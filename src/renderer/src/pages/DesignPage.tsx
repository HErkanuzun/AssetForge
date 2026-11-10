// SPDX-License-Identifier: AGPL-3.0-only
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
          <h1>Oyun Tasarımı</h1>
          <p className="muted">{p.bible.projectName || p.name}: döngüler, hikâye ve arayüz. Brief yönetmeni ve Unreal’daki yapay zekâ bu tasarımı bilir; asset’ler oyunun ihtiyacına göre önerilir.</p>
        </div>
        <div className="seg">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
              {t.label}
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
  const { project, toast } = useStore()
  const [text, setText] = useState('')
  const [engine, setEngine] = useState<Engine>(() => readPref<Engine>('forge.design.engine', 'claude-code'))
  const filled = hasContent(section, design)
  const run = async () => {
    if (filled && !window.confirm('Bu bölüm yapay zekânın yeni sürümüyle değiştirilecek (mevcut içerik ona bağlam olarak verilir). Devam edilsin mi?')) return
    toast('Tasarım yazılıyor… (1-3 dk)')
    try {
      const r = await window.forge.design.generate({ ...project!, design }, section, text, engine)
      onResult(r.data)
      toast(`Hazır${r.usd ? ` ($${r.usd.toFixed(3)})` : ''}`, 'ok')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  return (
    <section className="card ai-bar">
      <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Field label={filled ? 'Yapay zekâ ile geliştir' : 'Yapay zekâ ile oluştur'} help="Proje Kitabı, kütüphane ve tasarımın diğer bölümleri bağlam olarak verilir">
            <TextInput value={text} onChange={setText} placeholder={SECTION_HINT[section]} />
          </Field>
        </div>
        <div style={{ width: 220 }}>
          <Field label="Motor">
            <Select
              value={engine}
              onChange={(v) => {
                setEngine(v as Engine)
                writePref('forge.design.engine', v)
              }}
              options={ENGINES}
            />
          </Field>
        </div>
        <AsyncButton className="primary" onClick={run}>
          ✨ {filled ? 'Geliştir' : 'Oluştur'}
        </AsyncButton>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Özet

type SetFn = (patch: Partial<GameDesign>) => void

function CoreTab({ d, set }: { d: GameDesign; set: SetFn }) {
  const setMech = (i: number, patch: Partial<GameDesign['mechanics'][number]>) => set({ mechanics: d.mechanics.map((m, j) => (j === i ? { ...m, ...patch } : m)) })
  return (
    <>
      <section className="card">
        <h2>Çekirdek fikir</h2>
        <div className="grid2">
          <Field label="Tek cümlede oyun" wide>
            <TextInput value={d.pitch} onChange={(v) => set({ pitch: v })} placeholder="Kum fırtınalarında yük taşıyan bir kuryenin hayatta kalma yolculuğu" />
          </Field>
          <Field label="Oyuncu fantezisi" wide help="Oynarken ne hissettiriyor?">
            <TextArea value={d.fantasy} onChange={(v) => set({ fantasy: v })} />
          </Field>
          <Field label="Hedef kitle / platform" wide>
            <TextInput value={d.audience} onChange={(v) => set({ audience: v })} />
          </Field>
          <Field label="Tasarım sütunları (her satıra bir)" wide help="Her özellik bu kurallardan en az birine hizmet etmeli">
            <TextArea rows={5} value={d.pillars.join('\n')} onChange={(v) => set({ pillars: lines(v) })} />
          </Field>
        </div>
      </section>
      <section className="card">
        <div className="row between">
          <h2>Mekanikler</h2>
          <button className="btn ghost" onClick={() => set({ mechanics: [...d.mechanics, { name: '', description: '' }] })}>
            + Mekanik
          </button>
        </div>
        {d.mechanics.length === 0 && <p className="muted">Henüz mekanik yok.</p>}
        {d.mechanics.map((m, i) => (
          <div key={i} className="design-row">
            <input className="input" style={{ width: 200 }} value={m.name} placeholder="Ad" onChange={(e) => setMech(i, { name: e.target.value })} />
            <input className="input" style={{ flex: 1 }} value={m.description} placeholder="Nasıl çalışır" onChange={(e) => setMech(i, { description: e.target.value })} />
            <button className="btn ghost" title="Sil" onClick={() => set({ mechanics: d.mechanics.filter((_, j) => j !== i) })}>
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
  const t = NODE_TYPES.find((x) => x.value === data.type) ?? NODE_TYPES[0]
  return (
    <div className={`loop-node ${selected ? 'sel' : ''}`} style={{ borderColor: t.color }}>
      <Handle type="target" position={Position.Top} />
      <span className="loop-type" style={{ color: t.color }}>
        {t.label}
      </span>
      <b>{data.label || '—'}</b>
      {data.note && <span className="loop-note">{data.note}</span>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
const nodeTypes = { loop: LoopNode }

function LoopsTab({ d, set }: { d: GameDesign; set: SetFn }) {
  const [sel, setSel] = useState<string>(d.loops[0]?.id ?? '')
  const loop = d.loops.find((l) => l.id === sel) ?? d.loops[0]
  const setLoop = (patch: Partial<DesignGraph>) => loop && set({ loops: d.loops.map((l) => (l.id === loop.id ? { ...l, ...patch } : l)) })
  const add = (scope: DesignGraph['scope']) => {
    const base = circleLayout(
      ['Eylem', 'Zorluk', 'Ödül', 'İlerleme'].map((label, i) => ({ id: newId('n'), label, type: (['action', 'challenge', 'reward', 'progress'] as const)[i], note: '', x: 0, y: 0 }))
    )
    const edges = base.map((n, i) => ({ id: newId('e'), from: n.id, to: base[(i + 1) % base.length].id, label: '' }))
    const g: DesignGraph = { id: newId('loop'), name: SCOPES.find((s) => s.value === scope)!.label, scope, description: '', nodes: base, edges }
    set({ loops: [...d.loops, g] })
    setSel(g.id)
  }
  return (
    <div className="loops">
      <aside className="card loop-list">
        <h2>Döngüler</h2>
        {d.loops.map((l) => (
          <button key={l.id} className={`loop-item ${loop?.id === l.id ? 'on' : ''}`} onClick={() => setSel(l.id)}>
            <b>{l.name || 'Adsız'}</b>
            <span className="muted small">{SCOPES.find((s) => s.value === l.scope)?.label}</span>
          </button>
        ))}
        <div style={{ marginTop: 10 }}>
          <Select
            value=""
            onChange={(v) => v && add(v as DesignGraph['scope'])}
            options={[{ value: '', label: '+ Yeni döngü…' }, ...SCOPES.map((s) => ({ value: s.value, label: `${s.label} (${s.hint})` }))]}
          />
        </div>
      </aside>
      {loop ? (
        <ReactFlowProvider key={loop.id}>
          <LoopEditor loop={loop} setLoop={setLoop} onDelete={() => set({ loops: d.loops.filter((l) => l.id !== loop.id) })} />
        </ReactFlowProvider>
      ) : (
        <section className="card" style={{ flex: 1 }}>
          <p className="muted">Henüz döngü yok. Yukarıdan yapay zekâya oluşturtun ya da soldan yeni bir döngü ekleyin.</p>
        </section>
      )}
    </div>
  )
}

function LoopEditor({ loop, setLoop, onDelete }: { loop: DesignGraph; setLoop: (p: Partial<DesignGraph>) => void; onDelete: () => void }) {
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
    const n = { id: newId('n'), label: 'Yeni adım', type: 'action' as DesignNodeType, note: '', x: 40, y: 40 }
    setLoop({ nodes: [...loop.nodes, n] })
    setSelNode(n.id)
  }
  return (
    <div className="loop-editor">
      <section className="card loop-head">
        <div className="grid2">
          <Field label="Ad">
            <TextInput value={loop.name} onChange={(v) => setLoop({ name: v })} />
          </Field>
          <Field label="Kapsam">
            <Select value={loop.scope} onChange={(v) => setLoop({ scope: v as DesignGraph['scope'] })} options={SCOPES.map((s) => ({ value: s.value, label: `${s.label} (${s.hint})` }))} />
          </Field>
          <Field label="Neden eğlenceli / neyi besliyor" wide>
            <TextArea rows={2} value={loop.description} onChange={(v) => setLoop({ description: v })} />
          </Field>
        </div>
      </section>
      <div className="loop-canvas">
        <ReactFlow
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
            + Adım
          </button>
          <button className="btn ghost" onClick={() => setLoop({ nodes: circleLayout(loop.nodes) })} title="Düğümleri çembere diz">
            ◯ Diz
          </button>
          <button className="btn ghost danger" onClick={() => window.confirm(`“${loop.name}” silinsin mi?`) && onDelete()}>
            Döngüyü sil
          </button>
        </div>
      </div>
      <section className="card loop-inspector">
        {node ? (
          <div className="grid2">
            <Field label="Adım">
              <TextInput value={node.label} onChange={(v) => setNode({ label: v })} />
            </Field>
            <Field label="Tür">
              <Select value={node.type} onChange={(v) => setNode({ type: v as DesignNodeType })} options={NODE_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
            </Field>
            <Field label="Ayrıntı (kurallar, sayılar, his)" wide>
              <TextArea rows={2} value={node.note} onChange={(v) => setNode({ note: v })} />
            </Field>
          </div>
        ) : edge ? (
          <Field label="Geçiş koşulu" help="Ör. “görev tamamlanınca”, “yakıt bitince”">
            <TextInput value={edge.label} onChange={(v) => setLoop({ edges: loop.edges.map((e) => (e.id === edge.id ? { ...e, label: v } : e)) })} />
          </Field>
        ) : (
          <p className="muted small">Bir adıma ya da oka tıklayın. Adımları bağlamak için alt noktadan sürükleyin; silmek için Delete.</p>
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
  const st = d.story
  const setStory = (patch: Partial<GameDesign['story']>) => set({ story: { ...st, ...patch } })
  const setAct = (i: number, patch: Partial<GameDesign['story']['acts'][number]>) => setStory({ acts: st.acts.map((a, j) => (j === i ? { ...a, ...patch } : a)) })
  const setChr = (i: number, patch: Partial<GameDesign['story']['characters'][number]>) => setStory({ characters: st.characters.map((c, j) => (j === i ? { ...c, ...patch } : c)) })
  return (
    <>
      <section className="card">
        <h2>Öncül</h2>
        <div className="grid2">
          <Field label="Hikâyenin özü" wide>
            <TextArea rows={4} value={st.premise} onChange={(v) => setStory({ premise: v })} />
          </Field>
          <Field label="Temalar (virgülle)" wide>
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
          <h2>Perdeler ve olay örgüsü</h2>
          <button className="btn ghost" onClick={() => setStory({ acts: [...st.acts, { id: newId('act'), title: `${st.acts.length + 1}. Perde`, summary: '', beats: [] }] })}>
            + Perde
          </button>
        </div>
        {st.acts.map((a, i) => (
          <div key={a.id} className="design-block">
            <div className="design-row">
              <input className="input" style={{ width: 220, fontWeight: 600 }} value={a.title} onChange={(e) => setAct(i, { title: e.target.value })} />
              <input className="input" style={{ flex: 1 }} value={a.summary} placeholder="Özet" onChange={(e) => setAct(i, { summary: e.target.value })} />
              <button className="btn ghost" title="Sil" onClick={() => setStory({ acts: st.acts.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
            <TextArea rows={Math.max(3, a.beats.length + 1)} value={a.beats.join('\n')} onChange={(v) => setAct(i, { beats: lines(v) })} placeholder="Olaylar, sırayla (her satıra bir)" />
          </div>
        ))}
      </section>
      <section className="card">
        <div className="row between">
          <h2>Karakterler</h2>
          <button className="btn ghost" onClick={() => setStory({ characters: [...st.characters, { id: newId('chr'), name: '', role: '', description: '', arc: '' }] })}>
            + Karakter
          </button>
        </div>
        {st.characters.map((c, i) => (
          <div key={c.id} className="design-block">
            <div className="design-row">
              <input className="input" style={{ width: 180, fontWeight: 600 }} value={c.name} placeholder="Ad" onChange={(e) => setChr(i, { name: e.target.value })} />
              <input className="input" style={{ width: 180 }} value={c.role} placeholder="Rol" onChange={(e) => setChr(i, { role: e.target.value })} />
              <input className="input" style={{ flex: 1 }} value={c.description} placeholder="Tanım" onChange={(e) => setChr(i, { description: e.target.value })} />
              <button className="btn ghost" title="Sil" onClick={() => setStory({ characters: st.characters.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
            <input className="input" value={c.arc} placeholder="Gelişim (başta → sonda)" onChange={(e) => setChr(i, { arc: e.target.value })} />
          </div>
        ))}
      </section>
    </>
  )
}

// ---------------------------------------------------------------------------
// Arayüz ekranları

function ScreensTab({ d, set }: { d: GameDesign; set: SetFn }) {
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
    const n: UiScreen = { id: newId('scr'), name: 'Yeni ekran', purpose: '', when: '', layer: 'menu', widgets: [], next: [] }
    set({ screens: [...d.screens, n] })
    setSel(n.id)
  }
  return (
    <div className="screens">
      <section className="card screen-flow">
        <div className="row between">
          <h2>Ekran akışı</h2>
          <button className="btn ghost" onClick={add}>
            + Ekran
          </button>
        </div>
        <div className="screen-canvas">
          <ReactFlowProvider>
            <ReactFlow nodes={nodes} edges={edges} onNodeClick={(_, n) => setSel(n.id)} fitView colorMode="dark" nodesDraggable={false} nodesConnectable={false}>
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
              onClick={() => window.confirm(`“${s.name}” silinsin mi?`) && set({ screens: d.screens.filter((x) => x.id !== s.id).map((x) => ({ ...x, next: x.next.filter((n) => n !== s.id) })) })}
            >
              Sil
            </button>
          </div>
          <div className="grid2">
            <Field label="Ad">
              <TextInput value={s.name} onChange={(v) => setScreen({ name: v })} />
            </Field>
            <Field label="Katman">
              <Select
                value={s.layer}
                onChange={(v) => setScreen({ layer: v as UiScreen['layer'] })}
                options={[
                  { value: 'hud', label: 'HUD (oyunun üstünde)' },
                  { value: 'menu', label: 'Menü (tam ekran)' },
                  { value: 'popup', label: 'Açılır pencere' }
                ]}
              />
            </Field>
            <Field label="Amaç" wide>
              <TextInput value={s.purpose} onChange={(v) => setScreen({ purpose: v })} />
            </Field>
            <Field label="Ne zaman görünür" wide>
              <TextInput value={s.when} onChange={(v) => setScreen({ when: v })} placeholder="Ör. Esc ile, sürüş sırasında, görev bitince" />
            </Field>
          </div>
          <div className="row between" style={{ marginTop: 10 }}>
            <h3 style={{ margin: 0 }}>Öğeler</h3>
            <button className="btn ghost" onClick={() => setScreen({ widgets: [...s.widgets, { type: 'text', label: '', binding: '' }] })}>
              + Öğe
            </button>
          </div>
          {s.widgets.map((w, i) => (
            <div key={i} className="design-row">
              <div style={{ width: 120 }}>
                <Select value={w.type} onChange={(v) => setScreen({ widgets: s.widgets.map((x, j) => (j === i ? { ...x, type: v as UiWidgetType } : x)) })} options={WIDGETS} />
              </div>
              <input
                className="input"
                style={{ flex: 1 }}
                value={w.label}
                placeholder="Etiket"
                onChange={(e) => setScreen({ widgets: s.widgets.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
              />
              <input
                className="input"
                style={{ width: 220 }}
                value={w.binding}
                placeholder="Veri (ör. Player.Health)"
                onChange={(e) => setScreen({ widgets: s.widgets.map((x, j) => (j === i ? { ...x, binding: e.target.value } : x)) })}
              />
              <button className="btn ghost" title="Sil" onClick={() => setScreen({ widgets: s.widgets.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
          ))}
          <h3>Geçişler</h3>
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
          <p className="muted">Bir ekran seçin ya da yapay zekâya arayüzü oluşturtun.</p>
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Unreal

function UnrealTab({ d, toast }: { d: GameDesign; toast: (m: string, kind?: 'ok' | 'error') => void }) {
  const { project } = useStore()
  const [status, setStatus] = useState<{ remote: { projectName: string; engineVersion: string }[]; mcp: boolean; python: string } | null>(null)
  const check = async () => {
    try {
      setStatus(await window.forge.ueStatus())
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  const counts = `${d.loops.length} döngü · ${d.story.acts.length} perde · ${d.story.characters.length} karakter · ${d.screens.length} ekran`
  return (
    <>
      <section className="card">
        <h2>Bağlantı</h2>
        <div className="row" style={{ gap: 10 }}>
          <AsyncButton className="primary" onClick={check}>
            Unreal’ı kontrol et
          </AsyncButton>
          {status && (
            <span className="muted">
              {status.remote.length ? `Remote Execution: ${status.remote.map((n) => `${n.projectName} (UE ${n.engineVersion})`).join(', ')} · ` : ''}
              {status.mcp ? `MCP bağlı${status.python ? ` · Python: ${status.python}` : ''}` : 'MCP yok'}
              {!status.remote.length && !status.mcp && ' — Unreal Editor açık değil'}
            </span>
          )}
        </div>
      </section>
      <section className="card">
        <h2>Unreal’daki yapay zekâya öğret</h2>
        <p className="muted">
          Oyunun tasarımı ve AssetForge’un asset kuralları (klasörler, adlandırma, araç kurulumu, ezilme hedefleri, optimizasyon) Unreal’a Agent Skill olarak yazılır. Unreal MCP’ye bağlanan her yapay
          zekâ oyuna bir şey eklerken, UI kurarken ya da içe aktarılan asset’leri optimize ederken bunları kullanır. Tasarım değişince yeniden gönderin.
        </p>
        <AsyncButton
          className="primary"
          onClick={async () => {
            try {
              const done = await window.forge.design.teachUe(project!)
              toast(`Unreal’a öğretildi: ${done.join(' · ')}`, 'ok')
            } catch (e) {
              toast((e as Error).message, 'error')
            }
          }}
        >
          Tasarımı ve kuralları Unreal’a gönder
        </AsyncButton>
      </section>
      <section className="card">
        <h2>Tasarım dokümanı</h2>
        <p className="muted">{counts}. Tüm tasarım tek bir Markdown GDD’ye yazılır (döngüler mermaid akış şeması olarak).</p>
        <AsyncButton
          onClick={async () => {
            const f = await window.forge.design.exportMd(project!)
            toast(`GDD yazıldı: ${f}`, 'ok')
            await window.forge.openPath(f)
          }}
        >
          GDD’yi dışa aktar ve aç
        </AsyncButton>
      </section>
    </>
  )
}
