// SPDX-License-Identifier: AGPL-3.0-only
// Claude: prompt motoru, görsel kalite kontrol ve Proje Kitabı çıkarımı.
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { PROMPT_TARGETS } from '../../shared/nodes'
import type { AssetSpec, Bible, GeneratedPrompt, QAReport } from '../../shared/types'
import type { LlmProvider } from '../../shared/types'
import { oaStructured, toOaParts } from '../ai/openai'
import { getSecret, getSettings, providerFor, providerKey } from '../settings'
import { sniffImage, truncateWords } from '../util'

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

// $ / 1M token (girdi, çıktı)
const PRICES: Record<string, [number, number]> = {
  'claude-fable-5-1': [10, 50],
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5]
}
// Sunucu tarafı yedek model (refusal fallback) desteği olan modeller
export const FALLBACK_MODELS = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5-5'])

export function usageCost(model: string, u: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }): number {
  const [pin, pout] = PRICES[model] ?? PRICES['claude-opus-5-5']
  const inputTokens = u.input_tokens + (u.cache_creation_input_tokens ?? 0) * 1.25 + (u.cache_read_input_tokens ?? 0) * 0.1
  return (inputTokens * pin + u.output_tokens * pout) / 1_000_000
}

export function client(): Anthropic {
  const apiKey = getSecret('anthropic')
  // Anahtar yoksa SDK ortam değişkeni / `ant auth login` profilini kullanır
  return apiKey ? new Anthropic({ apiKey }) : new Anthropic()
}

/** Sağlayıcıya göre Anthropic istemcisi (yerleşik Claude ya da Anthropic uyumlu özel uç) */
export function clientFor(p: LlmProvider): Anthropic {
  if (p.builtin) return client()
  return new Anthropic({ apiKey: providerKey(p) ?? 'none', baseURL: p.baseUrl || undefined })
}

export type Content = Anthropic.Beta.BetaContentBlockParam[]

/** SDK hatalarını kullanıcıya anlaşılır Türkçe mesajlara çevirir. */
export async function callClaude<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('Claude API anahtarı geçersiz (Ayarlar)', { cause: e })
    if (e instanceof Anthropic.PermissionDeniedError) throw new Error('Claude: bu model/özellik için yetki yok', { cause: e })
    if (e instanceof Anthropic.NotFoundError) throw new Error(`Claude modeli bulunamadı: ${getSettings().claudeModel}`, { cause: e })
    if (e instanceof Anthropic.RateLimitError) throw new Error('Claude istek sınırı aşıldı; biraz sonra tekrar deneyin veya eşzamanlı iş sayısını düşürün', { cause: e })
    if (e instanceof Anthropic.APIConnectionError) throw new Error('Claude sunucusuna bağlanılamadı (internet bağlantısı?)', { cause: e })
    if (e instanceof Anthropic.APIError) throw new Error(`Claude hatası (${e.status}): ${e.message}`, { cause: e })
    const msg = (e as Error).message ?? String(e)
    if (/authentication method/i.test(msg)) throw new Error('Claude API anahtarı girilmemiş (Ayarlar → Claude)', { cause: e })
    throw e
  }
}

export interface CallResult<T> {
  data: T
  usd: number
}

export async function structured<S extends z.ZodType>(
  schema: S,
  system: Anthropic.Beta.BetaTextBlockParam[],
  content: Content,
  effort: Effort,
  maxTokens = 16000,
  role: 'prompts' | 'vision' = 'prompts',
  provider?: LlmProvider
): Promise<CallResult<z.infer<S>>> {
  const p = provider ?? providerFor(role)
  if (p.kind === 'openai') {
    const sys = system.map((b) => b.text).join('\n\n')
    const data = await oaStructured(p, schema, sys, toOaParts(content as Parameters<typeof toOaParts>[0], p.vision), maxTokens)
    return { data, usd: 0 }
  }
  const model = p.builtin ? getSettings().claudeModel : p.model
  const useFallback = p.builtin && FALLBACK_MODELS.has(model)
  const res = await callClaude(() =>
    clientFor(p).beta.messages.parse(
      {
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content }],
        output_config: { format: betaZodOutputFormat(schema), effort },
        ...(useFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {})
      },
      { timeout: 15 * 60 * 1000 }
    )
  )
  if (res.stop_reason === 'refusal') {
    throw new Error(`Claude isteği reddetti${res.stop_details?.explanation ? `: ${res.stop_details.explanation}` : ''}`)
  }
  if (res.stop_reason === 'max_tokens') throw new Error('Claude yanıtı token sınırında kesildi')
  const data = res.parsed_output as z.infer<S> | null
  if (!data) throw new Error('Claude yapılandırılmış yanıt döndürmedi')
  return { data, usd: usageCost(model, res.usage) }
}

