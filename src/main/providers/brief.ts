// SPDX-License-Identifier: AGPL-3.0-only
// Brief Chat (Atölye): üretim öncesi Claude ile form gibi akan sohbet.
// Claude soruları tıklanabilir seçeneklerle sorar (ask_question), brief kartını canlı doldurur (update_brief),
// ana asset'in oyun dünyasında ihtiyaç duyduğu her şeyi bir üretim kitine çevirir (set_kit) ve
// hazır olunca brief'i kapatır (finalize_brief).
import type Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { AssetKind, AssetSpec, Brief, BriefEvent, BriefInput, BriefQuestion, BriefSpec, KitItem, Project } from '../../shared/types'
import { briefsDir, loadBrief, saveBrief } from '../project'
import { getSettings } from '../settings'
import { ensureDir, newId, sniffImage } from '../util'
import { assetContext, bibleContext, callClaude, client, FALLBACK_MODELS, usageCost } from './claude'

type Msg = Anthropic.Beta.BetaMessageParam
type Block = Anthropic.Beta.BetaContentBlockParam

const KINDS = ['model', 'character', 'creature', 'vehicle', 'weapon', 'texture', 'image', 'sfx', 'music', 'vfx', 'animation'] as const

// ---------------------------------------------------------------------------
// Araçlar

const AskSchema = z.object({
  question: z.string().min(1).describe('One short question in Turkish'),
  options: z
    .array(z.object({ label: z.string().min(1).describe('Short Turkish option label (1-5 words)'), description: z.string().optional().describe('One-line Turkish explanation / trade-off') }))
    .min(2)
    .max(6),
  multi: z.boolean().describe('true if several options can be picked together')
})

const BriefFieldsSchema = z.object({
  title: z.string().optional().describe('Short Turkish title of the whole brief'),
  name: z.string().optional().describe('Turkish asset name'),
  kind: z.enum(KINDS).optional(),
  category: z.string().optional().describe('Project bible category code if one fits, else short Turkish category'),
  description: z.string().optional().describe('Rich Turkish design note: silhouette, construction, details, wear, how it is used. The prompt engine reads this.'),
  style: z.string().optional().describe('Visual style, e.g. "stylized low poly, flat colors" or "grounded realistic PBR"'),
  tier: z.string().optional().describe('Chosen complexity tier, Turkish'),
  tri_budget: z.number().int().optional().describe('Triangle budget for the main asset'),
  size: z.string().optional().describe('Real size in meters, "LxWxH" or height like "1,80 m"'),
  palette: z.array(z.string()).optional().describe('Palette codes from the bible or hex colors'),
  materials: z.string().optional(),
  world: z.string().optional().describe('Turkish: how it lives in the game world (surfaces, weather, interactions, gameplay role)'),
  notes: z.string().optional()
})

const KitSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().min(1).describe('Stable snake_case key, e.g. engine_loop, door_open, dust_sand'),
        group: z.enum(['model', 'doku', 'ses', 'vfx', 'animasyon']),
        kind: z.enum(KINDS),
        name: z.string().min(1).describe('Turkish asset name'),
        role: z.string().describe('Short English role tag'),
        purpose: z.string().describe('Turkish: why the game needs it / when it plays'),
        description: z.string().describe('Turkish design note for the prompt engine (materials, intensity, surface, perspective...)'),
        priority: z.enum(['P0', 'P1', 'P2']),
        existing_id: z.string().optional().describe('If a LIBRARY asset already covers this, its id (it will be reused, not regenerated)'),
        dynamic: z
          .object({
            layers: z.number().int().min(2).max(8),
            idle_rpm: z.number(),
            max_rpm: z.number(),
            engine: z.string().describe('English engine timbre, e.g. "inline-4 petrol, raspy exhaust"')
          })
          .optional()
          .describe('Only for an engine sound: RPM-layered dynamic MetaSound'),
        motion: z
          .object({
            prompt: z.string().describe('English Kimodo prompt starting with "A person ..." — one line per sequential segment'),
            seconds: z.number().min(1).max(30),
            loop: z.boolean()
          })
          .optional()
          .describe('Only for humanoid character animations (Kimodo)')
      })
    )
    .max(40)
})

