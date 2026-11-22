// SPDX-License-Identifier: AGPL-3.0-only
import { errorMessage } from '../../../shared/i18n/errors'
import { message } from '../../../shared/i18n/message'
import { useLocale } from '../i18n'
import type { Bible, CategoryRule, TextureRes } from '../../../shared/types'
import { AsyncButton, Field, NumberInput, Select, TextArea, TextInput, Toggle } from '../components/ui'
import { useStore } from '../store'

const RES: { value: TextureRes; label: string }[] = [
  { value: '1k', label: '1K' },
  { value: '2k', label: '2K' },
  { value: '4k', label: '4K' },
  { value: '8k', label: '8K' }
]

const list = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

export default function BiblePage() {
  const { t } = useLocale()

  const { project, update, toast } = useStore()
  const b = project!.bible
  const set = (patch: Partial<Bible>) => update((p) => ({ ...p, bible: { ...p.bible, ...patch } }))
  const setTech = (patch: Partial<Bible['technical']>) => set({ technical: { ...b.technical, ...patch } })
  const setCat = (i: number, patch: Partial<CategoryRule>) => set({ categories: b.categories.map((c, j) => (j === i ? { ...c, ...patch } : c)) })

  const usedCategories = [...new Set(project!.assets.map((a) => a.category).filter(Boolean))]

  const extract = async () => {
    const pdfs = await window.forge.pickFiles([{ name: 'PDF', extensions: ['pdf'] }], true)
    if (!pdfs.length) return
    toast(message('surface.readingPdf', { count: pdfs.length }))
    try {
      const { data, usd } = await window.forge.extractBible(pdfs, b, usedCategories.join(', '))
      set({ ...data, technical: { ...b.technical, ...data.technical } })
      toast(message('surface.bibleUpdated', { usd: usd.toFixed(3) }), 'ok')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  const addMissingCategories = () => {
    const have = new Set(b.categories.map((c) => c.code))
    const add = usedCategories.filter((c) => !have.has(c)).map((code): CategoryRule => ({ code, name: code, styleNotes: '', triBudget: 0, textureRes: b.technical.textureRes }))
    set({ categories: [...b.categories, ...add] })
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1> {t('surface.bible')} </h1>
          <p className="muted"> {t('surface.bibleHelp')} </p>
        </div>
        <div className="row">
          <AsyncButton className="primary" onClick={extract} title={t('surface.pickPdf')}>
            {' '}
            {t('surface.fillPdf')}{' '}
          </AsyncButton>
        </div>
      </header>

      <section className="card">
        <h2> {t('surface.identity')} </h2>
        <div className="grid2">
          <Field label={t('surface.projectName')}>
            <TextInput value={b.projectName} onChange={(v) => set({ projectName: v })} />
          </Field>
          <Field label={t('surface.type')}>
            <TextInput value={b.genre} onChange={(v) => set({ genre: v })} placeholder={t('surface.genreExample')} />
          </Field>
          <Field label={t('surface.setting')} wide>
            <TextArea value={b.setting} onChange={(v) => set({ setting: v })} />
          </Field>
          <Field label={t('surface.lore')} wide>
            <TextArea rows={5} value={b.loreSummary} onChange={(v) => set({ loreSummary: v })} />
          </Field>
          <Field label={t('surface.artDirection')} wide help={t('surface.artHelp')}>
            <TextArea rows={5} value={b.artDirection} onChange={(v) => set({ artDirection: v })} />
          </Field>
          <Field label={t('surface.realism')}>
            <TextInput value={b.realism} onChange={(v) => set({ realism: v })} />
          </Field>
          <Field label={t('surface.mood')} help={t('surface.commaHelp')}>
            <TextInput value={b.moodKeywords.join(', ')} onChange={(v) => set({ moodKeywords: list(v) })} />
          </Field>
          <Field label={t('surface.forbidden')} help={t('surface.forbiddenHelp')}>
            <TextInput value={b.forbidden.join(', ')} onChange={(v) => set({ forbidden: list(v) })} />
          </Field>
          <Field label={t('surface.audioDirection')}>
            <TextArea value={b.audioDirection} onChange={(v) => set({ audioDirection: v })} />
          </Field>
        </div>
      </section>

      <section className="card">
        <h2> {t('surface.technical')} </h2>
        <div className="grid4">
          <Field label={t('surface.defaultBudget')}>
            <NumberInput value={b.technical.defaultTriBudget} onChange={(v) => setTech({ defaultTriBudget: v })} />
          </Field>
          <Field label={t('surface.textureResolution')}>
            <Select value={b.technical.textureRes} onChange={(v) => setTech({ textureRes: v as TextureRes })} options={RES} />
          </Field>
          <Field label="PBR">
            <Toggle value={b.technical.pbr} onChange={(v) => setTech({ pbr: v })} />
          </Field>
          <Field label={t('surface.ueRoot')}>
            <TextInput value={b.technical.ueContentRoot} onChange={(v) => setTech({ ueContentRoot: v })} />
          </Field>
          <Field label={t('surface.masterMaterial')} help={t('surface.masterHelp')}>
            <TextInput value={b.technical.masterMaterial} onChange={(v) => setTech({ masterMaterial: v })} placeholder="/Game/Materials/M_Master" />
          </Field>
          {(Object.keys(b.technical.naming) as (keyof Bible['technical']['naming'])[]).map((k) => (
            <Field key={k} label={t('surface.prefix', { name: t(`naming.${k}`) })}>
              <TextInput value={b.technical.naming[k]} onChange={(v) => setTech({ naming: { ...b.technical.naming, [k]: v } })} />
            </Field>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="row between">
          <h2> {t('surface.categoryRules')} </h2>
          <button className="btn" onClick={addMissingCategories} disabled={!usedCategories.length}>
            {' '}
            {t('surface.addCategories')}{' '}
          </button>
        </div>
        {b.categories.length === 0 ? (
          <p className="muted"> {t('surface.noCategories')} </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 80 }}> {t('surface.code')} </th>
                <th style={{ width: 180 }}> {t('surface.name')} </th>
                <th> {t('surface.styleNotes')} </th>
                <th style={{ width: 110 }}> {t('surface.triangles')} </th>
                <th style={{ width: 80 }}> {t('surface.texture')} </th>
                <th style={{ width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {b.categories.map((c, i) => (
                <tr key={i}>
                  <td>
                    <TextInput value={c.code} onChange={(v) => setCat(i, { code: v })} />
                  </td>
                  <td>
                    <TextInput value={c.name} onChange={(v) => setCat(i, { name: v })} />
                  </td>
                  <td>
                    <TextInput value={c.styleNotes} onChange={(v) => setCat(i, { styleNotes: v })} />
                  </td>
                  <td>
                    <NumberInput value={c.triBudget} onChange={(v) => setCat(i, { triBudget: v })} />
                  </td>
                  <td>
                    <Select value={c.textureRes} onChange={(v) => setCat(i, { textureRes: v as TextureRes })} options={RES} />
                  </td>
                  <td>
                    <button className="icon-btn" onClick={() => set({ categories: b.categories.filter((_, j) => j !== i) })}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>{t('surface.paletteCount', { count: b.palette.length })}</h2>
        {b.palette.length === 0 ? (
          <p className="muted"> {t('surface.paletteHelp')} </p>
        ) : (
          <div className="swatches">
            {b.palette.map((p) => (
              <div key={p.code} className="swatch" title={p.usage}>
                <span className="swatch-color" style={{ background: /^#[0-9a-f]{3,8}$/i.test(p.hex) ? p.hex : '#333' }} />
                <div>
                  <b>{p.code}</b> {p.name}
                  <div className="muted small">{p.hex}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>{t('surface.materialCount', { count: b.materials.length })}</h2>
        {b.materials.length === 0 ? (
          <p className="muted"> {t('surface.materialsHelp')} </p>
        ) : (
          <table className="table compact">
            <thead>
              <tr>
                <th> {t('surface.material')} </th>
                <th> {t('surface.description')} </th>
                <th> {t('surface.palette')} </th>
                <th> {t('surface.note')} </th>
                <th> {t('surface.priority')} </th>
              </tr>
            </thead>
            <tbody>
              {b.materials.map((m) => (
                <tr key={m.name}>
                  <td className="mono">{m.name}</td>
                  <td>{m.description}</td>
                  <td>{m.palette}</td>
                  <td className="muted">{m.notes}</td>
                  <td>{m.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
