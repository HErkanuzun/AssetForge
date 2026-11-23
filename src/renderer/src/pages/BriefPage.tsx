// SPDX-License-Identifier: AGPL-3.0-only
import { errorMessage } from '../../../shared/i18n/errors'
import { message, renderMessage } from '../../../shared/i18n/message'
import { legacyEvent } from '../../../shared/i18n/events'
import { useLocale } from '../i18n'
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AssetSpec, Brief, BriefOption, KitItem } from '../../../shared/types'
import { suggestPipeline } from '../../../shared/templates'
import { Icon, ForgeMark } from '../components/icons'
import KindArt from '../components/KindArt'
import { AssetThumb, hashSeed } from '../components/Thumb'
import { forgeUrl, useStore } from '../store'

const GROUPS: { id: KitItem['group']; label: string; icon: 'cube' | 'texture' | 'sound' | 'fire' | 'anim' }[] = [
  { id: 'model', label: 'Modeller', icon: 'cube' },
  { id: 'doku', label: 'Dokular', icon: 'texture' },
  { id: 'ses', label: 'Sesler', icon: 'sound' },
  { id: 'vfx', label: 'Efektler', icon: 'fire' },
  { id: 'animasyon', label: 'Animasyonlar', icon: 'anim' }
]
const IMG_EXT = /\.(png|jpe?g|webp|gif|bmp)$/i
const DRAG_TYPE = 'application/x-forge-asset'

interface Pending {
  path: string
  preview?: string
}

/** **kalın** ve satır başı "- " listelerini basitçe biçimlendir */
function rich(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>))
}

function parseOption(o: BriefOption): { label: string; rec: boolean } {
  const rec = /\(Önerilen\)\s*$/i.test(o.label)
  return { label: o.label.replace(/\s*\(Önerilen\)\s*$/i, ''), rec }
}

