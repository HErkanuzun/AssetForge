// SPDX-License-Identifier: AGPL-3.0-only
// Herhangi bir Gradio uygulamasını API'siyle çalıştırır (yerel demo, Pinokio'nun açtığı uygulama, Hugging Face Space).
// Gradio 4 ve 5: /info (5'te /gradio_api/info) uç noktaları ve girişleri anlatır; /call/<ad> işi başlatır,
// /call/<ad>/<event_id> sonucu SSE olarak akıtır; dosyalar /upload ile yüklenir, /file= ile indirilir.
// AssetForge'un girişleri (prompt, negatif, seed, süre, görsel, model, ses) bileşen türü ve adına göre eşlenir.
import fs from 'node:fs'
import path from 'node:path'
import type { ComfyOutputKind, GradioEndpointInfo } from '../../shared/types'
import { ensureDir } from '../util'
import { kindOfFile } from './comfyui'

export type GradioRole = 'prompt' | 'negative' | 'seed' | 'seconds' | 'image' | 'model' | 'audio' | 'file'

interface RawParam {
  label?: string
  parameter_name?: string
  parameter_has_default?: boolean
  parameter_default?: unknown
  component?: string
  type?: { type?: string }
  python_type?: { type?: string }
}
interface RawInfo {
  named_endpoints?: Record<string, { parameters?: RawParam[]; returns?: { label?: string; component?: string }[] }>
}

const base = (url: string) => url.trim().replace(/\/+$/, '')
const headers = (token?: string): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {})

async function request(url: string, init: RequestInit, what: string): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (e) {
    if (init.signal?.aborted) throw e
    throw new Error(`Gradio uygulamasına ulaşılamadı (${new URL(url).origin}) — ${what}. Uygulama açık mı?`, { cause: e })
  }
}

/** Gradio 5 API'yi /gradio_api altına taşıdı; 4 kökte. Hangisi yanıt veriyorsa o. */
export async function gradioApi(url: string, token?: string, signal?: AbortSignal): Promise<{ api: string; info: RawInfo }> {
  const root = base(url)
  let last = ''
  for (const prefix of ['/gradio_api', '']) {
    const r = await request(`${root}${prefix}/info`, { headers: headers(token), signal: signal ?? AbortSignal.timeout(10000) }, 'uç nokta listesi')
    if (r.ok) {
      const info = (await r.json().catch(() => null)) as RawInfo | null
      if (info && typeof info === 'object' && info.named_endpoints) return { api: `${root}${prefix}`, info }
    }
    last = `${r.status}`
  }
  throw new Error(`Bu adreste Gradio API’si bulunamadı (${root}, yanıt ${last}). Gradio 4 veya üstü gerekir; uygulamada API kapalı olabilir.`)
}

const KIND_BY_COMPONENT: Record<string, ComfyOutputKind> = { image: 'image', imageeditor: 'image', gallery: 'image', annotatedimage: 'image', model3d: 'model', audio: 'audio' }

/** Gradio girişlerini AssetForge rollerine eşler: ilk metin kutusu prompt, adı negatif olan negatif, seed, süre, ilk görsel/model/ses */
export function mapRoles(params: RawParam[]): (GradioRole | undefined)[] {
  const taken = new Set<GradioRole>()
  const take = (r: GradioRole) => (taken.has(r) ? undefined : (taken.add(r), r))
  const name = (p: RawParam) => `${p.parameter_name ?? ''} ${p.label ?? ''}`.toLowerCase()
  // Önce adıyla belli olanlar, sonra türüyle
  const first = params.map((p) => {
    const c = (p.component ?? '').toLowerCase()
    const n = name(p)
    if (c === 'textbox' && /neg/.test(n)) return take('negative')
    if ((c === 'number' || c === 'slider') && /seed/.test(n)) return take('seed')
    if ((c === 'number' || c === 'slider') && /duration|seconds|length|süre/.test(n)) return take('seconds')
    return undefined
  })
  return params.map((p, i) => {
    if (first[i]) return first[i]
    const c = (p.component ?? '').toLowerCase()
    if (c === 'textbox' && !/neg/.test(name(p))) return take('prompt')
    if (c === 'image' || c === 'imageeditor') return take('image')
    if (c === 'model3d') return take('model')
    if (c === 'audio') return take('audio')
    if (c === 'file' || c === 'uploadbutton') return take('file')
    return undefined
  })
}

