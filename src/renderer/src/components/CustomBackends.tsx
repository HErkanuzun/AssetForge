import {message} from '../../../shared/i18n/message'
import { useLocale } from '../i18n'
// SPDX-License-Identifier: AGPL-3.0-only
// Ayarlar → Yerel araçlar → Özel arka uçlar: git deposundan bir yapay zekâ projesi ekle, kurulum tarifini gözden geçir,
// onaylayıp kur, başlat/durdur. Gradio uygulamalarının uç noktalarını ve girişlerin nasıl eşleneceğini gösterir.
import { useCallback, useEffect, useState } from 'react'
import type { BackendStatus, CustomBackend, GradioEndpointInfo } from '../../../shared/types'
import { recipeToJson } from '../../../shared/backends'
import { useStore } from '../store'
import { Icon } from './icons'

const ROLE_LABEL = {prompt:'backend.role.prompt',negative:'backend.role.negative',seed:'backend.role.seed',seconds:'backend.role.seconds',image:'backend.role.image',model:'backend.role.model',audio:'backend.role.audio',file:'backend.role.file'} as const
const clean = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

function Endpoints({ list }: { list: GradioEndpointInfo[] }) {
  const {t} = useLocale()

  if (!list.length) return <div className="dim small"> {t('panel.c79bad1cc8')} </div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
      {list.map((ep) => (
        <div key={ep.name} className="small">
          <code>{ep.name}</code>{' '}
          <span className="muted">
            {ep.params.map((p) => `${p.name}${p.role ? ` ← ${p.role in ROLE_LABEL ? t(ROLE_LABEL[p.role as keyof typeof ROLE_LABEL]) : p.role}` : p.hasDefault ? ` = ${JSON.stringify(p.default)?.slice(0, 24)}` : ''}`).join(' · ') || t('backend.noInputs')}
            {' → '}
            {ep.returns.map((r) => r.component || r.label).join(', ') || '?'}
          </span>
        </div>
      ))}
      <div className="dim small"> {t('panel.67696171b9')} </div>
    </div>
  )
}

