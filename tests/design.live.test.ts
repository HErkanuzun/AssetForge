// SPDX-License-Identifier: AGPL-3.0-only
// Tasarım ajanını gerçek bir motorla dener. Normalde atlanır:
//   AF_DESIGN_ENGINE=claude-code AF_DESIGN_SECTION=loops npx vitest run tests/design.live.test.ts
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { generateDesignSection } from '../src/main/providers/design'
import { normalizeDesign } from '../src/shared/design'
import { defaultProject } from '../src/shared/templates'
import type { DesignSection } from '../src/shared/types'

const engine = process.env.AF_DESIGN_ENGINE as 'api' | 'claude-code' | 'codex' | undefined
const live = describe.skipIf(!engine)

live('canlı tasarım ajanı', () => {
  it(
    'bölümü şemaya uygun üretir',
    async () => {
      const section = (process.env.AF_DESIGN_SECTION ?? 'loops') as DesignSection
      const p = defaultProject('Kum')
      p.bible.projectName = 'Kum Kuryesi'
      p.bible.genre = 'Tek oyunculu açık dünya sürüş / hayatta kalma'
      p.bible.setting = 'Kum fırtınalarıyla kaplı, yakın gelecekte bir çöl; dağınık vahalar ve terk edilmiş otoyollar'
      p.bible.loreSummary = 'Su ve yedek parça kıt. Kuryeler vahalar arasında yük taşıyarak yaşar.'
      p.assets.push({
        id: 'ARA001',
        name: 'Kurye Pikap',
        kind: 'vehicle',
        category: 'ARA',
        subcategory: '',
        description: 'Paslı, modifiyeli pikap',
        size: '5 m',
        materials: '',
        variants: '',
        triBudget: 0,
        budgetNote: '',
        priority: 'P0',
        status: '',
        source: 'test',
        extra: {}
      })
      const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-design-'))
      // AF_DESIGN_SECTION=all: tüm bölümler sırayla (her biri öncekileri bağlam olarak görür)
      const sections: DesignSection[] = section === ('all' as DesignSection) ? ['core', 'loops', 'story', 'screens'] : [section]
      for (const sec of sections) {
        const r = await generateDesignSection({ project: p, section: sec, instruction: '', engine: engine!, outDir, log: (m) => console.log(`  ${m}`) })
        p.design = { ...normalizeDesign(p.design), ...r.data }
        if (sec === 'loops') {
          expect(r.data.loops!.length).toBeGreaterThanOrEqual(3)
          for (const g of r.data.loops!) expect(g.edges.length).toBeGreaterThanOrEqual(g.nodes.length - 1)
        }
        if (sec === 'screens') expect(r.data.screens!.length).toBeGreaterThanOrEqual(3)
      }
      // AF_DESIGN_SAVE=<klasör>: sonucu proje dosyası olarak yaz (arayüzde açmak için)
      if (process.env.AF_DESIGN_SAVE) {
        fs.mkdirSync(process.env.AF_DESIGN_SAVE, { recursive: true })
        fs.writeFileSync(path.join(process.env.AF_DESIGN_SAVE, 'forge-project.json'), JSON.stringify(p, null, 2))
      }
    },
    40 * 60 * 1000
  )
})
