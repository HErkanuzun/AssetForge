// SPDX-License-Identifier: AGPL-3.0-only
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Job, Project, SettingsPublic, WebMe } from '../../shared/types'

interface Toast {
  id: number
  text: string
  kind: 'info' | 'error' | 'ok'
}

interface Store {
  project: Project | null
  settings: SettingsPublic | null
  jobs: Job[]
  selectedAssets: string[]
  setSelectedAssets: (ids: string[]) => void
  update: (fn: (p: Project) => Project) => void
  saveNow: () => Promise<void>
  reload: () => Promise<void>
  setSettings: (s: SettingsPublic) => void
  setProject: (p: Project) => void
  toast: (text: string, kind?: Toast['kind']) => void
  toasts: Toast[]
  refreshJobs: () => Promise<void>
  /** asset id → önizleme görseli (iş çıktılarından) */
  thumbs: Record<string, string>
  refreshThumbs: () => Promise<void>
  /** Hat başlat; parentId verilirse ana asset'in işi bitene kadar bekletir */
  startRun: (pipelineId: string, assetIds: string[], waitFor?: string) => Promise<void>
  deferredCount: number
  /** Kim bağlı: masaüstünde sahip; tarayıcıda giriş yapan kişi ve rolü */
  me: WebMe | null
  /** İzleyici: değişiklik yapamaz */
  readOnly: boolean
}

const Ctx = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider eksik')
  return s
}