function Row({ b, st, refresh }: { b: CustomBackend; st?: BackendStatus; refresh: () => Promise<void> }) {
  const {t} = useLocale()

  const { setSettings, toast } = useStore()
  const [json, setJson] = useState(() => recipeToJson(b.recipe))
  const [open, setOpen] = useState(!st?.installed)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState('')
  const [lines, setLines] = useState<string[]>([])
  const [eps, setEps] = useState<GradioEndpointInfo[] | null>(null)
  useEffect(() => setJson(recipeToJson(b.recipe)), [b.recipe])
  useEffect(() => window.forge.backends.onLog((m) => m.id === b.id && setLines((x) => [...x.slice(-400), m.line])), [b.id])

  const act = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key)
    try {
      await fn()
      if (ok) toast(ok, 'ok')
    } catch (e) {
      toast(clean(e), 'error')
    } finally {
      setBusy('')
      setSettings(await window.forge.settings.get())
      await refresh()
    }
  }
  const dirty = json.trim() !== recipeToJson(b.recipe).trim()
  const saveRecipe = () => act('save', () => window.forge.backends.setRecipe(b.id, json), t('backend.saved'))
  const led = st?.healthy ? 'on' : st?.running ? 'wait' : ''
  const state = !st
    ? '…'
    : st.healthy
      ? t('backend.running', {url:st.url ?? ''})
      : st.running
        ? t('panel.cea26752e9')
        : st.installed
          ? st.stale
            ? t('panel.605c0faef3')
            : t('panel.2197247807')
          : st.cloned
            ? t('panel.07f789c95a')
            : t('backend.noRepo')

  return (
    <div className="mcp-row">
      <div className="row">
        <span className="svc" style={{ padding: 0, margin: 0, border: 0, background: 'none' }}>
          <span className={`led ${led}`} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{b.name}</b> <span className="chip">{b.recipe.api === 'gradio' ? 'Gradio' : 'HTTP'}</span>
          <div className="muted small ellipsis">
            {state} · {b.recipe.repo}
          </div>
        </div>
        {st?.installed && !st.stale && (st.running || st.healthy) ? (
          <button className="btn" disabled={!!busy} onClick={() => act('stop', () => window.forge.backends.stop(b.id))}> {t('panel.5769a8f8ae')} </button>
        ) : (
          st?.installed &&
          !st.stale && (
            <button className="btn primary" disabled={!!busy} onClick={() => act('start', () => window.forge.backends.start(b.id), t('backend.ready', {name:b.name}))}>
              {busy === 'start' ? <span className="spinner" /> : <Icon name="play" size={13} />} {t('panel.24fa59605d')} </button>
          )
        )}
        {st?.healthy && (
          <button className="btn" title={t('panel.4edc8c3706')} onClick={() => window.forge.backends.open(b.id)}>
            <Icon name="link" size={13} /> {t('panel.dcc084f9a2')} </button>
        )}
        <button className={`btn ${!st?.installed || st.stale ? 'primary' : ''}`} disabled={!!busy || dirty} title={dirty ? t('panel.2ba9980b2e') : undefined} onClick={() => setConfirm(true)}>
          {busy === 'install' ? <span className="spinner" /> : st?.installed ? t('backend.reinstall') : t('backend.install')}
        </button>
        <button className="btn ghost" title={t('panel.09d23a2f02')} onClick={() => setOpen(!open)}>
          <Icon name="settings" size={14} />
        </button>
        <button className="btn ghost" title={t('panel.d6f2f6cad0')} onClick={() => window.forge.backends.folder(b.id)}>
          <Icon name="folder" size={14} />
        </button>
        <button
          className="btn ghost"
          title={t('panel.08d26d4008')}
          disabled={!!busy}
          onClick={() => act('remove', () => window.forge.backends.remove(b.id), t('backend.removed', {name:b.name}))}
        >
          <Icon name="trash" size={14} />
        </button>
      </div>

      {confirm && (
        <div className="set-note warn" style={{ flexDirection: 'column', alignItems: 'stretch', marginTop: 8 }}>
          <b> {t('panel.e05952bb64')} </b>
          <div className="console" style={{ maxHeight: 160 }}>
            {[
              `git clone ${b.recipe.repo}${b.recipe.ref ? ` (${b.recipe.ref})` : ''}`,
              ...(b.recipe.python ? [`uv venv --python ${b.recipe.python}`] : []),
              ...b.recipe.install,
              t('backend.startCommand', {command:b.recipe.start})
            ].join('\n')}
          </div>
          <span className="small"> {t('panel.317f43193c')} </span>
          <div className="row">
            <span className="spacer" />
            <button className="btn ghost" onClick={() => setConfirm(false)}> {t('panel.39a8d28c1c')} </button>
            <button
              className="btn primary"
              onClick={() => {
                setConfirm(false)
                setLines([])
                void act('install', () => window.forge.backends.install(b.id), `${b.name} kuruldu`)
              }}
            > {t('panel.4b8759a02d')} </button>
          </div>
        </div>
      )}

      {open && (
        <div style={{ marginTop: 8 }}>
          <textarea
            className="input"
            rows={14}
            spellCheck={false}
            style={{ width: '100%', fontFamily: 'Cascadia Mono, Consolas, monospace', fontSize: 12 }}
            value={json}
            onChange={(e) => setJson(e.target.value)}
          />
          <div className="row" style={{ marginTop: 6, flexWrap: 'wrap' }}>
            <span className="dim small" style={{ flex: 1, minWidth: 240 }}>
              <code>{'{uv}'}</code> <code>{'{python}'}</code> <code>{'{port}'}</code> <code>{'{repo}'}</code> {t('panel.abbd490e36')} <code>_hf</code> {t('panel.640b7494bd')} <code>assetforge.json</code> {t('panel.491385856c')} </span>
            {dirty && (
              <button className="btn ghost" onClick={() => setJson(recipeToJson(b.recipe))}> {t('panel.6b65f1920b')} </button>
            )}
            <button className="btn" disabled={!dirty || busy === 'save'} onClick={saveRecipe}> {t('panel.4583ec0338')} </button>
          </div>
        </div>
      )}

      <div className="row" style={{ marginTop: 6 }}>
        {b.recipe.api === 'gradio' && st?.healthy && (
          <button
            className="btn ghost"
            disabled={busy === 'eps'}
            onClick={async () => {
              setBusy('eps')
              try {
                setEps(await window.forge.backends.inspect(st.url))
              } catch (e) {
                toast(clean(e), 'error')
              } finally {
                setBusy('')
              }
            }}
          >
            {busy === 'eps' ? <span className="spinner" /> : <Icon name="list" size={13} />} {t('panel.9264d0bc8d')} </button>
        )}
        <button className="btn ghost" onClick={async () => setLines((await window.forge.backends.logs(b.id)).split(/\r?\n/).slice(-200))}>
          <Icon name="terminal" size={13} /> {t('panel.0b754b0278')} </button>
      </div>
      {eps && <Endpoints list={eps} />}
      {lines.length > 0 && <div className="console">{lines.join('\n')}</div>}
    </div>
  )
}