/** Proje Kitabını prompta konacak sade bir metne çevirir (sabit kalır → önbelleğe uygun). */
export function bibleContext(b: Bible): string {
  const lines = [
    `PROJECT: ${b.projectName} — ${b.genre}`,
    `SETTING: ${b.setting}`,
    `LORE SUMMARY: ${b.loreSummary}`,
    `ART DIRECTION: ${b.artDirection}`,
    `REALISM LEVEL: ${b.realism}`,
    `MOOD: ${b.moodKeywords.join(', ')}`,
    `FORBIDDEN: ${b.forbidden.join(', ')}`,
    `AUDIO DIRECTION: ${b.audioDirection}`,
    `TECH: default triangle budget ${b.technical.defaultTriBudget}, textures ${b.technical.textureRes}, PBR ${b.technical.pbr ? 'yes' : 'no'}, engine Unreal Engine 5`
  ]
  if (b.categories.length) {
    lines.push('CATEGORY RULES:')
    for (const c of b.categories) lines.push(`- ${c.code} ${c.name}: ${c.styleNotes} (budget ${c.triBudget || 'default'} tris, ${c.textureRes})`)
  }
  if (b.palette.length) {
    lines.push('PALETTE (code | name | hex | usage):')
    for (const p of b.palette) lines.push(`- ${p.code} | ${p.name} | ${p.hex} | ${p.usage}`)
  }
  if (b.materials.length) {
    lines.push('MATERIAL LIBRARY (name | description | palette | notes):')
    for (const m of b.materials) lines.push(`- ${m.name} | ${m.description} | ${m.palette} | ${m.notes}`)
  }
  return lines.join('\n')
}

export function assetContext(a: AssetSpec): string {
  const extra = Object.entries(a.extra)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
  return [
    `ID: ${a.id}`,
    `NAME (Turkish): ${a.name}`,
    `KIND: ${a.kind}`,
    `CATEGORY: ${a.category}${a.subcategory ? ' / ' + a.subcategory : ''}`,
    `DESIGN NOTE (Turkish): ${a.description}`,
    a.size && `SIZE (meters): ${a.size}`,
    a.materials && `COLOR / MATERIAL (palette codes): ${a.materials}`,
    a.variants && `VARIANTS: ${a.variants}`,
    (a.triBudget || a.budgetNote) && `TRIANGLE BUDGET: ${a.triBudget || ''} ${a.budgetNote}`,
    extra && `OTHER COLUMNS:\n${extra}`
  ]
    .filter(Boolean)
    .join('\n')
}

const PromptSchema = z.object({
  prompt: z.string().describe('Main prompt for the target service, in English'),
  negative_prompt: z.string().describe('Negative prompt, empty string if the target does not use one'),
  texture_prompt: z.string().describe('Texture/material prompt, empty string if not used'),
  duration_seconds: z.number().describe('Audio duration in seconds; 0 if not audio'),
  loop: z.boolean().describe('Whether the sound should loop seamlessly; false if not audio'),
  pose: z.enum(['none', 'a-pose', 't-pose']),
  rationale: z.string().describe('Short explanation in Turkish of the key choices')
})

const PROMPT_SYSTEM = `You are the prompt engineer of a game-asset production pipeline. You turn a row of the studio's asset list into the best possible prompt for one specific generative AI service.

Principles:
- Everything you write must fit the project bible: art direction, realism level, palette, material library, mood and forbidden list. Translate palette codes into concrete color names (and keep the hex in mind for accuracy).
- The asset list is written in Turkish; you write prompts in English, but the "rationale" field in Turkish.
- Be concrete and visual. Prefer physical descriptions (shape, construction, materials, wear) over abstract adjectives.
- Respect the target service's rules and character limit strictly. If information is missing, make reasonable choices consistent with the bible instead of asking.
- When reviewer feedback from a previous attempt is provided, fix every listed problem explicitly in the new prompt.`

