// SPDX-License-Identifier: AGPL-3.0-only
// Testlerde gerçek Electron yerine kullanılan en küçük sahte modül.
import os from 'node:os'
import path from 'node:path'

const tmp = path.join(os.tmpdir(), 'assetforge-test')

export const app = {
  getPath: (_name: string) => tmp,
  getAppPath: () => process.cwd(),
  isPackaged: false
}

export const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (s: string) => Buffer.from(`enc:${s}`),
  decryptString: (b: Buffer) => b.toString().replace(/^enc:/, '')
}

let clip = ''
export const clipboard = {
  readText: async () => clip,
  writeText: (s: string) => {
    clip = s
  },
  clear: () => {
    clip = ''
  }
}

export const shell = { openExternal: async (_url: string) => undefined }

export default { app, safeStorage, clipboard, shell }
