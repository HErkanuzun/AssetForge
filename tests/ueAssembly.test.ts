// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { doorBones, physicsBoxes, soundSlot, templateOrder, type Assembly } from '../src/main/engine/ueAssembly'
import { findPythonTool, parseToolsets } from '../src/main/integrations/ue'
import { suggestPipeline } from '../src/shared/templates'
import type { AssetSpec } from '../src/shared/types'

describe('kit sesi → araç ses yuvası', () => {
  it.each([
    ['door_open', '', 'door_open'],
    ['door_close', '', 'door_close'],
    ['door slam', '', 'door_close'],
    ['sfx', 'Kapı açılma sesi', 'door_open'],
    ['sfx', 'Kapı kapanma sesi', 'door_close'],
    ['trunk_open', '', 'trunk_open'],
    ['sfx', 'Bagaj kapanışı', 'trunk_close'],
    ['hood_close', '', 'hood_close'],
    ['horn', '', 'horn'],
    ['sfx', 'Korna', 'horn'],
    ['engine_loop', '', 'engine'],
    ['engine_start', '', 'engine_start'],
    ['engine_stop', '', 'engine_stop'],
    ['ignition', 'Motor marşı', 'engine_start'],
    ['sfx', 'Motor rölanti', 'engine'],
    ['dust_sand', 'Kum tozu', null],
    ['impact_metal', 'Çarpışma', null],
    ['skid_asphalt', 'Lastik sürtünmesi', null]
  ])('%s / %s → %s', (role, name, slot) => {
    expect(soundSlot(role, name)).toBe(slot)
  })
})

const asm: Assembly = {
  mesh: 'x.fbx',
  dims: [4.2, 1.8, 1.4],
  clips: [],
  parts: [
    { name: 'wheel_fl', role: 'wheel', min: [1.2, 0.6, 0], max: [1.8, 0.9, 0.66] },
    { name: 'wheel_rr', role: 'wheel', min: [-1.8, -0.9, 0], max: [-1.2, -0.6, 0.66] },
    { name: 'door_fl', role: 'door', min: [0, 0.8, 0.3], max: [1, 0.9, 1.1] },
    { name: 'trunk', role: 'trunk', min: [-2, -0.7, 0.8], max: [-1.5, 0.7, 1] },
    { name: 'steering', role: 'steering_wheel', min: [0, 0, 0], max: [0.1, 0.1, 0.1] }
  ]
}

describe('araç kurulumu', () => {
  it('kapı kemiklerini seçer (en fazla 4)', () => {
    expect(doorBones(asm)).toEqual(['door_fl', 'trunk'])
    const many = { ...asm, parts: Array.from({ length: 6 }, (_, i) => ({ name: `door_${i}`, role: 'door', min: [0, 0, 0], max: [1, 1, 1] })) }
    expect(doorBones(many)).toHaveLength(4)
  })

  it('fizik kutuları cm cinsinden ve gövdenin içinde', () => {
    const [chassis, cabin] = physicsBoxes(asm)
    expect(chassis.min.x).toBeCloseTo(-206)
    expect(chassis.max.y).toBeCloseTo(86)
    expect(chassis.min.z).toBeCloseTo(16.5) // tekerlek yarıçapı 33 cm'nin yarısı
    expect(cabin.max.z).toBeCloseTo(137)
    for (const b of [chassis, cabin]) {
      expect(b.isValid).toBe(true)
      expect(b.max.x).toBeGreaterThan(b.min.x)
      expect(b.max.z).toBeGreaterThan(b.min.z)
    }
  })

  it('şablonu araç türüne göre sıralar', () => {
    const a = (description: string) => ({ name: 'Araç', description, subcategory: '' }) as AssetSpec
    expect(templateOrder(a('kırmızı sedan'), 4)[0]).toMatch(/SportsCar/)
    expect(templateOrder(a('çamurlu arazi aracı, 4x4'), 4)[0]).toMatch(/OffroadCar/)
    expect(templateOrder(a('askeri kamyon'), 6)[0]).toMatch(/Truck6x6/)
  })

  it('araçlar rigli hatta yönlenir', () => {
    expect(suggestPipeline({ kind: 'vehicle' })).toBe('tpl_vehicle_rig')
  })
})

describe('Unreal MCP keşfi', () => {
  it('araç seti listesini okur', () => {
    const t = '- ToolsetRegistry.AgentSkillToolset: Provides tools.\n- KirilmaVehiclesEditor.KVVehicleToolset: Vehicle tools\n  devam satırı\nbaşka metin'
    expect(parseToolsets(t).map((x) => x.name)).toEqual(['ToolsetRegistry.AgentSkillToolset', 'KirilmaVehiclesEditor.KVVehicleToolset'])
  })

  it('Python aracını ve kod parametresini bulur', () => {
    expect(findPythonTool('Tools:\n- ExecutePython(code: string): runs python')).toEqual({ tool: 'ExecutePython', arg: 'code' })
    expect(findPythonTool('{"name": "run_python_script", "inputSchema": {"properties": {"script": {"type": "string"}}}}')).toEqual({ tool: 'run_python_script', arg: 'script' })
    expect(findPythonTool('- CreateVehicleAnimBlueprint(mesh, assetPath)')).toBeNull()
  })
})
