// SPDX-License-Identifier: AGPL-3.0-only
// Özel arka uçlar ve Gradio: kurulum tarifinin okunması ve taslak önerisi, Gradio girişlerinin eşlenmesi,
// sahte Gradio 5 sunucusuyla uçtan uca çalıştırma, gerçek bir süreçle kur → başlat → hazır → durdur döngüsü.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fillCommand, guessRecipe, isGitUrl, parseRecipe, slugFromRepo } from '../src/shared/backends'
import { collectFiles, gradioEndpoints, gradioRun, mapRoles, parseSse } from '../src/main/providers/gradio'
import { getSettings, setSettings } from '../src/main/settings'
import { backendStatus, ensureBackend, installBackend, installHash, stopBackend, updateRecipe } from '../src/main/integrations/backends'

describe('kurulum tarifi', () => {
  it('git adreslerini tanır, yerel yolu ve file:// adresini reddeder', () => {
    expect(isGitUrl('https://github.com/microsoft/TRELLIS.2')).toBe(true)
    expect(isGitUrl('https://github.com/a/b.git')).toBe(true)
    expect(isGitUrl('git@github.com:a/b.git')).toBe(true)
    expect(isGitUrl('file:///C:/x')).toBe(false)
    expect(isGitUrl('C:\\repo')).toBe(false)
    expect(isGitUrl('https://github.com/a/b; rm -rf /')).toBe(false)
    expect(slugFromRepo('https://github.com/microsoft/TRELLIS.2.git')).toBe('trellis-2')
  })

  it('eksikleri varsayılanla doldurur, hatalıları anlaşılır hatayla reddeder', () => {
    const r = parseRecipe({ start: '{python} app.py' }, 'https://github.com/a/demo')
    expect(r).toMatchObject({ name: 'demo', repo: 'https://github.com/a/demo', port: 7860, api: 'gradio', ready: '/', install: [], startTimeout: 600 })
    expect(() => parseRecipe({ start: 'x', port: 80 }, 'https://github.com/a/b')).toThrow(/port/)
    expect(() => parseRecipe({ start: 'x', api: 'grpc' }, 'https://github.com/a/b')).toThrow(/api/)
    expect(() => parseRecipe({ start: 'x', python: 'en yeni' }, 'https://github.com/a/b')).toThrow(/python/)
    expect(() => parseRecipe({}, 'https://github.com/a/b')).toThrow(/start/)
    expect(() => parseRecipe({ start: 'x' })).toThrow(/repo/)
    expect(() => parseRecipe('{bozuk')).toThrow(/okunamadı/)
    expect(parseRecipe({ start: 'x', env: { HF_TOKEN_X: 1, 'bad key': 2 }, produces: ['model', 'video'] }, 'https://github.com/a/b')).toMatchObject({ env: { HF_TOKEN_X: '1' }, produces: ['model'] })
  })

  it('yer tutucuları doldurur, boşluklu yolları tırnaklar', () => {
    expect(fillCommand('{uv} pip install -r requirements.txt && {python} app.py --port {port}', { uv: 'C:\\u\\uv.exe', python: 'D:\\My Data\\venv\\python.exe', port: 7861, repo: 'D:\\r' })).toBe(
      'C:\\u\\uv.exe pip install -r requirements.txt && "D:\\My Data\\venv\\python.exe" app.py --port 7861'
    )
  })

  it('Gradio demosu olan bir depo için taslak: torch CUDA, requirements, app.py', () => {
    const g = guessRecipe('https://github.com/a/img23d', {
      files: ['README.md', 'app.py', 'requirements.txt'],
      requirements: 'torch==2.4.0\ngradio>=4\ntrimesh',
      entries: { 'app.py': 'import gradio as gr\ndemo.launch()' }
    })
    expect(g.recipe.install).toEqual(['{uv} pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128', '{uv} pip install -r requirements.txt'])
    expect(g.recipe.start).toBe('{python} app.py')
    expect(g.recipe.api).toBe('gradio')
    expect(g.notes.join(' ')).toMatch(/GRADIO_SERVER_PORT/)
  })

  it('sunucusu olmayan depo için uyarır', () => {
    const g = guessRecipe('https://github.com/a/cli', { files: ['infer.py', 'pyproject.toml'], entries: { 'infer.py': 'import argparse' } })
    expect(g.recipe.install).toEqual(['{uv} pip install -e .'])
    expect(g.notes.join(' ')).toMatch(/Başlatma dosyası bulunamadı/)
    expect(g.notes.join(' ')).toMatch(/sarmalayıcı/)
  })
})

