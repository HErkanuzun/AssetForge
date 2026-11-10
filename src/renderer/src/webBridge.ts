// SPDX-License-Identifier: AGPL-3.0-only
// Tarayıcıdan açıldığında window.forge: işlemler /api/call üzerinden, olaylar /api/events akışından gelir.
// Bu bilgisayarın pencerelerini açan işlemler (dosya seçici, Gezgin) tarayıcı karşılıklarıyla değiştirilir.
import type { ForgeApi } from '../../preload/api'
import { createApi } from '../../shared/forgeApi'

// Düz HTTP (yerel ağ) sayfalarında crypto.randomUUID yok
const clientId = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('')

function toLogin(): never {
  location.href = '/login'
  throw new Error('Oturum kapandı; yeniden giriş yapın')
}

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  // JSON undefined'ı null'a çevirir; varsayılan değerli parametreler bozulmasın diye yerleri ayrıca gönderilir
  const undef = args.flatMap((a, i) => (a === undefined ? [i] : []))
  const r = await fetch(`/api/call/${channel}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forge': '1', 'x-forge-client': clientId },
    body: JSON.stringify({ args, undef })
  })
  if (r.status === 401) toLogin()
  const j = (await r.json()) as { ok: true; value: T } | { ok: false; error: string }
  if (!j.ok) throw new Error(j.error)
  return j.value
}

const listeners = new Map<string, Set<(p: unknown) => void>>()

function connectEvents(): void {
  const es = new EventSource(`/api/events?client=${clientId}`)
  es.onmessage = (e) => {
    try {
      const { c, p } = JSON.parse(e.data as string) as { c: string; p: unknown }
      for (const cb of listeners.get(c) ?? []) cb(p)
    } catch {
      /* bozuk ileti */
    }
  }
  es.onerror = () => {
    // Tarayıcı kendisi yeniden dener; bağlantı tamamen kapandıysa oturumu yokla
    if (es.readyState !== EventSource.CLOSED) return
    fetch('/api/call/web:me', { method: 'POST', headers: { 'x-forge': '1' } }).then(
      (r) => (r.status === 401 ? toLogin() : setTimeout(connectEvents, 3000)),
      () => setTimeout(connectEvents, 5000)
    )
  }
}

export async function uploadFile(f: File): Promise<string> {
  const r = await fetch(`/api/upload?name=${encodeURIComponent(f.name)}`, { method: 'POST', headers: { 'x-forge': '1' }, body: f })
  if (r.status === 401) toLogin()
  const j = (await r.json()) as { ok: true; value: string } | { ok: false; error: string }
  if (!j.ok) throw new Error(j.error)
  return j.value
}

/** Tarayıcının dosya seçicisi: seçilenler sunucuya yüklenir, sunucudaki yolları döner */
function pickFiles(filters: { name: string; extensions: string[] }[], multi = false): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = multi
    const exts = filters.flatMap((f) => f.extensions).filter((e) => e !== '*')
    if (exts.length) input.accept = exts.map((e) => `.${e}`).join(',')
    input.onchange = () => Promise.all([...(input.files ?? [])].map(uploadFile)).then(resolve, reject)
    input.oncancel = () => resolve([])
    input.click()
  })
}

const fileUrl = (p: string) => '/files/' + encodeURIComponent(p)
const hostOnly = (what: string) => () => Promise.reject(new Error(`${what} yalnızca AssetForge’un çalıştığı bilgisayarda yapılabilir`))

export function installWebBridge(): void {
  if ('forge' in window && window.forge) return
  connectEvents()
  const api: ForgeApi = createApi({
    web: true,
    call,
    on: <T>(channel: string, cb: (payload: T) => void) => {
      const set = listeners.get(channel) ?? new Set()
      const fn = cb as (p: unknown) => void
      set.add(fn)
      listeners.set(channel, set)
      return () => set.delete(fn)
    },
    pathForFile: () => '',
    dropFile: uploadFile
  })
  api.pickFiles = pickFiles
  // Dosyayı açmak / göstermek: tarayıcıda yeni sekmede
  api.openPath = async (p) => {
    window.open(fileUrl(p), '_blank', 'noopener')
    return ''
  }
  api.showItem = async (p) => {
    window.open(fileUrl(p), '_blank', 'noopener')
  }
  api.diag.save = async () => {
    const a = document.createElement('a')
    a.href = '/api/diag'
    a.download = 'AssetForge-tanilama.txt'
    a.click()
    return 'AssetForge-tanilama.txt'
  }
  api.diag.openLogs = hostOnly('Günlük klasörünü açmak')
  api.project.pickDir = hostOnly('Proje klasörünü değiştirmek')
  api.comfy.open = hostOnly('ComfyUI düğüm editörünü açmak')
  api.comfy.wf.show = hostOnly('Workflow dosyasını Gezgin’de göstermek')
  api.web.headless = hostOnly('Pencereyi kapatmak')
  window.forge = api
}

export const webFileUrl = fileUrl
