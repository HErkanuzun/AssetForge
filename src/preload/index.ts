// SPDX-License-Identifier: AGPL-3.0-only
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { ForgeApi } from './api'

type Wrapped<T> = { ok: true; value: T } | { ok: false; error: string }

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const r = (await ipcRenderer.invoke(channel, ...args)) as Wrapped<T>
  if (!r.ok) throw new Error(r.error)
  return r.value
}

const api: ForgeApi = {
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
  run: {
    start: (pipelineId, assetIds) => call('run:start', pipelineId, assetIds),
    cancel: (jobId) => call('run:cancel', jobId)
  },
  jobs: () => call('jobs:list'),
  onNavigate: (cb) => {
    const listener = (_e: unknown, page: string) => cb(page)
    ipcRenderer.on('nav:page', listener)
    return () => ipcRenderer.removeListener('nav:page', listener)
  },
  onJobUpdate: (cb) => {
    const listener = (_e: unknown, job: Parameters<typeof cb>[0]) => cb(job)
    ipcRenderer.on('job:update', listener)
    return () => ipcRenderer.removeListener('job:update', listener)
  },
  ueDiscover: () => call('ue:discover'),
  testClaude: () => call('test:claude'),
  testMeshy: () => call('test:meshy'),
  testComfy: () => call('test:comfy'),
  openPath: (p) => call('shell:openPath', p),
  showItem: (p) => call('shell:showItem', p),
  pathForFile: (f) => webUtils.getPathForFile(f),
  brief: {
    create: (seed) => call('brief:create', seed),
    list: () => call('brief:list'),
    get: (id) => call('brief:get', id),
    send: (id, input) => call('brief:send', id, input),
    patch: (id, patch) => call('brief:patch', id, patch),
    remove: (id) => call('brief:delete', id),
    toAssets: (id) => call('brief:toAssets', id),
    onEvent: (cb) => {
      const listener = (_e: unknown, ev: Parameters<typeof cb>[0]) => cb(ev)
      ipcRenderer.on('brief:event', listener)
      return () => ipcRenderer.removeListener('brief:event', listener)
    }
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
    onEvent: (cb) => {
      const listener = (_e: unknown, ev: Parameters<typeof cb>[0]) => cb(ev)
      ipcRenderer.on('agent:event', listener)
      return () => ipcRenderer.removeListener('agent:event', listener)
    },
    onExternal: (cb) => {
      const listener = (_e: unknown, name: string) => cb(name)
      ipcRenderer.on('agent:external', listener)
      return () => ipcRenderer.removeListener('agent:external', listener)
    }
  },
  onProjectChanged: (cb) => {
    const listener = (_e: unknown, p: Parameters<typeof cb>[0]) => cb(p)
    ipcRenderer.on('project:changed', listener)
    return () => ipcRenderer.removeListener('project:changed', listener)
  },
  llm: {
    test: (providerId) => call('llm:test', providerId)
  },
  connect: {
    start: (service) => call('connect:start', service),
    cancel: () => call('connect:cancel'),
    tryClipboard: () => call('connect:tryClipboard'),
    onEvent: (cb) => {
      const listener = (_e: unknown, ev: Parameters<typeof cb>[0]) => cb(ev)
      ipcRenderer.on('connect:event', listener)
      return () => ipcRenderer.removeListener('connect:event', listener)
    }
  },
  diag: {
    save: () => call('diag:save'),
    openLogs: () => call('diag:openLogs')
  },
  mcp: {
    status: () => call('mcp:status'),
    test: (id) => call('mcp:test', id)
  },
  kimodo: {
    status: () => call('kimodo:status'),
    step: (step) => call('kimodo:step', step),
    logs: () => call('kimodo:logs'),
    suggest: (text, character) => call('kimodo:suggest', text, character),
    onLog: (cb) => {
      const listener = (_e: unknown, line: string) => cb(line)
      ipcRenderer.on('kimodo:log', listener)
      return () => ipcRenderer.removeListener('kimodo:log', listener)
    }
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
  }
}

contextBridge.exposeInMainWorld('forge', api)
