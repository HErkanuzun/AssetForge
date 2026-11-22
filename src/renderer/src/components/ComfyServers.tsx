import {message} from '../../../shared/i18n/message'
import { useLocale } from '../i18n'
// SPDX-License-Identifier: AGPL-3.0-only
// Ayarlar → Yerel araçlar → ComfyUI sunucuları: bu bilgisayar, ağdaki diğer bilgisayarlar, uzak GPU.
// Her satırda ad ve adres doğrudan düzenlenir; token şifreli saklanır. Düğümler "Otomatik" ya da bir sunucu seçer.
import { useCallback, useEffect, useState } from 'react'
import type { ComfyServer, ComfyServerState, SettingsPatch } from '../../../shared/types'
import { normalizeComfyUrl } from '../../../shared/comfyServers'
import { useStore } from '../store'
import { Icon } from './icons'
import { Toggle } from './ui'

const rid = () => `cs_${Math.random().toString(36).slice(2, 8)}`
const strip = (list: (ComfyServer & { hasToken?: boolean })[]): ComfyServer[] => list.map(({ id, name, url, enabled, managed }) => ({ id, name, url, enabled, managed }))

export default function ComfyServers() {
  const {t} = useLocale()

  const { settings, setSettings, toast } = useStore()
  const s = settings!
  const [states, setStates] = useState<Record<string, ComfyServerState>>({})
  const [found, setFound] = useState<{ url: string; info: string; known: boolean }[] | null>(null)
  const [tokens, setTokens] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')

  const patch = async (p: SettingsPatch) => setSettings(await window.forge.settings.set(p))
  const setServers = (list: (ComfyServer & { hasToken?: boolean })[]) => patch({ comfyServers: strip(list) })
  const edit = (id: string, ch: Partial<ComfyServer>) => setServers(s.comfyServers.map((x) => (x.id === id ? { ...x, ...ch } : x)))

  const refresh = useCallback(async () => {
    try {
      const list = await window.forge.comfy.servers()
      setStates(Object.fromEntries(list.map((x) => [x.id, x])))
    } catch {
      /* bir sonraki turda */
    }
  }, [])
  useEffect(() => {
    void refresh()
    const t = window.setInterval(refresh, 10000)
    return () => window.clearInterval(t)
  }, [refresh])

  const test = async (x: ComfyServer) => {
    setBusy(`test:${x.id}`)
    try {
      const info = await window.forge.testComfy(x.id, { url: x.url, token: tokens[x.id] || undefined })
      toast(`${x.name}: ${info}`, 'ok')
    } catch (e) {
      toast(`${x.name}: ${(e as Error).message}`, 'error')
    } finally {
      setBusy('')
      void refresh()
    }
  }

  const saveToken = async (id: string, value: string) => {
    await patch({ comfyTokens: { [id]: value } })
    setTokens((t) => ({ ...t, [id]: '' }))
    toast(value ? 'Token kaydedildi' : 'Token silindi', 'ok')
    void refresh()
  }

  const discover = async () => {
    setBusy('discover')
    try {
      const list = await window.forge.comfy.discover()
      setFound(list)
      if (!list.length) toast(message('panel.e24b716d14'), 'info')
    } finally {
      setBusy('')
    }
  }

  const add = (url = '', name = '') => {
    const n = s.comfyServers.filter((x) => !x.managed).length + 1
    void setServers([...s.comfyServers, { id: rid(), name: name || `ComfyUI ${n}`, url, enabled: true }])
  }

  return (
    <div className="comfy-servers">
      {s.comfyServers.map((x) => {
        const st = states[x.id]
        const led = st?.online ? 'on' : ''
        return (
          <div key={x.id} className="mcp-row">
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="svc" style={{ padding: 0, margin: 0, border: 0, background: 'none' }}>
                <span className={`led ${led}`} title={st?.online ? t('panel.bbb1132f30') : (st?.error ?? t('comfy.off'))} />
              </span>
              <input className="input" style={{ width: 200 }} value={x.name} title={t('surface.name')} onChange={(e) => edit(x.id, { name: e.target.value })} />
              <input
                className="input"
                style={{ flex: 1 }}
                value={x.url}
                placeholder="http://192.168.1.20:8188"
                title={t('panel.32c6bebf1c')}
                onChange={(e) => edit(x.id, { url: e.target.value })}
                onBlur={(e) => {
                  const v = normalizeComfyUrl(e.target.value)
                  if (v !== x.url) void edit(x.id, { url: v })
                }}
              />
              <button className="btn" disabled={busy === `test:${x.id}` || !x.url.trim()} onClick={() => test(x)}>
                {busy === `test:${x.id}` ? <span className="spinner" /> : 'Test et'}
              </button>
              {st?.online && (
                <button className="btn" title={t('panel.a2b2a0847b')} onClick={() => window.forge.comfy.open(x.id)}>
                  <Icon name="link" size={13} /> {t('panel.dcc084f9a2')} </button>
              )}
              {!x.managed && (
                <button className="btn ghost" title={t('panel.3ff47d4e64')} onClick={() => setServers(s.comfyServers.filter((y) => y.id !== x.id))}>
                  <Icon name="trash" size={14} />
                </button>
              )}
            </div>
            <div className="row">
              <Toggle value={x.enabled} onChange={(v) => edit(x.id, { enabled: v })} label={t('panel.de91313104')} />
              {x.managed && <span className="chip"> {t('panel.0f446b11bb')} </span>}
              {st?.online ? (
                <span className="chip ok ellipsis" style={{ maxWidth: 340 }} title={st.info}>
                  {st.info}
                  {st.queue ? ` · kuyruk ${st.queue}` : ''}
                </span>
              ) : (
                st?.error && (
                  <span className={`chip ${x.managed ? '' : 'pink'} ellipsis`} style={{ maxWidth: 340 }} title={st.error}>
                    {/token|reddetti|ComfyUI değil/.test(st.error) ? st.error : x.managed ? t('panel.c62801f0e9') : t('panel.21f7d98117')}
                  </span>
                )
              )}
              <span className="spacer" />
              {!x.managed &&
                (x.hasToken ? (
                  <>
                    <span className="chip ok"> {t('panel.62e1011e4e')} </span>
                    <button className="btn ghost" onClick={() => saveToken(x.id, '')}> {t('panel.f698e9b40f')} </button>
                  </>
                ) : (
                  <>
                    <input
                      className="input"
                      type="password"
                      style={{ width: 200 }}
                      placeholder={t('panel.224504476b')}
                      title={t('panel.41510661f9')}
                      value={tokens[x.id] ?? ''}
                      onChange={(e) => setTokens((t) => ({ ...t, [x.id]: e.target.value }))}
                    />
                    <button className="btn" disabled={!tokens[x.id]?.trim()} onClick={() => saveToken(x.id, tokens[x.id])}> {t('panel.c1fe2ecdff')} </button>
                  </>
                ))}
            </div>
          </div>
        )
      })}

      <div className="row" style={{ flexWrap: 'wrap', margin: '4px 0 10px' }}>
        <button className="btn" onClick={() => add()}>
          <Icon name="plus" size={13} /> {t('panel.06251617d6')} </button>
        <button className="btn" disabled={busy === 'discover'} onClick={discover} title={t('panel.701930f901')}>
          {busy === 'discover' ? <span className="spinner" /> : <Icon name="search" size={13} />} {t('panel.f42312b5c1')} </button>
        <span className="spacer" />
        <span className="dim small"> {t('panel.8617ed5b97')} </span>
        <select className="input" style={{ width: 220 }} value={s.comfyDefaultServer || 'auto'} onChange={(e) => patch({ comfyDefaultServer: e.target.value })}>
          <option value="auto"> {t('panel.ee1cd50e94')} </option>
          {s.comfyServers.map((x) => (
            <option key={x.id} value={x.id}>
              {x.enabled ? x.name : t('comfy.disabledName', {name:x.name})}
            </option>
          ))}
        </select>
      </div>

      {found && found.length > 0 && (
        <div className="set-note" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          {found.map((f) => (
            <div key={f.url} className="row">
              <Icon name="check" size={14} />
              <span style={{ flex: 1 }}>
                <b>{f.url}</b> <span className="muted small">{f.info}</span>
              </span>
              {f.known ? (
                <span className="dim small"> {t('panel.201d61974b')} </span>
              ) : (
                <button
                  className="btn"
                  onClick={() => {
                    add(f.url, f.url.endsWith(':8000') ? 'ComfyUI Desktop' : t('panel.980cd6869f'))
                    setFound(found.map((y) => (y.url === f.url ? { ...y, known: true } : y)))
                  }}
                >
                  <Icon name="plus" size={13} /> {t('panel.f560a85f28')} </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="dim small">
        <b> {t('panel.ee1cd50e94')} </b> {t('panel.334e66d8e3')} <code>--listen 0.0.0.0</code> {t('panel.2a5249f17f')} </p>
    </div>
  )
}
