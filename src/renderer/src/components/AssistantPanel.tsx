// SPDX-License-Identifier: AGPL-3.0-only
// Yapımcı — her ekrandan açılan, projeyi araçlarla yöneten asistan paneli
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentConversation, AgentViewItem } from '../../../shared/types'
import { useNav } from '../App'
import { forgeUrl, useStore } from '../store'
import { ForgeMark, Icon, type IconName } from './icons'
import Markdown from './Markdown'

const TOOL_LABEL: Record<string, [string, IconName]> = {
  project_overview: ['Projeye baktı', 'gauge'],
  list_assets: ['Kütüphaneyi taradı', 'library'],
  get_asset: ['Asset’i inceledi', 'cube'],
  view_asset: ['Önizlemelere baktı', 'image'],
  upsert_asset: ['Asset yazdı', 'plus'],
  delete_asset: ['Asset sildi', 'trash'],
  get_bible: ['Proje Kitabı’nı okudu', 'book'],
  update_bible: ['Proje Kitabı’nı güncelledi', 'book'],
  list_pipelines: ['Hatlara baktı', 'flow'],
  run_pipeline: ['Üretim başlattı', 'bolt'],
  list_jobs: ['İşlere baktı', 'jobs'],
  get_job: ['İşi inceledi', 'jobs'],
  wait_for_job: ['İşin bitmesini bekledi', 'jobs'],
  cancel_job: ['İşi iptal etti', 'x'],
  generate_animation: ['Animasyon üretti', 'anim'],
  list_briefs: ['Brief’lere baktı', 'chat'],
  get_brief: ['Brief’i okudu', 'chat'],
  kimodo_status: ['Kimodo’yu kontrol etti', 'anim'],
  unreal_status: ['Unreal’ı aradı', 'cube'],
  unreal_python: ['Unreal’da Python çalıştırdı', 'terminal'],
  web_search: ['Web’de araştırdı', 'search']
}

const SUGGEST = [
  'Projeye bak, eksikleri ve sıradaki adımları söyle',
  'Seçtiğim asset’leri üret, sonuçları kontrol edip düzelt',
  'Gerçekçi bir çöl kasabası için asset listesi çıkar ve kütüphaneye ekle',
  'Karakterim için motion matching’e uygun lokomosyon animasyon seti üret',
  'Unreal’da açık sahneyi incele ve ışığı gerçekçi hale getir'
]

