// SPDX-License-Identifier: AGPL-3.0-only
// Genel HTTP isteği: standart API'si olmayan projeler (kendi 3D/ses/hareket sunucunuz, Replicate benzeri işler).
// İstek şablonla kurulur, sonuç yanıttaki bir yoldan (ör. "data.0.url") ya da yanıtın kendisinden alınır.
// İş kimliği dönen uçlar için durum sorgulama (poll) desteklenir.
import fs from 'node:fs'
import path from 'node:path'
import { ensureDir, sleep } from '../util'

export type HttpKind = 'image' | 'model' | 'audio' | 'anim'

/** Şablon değerleri: PROMPT, NEGATIVE, SEED, SECONDS, ASSET, ID, IMAGE_B64, IMAGE_DATA_URI, AUDIO_B64, MODEL_B64 … */
export type TemplateValues = Record<string, string | number | undefined>

/**
 * {{AD}} yer tutucularını doldurur. json: değer JSON dizgesi içine kaçışlı yazılır (şablonda "{{PROMPT}}" tırnak içinde);
 * sayılar tırnaksız da yazılabilir ({{SEED}}). url: değer adres için kodlanır. text: olduğu gibi.
 */
export function fillTemplate(tpl: string, v: TemplateValues, mode: 'json' | 'url' | 'text'): string {
  return tpl.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_m, name: string) => {
    const val = v[name]
    if (val === undefined) return ''
    const s = String(val)
    if (mode === 'url') return encodeURIComponent(s)
    if (mode === 'json') return JSON.stringify(s).slice(1, -1)
    return s
  })
}

/** "data.0.url", "output[0]", "images.*.url" gibi yollar; * dizinin her elemanı */
export function getPath(obj: unknown, p: string): unknown {
  const parts = p
    .trim()
    .replace(/\[(\d+|\*)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
  let cur: unknown[] = [obj]
  for (const key of parts) {
    const next: unknown[] = []
    for (const c of cur) {
      if (c == null || typeof c !== 'object') continue
      if (key === '*') next.push(...(Array.isArray(c) ? c : Object.values(c)))
      else next.push((c as Record<string, unknown>)[key])
    }
    cur = next.filter((x) => x !== undefined)
    if (!cur.length) return undefined
  }
  return p.includes('*') ? cur : cur[0]
}

const MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'model/gltf-binary': '.glb',
  'model/gltf+json': '.gltf',
  'model/obj': '.obj',
  'model/stl': '.stl',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/wave': '.wav',
  'audio/mpeg': '.mp3',
  'audio/flac': '.flac',
  'audio/ogg': '.ogg',
  'audio/opus': '.opus'
}
const KIND_EXT: Record<HttpKind, string> = { image: '.png', model: '.glb', audio: '.wav', anim: '.bvh' }

/** Uzantı: içerik türü → adresteki uzantı → çıktı türünün varsayılanı */
export function extFor(kind: HttpKind, contentType?: string | null, url?: string): string {
  const ct = contentType?.split(';')[0].trim().toLowerCase()
  if (ct && MIME_EXT[ct]) return MIME_EXT[ct]
  const fromUrl = url ? path.extname(new URL(url, 'http://x').pathname).toLowerCase() : ''
  if (/^\.(png|jpe?g|webp|glb|gltf|fbx|obj|stl|ply|usdz?|wav|mp3|flac|ogg|opus|bvh)$/.test(fromUrl)) return fromUrl
  return KIND_EXT[kind]
}

export interface HttpRunOptions {
  method: string
  url: string
  /** "Ad: değer" satırları */
  headers: string
  /** Kimlik (Authorization: Bearer); düğüme yazılmaz, sağlayıcıdan gelir */
  token?: string
  bodyType: 'json' | 'multipart' | 'none'
  /** json: şablon gövde · multipart: "alan=değer" satırları; değer @image / @model / @audio ise dosya eklenir */
  body: string
  values: TemplateValues
  files: { image?: string; model?: string; audio?: string }
  kind: HttpKind
  /** Boş = yanıtın kendisi dosyadır */
  resultPath: string
  /** Async uçlar: ilk yanıttaki iş kimliği yolu ve durum sorgu adresi ({{ID}}) */
  idPath?: string
  pollUrl?: string
  statusPath?: string
  doneValues?: string
  failValues?: string
  timeoutMin?: number
  outDir: string
  baseName: string
  log: (m: string) => void
  signal?: AbortSignal
}

function parseHeaders(text: string, v: TemplateValues): Record<string, string> {
  const h: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) h[line.slice(0, i).trim()] = fillTemplate(line.slice(i + 1).trim(), v, 'text')
  }
  return h
}

async function call(url: string, init: RequestInit, what: string): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new Error(`HTTP ${what}: sunucuya bağlanılamadı (${new URL(url).origin})`, { cause: e })
  }
  if (!res.ok) throw new Error(`HTTP ${what} hatası (${res.status}): ${(await res.text()).slice(0, 400)}`)
  return res
}

const list = (s: string | undefined, d: string) =>
  (s?.trim() ? s : d)
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)

