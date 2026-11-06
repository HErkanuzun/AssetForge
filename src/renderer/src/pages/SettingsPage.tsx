// SPDX-License-Identifier: AGPL-3.0-only
// Ayarlar: solda kategori menüsü (arama ile), sağda yalnızca seçili kategori
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AsyncButton, Field, NumberInput, Select, TextInput } from '../components/ui'
import { Icon, type IconName } from '../components/icons'
import { useStore } from '../store'
import { McpSettings, ModelSettings } from '../components/ConnectionsSettings'
import QuickConnect from '../components/QuickConnect'

type Section = 'connect' | 'models' | 'project' | 'tools' | 'anim' | 'unreal' | 'mcp' | 'about'

const SECTIONS: { id: Section; label: string; icon: IconName; desc: string; keywords: string }[] = [
  {
    id: 'connect',
    label: 'Hesaplar ve API',
    icon: 'link',
    desc: 'Claude, Meshy, ElevenLabs, Hugging Face ve OpenRouter bağlantıları',
    keywords: 'anahtar key api giriş claude anthropic meshy elevenlabs hugging face openrouter bağlan token'
  },
  {
    id: 'models',
    label: 'Yapay zeka modelleri',
    icon: 'spark',
    desc: 'Claude modeli, yerel ve ek modeller, görev atamaları',
    keywords: 'model claude ollama lm studio openrouter llm görev atama asistan prompt görsel vision web arama'
  },
  { id: 'project', label: 'Proje ve üretim', icon: 'folder', desc: 'Proje klasörü, eşzamanlı iş sayısı, ses formatı', keywords: 'proje klasör iş sayısı concurrency ses format wav mp3 çıktı' },
  { id: 'tools', label: 'Yerel araçlar', icon: 'wand', desc: 'Blender ve ComfyUI', keywords: 'blender comfyui workflow doku texture yerel 3d ses partner comfy hesabı' },
  { id: 'anim', label: 'Animasyon', icon: 'anim', desc: 'NVIDIA Kimodo kurulumu ve servis', keywords: 'kimodo animasyon hareket motion wsl docker cuda hugging face llama' },
  { id: 'unreal', label: 'Unreal Engine', icon: 'cube', desc: 'Remote Execution bağlantısı ve IK Rig', keywords: 'unreal ue5 remote execution python ik rig manny quinn retarget' },
  {
    id: 'mcp',
    label: 'MCP ve dış araçlar',
    icon: 'terminal',
    desc: 'Claude Code / Desktop bağlantısı, dış MCP sunucuları',
    keywords: 'mcp claude code desktop sunucu server token port blender mcp araç'
  },
  { id: 'about', label: 'Hakkında', icon: 'gauge', desc: 'Sürüm, lisans, destek ve tanılama', keywords: 'sürüm versiyon hakkında lisans github hata bildir destek tanılama günlük log sorun' }
]

const AUDIO = [
  { value: 'pcm_24000', label: 'WAV 24 kHz (tüm planlar)' },
  { value: 'pcm_44100', label: 'WAV 44.1 kHz (Pro plan)' },
  { value: 'pcm_22050', label: 'WAV 22 kHz' },
  { value: 'mp3_44100_128', label: 'MP3 128 kbps (Unreal import etmeyebilir)' }
]

const STORE_KEY = 'forge.settingsSection'

type KeyName = 'anthropic' | 'meshy' | 'elevenlabs' | 'huggingface' | 'comfy'

