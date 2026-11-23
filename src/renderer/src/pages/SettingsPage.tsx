// SPDX-License-Identifier: AGPL-3.0-only
import { errorMessage } from '../../../shared/i18n/errors'
import { message } from '../../../shared/i18n/message'
// Ayarlar: solda kategori menüsü (arama ile), sağda yalnızca seçili kategori
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AsyncButton, Field, NumberInput, Select, TextInput } from '../components/ui'
import { Icon, type IconName } from '../components/icons'
import { useStore } from '../store'
import { McpSettings, ModelSettings } from '../components/ConnectionsSettings'
import QuickConnect from '../components/QuickConnect'
import ComfyLocal from '../components/ComfyLocal'
import ComfyServers from '../components/ComfyServers'
import ComfyLibrary from '../components/ComfyLibrary'
import CustomBackends from '../components/CustomBackends'
import AgentClis from '../components/AgentClis'
import WebSettings from '../components/WebSettings'
import { LANGUAGE_NAMES, LOCALES, type Locale, type PlainMessageKey } from '../../../shared/i18n'
import { useLocale } from '../i18n'

type Section = 'connect' | 'models' | 'project' | 'tools' | 'anim' | 'unreal' | 'mcp' | 'web' | 'about' | 'language'

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
    keywords: 'model claude ollama lm studio openrouter llm görev atama asistan prompt görsel vision web arama claude code codex cli ajan abonelik'
  },
  { id: 'project', label: 'Proje ve üretim', icon: 'folder', desc: 'Proje klasörü, eşzamanlı iş sayısı, ses formatı', keywords: 'proje klasör iş sayısı concurrency ses format wav mp3 çıktı' },
  {
    id: 'tools',
    label: 'Yerel araçlar',
    icon: 'wand',
    desc: 'Blender ve ComfyUI',
    keywords:
      'blender comfyui gradio git depo arka uç backend pinokio hugging face space workflow kitaplık sunucu adres endpoint uzak ağ bilgisayar token doku texture yerel 3d ses partner comfy hesabı'
  },
  { id: 'anim', label: 'Animasyon', icon: 'anim', desc: 'NVIDIA Kimodo kurulumu ve servis', keywords: 'kimodo animasyon hareket motion wsl docker cuda hugging face llama' },
  { id: 'unreal', label: 'Unreal Engine', icon: 'cube', desc: 'Remote Execution bağlantısı ve IK Rig', keywords: 'unreal ue5 remote execution python ik rig manny quinn retarget' },
  {
    id: 'mcp',
    label: 'MCP ve dış araçlar',
    icon: 'terminal',
    desc: 'Claude Code / Desktop bağlantısı, dış MCP sunucuları',
    keywords: 'mcp claude code desktop sunucu server token port blender mcp araç'
  },
  {
    id: 'web',
    label: 'Web ve paylaşım',
    icon: 'globe',
    desc: 'Tarayıcıdan erişim, ekip davetleri ve roller, yalnızca sunucu modu',
    keywords: 'web tarayıcı browser paylaş ekip davet katıl rol editör izleyici sahip parola sunucu headless pencere tailscale cloudflare tünel ağ lan'
  },
  { id: 'about', label: 'Hakkında', icon: 'gauge', desc: 'Sürüm, lisans, destek ve tanılama', keywords: 'sürüm versiyon hakkında lisans github hata bildir destek tanılama günlük log sorun' },
  { id: 'language', label: '', icon: 'globe', desc: '', keywords: `language locale ${LOCALES.map((value) => LANGUAGE_NAMES[value]).join(' ')} dil` }
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
  const { t } = useLocale()
  const { setSettings, toast } = useStore()
  const [v, setV] = useState('')
  const save = async (value: string) => {
    setSettings(await window.forge.settings.set({ secrets: { [name]: value } }))
    setV('')
    toast(value ? t('settings.keySaved', { name: label }) : t('settings.keyDeleted', { name: label }), 'ok')
  }
  return (
    <Field label={t('settings.keyLabel', { name: label })} help={has ? t('settings.keyStored') : name === 'comfy' ? t('settings.keyMissing', { link }) : t('settings.keyConnect', { link })}>
      <div className="row">
        <TextInput type="password" value={v} onChange={setV} placeholder={has ? t('settings.keyReplace') : t('settings.keyPaste')} />
        <AsyncButton onClick={() => save(v)} disabled={!v}>
          {t('common.save')}
        </AsyncButton>
        {has && (
          <AsyncButton className="ghost" onClick={() => save('')}>
            {t('common.delete')}
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
  const { locale, t } = useLocale()
  const [savingLocale, setSavingLocale] = useState(false)
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
  const sections = useMemo(() => {
    const keys: Partial<Record<Section, [PlainMessageKey, PlainMessageKey]>> = {
      language: ['language.label', 'language.help'],
      connect: ['settings.connect', 'settings.connectDesc'],
      models: ['settings.models', 'settings.modelsDesc'],
      project: ['settings.project', 'settings.projectDesc'],
      anim: ['app.animation', 'settings.animDesc'],
      mcp: ['settings.mcp', 'settings.mcpDesc'],
      web: ['settings.web', 'settings.webDesc'],
      about: ['settings.about', 'settings.aboutDesc']
    }
    return SECTIONS.map((x) => ({
      ...x,
      label: keys[x.id] ? t(keys[x.id]![0]) : x.id === 'tools' ? t('settings.tools') : x.label,
      desc: keys[x.id] ? t(keys[x.id]![1]) : x.id === 'unreal' ? t('settings.unrealDesc') : x.desc
    }))
  }, [t])
  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase(locale)
    if (!needle) return sections
    return sections.filter((x) => `${x.label} ${x.desc} ${x.id} ${x.keywords}`.toLocaleLowerCase(locale).includes(needle))
  }, [q, locale, sections])

  const badge = (id: Section): ReactNode => {
    if (id === 'connect') return missingCore ? <span className="set-dot warn" title={t('settings.missingKeys')} /> : <span className="set-count">{keyCount}/4</span>
    if (id === 'mcp' && s.mcpExpose.enabled) return <span className="set-dot ok" title={t('settings.mcpEnabled')} />
    if (id === 'web' && s.web.enabled) return <span className="set-dot ok" title={t('settings.webEnabled')} />
    return null
  }

  const test = async (fn: () => Promise<unknown>, label: string) => {
    try {
      const r = await fn()
      toast(message('settings.testOk', { name: label, detail: String(r).slice(0, 60) }), 'ok')
    } catch (e) {
      toast(message('feedback.namedDetail', { name: label, detail: errorMessage(e) }), 'error')
    }
  }

  const current = sections.find((x) => x.id === section)!
  let body: ReactNode
  switch (section) {
    case 'language':
      body = (
        <Card title={t('language.label')}>
          <Field label={t('language.label')} help={t('language.help')}>
            <select
              id="interface-language"
              className="input"
              aria-label={t('language.label')}
              value={locale}
              disabled={savingLocale}
              onChange={async (e) => {
                const next = e.target.value as Locale
                setSavingLocale(true)
                try {
                  await patch({ locale: next })
                } catch (error) {
                  toast(message('language.saveFailed', { detail: errorMessage(error) }), 'error')
                } finally {
                  setSavingLocale(false)
                }
              }}
            >
              {LOCALES.map((value) => (
                <option key={value} value={value}>
                  {LANGUAGE_NAMES[value]}
                </option>
              ))}
            </select>
          </Field>
        </Card>
      )
      break
    case 'connect':
      body = (
        <>
          <QuickConnect />
          <Card title={t('settings.manualKeys')} desc={t('settings.manualKeysHelp')}>
            <KeyField name="anthropic" label="Claude (Anthropic)" has={s.hasKeys.anthropic} link="platform.claude.com → API Keys" />
            <KeyField name="meshy" label="Meshy" has={s.hasKeys.meshy} link="meshy.ai → Settings → API" />
            <KeyField name="elevenlabs" label="ElevenLabs" has={s.hasKeys.elevenlabs} link="elevenlabs.io → Profile → API keys" />
            <KeyField name="huggingface" label="Hugging Face" has={s.hasKeys.huggingface} link="huggingface.co → Settings → Access Tokens" />
            <div className="row">
              <AsyncButton onClick={() => test(window.forge.testClaude, 'Claude')}>{t('settings.testClaude')}</AsyncButton>
              <AsyncButton onClick={() => test(async () => t('settings.credits', { count: await window.forge.testMeshy() }), 'Meshy')}>{t('settings.meshyBalance')}</AsyncButton>
            </div>
          </Card>
        </>
      )
      break
    case 'models':
      body = (
        <>
          <ModelSettings />
          <AgentClis />
        </>
      )
      break
    case 'project':
      body = (
        <Card title={t('settings.projectTitle')}>
          <Field label={t('settings.projectDir')} help={t('settings.projectDirHelp')}>
            <div className="row">
              <TextInput value={s.projectDir} onChange={() => {}} />
              <AsyncButton
                onClick={async () => {
                  const p = await window.forge.project.pickDir()
                  if (p) {
                    setProject(p)
                    setSettings(await window.forge.settings.get())
                    toast(message('settings.projectOpened', { name: p.name }), 'ok')
                  }
                }}
              >
                {t('settings.pickFolder')}
              </AsyncButton>
              <AsyncButton className="ghost" onClick={() => window.forge.openPath(s.projectDir)}>
                {t('settings.openFolder')}
              </AsyncButton>
            </div>
          </Field>
          <div className="grid2">
            <Field label={t('settings.concurrent')} help={t('settings.concurrentHelp')}>
              <NumberInput value={s.concurrency} onChange={(v) => patch({ concurrency: Math.min(8, Math.max(1, v)) })} />
            </Field>
            <Field label={t('settings.audioFormat')} help={t('settings.audioHelp')}>
              <Select
                value={s.audioFormat}
                onChange={(v) => patch({ audioFormat: v })}
                options={AUDIO.map((option) => ({
                  ...option,
                  label:
                    option.value === 'pcm_24000'
                      ? t('settings.audio24')
                      : option.value === 'pcm_44100'
                        ? t('settings.audio44')
                        : option.value === 'mp3_44100_128'
                          ? t('settings.audioMp3')
                          : option.label
                }))}
              />
            </Field>
          </div>
        </Card>
      )
      break
    case 'tools':
      body = (
        <>
          <Card title="Blender" desc={t('settings.blenderDesc')}>
            <Field label={t('settings.blenderPath')} help={s.blenderPath ? undefined : t('settings.blenderMissing')}>
              <div className="row">
                <TextInput value={s.blenderPath} onChange={(v) => patch({ blenderPath: v })} />
                <AsyncButton
                  onClick={async () => {
                    const [f] = await window.forge.pickFiles([{ name: 'Blender', extensions: ['exe'] }])
                    if (f) await patch({ blenderPath: f })
                  }}
                >
                  {t('settings.choose')}
                </AsyncButton>
              </div>
            </Field>
          </Card>
          <Card title={t('settings.comfyServers')} desc={t('settings.comfyDesc')}>
            <ComfyServers />
            <KeyField name="comfy" label={t('settings.comfyAccount')} has={s.hasKeys.comfy} link={t('settings.comfyKeyLink')} />
          </Card>
          <Card title={t('settings.comfyLibrary')} desc={t('settings.comfyLibraryDesc')}>
            <ComfyLibrary />
          </Card>
          <Card title={t('settings.comfyLocal')} desc={t('settings.comfyLocalDesc')}>
            <ComfyLocal />
            <Field label={t('common.installDir')} help={t('settings.comfyDirHelp')}>
              <TextInput value={s.comfyHome} onChange={(v) => patch({ comfyHome: v })} />
            </Field>
          </Card>
          <Card title={t('settings.backends')} desc={t('settings.backendDesc')}>
            <CustomBackends />
            <Field label={t('common.installDir')} help={t('settings.backendDirHelp')}>
              <TextInput value={s.backendsHome} onChange={(v) => patch({ backendsHome: v })} />
            </Field>
          </Card>
        </>
      )
      break
    case 'anim':
      body = (
        <Card title="NVIDIA Kimodo" desc={t('settings.kimodoDesc')}>
          <div className={`set-note ${s.hasKeys.huggingface ? 'ok' : ''}`}>
            <Icon name={s.hasKeys.huggingface ? 'check' : 'link'} size={15} />
            <span>{s.hasKeys.huggingface ? t('settings.hfConnected') : t('settings.hfRequired')}</span>
            {!s.hasKeys.huggingface && (
              <button className="btn primary" onClick={() => setSection('connect')}>
                {t('common.connect')}
              </button>
            )}
          </div>
          <Field label={t('settings.executionMode')} help={t('settings.executionModeHelp')}>
            <Select
              value={s.kimodoBackend}
              onChange={(v) => patch({ kimodoBackend: v as 'native' | 'wsl' })}
              options={[
                { value: 'native', label: t('settings.native') },
                { value: 'wsl', label: 'WSL2 + Docker' }
              ]}
            />
          </Field>
          <Field label={t('settings.kimodoDir')} help={t('settings.kimodoDirHelp')}>
            <TextInput value={s.kimodoHome} onChange={(v) => patch({ kimodoHome: v })} />
          </Field>
          <Field label={t('common.serviceUrl')}>
            <TextInput value={s.kimodoUrl} onChange={(v) => patch({ kimodoUrl: v })} />
          </Field>
        </Card>
      )
      break
    case 'unreal':
      body = (
        <Card title={t('settings.unrealConnection')}>
          <ol className="set-steps small">
            <li>{t('settings.unrealStep1')}</li>
            <li>{t('settings.unrealStep2')}</li>
            <li>{t('settings.unrealStep3')}</li>
            <li>{t('settings.unrealStep4')}</li>
          </ol>
          <AsyncButton
            className="primary"
            onClick={async () => {
              try {
                const st = await window.forge.ueStatus()
                const parts = [
                  st.remote.length ? `Remote Execution: ${st.remote.map((n) => `${n.projectName} (UE ${n.engineVersion})`).join(', ')}` : '',
                  st.mcp ? `MCP: ${t('settings.connected')}${st.python ? ` · Python: ${st.python}` : ` · ${t('settings.noPythonTool')}`}` : ''
                ].filter(Boolean)
                if (!parts.length) toast(message('settings.unrealNotFound'), 'error')
                else toast(parts.join(' · '), 'ok')
              } catch (e) {
                toast(errorMessage(e), 'error')
              }
            }}
          >
            {t('settings.findUnreal')}
          </AsyncButton>
          <div style={{ height: 14 }} />
          <Field label={t('settings.unrealUrl')} help={t('settings.unrealUrlHelp')}>
            <TextInput value={s.ueMcpUrl} onChange={(v) => patch({ ueMcpUrl: v })} />
          </Field>
          <Field label={t('settings.ikRig')} help={t('settings.ikRigHelp')}>
            <TextInput value={s.mannyIkRig} onChange={(v) => patch({ mannyIkRig: v })} />
          </Field>
        </Card>
      )
      break
    case 'mcp':
      body = <McpSettings />
      break
    case 'web':
      body = <WebSettings />
      break
    case 'about':
      body = (
        <Card title="AssetForge">
          <div className="kv2" style={{ gridTemplateColumns: '140px 1fr' }}>
            <span className="muted">{t('common.version')}</span>
            <span>v{__APP_VERSION__} (alpha)</span>
            <span className="muted">{t('common.license')}</span>
            <span>{t('settings.licenseSummary')}</span>
            <span className="muted">{t('settings.generatedAssets')}</span>
            <span>{t('settings.assetsOwnership')}</span>
            <span className="muted">{t('settings.keys')}</span>
            <span>{t('settings.keysProtection')}</span>
          </div>
          <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <a className="btn" href="https://github.com/HErkanuzun/AssetForge" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a className="btn" href="https://github.com/HErkanuzun/AssetForge/issues/new/choose" target="_blank" rel="noreferrer">
              {t('settings.reportIssue')}
            </a>
            <a className="btn ghost" href="https://github.com/HErkanuzun/AssetForge/releases" target="_blank" rel="noreferrer">
              {t('settings.releaseNotes')}
            </a>
            <a className="btn ghost" href="https://github.com/HErkanuzun/AssetForge/blob/main/LICENSE" target="_blank" rel="noreferrer">
              {t('settings.licenseText')}
            </a>
            <a className="btn ghost" href="https://github.com/HErkanuzun/AssetForge/blob/main/THIRD_PARTY_NOTICES.md" target="_blank" rel="noreferrer">
              {t('settings.thirdParty')}
            </a>
            <a className="btn ghost" href="https://github.com/HErkanuzun/AssetForge/blob/main/COMMERCIAL.md" target="_blank" rel="noreferrer">
              {t('settings.commercial')}
            </a>
          </div>
        </Card>
      )
      body = (
        <>
          {body}
          <div style={{ height: 14 }} />
          <Card title={t('settings.reporting')}>
            <p className="muted small" style={{ marginTop: 0 }}>
              {t('settings.diagnosticsHelp')}
            </p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <AsyncButton
                onClick={async () => {
                  try {
                    const f = await window.forge.diag.save()
                    if (f) toast(message('settings.diagnosticsSaved', { file: f }), 'ok')
                  } catch (e) {
                    toast(message('settings.diagnosticsFailed', { detail: errorMessage(e) }), 'error')
                  }
                }}
              >
                {t('settings.saveDiagnostics')}
              </AsyncButton>
              <AsyncButton className="ghost" onClick={() => window.forge.diag.openLogs().catch((e: Error) => toast(errorMessage(e), 'error'))}>
                {t('settings.openLogs')}
              </AsyncButton>
              <a className="btn ghost" href="https://github.com/HErkanuzun/AssetForge/issues/new?template=bug_report.yml" target="_blank" rel="noreferrer">
                {t('settings.reportBug')}
              </a>
            </div>
          </Card>
        </>
      )
      break
  }

  return (
    <div className="page split set-page">
      <nav className="set-nav" aria-label={t('settings.categories')}>
        <h1>{t('app.settings')}</h1>
        <div className="set-search">
          <Icon name="search" size={14} />
          <input
            className="input"
            placeholder={t('common.searchSettings')}
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
            {t('common.noResults')}
          </div>
        )}
        <div className="set-foot dim small">
          v{__APP_VERSION__} · {t('settings.keysEncrypted')}
        </div>
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
