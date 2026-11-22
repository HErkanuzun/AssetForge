// SPDX-License-Identifier: AGPL-3.0-only
import { errorMessage } from '../../../shared/i18n/errors'
import { message } from '../../../shared/i18n/message'
import { panelLabel } from '../../../shared/i18n/display'
import { flowLabels } from '../components/flowLabels'
import { useLocale } from '../i18n'
// Oyun Tasarımı: çekirdek fikir, oyun / hikâye döngüleri (akış şeması), hikâye, arayüz ekranları ve Unreal bağlantısı.
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps
} from '@xyflow/react'
import { useMemo, useState } from 'react'
import { circleLayout, newId, NODE_TYPES, normalizeDesign, SCOPES, screenLayout } from '../../../shared/design'
import type { DesignGraph, DesignNodeType, DesignSection, GameDesign, UiScreen, UiWidgetType } from '../../../shared/types'
import { AsyncButton, Field, Select, TextArea, TextInput } from '../components/ui'
import { useStore } from '../store'
import '../design.css'

type Tab = DesignSection | 'unreal'
type Engine = 'api' | 'claude-code' | 'codex'

const TABS: { id: Tab; label: string }[] = [
  { id: 'core', label: 'Özet' },
  { id: 'loops', label: 'Döngüler' },
  { id: 'story', label: 'Hikâye' },
  { id: 'screens', label: 'Arayüz' },
  { id: 'unreal', label: 'Unreal' }
]

const ENGINES: { value: Engine; label: string }[] = [
  { value: 'claude-code', label: 'Claude Code (aboneliğinle)' },
  { value: 'codex', label: 'Codex CLI (aboneliğinle)' },
  { value: 'api', label: 'API (Ayarlar’daki LLM)' }
]

const WIDGETS: { value: UiWidgetType; label: string }[] = [
  { value: 'text', label: 'Metin' },
  { value: 'button', label: 'Düğme' },
  { value: 'bar', label: 'Çubuk' },
  { value: 'image', label: 'Görsel' },
  { value: 'icon', label: 'İkon' },
  { value: 'list', label: 'Liste' },
  { value: 'input', label: 'Giriş' },
  { value: 'panel', label: 'Panel' }
]

const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)

function readPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback
  } catch {
    return fallback
  }
}
function writePref(key: string, v: string): void {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* depolama kapalı */
  }
}

