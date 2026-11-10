// SPDX-License-Identifier: AGPL-3.0-only
// Ayarlar → Yerel araçlar → ComfyUI workflow kitaplığı: dosyadan / sürükle-bırak / yapıştırarak ekle, adlandır,
// tercih edilen sunucuyu seç, sunucularda eksik düğüm ve model denetle. Düğümler workflow'u bu listeden seçer.
import { useState, type DragEvent } from 'react'
import type { ComfyFit, ComfyWorkflowEntry } from '../../../shared/types'
import { KIND_LABEL } from '../../../shared/comfyServers'
import { useStore } from '../store'
import { Icon } from './icons'

function FitList({ fits }: { fits: ComfyFit[] }) {
  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {fits.map((f) => (
        <div key={f.serverId} className="small row" style={{ alignItems: 'flex-start' }}>
          <span className={`chip ${f.ok ? 'ok' : f.online ? 'pink' : ''}`} style={{ flex: 'none' }}>
            {f.ok ? '✓' : f.online ? '✗' : '–'} {f.serverName}
          </span>
          <span className="muted" style={{ flex: 1, minWidth: 0 }}>
            {!f.online
              ? `kapalı${f.error ? ` — ${f.error.slice(0, 120)}` : ''}`
              : f.ok
                ? `çalıştırabilir${f.queue ? ` · kuyruk ${f.queue}` : ''}${f.error ? ` · ${f.error}` : ''}`
                : [f.missingNodes.length ? `eksik düğüm: ${f.missingNodes.join(', ')}` : '', f.missingModels.length ? `eksik model: ${f.missingModels.join(', ')}` : ''].filter(Boolean).join(' · ')}
          </span>
        </div>
      ))}
      {fits.some((f) => f.online && !f.ok) && <div className="dim small">Eksikleri o bilgisayardaki ComfyUI Manager’dan kurun (Install Missing Custom Nodes / Model Manager).</div>}
    </div>
  )
}

