import {message} from '../../../shared/i18n/message'
import { assetStatus } from '../../../shared/i18n/display'
import { useLocale } from '../i18n'
// SPDX-License-Identifier: AGPL-3.0-only
import { useMemo, useState } from 'react'
import type { AssetKind, AssetSpec } from '../../../shared/types'
import { AsyncButton, Field, NumberInput, Select, TextArea, TextInput } from '../components/ui'
import { useStore } from '../store'
import { suggestPipeline } from '../../../shared/templates'

export const KIND_LABEL: Record<AssetKind, string> = {
  model: '3D model',
  character: 'Karakter',
  creature: 'Yaratık',
  vehicle: 'Araç',
  weapon: 'Silah',
  texture: 'Doku',
  image: 'Görsel',
  sfx: 'Ses efekti',
  music: 'Müzik',
  vfx: 'VFX',
  animation: 'Animasyon'
}

export default function AssetsPage({ goJobs }: { goPipeline: () => void; goJobs: () => void }) {
  const { t, locale } = useLocale()

  const { project, update, toast, selectedAssets, setSelectedAssets, saveNow } = useStore()
  const kindLabels = Object.fromEntries((Object.keys(KIND_LABEL) as AssetKind[]).map(kind => [kind, t(`kind.${kind}`)])) as Record<AssetKind, string>
  const p = project!
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [prio, setPrio] = useState('')
  const [status, setStatus] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [pipelineId, setPipelineId] = useState('')

  const priorities = useMemo(() => [...new Set(p.assets.map((a) => a.priority).filter(Boolean))].sort(), [p.assets])
  const statuses = useMemo(() => [...new Set(p.assets.map((a) => a.status).filter(Boolean))].sort(), [p.assets])
  const filtered = useMemo(() => {
    const needle = q.toLocaleLowerCase(locale)
    return p.assets.filter(
      (a) =>
        (!kind || a.kind === kind) &&
        (!prio || a.priority === prio) &&
        (!status || a.status === status) &&
        (!needle || `${a.id} ${a.name} ${a.description} ${a.category} ${a.subcategory}`.toLocaleLowerCase(locale).includes(needle))
    )
  }, [p.assets, q, kind, prio, status, locale])

  const selected = new Set(selectedAssets)
  const toggle = (id: string) => setSelectedAssets(selected.has(id) ? selectedAssets.filter((x) => x !== id) : [...selectedAssets, id])
  const allVisibleSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id))
  const open = p.assets.find((a) => a.id === openId)
  const edit = (id: string, patch: Partial<AssetSpec>) => update((pr) => ({ ...pr, assets: pr.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))

  const selAssets = p.assets.filter((a) => selected.has(a.id))
  const kindCounts = selAssets.reduce<Record<string, number>>((m, a) => ((m[a.kind] = (m[a.kind] ?? 0) + 1), m), {})
  const dominant = (Object.entries(kindCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as AssetKind) ?? 'model'
  const suggested =
    p.pipelines.find((pl) => pl.id === (selAssets.find((a) => a.kind === dominant) ? suggestPipeline(selAssets.find((a) => a.kind === dominant)!) : suggestPipeline({ kind: dominant })))?.id ??
    p.pipelines[0]?.id ??
    ''
  const runPipeline = pipelineId || suggested

  const importFile = async () => {
    const [file] = await window.forge.pickFiles([{ name: t('surface.assetFilter'), extensions: ['xlsx', 'csv', 'tsv'] }])
    if (!file) return
    try {
      const r = await window.forge.importAssets(file)
      update((pr) => {
        const byId = new Map(pr.assets.map((a) => [a.id, a]))
        for (const a of r.assets) {
          const old = byId.get(a.id)
          byId.set(a.id, old?.status === 'Üretildi' ? { ...a, status: old.status } : a)
        }
        return {
          ...pr,
          assets: [...byId.values()],
          bible: {
            ...pr.bible,
            palette: r.palette.length ? r.palette : pr.bible.palette,
            materials: r.materials.length ? r.materials : pr.bible.materials
          }
        }
      })
      const summary = r.sheets
        .filter((s) => s.rows)
        .map((s) => `${s.name}: ${s.rows}`)
        .join(' · ')
      toast(message('surface.imported', { summary }), 'ok')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const run = async () => {
    await saveNow()
    const jobs = await window.forge.run.start(runPipeline, selectedAssets)
    toast(message('surface.queued', { count: jobs.length }), 'ok')
    goJobs()
  }

  return (
    <div className="page split">
      <div className="split-main">
        <header className="page-head">
          <div>
            <h1> {t('surface.assetList')} </h1>
            <p className="muted">
              {t('surface.counts', {total:p.assets.length, visible:filtered.length, selected:selectedAssets.length})}
            </p>
          </div>
          <div className="row">
            <AsyncButton onClick={importFile}> {t('surface.importExcel')} </AsyncButton>
          </div>
        </header>

        <div className="toolbar">
          <input className="input search" placeholder={t('surface.searchAssets')} value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={kind} onChange={setKind} options={[{ value: '', label: t('surface.allKinds') }, ...Object.entries(kindLabels).map(([value, label]) => ({ value, label }))]} />
          <Select value={prio} onChange={setPrio} options={[{ value: '', label: t('surface.allPriorities') }, ...priorities.map((x) => ({ value: x, label: assetStatus(locale, x) }))]} />
          <Select value={status} onChange={setStatus} options={[{ value: '', label: t('surface.allStatuses') }, ...statuses.map((x) => ({ value: x, label: x }))]} />
        </div>

        {selectedAssets.length > 0 && (
          <div className="runbar">
            <span>
              {t('surface.selected', {count:selectedAssets.length})}
            </span>
            <Select value={runPipeline} onChange={setPipelineId} options={p.pipelines.map((pl) => ({ value: pl.id, label: pl.name + (pl.id === suggested ? t('surface.recommendedSuffix') : '') }))} />
            <AsyncButton className="primary" onClick={run} disabled={!runPipeline}> {t('surface.generateArrow')} </AsyncButton>
            <button className="btn ghost" onClick={() => setSelectedAssets([])}> {t('surface.clearSelection')} </button>
          </div>
        )}

        {p.assets.length === 0 ? (
          <div className="empty-card">
            <h3> {t('surface.noAssets')} </h3>
            <p className="muted">
              {t('surface.importHelp')}
            </p>
            <AsyncButton className="primary" onClick={importFile}> {t('surface.import')} </AsyncButton>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table hover">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={() =>
                        setSelectedAssets(allVisibleSelected ? selectedAssets.filter((id) => !filtered.some((a) => a.id === id)) : [...new Set([...selectedAssets, ...filtered.map((a) => a.id)])])
                      }
                    />
                  </th>
                  <th style={{ width: 100 }}>ID</th>
                  <th> {t('surface.name')} </th>
                  <th style={{ width: 90 }}> {t('surface.type')} </th>
                  <th style={{ width: 80 }}> {t('surface.category')} </th>
                  <th style={{ width: 110 }}> {t('surface.size')} </th>
                  <th style={{ width: 80 }}> {t('surface.budget')} </th>
                  <th style={{ width: 60 }}> {t('surface.priorityShort')} </th>
                  <th style={{ width: 100 }}> {t('surface.status')} </th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 600).map((a) => (
                  <tr key={a.id} className={`${openId === a.id ? 'active' : ''}`} onClick={() => setOpenId(a.id)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                    </td>
                    <td className="mono">{a.id}</td>
                    <td>
                      <div className="ellipsis">{a.name}</div>
                      <div className="muted small ellipsis">{a.description}</div>
                    </td>
                    <td>
                      <span className={`kind k-${a.kind}`}>{kindLabels[a.kind]}</span>
                    </td>
                    <td>{a.category}</td>
                    <td className="small">{a.size}</td>
                    <td className="small">{a.triBudget || ''}</td>
                    <td>{a.priority}</td>
                    <td>
                      <span className={`status ${a.status === 'Üretildi' ? 'ok' : ''}`}>{assetStatus(locale, a.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 600 && <p className="muted center"> {t('surface.limitRows')} </p>}
          </div>
        )}
      </div>

      {open && (
        <aside className="split-side">
          <div className="row between">
            <h2 className="mono">{open.id}</h2>
            <button className="icon-btn" onClick={() => setOpenId(null)}>
              ✕
            </button>
          </div>
          <Field label={t('surface.name')}>
            <TextInput value={open.name} onChange={(v) => edit(open.id, { name: v })} />
          </Field>
          <Field label={t('surface.type')}>
            <Select value={open.kind} onChange={(v) => edit(open.id, { kind: v as AssetKind })} options={Object.entries(kindLabels).map(([value, label]) => ({ value, label }))} />
          </Field>
          <div className="grid2">
            <Field label={t('surface.category')}>
              <TextInput value={open.category} onChange={(v) => edit(open.id, { category: v })} />
            </Field>
            <Field label={t('surface.subcategory')}>
              <TextInput value={open.subcategory} onChange={(v) => edit(open.id, { subcategory: v })} />
            </Field>
          </div>
          <Field label={t('surface.designNotes')}>
            <TextArea rows={5} value={open.description} onChange={(v) => edit(open.id, { description: v })} />
          </Field>
          <div className="grid2">
            <Field label={t('surface.sizeM')} help={t('surface.sizeHelp')}>
              <TextInput value={open.size} onChange={(v) => edit(open.id, { size: v })} />
            </Field>
            <Field label={t('surface.triangleBudget')} help={open.budgetNote}>
              <NumberInput value={open.triBudget} onChange={(v) => edit(open.id, { triBudget: v })} />
            </Field>
          </div>
          <Field label={t('surface.colorMaterial')}>
            <TextInput value={open.materials} onChange={(v) => edit(open.id, { materials: v })} />
          </Field>
          <div className="grid2">
            <Field label={t('surface.priority')}>
              <TextInput value={open.priority} onChange={(v) => edit(open.id, { priority: v })} />
            </Field>
            <Field label={t('surface.status')}>
              <TextInput value={open.status} onChange={(v) => edit(open.id, { status: v })} />
            </Field>
          </div>
          {Object.keys(open.extra).length > 0 && (
            <div className="extra">
              <div className="field-label"> {t('surface.otherColumns')} </div>
              {Object.entries(open.extra).map(([k, v]) => (
                <div key={k} className="kv">
                  <span>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          )}
          <div className="muted small">{t('surface.source', {source:open.source})}</div>
        </aside>
      )}
    </div>
  )
}
