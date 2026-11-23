// SPDX-License-Identifier: AGPL-3.0-only
// Hızlı bağlantı: servisin giriş / anahtar sayfasını tarayıcıda açar.
// - OpenRouter: gerçek "giriş yap → onayla" akışı (OAuth PKCE), anahtar kendiliğinden gelir.
// - Diğerleri: kullanıcı sayfada anahtarı kopyalar, panodan yakalanır, API'ye sorularak doğrulanır, kaydedilir.
import { message, renderMessage, type MessageDescriptor } from '../shared/i18n/message'
import { UiError, errorMessage, errorEnvelope } from '../shared/i18n/errors'
import { translate } from '../shared/i18n'
import { clipboard, shell } from 'electron'
import http from 'node:http'
import crypto from 'node:crypto'
import type { AddressInfo } from 'node:net'
import type { ConnectEvent, ConnectService, LlmProvider } from '../shared/types'
import { writeLog } from './log'
import { getSettings, setSettings } from './settings'

export type KeyService = Exclude<ConnectService, 'openrouter'>

const localized = (uiMessage: MessageDescriptor) => ({ message: renderMessage('tr', uiMessage), uiMessage })
const text = <K extends import('../shared/i18n').MessageKey>(key: K, ...args: import('../shared/i18n').MessageArgs<K>) => translate(getSettings().locale, key, ...args)

const TIMEOUT_MS = 10 * 60 * 1000

export const KEY_PAGES: Record<KeyService, { name: string; url: string; key: string; hint: string }> = {
  anthropic: { name: 'Claude', url: 'https://platform.claude.com/settings/keys', key: 'sk-ant-[A-Za-z0-9_-]{20,}', hint: 'sk-ant-' },
  meshy: { name: 'Meshy', url: 'https://www.meshy.ai/settings/api', key: 'msy_[A-Za-z0-9_-]{16,}', hint: 'msy_' },
  elevenlabs: { name: 'ElevenLabs', url: 'https://elevenlabs.io/app/settings/api-keys', key: 'sk_[A-Za-z0-9]{30,}|[a-f0-9]{32}', hint: 'sk_' },
  huggingface: { name: 'Hugging Face', url: 'https://huggingface.co/settings/tokens/new?tokenType=read&tokenName=AssetForge', key: 'hf_[A-Za-z0-9]{20,}', hint: 'hf_' }
}

const KEY_CHAR = '[A-Za-z0-9_-]'

/**
 * Metnin içindeki bu servise ait anahtar. Kopyala düğmeleri bazen tırnak, satır sonu ya da
 * `MESHY_API_KEY=…` gibi bir satır kopyalar; anahtar bunların içinden de bulunur.
 */
export function findKey(service: KeyService, text: string): string | null {
  if (text.length > 4000) return null
  return text.match(new RegExp(`(?<!${KEY_CHAR})(?:${KEY_PAGES[service].key})(?!${KEY_CHAR})`))?.[0] ?? null
}

/** Panodaki metnin tamamı bu servisin anahtarı mı? (doğrulama ayrıca API ile yapılır) */
export function looksLikeKey(service: KeyService, text: string): boolean {
  const t = text.trim()
  return findKey(service, t) === t
}

/** "Panodakini dene" ile elle denenebilecek, tek parça anahtar benzeri metin */
export function plausibleToken(text: string): boolean {
  return /^[A-Za-z0-9_.:-]{16,300}$/.test(text.trim())
}

/** Servis anahtarı açıkça reddetti (ağ hatasından farklı: aynı anahtar bir daha denenmez) */
class KeyRejected extends UiError {}

const log = (service: ConnectService, text: string) => writeLog('info', `[connect] ${service}: ${text}`)

const OPENROUTER_PRESET: Omit<LlmProvider, 'id'> = {
  name: 'OpenRouter',
  kind: 'openai',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'meta-llama/llama-4-maverick',
  vision: true
}

let active: { service: ConnectService; stop: () => void; tryNow?: () => Promise<void> } | null = null

export function connectCancel(): void {
  if (!active) return
  const a = active
  active = null
  a.stop()
}

/** Bekleyen bağlantıda panodaki metni hemen dene (biçimi tanınmasa da) */
export async function connectTryClipboard(): Promise<void> {
  await active?.tryNow?.()
}

export async function connectStart(service: ConnectService, emit: (e: ConnectEvent) => void, onDone: () => void): Promise<void> {
  connectCancel()
  if (service === 'openrouter') return startOAuth(emit, onDone)
  return startClipboard(service, emit, onDone)
}

// ── Anahtarı panodan yakala ─────────────────────────────────────────