describe('Gradio', () => {
  it('girişleri bileşen türü ve adına göre eşler', () => {
    const roles = mapRoles([
      { parameter_name: 'negative_prompt', component: 'Textbox' },
      { parameter_name: 'prompt', component: 'Textbox' },
      { parameter_name: 'input_image', component: 'Image' },
      { parameter_name: 'seed', component: 'Slider' },
      { parameter_name: 'steps', component: 'Slider' },
      { parameter_name: 'duration', component: 'Number' },
      { parameter_name: 'extra', component: 'Textbox' }
    ])
    expect(roles).toEqual(['negative', 'prompt', 'image', 'seed', undefined, 'seconds', undefined])
  })

  it('SSE akışını ve galeri çıktılarını okur', () => {
    expect(parseSse('event: generating\ndata: null\n\nevent: complete\ndata: [{"url": "http://x/f.glb"}, "ok"]\n\n')).toEqual([
      { event: 'generating', data: null },
      { event: 'complete', data: [{ url: 'http://x/f.glb' }, 'ok'] }
    ])
    const files = collectFiles(
      [[{ image: { url: 'http://x/a.png' }, caption: null }], { path: '/tmp/m.glb', meta: { _type: 'gradio.FileData' } }],
      [{ component: 'gallery' }, { component: 'model3d' }]
    )
    expect(files.map((f) => f.kind)).toEqual(['image', 'model'])
  })

  describe('sahte Gradio 5 sunucusu', () => {
    let server: http.Server
    let url = ''
    const seen: { call?: { data: unknown[] }; uploads: string[] } = { uploads: [] }
    beforeAll(async () => {
      server = http.createServer((req, res) => {
        const p = new URL(req.url ?? '/', 'http://x').pathname
        const chunks: Buffer[] = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
          const body = Buffer.concat(chunks)
          if (p === '/info') return res.writeHead(404).end()
          if (p === '/gradio_api/info')
            return res.end(
              JSON.stringify({
                named_endpoints: {
                  '/generate': {
                    parameters: [
                      { label: 'Image', parameter_name: 'image', component: 'Image', parameter_has_default: false },
                      { label: 'Prompt', parameter_name: 'prompt', component: 'Textbox', parameter_has_default: true, parameter_default: '' },
                      { label: 'Seed', parameter_name: 'seed', component: 'Slider', parameter_has_default: true, parameter_default: 0 },
                      { label: 'Steps', parameter_name: 'steps', component: 'Slider', parameter_has_default: true, parameter_default: 12 }
                    ],
                    returns: [
                      { label: 'Mesh', component: 'Model3D' },
                      { label: 'Preview', component: 'Image' },
                      { label: 'Log', component: 'Textbox' }
                    ]
                  }
                }
              })
            )
          if (p === '/gradio_api/upload') {
            const name = /filename="([^"]+)"/.exec(body.toString('latin1'))?.[1] ?? '?'
            seen.uploads.push(name)
            return res.end(JSON.stringify([`/tmp/gradio/${name}`]))
          }
          if (p === '/gradio_api/call/generate') {
            seen.call = JSON.parse(body.toString())
            return res.end(JSON.stringify({ event_id: 'e1' }))
          }
          if (p === '/gradio_api/call/generate/e1') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream' })
            res.write('event: generating\ndata: null\n\n')
            return res.end(
              `event: complete\ndata: ${JSON.stringify([
                { path: '/tmp/gradio/out.glb', url: `${url}/gradio_api/file=/tmp/gradio/out.glb`, orig_name: 'out.glb', meta: { _type: 'gradio.FileData' } },
                { path: '/tmp/gradio/prev.webp', url: null, orig_name: 'prev.webp', meta: { _type: 'gradio.FileData' } },
                'tamam'
              ])}\n\n`
            )
          }
          if (p.startsWith('/gradio_api/file=')) return res.end(p.endsWith('.glb') ? 'glTF' : 'RIFF')
          res.writeHead(404).end()
        })
      })
      await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
      url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    })
    afterAll(() => {
      server.closeAllConnections()
      server.close()
    })

    it('uç noktaları ve eşlemeyi gösterir', async () => {
      const eps = await gradioEndpoints(url)
      expect(eps[0].name).toBe('/generate')
      expect(eps[0].params.map((p) => p.role)).toEqual(['image', 'prompt', 'seed', undefined])
      expect(eps[0].returns.map((r) => r.kind)).toEqual(['model', 'image', null])
    })

    it('görseli yükler, değerleri yazar, modeli ve önizlemeyi indirir', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-gradio-'))
      const ref = path.join(dir, 'ref.png')
      fs.writeFileSync(ref, 'PNG')
      const logs: string[] = []
      const r = await gradioRun({
        url,
        values: { prompt: 'kılıç', seed: 5 },
        uploads: { image: ref },
        overrides: { steps: 30 },
        outDir: path.join(dir, 'out'),
        baseName: 'SM_Kilic',
        log: (m) => logs.push(m)
      })
      expect(seen.uploads).toEqual(['ref.png'])
      expect(seen.call?.data).toEqual([{ path: '/tmp/gradio/ref.png', orig_name: 'ref.png', meta: { _type: 'gradio.FileData' } }, 'kılıç', 5, 30])
      expect(r.files.model.map((f) => path.basename(f))).toEqual(['SM_Kilic.glb'])
      expect(r.files.image.map((f) => path.basename(f))).toEqual(['SM_Kilic.webp'])
      expect(fs.readFileSync(r.files.model[0], 'utf8')).toBe('glTF')
      expect(r.text).toEqual(['tamam'])
      expect(logs.join('\n')).toMatch(/uç nokta \/generate/)
    })

    it('olmayan uç nokta için var olanları söyler', async () => {
      await expect(gradioRun({ url, endpoint: '/yok', values: {}, outDir: os.tmpdir(), baseName: 'x', log: () => undefined })).rejects.toThrow(/Var olanlar: \/generate/)
    })
  })
})

