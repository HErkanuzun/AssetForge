// SPDX-License-Identifier: AGPL-3.0-only
// Özel arka uçlar: git deposundan kurulan yapay zekâ projeleri. Her biri kendi klasöründe (depo, uv sanal ortamı,
// günlük) durur; AssetForge kurar, gerektiğinde arka planda başlatır, hazır olunca adresini düğüme verir.
// Kurulum komutları kullanıcının onayladığı tariften gelir; depo kodu bu bilgisayarda tam yetkiyle çalışır.
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { BackendRecipe, BackendStatus, CustomBackend } from '../../shared/types'
import { fillCommand, guessRecipe, isGitUrl, parseRecipe, RECIPE_FILE, slugFromRepo, type RepoProbe } from '../../shared/backends'
import { getSettings, setSettings } from '../settings'
import { sleep } from '../util'
import { run, type LogFn } from './process'

const win = process.platform === 'win32'
const home = () => getSettings().backendsHome
const dirOf = (id: string) => path.join(home(), id.replace(/[^\w-]/g, ''))
const repoOf = (id: string) => path.join(dirOf(id), 'repo')
const venvOf = (id: string) => path.join(dirOf(id), 'venv')
const pyOf = (id: string) => path.join(venvOf(id), win ? 'Scripts' : 'bin', win ? 'python.exe' : 'python')
const logOf = (id: string) => path.join(dirOf(id), 'server.log')
const stateOf = (id: string) => path.join(dirOf(id), 'state.json')

interface State {
  installedHash?: string
  pid?: number
}
function readState(id: string): State {
  try {
    return JSON.parse(fs.readFileSync(stateOf(id), 'utf8')) as State
  } catch {
    return {}
  }
}
function writeState(id: string, patch: State): void {
  fs.mkdirSync(dirOf(id), { recursive: true })
  fs.writeFileSync(stateOf(id), JSON.stringify({ ...readState(id), ...patch }, null, 2))
}

/** Kurulumu etkileyen alanlar değişince "yeniden kur" uyarısı çıkar */
export const installHash = (r: BackendRecipe) =>
  crypto
    .createHash('sha1')
    .update(JSON.stringify([r.repo, r.ref ?? '', r.python, r.install]))
    .digest('hex')
    .slice(0, 12)

export const listBackends = (): CustomBackend[] => getSettings().customBackends

export function getBackend(id: string): CustomBackend {
  const b = listBackends().find((x) => x.id === id)
  if (!b) throw new Error(`Arka uç bulunamadı: ${id}`)
  return b
}

const save = (list: CustomBackend[]) => setSettings({ customBackends: list })
export const backendUrl = (b: CustomBackend) => `http://127.0.0.1:${b.recipe.port}`

/** uv yalnızca Python ortamı ya da {uv} kullanan tarifler için gerekir */
const needsUv = (r: BackendRecipe) => !!r.python || [...r.install, r.start].some((c) => c.includes('{uv}'))

async function findUv(log?: LogFn): Promise<string> {
  const local = path.join(os.homedir(), '.local', 'bin', win ? 'uv.exe' : 'uv')
  if (fs.existsSync(local)) return local
  const w = await run(win ? 'where' : 'which', ['uv'])
  const found = w.code === 0 ? w.out.split(/\r?\n/).find((l) => l.trim()) : undefined
  if (found) return found.trim()
  if (!win) throw new Error('uv bulunamadı: https://docs.astral.sh/uv/ adresinden kurun')
  log?.('uv kuruluyor (Python ortam yöneticisi)…')
  const r = await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://astral.sh/uv/install.ps1 | iex'], { log, timeoutMs: 10 * 60_000 })
  if (r.code !== 0 || !fs.existsSync(local)) throw new Error('uv kurulamadı; https://docs.astral.sh/uv/ adresinden elle kurun')
  return local
}

