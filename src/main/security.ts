// SPDX-License-Identifier: AGPL-3.0-only
// Electron güvenlik ayarları: izinler, gezinme, yeni pencere, dış bağlantılar ve dosya açma kuralları.
// Saf yardımcılar (isInside, externalUrl, isRunnable) testlerde Electron olmadan kullanılır.
import { app, session, shell, type WebContents } from 'electron'
import path from 'node:path'

/** `file` `root`un içinde (ya da kendisi) mi? Önek hilelerine (C:\proje-kopya) ve ..'ya karşı güvenli. */
export function isInside(root: string, file: string, allowRoot = false): boolean {
  if (!root) return false
  const rel = path.relative(path.resolve(root), path.resolve(file))
  if (rel === '') return allowRoot
  return !rel.startsWith('..') && !path.isAbsolute(rel)
}

/** Tarayıcıda açılabilecek bağlantı: yalnızca https, ya da bu makinedeki http (yerel servis arayüzleri) */
export function externalUrl(raw: string): string | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.username || u.password) return null
  if (u.protocol === 'https:') return u.toString()
  if (u.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) return u.toString()
  return null
}

// Çift tıklayınca kod çalıştırabilen türler: bunlar açılmaz, klasörde gösterilir
const RUNNABLE = new Set(
  '.exe .com .bat .cmd .ps1 .psm1 .vbs .vbe .js .jse .wsf .wsh .msi .msp .scr .hta .cpl .jar .lnk .url .reg .pif .appref-ms .application .msc .settingcontent-ms .py .pyw'.split(' ')
)

export function isRunnable(file: string): boolean {
  return RUNNABLE.has(path.extname(file).toLowerCase())
}

/** Arayüzden gelen "aç" isteği: yalnızca proje klasörü içinde; çalıştırılabilir dosyalar klasörde gösterilir. */
export async function openInsideProject(file: string, projectDir: string): Promise<void> {
  if (!isInside(projectDir, file, true)) throw new Error('Yalnızca proje klasöründeki dosyalar açılabilir')
  if (isRunnable(file)) return shell.showItemInFolder(file)
  const err = await shell.openPath(file)
  if (err) throw new Error(err)
}

export function showInsideProject(file: string, projectDir: string): void {
  if (!isInside(projectDir, file, true)) throw new Error('Yalnızca proje klasöründeki dosyalar gösterilebilir')
  shell.showItemInFolder(file)
}

export function openExternal(raw: string): void {
  const url = externalUrl(raw)
  if (url) void shell.openExternal(url)
  else console.warn('[security] dış bağlantı engellendi:', raw.slice(0, 200))
}

/** Uygulamanın kendi sayfası mı? (geliştirmede Vite sunucusu, pakette index.html) */
function isAppUrl(raw: string): boolean {
  const dev = process.env['ELECTRON_RENDERER_URL']
  if (dev) return raw.startsWith(dev)
  try {
    const u = new URL(raw)
    return u.protocol === 'file:' && u.pathname.toLowerCase().endsWith('/renderer/index.html')
  } catch {
    return false
  }
}

function guard(contents: WebContents): void {
  contents.on('will-attach-webview', (e) => e.preventDefault())
  contents.setWindowOpenHandler(({ url }) => {
    openExternal(url)
    return { action: 'deny' }
  })
  const block = (e: { preventDefault: () => void }, url: string) => {
    if (isAppUrl(url)) return
    e.preventDefault()
    openExternal(url)
  }
  contents.on('will-navigate', (e) => block(e, e.url))
  contents.on('will-redirect', (e) => block(e, e.url))
}

/** app hazır olunca bir kez çağrılır */
export function hardenApp(): void {
  // Arayüzün tek ihtiyacı panoya yazmak; kamera, mikrofon, konum, bildirim vb. reddedilir
  const allowed = new Set(['clipboard-sanitized-write'])
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.has(permission)))
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission))
  app.on('web-contents-created', (_e, contents) => guard(contents))
}
