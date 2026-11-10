// SPDX-License-Identifier: AGPL-3.0-only
// Yerel ComfyUI: AssetForge kurar (Python 3.12 + CUDA PyTorch + ComfyUI + Manager), arka planda başlatır,
// gerektiğinde kendiliğinden açar. Kullanıcının kendi ComfyUI'ı aynı adreste çalışıyorsa ona dokunulmaz.
import type { ComfyLocalStatus } from '../../shared/types'
import { comfyInfo } from '../providers/comfyui'
import { getSettings } from '../settings'
import { resourcePath, sleep } from '../util'
import { run, type LogFn } from './process'

const script = () => resourcePath('comfyui', 'setup_native.ps1')

/** Adres bu bilgisayarı mı gösteriyor? Uzak sunucu kurulamaz/başlatılamaz. */
export function isLocalUrl(url: string): boolean {
  try {
    return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)
  } catch {
    return false
  }
}

export function portOf(url: string): number {
  try {
    const u = new URL(url)
    return Number(u.port) || (u.protocol === 'https:' ? 443 : 80)
  } catch {
    return 8188
  }
}

function step(name: string, log?: LogFn, timeoutMs?: number) {
  const s = getSettings()
  return run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script(), '-Step', name, '-Root', s.comfyHome, '-Port', String(portOf(s.comfyUrl))], { log, timeoutMs })
}

function parseJson<T>(out: string): T | null {
  const line = out
    .split(/\r?\n/)
    .reverse()
    .find((l) => l.trim().startsWith('{'))
  try {
    return line ? (JSON.parse(line) as T) : null
  } catch {
    return null
  }
}

export async function comfyLocalStatus(): Promise<ComfyLocalStatus> {
  const s = getSettings()
  const remote = !isLocalUrl(s.comfyUrl)
  let info: string | undefined
  try {
    info = await comfyInfo(s.comfyUrl)
  } catch {
    info = undefined
  }
  const base = { healthy: !!info, info, home: s.comfyHome, url: s.comfyUrl, remote }
  if (remote) return { ...base, running: !!info, steps: [] }
  const st = parseJson<Record<string, boolean>>((await step('status', undefined, 60000)).out) ?? {}
  return {
    ...base,
    running: !!info || !!st.running,
    steps: [
      { id: 'env', label: 'Python 3.12 + PyTorch (CUDA)', done: !!(st.venv && st.torch), hint: '~3 GB indirme (önbellekte varsa hızlı)' },
      { id: 'clone', label: 'ComfyUI', done: !!st.cloned, hint: st.cloned ? 'Tekrar = güncelle' : undefined },
      { id: 'deps', label: 'ComfyUI bağımlılıkları + Manager', done: !!st.deps },
      { id: 'start', label: 'ComfyUI sunucusu', done: !!info, hint: st.running && !info ? 'açılıyor…' : info ? undefined : 'İş akışı çalışınca kendiliğinden de açılır' }
    ]
  }
}

/** Tek kurulum adımı; satır satır log akar */
export async function comfyLocalStep(name: string, log: LogFn): Promise<void> {
  if (!['env', 'clone', 'deps', 'start', 'stop'].includes(name)) throw new Error(`Bilinmeyen adım: ${name}`)
  if (!isLocalUrl(getSettings().comfyUrl)) throw new Error('ComfyUI adresi bu bilgisayar değil; kurulum yalnızca yerel adreste (127.0.0.1) yapılabilir.')
  const r = await step(name, log, 2 * 60 * 60 * 1000)
  if (r.code !== 0) throw new Error(`ComfyUI adımı başarısız (${name}). Ayrıntı yukarıdaki çıktıda.`)
  if (name === 'start') await waitReady(log, 180)
}

export async function comfyLocalLogs(): Promise<string> {
  return (await step('logs', undefined, 30000)).out
}

async function waitReady(log: LogFn, seconds: number, signal?: AbortSignal): Promise<string> {
  const url = getSettings().comfyUrl
  const until = Date.now() + seconds * 1000
  let last = ''
  while (Date.now() < until) {
    try {
      const info = await comfyInfo(url)
      log(`${info} hazır`)
      return info
    } catch (e) {
      last = (e as Error).message
    }
    await sleep(2000, signal)
  }
  const tail = (await comfyLocalLogs().catch(() => ''))
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(-6)
    .join(' | ')
  throw new Error(`ComfyUI ${seconds} sn içinde açılmadı (${last}). Son günlük: ${tail.slice(0, 500)}`)
}

/**
 * İş akışı çalışmadan önce: sunucu yanıt veriyorsa hiçbir şey yapma; yerel kurulum hazırsa başlat ve bekle;
 * değilse ne yapılacağını söyleyen bir hata ver.
 */
export async function ensureComfy(log: LogFn, signal?: AbortSignal): Promise<void> {
  const s = getSettings()
  try {
    await comfyInfo(s.comfyUrl)
    return
  } catch {
    /* kapalı */
  }
  if (!isLocalUrl(s.comfyUrl)) throw new Error(`ComfyUI'a ulaşılamadı (${s.comfyUrl}). Uzak sunucu açık mı?`)
  const st = parseJson<Record<string, boolean>>((await step('status', undefined, 60000)).out) ?? {}
  if (!(st.venv && st.torch && st.cloned && st.deps)) {
    throw new Error('ComfyUI kapalı ve bu bilgisayarda kurulu değil. Ayarlar → Yerel araçlar → ComfyUI’dan “Kur” adımlarını çalıştırın ya da kendi ComfyUI’ınızı açın.')
  }
  log('ComfyUI kapalı; başlatılıyor…')
  const r = await step('start', log, 60000)
  if (r.code !== 0) throw new Error('ComfyUI başlatılamadı (Ayarlar → Yerel araçlar → ComfyUI → Günlük)')
  await waitReady(log, 180, signal)
}