const FinalizeSchema = z.object({ summary: z.string().min(1).describe('2-4 sentence Turkish summary of the brief and the kit') })

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'ask_question',
    description:
      'Ask the user exactly ONE question with clickable options (the UI also lets them type freely or drop images/library items). Put the option you recommend first and append " (Önerilen)" to its label. After calling this tool, stop and wait — do not ask anything else in the same turn.',
    input_schema: z.toJSONSchema(AskSchema) as Anthropic.Beta.BetaTool.InputSchema,
    eager_input_streaming: true
  },
  {
    name: 'update_brief',
    description: 'Update the live brief sheet the user sees. Call it whenever you learn or decide something; send only changed fields.',
    input_schema: z.toJSONSchema(BriefFieldsSchema) as Anthropic.Beta.BetaTool.InputSchema,
    eager_input_streaming: true
  },
  {
    name: 'set_kit',
    description: 'Replace the production kit: every additional asset the main asset needs in the game world (sounds, VFX, textures, animations, extra models). Send the full list each time.',
    input_schema: z.toJSONSchema(KitSchema) as Anthropic.Beta.BetaTool.InputSchema,
    eager_input_streaming: true
  },
  {
    name: 'finalize_brief',
    description: 'Call when the brief and kit are complete enough to produce. The user then reviews the kit and presses "Üretime gönder".',
    input_schema: z.toJSONSchema(FinalizeSchema) as Anthropic.Beta.BetaTool.InputSchema,
    eager_input_streaming: true
  }
]

// ---------------------------------------------------------------------------
// Sistem promptu

const DIRECTOR = `You are the production director inside AssetForge, a studio tool that turns a short idea into a complete, game-ready asset kit for an Unreal Engine 5 game. You talk to the game developer in Turkish, warm and professional, short sentences, no markdown headings.

Your job in this conversation: interview the developer like a smart modern form, one question at a time, until you can hand a precise brief and a complete production kit to the automatic pipelines (Meshy 3D, ElevenLabs audio, image generation, NVIDIA Kimodo motion, Blender cleanup, Unreal import).

HOW TO RUN THE INTERVIEW
- Each turn: at most 1-2 short sentences of reaction/recommendation, then exactly one ask_question call. Never ask what the user already told you; never ask more than one thing per turn.
- Options must be concrete and production-meaningful, with a one-line trade-off. Put your recommendation first with " (Önerilen)".
- If the user says "sen seç", "fark etmez" or similar, decide yourself (consistent with the project bible) and move on.
- After every answer call update_brief (and set_kit when the kit changes) BEFORE the next question.
- Aim for roughly 5-9 questions in total. Then call set_kit with the full kit, call finalize_brief, and tell the user to review the kit on the right and press "Üretime gönder".
- Images the user attaches are references: describe what you take from them. Library items the user drops in are existing assets of the project: use them as context and link them instead of regenerating.

WHAT TO COVER (adapt to the asset type, skip what is irrelevant)
1. Identity: what it is, role in the game, references.
2. Style: e.g. stylized low poly, hand-painted, cartoon, semi-realistic, grounded realistic PBR — consistent with the bible unless the user wants otherwise.
3. Shape and look: silhouette, key features, colors (prefer bible palette codes), materials, wear/damage state, size in meters.
4. Complexity tier — always ask, with tiers specific to the type:
   - Vehicle: Seviye 1 "Gövde" (static body, wheels part of the mesh) · Seviye 2 "Oynar parçalar" (separate wheels that spin, opening doors/hood) · Seviye 3 "Tam fizik rigi" (suspension with springs and limits, steering, brakes, Chaos Vehicle ready, damage states).
   - Character: Seviye 1 "Arka plan NPC" (15-20k tris, basic locomotion) · Seviye 2 "Oynanabilir/önemli NPC" (25-35k, full locomotion + interactions) · Seviye 3 "Ana kahraman" (40-60k, full locomotion, combat/interaction set, facial later).
   - Creature: background / enemy / boss with 15-30k tris guidance.
   - Prop/weapon: static / interactive (moving parts) / hero prop.
5. Performance budget: propose a triangle budget for the tier (hero character 40-60k, NPC/creature 15-30k, vehicle 30-80k by tier, props usually 1-15k). Never accept "10 million polygons": explain LODs (50/25/10%) are generated automatically.
6. World context — this is what makes the kit complete. Ask about the game's tone (chill/cozy vs tense/realistic), the surfaces and environments it touches (asphalt, sand, mud, snow, water, grass…), weather, and its interactions:
   - Vehicle: what comes out when it moves (exhaust smoke, dust per surface, mud spray, tire tracks), what happens on collision (sparks, debris, glass, dents/damage state), sounds (dynamic engine, start/stop, idle, door open/close, horn, crash/impact per material, tire skid per surface, suspension creaks).
   - Character: footsteps per surface, cloth/gear foley, voice efforts (later), locomotion and interaction animations.
   - Creature/weapon/prop: impacts, use sounds, VFX, destruction.
7. Engine sounds are DYNAMIC: explain in one sentence that the engine is rendered as several seamless RPM layers that Unreal crossfades and pitches by RPM/throttle in a MetaSound (that is how games make engines react). Create ONE kit item for it with "dynamic" set (layers 5-6, realistic idle/max rpm for that engine).
8. Animations: Kimodo only does human motion. For humanoid characters add kit items (group "animasyon", kind "animation") with an English "motion" prompt per clip (idle, walk, run, jump, interactions fitting the game). For vehicles/creatures say that motion comes from the rig in a later module and do not add Kimodo items.

KIT RULES
- Every kit item is its own asset that a pipeline will produce. Make descriptions specific to THIS asset and world (e.g. dust "tinted like the referenced sand texture", crash "sheet metal of a small hatchback on asphalt").
- Typical size 6-18 items. Priorities: P0 = needed for the first playable, P1 = polish, P2 = nice to have.
- If the LIBRARY already contains a matching asset, set existing_id to reuse it (and mention it).
- VFX items (kind "vfx") produce a sprite/flipbook texture for Niagara; textures (kind "texture") are tileable materials.
- Never invent library ids; only use ids from the LIBRARY list.`

