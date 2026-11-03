// SPDX-License-Identifier: AGPL-3.0-only
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORY_META, defaultParams, NODE_DEF_MAP, NODE_DEFS, PORT_COLORS, portsCompatible, type NodeCategory } from '../../../shared/nodes'
import { PIPELINE_TEMPLATES } from '../../../shared/templates'
import type { Pipeline, PipelineEdge, PipelineNode } from '../../../shared/types'
import { ForgeNode, RunStateCtx, type ForgeRFNode } from '../components/ForgeNode'
import { Field, NumberInput, Select, TextArea, TextInput, Toggle, AsyncButton } from '../components/ui'
import { useStore } from '../store'

const nodeTypes = { forge: ForgeNode }

const portType = (nodeType: string | undefined, port: string | null | undefined, dir: 'in' | 'out') => {
  const def = nodeType ? NODE_DEF_MAP[nodeType] : undefined
  return (dir === 'in' ? def?.inputs : def?.outputs)?.find((p) => p.id === port)?.type
}

const toRF = (n: PipelineNode): ForgeRFNode => ({ id: n.id, type: 'forge', position: n.position, data: { defType: n.type, params: n.params } })

function toRFEdge(e: PipelineEdge, nodes: PipelineNode[]): Edge {
  const src = nodes.find((n) => n.id === e.source)
  const t = portType(src?.type, e.sourceHandle, 'out')
  return { ...e, animated: false, style: { stroke: t ? PORT_COLORS[t] : '#888', strokeWidth: 2 } }
}

function newPipelineId() {
  return 'pl_' + Date.now().toString(36)
}

