// SPDX-License-Identifier: AGPL-3.0-only
import { errorMessage, errorEnvelope } from '../../../shared/i18n/errors'
import { panelLabel } from '../../../shared/i18n/display'
import { message, renderMessage, type UiMessage } from '../../../shared/i18n/message'
import { useLocale } from '../i18n'
// Ayarlar → Yerel araçlar → ComfyUI: bu bilgisayara kurulum, başlat/durdur ve düğüm editörünü açma
import { useCallback, useEffect, useState } from 'react'
import type { ComfyLocalStatus } from '../../../shared/types'
import { useStore } from '../store'
import { Icon } from './icons'

export default function ComfyLocal() {
  const { t, locale } = useLocale()

  const { toast } = useStore()
  const [st, setSt] = useState<ComfyLocalStatus | null>(null)
  const [busy, setBusy] = useState('')
  const [lines, setLines] = useState<UiMessage[]>([])

  const refresh = useCallback(
    () =>
      window.forge.comfy.status().then(setSt, (e: Error) =>
        setSt((prev) => ({
          steps: prev?.steps ?? [],
          healthy: false,
          running: false,
          home: prev?.home ?? '',
          url: prev?.url ?? '',
          remote: false,
          error: e.message,
          uiError: errorEnvelope(e).uiMessage
        }))
      ),
    []
  )
  useEffect(() => {
    refresh()
    const t = window.setInterval(refresh, 8000)
    const off = window.forge.comfy.onLog((l) => setLines((x) => [...x.slice(-300), l]))
    return () => {
      window.clearInterval(t)
      off()
    }
  }, [refresh])

  const step = async (id: string) => {
    setBusy(id)
    setLines((x) => [...x, `▶ ${id}`])
    try {
      await window.forge.comfy.step(id)
      toast(message('setup.stepDone', { service: 'ComfyUI', id }), 'ok')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusy('')
      refresh()
    }
  }

  const led = st?.healthy ? 'on' : st?.running ? 'wait' : ''
  const installed = !!st && st.steps.length > 0 && st.steps.filter((s) => s.id !== 'start').every((s) => s.done)
  const next = st?.steps.find((s) => !s.done)
  return (
    <div className="comfy-local">
      <div className="svc">
        <span className={`led ${led}`} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{st?.healthy ? t('panel.ddfa4c630d') : st?.running ? t('panel.658bc0d097') : t('panel.f5ae2a887b')}</b>
          <div className="muted small ellipsis">
            {st?.healthy ? st.info : renderMessage(locale, st?.uiError ?? st?.error ?? (st?.remote ? t('setup.remote', { url: st.url }) : t('setup.local', { path: st?.home ?? '…' })))}
          </div>
        </div>
        {st?.healthy && (
          <button className="btn" onClick={() => window.forge.comfy.open()} title={t('panel.d292c9cc8d')}>
            <Icon name="link" size={13} /> {t('panel.a191a73c56')}{' '}
          </button>
        )}
        {!st?.remote &&
          (st?.healthy || st?.running ? (
            <button className="btn" disabled={!!busy} onClick={() => step('stop')}>
              {' '}
              {t('panel.5769a8f8ae')}{' '}
            </button>
          ) : (
            <button className="btn primary" disabled={!!busy || !installed} onClick={() => step('start')}>
              {busy === 'start' ? <span className="spinner" /> : <Icon name="play" size={13} />} {t('panel.24fa59605d')}{' '}
            </button>
          ))}
      </div>
      {!st?.remote && (
        <div className="steps">
          {st?.steps.map((s, i) => (
            <div key={s.id} className={`step ${s.done ? 'done' : ''}`}>
              <span className="dot">{s.done ? <Icon name="check" size={11} strokeWidth={3} /> : i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>{panelLabel(locale, s.label)}</div>
                {s.hint && <div className="dim small">{panelLabel(locale, s.hint)}</div>}
              </div>
              {s.id !== 'start' && (
                <button className={`btn ${next?.id === s.id ? 'primary' : ''}`} disabled={!!busy} onClick={() => step(s.id)} style={{ height: 28 }}>
                  {busy === s.id ? <span className="spinner" /> : s.done ? t('setup.repeat') : t('setup.install')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {(lines.length > 0 || busy) && <div className="console">{lines.map((line) => renderMessage(locale, line)).join('\n')}</div>}
      {!st?.remote && (
        <button className="btn ghost" style={{ marginTop: 6 }} onClick={async () => setLines((await window.forge.comfy.logs()).split(/\r?\n/).slice(-200))}>
          <Icon name="terminal" size={14} /> {t('panel.0b754b0278')}{' '}
        </button>
      )}
    </div>
  )
}
