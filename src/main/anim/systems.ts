// SPDX-License-Identifier: AGPL-3.0-only
// Animasyon sistemleri: kayıt, klip → ANM asset senkronu, poz eşlemeli faz faz üretim, Unreal kurulumu.

import fs from 'node:fs'
import path from 'node:path'
import type { AnimSystem, AnimSystemClip, AnimSystemClipState, AssetSpec, Job, Project } from '../../shared/types'
import { animSystemInfo, productionPhases, sampleFor, stylePrompt } from '../../shared/animSystems'
import { assetBaseName, safeName } from '../../shared/templates'
import type { Runner } from '../engine/runner'
import { runInUe } from '../integrations/ue'
import { listJobs, loadProject, saveProject } from '../project'
import { ensureDir, resourcePath } from '../util'
import type { KimodoSpec } from './motion'
import { loadMotion, motionInfo } from './store'

export const ANIM_PIPELINE = 'tpl_anim_kimodo'

export interface SysCtx {
  dir: string
  runner: Runner
  notify: (p: Project) => void
}

function mutate(ctx: SysCtx, fn: (p: Project) => void): Project {
  const p = loadProject(ctx.dir)
  fn(p)
  saveProject(ctx.dir, p)
  ctx.notify(p)
  return p
}

export function listSystems(dir: string, characterId?: string): AnimSystem[] {
  const all = loadProject(dir).animSystems ?? []
  return characterId ? all.filter((s) => s.characterId === characterId) : all
}

export function getSystem(dir: string, id: string): AnimSystem {
  const s = (loadProject(dir).animSystems ?? []).find((x) => x.id === id)
  if (!s) throw new Error(`Animasyon sistemi bulunamadı: ${id}`)
  return s
}

export function saveSystem(ctx: SysCtx, sys: AnimSystem): AnimSystem {
  const next = { ...sys, updatedAt: Date.now() }
  mutate(ctx, (p) => {
    p.animSystems ??= []
    const i = p.animSystems.findIndex((x) => x.id === sys.id)
    if (i >= 0) p.animSystems[i] = { ...next, producing: p.animSystems[i].producing }
    else p.animSystems.push(next)
  })
  return next
}

export function deleteSystem(ctx: SysCtx, id: string, withAssets = false): void {
  mutate(ctx, (p) => {
    const sys = (p.animSystems ?? []).find((x) => x.id === id)
    p.animSystems = (p.animSystems ?? []).filter((x) => x.id !== id)
    if (withAssets && sys) {
      const ids = new Set(sys.clips.map((c) => c.assetId).filter(Boolean))
      p.assets = p.assets.filter((a) => !ids.has(a.id))
    }
  })
}

// --------------------------------------------------------------------------- durum

function latestJobs(dir: string): Map<string, Job> {
  const m = new Map<string, Job>()
  for (const j of listJobs(dir, 800)) {
    if (j.pipelineId !== ANIM_PIPELINE) continue
    const prev = m.get(j.assetId)
    if (!prev || prev.createdAt < j.createdAt) m.set(j.assetId, j)
  }
  return m
}

/** İşteki kalite kontrol düğümünün son raporu */
function qaOf(j: Job): AnimSystemClipState['qa'] {
  for (const n of Object.values(j.nodes)) {
    const r = n.outputs?.report
    if (r?.kind === 'report') {
      const { score, pass, summary, issues, technical } = r.report
      return { score, pass, summary, issues, technical }
    }
  }
  return undefined
}

const jobProgressOf = (j: Job) => {
  const n = Object.values(j.nodes)
  return n.length ? Math.round(n.reduce((s, x) => s + (x.status === 'done' || x.status === 'skipped' ? 100 : x.progress), 0) / n.length) : 0
}

export function systemStates(dir: string, sys: AnimSystem): AnimSystemClipState[] {
  const jobs = latestJobs(dir)
  const waiting = waitingKeys.get(sys.id)
  return sys.clips.map((c) => {
    const motion = loadMotion(dir, c.assetId)
    const j = c.assetId ? jobs.get(c.assetId) : undefined
    let status: AnimSystemClipState['status'] = motion ? 'done' : 'none'
    if (j && (j.status === 'queued' || j.status === 'running')) status = j.status
    else if (j && j.status === 'failed' && (!motion || (motion.at ?? 0) < j.createdAt)) status = 'failed'
    else if (waiting?.has(c.key)) status = 'waiting'
    return {
      key: c.key,
      assetId: c.assetId,
      status,
      progress: status === 'done' ? 100 : j ? jobProgressOf(j) : 0,
      error: status === 'failed' ? j?.error : undefined,
      motion: motionInfo(motion),
      bvhUrl: motion?.bvh ? 'forge://local/' + encodeURIComponent(motion.bvh) : undefined,
      qa: j ? qaOf(j) : undefined
    }
  })
}

