// SPDX-License-Identifier: AGPL-3.0-only
// Web sunucusu: aynı projeyi birden çok kişinin kaydetmesi (birleştirme), hesaplar ve davetler, roller,
// ve gerçek HTTP üzerinden giriş → işlem çağrısı → olay akışı → dosya yükleme/okuma.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Project } from '../src/shared/types'
import { merge3, loadSynced, saveSynced } from '../src/main/projectSync'
import { createInvite, createSession, endSession, inviteInfo, join, login, removeUser, resetAccessCache, sessionUser, setOwner, setRole } from '../src/main/web/access'
import { allowed, foreignPath, shellEscalation } from '../src/main/web/policy'
import { currentCaller } from '../src/main/web/caller'
import { emit } from '../src/main/web/hub'
import { syncWebServer, webRunning, type Handler } from '../src/main/web/server'

const tmp = path.join(os.tmpdir(), 'assetforge-test')
const accessFile = path.join(tmp, 'web-access.json')

function freshAccess(): void {
  fs.rmSync(accessFile, { force: true })
  resetAccessCache()
}

describe('proje birleştirme', () => {
  it('farklı alanlardaki değişiklikler korunur, aynı alanda gönderen kazanır', () => {
    const base = {
      name: 'A',
      assets: [
        { id: 'a1', name: 'Kılıç' },
        { id: 'a2', name: 'Kalkan' }
      ],
      bible: { style: 'x', tone: 'y' }
    }
    const mine = {
      ...base,
      assets: [
        { id: 'a1', name: 'Kılıç v2' },
        { id: 'a2', name: 'Kalkan' },
        { id: 'a3', name: 'Yay' }
      ],
      bible: { style: 'benim', tone: 'y' }
    }
    const theirs = {
      ...base,
      assets: [
        { id: 'a1', name: 'Kılıç' },
        { id: 'a4', name: 'Mızrak' }
      ],
      bible: { style: 'onların', tone: 'koyu' }
    }
    const out = merge3(base, mine, theirs)
    // a2'yi onlar sildi, ben değiştirmedim → silinir; a3'ü ben, a4'ü onlar ekledi → ikisi de kalır
    expect(out.assets.map((a) => a.id)).toEqual(['a1', 'a4', 'a3'])
    expect(out.assets[0].name).toBe('Kılıç v2')
    expect(out.bible).toEqual({ style: 'benim', tone: 'koyu' })
  })

  it('eski sürümle kaydeden kişinin değişikliği diğerininkini silmez', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-sync-'))
    const a = loadSynced(dir)
    const b = loadSynced(dir)
    const r1 = saveSynced(dir, { ...a, assets: [...a.assets, { id: 'x1', name: 'A’nın asset’i' } as Project['assets'][number]] })
    expect(r1.merged).toBe(false)
    // B, A'nın kaydını görmeden kendi asset'ini ekler
    const r2 = saveSynced(dir, { ...b, assets: [...b.assets, { id: 'x2', name: 'B’nin asset’i' } as Project['assets'][number]] })
    expect(r2.merged).toBe(true)
    expect(r2.project.assets.map((x) => x.id)).toEqual(expect.arrayContaining(['x1', 'x2']))
    expect(r2.rev).toBeGreaterThan(r1.rev)
    const disk = JSON.parse(fs.readFileSync(path.join(dir, 'forge-project.json'), 'utf8')) as Project
    expect(disk.assets.map((x) => x.id)).toEqual(expect.arrayContaining(['x1', 'x2']))
    expect('rev' in disk).toBe(false)
  })
})

