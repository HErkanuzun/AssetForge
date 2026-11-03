// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AnimSegment, AssetSpec, KimodoStatus } from '../../../shared/types'
import { useNav } from '../App'
import SystemsView from '../components/AnimSystems'
import BvhViewer from '../components/BvhViewer'
import { Icon } from '../components/icons'
import { AssetThumb, hashSeed, jobProgress } from '../components/Thumb'
import { Select, Toggle } from '../components/ui'
import { forgeUrl, useStore } from '../store'

const PIPELINE = 'tpl_anim_kimodo'

interface Draft {
  id?: string
  name: string
  idea: string
  segments: AnimSegment[]
  loop: boolean
  rootMotion: string
}
const EMPTY: Draft = {
  name: '',
  idea: '',
  segments: [],
  loop: false,
  rootMotion: 'root'
}

function draftFrom(a: AssetSpec): Draft {
  const texts = (a.extra['Kimodo'] ?? '').split(/\r?\n/).filter(Boolean)
  const secs = (a.extra['Süre'] ?? '')
    .split(/[\s,;]+/)
    .map(Number)
    .filter((x) => x > 0)
  return {
    id: a.id,
    name: a.name,
    idea: a.description.split('\n')[0] ?? '',
    segments: texts.map((t, i) => ({
      text: t,
      seconds: secs[Math.min(i, secs.length - 1)] || 4
    })),
    loop: a.extra['Döngü'] === 'evet',
    rootMotion: a.extra['RootMotion'] || (a.extra['Döngü'] === 'evet' ? 'inplace' : 'root')
  }
}

