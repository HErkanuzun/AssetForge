// SPDX-License-Identifier: AGPL-3.0-only
import { app, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { setLogSecrets } from './log'
import type { LlmProvider, LlmRoles, McpExpose, McpServerConfig, SettingsPatch, SettingsPublic } from '../shared/types'

type SecretName = 'anthropic' | 'meshy' | 'elevenlabs' | 'huggingface' | 'comfy' | `llm:${string}`

interface SettingsFile {
  claudeModel: string
  comfyUrl: string
  comfyWorkflow: string
  /** AssetForge'un kurduğu yerel ComfyUI klasörü (venv + ComfyUI deposu) */
  comfyHome: string
  blenderPath: string
  /** Unreal MCP sunucusu (Remote Execution yoksa yedek yol) */
  ueMcpUrl: string
  projectDir: string
  audioFormat: string
  concurrency: number
  mannyIkRig: string
  wslDistro: string
  kimodoUrl: string
  kimodoBackend: 'native' | 'wsl'
  kimodoHome: string
  /** Ek LLM sağlayıcıları (yerleşik Claude hariç) */
  llmProviders: LlmProvider[]
  llmRoles: LlmRoles
  mcpServers: McpServerConfig[]
  mcpExpose: McpExpose
  /** Claude için web araması (referans araştırması) */
  webSearch: boolean
  /** safeStorage ile şifrelenmiş, base64 */
  secrets: Partial<Record<SecretName, string>>
}

const file = () => path.join(app.getPath('userData'), 'settings.json')

function detectBlender(): string {
  const root = 'C:\\Program Files\\Blender Foundation'
  try {
    const dirs = fs
      .readdirSync(root)
      .filter((d) => fs.existsSync(path.join(root, d, 'blender.exe')))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    if (dirs.length) return path.join(root, dirs[0], 'blender.exe')
  } catch {
    /* Blender kurulu değil */
  }
  return ''
}

function defaults(): SettingsFile {
  return {
    claudeModel: 'claude-opus-5-5',
    comfyUrl: 'http://127.0.0.1:8188',
    comfyWorkflow: '',
    comfyHome: path.join(app.getPath('userData'), 'comfyui'),
    blenderPath: detectBlender(),
    ueMcpUrl: 'http://127.0.0.1:8000/mcp',
    projectDir: path.join(app.getPath('documents'), 'AssetForge', 'Projem'),
    // 44.1 kHz PCM ElevenLabs Pro plan ister; 24 kHz tüm planlarda çalışır
    audioFormat: 'pcm_24000',
    concurrency: 2,
    // GASP / Third Person şablonundaki Manny IK Rig'i
    mannyIkRig: '/Game/Characters/Mannequins/Rigs/IK_Mannequin',
    wslDistro: 'Ubuntu-24.04',
    kimodoUrl: 'http://127.0.0.1:9551',
    // BIOS sanallaştırması gerektirmeyen yol varsayılan
    kimodoBackend: 'native',
    // Modeller ~25 GB: Ayarlar → Animasyon'dan büyük bir diske taşınabilir
    kimodoHome: path.join(app.getPath('userData'), 'kimodo'),
    llmProviders: [],
    llmRoles: { assistant: 'claude', prompts: 'claude', vision: 'claude' },
    mcpServers: [],
    mcpExpose: { enabled: true, port: 9560, token: crypto.randomBytes(18).toString('base64url') },
    webSearch: true,
    secrets: {}
  }
}

let cache: SettingsFile | null = null

export function getSettings(): SettingsFile {
  if (cache) return cache
  let loaded: Partial<SettingsFile> = {}
  try {
    loaded = JSON.parse(fs.readFileSync(file(), 'utf8'))
  } catch (e) {
    // Dosya yoksa ilk açılış. Bozuksa sessizce sıfırlama: yedeğini al ki anahtarlar kurtarılabilsin
    if (fs.existsSync(file())) {
      const backup = file().replace(/\.json$/, `.broken-${Date.now()}.json`)
      fs.copyFileSync(file(), backup)
      console.error(`[settings] ayar dosyası okunamadı, yedeklendi: ${backup}`, (e as Error).message)
    }
  }
  const d = defaults()
  cache = { ...d, ...loaded, secrets: { ...loaded.secrets } }
  savedProjectDir = cache.projectDir
  // Geliştirme kancası: yalnızca bu oturum için; dosyaya yazılmaz
  if (process.env.FORGE_PROJECT_DIR) cache.projectDir = process.env.FORGE_PROJECT_DIR
  if (!cache.blenderPath) cache.blenderPath = d.blenderPath
  // Kimodo büyük bir diske taşındıysa ComfyUI de yanına kurulur
  if (!loaded.comfyHome) cache.comfyHome = path.join(path.dirname(cache.kimodoHome), 'comfyui')
  if (!loaded.mcpExpose) persist() // MCP token'ı bir kez üretilip saklansın
  refreshLogSecrets()
  return cache
}

let savedProjectDir = ''

function persist(): void {
  fs.mkdirSync(path.dirname(file()), { recursive: true })
  const out = process.env.FORGE_PROJECT_DIR ? { ...cache, projectDir: savedProjectDir } : cache
  // Önce geçici dosyaya yaz, sonra değiştir: yazma yarıda kalırsa eski ayarlar bozulmaz
  const tmp = file() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(out, null, 2))
  fs.renameSync(tmp, file())
  refreshLogSecrets()
}