function libraryContext(p: Project): string {
  if (!p.assets.length) return 'LIBRARY: (empty)'
  const rows = p.assets.slice(0, 900).map((a) => `${a.id} | ${a.kind} | ${a.name}${a.status ? ` | ${a.status}` : ''}`)
  return `LIBRARY (existing project assets: id | kind | name | status):\n${rows.join('\n')}`
}

function emptySpec(): BriefSpec {
  return { name: '', kind: 'model', category: '', description: '', style: '', tier: '', triBudget: 0, size: '', palette: [], materials: '', world: '', notes: '' }
}

export function createBrief(dir: string, seed?: { title?: string; kind?: AssetKind }): Brief {
  const now = Date.now()
  const b: Brief = {
    id: newId('brief'),
    title: seed?.title || 'Yeni brief',
    status: 'drafting',
    createdAt: now,
    updatedAt: now,
    spec: { ...emptySpec(), kind: seed?.kind ?? 'model' },
    kit: [],
    refs: [],
    links: [],
    view: [],
    history: [],
    costUsd: 0
  }
  saveBrief(dir, b)
  return b
}

// ---------------------------------------------------------------------------

function imageBlock(file: string): Block | null {
  try {
    const buf = fs.readFileSync(file)
    const media = sniffImage(buf)
    if (!media || buf.length > 4.5 * 1024 * 1024) return null
    return { type: 'image', source: { type: 'base64', media_type: media, data: buf.toString('base64') } }
  } catch {
    return null
  }
}

function applyFields(b: Brief, f: z.infer<typeof BriefFieldsSchema>): void {
  const s = b.spec
  if (f.title) b.title = f.title
  if (f.name !== undefined) s.name = f.name
  if (f.kind) s.kind = f.kind
  if (f.category !== undefined) s.category = f.category
  if (f.description !== undefined) s.description = f.description
  if (f.style !== undefined) s.style = f.style
  if (f.tier !== undefined) s.tier = f.tier
  if (f.tri_budget !== undefined) s.triBudget = f.tri_budget
  if (f.size !== undefined) s.size = f.size
  if (f.palette) s.palette = f.palette
  if (f.materials !== undefined) s.materials = f.materials
  if (f.world !== undefined) s.world = f.world
  if (f.notes !== undefined) s.notes = f.notes
  if (!b.title || b.title === 'Yeni brief') b.title = s.name || b.title
}

function applyKit(b: Brief, k: z.infer<typeof KitSchema>, validIds: Set<string>): void {
  const prev = new Map(b.kit.map((i) => [i.key, i]))
  const seen = new Set<string>()
  b.kit = k.items.map((it) => {
    let key = it.key
    while (seen.has(key)) key += '_2'
    seen.add(key)
    const old = prev.get(key)
    const item: KitItem = {
      key,
      group: it.group,
      kind: it.kind,
      name: it.name,
      role: it.role,
      purpose: it.purpose,
      description: it.description,
      priority: it.priority,
      // Kullanıcının kapattığı kalemler kapalı kalsın
      include: old ? old.include : true,
      existingId: it.existing_id && validIds.has(it.existing_id) ? it.existing_id : undefined,
      dynamic: it.dynamic ? { type: 'engine', layers: it.dynamic.layers, idleRpm: it.dynamic.idle_rpm, maxRpm: it.dynamic.max_rpm, engine: it.dynamic.engine } : undefined,
      motion: it.motion
    }
    return item
  })
}

