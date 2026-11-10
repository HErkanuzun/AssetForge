// SPDX-License-Identifier: AGPL-3.0-only
// Sahte ComfyUI sunucularıyla sunucu seçimi ve workflow kitaplığı: "Otomatik" eksik düğümü olanı ve kapalıyı atlar,
// aynı anda başlayan işleri boş sunuculara dağıtır, açık seçim anlaşılır hata verir, token sunucuya gider.
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getSettings, setSettings } from '../src/main/settings'
import { effectiveChoice, withComfyServer } from '../src/main/integrations/comfyServers'
import { importWorkflow, listWorkflows, removeWorkflow, resolveWorkflow, updateWorkflow } from '../src/main/integrations/comfyLibrary'

const WF = {
  '1': { class_type: 'LoadImage', inputs: { image: 'ref.png' } },
  '2': { class_type: 'Trellis2ImageTo3D', inputs: { image: ['1', 0], seed: 0 } },
  '3': { class_type: 'SaveGLB', inputs: { mesh: ['2', 0], filename_prefix: '3d/AF' } }
}

interface Fake {
  server: http.Server
  url: string
  auth: string[]
}

function fake(nodes: string[], queue: number): Promise<Fake> {
  const auth: string[] = []
  const info = Object.fromEntries(nodes.map((n) => [n, { input: { required: {} } }]))
  const server = http.createServer((req, res) => {
    auth.push(req.headers.authorization ?? '-')
    const p = new URL(req.url ?? '/', 'http://x').pathname
    if (p === '/system_stats') res.end(JSON.stringify({ system: { comfyui_version: '0.44.0' }, devices: [{ name: 'cuda:0 RTX', vram_total: 8 * 2 ** 30 }] }))
    else if (p === '/queue') res.end(JSON.stringify({ queue_running: Array.from({ length: queue }, () => [0, 'x']), queue_pending: [] }))
    else if (p === '/object_info') res.end(JSON.stringify(info))
    else res.writeHead(404).end()
  })
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, auth })))
}

