// SPDX-License-Identifier: AGPL-3.0-only
// Montaj ve Hareket Rigi düğümünü gerçek Blender + yapay zekâ ile dener. Normalde atlanır:
//   AF_RIG_MODEL=C:/x/car.glb AF_BLENDER="C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" \
//   AF_RIG_ENGINE=claude-code npx vitest run tests/rig.live.test.ts
// Elle plan ile (yapay zekâsız) yalnızca Blender adımı: AF_RIG_PLAN=C:/x/plan.json
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getExecutor, type ExecCtx } from '../src/main/engine/executors'
import { setSettings } from '../src/main/settings'
import { defaultBible } from '../src/shared/templates'
import type { AssetSpec, Job } from '../src/shared/types'

const model = process.env.AF_RIG_MODEL
const blender = process.env.AF_BLENDER
const live = describe.skipIf(!model || !blender)

const asset: AssetSpec = {
  id: 'ARA900',
  name: 'Test Sedan',
  kind: 'vehicle',
  category: 'ARA',
  subcategory: '',
  description: 'Kırmızı, dört kapılı basit low-poly sedan. Tekerlekler dönmeli; bagaj açılabilir.',
  size: '4,2 m',
  materials: '',
  variants: '',
  triBudget: 0,
  budgetNote: '',
  priority: 'P0',
  status: '',
  source: 'test',
  extra: {}
}

live('canlı montaj rigi', () => {
  it(
    'tekerlekleri ayırır, kemik ve assembly.json üretir',
    async () => {
      setSettings({ blenderPath: blender! })
      const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-rig-proj-'))
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-rig-'))
      const ctx: ExecCtx = {
        job: { id: 'job_test' } as Job,
        nodeId: 'rig',
        asset,
        bible: defaultBible(),
        projectDir,
        dir,
        feedback: [],
        signal: new AbortController().signal,
        log: (m) => console.log(`  ${m}`),
        progress: () => undefined,
        cost: () => undefined,
        warn: (m) => console.log(`  ⚠ ${m}`)
      }
      const plan = process.env.AF_RIG_PLAN ? fs.readFileSync(process.env.AF_RIG_PLAN, 'utf8') : ''
      const r = await getExecutor('rig.assembly')(ctx, { engine: process.env.AF_RIG_ENGINE ?? 'claude-code', plan, rounds: 1, extra: '' }, { model: { kind: 'model', file: model! } })
      const out = r.outputs.model
      expect(out?.kind).toBe('model')
      if (out?.kind !== 'model') return
      console.log(`  klasör: ${dir}`)
      const asm = JSON.parse(fs.readFileSync(out.assembly!, 'utf8')) as { parts: { name: string; role: string; tris: number }[]; bones: string[] }
      const wheels = asm.parts.filter((p) => p.role === 'wheel')
      expect(wheels.length).toBe(4)
      for (const w of wheels) expect(w.tris).toBeGreaterThan(20)
      expect(fs.existsSync(out.file)).toBe(true)
    },
    35 * 60 * 1000
  )
})
