// SPDX-License-Identifier: AGPL-3.0-only
// Birden çok ComfyUI sunucusu: durum, bu bilgisayarda arama, workflow'un sunucuda çalışıp çalışamayacağı
// ve "Otomatik" seçim (açık + gerekli düğüm/modelleri olan + kuyruğu en kısa sunucu).
import fs from 'node:fs'
import type { ComfyFit, ComfyServer, ComfyServerState } from '../../shared/types'
import { normalizeComfyUrl, rankServers, type ServerCandidate } from '../../shared/comfyServers'
import { checkFit, comfyInfo, comfyObjectInfo, comfyQueue, type ObjectInfo } from '../providers/comfyui'
import { getSecret, getSettings } from '../settings'
import { ensureComfy, managedInstalled } from './comfy'
import type { LogFn } from './process'

export interface ResolvedServer {
  id: string
  name: string
  url: string
  token?: string
  managed: boolean
  enabled: boolean
}

export function resolveServer(s: ComfyServer): ResolvedServer {
  return { id: s.id, name: s.name || s.url, url: normalizeComfyUrl(s.url), token: getSecret(`comfy:${s.id}`), managed: !!s.managed, enabled: s.enabled }
}

export const listServers = (): ResolvedServer[] => getSettings().comfyServers.map(resolveServer)

export function findServer(id: string): ResolvedServer | undefined {
  return listServers().find((s) => s.id === id)
}

export async function serverState(s: ResolvedServer, timeoutMs = 4000): Promise<ComfyServerState> {
  try {
    const info = await comfyInfo(s.url, s.token, timeoutMs)
    const queue = await comfyQueue(s.url, s.token).catch(() => undefined)
    return { id: s.id, online: true, info, queue }
  } catch (e) {
    return { id: s.id, online: false, error: (e as Error).message.slice(0, 200) }
  }
}

export const serverStates = (): Promise<ComfyServerState[]> => Promise.all(listServers().map((s) => serverState(s)))

/** Ayarlar'daki "Test et": kayıtlı sunucu ya da henüz kaydedilmemiş adres/token */
export async function testServer(id: string, draft?: { url?: string; token?: string }): Promise<string> {
  const s = findServer(id)
  const url = normalizeComfyUrl(draft?.url ?? s?.url ?? '')
  if (!url) throw new Error('Adres boş')
  return comfyInfo(url, draft?.token || s?.token)
}

/** Bu bilgisayarda çalışan ComfyUI'lar: 8188 (ComfyUI / portable), 8000 (ComfyUI Desktop) ve yakın portlar */
export async function discoverLocal(): Promise<{ url: string; info: string; known: boolean }[]> {
  const known = new Set(listServers().map((s) => s.url))
  const ports = [8188, 8000, 8189, 8190, 8001]
  const found = await Promise.all(
    ports.map(async (p) => {
      const url = `http://127.0.0.1:${p}`
      try {
        return { url, info: await comfyInfo(url, undefined, 1500), known: known.has(url) || known.has(url.replace('127.0.0.1', 'localhost')) }
      } catch {
        return null
      }
    })
  )
  return found.filter((x): x is NonNullable<typeof x> => !!x)
}

// /object_info büyük bir yanıttır; kısa süre önbelleğe alınır (yeni model/düğüm kurulunca "Yeniden denetle" tazeler)
const infoCache = new Map<string, { at: number; info: ObjectInfo }>()
const INFO_TTL = 2 * 60_000

async function objectInfo(s: ResolvedServer, fresh = false): Promise<ObjectInfo> {
  const key = `${s.id}|${s.url}`
  const hit = infoCache.get(key)
  if (!fresh && hit && Date.now() - hit.at < INFO_TTL) return hit.info
  const info = await comfyObjectInfo(s.url, s.token)
  infoCache.set(key, { at: Date.now(), info })
  return info
}

/** Workflow bu sunucuda çalışır mı? Sunucu kapalıysa online=false; düğüm listesi alınamazsa uygun sayılır */
export async function fitOn(s: ResolvedServer, source: string, fresh = false): Promise<ComfyFit> {
  const base = { serverId: s.id, serverName: s.name, missingNodes: [] as string[], missingModels: [] as string[] }
  const st = await serverState(s)
  if (!st.online) return { ...base, online: false, ok: false, error: st.error }
  try {
    const f = checkFit(source, await objectInfo(s, fresh))
    return { ...base, ...f, online: true, ok: !f.missingNodes.length && !f.missingModels.length, queue: st.queue }
  } catch (e) {
    return { ...base, online: true, ok: true, queue: st.queue, error: `Uygunluk denetlenemedi: ${(e as Error).message.slice(0, 160)}` }
  }
}

