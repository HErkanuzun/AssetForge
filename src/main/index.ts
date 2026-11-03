// SPDX-License-Identifier: AGPL-3.0-only
import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AgentInput, AssetKind, Bible, Brief, BriefInput, ConnectEvent, ConnectService, Job, Project, SettingsPatch } from '../shared/types'
import { connectCancel, connectStart } from './connect'
import { buildDiagnostics, saveDiagnostics } from './diagnostics'
import { initLog, logDir, writeLog } from './log'
import { hardenApp, isInside, openInsideProject, showInsideProject } from './security'
import { approve, createConv, deleteConv, listConvs, loadConv, sendAgent, stopConv } from './agent/assistant'
import { mcpStatus, mcpTest } from './agent/mcpClient'
import { mcpServerRunning, mcpUrl, syncMcpServer } from './agent/mcpServer'
import { oaTest } from './ai/openai'
import { suggestPipeline } from '../shared/templates'
import { kimodoLogs, kimodoStatus, kimodoStep } from './integrations/kimodo'
import { briefToAssets, createBrief, libraryThumbnails, sendBrief } from './providers/brief'
import { Runner } from './engine/runner'
import { importAssetList } from './importers/assetList'
import { discoverUe } from './integrations/ue'
import { deleteBrief, listBriefs, listJobs, loadBrief, loadProject, saveBrief, saveProject } from './project'
import { clientFor, extractBible, planAnimSystem, suggestMotion, testClaude } from './providers/claude'
import { animSystemInfo, newAnimSystem } from '../shared/animSystems'
import type { AnimSystem, AnimSystemKind } from '../shared/types'
import { applyPlan, buildSystemInUe, deleteSystem, getSystem, listSystems, produceSystem, saveSystem, stopProduce, systemStates, type ProduceOptions } from './anim/systems'
import { balance } from './providers/meshy'
import { allProviders, getSettings, publicSettings, setSettings } from './settings'

initLog(app.getPath('logs'))
console.info(`[app] AssetForge ${app.getVersion()} başlıyor (Electron ${process.versions.electron}, ${process.platform} ${process.arch})`)

// Tek örnek: ikinci açılış mevcut pencereyi öne getirir (MCP portu ve ayar dosyası çakışmasın).
// Geliştirme kancaları (anlık görüntü, otomatik çalıştırma) ayrı örnek olarak çalışabilir.
const devHook = process.env.FORGE_SNAPSHOT || process.env.FORGE_AUTORUN || process.env.FORGE_AGENT_TEST || process.env.FORGE_DIAG
if (!devHook && !app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}
app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

protocol.registerSchemesAsPrivileged([{ scheme: 'forge', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }])

let win: BrowserWindow | null = null

const runner = new Runner(
  (job: Job) => {
    win?.webContents.send('job:update', job)
    // Geliştirme: FORGE_AUTORUN ile başlatılan iş bitince sonucu yazdırıp kapan
    if (process.env.FORGE_AUTORUN && ['done', 'failed', 'canceled'].includes(job.status)) {
      console.log('[autorun] ' + JSON.stringify(job, null, 1))
      setTimeout(() => app.quit(), 500)
    }
  },
  () => getSettings().concurrency
)

