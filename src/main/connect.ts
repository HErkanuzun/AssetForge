// Hızlı bağlantı: servisin giriş / anahtar sayfasını tarayıcıda açar.
// - OpenRouter: gerçek "giriş yap → onayla" akışı (OAuth PKCE), anahtar kendiliğinden gelir.
// - Diğerleri: kullanıcı sayfada anahtarı kopyalar, panodan yakalanır, API'ye sorularak doğrulanır, kaydedilir.
import { clipboard, shell } from 'electron'
import http from 'node:http'
import crypto from 'node:crypto'
import type { AddressInfo } from 'node:net'
import type { ConnectEvent, ConnectService, LlmProvider } from '../shared/types'
import { getSettings, setSettings } from './settings'

type KeyService = Exclude<ConnectService, 'openrouter'>

const TIMEOUT_MS = 10 * 60 * 1000

const KEY_PAGES: Record<KeyService, { url: string; pattern: RegExp }> = {
  anthropic: { url: 'https://platform.claude.com/settings/keys', pattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/ },
  meshy: { url: 'https://www.meshy.ai/settings/api', pattern: /^msy_[A-Za-z0-9_-]{16,}$/ },
  elevenlabs: { url: 'https://elevenlabs.io/app/settings/api-keys', pattern: /^(sk_[A-Za-z0-9]{30,}|[a-f0-9]{32})$/ },
  huggingface: { url: 'https://huggingface.co/settings/tokens/new?tokenType=read&tokenName=AssetForge', pattern: /^hf_[A-Za-z0-9]{20,}$/ }
}

const OPENROUTER_PRESET: Omit<LlmProvider, 'id'> = {
  name: 'OpenRouter',
  kind: 'openai',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'meta-llama/llama-4-maverick',
  vision: true
}

let active: { service: ConnectService; stop: () => void } | null = null

export function connectCancel(): void {
  if (!active) return
  const a = active
  active = null
  a.stop()
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
    if (canceled) emit({ service, phase: 'canceled', message: 'İptal edildi' })
  }
  const me = { service, stop: () => stop(true) }
  active = me
  const finish = () => {
    if (active === me) active = null
    stop(false)
  }

  const check = async (text: string) => {
    const key = text.trim()
    if (!page.pattern.test(key) || tried.has(key)) return
    tried.add(key)
    checking = true
    emit({ service, phase: 'checking', message: 'Anahtar yakalandı, doğrulanıyor…' })
    try {
      const info = await verifyKey(service, key)
      if (active !== me) return
      setSettings({ secrets: { [service]: key } })
      // Anahtar panoda açıkta kalmasın
      if ((await clipboard.readText()).trim() === key) clipboard.clear()
      finish()
      emit({ service, phase: 'done', message: info })
      onDone()
    } catch (e) {
      if (active === me) emit({ service, phase: 'error', message: `${(e as Error).message} — başka bir anahtar kopyalayabilirsiniz, beklemeye devam ediyorum.` })
    } finally {
      checking = false
    }
  }

  // Kullanıcı anahtarı önceden kopyalamış olabilir
  last = await clipboard.readText()
  await shell.openExternal(page.url)
  emit({ service, phase: 'waiting', message: 'Tarayıcıda giriş yapın, yeni anahtar oluşturup Kopyala’ya basın — AssetForge otomatik yakalar.' })
  void check(last)

  timer = setInterval(async () => {
    if (checking) return
    const t = await clipboard.readText().catch(() => last)
    if (t === last || active !== me) return
    last = t
    void check(t)
  }, 700)
  deadline = setTimeout(() => {
    if (active !== me) return
    finish()
    emit({ service, phase: 'error', message: 'Süre doldu (10 dk). Tekrar “Bağlan”a basın ya da anahtarı elle yapıştırın.' })
  }, TIMEOUT_MS)
}

