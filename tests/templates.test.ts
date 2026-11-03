import { describe, expect, it } from 'vitest'
import { assetBaseName, parseSizeMeters, parseTriBudget, safeName } from '../src/shared/templates'

describe('parseSizeMeters', () => {
  it.each([
    ['4x4x0.3', [4, 4, 0.3]],
    ['1,80 m (ayarlanabilir)', [1.8]],
    ['0,5 m / 15 kg', [0.5]],
    ['30 x 20 cm', [0.3, 0.2]],
    ['', []],
    ['boyut yok', []]
  ])('%s → %j', (input, expected) => {
    const got = parseSizeMeters(input)
    expect(got).toHaveLength(expected.length)
    got.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 6))
  })
})

describe('parseTriBudget', () => {
  it.each([
    ['1-4K + Nanite yok', 4000],
    ['12000', 12000],
    ['2,5k', 2500],
    ['', 0]
  ])('%s → %d', (input, expected) => {
    expect(parseTriBudget(input)).toBe(expected)
  })
})

describe('safeName', () => {
  it('Türkçe karakterleri sadeleştirip PascalCase yapar', () => {
    expect(safeName('paslı kamyonet')).toBe('PasliKamyonet')
    expect(safeName('Çöl İstasyonu — gece')).toBe('ColIstasyonuGece')
  })
  it('aksanlı harfleri ASCII’ye indirir, diğer karakterleri atar', () => {
    expect(safeName('café crème')).toBe('CafeCreme')
    expect(safeName('🔥 ateş topu!')).toBe('AtesTopu')
  })
})

describe('assetBaseName', () => {
  it('Unreal için güvenli bir isim üretir', () => {
    const n = assetBaseName({ id: 'KAR001', name: 'Paslı Kamyonet' })
    expect(n).toMatch(/^[A-Za-z0-9_]+$/)
    expect(n).toContain('KAR001')
  })
})
