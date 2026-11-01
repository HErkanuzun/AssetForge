// Yapımcı: projenin tamamını araçlarla yöneten sohbet asistanı (Claude ya da OpenAI uyumlu herhangi bir model).
import type Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'
import type { AgentConversation, AgentEvent, AgentInput, AgentViewItem, LlmProvider, Project } from '../../shared/types'
import { oaChatStream, type OaMessage, type OaPart, type OaTool } from '../ai/openai'
import type { Runner } from '../engine/runner'
import { loadProject } from '../project'
import { bibleContext, callClaude, clientFor, FALLBACK_MODELS, usageCost } from '../providers/claude'
import { allProviders, getSettings, providerFor } from '../settings'
import { ensureDir, newId, sniffImage } from '../util'
import { externalTools } from './mcpClient'
import { builtinTools, type AgentTool, type ToolCtx, type ToolResult } from './tools'

const SYSTEM = `You are "Yapımcı" (the Producer) — the AI production lead built into AssetForge, a game-asset factory for the user's Unreal Engine 5 game. You help with every step of making a high-quality, realistic game: planning, art direction, asset lists, 3D models, textures, characters, vehicles, audio, VFX, animation and Unreal integration. You act through tools; the user watches the results in the app.

LANGUAGE: Always answer in Turkish. Asset descriptions you write (that feed AI generators) may be Turkish; motion segments for Kimodo must be English.

HOW YOU WORK
- Look before you act: call project_overview at the start of a task, read assets/bible/jobs with tools instead of guessing. Never invent tool results, file paths or scores.
- For multi-step work, state a short plan (numbered), then execute. Spending tools (run_pipeline, generate_animation, unreal_python, bible edits, external tools) ask the user for approval in the UI automatically — call them directly when the plan is agreed; don't ask twice in text.
- After production: wait_for_job, then view_asset and judge the result against the bible (silhouette, proportions, materials, palette, wear, scale, triangle budget, UVs). Be a strict art director. If it's not good enough, improve the asset description (upsert_asset) with concrete fixes and re-run.
- Keep replies short and skimmable. Use the user's terms. When something is impossible or a tool/service is missing (API key, Blender, Kimodo, Unreal not open), say exactly what the user must do.
- The user's current page and selected assets are given as context; "bunlar / seçtiklerim" refers to them.

PRODUCTION KNOWLEDGE (UE5, realistic)
- Budgets: hero character 40-60k tris, NPC/creature 15-30k, LODs 50/25/10 %, hero vehicle 60-120k (body + separate doors/hood/wheels), small props 0.5-5k, large static props can use Nanite. Texel density ~10.24 px/cm for first-person-close assets, 5.12 for the rest. PBR, no baked lighting in albedo.
- Characters use the UE5 Manny/Quinn skeleton (AssetForge renames bones, adds root, builds IK Rig + retargeter). For synchronized animation SETS use the animation-system tools instead of single clips: create_anim_system (kinds: blendspace1d speed, blendspace2d direction×speed, montage actions, statemachine jump, aimoffset, motionmatching dance card; pass a Turkish request so the planner adapts speeds/prompts/style), then produce_anim_system (pose-matched phases: idles/loops first, then starts/stops/turns/pivots locked to their poses; loops cut at left-foot plants with L/R sync markers measured), then build_anim_system (creates the Unreal Blend Space / Aim Offset / Montages / Pose Search Schema+Database). AnimBP graphs cannot be wired from Python — explain the remaining manual hookup. generate_animation is for one-off clips.
- Vehicles: complexity tiers (1 static body; 2 separate wheels/doors/hood + suspension pivots; 3 full rig with suspension arms, springs, brake calipers). Plus engine sound (dynamic RPM-layered MetaSound), door/horn/crash one-shots, tire/skid per surface, dust/exhaust/impact VFX matched to ground textures in the library.
- Audio: for one-shots plan 3-5 variations to avoid repetition; surface-dependent sounds (footsteps, tires) per physical material; ambience loops per biome.
- VFX: sprite/flipbook sources here, Niagara systems in Unreal (unreal_python can create/adjust assets).
- Be honest about AI generation limits: generated meshes are triangulated and may need cleanup; for hero realism recommend scan/library sources (Fab/Megascans) or manual retopo where it clearly beats generation.

AVAILABLE PIPELINES are listed by list_pipelines; asset kinds: model, character, creature, vehicle, weapon, texture, image, sfx, music, vfx, animation.`

