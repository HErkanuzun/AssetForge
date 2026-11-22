import {message} from '../../../shared/i18n/message'
import { useLocale } from '../i18n'
// SPDX-License-Identifier: AGPL-3.0-only
// Ayarlar → Yerel araçlar → ComfyUI workflow kitaplığı: dosyadan / sürükle-bırak / yapıştırarak ekle, adlandır,
// tercih edilen sunucuyu seç, sunucularda eksik düğüm ve model denetle. Düğümler workflow'u bu listeden seçer.
import { useState, type DragEvent } from 'react'
import type { ComfyFit, ComfyWorkflowEntry } from '../../../shared/types'
import { KIND_LABEL } from '../../../shared/comfyServers'
import { useStore } from '../store'
import { Icon } from './icons'

function FitList({ fits }: { fits: ComfyFit[] }) {
  const {t} = useLocale()

  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {fits.map((f) => (
        <div key={f.serverId} className="small row" style={{ alignItems: 'flex-start' }}>
          <span className={`chip ${f.ok ? 'ok' : f.online ? 'pink' : ''}`} style={{ flex: 'none' }}>
            {f.ok ? '✓' : f.online ? '✗' : '–'} {f.serverName}
          </span>
          <span className="muted" style={{ flex: 1, minWidth: 0 }}>
            {!f.online
              ? `${t('comfy.off')}${f.error ? ` — ${f.error.slice(0, 120)}` : ''}`
              : f.ok
                ? `${t('comfy.canRun')}${f.queue ? t('comfy.queue', {count:f.queue}) : ''}${f.error ? ` · ${f.error}` : ''}`
                : [f.missingNodes.length ? t('comfy.missingNodes', {list:f.missingNodes.join(', ')}) : '', f.missingModels.length ? t('comfy.missingModels', {list:f.missingModels.join(', ')}) : ''].filter(Boolean).join(' · ')}
          </span>
        </div>
      ))}
      {fits.some((f) => f.online && !f.ok) && <div className="dim small"> {t('panel.a5ffec3085')} </div>}
    </div>
  )
}

