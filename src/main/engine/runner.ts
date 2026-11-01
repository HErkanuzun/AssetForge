// Pipeline çalıştırma motoru: topolojik sıra, QA geri bildirim döngüsü, iş kuyruğu, iptal.
import path from 'node:path'
import { NODE_DEF_MAP } from '../../shared/nodes'
import type { Artifact, AssetSpec, Job, NodeRunState, Pipeline, Project } from '../../shared/types'
import { assetBaseName } from '../../shared/templates'
import { saveJob } from '../project'
import { ensureDir, newId } from '../util'
import { getExecutor, type ExecCtx } from './executors'

function topoSort(p: Pipeline): string[] {
  const indeg = new Map(p.nodes.map((n) => [n.id, 0]))
  for (const e of p.edges) if (indeg.has(e.target) && indeg.has(e.source)) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1)
  const order: string[] = []
  const queue = [...p.nodes].sort((a, b) => a.position.x - b.position.x).filter((n) => indeg.get(n.id) === 0).map((n) => n.id)
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const e of p.edges.filter((e) => e.source === id)) {
      const d = (indeg.get(e.target) ?? 0) - 1
      indeg.set(e.target, d)
      if (d === 0) queue.push(e.target)
    }
  }
  if (order.length !== p.nodes.length) throw new Error('Pipeline döngü içeriyor (bir node kendine geri bağlanmış)')
  return order
}

function ancestors(p: Pipeline, id: string): Set<string> {
  const out = new Set<string>()
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    for (const e of p.edges) if (e.target === cur && !out.has(e.source)) out.add(e.source), stack.push(e.source)
  }
  return out
}

function descendants(p: Pipeline, id: string): Set<string> {
  const out = new Set<string>()
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    for (const e of p.edges) if (e.source === cur && !out.has(e.target)) out.add(e.target), stack.push(e.target)
  }
  return out
}

/** QA node'una en yakın üst Prompt Motoru (geriye doğru BFS) */
function nearestPrompt(p: Pipeline, qaId: string): string | null {
  const types = new Map(p.nodes.map((n) => [n.id, n.type]))
  const seen = new Set<string>([qaId])
  let frontier = [qaId]
  while (frontier.length) {
    const next: string[] = []
    for (const cur of frontier)
      for (const e of p.edges)
        if (e.target === cur && !seen.has(e.source)) {
          if (types.get(e.source) === 'prompt.generate') return e.source
          seen.add(e.source)
          next.push(e.source)
        }
    frontier = next
  }
  return null
}

const freshState = (): NodeRunState => ({ status: 'idle', progress: 0, logs: [], attempts: 0 })

export class Runner {
  private active = new Map<string, AbortController>()
  private queue: (() => Promise<void>)[] = []
  private running = 0
  private lastEmit = new Map<string, number>()

  constructor(
    private emit: (job: Job) => void,
    private concurrency: () => number
  ) {}

  start(project: Project, projectDir: string, pipelineId: string, assetIds: string[]): Job[] {
    const pipeline = project.pipelines.find((p) => p.id === pipelineId)
    if (!pipeline) throw new Error('Pipeline bulunamadı')
    topoSort(pipeline) // döngü kontrolü
    const assets = assetIds.map((id) => project.assets.find((a) => a.id === id)).filter((a): a is AssetSpec => !!a)
    if (!assets.length) throw new Error('Çalıştırılacak asset seçilmedi')

    const jobs = assets.map((asset) => {
      const id = newId('job')
      const job: Job = {
        id,
        pipelineId,
        pipelineName: pipeline.name,
        assetId: asset.id,
        assetName: asset.name,
        status: 'queued',
        createdAt: Date.now(),
        outDir: path.join(projectDir, 'output', assetBaseName(asset), id),
        nodes: Object.fromEntries(pipeline.nodes.map((n) => [n.id, freshState()])),
        cost: { claudeUsd: 0, meshyCredits: 0, audioChars: 0 },
        warnings: []
      }
      const parent = asset.parentId ? project.assets.find((a) => a.id === asset.parentId) : undefined
      const snapshot = structuredClone({ pipeline, asset, bible: project.bible, parent })
      this.queue.push(() => this.execute(job, snapshot.pipeline, snapshot.asset, snapshot.bible, projectDir, snapshot.parent))
      saveJob(projectDir, job)
      this.emit(job)
      return job
    })
    this.pump()
    return jobs
  }

  cancel(jobId: string): void {
    this.active.get(jobId)?.abort()
  }

  private pump(): void {
    while (this.running < Math.max(1, this.concurrency()) && this.queue.length) {
      const task = this.queue.shift()!
      this.running++
      task().finally(() => {
        this.running--
        this.pump()
      })
    }
  }

  private push(job: Job, force = false): void {
    const now = Date.now()
    if (!force && now - (this.lastEmit.get(job.id) ?? 0) < 250) return
    this.lastEmit.set(job.id, now)
    this.emit(structuredClone(job))
  }