describe('hesaplar ve davetler', () => {
  beforeAll(freshAccess)

  it('sahip, davet, katılma, giriş ve oturum', () => {
    expect(() => setOwner('S', 'kısa')).toThrow()
    const owner = setOwner('Sahip Kişi', 'parola-123')
    expect(owner.role).toBe('owner')
    expect(() => createInvite('owner')).toThrow()

    const inv = createInvite('editor', 1, 1)
    expect(inviteInfo(inv.token)).toEqual({ role: 'editor' })
    const ed = join(inv.token, 'Editör Ece', 'ece-parola')
    expect(ed.role).toBe('editor')
    // Tek kullanımlık davet bitti
    expect(inviteInfo(inv.token)).toBeNull()
    expect(() => join(inv.token, 'Başka', 'parola-xyz')).toThrow(/geçersiz/)
    // Aynı ad iki kez alınamaz
    const inv2 = createInvite('viewer', 1, 2)
    expect(() => join(inv2.token, 'editör ece', 'parola-xyz')).toThrow(/kullanılıyor/)

    expect(login('Editör Ece', 'yanlış-parola')).toBeNull()
    expect(login('editör ece', 'ece-parola')?.id).toBe(ed.id)
    const t = createSession(ed.id)
    expect(sessionUser(t)?.name).toBe('Editör Ece')
    // Dosyada düz oturum anahtarı ve düz parola yok
    const raw = fs.readFileSync(accessFile, 'utf8')
    expect(raw).not.toContain(t)
    expect(raw).not.toContain('ece-parola')

    setRole(ed.id, 'viewer')
    expect(sessionUser(t)?.role).toBe('viewer')
    expect(() => setRole(owner.id, 'viewer')).toThrow()
    endSession(t)
    expect(sessionUser(t)).toBeNull()
    removeUser(ed.id)
    expect(login('Editör Ece', 'ece-parola')).toBeNull()
  })
})

describe('roller', () => {
  it('izleyici bakar, editör üretir, ayarlar ve kurulumlar sahibe kalır', () => {
    expect(allowed('viewer', 'project:load')).toBe(true)
    expect(allowed('viewer', 'project:save')).toBe(false)
    expect(allowed('editor', 'project:save')).toBe(true)
    expect(allowed('editor', 'run:start')).toBe(true)
    expect(allowed('editor', 'settings:set')).toBe(false)
    expect(allowed('editor', 'comfy:step')).toBe(false)
    expect(allowed('editor', 'web:invite')).toBe(false)
    // Listede olmayan yeni işlem varsayılan olarak yalnızca sahibe açık
    expect(allowed('editor', 'yeni:islem')).toBe(false)
    expect(allowed('owner', 'yeni:islem')).toBe(true)
  })

  it('editör Ajan Görevi için terminal iznini açamaz, var olanı koruyabilir', () => {
    const p = (shell: boolean) => ({ pipelines: [{ id: 'p', name: 'Hat', nodes: [{ id: 'n', type: 'agent.task', params: { shell } }] }] }) as unknown as Project
    expect(shellEscalation(p(false), p(true))).toMatch(/sahip/)
    expect(shellEscalation(p(true), p(true))).toBeNull()
    expect(shellEscalation(p(true), p(false))).toBeNull()
  })

  it('proje klasörü dışındaki dosya yolları yakalanır', () => {
    const root = path.join(os.tmpdir(), 'af-root')
    const inside = (s: string) => path.resolve(root, s).startsWith(root + path.sep)
    const none = new Set<string>()
    expect(foreignPath({ images: [path.join(root, 'uploads', 'a.png')] }, inside, none)).toBeNull()
    expect(foreignPath({ images: [path.join(os.tmpdir(), 'baska', 'gizli.png')] }, inside, none)).toContain('gizli.png')
    expect(foreignPath(['..\\..\\gizli.txt'], inside, none, false)).toBe('..\\..\\gizli.txt')
    expect(foreignPath(['C:\\Windows\\win.ini'], inside, none, false)).toBe('C:\\Windows\\win.ini')
    expect(foreignPath(['file:///etc/passwd'], inside, none, true)).toBe('file:///etc/passwd')
    // Sohbet metni, Unreal içerik yolu ve projede zaten kayıtlı yol serbest
    expect(foreignPath(['Şu klasöre bak: C:\\x', '/Game/Characters/Hero'], inside, none, true)).toBeNull()
    expect(foreignPath(['D:\\UE\\Proje\\Content'], inside, new Set(['D:\\UE\\Proje\\Content']), false)).toBeNull()
  })
})