export default function ComfyLibrary() {
  const {t} = useLocale()

  const { settings, setSettings, toast } = useStore()
  const s = settings!
  const [busy, setBusy] = useState('')
  const [paste, setPaste] = useState<{ name: string; json: string } | null>(null)
  const [fits, setFits] = useState<Record<string, ComfyFit[]>>({})
  const [drag, setDrag] = useState(false)

  const reload = async () => setSettings(await window.forge.settings.get())
  const act = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key)
    try {
      await fn()
      if (ok) toast(ok, 'ok')
    } catch (e) {
      toast((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), 'error')
    } finally {
      setBusy('')
      await reload()
    }
  }

  const importFiles = (files: string[]) =>
    act('import', async () => {
      const added: ComfyWorkflowEntry[] = []
      for (const f of files) added.push(await window.forge.comfy.wf.import({ file: f }))
      if (added.length) toast(message('comfy.added', {name:added.map(w=>w.name).join(', ')}), 'ok')
    })

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const files = [...e.dataTransfer.files].filter((f) => /\.json$/i.test(f.name))
    if (files.length) Promise.all(files.map((f) => window.forge.dropFile(f))).then(importFiles, (err: Error) => toast(err.message, 'error'))
    else toast(message('panel.0099439f4e'), 'error')
  }

  const lib = s.comfyWorkflows
  return (
    <div
      className={`comfy-lib ${drag ? 'drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      style={drag ? { outline: '2px dashed var(--accent)', outlineOffset: 4, borderRadius: 10 } : undefined}
    >
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
        <button className="btn primary" disabled={busy === 'import'} onClick={async () => importFiles(await window.forge.pickFiles([{ name: 'ComfyUI workflow (API)', extensions: ['json'] }], true))}>
          {busy === 'import' ? <span className="spinner" /> : <Icon name="plus" size={13} />} {t('panel.662d2760c7')} </button>
        <button className="btn" onClick={() => setPaste(paste ? null : { name: '', json: '' })}> {t('panel.c898c04548')} </button>
        <span className="dim small"> {t('panel.acfcab5145')} </span>
        <span className="spacer" />
        <span className="dim small"> {t('panel.006ac77b36')} </span>
        <select className="input" style={{ width: 220 }} value={s.comfyDefaultWorkflow} onChange={(e) => act('default', () => window.forge.comfy.wf.setDefault(e.target.value))}>
          <option value=""> {t('panel.2bf4175235')} </option>
          {lib.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      {paste && (
        <div className="mcp-row">
          <input
            className="input"
            style={{ width: '100%', marginBottom: 6 }}
            placeholder={t('panel.5aace6ffd8')}
            value={paste.name}
            onChange={(e) => setPaste({ ...paste, name: e.target.value })}
          />
          <textarea
            className="input"
            rows={6}
            style={{ width: '100%', fontFamily: 'Cascadia Mono, Consolas, monospace', fontSize: 12 }}
            placeholder={t('comfy.jsonPlaceholder')}
            value={paste.json}
            onChange={(e) => setPaste({ ...paste, json: e.target.value })}
          />
          <div className="row" style={{ marginTop: 6 }}>
            <span className="spacer" />
            <button className="btn ghost" onClick={() => setPaste(null)}> {t('panel.39a8d28c1c')} </button>
            <button
              className="btn primary"
              disabled={!paste.json.trim() || busy === 'paste'}
              onClick={() =>
                act('paste', async () => {
                  const w = await window.forge.comfy.wf.import({ json: paste.json, name: paste.name })
                  setPaste(null)
                  toast(message('comfy.added', {name:w.name}), 'ok')
                })
              }
            > {t('panel.f560a85f28')} </button>
          </div>
        </div>
      )}

      {!lib.length && !paste && (
        <div className="set-note">
          <Icon name="flow" size={15} />
          <span> {t('panel.aa07947909')} <b>Workflow → Export (API)</b> {t('panel.143e0a7247')} <code>AF:prompt</code>,{' '}
            <code>AF:image</code>, <code>AF:seed</code> {t('panel.aa2e6c9d1a')} </span>
        </div>
      )}

      {lib.map((w) => (
        <div key={w.id} className="mcp-row">
          <div className="row" style={{ marginBottom: 6 }}>
            <input
              key={`${w.id}:${w.name}`}
              className="input"
              style={{ flex: 1 }}
              defaultValue={w.name}
              title={t('surface.name')}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== w.name) void act(`name:${w.id}`, () => window.forge.comfy.wf.update(w.id, { name: v }))
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            <select
              className="input"
              style={{ width: 230 }}
              title={t('panel.1e83cb4ed7')}
              value={w.serverId}
              onChange={(e) => act(`srv:${w.id}`, () => window.forge.comfy.wf.update(w.id, { serverId: e.target.value }))}
            >
              <option value=""> {t('panel.9050739103')} </option>
              <option value="auto"> {t('panel.22e7dd248d')} </option>
              {s.comfyServers.map((x) => (
                <option key={x.id} value={x.id}> {t('panel.a79d5985e0')} {x.name}
                </option>
              ))}
            </select>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {w.produces.length ? (
              w.produces.map((k) => (
                <span key={k} className="chip accent">
                  {KIND_LABEL[k]}
                </span>
              ))
            ) : (
              <span className="chip" title={t('panel.e7a5327d5a')}> {t('panel.adbaf76e3a')} </span>
            )}
            <span className="chip cyan" title={t('panel.f2500b10fb')}> {t('panel.4af6d574cd')} {w.roles.length ? w.roles.join(', ') : 'yok'}
            </span>
            <span className="chip" title={w.classTypes.join('\n')}>
              {w.classTypes.length} {t('panel.696a122136')} </span>
            {w.models.length > 0 && (
              <span className="chip" title={w.models.join('\n')}>
                {w.models.length} {t('panel.9372c470ee')} </span>
            )}
            <span className="spacer" />
            <button
              className="btn"
              disabled={busy === `fit:${w.id}`}
              title={t('panel.23f7d72164')}
              onClick={async () => {
                setBusy(`fit:${w.id}`)
                try {
                  const r = await window.forge.comfy.wf.fit(w.id)
                  setFits((f) => ({ ...f, [w.id]: r }))
                } catch (e) {
                  toast((e as Error).message, 'error')
                } finally {
                  setBusy('')
                }
              }}
            >
              {busy === `fit:${w.id}` ? <span className="spinner" /> : <Icon name="check" size={13} />} {t('panel.c812701f2d')} </button>
            <button
              className="btn ghost"
              title={t('panel.58f10c66ea')}
              onClick={async () => {
                const [f] = await window.forge.pickFiles([{ name: 'ComfyUI workflow (API)', extensions: ['json'] }])
                if (f) await act(`rep:${w.id}`, () => window.forge.comfy.wf.replace(w.id, { file: f }), t('comfy.updated', {name:w.name}))
              }}
            >
              <Icon name="refresh" size={13} />
            </button>
            <button className="btn ghost" title={t('panel.e662361c4f')} onClick={() => act(`dup:${w.id}`, () => window.forge.comfy.wf.duplicate(w.id))}>
              <Icon name="plus" size={13} />
            </button>
            <button className="btn ghost" title={t('panel.2fbdba3ba5')} onClick={() => window.forge.comfy.wf.show(w.id)}>
              <Icon name="folder" size={13} />
            </button>
            <button className="btn ghost" title={t('panel.4a4c6d6e3d')} onClick={() => act(`del:${w.id}`, () => window.forge.comfy.wf.remove(w.id), `${w.name} silindi`)}>
              <Icon name="trash" size={14} />
            </button>
          </div>
          {fits[w.id] && <FitList fits={fits[w.id]} />}
        </div>
      ))}
    </div>
  )
}
