// SPDX-License-Identifier: AGPL-3.0-only
// Montajlı modeli açık Unreal Editor'e kurar (Remote Execution ya da Unreal MCP). Normalde atlanır:
//   AF_UE_ASM=C:/x/build/assembly.json npx vitest run tests/ue.live.test.ts
// İsteğe bağlı: AF_UE_DEST=/Game/AssetForge/Test/ARA900  AF_UE_TEMPLATE=/Game/.../BP_KV_SportsCar
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { exportAssemblyToUe } from '../src/main/engine/ueAssembly'
import type { AssetSpec } from '../src/shared/types'

const asmFile = process.env.AF_UE_ASM
const live = describe.skipIf(!asmFile)

live('canlı Unreal araç kurulumu', () => {
  it(
    'mesh, fizik, Anim BP ve araç Blueprint’ini kurar',
    async () => {
      const asset = { id: 'ARA900', name: 'Test Sedan', kind: 'vehicle', description: 'kırmızı sedan', subcategory: '' } as AssetSpec
      const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-ue-proj-'))
      const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-ue-exp-'))
      const r = await exportAssemblyToUe(
        { asset, projectDir, signal: new AbortController().signal, log: (m) => console.log(`  ${m}`), warn: (m) => console.log(`  ⚠ ${m}`) },
        { assemblyFile: asmFile!, exportDir, dest: process.env.AF_UE_DEST ?? '/Game/AssetForge/Test/ARA900', name: 'ARA900', template: process.env.AF_UE_TEMPLATE ?? '', kitWaitMin: 0 }
      )
      for (const n of r.notes) console.log(`  ✓ ${n}`)
      expect(r.mesh).toMatch(/SK_ARA900/)
      expect(r.blueprint).toMatch(/BP_ARA900/)
    },
    20 * 60 * 1000
  )
})
