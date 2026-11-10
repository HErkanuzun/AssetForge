// SPDX-License-Identifier: AGPL-3.0-only
// Oyun tasarımı yazarı: çekirdek fikir, oyun / hikâye döngüleri (akış şeması), hikâye ve arayüz ekranları.
// API (Ayarlar'daki LLM) ya da aboneliğinle Claude Code / Codex CLI ile çalışır.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { circleLayout, designContext, newId, normalizeDesign } from '../../shared/design'
import type { DesignGraph, DesignSection, GameDesign, Project, UiScreen } from '../../shared/types'
import { runTaskAgent, type AgentEngine } from '../agent/taskAgent'
import { ensureDir } from '../util'
import { bibleContext, structured } from './claude'

const NodeType = z.enum(['action', 'challenge', 'reward', 'progress', 'decision', 'story', 'state'])

const CoreSchema = z.object({
  pitch: z.string().describe('One-sentence Turkish elevator pitch'),
  fantasy: z.string().describe('Turkish: the player fantasy — what it feels like to play'),
  audience: z.string().describe('Turkish: target audience and platform'),
  pillars: z.array(z.string()).describe('3-5 Turkish design pillars, each a short rule used to accept/reject features'),
  mechanics: z.array(z.object({ name: z.string(), description: z.string() })).describe('Core mechanics, Turkish')
})

const LoopsSchema = z.object({
  loops: z.array(
    z.object({
      name: z.string().describe('Turkish loop name'),
      scope: z.enum(['core', 'session', 'meta', 'story', 'other']),
      description: z.string().describe('Turkish: why this loop is fun / what it sustains'),
      nodes: z.array(
        z.object({
          key: z.string().describe('short snake_case id'),
          label: z.string().describe('Turkish, 1-4 words'),
          type: NodeType,
          note: z.string().describe('Turkish detail: numbers, rules, feel')
        })
      ),
      edges: z.array(z.object({ from: z.string().describe('node key'), to: z.string().describe('node key'), label: z.string().describe('Turkish condition/trigger, may be empty') }))
    })
  )
})

const StorySchema = z.object({
  premise: z.string().describe('Turkish premise, 3-6 sentences'),
  themes: z.array(z.string()),
  acts: z.array(z.object({ title: z.string(), summary: z.string(), beats: z.array(z.string()).describe('Turkish story beats in order') })),
  characters: z.array(z.object({ name: z.string(), role: z.string(), description: z.string(), arc: z.string() }))
})

const ScreensSchema = z.object({
  screens: z.array(
    z.object({
      key: z.string().describe('short snake_case id'),
      name: z.string().describe('Turkish screen name'),
      purpose: z.string(),
      when: z.string().describe('Turkish: when it is shown / which input opens it'),
      layer: z.enum(['hud', 'menu', 'popup']),
      widgets: z.array(
        z.object({
          type: z.enum(['text', 'button', 'image', 'bar', 'list', 'icon', 'input', 'panel']),
          label: z.string().describe('Turkish label as the player sees it'),
          binding: z.string().describe('Game data it shows, e.g. Player.Health, Vehicle.SpeedKmh; empty for static')
        })
      ),
      next: z.array(z.string()).describe('keys of screens reachable from here')
    })
  )
})

const SCHEMAS = { core: CoreSchema, loops: LoopsSchema, story: StorySchema, screens: ScreensSchema } as const

const GUIDE: Record<DesignSection, string> = {
  core: 'Write the core concept: pitch, player fantasy, audience, 3-5 design pillars and the core mechanics. Pillars must be concrete enough to reject features.',
  loops:
    'Design the gameplay loops as flowcharts. Always include one "core" loop (seconds, the moment-to-moment action), one "session" loop (minutes: mission/match/run) and one "meta" loop (long-term progression/economy); add a "story" loop if the game has narrative. Each loop is a CYCLE: the last node must lead back to the first. 4-8 nodes per loop; typical shape action → challenge → reward → progress → back. Put numbers in notes (durations, costs, drop rates) where it matters.',
  story:
    'Write the story: premise, themes, acts (usually 3) with ordered beats, and the main characters with their arcs. The story must serve the gameplay loops and pillars; beats should map to things the player does.',
  screens:
    'Design the in-game UI: main menu, HUD, pause, settings, inventory/garage/upgrade or whatever the loops need, results/game over, and popups. For each screen list its widgets with data bindings, and the screens you can navigate to. HUD shows only what the core loop needs.'
}

const SYSTEM = `You are a senior game designer and narrative designer helping an indie developer build an Unreal Engine 5 game.
You write in Turkish (JSON keys and enum values stay English). Be specific to THIS game: use its setting, mood and existing assets; avoid generic filler.
Design for fun and clarity: every element must support the design pillars. Keep scope realistic for a small team.`

export interface DesignGenInput {
  project: Project
  section: DesignSection
  instruction: string
  engine: AgentEngine
  outDir: string
  log?: (m: string) => void
  signal?: AbortSignal
}

