// SPDX-License-Identifier: AGPL-3.0-only
// ComfyUI sunucusunda her türlü workflow'u çalıştırır: görsel, 3D model, ses, animasyon.
// Workflow API formatındadır (ComfyUI → Workflow → Export (API)). AssetForge'un değerleri şöyle girer:
//  1) Düğüm başlıkları: AF:prompt, AF:negative, AF:seed, AF:seconds, AF:image, AF:model, AF:audio
//  2) Eski yer tutucular: {{PROMPT}}, {{NEGATIVE}}, "{{SEED}}", "{{SECONDS}}"
//  3) İkisi de yoksa tahmin: örnekleyicinin positive/negative metni, tek LoadImage / Load3D / LoadAudio
// Çıktı düğümünün başlığı AF:image / AF:model / AF:audio / AF:anim ise o türe sayılır; yoksa uzantıya bakılır.
// Partner düğümleri (Meshy, Tripo, Rodin, ElevenLabs …) Comfy hesabı anahtarıyla çalışır (extra_data).
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { ensureDir, sleep } from '../util'

export type ComfyKind = 'image' | 'model' | 'audio' | 'anim'

export interface ComfyNode {
  class_type: string
  inputs: Record<string, unknown>
  _meta?: { title?: string }
}
export type ComfyWorkflow = Record<string, ComfyNode>

export interface ComfyValues {
  prompt?: string
  negative?: string
  seed?: number
  seconds?: number
  /** ComfyUI giriş klasöründeki ad (yüklemeden sonra) */
  image?: string
  model?: string
  audio?: string
}
type Role = keyof ComfyValues

const ROLE_ALIASES: Record<string, Role | 'anim'> = {
  prompt: 'prompt',
  positive: 'prompt',
  text: 'prompt',
  negative: 'negative',
  neg: 'negative',
  seed: 'seed',
  seconds: 'seconds',
  duration: 'seconds',
  image: 'image',
  model: 'model',
  mesh: 'model',
  '3d': 'model',
  audio: 'audio',
  anim: 'anim',
  motion: 'anim'
}

/** Rolün yazılacağı giriş adları, öncelik sırasıyla */
const ROLE_INPUTS: Record<Role, string[]> = {
  prompt: ['text', 'prompt', 'positive', 'text_g', 'tags', 'string', 'value'],
  negative: ['text', 'negative', 'negative_prompt', 'prompt', 'string', 'value'],
  seed: ['seed', 'noise_seed', 'value'],
  seconds: ['seconds', 'duration', 'length', 'value'],
  image: ['image'],
  model: ['model_file', 'mesh', 'file'],
  audio: ['audio']
}

const TEXT_ROLES: Role[] = ['prompt', 'negative', 'image', 'model', 'audio']

/** Başlıktaki AF etiketi: "AF:prompt", "af: Model", "AF image" */
export function titleRole(title: string | undefined): Role | 'anim' | null {
  const m = title?.match(/^\s*AF\s*[:\s]\s*([a-z0-9]+)/i)
  return m ? (ROLE_ALIASES[m[1].toLowerCase()] ?? null) : null
}

const isLink = (v: unknown) => Array.isArray(v) && v.length === 2 && typeof v[0] === 'string'

function setRole(node: ComfyNode, role: Role, value: string | number): string | null {
  const want = TEXT_ROLES.includes(role) ? 'string' : 'number'
  const key = ROLE_INPUTS[role].find((k) => k in node.inputs && !isLink(node.inputs[k])) ?? Object.keys(node.inputs).find((k) => typeof node.inputs[k] === want)
  if (!key) return null
  node.inputs[key] = value
  return key
}

const PLACEHOLDERS: [Role, string, boolean][] = [
  ['prompt', '{{PROMPT}}', true],
  ['negative', '{{NEGATIVE}}', true],
  ['seed', '"{{SEED}}"', false],
  ['seconds', '"{{SECONDS}}"', false]
]

/**
 * AssetForge değerlerini workflow'a yazar. Dönen `applied` günlük içindir; `unused` verilen ama
 * yazılacak yeri bulunamayan değerlerdir (kullanıcıya uyarı olarak gösterilir).
 */
