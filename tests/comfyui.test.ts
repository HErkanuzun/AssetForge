// SPDX-License-Identifier: AGPL-3.0-only
// ComfyUI iş akışı: değerlerin workflow'a yazılması, çıktıların toplanması ve sahte sunucuyla uçtan uca çalıştırma.
// Sahte sunucunun yanıtları ComfyUI kaynağındaki biçimlerle aynıdır (images / audio / 3d listeleri, node_errors).
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { collectOutputs, comfyRun, describeRejection, kindOfFile, prepareWorkflow, titleRole, type ComfyWorkflow } from '../src/main/providers/comfyui'

const sdxl = {
  '3': { class_type: 'KSampler', inputs: { seed: 1, steps: 20, positive: ['6', 0], negative: ['7', 0], model: ['4', 0] } },
  '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sdxl.safetensors' } },
  '6': { class_type: 'CLIPTextEncode', inputs: { text: 'eski', clip: ['4', 1] } },
  '7': { class_type: 'CLIPTextEncode', inputs: { text: 'kötü', clip: ['4', 1] } },
  '9': { class_type: 'SaveImage', inputs: { images: ['8', 0], filename_prefix: 'AF' } }
}

describe('workflow hazırlama', () => {
  it('AF başlıklarına yazar', () => {
    const wf = {
      '1': { class_type: 'MeshyTextToModel', inputs: { prompt: '', seed: 0 }, _meta: { title: 'AF:prompt' } },
      '2': { class_type: 'LoadImage', inputs: { image: 'x.png' }, _meta: { title: 'af: image' } },
      '3': { class_type: 'Seed', inputs: { value: 5 }, _meta: { title: 'AF seed' } }
    }
    const r = prepareWorkflow(JSON.stringify(wf), { prompt: 'kılıç "rün"lü', image: 'up.png', seed: 42 })
    expect(r.workflow['1'].inputs.prompt).toBe('kılıç "rün"lü')
    expect(r.workflow['2'].inputs.image).toBe('up.png')
    expect(r.workflow['3'].inputs.value).toBe(42)
    expect(r.unused).toEqual([])
  })

  it('başlık yoksa örnekleyicinin positive / negative metnini bulur, tüm seedleri değiştirir', () => {
    const r = prepareWorkflow(JSON.stringify(sdxl), { prompt: 'pas tutmuş kalkan', negative: 'bulanık', seed: 7 })
    expect(r.workflow['6'].inputs.text).toBe('pas tutmuş kalkan')
    expect(r.workflow['7'].inputs.text).toBe('bulanık')
    expect(r.workflow['3'].inputs.seed).toBe(7)
    expect(r.applied.join()).toMatch(/tahmin/)
  })

  it('eski yer tutucular çalışmaya devam eder (tırnaklar kaçışlanır)', () => {
    const src = JSON.stringify({ '1': { class_type: 'CLIPTextEncode', inputs: { text: '{{PROMPT}}' } }, '2': { class_type: 'KSampler', inputs: { seed: '{{SEED}}' } } })
    const r = prepareWorkflow(src, { prompt: 'a "b" \\ c', seed: 99 })
    expect(r.workflow['1'].inputs.text).toBe('a "b" \\ c')
    expect(r.workflow['2'].inputs.seed).toBe(99)
  })

  it('tek yükleyiciye dosya gider; yeri olmayan girdi bildirilir', () => {
    const wf = { '1': { class_type: 'Load3D', inputs: { model_file: 'none', width: 1024 } }, '2': { class_type: 'SaveGLB', inputs: { mesh: ['1', 0] } } }
    const r = prepareWorkflow(JSON.stringify(wf), { model: '3d/kilic.glb', audio: 'ses.wav', prompt: 'x' })
    expect(r.workflow['1'].inputs.model_file).toBe('3d/kilic.glb')
    expect(r.unused.sort()).toEqual(['audio', 'prompt'])
  })

  it('arayüz formatındaki dosyayı açık mesajla reddeder', () => {
    expect(() => prepareWorkflow(JSON.stringify({ nodes: [], links: [] }), {})).toThrow(/Export \(API\)/)
    expect(() => prepareWorkflow('{bozuk', {})).toThrow(/JSON/)
  })

  it('başlık etiketleri', () => {
    expect(titleRole('AF:Positive')).toBe('prompt')
    expect(titleRole('AF:3d')).toBe('model')
    expect(titleRole('After Effects')).toBeNull()
    expect(titleRole(undefined)).toBeNull()
  })
})