function Editor({ goJobs }: { goJobs: () => void }) {
  const { project, update, jobs, selectedAssets, saveNow, toast } = useStore()
  const p = project!
  const [pipelineId, setPipelineId] = useState(p.pipelines[0]?.id ?? '')
  const pipeline = p.pipelines.find((pl) => pl.id === pipelineId)
  const [nodes, setNodes] = useState<ForgeRFNode[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string>('')
  const [showRun, setShowRun] = useState(false)
  const loadedFor = useRef('')
  const rf = useReactFlow()

  // Pipeline değişince tuvali yeniden kur
  useEffect(() => {
    if (!pipeline || loadedFor.current === pipeline.id) return
    loadedFor.current = pipeline.id
    setNodes(pipeline.nodes.map(toRF))
    setEdges(pipeline.edges.map((e) => toRFEdge(e, pipeline.nodes)))
    setSelId(null)
    setJobId('')
    setTimeout(() => rf.fitView({ padding: 0.2 }), 50)
  }, [pipeline, rf])

  // Tuvaldeki değişiklikleri projeye yaz (sürükleme bitince)
  const commit = useCallback(
    (ns: ForgeRFNode[], es: Edge[]) => {
      if (!pipelineId) return
      update((pr) => ({
        ...pr,
        pipelines: pr.pipelines.map((pl) =>
          pl.id !== pipelineId
            ? pl
            : {
                ...pl,
                nodes: ns.map((n) => ({ id: n.id, type: n.data.defType, position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }, params: n.data.params })),
                edges: es.map((e) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle ?? '', target: e.target, targetHandle: e.targetHandle ?? '' }))
              }
        )
      }))
    },
    [pipelineId, update]
  )

  // Kalıcı değişiklik olduğunda işaretlenir; efekt render sonrası projeye yazar
  const dirty = useRef(false)
  useEffect(() => {
    if (!dirty.current) return
    dirty.current = false
    commit(nodes, edges)
  }, [nodes, edges, commit])

  const onNodesChange = useCallback((changes: NodeChange<ForgeRFNode>[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns))
    const removed = new Set(changes.filter((c) => c.type === 'remove').map((c) => c.id))
    if (removed.size) setEdges((es) => es.filter((e) => !removed.has(e.source) && !removed.has(e.target)))
    if (removed.size || changes.some((c) => c.type === 'position' && !c.dragging)) dirty.current = true
    for (const c of changes) if (c.type === 'select' && c.selected) setSelId(c.id)
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((es) => applyEdgeChanges(changes, es))
    if (changes.some((c) => c.type === 'remove')) dirty.current = true
  }, [])

  const isValidConnection = useCallback(
    (c: Connection | Edge) => {
      if (c.source === c.target) return false
      const s = nodes.find((n) => n.id === c.source)
      const t = nodes.find((n) => n.id === c.target)
      const st = portType(s?.data.defType, c.sourceHandle, 'out')
      const tt = portType(t?.data.defType, c.targetHandle, 'in')
      return !!st && !!tt && portsCompatible(st, tt)
    },
    [nodes]
  )

  const onConnect = useCallback(
    (c: Connection) => {
      const src = nodes.find((n) => n.id === c.source)
      const t = portType(src?.data.defType, c.sourceHandle, 'out')
      setEdges((es) => {
        // Her giriş portuna tek bağlantı
        const filtered = es.filter((e) => !(e.target === c.target && e.targetHandle === c.targetHandle))
        return addEdge({ ...c, id: `${c.source}.${c.sourceHandle}->${c.target}.${c.targetHandle}`, style: { stroke: t ? PORT_COLORS[t] : '#888', strokeWidth: 2 } }, filtered)
      })
      dirty.current = true
    },
    [nodes]
  )

  const addNode = (type: string) => {
    const pos = rf.screenToFlowPosition({ x: window.innerWidth * 0.45, y: window.innerHeight * 0.4 })
    const id = `${type.split('.').pop()}_${Math.random().toString(36).slice(2, 6)}`
    const node: ForgeRFNode = { id, type: 'forge', position: pos, data: { defType: type, params: defaultParams(type) } }
    setNodes((ns) => [...ns, node])
    dirty.current = true
    setSelId(id)
  }

  const setParam = (key: string, value: string | number | boolean) => {
    setNodes((ns) => ns.map((n) => (n.id === selId ? { ...n, data: { ...n.data, params: { ...n.data.params, [key]: value } } } : n)))
    dirty.current = true
  }

  const createFrom = (tplId: string) => {
    const tpl = tplId === 'empty' ? null : (PIPELINE_TEMPLATES.find((t) => t.id === tplId) ?? p.pipelines.find((t) => t.id === tplId))
    const pl: Pipeline = tpl
      ? { ...structuredClone(tpl), id: newPipelineId(), name: tpl.name + ' (kopya)' }
      : { id: newPipelineId(), name: 'Yeni hat', description: '', nodes: [{ id: 'asset', type: 'asset.input', position: { x: 40, y: 150 }, params: {} }], edges: [] }
    update((pr) => ({ ...pr, pipelines: [...pr.pipelines, pl] }))
    setPipelineId(pl.id)
  }

  const removePipeline = () => {
    if (!pipeline || p.pipelines.length <= 1) return
    update((pr) => ({ ...pr, pipelines: pr.pipelines.filter((pl) => pl.id !== pipeline.id) }))
    setPipelineId(p.pipelines.find((pl) => pl.id !== pipeline.id)!.id)
  }

  const pipelineJobs = jobs.filter((j) => j.pipelineId === pipelineId)
  const shownJob = pipelineJobs.find((j) => j.id === jobId) ?? pipelineJobs[0]
  const runState = useMemo(() => shownJob?.nodes ?? {}, [shownJob])
  const sel = nodes.find((n) => n.id === selId)
  const selDef = sel ? NODE_DEF_MAP[sel.data.defType] : undefined

  const grouped = useMemo(() => {
    const m = new Map<NodeCategory, typeof NODE_DEFS>()
    for (const d of NODE_DEFS) m.set(d.category, [...(m.get(d.category) ?? []), d])
    return [...m.entries()]
  }, [])

  if (!pipeline) return <div className="empty">Pipeline yok</div>

  return (
    <div className="pipeline">
      <div className="pl-toolbar">
        <Select value={pipelineId} onChange={setPipelineId} options={p.pipelines.map((pl) => ({ value: pl.id, label: pl.name }))} />
        <input
          className="input"
          style={{ width: 240 }}
          value={pipeline.name}
          onChange={(e) => update((pr) => ({ ...pr, pipelines: pr.pipelines.map((pl) => (pl.id === pipelineId ? { ...pl, name: e.target.value } : pl)) }))}
        />
        <Select
          value=""
          onChange={(v) => v && createFrom(v)}
          options={[
            { value: '', label: '+ Yeni hat…' },
            { value: 'empty', label: 'Boş hat' },
            ...PIPELINE_TEMPLATES.map((t) => ({ value: t.id, label: 'Şablon: ' + t.name })),
            { value: pipelineId, label: 'Bu hattı kopyala' }
          ]}
        />
        <button className="btn ghost" onClick={removePipeline} disabled={p.pipelines.length <= 1}>
          Sil
        </button>
        <div className="spacer" />
        {pipelineJobs.length > 0 && <Select value={shownJob?.id ?? ''} onChange={setJobId} options={pipelineJobs.slice(0, 30).map((j) => ({ value: j.id, label: `${j.assetName} — ${j.status}` }))} />}
        <button className="btn primary" onClick={() => setShowRun(true)}>
          ▶ Çalıştır
        </button>
      </div>
      <p className="pl-desc muted">{pipeline.description}</p>

      <div className="pl-body">
        <div className="palette">
          {grouped.map(([cat, defs]) => (
            <div key={cat} className="palette-group">
              <div className="palette-title" style={{ color: CATEGORY_META[cat].color }}>
                {CATEGORY_META[cat].label}
              </div>
              {defs.map((d) => (
                <button key={d.type} className="palette-item" title={d.description} onClick={() => addNode(d.type)}>
                  {d.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="canvas">
          <RunStateCtx.Provider value={runState}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              onPaneClick={() => setSelId(null)}
              deleteKeyCode={['Delete']}
              colorMode="dark"
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} size={1} />
              <Controls />
              <MiniMap pannable zoomable nodeColor={(n) => CATEGORY_META[NODE_DEF_MAP[(n as ForgeRFNode).data.defType]?.category ?? 'input'].color} />
            </ReactFlow>
          </RunStateCtx.Provider>
        </div>

        <div className="inspector">
          {sel && selDef ? (
            <>
              <h3>{selDef.label}</h3>
              <p className="muted small">{selDef.description}</p>
              <div className="muted small mono">id: {sel.id}</div>
              {selDef.params.map((pd) => {
                const v = sel.data.params[pd.id] ?? pd.default
                return (
                  <Field key={pd.id} label={pd.label} help={pd.help}>
                    {pd.type === 'select' ? (
                      <Select value={String(v)} onChange={(x) => setParam(pd.id, x)} options={pd.options ?? []} />
                    ) : pd.type === 'bool' ? (
                      <Toggle value={v === true} onChange={(x) => setParam(pd.id, x)} />
                    ) : pd.type === 'number' ? (
                      <NumberInput value={Number(v)} step={pd.id === 'prompt_influence' ? 0.05 : 1} onChange={(x) => setParam(pd.id, x)} />
                    ) : pd.type === 'textarea' ? (
                      <TextArea value={String(v)} onChange={(x) => setParam(pd.id, x)} />
                    ) : (
                      <TextInput value={String(v)} onChange={(x) => setParam(pd.id, x)} />
                    )}
                  </Field>
                )
              })}
              {shownJob?.nodes[sel.id]?.logs.length ? (
                <div className="logs small">
                  {shownJob.nodes[sel.id].logs.slice(-40).map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="muted small">
              <p>Bir node seçin ya da soldaki listeden ekleyin.</p>
              <p>
                Portları sürükleyerek bağlayın. Renkler veri tipini gösterir; uyumsuz portlar bağlanmaz. Silmek için <b>Delete</b>.
              </p>
              <p>
                <b>Kalite Kontrol</b> node'u başarısız olursa kendisine en yakın <b>Prompt Motoru</b>na geri bildirim gönderir ve aradaki adımlar yeniden çalışır.
              </p>
            </div>
          )}
        </div>
      </div>

      {showRun && (
        <RunDialog
          onClose={() => setShowRun(false)}
          preselected={selectedAssets}
          onRun={async (ids) => {
            await saveNow()
            const started = await window.forge.run.start(pipelineId, ids)
            toast(`${started.length} iş başladı`, 'ok')
            setJobId(started[0]?.id ?? '')
            setShowRun(false)
            if (started.length > 1) goJobs()
          }}
        />
      )}
    </div>
  )
}

function RunDialog({ onClose, onRun, preselected }: { onClose: () => void; onRun: (ids: string[]) => Promise<void>; preselected: string[] }) {
  const { project } = useStore()
  const [q, setQ] = useState('')
  const [ids, setIds] = useState<string[]>(preselected)
  const assets = project!.assets.filter((a) => !q || `${a.id} ${a.name}`.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))).slice(0, 200)
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Hangi asset(ler) üretilsin?</h2>
        <input className="input" autoFocus placeholder="Ara…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="modal-list">
          {assets.map((a) => (
            <label key={a.id} className="modal-row">
              <input type="checkbox" checked={ids.includes(a.id)} onChange={() => setIds(ids.includes(a.id) ? ids.filter((x) => x !== a.id) : [...ids, a.id])} />
              <span className="mono">{a.id}</span> {a.name}
            </label>
          ))}
          {!assets.length && <p className="muted">Asset yok — önce Asset Listesi'nden içe aktarın.</p>}
        </div>
        <div className="row between">
          <span className="muted">{ids.length} seçili</span>
          <div className="row">
            <button className="btn ghost" onClick={onClose}>
              Vazgeç
            </button>
            <AsyncButton className="primary" disabled={!ids.length} onClick={() => onRun(ids)}>
              ▶ Başlat
            </AsyncButton>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PipelinePage({ goJobs }: { goJobs: () => void }) {
  return (
    <ReactFlowProvider>
      <Editor goJobs={goJobs} />
    </ReactFlowProvider>
  )
}