export function prepareWorkflow(source: string, v: ComfyValues): { workflow: ComfyWorkflow; applied: string[]; unused: Role[] } {
  const applied: string[] = []
  const done = new Set<Role>()
  let text = source
  for (const [role, token, quoted] of PLACEHOLDERS) {
    const value = v[role]
    if (value === undefined || !text.includes(token)) continue
    text = text.replaceAll(token, quoted ? JSON.stringify(String(value)).slice(1, -1) : String(value))
    applied.push(`${role} → ${token}`)
    done.add(role)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    throw new Error(`Workflow JSON okunamadı: ${(e as Error).message}`, { cause: e })
  }
  const obj = parsed as Record<string, unknown>
  if (obj && Array.isArray(obj.nodes) && Array.isArray(obj.links)) {
    throw new Error('Bu dosya ComfyUI’ın arayüz formatında. ComfyUI’da Workflow → Export (API) ile kaydedip onu seçin.')
  }
  const wf = obj as ComfyWorkflow
  const ids = Object.keys(wf).filter((id) => wf[id] && typeof wf[id] === 'object' && typeof wf[id].class_type === 'string')
  if (!ids.length) throw new Error('Workflow’da düğüm yok (API formatında mı?)')

  const put = (id: string, role: Role, how: string) => {
    const value = v[role]
    if (value === undefined) return false
    const key = setRole(wf[id], role, value)
    if (!key) return false
    applied.push(`${role} → ${wf[id].class_type}.${key}${how}`)
    return true
  }

  // 1) Başlıklar
  for (const id of ids) {
    const role = titleRole(wf[id]._meta?.title)
    if (!role || role === 'anim' || v[role] === undefined) continue
    if (put(id, role, '')) done.add(role)
  }

  // 2) Tahmin: örnekleyicinin positive / negative bağlantısındaki metin düğümü
  for (const [role, input] of [
    ['prompt', 'positive'],
    ['negative', 'negative']
  ] as const) {
    if (done.has(role) || v[role] === undefined) continue
    const targets = new Set(ids.flatMap((id) => (isLink(wf[id].inputs[input]) ? [String((wf[id].inputs[input] as unknown[])[0])] : [])))
    const texts = [...targets].filter((t) => wf[t] && typeof wf[t].inputs.text === 'string')
    if (texts.length === 1 && put(texts[0], role, ' (tahmin)')) done.add(role)
  }
  // Tek yükleyici düğümü varsa dosya ona gider
  for (const [role, cls] of [
    ['image', /^LoadImage$/],
    ['model', /^Load3D/],
    ['audio', /^LoadAudio$/]
  ] as const) {
    if (done.has(role) || v[role] === undefined) continue
    const loaders = ids.filter((id) => cls.test(wf[id].class_type))
    if (loaders.length === 1 && put(loaders[0], role, ' (tahmin)')) done.add(role)
  }
  // Seed verilmiş ama yeri belirtilmemişse tüm örnekleyici seed'leri değişir; yoksa aynı sonuç tekrar gelir
  if (!done.has('seed') && v.seed !== undefined) {
    for (const id of ids) {
      for (const k of ['seed', 'noise_seed']) {
        if (typeof wf[id].inputs[k] === 'number') {
          wf[id].inputs[k] = v.seed
          applied.push(`seed → ${wf[id].class_type}.${k} (tahmin)`)
          done.add('seed')
        }
      }
    }
  }

  const unused = (Object.keys(v) as Role[]).filter((r) => v[r] !== undefined && !done.has(r) && r !== 'seed' && r !== 'seconds' && r !== 'negative')
  return { workflow: wf, applied, unused }
}

// ── Çıktılar ────────────────────────────────────────────────────────

export interface ComfyFile {
  filename: string
  subfolder: string
  type: string
  kind: ComfyKind | null
  node: string
}

const EXT_KIND: Record<string, ComfyKind> = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  exr: 'image',
  tga: 'image',
  bmp: 'image',
  tif: 'image',
  tiff: 'image',
  glb: 'model',
  gltf: 'model',
  fbx: 'model',
  obj: 'model',
  ply: 'model',
  stl: 'model',
  usd: 'model',
  usdz: 'model',
  wav: 'audio',
  flac: 'audio',
  mp3: 'audio',
  ogg: 'audio',
  opus: 'audio',
  m4a: 'audio',
  bvh: 'anim'
}