/** Komut ortamı: sanal ortam önde, Gradio portu ve adresi, modeller büyük diskte ortak önbellekte */
function commandEnv(b: CustomBackend, uv: string): Record<string, string> {
  const pathKey = Object.keys(process.env).find((k) => k.toLowerCase() === 'path') ?? 'PATH'
  const bin = path.join(venvOf(b.id), win ? 'Scripts' : 'bin')
  const vars = { port: b.recipe.port, python: pyOf(b.id), uv, repo: repoOf(b.id) }
  const env: Record<string, string> = {
    [pathKey]: `${b.recipe.python ? bin + path.delimiter : ''}${path.dirname(uv)}${path.delimiter}${process.env[pathKey] ?? ''}`,
    PYTHONUTF8: '1',
    PYTHONUNBUFFERED: '1',
    PORT: String(b.recipe.port),
    GRADIO_SERVER_PORT: String(b.recipe.port),
    GRADIO_SERVER_NAME: '127.0.0.1',
    GRADIO_ANALYTICS_ENABLED: 'False',
    HF_HOME: path.join(home(), '_hf'),
    // uv önbelleği ile sanal ortam ayrı disklerde olabilir
    UV_LINK_MODE: 'copy'
  }
  if (b.recipe.python) env.VIRTUAL_ENV = venvOf(b.id)
  for (const [k, v] of Object.entries(b.recipe.env)) env[k] = fillCommand(v, vars)
  return env
}

function shell(cmd: string): [string, string[]] {
  return win ? ['cmd.exe', ['/d', '/s', '/c', `"${cmd}"`]] : ['/bin/sh', ['-c', cmd]]
}

async function runCmd(b: CustomBackend, uv: string, cmd: string, log: LogFn, signal?: AbortSignal): Promise<void> {
  const filled = fillCommand(cmd, { port: b.recipe.port, python: pyOf(b.id), uv, repo: repoOf(b.id) })
  log(`$ ${filled}`)
  const [exe, args] = shell(filled)
  const r = await run(exe, args, { cwd: repoOf(b.id), env: commandEnv(b, uv), log, signal, verbatim: win, timeoutMs: 3 * 60 * 60_000 })
  if (signal?.aborted) throw new Error('İptal edildi')
  if (r.code !== 0) throw new Error(`Komut başarısız (kod ${r.code}): ${filled}`)
}

async function git(args: string[], log: LogFn, cwd?: string, signal?: AbortSignal): Promise<void> {
  const r = await run('git', args, { cwd, log, signal, timeoutMs: 60 * 60_000, env: { GIT_TERMINAL_PROMPT: '0' } })
  if (r.code !== 0) throw new Error(`git ${args[0]} başarısız (kod ${r.code}). Git kurulu mu, adres doğru mu?`)
}

/** Kök dizindeki dosyalar ve olası başlatma dosyalarının başı: taslak tarif için */
function probeRepo(dir: string): RepoProbe {
  const files = fs.readdirSync(dir)
  const read = (f: string, max = 8000) => {
    try {
      return fs.readFileSync(path.join(dir, f), 'utf8').slice(0, max)
    } catch {
      return undefined
    }
  }
  const entries: Record<string, string> = {}
  for (const f of files) if (/\.py$/i.test(f)) entries[f.toLowerCase()] = read(f) ?? ''
  return { files, requirements: read('requirements.txt', 20000), entries }
}

function uniqueId(slug: string): string {
  const ids = new Set(listBackends().map((b) => b.id))
  if (!ids.has(slug) && !fs.existsSync(dirOf(slug))) return slug
  for (let i = 2; ; i++) if (!ids.has(`${slug}-${i}`) && !fs.existsSync(dirOf(`${slug}-${i}`))) return `${slug}-${i}`
}

function freePort(want: number, exceptId?: string): number {
  const used = new Set(
    listBackends()
      .filter((b) => b.id !== exceptId)
      .map((b) => b.recipe.port)
  )
  let p = want
  while (used.has(p)) p++
  return p
}

