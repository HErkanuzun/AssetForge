// SPDX-License-Identifier: AGPL-3.0-only
import { UiError } from './i18n/errors'
import { message, renderMessage, type MessageDescriptor } from './i18n/message'
// Özel arka uçlar: git deposundan kurulan yapay zekâ projeleri (Gradio demosu ya da HTTP sunucusu).
// Kurulum tarifi (assetforge.json) deponun kökünde olabilir; yoksa AssetForge dosyalara bakıp bir taslak önerir.
// Bu modül saf: tarifi okur, denetler, yer tutucuları doldurur, taslak çıkarır (Electron'a bağlı değil).
import type { BackendRecipe, ComfyOutputKind } from './types'

export const RECIPE_FILE = 'assetforge.json'

const KINDS: ComfyOutputKind[] = ['image', 'model', 'audio', 'anim']

/** https / ssh git adresi mi? Yerel yol ve file:// kabul edilmez (ne çalıştırılacağı belli olsun) */
export function isGitUrl(url: string): boolean {
  return /^(https:\/\/[\w.-]+\/[\w.~/-]+?(\.git)?\/?|git@[\w.-]+:[\w.~/-]+?(\.git)?)$/i.test(url.trim())
}

/** Depo adından okunur bir kimlik: "https://github.com/a/TRELLIS.2.git" → "trellis-2" */
export function slugFromRepo(url: string): string {
  const last =
    url
      .trim()
      .replace(/\.git\/?$/i, '')
      .split(/[/:]/)
      .filter(Boolean)
      .pop() ?? 'backend'
  return (
    last
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'backend'
  )
}

/** Tarif JSON'unu okur ve denetler; eksik alanlar varsayılanla dolar, hatalı olanlar anlaşılır hatayla reddedilir */
export function parseRecipe(input: string | object, repoFallback = ''): BackendRecipe {
  let o: Record<string, unknown>
  if (typeof input === 'string') {
    try {
      o = JSON.parse(input.replace(/^﻿/, '')) as Record<string, unknown>
    } catch (e) {
      throw new UiError(message('error.2fa7479d96', { p0: String((e as Error).message) }), { cause: e })
    }
  } else o = input as Record<string, unknown>
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new UiError(message('error.24b57090d1'))
  const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string).trim() : '')
  const repo = str('repo') || repoFallback
  if (!repo || !isGitUrl(repo)) throw new UiError(message('error.8c39657e41'))
  const install = Array.isArray(o.install) ? o.install.map((x) => String(x).trim()).filter(Boolean) : typeof o.install === 'string' ? [o.install.trim()].filter(Boolean) : []
  const start = str('start')
  if (!start) throw new UiError(message('error.a955c0f3ba'))
  const port = Number(o.port ?? 7860)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new UiError(message('error.dac1f55433'))
  const api = str('api') || 'gradio'
  if (api !== 'gradio' && api !== 'http') throw new UiError(message('error.a2689fb329'))
  const python = str('python')
  if (python && !/^3\.\d{1,2}$/.test(python)) throw new UiError(message('error.7c6ac7bd11'))
  const env: Record<string, string> = {}
  if (o.env && typeof o.env === 'object' && !Array.isArray(o.env)) for (const [k, v] of Object.entries(o.env)) if (/^[A-Z_][A-Z0-9_]*$/i.test(k)) env[k] = String(v)
  const produces = Array.isArray(o.produces) ? (o.produces.filter((k) => KINDS.includes(k as ComfyOutputKind)) as ComfyOutputKind[]) : []
  const ready = str('ready') || '/'
  const startTimeout = Number(o.startTimeout ?? 600)
  return {
    name: str('name') || slugFromRepo(repo),
    repo,
    ...(str('ref') ? { ref: str('ref') } : {}),
    python,
    install,
    start,
    port,
    api,
    env,
    ready: ready.startsWith('/') ? ready : `/${ready}`,
    startTimeout: Number.isFinite(startTimeout) && startTimeout > 0 ? Math.min(startTimeout, 3600) : 600,
    produces,
    ...(str('notes') ? { notes: str('notes') } : {})
  }
}

export interface RecipeVars {
  port: number
  python: string
  uv: string
  repo: string
}

/** Komutlardaki {port} {python} {uv} {repo} yer tutucularını doldurur; yollar boşluk içerebilir diye tırnaklanır */
export function fillCommand(cmd: string, v: RecipeVars): string {
  const q = (p: string) => (/\s/.test(p) ? `"${p}"` : p)
  return cmd.replaceAll('{port}', String(v.port)).replaceAll('{python}', q(v.python)).replaceAll('{uv}', q(v.uv)).replaceAll('{repo}', q(v.repo))
}

export interface RepoProbe {
  /** Kök dizindeki dosya adları */
  files: string[]
  /** requirements.txt içeriği (varsa) */
  requirements?: string
  /** Olası başlatma dosyalarının ilk birkaç KB'ı: ad → içerik */
  entries: Record<string, string>
}

const ENTRY_CANDIDATES = ['app.py', 'gradio_app.py', 'demo.py', 'webui.py', 'app_gradio.py', 'run_gradio.py', 'server.py', 'api.py', 'main.py']

/** Deponun dosyalarına bakarak bir tarif taslağı önerir; kullanıcı kurmadan önce görür ve düzenler */
export function guessRecipe(repo: string, p: RepoProbe): { recipe: BackendRecipe; notes: string[]; uiNotes: MessageDescriptor[] } {
  const notes: string[] = []
  const uiNotes: MessageDescriptor[] = []
  const note = (value: MessageDescriptor) => {
    uiNotes.push(value)
    notes.push(renderMessage('tr', value))
  }
  const files = new Set(p.files.map((f) => f.toLowerCase()))
  const req = p.requirements ?? ''
  const entry = ENTRY_CANDIDATES.find((f) => files.has(f))
  const entryText = entry ? (p.entries[entry] ?? '') : ''
  const gradio = /gradio/i.test(req) || /import gradio|from gradio/.test(entryText)
  const fastapi = /fastapi|flask|uvicorn/i.test(req) || /FastAPI\(|Flask\(|uvicorn/.test(entryText)
  const install: string[] = []
  if (/^torch\b|\btorch[=<>~! ]|\btorch$/im.test(req)) {
    install.push('{uv} pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128')
    note(message('backend.noteTorch'))
  }
  if (files.has('requirements.txt')) install.push('{uv} pip install -r requirements.txt')
  else if (files.has('pyproject.toml') || files.has('setup.py')) install.push('{uv} pip install -e .')
  else note(message('backend.noteRequirements'))
  if (gradio && !/gradio/i.test(req)) install.push('{uv} pip install gradio')
  let start = ''
  if (entry) start = `{python} ${entry}${gradio ? '' : ' --port {port}'}`
  else note(message('backend.noteStart'))
  if (!gradio && !fastapi) note(message('backend.noteServer'))
  if (entry && gradio && !/server_port|GRADIO_SERVER_PORT/.test(entryText)) note(message('backend.notePort'))
  return {
    recipe: {
      name: slugFromRepo(repo),
      repo,
      python: '3.11',
      install,
      start: start || '{python} app.py',
      port: 7860,
      api: gradio || !fastapi ? 'gradio' : 'http',
      env: {},
      ready: '/',
      startTimeout: 600,
      produces: []
    },
    notes,
    uiNotes
  }
}

/** Ayarlar'da gösterilecek düzenlenebilir JSON (repo hariç her şey) */
export function recipeToJson(r: BackendRecipe): string {
  return JSON.stringify(r, null, 2)
}