export const kindOfFile = (name: string): ComfyKind | null => EXT_KIND[path.extname(name).slice(1).toLowerCase()] ?? null

/**
 * Geçmiş kaydındaki çıktı dosyaları. ComfyUI kaydedilen dosyaları "images", "audio", "3d" listelerinde
 * {filename, subfolder, type} olarak verir; özel düğümler başka anahtar ya da düz yol kullanabilir.
 * Kaydedilen (output) dosya varsa yalnızca onlar, yoksa önizlemeler (temp) alınır.
 */
export function collectOutputs(outputs: Record<string, Record<string, unknown>>, wf: ComfyWorkflow = {}): ComfyFile[] {
  const found: ComfyFile[] = []
  const seen = new Set<string>()
  for (const [node, ui] of Object.entries(outputs ?? {})) {
    const role = titleRole(wf[node]?._meta?.title)
    const forced: ComfyKind | null = role === 'image' || role === 'model' || role === 'audio' || role === 'anim' ? role : null
    for (const list of Object.values(ui ?? {})) {
      if (!Array.isArray(list)) continue
      for (const item of list) {
        let f: { filename: string; subfolder: string; type: string } | null = null
        if (item && typeof item === 'object' && typeof (item as { filename?: unknown }).filename === 'string') {
          const o = item as { filename: string; subfolder?: string; type?: string }
          f = { filename: o.filename, subfolder: o.subfolder ?? '', type: o.type ?? 'output' }
        } else if (typeof item === 'string' && kindOfFile(item.replace(/\s*\[\w+\]$/, ''))) {
          // "3d/model_00001_.glb [output]" biçimindeki düz yollar
          const ann = item.match(/\s*\[(\w+)\]$/)
          const p = item.replace(/\s*\[\w+\]$/, '').replace(/\\/g, '/')
          f = { filename: p.split('/').pop()!, subfolder: p.split('/').slice(0, -1).join('/'), type: ann ? ann[1] : 'output' }
        }
        if (!f) continue
        const key = `${f.type}/${f.subfolder}/${f.filename}`
        if (seen.has(key)) continue
        seen.add(key)
        const byExt = kindOfFile(f.filename)
        // AF:anim başlıklı düğümün FBX'i animasyondur; diğer uzantılar başlıktan bağımsız kendi türünde kalır
        found.push({ ...f, node, kind: forced && (byExt === null || byExt === forced || (forced === 'anim' && byExt === 'model')) ? forced : byExt })
      }
    }
  }
  const saved = found.filter((f) => f.type === 'output')
  return saved.length ? saved : found
}

// ── HTTP ────────────────────────────────────────────────────────────

const base = (url: string) => url.trim().replace(/\/+$/, '')

async function request(url: string, init: RequestInit & { signal?: AbortSignal }, what: string): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (e) {
    if (init.signal?.aborted) throw e
    throw new Error(`ComfyUI'a ulaşılamadı (${new URL(url).origin}) — ${what}. ComfyUI açık mı?`, { cause: e })
  }
}

/** Sunucu sürümü ve GPU: Ayarlar'daki "Bağlantıyı test et" için */
export async function comfyInfo(url: string): Promise<string> {
  const r = await request(`${base(url)}/system_stats`, { signal: AbortSignal.timeout(8000) }, 'sistem bilgisi')
  if (!r.ok) throw new Error(`ComfyUI yanıtı ${r.status}`)
  const j = (await r.json()) as { system?: { comfyui_version?: string }; devices?: { name?: string; vram_total?: number }[] }
  const d = j.devices?.[0]
  const gpu = d?.name ? ` · ${d.name.replace(/^cuda:\d+\s*/, '').replace(/\s*:\s*cudaMallocAsync$/, '')}${d.vram_total ? ` ${Math.round(d.vram_total / 2 ** 30)} GB` : ''}` : ''
  return `ComfyUI ${j.system?.comfyui_version ?? '?'}${gpu}`
}

async function upload(url: string, file: string, subfolder: string, signal?: AbortSignal): Promise<string> {
  const form = new FormData()
  form.append('image', new Blob([fs.readFileSync(file)]), path.basename(file))
  form.append('type', 'input')
  form.append('subfolder', subfolder)
  form.append('overwrite', 'true')
  const r = await request(`${base(url)}/upload/image`, { method: 'POST', body: form, signal }, 'dosya yükleme')
  if (!r.ok) throw new Error(`ComfyUI dosyayı kabul etmedi (${r.status}): ${(await r.text()).slice(0, 200)}`)
  const j = (await r.json()) as { name: string; subfolder?: string }
  return j.subfolder ? `${j.subfolder}/${j.name}` : j.name
}