function createWindow(): void {
  win = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#07080c',
    title: 'AssetForge',
    autoHideMenuBar: true,
    // Launcher görünümü: çerçevesiz, Windows pencere düğmeleri üst şeride bindirilir
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#c9cdd6', height: 40 },
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false
    }
  })
  // Arayüz hatalarını da günlüğe yaz (yakalanmamış istisnalar konsola "error" olarak düşer)
  win.webContents.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 'warning') writeLog(`renderer:${e.level === 'error' ? 'error' : 'warn'}`, `${e.message} (${e.sourceId.split('/').pop()}:${e.lineNumber})`)
  })
  win.webContents.on('render-process-gone', (_e, d) => console.error('[renderer] süreç kapandı:', d.reason, d.exitCode))
  win.on('unresponsive', () => console.warn('[renderer] pencere yanıt vermiyor'))
  win.on('responsive', () => console.info('[renderer] pencere yeniden yanıt veriyor'))
  const page = process.env.FORGE_PAGE ?? ''
  if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL'] + (page ? '#' + page : ''))
  else win.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: page })

  // Geliştirme: FORGE_SNAPSHOT=dosya.png → sayfa yüklenince ekran görüntüsü alıp kapanır
  const snap = process.env.FORGE_SNAPSHOT
  if (snap) {
    win.webContents.on('console-message', (e) => console.log(`[renderer:${e.level}] ${e.message}`))
    win.webContents.on('render-process-gone', (_e, d) => console.log('[renderer gone]', d.reason))
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        // FORGE_SNAPSHOT_JS: çekimden önce çalışacak JS (ör. kaydırma)
        if (process.env.FORGE_SNAPSHOT_JS) {
          await win!.webContents.executeJavaScript(process.env.FORGE_SNAPSHOT_JS).catch(() => undefined)
          await new Promise((r) => setTimeout(r, 600))
        }
        for (let i = 0; i < 5; i++) {
          try {
            const img = await win!.webContents.capturePage()
            fs.writeFileSync(snap, img.toPNG())
            break
          } catch (e) {
            console.log('[snapshot failed]', (e as Error).message)
            await new Promise((r) => setTimeout(r, 1000))
          }
        }
        app.quit()
      }, 3500)
    })
  }
}

/** forge://local/<encoded path> → yalnızca proje klasörü içindeki dosyalar */
function registerFileProtocol(): void {
  protocol.handle('forge', (req) => {
    const url = new URL(req.url)
    const file = path.resolve(decodeURIComponent(url.pathname.slice(1)))
    if (!isInside(getSettings().projectDir, file)) return new Response('forbidden', { status: 403 })
    // Arayüz file:// kökenli; fetch (BVH önizleme) için CORS başlığı ekle
    return net.fetch(pathToFileURL(file).toString()).then((r) => {
      const headers = new Headers(r.headers)
      headers.set('Access-Control-Allow-Origin', '*')
      return new Response(r.body, { status: r.status, headers })
    })
  })
}

function handle<T extends unknown[], R>(channel: string, fn: (...args: T) => R | Promise<R>): void {
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      return { ok: true, value: await fn(...(args as T)) }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })
}

