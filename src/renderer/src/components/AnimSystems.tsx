import { useEffect, useMemo, useRef, useState } from 'react'
import type { AnimSystem, AnimSystemClip, AnimSystemClipState, AnimSystemKind, AssetSpec } from '../../../shared/types'
import { ANIM_SYSTEMS, animSystemInfo, productionPhases, sampleFor, stylePrompt } from '../../../shared/animSystems'
import { useStore } from '../store'
import BvhViewer from './BvhViewer'
import { Icon } from './icons'
import { AssetThumb, hashSeed } from './Thumb'
import { Select, Toggle } from './ui'

const KIND_ICON: Record<AnimSystemKind, string> = {
  single: 'anim',
  montage: 'bolt',
  blendspace1d: 'gauge',
  blendspace2d: 'grid',
  statemachine: 'flow',
  aimoffset: 'search',
  motionmatching: 'cube'
}

const STATUS_TR: Record<AnimSystemClipState['status'], string> = {
  none: 'üretilmedi',
  waiting: 'bekliyor',
  queued: 'sırada',
  running: 'üretiliyor',
  done: 'hazır',
  failed: 'hata'
}

// --------------------------------------------------------------------------- galeri

function Gallery({ onPick, busy }: { onPick: (k: AnimSystemKind) => void; busy: boolean }) {
  const [open, setOpen] = useState<AnimSystemKind | null>('motionmatching')
  return (
    <div className="sys-gallery">
      <div className="sys-intro">
        <h2>Animasyon sistemleri</h2>
        <p className="muted">
          Oyunlarda klipler tek başına değil, birbirini tamamlayan <b>sistemler</b> halinde çalışır. Bir sistem seç; AssetForge kliplerini aynı stilde, senkron (aynı ayakla başlayan, uçları birbirine
          kilitli) üretir ve Unreal’da kurar.
        </p>
      </div>
      <div className="sys-cards">
        {ANIM_SYSTEMS.map((s) => (
          <div key={s.kind} className={`sys-card ${open === s.kind ? 'open' : ''}`} onClick={() => setOpen(open === s.kind ? null : s.kind)}>
            <div className="row" style={{ gap: 10 }}>
              <span className="sys-ico">
                <Icon name={KIND_ICON[s.kind]} size={18} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{s.title}</b>
                <div className="dim small">{s.ue}</div>
              </div>
              <span className="chip">{s.clips().length} klip</span>
            </div>
            <p className="small" style={{ margin: '10px 0 0' }}>
              {s.short}
            </p>
            {open === s.kind && (
              <div className="sys-detail" onClick={(e) => e.stopPropagation()}>
                <dl>
                  <dt>Nedir</dt>
                  <dd>{s.what}</dd>
                  <dt>Ne zaman</dt>
                  <dd>{s.when}</dd>
                  <dt>Profesyoneller nasıl yapar</dt>
                  <dd>{s.pro}</dd>
                  <dt>AssetForge ne otomatikleştirir</dt>
                  <dd>{s.auto}</dd>
                  <dt>Sınırlar</dt>
                  <dd className="warn-text">{s.limits}</dd>
                </dl>
                <button className="btn primary" disabled={busy} onClick={() => onPick(s.kind)}>
                  <Icon name="plus" size={14} /> Bu sistemi oluştur
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------- görseller

interface VizProps {
  sys: AnimSystem
  states: Map<string, AnimSystemClipState>
  sel: string
  onSel: (k: string) => void
}

const stCls = (st?: AnimSystemClipState) => `st-${st?.status ?? 'none'}`

function BlendViz({ sys, states, sel, onSel }: VizProps) {
  const ax = sys.axes ?? { x: { name: 'X', min: 0, max: 1, grid: 4 } }
  const two = !!ax.y
  const W = 560
  const H = two ? 300 : 120
  const pad = 36
  const px = (x: number) => pad + ((x - ax.x.min) / (ax.x.max - ax.x.min || 1)) * (W - pad * 2)
  const py = (y: number) => (two && ax.y ? H - pad - ((y - ax.y.min) / (ax.y.max - ax.y.min || 1)) * (H - pad * 2) : H / 2)
  const pts: { c: AnimSystemClip; x: number; y: number; ghost?: boolean }[] = []
  for (const c of sys.clips.filter((x) => x.enabled)) {
    const s = sampleFor(sys, c, states.get(c.key)?.motion?.measured)
    pts.push({ c, x: s.x, y: s.y ?? 0 })
    if (sys.kind === 'blendspace2d' && Math.abs(Math.abs(s.x) - 180) < 0.5) pts.push({ c, x: -s.x, y: s.y ?? 0, ghost: true })
  }
  return (
    <svg className="bs-viz" viewBox={`0 0 ${W} ${H}`}>
      {Array.from({ length: ax.x.grid + 1 }, (_, i) => {
        const x = pad + (i / ax.x.grid) * (W - pad * 2)
        const v = ax.x.min + (i / ax.x.grid) * (ax.x.max - ax.x.min)
        return (
          <g key={'x' + i}>
            <line x1={x} x2={x} y1={two ? pad : H / 2 - 18} y2={two ? H - pad : H / 2 + 18} className="grid" />
            <text x={x} y={H - 10} className="lbl" textAnchor="middle">
              {Math.round(v)}
            </text>
          </g>
        )
      })}
      {two &&
        ax.y &&
        Array.from({ length: ax.y.grid + 1 }, (_, i) => {
          const y = H - pad - (i / ax.y!.grid) * (H - pad * 2)
          const v = ax.y!.min + (i / ax.y!.grid) * (ax.y!.max - ax.y!.min)
          return (
            <g key={'y' + i}>
              <line x1={pad} x2={W - pad} y1={y} y2={y} className="grid" />
              <text x={pad - 6} y={y + 4} className="lbl" textAnchor="end">
                {Math.round(v)}
              </text>
            </g>
          )
        })}
      {!two && <line x1={pad} x2={W - pad} y1={H / 2} y2={H / 2} className="axis" />}
      <text x={W - pad} y={14} className="lbl" textAnchor="end">
        {ax.x.name} →{two && ax.y ? `   ${ax.y.name} ↑` : ''}
      </text>
      {pts.map((p, i) => (
        <g key={i} className={`pt ${stCls(states.get(p.c.key))} ${sel === p.c.key ? 'sel' : ''} ${p.ghost ? 'ghost' : ''}`} onClick={() => onSel(p.c.key)}>
          <circle cx={px(p.x)} cy={py(p.y)} r={sel === p.c.key ? 9 : 7} />
          <text x={px(p.x)} y={py(p.y) - 13} textAnchor="middle" className="pt-lbl">
            {p.c.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

function Tile({ c, st, sel, onSel }: { c: AnimSystemClip; st?: AnimSystemClipState; sel: boolean; onSel: () => void }) {
  const m = st?.motion?.measured
  return (
    <div className={`dc-tile ${stCls(st)} ${sel ? 'sel' : ''} ${c.enabled ? '' : 'off'}`} onClick={onSel} title={c.prompt}>
      <b className="ellipsis">{c.label}</b>
      <span className="dim small">
        {c.loop ? '↻ ' : ''}
        {m
          ? `${m.speed.toFixed(1)} m/sn${Math.abs(m.turn) > 5 ? ` · ${Math.round(m.turn)}°` : ''}`
          : `${c.speedEnd !== undefined && c.speedEnd !== c.speed ? `${c.speed}→${c.speedEnd}` : c.speed} m/sn${c.turn ? ` · ${c.turn}°` : ''}`}
      </span>
      <span className={`dc-st small`}>{st?.status === 'running' ? `%${st.progress}` : STATUS_TR[st?.status ?? 'none']}</span>
    </div>
  )
}

function DanceCard({ sys, states, sel, onSel }: VizProps) {
  const groups = useMemo(() => {
    const m = new Map<string, AnimSystemClip[]>()
    for (const c of sys.clips) m.set(c.group, [...(m.get(c.group) ?? []), c])
    return [...m.entries()]
  }, [sys.clips])
  return (
    <div className="dance">
      {groups.map(([g, cs]) => (
        <div key={g} className="dc-group">
          <div className="dc-head">
            {g} <span className="dim">{cs.filter((c) => c.enabled).length}</span>
          </div>
          <div className="dc-tiles">
            {cs.map((c) => (
              <Tile key={c.key} c={c} st={states.get(c.key)} sel={sel === c.key} onSel={() => onSel(c.key)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function FlowViz({ sys, states, sel, onSel }: VizProps) {
  // from → klip → to zincirleri; bekleme merkezde
  const by = new Map(sys.clips.map((c) => [c.key, c]))
  const order = productionPhases(sys).flat()
  return (
    <div className="flow-viz">
      {order.map((c) => (
        <div key={c.key} className="flow-row">
          {c.from && by.get(c.from) && (
            <>
              <span className="flow-ref" onClick={() => onSel(c.from!)}>
                {by.get(c.from)!.label}
              </span>
              <span className="flow-arrow">→</span>
            </>
          )}
          <Tile c={c} st={states.get(c.key)} sel={sel === c.key} onSel={() => onSel(c.key)} />
          {c.to && by.get(c.to) && (
            <>
              <span className="flow-arrow">→</span>
              <span className="flow-ref" onClick={() => onSel(c.to!)}>
                {by.get(c.to)!.label}
              </span>
            </>
          )}
          {c.loop && <span className="chip cyan">döngü</span>}
        </div>
      ))}
    </div>
  )
}

function AimViz({ sys, states, sel, onSel }: VizProps) {
  const cells = [60, 0, -60].flatMap((pitch) => [-90, 0, 90].map((yaw) => sys.clips.find((c) => c.aim?.yaw === yaw && c.aim?.pitch === pitch)))
  return (
    <div className="aim-grid">
      {cells.map((c, i) => (c ? <Tile key={c.key} c={c} st={states.get(c.key)} sel={sel === c.key} onSel={() => onSel(c.key)} /> : <div key={i} className="dc-tile off" />))}
    </div>
  )
}

// --------------------------------------------------------------------------- klip denetçisi

function Num({ label, value, onChange, step = 0.1, suffix }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; step?: number; suffix?: string }) {
  return (
    <label className="ins-num">
      <span className="dim small">{label}</span>
      <div className="row" style={{ gap: 4 }}>
        <input className="input" type="number" step={step} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
        {suffix && <span className="dim small">{suffix}</span>}
      </div>
    </label>
  )
}

function Inspector({ sys, c, st, onChange, onProduce }: { sys: AnimSystem; c: AnimSystemClip; st?: AnimSystemClipState; onChange: (p: Partial<AnimSystemClip>) => void; onProduce: () => void }) {
  const m = st?.motion
  const others = sys.clips.filter((x) => x.key !== c.key).map((x) => ({ value: x.key, label: x.label }))
  return (
    <div className="ins">
      <div className="row between">
        <input className="input" style={{ flex: 1, fontWeight: 600 }} value={c.label} onChange={(e) => onChange({ label: e.target.value })} />
        <Toggle value={c.enabled} onChange={(v) => onChange({ enabled: v })} label="Etkin" />
      </div>
      <div className="row" style={{ gap: 6, margin: '8px 0', flexWrap: 'wrap' }}>
        <span className="chip">{c.role}</span>
        <span className={`chip ${st?.status === 'done' ? 'ok' : st?.status === 'failed' ? 'pink' : ''}`}>
          {st?.status === 'running' ? `üretiliyor %${st.progress}` : STATUS_TR[st?.status ?? 'none']}
        </span>
        {c.assetId && <span className="chip">{c.assetId}</span>}
      </div>
      <span className="dim small">Kimodo promptu ({'{S}'} = stil öznesi)</span>
      <textarea className="input" rows={3} value={c.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      <div className="dim small ellipsis" style={{ margin: '4px 0 10px' }} title={stylePrompt(c.prompt, sys.style)}>
        → {stylePrompt(c.prompt, sys.style)}
      </div>
      <div className="ins-grid">
        <Num label="Süre" value={c.seconds} onChange={(v) => onChange({ seconds: v ?? 1 })} suffix="sn" />
        <Num label={c.speedEnd !== undefined ? 'Başlangıç hızı' : 'Hız'} value={c.speed} onChange={(v) => onChange({ speed: v ?? 0 })} suffix="m/sn" />
        <Num label="Bitiş hızı" value={c.speedEnd} onChange={(v) => onChange({ speedEnd: v })} suffix="m/sn" />
        <Num label="Hareket yönü" value={c.moveDir} step={15} onChange={(v) => onChange({ moveDir: v ?? 0 })} suffix="°" />
        <Num label="Dönüş" value={c.turn} step={15} onChange={(v) => onChange({ turn: v ?? 0 })} suffix="°" />
        <Num label="Tohum" value={c.seed} step={1} onChange={(v) => onChange({ seed: v })} />
      </div>
      <div className="row" style={{ gap: 8, margin: '10px 0', flexWrap: 'wrap' }}>
        <Toggle value={c.loop} onChange={(v) => onChange({ loop: v })} label="Döngü" />
        <Toggle value={c.constrainPath} onChange={(v) => onChange({ constrainPath: v })} label="Kök yolu kilidi" />
      </div>
      <div className="ins-grid two">
        <label>
          <span className="dim small">Root motion</span>
          <Select
            value={c.rootMotion}
            onChange={(v) => onChange({ rootMotion: v as AnimSystemClip['rootMotion'] })}
            options={[
              { value: 'root', label: 'Root motion' },
              { value: 'inplace', label: 'Yerinde' }
            ]}
          />
        </label>
        <span />
        <label>
          <span className="dim small">Başlangıç pozu ←</span>
          <Select value={c.from ?? ''} onChange={(v) => onChange({ from: v || undefined })} options={[{ value: '', label: '— serbest —' }, ...others]} />
        </label>
        <label>
          <span className="dim small">Bitiş pozu →</span>
          <Select value={c.to ?? ''} onChange={(v) => onChange({ to: v || undefined })} options={[{ value: '', label: '— serbest —' }, ...others]} />
        </label>
      </div>
      {m && (
        <div className="ins-meas">
          <b className="small">Ölçülen</b>
          <div className="small">
            {m.measured.seconds.toFixed(2)} sn · {m.measured.speed.toFixed(2)} m/sn · yön {m.measured.direction}° · dönüş {m.measured.turn}°
          </div>
          {m.loop && (
            <div className="small dim">
              Döngü: {m.loop.start}→{m.loop.end}. kare / {m.loop.sourceFrames} · dikiş farkı {m.loop.cost}
            </div>
          )}
          <div className="small dim">
            Sync marker: L {m.markers.L.map((t) => t.toFixed(2)).join(', ') || '—'} · R {m.markers.R.map((t) => t.toFixed(2)).join(', ') || '—'}
          </div>
        </div>
      )}
      {st?.status === 'failed' && st.error && (
        <p className="small" style={{ color: 'var(--err)' }}>
          {st.error}
        </p>
      )}
      <button className="btn" style={{ marginTop: 10 }} disabled={st?.status === 'running' || st?.status === 'queued'} onClick={onProduce}>
        <Icon name="refresh" size={14} /> Bu klibi {st?.status === 'done' ? 'yeniden ' : ''}üret
      </button>
    </div>
  )
}

// --------------------------------------------------------------------------- ana görünüm

export default function SystemsView({ characters, charId, setCharId }: { characters: AssetSpec[]; charId: string; setCharId: (id: string) => void }) {
  const { project, jobs, toast } = useStore()
  const char = characters.find((c) => c.id === charId) ?? characters[0]
  const systems = useMemo(() => (project?.animSystems ?? []).filter((s) => s.characterId === char?.id), [project?.animSystems, char?.id])
  const [sysId, setSysIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem('forge.animSystem')
    } catch {
      return null
    }
  })
  const setSysId = (id: string | null) => {
    setSysIdState(id)
    try {
      if (id) localStorage.setItem('forge.animSystem', id)
    } catch {
      /* yok say */
    }
  }
  const [gallery, setGallery] = useState(false)
  const [local, setLocal] = useState<AnimSystem | null>(null)
  const [states, setStates] = useState<AnimSystemClipState[]>([])
  const [sel, setSel] = useState('')
  const [planText, setPlanText] = useState('')
  const [busy, setBusy] = useState('')
  const [rationale, setRationale] = useState('')
  const saveT = useRef<number | undefined>(undefined)

  const remote = systems.find((s) => s.id === sysId) ?? (gallery ? undefined : systems[0])
  useEffect(() => {
    if (!remote) return setLocal(null)
    // uzak değişiklik (üretim durumu, AI planı) gelince yerel taslağı güncelle
    setLocal((cur) =>
      cur && cur.id === remote.id && cur.updatedAt > remote.updatedAt
        ? {
            ...cur,
            producing: remote.producing,
            lastBuild: remote.lastBuild,
            clips: cur.clips.map((c) => ({
              ...c,
              assetId: remote.clips.find((r) => r.key === c.key)?.assetId ?? c.assetId
            }))
          }
        : remote
    )
  }, [remote])
  const sys = local
  useEffect(() => {
    if (sys && !sys.clips.some((c) => c.key === sel)) setSel(sys.clips[0]?.key ?? '')
  }, [sys, sel])

  const refreshStates = async (id?: string) => {
    if (!id) return
    try {
      setStates(await window.forge.animsys.states(id))
    } catch {
      /* sistem silinmiş olabilir */
    }
  }
  const jobSig = jobs.map((j) => j.id + j.status).join()
  useEffect(() => {
    refreshStates(sys?.id)
    const t = window.setInterval(() => refreshStates(sys?.id), sys?.producing ? 2500 : 8000)
    return () => window.clearInterval(t)
  }, [sys?.id, sys?.producing, jobSig])

  const stMap = useMemo(() => new Map(states.map((s) => [s.key, s])), [states])

  const edit = (next: AnimSystem) => {
    const n = { ...next, updatedAt: Date.now() }
    setLocal(n)
    window.clearTimeout(saveT.current)
    saveT.current = window.setTimeout(() => window.forge.animsys.save(n).catch((e: Error) => toast(e.message, 'error')), 600)
  }
  const flush = async () => {
    window.clearTimeout(saveT.current)
    if (local) await window.forge.animsys.save(local)
  }
  const editClip = (key: string, patch: Partial<AnimSystemClip>) =>
    sys &&
    edit({
      ...sys,
      clips: sys.clips.map((c) => (c.key === key ? { ...c, ...patch } : c))
    })

  const create = async (kind: AnimSystemKind) => {
    if (!char) return
    setBusy('create')
    try {
      const s = await window.forge.animsys.create(kind, char.id, `${char.name} · ${animSystemInfo(kind).title}`)
      setSysId(s.id)
      setGallery(false)
      setLocal(s)
      toast(`${animSystemInfo(kind).title} oluşturuldu — istersen “AI ile uyarla”, sonra “Hepsini üret”`, 'ok')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy('')
    }
  }

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label)
    try {
      await fn()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy('')
    }
  }

  const plan = () =>
    run('plan', async () => {
      await flush()
      const r = await window.forge.animsys.plan(sys!.id, planText)
      setLocal(r.system)
      setRationale(r.rationale)
      toast(`Plan güncellendi ($${r.usd.toFixed(3)})`, 'ok')
    })
  const produce = (keys?: string[], force?: boolean) =>
    run('produce', async () => {
      await flush()
      const r = await window.forge.animsys.produce(sys!.id, { keys, force })
      toast(r.clips ? `${r.clips} klip, ${r.phases} fazda üretilecek (poz kaynakları önce)` : 'Üretilecek eksik klip yok', r.clips ? 'ok' : 'info')
      refreshStates(sys!.id)
    })
  const build = () =>
    run('build', async () => {
      await flush()
      const b = await window.forge.animsys.build(sys!.id)
      toast(b.ok ? 'Unreal’da kuruldu' : 'Unreal kurulumu tamamlanamadı — ayrıntılar aşağıda', b.ok ? 'ok' : 'error')
    })

  const counts = useMemo(() => {
    const en = sys?.clips.filter((c) => c.enabled) ?? []
    return {
      total: en.length,
      done: en.filter((c) => stMap.get(c.key)?.status === 'done').length
    }
  }, [sys, stMap])
  const selClip = sys?.clips.find((c) => c.key === sel)
  const selSt = stMap.get(sel)
  const info = sys ? animSystemInfo(sys.kind) : null
  const Viz = !sys ? null : sys.kind === 'blendspace1d' || sys.kind === 'blendspace2d' ? BlendViz : sys.kind === 'aimoffset' ? AimViz : sys.kind === 'motionmatching' ? DanceCard : FlowViz

  return (
    <div className="anim">
      <section className="panel">
        <div className="panel-head">
          <Icon name="anim" size={16} />
          <h3>Karakterler</h3>
        </div>
        <div className="panel-body">
          {characters.map((c) => (
            <div key={c.id} className={`char-item ${c.id === char?.id ? 'on' : ''}`} onClick={() => (setCharId(c.id), setSysId(null))}>
              <div className="av">
                <AssetThumb id={c.id} kind="character" seed={hashSeed(c.id)} />
              </div>
              <div style={{ minWidth: 0 }}>
                <b className="ellipsis" style={{ display: 'block' }}>
                  {c.name}
                </b>
                <span className="muted small">{(project?.animSystems ?? []).filter((s) => s.characterId === c.id).length} sistem</span>
              </div>
            </div>
          ))}
          <div className="section-title" style={{ margin: '18px 4px 8px', fontSize: 12.5 }}>
            Sistemler
            <span className="spacer" />
            <button className="btn ghost" style={{ height: 26, padding: '0 6px' }} onClick={() => (setGallery(true), setSysId(null))} title="Yeni sistem">
              <Icon name="plus" size={14} />
            </button>
          </div>
          {systems.map((s) => (
            <div key={s.id} className={`clip ${!gallery && sys?.id === s.id ? 'on' : ''}`} onClick={() => (setGallery(false), setSysId(s.id))}>
              <div className="row" style={{ gap: 6 }}>
                <Icon name={KIND_ICON[s.kind]} size={13} />
                <b className="ellipsis" style={{ fontSize: 12.5, flex: 1 }}>
                  {s.name}
                </b>
                {s.producing && <span className="pulse" />}
              </div>
              <div className="row between small muted">
                <span>{animSystemInfo(s.kind).ue}</span>
                <span>{s.clips.filter((c) => c.enabled).length} klip</span>
              </div>
            </div>
          ))}
          {!systems.length && (
            <button className="btn primary" style={{ width: '100%' }} onClick={() => setGallery(true)}>
              <Icon name="spark" size={14} /> İlk sistemi kur
            </button>
          )}
        </div>
      </section>

      <section className="panel">
        {gallery || !sys ? (
          <div className="panel-body" style={{ paddingTop: 14 }}>
            <Gallery onPick={create} busy={!!busy} />
          </div>
        ) : (
          <>
            <div className="sys-head">
              <span className="sys-ico">
                <Icon name={KIND_ICON[sys.kind]} size={18} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input className="input sys-name" value={sys.name} onChange={(e) => edit({ ...sys, name: e.target.value })} />
                <div className="dim small">
                  {info!.ue} · {counts.done}/{counts.total} klip hazır
                </div>
              </div>
              <div className="sys-progress">
                <div
                  style={{
                    width: `${counts.total ? (counts.done / counts.total) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
            {selSt?.bvhUrl ? (
              <div className="sys-stage">
                <BvhViewer key={selSt.bvhUrl} url={selSt.bvhUrl} />
              </div>
            ) : null}
            <div className="panel-body sys-body">
              <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                <span className="dim small" style={{ whiteSpace: 'nowrap' }}>
                  Stil öznesi
                </span>
                <input className="input" style={{ flex: 1 }} value={sys.style} placeholder="A tired soldier" onChange={(e) => edit({ ...sys, style: e.target.value })} />
              </div>
              {Viz && <Viz sys={sys} states={stMap} sel={sel} onSel={setSel} />}
              <div className="composer" style={{ maxWidth: 'none', marginTop: 12 }}>
                <textarea
                  rows={2}
                  placeholder="Tarif et: “Yaralı asker, sol bacağını kolluyor; koşu yok, yürüyüş yavaş. Kavisleri çıkar, 2 bekleme varyasyonu ekle.”"
                  value={planText}
                  onChange={(e) => setPlanText(e.target.value)}
                />
                <button className="btn" disabled={!!busy} onClick={plan} title="Claude kartı karaktere ve tarife göre uyarlar">
                  {busy === 'plan' ? <span className="spinner" /> : <Icon name="wand" size={15} />} AI ile uyarla
                </button>
              </div>
              {rationale && (
                <p className="small muted" style={{ marginTop: 6 }}>
                  {rationale}
                </p>
              )}
              <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
                {sys.producing ? (
                  <button className="btn" onClick={() => run('stop', () => window.forge.animsys.stop(sys.id))}>
                    <Icon name="x" size={14} /> Üretimi durdur
                  </button>
                ) : (
                  <button className="btn primary big" disabled={!!busy} onClick={() => produce()}>
                    {busy === 'produce' ? <span className="spinner" /> : <Icon name="bolt" size={16} />} {counts.done ? 'Eksikleri üret' : 'Hepsini üret'}
                  </button>
                )}
                <button className="btn big" disabled={!!busy || !counts.done} onClick={build} title="Blend Space / Montage / Motion Matching veritabanını kur">
                  {busy === 'build' ? <span className="spinner" /> : <Icon name="cube" size={16} />} Unreal’da kur
                </button>
                <span className="spacer" />
                <button
                  className="btn ghost"
                  onClick={() => {
                    if (window.confirm(`“${sys.name}” silinsin mi? (Üretilen klip asset’leri Kütüphane’de kalır)`))
                      run('del', async () => (await window.forge.animsys.remove(sys.id, false), setSysId(null)))
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
              <p className="dim small" style={{ marginTop: 8 }}>
                Sıra: önce poz kaynakları (bekleme, döngüler), sonra onlara kilitlenen geçişler. Her klip karakterine retarget edilir; “Unreal’da kur” ölçülen gerçek hız ve ayak basışlarıyla sistemi
                kurar.
              </p>
              {sys.lastBuild && (
                <div className={`build-box ${sys.lastBuild.ok ? 'ok' : 'err'}`}>
                  <b className="small">
                    Unreal kurulumu · {new Date(sys.lastBuild.at).toLocaleString('tr-TR')} · {sys.lastBuild.ok ? 'tamam' : 'sorun var'}
                  </b>
                  {sys.lastBuild.errors.map((e, i) => (
                    <div key={'e' + i} className="small" style={{ color: 'var(--err)' }}>
                      ✕ {e}
                    </div>
                  ))}
                  {sys.lastBuild.notes.map((n, i) => (
                    <div key={i} className="small">
                      {n.startsWith('  ') ? '   ' : '✓ '}
                      {n.trim()}
                    </div>
                  ))}
                  {sys.lastBuild.script && <div className="dim small ellipsis">Betik: {sys.lastBuild.script}</div>}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <Icon name="settings" size={16} />
          <h3>{selClip && !gallery ? 'Klip' : 'Nasıl çalışır'}</h3>
        </div>
        <div className="panel-body">
          {sys && selClip && !gallery ? (
            <Inspector sys={sys} c={selClip} st={selSt} onChange={(p) => editClip(selClip.key, p)} onProduce={() => produce([selClip.key], true)} />
          ) : (
            <div className="small muted how">
              <p>
                <b>1. Sistem seç.</b> Her sistem, oyunlarda o işi yapan klip setini (“dans kartı”) hazır getirir.
              </p>
              <p>
                <b>2. Uyarla.</b> Stil öznesi (“A tired soldier”) tüm kliplere aynı karakteri verir; AI tarifine göre hız, prompt ve klipleri düzenler.
              </p>
              <p>
                <b>3. Üret.</b> Kimodo her klibi hedef hız/yön/dönüşte kök yolu ile üretir; geçişlerin uçları komşu klibin pozuna kilitlenir; döngüler sol ayak basışında kesilip dikişi kapatılır.
              </p>
              <p>
                <b>4. Kur.</b> Unreal’da Blend Space / Montage / Aim Offset / Pose Search veritabanı kurulur, L/R sync marker’ları eklenir.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