export default function BriefPage({ id, firstMessage, onBack }: { id: string; firstMessage?: string; onBack: () => void }) {
  const { t, locale } = useLocale()

  const { project, toast, update, saveNow, startRun } = useStore()
  const [brief, setBrief] = useState<Brief | null>(null)
  const [stream, setStream] = useState('')
  const [thinking, setThinking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [images, setImages] = useState<Pending[]>([])
  const [links, setLinks] = useState<string[]>([])
  const [multi, setMulti] = useState<string[]>([])
  const [drawer, setDrawer] = useState(false)
  const [drag, setDrag] = useState(false)
  const [libQ, setLibQ] = useState('')
  const [committing, setCommitting] = useState(false)
  const log = useRef<HTMLDivElement>(null)
  const sentFirst = useRef(false)

  const send = async (input: { text: string; images?: string[]; links?: string[] }) => {
    setBusy(true)
    setStream('')
    try {
      const b = await window.forge.brief.send(id, input)
      setBrief(b)
    } catch (e) {
      toast(message('surface.directorFailed', { detail: errorMessage(e) }), 'error')
      window.forge.brief.get(id).then((b) => b && setBrief(b))
    } finally {
      setBusy(false)
      setThinking(false)
      setStream('')
    }
  }

  useEffect(() => {
    window.forge.brief.get(id).then((b) => {
      if (!b) return toast(message('surface.briefMissing'), 'error')
      setBrief(b)
      if (firstMessage && !sentFirst.current && b.view.length === 0) {
        sentFirst.current = true
        send({ text: firstMessage })
      }
    })
    return window.forge.brief.onEvent((e) => {
      if (e.type === 'brief') {
        if (e.brief.id === id) setBrief(e.brief)
        return
      }
      if (e.briefId !== id) return
      if (e.type === 'delta') setStream((s) => s + e.text)
      else if (e.type === 'thinking') setThinking(e.on)
      else if (e.type === 'error') toast(e.uiMessage ?? e.error, 'error')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [brief?.view.length, stream, thinking, busy])

  useEffect(() => setMulti([]), [brief?.pending?.toolUseId])

  const assetsById = useMemo(() => new Map((project?.assets ?? []).map((a) => [a.id, a])), [project?.assets])

  const submit = (answer?: string) => {
    const t = (answer ?? text).trim()
    if (busy || (!t && !images.length && !links.length)) return
    send({ text: t, images: images.map((i) => i.path), links })
    setText('')
    setImages([])
    setLinks([])
  }

  const addLink = (assetId: string) => setLinks((l) => (l.includes(assetId) ? l : [...l, assetId]))

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const assetId = e.dataTransfer.getData(DRAG_TYPE)
    if (assetId) return addLink(assetId)
    const files = [...e.dataTransfer.files].filter((f) => IMG_EXT.test(f.name))
    if (!files.length) return toast(message('brief.dropOnly'))
    Promise.all(files.map(async (f) => ({ path: await window.forge.dropFile(f), preview: URL.createObjectURL(f) }))).then(
      (list) => setImages((cur) => [...cur, ...list]),
      (err: Error) => toast(message('brief.imageFailed', { detail: errorMessage(err) }), 'error')
    )
  }

  const pickImages = async () => {
    const files = await window.forge.pickFiles([{ name: t('brief.images'), extensions: ['png', 'jpg', 'jpeg', 'webp'] }], true)
    setImages((cur) => [...cur, ...files.map((p) => ({ path: p }))])
  }

  const toggleKit = async (key: string) => {
    if (!brief) return
    const kit = brief.kit.map((k) => (k.key === key ? { ...k, include: !k.include } : k))
    setBrief({ ...brief, kit })
    setBrief(await window.forge.brief.patch(id, { kit }))
  }

  const commit = async () => {
    if (!brief || !project) return
    setCommitting(true)
    try {
      const prev = (brief.committedAssetIds ?? []).map((x) => assetsById.get(x)).filter((a): a is AssetSpec => !!a)
      const rerun = brief.status === 'committed' && prev.length > 0
      const assets = rerun ? prev : await window.forge.brief.toAssets(id)
      if (!assets.length) throw new Error(t('brief.noProduction'))
      const newIds = new Set(assets.map((a) => a.id))
      if (!rerun) update((p) => ({ ...p, assets: [...p.assets.filter((a) => !newIds.has(a.id)), ...assets] }))
      await saveNow()
      const pipelines = new Set(project.pipelines.map((p) => p.id))
      const pick = (a: AssetSpec) => (a.pipelineId && pipelines.has(a.pipelineId) ? a.pipelineId : suggestPipeline(a))
      const now = new Map<string, string[]>()
      let waiting = 0
      for (const a of assets) {
        const pl = pick(a)
        if (!pipelines.has(pl)) continue
        const parent = a.parentId ? (assets.find((x) => x.id === a.parentId) ?? assetsById.get(a.parentId)) : undefined
        // Animasyonlar karakterin iskeletine retarget edilir → karakter bitmeden başlamasın
        if (a.kind === 'animation' && parent && (newIds.has(parent.id) || parent.status !== 'Üretildi')) {
          await startRun(pl, [a.id], parent.id)
          waiting++
        } else now.set(pl, [...(now.get(pl) ?? []), a.id])
      }
      for (const [pl, ids] of now) await startRun(pl, ids)
      setBrief(await window.forge.brief.patch(id, { status: 'committed', committedAssetIds: assets.map((a) => a.id) }))
      toast(message('brief.productionStarted', { count: assets.length, waiting }), 'ok')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setCommitting(false)
    }
  }

  if (!brief || !project) return <div className="stage-empty">{t('app.loading')}</div>

  const spec = brief.spec
  const kind = spec.kind || 'model'
  const pending = brief.pending
  const lastQ = [...brief.view].reverse().find((v) => v.kind === 'question')
  const included = brief.kit.filter((k) => k.include)
  const heroRef = brief.refs[0]
  const resolveColor = (c: string) => {
    if (/^#?[0-9a-f]{6}$/i.test(c.trim())) return c.trim().startsWith('#') ? c.trim() : '#' + c.trim()
    const e = project.bible.palette.find((p) => p.code === c || p.name.toLocaleLowerCase(locale) === c.toLocaleLowerCase(locale))
    return e?.hex || null
  }
  const libList = project.assets.filter((a) => !libQ || `${a.name} ${a.id} ${a.category}`.toLocaleLowerCase(locale).includes(libQ.toLocaleLowerCase(locale)))

  return (
    <div className="brief">
      <section
        className="chat"
        onDragOver={(e) => {
          e.preventDefault()
          if (!drag) setDrag(true)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDrag(false)
        }}
        onDrop={onDrop}
      >
        <div className="chat-head">
          <button className="btn ghost" onClick={onBack} title={t('app.workshop')}>
            <Icon name="back" size={16} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="ellipsis">{spec.name || brief.title}</h2>
            <div className="muted small">{t('brief.questions', { count: brief.view.filter((v) => v.kind === 'question').length })}</div>
          </div>
          {brief.costUsd > 0 && <span className="chip">${brief.costUsd.toFixed(3)}</span>}
          <button className={`btn ${drawer ? 'primary' : ''}`} onClick={() => setDrawer(!drawer)}>
            <Icon name="library" size={15} /> {t('surface.library')}{' '}
          </button>
        </div>

        <div className="chat-log" ref={log}>
          {brief.view.length === 0 && !busy && (
            <div className="stage-empty" style={{ position: 'relative', minHeight: 300 }}>
              <div>
                <ForgeMark size={56} />
                <h2 style={{ marginTop: 14 }}>{t('brief.ideaTitle')}</h2>
                <p className="muted">{t('brief.ideaHelp')}</p>
              </div>
            </div>
          )}
          {brief.view.map((v, i) => {
            if (v.kind === 'event')
              return (
                <div key={i} className="event">
                  {renderMessage(locale, v.uiMessage ?? legacyEvent(v.text))}
                </div>
              )
            if (v.kind === 'assistant')
              return (
                <div key={i} className="msg ai">
                  <div className="avatar">
                    <ForgeMark size={30} />
                  </div>
                  <div className="bubble">{rich(v.text)}</div>
                </div>
              )
            if (v.kind === 'user')
              return (
                <div key={i} className="msg user">
                  <div>
                    {v.text && <div className="bubble">{v.text}</div>}
                    {(v.images?.length || v.links?.length) && (
                      <div className="msg-attach">
                        {v.images?.map((f) => (
                          <img key={f} src={forgeUrl(f)} alt="" />
                        ))}
                        {v.links?.map((l) => {
                          const a = assetsById.get(l)
                          return (
                            <div key={l} className="pending-attach">
                              <div className="pa">
                                <AssetThumb id={l} kind={a?.kind ?? 'model'} />
                                {a?.name ?? l}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            const q = v.question
            const live = pending?.toolUseId === q.toolUseId && !busy
            return (
              <div key={i} className={`q-card ${v.answer ? 'answered' : ''}`}>
                <div className="q-title">{q.question}</div>
                <div className="opts">
                  {q.options.map((o) => {
                    const { label, rec } = parseOption(o)
                    const on = q.multi ? multi.includes(label) : v.answer === label || (v.answer ?? '').split(', ').includes(label)
                    return (
                      <button
                        key={o.label}
                        className={`opt ${rec ? 'rec' : ''} ${on ? 'on' : ''}`}
                        disabled={!live}
                        onClick={() => (q.multi ? setMulti((m) => (m.includes(label) ? m.filter((x) => x !== label) : [...m, label])) : submit(label))}
                      >
                        <b>{label}</b>
                        {o.description && <span>{o.description}</span>}
                      </button>
                    )
                  })}
                </div>
                {live && q.multi && (
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="btn primary" disabled={!multi.length} onClick={() => submit(multi.join(', '))}>
                      <Icon name="check" size={15} /> {t('brief.sendChoices', { count: multi.length })}
                    </button>
                    <span className="muted small">{t('brief.ownAnswer')}</span>
                  </div>
                )}
                {v.answer && <div className="q-answer">→ {v.answer}</div>}
              </div>
            )
          })}
          {busy && stream && (
            <div className="msg ai">
              <div className="avatar">
                <ForgeMark size={30} />
              </div>
              <div className="bubble">{rich(stream)}</div>
            </div>
          )}
          {busy && (thinking || !stream) && (
            <div className="typing">
              <i />
              <i />
              <i /> {thinking ? t('brief.thinking') : t('brief.writing')}
            </div>
          )}
        </div>

        <div className="chat-input">
          {(images.length > 0 || links.length > 0) && (
            <div className="pending-attach">
              {images.map((im, i) => (
                <div key={im.path + i} className="pa">
                  {im.preview ? <img src={im.preview} alt="" /> : <Icon name="image" size={20} />}
                  <span className="ellipsis" style={{ maxWidth: 140 }}>
                    {im.path.split(/[\\/]/).pop()}
                  </span>
                  <button className="btn ghost" style={{ height: 22, padding: '0 4px' }} onClick={() => setImages(images.filter((_, j) => j !== i))}>
                    <Icon name="x" size={12} />
                  </button>
                </div>
              ))}
              {links.map((l) => {
                const a = assetsById.get(l)
                return (
                  <div key={l} className="pa">
                    <AssetThumb id={l} kind={a?.kind ?? 'model'} />
                    <span className="ellipsis" style={{ maxWidth: 140 }}>
                      {a?.name ?? l}
                    </span>
                    <button className="btn ghost" style={{ height: 22, padding: '0 4px' }} onClick={() => setLinks(links.filter((x) => x !== l))}>
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          <div className="composer">
            <button className="btn ghost" title={t('surface.referenceImage')} onClick={pickImages}>
              <Icon name="image" size={17} />
            </button>
            <textarea
              rows={1}
              value={text}
              disabled={busy}
              placeholder={pending ? t('surface.answer') : lastQ ? t('surface.ask') : t('surface.idea')}
              onChange={(e) => {
                setText(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
            />
            <button className="btn primary" disabled={busy || (!text.trim() && !images.length && !links.length)} onClick={() => submit()}>
              {busy ? <span className="spinner" /> : <Icon name="send" size={15} />}
            </button>
          </div>
        </div>

        {drag && <div className="dropzone"> {t('surface.drop')} </div>}

        {drawer && (
          <aside className="drawer" onDragOver={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div className="row between" style={{ marginBottom: 8 }}>
                <b> {t('surface.library')} </b>
                <button className="btn ghost" onClick={() => setDrawer(false)}>
                  <Icon name="x" size={14} />
                </button>
              </div>
              <input className="input" style={{ width: '100%' }} placeholder={t('surface.search')} value={libQ} onChange={(e) => setLibQ(e.target.value)} />
              <div className="dim small" style={{ marginTop: 6 }}>
                {' '}
                {t('surface.libraryContext')}{' '}
              </div>
            </div>
            <div className="drawer-grid">
              {libList.slice(0, 120).map((a) => (
                <div
                  key={a.id}
                  className={`acard ${links.includes(a.id) ? 'sel' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_TYPE, a.id)
                    e.dataTransfer.effectAllowed = 'link'
                  }}
                  onClick={() => addLink(a.id)}
                >
                  <div className="thumb">
                    <AssetThumb id={a.id} kind={a.kind} seed={hashSeed(a.id)} />
                  </div>
                  <div className="meta">
                    <b>{a.name}</b>
                    <span>{t(`kind.${a.kind}`)}</span>
                  </div>
                </div>
              ))}
              {!libList.length && <div className="dim small"> {t('surface.libraryEmpty')} </div>}
            </div>
          </aside>
        )}
      </section>

      <aside className="sheet">
        <div className="sheet-body">
          <div className="sheet-hero">
            {heroRef ? <img src={forgeUrl(heroRef)} alt="" /> : <KindArt kind={kind} seed={hashSeed(id)} />}
            <div className="shade" />
            <div className="title">
              <div className="row wrap">
                <span className="chip accent">{t(`kind.${kind}`)}</span>
                {spec.tier && <span className="chip cyan">{spec.tier}</span>}
                {brief.status === 'committed' && <span className="chip ok"> {t('surface.inProduction')} </span>}
              </div>
              <h2>{spec.name || <span className="placeholder"> {t('surface.awaitingName')} </span>}</h2>
            </div>
          </div>

          <div className="sheet-sec">
            <h4> {t('surface.briefCard')} </h4>
            {spec.description ? <p style={{ fontSize: 12.5 }}>{spec.description}</p> : <p className="placeholder small"> {t('surface.briefHelp')} </p>}
            <div className="kv2">
              <span> {t('surface.style')} </span>
              <span>{spec.style || <i className="placeholder">—</i>}</span>
              <span> {t('surface.category')} </span>
              <span>{spec.category || <i className="placeholder">—</i>}</span>
              <span> {t('surface.size')} </span>
              <span>{spec.size || <i className="placeholder">—</i>}</span>
              <span> {t('surface.materials')} </span>
              <span>{spec.materials || <i className="placeholder">—</i>}</span>
              <span> {t('surface.world')} </span>
              <span>{spec.world || <i className="placeholder">—</i>}</span>
              {spec.notes && (
                <>
                  <span> {t('surface.notes')} </span>
                  <span>{spec.notes}</span>
                </>
              )}
            </div>
          </div>

          {spec.triBudget > 0 && (
            <div className="sheet-sec">
              <h4> {t('surface.polygonBudget')} </h4>
              <div className="row between">
                <b style={{ fontSize: 18, fontFamily: 'var(--font-display)' }}>{spec.triBudget.toLocaleString(locale)}</b>
                <span className="muted small">
                  {t('surface.triangles')} · LOD1 {Math.round(spec.triBudget * 0.5).toLocaleString(locale)} · LOD2 {Math.round(spec.triBudget * 0.25).toLocaleString(locale)}
                </span>
              </div>
              <div className="budget">
                <div className="budget-track">
                  <div
                    className="budget-mark"
                    style={{ left: `calc(${Math.min(100, ((Math.log10(Math.max(500, spec.triBudget)) - Math.log10(500)) / (Math.log10(150000) - Math.log10(500))) * 100)}% - 1px)` }}
                  />
                </div>
                <div className="budget-scale">
                  <span> {t('surface.mobileBudget')} </span>
                  <span>15k · NPC</span>
                  <span> {t('surface.heroBudget')} </span>
                  <span>150k</span>
                </div>
              </div>
            </div>
          )}

          {spec.palette.length > 0 && (
            <div className="sheet-sec">
              <h4> {t('surface.colorPalette')} </h4>
              <div className="sw-row">
                {spec.palette.map((c) => {
                  const hex = resolveColor(c)
                  return hex ? (
                    <div key={c} className="sw" style={{ background: hex }} title={c} />
                  ) : (
                    <span key={c} className="chip">
                      {c}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          <div className="sheet-sec">
            <h4>{t('surface.kitCount', { included: included.length, total: brief.kit.length })}</h4>
            {!brief.kit.length && <p className="placeholder small"> {t('surface.kitHelp')} </p>}
            {GROUPS.map((g) => {
              const items = brief.kit.filter((k) => k.group === g.id)
              if (!items.length) return null
              return (
                <div key={g.id} className="kit-group">
                  <div className="kit-group-title">
                    <Icon name={g.icon} size={14} /> {t(({ model: 'brief.models', doku: 'brief.textures', ses: 'brief.sounds', vfx: 'brief.effects', animasyon: 'brief.animations' } as const)[g.id])}
                  </div>
                  {items.map((k) => (
                    <div key={k.key} className={`kit-item ${k.include ? '' : 'off'}`} onClick={() => brief.status !== 'committed' && toggleKit(k.key)}>
                      <div className="kit-check">{k.include && <Icon name="check" size={12} strokeWidth={3} />}</div>
                      <div style={{ minWidth: 0 }}>
                        <b>{k.name}</b>
                        <p>{k.purpose || k.description}</p>
                        <div className="kit-tags">
                          <span className="chip">{t(`kind.${k.kind}`)}</span>
                          {k.dynamic && <span className="chip accent">{t('surface.layers', { count: k.dynamic.layers, idle: k.dynamic.idleRpm, max: k.dynamic.maxRpm })}</span>}
                          {k.motion && (
                            <span className="chip pink">
                              {k.motion.seconds} {t('surface.secondsShort')} {k.motion.loop ? t('surface.loopSuffix') : ''}
                            </span>
                          )}
                          {k.existingId && <span className="chip ok"> {t('surface.inLibrary')} </span>}
                          {k.priority && <span className="chip">{k.priority}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
        <div className="sheet-foot">
          {brief.status === 'committed' ? (
            <div className="row between">
              <span className="muted small">{t('surface.sentCount', { count: brief.committedAssetIds?.length ?? 0 })}</span>
              <button className="btn" onClick={commit} disabled={committing}>
                <Icon name="refresh" size={14} /> {t('surface.resend')}{' '}
              </button>
            </div>
          ) : (
            <button className="btn primary big" style={{ width: '100%' }} disabled={committing || busy || (!spec.name && !brief.kit.length)} onClick={commit}>
              {committing ? <span className="spinner" /> : <Icon name="bolt" size={17} />} {t('surface.sendProduction')} {included.length ? `· ${included.length + 1} ${t('app.assets')}` : ''}
            </button>
          )}
        </div>
      </aside>
    </div>
  )
}
