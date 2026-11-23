// SPDX-License-Identifier: AGPL-3.0-only
import { renderMessage } from '../../../shared/i18n/message'
import { pipelineTitle } from '../../../shared/i18n/metadata'
import { errorMessage } from '../../../shared/i18n/errors'
import { useEffect, useRef, useState } from 'react'
import type { AssetKind, Brief } from '../../../shared/types'
import { useNav } from '../App'
import { Icon } from '../components/icons'
import KindArt from '../components/KindArt'
import { ago, jobProgress } from '../components/Thumb'
import { useStore } from '../store'
import { useLocale } from '../i18n'

const TILES = ['character', 'vehicle', 'creature', 'weapon', 'model', 'texture', 'sfx', 'vfx', 'animation', 'music'] as const

function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 600 400" preserveAspectRatio="xMaxYMid slice">
      <defs>
        <radialGradient id="ha-core" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff3d6" />
          <stop offset=".25" stopColor="#ffb547" />
          <stop offset=".6" stopColor="#ff6a2b" stopOpacity=".55" />
          <stop offset="1" stopColor="#e2235f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ha-hex" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffb547" />
          <stop offset=".55" stopColor="#ff6a2b" />
          <stop offset="1" stopColor="#e2235f" />
        </linearGradient>
      </defs>
      <circle cx="390" cy="200" r="190" fill="url(#ha-core)" opacity=".45" />
      <g fill="none" stroke="#ffb98a" strokeOpacity=".22">
        <ellipse cx="390" cy="200" rx="230" ry="70">
          <animateTransform attributeName="transform" type="rotate" from="0 390 200" to="360 390 200" dur="60s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="390" cy="200" rx="170" ry="120" strokeDasharray="4 10">
          <animateTransform attributeName="transform" type="rotate" from="360 390 200" to="0 390 200" dur="80s" repeatCount="indefinite" />
        </ellipse>
        <circle cx="390" cy="200" r="140" strokeDasharray="1 8" />
      </g>
      {/* tel kafes altıgen + örs */}
      <g transform="translate(390 200)">
        <path d="M0-118 102-59v118L0 118-102 59v-118z" fill="url(#ha-hex)" opacity=".92" />
        <path d="M0-118 102-59v118L0 118-102 59v-118z" fill="none" stroke="#fff" strokeOpacity=".35" />
        <path d="M0-118V0M102-59 0 0-102-59M0 0v118" stroke="#000" strokeOpacity=".22" strokeWidth="2" />
        <path d="M-60-12h92c0 18 11 26 26 26v12H18l11 33h-66l11-33h-15c-11 0-19-11-19-22z" fill="#14070a" fillOpacity=".9" />
      </g>
      {/* kıvılcımlar */}
      {Array.from({ length: 18 }, (_, i) => {
        const x = 420 + Math.cos(i * 1.7) * (60 + (i % 5) * 26)
        const y = 140 + Math.sin(i * 2.3) * 50
        return (
          <circle key={i} cx={x} cy={y} r={1.5 + (i % 3)} fill="#ffe2a8">
            <animate attributeName="cy" values={`${y};${y - 70 - (i % 4) * 20}`} dur={`${2.4 + (i % 5) * 0.5}s`} repeatCount="indefinite" begin={`${(i % 7) * 0.35}s`} />
            <animate attributeName="opacity" values="0;1;0" dur={`${2.4 + (i % 5) * 0.5}s`} repeatCount="indefinite" begin={`${(i % 7) * 0.35}s`} />
          </circle>
        )
      })}
      {/* yörüngedeki küçük asset kartları */}
      {(['vehicle', 'character', 'sfx'] as const).map((k, i) => (
        <g key={k} transform={`translate(${[150, 520, 470][i]} ${[90, 70, 300][i]}) rotate(${[-8, 6, -4][i]})`} opacity=".9">
          <rect x="-34" y="-40" width="68" height="80" rx="12" fill="#0c0d13" stroke="#fff" strokeOpacity=".15" />
          <foreignObject x="-34" y="-40" width="68" height="80">
            <div style={{ width: 68, height: 80, borderRadius: 12, overflow: 'hidden' }}>
              <KindArt kind={k} />
            </div>
          </foreignObject>
        </g>
      ))}
    </svg>
  )
}

