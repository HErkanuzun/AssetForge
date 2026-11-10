// SPDX-License-Identifier: AGPL-3.0-only
// Birden çok ComfyUI sunucusu ve workflow kitaplığı: eski ayardan geçiş, otomatik seçim sırası,
// workflow özeti (girişler, çıktılar, modeller) ve sunucuda eksik düğüm / model denetimi.
import { describe, expect, it } from 'vitest'
import { migrateComfyServers, normalizeComfyUrl, rankServers } from '../src/shared/comfyServers'
import { analyzeWorkflow, checkFit, type ObjectInfo } from '../src/main/providers/comfyui'

const sdxl = {
  '3': { class_type: 'KSampler', inputs: { seed: 1, steps: 20, positive: ['6', 0], negative: ['7', 0], model: ['4', 0] } },
  '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'SDXL\\sd_xl_base_1.0.safetensors' } },
  '6': { class_type: 'CLIPTextEncode', inputs: { text: 'a', clip: ['4', 1] } },
  '7': { class_type: 'CLIPTextEncode', inputs: { text: 'b', clip: ['4', 1] } },
  '9': { class_type: 'SaveImage', inputs: { images: ['8', 0], filename_prefix: 'AF' } }
}

const trellis = {
  '1': { class_type: 'LoadImage', inputs: { image: 'ref.png' } },
  '2': { class_type: 'Trellis2Loader', inputs: { model: 'trellis2-image-large.safetensors' } },
  '3': { class_type: 'Trellis2ImageTo3D', inputs: { image: ['1', 0], model: ['2', 0], seed: 0 } },
  '4': { class_type: 'SaveGLB', inputs: { mesh: ['3', 0], filename_prefix: '3d/AF' } }
}

describe('sunucu listesi', () => {
  it('adresi düzeltir', () => {
    expect(normalizeComfyUrl(' 192.168.1.20:8188/ ')).toBe('http://192.168.1.20:8188')
    expect(normalizeComfyUrl('https://gpu.example.com/')).toBe('https://gpu.example.com')
    expect(normalizeComfyUrl('')).toBe('')
  })

  it('eski yerel adres "bu bilgisayar" kaydı olur', () => {
    expect(migrateComfyServers({ comfyUrl: 'http://127.0.0.1:8190' })).toEqual([{ id: 'local', name: 'Bu bilgisayar', url: 'http://127.0.0.1:8190', enabled: true, managed: true }])
    expect(migrateComfyServers({})[0]).toMatchObject({ url: 'http://127.0.0.1:8188', managed: true, enabled: true })
  })

  it('eski uzak adres ayrı sunucu olur, yerel kurulum kapalı başlar', () => {
    const list = migrateComfyServers({ comfyUrl: 'http://192.168.1.20:8188' })
    expect(list.map((x) => [x.id, x.url, x.enabled, !!x.managed])).toEqual([
      ['local', 'http://127.0.0.1:8188', false, true],
      ['remote', 'http://192.168.1.20:8188', true, false]
    ])
  })

  it('her zaman tek bir yönetilen kayıt bulunur', () => {
    const two = migrateComfyServers({
      comfyServers: [
        { id: 'a', name: 'A', url: 'http://127.0.0.1:8188', enabled: true, managed: true },
        { id: 'b', name: 'B', url: 'http://127.0.0.1:8189', enabled: true, managed: true }
      ]
    })
    expect(two.filter((x) => x.managed).map((x) => x.id)).toEqual(['a'])
    const none = migrateComfyServers({ comfyServers: [{ id: 'b', name: 'B', url: 'http://10.0.0.2:8188', enabled: true }] })
    expect(none.map((x) => [x.id, !!x.managed, x.enabled])).toEqual([
      ['local', true, false],
      ['b', false, true]
    ])
  })

  it('otomatik seçim: kapalı ve uymayanlar elenir, kuyruğu kısa olan önce, eşitlikte liste sırası', () => {
    const r = rankServers([
      { id: 'kapali', online: false, fits: true, queue: 0, inflight: 0 },
      { id: 'eksik', online: true, fits: false, queue: 0, inflight: 0 },
      { id: 'dolu', online: true, fits: true, queue: 3, inflight: 0 },
      { id: 'mesgul', online: true, fits: true, queue: 0, inflight: 1 },
      { id: 'bos', online: true, fits: true, queue: 0, inflight: 0 },
      { id: 'bos2', online: true, fits: true, queue: 0, inflight: 0 }
    ])
    expect(r.map((x) => x.id)).toEqual(['bos', 'bos2', 'mesgul', 'dolu'])
  })
})