function KeyField({ name, label, has, link }: { name: KeyName; label: string; has: boolean; link: string }) {
  const { setSettings, toast } = useStore()
  const [v, setV] = useState('')
  const save = async (value: string) => {
    setSettings(await window.forge.settings.set({ secrets: { [name]: value } }))
    setV('')
    toast(value ? `${label} anahtarı kaydedildi` : `${label} anahtarı silindi`, 'ok')
  }
  return (
    <Field label={`${label} API anahtarı`} help={has ? '✓ Kayıtlı (Windows şifrelemesiyle saklanır)' : name === 'comfy' ? `Yok — ${link}` : `Yok — yukarıdan “Bağlan” ya da ${link}`}>
      <div className="row">
        <TextInput type="password" value={v} onChange={setV} placeholder={has ? '•••••••• (değiştirmek için yazın)' : 'anahtarı yapıştırın'} />
        <AsyncButton onClick={() => save(v)} disabled={!v}>
          Kaydet
        </AsyncButton>
        {has && (
          <AsyncButton className="ghost" onClick={() => save('')}>
            Sil
          </AsyncButton>
        )}
      </div>
    </Field>
  )
}

function Card({ title, desc, children }: { title: string; desc?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {desc && <p className="muted small">{desc}</p>}
      {children}
    </section>
  )
}

