// SPDX-License-Identifier: AGPL-3.0-only
import fs from 'node:fs'
import path from 'node:path'
import type { Brief, Job, Project } from '../shared/types'
import { defaultBible, defaultProject, PIPELINE_TEMPLATES } from '../shared/templates'
import { ensureDir } from './util'

const PROJECT_FILE = 'forge-project.json'

export function loadProject(dir: string): Project {
  ensureDir(dir)
  const file = path.join(dir, PROJECT_FILE)
  if (!fs.existsSync(file)) {
    const p = defaultProject(path.basename(dir))
    saveProject(dir, p)
    return p
  }
  const p = JSON.parse(fs.readFileSync(file, 'utf8')) as Project
  // Eski dosyalarda eksik alanları tamamla
  const b = defaultBible()
  p.bible = { ...b, ...p.bible, technical: { ...b.technical, ...p.bible?.technical, naming: { ...b.technical.naming, ...p.bible?.technical?.naming } } }
  p.assets ??= []
  p.pipelines ??= []
  p.clips ??= []
  // Uygulama güncellemesiyle gelen yeni hazır hatları ekle
  for (const t of PIPELINE_TEMPLATES) if (!p.pipelines.some((x) => x.id === t.id)) p.pipelines.push(structuredClone(t))
  return p
}

export function saveProject(dir: string, project: Project): void {
  ensureDir(dir)
  const file = path.join(dir, PROJECT_FILE)
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(project, null, 2))
  fs.renameSync(tmp, file)
}

export function jobsDir(dir: string): string {
  return ensureDir(path.join(dir, 'jobs'))
}

export function saveJob(dir: string, job: Job): void {
  fs.writeFileSync(path.join(jobsDir(dir), `${job.id}.json`), JSON.stringify(job, null, 2))
}

export function listJobs(dir: string, limit = 200): Job[] {
  const jd = jobsDir(dir)
  return fs
    .readdirSync(jd)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(jd, f), 'utf8')) as Job
      } catch {
        return null
      }
    })
    .filter((j): j is Job => !!j)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Brief kayıtları: <proje>/briefs/<id>.json

export function briefsDir(dir: string): string {
  return ensureDir(path.join(dir, 'briefs'))
}

export function saveBrief(dir: string, brief: Brief): void {
  const file = path.join(briefsDir(dir), `${brief.id}.json`)
  fs.writeFileSync(file + '.tmp', JSON.stringify(brief))
  fs.renameSync(file + '.tmp', file)
}

export function loadBrief(dir: string, id: string): Brief | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(briefsDir(dir), `${id}.json`), 'utf8')) as Brief
  } catch {
    return null
  }
}

export function listBriefs(dir: string): Brief[] {
  const bd = briefsDir(dir)
  return fs
    .readdirSync(bd)
    .filter((f) => f.endsWith('.json'))
    .map((f) => loadBrief(dir, f.slice(0, -5)))
    .filter((b): b is Brief => !!b)
    .map((b) => ({ ...b, history: [] }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function deleteBrief(dir: string, id: string): void {
  fs.rmSync(path.join(briefsDir(dir), `${id}.json`), { force: true })
}
