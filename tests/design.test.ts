// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { circleLayout, defaultDesign, designContext, designMarkdown, normalizeDesign, screenLayout } from '../src/shared/design'
import { defaultProject } from '../src/shared/templates'
import { toDesign } from '../src/main/providers/design'
import type { GameDesign, UiScreen } from '../src/shared/types'

const loopsRaw = {
  loops: [
    {
      name: 'Teslimat',
      scope: 'core',
      description: 'Yükü zamanında götür',
      nodes: [
        { key: 'drive', label: 'Sür', type: 'action', note: '' },
        { key: 'storm', label: 'Fırtına', type: 'challenge', note: '30 sn' },
        { key: 'pay', label: 'Ödeme', type: 'reward', note: '' }
      ],
      edges: [
        { from: 'drive', to: 'storm', label: '' },
        { from: 'storm', to: 'pay', label: 'atlatınca' },
        { from: 'pay', to: 'drive', label: '' },
        { from: 'pay', to: 'ghost', label: 'bilinmeyen düğüm atılır' }
      ]
    }
  ]
}

describe('oyun tasarımı', () => {
  it('eski / eksik tasarımı tamamlar', () => {
    const d = normalizeDesign({ pitch: 'x' } as Partial<GameDesign>)
    expect(d.pitch).toBe('x')
    expect(d.loops).toEqual([])
    expect(d.story.acts).toEqual([])
    expect(normalizeDesign(undefined)).toEqual(defaultDesign())
  })

  it('döngü düğümlerini çembere dizer', () => {
    const out = circleLayout(
      Array.from({ length: 4 }, () => ({ x: 0, y: 0 })),
      100
    )
    expect(out.map((n) => [n.x, n.y])).toEqual([
      [100, 0],
      [200, 100],
      [100, 200],
      [0, 100]
    ])
  })

  it('yapay zekâ döngüsünü kimlikli şemaya çevirir, geçersiz okları atar', () => {
    const { loops } = toDesign('loops', loopsRaw) as { loops: GameDesign['loops'] }
    expect(loops).toHaveLength(1)
    const g = loops[0]
    expect(g.nodes.map((n) => n.label)).toEqual(['Sür', 'Fırtına', 'Ödeme'])
    expect(g.edges).toHaveLength(3)
    const label = (id: string) => g.nodes.find((n) => n.id === id)!.label
    expect(g.edges.map((e) => `${label(e.from)}>${label(e.to)}`)).toEqual(['Sür>Fırtına', 'Fırtına>Ödeme', 'Ödeme>Sür'])
    expect(new Set(g.nodes.map((n) => `${n.x},${n.y}`)).size).toBe(3)
  })

  it('ekran geçişlerini anahtarlardan kimliklere çevirir ve soldan sağa dizer', () => {
    const { screens } = toDesign('screens', {
      screens: [
        { key: 'main', name: 'Ana menü', purpose: '', when: '', layer: 'menu', widgets: [], next: ['hud', 'settings'] },
        { key: 'hud', name: 'HUD', purpose: '', when: '', layer: 'hud', widgets: [{ type: 'bar', label: 'Yakıt', binding: 'Vehicle.Fuel' }], next: ['pause'] },
        { key: 'pause', name: 'Duraklat', purpose: '', when: 'Esc', layer: 'menu', widgets: [], next: ['main', 'yok'] },
        { key: 'settings', name: 'Ayarlar', purpose: '', when: '', layer: 'menu', widgets: [], next: [] }
      ]
    }) as { screens: UiScreen[] }
    const id = (name: string) => screens.find((s) => s.name === name)!.id
    expect(screens[0].next).toEqual([id('HUD'), id('Ayarlar')])
    expect(screens[2].next).toEqual([id('Ana menü')])
    const lay = screenLayout(screens)
    expect(lay[id('Ana menü')].x).toBe(0)
    expect(lay[id('HUD')].x).toBe(260)
    expect(lay[id('Ayarlar')].x).toBe(260)
    expect(lay[id('Duraklat')].x).toBe(520)
    expect(lay[id('HUD')].y).not.toBe(lay[id('Ayarlar')].y)
  })

  it('GDD ve yapay zekâ bağlamı üretir', () => {
    const p = defaultProject('Kum')
    p.bible.projectName = 'Kum Kuryesi'
    const loops = (toDesign('loops', loopsRaw) as { loops: GameDesign['loops'] }).loops
    p.design = { ...defaultDesign(), pitch: 'Fırtınada kurye', pillars: ['Yol tehlikeli', 'Araç ev'], loops }
    const md = designMarkdown(p)
    expect(md).toContain('# Kum Kuryesi')
    expect(md).toContain('- Yol tehlikeli')
    expect(md).toContain('```mermaid')
    expect(md).toMatch(/-->\|atlatınca\|/)
    const ctx = designContext(p.design)
    expect(ctx).toContain('PITCH: Fırtınada kurye')
    expect(ctx).toContain('CORE LOOP "Teslimat": Sür → Fırtına; Fırtına → Ödeme (atlatınca); Ödeme → Sür')
    expect(designContext(defaultDesign())).toBe('')
  })
})

describe('Unreal skill’leri', () => {
  it('Türkçe adı PascalCase asset adına çevirir', async () => {
    const { skillName } = await import('../src/main/integrations/ueSkills')
    expect(skillName('AF', 'Kum Kuryesi', 'Game Design')).toBe('AFKumKuryesiGameDesign')
    expect(skillName('AF', 'Kırılma: Öncü', 'Asset Rules')).toBe('AFKirilmaOncuAssetRules')
  })

  it('tasarım varsa iki, yoksa yalnızca kural skill’i üretir', async () => {
    const { buildSkills } = await import('../src/main/integrations/ueSkills')
    const p = defaultProject('Kum')
    p.bible.projectName = 'Kum Kuryesi'
    expect(buildSkills(p).map((s) => s.assetName)).toEqual(['AFKumKuryesiAssetRules'])
    p.design = { ...defaultDesign(), pitch: 'Fırtınada kurye', pillars: ['Yol tehlikeli'] }
    const skills = buildSkills(p)
    expect(skills.map((s) => s.assetName)).toEqual(['AFKumKuryesiGameDesign', 'AFKumKuryesiAssetRules'])
    expect(skills[0].instructions).toContain('Fırtınada kurye')
    expect(skills[1].instructions).toContain('dmg_*')
    for (const s of skills) expect(s.instructions.length).toBeLessThan(16000)
  })
})