describe('çıktılar', () => {
  it('images / audio / 3d listelerini ve düz yolları toplar, kaydedilenleri önizlemeye tercih eder', () => {
    const outs = collectOutputs({
      '9': { images: [{ filename: 'a.png', subfolder: '', type: 'output' }] },
      '10': { images: [{ filename: 'p.png', subfolder: '', type: 'temp' }] },
      '11': { audio: [{ filename: 'muzik.flac', subfolder: 'audio', type: 'output' }] },
      '12': { '3d': [{ filename: 'kilic.glb', subfolder: '3d', type: 'output' }], camera_info: [null] },
      '13': { result: ['3d/kilic.glb [output]', null] },
      '14': { text: ['merhaba'] }
    })
    expect(outs.map((o) => `${o.kind}:${o.subfolder}/${o.filename}`)).toEqual(['image:/a.png', 'audio:audio/muzik.flac', 'model:3d/kilic.glb'])
  })

  it('yalnızca önizleme varsa onu alır; AF:anim başlıklı FBX animasyondur', () => {
    const wf: ComfyWorkflow = { '5': { class_type: 'KimodoExportFBX', inputs: {}, _meta: { title: 'AF:anim' } } }
    const outs = collectOutputs(
      {
        '5': {
          files: [
            { filename: 'yuru.fbx', subfolder: '', type: 'temp' },
            { filename: 'yuru.bvh', subfolder: '', type: 'temp' }
          ]
        }
      },
      wf
    )
    expect(outs.map((o) => o.kind)).toEqual(['anim', 'anim'])
    expect(kindOfFile('x.FBX')).toBe('model')
    expect(kindOfFile('x.mp4')).toBeNull()
  })

  it('reddedilen workflow için okunur mesaj, eksik düğümde ipucu', () => {
    const body = JSON.stringify({ error: { type: 'invalid_prompt', message: 'Cannot execute because node Trellis2Sampler does not exist.', details: 'Node ID #3' }, node_errors: {} })
    expect(describeRejection(body)).toMatch(/Trellis2Sampler.*eksik düğüm/)
    const bad = JSON.stringify({
      error: { message: 'Prompt outputs failed validation' },
      node_errors: { '2': { class_type: 'LoadImage', errors: [{ message: 'Invalid image file', details: 'image: yok.png' }] } }
    })
    expect(describeRejection(bad)).toMatch(/#2 LoadImage: Invalid image file \(image: yok.png\)/)
  })
})

describe('sahte ComfyUI sunucusuyla uçtan uca', () => {
  let server: http.Server
  let url = ''
  const seen: { uploads: string[]; prompt?: { prompt: ComfyWorkflow; extra_data?: { api_key_comfy_org?: string } }; reject?: boolean } = { uploads: [] }
  const files: Record<string, Buffer> = { 'out/3d/kilic.glb': Buffer.from('glTF'), 'out//onizleme.png': Buffer.from('PNG'), 'out/audio/s.flac': Buffer.from('fLaC') }

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url ?? '/', 'http://x')
      const chunks: Buffer[] = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        const body = Buffer.concat(chunks)
        if (u.pathname === '/upload/image') {
          const text = body.toString('latin1')
          const name = /filename="([^"]+)"/.exec(text)?.[1] ?? '?'
          const sub = /name="subfolder"\r\n\r\n([^\r]*)/.exec(text)?.[1] ?? ''
          seen.uploads.push(`${sub}/${name}`)
          res.end(JSON.stringify({ name, subfolder: sub, type: 'input' }))
        } else if (u.pathname === '/prompt') {
          if (seen.reject) {
            res.writeHead(400).end(JSON.stringify({ error: { message: 'Cannot execute because node Yok does not exist.' }, node_errors: {} }))
            return
          }
          seen.prompt = JSON.parse(body.toString())
          res.end(JSON.stringify({ prompt_id: 'p1', number: 1 }))
        } else if (u.pathname === '/history/p1') {
          res.end(
            JSON.stringify({
              p1: {
                status: { status_str: 'success', completed: true, messages: [] },
                outputs: {
                  '20': { '3d': [{ filename: 'kilic.glb', subfolder: '3d', type: 'output' }] },
                  '21': { images: [{ filename: 'onizleme.png', subfolder: '', type: 'output' }] },
                  '22': { audio: [{ filename: 's.flac', subfolder: 'audio', type: 'output' }] }
                }
              }
            })
          )
        } else if (u.pathname === '/view') {
          const f = files[`out/${u.searchParams.get('subfolder')}/${u.searchParams.get('filename')}`]
          if (f) res.end(f)
          else res.writeHead(404).end()
        } else res.writeHead(404).end()
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
  })
  afterAll(() => {
    server.closeAllConnections()
    server.close()
  })

  it('görseli yükler, anahtarı gönderir, 3D / görsel / ses çıktılarını indirir', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-comfy-'))
    const wfFile = path.join(dir, 'wf.json')
    fs.writeFileSync(
      wfFile,
      JSON.stringify({
        '1': { class_type: 'LoadImage', inputs: { image: 'x.png' } },
        '2': { class_type: 'TextNode', inputs: { text: '' }, _meta: { title: 'AF:prompt' } },
        '20': { class_type: 'SaveGLB', inputs: { mesh: ['1', 0], filename_prefix: '3d/ComfyUI' } }
      })
    )
    const ref = path.join(dir, 'ref.png')
    fs.writeFileSync(ref, 'PNG')
    const logs: string[] = []
    const r = await comfyRun({
      url,
      apiKey: 'comfy-key',
      workflowPath: wfFile,
      values: { prompt: 'zırh', seed: 3 },
      uploads: { image: ref },
      outDir: path.join(dir, 'out'),
      baseName: 'SM_Kilic',
      log: (m) => logs.push(m)
    })
    expect(seen.uploads).toEqual(['/ref.png'])
    expect(seen.prompt?.prompt['1'].inputs.image).toBe('ref.png')
    expect(seen.prompt?.prompt['2'].inputs.text).toBe('zırh')
    expect(seen.prompt?.extra_data?.api_key_comfy_org).toBe('comfy-key')
    expect(Object.fromEntries(Object.entries(r.files).map(([k, v]) => [k, v.map((f) => path.basename(f))]))).toEqual({
      image: ['SM_Kilic.png'],
      model: ['SM_Kilic.glb'],
      audio: ['SM_Kilic.flac'],
      anim: []
    })
    expect(fs.readFileSync(r.files.model[0], 'utf8')).toBe('glTF')
    expect(logs.join('\n')).toMatch(/ComfyUI işi: p1/)
  })

  it('reddedilen workflow açık hata verir; ulaşılamayan sunucu açık hata verir', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-comfy-'))
    const wfFile = path.join(dir, 'wf.json')
    fs.writeFileSync(wfFile, JSON.stringify(sdxl))
    seen.reject = true
    await expect(comfyRun({ url, workflowPath: wfFile, values: {}, outDir: dir, baseName: 'x', log: () => undefined })).rejects.toThrow(/reddetti.*eksik düğüm/)
    seen.reject = false
    await expect(comfyRun({ url: 'http://127.0.0.1:9', workflowPath: wfFile, values: {}, outDir: dir, baseName: 'x', log: () => undefined })).rejects.toThrow(/ulaşılamadı/)
  })
})

describe('yerel ComfyUI adresi', () => {
  it('yalnızca bu bilgisayardaki adres yönetilir; port adresten okunur', async () => {
    const { isLocalUrl, portOf } = await import('../src/main/integrations/comfy')
    expect(isLocalUrl('http://127.0.0.1:8188')).toBe(true)
    expect(isLocalUrl('http://localhost:9000/')).toBe(true)
    expect(isLocalUrl('http://192.168.1.20:8188')).toBe(false)
    expect(isLocalUrl('bozuk')).toBe(false)
    expect(portOf('http://127.0.0.1:8190')).toBe(8190)
    expect(portOf('http://127.0.0.1')).toBe(80)
  })
})
