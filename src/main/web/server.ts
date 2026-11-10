// SPDX-License-Identifier: AGPL-3.0-only
// Web sunucusu: masaüstü arayüzünün aynısını tarayıcıya sunar. Arayüzün çağırdığı her işlem (IPC) burada
// HTTP'den aynı işleyiciye gider; olaylar Server-Sent Events ile akar; dosyalar /files altından okunur.
// Giriş: sahip parolası ya da davet bağlantısıyla açılan hesaplar. Roller policy.ts'te.
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import type { WebRole, WebUserPublic } from '../../shared/types'
import { isInside } from '../security'
import { ensureDir } from '../util'
import { createSession, endSession, inviteInfo, join, login, sessionUser } from './access'
import { runAs, type Caller } from './caller'
import { addClient, removeClient } from './hub'
import { allowed, foreignPath, ROLE_LABEL, stringsOf } from './policy'
import { loadProject } from '../project'

export type Handler = (...args: unknown[]) => unknown

export interface WebServerDeps {
  registry: Map<string, Handler>
  rendererDir: string
  projectDir: () => string
  diagnostics: () => Promise<string>
}

/** Bu bilgisayardaki pencereleri/dosya gezginini açan işlemler: tarayıcıdan anlamsız ve tehlikeli */
const HOST_ONLY = new Set([
  'dialog:pickFiles',
  'project:pickDir',
  'shell:openPath',
  'shell:showItem',
  'comfy:wf:show',
  'comfy:open',
  'backends:folder',
  'backends:open',
  'diag:save',
  'diag:openLogs',
  'web:headless'
])

const COOKIE = 'af_session'
const MAX_CALL_BODY = 32 * 1024 * 1024
const MAX_UPLOAD = 2 * 1024 * 1024 * 1024

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.fbx': 'application/octet-stream',
  '.bvh': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
}

let server: http.Server | null = null
let state: { port: number; lan: boolean; error?: string } = { port: 0, lan: false }

export function webUrls(port = state.port, lan = state.lan): string[] {
  const urls = [`http://127.0.0.1:${port}`]
  if (lan) {
    for (const list of Object.values(os.networkInterfaces())) {
      for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) urls.push(`http://${a.address}:${port}`)
    }
  }
  return urls
}

export const webRunning = (): boolean => !!server?.listening
export const webError = (): string | undefined => state.error