// --------------------------------------------------------------------------- klip → asset

function specOf(c: AnimSystemClip, sys: AnimSystem, keyToAsset: Map<string, string>): KimodoSpec {
  return {
    role: c.role,
    loop: c.loop,
    seconds: c.seconds,
    speed: c.speed,
    speedEnd: c.speedEnd,
    moveDir: c.moveDir,
    turn: c.turn,
    constrainPath: c.constrainPath,
    fromAssetId: c.from && c.from !== c.key ? keyToAsset.get(c.from) : undefined,
    toAssetId: c.to && c.to !== c.key ? keyToAsset.get(c.to) : undefined,
    seed: c.seed,
    system: sys.id,
    key: c.key
  }
}

function nextAnimId(p: Project): string {
  let n = 1
  while (p.assets.some((a) => a.id === `ANM${String(n).padStart(3, '0')}`)) n++
  return `ANM${String(n).padStart(3, '0')}`
}

/** Sistemin her etkin klibi için ANM asset'i oluştur/güncelle (prompt, süre, spec) */
export function syncAssets(ctx: SysCtx, sysId: string): AnimSystem {
  let out: AnimSystem | null = null
  mutate(ctx, (p) => {
    const sys = (p.animSystems ?? []).find((x) => x.id === sysId)
    if (!sys) throw new Error('Sistem bulunamadı')
    const ch = p.assets.find((a) => a.id === sys.characterId)
    // önce id ata (spec'ler birbirine id ile bağlanır)
    for (const c of sys.clips) {
      if (!c.enabled) continue
      if (!c.assetId || !p.assets.some((a) => a.id === c.assetId)) {
        const id = nextAnimId(p)
        c.assetId = id
        p.assets.push({
          id,
          name: `${safeName(sys.name).slice(0, 14)} ${c.key}`,
          kind: 'animation',
          category: ch?.category ?? 'Animation',
          subcategory: 'animasyon',
          description: '',
          size: '',
          materials: '',
          variants: '',
          triBudget: 0,
          budgetNote: '',
          priority: 'P1',
          status: 'Bekliyor',
          source: 'Animasyon sistemi',
          parentId: ch?.id,
          role: c.key,
          extra: {},
          pipelineId: ANIM_PIPELINE
        } as AssetSpec)
      }
    }
    const keyToAsset = new Map(sys.clips.filter((c) => c.assetId).map((c) => [c.key, c.assetId!]))
    for (const c of sys.clips) {
      const a = c.assetId ? p.assets.find((x) => x.id === c.assetId) : undefined
      if (!a || !c.enabled) continue
      const prompt = stylePrompt(c.prompt, sys.style)
      a.description = `${animSystemInfo(sys.kind).title} · ${c.label}: ${prompt}`
      a.extra = {
        ...a.extra,
        Kimodo: prompt,
        Süre: String(c.seconds),
        Döngü: c.loop ? 'evet' : 'hayır',
        RootMotion: c.rootMotion,
        Sistem: sys.name,
        KimodoSpec: JSON.stringify(specOf(c, sys, keyToAsset))
      }
    }
    sys.updatedAt = Date.now()
    out = structuredClone(sys)
  })
  return out!
}

// --------------------------------------------------------------------------- üretim

const producing = new Map<string, AbortController>()
const waitingKeys = new Map<string, Set<string>>()

export const isProducing = (id: string) => producing.has(id)

export function stopProduce(ctx: SysCtx, id: string): void {
  producing.get(id)?.abort()
  const p = loadProject(ctx.dir)
  const sys = (p.animSystems ?? []).find((x) => x.id === id)
  if (sys) {
    const jobs = latestJobs(ctx.dir)
    for (const c of sys.clips) {
      const j = c.assetId ? jobs.get(c.assetId) : undefined
      if (j && (j.status === 'running' || j.status === 'queued')) ctx.runner.cancel(j.id)
    }
  }
}

function setProducing(ctx: SysCtx, id: string, on: boolean) {
  mutate(ctx, (p) => {
    const s = (p.animSystems ?? []).find((x) => x.id === id)
    if (s) s.producing = on || undefined
  })
}

