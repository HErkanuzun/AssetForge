// SPDX-License-Identifier: AGPL-3.0-only
import os from 'node:os'
import { describe, expect, it } from 'vitest'
import { tokenMatches } from '../src/main/agent/mcpServer'
import { redact } from '../src/main/log'
import { externalUrl, isInside, isRunnable } from '../src/main/security'

describe('isInside', () => {
  const root = 'C:\\Oyun\\Proje'
  it('içerideki dosyalar', () => {
    expect(isInside(root, 'C:\\Oyun\\Proje\\out\\a.glb')).toBe(true)
    expect(isInside(root, 'c:\\oyun\\proje\\out\\a.glb')).toBe(process.platform === 'win32')
  })
  it('kökün kendisi yalnızca izin verilirse', () => {
    expect(isInside(root, root)).toBe(false)
    expect(isInside(root, root + '\\', true)).toBe(true)
  })
  it('önek hilesi, .. ve başka sürücü', () => {
    expect(isInside(root, 'C:\\Oyun\\Proje-kopya\\a.glb')).toBe(false)
    expect(isInside(root, 'C:\\Oyun\\Proje\\..\\gizli.txt')).toBe(false)
    expect(isInside(root, 'D:\\Proje\\a.glb')).toBe(false)
    expect(isInside('', 'C:\\a')).toBe(false)
  })
})

describe('externalUrl', () => {
  it('https ve yerel http', () => {
    expect(externalUrl('https://github.com/x')).toBe('https://github.com/x')
    expect(externalUrl('http://127.0.0.1:8188/')).toBe('http://127.0.0.1:8188/')
    expect(externalUrl('http://localhost:9560/mcp')).toBe('http://localhost:9560/mcp')
  })
  it('tehlikeli ya da uzak http şemalarını reddeder', () => {
    for (const u of [
      'http://evil.example.com',
      'file:///C:/Windows/System32/calc.exe',
      'javascript:alert(1)',
      'ms-msdt:/id',
      'search-ms:query=x',
      'smb://host/share',
      'https://user:pw@example.com',
      'not a url'
    ])
      expect(externalUrl(u), u).toBeNull()
  })
})

describe('isRunnable', () => {
  it('çalıştırılabilir uzantılar', () => {
    for (const f of ['a.exe', 'b.BAT', 'c.ps1', 'd.lnk', 'e.js', 'f.hta', 'g.py']) expect(isRunnable(f), f).toBe(true)
    for (const f of ['a.glb', 'b.png', 'c.wav', 'd.fbx', 'e.json', 'klasor']) expect(isRunnable(f), f).toBe(false)
  })
})

describe('redact', () => {
  it('servis anahtarlarını maskeler', () => {
    const t = 'anthropic sk-ant-api03-AbCdEf_123456789-xyz meshy msy_abcdefgh12345678 hf hf_ABCDEFGHijkl1234 eleven sk_0123456789abcdef0123456789abcdef01234567 or sk-or-v1-0123456789abcdef'
    const r = redact(t, [])
    for (const s of ['AbCdEf_123456789', 'abcdefgh12345678', 'ABCDEFGHijkl1234', '0123456789abcdef0123456789', 'sk-or-v1-0123']) expect(r).not.toContain(s)
    expect(r).toContain('sk-ant-***')
  })
  it('Bearer, sorgu parametreleri ve JSON alanları', () => {
    const r = redact('Authorization: Bearer abc.def-ghi_jkl GET /mcp?token=SeCrEt123&x=1 {"apiKey":"zzz-secret","name":"ok"} code_verifier=pkce123', [])
    expect(r).toContain('Bearer ***')
    expect(r).toContain('token=***&x=1')
    expect(r).toContain('"apiKey":"***"')
    expect(r).toContain('"name":"ok"')
    expect(r).not.toMatch(/SeCrEt123|zzz-secret|abc\.def|pkce123/)
  })
  it('bilinen gizli değerleri ve ev klasörünü maskeler', () => {
    const home = os.homedir()
    const r = redact(`özel-anahtar-değeri ${home}\\Documents\\AssetForge kısa`, ['özel-anahtar-değeri', 'kısa'])
    expect(r).not.toContain('özel-anahtar-değeri')
    expect(r).not.toContain(home)
    expect(r).toContain('~')
    expect(r).toContain('kısa') // 6 karakterden kısa değerler maskelenmez (yanlış pozitif olmasın)
  })
})

describe('MCP token karşılaştırması', () => {
  it('yalnızca tam eşleşme', () => {
    expect(tokenMatches('abc123XYZ', 'abc123XYZ')).toBe(true)
    expect(tokenMatches('abc123XY', 'abc123XYZ')).toBe(false)
    expect(tokenMatches('abc123XYZ0', 'abc123XYZ')).toBe(false)
    expect(tokenMatches('', 'abc')).toBe(false)
    expect(tokenMatches(null, 'abc')).toBe(false)
    expect(tokenMatches(undefined, 'abc')).toBe(false)
    expect(tokenMatches('abc', '')).toBe(false)
  })
})