function cookies(req: http.IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

function send(res: http.ServerResponse, status: number, body: string | Buffer, type = 'text/plain; charset=utf-8', extra: Record<string, string> = {}): void {
  res.writeHead(status, {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
    ...extra
  })
  res.end(body)
}

const json = (res: http.ServerResponse, status: number, v: unknown) => send(res, status, JSON.stringify(v), 'application/json')

function readBody(req: http.IncomingMessage, max: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let n = 0
    req.on('data', (c: Buffer) => {
      n += c.length
      if (n > max) {
        reject(new Error('İstek çok büyük'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// ── Giriş sayfaları (betik yok: düz HTML formu) ─────────────────────

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function page(title: string, body: string): string {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · AssetForge</title>
<style>
:root{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0c10;color:#e8e8ec;font:15px/1.5 system-ui,Segoe UI,sans-serif;padding:16px}
.box{width:100%;max-width:380px;background:#14161c;border:1px solid #262a33;border-radius:16px;padding:28px}
h1{font-size:20px;margin:0 0 6px}p{color:#9aa0ab;margin:0 0 18px;font-size:14px}label{display:block;font-size:13px;color:#9aa0ab;margin:12px 0 4px}
input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid #2c313b;background:#0f1116;color:#e8e8ec;font:inherit}
button{margin-top:18px;width:100%;padding:11px;border:0;border-radius:10px;background:linear-gradient(90deg,#ff6a2b,#ff9a3c);color:#111;font-weight:700;font:inherit;cursor:pointer}
.err{background:#3a1820;border:1px solid #6b2436;color:#ffb4c0;padding:8px 10px;border-radius:8px;font-size:13px;margin-bottom:10px}
.brand{font-weight:800;letter-spacing:.02em;color:#ff8a3c;margin-bottom:14px}
</style></head><body><main class="box"><div class="brand">AssetForge</div>${body}</main></body></html>`
}

const loginPage = (err = '') =>
  page(
    'Giriş',
    `<h1>Giriş yap</h1><p>Bu AssetForge’u paylaşan kişinin verdiği hesapla girin.</p>${err ? `<div class="err">${esc(err)}</div>` : ''}
<form method="post" action="/login"><label for="n">Ad</label><input id="n" name="name" autocomplete="username" required autofocus>
<label for="p">Parola</label><input id="p" name="password" type="password" autocomplete="current-password" required><button type="submit">Giriş</button></form>`
  )

const joinPage = (t: string, role: WebRole, err = '') =>
  page(
    'Katıl',
    `<h1>Projeye katıl</h1><p>Rolün: <b>${ROLE_LABEL[role]}</b>${role === 'viewer' ? ' (yalnızca görüntüleme)' : ' (üretebilir ve düzenleyebilirsin)'}. Kendine bir ad ve parola seç.</p>${err ? `<div class="err">${esc(err)}</div>` : ''}
<form method="post" action="/join/${esc(t)}"><label for="n">Ad</label><input id="n" name="name" autocomplete="username" minlength="2" maxlength="40" required autofocus>
<label for="p">Parola (en az 8 karakter)</label><input id="p" name="password" type="password" autocomplete="new-password" minlength="8" required><button type="submit">Katıl</button></form>`
  )

const PAGE_CSP = { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" }

// Giriş denemesi sınırı: adres başına 10 dakikada 10 deneme
const attempts = new Map<string, { n: number; until: number }>()
function limited(ip: string): boolean {
  const now = Date.now()
  const a = attempts.get(ip)
  if (!a || a.until < now) {
    attempts.set(ip, { n: 1, until: now + 10 * 60_000 })
    return false
  }
  a.n++
  return a.n > 10
}

function sessionCookie(t: string, secure: boolean): string {
  return `${COOKIE}=${encodeURIComponent(t)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${30 * 86400}${secure ? '; Secure' : ''}`
}

// ── Statik dosyalar ve proje dosyaları ──────────────────────────────

function serveFile(req: http.IncomingMessage, res: http.ServerResponse, file: string, cache: string): void {
  let st: fs.Stats
  try {
    st = fs.statSync(file)
    if (!st.isFile()) throw new Error('dosya değil')
  } catch {
    send(res, 404, 'Bulunamadı')
    return
  }
  const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
  const base = { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': cache, 'Accept-Ranges': 'bytes' }
  // Ses/video ileri sarma için bayt aralığı
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
  if (m) {
    const start = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2]))
    const end = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1
    if (start > end || start >= st.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${st.size}` })
      res.end()
      return
    }
    res.writeHead(206, { ...base, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': String(end - start + 1) })
    fs.createReadStream(file, { start, end }).pipe(res)
    return
  }
  res.writeHead(200, { ...base, 'Content-Length': String(st.size) })
  if (req.method === 'HEAD') res.end()
  else fs.createReadStream(file).pipe(res)
}

function serveApp(req: http.IncomingMessage, res: http.ServerResponse, deps: WebServerDeps, pathname: string): void {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '')
  const file = path.resolve(deps.rendererDir, rel || 'index.html')
  if (!isInside(deps.rendererDir, file)) return send(res, 403, 'Yasak')
  // Arayüz içi adresler (#sayfa) dışında bilinmeyen yollar uygulamaya düşer
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(deps.rendererDir, 'index.html')
  if (!fs.existsSync(target)) return send(res, 503, 'Arayüz derlenmemiş (npm run build).')
  serveFile(req, res, target, target.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable')
}

// ── İstek yönlendirme ──────────────────────────────────────────────

async function route(req: http.IncomingMessage, res: http.ServerResponse, deps: WebServerDeps): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://x')
  const p = url.pathname
  const ip = req.socket.remoteAddress ?? '?'
  const secure = req.headers['x-forwarded-proto'] === 'https'

  if (p === '/login' && req.method === 'GET') return send(res, 200, loginPage(), 'text/html; charset=utf-8', PAGE_CSP)
  if (p === '/login' && req.method === 'POST') {
    if (limited(ip)) return send(res, 429, loginPage('Çok fazla deneme. 10 dakika sonra yeniden deneyin.'), 'text/html; charset=utf-8', PAGE_CSP)
    const f = new URLSearchParams((await readBody(req, 16_384)).toString())
    const u = login(f.get('name') ?? '', f.get('password') ?? '')
    if (!u) return send(res, 401, loginPage('Ad ya da parola yanlış'), 'text/html; charset=utf-8', PAGE_CSP)
    attempts.delete(ip)
    res.writeHead(303, { Location: '/', 'Set-Cookie': sessionCookie(createSession(u.id), secure) })
    return void res.end()
  }
  const jm = /^\/join\/([\w-]+)$/.exec(p)
  if (jm) {
    const info = inviteInfo(jm[1])
    if (!info)
      return send(
        res,
        410,
        page('Davet', '<h1>Davet geçersiz</h1><p>Bu bağlantının süresi dolmuş ya da kullanılmış. Paylaşan kişiden yeni bir davet isteyin.</p>'),
        'text/html; charset=utf-8',
        PAGE_CSP
      )
    if (req.method === 'GET') return send(res, 200, joinPage(jm[1], info.role), 'text/html; charset=utf-8', PAGE_CSP)
    if (limited(ip)) return send(res, 429, joinPage(jm[1], info.role, 'Çok fazla deneme'), 'text/html; charset=utf-8', PAGE_CSP)
    const f = new URLSearchParams((await readBody(req, 16_384)).toString())
    try {
      const u = join(jm[1], f.get('name') ?? '', f.get('password') ?? '')
      res.writeHead(303, { Location: '/', 'Set-Cookie': sessionCookie(createSession(u.id), secure) })
      return void res.end()
    } catch (e) {
      return send(res, 400, joinPage(jm[1], info.role, (e as Error).message), 'text/html; charset=utf-8', PAGE_CSP)
    }
  }
  if (p === '/logout') {
    endSession(cookies(req)[COOKIE])
    res.writeHead(303, { Location: '/login', 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0` })
    return void res.end()
  }

  const user = sessionUser(cookies(req)[COOKIE])
  if (!user) {
    if (p.startsWith('/api/') || p.startsWith('/files/')) return json(res, 401, { ok: false, error: 'Oturum yok ya da süresi doldu; yeniden giriş yapın' })
    res.writeHead(303, { Location: '/login' })
    return void res.end()
  }

  if (p.startsWith('/api/')) {
    // Başka sitelerden gönderilen formları engelle: arayüz her istekte bu başlığı ekler
    if (req.method !== 'GET' && req.headers['x-forge'] !== '1') return json(res, 403, { ok: false, error: 'Geçersiz istek' })
    return api(req, res, deps, user, url)
  }
  if (p.startsWith('/files/')) {
    const file = path.resolve(decodeURIComponent(p.slice('/files/'.length)))
    if (!isInside(deps.projectDir(), file)) return send(res, 403, 'Yasak')
    return serveFile(req, res, file, 'private, max-age=60')
  }
  return serveApp(req, res, deps, p)
}

async function api(req: http.IncomingMessage, res: http.ServerResponse, deps: WebServerDeps, user: WebUserPublic, url: URL): Promise<void> {
  const p = url.pathname
  const clientId = String(req.headers['x-forge-client'] ?? url.searchParams.get('client') ?? '').slice(0, 64)
  const caller: Caller = { kind: 'web', name: user.name, role: user.role, userId: user.id, clientId: clientId || undefined }

  if (p === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
    res.write(`retry: 3000\n\n`)
    const id = clientId || crypto.randomUUID()
    addClient({ id, userId: user.id, name: user.name, role: user.role, since: Date.now(), send: (c, payload) => res.write(`data: ${JSON.stringify({ c, p: payload })}\n\n`), close: () => res.end() })
    const beat = setInterval(() => res.write(': canlı\n\n'), 25_000)
    req.on('close', () => {
      clearInterval(beat)
      removeClient(id)
    })
    return
  }

  if (p === '/api/upload' && req.method === 'POST') {
    if (!allowed(user.role, 'project:save')) return json(res, 403, { ok: false, error: 'Dosya yüklemek için editör rolü gerekir' })
    const name = (url.searchParams.get('name') ?? 'dosya').replace(/[^\w.\- ()ğüşıöçĞÜŞİÖÇ]/g, '_').slice(-120) || 'dosya'
    const dir = ensureDir(path.join(deps.projectDir(), 'uploads', user.name.replace(/[^\w-]/g, '_')))
    const dest = path.join(dir, `${Date.now().toString(36)}_${name}`)
    let n = 0
    const out = fs.createWriteStream(dest)
    try {
      await new Promise<void>((resolve, reject) => {
        req.on('data', (c: Buffer) => {
          n += c.length
          if (n > MAX_UPLOAD) {
            reject(new Error('Dosya çok büyük (en fazla 2 GB)'))
            req.destroy()
          }
        })
        req.pipe(out)
        out.on('finish', resolve)
        req.on('error', reject)
        out.on('error', reject)
      })
    } catch (e) {
      out.destroy()
      fs.rmSync(dest, { force: true })
      return json(res, 413, { ok: false, error: (e as Error).message })
    }
    return json(res, 200, { ok: true, value: dest })
  }

  if (p === '/api/diag') {
    if (user.role !== 'owner') return json(res, 403, { ok: false, error: 'Yalnızca sahip' })
    return send(res, 200, await deps.diagnostics(), 'text/plain; charset=utf-8', { 'Content-Disposition': 'attachment; filename="AssetForge-tanilama.txt"' })
  }

  const cm = /^\/api\/call\/([\w:.-]+)$/.exec(p)
  if (cm && req.method === 'POST') {
    const channel = cm[1]
    const fn = deps.registry.get(channel)
    if (!fn) return json(res, 404, { ok: false, error: `Bilinmeyen işlem: ${channel}` })
    if (HOST_ONLY.has(channel)) return json(res, 200, { ok: false, error: 'Bu işlem yalnızca AssetForge’un çalıştığı bilgisayarda yapılabilir' })
    if (!allowed(user.role, channel)) return json(res, 200, { ok: false, error: `Bu işlem için yetkin yok (${ROLE_LABEL[user.role]}). Proje sahibinden rol isteyebilirsin.` })
    let args: unknown[] = []
    try {
      const body = (await readBody(req, MAX_CALL_BODY)).toString()
      const j = body ? (JSON.parse(body) as { args?: unknown[]; undef?: number[] }) : {}
      args = Array.isArray(j.args) ? j.args : []
      // Arayüzde undefined olan bağımsız değişkenler (JSON'da null'a dönüşür)
      for (const i of j.undef ?? []) if (Number.isInteger(i) && i >= 0 && i < args.length) args[i] = undefined
    } catch (e) {
      return json(res, 400, { ok: false, error: (e as Error).message })
    }
    if (user.role !== 'owner') {
      const root = deps.projectDir()
      const known = channel === 'project:save' ? stringsOf(loadProject(root)) : new Set<string>()
      const bad = foreignPath(args, (s) => isInside(root, path.resolve(root, s)), known)
      if (bad) return json(res, 200, { ok: false, error: `Proje klasörü dışındaki dosyalar kullanılamaz: ${bad}` })
    }
    try {
      const value = await runAs(caller, () => fn(...args))
      return json(res, 200, { ok: true, value: value === undefined ? null : value })
    } catch (e) {
      return json(res, 200, { ok: false, error: (e as Error).message })
    }
  }
  return json(res, 404, { ok: false, error: 'Bulunamadı' })
}

/** Ayarlara göre başlatır, durdurur ya da yeniden başlatır */
export async function syncWebServer(cfg: { enabled: boolean; port: number; lan: boolean }, deps: WebServerDeps): Promise<void> {
  const want = cfg.enabled ? { port: cfg.port, lan: cfg.lan } : null
  if (server && (!want || want.port !== state.port || want.lan !== state.lan)) {
    await new Promise<void>((r) => {
      server!.closeAllConnections()
      server!.close(() => r())
    })
    server = null
  }
  if (!want || server) return
  state = { ...want }
  const srv = http.createServer((req, res) => {
    route(req, res, deps).catch((e) => {
      if (!res.headersSent) json(res, 500, { ok: false, error: (e as Error).message })
      else res.end()
    })
  })
  await new Promise<void>((resolve) => {
    srv.once('error', (e: NodeJS.ErrnoException) => {
      state.error = e.code === 'EADDRINUSE' ? `Port ${want.port} kullanımda; başka bir port seçin` : e.message
      console.error('[web]', state.error)
      server = null
      resolve()
    })
    srv.listen(want.port, want.lan ? '0.0.0.0' : '127.0.0.1', () => {
      server = srv
      state.error = undefined
      console.log(`[web] sunucu açık: ${webUrls().join(', ')}`)
      resolve()
    })
  })
}