async function waitJobs(dir: string, ids: string[], signal: AbortSignal): Promise<void> {
  const left = new Set(ids)
  while (left.size && !signal.aborted) {
    await new Promise((r) => setTimeout(r, 2000))
    for (const j of listJobs(dir, 800)) if (left.has(j.id) && j.status !== 'queued' && j.status !== 'running') left.delete(j.id)
  }
}

export interface ProduceOptions {
  /** Yalnızca bu klipler (boş = eksik/başarısız olanlar) */
  keys?: string[]
  /** Hazır olanları da yeniden üret */
  force?: boolean
  log?: (m: string) => void
}

/**
 * Klipleri bağımlılık sırasıyla üret: önce poz kaynakları (bekleme, döngüler), sonra bunlara
 * kilitlenen geçişler (başlangıç, duruş, pivot, aksiyon). Arka planda çalışır.
 */
export function produceSystem(ctx: SysCtx, id: string, opts: ProduceOptions = {}): { clips: number; phases: number } {
  if (producing.has(id)) throw new Error('Bu sistem zaten üretiliyor')
  const sys = syncAssets(ctx, id)
  const states = new Map(systemStates(ctx.dir, sys).map((s) => [s.key, s]))
  const want = (c: AnimSystemClip) => (opts.keys?.length ? opts.keys.includes(c.key) : opts.force || states.get(c.key)?.status !== 'done')
  const phases = productionPhases(sys)
    .map((ph) => ph.filter(want))
    .filter((ph) => ph.length)
  const total = phases.reduce((s, ph) => s + ph.length, 0)
  if (!total) return { clips: 0, phases: 0 }
  const abort = new AbortController()
  producing.set(id, abort)
  waitingKeys.set(id, new Set(phases.flat().map((c) => c.key)))
  setProducing(ctx, id, true)
  ;(async () => {
    try {
      for (const [i, ph] of phases.entries()) {
        if (abort.signal.aborted) break
        const p = loadProject(ctx.dir)
        const ids = ph.map((c) => c.assetId!).filter(Boolean)
        opts.log?.(`Faz ${i + 1}/${phases.length}: ${ph.map((c) => c.key).join(', ')}`)
        for (const c of ph) waitingKeys.get(id)?.delete(c.key)
        const jobs = ctx.runner.start(p, ctx.dir, ANIM_PIPELINE, ids)
        await waitJobs(
          ctx.dir,
          jobs.map((j) => j.id),
          abort.signal
        )
      }
    } catch (e) {
      opts.log?.(`Üretim hatası: ${(e as Error).message}`)
    } finally {
      producing.delete(id)
      waitingKeys.delete(id)
      setProducing(ctx, id, false)
    }
  })()
  return { clips: total, phases: phases.length }
}

// --------------------------------------------------------------------------- Unreal kurulumu

export interface BuildManifest {
  kind: AnimSystem['kind']
  name: string
  dest: string
  axes?: AnimSystem['axes']
  clips: {
    key: string
    label: string
    role: string
    loop: boolean
    rootMotion: string
    paths: string[]
    sample: { x: number; y?: number }
    markers: { L: number[]; R: number[] } | null
    measured?: { speed: number; direction: number; turn: number; seconds: number }
  }[]
}

export function buildManifest(dir: string, sysId: string): BuildManifest {
  const p = loadProject(dir)
  const sys = (p.animSystems ?? []).find((x) => x.id === sysId)
  if (!sys) throw new Error('Sistem bulunamadı')
  const t = p.bible.technical
  const root = t.ueContentRoot.replace(/\/$/, '')
  const ch = p.assets.find((a) => a.id === sys.characterId)
  const chBase = ch ? assetBaseName(ch) : ''
  const tdir = ch ? `${root}/${ch.category || 'Misc'}` : ''
  const sysSlug = safeName(sys.name) || 'AnimSystem'
  const clips: BuildManifest['clips'] = []
  for (const c of sys.clips) {
    if (!c.enabled || !c.assetId) continue
    const a = p.assets.find((x) => x.id === c.assetId)
    const m = loadMotion(dir, c.assetId)
    if (!a || !m) continue
    const base = assetBaseName(a)
    const paths = [...(ch ? [`${tdir}/Animations/A_${chBase}_${base}`] : []), `${root}/Animation/SOMA/AS_SOMA_${base}`]
    clips.push({
      key: c.key,
      label: c.label,
      role: c.role,
      loop: c.loop,
      rootMotion: c.rootMotion,
      paths,
      sample: sampleFor(sys, c, m.measured),
      markers: m.markers,
      measured: m.measured
    })
  }
  return {
    kind: sys.kind,
    name: sysSlug,
    dest: ch ? `${tdir}/AnimSystems/${sysSlug}` : `${root}/Animation/Systems/${sysSlug}`,
    axes: sys.axes,
    clips
  }
}

