// SPDX-License-Identifier: AGPL-3.0-only
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
      throw new Error(`Tarif JSON okunamadı: ${(e as Error).message}`, { cause: e })
    }
  } else o = input as Record<string, unknown>
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('Tarif bir JSON nesnesi olmalı')
  const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string).trim() : '')
  const repo = str('repo') || repoFallback
  if (!repo || !isGitUrl(repo)) throw new Error('Tarifte geçerli bir "repo" (https git adresi) yok')
  const install = Array.isArray(o.install) ? o.install.map((x) => String(x).trim()).filter(Boolean) : typeof o.install === 'string' ? [o.install.trim()].filter(Boolean) : []
  const start = str('start')
  if (!start) throw new Error('Tarifte "start" (başlatma komutu) yok')
  const port = Number(o.port ?? 7860)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('"port" 1024–65535 arasında bir sayı olmalı')
  const api = str('api') || 'gradio'
  if (api !== 'gradio' && api !== 'http') throw new Error('"api" gradio ya da http olmalı')
  const python = str('python')
  if (python && !/^3\.\d{1,2}$/.test(python)) throw new Error('"python" 3.10, 3.11, 3.12 gibi bir sürüm olmalı (boş = sanal ortam yok)')
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
export function guessRecipe(repo: string, p: RepoProbe): { recipe: BackendRecipe; notes: string[] } {
  const notes: string[] = []
  const files = new Set(p.files.map((f) => f.toLowerCase()))
  const req = p.requirements ?? ''
  const entry = ENTRY_CANDIDATES.find((f) => files.has(f))
  const entryText = entry ? (p.entries[entry] ?? '') : ''
  const gradio = /gradio/i.test(req) || /import gradio|from gradio/.test(entryText)
  const fastapi = /fastapi|flask|uvicorn/i.test(req) || /FastAPI\(|Flask\(|uvicorn/.test(entryText)
  const install: string[] = []
  if (/^torch\b|\btorch[=<>~! ]|\btorch$/im.test(req)) {
    install.push('{uv} pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128')
    notes.push('PyTorch CUDA 12.8 sürümüyle kurulur; depo başka bir sürüm istiyorsa bu satırı değiştirin.')
  }
  if (files.has('requirements.txt')) install.push('{uv} pip install -r requirements.txt')
  else if (files.has('pyproject.toml') || files.has('setup.py')) install.push('{uv} pip install -e .')
  else notes.push('requirements.txt / pyproject.toml bulunamadı: kurulum komutlarını README’ye bakarak yazın.')
  if (gradio && !/gradio/i.test(req)) install.push('{uv} pip install gradio')
  let start = ''
  if (entry) start = `{python} ${entry}${gradio ? '' : ' --port {port}'}`
  else notes.push('Başlatma dosyası bulunamadı (app.py, demo.py …): "start" komutunu README’ye bakarak yazın.')
  if (!gradio && !fastapi) notes.push('Gradio ya da HTTP sunucusu görünmüyor: proje yalnızca komut satırından çalışıyorsa önce küçük bir sunucu sarmalayıcı gerekir.')
  if (entry && gradio && !/server_port|GRADIO_SERVER_PORT/.test(entryText))
    notes.push('Gradio portu GRADIO_SERVER_PORT ortam değişkeniyle verilir; uygulama kendi portunu sabitliyorsa "port" alanını ona göre değiştirin.')
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
    notes
  }
}

/** Ayarlar'da gösterilecek düzenlenebilir JSON (repo hariç her şey) */
export function recipeToJson(r: BackendRecipe): string {
  return JSON.stringify(r, null, 2)
}