function ToolCard({ t, convId }: { t: Extract<AgentViewItem, { kind: 'tool' }>; convId: string }) {
  const [open, setOpen] = useState(false)
  const ext = t.name.includes('__')
  const [label, icon] = TOOL_LABEL[t.name] ?? [ext ? t.name.replace('__', ' → ') : t.name, 'link' as IconName]
  const st = { running: 'çalışıyor', done: '', error: 'hata', awaiting: 'onay bekliyor', denied: 'reddedildi' }[t.status]
  return (
    <div className={`tcard ${t.status}`}>
      <div className="tcard-head" onClick={() => setOpen(!open)}>
        <span className="tcard-ico">{t.status === 'running' ? <span className="spinner" /> : <Icon name={icon} size={14} />}</span>
        <span className="ellipsis" style={{ flex: 1 }}>
          {label}
          {ext && <span className="dim"> · MCP</span>}
        </span>
        {st && <span className={`chip ${t.status === 'error' || t.status === 'denied' ? 'pink' : t.status === 'awaiting' ? 'accent' : ''}`}>{st}</span>}
        <Icon name="chevron" size={12} style={{ transform: open ? 'rotate(90deg)' : undefined, opacity: 0.5 }} />
      </div>
      {t.status === 'awaiting' && (
        <div className="tcard-ask">
          <pre>{t.ask}</pre>
          <div className="row">
            <button className="btn primary" onClick={() => window.forge.agent.approve(convId, t.id, true)}>
              <Icon name="check" size={14} /> Onayla
            </button>
            <button className="btn" onClick={() => window.forge.agent.approve(convId, t.id, false)}>
              Reddet
            </button>
          </div>
        </div>
      )}
      {open && (
        <div className="tcard-body">
          <div className="dim small">Girdi</div>
          <pre>{JSON.stringify(t.input, null, 1)}</pre>
          {t.result && (
            <>
              <div className="dim small">Sonuç</div>
              <pre>{t.result}</pre>
            </>
          )}
        </div>
      )}
      {!!t.images?.length && (
        <div className="tcard-imgs">
          {t.images.map((f) => (
            <img key={f} src={forgeUrl(f)} alt="" onClick={() => window.forge.openPath(f)} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function AssistantPanel({ onClose }: { onClose: () => void }) {
  const { settings, selectedAssets, toast } = useStore()
  const nav = useNav()
  const [convs, setConvs] = useState<AgentConversation[]>([])
  const [conv, setConv] = useState<AgentConversation | null>(null)
  const [stream, setStream] = useState('')
  const [thinking, setThinking] = useState(false)
  const [text, setText] = useState('')
  const [images, setImages] = useState<{ path: string; preview?: string }[]>([])
  const [showList, setShowList] = useState(false)
  const [providerId, setProviderId] = useState('')
  const [drag, setDrag] = useState(false)
  const log = useRef<HTMLDivElement>(null)
  const convRef = useRef<string | null>(null)
  convRef.current = conv?.id ?? null

  const providers = settings?.llmProviders ?? []
  const defaultProvider = settings?.llmRoles.assistant ?? 'claude'
  const prov = providers.find((p) => p.id === (conv?.providerId ?? (providerId || defaultProvider)))

  useEffect(() => {
    window.forge.agent.list().then((l) => {
      setConvs(l)
      if (l[0]) window.forge.agent.get(l[0].id).then(setConv)
    })
    return window.forge.agent.onEvent((e) => {
      if (e.type === 'conv') {
        setConvs((l) => [e.conv, ...l.filter((c) => c.id !== e.conv.id)])
        if (e.conv.id === convRef.current) {
          setConv(e.conv)
          setStream('')
        }
        return
      }
      if (e.convId !== convRef.current) return
      if (e.type === 'delta') setStream((s) => s + e.text)
      else if (e.type === 'thinking') setThinking(e.on)
      else if (e.type === 'error') toast(e.error, 'error')
    })
  }, [toast])

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [conv?.view.length, conv?.updatedAt, stream, thinking])

  const busy = !!conv?.busy
  const awaiting = useMemo(() => conv?.view.some((v) => v.kind === 'tool' && v.status === 'awaiting'), [conv])

  const newChat = async () => {
    const c = await window.forge.agent.create(providerId || defaultProvider)
    setConv(c)
    setConvs((l) => [c, ...l])
    setShowList(false)
    return c
  }

  const send = async (msg?: string) => {
    const t = (msg ?? text).trim()
    if ((!t && !images.length) || busy) return
    const c = conv ?? (await newChat())
    setText('')
    const imgs = images.map((i) => i.path)
    setImages([])
    setStream('')
    setConv({ ...c, busy: true })
    try {
      const r = await window.forge.agent.send(c.id, { text: t, images: imgs, context: { page: nav.page, selectedAssets, briefId: nav.briefId } })
      setConv(r)
    } catch (e) {
      toast((e as Error).message, 'error')
      window.forge.agent.get(c.id).then((x) => x && setConv(x))
    }
  }

  const ctxLabel = [
    { home: 'Atölye', library: 'Kütüphane', anim: 'Animasyon', pipeline: 'Hatlar', jobs: 'Üretim', design: 'Oyun Tasarımı', bible: 'Proje Kitabı', settings: 'Ayarlar' }[nav.page],
    nav.briefId ? 'brief açık' : '',
    selectedAssets.length ? `${selectedAssets.length} seçili asset` : ''
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <aside
      className="assistant"
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        const files = [...e.dataTransfer.files].filter((f) => /\.(png|jpe?g|webp)$/i.test(f.name))
        setImages((cur) => [...cur, ...files.map((f) => ({ path: window.forge.pathForFile(f), preview: URL.createObjectURL(f) }))])
      }}
    >
      <div className="as-head">
        <ForgeMark size={26} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>Yapımcı</b>
          <div className="dim small ellipsis">
            {prov ? `${prov.name} · ${prov.model}` : conv ? `${conv.model} (sağlayıcı silinmiş — yeni sohbet aç)` : '—'}
            {conv && conv.costUsd > 0 ? ` · $${conv.costUsd.toFixed(3)}` : ''}
          </div>
        </div>
        <button className="btn ghost" title="Sohbetler" onClick={() => setShowList(!showList)}>
          <Icon name="list" size={15} />
        </button>
        <button className="btn ghost" title="Yeni sohbet" onClick={newChat}>
          <Icon name="plus" size={15} />
        </button>
        <button className="btn ghost" title="Kapat (Ctrl+J)" onClick={onClose}>
          <Icon name="x" size={15} />
        </button>
      </div>

      {showList && (
        <div className="as-list">
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="dim small">Yeni sohbet modeli</span>
            <select className="input" style={{ flex: 1, height: 30, padding: '0 8px' }} value={providerId || defaultProvider} onChange={(e) => setProviderId(e.target.value)}>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.model}
                </option>
              ))}
            </select>
          </div>
          {convs.map((c) => (
            <div
              key={c.id}
              className={`as-item ${c.id === conv?.id ? 'on' : ''}`}
              onClick={async () => {
                setConv(await window.forge.agent.get(c.id))
                setShowList(false)
              }}
            >
              <span className="ellipsis" style={{ flex: 1 }}>
                {c.title}
              </span>
              {c.busy && <span className="pulse" />}
              <button
                className="btn ghost"
                style={{ height: 22, padding: '0 4px' }}
                onClick={async (e) => {
                  e.stopPropagation()
                  await window.forge.agent.remove(c.id)
                  setConvs((l) => l.filter((x) => x.id !== c.id))
                  if (conv?.id === c.id) setConv(null)
                }}
              >
                <Icon name="trash" size={12} />
              </button>
            </div>
          ))}
          {!convs.length && <div className="dim small">Henüz sohbet yok.</div>}
        </div>
      )}

      <div className="as-log" ref={log}>
        {!conv?.view.length && (
          <div className="as-empty">
            <ForgeMark size={48} />
            <h3>Oyununu birlikte yapalım</h3>
            <p className="muted small">Asset üretir, sonuçlara bakıp eleştiririm, animasyon çıkarırım, Unreal’da sahne kurarım. Para harcayan ya da geri alınamayan her adımda önce onay isterim.</p>
            {SUGGEST.map((s) => (
              <button key={s} className="as-sug" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {conv?.view.map((v, i) => {
          if (v.kind === 'event')
            return (
              <div key={i} className="event">
                {v.text}
              </div>
            )
          if (v.kind === 'tool') return <ToolCard key={v.id + i} t={v} convId={conv.id} />
          if (v.kind === 'user')
            return (
              <div key={i} className="as-user">
                {v.text}
                {!!v.images?.length && (
                  <div className="tcard-imgs">
                    {v.images.map((f) => (
                      <img key={f} src={forgeUrl(f)} alt="" />
                    ))}
                  </div>
                )}
              </div>
            )
          return (
            <div key={i} className="as-ai">
              <Markdown text={v.text} />
            </div>
          )
        })}
        {busy && stream && (
          <div className="as-ai">
            <Markdown text={stream} />
          </div>
        )}
        {busy && !awaiting && (thinking || !stream) && (
          <div className="typing" style={{ marginLeft: 0 }}>
            <i />
            <i />
            <i /> {thinking ? 'Düşünüyor…' : 'Çalışıyor…'}
          </div>
        )}
      </div>

      <div className="as-input">
        {ctxLabel && (
          <div className="dim small" style={{ marginBottom: 6 }}>
            <Icon name="link" size={11} /> Bağlam: {ctxLabel}
          </div>
        )}
        {images.length > 0 && (
          <div className="pending-attach">
            {images.map((im, i) => (
              <div key={i} className="pa">
                {im.preview ? <img src={im.preview} alt="" /> : <Icon name="image" size={18} />}
                <button className="btn ghost" style={{ height: 22, padding: '0 4px' }} onClick={() => setImages(images.filter((_, j) => j !== i))}>
                  <Icon name="x" size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="composer" style={{ maxWidth: 'none', padding: '6px 6px 6px 8px' }}>
          <button
            className="btn ghost"
            title="Görsel ekle"
            onClick={async () => {
              const f = await window.forge.pickFiles([{ name: 'Görseller', extensions: ['png', 'jpg', 'jpeg', 'webp'] }], true)
              setImages((cur) => [...cur, ...f.map((p) => ({ path: p }))])
            }}
          >
            <Icon name="image" size={16} />
          </button>
          <textarea
            rows={1}
            value={text}
            placeholder={busy ? 'Çalışıyor…' : 'Ne yapalım?'}
            disabled={busy}
            onChange={(e) => {
              setText(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(160, e.target.scrollHeight) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
          />
          {busy ? (
            <button className="btn" title="Durdur" onClick={() => conv && window.forge.agent.stop(conv.id)}>
              <Icon name="pause" size={14} />
            </button>
          ) : (
            <button className="btn primary" disabled={!text.trim() && !images.length} onClick={() => send()}>
              <Icon name="send" size={15} />
            </button>
          )}
        </div>
      </div>
      {drag && <div className="dropzone">Görseli bırak</div>}
    </aside>
  )
}