/** /prompt 400 yanıtını okunur hale getirir (eksik düğüm, hatalı giriş) */
export function describeRejection(body: string): string {
  let j: { error?: { message?: string; details?: string }; node_errors?: Record<string, { class_type?: string; errors?: { message?: string; details?: string }[] }> }
  try {
    j = JSON.parse(body)
  } catch {
    return body.slice(0, 300)
  }
  const lines = [j.error?.message, j.error?.details].filter(Boolean) as string[]
  for (const [id, ne] of Object.entries(j.node_errors ?? {})) {
    for (const e of ne.errors ?? []) lines.push(`#${id} ${ne.class_type ?? ''}: ${e.message ?? ''}${e.details ? ` (${e.details})` : ''}`)
  }
  const text = lines.join(' · ').slice(0, 600) || body.slice(0, 300)
  const missing = /node\s+(\S+)\s+does not exist|Cannot execute because node (\S+)/i.exec(text)
  return missing ? `${text} — eksik düğüm: ComfyUI Manager’dan ilgili custom node’u kurun` : text
}

type HistoryEntry = {
  outputs: Record<string, Record<string, unknown>>
  status?: { status_str?: string; completed?: boolean; messages?: [string, Record<string, unknown>][] }
}

export interface ComfyRunOptions {
  url: string
  /** Comfy hesabı anahtarı: partner düğümleri (Meshy, Tripo, ElevenLabs …) için */
  apiKey?: string
  workflowPath: string
  values: ComfyValues
  /** Yüklenecek yerel dosyalar; ComfyUI'daki adları values'a yazılır */
  uploads?: { image?: string; model?: string; audio?: string }
  outDir: string
  baseName: string
  log: (m: string) => void
  warn?: (m: string) => void
  progress?: (p: number) => void
  signal?: AbortSignal
  timeoutMin?: number
}

export interface ComfyResult {
  files: Record<ComfyKind, string[]>
  promptId: string
  skipped: string[]
}

