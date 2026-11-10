// SPDX-License-Identifier: AGPL-3.0-only
// Ayarlar → Yerel araçlar → Özel arka uçlar: git deposundan bir yapay zekâ projesi ekle, kurulum tarifini gözden geçir,
// onaylayıp kur, başlat/durdur. Gradio uygulamalarının uç noktalarını ve girişlerin nasıl eşleneceğini gösterir.
import { useCallback, useEffect, useState } from 'react'
import type { BackendStatus, CustomBackend, GradioEndpointInfo } from '../../../shared/types'
import { recipeToJson } from '../../../shared/backends'
import { useStore } from '../store'
import { Icon } from './icons'

const ROLE_LABEL: Record<string, string> = { prompt: 'prompt', negative: 'negatif', seed: 'seed', seconds: 'süre', image: 'görsel', model: '3D model', audio: 'ses', file: 'dosya' }
const clean = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

function Endpoints({ list }: { list: GradioEndpointInfo[] }) {
  if (!list.length) return <div className="dim small">API’ye açık uç nokta yok.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
      {list.map((ep) => (
        <div key={ep.name} className="small">
          <code>{ep.name}</code>{' '}
          <span className="muted">
            {ep.params.map((p) => `${p.name}${p.role ? ` ← ${ROLE_LABEL[p.role] ?? p.role}` : p.hasDefault ? ` = ${JSON.stringify(p.default)?.slice(0, 24)}` : ''}`).join(' · ') || 'giriş yok'}
            {' → '}
            {ep.returns.map((r) => r.component || r.label).join(', ') || '?'}
          </span>
        </div>
      ))}
      <div className="dim small">“← prompt” gibi oklar AssetForge’un o girişe ne yazacağını gösterir; diğerleri varsayılanla gider. Düğümdeki “Sabit değerler (JSON)” ile değiştirebilirsiniz.</div>
    </div>
  )
}