/**
 * Depoyu indirir (kod çalıştırmaz) ve tarifi bulur: depoda assetforge.json varsa o, yoksa dosyalara bakılarak
 * önerilen taslak. Kullanıcı tarifi görüp onaylamadan hiçbir komut çalışmaz.
 */
export async function addBackend(gitUrl: string, log: LogFn, signal?: AbortSignal): Promise<{ backend: CustomBackend; notes: string[] }> {
  const url = gitUrl.trim()
  if (!isGitUrl(url)) throw new Error('Geçerli bir git adresi girin (https://github.com/kullanıcı/proje)')
  const id = uniqueId(slugFromRepo(url))
  fs.mkdirSync(dirOf(id), { recursive: true })
  try {
    await git(['clone', '--depth', '1', url, repoOf(id)], log, undefined, signal)
  } catch (e) {
    fs.rmSync(dirOf(id), { recursive: true, force: true })
    throw e
  }
  let recipe: BackendRecipe
  let notes: string[] = []
  let fromRepo = false
  const own = path.join(repoOf(id), RECIPE_FILE)
  if (fs.existsSync(own)) {
    recipe = parseRecipe(fs.readFileSync(own, 'utf8'), url)
    fromRepo = true
    notes.push(`Depodaki ${RECIPE_FILE} tarifi kullanılıyor. Kurmadan önce komutları gözden geçirin.`)
  } else {
    const g = guessRecipe(url, probeRepo(repoOf(id)))
    recipe = g.recipe
    notes = [`Depoda ${RECIPE_FILE} yok; dosyalara bakılarak bir taslak hazırlandı. README’ye göre düzeltin.`, ...g.notes]
  }
  recipe.port = freePort(recipe.port)
  const backend: CustomBackend = { id, name: recipe.name, recipe, addedAt: Date.now(), recipeFromRepo: fromRepo }
  save([...listBackends(), backend])
  return { backend, notes }
}

export function updateRecipe(id: string, json: string): CustomBackend {
  const b = getBackend(id)
  const recipe = parseRecipe(json, b.recipe.repo)
  if (recipe.port !== b.recipe.port && listBackends().some((x) => x.id !== id && x.recipe.port === recipe.port)) throw new Error(`Port ${recipe.port} başka bir arka uçta kullanılıyor`)
  const next = { ...b, name: recipe.name, recipe }
  save(listBackends().map((x) => (x.id === id ? next : x)))
  return next
}

/** Onaylanmış tarifle kurar: istenen sürüme geçer, uv ile sanal ortam açar, kurulum komutlarını sırayla çalıştırır */
export async function installBackend(id: string, log: LogFn, signal?: AbortSignal): Promise<void> {
  const b = getBackend(id)
  await stopBackend(id).catch(() => undefined)
  if (!fs.existsSync(path.join(repoOf(id), '.git'))) await git(['clone', '--depth', '1', b.recipe.repo, repoOf(id)], log, undefined, signal)
  if (b.recipe.ref) {
    await git(['fetch', '--depth', '1', 'origin', b.recipe.ref], log, repoOf(id), signal)
    await git(['checkout', '--force', 'FETCH_HEAD'], log, repoOf(id), signal)
  }
  const uv = needsUv(b.recipe) ? await findUv(log) : 'uv'
  if (b.recipe.python) {
    if (!fs.existsSync(pyOf(id))) {
      log(`Python ${b.recipe.python} sanal ortamı oluşturuluyor…`)
      const r = await run(uv, ['venv', '--seed', '--python', b.recipe.python, venvOf(id)], { log, signal, timeoutMs: 30 * 60_000 })
      if (r.code !== 0) throw new Error('Sanal ortam oluşturulamadı (uv venv)')
    }
  }
  writeState(id, { installedHash: undefined })
  for (const cmd of b.recipe.install) await runCmd(b, uv, cmd, log, signal)
  writeState(id, { installedHash: installHash(b.recipe) })
  log('Kurulum tamam')
}

