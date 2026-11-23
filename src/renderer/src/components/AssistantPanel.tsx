// SPDX-License-Identifier: AGPL-3.0-only
import { message, renderMessage } from '../../../shared/i18n/message'
import { legacyEvent } from '../../../shared/i18n/events'
import { errorMessage } from '../../../shared/i18n/errors'
import { panelLabel } from '../../../shared/i18n/display'
import { useLocale } from '../i18n'
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

function ToolCard({ tool, convId }: { tool: Extract<AgentViewItem, { kind: 'tool' }>; convId: string }) {
  const { t, locale } = useLocale()

  const [open, setOpen] = useState(false)
  const ext = tool.name.includes('__')
  const [label, icon] = TOOL_LABEL[tool.name] ?? [ext ? tool.name.replace('__', ' → ') : tool.name, 'link' as IconName]
  const st = { running: t('status.running'), done: '', error: t('status.failed'), awaiting: t('assistant.awaiting'), denied: t('assistant.denied') }[tool.status]
  return (
    <div className={`tcard ${tool.status}`}>
      <div className="tcard-head" onClick={() => setOpen(!open)}>
        <span className="tcard-ico">{tool.status === 'running' ? <span className="spinner" /> : <Icon name={icon} size={14} />}</span>
        <span className="ellipsis" style={{ flex: 1 }}>
          {TOOL_LABEL[tool.name] ? panelLabel(locale, label) : label}
          {ext && <span className="dim"> · MCP</span>}
        </span>
        {st && <span className={`chip ${tool.status === 'error' || tool.status === 'denied' ? 'pink' : tool.status === 'awaiting' ? 'accent' : ''}`}>{st}</span>}
        <Icon name="chevron" size={12} style={{ transform: open ? 'rotate(90deg)' : undefined, opacity: 0.5 }} />
      </div>
      {tool.status === 'awaiting' && (
        <div className="tcard-ask">
          <pre>{tool.ask}</pre>
          <div className="row">
            <button className="btn primary" onClick={() => window.forge.agent.approve(convId, tool.id, true)}>
              <Icon name="check" size={14} /> {t('panel.8f2e0d241d')}{' '}
            </button>
            <button className="btn" onClick={() => window.forge.agent.approve(convId, tool.id, false)}>
              {' '}
              {t('panel.fd78c713b1')}{' '}
            </button>
          </div>
        </div>
      )}
      {open && (
        <div className="tcard-body">
          <div className="dim small"> {t('panel.fb9e8771b6')} </div>
          <pre>{JSON.stringify(tool.input, null, 1)}</pre>
          {tool.result && (
            <>
              <div className="dim small"> {t('panel.8e7f4d257e')} </div>
              <pre>{tool.result}</pre>
            </>
          )}
        </div>
      )}
      {!!tool.images?.length && (
        <div className="tcard-imgs">
          {tool.images.map((f) => (
            <img key={f} src={forgeUrl(f)} alt="" onClick={() => window.forge.openPath(f)} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function AssistantPanel({ onClose }: { onClose: () => void }) {
  const { t, locale } = useLocale()

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
      else if (e.type === 'error') toast(e.uiMessage ?? e.error, 'error')
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
      toast(errorMessage(e), 'error')
      window.forge.agent.get(c.id).then((x) => x && setConv(x))
    }
  }

  const ctxLabel = [
    t(
      (
        {
          home: 'app.workshop',
          library: 'app.library',
          anim: 'app.animation',
          pipeline: 'app.pipelines',
          jobs: 'app.jobs',
          design: 'app.design',
          bible: 'app.bible',
          settings: 'app.settings'
        } as const
      )[nav.page]
    ),
    nav.briefId ? t('assistant.briefOpen') : '',
    selectedAssets.length ? t('surface.selected', { count: selectedAssets.length }) : ''
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
        Promise.all(files.map(async (f) => ({ path: await window.forge.dropFile(f), preview: URL.createObjectURL(f) }))).then(
          (list) => setImages((cur) => [...cur, ...list]),
          (err: Error) => toast(message('brief.imageFailed', { detail: errorMessage(err) }), 'error')
        )
      }}
    >
      <div className="as-head">
        <ForgeMark size={26} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b> {t('panel.b85cc7254c')} </b>
          <div className="dim small ellipsis">
            {prov ? `${prov.name} · ${prov.model}` : conv ? t('assistant.providerRemoved', { model: conv.model || '' }) : '—'}
            {conv && conv.costUsd > 0 ? ` · $${conv.costUsd.toFixed(3)}` : ''}
          </div>
        </div>
        <button className="btn ghost" title={t('panel.a66b56b53f')} onClick={() => setShowList(!showList)}>
          <Icon name="list" size={15} />
        </button>
        <button className="btn ghost" title={t('panel.11dbb00508')} onClick={newChat}>
          <Icon name="plus" size={15} />
        </button>
        <button className="btn ghost" title={t('panel.d887e00ded')} onClick={onClose}>
          <Icon name="x" size={15} />
        </button>
      </div>

      {showList && (
        <div className="as-list">
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="dim small"> {t('panel.63399891eb')} </span>
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
          {!convs.length && <div className="dim small"> {t('panel.39fbfd1884')} </div>}
        </div>
      )}

      <div className="as-log" ref={log}>
        {!conv?.view.length && (
          <div className="as-empty">
            <ForgeMark size={48} />
            <h3> {t('panel.72fef98d19')} </h3>
            <p className="muted small"> {t('panel.5a6f0b9db2')} </p>
            {SUGGEST.map((s) => (
              <button key={s} className="as-sug" onClick={() => send(panelLabel(locale, s))}>
                {panelLabel(locale, s)}
              </button>
            ))}
          </div>
        )}
        {conv?.view.map((v, i) => {
          if (v.kind === 'event')
            return (
              <div key={i} className="event">
                {renderMessage(locale, v.uiMessage ?? legacyEvent(v.text))}
              </div>
            )
          if (v.kind === 'tool') return <ToolCard key={v.id + i} tool={v} convId={conv.id} />
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
            <i /> {thinking ? t('panel.6747207040') : t('panel.29f4095092')}
          </div>
        )}
      </div>

      <div className="as-input">
        {ctxLabel && (
          <div className="dim small" style={{ marginBottom: 6 }}>
            <Icon name="link" size={11} /> {t('panel.2094d016b7')} {ctxLabel}
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
            title={t('panel.1ac4e29874')}
            onClick={async () => {
              const f = await window.forge.pickFiles([{ name: t('brief.images'), extensions: ['png', 'jpg', 'jpeg', 'webp'] }], true)
              setImages((cur) => [...cur, ...f.map((p) => ({ path: p }))])
            }}
          >
            <Icon name="image" size={16} />
          </button>
          <textarea
            rows={1}
            value={text}
            placeholder={busy ? t('panel.29f4095092') : t('panel.d7243c1a06')}
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
            <button className="btn" title={t('panel.5769a8f8ae')} onClick={() => conv && window.forge.agent.stop(conv.id)}>
              <Icon name="pause" size={14} />
            </button>
          ) : (
            <button className="btn primary" disabled={!text.trim() && !images.length} onClick={() => send()}>
              <Icon name="send" size={15} />
            </button>
          )}
        </div>
      </div>
      {drag && <div className="dropzone"> {t('panel.edf4790b6a')} </div>}
    </aside>
  )
}