export async function buildSystemInUe(ctx: SysCtx, sysId: string): Promise<NonNullable<AnimSystem['lastBuild']>> {
  const man = buildManifest(ctx.dir, sysId)
  if (!man.clips.length) throw new Error('Kurulacak üretilmiş klip yok. Önce “Hepsini üret”.')
  const b64 = Buffer.from(JSON.stringify(man), 'utf8').toString('base64')
  const script = `import base64, json\nSYSTEM = json.loads(base64.b64decode("${b64}").decode("utf-8"))\n` + fs.readFileSync(resourcePath('python', 'ue_animsys.py'), 'utf8')
  const outDir = ensureDir(path.join(ctx.dir, 'export', 'AnimSystems'))
  const file = path.join(outDir, `ue_animsys_${man.name}.py`)
  fs.writeFileSync(file, script)
  const build: NonNullable<AnimSystem['lastBuild']> = { at: Date.now(), ok: false, notes: [], errors: [], script: file, assets: [] }
  try {
    const r = await runInUe(script)
    const line = r.output.split('\n').find((l) => l.startsWith('FORGE_RESULT '))
    if (line) {
      const res = JSON.parse(line.slice(13)) as { notes: string[]; errors: string[]; assets: string[] }
      build.notes = res.notes
      build.errors = res.errors
      build.assets = res.assets
      build.ok = r.success && !res.errors.length
    } else {
      build.errors.push(r.result || r.output.slice(-600) || 'Unreal’dan sonuç gelmedi')
    }
  } catch (e) {
    build.errors.push(`Unreal’a bağlanılamadı: ${(e as Error).message}. Betik kaydedildi; Unreal’da File → Execute Python Script ile çalıştırabilirsin: ${file}`)
  }
  mutate(ctx, (p) => {
    const s = (p.animSystems ?? []).find((x) => x.id === sysId)
    if (s) s.lastBuild = build
  })
  return build
}

// --------------------------------------------------------------------------- AI planı

export interface PlanClip {
  key: string
  enabled: boolean
  prompt: string
  seconds: number
  speed: number
  speedEnd?: number
  moveDir: number
  turn: number
  role: AnimSystemClip['role']
  label: string
  group: string
  loop: boolean
  from?: string
  to?: string
}

/** Planı sisteme uygula: mevcut klipler güncellenir (asset bağı korunur), yeniler eklenir, planda olmayanlar kapatılır */
export function applyPlan(sys: AnimSystem, plan: { name?: string; style: string; clips: PlanClip[] }): AnimSystem {
  const inPlace = sys.kind === 'blendspace1d' || sys.kind === 'blendspace2d' || sys.kind === 'statemachine' || sys.kind === 'aimoffset'
  const byKey = new Map(sys.clips.map((c) => [c.key, c]))
  const keys = new Set(plan.clips.map((c) => c.key))
  const clips: AnimSystemClip[] = []
  for (const pc of plan.clips) {
    const old = byKey.get(pc.key)
    const prompt = pc.prompt.includes('{S}') ? pc.prompt : pc.prompt.replace(/^(A|An)\s+[^,]*?(person|man|woman|soldier)\b/i, '{S}')
    const base: AnimSystemClip = old ?? {
      key: pc.key,
      label: pc.label,
      group: pc.group,
      role: pc.role,
      prompt,
      seconds: pc.seconds,
      loop: pc.loop,
      rootMotion: inPlace ? 'inplace' : 'root',
      speed: 0,
      moveDir: 0,
      turn: 0,
      constrainPath: !['action', 'other', 'jump_start', 'jump_loop', 'land'].includes(pc.role),
      enabled: true
    }
    clips.push({
      ...base,
      label: pc.label || base.label,
      group: pc.group || base.group,
      role: pc.role,
      prompt,
      seconds: Math.min(10, Math.max(0.5, pc.seconds)),
      loop: pc.loop,
      speed: Math.max(0, pc.speed),
      speedEnd: pc.speedEnd,
      moveDir: pc.moveDir,
      turn: pc.turn,
      from: pc.from && keys.has(pc.from) ? pc.from : undefined,
      to: pc.to && keys.has(pc.to) ? pc.to : undefined,
      enabled: pc.enabled
    })
  }
  for (const c of sys.clips) if (!keys.has(c.key)) clips.push({ ...c, enabled: false })
  return { ...sys, name: plan.name || sys.name, style: plan.style || sys.style, clips, updatedAt: Date.now() }
}
