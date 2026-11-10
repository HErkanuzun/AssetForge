// SPDX-License-Identifier: AGPL-3.0-only
// window.forge nesnesi: masaüstünde IPC'ye, tarayıcıda web sunucusuna (HTTP + olay akışı) bağlanır.
// İşlem adları iki tarafta aynıdır; yalnızca taşıyıcı değişir.
import type { ForgeApi } from '../preload/api'

export interface ForgeBridge {
  call<T>(channel: string, ...args: unknown[]): Promise<T>
  /** Olay dinleyicisi; dönen işlev dinlemeyi bırakır */
  on<T>(channel: string, cb: (payload: T) => void): () => void
  /** Sürükle-bırak dosyasının yolu (tarayıcıda yok: boş) */
  pathForFile(f: File): string
  /** Bırakılan dosyayı kullanılabilir bir yola çevirir (tarayıcıda sunucuya yükler) */
  dropFile(f: File): Promise<string>
  web: boolean
}

export function createApi(b: ForgeBridge): ForgeApi {
  const call = b.call.bind(b) as <T>(channel: string, ...args: unknown[]) => Promise<T>
  return {
    isWeb: b.web,
    settings: {
      get: () => call('settings:get'),
      set: (patch) => call('settings:set', patch)
    },
    project: {
      load: () => call('project:load'),
      save: (p) => call('project:save', p),
      pickDir: () => call('project:pickDir')
    },
    pickFiles: (filters, multi = false) => call('dialog:pickFiles', filters, multi),
    importAssets: (file) => call('assets:import', file),
    extractBible: (pdfs, current, hint) => call('bible:extract', pdfs, current, hint),
    design: {
      generate: (project, section, instruction, engine) => call('design:generate', project, section, instruction, engine),
      exportMd: (project) => call('design:exportMd', project),
      teachUe: (project) => call('design:teachUe', project)
    },
    run: {
      start: (pipelineId, assetIds) => call('run:start', pipelineId, assetIds),
      cancel: (jobId) => call('run:cancel', jobId)
    },
    jobs: () => call('jobs:list'),
    onNavigate: (cb) => b.on('nav:page', cb),
    onJobUpdate: (cb) => b.on('job:update', cb),
    ueDiscover: () => call('ue:discover'),
    ueStatus: () => call('ue:status'),
    testClaude: () => call('test:claude'),
    testMeshy: () => call('test:meshy'),
    testComfy: (id, draft) => call('test:comfy', id, draft),
    openPath: (p) => call('shell:openPath', p),
    showItem: (p) => call('shell:showItem', p),
    pathForFile: (f) => b.pathForFile(f),
    dropFile: (f) => b.dropFile(f),
    brief: {
      create: (seed) => call('brief:create', seed),
      list: () => call('brief:list'),
      get: (id) => call('brief:get', id),
      send: (id, input) => call('brief:send', id, input),
      patch: (id, patch) => call('brief:patch', id, patch),
      remove: (id) => call('brief:delete', id),
      toAssets: (id) => call('brief:toAssets', id),
      onEvent: (cb) => b.on('brief:event', cb)
    },
    library: {
      thumbs: () => call('library:thumbs')
    },
    agent: {
      list: () => call('agent:list'),
      get: (id) => call('agent:get', id),
      create: (providerId) => call('agent:create', providerId),
      send: (id, input) => call('agent:send', id, input),
      approve: (id, toolId, ok) => call('agent:approve', id, toolId, ok),
      stop: (id) => call('agent:stop', id),
      remove: (id) => call('agent:delete', id),
      onEvent: (cb) => b.on('agent:event', cb),
      clis: (force) => call('agent:clis', force),
      onExternal: (cb) => b.on('agent:external', cb)
    },
    onProjectChanged: (cb) => b.on('project:changed', cb),
    llm: {
      test: (providerId) => call('llm:test', providerId)
    },
    connect: {
      start: (service) => call('connect:start', service),
      cancel: () => call('connect:cancel'),
      tryClipboard: () => call('connect:tryClipboard'),
      onEvent: (cb) => b.on('connect:event', cb)
    },
    diag: {
      save: () => call('diag:save'),
      openLogs: () => call('diag:openLogs')
    },
    mcp: {
      status: () => call('mcp:status'),
      test: (id) => call('mcp:test', id)
    },
    comfy: {
      status: () => call('comfy:status'),
      step: (step) => call('comfy:step', step),
      logs: () => call('comfy:logs'),
      open: (id) => call('comfy:open', id),
      servers: () => call('comfy:servers'),
      discover: () => call('comfy:discover'),
      wf: {
        import: (o) => call('comfy:wf:import', o),
        replace: (id, o) => call('comfy:wf:replace', id, o),
        update: (id, patch) => call('comfy:wf:update', id, patch),
        remove: (id) => call('comfy:wf:remove', id),
        duplicate: (id) => call('comfy:wf:duplicate', id),
        setDefault: (id) => call('comfy:wf:default', id),
        fit: (id) => call('comfy:wf:fit', id),
        show: (id) => call('comfy:wf:show', id)
      },
      onLog: (cb) => b.on('comfy:log', cb)
    },
    backends: {
      status: () => call('backends:status'),
      add: (url) => call('backends:add', url),
      setRecipe: (id, json) => call('backends:recipe', id, json),
      install: (id) => call('backends:install', id),
      start: (id) => call('backends:start', id),
      stop: (id) => call('backends:stop', id),
      logs: (id) => call('backends:logs', id),
      remove: (id) => call('backends:remove', id),
      folder: (id) => call('backends:folder', id),
      open: (id) => call('backends:open', id),
      inspect: (url) => call('gradio:inspect', url),
      onLog: (cb) => b.on('backends:log', cb)
    },
    kimodo: {
      status: () => call('kimodo:status'),
      step: (step) => call('kimodo:step', step),
      logs: () => call('kimodo:logs'),
      suggest: (text, character) => call('kimodo:suggest', text, character),
      onLog: (cb) => b.on('kimodo:log', cb)
    },
    animsys: {
      list: (characterId) => call('animsys:list', characterId),
      create: (kind, characterId, name, style) => call('animsys:create', kind, characterId, name, style),
      save: (sys) => call('animsys:save', sys),
      remove: (id, withAssets) => call('animsys:delete', id, withAssets),
      states: (id) => call('animsys:states', id),
      plan: (id, request) => call('animsys:plan', id, request),
      produce: (id, opts) => call('animsys:produce', id, opts),
      stop: (id) => call('animsys:stop', id),
      build: (id) => call('animsys:build', id)
    },
    web: {
      me: () => call('web:me'),
      status: () => call('web:status'),
      setOwner: (name, password) => call('web:setOwner', name, password),
      invite: (role, hours, maxUses) => call('web:invite', role, hours, maxUses),
      revokeInvite: (token) => call('web:revokeInvite', token),
      removeUser: (id) => call('web:removeUser', id),
      setRole: (id, role) => call('web:setRole', id, role),
      headless: () => call('web:headless')
    }
  }
}