const alive = (pid?: number) => {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function healthy(b: CustomBackend): Promise<boolean> {
  try {
    const r = await fetch(`${backendUrl(b)}${b.recipe.ready}`, { signal: AbortSignal.timeout(2500) })
    return r.status < 500
  } catch {
    return false
  }
}

export async function backendStatus(id: string): Promise<BackendStatus> {
  const b = getBackend(id)
  const st = readState(id)
  const ok = await healthy(b)
  return {
    id,
    cloned: fs.existsSync(path.join(repoOf(id), '.git')),
    installed: !!st.installedHash,
    stale: !!st.installedHash && st.installedHash !== installHash(b.recipe),
    running: ok || alive(st.pid),
    healthy: ok,
    url: backendUrl(b)
  }
}

export const backendStatuses = () => Promise.all(listBackends().map((b) => backendStatus(b.id)))

export async function startBackend(id: string, log: LogFn): Promise<void> {
  const b = getBackend(id)
  if (await healthy(b)) return
  const st = readState(id)
  if (!st.installedHash) throw new Error(`“${b.name}” henüz kurulmadı (Ayarlar → Yerel araçlar → Özel arka uçlar → Kur)`)
  if (alive(st.pid)) return
  const uv = needsUv(b.recipe) ? await findUv(log) : 'uv'
  const cmd = fillCommand(b.recipe.start, { port: b.recipe.port, python: pyOf(id), uv, repo: repoOf(id) })
  log(`Başlatılıyor: ${cmd}`)
  const out = fs.openSync(logOf(id), 'a')
  fs.writeSync(out, `\n===== ${new Date().toISOString()} ${cmd}\n`)
  const [exe, args] = shell(cmd)
  const p = spawn(exe, args, { cwd: repoOf(id), env: { ...process.env, ...commandEnv(b, uv) }, detached: true, windowsHide: true, stdio: ['ignore', out, out], windowsVerbatimArguments: win })
  p.unref()
  fs.closeSync(out)
  writeState(id, { pid: p.pid })
}

export async function stopBackend(id: string): Promise<void> {
  const st = readState(id)
  if (!alive(st.pid)) return
  if (win) await run('taskkill', ['/PID', String(st.pid), '/T', '/F'])
  else process.kill(-st.pid!, 'SIGTERM')
  writeState(id, { pid: undefined })
}

export function backendLogs(id: string, lines = 200): string {
  try {
    return fs.readFileSync(logOf(id), 'utf8').split(/\r?\n/).slice(-lines).join('\n')
  } catch {
    return ''
  }
}

/** Düğüm çalışmadan önce: açıksa adresini ver, değilse başlat ve hazır olana kadar bekle */
export async function ensureBackend(id: string, log: LogFn, signal?: AbortSignal): Promise<string> {
  const b = getBackend(id)
  if (await healthy(b)) return backendUrl(b)
  await startBackend(id, log)
  log(`“${b.name}” açılıyor (ilk açılışta modeller indirilebilir; en fazla ${Math.round(b.recipe.startTimeout / 60)} dk beklenir)…`)
  const until = Date.now() + b.recipe.startTimeout * 1000
  while (Date.now() < until) {
    if (await healthy(b)) {
      log(`“${b.name}” hazır: ${backendUrl(b)}`)
      return backendUrl(b)
    }
    if (!alive(readState(id).pid)) break
    await sleep(3000, signal)
  }
  const tail = backendLogs(id, 8).replace(/\s+/g, ' ').slice(-500)
  throw new Error(`“${b.name}” açılmadı. Son günlük: ${tail || '(boş)'}`)
}

export async function removeBackend(id: string): Promise<void> {
  await stopBackend(id).catch(() => undefined)
  save(listBackends().filter((x) => x.id !== id))
  fs.rmSync(dirOf(id), { recursive: true, force: true })
}

export const backendFolder = (id: string) => dirOf(id)