export default function HomePage() {
  const { locale, t } = useLocale()
  const tiles = TILES.map((kind) => ({ kind, hint: t(`home.${kind}Hint`), start: t(`home.${kind}Start`) }))
  const quick = (['home.quick0', 'home.quick1', 'home.quick2', 'home.quick3'] as const).map((key) => t(key))
  const { jobs, toast, project } = useStore()
  const nav = useNav()
  const [text, setText] = useState('')
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [busy, setBusy] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    window.forge.brief.list().then(setBriefs, (e: Error) => toast(errorMessage(e), 'error'))
  }, [toast])

  const start = async (msg: string, kind?: AssetKind) => {
    const m = msg.trim()
    if (!m || busy) return
    setBusy(true)
    try {
      const b = await window.forge.brief.create({ title: m.length > 48 ? m.slice(0, 46) + '…' : m, kind })
      nav.openBrief(b.id, m)
    } catch (e) {
      toast(errorMessage(e), 'error')
      setBusy(false)
    }
  }

  const active = jobs.filter((j) => j.status === 'running' || j.status === 'queued')
  const recent = [...active, ...jobs.filter((j) => j.status !== 'running' && j.status !== 'queued')].slice(0, 6)

  return (
    <div className="home">
      <section className="hero">
        <HeroArt />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="hero-kicker">
            <Icon name="bolt" size={14} /> {t('home.factory')} · {project?.bible.projectName || t('home.newProject')}
          </div>
          <h1>
            {t('home.heading')}
            <br />
            <span className="grad-text">{t('home.tagline')}</span>
          </h1>
          <p>{t('home.description')}</p>
          <div className="composer">
            <textarea
              ref={ta}
              rows={1}
              value={text}
              placeholder={t('home.placeholder')}
              onChange={(e) => {
                setText(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  start(text)
                }
              }}
            />
            <button className="btn primary big" disabled={!text.trim() || busy} onClick={() => start(text)}>
              {busy ? <span className="spinner" /> : <Icon name="send" size={17} />}
              {t('home.start')}
            </button>
          </div>
          <div className="quick">
            {quick.map((q) => (
              <button key={q} onClick={() => start(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="section-title">
        {t('home.whatKind')}
        <span className="muted">{t('home.tileHelp')}</span>
      </div>
      <div className="tiles">
        {tiles.map((tile, i) => (
          <div key={tile.kind} className="tile" onClick={() => start(tile.start, tile.kind)}>
            <KindArt kind={tile.kind} seed={i} />
            <div className="tile-label">
              <b>{t(`kind.${tile.kind}`)}</b>
              <span title={tile.hint}>{tile.hint}</span>
            </div>
          </div>
        ))}
      </div>

      {briefs.length > 0 && (
        <>
          <div className="section-title">
            {t('home.briefs')}
            <span className="muted">{t('home.conversations', { count: briefs.length })}</span>
          </div>
          <div className="cards-row">
            {briefs.slice(0, 9).map((b, i) => (
              <div key={b.id} className="brief-card" onClick={() => nav.openBrief(b.id)}>
                <div className="bc-art">
                  <KindArt kind={b.spec.kind} seed={i} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b className="ellipsis" style={{ display: 'block' }}>
                    {b.spec.name || b.title}
                  </b>
                  <div className="muted small ellipsis">{b.spec.style || b.spec.description || t('home.conversation')}</div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <span className={`chip ${b.status === 'committed' ? 'ok' : b.status === 'ready' ? 'accent' : ''}`}>
                      {b.status === 'committed' ? t('home.committed') : b.status === 'ready' ? t('home.ready') : t('home.draft')}
                    </span>
                    {b.kit.length > 0 && <span className="chip">{t('home.parts', { count: b.kit.filter((k) => k.include).length })}</span>}
                    <span className="dim small">{ago(b.updatedAt, locale)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {recent.length > 0 && (
        <>
          <div className="section-title">
            {t('home.production')}
            <span className="muted">{active.length ? t('home.active', { count: active.length }) : t('home.recentJobs')}</span>
            <span className="spacer" />
            <button className="btn ghost" onClick={() => nav.go('jobs')}>
              {t('home.all')}
              <Icon name="chevron" size={14} />
            </button>
          </div>
          <div className="job-strip">
            {recent.map((j) => (
              <div key={j.id} className="job-mini">
                <div className="row between">
                  <b className="ellipsis">{j.assetName}</b>
                  <span className={`chip ${j.status === 'done' ? 'ok' : j.status === 'failed' ? 'pink' : j.status === 'running' ? 'accent' : ''}`}>{t(`status.${j.status}`)}</span>
                </div>
                <div className="muted small ellipsis">{renderMessage(locale, pipelineTitle(j.pipelineId, j.pipelineName))}</div>
                <div className="bar">
                  <div style={{ width: `${jobProgress(j)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
