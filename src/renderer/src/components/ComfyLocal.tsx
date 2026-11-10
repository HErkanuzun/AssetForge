// SPDX-License-Identifier: AGPL-3.0-only
// Ayarlar → Yerel araçlar → ComfyUI: bu bilgisayara kurulum, başlat/durdur ve düğüm editörünü açma
import { useCallback, useEffect, useState } from 'react'
import type { ComfyLocalStatus } from '../../../shared/types'
import { useStore } from '../store'
import { Icon } from './icons'

export default function ComfyLocal() {
  const { toast } = useStore()
  const [st, setSt] = useState<ComfyLocalStatus | null>(null)
  const [busy, setBusy] = useState('')
  const [lines, setLines] = useState<string[]>([])

  const refresh = useCallback(
    () =>
      window.forge.comfy
        .status()
        .then(setSt, (e: Error) => setSt((prev) => ({ steps: prev?.steps ?? [], healthy: false, running: false, home: prev?.home ?? '', url: prev?.url ?? '', remote: false, error: e.message }))),
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
      toast(`ComfyUI: ${id} tamam`, 'ok')
    } catch (e) {
      toast((e as Error).message, 'error')
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
          <b>{st?.healthy ? 'ComfyUI çalışıyor' : st?.running ? 'ComfyUI açılıyor…' : 'ComfyUI kapalı'}</b>
          <div className="muted small ellipsis">{st?.healthy ? st.info : (st?.error ?? (st?.remote ? `Uzak sunucu: ${st.url}` : `Bu bilgisayarda: ${st?.home ?? '…'}`))}</div>
        </div>
        {st?.healthy && (
          <button className="btn" onClick={() => window.forge.comfy.open()} title="ComfyUI’ın düğüm editörünü tarayıcıda açar; workflow’larınızı orada kurup Export (API) ile kaydedin">
            <Icon name="link" size={13} /> Düğüm editörünü aç
          </button>
        )}
        {!st?.remote &&
          (st?.healthy || st?.running ? (
            <button className="btn" disabled={!!busy} onClick={() => step('stop')}>
              Durdur
            </button>
          ) : (
            <button className="btn primary" disabled={!!busy || !installed} onClick={() => step('start')}>
              {busy === 'start' ? <span className="spinner" /> : <Icon name="play" size={13} />} Başlat
            </button>
          ))}
      </div>
      {!st?.remote && (
        <div className="steps">
          {st?.steps.map((s, i) => (
            <div key={s.id} className={`step ${s.done ? 'done' : ''}`}>
              <span className="dot">{s.done ? <Icon name="check" size={11} strokeWidth={3} /> : i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>{s.label}</div>
                {s.hint && <div className="dim small">{s.hint}</div>}
              </div>
              {s.id !== 'start' && (
                <button className={`btn ${next?.id === s.id ? 'primary' : ''}`} disabled={!!busy} onClick={() => step(s.id)} style={{ height: 28 }}>
                  {busy === s.id ? <span className="spinner" /> : s.done ? 'Tekrar' : 'Kur'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {(lines.length > 0 || busy) && <div className="console">{lines.join('\n')}</div>}
      {!st?.remote && (
        <button className="btn ghost" style={{ marginTop: 6 }} onClick={async () => setLines((await window.forge.comfy.logs()).split(/\r?\n/).slice(-200))}>
          <Icon name="terminal" size={14} /> Sunucu günlüğü
        </button>
      )}
    </div>
  )
}