export async function generatePrompt(input: { bible: Bible; asset: AssetSpec; targetId: string; extra: string; feedback: string[] }): Promise<CallResult<GeneratedPrompt>> {
  const target = PROMPT_TARGETS[input.targetId]
  if (!target) throw new Error(`Bilinmeyen prompt hedefi: ${input.targetId}`)
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: 'text', text: PROMPT_SYSTEM },
    { type: 'text', text: `PROJECT BIBLE\n${bibleContext(input.bible)}`, cache_control: { type: 'ephemeral' } }
  ]
  const parts = [
    `TARGET SERVICE: ${target.label}`,
    `HARD LIMIT: "prompt" and "texture_prompt" must each be at most ${target.maxChars} characters.`,
    `Uses negative prompt: ${target.usesNegative ? 'yes' : 'no'} · uses texture prompt: ${target.usesTexturePrompt ? 'yes' : 'no'} · uses duration: ${target.usesDuration ? 'yes' : 'no'}`,
    'TARGET RULES:',
    ...target.rules.map((r) => `- ${r}`),
    '',
    'ASSET ROW:',
    assetContext(input.asset)
  ]
  if (input.extra.trim()) parts.push('', `PIPELINE INSTRUCTION: ${input.extra.trim()}`)
  if (input.feedback.length) {
    parts.push('', 'REVIEWER FEEDBACK FROM PREVIOUS ATTEMPTS (fix all of it):')
    input.feedback.forEach((f, i) => parts.push(`Attempt ${i + 1}: ${f}`))
  }

  let total = 0
  let result: GeneratedPrompt | null = null
  let note = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = parts.join('\n') + note
    const { data, usd } = await structured(PromptSchema, system, [{ type: 'text', text }], 'medium', 8000)
    total += usd
    result = { target: target.id, ...data }
    const tooLong = data.prompt.length > target.maxChars || data.texture_prompt.length > target.maxChars
    if (!tooLong) break
    note = `\n\nYour previous prompt was ${data.prompt.length} characters (texture ${data.texture_prompt.length}). Rewrite within ${target.maxChars} characters.`
  }
  if (!result) throw new Error('Prompt üretilemedi')
  result.prompt = truncateWords(result.prompt, target.maxChars)
  result.texture_prompt = truncateWords(result.texture_prompt, target.maxChars)
  return { data: result, usd: total }
}

// ---------------------------------------------------------------------------

const QASchema = z.object({
  score: z.number().describe('0-10 overall quality and fit to the brief'),
  issues: z.array(z.string()).describe('Concrete problems, in Turkish'),
  strengths: z.array(z.string()).describe('What works, in Turkish'),
  prompt_fix: z.string().describe('English instructions to add to the next generation prompt to fix the issues'),
  summary: z.string().describe('One or two sentence verdict in Turkish')
})

const QA_SYSTEM = `You are the art director and technical artist reviewing AI-generated game assets before they enter an Unreal Engine 5 project.

Score 0-10 against the brief and the project bible:
- Fit: does it match the asset description, category, size and materials/palette?
- Readability: clear silhouette, believable construction, consistent style with the art direction.
- Production quality: no melted/blobby geometry, floating fragments, duplicated parts, broken symmetry where symmetry is expected, smeared or stretched textures, baked harsh lighting, text/logos, cropped or partial subject.
- For reference images that will be converted to 3D: single centered subject, fully visible, clean plain background, even lighting.
- Technical facts provided by the pipeline (triangle count vs budget, UVs, dimensions) are measured truth; weigh them.

A 7 means "usable in production after minor touch-ups". Be strict but fair; list concrete, fixable issues.`

