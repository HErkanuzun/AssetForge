// SPDX-License-Identifier: AGPL-3.0-only
// OpenAI uyumlu görsel / konuşma uçları ve genel HTTP isteği düğümü: şablon doldurma, yanıttan sonuç çıkarma,
// iş kimliği dönen uçlarda durum sorgulama, anahtarın yalnızca aynı sunucuya gitmesi (sahte sunucularla).
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { apiBase, openaiImage, openaiSpeech } from '../src/main/providers/openaiMedia'
import { extFor, fillTemplate, getPath, httpRun } from '../src/main/providers/httpGeneric'
import type { LlmProvider } from '../src/shared/types'

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')

interface Seen {
  path: string
  auth: string
  ct: string
  body: string
}

function serve(handler: (req: http.IncomingMessage, body: Buffer, res: http.ServerResponse, url: URL) => void): Promise<{ url: string; seen: Seen[]; close: () => void }> {
  const seen: Seen[] = []
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const u = new URL(req.url ?? '/', 'http://x')
      const body = Buffer.concat(chunks)
      seen.push({ path: u.pathname + u.search, auth: req.headers.authorization ?? '-', ct: req.headers['content-type'] ?? '', body: body.toString('utf8') })
      handler(req, body, res, u)
    })
  })
  return new Promise((r) =>
    server.listen(0, '127.0.0.1', () =>
      r({
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        seen,
        close: () => {
          server.closeAllConnections()
          server.close()
        }
      })
    )
  )
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'af-custom-'))

describe('şablon ve yol yardımcıları', () => {
  it('JSON içine kaçışlı yazar, adreste kodlar, eksik değeri boş bırakır', () => {
    expect(fillTemplate('{"p": "{{PROMPT}}", "s": {{SEED}}}', { PROMPT: 'kırmızı "kılıç"\nyeni', SEED: 7 }, 'json')).toBe('{"p": "kırmızı \\"kılıç\\"\\nyeni", "s": 7}')
    expect(fillTemplate('http://h/run?q={{PROMPT}}&x={{YOK}}', { PROMPT: 'a b&c' }, 'url')).toBe('http://h/run?q=a%20b%26c&x=')
  })

  it('yolları okur: nokta, köşeli parantez, yıldız', () => {
    const j = { data: [{ url: 'u1' }, { url: 'u2' }], output: { mesh: 'm' } }
    expect(getPath(j, 'data.0.url')).toBe('u1')
    expect(getPath(j, 'data[1].url')).toBe('u2')
    expect(getPath(j, 'data.*.url')).toEqual(['u1', 'u2'])
    expect(getPath(j, 'output.mesh')).toBe('m')
    expect(getPath(j, 'output.yok')).toBeUndefined()
  })

  it('uzantıyı içerik türünden, adresten ya da çıktı türünden seçer', () => {
    expect(extFor('model', 'model/gltf-binary')).toBe('.glb')
    expect(extFor('model', 'application/octet-stream', 'http://h/files/a.fbx?x=1')).toBe('.fbx')
    expect(extFor('audio', null)).toBe('.wav')
    expect(extFor('anim', '')).toBe('.bvh')
  })

  it('sağlayıcı adresinin kökünü bulur', () => {
    expect(apiBase({ baseUrl: 'http://127.0.0.1:8880/v1/' })).toBe('http://127.0.0.1:8880/v1')
    expect(apiBase({ baseUrl: 'https://api.ornek.com/v1/chat/completions' })).toBe('https://api.ornek.com/v1')
    expect(apiBase({ baseUrl: '' })).toBe('https://api.openai.com/v1')
  })
})

