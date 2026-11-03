// SPDX-License-Identifier: AGPL-3.0-only
import { useEffect, useRef, useState } from 'react'
import type { AssetKind, Brief } from '../../../shared/types'
import { useNav } from '../App'
import { Icon } from '../components/icons'
import KindArt, { KIND_THEME } from '../components/KindArt'
import { ago, jobProgress } from '../components/Thumb'
import { useStore } from '../store'

const TILES: { kind: AssetKind; hint: string; start: string }[] = [
  { kind: 'character', hint: 'Rig + LOD + Manny', start: 'Oyunum için bir karakter tasarlamak istiyorum.' },
  { kind: 'vehicle', hint: 'Gövde, ses, toz, hasar', start: 'Oyunum için sürülebilir bir araç üretmek istiyorum.' },
  { kind: 'creature', hint: 'Yaratık / hayvan', start: 'Oyunum için bir yaratık tasarlamak istiyorum.' },
  { kind: 'weapon', hint: 'Silah + sesleri', start: 'Oyunum için bir silah üretmek istiyorum.' },
  { kind: 'model', hint: 'Prop, yapı, çevre', start: 'Oyun dünyam için bir prop / yapı üretmek istiyorum.' },
  { kind: 'texture', hint: 'Zemin, PBR, tileable', start: 'Oyun dünyam için bir zemin dokusu üretmek istiyorum.' },
  { kind: 'sfx', hint: 'Dinamik motor, efekt', start: 'Oyunum için ses efektleri üretmek istiyorum.' },
  { kind: 'vfx', hint: 'Duman, toz, kıvılcım', start: 'Oyunum için bir görsel efekt (VFX) üretmek istiyorum.' },
  { kind: 'animation', hint: 'Metinden hareket', start: 'Karakterim için animasyon seti üretmek istiyorum.' },
  { kind: 'music', hint: 'Döngü, ambiyans', start: 'Oyunum için müzik / ambiyans üretmek istiyorum.' }
]

const QUICK = [
  'Çölde giden paslı bir pikap — toz, motor sesi, çarpışma',
  'Low poly, sevimli bir köy çiftçisi karakteri',
  'Sci-fi koridor için modüler duvar seti',
  'Ormanda gezen kurt — yürüyüş ve uluma'
]

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
  const { jobs, toast, project } = useStore()
  const nav = useNav()
  const [text, setText] = useState('')
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [busy, setBusy] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    window.forge.brief.list().then(setBriefs, (e: Error) => toast(e.message, 'error'))
  }, [toast])

  const start = async (msg: string, kind?: AssetKind) => {
    const m = msg.trim()
    if (!m || busy) return
    setBusy(true)
    try {
      const b = await window.forge.brief.create({ title: m.length > 48 ? m.slice(0, 46) + '…' : m, kind })
      nav.openBrief(b.id, m)
    } catch (e) {
      toast((e as Error).message, 'error')
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
            <Icon name="bolt" size={14} /> Asset fabrikası · {project?.bible.projectName || 'Yeni proje'}
          </div>
          <h1>
            Ne üretelim?
            <br />
            <span className="grad-text">Anlat, gerisini fabrika yapsın.</span>
          </h1>
          <p>
            Fikrini yaz ya da bir görsel bırak. Yönetmen sana birkaç soru sorar: stil, renk, poligon bütçesi, oyun dünyası. Sonra modelden sese, tozdan animasyona kadar bütün seti tek seferde üretir.
          </p>
          <div className="composer">
            <textarea
              ref={ta}
              rows={1}
              value={text}
              placeholder="ör. Kumlu çölde giden, paslı ama sevimli bir pikap…"
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
              Başla
            </button>
          </div>
          <div className="quick">
            {QUICK.map((q) => (
              <button key={q} onClick={() => start(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="section-title">
        Ne tür bir şey? <span className="muted">Bir karoya tıkla, yönetmen oradan başlasın</span>
      </div>
      <div className="tiles">
        {TILES.map((t, i) => (
          <div key={t.kind} className="tile" onClick={() => start(t.start, t.kind)}>
            <KindArt kind={t.kind} seed={i} />
            <div className="tile-label">
              <b>{KIND_THEME[t.kind].label}</b>
              <span>{t.hint}</span>
            </div>
          </div>
        ))}
      </div>

      {briefs.length > 0 && (
        <>
          <div className="section-title">
            Brief'ler <span className="muted">{briefs.length} tasarım konuşması</span>
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
                  <div className="muted small ellipsis">{b.spec.style || b.spec.description || 'Tasarım konuşması'}</div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <span className={`chip ${b.status === 'committed' ? 'ok' : b.status === 'ready' ? 'accent' : ''}`}>
                      {b.status === 'committed' ? 'Üretime gitti' : b.status === 'ready' ? 'Hazır' : 'Taslak'}
                    </span>
                    {b.kit.length > 0 && <span className="chip">{b.kit.filter((k) => k.include).length} parça</span>}
                    <span className="dim small">{ago(b.updatedAt)}</span>
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
            Üretim bandı <span className="muted">{active.length ? `${active.length} iş sürüyor` : 'son işler'}</span>
            <span className="spacer" />
            <button className="btn ghost" onClick={() => nav.go('jobs')}>
              Tümü <Icon name="chevron" size={14} />
            </button>
          </div>
          <div className="job-strip">
            {recent.map((j) => (
              <div key={j.id} className="job-mini">
                <div className="row between">
                  <b className="ellipsis">{j.assetName}</b>
                  <span className={`chip ${j.status === 'done' ? 'ok' : j.status === 'failed' ? 'pink' : j.status === 'running' ? 'accent' : ''}`}>
                    {{ queued: 'sırada', running: 'üretiliyor', done: 'hazır', failed: 'hata', canceled: 'iptal' }[j.status]}
                  </span>
                </div>
                <div className="muted small ellipsis">{j.pipelineName}</div>
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
