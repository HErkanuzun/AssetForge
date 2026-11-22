// SPDX-License-Identifier: AGPL-3.0-only
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'af-locale-'))
vi.mock('electron', () => ({
  app: { getPath: () => tmp, getLocale: () => 'zh-CN' },
  safeStorage: { encryptString: (s: string) => Buffer.from(s), decryptString: (b: Buffer) => b.toString() }
}))
const file = path.join(tmp, 'settings.json')

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  fs.rmSync(file, { force: true })
})

describe('locale settings persistence', () => {
  it('upgrades legacy settings without changing paths or encrypted secrets', async () => {
    fs.writeFileSync(file, JSON.stringify({ projectDir: 'D:/用户项目', secrets: { anthropic: Buffer.from('test-key').toString('base64') } }))
    const { getSettings, publicSettings, getSecret } = await import('../src/main/settings')
    expect(getSettings().locale).toBe('zh-CN')
    expect(getSettings().projectDir).toBe('D:/用户项目')
    expect(getSecret('anthropic')).toBe('test-key')
    expect(publicSettings().locale).toBe('zh-CN')
  })
  it('persists a choice across module reloads and project changes', async () => {
    const s = await import('../src/main/settings')
    s.setSettings({ locale: 'en' })
    s.setSettings({ projectDir: 'D:/different' })
    vi.resetModules()
    const reloaded = await import('../src/main/settings')
    expect(reloaded.publicSettings().locale).toBe('en')
    expect(reloaded.getSettings().projectDir).toBe('D:/different')
  })
  it('rejects invalid updates before changing any other field', async () => {
    const s = await import('../src/main/settings')
    s.setSettings({ locale: 'en' })
    const original = fs.readFileSync(file, 'utf8')
    expect(() => s.setSettings({ locale: 'invalid' as 'en', projectDir: 'bad', secrets: { anthropic: 'bad' } })).toThrow('Unsupported interface language')
    expect(fs.readFileSync(file, 'utf8')).toBe(original)
    expect(s.getSettings().projectDir).not.toBe('bad')
    expect(s.getSecret('anthropic')).toBeUndefined()
  })
  it('normalizes invalid persisted locale and rolls back memory after a disk write fails', async () => {
    fs.writeFileSync(file, JSON.stringify({ locale: 'invalid', mcpExpose: { token: 'fixture', enabled: false, port: 9560 } }))
    const s = await import('../src/main/settings')
    expect(s.getSettings().locale).toBe('zh-CN')
    vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('disk failure')
    })
    expect(() => s.setSettings({ locale: 'en' })).toThrow('disk failure')
    expect(s.getSettings().locale).toBe('zh-CN')
  })
})
