// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { findKey, looksLikeKey, plausibleToken } from '../src/main/connect'
import { pcmToWav, sniffImage, truncateWords } from '../src/main/util'

describe('Hızlı bağlantı anahtar tanıma', () => {
  it.each([
    ['anthropic', 'sk-ant-api03-' + 'a'.repeat(40), true],
    ['anthropic', 'sk-proj-' + 'a'.repeat(40), false],
    ['meshy', 'msy_' + 'A1b2'.repeat(6), true],
    ['meshy', 'msy_kisa', false],
    ['elevenlabs', 'sk_' + 'f0'.repeat(24), true],
    ['elevenlabs', 'a'.repeat(32), true],
    ['elevenlabs', 'merhaba dünya', false],
    ['huggingface', 'hf_' + 'x'.repeat(34), true],
    ['huggingface', 'hf_ boşluklu anahtar', false]
  ] as const)('%s: %s → %s', (service, text, ok) => {
    expect(looksLikeKey(service, text)).toBe(ok)
  })

  it('panodaki baştaki/sondaki boşlukları yok sayar', () => {
    expect(looksLikeKey('huggingface', `  hf_${'x'.repeat(34)}\n`)).toBe(true)
  })

  it('kopyalanan satırın içindeki anahtarı bulur', () => {
    const msy = 'msy_' + 'A1b2'.repeat(8)
    expect(findKey('meshy', `MESHY_API_KEY="${msy}"`)).toBe(msy)
    expect(findKey('meshy', `API key:\n${msy}\n`)).toBe(msy)
    expect(findKey('elevenlabs', 'commit ' + 'a'.repeat(40))).toBeNull()
    expect(findKey('huggingface', 'hf_kisa')).toBeNull()
    expect(findKey('meshy', 'x'.repeat(5000) + msy)).toBeNull()
  })

  it('elle denemede yalnızca tek parça metin kabul edilir', () => {
    expect(plausibleToken('  abcDEF123_-.:abcDEF123\n')).toBe(true)
    expect(plausibleToken('kisa')).toBe(false)
    expect(plausibleToken('iki kelime anahtar olamaz değil mi')).toBe(false)
  })

  it('bir servisin anahtarını başka servis sanmaz', () => {
    const claude = 'sk-ant-api03-' + 'a'.repeat(40)
    expect(looksLikeKey('meshy', claude)).toBe(false)
    expect(looksLikeKey('elevenlabs', claude)).toBe(false)
    expect(looksLikeKey('huggingface', claude)).toBe(false)
  })
})

describe('pcmToWav', () => {
  it('geçerli 44 baytlık WAV başlığı yazar', () => {
    const pcm = Buffer.alloc(4800) // 24 kHz, 0.1 sn, mono 16-bit
    const wav = pcmToWav(pcm, 24000)
    expect(wav.length).toBe(44 + pcm.length)
    expect(wav.subarray(0, 4).toString()).toBe('RIFF')
    expect(wav.subarray(8, 12).toString()).toBe('WAVE')
    expect(wav.readUInt32LE(4)).toBe(36 + pcm.length)
    expect(wav.readUInt16LE(22)).toBe(1) // kanal
    expect(wav.readUInt32LE(24)).toBe(24000)
    expect(wav.readUInt32LE(28)).toBe(48000) // byte rate
    expect(wav.readUInt16LE(34)).toBe(16)
    expect(wav.readUInt32LE(40)).toBe(pcm.length)
  })
})

describe('sniffImage', () => {
  it.each([
    [[0x89, 0x50, 0x4e, 0x47], 'image/png'],
    [[0xff, 0xd8, 0xff, 0xe0], 'image/jpeg'],
    [[...Buffer.from('GIF89a')], 'image/gif'],
    [[...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')], 'image/webp'],
    [[...Buffer.from('%PDF')], null]
  ])('%j → %s', (bytes, mime) => {
    expect(sniffImage(Buffer.from(bytes))).toBe(mime)
  })
})

describe('truncateWords', () => {
  it('kısa metne dokunmaz', () => {
    expect(truncateWords('kısa metin', 50)).toBe('kısa metin')
  })
  it('kelime ortasından kesmez, sondaki noktalamayı temizler', () => {
    const s = 'rusty pickup truck, desert, worn paint, dusty tires'
    const out = truncateWords(s, 30)
    expect(out.length).toBeLessThanOrEqual(30)
    expect(s.startsWith(out)).toBe(true)
    expect(out).not.toMatch(/[,\s]$/)
    expect(out).toBe('rusty pickup truck, desert')
  })
})