export function describeFit(f: ComfyFit): string {
  if (!f.online) return `kapalı${f.error ? ` (${f.error.slice(0, 80)})` : ''}`
  const parts = []
  if (f.missingNodes.length) parts.push(`eksik düğüm: ${f.missingNodes.slice(0, 4).join(', ')}${f.missingNodes.length > 4 ? '…' : ''}`)
  if (f.missingModels.length) parts.push(`eksik model: ${f.missingModels.slice(0, 3).join(', ')}${f.missingModels.length > 3 ? '…' : ''}`)
  return parts.join(' · ') || 'uygun'
}

// Bu uygulamanın sunucuya gönderdiği, bitmemiş işler: aynı anda başlayan işler aynı sunucuya yığılmasın
const inflight = new Map<string, number>()

export interface ServerChoice {
  /** Düğümdeki seçim: '' = workflow'un ya da Ayarlar'ın seçimi, 'auto' ya da sunucu kimliği */
  choice: string
  /** Workflow'un tercih ettiği sunucu ('' = yok) */
  workflowServer?: string
  workflowPath: string
  log: LogFn
  warn?: (m: string) => void
  signal?: AbortSignal
}

/** Seçim zinciri: düğüm → workflow → Ayarlar → otomatik */
export function effectiveChoice(choice: string, workflowServer?: string): string {
  const pick = [choice, workflowServer, getSettings().comfyDefaultServer].find((c) => c && c.trim())
  return pick && pick !== 'auto' && findServer(pick) ? pick : 'auto'
}

async function chooseServer(o: ServerChoice): Promise<ResolvedServer> {
  const source = fs.readFileSync(o.workflowPath, 'utf8')
  const want = effectiveChoice(o.choice, o.workflowServer)
  if (want !== 'auto') {
    const s = findServer(want)!
    if (!s.enabled) throw new Error(`ComfyUI sunucusu “${s.name}” Ayarlar’da kapalı. Açın ya da düğümde başka bir sunucu seçin.`)
    if (s.managed) await ensureComfy(o.log, o.signal)
    const f = await fitOn(s, source)
    if (!f.online) throw new Error(`ComfyUI sunucusu “${s.name}” yanıt vermiyor (${s.url}). ${f.error ?? ''}`.trim())
    if (!f.ok) throw new Error(`“${s.name}” bu workflow’u çalıştıramaz — ${describeFit(f)}. ComfyUI Manager’dan eksikleri kurun ya da düğümde başka bir sunucu / Otomatik seçin.`)
    if (f.error) o.log(f.error)
    return s
  }

  const enabled = listServers().filter((s) => s.enabled)
  if (!enabled.length) throw new Error('Etkin ComfyUI sunucusu yok. Ayarlar → Yerel araçlar → ComfyUI’dan bir sunucu ekleyin ya da açın.')
  let fits = await Promise.all(enabled.map((s) => fitOn(s, source)))
  const ranked = () => rankServers(fits.map((f): ServerCandidate => ({ id: f.serverId, online: f.online, fits: f.ok, queue: f.queue ?? 0, inflight: inflight.get(f.serverId) ?? 0 })))
  let best = ranked()[0]
  // Hiçbiri açık/uygun değilse AssetForge'un yerel kurulumunu başlatmayı dene
  const managed = enabled.find((s) => s.managed)
  if (!best && managed && !fits.find((f) => f.serverId === managed.id)?.online && (await managedInstalled().catch(() => false))) {
    await ensureComfy(o.log, o.signal)
    const mf = await fitOn(managed, source)
    fits = fits.map((f) => (f.serverId === managed.id ? mf : f))
    best = ranked()[0]
  }
  if (!best) {
    const why = fits.map((f) => `${f.serverName}: ${describeFit(f)}`).join(' · ')
    throw new Error(`Bu workflow’u çalıştırabilecek ComfyUI sunucusu yok — ${why}`)
  }
  const chosen = enabled.find((s) => s.id === best.id)!
  const skipped = fits.filter((f) => f.serverId !== chosen.id && !(f.online && f.ok))
  for (const f of skipped) o.log(`ComfyUI: ${f.serverName} atlandı (${describeFit(f)})`)
  const cf = fits.find((f) => f.serverId === chosen.id)
  if (cf?.error) o.log(cf.error)
  return chosen
}

/** Uygun sunucuyu seçer, işi orada çalıştırır; iş bitene kadar o sunucunun yükü sayılır */
export async function withComfyServer<T>(o: ServerChoice, fn: (s: ResolvedServer) => Promise<T>): Promise<T> {
  const s = await chooseServer(o)
  o.log(`ComfyUI sunucusu: ${s.name} (${s.url})`)
  inflight.set(s.id, (inflight.get(s.id) ?? 0) + 1)
  try {
    return await fn(s)
  } finally {
    inflight.set(s.id, Math.max(0, (inflight.get(s.id) ?? 1) - 1))
  }
}
