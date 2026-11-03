// SPDX-License-Identifier: AGPL-3.0-only
import { type ReactNode, useState } from 'react'

export function Field({ label, help, children, wide }: { label: string; help?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {help && <span className="field-help">{help}</span>}
    </label>
  )
}

export function TextInput(props: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input className="input" type={props.type ?? 'text'} value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
}

export function NumberInput(props: { value: number; onChange: (v: number) => void; step?: number }) {
  return <input className="input" type="number" step={props.step ?? 1} value={Number.isFinite(props.value) ? props.value : 0} onChange={(e) => props.onChange(Number(e.target.value))} />
}

export function TextArea(props: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return <textarea className="input" rows={props.rows ?? 3} value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
}

export function Select(props: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select className="input" value={props.value} onChange={(e) => props.onChange(e.target.value)}>
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Toggle(props: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" className={`toggle ${props.value ? 'on' : ''}`} onClick={() => props.onChange(!props.value)}>
      <span className="knob" />
      {props.label && <span>{props.label}</span>}
    </button>
  )
}

/** Async işlemlerde kendi "çalışıyor" durumunu yöneten buton */
export function AsyncButton(props: { onClick: () => Promise<unknown>; children: ReactNode; className?: string; disabled?: boolean; title?: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      className={`btn ${props.className ?? ''}`}
      title={props.title}
      disabled={busy || props.disabled}
      onClick={async () => {
        setBusy(true)
        try {
          await props.onClick()
        } finally {
          setBusy(false)
        }
      }}
    >
      {busy ? <span className="spinner" /> : null}
      {props.children}
    </button>
  )
}

export function StatusPill({ status }: { status: string }) {
  const labels: Record<string, string> = {
    queued: 'sırada',
    running: 'çalışıyor',
    done: 'bitti',
    failed: 'hata',
    canceled: 'iptal',
    skipped: 'atlandı',
    retrying: 'yeniden',
    idle: 'bekliyor'
  }
  return <span className={`pill s-${status}`}>{labels[status] ?? status}</span>
}