/** Günlükte maskelenecek gerçek değerler: kayıtlı anahtarlar, MCP token'ı, dış MCP başlık/ortam değerleri */
function refreshLogSecrets(): void {
  if (!cache) return
  const values: string[] = [cache.mcpExpose.token]
  for (const enc of Object.values(cache.secrets)) {
    try {
      if (enc) values.push(safeStorage.decryptString(Buffer.from(enc, 'base64')))
    } catch {
      /* başka kullanıcıya ait şifreli değer */
    }
  }
  for (const m of cache.mcpServers) {
    for (const line of [...m.env.split(/\r?\n/), ...m.headers.split(/\r?\n/)]) {
      const v = line.split(/[=:]/).slice(1).join(':').trim()
      if (v) values.push(v.replace(/^Bearer\s+/i, ''))
    }
  }
  setLogSecrets(values)
}

export function getSecret(name: SecretName): string | undefined {
  const enc = getSettings().secrets[name]
  if (!enc) {
    const env = ({ anthropic: 'ANTHROPIC_API_KEY', meshy: 'MESHY_API_KEY', elevenlabs: 'ELEVENLABS_API_KEY', huggingface: 'HF_TOKEN', comfy: 'COMFY_API_KEY' } as Record<string, string>)[name]
    return env ? process.env[env] || undefined : undefined
  }
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    return undefined
  }
}

export function setSettings(patch: SettingsPatch): void {
  const s = getSettings()
  const { secrets, providerKeys, ...rest } = patch
  for (const [id, v] of Object.entries(providerKeys ?? {})) {
    if (v === '') delete s.secrets[`llm:${id}`]
    else s.secrets[`llm:${id}`] = safeStorage.encryptString(v.trim()).toString('base64')
  }
  if (rest.llmProviders) rest.llmProviders = rest.llmProviders.filter((p) => !p.builtin).map(({ hasKey: _h, builtin: _b, ...p }) => p)
  Object.assign(s, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)))
  if (secrets) {
    for (const [k, v] of Object.entries(secrets) as [SecretName, string | undefined][]) {
      if (v === undefined) continue
      if (v === '') delete s.secrets[k]
      else s.secrets[k] = safeStorage.encryptString(v.trim()).toString('base64')
    }
  }
  persist()
}

export function publicSettings(): SettingsPublic {
  const s = getSettings()
  return {
    claudeModel: s.claudeModel,
    comfyUrl: s.comfyUrl,
    comfyWorkflow: s.comfyWorkflow,
    comfyHome: s.comfyHome,
    blenderPath: s.blenderPath,
    ueMcpUrl: s.ueMcpUrl,
    projectDir: s.projectDir,
    audioFormat: s.audioFormat,
    concurrency: s.concurrency,
    mannyIkRig: s.mannyIkRig,
    wslDistro: s.wslDistro,
    kimodoUrl: s.kimodoUrl,
    kimodoBackend: s.kimodoBackend,
    kimodoHome: s.kimodoHome,
    llmProviders: allProviders().map((p) => ({ ...p, hasKey: p.builtin ? !!getSecret('anthropic') : !!getSecret(`llm:${p.id}`) })),
    llmRoles: s.llmRoles,
    mcpServers: s.mcpServers,
    mcpExpose: s.mcpExpose,
    webSearch: s.webSearch,
    hasKeys: {
      anthropic: !!getSecret('anthropic'),
      meshy: !!getSecret('meshy'),
      elevenlabs: !!getSecret('elevenlabs'),
      huggingface: !!getSecret('huggingface'),
      comfy: !!getSecret('comfy')
    }
  }
}

/** Yerleşik Claude + kullanıcının eklediği sağlayıcılar */
export function allProviders(): LlmProvider[] {
  const s = getSettings()
  return [{ id: 'claude', name: 'Claude (Anthropic)', kind: 'anthropic', baseUrl: '', model: s.claudeModel, vision: true, builtin: true }, ...s.llmProviders]
}

export function providerFor(role: keyof LlmRoles): LlmProvider {
  const all = allProviders()
  return all.find((p) => p.id === getSettings().llmRoles[role]) ?? all[0]
}

export function providerKey(p: LlmProvider): string | undefined {
  return p.builtin ? getSecret('anthropic') : getSecret(`llm:${p.id}`)
}