export async function reviewAsset(input: {
  bible: Bible
  asset: AssetSpec
  subjectKind: string
  images: string[]
  technical: string[]
  focus: string
}): Promise<CallResult<Omit<QAReport, 'pass' | 'technical'>>> {
  const content: Content = []
  for (const img of input.images.slice(0, 6)) {
    const buf = fs.readFileSync(img)
    const media = sniffImage(buf)
    if (!media) continue
    content.push({ type: 'text', text: `Image: ${path.basename(img)}` })
    content.push({ type: 'image', source: { type: 'base64', media_type: media, data: buf.toString('base64') } })
  }
  const text = [
    `SUBJECT TYPE: ${input.subjectKind}`,
    'ASSET BRIEF:',
    assetContext(input.asset),
    input.technical.length ? `\nMEASURED TECHNICAL FACTS:\n${input.technical.map((t) => '- ' + t).join('\n')}` : '',
    input.focus.trim() ? `\nEXTRA CRITERIA: ${input.focus.trim()}` : '',
    content.length ? '' : '\n(No images available — judge only the technical facts.)'
  ].join('\n')
  content.push({ type: 'text', text })
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: 'text', text: QA_SYSTEM },
    { type: 'text', text: `PROJECT BIBLE\n${bibleContext(input.bible)}`, cache_control: { type: 'ephemeral' } }
  ]
  return structured(QASchema, system, content, 'medium', 8000, 'vision')
}

// ---------------------------------------------------------------------------

const BibleSchema = z.object({
  projectName: z.string(),
  genre: z.string(),
  setting: z.string().describe('Where and when the game takes place, 2-4 sentences, Turkish'),
  loreSummary: z.string().describe('Core lore relevant to visual/audio design, max ~200 words, Turkish'),
  artDirection: z.string().describe('Concrete visual language: shapes, construction logic, wear, lighting mood, references. English, max ~200 words'),
  realism: z.string().describe('e.g. "grounded realistic PBR, slightly stylized silhouettes"'),
  moodKeywords: z.array(z.string()),
  forbidden: z.array(z.string()).describe('Visual or audio things that must never appear'),
  audioDirection: z.string().describe('Sound design direction, English'),
  categories: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      styleNotes: z.string().describe('English style notes for this category'),
      triBudget: z.number().describe('Typical triangle budget, 0 if unknown'),
      textureRes: z.enum(['1k', '2k', '4k', '8k'])
    })
  ),
  defaultTriBudget: z.number(),
  textureRes: z.enum(['1k', '2k', '4k', '8k'])
})

export async function extractBible(input: { pdfs: string[]; current: Bible; categoryHint: string }): Promise<CallResult<Partial<Bible>>> {
  const content: Content = []
  for (const pdf of input.pdfs) {
    const data = fs.readFileSync(pdf).toString('base64')
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data }, title: path.basename(pdf) })
  }
  content.push({
    type: 'text',
    text: [
      'These documents are the universe handbook / game design documents of a game. Extract a production "project bible" that an AI asset pipeline will use to write prompts and review assets.',
      'Focus on what affects how 3D models, textures and sounds should look and sound. Be specific and faithful to the documents; do not invent lore.',
      input.categoryHint ? `Asset list category codes in use: ${input.categoryHint}. Produce one category rule per code.` : '',
      `Current bible (improve, keep good values): ${JSON.stringify({ ...input.current, palette: undefined, materials: undefined })}`
    ].join('\n')
  })
  const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: 'text', text: 'You are a lead art director building a concise production bible from design documents.' }]
  const { data, usd } = await structured(BibleSchema, system, content, 'high', 16000)
  const { defaultTriBudget, textureRes, ...rest } = data
  return {
    usd,
    data: {
      ...rest,
      technical: { ...input.current.technical, defaultTriBudget: defaultTriBudget || input.current.technical.defaultTriBudget, textureRes }
    }
  }
}

export async function testClaude(): Promise<string> {
  const res = await callClaude(() =>
    client().messages.create({
      model: getSettings().claudeModel,
      max_tokens: 64,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Reply with: OK' }]
    })
  )
  const t = res.content.find((c) => c.type === 'text')
  return t && t.type === 'text' ? t.text : (res.stop_reason ?? '')
}

// ---------------------------------------------------------------------------
// Animasyon Stüdyosu: Türkçe hareket tarifini Kimodo segmentlerine çevirir

const MotionSchema = z.object({
  name: z.string().describe('Short PascalCase English clip name, e.g. "RunToStop"'),
  loop: z.boolean().describe('true for cyclic locomotion clips (idle, walk, run)'),
  segments: z
    .array(
      z.object({
        text: z.string().describe('English Kimodo prompt for this segment, starting with "A person"'),
        seconds: z.number().describe('Segment length in seconds, 1-10')
      })
    )
    .min(1)
    .max(6)
})