describe('web sunucusu (HTTP)', () => {
  const port = 20000 + Math.floor(Math.random() * 20000)
  const base = `http://127.0.0.1:${port}`
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-webproj-'))
  const rendererDir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-webui-'))
  const seen: { channel: string; args: unknown[]; role: string; client?: string }[] = []
  const registry = new Map<string, Handler>()
  const record =
    (channel: string) =>
    (...args: unknown[]) => {
      const c = currentCaller()
      seen.push({ channel, args, role: c.role, client: c.clientId })
      return { channel, n: args.length, second: args[1] === undefined ? 'undefined' : typeof args[1] }
    }
  for (const ch of ['project:load', 'run:start', 'assets:import', 'settings:set', 'dialog:pickFiles']) registry.set(ch, record(ch))
  let ownerCookie = ''
  let editorCookie = ''
  let viewerCookie = ''

  async function signIn(name: string, password: string): Promise<string> {
    const r = await fetch(`${base}/login`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ name, password }) })
    expect(r.status).toBe(303)
    const c = r.headers.get('set-cookie') ?? ''
    expect(c).toMatch(/HttpOnly/)
    expect(c).toMatch(/SameSite=Strict/)
    return c.split(';')[0]
  }

  const callApi = (cookie: string, channel: string, args: unknown[], extra: Record<string, string> = {}) =>
    fetch(`${base}/api/call/${channel}`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json', 'x-forge': '1', 'x-forge-client': 'sekme1', ...extra },
      body: JSON.stringify({ args, undef: args.flatMap((a, i) => (a === undefined ? [i] : [])) })
    })

  beforeAll(async () => {
    freshAccess()
    fs.writeFileSync(path.join(rendererDir, 'index.html'), '<!doctype html><title>AF</title>')
    setOwner('Sahip', 'sahip-parola')
    join(createInvite('editor').token, 'Ece', 'ece-parola')
    join(createInvite('viewer').token, 'Can', 'can-parola')
    await syncWebServer({ enabled: true, port, lan: false }, { registry, rendererDir, projectDir: () => projectDir, diagnostics: async () => 'tanı' })
    expect(webRunning()).toBe(true)
    ownerCookie = await signIn('Sahip', 'sahip-parola')
    editorCookie = await signIn('Ece', 'ece-parola')
    viewerCookie = await signIn('Can', 'can-parola')
  })

  afterAll(async () => {
    await syncWebServer({ enabled: false, port, lan: false }, { registry, rendererDir, projectDir: () => projectDir, diagnostics: async () => '' })
  })

  it('oturumsuz istek reddedilir, arayüz girişe yönlendirir', async () => {
    expect((await callApi('', 'project:load', [])).status).toBe(401)
    const r = await fetch(base + '/', { redirect: 'manual' })
    expect(r.status).toBe(303)
    expect(r.headers.get('location')).toBe('/login')
    const bad = await fetch(`${base}/login`, { method: 'POST', redirect: 'manual', body: new URLSearchParams({ name: 'Sahip', password: 'yanlış' }) })
    expect(bad.status).toBe(401)
  })

  it('arayüz dosyaları oturumla sunulur', async () => {
    const r = await fetch(base + '/', { headers: { Cookie: viewerCookie } })
    expect(r.status).toBe(200)
    expect(await r.text()).toContain('<title>AF</title>')
  })

  it('işlem çağrısı rol ile denetlenir ve çağıranı bilir', async () => {
    const ok = await (await callApi(editorCookie, 'run:start', ['p1', undefined])).json()
    expect(ok).toMatchObject({ ok: true, value: { channel: 'run:start', n: 2, second: 'undefined' } })
    expect(seen.at(-1)).toMatchObject({ channel: 'run:start', role: 'editor', client: 'sekme1' })

    const denied = await (await callApi(viewerCookie, 'run:start', ['p1'])).json()
    expect(denied.ok).toBe(false)
    expect(denied.error).toMatch(/yetkin yok/)
    expect((await (await callApi(editorCookie, 'settings:set', [{}])).json()).ok).toBe(false)
    expect((await (await callApi(ownerCookie, 'settings:set', [{}])).json()).ok).toBe(true)
    // Bu bilgisayarın dosya seçicisi sahip için bile tarayıcıdan açılmaz
    const host = await (await callApi(ownerCookie, 'dialog:pickFiles', [[]])).json()
    expect(host.error).toMatch(/çalıştığı bilgisayarda/)
    // Başlıksız istek (başka siteden form) reddedilir
    const csrf = await fetch(`${base}/api/call/run:start`, { method: 'POST', headers: { Cookie: editorCookie }, body: '{}' })
    expect(csrf.status).toBe(403)
  })

  it('editör proje klasörü dışındaki dosyayı okutamaz', async () => {
    const outside = await (await callApi(editorCookie, 'assets:import', [path.join(os.tmpdir(), 'baska-yer', 'gizli.csv')])).json()
    expect(outside.ok).toBe(false)
    expect(outside.error).toMatch(/Proje klasörü dışındaki/)
    const inside = await (await callApi(editorCookie, 'assets:import', [path.join(projectDir, 'uploads', 'liste.csv')])).json()
    expect(inside.ok).toBe(true)
  })

  it('olaylar akışla gelir; kurulum günlükleri yalnızca sahibe', async () => {
    const ctrl = new AbortController()
    const r = await fetch(`${base}/api/events?client=akış1`, { headers: { Cookie: editorCookie }, signal: ctrl.signal })
    expect(r.headers.get('content-type')).toMatch(/event-stream/)
    const reader = r.body!.getReader()
    const dec = new TextDecoder()
    let text = ''
    await new Promise((res) => setTimeout(res, 50))
    emit('comfy:log', 'gizli kurulum satırı')
    emit('job:update', { id: 'j1', status: 'running' })
    while (!text.includes('job:update')) text += dec.decode((await reader.read()).value)
    ctrl.abort()
    expect(text).toContain('"j1"')
    expect(text).not.toContain('gizli kurulum')
  })

  it('dosya yükleme ve okuma proje klasörüyle sınırlı', async () => {
    const bytes = Buffer.from('PNGVERI')
    const up = await (await fetch(`${base}/api/upload?name=ref.png`, { method: 'POST', headers: { Cookie: editorCookie, 'x-forge': '1' }, body: bytes })).json()
    expect(up.ok).toBe(true)
    expect(path.resolve(up.value).startsWith(path.join(projectDir, 'uploads'))).toBe(true)
    const got = await fetch(`${base}/files/${encodeURIComponent(up.value)}`, { headers: { Cookie: viewerCookie } })
    expect(Buffer.from(await got.arrayBuffer()).toString()).toBe('PNGVERI')
    const partial = await fetch(`${base}/files/${encodeURIComponent(up.value)}`, { headers: { Cookie: viewerCookie, Range: 'bytes=0-2' } })
    expect(partial.status).toBe(206)
    expect(await partial.text()).toBe('PNG')

    const viewerUp = await fetch(`${base}/api/upload?name=x.png`, { method: 'POST', headers: { Cookie: viewerCookie, 'x-forge': '1' }, body: bytes })
    expect(viewerUp.status).toBe(403)
    const outside = await fetch(`${base}/files/${encodeURIComponent(accessFile)}`, { headers: { Cookie: ownerCookie } })
    expect(outside.status).toBe(403)
  })

  it('tanılama yalnızca sahibe; çıkış oturumu kapatır', async () => {
    expect((await fetch(`${base}/api/diag`, { headers: { Cookie: editorCookie } })).status).toBe(403)
    expect(await (await fetch(`${base}/api/diag`, { headers: { Cookie: ownerCookie } })).text()).toBe('tanı')
    await fetch(`${base}/logout`, { headers: { Cookie: viewerCookie }, redirect: 'manual' })
    expect((await callApi(viewerCookie, 'project:load', [])).status).toBe(401)
  })
})