const running = new Set<string>()

/**
 * Kullanıcı mesajını (veya bekleyen soruya cevabı) gönderir ve Claude'un turunu
 * araç çağrılarıyla birlikte tamamlar. Akış olayları emit ile arayüze gider.
 */
export async function sendBrief(dir: string, project: Project, briefId: string, input: BriefInput, emit: (e: BriefEvent) => void): Promise<Brief> {
  const b = loadBrief(dir, briefId)
  if (!b) throw new Error('Brief bulunamadı')
  if (running.has(briefId)) throw new Error('Bu brief zaten yanıt bekliyor')
  running.add(briefId)
  const history = b.history as Msg[]
  const validIds = new Set(project.assets.map((a) => a.id))
  const byId = new Map(project.assets.map((a) => [a.id, a]))

  try {
    // Kullanıcı içeriği
    const extra: Block[] = []
    // Referans görselleri proje klasörüne kopyala (arayüz forge:// ile yalnızca proje içini gösterebilir)
    const refDir = ensureDir(path.join(briefsDir(dir), briefId + '_refs'))
    const images = (input.images ?? [])
      .filter((f) => fs.existsSync(f))
      .map((f) => {
        const dest = path.join(refDir, path.basename(f))
        if (path.resolve(f).toLowerCase() !== path.resolve(dest).toLowerCase()) fs.copyFileSync(f, dest)
        return dest
      })
    for (const f of images) {
      const blk = imageBlock(f)
      if (blk) {
        extra.push({ type: 'text', text: `Reference image: ${path.basename(f)}` }, blk)
        if (!b.refs.includes(f)) b.refs.push(f)
      }
    }
    const links = (input.links ?? []).filter((id) => byId.has(id))
    for (const id of links) {
      const a = byId.get(id)!
      extra.push({ type: 'text', text: `The user dropped this LIBRARY asset into the chat (link it / use it as context):\n${assetContext(a)}` })
      const thumb = assetThumbnail(dir, id)
      const blk = thumb ? imageBlock(thumb) : null
      if (blk) extra.push(blk)
      if (!b.links.includes(id)) b.links.push(id)
    }
    const text = (input.answer ?? input.text ?? '').trim()

    let content: Block[]
    if (b.pending) {
      const answer = text || (images.length || links.length ? '(cevap yerine ek gönderdi)' : 'sen seç')
      content = [...((b.pendingResults ?? []) as Block[]), { type: 'tool_result', tool_use_id: b.pending.toolUseId, content: answer }, ...extra]
      const q = [...b.view].reverse().find((v) => v.kind === 'question' && v.question.toolUseId === b.pending!.toolUseId)
      if (q && q.kind === 'question') q.answer = answer
      if (images.length || links.length) b.view.push({ kind: 'user', text: '', images, links })
      b.pending = undefined
      b.pendingResults = undefined
    } else {
      if (!text && !extra.length) throw new Error('Boş mesaj')
      content = [...(text ? [{ type: 'text' as const, text }] : []), ...extra]
      b.view.push({ kind: 'user', text, images, links })
    }
    history.push({ role: 'user', content })
    b.updatedAt = Date.now()
    saveBrief(dir, b)
    emit({ type: 'brief', brief: { ...b, history: [] } })

    const model = getSettings().claudeModel
    const system: Anthropic.Beta.BetaTextBlockParam[] = [
      { type: 'text', text: DIRECTOR },
      { type: 'text', text: `PROJECT BIBLE\n${bibleContext(project.bible)}\n\n${libraryContext(project)}`, cache_control: { type: 'ephemeral' } }
    ]

    for (let round = 0; round < 8; round++) {
      let live = ''
      const stream = await callClaude(async () =>
        client().beta.messages.stream({
          model,
          max_tokens: 12000,
          system,
          tools: TOOLS,
          messages: history,
          output_config: { effort: 'medium' },
          ...(FALLBACK_MODELS.has(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {})
        })
      )
      stream.on('streamEvent', (ev) => {
        if (ev.type === 'content_block_start' && ev.content_block.type === 'thinking') emit({ type: 'thinking', briefId, on: true })
        if (ev.type === 'content_block_start' && ev.content_block.type === 'text') emit({ type: 'thinking', briefId, on: false })
      })
      stream.on('text', (delta) => {
        live += delta
        emit({ type: 'delta', briefId, text: delta })
      })
      const msg = await callClaude(() => stream.finalMessage())
      emit({ type: 'thinking', briefId, on: false })
      b.costUsd += usageCost(model, msg.usage)
      history.push({ role: 'assistant', content: msg.content as Block[] })
      const said = msg.content
        .filter((c) => c.type === 'text')
        .map((c) => (c.type === 'text' ? c.text : ''))
        .join('')
        .trim()
      if (said || live.trim()) b.view.push({ kind: 'assistant', text: said || live.trim() })

      if (msg.stop_reason === 'refusal') {
        b.view.push({ kind: 'event', text: 'Claude bu isteği yanıtlamadı.' })
        break
      }
      if (msg.stop_reason === 'max_tokens') {
        b.view.push({ kind: 'event', text: 'Yanıt uzunluk sınırında kesildi; devam etmek için yazın.' })
        break
      }
      if (msg.stop_reason !== 'tool_use') break

      const results: Block[] = []
      let question: BriefQuestion | undefined
      for (const blk of msg.content) {
        if (blk.type !== 'tool_use') continue
        const raw = blk.input
        const fail = (err: string) => results.push({ type: 'tool_result', tool_use_id: blk.id, content: `INVALID_INPUT: ${err}`, is_error: true })
        if (blk.name === 'ask_question') {
          const r = AskSchema.safeParse(raw)
          if (!r.success) {
            fail(r.error.message)
            continue
          }
          if (question) {
            // Her tool_use bir sonuç ister; aynı turdaki ikinci soruyu reddet
            results.push({ type: 'tool_result', tool_use_id: blk.id, content: 'Ignored: ask one question at a time; the first question is shown.', is_error: true })
            continue
          }
          question = { toolUseId: blk.id, question: r.data.question, options: r.data.options, multi: r.data.multi }
        } else if (blk.name === 'update_brief') {
          const r = BriefFieldsSchema.safeParse(raw)
          if (!r.success) {
            fail(r.error.message)
            continue
          }
          applyFields(b, r.data)
          results.push({ type: 'tool_result', tool_use_id: blk.id, content: 'ok' })
        } else if (blk.name === 'set_kit') {
          const r = KitSchema.safeParse(raw)
          if (!r.success) {
            fail(r.error.message)
            continue
          }
          applyKit(b, r.data, validIds)
          b.view.push({ kind: 'event', text: `Üretim kiti güncellendi: ${b.kit.length} kalem` })
          results.push({ type: 'tool_result', tool_use_id: blk.id, content: `ok, ${b.kit.length} items` })
        } else if (blk.name === 'finalize_brief') {
          const r = FinalizeSchema.safeParse(raw)
          if (!r.success) {
            fail(r.error.message)
            continue
          }
          b.status = b.status === 'committed' ? 'committed' : 'ready'
          b.summary = r.data.summary
          b.view.push({ kind: 'event', text: 'Brief hazır — kiti gözden geçirip üretime gönderebilirsin.' })
          results.push({ type: 'tool_result', tool_use_id: blk.id, content: 'ok — the user now reviews the kit' })
        } else {
          fail('unknown tool')
        }
      }
      b.updatedAt = Date.now()
      if (question) {
        b.pending = question
        b.pendingResults = results
        b.view.push({ kind: 'question', question })
        saveBrief(dir, b)
        break
      }
      history.push({ role: 'user', content: results })
      saveBrief(dir, b)
      emit({ type: 'brief', brief: { ...b, history: [] } })
    }
    b.updatedAt = Date.now()
    saveBrief(dir, b)
    const out = { ...b, history: [] }
    emit({ type: 'brief', brief: out })
    return out
  } catch (e) {
    const err = (e as Error).message
    b.view.push({ kind: 'event', text: `Hata: ${err}` })
    // Başarısız turu geçmişten geri al ki tekrar denenebilsin
    while (history.length && history[history.length - 1].role === 'user') history.pop()
    saveBrief(dir, b)
    emit({ type: 'error', briefId, error: err })
    throw e
  } finally {
    running.delete(briefId)
  }
}

// ---------------------------------------------------------------------------
// Kütüphane küçük resimleri: bir asset'in en son üretim işindeki önizleme

let thumbCache: { at: number; map: Record<string, string> } | null = null

export function libraryThumbnails(dir: string): Record<string, string> {
  if (thumbCache && Date.now() - thumbCache.at < 4000) return thumbCache.map
  const map: Record<string, string> = {}
  const jd = path.join(dir, 'jobs')
  let files: string[] = []
  try {
    files = fs.readdirSync(jd).filter((f) => f.endsWith('.json'))
  } catch {
    /* henüz iş yok */
  }
  const jobs = files
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(jd, f), 'utf8')) as import('../../shared/types').Job
      } catch {
        return null
      }
    })
    .filter((j): j is import('../../shared/types').Job => !!j)
    .sort((a, b) => a.createdAt - b.createdAt)
  for (const j of jobs) {
    for (const st of Object.values(j.nodes)) {
      for (const art of Object.values(st.outputs ?? {})) {
        let img: string | undefined
        if (art.kind === 'model') img = art.previews?.[0] ?? art.thumbnail
        else if (art.kind === 'image') img = art.files[0]
        if (img && fs.existsSync(img)) map[j.assetId] = img
      }
    }
  }
  thumbCache = { at: Date.now(), map }
  return map
}