describe('arka uç yaşam döngüsü (gerçek süreç)', () => {
  const id = 'af-test-node-server'
  const before = structuredClone({ list: getSettings().customBackends, home: getSettings().backendsHome })
  let home = ''

  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'af-backends-'))
    const repo = path.join(home, id, 'repo')
    fs.mkdirSync(repo, { recursive: true })
    execFileSync('git', ['init', '-q'], { cwd: repo })
    // Python gerektirmeyen küçük bir sunucu: kurulum bir dosya yazar, sunucu PORT ortam değişkenini dinler
    fs.writeFileSync(path.join(repo, 'server.js'), "require('http').createServer((q, s) => s.end(require('fs').readFileSync('ok.txt', 'utf8'))).listen(Number(process.env.PORT), '127.0.0.1')")
    const port = 20000 + Math.floor(Math.random() * 20000)
    setSettings({
      backendsHome: home,
      customBackends: [
        {
          id,
          name: 'Test sunucusu',
          addedAt: Date.now(),
          recipe: parseRecipe(
            { name: 'Test sunucusu', python: '', install: ["node -e \"require('fs').writeFileSync('ok.txt', 'hazir')\""], start: 'node server.js', port, api: 'http', startTimeout: 30 },
            'https://github.com/af/test'
          )
        }
      ]
    })
  })
  afterAll(async () => {
    await stopBackend(id).catch(() => undefined)
    setSettings({ customBackends: before.list, backendsHome: before.home })
    fs.rmSync(home, { recursive: true, force: true })
  })

  it('kurar, gerekince başlatır, hazır olunca adresi verir, durdurur', async () => {
    expect((await backendStatus(id)).installed).toBe(false)
    await expect(ensureBackend(id, () => undefined)).rejects.toThrow(/henüz kurulmadı/)
    const logs: string[] = []
    await installBackend(id, (l) => logs.push(l))
    expect(fs.readFileSync(path.join(home, id, 'repo', 'ok.txt'), 'utf8')).toBe('hazir')
    const st = await backendStatus(id)
    expect(st).toMatchObject({ installed: true, stale: false, healthy: false })
    const url = await ensureBackend(id, (l) => logs.push(l))
    expect(await (await fetch(url)).text()).toBe('hazir')
    expect((await backendStatus(id)).healthy).toBe(true)
    await stopBackend(id)
    await new Promise((r) => setTimeout(r, 800))
    expect((await backendStatus(id)).healthy).toBe(false)
  }, 60000)

  it('kurulumu etkileyen tarif değişikliği "yeniden kur" uyarısı verir', () => {
    const b = getSettings().customBackends.find((x) => x.id === id)!
    const h = installHash(b.recipe)
    const next = updateRecipe(id, JSON.stringify({ ...b.recipe, install: [...b.recipe.install, 'echo yeni'] }))
    expect(installHash(next.recipe)).not.toBe(h)
    return backendStatus(id).then((st) => expect(st.stale).toBe(true))
  })
})