function context(p: Project, section: DesignSection, instruction: string): string {
  const d = normalizeDesign(p.design)
  const current =
    section === 'core'
      ? { pitch: d.pitch, fantasy: d.fantasy, audience: d.audience, pillars: d.pillars, mechanics: d.mechanics }
      : section === 'story'
        ? d.story
        : section === 'loops'
          ? d.loops
          : d.screens
  const hasCurrent = JSON.stringify(current).replace(/[\s"[\]{}:,]|pitch|fantasy|audience|pillars|mechanics|premise|themes|acts|characters/g, '').length > 0
  const assets = p.assets
    .filter((a) => !a.parentId)
    .slice(0, 60)
    .map((a) => `${a.name} (${a.kind})`)
    .join(', ')
  return [
    `PROJECT BIBLE\n${bibleContext(p.bible)}`,
    designContext(d),
    assets ? `ASSET LIBRARY: ${assets}` : '',
    hasCurrent ? `CURRENT ${section.toUpperCase()} (improve it; keep what is good unless the instruction says otherwise):\n${JSON.stringify(current, null, 1)}` : '',
    `TASK: ${GUIDE[section]}`,
    instruction ? `DEVELOPER'S INSTRUCTION: ${instruction}` : ''
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Şemaya uyan JSON'u API ya da CLI ajanıyla üretir */
async function generateJson<S extends z.ZodType>(schema: S, prompt: string, o: DesignGenInput): Promise<{ data: z.infer<S>; usd: number }> {
  if (o.engine === 'api') {
    const r = await structured(schema, [{ type: 'text', text: SYSTEM }], [{ type: 'text', text: prompt }], 'high', 32000)
    return { data: r.data, usd: r.usd }
  }
  ensureDir(o.outDir)
  const file = path.join(o.outDir, `design_${o.section}.json`)
  fs.rmSync(file, { force: true })
  let usd = 0
  let lastError = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    const task = [
      prompt,
      `\nOUTPUT: write the result as a single JSON object to ${file} (UTF-8, no comments, no code fences). It must validate against this JSON Schema:\n${JSON.stringify(z.toJSONSchema(schema))}`,
      lastError ? `\nYour previous file did not validate: ${lastError}. Fix it.` : '',
      '\nDo not modify any other file. Reply with one short Turkish sentence when done.'
    ].join('\n')
    await runTaskAgent({
      engine: o.engine,
      providerId: '',
      mcp: 'none',
      system: SYSTEM,
      task,
      images: [],
      readDirs: [],
      outDir: o.outDir,
      maxRounds: 10,
      timeoutMin: 15,
      shell: false,
      cliModel: '',
      log: o.log ?? (() => undefined),
      cost: (c) => (usd += c),
      signal: o.signal ?? new AbortController().signal
    })
    if (!fs.existsSync(file)) {
      lastError = 'the file was not written'
      continue
    }
    try {
      const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').trim()
      return { data: schema.parse(JSON.parse(raw)), usd }
    } catch (e) {
      lastError = (e as Error).message.slice(0, 1500)
    }
  }
  throw new Error(`Tasarım ajanı geçerli JSON üretemedi: ${lastError}`)
}

/** Bir tasarım bölümünü üretir / geliştirir; yalnızca o bölümü içeren kısmi tasarım döner */
export async function generateDesignSection(o: DesignGenInput): Promise<{ data: Partial<GameDesign>; usd: number }> {
  const prompt = context(o.project, o.section, o.instruction)
  const { data, usd } = await generateJson(SCHEMAS[o.section], prompt, o)
  return { data: toDesign(o.section, data), usd }
}

/** Yapay zekâ çıktısını uygulama modeline çevirir (id'ler, yerleşim) */
export function toDesign(section: DesignSection, raw: unknown): Partial<GameDesign> {
  switch (section) {
    case 'core':
      return raw as z.infer<typeof CoreSchema>
    case 'story': {
      const s = raw as z.infer<typeof StorySchema>
      return {
        story: {
          premise: s.premise,
          themes: s.themes,
          acts: s.acts.map((a) => ({ id: newId('act'), ...a })),
          characters: s.characters.map((c) => ({ id: newId('chr'), ...c }))
        }
      }
    }
    case 'loops': {
      const s = raw as z.infer<typeof LoopsSchema>
      const loops: DesignGraph[] = s.loops.map((l) => {
        const ids = new Map(l.nodes.map((n) => [n.key, newId('n')]))
        const nodes = circleLayout(l.nodes.map((n) => ({ id: ids.get(n.key)!, label: n.label, type: n.type, note: n.note, x: 0, y: 0 })))
        const edges = l.edges.filter((e) => ids.has(e.from) && ids.has(e.to)).map((e) => ({ id: newId('e'), from: ids.get(e.from)!, to: ids.get(e.to)!, label: e.label }))
        return { id: newId('loop'), name: l.name, scope: l.scope, description: l.description, nodes, edges }
      })
      return { loops }
    }
    case 'screens': {
      const s = raw as z.infer<typeof ScreensSchema>
      const ids = new Map(s.screens.map((x) => [x.key, newId('scr')]))
      const screens: UiScreen[] = s.screens.map((x) => ({
        id: ids.get(x.key)!,
        name: x.name,
        purpose: x.purpose,
        when: x.when,
        layer: x.layer,
        widgets: x.widgets,
        next: x.next.map((k) => ids.get(k)).filter((v): v is string => !!v)
      }))
      return { screens }
    }
  }
}