function registerIpc(): void {
  const dir = () => getSettings().projectDir

  handle('settings:get', () => publicSettings())
  handle('settings:set', async (patch: SettingsPatch) => {
    setSettings(patch)
    if (patch.mcpExpose) await startMcp()
    return publicSettings()
  })

  handle('project:load', () => loadProject(dir()))
  handle('project:save', (p: Project) => saveProject(dir(), p))
  handle('project:pickDir', async () => {
    const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory', 'createDirectory'], title: 'Proje klasörü seç' })
    if (r.canceled || !r.filePaths[0]) return null
    setSettings({ projectDir: r.filePaths[0] })
    return loadProject(r.filePaths[0])
  })

  handle('dialog:pickFiles', async (filters: { name: string; extensions: string[] }[], multi: boolean) => {
    const r = await dialog.showOpenDialog(win!, { properties: multi ? ['openFile', 'multiSelections'] : ['openFile'], filters })
    return r.canceled ? [] : r.filePaths
  })

  handle('assets:import', (file: string) => importAssetList(file))
  handle('bible:extract', (pdfs: string[], current: Bible, categoryHint: string) => extractBible({ pdfs, current, categoryHint }))

  handle('run:start', (pipelineId: string, assetIds: string[]) => runner.start(loadProject(dir()), dir(), pipelineId, assetIds))
  handle('run:cancel', (jobId: string) => runner.cancel(jobId))
  handle('jobs:list', () => listJobs(dir()))

  handle('ue:discover', () => discoverUe())
  handle('test:claude', () => testClaude())
  handle('test:meshy', () => balance())

  // Brief Chat
  handle('brief:create', (seed?: { title?: string; kind?: AssetKind }) => ({ ...createBrief(dir(), seed), history: [] }))
  handle('brief:list', () => listBriefs(dir()))
  handle('brief:get', (id: string) => {
    const b = loadBrief(dir(), id)
    return b ? { ...b, history: [] } : null
  })
  handle('brief:send', (id: string, input: BriefInput) => sendBrief(dir(), loadProject(dir()), id, input, (ev) => win?.webContents.send('brief:event', ev)))
  handle('brief:patch', (id: string, patch: Partial<Pick<Brief, 'title' | 'kit' | 'status' | 'committedAssetIds'>>) => {
    const b = loadBrief(dir(), id)
    if (!b) throw new Error('Brief bulunamadı')
    Object.assign(b, patch, { updatedAt: Date.now() })
    saveBrief(dir(), b)
    return { ...b, history: [] }
  })
  handle('brief:delete', (id: string) => deleteBrief(dir(), id))
  handle('brief:toAssets', (id: string) => {
    const b = loadBrief(dir(), id)
    if (!b) throw new Error('Brief bulunamadı')
    return briefToAssets(b, loadProject(dir()).assets, suggestPipeline)
  })
  handle('library:thumbs', () => libraryThumbnails(dir()))

  // Kimodo (NVIDIA hareket üretimi)
  handle('kimodo:status', () => kimodoStatus())
  handle('kimodo:step', (step: string) => kimodoStep(step, (line) => win?.webContents.send('kimodo:log', line)))
  handle('kimodo:logs', () => kimodoLogs())
  handle('kimodo:suggest', async (text: string, character: string) => {
    const { data, usd } = await suggestMotion(loadProject(dir()).bible, text, character)
    return { ...data, usd }
  })

  // Animasyon sistemleri
  const sysCtx = () => ({ dir: dir(), runner, notify: (p: Project) => win?.webContents.send('project:changed', p) })
  handle('animsys:list', (characterId?: string) => listSystems(dir(), characterId))
  handle('animsys:create', (kind: AnimSystemKind, characterId: string, name?: string, style?: string) => saveSystem(sysCtx(), newAnimSystem(kind, characterId, name, style)))
  handle('animsys:save', (sys: AnimSystem) => saveSystem(sysCtx(), sys))
  handle('animsys:delete', (id: string, withAssets?: boolean) => deleteSystem(sysCtx(), id, !!withAssets))
  handle('animsys:states', (id: string) => systemStates(dir(), getSystem(dir(), id)))
  handle('animsys:plan', async (id: string, request: string) => {
    const p = loadProject(dir())
    const sys = getSystem(dir(), id)
    const ch = p.assets.find((a) => a.id === sys.characterId)
    const { data, usd } = await planAnimSystem(
      p.bible,
      { kind: sys.kind, title: animSystemInfo(sys.kind).title, style: sys.style, clips: sys.clips.map(({ assetId: _a, ...c }) => c) },
      ch ? `${ch.name}: ${ch.description}` : '',
      request
    )
    const next = saveSystem(sysCtx(), { ...applyPlan(sys, data), description: request || sys.description })
    return { system: next, rationale: data.rationale, usd }
  })
  handle('animsys:produce', (id: string, opts?: ProduceOptions) => produceSystem(sysCtx(), id, { ...opts, log: (m) => console.log('[animsys]', m) }))
  handle('animsys:stop', (id: string) => stopProduce(sysCtx(), id))
  handle('animsys:build', (id: string) => buildSystemInUe(sysCtx(), id))

  // Yapımcı asistanı
  const deps = {
    runner,
    notify: (p: Project) => win?.webContents.send('project:changed', p),
    emit: (e: unknown) => win?.webContents.send('agent:event', e)
  }
  handle('agent:list', () => listConvs(dir()))
  handle('agent:get', (id: string) => {
    const c = loadConv(dir(), id)
    return c ? { ...c, history: [] } : null
  })
  handle('agent:create', (providerId?: string) => ({ ...createConv(dir(), providerId), history: [] }))
  handle('agent:send', (id: string, input: AgentInput) => sendAgent(dir(), id, input, deps))
  handle('agent:approve', (id: string, toolId: string, ok: boolean) => approve(id, toolId, ok))
  handle('agent:stop', (id: string) => stopConv(id))
  handle('agent:delete', (id: string) => deleteConv(dir(), id))

  // Sağlayıcılar ve MCP
  handle('llm:test', async (providerId: string) => {
    const p = allProviders().find((x) => x.id === providerId)
    if (!p) throw new Error('Sağlayıcı bulunamadı')
    if (p.kind === 'openai') return oaTest(p)
    if (p.builtin) return testClaude()
    const r = await clientFor(p).messages.create({ model: p.model, max_tokens: 20, messages: [{ role: 'user', content: 'Sadece "hazır" yaz.' }] })
    return `${r.model}: ${r.content.map((b) => (b.type === 'text' ? b.text : '')).join('')}`
  })
  handle('mcp:status', async () => ({ servers: await mcpStatus(), expose: { running: mcpServerRunning(), url: mcpUrl() } }))
  handle('mcp:test', (id: string) => mcpTest(id))

  // Hızlı bağlantı: servis sayfasını tarayıcıda aç, anahtarı yakala
  handle('connect:start', (service: ConnectService) =>
    connectStart(
      service,
      (e: ConnectEvent) => win?.webContents.send('connect:event', e),
      () => {
        if (win?.isMinimized()) win.restore()
        win?.flashFrame(true)
      }
    )
  )
  handle('connect:cancel', () => connectCancel())

  handle('shell:openPath', (p: string) => openInsideProject(p, dir()))
  handle('shell:showItem', (p: string) => showInsideProject(p, dir()))

  // Tanılama: hata bildirimine eklenecek dosya ve günlük klasörü
  handle('diag:save', () => saveDiagnostics(win))
  handle('diag:openLogs', async () => {
    const err = await shell.openPath(logDir())
    if (err) throw new Error(err)
  })
}

