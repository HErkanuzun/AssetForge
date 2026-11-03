// SPDX-License-Identifier: AGPL-3.0-only
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const TAG = 'SPDX-License-Identifier: AGPL-3.0-only'
const EXT = new Set(['.ts', '.tsx', '.mjs', '.js', '.css', '.py', '.sh', '.ps1'])

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === '__pycache__') return []
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : EXT.has(extname(p)) ? [p] : []
  })
}

const files = ['src', 'tests', 'scripts', 'resources'].flatMap(walk)

describe('lisans başlıkları', () => {
  it('kaynak dosyalar bulundu', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it.each(files)('%s SPDX başlığı taşıyor', (f) => {
    const head = readFileSync(f, 'utf8').replace(/^﻿/, '').split(/\r?\n/).slice(0, 3)
    expect(head.some((l) => l.includes(TAG))).toBe(true)
  })

  it('PowerShell betiklerinde BOM yalnızca en başta', () => {
    for (const f of files.filter((x) => x.endsWith('.ps1'))) {
      const b = readFileSync(f)
      expect(b.indexOf(Buffer.from([0xef, 0xbb, 0xbf]), 1), f).toBe(-1)
    }
  })
})
