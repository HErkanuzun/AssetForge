import { useState } from 'react'
import type { SettingsPatch } from '../../../shared/types'
import { AsyncButton, Field, NumberInput, Select, TextInput } from '../components/ui'
import { useStore } from '../store'
import ConnectionsSettings from '../components/ConnectionsSettings'

const MODELS = [
  { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 (önerilen)' },
  { value: 'claude-fable-5-1', label: 'Claude Fable 5.1 (en güçlü, pahalı)' },
  { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (hızlı/ucuz)' },
  { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (en ucuz)' }
]

const AUDIO = [
  { value: 'pcm_24000', label: 'WAV 24 kHz (tüm planlar)' },
  { value: 'pcm_44100', label: 'WAV 44.1 kHz (Pro plan)' },
  { value: 'pcm_22050', label: 'WAV 22 kHz' },
  { value: 'mp3_44100_128', label: 'MP3 128 kbps (Unreal import etmeyebilir)' }
]

function KeyField({ name, label, has, link }: { name: 'anthropic' | 'meshy' | 'elevenlabs' | 'huggingface'; label: string; has: boolean; link: string }) {
  const { setSettings, toast } = useStore()
  const [v, setV] = useState('')
  const save = async (value: string) => {
    setSettings(await window.forge.settings.set({ secrets: { [name]: value } }))
    setV('')
    toast(value ? `${label} anahtarı kaydedildi` : `${label} anahtarı silindi`, 'ok')
  }
  return (
    <Field label={`${label} API anahtarı`} help={has ? '✓ Kayıtlı (Windows şifrelemesiyle saklanır)' : `Yok — ${link}`}>
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

export default function SettingsPage() {
  const { settings, setSettings, setProject, toast } = useStore()
  const s = settings!
  const patch = async (p: SettingsPatch) => setSettings(await window.forge.settings.set(p))

  const test = async (fn: () => Promise<unknown>, label: string) => {
    try {
      const r = await fn()
      toast(`${label}: bağlantı tamam (${String(r).slice(0, 60)})`, 'ok')
    } catch (e) {
      toast(`${label}: ${(e as Error).message}`, 'error')
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Ayarlar</h1>
          <p className="muted">AssetForge v{__APP_VERSION__} · Anahtarlar bu bilgisayarda şifreli saklanır, proje dosyasına yazılmaz.</p>
        </div>
      </header>

      <section className="card">
        <h2>Proje</h2>
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
          </div>
        </Field>
        <Field label="Aynı anda çalışacak iş sayısı" help="Meshy ve Claude istek sınırlarına göre 1-4 önerilir">
          <NumberInput value={s.concurrency} onChange={(v) => patch({ concurrency: Math.min(8, Math.max(1, v)) })} />
        </Field>
      </section>

      <section className="card">
        <h2>AI servisleri</h2>
        <KeyField name="anthropic" label="Claude (Anthropic)" has={s.hasKeys.anthropic} link="platform.claude.com → API Keys" />
        <div className="row">
          <Field label="Claude modeli">
            <Select value={s.claudeModel} onChange={(v) => patch({ claudeModel: v })} options={MODELS} />
          </Field>
          <AsyncButton onClick={() => test(window.forge.testClaude, 'Claude')}>Test et</AsyncButton>
        </div>
        <KeyField name="meshy" label="Meshy" has={s.hasKeys.meshy} link="meshy.ai → Settings → API" />
        <AsyncButton onClick={() => test(async () => `${await window.forge.testMeshy()} kredi`, 'Meshy')}>Meshy bakiyesini kontrol et</AsyncButton>
        <KeyField name="elevenlabs" label="ElevenLabs" has={s.hasKeys.elevenlabs} link="elevenlabs.io → Profile → API keys" />
        <Field label="Ses çıktı formatı">
          <Select value={s.audioFormat} onChange={(v) => patch({ audioFormat: v })} options={AUDIO} />
        </Field>
      </section>

      <ConnectionsSettings />

      <section className="card">
        <h2>Yerel araçlar</h2>
        <Field label="Blender (blender.exe)" help="Temizlik, ölçekleme, export ve önizleme render için">
          <TextInput value={s.blenderPath} onChange={(v) => patch({ blenderPath: v })} />
        </Field>
        <Field label="ComfyUI adresi">
          <TextInput value={s.comfyUrl} onChange={(v) => patch({ comfyUrl: v })} />
        </Field>
        <Field label="Varsayılan ComfyUI workflow (API formatı .json)" help="Boş = yerleşik SDXL şablonu. Yer tutucular: {{PROMPT}} {{NEGATIVE}} {{SEED}}">
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
      </section>

      <section className="card">
        <h2>Animasyon — NVIDIA Kimodo</h2>
        <p className="muted small">
          Kimodo metinden insan hareketi üretir; metni anlamak için Meta Llama-3-8B-Instruct kullanır. Hugging Face’te <b>meta-llama/Meta-Llama-3-8B-Instruct</b> sayfasında lisansı kabul edin,
          sonra “Read” yetkili bir token oluşturup buraya yapıştırın. Kurulum adımları Animasyon sayfasındadır.
        </p>
        <KeyField name="huggingface" label="Hugging Face" has={s.hasKeys.huggingface} link="huggingface.co → Settings → Access Tokens" />
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
      </section>

      <section className="card">
        <h2>Unreal Engine bağlantısı</h2>
        <p className="muted small">
          Unreal'da: <b>Edit → Plugins → Python Editor Script Plugin</b> açık olmalı, ardından <b>Project Settings → Plugins → Python → Enable Remote Execution</b> işaretlenmeli. Editör açıkken Unreal
          Export node'u asset'leri otomatik import eder.
        </p>
        <Field label="Manny/Quinn IK Rig yolu" help="Karakterler bu IK Rig’ten retarget alır (UE5 Third Person şablonundaki varsayılan)">
          <TextInput value={s.mannyIkRig} onChange={(v) => patch({ mannyIkRig: v })} />
        </Field>
        <AsyncButton
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
          Unreal'ı bul
        </AsyncButton>
      </section>
    </div>
  )
}