describe('OpenAI uyumlu görsel ve konuşma', () => {
  let srv: Awaited<ReturnType<typeof serve>>
  let provider: LlmProvider
  beforeAll(async () => {
    srv = await serve((_req, _body, res, u) => {
      if (u.pathname === '/v1/images/generations') res.end(JSON.stringify({ data: [{ b64_json: PNG.toString('base64') }, { url: `${srv.url}/files/b.png` }] }))
      else if (u.pathname === '/v1/images/edits') res.end(JSON.stringify({ data: [{ b64_json: PNG.toString('base64') }] }))
      else if (u.pathname === '/files/b.png') res.end(PNG)
      else if (u.pathname === '/v1/audio/speech') res.end(Buffer.alloc(2000, 1))
      else res.writeHead(404).end('yok')
    })
    provider = { id: 'p_yok', name: 'Yerel', kind: 'openai', baseUrl: `${srv.url}/v1`, model: 'x', vision: false }
  })
  afterAll(() => srv.close())

  it('metinden görsel: b64 ve adresli sonuçları kaydeder, yalnızca verilen alanları gönderir', async () => {
    const dir = tmp()
    const files = await openaiImage({ provider, model: 'flux', prompt: 'kılıç', n: 2, outDir: dir, baseName: 'T_Kilic' })
    expect(files.map((f) => path.basename(f))).toEqual(['T_Kilic_1.png', 'T_Kilic_2.png'])
    expect(fs.readFileSync(files[1]).equals(PNG)).toBe(true)
    const req = srv.seen.find((x) => x.path === '/v1/images/generations')!
    expect(JSON.parse(req.body)).toEqual({ model: 'flux', prompt: 'kılıç', n: 2 })
  })

  it('görsel bağlıysa düzenleme ucuna dosyayı yükler', async () => {
    const dir = tmp()
    const src = path.join(dir, 'kaynak.png')
    fs.writeFileSync(src, PNG)
    await openaiImage({ provider, model: 'gpt-image-1', prompt: 'paslı yap', image: src, outDir: dir, baseName: 'E' })
    const req = srv.seen.find((x) => x.path === '/v1/images/edits')!
    expect(req.ct).toMatch(/multipart\/form-data/)
    expect(req.body).toContain('filename="kaynak.png"')
    expect(req.body).toContain('name="prompt"')
  })

  it('konuşma sesini dosyaya yazar', async () => {
    const out = path.join(tmp(), 'VO_Muhafiz.wav')
    await openaiSpeech({ provider, model: 'kokoro', voice: 'af_bella', text: 'Dur! Kimsin?', format: 'wav', speed: 1.1, out })
    expect(fs.statSync(out).size).toBe(2000)
    expect(JSON.parse(srv.seen.find((x) => x.path === '/v1/audio/speech')!.body)).toEqual({ model: 'kokoro', input: 'Dur! Kimsin?', voice: 'af_bella', response_format: 'wav', speed: 1.1 })
  })

  it('desteklenmeyen uçta anlaşılır hata', async () => {
    await expect(openaiImage({ provider: { ...provider, baseUrl: `${srv.url}/v2` }, model: 'x', prompt: 'x', outDir: tmp(), baseName: 'x' })).rejects.toThrow(/404.*desteklemiyor/)
  })
})