describe('workflow özeti', () => {
  it('SDXL: görsel üretir, prompt/negative/seed doldurulur, modeli listeler', () => {
    const s = analyzeWorkflow(JSON.stringify(sdxl))
    expect(s.produces).toEqual(['image'])
    expect(s.roles).toEqual(['prompt', 'negative', 'seed'])
    expect(s.models).toEqual(['SDXL\\sd_xl_base_1.0.safetensors'])
    expect(s.classTypes).toEqual(['CLIPTextEncode', 'CheckpointLoaderSimple', 'KSampler', 'SaveImage'])
  })

  it('görselden 3D: model üretir, görsel girişi var', () => {
    const s = analyzeWorkflow(JSON.stringify(trellis))
    expect(s.produces).toEqual(['model'])
    expect(s.roles).toEqual(['seed', 'image'])
  })

  it('AF başlıkları ve yer tutucular giriş sayılır; AF:audio başlıklı kaydetme giriş değil ses çıktısıdır', () => {
    const wf = {
      '1': { class_type: 'TextEncodeAceStepAudio', inputs: { tags: '{{PROMPT}}' } },
      '2': { class_type: 'CustomSaver', inputs: { audio: ['1', 0] }, _meta: { title: 'AF:audio' } },
      '3': { class_type: 'LoadAudio', inputs: { audio: 'ref.wav' }, _meta: { title: 'AF:audio' } }
    }
    const s = analyzeWorkflow(JSON.stringify(wf))
    expect(s.roles).toEqual(['prompt', 'audio'])
    expect(s.produces).toEqual(['audio'])
    const out = analyzeWorkflow(JSON.stringify({ '2': wf['2'] }))
    expect(out.roles).toEqual([])
  })

  it('arayüz formatını anlaşılır hatayla reddeder', () => {
    expect(() => analyzeWorkflow(JSON.stringify({ nodes: [], links: [] }))).toThrow(/Export \(API\)/)
    expect(() => analyzeWorkflow('{bozuk')).toThrow(/okunamadı/)
  })
})

describe('sunucu uygunluğu', () => {
  const info: ObjectInfo = {
    KSampler: { input: { required: { seed: ['INT', {}] } } },
    CLIPTextEncode: { input: { required: { text: ['STRING', {}] } } },
    // Eski biçim: seçenek listesi ilk eleman; Windows alt klasörü ters bölüyle
    CheckpointLoaderSimple: { input: { required: { ckpt_name: [['SDXL/sd_xl_base_1.0.safetensors', 'v1-5.ckpt']] } } },
    SaveImage: { input: { required: {} } },
    LoadImage: { input: { required: { image: [['baska.png']] } } },
    // Yeni biçim: ["COMBO", {options}]
    Trellis2Loader: { input: { required: { model: ['COMBO', { options: ['trellis2-image-small.safetensors'] }] } } }
  }

  it('her şey kuruluysa eksik yok (alt klasör ayıracı fark etmez)', () => {
    expect(checkFit(JSON.stringify(sdxl), info)).toEqual({ missingNodes: [], missingModels: [] })
  })

  it('eksik düğüm türünü ve sunucuda olmayan modeli bulur; yüklenecek görsel adı eksik sayılmaz', () => {
    expect(checkFit(JSON.stringify(trellis), info)).toEqual({ missingNodes: ['SaveGLB', 'Trellis2ImageTo3D'], missingModels: ['trellis2-image-large.safetensors'] })
  })
})