  private async execute(job: Job, pipeline: Pipeline, asset: AssetSpec, bible: Project['bible'], projectDir: string, parent?: AssetSpec): Promise<void> {
    const abort = new AbortController()
    this.active.set(job.id, abort)
    job.status = 'running'
    this.push(job, true)

    const order = topoSort(pipeline)
    const byId = new Map(pipeline.nodes.map((n) => [n.id, n]))
    const feedback = new Map<string, string[]>()
    const dirty = new Set(order)

    try {
      for (let i = 0; i < order.length; i++) {
        const nodeId = order[i]
        if (!dirty.has(nodeId)) continue
        dirty.delete(nodeId)
        if (abort.signal.aborted) throw new Error('İptal edildi')
        const node = byId.get(nodeId)!
        const def = NODE_DEF_MAP[node.type]
        const state = job.nodes[nodeId]

        // Girdileri topla
        const inputs: Record<string, Artifact | undefined> = {}
        for (const e of pipeline.edges.filter((e) => e.target === nodeId)) inputs[e.targetHandle] = job.nodes[e.source]?.outputs?.[e.sourceHandle]
        const missing = def?.inputs.filter((port) => !port.optional && !inputs[port.id]) ?? []
        if (missing.length) {
          state.status = 'skipped'
          state.logs.push(`Atlandı: bağlı olmayan giriş(ler) ${missing.map((m) => m.label).join(', ')}`)
          this.push(job, true)
          continue
        }

        state.status = 'running'
        state.progress = 0
        state.error = undefined
        state.attempts++
        const dir = ensureDir(path.join(job.outDir, `${nodeId}${state.attempts > 1 ? `_try${state.attempts}` : ''}`))
        const ctx: ExecCtx = {
          job,
          nodeId,
          asset,
          parent,
          bible,
          projectDir,
          dir,
          feedback: feedback.get(nodeId) ?? [],
          signal: abort.signal,
          log: (m) => {
            state.logs.push(`[${new Date().toLocaleTimeString('tr-TR')}] ${m}`)
            this.push(job)
          },
          progress: (p) => {
            state.progress = Math.max(0, Math.min(100, p))
            this.push(job)
          },
          cost: (c) => {
            job.cost.claudeUsd += c.usd ?? 0
            job.cost.meshyCredits += c.credits ?? 0
            job.cost.audioChars += c.chars ?? 0
          },
          warn: (m) => {
            job.warnings.push(m)
            state.logs.push(`⚠ ${m}`)
            this.push(job, true)
          }
        }
        this.push(job, true)

        let result
        try {
          result = await getExecutor(node.type)(ctx, node.params, inputs)
        } catch (e) {
          state.status = 'failed'
          state.error = (e as Error).message
          state.logs.push(`HATA: ${state.error}`)
          throw new Error(`${def?.label ?? node.type}: ${state.error}`)
        }
        state.outputs = result.outputs
        state.progress = 100
        state.status = 'done'

        // Kalite kontrol başarısız → geri bildirimle yeniden dene
        if (result.qa && !result.qa.pass) {
          const maxRetries = Number(node.params.max_retries ?? 2)
          const promptId = nearestPrompt(pipeline, nodeId)
          if (promptId && state.attempts <= maxRetries) {
            const list = feedback.get(promptId) ?? []
            list.push(result.qa.feedback || 'Previous result was rejected by the reviewer; improve fidelity to the brief.')
            feedback.set(promptId, list)
            const rerun = new Set([...descendants(pipeline, promptId)].filter((id) => ancestors(pipeline, nodeId).has(id)))
            rerun.add(promptId)
            rerun.add(nodeId)
            for (const id of rerun) {
              dirty.add(id)
              if (id !== nodeId) job.nodes[id].status = 'retrying'
            }
            state.status = 'retrying'
            state.logs.push(`↻ Yeniden deneme ${state.attempts}/${maxRetries}: prompt geri bildirimle yeniden yazılacak`)
            i = Math.min(...[...rerun].map((id) => order.indexOf(id))) - 1
            this.push(job, true)
            continue
          }
          if (String(node.params.on_fail ?? 'stop') === 'continue') {
            ctx.warn(`Kalite kontrol geçilemedi ama hat devam ediyor (${node.id})`)
          } else {
            state.status = 'failed'
            state.error = 'Kalite kontrol eşiği aşılamadı'
            throw new Error(`Kalite kontrol: ${maxRetries} denemede eşik aşılamadı`)
          }
        }
        this.push(job, true)
        saveJob(projectDir, job)
      }
      job.status = 'done'
    } catch (e) {
      const msg = (e as Error).message
      job.status = abort.signal.aborted ? 'canceled' : 'failed'
      job.error = msg
      for (const s of Object.values(job.nodes)) if (s.status === 'running' || s.status === 'retrying') s.status = abort.signal.aborted ? 'skipped' : 'failed'
    } finally {
      job.finishedAt = Date.now()
      this.active.delete(job.id)
      saveJob(projectDir, job)
      this.push(job, true)
    }
  }
}