function Row({ b, st, refresh }: { b: CustomBackend; st?: BackendStatus; refresh: () => Promise<void> }) {
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
  const saveRecipe = () => act('save', () => window.forge.backends.setRecipe(b.id, json), 'Tarif kaydedildi')
  const led = st?.healthy ? 'on' : st?.running ? 'wait' : ''
  const state = !st
    ? '…'
    : st.healthy
      ? `çalışıyor · ${st.url}`
      : st.running
        ? 'açılıyor…'
        : st.installed
          ? st.stale
            ? 'tarif değişti: yeniden kurun'
            : 'kurulu · kapalı'
          : st.cloned
            ? 'indirildi · kurulmadı'
            : 'depo yok'

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
          <button className="btn" disabled={!!busy} onClick={() => act('stop', () => window.forge.backends.stop(b.id))}>
            Durdur
          </button>
        ) : (
          st?.installed &&
          !st.stale && (
            <button className="btn primary" disabled={!!busy} onClick={() => act('start', () => window.forge.backends.start(b.id), `${b.name} hazır`)}>
              {busy === 'start' ? <span className="spinner" /> : <Icon name="play" size={13} />} Başlat
            </button>
          )
        )}
        {st?.healthy && (
          <button className="btn" title="Uygulamayı tarayıcıda aç" onClick={() => window.forge.backends.open(b.id)}>
            <Icon name="link" size={13} /> Aç
          </button>
        )}
        <button className={`btn ${!st?.installed || st.stale ? 'primary' : ''}`} disabled={!!busy || dirty} title={dirty ? 'Önce tarifi kaydedin' : undefined} onClick={() => setConfirm(true)}>
          {busy === 'install' ? <span className="spinner" /> : st?.installed ? 'Yeniden kur' : 'Kur'}
        </button>
        <button className="btn ghost" title="Tarif" onClick={() => setOpen(!open)}>
          <Icon name="settings" size={14} />
        </button>
        <button className="btn ghost" title="Klasörü aç" onClick={() => window.forge.backends.folder(b.id)}>
          <Icon name="folder" size={14} />
        </button>
        <button
          className="btn ghost"
          title="Kaldır (klasörü ve indirilen dosyaları siler)"
          disabled={!!busy}
          onClick={() => act('remove', () => window.forge.backends.remove(b.id), `${b.name} kaldırıldı`)}
        >
          <Icon name="trash" size={14} />
        </button>
      </div>

      {confirm && (
        <div className="set-note warn" style={{ flexDirection: 'column', alignItems: 'stretch', marginTop: 8 }}>
          <b>Bu komutlar bilgisayarınızda, deponun klasöründe tam yetkiyle çalışacak:</b>
          <div className="console" style={{ maxHeight: 160 }}>
            {[
              `git clone ${b.recipe.repo}${b.recipe.ref ? ` (${b.recipe.ref})` : ''}`,
              ...(b.recipe.python ? [`uv venv --python ${b.recipe.python}`] : []),
              ...b.recipe.install,
              `başlatma: ${b.recipe.start}`
            ].join('\n')}
          </div>
          <span className="small">Yalnızca güvendiğiniz depoları kurun. Kurulum indirme boyutuna göre uzun sürebilir.</span>
          <div className="row">
            <span className="spacer" />
            <button className="btn ghost" onClick={() => setConfirm(false)}>
              Vazgeç
            </button>
            <button
              className="btn primary"
              onClick={() => {
                setConfirm(false)
                setLines([])
                void act('install', () => window.forge.backends.install(b.id), `${b.name} kuruldu`)
              }}
            >
              Onayla ve kur
            </button>
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
              <code>{'{uv}'}</code> <code>{'{python}'}</code> <code>{'{port}'}</code> <code>{'{repo}'}</code> yer tutucuları doldurulur. Modeller <code>_hf</code> ortak önbelleğine iner. Bu tarifi
              depoya <code>assetforge.json</code> olarak koyarsanız herkes tek tıkla kurar.
            </span>
            {dirty && (
              <button className="btn ghost" onClick={() => setJson(recipeToJson(b.recipe))}>
                Geri al
              </button>
            )}
            <button className="btn" disabled={!dirty || busy === 'save'} onClick={saveRecipe}>
              Tarifi kaydet
            </button>
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
            {busy === 'eps' ? <span className="spinner" /> : <Icon name="list" size={13} />} Uç noktaları göster
          </button>
        )}
        <button className="btn ghost" onClick={async () => setLines((await window.forge.backends.logs(b.id)).split(/\r?\n/).slice(-200))}>
          <Icon name="terminal" size={13} /> Sunucu günlüğü
        </button>
      </div>
      {eps && <Endpoints list={eps} />}
      {lines.length > 0 && <div className="console">{lines.join('\n')}</div>}
    </div>
  )
}

export default function CustomBackends() {
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
      toast(`${r.backend.name} indirildi; tarifi gözden geçirip “Kur”a basın`, 'ok')
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
          placeholder="https://github.com/kullanıcı/proje"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && url.trim() && add()}
        />
        <button className="btn primary" disabled={!url.trim() || busy === 'add'} onClick={add}>
          {busy === 'add' ? <span className="spinner" /> : <Icon name="plus" size={13} />} Depodan ekle
        </button>
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
          placeholder="Çalışan bir Gradio uygulamasını incele: http://127.0.0.1:7860 ya da https://…hf.space"
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
          {busy === 'probe' ? <span className="spinner" /> : <Icon name="search" size={13} />} İncele
        </button>
      </div>
      {eps && <Endpoints list={eps} />}
      <p className="dim small" style={{ marginTop: 8 }}>
        Kurulan arka uçlar ve adresini bildiğiniz Gradio uygulamaları (Pinokio, başka bir bilgisayar, Hugging Face Space) hatlarda <b>Gradio Uygulaması</b> düğümüyle kullanılır. Depo kodu bu
        bilgisayarda sizin yetkinizle çalışır; yalnızca güvendiğiniz projeleri kurun.
      </p>
    </div>
  )
}