async function verifyKey(service: KeyService, key: string): Promise<string> {
  const get = (url: string, headers: Record<string, string>) => fetch(url, { headers, signal: AbortSignal.timeout(15000) })
  const fail = async (r: Response) => {
    const body = await r.text().catch(() => '')
    return new Error(r.status === 401 || r.status === 403 ? 'Anahtar reddedildi' : `Servis yanıtı ${r.status} ${body.slice(0, 120)}`)
  }
  switch (service) {
    case 'anthropic': {
      const r = await get('https://api.anthropic.com/v1/models?limit=1', { 'x-api-key': key, 'anthropic-version': '2023-06-01' })
      if (!r.ok) throw await fail(r)
      return 'Claude bağlandı'
    }
    case 'meshy': {
      const r = await get('https://api.meshy.ai/openapi/v1/balance', { Authorization: `Bearer ${key}` })
      if (!r.ok) throw await fail(r)
      const j = (await r.json()) as { balance?: number }
      return `Meshy bağlandı · ${j.balance ?? '?'} kredi`
    }
    case 'elevenlabs': {
      const r = await get('https://api.elevenlabs.io/v1/user/subscription', { 'xi-api-key': key })
      if (r.ok) {
        const j = (await r.json()) as { tier?: string }
        return `ElevenLabs bağlandı${j.tier ? ` · ${j.tier}` : ''}`
      }
      // Kısıtlı anahtar: geçerli ama abonelik okuma izni yok
      const body = await r.text().catch(() => '')
      if (body.includes('missing_permissions')) return 'ElevenLabs bağlandı (kısıtlı anahtar)'
      throw r.status === 401 ? new Error('Anahtar reddedildi') : new Error(`Servis yanıtı ${r.status}`)
    }
    case 'huggingface': {
      const r = await get('https://huggingface.co/api/whoami-v2', { Authorization: `Bearer ${key}` })
      if (!r.ok) throw await fail(r)
      const j = (await r.json()) as { name?: string }
      return `Hugging Face bağlandı${j.name ? ` · ${j.name}` : ''}`
    }
  }
}

// ── OpenRouter: giriş yap → onayla (OAuth PKCE) ─────────────────────

const b64url = (b: Buffer) => b.toString('base64url')

function page(title: string, text: string, ok: boolean): string {
  return `<!doctype html><meta charset="utf-8"><title>AssetForge</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#07080c;color:#eef0f5;font-family:Segoe UI,system-ui,sans-serif">
<div style="text-align:center;max-width:420px;padding:24px">
<div style="font-size:44px;color:${ok ? '#34d399' : '#e2235f'}">${ok ? '✓' : '✕'}</div>
<h2 style="margin:8px 0">${title}</h2><p style="color:#8a91a3">${text}</p></div></body>`
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
      emit({ service, phase: 'canceled', message: 'İptal edildi' })
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
      reply(400, page('Bağlantı onaylanmadı', 'Bu pencereyi kapatıp AssetForge’da tekrar deneyebilirsiniz.', false))
      finish()
      emit({ service, phase: 'error', message: 'OpenRouter onayı alınamadı (reddedildi ya da geçersiz yanıt).' })
      return
    }
    emit({ service, phase: 'checking', message: 'Onay alındı, anahtar oluşturuluyor…' })
    try {
      const r = await fetch('https://openrouter.ai/api/v1/auth/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
        signal: AbortSignal.timeout(20000)
      })
      if (!r.ok) throw new Error(`OpenRouter yanıtı ${r.status}`)
      const { key } = (await r.json()) as { key?: string }
      if (!key) throw new Error('OpenRouter anahtar döndürmedi')
      saveOpenRouterKey(key)
      reply(200, page('AssetForge bağlandı', 'OpenRouter hesabınız bağlandı. Bu sekmeyi kapatıp uygulamaya dönebilirsiniz.', true))
      finish()
      emit({ service, phase: 'done', message: 'OpenRouter bağlandı — Görev atamalarından kullanabilirsiniz.' })
      onDone()
    } catch (e) {
      reply(500, page('Bir sorun oldu', (e as Error).message, false))
      finish()
      emit({ service, phase: 'error', message: (e as Error).message })
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
  emit({ service, phase: 'waiting', message: 'Tarayıcıda OpenRouter’a giriş yapıp “Authorize”a basın — gerisi otomatik.' })
  deadline = setTimeout(() => {
    if (active !== me) return
    finish()
    emit({ service, phase: 'error', message: 'Süre doldu (10 dk). Tekrar deneyin.' })
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