describe('genel HTTP isteği', () => {
  let api: Awaited<ReturnType<typeof serve>>
  let cdn: Awaited<ReturnType<typeof serve>>
  let polls = 0
  beforeAll(async () => {
    cdn = await serve((_req, _body, res) => res.end('glTF-cdn'))
    api = await serve((_req, body, res, u) => {
      if (u.pathname === '/raw') {
        res.setHeader('Content-Type', 'model/gltf-binary')
        res.end('glTF-raw')
      } else if (u.pathname === '/json') res.end(JSON.stringify({ output: { mesh: '/files/m.glb', cdn: `${cdn.url}/m.glb` }, echo: JSON.parse(body.toString() || '{}') }))
      else if (u.pathname === '/files/m.glb') res.end('glTF-local')
      else if (u.pathname === '/jobs') res.end(JSON.stringify({ id: 'job 1' }))
      else if (u.pathname === '/jobs/job%201') {
        polls++
        res.end(JSON.stringify(polls < 2 ? { status: 'processing' } : { status: 'SUCCEEDED', result: { audio: `data:audio/wav;base64,${Buffer.from('RIFFwav').toString('base64')}` } }))
      } else if (u.pathname === '/fail') res.end(JSON.stringify({ id: 'f' }))
      else if (u.pathname === '/fail/f') res.end(JSON.stringify({ status: 'failed', error: 'GPU yok' }))
      else res.writeHead(404).end()
    })
  })
  afterAll(() => {
    api.close()
    cdn.close()
  })

  const base = (dir: string) => ({
    method: 'POST',
    headers: 'X-Proje: {{ASSET}}',
    bodyType: 'json' as const,
    body: '{"prompt": "{{PROMPT}}", "seed": {{SEED}}}',
    values: { PROMPT: 'taş "kule"', SEED: 42, ASSET: 'Kule' },
    files: {},
    outDir: dir,
    baseName: 'SM_Kule',
    log: () => undefined
  })

  it('yanıtın kendisi dosya', async () => {
    const dir = tmp()
    const files = await httpRun({ ...base(dir), url: `${api.url}/raw`, kind: 'model', resultPath: '' })
    expect(path.basename(files[0])).toBe('SM_Kule.glb')
    expect(fs.readFileSync(files[0], 'utf8')).toBe('glTF-raw')
    const req = api.seen.at(-1)!
    expect(JSON.parse(req.body)).toEqual({ prompt: 'taş "kule"', seed: 42 })
  })

  it('JSON yanıttaki göreli adresi indirir; anahtar aynı sunucuya gider, başka sunucuya gitmez', async () => {
    const dir = tmp()
    const local = await httpRun({ ...base(dir), url: `${api.url}/json`, token: 'gizli', kind: 'model', resultPath: 'output.mesh' })
    expect(fs.readFileSync(local[0], 'utf8')).toBe('glTF-local')
    expect(api.seen.filter((x) => x.path.startsWith('/json') || x.path.startsWith('/files')).every((x) => x.auth === 'Bearer gizli')).toBe(true)
    const remote = await httpRun({ ...base(dir), baseName: 'SM_Uzak', url: `${api.url}/json`, token: 'gizli', kind: 'model', resultPath: 'output.cdn' })
    expect(fs.readFileSync(remote[0], 'utf8')).toBe('glTF-cdn')
    expect(cdn.seen.every((x) => x.auth === '-')).toBe(true)
  })

  it('iş kimliği dönen uçta bitene kadar sorgular ve data: sonucunu kaydeder', async () => {
    const dir = tmp()
    const files = await httpRun({ ...base(dir), url: `${api.url}/jobs`, kind: 'audio', resultPath: 'result.audio', idPath: 'id', pollUrl: `${api.url}/jobs/{{ID}}`, statusPath: 'status' })
    expect(polls).toBe(2)
    expect(path.basename(files[0])).toBe('SM_Kule.wav')
    expect(fs.readFileSync(files[0], 'utf8')).toBe('RIFFwav')
  }, 20000)

  it('başarısız iş ve bozuk şablon anlaşılır hata verir', async () => {
    const dir = tmp()
    await expect(httpRun({ ...base(dir), url: `${api.url}/fail`, kind: 'model', resultPath: 'x', idPath: 'id', pollUrl: `${api.url}/fail/{{ID}}` })).rejects.toThrow(/başarısız \(failed\).*GPU yok/)
    await expect(httpRun({ ...base(dir), url: `${api.url}/raw`, body: '{"seed": {{SEED}', kind: 'model', resultPath: '' })).rejects.toThrow(/geçerli JSON değil/)
    await expect(httpRun({ ...base(dir), url: `${api.url}/json`, kind: 'model', resultPath: 'output.yok' })).rejects.toThrow(/yolunda dosya yok/)
  }, 20000)

  it('çok parçalı gövdede bağlı görseli yükler', async () => {
    const dir = tmp()
    const img = path.join(dir, 'ref.png')
    fs.writeFileSync(img, PNG)
    await httpRun({ ...base(dir), url: `${api.url}/raw`, bodyType: 'multipart', body: 'image=@image\nprompt={{PROMPT}}', files: { image: img }, kind: 'model', resultPath: '' })
    const req = api.seen.at(-1)!
    expect(req.ct).toMatch(/multipart\/form-data/)
    expect(req.body).toContain('filename="ref.png"')
    await expect(httpRun({ ...base(dir), url: `${api.url}/raw`, bodyType: 'multipart', body: 'audio=@audio', kind: 'model', resultPath: '' })).rejects.toThrow(/audio dosyası istiyor/)
  })
})
