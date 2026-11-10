// SPDX-License-Identifier: AGPL-3.0-only
// Gerçek ComfyUI'a karşı uçtan uca test. Normalde atlanır; kurulu bir ComfyUI klasörüyle çalıştırın:
//   AF_COMFY_HOME=D:/AssetForgeData/comfyui npx vitest run tests/comfy.live.test.ts
// Model gerektirmez: resmi yükler, ComfyUI'da tersine çevirir, sonucu geri indirir.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { comfyLocalStatus, ensureComfy, comfyLocalStep } from '../src/main/integrations/comfy'
import { checkFit, comfyObjectInfo, comfyRun } from '../src/main/providers/comfyui'
import { importWorkflow, removeWorkflow, resolveWorkflow } from '../src/main/integrations/comfyLibrary'
import { withComfyServer } from '../src/main/integrations/comfyServers'
import { setSettings } from '../src/main/settings'

const home = process.env.AF_COMFY_HOME
const live = describe.skipIf(!home)

// 2x2 PNG: kırmızı, yeşil, mavi, beyaz
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAAMIM/////w8AH+4F+7C4l8kAAAAASUVORK5CYII=', 'base64')

const WORKFLOW = {
  '1': { class_type: 'LoadImage', inputs: { image: 'x.png' }, _meta: { title: 'AF:image' } },
  '2': { class_type: 'ImageInvert', inputs: { image: ['1', 0] } },
  '3': { class_type: 'SaveImage', inputs: { filename_prefix: 'AssetForgeLive', images: ['2', 0] } }
}

live('canlı ComfyUI', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-comfy-live-'))
  const log = (m: string) => console.log(`  ${m}`)
  let started = false

  afterAll(async () => {
    if (started) await comfyLocalStep('stop', log)
  }, 60000)

  it('kurulum adımları tamam görünür', async () => {
    setSettings({ comfyHome: home!, comfyServers: [{ id: 'local', name: 'Bu bilgisayar', url: 'http://127.0.0.1:8188', enabled: true, managed: true }] })
    const st = await comfyLocalStatus()
    log(JSON.stringify(st.steps.map((s) => [s.id, s.done])))
    expect(st.steps.filter((s) => s.id !== 'start').every((s) => s.done)).toBe(true)
  }, 90000)

  it('kapalıysa kendiliğinden başlar', async () => {
    const before = await comfyLocalStatus()
    started = !before.healthy
    await ensureComfy(log)
    expect((await comfyLocalStatus()).healthy).toBe(true)
  }, 240000)

  it('iş akışını çalıştırıp resmi geri getirir', async () => {
    const wf = path.join(dir, 'invert_api.json')
    const img = path.join(dir, 'in.png')
    fs.writeFileSync(wf, JSON.stringify(WORKFLOW))
    fs.writeFileSync(img, PNG)
    let last = 0
    const r = await comfyRun({
      url: 'http://127.0.0.1:8188',
      workflowPath: wf,
      values: {},
      uploads: { image: img },
      outDir: dir,
      baseName: 'live',
      log,
      progress: (p) => (last = p)
    })
    expect(r.files.image).toHaveLength(1)
    const out = fs.readFileSync(r.files.image[0])
    expect(out.subarray(1, 4).toString()).toBe('PNG')
    expect(last).toBeGreaterThan(0)
  }, 120000)

  it('gerçek düğüm listesiyle uygunluk denetimi ve kitaplıktan otomatik sunucu seçimi', async () => {
    const info = await comfyObjectInfo('http://127.0.0.1:8188')
    expect(checkFit(JSON.stringify(WORKFLOW), info)).toEqual({ missingNodes: [], missingModels: [] })
    const fake = { ...WORKFLOW, '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'yok-boyle-model.safetensors' } }, '5': { class_type: 'YokBoyleDugum', inputs: {} } }
    expect(checkFit(JSON.stringify(fake), info)).toEqual({ missingNodes: ['YokBoyleDugum'], missingModels: ['yok-boyle-model.safetensors'] })

    const w = importWorkflow({ json: JSON.stringify(WORKFLOW), name: 'Canlı test ters çevir' })
    try {
      const wf = resolveWorkflow(w.id)
      const img = path.join(dir, 'in2.png')
      fs.writeFileSync(img, PNG)
      const logs: string[] = []
      const r = await withComfyServer({ choice: 'auto', workflowPath: wf.path, log: (m) => logs.push(m) }, (s) =>
        comfyRun({ url: s.url, token: s.token, workflowPath: wf.path, values: {}, uploads: { image: img }, outDir: dir, baseName: 'live2', log })
      )
      expect(logs.join('\n')).toMatch(/ComfyUI sunucusu: Bu bilgisayar/)
      expect(r.files.image).toHaveLength(1)
    } finally {
      removeWorkflow(w.id)
    }
  }, 120000)
})