const MAX_ROUNDS = 30

function dirOf(dir: string): string {
  return ensureDir(path.join(dir, 'assistant'))
}
const fileOf = (dir: string, id: string) => path.join(dirOf(dir), `${id}.json`)

function save(dir: string, c: AgentConversation): void {
  const f = fileOf(dir, c.id)
  fs.writeFileSync(f + '.tmp', JSON.stringify(c))
  fs.renameSync(f + '.tmp', f)
}

export function loadConv(dir: string, id: string): AgentConversation | null {
  try {
    return JSON.parse(fs.readFileSync(fileOf(dir, id), 'utf8'))
  } catch {
    return null
  }
}

const strip = (c: AgentConversation): AgentConversation => ({ ...c, history: [], busy: running.has(c.id) })

export function listConvs(dir: string): AgentConversation[] {
  return fs
    .readdirSync(dirOf(dir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => loadConv(dir, f.slice(0, -5)))
    .filter((c): c is AgentConversation => !!c)
    .map(strip)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function createConv(dir: string, providerId?: string): AgentConversation {
  const p = (providerId && allProviders().find((x) => x.id === providerId)) || providerFor('assistant')
  const now = Date.now()
  const c: AgentConversation = { id: newId('chat'), title: 'Yeni sohbet', providerId: p.id, model: p.model, createdAt: now, updatedAt: now, view: [], history: [], costUsd: 0 }
  save(dir, c)
  return c
}

export function deleteConv(dir: string, id: string): void {
  fs.rmSync(fileOf(dir, id), { force: true })
}

// --------------------------------------------------------------------------- onay ve durdurma

const running = new Map<string, AbortController>()
const approvals = new Map<string, (ok: boolean) => void>()

export function approve(convId: string, toolId: string, ok: boolean): void {
  approvals.get(`${convId}:${toolId}`)?.(ok)
}

export function stopConv(convId: string): void {
  running.get(convId)?.abort()
  for (const [k, fn] of approvals) if (k.startsWith(convId + ':')) fn(false)
}

// --------------------------------------------------------------------------- yardımcılar

function imageB64(f: string): { media: string; data: string } | null {
  try {
    const buf = fs.readFileSync(f)
    const media = sniffImage(buf)
    if (!media || buf.length > 4_500_000) return null
    return { media, data: buf.toString('base64') }
  } catch {
    return null
  }
}

function libraryContext(p: Project): string {
  const lines = p.assets.slice(0, 150).map((a) => `${a.id} ${a.name} [${a.kind}, ${a.status || '—'}]${a.parentId ? ` ← ${a.parentId}` : ''}`)
  return `LIBRARY (${p.assets.length} assets${p.assets.length > 150 ? ', first 150' : ''}):\n${lines.join('\n')}`
}

function contextLine(input: AgentInput, p: Project): string {
  const c = input.context
  if (!c) return ''
  const PAGES: Record<string, string> = { home: 'Atölye', library: 'Kütüphane', anim: 'Animasyon Stüdyosu', pipeline: 'Hatlar', jobs: 'Üretim kuyruğu', bible: 'Proje Kitabı', settings: 'Ayarlar' }
  const sel = c.selectedAssets
    .map((id) => p.assets.find((a) => a.id === id))
    .filter(Boolean)
    .map((a) => `${a!.id} ${a!.name}`)
  return `[Bağlam: kullanıcı ${PAGES[c.page] ?? c.page} sayfasında${c.briefId ? `, açık brief ${c.briefId}` : ''}${sel.length ? `; seçili asset'ler: ${sel.join(', ')}` : ''}]`
}

function summarizeInput(name: string, input: unknown): string {
  const s = JSON.stringify(input ?? {})
  return s.length > 160 ? s.slice(0, 160) + '…' : s
}

interface Deps {
  runner: Runner
  notify: (p: Project) => void
  emit: (e: AgentEvent) => void
}

/** Bir aracı doğrula → (gerekirse) onay al → çalıştır; görünümü günceller */
async function execTool(
  dir: string,
  c: AgentConversation,
  tools: AgentTool[],
  call: { id: string; name: string; input: unknown },
  deps: Deps,
  signal: AbortSignal
): Promise<ToolResult> {
  const item: Extract<AgentViewItem, { kind: 'tool' }> = { kind: 'tool', id: call.id, name: call.name, input: call.input, status: 'running' }
  c.view.push(item)
  const push = () => {
    c.updatedAt = Date.now()
    save(dir, c)
    deps.emit({ type: 'conv', conv: strip(c) })
  }
  const t = tools.find((x) => x.name === call.name)
  if (!t) {
    item.status = 'error'
    item.result = 'Bilinmeyen araç'
    push()
    return { text: `Unknown tool: ${call.name}`, isError: true }
  }
  const parsed = t.parse(call.input)
  if (!parsed.ok) {
    item.status = 'error'
    item.result = parsed.error
    push()
    return { text: `INVALID_INPUT: ${parsed.error}`, isError: true }
  }
  const ask = t.confirm?.(parsed.data)
  if (ask) {
    item.status = 'awaiting'
    item.ask = ask
    push()
    const ok = await new Promise<boolean>((resolve) => {
      if (signal.aborted) return resolve(false)
      approvals.set(`${c.id}:${call.id}`, resolve)
      signal.addEventListener('abort', () => resolve(false), { once: true })
    })
    approvals.delete(`${c.id}:${call.id}`)
    if (!ok) {
      item.status = 'denied'
      push()
      return { text: 'The user declined this action. Do not retry it unless they ask; propose an alternative or ask what they want.', isError: true }
    }
    item.status = 'running'
  }
  push()
  try {
    const ctx: ToolCtx = { dir, runner: deps.runner, notify: deps.notify, source: 'assistant' }
    const r = await t.run(ctx, parsed.data)
    item.status = r.isError ? 'error' : 'done'
    item.result = r.text.length > 4000 ? r.text.slice(0, 4000) + '…' : r.text
    // Görseller arayüzde forge:// ile gösterilir → proje klasörü dışındakileri kopyala
    item.images = (r.images ?? []).map((f) => {
      if (path.resolve(f).toLowerCase().startsWith(path.resolve(dir).toLowerCase() + path.sep)) return f
      const dest = path.join(ensureDir(path.join(dirOf(dir), 'media')), `${Date.now()}_${path.basename(f)}`)
      fs.copyFileSync(f, dest)
      return dest
    })
    push()
    return { ...r, images: item.images }
  } catch (e) {
    item.status = 'error'
    item.result = (e as Error).message
    push()
    return { text: `Error: ${(e as Error).message}`, isError: true }
  }
}

// --------------------------------------------------------------------------- ana döngü

export async function sendAgent(dir: string, convId: string, input: AgentInput, deps: Deps): Promise<AgentConversation> {
  const c = loadConv(dir, convId)
  if (!c) throw new Error('Sohbet bulunamadı')
  if (running.has(convId)) throw new Error('Asistan hâlâ çalışıyor')
  const provider = allProviders().find((p) => p.id === c.providerId)
  if (!provider) throw new Error('Bu sohbetin sağlayıcısı silinmiş; yeni sohbet açın')
  const ac = new AbortController()
  running.set(convId, ac)

  const project = loadProject(dir)
  // Kullanıcının bıraktığı görselleri proje içine kopyala (arayüzde gösterilebilsin)
  const images = (input.images ?? [])
    .filter((f) => fs.existsSync(f))
    .map((f) => {
      const dest = path.join(ensureDir(path.join(dirOf(dir), 'media')), `${Date.now()}_${path.basename(f)}`)
      fs.copyFileSync(f, dest)
      return dest
    })
  const ctxLine = contextLine(input, project)
  c.view.push({ kind: 'user', text: input.text, images, context: ctxLine || undefined })
  if (c.title === 'Yeni sohbet' && input.text.trim()) c.title = input.text.trim().slice(0, 60)
  c.updatedAt = Date.now()
  save(dir, c)
  deps.emit({ type: 'conv', conv: strip(c) })

  try {
    const tools = [...builtinTools(), ...(await externalTools(dir))]
    const sys = `${SYSTEM}\n\nTODAY: ${new Date().toISOString().slice(0, 10)}`
    const projectCtx = `PROJECT BIBLE\n${bibleContext(project.bible)}\n\n${libraryContext(project)}`
    const userText = [ctxLine, input.text].filter(Boolean).join('\n')
    if (provider.kind === 'anthropic') await anthropicLoop(dir, c, provider, tools, sys, projectCtx, userText, images, deps, ac.signal)
    else await openaiLoop(dir, c, provider, tools, `${sys}\n\n${projectCtx}`, userText, images, deps, ac.signal)
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' || ac.signal.aborted ? 'Durduruldu.' : (e as Error).message
    c.view.push({ kind: 'event', text: msg })
    if (msg !== 'Durduruldu.') deps.emit({ type: 'error', convId, error: msg })
  } finally {
    running.delete(convId)
    c.updatedAt = Date.now()
    save(dir, c)
    deps.emit({ type: 'thinking', convId, on: false })
    deps.emit({ type: 'conv', conv: strip(c) })
  }
  return strip(c)
}

type AMsg = Anthropic.Beta.BetaMessageParam
type ABlock = Anthropic.Beta.BetaContentBlockParam

async function anthropicLoop(
  dir: string,
  c: AgentConversation,
  p: LlmProvider,
  tools: AgentTool[],
  sys: string,
  projectCtx: string,
  userText: string,
  images: string[],
  deps: Deps,
  signal: AbortSignal
): Promise<void> {
  const history = c.history as AMsg[]
  const content: ABlock[] = []
  // Önceki tur yarıda kaldıysa: cevapsız tool_use'lara sonuç ekle
  const last = history[history.length - 1]
  if (last?.role === 'assistant' && Array.isArray(last.content)) {
    for (const b of last.content as ABlock[]) if (b.type === 'tool_use') content.push({ type: 'tool_result', tool_use_id: b.id, content: 'Interrupted (app closed or stopped).', is_error: true })
  }
  for (const f of images) {
    const img = imageB64(f)
    if (img) content.push({ type: 'image', source: { type: 'base64', media_type: img.media as 'image/png', data: img.data } })
  }
  content.push({ type: 'text', text: userText || '(görsel)' })
  history.push({ role: 'user', content })

  const model = p.builtin ? getSettings().claudeModel : p.model
  const client = clientFor(p)
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: 'text', text: sys },
    { type: 'text', text: projectCtx, cache_control: { type: 'ephemeral' } }
  ]
  let useWeb = p.builtin && getSettings().webSearch
  const toolDefs = () =>
    [
      ...tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema as Anthropic.Beta.BetaTool.InputSchema, eager_input_streaming: true })),
      ...(useWeb ? [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: 5 }] : [])
    ] as Anthropic.Beta.BetaToolUnion[]

  for (let round = 0; round < MAX_ROUNDS; round++) {
    let live = ''
    let msg: Anthropic.Beta.BetaMessage
    try {
      const stream = await callClaude(async () =>
        client.beta.messages.stream(
          {
            model,
            max_tokens: 16000,
            system,
            tools: toolDefs(),
            messages: history,
            thinking: { type: 'adaptive' },
            output_config: { effort: 'medium' },
            ...(p.builtin && FALLBACK_MODELS.has(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {})
          },
          { signal }
        )
      )
      stream.on('streamEvent', (ev) => {
        if (ev.type === 'content_block_start' && ev.content_block.type === 'thinking') deps.emit({ type: 'thinking', convId: c.id, on: true })
        if (ev.type === 'content_block_start' && ev.content_block.type !== 'thinking') deps.emit({ type: 'thinking', convId: c.id, on: false })
      })
      stream.on('text', (d) => {
        live += d
        deps.emit({ type: 'delta', convId: c.id, text: d })
      })
      msg = await callClaude(() => stream.finalMessage())
    } catch (e) {
      // Kuruluşta web araması kapalıysa onsuz tekrar dene
      if (useWeb && /web_search/i.test((e as Error).message)) {
        useWeb = false
        round--
        continue
      }
      throw e
    }
    c.costUsd += p.builtin ? usageCost(model, msg.usage) : 0
    history.push({ role: 'assistant', content: msg.content as ABlock[] })
    for (const b of msg.content) {
      if (b.type === 'server_tool_use') c.view.push({ kind: 'tool', id: b.id, name: b.name, input: b.input, status: 'done', result: 'web araması' })
    }
    const said = msg.content
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    if (said || live.trim()) c.view.push({ kind: 'assistant', text: said || live.trim() })
    c.updatedAt = Date.now()
    save(dir, c)
    deps.emit({ type: 'conv', conv: strip(c) })

    if (msg.stop_reason === 'pause_turn') continue
    if (msg.stop_reason === 'refusal') {
      c.view.push({ kind: 'event', text: 'Model bu isteği yanıtlamadı.' })
      return
    }
    if (msg.stop_reason === 'max_tokens') {
      c.view.push({ kind: 'event', text: 'Yanıt uzunluk sınırında kesildi; "devam" yazabilirsin.' })
      return
    }
    if (msg.stop_reason !== 'tool_use') return

    const results: ABlock[] = []
    for (const b of msg.content) {
      if (b.type !== 'tool_use') continue
      const r = await execTool(dir, c, tools, { id: b.id, name: b.name, input: b.input }, deps, signal)
      const blocks: ({ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/png'; data: string } })[] = [{ type: 'text', text: r.text }]
      for (const f of (r.images ?? []).slice(0, 4)) {
        const img = imageB64(f)
        if (img) blocks.push({ type: 'image', source: { type: 'base64', media_type: img.media as 'image/png', data: img.data } })
      }
      results.push({ type: 'tool_result', tool_use_id: b.id, content: blocks, is_error: r.isError || undefined })
    }
    history.push({ role: 'user', content: results })
    save(dir, c)
    if (signal.aborted) throw Object.assign(new Error('Durduruldu.'), { name: 'AbortError' })
  }
  c.view.push({ kind: 'event', text: `Tur sınırına (${MAX_ROUNDS}) ulaşıldı; devam etmek için yaz.` })
}

async function openaiLoop(
  dir: string,
  c: AgentConversation,
  p: LlmProvider,
  tools: AgentTool[],
  sys: string,
  userText: string,
  images: string[],
  deps: Deps,
  signal: AbortSignal
): Promise<void> {
  const history = c.history as OaMessage[]
  const last = history[history.length - 1]
  if (last?.role === 'assistant' && last.tool_calls?.length) {
    for (const tc of last.tool_calls) history.push({ role: 'tool', tool_call_id: tc.id, content: 'Interrupted (app closed or stopped).' })
  }
  const parts: OaPart[] = [{ type: 'text', text: userText || '(görsel)' }]
  for (const f of images) {
    const img = imageB64(f)
    if (img && p.vision) parts.push({ type: 'image_url', image_url: { url: `data:${img.media};base64,${img.data}` } })
  }
  history.push({ role: 'user', content: parts })
  const oaTools: OaTool[] = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } }))

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const r = await oaChatStream(
      p,
      [{ role: 'system', content: sys }, ...history],
      oaTools,
      { text: (d) => deps.emit({ type: 'delta', convId: c.id, text: d }), thinking: (on) => deps.emit({ type: 'thinking', convId: c.id, on }) },
      signal
    )
    history.push({ role: 'assistant', content: r.content || null, ...(r.toolCalls.length ? { tool_calls: r.toolCalls } : {}) })
    if (r.content) c.view.push({ kind: 'assistant', text: r.content })
    c.updatedAt = Date.now()
    save(dir, c)
    deps.emit({ type: 'conv', conv: strip(c) })
    if (!r.toolCalls.length) {
      if (r.finish === 'length') c.view.push({ kind: 'event', text: 'Yanıt uzunluk sınırında kesildi; "devam" yazabilirsin.' })
      return
    }
    const imgParts: OaPart[] = []
    for (const tc of r.toolCalls) {
      let input: unknown = {}
      try {
        input = JSON.parse(tc.function.arguments || '{}')
      } catch {
        history.push({ role: 'tool', tool_call_id: tc.id, content: 'INVALID_JSON: arguments were not valid JSON; resend the call.' })
        continue
      }
      const res = await execTool(dir, c, tools, { id: tc.id, name: tc.function.name, input }, deps, signal)
      history.push({ role: 'tool', tool_call_id: tc.id, content: (res.isError ? 'ERROR: ' : '') + res.text })
      if (p.vision)
        for (const f of (res.images ?? []).slice(0, 4)) {
          const img = imageB64(f)
          if (img) imgParts.push({ type: 'image_url', image_url: { url: `data:${img.media};base64,${img.data}` } })
        }
    }
    // OpenAI biçiminde araç mesajları yalnızca metin alır → görselleri ayrı kullanıcı mesajıyla ekle
    if (imgParts.length) history.push({ role: 'user', content: [{ type: 'text', text: 'Images returned by the tools above:' }, ...imgParts] })
    save(dir, c)
    if (signal.aborted) throw Object.assign(new Error('Durduruldu.'), { name: 'AbortError' })
  }
  c.view.push({ kind: 'event', text: `Tur sınırına (${MAX_ROUNDS}) ulaşıldı; devam etmek için yaz.` })
}