export async function comfyRun(o: ComfyRunOptions): Promise<ComfyResult> {
  const root = base(o.url)
  if (!fs.existsSync(o.workflowPath)) throw new Error(`ComfyUI workflow bulunamadı: ${o.workflowPath}`)
  const values: ComfyValues = { ...o.values }
  for (const [role, sub] of [
    ['image', ''],
    ['model', '3d'],
    ['audio', '']
  ] as const) {
    const file = o.uploads?.[role]
    if (!file) continue
    values[role] = await upload(root, file, sub, o.signal)
    o.log(`ComfyUI'a yüklendi: ${values[role]}`)
  }

  const { workflow, applied, unused } = prepareWorkflow(fs.readFileSync(o.workflowPath, 'utf8'), values)
  for (const a of applied) o.log(`  ${a}`)
  for (const r of unused) {
    const hint = r === 'prompt' ? 'metin düğümünün başlığını AF:prompt yapın' : `yükleyici düğümün başlığını AF:${r} yapın`
    ;(o.warn ?? o.log)(`Workflow'da ${r} için yer bulunamadı; ${hint}`)
  }

  const clientId = randomUUID()
  const total = Object.keys(workflow).length
  let executed = 0
  let wsError = ''
  let promptId = ''
  let ws: WebSocket | null = null
  try {
    ws = new WebSocket(`${root.replace(/^http/i, 'ws')}/ws?clientId=${clientId}`)
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return // önizleme kareleri (ikili)
      try {
        const m = JSON.parse(ev.data) as { type: string; data: { prompt_id?: string; node?: string | null; value?: number; max?: number; exception_message?: string; node_type?: string } }
        if (promptId && m.data?.prompt_id && m.data.prompt_id !== promptId) return
        if (m.type === 'executing' && m.data.node) {
          executed++
          o.progress?.(Math.min(95, (executed / total) * 95))
        } else if (m.type === 'progress' && m.data.max) {
          o.progress?.(Math.min(95, ((Math.max(0, executed - 1) + (m.data.value ?? 0) / m.data.max) / total) * 95))
        } else if (m.type === 'execution_error') {
          wsError = `${m.data.node_type ?? ''}: ${m.data.exception_message ?? 'hata'}`.trim()
        }
      } catch {
        /* tanınmayan mesaj */
      }
    }
    ws.onerror = () => undefined // ilerleme yalnızca bilgi; geçmiş sorgusu yeterli
  } catch {
    ws = null
  }

  try {
    const res = await request(
      `${root}/prompt`,
      {
        method: 'POST',
        signal: o.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow, client_id: clientId, ...(o.apiKey ? { extra_data: { api_key_comfy_org: o.apiKey } } : {}) })
      },
      'workflow gönderme'
    )
    if (!res.ok) throw new Error(`ComfyUI workflow'u reddetti: ${describeRejection(await res.text())}`)
    promptId = ((await res.json()) as { prompt_id: string }).prompt_id
    o.log(`ComfyUI işi: ${promptId}`)

    const deadline = Date.now() + (o.timeoutMin && o.timeoutMin > 0 ? o.timeoutMin : 30) * 60_000
    let entry: HistoryEntry | undefined
    for (;;) {
      try {
        await sleep(1500, o.signal)
      } catch (e) {
        await cancel(root, promptId)
        throw e
      }
      const h = await request(`${root}/history/${promptId}`, { signal: o.signal }, 'durum sorgusu')
      entry = ((await h.json()) as Record<string, HistoryEntry>)[promptId]
      if (entry?.status?.status_str === 'error' || (wsError && entry)) {
        const err = entry.status?.messages?.find((m) => m[0] === 'execution_error')?.[1] as { node_type?: string; exception_message?: string } | undefined
        const msg = err ? `${err.node_type ?? ''}: ${err.exception_message ?? ''}`.trim() : wsError
        throw new Error(`ComfyUI workflow hata verdi${msg ? ` — ${msg.slice(0, 400)}` : ' (ComfyUI konsoluna bakın)'}`)
      }
      if (entry && (entry.status?.completed || entry.status?.status_str === 'success' || (!entry.status && Object.keys(entry.outputs ?? {}).length))) break
      if (Date.now() > deadline) {
        await cancel(root, promptId)
        throw new Error(`ComfyUI zaman aşımı (${o.timeoutMin || 30} dk)`)
      }
    }

    const outs = collectOutputs(entry.outputs, workflow)
    const files: Record<ComfyKind, string[]> = { image: [], model: [], audio: [], anim: [] }
    const skipped: string[] = []
    ensureDir(o.outDir)
    const counts = Object.fromEntries(Object.keys(files).map((k) => [k, outs.filter((f) => f.kind === k).length])) as Record<ComfyKind, number>
    for (const f of outs) {
      if (!f.kind) {
        skipped.push(f.filename)
        continue
      }
      const q = new URLSearchParams({ filename: f.filename, subfolder: f.subfolder, type: f.type })
      const r = await request(`${root}/view?${q}`, { signal: o.signal }, 'çıktı indirme')
      if (!r.ok) throw new Error(`ComfyUI çıktısı indirilemedi: ${f.filename} (${r.status})`)
      const n = files[f.kind].length + 1
      const ext = path.extname(f.filename).toLowerCase() || '.png'
      const dest = path.join(o.outDir, `${o.baseName}${counts[f.kind] > 1 ? `_${n}` : ''}${ext}`)
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
      files[f.kind].push(dest)
    }
    o.progress?.(100)
    return { files, promptId, skipped }
  } finally {
    try {
      ws?.close()
    } catch {
      /* zaten kapalı */
    }
  }
}

/** Kuyruktan çıkar; yalnızca bizim işimiz çalışıyorsa durdur (kullanıcının başka işine dokunma) */
async function cancel(root: string, promptId: string): Promise<void> {
  const post = (p: string, body: unknown) => fetch(`${root}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) })
  try {
    await post('/queue', { delete: [promptId] })
    const q = (await (await fetch(`${root}/queue`, { signal: AbortSignal.timeout(5000) })).json()) as { queue_running?: unknown[][] }
    if (q.queue_running?.some((item) => item[1] === promptId)) await post('/interrupt', { prompt_id: promptId })
  } catch {
    /* sunucu kapanmış olabilir */
  }
}