export const forgeUrl = (file: string) => (window.forge.isWeb ? '/files/' : 'forge://local/') + encodeURIComponent(file)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [project, setProjectState] = useState<Project | null>(null)
  const [settings, setSettings] = useState<SettingsPublic | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedAssets, setSelectedAssets] = useState<string[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const deferred = useRef(new Map<string, { pipelineId: string; assetIds: string[] }[]>())
  const [deferredCount, setDeferredCount] = useState(0)
  const saveTimer = useRef<number | undefined>(undefined)
  const latest = useRef<Project | null>(null)
  const [me, setMe] = useState<WebMe | null>(null)
  const readOnly = me?.role === 'viewer'
  const readOnlyRef = useRef(false)
  readOnlyRef.current = readOnly
  /** Başkasının değişikliği geldiğinde artar: o sırada yoldaki kaydın sürüm bilgisi artık geçersiz */
  const externalSeq = useRef(0)
  const pending = useRef(false)

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 9000 : 4500)
  }, [])

  /**
   * Kaydeder. Sunucu başkalarının değişikliklerini birleştirdiyse yeni hali alır; bu arada yeni bir yerel
   * düzenleme yapıldıysa eski sürüm numarası korunur, böylece sonraki kayıt da doğru birleştirilir.
   */
  const persist = useCallback(async (p: Project) => {
    pending.current = false
    if (readOnlyRef.current) return
    const seq = externalSeq.current
    const r = await window.forge.project.save(p)
    const cur = latest.current
    if (!cur || seq !== externalSeq.current) return
    if (r.project) {
      if (cur === p) {
        latest.current = r.project
        setProjectState(r.project)
      }
    } else latest.current = { ...cur, rev: r.rev }
  }, [])

  const saveNow = useCallback(async () => {
    window.clearTimeout(saveTimer.current)
    if (latest.current) await persist(latest.current)
  }, [persist])

  const setProject = useCallback((p: Project) => {
    latest.current = p
    setProjectState(p)
  }, [])

  const update = useCallback(
    (fn: (p: Project) => Project) => {
      if (!latest.current) return
      const next = fn(latest.current)
      latest.current = next
      setProjectState(next)
      window.clearTimeout(saveTimer.current)
      pending.current = true
      saveTimer.current = window.setTimeout(() => {
        persist(next).catch((e: Error) => toast('Kaydedilemedi: ' + e.message, 'error'))
      }, 500)
    },
    [toast, persist]
  )

  const refreshJobs = useCallback(async () => setJobs(await window.forge.jobs()), [])
  const refreshThumbs = useCallback(async () => setThumbs(await window.forge.library.thumbs()), [])
  const countDeferred = () => setDeferredCount([...deferred.current.values()].reduce((n, l) => n + l.reduce((m, x) => m + x.assetIds.length, 0), 0))

  const startRun = useCallback(
    async (pipelineId: string, assetIds: string[], waitFor?: string) => {
      if (!assetIds.length) return
      if (waitFor) {
        const list = deferred.current.get(waitFor) ?? []
        list.push({ pipelineId, assetIds })
        deferred.current.set(waitFor, list)
        countDeferred()
        return
      }
      await saveNow()
      const started = await window.forge.run.start(pipelineId, assetIds)
      setJobs((l) => [...started, ...l.filter((j) => !started.some((s) => s.id === j.id))])
    },
    [saveNow]
  )

  const reload = useCallback(async () => {
    const [p, s, j, who] = await Promise.all([window.forge.project.load(), window.forge.settings.get(), window.forge.jobs(), window.forge.web.me()])
    setProject(p)
    setSettings(s)
    setJobs(j)
    setMe(who)
    window.forge.library.thumbs().then(setThumbs, () => undefined)
  }, [setProject])

  const lastStatus = useRef(new Map<string, string>())

  useEffect(() => {
    reload().catch((e: Error) => toast(e.message, 'error'))
    // Asistan, MCP istemcisi ya da başka bir kişi projeyi değiştirdi
    const offProject = window.forge.onProjectChanged((p) => {
      if (pending.current && latest.current && !readOnlyRef.current) {
        // Kaydedilmemiş yerel düzenleme var: hemen kaydet; sunucu iki tarafı birleştirip döndürür
        window.clearTimeout(saveTimer.current)
        persist(latest.current).catch((e: Error) => toast('Kaydedilemedi: ' + e.message, 'error'))
        return
      }
      externalSeq.current++
      setProject(p)
    })
    const offExternal = window.forge.agent.onExternal((name) => toast(`Claude (MCP) → ${name}`, 'info'))
    const offJobs = window.forge.onJobUpdate((job) => {
      const prev = lastStatus.current.get(job.id)
      lastStatus.current.set(job.id, job.status)
      if (job.status === 'done' && prev !== 'done') {
        update((p) => ({ ...p, assets: p.assets.map((a) => (a.id === job.assetId ? { ...a, status: 'Üretildi' } : a)) }))
        toast(`✓ ${job.assetName} hazır (${job.pipelineName})`, 'ok')
        window.forge.library.thumbs().then(setThumbs, () => undefined)
        const waiting = deferred.current.get(job.assetId)
        if (waiting) {
          deferred.current.delete(job.assetId)
          countDeferred()
          for (const w of waiting) window.forge.run.start(w.pipelineId, w.assetIds).catch((e: Error) => toast('Bekleyen iş başlatılamadı: ' + e.message, 'error'))
        }
      }
      if ((job.status === 'failed' || job.status === 'canceled') && prev !== job.status && deferred.current.has(job.assetId)) {
        const n = deferred.current.get(job.assetId)!.reduce((m, x) => m + x.assetIds.length, 0)
        deferred.current.delete(job.assetId)
        countDeferred()
        toast(`${job.assetName} bitmediği için ${n} bekleyen animasyon işi iptal edildi`, 'error')
      }
      if (job.status === 'failed' && prev !== 'failed') toast(`✗ ${job.assetName}: ${job.error ?? 'hata'}`, 'error')
      setJobs((list) => (list.some((j) => j.id === job.id) ? list.map((j) => (j.id === job.id ? job : j)) : [job, ...list]))
    })
    return () => {
      offJobs()
      offProject()
      offExternal()
    }
  }, [reload, toast, update, setProject, persist])

  return (
    <Ctx.Provider
      value={{
        project,
        settings,
        jobs,
        selectedAssets,
        setSelectedAssets,
        update,
        saveNow,
        reload,
        setSettings,
        setProject,
        toast,
        toasts,
        refreshJobs,
        thumbs,
        refreshThumbs,
        startRun,
        deferredCount,
        me,
        readOnly
      }}
    >
      {children}
    </Ctx.Provider>
  )
}