export async function httpRun(o: HttpRunOptions): Promise<string[]> {
  const v = o.values
  const url = fillTemplate(o.url, v, 'url').trim()
  if (!/^https?:\/\//i.test(url)) throw new Error(`HTTP adresi geçersiz: ${url || '(boş)'}`)
  const headers: Record<string, string> = { ...parseHeaders(o.headers, v), ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}) }
  let body: string | FormData | undefined
  if (o.method !== 'GET' && o.bodyType === 'json' && o.body.trim()) {
    const text = fillTemplate(o.body, v, 'json')
    try {
      JSON.parse(text)
    } catch (e) {
      throw new Error(`İstek gövdesi geçerli JSON değil (yer tutucular doldurulduktan sonra): ${(e as Error).message}`, { cause: e })
    }
    body = text
    headers['Content-Type'] ??= 'application/json'
  } else if (o.method !== 'GET' && o.bodyType === 'multipart') {
    const form = new FormData()
    for (const line of o.body.split(/\r?\n/)) {
      const i = line.indexOf('=')
      if (i <= 0) continue
      const key = line.slice(0, i).trim()
      const val = line.slice(i + 1).trim()
      const ref = /^@(image|model|audio)$/.exec(val)?.[1] as keyof HttpRunOptions['files'] | undefined
      if (ref) {
        const f = o.files[ref]
        if (!f) throw new Error(`Çok parçalı gövde ${ref} dosyası istiyor ama düğüme ${ref} bağlı değil`)
        form.append(key, new Blob([fs.readFileSync(f)]), path.basename(f))
      } else form.append(key, fillTemplate(val, v, 'text'))
    }
    body = form
  }

  o.log(`HTTP ${o.method} ${new URL(url).origin}${new URL(url).pathname}`)
  let res = await call(url, { method: o.method, headers, body, signal: o.signal }, 'isteği')
  let finalUrl = url

  if (o.idPath?.trim() && o.pollUrl?.trim()) {
    const first = await res.json()
    const id = getPath(first, o.idPath)
    if (id === undefined || id === null || typeof id === 'object') throw new Error(`Yanıtta iş kimliği yok (${o.idPath}): ${JSON.stringify(first).slice(0, 300)}`)
    o.log(`İş kimliği: ${String(id)}`)
    const pollUrl = fillTemplate(o.pollUrl, { ...v, ID: String(id) }, 'url')
    const done = list(o.doneValues, 'succeeded,success,successful,completed,complete,done,finished')
    const failed = list(o.failValues, 'failed,failure,error,errored,canceled,cancelled,expired')
    const deadline = Date.now() + (o.timeoutMin && o.timeoutMin > 0 ? o.timeoutMin : 30) * 60_000
    const pollHeaders = { ...headers }
    delete pollHeaders['Content-Type']
    for (;;) {
      await sleep(3000, o.signal)
      res = await call(pollUrl, { headers: pollHeaders, signal: o.signal }, 'durum sorgusu')
      const j = await res.clone().json()
      const st = String(getPath(j, o.statusPath || 'status') ?? '').toLowerCase()
      if (failed.includes(st)) throw new Error(`İş başarısız (${st}): ${JSON.stringify(j).slice(0, 300)}`)
      if (done.includes(st)) break
      if (Date.now() > deadline) throw new Error(`HTTP işi zaman aşımı (${o.timeoutMin || 30} dk), son durum: ${st || '?'}`)
    }
    finalUrl = pollUrl
  }

  ensureDir(o.outDir)
  const out = (i: number, n: number, ext: string) => path.join(o.outDir, `${o.baseName}${n > 1 ? `_${i + 1}` : ''}${ext}`)

  // Sonuç yolu yoksa yanıt gövdesi dosyanın kendisidir
  if (!o.resultPath.trim()) {
    const ct = res.headers.get('content-type')
    if (ct?.includes('application/json')) throw new Error('Yanıt JSON; “Sonuç yolu” alanına dosyanın bulunduğu yolu yazın (ör. data.0.url)')
    const dest = out(0, 1, extFor(o.kind, ct, finalUrl))
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
    return [dest]
  }

  const j = await res.json()
  const found = getPath(j, o.resultPath)
  const items = (Array.isArray(found) ? found : [found]).map((x) => (x && typeof x === 'object' && 'url' in x ? (x as { url: unknown }).url : x)).filter((x) => typeof x === 'string' && x)
  if (!items.length) throw new Error(`Yanıtta “${o.resultPath}” yolunda dosya yok: ${JSON.stringify(j).slice(0, 300)}`)
  const files: string[] = []
  for (const [i, raw] of (items as string[]).entries()) {
    if (raw.startsWith('data:')) {
      const mime = /^data:([^;,]+)/.exec(raw)?.[1]
      const dest = out(i, items.length, extFor(o.kind, mime))
      fs.writeFileSync(dest, Buffer.from(raw.split(',')[1] ?? '', 'base64'))
      files.push(dest)
    } else if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) {
      const abs = new URL(raw, finalUrl).toString()
      // Aynı sunucudaki dosyalar aynı kimlikle indirilir; başka sunucuya anahtar gönderilmez
      const sameOrigin = new URL(abs).origin === new URL(finalUrl).origin
      const { 'Content-Type': _ct, ...getHeaders } = headers
      const r = await call(abs, { headers: sameOrigin ? getHeaders : {}, signal: o.signal }, 'dosya indirme')
      const dest = out(i, items.length, extFor(o.kind, r.headers.get('content-type'), abs))
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
      files.push(dest)
    } else if (/^[A-Za-z0-9+/=\s]{64,}$/.test(raw)) {
      const dest = out(i, items.length, KIND_EXT[o.kind])
      fs.writeFileSync(dest, Buffer.from(raw, 'base64'))
      files.push(dest)
    } else throw new Error(`Sonuç tanınmadı (adres, data: ya da base64 değil): ${raw.slice(0, 120)}`)
  }
  return files
}