async function startClipboard(service: KeyService, emit: (e: ConnectEvent) => void, onDone: () => void): Promise<void> {
  const page = KEY_PAGES[service]
  const tried = new Set<string>()
  let last = ''
  let checking = false
  let timer: NodeJS.Timeout | undefined
  let deadline: NodeJS.Timeout | undefined

  const stop = (canceled = true) => {
    clearInterval(timer)
    clearTimeout(deadline)
    if (canceled) emit({ service, phase: 'canceled', ...localized(message('connect.canceled')) })
  }
  const finish = () => {
    if (active === me) active = null
    stop(false)
  }

  /**
   * Otomatik yakalamada yalnızca servisin anahtar biçimi kabul edilir (girişte kopyalanan
   * parola servise gönderilmesin). Elle "Panodakini dene"de tek parça her metin denenir.
   */
  const check = async (text: string, manual = false) => {
    const raw = text.trim()
    const key = findKey(service, raw) ?? (manual && plausibleToken(raw) ? raw : null)
    if (!key) {
      if (!raw && !manual) return
      log(service, raw ? `panoda anahtara benzemeyen metin (${raw.length} karakter)` : 'pano boş')
      emit({
        service,
        phase: 'waiting',
        ...localized(raw ? message('connect.keyFormat', { name: page.name, hint: page.hint }) : message('connect.emptyClipboard'))
      })
      return
    }
    if (!manual && tried.has(key)) {
      emit({ service, phase: 'error', pending: true, ...localized(message('connect.rejectedBefore', { name: page.name })) })
      return
    }
    checking = true
    log(service, `anahtar yakalandı (${manual ? 'elle' : 'otomatik'}), doğrulanıyor`)
    emit({ service, phase: 'checking', ...localized(message('connect.checkingKey')) })
    try {
      const info = await verifyKey(service, key)
      if (active !== me) return
      setSettings({ secrets: { [service]: key } })
      // Anahtar panoda açıkta kalmasın
      if ((await clipboard.readText()).includes(key)) clipboard.clear()
      log(service, 'bağlandı')
      finish()
      emit({ service, phase: 'done', ...localized(info) })
      onDone()
    } catch (e) {
      // Ağ hatasında aynı anahtar tekrar kopyalanınca yeniden denenir
      if (e instanceof KeyRejected) tried.add(key)
      log(service, `doğrulanamadı: ${(e as Error).message}`)
      if (active === me) emit({ service, phase: 'error', pending: true, ...localized(message('connect.retryKey', { detail: errorMessage(e) })) })
    } finally {
      checking = false
    }
  }

  const me = {
    service,
    stop: () => stop(true),
    tryNow: async () => {
      if (checking) return
      last = await clipboard.readText().catch(() => '')
      await check(last, true)
    }
  }
  active = me

  // Kullanıcı anahtarı önceden kopyalamış olabilir
  last = await clipboard.readText().catch(() => '')
  log(service, 'anahtar sayfası açılıyor, pano izleniyor')
  await shell.openExternal(page.url)
  emit({ service, phase: 'waiting', ...localized(message('connect.waitKey')) })
  if (findKey(service, last.trim())) void check(last)

  timer = setInterval(async () => {
    if (checking || active !== me) return
    const t = await clipboard.readText().catch(() => last)
    if (t === last) return
    last = t
    void check(t)
  }, 500)
  deadline = setTimeout(() => {
    if (active !== me) return
    finish()
    emit({ service, phase: 'error', ...localized(message('connect.timeoutKey')) })
  }, TIMEOUT_MS)
}

async function verifyKey(service: KeyService, key: string): Promise<MessageDescriptor> {
  const get = (url: string, headers: Record<string, string>) => fetch(url, { headers, signal: AbortSignal.timeout(15000) })
  const fail = async (r: Response) => {
    const body = await r.text().catch(() => '')
    return r.status === 401 || r.status === 403
      ? new KeyRejected(message('connect.keyRejected'))
      : new UiError(message('connect.response', { name: service, status: r.status, detail: body.slice(0, 120) }))
  }
  switch (service) {
    case 'anthropic': {
      const r = await get('https://api.anthropic.com/v1/models?limit=1', { 'x-api-key': key, 'anthropic-version': '2023-06-01' })
      if (!r.ok) throw await fail(r)
      return message('connect.connected', { name: 'Claude', detail: '' })
    }
    case 'meshy': {
      const r = await get('https://api.meshy.ai/openapi/v1/balance', { Authorization: `Bearer ${key}` })
      if (!r.ok) throw await fail(r)
      const j = (await r.json()) as { balance?: number }
      return message('connect.meshyBalance', { balance: j.balance ?? '?' })
    }
    case 'elevenlabs': {
      const r = await get('https://api.elevenlabs.io/v1/user/subscription', { 'xi-api-key': key })
      if (r.ok) {
        const j = (await r.json()) as { tier?: string }
        return message('connect.connected', { name: 'ElevenLabs', detail: j.tier ? ` · ${j.tier}` : '' })
      }
      // Kısıtlı anahtar: geçerli ama abonelik okuma izni yok
      const body = await r.text().catch(() => '')
      if (body.includes('missing_permissions')) return message('connect.limitedKey')
      throw r.status === 401 ? new KeyRejected(message('connect.keyRejected')) : new UiError(message('connect.response', { name: service, status: r.status, detail: '' }))
    }
    case 'huggingface': {
      const r = await get('https://huggingface.co/api/whoami-v2', { Authorization: `Bearer ${key}` })
      if (!r.ok) throw await fail(r)
      const j = (await r.json()) as { name?: string }
      return message('connect.connected', { name: 'Hugging Face', detail: j.name ? ` · ${j.name}` : '' })
    }
  }
}