function KimodoPanel() {
  const { settings, toast } = useStore()
  const nav = useNav()
  const [st, setSt] = useState<KimodoStatus | null>(null)
  const [busyStep, setBusyStep] = useState('')
  const [lines, setLines] = useState<string[]>([])

  const refresh = useCallback(
    () =>
      window.forge.kimodo.status().then(setSt, (e: Error) =>
        setSt({
          backend: 'native',
          steps: [],
          running: false,
          healthy: false,
          error: e.message
        })
      ),
    []
  )
  useEffect(() => {
    refresh()
    const t = window.setInterval(refresh, 8000)
    const off = window.forge.kimodo.onLog((l) => setLines((x) => [...x.slice(-300), l]))
    return () => {
      window.clearInterval(t)
      off()
    }
  }, [refresh])

  const step = async (id: string) => {
    setBusyStep(id)
    setLines((x) => [...x, `▶ ${id}`])
    try {
      await window.forge.kimodo.step(id)
      toast(`Kimodo: ${id} tamam`, 'ok')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusyStep('')
      refresh()
    }
  }

  const led = st?.healthy ? 'on' : st?.running ? 'wait' : ''
  const next = st?.steps.find((s) => !s.done)
  return (
    <section className="panel">
      <div className="panel-head">
        <Icon name="cube" size={16} />
        <h3>NVIDIA Kimodo</h3>
        <span className="spacer" />
        <span className="chip">{st?.backend === 'wsl' ? 'WSL2 + Docker' : 'Yerel Windows'}</span>
        <button className="btn ghost" style={{ height: 28, padding: '0 6px' }} onClick={refresh}>
          <Icon name="refresh" size={14} />
        </button>
      </div>
      <div className="panel-body">
        <div className="svc">
          <span className={`led ${led}`} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{st?.healthy ? 'Servis hazır' : st?.running ? 'Servis açılıyor…' : 'Servis kapalı'}</b>
            <div className="muted small ellipsis">
              {st?.healthy ? `${st.model ?? 'Kimodo'} · ${st.device ?? ''}${st.busy ? ' · üretiyor' : ''}` : (st?.error ?? 'Metinden hareket üretimi (yerel GPU)')}
            </div>
          </div>
          {st?.healthy || st?.running ? (
            <button className="btn" disabled={!!busyStep} onClick={() => step('stop')}>
              Durdur
            </button>
          ) : (
            <button className="btn primary" disabled={!!busyStep || (st?.steps.some((s) => s.id !== 'start' && !s.done) ?? true)} onClick={() => step('start')}>
              <Icon name="play" size={13} /> Başlat
            </button>
          )}
        </div>
        <div className="steps">
          {st?.steps.map((s, i) => (
            <div key={s.id} className={`step ${s.done ? 'done' : ''}`}>
              <span className="dot">{s.done ? <Icon name="check" size={11} strokeWidth={3} /> : i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>{s.label}</div>
                {s.hint && <div className="dim small">{s.hint}</div>}
              </div>
              {s.id === 'token' && !settings?.hasKeys.huggingface ? (
                <button className="btn" onClick={() => nav.go('settings')}>
                  Anahtar
                </button>
              ) : (
                <button className={`btn ${next?.id === s.id ? 'primary' : ''}`} disabled={!!busyStep} onClick={() => step(s.id)} style={{ height: 28 }}>
                  {busyStep === s.id ? <span className="spinner" /> : s.done ? 'Tekrar' : 'Kur'}
                </button>
              )}
            </div>
          ))}
        </div>
        {st?.backend === 'wsl' && st.virtualization === false && (
          <p className="small" style={{ color: 'var(--warn)', marginTop: 10 }}>
            BIOS’ta sanallaştırma (SVM / VT-x) kapalı. WSL yolu için açılmalı — ya da Ayarlar’dan “Yerel Windows” arka ucunu seç.
          </p>
        )}
        <div className="console">{lines.length ? lines.join('\n') : 'Kurulum çıktısı burada görünecek.'}</div>
        <button className="btn ghost" style={{ marginTop: 6 }} onClick={async () => setLines((await window.forge.kimodo.logs()).split(/\r?\n/).slice(-200))}>
          <Icon name="terminal" size={14} /> Servis günlüğü
        </button>
      </div>
    </section>
  )
}

export default function AnimPage() {
  const { project, jobs, update, toast, startRun } = useStore()
  const nav = useNav()
  const p = project!
  const characters = useMemo(() => p.assets.filter((a) => a.kind === 'character'), [p.assets])
  const [charId, setCharId] = useState(characters[0]?.id ?? '')
  const char = characters.find((c) => c.id === charId) ?? characters[0]
  const clips = useMemo(() => p.assets.filter((a) => a.kind === 'animation' && a.parentId === char?.id), [p.assets, char?.id])
  const [d, setD] = useState<Draft>(EMPTY)
  const [suggesting, setSuggesting] = useState(false)
  const [mode, setModeState] = useState<'clips' | 'systems'>(() => {
    try {
      return localStorage.getItem('forge.animMode') === 'clips' ? 'clips' : 'systems'
    } catch {
      return 'systems'
    }
  })
  const setMode = (m: 'clips' | 'systems') => {
    setModeState(m)
    try {
      localStorage.setItem('forge.animMode', m)
    } catch {
      /* yok say */
    }
  }

  useEffect(() => setD(EMPTY), [char?.id])

  const jobFor = (id: string) => jobs.filter((j) => j.assetId === id).sort((a, b) => b.createdAt - a.createdAt)[0]
  const bvhFor = (id: string) => {
    for (const j of jobs.filter((x) => x.assetId === id && x.status === 'done').sort((a, b) => b.createdAt - a.createdAt))
      for (const n of Object.values(j.nodes)) for (const o of Object.values(n.outputs ?? {})) if (o.kind === 'animation') return o
    return undefined
  }
  const art = d.id ? bvhFor(d.id) : clips.map((c) => bvhFor(c.id)).find(Boolean)
  const curJob = d.id ? jobFor(d.id) : undefined
  const total = d.segments.reduce((s, x) => s + x.seconds, 0)

  const suggest = async () => {
    if (!d.idea.trim() || !char) return
    setSuggesting(true)
    try {
      const r = await window.forge.kimodo.suggest(d.idea, `${char.name}: ${char.description}`)
      setD((cur) => ({
        ...cur,
        segments: r.segments,
        loop: r.loop,
        name: cur.name || r.name,
        rootMotion: r.loop ? 'inplace' : cur.rootMotion
      }))
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setSuggesting(false)
    }
  }

  const produce = async () => {
    if (!char) return
    const segs = d.segments.length ? d.segments : d.idea.trim() ? [{ text: d.idea.trim(), seconds: 4 }] : []
    if (!segs.length) return toast('Önce ne yapacağını yaz', 'error')
    const used = new Set(p.assets.map((a) => a.id))
    let id = d.id
    if (!id) {
      let n = 1
      while (used.has(`ANM${String(n).padStart(3, '0')}`)) n++
      id = `ANM${String(n).padStart(3, '0')}`
    }
    const asset: AssetSpec = {
      ...(p.assets.find((a) => a.id === id) ?? {
        id,
        kind: 'animation',
        category: char.category,
        subcategory: 'animasyon',
        size: '',
        materials: '',
        variants: '',
        triBudget: 0,
        budgetNote: '',
        priority: 'P1',
        source: 'Animasyon Stüdyosu'
      }),
      name: d.name.trim() || `${char.name} ${segs[0].text.split(' ').slice(0, 3).join(' ')}`,
      description: d.idea || segs.map((s) => s.text).join(' → '),
      status: 'Sırada',
      parentId: char.id,
      extra: {
        Kimodo: segs.map((s) => s.text).join('\n'),
        Süre: segs.map((s) => s.seconds).join(','),
        Döngü: d.loop ? 'evet' : 'hayır',
        RootMotion: d.rootMotion
      }
    } as AssetSpec
    update((pr) => ({
      ...pr,
      assets: pr.assets.some((a) => a.id === id) ? pr.assets.map((a) => (a.id === id ? asset : a)) : [...pr.assets, asset]
    }))
    setD({ ...d, id, name: asset.name, segments: segs })
    const charBusy = jobs.some((j) => j.assetId === char.id && (j.status === 'running' || j.status === 'queued'))
    try {
      await startRun(PIPELINE, [id], charBusy ? char.id : undefined)
      toast(charBusy ? 'Karakter üretimi bitince animasyon başlayacak' : 'Kimodo üretimi başladı', 'ok')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const setSeg = (i: number, patch: Partial<AnimSegment>) =>
    setD({
      ...d,
      segments: d.segments.map((s, j) => (j === i ? { ...s, ...patch } : s))
    })

  if (!characters.length)
    return (
      <div className="stage-empty" style={{ position: 'relative', flex: 1 }}>
        <div>
          <h2>Henüz karakter yok</h2>
          <p className="muted">Kimodo insan iskeletiyle (SOMA → Manny) çalışır. Önce Atölye’de bir karakter üret.</p>
          <button className="btn primary" onClick={() => nav.go('home')}>
            <Icon name="spark" size={15} /> Karakter üret
          </button>
        </div>
      </div>
    )

  const tabs = (
    <div className="anim-tabs">
      <div className="seg">
        <button className={mode === 'systems' ? 'on' : ''} onClick={() => setMode('systems')}>
          <Icon name="grid" size={13} /> Sistemler <span className="n">{(p.animSystems ?? []).length}</span>
        </button>
        <button className={mode === 'clips' ? 'on' : ''} onClick={() => setMode('clips')}>
          <Icon name="anim" size={13} /> Tek klipler
        </button>
      </div>
      <span className="dim small">{mode === 'systems' ? 'Blend Space, Montage, Aim Offset, durum makinesi, Motion Matching — senkron klip setleri' : 'Serbest tarifle tek animasyon üret'}</span>
    </div>
  )

  if (mode === 'systems')
    return (
      <div className="anim-wrap">
        {tabs}
        <SystemsView characters={characters} charId={char?.id ?? ''} setCharId={setCharId} />
      </div>
    )

  return (
    <div className="anim-wrap">
      {tabs}
      <div className="anim">
        <section className="panel">
          <div className="panel-head">
            <Icon name="anim" size={16} />
            <h3>Karakterler</h3>
          </div>
          <div className="panel-body">
            {characters.map((c) => (
              <div key={c.id} className={`char-item ${c.id === char?.id ? 'on' : ''}`} onClick={() => setCharId(c.id)}>
                <div className="av">
                  <AssetThumb id={c.id} kind="character" seed={hashSeed(c.id)} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <b className="ellipsis" style={{ display: 'block' }}>
                    {c.name}
                  </b>
                  <span className="muted small">
                    {p.assets.filter((a) => a.kind === 'animation' && a.parentId === c.id).length} klip · {c.status || 'bekliyor'}
                  </span>
                </div>
              </div>
            ))}
            <div className="section-title" style={{ margin: '18px 4px 8px', fontSize: 12.5 }}>
              Klipler
              <span className="spacer" />
              <button className="btn ghost" style={{ height: 26, padding: '0 6px' }} onClick={() => setD(EMPTY)} title="Yeni klip">
                <Icon name="plus" size={14} />
              </button>
            </div>
            {clips.map((c) => {
              const j = jobFor(c.id)
              return (
                <div key={c.id} className={`clip ${d.id === c.id ? 'on' : ''}`} onClick={() => setD(draftFrom(c))}>
                  <b className="ellipsis" style={{ display: 'block', fontSize: 12.5 }}>
                    {c.name}
                  </b>
                  <div className="row between small muted">
                    <span>
                      {(c.extra['Süre'] ?? '')
                        .split(',')
                        .filter(Boolean)
                        .reduce((s, x) => s + Number(x), 0) || '?'}{' '}
                      sn
                    </span>
                    <span>
                      {j
                        ? {
                            queued: 'sırada',
                            running: `%${jobProgress(j)}`,
                            done: 'hazır',
                            failed: 'hata',
                            canceled: 'iptal'
                          }[j.status]
                        : 'üretilmedi'}
                    </span>
                  </div>
                </div>
              )
            })}
            {!clips.length && (
              <p className="dim small" style={{ padding: '0 4px' }}>
                Bu karakterin henüz klibi yok.
              </p>
            )}
          </div>
        </section>

        <section className="panel">
          {art ? (
            <BvhViewer key={art.bvh} url={forgeUrl(art.bvh)} />
          ) : (
            <div className="stage">
              <div className="stage-empty">
                <div>
                  <Icon name="anim" size={42} style={{ color: '#ff4f9a' }} />
                  <h2 style={{ marginTop: 10 }}>Hareketi tarif et</h2>
                  <p className="muted">“Yorgun adımlarla yürür, durur ve etrafına bakınır” gibi. Üretilen hareket burada 3B oynar.</p>
                </div>
              </div>
            </div>
          )}
          <div style={{ padding: 14, borderTop: '1px solid var(--line)' }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <input className="input" style={{ flex: 1 }} placeholder="Klip adı (ör. Yürüyüş döngüsü)" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
              <div style={{ width: 160 }}>
                <Select
                  value={d.rootMotion}
                  onChange={(v) => setD({ ...d, rootMotion: v })}
                  options={[
                    { value: 'root', label: 'Root motion' },
                    { value: 'inplace', label: 'Yerinde' },
                    { value: 'raw', label: 'Ham' }
                  ]}
                />
              </div>
              <Toggle value={d.loop} onChange={(v) => setD({ ...d, loop: v })} label="Döngü" />
            </div>
            <div className="composer" style={{ maxWidth: 'none' }}>
              <textarea
                rows={2}
                placeholder="Ne yapsın? Türkçe yazabilirsin — Claude Kimodo’nun anlayacağı segmentlere çevirir."
                value={d.idea}
                onChange={(e) => setD({ ...d, idea: e.target.value })}
              />
              <button className="btn" disabled={suggesting || !d.idea.trim()} onClick={suggest} title="Claude ile segmentlere çevir">
                {suggesting ? <span className="spinner" /> : <Icon name="wand" size={15} />} Segmentle
              </button>
            </div>
            {d.segments.length > 0 && (
              <>
                <div className="timeline">
                  {d.segments.map((s, i) => (
                    <div key={i} className="seg-block" style={{ flex: s.seconds }} title={s.text}>
                      <b>
                        {i + 1} · {s.seconds} sn
                      </b>
                      <span className="ellipsis" style={{ display: 'block' }}>
                        {s.text}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="col" style={{ gap: 6 }}>
                  {d.segments.map((s, i) => (
                    <div key={i} className="row">
                      <span className="chip pink" style={{ width: 30, justifyContent: 'center' }}>
                        {i + 1}
                      </span>
                      <input className="input" style={{ flex: 1 }} value={s.text} onChange={(e) => setSeg(i, { text: e.target.value })} />
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={10}
                        step={0.5}
                        style={{ width: 70 }}
                        value={s.seconds}
                        onChange={(e) => setSeg(i, { seconds: Number(e.target.value) || 1 })}
                      />
                      <button
                        className="btn ghost"
                        onClick={() =>
                          setD({
                            ...d,
                            segments: d.segments.filter((_, j) => j !== i)
                          })
                        }
                      >
                        <Icon name="x" size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="btn ghost"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() =>
                      setD({
                        ...d,
                        segments: [...d.segments, { text: '', seconds: 3 }]
                      })
                    }
                  >
                    <Icon name="plus" size={13} /> Segment ekle
                  </button>
                </div>
              </>
            )}
            <div className="row" style={{ marginTop: 12 }}>
              <span className="muted small">
                {d.segments.length ? `${d.segments.length} segment · ${total.toFixed(1)} sn` : 'Segment yoksa açıklama tek parça kullanılır'} · {char?.name} iskeletine otomatik retarget
              </span>
              <span className="spacer" />
              {curJob && (curJob.status === 'running' || curJob.status === 'queued') ? (
                <span className="chip accent">
                  <span className="pulse" /> üretiliyor %{jobProgress(curJob)}
                </span>
              ) : (
                <button className="btn primary big" disabled={!d.idea.trim() && !d.segments.length} onClick={produce}>
                  <Icon name="bolt" size={16} /> {d.id ? 'Yeniden üret' : 'Üret'}
                </button>
              )}
            </div>
            {curJob?.status === 'failed' && (
              <p className="small" style={{ color: 'var(--err)', marginTop: 8 }}>
                {curJob.error}
              </p>
            )}
          </div>
        </section>

        <KimodoPanel />
      </div>
    </div>
  )
}
