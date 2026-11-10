// SPDX-License-Identifier: AGPL-3.0-only
// Montajı yapılmış (rig.assembly) modeli Unreal'da kurar: iskeletli mesh + ezilme hedefleri + klipler,
// kit sesleri (motor MetaSound'u dahil), fizik asset'i, araç Anim BP'si ve şablondan araç Blueprint'i.
import fs from 'node:fs'
import path from 'node:path'
import type { Artifact, AssetSpec, DynamicSoundSpec, Job } from '../../shared/types'
import { runInUe, ueFindToolset, ueTool } from '../integrations/ue'
import { listJobs, loadProject } from '../project'
import { resourcePath } from '../util'

/** Unreal araç Blueprint'inin bildiği ses yuvaları */
export type SoundSlot = 'engine' | 'engine_start' | 'engine_stop' | 'horn' | 'door_open' | 'door_close' | 'trunk_open' | 'trunk_close' | 'hood_open' | 'hood_close'

/** Kit üyesinin rol etiketi + adından ses yuvası çıkarır (ör. "door open" / "Kapı kapanma sesi") */
export function soundSlot(role: string, name = ''): SoundSlot | null {
  const t = ` ${role} ${name} `.toLocaleLowerCase('tr').replace(/[_\-/.,()]+/g, ' ')
  const has = (...w: string[]) => w.some((x) => t.includes(x))
  const close = has('close', 'shut', 'slam', 'kapan', 'kapat')
  if (has('door', 'kapı', 'kapi ')) return close ? 'door_close' : 'door_open'
  if (has('trunk', ' boot', 'tailgate', 'bagaj')) return close ? 'trunk_close' : 'trunk_open'
  if (has('hood', 'bonnet', 'kaput')) return close ? 'hood_close' : 'hood_open'
  if (has('horn', 'korna')) return 'horn'
  const engine = has('engine', 'motor')
  if (has('start', 'ignition', 'crank', 'marş', 'mars ', 'çalıştır', 'calistir')) return 'engine_start'
  if (engine && (has('stop', 'shutdown', 'shut off', 'turn off', 'durma', 'sus') || close)) return 'engine_stop'
  if (engine || has('rpm', 'idle loop', 'rölanti', 'rolanti')) return 'engine'
  return null
}

export interface KitSounds {
  /** yuva → wav dosyası */
  files: Partial<Record<SoundSlot, string>>
  /** Katmanlı motor sesi (audio.engine çıktısı) */
  engine?: { layers: { file: string; baseRpm: number }[]; dynamic: DynamicSoundSpec }
  /** İşi hâlâ süren kit üyeleri */
  pending: string[]
  /** Ses yuvasına uyan ama çıktısı olmayan kit üyeleri */
  missing: string[]
}

function lastOutputs(jobs: Job[], assetId: string): Artifact[] {
  const done = jobs.filter((j) => j.assetId === assetId && j.status === 'done').sort((a, b) => b.createdAt - a.createdAt)
  for (const j of done) {
    const arts = Object.values(j.nodes).flatMap((n) => Object.values(n.outputs ?? {}))
    if (arts.length) return arts
  }
  return []
}

/** Ana asset'in kitindeki seslerin son iş çıktılarını toplar */
export function collectKitSounds(projectDir: string, parentId: string): KitSounds {
  const kit = loadProject(projectDir).assets.filter((a: AssetSpec) => a.parentId === parentId && a.role)
  const jobs = listJobs(projectDir, 500)
  const out: KitSounds = { files: {}, pending: [], missing: [] }
  for (const a of kit) {
    const slot = soundSlot(a.role!, a.name)
    if (!slot) continue
    if (jobs.some((j) => j.assetId === a.id && (j.status === 'running' || j.status === 'queued'))) {
      out.pending.push(a.name)
      continue
    }
    const arts = lastOutputs(jobs, a.id)
    const set = arts.find((x) => x.kind === 'audioset')
    if (slot === 'engine' && set?.kind === 'audioset') {
      out.engine = { layers: set.layers.map((l) => ({ file: l.file, baseRpm: l.baseRpm })), dynamic: set.dynamic }
      continue
    }
    const au = arts.find((x) => x.kind === 'audio')
    const file = au?.kind === 'audio' ? au.files.find((f) => fs.existsSync(f)) : undefined
    if (file && !out.files[slot]) out.files[slot] = file
    else if (!file) out.missing.push(a.name)
  }
  return out
}

interface AsmPart {
  name: string
  role: string
  min: number[]
  max: number[]
}
export interface Assembly {
  mesh: string
  dims: number[]
  parts: AsmPart[]
  clips: { name: string; file: string; seconds: number; loop: boolean }[]
  kind?: string
}

const OPENABLE = /door|hood|bonnet|trunk|boot|lid|hatch|tailgate/

/** Araç Anim BP'sinin döndüreceği kapı kemikleri (en fazla 4) */
export function doorBones(asm: Assembly): string[] {
  return asm.parts
    .filter((p) => OPENABLE.test(p.role) || OPENABLE.test(p.name))
    .map((p) => p.name)
    .slice(0, 4)
}