// ── OpenRouter: giriş yap → onayla (OAuth PKCE) ─────────────────────

const b64url = (b: Buffer) => b.toString('base64url')

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function page(title: string, text: string, ok: boolean): string {
  return `<!doctype html><html lang="${getSettings().locale}"><meta charset="utf-8"><title>AssetForge</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#07080c;color:#eef0f5;font-family:Segoe UI,system-ui,sans-serif">
<div style="text-align:center;max-width:420px;padding:24px">
<div style="font-size:44px;color:${ok ? '#34d399' : '#e2235f'}">${ok ? '✓' : '✕'}</div>
<h2 style="margin:8px 0">${escapeHtml(title)}</h2><p style="color:#8a91a3">${escapeHtml(text)}</p></div></body></html>`
}

async function startOAuth(emit: (e: ConnectEvent) => void, onDone: () => void): Promise<void> {
  const service = 'openrouter' as const
  const verifier = b64url(crypto.randomBytes(32))
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest())
  const state = b64url(crypto.randomBytes(16))
  let deadline: NodeJS.Timeout | undefined

  const server = http.createServer()
  const close = () => {
    clearTimeout(deadline)
    server.close()
    server.closeAllConnections()
  }
  const me = {
    service,
    stop: () => {
      close()
      emit({ service, phase: 'canceled', ...localized(message('connect.canceled')) })
    }
  }
  const finish = () => {
    if (active === me) active = null
    close()
  }

  server.on('request', async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname !== '/callback') {
      res.writeHead(404).end()
      return
    }
    const reply = (status: number, html: string) => res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' }).end(html)
    const code = url.searchParams.get('code')
    if (!code || url.searchParams.get('state') !== state) {
      reply(400, page(text('connect.notApproved'), text('connect.closeRetry'), false))
      finish()
      emit({ service, phase: 'error', ...localized(message('connect.oauthRejected')) })
      return
    }
    emit({ service, phase: 'checking', ...localized(message('connect.creatingKey')) })
    try {
      const r = await fetch('https://openrouter.ai/api/v1/auth/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
        signal: AbortSignal.timeout(20000)
      })
      if (!r.ok) throw new UiError(message('connect.response', { name: 'OpenRouter', status: r.status, detail: '' }))
      const { key } = (await r.json()) as { key?: string }
      if (!key) throw new UiError(message('connect.noKey'))
      saveOpenRouterKey(key)
      reply(200, page(text('connect.appConnected'), text('connect.closeDone'), true))
      finish()
      emit({ service, phase: 'done', ...localized(message('connect.routerDone')) })
      onDone()
    } catch (e) {
      reply(500, page(text('connect.problem'), renderMessage(getSettings().locale, errorMessage(e)), false))
      finish()
      emit({ service, phase: 'error', message: (e as Error).message, uiMessage: errorEnvelope(e).uiMessage })
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  active = me
  const port = (server.address() as AddressInfo).port
  const auth = new URL('https://openrouter.ai/auth')
  auth.searchParams.set('callback_url', `http://localhost:${port}/callback`)
  auth.searchParams.set('code_challenge', challenge)
  auth.searchParams.set('code_challenge_method', 'S256')
  auth.searchParams.set('state', state)
  auth.searchParams.set('key_label', 'AssetForge')
  await shell.openExternal(auth.toString())
  emit({ service, phase: 'waiting', ...localized(message('connect.waitRouter')) })
  deadline = setTimeout(() => {
    if (active !== me) return
    finish()
    emit({ service, phase: 'error', ...localized(message('connect.timeout')) })
  }, TIMEOUT_MS)
}

function saveOpenRouterKey(key: string): void {
  const list = getSettings().llmProviders
  let p = list.find((x) => x.baseUrl.includes('openrouter.ai'))
  if (!p) {
    p = { ...OPENROUTER_PRESET, id: `llm_${crypto.randomBytes(3).toString('hex')}` }
    setSettings({ llmProviders: [...list, p] })
  }
  setSettings({ providerKeys: { [p.id]: key } })
}