export default function DesignPage() {
  const { t, locale } = useLocale()

  const { project, update, toast } = useStore()
  const p = project!
  const d = normalizeDesign(p.design)
  const [tab, setTab] = useState<Tab>(() => readPref<Tab>('forge.design.tab', 'core'))
  const go = (t: Tab) => {
    setTab(t)
    writePref('forge.design.tab', t)
  }
  const set = (patch: Partial<GameDesign>) => update((pr) => ({ ...pr, design: { ...normalizeDesign(pr.design), ...patch, updatedAt: Date.now() } }))

  return (
    <div className="page design">
      <header className="page-head">
        <div>
          <h1> {t('panel.cebd0074d5')} </h1>
          <p className="muted">
            {p.bible.projectName || p.name} {t('panel.6a12c35545')}{' '}
          </p>
        </div>
        <div className="seg">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
              {panelLabel(locale, t.label)}
              {t.id === 'loops' && d.loops.length > 0 && <span className="n">{d.loops.length}</span>}
              {t.id === 'screens' && d.screens.length > 0 && <span className="n">{d.screens.length}</span>}
            </button>
          ))}
        </div>
      </header>

      {tab !== 'unreal' && <AiBar section={tab} design={d} onResult={(data) => set(data)} />}
      {tab === 'core' && <CoreTab d={d} set={set} />}
      {tab === 'loops' && <LoopsTab d={d} set={set} />}
      {tab === 'story' && <StoryTab d={d} set={set} />}
      {tab === 'screens' && <ScreensTab d={d} set={set} />}
      {tab === 'unreal' && <UnrealTab d={d} toast={toast} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Yapay zekâ çubuğu

const SECTION_HINT: Record<DesignSection, string> = {
  core: 'Ör. "Sakin, keşif odaklı bir araç oyunu; çatışma yok"',
  loops: 'Ör. "Çekirdek döngü sürüş ve teslimat olsun; meta döngüde garaj geliştirme"',
  story: 'Ör. "Üç perde, sonunda ihanet; ana karakter kurye"',
  screens: 'Ör. "Garaj ekranında araç parçaları değiştirilebilsin; HUD sade"'
}

function hasContent(section: DesignSection, d: GameDesign): boolean {
  if (section === 'core') return !!(d.pitch || d.pillars.length || d.mechanics.length)
  if (section === 'loops') return d.loops.length > 0
  if (section === 'story') return !!(d.story.premise || d.story.acts.length)
  return d.screens.length > 0
}

function AiBar({ section, design, onResult }: { section: DesignSection; design: GameDesign; onResult: (d: Partial<GameDesign>) => void }) {
  const { t, locale } = useLocale()

  const { project, toast } = useStore()
  const [text, setText] = useState('')
  const [engine, setEngine] = useState<Engine>(() => readPref<Engine>('forge.design.engine', 'claude-code'))
  const filled = hasContent(section, design)
  const run = async () => {
    if (filled && !window.confirm(t('panel.f99ea99e45'))) return
    toast(message('panel.04c7188e81'))
    try {
      const r = await window.forge.design.generate({ ...project!, design }, section, text, engine)
      onResult(r.data)
      toast(message('design.ready', { usd: r.usd?.toFixed(3) ?? '0.000' }), 'ok')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }
  return (
    <section className="card ai-bar">
      <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Field label={filled ? t('panel.705b581768') : t('panel.25e7e92af8')} help={t('panel.0bdd55de83')}>
            <TextInput value={text} onChange={setText} placeholder={panelLabel(locale, SECTION_HINT[section])} />
          </Field>
        </div>
        <div style={{ width: 220 }}>
          <Field label={t('panel.b25a14f2be')}>
            <Select
              value={engine}
              onChange={(v) => {
                setEngine(v as Engine)
                writePref('forge.design.engine', v)
              }}
              options={ENGINES.map((x) => ({ ...x, label: panelLabel(locale, x.label) }))}
            />
          </Field>
        </div>
        <AsyncButton className="primary" onClick={run}>
          ✨ {filled ? t('panel.0573a35623') : t('panel.89c75b03b9')}
        </AsyncButton>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Özet

type SetFn = (patch: Partial<GameDesign>) => void

function CoreTab({ d, set }: { d: GameDesign; set: SetFn }) {
  const { t } = useLocale()

  const setMech = (i: number, patch: Partial<GameDesign['mechanics'][number]>) => set({ mechanics: d.mechanics.map((m, j) => (j === i ? { ...m, ...patch } : m)) })
  return (
    <>
      <section className="card">
        <h2> {t('panel.83a1c2f0f3')} </h2>
        <div className="grid2">
          <Field label={t('panel.9320befb7a')} wide>
            <TextInput value={d.pitch} onChange={(v) => set({ pitch: v })} placeholder={t('panel.9bbb3e8e71')} />
          </Field>
          <Field label={t('panel.c62716edd1')} wide help={t('panel.cb9ea88d2b')}>
            <TextArea value={d.fantasy} onChange={(v) => set({ fantasy: v })} />
          </Field>
          <Field label={t('panel.f7058febf5')} wide>
            <TextInput value={d.audience} onChange={(v) => set({ audience: v })} />
          </Field>
          <Field label={t('panel.014b39bd0f')} wide help={t('panel.6df9a90e0f')}>
            <TextArea rows={5} value={d.pillars.join('\n')} onChange={(v) => set({ pillars: lines(v) })} />
          </Field>
        </div>
      </section>
      <section className="card">
        <div className="row between">
          <h2> {t('panel.430d7ee055')} </h2>
          <button className="btn ghost" onClick={() => set({ mechanics: [...d.mechanics, { name: '', description: '' }] })}>
            {' '}
            {t('panel.ea50d5211b')}{' '}
          </button>
        </div>
        {d.mechanics.length === 0 && <p className="muted"> {t('panel.54875121c8')} </p>}
        {d.mechanics.map((m, i) => (
          <div key={i} className="design-row">
            <input className="input" style={{ width: 200 }} value={m.name} placeholder={t('surface.name')} onChange={(e) => setMech(i, { name: e.target.value })} />
            <input className="input" style={{ flex: 1 }} value={m.description} placeholder={t('panel.96078f242d')} onChange={(e) => setMech(i, { description: e.target.value })} />
            <button className="btn ghost" title={t('panel.f698e9b40f')} onClick={() => set({ mechanics: d.mechanics.filter((_, j) => j !== i) })}>
              ✕
            </button>
          </div>
        ))}
      </section>
    </>
  )
}

// ---------------------------------------------------------------------------
// Döngüler (akış şeması)

type LoopNodeData = { label: string; type: DesignNodeType; note: string }

function LoopNode({ data, selected }: NodeProps<Node<LoopNodeData>>) {
  const { locale } = useLocale()
  const t = NODE_TYPES.find((x) => x.value === data.type) ?? NODE_TYPES[0]
  return (
    <div className={`loop-node ${selected ? 'sel' : ''}`} style={{ borderColor: t.color }}>
      <Handle type="target" position={Position.Top} />
      <span className="loop-type" style={{ color: t.color }}>
        {panelLabel(locale, t.label)}
      </span>
      <b>{data.label || '—'}</b>
      {data.note && <span className="loop-note">{data.note}</span>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
const nodeTypes = { loop: LoopNode }

function LoopsTab({ d, set }: { d: GameDesign; set: SetFn }) {
  const { t, locale } = useLocale()

  const [sel, setSel] = useState<string>(d.loops[0]?.id ?? '')
  const loop = d.loops.find((l) => l.id === sel) ?? d.loops[0]
  const setLoop = (patch: Partial<DesignGraph>) => loop && set({ loops: d.loops.map((l) => (l.id === loop.id ? { ...l, ...patch } : l)) })
  const add = (scope: DesignGraph['scope']) => {
    const base = circleLayout(
      ['Eylem', 'Zorluk', 'Ödül', 'İlerleme'].map((label, i) => ({
        id: newId('n'),
        label: panelLabel(locale, label),
        type: (['action', 'challenge', 'reward', 'progress'] as const)[i],
        note: '',
        x: 0,
        y: 0
      }))
    )
    const edges = base.map((n, i) => ({ id: newId('e'), from: n.id, to: base[(i + 1) % base.length].id, label: '' }))
    const g: DesignGraph = { id: newId('loop'), name: panelLabel(locale, SCOPES.find((s) => s.value === scope)!.label), scope, description: '', nodes: base, edges }
    set({ loops: [...d.loops, g] })
    setSel(g.id)
  }
  return (
    <div className="loops">
      <aside className="card loop-list">
        <h2> {t('panel.b016c6b0c1')} </h2>
        {d.loops.map((l) => (
          <button key={l.id} className={`loop-item ${loop?.id === l.id ? 'on' : ''}`} onClick={() => setSel(l.id)}>
            <b>{l.name || panelLabel(locale, 'Adsız')}</b>
            <span className="muted small">{panelLabel(locale, SCOPES.find((s) => s.value === l.scope)?.label ?? l.scope)}</span>
          </button>
        ))}
        <div style={{ marginTop: 10 }}>
          <Select
            value=""
            onChange={(v) => v && add(v as DesignGraph['scope'])}
            options={[{ value: '', label: t('panel.c110946124') }, ...SCOPES.map((s) => ({ value: s.value, label: `${panelLabel(locale, s.label)} (${panelLabel(locale, s.hint)})` }))]}
          />
        </div>
      </aside>
      {loop ? (
        <ReactFlowProvider key={loop.id}>
          <LoopEditor loop={loop} setLoop={setLoop} onDelete={() => set({ loops: d.loops.filter((l) => l.id !== loop.id) })} />
        </ReactFlowProvider>
      ) : (
        <section className="card" style={{ flex: 1 }}>
          <p className="muted"> {t('panel.4c4f6c15c4')} </p>
        </section>
      )}
    </div>
  )
}

function LoopEditor({ loop, setLoop, onDelete }: { loop: DesignGraph; setLoop: (p: Partial<DesignGraph>) => void; onDelete: () => void }) {
  const { t, locale } = useLocale()

  const [selNode, setSelNode] = useState<string>('')
  const [selEdge, setSelEdge] = useState<string>('')
  const nodes: Node<LoopNodeData>[] = useMemo(
    () => loop.nodes.map((n) => ({ id: n.id, type: 'loop', position: { x: n.x, y: n.y }, data: { label: n.label, type: n.type, note: n.note }, selected: n.id === selNode })),
    [loop.nodes, selNode]
  )
  const edges: Edge[] = useMemo(
    () =>
      loop.edges.map((e) => ({
        id: e.id,
        source: e.from,
        target: e.to,
        label: e.label,
        selected: e.id === selEdge,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 2 }
      })),
    [loop.edges, selEdge]
  )
  const onNodesChange = (ch: NodeChange<Node<LoopNodeData>>[]) => {
    const next = applyNodeChanges(ch, nodes)
    const removed = new Set(ch.filter((c) => c.type === 'remove').map((c) => c.id))
    const moved = ch.some((c) => c.type === 'position' && !c.dragging) || removed.size > 0
    for (const c of ch) if (c.type === 'select' && c.selected) setSelNode(c.id)
    if (!moved) {
      // Sürükleme sırasında yalnızca konumları güncelle (kayıt sürükleme bitince)
      if (ch.some((c) => c.type === 'position')) setLoop({ nodes: loop.nodes.map((n) => ({ ...n, ...pos(next, n.id) })) })
      return
    }
    setLoop({
      nodes: loop.nodes.filter((n) => !removed.has(n.id)).map((n) => ({ ...n, ...pos(next, n.id) })),
      edges: loop.edges.filter((e) => !removed.has(e.from) && !removed.has(e.to))
    })
  }
  const onEdgesChange = (ch: EdgeChange[]) => {
    for (const c of ch) if (c.type === 'select' && c.selected) setSelEdge(c.id)
    const next = applyEdgeChanges(ch, edges)
    if (ch.some((c) => c.type === 'remove')) setLoop({ edges: loop.edges.filter((e) => next.some((n) => n.id === e.id)) })
  }
  const onConnect = (c: Connection) => {
    if (!c.source || !c.target) return
    const added = addEdge({ ...c, id: newId('e') }, edges)
    const e = added[added.length - 1]
    setLoop({ edges: [...loop.edges, { id: e.id, from: c.source, to: c.target, label: '' }] })
  }
  const node = loop.nodes.find((n) => n.id === selNode)
  const edge = loop.edges.find((e) => e.id === selEdge)
  const setNode = (patch: Partial<DesignGraph['nodes'][number]>) => setLoop({ nodes: loop.nodes.map((n) => (n.id === selNode ? { ...n, ...patch } : n)) })
  const addNode = () => {
    const n = { id: newId('n'), label: t('panel.4e44a0580d'), type: 'action' as DesignNodeType, note: '', x: 40, y: 40 }
    setLoop({ nodes: [...loop.nodes, n] })
    setSelNode(n.id)
  }
  return (
    <div className="loop-editor">
      <section className="card loop-head">
        <div className="grid2">
          <Field label={t('surface.name')}>
            <TextInput value={loop.name} onChange={(v) => setLoop({ name: v })} />
          </Field>
          <Field label={t('panel.7b0d5cffae')}>
            <Select
              value={loop.scope}
              onChange={(v) => setLoop({ scope: v as DesignGraph['scope'] })}
              options={SCOPES.map((s) => ({ value: s.value, label: `${panelLabel(locale, s.label)} (${panelLabel(locale, s.hint)})` }))}
            />
          </Field>
          <Field label={t('panel.218fc41215')} wide>
            <TextArea rows={2} value={loop.description} onChange={(v) => setLoop({ description: v })} />
          </Field>
        </div>
      </section>
      <div className="loop-canvas">
        <ReactFlow
          ariaLabelConfig={flowLabels(locale)}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneClick={() => (setSelNode(''), setSelEdge(''))}
          fitView
          colorMode="dark"
          deleteKeyCode={['Delete']}
        >
          <Background gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
        <div className="loop-tools">
          <button className="btn ghost" onClick={addNode}>
            {' '}
            {t('panel.9d1e6393ef')}{' '}
          </button>
          <button className="btn ghost" onClick={() => setLoop({ nodes: circleLayout(loop.nodes) })} title={t('panel.90595bb211')}>
            {' '}
            {t('panel.cf0cba41f6')}{' '}
          </button>
          <button className="btn ghost danger" onClick={() => window.confirm(t('common.deleteNamed', { name: loop.name })) && onDelete()}>
            {' '}
            {t('panel.ee561c9c9f')}{' '}
          </button>
        </div>
      </div>
      <section className="card loop-inspector">
        {node ? (
          <div className="grid2">
            <Field label={t('panel.98a3d97c81')}>
              <TextInput value={node.label} onChange={(v) => setNode({ label: v })} />
            </Field>
            <Field label={t('surface.type')}>
              <Select value={node.type} onChange={(v) => setNode({ type: v as DesignNodeType })} options={NODE_TYPES.map((t) => ({ value: t.value, label: panelLabel(locale, t.label) }))} />
            </Field>
            <Field label={t('panel.16270c7ae9')} wide>
              <TextArea rows={2} value={node.note} onChange={(v) => setNode({ note: v })} />
            </Field>
          </div>
        ) : edge ? (
          <Field label={t('panel.843e8c32d6')} help={t('panel.625032dc08')}>
            <TextInput value={edge.label} onChange={(v) => setLoop({ edges: loop.edges.map((e) => (e.id === edge.id ? { ...e, label: v } : e)) })} />
          </Field>
        ) : (
          <p className="muted small"> {t('panel.8d8bc026a8')} </p>
        )}
      </section>
    </div>
  )
}

function pos(nodes: Node[], id: string): { x: number; y: number } {
  const n = nodes.find((x) => x.id === id)
  return n ? { x: Math.round(n.position.x), y: Math.round(n.position.y) } : { x: 0, y: 0 }
}

// ---------------------------------------------------------------------------
// Hikâye

function StoryTab({ d, set }: { d: GameDesign; set: SetFn }) {
  const { t } = useLocale()

  const st = d.story
  const setStory = (patch: Partial<GameDesign['story']>) => set({ story: { ...st, ...patch } })
  const setAct = (i: number, patch: Partial<GameDesign['story']['acts'][number]>) => setStory({ acts: st.acts.map((a, j) => (j === i ? { ...a, ...patch } : a)) })
  const setChr = (i: number, patch: Partial<GameDesign['story']['characters'][number]>) => setStory({ characters: st.characters.map((c, j) => (j === i ? { ...c, ...patch } : c)) })
  return (
    <>
      <section className="card">
        <h2> {t('panel.817762ba24')} </h2>
        <div className="grid2">
          <Field label={t('panel.338b39473b')} wide>
            <TextArea rows={4} value={st.premise} onChange={(v) => setStory({ premise: v })} />
          </Field>
          <Field label={t('panel.6a5c484b91')} wide>
            <TextInput
              value={st.themes.join(', ')}
              onChange={(v) =>
                setStory({
                  themes: v
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean)
                })
              }
            />
          </Field>
        </div>
      </section>
      <section className="card">
        <div className="row between">
          <h2> {t('panel.5a28832a7e')} </h2>
          <button className="btn ghost" onClick={() => setStory({ acts: [...st.acts, { id: newId('act'), title: t('design.actTitle', { count: st.acts.length + 1 }), summary: '', beats: [] }] })}>
            {' '}
            {t('panel.13f322c0ab')}{' '}
          </button>
        </div>
        {st.acts.map((a, i) => (
          <div key={a.id} className="design-block">
            <div className="design-row">
              <input className="input" style={{ width: 220, fontWeight: 600 }} value={a.title} onChange={(e) => setAct(i, { title: e.target.value })} />
              <input className="input" style={{ flex: 1 }} value={a.summary} placeholder={t('panel.4ccc9faad3')} onChange={(e) => setAct(i, { summary: e.target.value })} />
              <button className="btn ghost" title={t('panel.f698e9b40f')} onClick={() => setStory({ acts: st.acts.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
            <TextArea rows={Math.max(3, a.beats.length + 1)} value={a.beats.join('\n')} onChange={(v) => setAct(i, { beats: lines(v) })} placeholder={t('panel.5cef69bd66')} />
          </div>
        ))}
      </section>
      <section className="card">
        <div className="row between">
          <h2> {t('panel.2536871f10')} </h2>
          <button className="btn ghost" onClick={() => setStory({ characters: [...st.characters, { id: newId('chr'), name: '', role: '', description: '', arc: '' }] })}>
            {' '}
            {t('panel.dd71779820')}{' '}
          </button>
        </div>
        {st.characters.map((c, i) => (
          <div key={c.id} className="design-block">
            <div className="design-row">
              <input className="input" style={{ width: 180, fontWeight: 600 }} value={c.name} placeholder={t('surface.name')} onChange={(e) => setChr(i, { name: e.target.value })} />
              <input className="input" style={{ width: 180 }} value={c.role} placeholder={t('panel.fb9f51fe92')} onChange={(e) => setChr(i, { role: e.target.value })} />
              <input className="input" style={{ flex: 1 }} value={c.description} placeholder={t('panel.37c9299cc7')} onChange={(e) => setChr(i, { description: e.target.value })} />
              <button className="btn ghost" title={t('panel.f698e9b40f')} onClick={() => setStory({ characters: st.characters.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
            <input className="input" value={c.arc} placeholder={t('panel.9aadd05deb')} onChange={(e) => setChr(i, { arc: e.target.value })} />
          </div>
        ))}
      </section>
    </>
  )
}

// ---------------------------------------------------------------------------
// Arayüz ekranları

function ScreensTab({ d, set }: { d: GameDesign; set: SetFn }) {
  const { t, locale } = useLocale()

  const [sel, setSel] = useState(d.screens[0]?.id ?? '')
  const s = d.screens.find((x) => x.id === sel)
  const setScreen = (patch: Partial<UiScreen>) => set({ screens: d.screens.map((x) => (x.id === sel ? { ...x, ...patch } : x)) })
  const layout = screenLayout(d.screens)
  const nodes: Node[] = d.screens.map((x) => ({
    id: x.id,
    position: layout[x.id],
    data: { label: `${x.layer === 'hud' ? '▣ ' : x.layer === 'popup' ? '◫ ' : '☰ '}${x.name}` },
    selected: x.id === sel,
    className: 'screen-node'
  }))
  const edges: Edge[] = d.screens.flatMap((x) => x.next.map((n) => ({ id: `${x.id}-${n}`, source: x.id, target: n, markerEnd: { type: MarkerType.ArrowClosed } })))
  const add = () => {
    const n: UiScreen = { id: newId('scr'), name: t('design.newScreen'), purpose: '', when: '', layer: 'menu', widgets: [], next: [] }
    set({ screens: [...d.screens, n] })
    setSel(n.id)
  }
  return (
    <div className="screens">
      <section className="card screen-flow">
        <div className="row between">
          <h2> {t('panel.34981dee11')} </h2>
          <button className="btn ghost" onClick={add}>
            {' '}
            {t('panel.8b24715c93')}{' '}
          </button>
        </div>
        <div className="screen-canvas">
          <ReactFlowProvider>
            <ReactFlow ariaLabelConfig={flowLabels(locale)} nodes={nodes} edges={edges} onNodeClick={(_, n) => setSel(n.id)} fitView colorMode="dark" nodesDraggable={false} nodesConnectable={false}>
              <Background gap={20} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </section>
      {s ? (
        <section className="card">
          <div className="row between">
            <h2>{s.name}</h2>
            <button
              className="btn ghost danger"
              onClick={() =>
                window.confirm(t('common.deleteNamed', { name: s.name })) && set({ screens: d.screens.filter((x) => x.id !== s.id).map((x) => ({ ...x, next: x.next.filter((n) => n !== s.id) })) })
              }
            >
              {' '}
              {t('panel.f698e9b40f')}{' '}
            </button>
          </div>
          <div className="grid2">
            <Field label={t('surface.name')}>
              <TextInput value={s.name} onChange={(v) => setScreen({ name: v })} />
            </Field>
            <Field label={t('panel.304db21f01')}>
              <Select
                value={s.layer}
                onChange={(v) => setScreen({ layer: v as UiScreen['layer'] })}
                options={[
                  { value: 'hud', label: t('panel.2425c55d12') },
                  { value: 'menu', label: t('panel.8ed9123eab') },
                  { value: 'popup', label: t('panel.3142bc3be2') }
                ]}
              />
            </Field>
            <Field label={t('panel.3515d148a8')} wide>
              <TextInput value={s.purpose} onChange={(v) => setScreen({ purpose: v })} />
            </Field>
            <Field label={t('panel.c26f21c3a6')} wide>
              <TextInput value={s.when} onChange={(v) => setScreen({ when: v })} placeholder={t('panel.d49005d67a')} />
            </Field>
          </div>
          <div className="row between" style={{ marginTop: 10 }}>
            <h3 style={{ margin: 0 }}> {t('panel.0f7cabcc5e')} </h3>
            <button className="btn ghost" onClick={() => setScreen({ widgets: [...s.widgets, { type: 'text', label: '', binding: '' }] })}>
              {' '}
              {t('panel.e32c64218e')}{' '}
            </button>
          </div>
          {s.widgets.map((w, i) => (
            <div key={i} className="design-row">
              <div style={{ width: 120 }}>
                <Select
                  value={w.type}
                  onChange={(v) => setScreen({ widgets: s.widgets.map((x, j) => (j === i ? { ...x, type: v as UiWidgetType } : x)) })}
                  options={WIDGETS.map((x) => ({ ...x, label: panelLabel(locale, x.label) }))}
                />
              </div>
              <input
                className="input"
                style={{ flex: 1 }}
                value={w.label}
                placeholder={t('panel.bc91fce11d')}
                onChange={(e) => setScreen({ widgets: s.widgets.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
              />
              <input
                className="input"
                style={{ width: 220 }}
                value={w.binding}
                placeholder={t('panel.fb2883be17')}
                onChange={(e) => setScreen({ widgets: s.widgets.map((x, j) => (j === i ? { ...x, binding: e.target.value } : x)) })}
              />
              <button className="btn ghost" title={t('panel.f698e9b40f')} onClick={() => setScreen({ widgets: s.widgets.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
          ))}
          <h3> {t('panel.ed903d3ea5')} </h3>
          <div className="row wrap" style={{ gap: 6 }}>
            {d.screens
              .filter((x) => x.id !== s.id)
              .map((x) => {
                const on = s.next.includes(x.id)
                return (
                  <button key={x.id} className={`chip ${on ? 'accent' : ''}`} onClick={() => setScreen({ next: on ? s.next.filter((n) => n !== x.id) : [...s.next, x.id] })}>
                    {on ? '→ ' : '+ '}
                    {x.name}
                  </button>
                )
              })}
          </div>
        </section>
      ) : (
        <section className="card">
          <p className="muted"> {t('panel.2c90094dca')} </p>
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Unreal

function UnrealTab({ d, toast }: { d: GameDesign; toast: (m: import('../../../shared/i18n/message').UiMessage, kind?: 'ok' | 'error') => void }) {
  const { t } = useLocale()

  const { project } = useStore()
  const [status, setStatus] = useState<{ remote: { projectName: string; engineVersion: string }[]; mcp: boolean; python: string } | null>(null)
  const check = async () => {
    try {
      setStatus(await window.forge.ueStatus())
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }
  const counts = t('design.counts', { loops: d.loops.length, acts: d.story.acts.length, characters: d.story.characters.length, screens: d.screens.length })
  return (
    <>
      <section className="card">
        <h2> {t('panel.7916c8f047')} </h2>
        <div className="row" style={{ gap: 10 }}>
          <AsyncButton className="primary" onClick={check}>
            {' '}
            {t('panel.107aee02e3')}{' '}
          </AsyncButton>
          {status && (
            <span className="muted">
              {status.remote.length ? `Remote Execution: ${status.remote.map((n) => `${n.projectName} (UE ${n.engineVersion})`).join(', ')} · ` : ''}
              {status.mcp ? t('design.mcpConnected') + (status.python ? ` · Python: ${status.python}` : '') : t('design.noMcp')}
              {!status.remote.length && !status.mcp && t('design.noEditor')}
            </span>
          )}
        </div>
      </section>
      <section className="card">
        <h2> {t('panel.53a9a2c92f')} </h2>
        <p className="muted"> {t('panel.104db4ed50')} </p>
        <AsyncButton
          className="primary"
          onClick={async () => {
            try {
              const done = await window.forge.design.teachUe(project!)
              toast(message('design.taught', { list: done.join(' · ') }), 'ok')
            } catch (e) {
              toast(errorMessage(e), 'error')
            }
          }}
        >
          {' '}
          {t('panel.f5e6f9a33c')}{' '}
        </AsyncButton>
      </section>
      <section className="card">
        <h2> {t('panel.1b6d4c78c4')} </h2>
        <p className="muted">
          {counts} {t('panel.7702428040')}{' '}
        </p>
        <AsyncButton
          onClick={async () => {
            const f = await window.forge.design.exportMd(project!)
            toast(message('design.exported', { file: f }), 'ok')
            await window.forge.openPath(f)
          }}
        >
          {' '}
          {t('panel.73b1164e7a')}{' '}
        </AsyncButton>
      </section>
    </>
  )
}