export function assetThumbnail(dir: string, assetId: string): string | undefined {
  return libraryThumbnails(dir)[assetId]
}

/** Brief'ten asset satırları üretir (renderer projeye ekler). */
export function briefToAssets(b: Brief, existing: AssetSpec[], suggest: (a: AssetSpec) => string): AssetSpec[] {
  const PREFIX: Record<string, string> = {
    character: 'KAR',
    creature: 'YRT',
    vehicle: 'ARA',
    weapon: 'SLH',
    model: 'PRP',
    texture: 'DOK',
    image: 'GRS',
    sfx: 'SES',
    music: 'MZK',
    vfx: 'VFX',
    animation: 'ANM'
  }
  const used = new Set(existing.map((a) => a.id))
  const nextId = (kind: string) => {
    const pre = 'B' + (PREFIX[kind] ?? 'AST')
    let n = 1
    while (used.has(`${pre}${String(n).padStart(3, '0')}`)) n++
    const id = `${pre}${String(n).padStart(3, '0')}`
    used.add(id)
    return id
  }
  const s = b.spec
  const mainId = nextId(s.kind)
  const main: AssetSpec = {
    id: mainId,
    name: s.name || b.title,
    kind: s.kind,
    category: s.category || PREFIX[s.kind] || '',
    subcategory: s.tier,
    description: [s.description, s.world && `Oyun dünyası: ${s.world}`, s.notes].filter(Boolean).join('\n'),
    size: s.size,
    materials: [s.palette.join(', '), s.materials].filter(Boolean).join(' · '),
    variants: '',
    triBudget: s.triBudget,
    budgetNote: s.tier,
    priority: 'P0',
    status: 'Brief',
    source: 'Brief',
    extra: { Stil: s.style },
    briefId: b.id,
    tier: s.tier,
    style: s.style,
    refs: b.refs,
    links: b.links
  }
  main.pipelineId = suggest(main)
  const out = [main]
  for (const k of b.kit) {
    if (!k.include || k.existingId) continue
    const a: AssetSpec = {
      id: nextId(k.kind),
      name: k.name,
      kind: k.kind,
      category: main.category,
      subcategory: k.group,
      description: `${k.description}\nAmaç: ${k.purpose}\nAna asset: ${main.name} (${main.id}). ${s.style ? 'Stil: ' + s.style + '.' : ''}`,
      size: '',
      materials: main.materials,
      variants: '',
      triBudget: 0,
      budgetNote: '',
      priority: k.priority,
      status: 'Brief',
      source: 'Brief',
      extra: {
        ...(k.motion ? { Kimodo: k.motion.prompt, Süre: String(k.motion.seconds), Döngü: k.motion.loop ? 'evet' : 'hayır' } : {}),
        ...(k.dynamic ? { Motor: k.dynamic.engine } : {})
      },
      briefId: b.id,
      parentId: mainId,
      role: k.role,
      style: s.style,
      links: b.links,
      dynamic: k.dynamic
    }
    a.pipelineId = suggest(a)
    out.push(a)
  }
  return out
}
