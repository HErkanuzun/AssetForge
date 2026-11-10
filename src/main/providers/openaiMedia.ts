// SPDX-License-Identifier: AGPL-3.0-only
// OpenAI uyumlu görsel ve ses uçları: /images/generations, /images/edits, /audio/speech.
// OpenAI, LocalAI, LiteLLM, Together, Fireworks, Kokoro-FastAPI, openedai-speech, Chatterbox gibi sunucularla çalışır.
// Sağlayıcılar Ayarlar → Yapay zeka modelleri'ndeki OpenAI uyumlu kayıtlardır (adres + anahtar oradan gelir).
import fs from 'node:fs'
import path from 'node:path'
import type { LlmProvider } from '../../shared/types'
import { providerKey } from '../settings'
import { ensureDir } from '../util'

/** Sağlayıcı adresinin kökü: ".../v1" (sohbet ucu yazılmışsa kırpılır) */
export function apiBase(p: Pick<LlmProvider, 'baseUrl'>): string {
  return (p.baseUrl || 'https://api.openai.com/v1')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(chat\/completions|completions|images\/generations|audio\/speech)$/, '')
}

function auth(p: LlmProvider): Record<string, string> {
  const key = providerKey(p)
  return key ? { Authorization: `Bearer ${key}` } : {}
}

async function send(p: LlmProvider, url: string, init: RequestInit, what: string): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new Error(`${p.name}: ${what} için sunucuya bağlanılamadı (${url}). Sunucu açık mı?`, { cause: e })
  }
  if (!res.ok) {
    const t = (await res.text()).slice(0, 500)
    const hint = res.status === 404 ? ' — bu sunucu bu ucu desteklemiyor olabilir' : res.status === 401 ? ' — anahtar eksik ya da yanlış' : ''
    throw new Error(`${p.name} ${what} hatası (${res.status})${hint}: ${t}`)
  }
  return res
}

export interface ImageOptions {
  provider: LlmProvider
  model: string
  prompt: string
  /** Verilirse /images/edits (görselden görsel) kullanılır */
  image?: string
  n?: number
  size?: string
  quality?: string
  outDir: string
  baseName: string
  signal?: AbortSignal
}

/** Yanıttaki görseller: b64_json ya da url */
async function saveImages(data: { b64_json?: string; url?: string }[], o: ImageOptions): Promise<string[]> {
  ensureDir(o.outDir)
  const files: string[] = []
  for (const [i, d] of data.entries()) {
    const dest = path.join(o.outDir, `${o.baseName}${data.length > 1 ? `_${i + 1}` : ''}.png`)
    if (d.b64_json) fs.writeFileSync(dest, Buffer.from(d.b64_json, 'base64'))
    else if (d.url?.startsWith('data:')) fs.writeFileSync(dest, Buffer.from(d.url.split(',')[1] ?? '', 'base64'))
    else if (d.url) {
      const r = await fetch(d.url, { signal: o.signal })
      if (!r.ok) throw new Error(`Görsel indirilemedi (${r.status})`)
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
    } else continue
    files.push(dest)
  }
  return files
}

export async function openaiImage(o: ImageOptions): Promise<string[]> {
  const base = apiBase(o.provider)
  const n = Math.max(1, Math.min(8, Math.round(o.n ?? 1)))
  let res: Response
  if (o.image) {
    const form = new FormData()
    form.append('model', o.model)
    form.append('prompt', o.prompt)
    form.append('n', String(n))
    if (o.size) form.append('size', o.size)
    if (o.quality) form.append('quality', o.quality)
    form.append('image', new Blob([fs.readFileSync(o.image)], { type: 'image/png' }), path.basename(o.image))
    res = await send(o.provider, `${base}/images/edits`, { method: 'POST', headers: auth(o.provider), body: form, signal: o.signal }, 'görsel düzenleme')
  } else {
    // Yalnızca verilen alanlar gönderilir: bazı sunucular tanımadığı alanı reddeder
    const body: Record<string, unknown> = { model: o.model, prompt: o.prompt, n }
    if (o.size) body.size = o.size
    if (o.quality) body.quality = o.quality
    res = await send(
      o.provider,
      `${base}/images/generations`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(o.provider) }, body: JSON.stringify(body), signal: o.signal },
      'görsel üretimi'
    )
  }
  const j = (await res.json()) as { data?: { b64_json?: string; url?: string }[] }
  const files = await saveImages(j.data ?? [], o)
  if (!files.length) throw new Error(`${o.provider.name} görsel döndürmedi`)
  return files
}

export interface SpeechOptions {
  provider: LlmProvider
  model: string
  voice: string
  text: string
  /** wav, mp3, flac, opus, aac, pcm */
  format?: string
  speed?: number
  /** Ses tonu talimatı (gpt-4o-mini-tts ve benzerleri) */
  instructions?: string
  out: string
  signal?: AbortSignal
}

export async function openaiSpeech(o: SpeechOptions): Promise<string> {
  const body: Record<string, unknown> = { model: o.model, input: o.text, voice: o.voice, response_format: o.format || 'wav' }
  if (o.speed && o.speed !== 1) body.speed = o.speed
  if (o.instructions?.trim()) body.instructions = o.instructions.trim()
  const res = await send(
    o.provider,
    `${apiBase(o.provider)}/audio/speech`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(o.provider) }, body: JSON.stringify(body), signal: o.signal },
    'konuşma sesi'
  )
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 64) throw new Error(`${o.provider.name} boş ses döndürdü`)
  ensureDir(path.dirname(o.out))
  fs.writeFileSync(o.out, buf)
  return o.out
}