export default function CustomBackends() {
  const {t} = useLocale()

  const { settings, setSettings, toast } = useStore()
  const s = settings!
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState('')
  const [notes, setNotes] = useState<string[]>([])
  const [lines, setLines] = useState<string[]>([])
  const [status, setStatus] = useState<Record<string, BackendStatus>>({})
  const [probe, setProbe] = useState('')
  const [eps, setEps] = useState<GradioEndpointInfo[] | null>(null)

  const refresh = useCallback(async () => {
    try {
      const list = await window.forge.backends.status()
      setStatus(Object.fromEntries(list.map((x) => [x.id, x])))
    } catch {
      /* bir sonraki turda */
    }
  }, [])
  useEffect(() => {
    void refresh()
    const t = window.setInterval(refresh, 8000)
    const off = window.forge.backends.onLog((m) => m.id === '_add' && setLines((x) => [...x.slice(-100), m.line]))
    return () => {
      window.clearInterval(t)
      off()
    }
  }, [refresh])

  const add = async () => {
    setBusy('add')
    setLines([])
    setNotes([])
    try {
      const r = await window.forge.backends.add(url)
      setNotes(r.notes)
      setUrl('')
      setSettings(await window.forge.settings.get())
      toast(message('backend.downloaded', {name:r.backend.name}), 'ok')
    } catch (e) {
      toast(clean(e), 'error')
    } finally {
      setBusy('')
      void refresh()
    }
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder={t('panel.bc33a3708a')}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && url.trim() && add()}
        />
        <button className="btn primary" disabled={!url.trim() || busy === 'add'} onClick={add}>
          {busy === 'add' ? <span className="spinner" /> : <Icon name="plus" size={13} />} {t('panel.43e4b33aa8')} </button>
      </div>
      {busy === 'add' && lines.length > 0 && <div className="console">{lines.join('\n')}</div>}
      {notes.length > 0 && (
        <div className="set-note">
          <Icon name="book" size={15} />
          <span>
            {notes.map((n) => (
              <div key={n}>{n}</div>
            ))}
          </span>
        </div>
      )}
      {s.customBackends.map((b) => (
        <Row key={b.id} b={b} st={status[b.id]} refresh={refresh} />
      ))}

      <div className="row" style={{ marginTop: 10 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder={t('panel.3d57341122')}
          value={probe}
          onChange={(e) => setProbe(e.target.value)}
        />
        <button
          className="btn"
          disabled={!probe.trim() || busy === 'probe'}
          onClick={async () => {
            setBusy('probe')
            try {
              setEps(await window.forge.backends.inspect(probe))
            } catch (e) {
              setEps(null)
              toast(clean(e), 'error')
            } finally {
              setBusy('')
            }
          }}
        >
          {busy === 'probe' ? <span className="spinner" /> : <Icon name="search" size={13} />} {t('panel.cd9db490c5')} </button>
      </div>
      {eps && <Endpoints list={eps} />}
      <p className="dim small" style={{ marginTop: 8 }}> {t('panel.265d44131b')} <b> {t('panel.a82f2f3671')} </b> {t('panel.baf24d6f0b')} </p>
    </div>
  )
}