export async function suggestMotion(bible: Bible, text: string, character: string): Promise<CallResult<z.infer<typeof MotionSchema>>> {
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    {
      type: 'text',
      text: `You write motion prompts for NVIDIA Kimodo, a text-to-human-motion diffusion model (full body, no props, no environment). Split the requested motion into 1-6 sequential segments; each segment is one clear action in present tense starting with "A person", with speed, style and mood. Kimodo blends segments with short transitions. Keep total length realistic (usually 2-12 s). Prefer cyclic single segments for locomotion loops.\n\nPROJECT BIBLE\n${bibleContext(bible)}`
    }
  ]
  const content: Content = [{ type: 'text', text: `Character: ${character || 'generic human'}\nRequested motion (Turkish): ${text}` }]
  return structured(MotionSchema, system, content, 'low', 4000)
}

// ---------------------------------------------------------------------------
// Animasyon sistemi planlayıcı: şablon klip setini karakter + tarif için uyarlar

const SystemPlanSchema = z.object({
  name: z.string().describe('Short Turkish system name, e.g. "Asker Lokomosyon"'),
  style: z.string().describe('Kimodo subject phrase used for EVERY clip, e.g. "A tired soldier", "A stealthy person", "An old person". Must start with A/An.'),
  rationale: z.string().describe('2-4 Turkish sentences: what you changed and why'),
  clips: z
    .array(
      z.object({
        key: z.string().describe('Existing clip key to modify, or a NEW unique snake_case key to add'),
        enabled: z.boolean(),
        prompt: z.string().describe('Kimodo prompt using the literal placeholder {S} as subject, e.g. "{S} walks forward carefully, scanning around."'),
        seconds: z.number(),
        speed: z.number().describe('m/s (start speed for start/stop/pivot)'),
        speedEnd: z.number().optional(),
        moveDir: z.number().describe('deg relative to facing, right positive'),
        turn: z.number().describe('total yaw change deg, right positive'),
        role: z.enum(['idle', 'loop', 'start', 'stop', 'turn', 'pivot', 'action', 'jump_start', 'jump_loop', 'land', 'aim', 'other']),
        label: z.string().describe('Short Turkish label'),
        group: z.string().describe('Turkish group name'),
        loop: z.boolean(),
        from: z.string().optional().describe('key whose LAST pose this clip starts from'),
        to: z.string().optional().describe('key whose FIRST pose this clip ends in')
      })
    )
    .max(60)
})

export async function planAnimSystem(
  bible: Bible,
  sys: { kind: string; title: string; style: string; clips: unknown[] },
  character: string,
  request: string
): Promise<CallResult<z.infer<typeof SystemPlanSchema>>> {
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    {
      type: 'text',
      text: `You are a senior game animation director planning a synchronized, complementary animation set that will be generated by NVIDIA Kimodo (text-to-motion diffusion, full body human, no props/environment, best with "A person..." style subjects, trained on locomotion, everyday actions, videogame combat, dancing and styles like tired/angry/happy/sad/scared/drunk/injured/stealthy/old/childlike; max 10 s per clip).
AssetForge then constrains root paths (speed/direction/turn), locks transition endpoints to neighbour poses (from/to), cuts clean loops at left-foot plants, adds L/R sync markers and builds the Unreal asset (${sys.title}).

Rules:
- Keep ONE consistent subject/style for all clips (the "style" field); prompts use {S} as the subject placeholder.
- Keep existing keys unless the request asks otherwise; you may disable clips or add new ones (variations are valuable for motion matching).
- Realistic speeds: walk 1.2-1.7, jog 2.8-3.6, run 4.5-6 m/s; adjust to the character (injured/old slower, soldier jog with gear ~3.0).
- Loops: one gait cycle is ~1.0-1.3 s walking, 0.7-0.9 s jogging; idles 2.5-4 s.
- Transitions must reference real keys in from/to. Return the COMPLETE clip list.

PROJECT BIBLE
${bibleContext(bible)}`
    }
  ]
  const content: Content = [
    {
      type: 'text',
      text: `System kind: ${sys.kind}\nCharacter: ${character || 'generic human'}\nCurrent style: ${sys.style}\nCurrent clips (JSON):\n${JSON.stringify(sys.clips)}\n\nUser request (Turkish): ${request || 'Karaktere uygun hale getir.'}`
    }
  ]
  return structured(SystemPlanSchema, system, content, 'medium', 16000)
}
