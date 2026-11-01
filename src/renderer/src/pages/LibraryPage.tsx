import { useMemo, useState } from 'react'
import type { AssetKind } from '../../../shared/types'
import { suggestPipeline } from '../../../shared/templates'
import { useNav } from '../App'
import { Icon } from '../components/icons'
import { KIND_THEME } from '../components/KindArt'
import { AssetThumb, hashSeed } from '../components/Thumb'
import { Select } from '../components/ui'
import { useStore } from '../store'
import AssetsPage from './AssetsPage'

const STATUS_COLOR: Record<string, string> = { Üretildi: 'var(--ok)', Brief: 'var(--accent2)' }

export default function LibraryPage() {
  const { project, jobs, selectedAssets, setSelectedAssets, startRun, toast } = useStore()
  const nav = useNav()
  const [view, setView] = useState<'gallery' | 'table'>('gallery')
  const [kind, setKind] = useState<AssetKind | ''>('')
  const [q, setQ] = useState('')
  const [pipelineId, setPipelineId] = useState('')
  const p = project!

  const counts = useMemo(() => p.assets.reduce<Record<string, number>>((m, a) => ((m[a.kind] = (m[a.kind] ?? 0) + 1), m), {}), [p.assets])
  const runningIds = useMemo(() => new Set(jobs.filter((j) => j.status === 'running' || j.status === 'queued').map((j) => j.assetId)), [jobs])
  const list = useMemo(() => {
    const n = q.toLocaleLowerCase('tr')
    return p.assets.filter((a) => (!kind || a.kind === kind) && (!n || `${a.id} ${a.name} ${a.description} ${a.category}`.toLocaleLowerCase('tr').includes(n)))
  }, [p.assets, kind, q])

  const sel = new Set(selectedAssets)
  const selAssets = p.assets.filter((a) => sel.has(a.id))
  const suggested = selAssets[0] ? suggestPipeline(selAssets[0]) : ''
  const pl = pipelineId || (p.pipelines.some((x) => x.id === suggested) ? suggested : p.pipelines[0]?.id) || ''

  if (view === 'table')
    return (
      <div className="library">
        <div className="lib-head">
          <h1 style={{ margin: 0 }}>Kütüphane</h1>
          <span className="spacer" />
          <div className="seg">
            <button onClick={() => setView('gallery')}>
              <Icon name="grid" size={14} /> Galeri
            </button>
            <button className="on">
              <Icon name="list" size={14} /> Tablo
            </button>
          </div>
        </div>
        <div className="legacy" style={{ margin: '0 -12px 12px 0' }}>
          <AssetsPage goPipeline={() => nav.go('pipeline')} goJobs={() => nav.go('jobs')} />
        </div>
      </div>
    )

  return (
    <div className="library" style={{ position: 'relative' }}>
      <div className="lib-head">
        <h1 style={{ margin: 0 }}>Kütüphane</h1>
        <span className="muted">{p.assets.length} asset</span>
        <span className="spacer" />
        <div className="composer" style={{ padding: '2px 4px 2px 12px', maxWidth: 280, borderRadius: 12 }}>
          <Icon name="search" size={15} style={{ color: 'var(--muted)', alignSelf: 'center' }} />
          <input className="input" style={{ border: 0, background: 'none', boxShadow: 'none', flex: 1 }} placeholder="Ara…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="seg">
          <button className="on">
            <Icon name="grid" size={14} /> Galeri
          </button>
          <button onClick={() => setView('table')}>
            <Icon name="list" size={14} /> Tablo
          </button>
        </div>
      </div>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <div className="seg" style={{ flexWrap: 'wrap' }}>
          <button className={kind === '' ? 'on' : ''} onClick={() => setKind('')}>
            Tümü <span className="n">{p.assets.length}</span>
          </button>
          {(Object.keys(KIND_THEME) as AssetKind[])
            .filter((k) => counts[k])
            .map((k) => (
              <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
                <span className="st-dot" style={{ background: KIND_THEME[k].a }} />
                {KIND_THEME[k].label} <span className="n">{counts[k]}</span>
              </button>
            ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="stage-empty" style={{ position: 'relative', flex: 1 }}>
          <div>
            <h2>Burası henüz boş</h2>
            <p className="muted">Atölye’de bir brief başlat ya da Tablo görünümünden asset listesi (Excel/CSV) içe aktar.</p>
            <button className="btn primary" onClick={() => nav.go('home')}>
              <Icon name="spark" size={15} /> Atölye’ye git
            </button>
          </div>
        </div>
      ) : (
        <div className="gallery">
          {list.map((a) => (
            <div
              key={a.id}
              className={`acard ${sel.has(a.id) ? 'sel' : ''}`}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/x-forge-asset', a.id)}
              onClick={() => setSelectedAssets(sel.has(a.id) ? selectedAssets.filter((x) => x !== a.id) : [...selectedAssets, a.id])}
              title={a.description}
            >
              <div className="thumb">
                <AssetThumb id={a.id} kind={a.kind} seed={hashSeed(a.id)} />
                <span className="st chip" style={{ background: 'rgba(0,0,0,.55)' }}>
                  {runningIds.has(a.id) ? <span className="pulse" /> : <span className="st-dot" style={{ background: STATUS_COLOR[a.status] ?? 'var(--dim)', marginRight: 0 }} />}
                  {runningIds.has(a.id) ? 'üretiliyor' : a.status || 'bekliyor'}
                </span>
                <span className="tick">{sel.has(a.id) && <Icon name="check" size={13} strokeWidth={3} />}</span>
              </div>
              <div className="meta">
                <b>{a.name}</b>
                <span>
                  {KIND_THEME[a.kind]?.label ?? a.kind} · {a.id}
                  {a.parentId ? ' · kit' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selAssets.length > 0 && (
        <div className="selbar">
          <b>{selAssets.length} seçili</b>
          <div style={{ width: 260 }}>
            <Select value={pl} onChange={setPipelineId} options={p.pipelines.map((x) => ({ value: x.id, label: x.name + (x.id === suggested ? ' ★' : '') }))} />
          </div>
          <button
            className="btn primary"
            disabled={!pl}
            onClick={async () => {
              try {
                await startRun(pl, selAssets.map((a) => a.id))
                toast(`${selAssets.length} iş başlatıldı`, 'ok')
                setSelectedAssets([])
              } catch (e) {
                toast((e as Error).message, 'error')
              }
            }}
          >
            <Icon name="bolt" size={15} /> Üret
          </button>
          <button className="btn ghost" onClick={() => setSelectedAssets([])}>
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
