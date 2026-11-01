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
  const { project, update, toast } = useStore()
  const b = project!.bible
  const set = (patch: Partial<Bible>) => update((p) => ({ ...p, bible: { ...p.bible, ...patch } }))
  const setTech = (patch: Partial<Bible['technical']>) => set({ technical: { ...b.technical, ...patch } })
  const setCat = (i: number, patch: Partial<CategoryRule>) => set({ categories: b.categories.map((c, j) => (j === i ? { ...c, ...patch } : c)) })

  const usedCategories = [...new Set(project!.assets.map((a) => a.category).filter(Boolean))]

  const extract = async () => {
    const pdfs = await window.forge.pickFiles([{ name: 'PDF', extensions: ['pdf'] }], true)
    if (!pdfs.length) return
    toast(`Claude ${pdfs.length} belgeyi okuyor… (1-3 dk sürebilir)`)
    try {
      const { data, usd } = await window.forge.extractBible(pdfs, b, usedCategories.join(', '))
      set({ ...data, technical: { ...b.technical, ...(data.technical ?? {}) } })
      toast(`Proje Kitabı güncellendi ($${usd.toFixed(3)})`, 'ok')
    } catch (e) {
      toast((e as Error).message, 'error')
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
          <h1>Proje Kitabı</h1>
          <p className="muted">Prompt motoru ve kalite kontrol her üretimde bu bilgileri kullanır. Ne kadar net olursa çıktı o kadar tutarlı olur.</p>
        </div>
        <div className="row">
          <AsyncButton className="primary" onClick={extract} title="Evren el kitabı / GDD PDF'lerini seç">
            📄 PDF'lerden doldur (Claude)
          </AsyncButton>
        </div>
      </header>

      <section className="card">
        <h2>Kimlik ve atmosfer</h2>
        <div className="grid2">
          <Field label="Proje adı">
            <TextInput value={b.projectName} onChange={(v) => set({ projectName: v })} />
          </Field>
          <Field label="Tür">
            <TextInput value={b.genre} onChange={(v) => set({ genre: v })} placeholder="Coop TPS hayatta kalma" />
          </Field>
          <Field label="Mekân / dönem" wide>
            <TextArea value={b.setting} onChange={(v) => set({ setting: v })} />
          </Field>
          <Field label="Lore özeti (görsel/işitsel tasarımı etkileyen)" wide>
            <TextArea rows={5} value={b.loreSummary} onChange={(v) => set({ loreSummary: v })} />
          </Field>
          <Field label="Sanat yönü (İngilizce önerilir)" wide help="Şekil dili, yapım mantığı, yıpranma, ışık atmosferi, referanslar">
            <TextArea rows={5} value={b.artDirection} onChange={(v) => set({ artDirection: v })} />
          </Field>
          <Field label="Gerçekçilik seviyesi">
            <TextInput value={b.realism} onChange={(v) => set({ realism: v })} />
          </Field>
          <Field label="Atmosfer kelimeleri" help="Virgülle ayırın">
            <TextInput value={b.moodKeywords.join(', ')} onChange={(v) => set({ moodKeywords: list(v) })} />
          </Field>
          <Field label="Yasaklar" help="Asla görünmemesi gerekenler, virgülle">
            <TextInput value={b.forbidden.join(', ')} onChange={(v) => set({ forbidden: list(v) })} />
          </Field>
          <Field label="Ses yönü">
            <TextArea value={b.audioDirection} onChange={(v) => set({ audioDirection: v })} />
          </Field>
        </div>
      </section>

      <section className="card">
        <h2>Teknik kurallar</h2>
        <div className="grid4">
          <Field label="Varsayılan üçgen bütçesi">
            <NumberInput value={b.technical.defaultTriBudget} onChange={(v) => setTech({ defaultTriBudget: v })} />
          </Field>
          <Field label="Doku çözünürlüğü">
            <Select value={b.technical.textureRes} onChange={(v) => setTech({ textureRes: v as TextureRes })} options={RES} />
          </Field>
          <Field label="PBR">
            <Toggle value={b.technical.pbr} onChange={(v) => setTech({ pbr: v })} />
          </Field>
          <Field label="UE içerik kökü">
            <TextInput value={b.technical.ueContentRoot} onChange={(v) => setTech({ ueContentRoot: v })} />
          </Field>
          <Field label="Master materyal (opsiyonel)" help="Doluysa her model için MI_ oluşturulur. Parametre adları: BaseColor, Normal, Roughness, Metallic">
            <TextInput value={b.technical.masterMaterial} onChange={(v) => setTech({ masterMaterial: v })} placeholder="/Game/Materials/M_Master" />
          </Field>
          {(Object.keys(b.technical.naming) as (keyof Bible['technical']['naming'])[]).map((k) => (
            <Field key={k} label={`Önek: ${{ staticMesh: 'Static mesh', skeletalMesh: 'Skeletal mesh', texture: 'Doku', materialInstance: 'Materyal inst.', sound: 'Ses' }[k]}`}>
              <TextInput value={b.technical.naming[k]} onChange={(v) => setTech({ naming: { ...b.technical.naming, [k]: v } })} />
            </Field>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="row between">
          <h2>Kategori kuralları</h2>
          <button className="btn" onClick={addMissingCategories} disabled={!usedCategories.length}>
            + Asset listesindeki kategorileri ekle
          </button>
        </div>
        {b.categories.length === 0 ? (
          <p className="muted">Henüz kategori yok. Asset listesini içe aktarıp yukarıdaki butona basın ya da PDF'lerden doldurun.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Kod</th>
                <th style={{ width: 180 }}>Ad</th>
                <th>Stil notları (İngilizce önerilir)</th>
                <th style={{ width: 110 }}>Üçgen</th>
                <th style={{ width: 80 }}>Doku</th>
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
        <h2>Palet ({b.palette.length})</h2>
        {b.palette.length === 0 ? (
          <p className="muted">Asset listesi Excel'inde "Palet" sayfası varsa içe aktarırken otomatik dolar.</p>
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
        <h2>Malzeme kütüphanesi ({b.materials.length})</h2>
        {b.materials.length === 0 ? (
          <p className="muted">Excel'deki "Malzemeler" sayfasından otomatik dolar.</p>
        ) : (
          <table className="table compact">
            <thead>
              <tr>
                <th>Materyal</th>
                <th>Açıklama</th>
                <th>Palet</th>
                <th>Not</th>
                <th>Öncelik</th>
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