describe('ComfyUI sunucu seçimi', () => {
  const all = ['LoadImage', 'Trellis2ImageTo3D', 'SaveGLB']
  let a: Fake, b: Fake, c: Fake, d: Fake
  let wfPath = ''
  const before = structuredClone({ servers: getSettings().comfyServers, def: getSettings().comfyDefaultServer })

  beforeAll(async () => {
    ;[a, b, c, d] = await Promise.all([fake(['LoadImage', 'SaveGLB'], 0), fake(all, 2), fake(all, 0), fake(all, 2)])
    setSettings({
      comfyDefaultServer: 'auto',
      comfyServers: [
        { id: 'local', name: 'Bu bilgisayar', url: 'http://127.0.0.1:1', enabled: false, managed: true },
        { id: 'a', name: 'Eksik PC', url: a.url, enabled: true },
        { id: 'b', name: 'Ofis PC', url: b.url, enabled: true },
        { id: 'c', name: 'Kapalı PC', url: c.url, enabled: false },
        { id: 'd', name: 'Laptop', url: d.url, enabled: true }
      ],
      comfyTokens: { b: 'ofis-token' }
    })
    const w = importWorkflow({ json: JSON.stringify(WF), name: 'TRELLIS test' })
    wfPath = resolveWorkflow(w.id).path
  })
  afterAll(() => {
    for (const w of listWorkflows().filter((x) => x.name.startsWith('TRELLIS test'))) removeWorkflow(w.id)
    setSettings({ comfyServers: before.servers, comfyDefaultServer: before.def, comfyTokens: { b: '' } })
    for (const f of [a, b, c, d]) {
      f.server.closeAllConnections()
      f.server.close()
    }
  })

  it('Otomatik: eksik düğümü olanı ve kapalıyı atlar, token’ı gönderir', async () => {
    const logs: string[] = []
    const picked = await withComfyServer({ choice: 'auto', workflowPath: wfPath, log: (m) => logs.push(m) }, async (s) => s.id)
    expect(['b', 'd']).toContain(picked)
    expect(logs.join('\n')).toMatch(/Eksik PC atlandı \(eksik düğüm: Trellis2ImageTo3D\)/)
    expect(logs.join('\n')).not.toMatch(/Kapalı PC/)
    expect(b.auth.length).toBeGreaterThan(0)
    expect(b.auth.every((x) => x === 'Bearer ofis-token')).toBe(true)
    expect(d.auth.every((x) => x === '-')).toBe(true)
  })

  it('aynı anda başlayan iki işi iki boş sunucuya dağıtır', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const first = withComfyServer({ choice: 'auto', workflowPath: wfPath, log: () => undefined }, async (s) => {
      await gate
      return s.id
    })
    // İlk iş sunucusunu seçip çalışmaya başlayana kadar bekle
    await new Promise((r) => setTimeout(r, 300))
    const second = await withComfyServer({ choice: 'auto', workflowPath: wfPath, log: () => undefined }, async (s) => s.id)
    release()
    expect(new Set([await first, second])).toEqual(new Set(['b', 'd']))
  })

  it('açık seçim: eksik düğüm ve kapalı sunucu için anlaşılır hata', async () => {
    await expect(withComfyServer({ choice: 'a', workflowPath: wfPath, log: () => undefined }, async () => 1)).rejects.toThrow(/Eksik PC.*eksik düğüm: Trellis2ImageTo3D/)
    await expect(withComfyServer({ choice: 'c', workflowPath: wfPath, log: () => undefined }, async () => 1)).rejects.toThrow(/Kapalı PC.*kapalı/)
    expect(await withComfyServer({ choice: 'd', workflowPath: wfPath, log: () => undefined }, async (s) => s.id)).toBe('d')
  })

  it('seçim zinciri: düğüm → workflow → Ayarlar; silinmiş sunucu Otomatik olur', () => {
    expect(effectiveChoice('', '')).toBe('auto')
    expect(effectiveChoice('', 'd')).toBe('d')
    expect(effectiveChoice('b', 'd')).toBe('b')
    expect(effectiveChoice('silindi', '')).toBe('auto')
    setSettings({ comfyDefaultServer: 'b' })
    expect(effectiveChoice('', '')).toBe('b')
    expect(effectiveChoice('auto', '')).toBe('auto')
    setSettings({ comfyDefaultServer: 'auto' })
  })
})

describe('workflow kitaplığı', () => {
  it('ekler, kopyasını saklar, sunucu tercihini tutar, siler', () => {
    const w = importWorkflow({ json: JSON.stringify(WF), name: 'TRELLIS test kitaplık' })
    expect(w.produces).toEqual(['model'])
    expect(w.roles).toEqual(['seed', 'image'])
    const r = resolveWorkflow(w.id)
    expect(JSON.parse(fs.readFileSync(r.path, 'utf8'))).toEqual(WF)
    expect(updateWorkflow(w.id, { serverId: 'd' }).serverId).toBe('d')
    expect(resolveWorkflow(w.id).serverId).toBe('d')
    // Aynı ad ikinci kez eklenince ayırt edilir
    const w2 = importWorkflow({ json: JSON.stringify(WF), name: 'TRELLIS test kitaplık' })
    expect(w2.name).toBe('TRELLIS test kitaplık (2)')
    removeWorkflow(w.id)
    removeWorkflow(w2.id)
    expect(fs.existsSync(r.path)).toBe(false)
    expect(() => resolveWorkflow(w.id)).toThrow(/bulunamadı/)
  })

  it('arayüz formatındaki workflow eklenmez', () => {
    expect(() => importWorkflow({ json: JSON.stringify({ nodes: [], links: [] }) })).toThrow(/Export \(API\)/)
  })

  it('boş seçim yerleşik şablona düşer', () => {
    expect(resolveWorkflow('').name).toMatch(/SDXL|.+/)
  })
})