/** Gövde için iki kutu (cm, UE ekseni): alt şasi + kabin. Tekerlekler Chaos tekerleğiyle çözülür. */
export function physicsBoxes(asm: Assembly): { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number }; isValid: boolean }[] {
  const [L, W, H] = asm.dims.map((d) => d * 100)
  const wheels = asm.parts.filter((p) => p.role === 'wheel')
  const wr = wheels.length ? Math.max(...wheels.map((p) => ((p.max[2] - p.min[2]) / 2) * 100)) : H * 0.18
  const box = (mn: number[], mx: number[]) => ({ min: { x: mn[0], y: mn[1], z: mn[2] }, max: { x: mx[0], y: mx[1], z: mx[2] }, isValid: true })
  return [box([-L / 2 + 4, -W / 2 + 4, wr * 0.5], [L / 2 - 4, W / 2 - 4, H * 0.62]), box([-L * 0.25, -W / 2 + 12, H * 0.55], [L * 0.2, W / 2 - 12, H - 3])]
}

const TEMPLATES = {
  sports: '/Game/Vehicles/KirilmaVehicles/Blueprints/BP_KV_SportsCar',
  offroad: '/Game/Vehicles/KirilmaVehicles/Blueprints/BP_KV_OffroadCar',
  truck: '/Game/Vehicles/Truck6x6/Blueprints/BP_KV_Truck6x6'
}

/** Varlık açıklamasına ve tekerlek sayısına göre şablon sırası */
export function templateOrder(asset: AssetSpec, wheelCount: number): string[] {
  const t = `${asset.name} ${asset.description} ${asset.subcategory}`.toLocaleLowerCase('tr')
  if (wheelCount > 4 || /truck|kamyon|tır|6x6/.test(t)) return [TEMPLATES.truck, TEMPLATES.offroad, TEMPLATES.sports]
  if (/off.?road|arazi|jeep|pickup|kamyonet|suv|4x4/.test(t)) return [TEMPLATES.offroad, TEMPLATES.sports, TEMPLATES.truck]
  return [TEMPLATES.sports, TEMPLATES.offroad, TEMPLATES.truck]
}

export interface UeAssemblyCtx {
  asset: AssetSpec
  projectDir: string
  signal: AbortSignal
  log: (m: string) => void
  warn: (m: string) => void
}

function script(file: string, manifest: Record<string, unknown>, varName = 'MANIFEST'): string {
  const b64 = Buffer.from(JSON.stringify(manifest), 'utf8').toString('base64')
  return `import base64, json\n${varName} = json.loads(base64.b64decode("${b64}").decode("utf-8"))\n` + fs.readFileSync(resourcePath('python', file), 'utf8')
}

async function py(file: string, manifest: Record<string, unknown>, what: string): Promise<Record<string, unknown>> {
  const r = await runInUe(script(file, manifest))
  const line = r.output.split('\n').find((l) => l.startsWith('FORGE_RESULT '))
  if (!line) throw new Error(`${what}: Unreal'dan sonuç gelmedi ${r.result || r.output.slice(-400)}`)
  return JSON.parse(line.slice(13)) as Record<string, unknown>
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms)
    signal.addEventListener('abort', () => (clearTimeout(t), rej(new Error('İptal edildi'))), { once: true })
  })

/**
 * Montajlı modeli Unreal'a kurar. exportDir'e dosyaların kopyasını bırakır.
 * Dönen: oluşturulan Blueprint yolu (araç değilse ya da şablon yoksa boş).
 */