export async function gradioEndpoints(url: string, token?: string): Promise<GradioEndpointInfo[]> {
  const { info } = await gradioApi(url, token)
  return Object.entries(info.named_endpoints ?? {}).map(([name, ep]) => {
    const params = ep.parameters ?? []
    const roles = mapRoles(params)
    return {
      name,
      params: params.map((p, i) => ({
        name: p.parameter_name ?? `arg${i}`,
        label: p.label ?? '',
        component: p.component ?? '',
        type: p.python_type?.type ?? p.type?.type ?? '',
        hasDefault: !!p.parameter_has_default,
        default: p.parameter_default,
        role: roles[i]
      })),
      returns: (ep.returns ?? []).map((r) => ({ label: r.label ?? '', component: r.component ?? '', kind: KIND_BY_COMPONENT[(r.component ?? '').toLowerCase()] ?? null }))
    }
  })
}

async function upload(api: string, file: string, token?: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const form = new FormData()
  form.append('files', new Blob([fs.readFileSync(file)]), path.basename(file))
  const r = await request(`${api}/upload`, { method: 'POST', body: form, headers: headers(token), signal }, 'dosya yükleme')
  if (!r.ok) throw new Error(`Gradio dosyayı kabul etmedi (${r.status}): ${(await r.text()).slice(0, 200)}`)
  const [p] = (await r.json()) as string[]
  return { path: p, orig_name: path.basename(file), meta: { _type: 'gradio.FileData' } }
}

/** SSE akışından son olayı çıkarır: complete → veri, error → hata */
export function parseSse(text: string): { event: string; data: unknown }[] {
  const out: { event: string; data: unknown }[] = []
  for (const block of text.split(/\r?\n\r?\n/)) {
    let event = 'message'
    const data: string[] = []
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).trim())
    }
    if (!data.length && event === 'message') continue
    const raw = data.join('\n')
    let parsed: unknown = raw
    try {
      parsed = raw ? JSON.parse(raw) : null
    } catch {
      /* düz metin */
    }
    out.push({ event, data: parsed })
  }
  return out
}

interface FileRef {
  url?: string
  path?: string
  orig_name?: string
}

/** Sonuç dizisindeki dosyalar: tek dosya, galeri ([{image, caption}]), iç içe listeler */
export function collectFiles(data: unknown[], returns: { component?: string }[] = []): { ref: FileRef; kind: ComfyOutputKind | null }[] {
  const found: { ref: FileRef; kind: ComfyOutputKind | null }[] = []
  const walk = (v: unknown, comp: string) => {
    if (!v) return
    if (Array.isArray(v)) return v.forEach((x) => walk(x, comp))
    if (typeof v !== 'object') return
    const o = v as Record<string, unknown>
    if (typeof o.url === 'string' || (typeof o.path === 'string' && (o.meta as { _type?: string } | undefined)?._type === 'gradio.FileData')) {
      const ref = { url: o.url as string | undefined, path: o.path as string | undefined, orig_name: o.orig_name as string | undefined }
      const name = ref.orig_name ?? ref.path ?? ref.url ?? ''
      found.push({ ref, kind: KIND_BY_COMPONENT[comp] ?? kindOfFile(name.split('?')[0]) })
      return
    }
    for (const k of ['image', 'video', 'audio', 'model', 'file', 'value']) if (o[k]) walk(o[k], comp)
  }
  data.forEach((v, i) => walk(v, (returns[i]?.component ?? '').toLowerCase()))
  return found
}

export interface GradioRunOptions {
  url: string
  token?: string
  /** Uç nokta adı ("/predict"); boş = ilk uç nokta */
  endpoint?: string
  values: { prompt?: string; negative?: string; seed?: number; seconds?: number }
  uploads?: { image?: string; model?: string; audio?: string }
  /** Parametre adı ya da etiketi → sabit değer (JSON'dan) */
  overrides?: Record<string, unknown>
  outDir: string
  baseName: string
  log: (m: string) => void
  warn?: (m: string) => void
  progress?: (p: number) => void
  signal?: AbortSignal
  timeoutMin?: number
}