export default function SettingsPage() {
  const { settings, setSettings, setProject, toast } = useStore()
  const s = settings!
  const patch = async (p: Parameters<typeof window.forge.settings.set>[0]) => setSettings(await window.forge.settings.set(p))
  const missingCore = !s.hasKeys.anthropic || !s.hasKeys.meshy || !s.hasKeys.elevenlabs
  const keyCount = [s.hasKeys.anthropic, s.hasKeys.meshy, s.hasKeys.elevenlabs, s.hasKeys.huggingface].filter(Boolean).length

  // Eksik anahtar varsa doğrudan bağlantılar açılır; yoksa son bakılan bölüm
  const [section, setSection] = useState<Section>(() => {
    if (missingCore) return 'connect'
    try {
      const v = localStorage.getItem(STORE_KEY) as Section | null
      if (v && SECTIONS.some((x) => x.id === v)) return v
    } catch {
      /* depolama kapalı */
    }
    return 'connect'
  })
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, section)
    } catch {
      /* depolama kapalı */
    }
  }, [section])

  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const t = q.trim().toLocaleLowerCase('tr')
    if (!t) return SECTIONS
    return SECTIONS.filter((x) => `${x.label} ${x.desc} ${x.keywords}`.toLocaleLowerCase('tr').includes(t))
  }, [q])

  const badge = (id: Section): ReactNode => {
    if (id === 'connect') return missingCore ? <span className="set-dot warn" title="Eksik anahtar var" /> : <span className="set-count">{keyCount}/4</span>
    if (id === 'mcp' && s.mcpExpose.enabled) return <span className="set-dot ok" title="MCP sunucusu açık" />
    return null
  }

  const test = async (fn: () => Promise<unknown>, label: string) => {
    try {
      const r = await fn()
      toast(`${label}: bağlantı tamam (${String(r).slice(0, 60)})`, 'ok')
    } catch (e) {
      toast(`${label}: ${(e as Error).message}`, 'error')
    }
  }

  const current = SECTIONS.find((x) => x.id === section)!
  let body: ReactNode
  switch (section) {
    case 'connect':
      body = (
        <>
          <QuickConnect />
          <Card title="Anahtarları elle gir" desc="Anahtarınız zaten varsa buraya yapıştırabilirsiniz. Proje dosyasına yazılmaz; bu bilgisayarda şifreli saklanır.">
            <KeyField name="anthropic" label="Claude (Anthropic)" has={s.hasKeys.anthropic} link="platform.claude.com → API Keys" />
            <KeyField name="meshy" label="Meshy" has={s.hasKeys.meshy} link="meshy.ai → Settings → API" />
            <KeyField name="elevenlabs" label="ElevenLabs" has={s.hasKeys.elevenlabs} link="elevenlabs.io → Profile → API keys" />
            <KeyField name="huggingface" label="Hugging Face" has={s.hasKeys.huggingface} link="huggingface.co → Settings → Access Tokens" />
            <div className="row">
              <AsyncButton onClick={() => test(window.forge.testClaude, 'Claude')}>Claude’u test et</AsyncButton>
              <AsyncButton onClick={() => test(async () => `${await window.forge.testMeshy()} kredi`, 'Meshy')}>Meshy bakiyesi</AsyncButton>
            </div>
          </Card>
        </>
      )
      break
    case 'models':
      body = <ModelSettings />
      break
    case 'project':
      body = (
        <Card title="Proje">
          <Field label="Proje klasörü" help="forge-project.json, çıktılar (output/), export/ ve iş kayıtları burada tutulur">
            <div className="row">
              <TextInput value={s.projectDir} onChange={() => {}} />
              <AsyncButton
                onClick={async () => {
                  const p = await window.forge.project.pickDir()
                  if (p) {
                    setProject(p)
                    setSettings(await window.forge.settings.get())
                    toast('Proje açıldı: ' + p.name, 'ok')
                  }
                }}
              >
                Klasör seç…
              </AsyncButton>
              <AsyncButton className="ghost" onClick={() => window.forge.openPath(s.projectDir)}>
                Aç
              </AsyncButton>
            </div>
          </Field>
          <div className="grid2">
            <Field label="Aynı anda çalışacak iş sayısı" help="Meshy ve Claude istek sınırlarına göre 1-4 önerilir">
              <NumberInput value={s.concurrency} onChange={(v) => patch({ concurrency: Math.min(8, Math.max(1, v)) })} />
            </Field>
            <Field label="Ses çıktı formatı" help="ElevenLabs çıktıları bu formatta kaydedilir">
              <Select value={s.audioFormat} onChange={(v) => patch({ audioFormat: v })} options={AUDIO} />
            </Field>
          </div>
        </Card>
      )
      break
    case 'tools':
      body = (
        <>
          <Card title="Blender" desc="Temizlik, ölçekleme, LOD, export ve önizleme render için arka planda çalışır.">
            <Field label="blender.exe yolu" help={s.blenderPath ? undefined : 'Bulunamadı — Blender kurulu değilse blender.org’dan indirin'}>
              <div className="row">
                <TextInput value={s.blenderPath} onChange={(v) => patch({ blenderPath: v })} />
                <AsyncButton
                  onClick={async () => {
                    const [f] = await window.forge.pickFiles([{ name: 'Blender', extensions: ['exe'] }])
                    if (f) await patch({ blenderPath: f })
                  }}
                >
                  Seç…
                </AsyncButton>
              </div>
            </Field>
          </Card>
          <Card
            title="ComfyUI"
            desc="Görsel, doku, 3D model, ses ve animasyon üreten ComfyUI workflow’larını çalıştırır. Yerel modeller (TRELLIS.2, Hunyuan3D, ACE-Step, Kimodo …) ücretsizdir; partner düğümleri (Meshy, Tripo, Rodin, ElevenLabs …) Comfy hesabı kredisiyle çalışır."
          >
            <Field label="ComfyUI adresi">
              <div className="row">
                <TextInput value={s.comfyUrl} onChange={(v) => patch({ comfyUrl: v })} />
                <AsyncButton onClick={() => test(window.forge.testComfy, 'ComfyUI')}>Bağlantıyı test et</AsyncButton>
              </div>
            </Field>
            <KeyField name="comfy" label="Comfy hesabı" has={s.hasKeys.comfy} link="platform.comfy.org → API Keys (yalnızca partner düğümleri için)" />
            <Field
              label="Varsayılan workflow (API formatı .json)"
              help="Boş = yerleşik SDXL şablonu. AssetForge’un değerleri başlığı AF:prompt, AF:negative, AF:seed, AF:image, AF:model, AF:audio olan düğümlere ya da {{PROMPT}} {{NEGATIVE}} {{SEED}} yer tutucularına yazılır."
            >
              <div className="row">
                <TextInput value={s.comfyWorkflow} onChange={(v) => patch({ comfyWorkflow: v })} />
                <AsyncButton
                  onClick={async () => {
                    const [f] = await window.forge.pickFiles([{ name: 'Workflow', extensions: ['json'] }])
                    if (f) await patch({ comfyWorkflow: f })
                  }}
                >
                  Seç…
                </AsyncButton>
              </div>
            </Field>
          </Card>
        </>
      )
      break
    case 'anim':
      body = (
        <Card
          title="NVIDIA Kimodo"
          desc={
            <>
              Kimodo metinden insan hareketi üretir; metni anlamak için Meta Llama-3-8B-Instruct kullanır. Kurulum adımları <b>Animasyon</b> sayfasındadır.
            </>
          }
        >
          <div className={`set-note ${s.hasKeys.huggingface ? 'ok' : ''}`}>
            <Icon name={s.hasKeys.huggingface ? 'check' : 'link'} size={15} />
            <span>{s.hasKeys.huggingface ? 'Hugging Face bağlı.' : 'Hugging Face token’ı gerekli (Llama-3 lisansı kabul edilmiş hesap).'}</span>
            {!s.hasKeys.huggingface && (
              <button className="btn primary" onClick={() => setSection('connect')}>
                Bağlan
              </button>
            )}
          </div>
          <Field label="Çalışma yolu" help="Yerel Windows: BIOS sanallaştırması gerekmez (önerilen). WSL2 + Docker: BIOS’ta SVM/VT-x açık olmalı.">
            <Select
              value={s.kimodoBackend}
              onChange={(v) => patch({ kimodoBackend: v as 'native' | 'wsl' })}
              options={[
                { value: 'native', label: 'Yerel Windows (Python + CUDA)' },
                { value: 'wsl', label: 'WSL2 + Docker' }
              ]}
            />
          </Field>
          <Field label="Kimodo kurulum klasörü" help="~25 GB (PyTorch + modeller). Boş alanı bol bir diskte olmalı.">
            <TextInput value={s.kimodoHome} onChange={(v) => patch({ kimodoHome: v })} />
          </Field>
          <Field label="Servis adresi">
            <TextInput value={s.kimodoUrl} onChange={(v) => patch({ kimodoUrl: v })} />
          </Field>
        </Card>
      )
      break
    case 'unreal':
      body = (
        <Card title="Unreal Engine bağlantısı">
          <ol className="set-steps small">
            <li>
              <b>Edit → Plugins → Python Editor Script Plugin</b>’i açın.
            </li>
            <li>
              <b>Project Settings → Plugins → Python → Enable Remote Execution</b>’ı işaretleyin.
            </li>
            <li>Editör açıkken “Unreal’ı bul”a basın. Unreal Export node’u asset’leri otomatik import eder.</li>
          </ol>
          <AsyncButton
            className="primary"
            onClick={async () => {
              try {
                const nodes = await window.forge.ueDiscover()
                if (!nodes.length) toast('Açık Unreal Editor bulunamadı (Remote Execution açık mı?)', 'error')
                else toast(`Bulundu: ${nodes.map((n) => `${n.projectName} (UE ${n.engineVersion})`).join(', ')}`, 'ok')
              } catch (e) {
                toast((e as Error).message, 'error')
              }
            }}
          >
            Unreal’ı bul
          </AsyncButton>
          <div style={{ height: 14 }} />
          <Field label="Manny/Quinn IK Rig yolu" help="Karakterler bu IK Rig’ten retarget alır (UE5 Third Person şablonundaki varsayılan)">
            <TextInput value={s.mannyIkRig} onChange={(v) => patch({ mannyIkRig: v })} />
          </Field>
        </Card>
      )
      break
    case 'mcp':
      body = <McpSettings />
      break
    case 'about':
      body = (
        <Card title="AssetForge">
          <div className="kv2" style={{ gridTemplateColumns: '140px 1fr' }}>
            <span className="muted">Sürüm</span>
            <span>v{__APP_VERSION__} (alpha)</span>
            <span className="muted">Lisans</span>
            <span>GNU AGPL-3.0 — ücretsiz ve açık kaynak, ticari oyun projeleri dahil</span>
            <span className="muted">Üretilen asset’ler</span>
            <span>Sizindir; onları üreten servislerin (Meshy, ElevenLabs…) koşullarına tabidir</span>
            <span className="muted">Anahtarlar</span>
            <span>Windows DPAPI ile bu bilgisayarda şifreli</span>
          </div>
          <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <a className="btn" href="https://github.com/HErkanuzun/AssetForge" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a className="btn" href="https://github.com/HErkanuzun/AssetForge/issues/new/choose" target="_blank" rel="noreferrer">
              Sorun bildir
            </a>
            <a className="btn ghost" href="https://github.com/HErkanuzun/AssetForge/releases" target="_blank" rel="noreferrer">
              Sürüm notları
            </a>
            <a className="btn ghost" href="https://github.com/HErkanuzun/AssetForge/blob/main/LICENSE" target="_blank" rel="noreferrer">
              Lisans metni
            </a>
            <a className="btn ghost" href="https://github.com/HErkanuzun/AssetForge/blob/main/THIRD_PARTY_NOTICES.md" target="_blank" rel="noreferrer">
              Üçüncü taraf lisansları
            </a>
            <a className="btn ghost" href="https://github.com/HErkanuzun/AssetForge/blob/main/COMMERCIAL.md" target="_blank" rel="noreferrer">
              Ticari lisans
            </a>
          </div>
        </Card>
      )
      body = (
        <>
          {body}
          <div style={{ height: 14 }} />
          <Card title="Sorun bildirme">
            <p className="muted small" style={{ marginTop: 0 }}>
              Bir şey ters gittiyse tanılama dosyasını kaydedip GitHub’daki hata bildirimine ekle. Dosyada sürümler, sistem bilgisi, ayar özeti ve son günlük satırları bulunur. API anahtarları,
              token’lar ve kullanıcı adın otomatik olarak gizlenir.
            </p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <AsyncButton
                onClick={async () => {
                  try {
                    const f = await window.forge.diag.save()
                    if (f) toast(`Tanılama dosyası kaydedildi: ${f}`, 'ok')
                  } catch (e) {
                    toast(`Tanılama dosyası kaydedilemedi: ${(e as Error).message}`, 'error')
                  }
                }}
              >
                Tanılama dosyası kaydet
              </AsyncButton>
              <AsyncButton className="ghost" onClick={() => window.forge.diag.openLogs().catch((e: Error) => toast(e.message, 'error'))}>
                Günlük klasörünü aç
              </AsyncButton>
              <a className="btn ghost" href="https://github.com/HErkanuzun/AssetForge/issues/new?template=bug_report.yml" target="_blank" rel="noreferrer">
                Hata bildir
              </a>
            </div>
          </Card>
        </>
      )
      break
  }

  return (
    <div className="page split set-page">
      <nav className="set-nav" aria-label="Ayar kategorileri">
        <h1>Ayarlar</h1>
        <div className="set-search">
          <Icon name="search" size={14} />
          <input
            className="input"
            placeholder="Ayar ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && shown[0]) {
                setSection(shown[0].id)
                setQ('')
              }
              if (e.key === 'Escape') setQ('')
            }}
          />
        </div>
        {shown.map((x) => (
          <button key={x.id} className={`set-item ${section === x.id ? 'active' : ''}`} aria-current={section === x.id ? 'page' : undefined} onClick={() => setSection(x.id)}>
            <Icon name={x.icon} size={17} />
            <span className="ellipsis">{x.label}</span>
            {badge(x.id)}
          </button>
        ))}
        {!shown.length && (
          <div className="dim small" style={{ padding: '6px 10px' }}>
            Sonuç yok
          </div>
        )}
        <div className="set-foot dim small">v{__APP_VERSION__} · Anahtarlar bu bilgisayarda şifreli saklanır.</div>
      </nav>
      <div className="split-main set-main">
        <header className="set-head">
          <h2>{current.label}</h2>
          <p className="muted small">{current.desc}</p>
        </header>
        {body}
      </div>
    </div>
  )
}