export default function ComfyLibrary() {
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
      if (added.length) toast(`Eklendi: ${added.map((w) => w.name).join(', ')}`, 'ok')
    })

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const files = [...e.dataTransfer.files].map((f) => window.forge.pathForFile(f)).filter((p) => /\.json$/i.test(p))
    if (files.length) void importFiles(files)
    else toast('Yalnızca .json workflow dosyaları eklenebilir', 'error')
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
          {busy === 'import' ? <span className="spinner" /> : <Icon name="plus" size={13} />} Dosyadan ekle…
        </button>
        <button className="btn" onClick={() => setPaste(paste ? null : { name: '', json: '' })}>
          JSON yapıştır
        </button>
        <span className="dim small">ya da .json dosyalarını buraya sürükleyin</span>
        <span className="spacer" />
        <span className="dim small">Varsayılan</span>
        <select className="input" style={{ width: 220 }} value={s.comfyDefaultWorkflow} onChange={(e) => act('default', () => window.forge.comfy.wf.setDefault(e.target.value))}>
          <option value="">Yerleşik SDXL şablonu</option>
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
            placeholder="Ad (ör. TRELLIS.2 görselden 3D)"
            value={paste.name}
            onChange={(e) => setPaste({ ...paste, name: e.target.value })}
          />
          <textarea
            className="input"
            rows={6}
            style={{ width: '100%', fontFamily: 'Cascadia Mono, Consolas, monospace', fontSize: 12 }}
            placeholder='ComfyUI → Workflow → Export (API) çıktısı: {"3": {"class_type": "KSampler", …}}'
            value={paste.json}
            onChange={(e) => setPaste({ ...paste, json: e.target.value })}
          />
          <div className="row" style={{ marginTop: 6 }}>
            <span className="spacer" />
            <button className="btn ghost" onClick={() => setPaste(null)}>
              Vazgeç
            </button>
            <button
              className="btn primary"
              disabled={!paste.json.trim() || busy === 'paste'}
              onClick={() =>
                act('paste', async () => {
                  const w = await window.forge.comfy.wf.import({ json: paste.json, name: paste.name })
                  setPaste(null)
                  toast(`Eklendi: ${w.name}`, 'ok')
                })
              }
            >
              Ekle
            </button>
          </div>
        </div>
      )}

      {!lib.length && !paste && (
        <div className="set-note">
          <Icon name="flow" size={15} />
          <span>
            Henüz workflow yok. ComfyUI’da workflow’unuzu kurun, <b>Workflow → Export (API)</b> ile kaydedip buraya ekleyin. AssetForge’un dolduracağı düğümlerin başlığını <code>AF:prompt</code>,{' '}
            <code>AF:image</code>, <code>AF:seed</code> … yapabilirsiniz; yoksa tahmin eder.
          </span>
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
              title="Ad"
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== w.name) void act(`name:${w.id}`, () => window.forge.comfy.wf.update(w.id, { name: v }))
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            <select
              className="input"
              style={{ width: 230 }}
              title="Bu workflow’u tercihen hangi sunucu çalıştırsın? Düğümde ayrıca seçilebilir."
              value={w.serverId}
              onChange={(e) => act(`srv:${w.id}`, () => window.forge.comfy.wf.update(w.id, { serverId: e.target.value }))}
            >
              <option value="">Sunucu: düğümün / Ayarlar’ın seçimi</option>
              <option value="auto">Sunucu: Otomatik</option>
              {s.comfyServers.map((x) => (
                <option key={x.id} value={x.id}>
                  Sunucu: {x.name}
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
              <span className="chip" title="Kaydetme düğümü tanınmadı; çıktılar dosya uzantısından anlaşılır">
                çıktı: ?
              </span>
            )}
            <span className="chip cyan" title="AssetForge’un doldurabildiği girişler">
              girişler: {w.roles.length ? w.roles.join(', ') : 'yok'}
            </span>
            <span className="chip" title={w.classTypes.join('\n')}>
              {w.classTypes.length} düğüm türü
            </span>
            {w.models.length > 0 && (
              <span className="chip" title={w.models.join('\n')}>
                {w.models.length} model
              </span>
            )}
            <span className="spacer" />
            <button
              className="btn"
              disabled={busy === `fit:${w.id}`}
              title="Her sunucuda bu workflow’un düğümleri ve modelleri kurulu mu?"
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
              {busy === `fit:${w.id}` ? <span className="spinner" /> : <Icon name="check" size={13} />} Sunucularda denetle
            </button>
            <button
              className="btn ghost"
              title="ComfyUI’da yeniden dışa aktardığınız dosyayla değiştir"
              onClick={async () => {
                const [f] = await window.forge.pickFiles([{ name: 'ComfyUI workflow (API)', extensions: ['json'] }])
                if (f) await act(`rep:${w.id}`, () => window.forge.comfy.wf.replace(w.id, { file: f }), `${w.name} güncellendi`)
              }}
            >
              <Icon name="refresh" size={13} />
            </button>
            <button className="btn ghost" title="Kopyasını oluştur" onClick={() => act(`dup:${w.id}`, () => window.forge.comfy.wf.duplicate(w.id))}>
              <Icon name="plus" size={13} />
            </button>
            <button className="btn ghost" title="Dosyayı klasörde göster" onClick={() => window.forge.comfy.wf.show(w.id)}>
              <Icon name="folder" size={13} />
            </button>
            <button className="btn ghost" title="Kitaplıktan sil" onClick={() => act(`del:${w.id}`, () => window.forge.comfy.wf.remove(w.id), `${w.name} silindi`)}>
              <Icon name="trash" size={14} />
            </button>
          </div>
          {fits[w.id] && <FitList fits={fits[w.id]} />}
        </div>
      ))}
    </div>
  )
}
