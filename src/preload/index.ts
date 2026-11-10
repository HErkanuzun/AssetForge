// SPDX-License-Identifier: AGPL-3.0-only
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { createApi } from '../shared/forgeApi'

type Wrapped<T> = { ok: true; value: T } | { ok: false; error: string }

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const r = (await ipcRenderer.invoke(channel, ...args)) as Wrapped<T>
  if (!r.ok) throw new Error(r.error)
  return r.value
}

const api = createApi({
  web: false,
  call,
  on: (channel, cb) => {
    const listener = (_e: unknown, payload: Parameters<typeof cb>[0]) => cb(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  pathForFile: (f) => webUtils.getPathForFile(f),
  dropFile: async (f) => webUtils.getPathForFile(f)
})

contextBridge.exposeInMainWorld('forge', api)
