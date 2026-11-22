// SPDX-License-Identifier: AGPL-3.0-only
// Runs the production renderer against deterministic local API fixtures in an isolated Edge profile.
// Usage: node scripts/verify-interface.mjs <absolute-output-directory> <edge-executable>
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !path.extname(specifier)) {
      const url = new URL(specifier + '.ts', context.parentURL)
      if (fs.existsSync(fileURLToPath(url))) return next(url.href, context)
    }
    return next(specifier, context)
  }
})
const { defaultProject } = await import('../src/shared/templates.ts')
const { ANIM_SYSTEMS } = await import('../src/shared/animSystems.ts')
const output = path.resolve(process.argv[2])
const executable = process.argv[3]
assert(output && executable, 'Provide output directory and Edge executable')
fs.mkdirSync(output, { recursive: true })
const project = defaultProject('用户项目 Özel')
const brief = {
  id: 'brief_fixture',
  title: '用户简报 Özel',
  status: 'ready',
  createdAt: 1,
  updatedAt: 1,
  spec: {
    name: '用户简报 Özel',
    kind: 'character',
    category: 'CHR',
    description: '原始描述',
    style: '用户风格',
    tier: 'hero',
    triBudget: 12000,
    size: '1.8m',
    palette: ['#aabbcc'],
    materials: '',
    world: '',
    notes: ''
  },
  kit: [],
  refs: [],
  links: [],
  view: [
    { kind: 'user', text: '用户消息 Özel' },
    { kind: 'assistant', text: 'AI 原始回复 Özel' },
    { kind: 'event', text: 'Brief hazır — kiti gözden geçirip üretime gönderebilirsin.' }
  ],
  history: [],
  costUsd: 0
}
const jobs = ['running', 'queued', 'done', 'failed', 'canceled'].map((status, i) => ({
  id: `job_${status}`,
  pipelineId: 'tpl_anim_kimodo',
  pipelineName: '用户流水线 Özel',
  assetId: `asset_${i}`,
  assetName: `用户任务 Özel ${status}`,
  status,
  createdAt: 1,
  outDir: 'C:/fixture/output',
  nodes: { step: { status: status === 'done' ? 'done' : status === 'failed' ? 'failed' : 'running', progress: 35, attempts: 1, logs: ['RAW_EXTERNAL_LOG Özel'], uiLogs: {} } },
  cost: { claudeUsd: 0.1, meshyCredits: 1, audioChars: 12 },
  warnings: [],
  ...(status === 'failed' ? { error: 'API anahtarı geçersiz', uiError: { key: 'provider.invalidKey' } } : {})
}))
let failNextSettings = false
project.assets = [
  {
    id: 'character_fixture',
    name: '用户角色 Özel',
    kind: 'character',
    category: 'CHR',
    subcategory: '',
    description: '原始描述',
    size: '1.8m',
    materials: '',
    variants: '',
    triBudget: 12000,
    budgetNote: '',
    priority: 'P1',
    status: 'Üretildi',
    source: 'fixture',
    extra: {}
  }
]
project.animSystems = ANIM_SYSTEMS.map((info, i) => ({
  id: `system_${i}`,
  characterId: project.assets[0].id,
  name: `${project.assets[0].name} · ${info.title}`,
  kind: info.kind,
  style: 'A tired soldier',
  axes: info.axes,
  clips: info.clips(),
  createdAt: 1,
  updatedAt: 1
}))
project.design = {
  pitch: '用户设计 Özel',
  fantasy: '原始幻想',
  audience: '玩家',
  pillars: ['原始支柱'],
  mechanics: [{ name: '用户机制', description: '机制内容' }],
  loops: [
    { id: 'loop_fixture', name: '用户循环', scope: 'core', description: '循环内容', nodes: [{ id: 'node_fixture', label: '用户节点', type: 'action', note: '原始注释', x: 80, y: 80 }], edges: [] }
  ],
  story: {
    premise: '原始故事',
    themes: ['主题'],
    acts: [{ id: 'act_fixture', title: '第一幕', summary: '原始摘要', beats: ['原始节拍'] }],
    characters: [{ id: 'story_character', name: '原始人物', role: '英雄', description: '人物内容', arc: '原始弧线' }]
  },
  screens: [{ id: 'screen_fixture', name: '用户屏幕', purpose: '原始目的', when: '游戏期间', layer: 'hud', widgets: [{ type: 'button', label: '用户按钮', binding: 'Player.Health' }], next: [] }]
}
let settings = {
  locale: 'en',
  claudeModel: 'claude-opus-5-5',
  concurrency: 2,
  projectDir: 'C:/fixture',
  blenderPath: '',
  audioFormat: 'pcm_24000',
  comfyServers: [],
  comfyDefaultServer: 'auto',
  comfyWorkflows: [],
  comfyDefaultWorkflow: '',
  customBackends: [],
  backendsHome: 'C:/fixture/backends',
  comfyHome: 'C:/fixture/comfy',
  kimodoHome: 'C:/fixture/kimodo',
  kimodoBackend: 'native',
  kimodoUrl: 'http://127.0.0.1:9551',
  wslDistro: 'Ubuntu-24.04',
  ueMcpUrl: '',
  mannyIkRig: '',
  llmProviders: [],
  llmRoles: { assistant: 'claude', prompts: 'claude', vision: 'claude' },
  mcpServers: [],
  mcpExpose: { enabled: false, port: 9560, token: 'fixture' },
  web: { enabled: false, port: 9570, lan: false, headless: false },
  hasKeys: { anthropic: true, meshy: true, elevenlabs: true, huggingface: true, comfy: false },
  webSearch: true,
  version: 'fixture'
}
const listeners = new Set()
settings.comfyServers = [
  { id: 'local', name: 'Bu bilgisayar (AssetForge kurulumu)', url: 'http://127.0.0.1:8188', enabled: true, managed: true },
  { id: 'custom', name: '用户服务器 Özel', url: 'http://127.0.0.1:8189', enabled: true }
]
settings.comfyWorkflows = [
  {
    id: 'workflow_fixture',
    name: '用户工作流 Özel',
    produces: ['image', 'audio'],
    roles: ['prompt', 'seed'],
    classTypes: ['SaveImage'],
    models: ['用户模型.safetensors'],
    serverId: 'local',
    addedAt: 1
  }
]
settings.customBackends = [
  {
    id: 'backend_fixture',
    name: '用户后端 Özel',
    addedAt: 1,
    recipe: {
      name: '用户后端 Özel',
      repo: 'https://example.invalid/fixture.git',
      python: '3.11',
      install: ['echo fixture'],
      start: 'python app.py',
      port: 7860,
      api: 'gradio',
      env: {},
      ready: '/',
      startTimeout: 60,
      produces: ['image']
    }
  }
]
settings.mcpServers = [{ id: 'mcp_fixture', name: '用户工具 Özel', transport: 'stdio', command: 'fixture', args: '', env: '', url: '', headers: '', autoApprove: false, enabled: true }]
const calls = []
async function call(channel, ...args) {
  calls.push(channel)
  switch (channel) {
    case 'settings:get':
      return settings
    case 'settings:set':
      if (failNextSettings) {
        failNextSettings = false
        throw Object.assign(new Error('fixture write failure'), { uiMessage: { key: 'provider.forbidden' } })
      }
      settings = { ...settings, ...args[0] }
      for (const res of listeners) res.write(`data: ${JSON.stringify({ c: 'settings:locale', p: settings.locale })}\n\n`)
      return settings
    case 'project:load':
      return project
    case 'project:save':
      return { rev: 1 }
    case 'jobs:list':
      return jobs
    case 'brief:list':
      return [brief]
    case 'brief:get':
      return brief
    case 'agent:list':
      return []
    case 'comfy:wf:list':
      return settings.comfyWorkflows
    case 'comfy:servers':
      return settings.comfyServers.map((s) => ({ id: s.id, online: false, error: 'fixture external diagnostic' }))
    case 'agent:clis':
      return [
        { id: 'claude-code', name: 'Claude Code', installed: false, install: 'npm install -g @anthropic-ai/claude-code' },
        { id: 'codex', name: 'Codex', installed: true, path: 'C:/fixture/codex', version: 'fixture', install: 'npm install -g @openai/codex' }
      ]
    case 'backends:status':
      return [{ id: 'backend_fixture', cloned: true, installed: false, stale: false, running: false, healthy: false, url: 'http://127.0.0.1:7860' }]
    case 'library:thumbs':
      return {}
    case 'web:me':
      return { id: 'fixture', name: 'Fixture', role: 'owner' }
    case 'web:status':
      return { running: false, urls: [], ownerSet: true, users: [], invites: [], online: [] }
    case 'ue:status':
      return { remote: [], mcp: false }
    case 'mcp:status':
      return { servers: [], expose: { running: false, url: '' } }
    case 'kimodo:status':
      return { backend: 'native', healthy: false, running: false, steps: [], home: 'C:/fixture', url: 'http://127.0.0.1:9551' }
    case 'comfy:status':
      return { healthy: false, running: false, steps: [], home: 'C:/fixture', url: 'http://127.0.0.1:8188', remote: false }
    case 'animsys:list':
      return project.animSystems
    case 'animsys:states':
      return []
    default:
      return []
  }
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  if (url.pathname === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' })
    res.write(': fixture\n\n')
    listeners.add(res)
    req.on('close', () => listeners.delete(res))
    return
  }
  if (url.pathname.startsWith('/api/call/')) {
    let raw = ''
    for await (const part of req) raw += part
    const body = raw ? JSON.parse(raw) : {}
    try {
      const value = await call(decodeURIComponent(url.pathname.slice(10)), ...(body.args || []))
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, value }))
    } catch (error) {
      res.writeHead(500).end(JSON.stringify({ ok: false, error: error.message, uiMessage: error.uiMessage }))
    }
    return
  }
  const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
  const file = path.resolve('out/renderer', relative)
  if (!file.startsWith(path.resolve('out/renderer') + path.sep)) {
    res.writeHead(403).end()
    return
  }
  if (!fs.existsSync(file)) {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' }).end(fs.readFileSync(file))
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const profile = fs.mkdtempSync(path.join(output, 'edge-profile-'))
const child = spawn(
  executable,
  [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-features=BackForwardCache,Translate,msEdgeTranslate',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--window-size=1440,1080',
    'about:blank'
  ],
  { stdio: 'ignore', windowsHide: true }
)
child.on('error', (e) => console.error(e))
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let socket
const pending = new Map()
let seq = 0
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq
    const timeout = setTimeout(() => {
      pending.delete(id)
      reject(Error('CDP timed out: ' + method))
    }, 15000)
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timeout)
        resolve(value)
      },
      reject: (error) => {
        clearTimeout(timeout)
        reject(error)
      }
    })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