export async function gradioRun(o: GradioRunOptions): Promise<{ files: Record<ComfyOutputKind, string[]>; text: string[] }> {
  const { api, info } = await gradioApi(o.url, o.token, o.signal)
  const names = Object.keys(info.named_endpoints ?? {})
  if (!names.length) throw new Error('Gradio uygulamasında API’ye açık uç nokta yok')
  const want = o.endpoint?.trim()
  const name = want ? names.find((n) => n === want || n === `/${want.replace(/^\//, '')}`) : names[0]
  if (!name) throw new Error(`Gradio uç noktası “${want}” yok. Var olanlar: ${names.join(', ')}`)
  const ep = info.named_endpoints![name]
  const params = ep.parameters ?? []
  const roles = mapRoles(params)
  o.log(`Gradio: ${api.replace(/\/gradio_api$/, '')} · uç nokta ${name}`)

  const files: Record<string, Record<string, unknown>> = {}
  for (const k of ['image', 'model', 'audio'] as const) {
    const f = o.uploads?.[k]
    if (f) files[k] = await upload(api, f, o.token, o.signal)
  }
  const ov = o.overrides ?? {}
  const used = new Set<string>()
  const data = params.map((p, i) => {
    const key = [p.parameter_name, p.label].find((k) => k && k in ov)
    if (key) {
      used.add(key)
      return ov[key]
    }
    const role = roles[i]
    let v: unknown
    if (role === 'prompt') v = o.values.prompt
    else if (role === 'negative') v = o.values.negative
    else if (role === 'seed') v = o.values.seed
    else if (role === 'seconds') v = o.values.seconds
    else if (role === 'image' || role === 'model' || role === 'audio') v = files[role]
    else if (role === 'file') v = files.image ?? files.model ?? files.audio
    if (v !== undefined) {
      o.log(`  ${role} → ${p.parameter_name ?? p.label ?? i}`)
      return v
    }
    return p.parameter_has_default ? p.parameter_default : null
  })
  for (const k of Object.keys(ov)) if (!used.has(k)) (o.warn ?? o.log)(`Gradio: “${k}” adlı giriş yok (sabit değer kullanılmadı)`)
  for (const [k, v] of Object.entries(o.uploads ?? {}))
    if (v && !roles.includes(k as GradioRole) && !roles.includes('file')) (o.warn ?? o.log)(`Gradio: uygulamada ${k} girişi yok; bağlı dosya kullanılmadı`)

  const call = await request(
    `${api}/call/${name.replace(/^\//, '')}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers(o.token) }, body: JSON.stringify({ data }), signal: o.signal },
    'iş başlatma'
  )
  if (!call.ok) throw new Error(`Gradio isteği reddetti (${call.status}): ${(await call.text()).slice(0, 300)}`)
  const { event_id } = (await call.json()) as { event_id: string }
  o.progress?.(10)
  const timeout = AbortSignal.timeout((o.timeoutMin && o.timeoutMin > 0 ? o.timeoutMin : 30) * 60_000)
  const sig = o.signal ? AbortSignal.any([o.signal, timeout]) : timeout
  const res = await request(`${api}/call/${name.replace(/^\//, '')}/${event_id}`, { headers: headers(o.token), signal: sig }, 'sonuç bekleme')
  let text: string
  try {
    text = await res.text()
  } catch (e) {
    if (timeout.aborted) throw new Error(`Gradio zaman aşımı (${o.timeoutMin || 30} dk)`, { cause: e })
    throw e
  }
  const events = parseSse(text)
  const err = events.find((e) => e.event === 'error')
  const done = [...events].reverse().find((e) => e.event === 'complete')
  if (!done)
    throw new Error(`Gradio uygulaması hata verdi${err?.data ? ` — ${String(typeof err.data === 'string' ? err.data : JSON.stringify(err.data)).slice(0, 300)}` : ' (uygulamanın konsoluna bakın)'}`)
  const result = Array.isArray(done.data) ? done.data : [done.data]
  o.progress?.(80)

  const out: Record<ComfyOutputKind, string[]> = { image: [], model: [], audio: [], anim: [] }
  const texts = result.filter((v): v is string => typeof v === 'string' && !!v.trim())
  for (const t of texts) o.log(`Gradio metin çıktısı: ${t.slice(0, 200)}`)
  const found = collectFiles(result, ep.returns ?? [])
  ensureDir(o.outDir)
  const counts: Record<string, number> = {}
  for (const f of found) if (f.kind) counts[f.kind] = (counts[f.kind] ?? 0) + 1
  for (const f of found) {
    if (!f.kind) {
      o.log(`Tanınmayan çıktı atlandı: ${f.ref.orig_name ?? f.ref.path ?? f.ref.url}`)
      continue
    }
    const src = f.ref.url ? (/^https?:/i.test(f.ref.url) ? f.ref.url : `${base(o.url)}${f.ref.url.startsWith('/') ? '' : '/'}${f.ref.url}`) : `${api}/file=${f.ref.path}`
    const r = await request(src, { headers: headers(o.token), signal: o.signal }, 'çıktı indirme')
    if (!r.ok) throw new Error(`Gradio çıktısı indirilemedi (${r.status}): ${src}`)
    const n = out[f.kind].length + 1
    const ext = path.extname((f.ref.orig_name ?? f.ref.path ?? src).split('?')[0]).toLowerCase() || '.bin'
    const dest = path.join(o.outDir, `${o.baseName}${counts[f.kind] > 1 ? `_${n}` : ''}${ext}`)
    fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
    out[f.kind].push(dest)
  }
  o.progress?.(100)
  return { files: out, text: texts }
}
