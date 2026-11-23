// SPDX-License-Identifier: AGPL-3.0-only
import { UiError } from '../../shared/i18n/errors'
import { message, emitMessage } from '../../shared/i18n/message'
// Yerel ComfyUI: AssetForge kurar (Python 3.12 + CUDA PyTorch + ComfyUI + Manager), arka planda başlatır,
// gerektiğinde kendiliğinden açar. Kullanıcının kendi ComfyUI'ı aynı adreste çalışıyorsa ona dokunulmaz.
import type { ComfyLocalStatus, ComfyServer } from '../../shared/types'
import { DEFAULT_COMFY_URL, isLocalUrl, normalizeComfyUrl, portOf } from '../../shared/comfyServers'
import { comfyInfo } from '../providers/comfyui'
import { getSettings } from '../settings'
import { resourcePath, sleep } from '../util'
import { run, type LogFn } from './process'

const script = () => resourcePath('comfyui', 'setup_native.ps1')

export { isLocalUrl, portOf }

/** AssetForge'un kurduğu "bu bilgisayar" kaydı (listede her zaman bir tane bulunur) */
export function managedServer(): ComfyServer {
  const list = getSettings().comfyServers
  return list.find((x) => x.managed) ?? { id: 'local', name: 'Bu bilgisayar', url: DEFAULT_COMFY_URL, enabled: true, managed: true }
}

const managedUrl = () => normalizeComfyUrl(managedServer().url) || DEFAULT_COMFY_URL

function step(name: string, log?: LogFn, timeoutMs?: number) {
  const s = getSettings()
  return run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script(), '-Step', name, '-Root', s.comfyHome, '-Port', String(portOf(managedUrl()))], { log, timeoutMs })
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
  const url = managedUrl()
  const remote = !isLocalUrl(url)
  let info: string | undefined
  try {
    info = await comfyInfo(url)
  } catch {
    info = undefined
  }
  const base = { healthy: !!info, info, home: s.comfyHome, url, remote }
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
  if (!['env', 'clone', 'deps', 'start', 'stop'].includes(name)) throw new UiError(message('error.c3db04df62', { p0: String(name) }))
  if (!isLocalUrl(managedUrl())) throw new UiError(message('error.9788919755'))
  const r = await step(name, log, 2 * 60 * 60 * 1000)
  if (r.code !== 0) throw new UiError(message('error.a9b3594556', { p0: String(name) }))
  if (name === 'start') await waitReady(log, 180)
}

export async function comfyLocalLogs(): Promise<string> {
  return (await step('logs', undefined, 30000)).out
}

async function waitReady(log: LogFn, seconds: number, signal?: AbortSignal): Promise<string> {
  const url = managedUrl()
  const until = Date.now() + seconds * 1000
  let last = ''
  while (Date.now() < until) {
    try {
      const info = await comfyInfo(url)
      emitMessage(log, message('log.f2bf8236aa', { p0: String(info) }))
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
  throw new UiError(message('error.808567535b', { p0: String(seconds), p1: String(last), p2: String(tail.slice(0, 500)) }))
}

/** Yerel kurulum tamam mı (başlatılabilir mi)? */
export async function managedInstalled(): Promise<boolean> {
  if (!isLocalUrl(managedUrl())) return false
  const st = parseJson<Record<string, boolean>>((await step('status', undefined, 60000)).out) ?? {}
  return !!(st.venv && st.torch && st.cloned && st.deps)
}

/**
 * "Bu bilgisayar" kaydı için, iş akışı çalışmadan önce: sunucu yanıt veriyorsa hiçbir şey yapma; yerel kurulum
 * hazırsa başlat ve bekle; değilse ne yapılacağını söyleyen bir hata ver.
 */
export async function ensureComfy(log: LogFn, signal?: AbortSignal): Promise<void> {
  const url = managedUrl()
  try {
    await comfyInfo(url)
    return
  } catch {
    /* kapalı */
  }
  if (!isLocalUrl(url)) throw new UiError(message('error.a33e9098f2', { p0: String(url) }))
  const st = parseJson<Record<string, boolean>>((await step('status', undefined, 60000)).out) ?? {}
  if (!(st.venv && st.torch && st.cloned && st.deps)) {
    throw new UiError(message('error.273642f7a1'))
  }
  emitMessage(log, message('log.6be301d737'))
  const r = await step('start', log, 60000)
  if (r.code !== 0) throw new UiError(message('error.c101436576'))
  await waitReady(log, 180, signal)
}