function startMcp(): Promise<void> {
  return syncMcpServer(
    () => ({ dir: getSettings().projectDir, runner, notify: (p: Project) => win?.webContents.send('project:changed', p) }),
    (name) => win?.webContents.send('agent:external', name)
  )
}

app.on('child-process-gone', (_e, d) => {
  if (d.reason !== 'clean-exit') console.error('[app] alt süreç kapandı:', d.type, d.reason, d.exitCode, d.name ?? '')
})

app.whenReady().then(() => {
  hardenApp()
  registerFileProtocol()
  registerIpc()
  createWindow()
  startMcp().catch((e) => console.error('[mcp]', e))
  // Geliştirme: FORGE_AGENT_TEST="mesaj" → Yapımcı'ya mesaj gönder, sohbeti yazdır, kapan
  const agentTest = process.env.FORGE_AGENT_TEST
  if (agentTest) {
    const d = getSettings().projectDir
    const c = createConv(d)
    sendAgent(d, c.id, { text: agentTest, context: { page: 'library', selectedAssets: ['KAR001'] } }, { runner, notify: () => undefined, emit: () => undefined })
      .then((r) => console.log('[agent] ' + JSON.stringify(r.view, null, 1)))
      .catch((e) => console.log('[agent error] ' + (e as Error).message))
      .finally(() => setTimeout(() => app.quit(), 300))
  }
  // Geliştirme: FORGE_DIAG=dosya.txt → tanılama dosyasını kaydetme penceresi olmadan yazar
  if (process.env.FORGE_DIAG) {
    buildDiagnostics()
      .then((t) => fs.writeFileSync(process.env.FORGE_DIAG!, t))
      .finally(() => app.quit())
  }
  // Geliştirme: FORGE_AUTORUN="pipelineId|assetId" → arayüzsüz uçtan uca test
  const auto = process.env.FORGE_AUTORUN
  if (auto) {
    const [pipelineId, assetId] = auto.split('|')
    runner.start(loadProject(getSettings().projectDir), getSettings().projectDir, pipelineId, [assetId])
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