export async function exportAssemblyToUe(
  ctx: UeAssemblyCtx,
  o: { assemblyFile: string; exportDir: string; dest: string; name: string; template: string; kitWaitMin: number }
): Promise<{ blueprint: string; mesh: string; notes: string[] }> {
  const asm = JSON.parse(fs.readFileSync(o.assemblyFile, 'utf8')) as Assembly
  const notes: string[] = []
  const copy = (f: string) => {
    const d = path.join(o.exportDir, path.basename(f))
    if (path.resolve(f) !== path.resolve(d)) fs.copyFileSync(f, d)
    return d
  }
  const meshFbx = copy(asm.mesh)
  const clips = asm.clips.filter((c) => fs.existsSync(c.file)).map((c) => ({ ...c, file: copy(c.file) }))
  const asmUe = { ...asm, mesh: meshFbx, clips }

  // 1) Kit sesleri: işi süren ses varsa bir süre bekle
  let kit = collectKitSounds(ctx.projectDir, ctx.asset.id)
  const until = Date.now() + Math.max(0, o.kitWaitMin) * 60_000
  while (kit.pending.length && Date.now() < until) {
    ctx.log(`Kit sesleri bekleniyor: ${kit.pending.join(', ')}`)
    await sleep(15_000, ctx.signal)
    kit = collectKitSounds(ctx.projectDir, ctx.asset.id)
  }
  if (kit.pending.length) ctx.warn(`Bitmemiş kit sesleri atlandı: ${kit.pending.join(', ')} (bitince Export'u yeniden çalıştırın)`)
  if (kit.missing.length) ctx.warn(`Çıktısı olmayan kit sesleri: ${kit.missing.join(', ')}`)
  const sounds: Record<string, string> = {}
  for (const [slot, f] of Object.entries(kit.files)) sounds[slot] = copy(f)

  // 2) Katmanlı motor sesi → MetaSound (RPM + Throttle + RPMAlpha)
  if (kit.engine) {
    const msName = `MS_${o.name}_Engine`
    const layers = kit.engine.layers.map((l, i) => ({ file: copy(l.file), name: `SW_${o.name}_Engine_L${i}`, base_rpm: l.baseRpm }))
    const r = await runInUe(
      script('ue_import.py', {
        master_material: '',
        items: [{ type: 'dynamic_sound', name: msName, dest: `${o.dest}/Audio`, file: '', layers, inputs: { idle: kit.engine.dynamic.idleRpm, max: kit.engine.dynamic.maxRpm } }]
      })
    )
    if (!r.success) ctx.warn(`Motor MetaSound'u kurulamadı: ${r.result || r.output.slice(-300)}`)
    else {
      sounds.engine = `${o.dest}/Audio/${msName}`
      notes.push(`motor sesi: ${msName} (${layers.length} katman)`)
    }
  }

  // 3) İskeletli mesh, klipler, sesler
  ctx.log('Unreal: iskeletli mesh, ezilme hedefleri, klipler ve sesler içe aktarılıyor')
  const base = { dest: o.dest, name: o.name, assembly: asmUe, mesh_fbx: meshFbx, sounds }
  const imp = await py('ue_vehicle.py', { ...base, step: 'import' }, 'İçe aktarma')
  for (const e of (imp.errors as string[]) ?? []) ctx.warn(`Unreal: ${e}`)
  const mesh = String(imp.mesh ?? '')
  if (!mesh) throw new Error('Unreal iskeletli mesh oluşturmadı')
  notes.push(...((imp.notes as string[]) ?? []))
  const soundsUe = (imp.sounds as Record<string, string>) ?? {}

  const wheels = asm.parts.filter((p) => p.role === 'wheel')
  const isVehicle = ctx.asset.kind === 'vehicle' && wheels.length >= 3
  if (!isVehicle) {
    notes.push('araç değil: iskeletli mesh + klipler kuruldu (Blueprint kurulmadı)')
    return { blueprint: '', mesh, notes }
  }

  // 4) Fizik asset'i ve araç Anim BP'si (projedeki araç araç setiyle). Editörü yormamak için tek tek.
  let physicsAsset = ''
  let animBp = ''
  try {
    const ts = await ueFindToolset('CreateVehiclePhysicsAsset')
    if (!ts) ctx.warn('Unreal’da CreateVehiclePhysicsAsset aracı yok: fizik asset’i ve Anim BP elle kurulmalı')
    else {
      physicsAsset = `${o.dest}/PA_${o.name}`
      await ueTool(ts, 'CreateVehiclePhysicsAsset', { mesh: { refPath: mesh }, assetPath: physicsAsset, boneName: 'root', boxes: physicsBoxes(asm) })
      await py('ue_save.py', { paths: [physicsAsset] }, 'Kaydetme').catch(() => undefined)
      animBp = `${o.dest}/ABP_${o.name}`
      await ueTool(ts, 'CreateVehicleAnimBlueprint', { mesh: { refPath: mesh }, assetPath: animBp, doorBones: doorBones(asm) })
      await py('ue_save.py', { paths: [animBp] }, 'Kaydetme').catch(() => undefined)
      notes.push(`fizik: PA_${o.name}, Anim BP: ABP_${o.name} (${doorBones(asm).length} açılır parça)`)
    }
  } catch (e) {
    ctx.warn(`Fizik / Anim BP kurulamadı: ${(e as Error).message}`)
  }

  // 5) Şablon araç Blueprint'i
  const candidates = o.template ? [o.template] : templateOrder(ctx.asset, wheels.length)
  const found = (await py('ue_exists.py', { paths: candidates }, 'Şablon arama').catch(() => ({ exists: [] }))) as { exists?: string[] }
  const template = candidates.find((c) => found.exists?.includes(c))
  if (!template) {
    ctx.warn(`Araç şablonu bulunamadı (${candidates.join(', ')}). Mesh, fizik ve Anim BP hazır; Blueprint için Export → “Araç şablonu” alanına bir AWheeledVehiclePawn Blueprint’i yazın.`)
    return { blueprint: '', mesh, notes }
  }
  ctx.log(`Unreal: ${template.split('/').pop()} şablonundan araç Blueprint’i kuruluyor`)
  const res = await py('ue_vehicle.py', { ...base, step: 'assemble', mesh, template, physics_asset: physicsAsset, anim_bp: animBp, sounds_ue: soundsUe }, 'Araç kurulumu')
  for (const e of (res.errors as string[]) ?? []) ctx.warn(`Unreal: ${e}`)
  notes.push(...((res.notes as string[]) ?? []))
  return { blueprint: String(res.blueprint ?? ''), mesh, notes }
}