const report = { pages: [], surfaces: [], errors: [], calls }
try {
  const portFile = path.join(profile, 'DevToolsActivePort')
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await delay(100)
  assert(fs.existsSync(portFile), 'Edge did not start')
  const port = fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0]
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())
  socket = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
  socket.addEventListener('message', ({ data }) => {
    const value = JSON.parse(data)
    if (value.id) {
      const entry = pending.get(value.id)
      pending.delete(value.id)
      if (value.error) entry?.reject(Error(value.error.message))
      else entry?.resolve(value.result)
    } else if (value.method === 'Runtime.exceptionThrown') report.errors.push(value.params.exceptionDetails)
  })
  await cdp('Runtime.enable')
  await cdp('Page.enable')
  const evaluate = async (expression) => {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  const waitFor = async (expression) => {
    for (let i = 0; i < 400; i++) {
      if (await evaluate(expression)) return
      await delay(50)
    }
    throw Error('UI condition timed out: ' + expression)
  }
  const capture = async () => ({
    text: await evaluate('document.body.innerText'),
    controls: await evaluate(
      `Array.from(document.querySelectorAll('button,input,textarea,select,[title],[aria-label]'), el=>({tag:el.tagName,text:el.tagName==='SELECT'?Array.from(el.options,o=>({label:o.label,value:o.value})):el.textContent,placeholder:el.getAttribute('placeholder'),title:el.getAttribute('title'),ariaLabel:el.getAttribute('aria-label')}))`
    )
  })
  for (const locale of ['en', 'zh-CN', 'tr']) {
    settings.locale = locale
    for (const page of ['home', 'settings', 'library', 'anim', 'pipeline', 'jobs', 'design', 'bible']) {
      for (const res of listeners) res.end()
      listeners.clear()
      await cdp('Page.navigate', { url: `${origin}/?fixture=${locale}_${page}#${page}` })
      try {
        await waitFor(`document.documentElement.lang===${JSON.stringify(locale)} && !!document.querySelector('.app') && location.search.includes(${JSON.stringify(locale + '_' + page)})`)
      } catch (error) {
        console.error(JSON.stringify({ locale, page, state: await evaluate('({lang:document.documentElement.lang,text:document.body.innerText,url:location.href})'), errors: report.errors }))
        throw error
      }
      await delay(150)
      const text = await evaluate('document.body.innerText')
      assert(text.length > 100, `${locale}/${page} rendered empty`)
      report.pages.push({ locale, page, text })
      if (locale !== 'tr' && page === 'settings') {
        const count = await evaluate("document.querySelectorAll('.set-item').length")
        for (let i = 0; i < count; i++) {
          await evaluate(`document.querySelectorAll('.set-item')[${i}].click()`)
          await delay(120)
          report.surfaces.push({ locale, page: `settings/${i}`, ...(await capture()) })
          fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
        }
        await evaluate("document.querySelector('.set-item').click()")
        await evaluate(
          `(()=>{const input=document.querySelector('.set-search input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'no-results-fixture-xyz');input.dispatchEvent(new Event('input',{bubbles:true}));})()`
        )
        await delay(80)
        assert(await evaluate("!!document.querySelector('.set-nav select') && document.querySelectorAll('.set-item').length===0"), 'Language selector disappeared with empty search')
        const other = locale === 'en' ? 'zh-CN' : 'en'
        await evaluate(`(()=>{const el=document.querySelector('.set-nav select');el.value=${JSON.stringify(other)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`)
        await waitFor(`document.documentElement.lang===${JSON.stringify(other)}`)
        await evaluate(`(()=>{const el=document.querySelector('.set-nav select');el.value=${JSON.stringify(locale)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`)
        await waitFor(`document.documentElement.lang===${JSON.stringify(locale)}`)
        failNextSettings = true
        await evaluate(`(()=>{const el=document.querySelector('.set-nav select');el.value=${JSON.stringify(other)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`)
        await waitFor("!!document.querySelector('.toast.error')")
        assert.equal(await evaluate('document.documentElement.lang'), locale, 'Failed save changed the active language')
        report.saveRollback = true
        await evaluate(
          "(()=>{const input=document.querySelector('.set-search input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'');input.dispatchEvent(new Event('input',{bubbles:true}));})()"
        )
      }
      if (locale !== 'tr' && page === 'anim') {
        await waitFor("document.querySelectorAll('.clip').length>=7")
        for (let i = 0; i < 7; i++) {
          await evaluate(`document.querySelectorAll('.clip')[${i}].click()`)
          await delay(100)
          report.surfaces.push({ locale, page: `animation/${i}`, ...(await capture()) })
        }
      }
      if (locale !== 'tr' && page === 'pipeline') {
        await waitFor("document.querySelectorAll('.palette-item').length===24")
        for (let i = 0; i < 24; i++) {
          await evaluate(`document.querySelectorAll('.palette-item')[${i}].click()`)
          await delay(50)
          report.surfaces.push({ locale, page: `pipeline/node-${i}`, ...(await capture()) })
        }
        await evaluate("document.querySelector('.pl-toolbar button.primary').click()")
        await waitFor("!!document.querySelector('.modal')")
        report.surfaces.push({ locale, page: 'pipeline/run-dialog', ...(await capture()) })
        const target = locale === 'en' ? 'zh-CN' : 'en'
        await evaluate("window.__dialog=document.querySelector('.modal');true")
        for (const res of listeners) res.write(`data: ${JSON.stringify({ c: 'settings:locale', p: target })}\n\n`)
        await waitFor(`document.documentElement.lang===${JSON.stringify(target)}`)
        assert(await evaluate("document.querySelector('.modal')===window.__dialog"), 'Language switch remounted the run dialog')
        for (const res of listeners) res.write(`data: ${JSON.stringify({ c: 'settings:locale', p: locale })}\n\n`)
        await waitFor(`document.documentElement.lang===${JSON.stringify(locale)}`)
        report.openDialogSwitch = true
        await evaluate("document.querySelector('.modal button.ghost').click()")
      }
      if (locale !== 'tr' && page === 'design') {
        for (let i = 0; i < 5; i++) {
          await evaluate(`document.querySelectorAll('.design .seg button')[${i}].click()`)
          await delay(80)
          report.surfaces.push({ locale, page: `design/${i}`, ...(await capture()) })
        }
      }
      if (locale !== 'tr' && page === 'jobs') {
        for (let i = 0; i < jobs.length; i++) {
          await evaluate(`document.querySelectorAll('.job-item')[${i}].click()`)
          await delay(60)
          await evaluate("document.querySelectorAll('.node-block').forEach(el=>el.open=true)")
          const text = await evaluate('document.body.innerText')
          assert(text.includes('RAW_EXTERNAL_LOG Özel'), 'External logs were rewritten')
          if (jobs[i].status === 'failed') assert(text.includes(locale === 'en' ? 'API key is invalid' : 'API 密钥无效'), 'Application error was not localized')
          report.surfaces.push({ locale, page: `jobs/${jobs[i].status}`, text })
        }
      }
      fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
      if (page === 'settings' || page === 'home') {
        await waitFor("!document.querySelector('.toast')")
        const png = await cdp('Page.captureScreenshot', { format: 'png' })
        fs.writeFileSync(path.join(output, `${locale}-${page}.png`), Buffer.from(png.data, 'base64'))
      }
      if (locale !== 'tr' && page === 'home') {
        await evaluate("document.querySelector('.brief-card').click()")
        await waitFor("!!document.querySelector('.brief .event')")
        const text = await evaluate('document.body.innerText')
        assert(text.includes('用户消息 Özel') && text.includes('AI 原始回复 Özel'), 'Conversation content was translated')
        assert(text.includes(locale === 'en' ? 'Brief ready' : '需求简报已就绪'), 'Brief event was not localized')
        report.surfaces.push({ locale, page: 'brief', text })
        await evaluate("if(!document.querySelector('.assistant'))document.querySelector('.as-toggle').click()")
        await waitFor("!!document.querySelector('.assistant')")
        assert(!(await evaluate("document.querySelector('.as-input').textContent")).includes('Atölye'), 'Assistant context label remained Turkish')
        report.surfaces.push({ locale, page: 'assistant', ...(await capture()) })
      }
      if (locale !== 'tr' && page === 'library') {
        await evaluate("document.querySelector('.lib-head .seg button:nth-child(2)').click()")
        await waitFor("!!document.querySelector('table')")
        report.surfaces.push({ locale, page: 'assets/table', ...(await capture()) })
      }
    }
  }
  // Switch in place while a draft and a running job remain mounted.
  for (const res of listeners) res.end()
  listeners.clear()
  await cdp('Page.navigate', { url: `${origin}/?fixture=draft#home` })
  await waitFor("!!document.querySelector('textarea')")
  await evaluate(
    `(()=>{const el=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'保留草稿 Özel');el.dispatchEvent(new Event('input',{bubbles:true}));window.__draft=el;window.__mount=el.closest('main');})()`
  )
  const before = JSON.stringify(project)
  for (const res of listeners) res.write(`data: ${JSON.stringify({ c: 'job:update', p: { ...jobs[3], id: 'job_toast' } })}\n\n`)
  await waitFor("!!document.querySelector('.toast.error')")
  for (const res of listeners) res.write(`data: ${JSON.stringify({ c: 'settings:locale', p: 'zh-CN' })}\n\n`)
  await waitFor("document.documentElement.lang==='zh-CN'")
  assert(await evaluate("document.querySelector('textarea')===window.__draft && window.__draft.value==='保留草稿 Özel'"), 'Locale change lost draft or remounted input')
  await waitFor("[...document.querySelectorAll('.toast.error')].some(el=>el.textContent.includes('API 密钥无效'))")
  assert.equal(JSON.stringify(project), before, 'Locale switch mutated project data')
  assert.equal(jobs[0].status, 'running')
  for (const res of listeners) res.write(`data: ${JSON.stringify({ c: 'job:update', p: { ...jobs[0], id: 'job_completed_fixture', status: 'done' } })}\n\n`)
  await waitFor("[...document.querySelectorAll('.toast.ok')].some(el=>el.textContent.includes('已就绪')&&el.textContent.includes('用户任务 Özel'))")
  report.subsequentJobFeedback = true
  report.existingToastSwitch = true
  report.projectUnchanged = true
  report.inPlaceSwitch = true
  assert.equal(report.errors.length, 0, 'Renderer raised exceptions')
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ pages: report.pages.length, errors: report.errors.length, inPlaceSwitch: report.inPlaceSwitch, output }))
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  if (socket?.readyState === WebSocket.OPEN) await cdp('Browser.close').catch(() => {})
  socket?.close()
  server.closeAllConnections()
  server.close()
}
