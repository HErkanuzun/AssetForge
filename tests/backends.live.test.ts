// SPDX-License-Identifier: AGPL-3.0-only
// Gerçek Gradio ile uçtan uca: uv ile Python ortamı kurulur, gradio indirilir, küçük bir demo arka planda açılır,
// Gradio Uygulaması düğümünün yolu (yükleme → çağrı → SSE → indirme) gerçek API'ye karşı denenir.
// Normalde atlanır (≈100 MB indirir):  AF_BACKEND_LIVE=1 npx vitest run tests/backends.live.test.ts
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseRecipe } from '../src/shared/backends'
import { gradioEndpoints, gradioRun } from '../src/main/providers/gradio'
import { getSettings, setSettings } from '../src/main/settings'
import { ensureBackend, installBackend, stopBackend } from '../src/main/integrations/backends'

const live = describe.skipIf(!process.env.AF_BACKEND_LIVE)

// 2x1 PNG: kırmızı, mavi
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAEElEQVR4nGP4z8DwHwyBDABG4gX7ioSYLwAAAABJRU5ErkJggg==', 'base64')

const APP = `import gradio as gr
from PIL import ImageOps

def flip(image, prompt, seed):
    return ImageOps.mirror(image), f"{prompt}|{int(seed)}"

gr.Interface(
    flip,
    [gr.Image(type="pil", label="Image"), gr.Textbox(label="Prompt"), gr.Number(label="Seed", value=0)],
    [gr.Image(type="pil", label="Flipped"), gr.Textbox(label="Log")],
).launch()
`

live('gerçek Gradio arka ucu', () => {
  const id = 'af-live-gradio'
  const before = structuredClone({ list: getSettings().customBackends, home: getSettings().backendsHome })
  const home = process.env.AF_BACKEND_HOME || path.join(os.tmpdir(), 'af-backends-live')
  const log = (m: string) => console.log(`  ${m}`)

  beforeAll(() => {
    const repo = path.join(home, id, 'repo')
    fs.mkdirSync(repo, { recursive: true })
    if (!fs.existsSync(path.join(repo, '.git'))) execFileSync('git', ['init', '-q'], { cwd: repo })
    fs.writeFileSync(path.join(repo, 'app.py'), APP)
    setSettings({
      backendsHome: home,
      customBackends: [
        {
          id,
          name: 'Canlı Gradio',
          addedAt: Date.now(),
          recipe: parseRecipe(
            { name: 'Canlı Gradio', python: '3.11', install: ['{uv} pip install gradio'], start: '{python} app.py', port: 7871, api: 'gradio', startTimeout: 180 },
            'https://github.com/af/live'
          )
        }
      ]
    })
  })
  afterAll(async () => {
    await stopBackend(id).catch(() => undefined)
    setSettings({ customBackends: before.list, backendsHome: before.home })
  })

  it('kurar, başlatır ve Gradio API’siyle görseli işler', async () => {
    await installBackend(id, log)
    const url = await ensureBackend(id, log)
    const eps = await gradioEndpoints(url)
    log(JSON.stringify(eps))
    expect(eps[0].params.map((p) => p.role)).toEqual(['image', 'prompt', 'seed'])
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-gradio-live-'))
    const img = path.join(dir, 'in.png')
    fs.writeFileSync(img, PNG)
    const r = await gradioRun({ url, values: { prompt: 'merhaba', seed: 7 }, uploads: { image: img }, outDir: dir, baseName: 'live', log })
    expect(r.text).toEqual(['merhaba|7'])
    expect(r.files.image).toHaveLength(1)
    expect(fs.statSync(r.files.image[0]).size).toBeGreaterThan(50)
  }, 900000)
})
