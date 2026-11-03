// SPDX-License-Identifier: AGPL-3.0-only
// Windows görev çubuğu: sağ tık kısayolları (jump list), üretim ilerleme çubuğu ve bitince yanıp sönme.
import { app, type BrowserWindow } from 'electron'
import type { Job } from '../shared/types'

export const JUMP_PAGES = [
  { page: 'home', title: 'Atölye', description: 'Brief sohbetini aç' },
  { page: 'library', title: 'Kütüphane', description: 'Asset kütüphanesini aç' },
  { page: 'anim', title: 'Animasyon Stüdyosu', description: 'Animasyon sistemlerini aç' },
  { page: 'jobs', title: 'Üretim Kuyruğu', description: 'Çalışan işleri gör' },
  { page: 'settings', title: 'Ayarlar', description: 'Hesaplar, araçlar ve MCP' }
] as const

const PAGES = new Set<string>([...JUMP_PAGES.map((p) => p.page), 'pipeline', 'bible'])

/** Komut satırındaki --page=<ad> (jump list ve ikinci açılış) */
export function pageFromArgv(argv: string[]): string | null {
  for (const a of argv) {
    const m = /^--page=([a-z]+)$/.exec(a)
    if (m && PAGES.has(m[1])) return m[1]
  }
  return null
}

/** Çalışan ve sıradaki işlerin ortalama ilerlemesi (0–1); iş yoksa null */
export function jobsProgress(jobs: Iterable<Job>): number | null {
  const active = [...jobs].filter((j) => j.status === 'running' || j.status === 'queued')
  if (!active.length) return null
  const perJob = active.map((j) => {
    const nodes = Object.values(j.nodes)
    if (!nodes.length) return 0
    return nodes.reduce((s, n) => s + (n.status === 'done' || n.status === 'skipped' ? 100 : n.progress), 0) / (nodes.length * 100)
  })
  return Math.min(1, Math.max(0, perJob.reduce((a, b) => a + b, 0) / perJob.length))
}

/** Kurulu uygulamada sağ tık menüsü; geliştirmede exe electron.exe olduğu için atlanır */
export function setupJumpList(): void {
  if (process.platform !== 'win32' || !app.isPackaged) return
  app.setUserTasks(
    JUMP_PAGES.map((p) => ({
      program: process.execPath,
      arguments: `--page=${p.page}`,
      iconPath: process.execPath,
      iconIndex: 0,
      title: p.title,
      description: p.description
    }))
  )
}

/** İş güncellemelerini görev çubuğuna yansıtır */
export function createJobTaskbar(getWin: () => BrowserWindow | null): (job: Job) => void {
  const jobs = new Map<string, Job>()
  return (job) => {
    const prev = jobs.get(job.id)?.status
    jobs.set(job.id, job)
    const win = getWin()
    if (!win || win.isDestroyed()) return
    const p = jobsProgress(jobs.values())
    const failed = job.status === 'failed'
    win.setProgressBar(p ?? -1, { mode: p === null ? 'none' : failed ? 'error' : 'normal' })
    // Bir iş bittiğinde ya da hata verdiğinde, pencere arkadaysa dikkat çek
    const finished = prev !== job.status && (job.status === 'done' || failed)
    if (finished && !win.isFocused()) win.flashFrame(true)
    for (const [id, j] of jobs) if (j.status !== 'running' && j.status !== 'queued') jobs.delete(id)
  }
}
