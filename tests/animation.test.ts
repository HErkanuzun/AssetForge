// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { ANIM_SYSTEMS, newAnimSystem, productionPhases, sampleFor, stylePrompt, wrap } from '../src/shared/animSystems'
import { buildKimodoRequest, buildPath, framesFor, generationSeconds, type KimodoSpec } from '../src/main/anim/motion'

const spec = (o: Partial<KimodoSpec>): KimodoSpec => ({ role: 'loop', loop: true, seconds: 1.2, speed: 0, moveDir: 0, turn: 0, constrainPath: true, ...o })

const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1])

describe('açı yardımcıları', () => {
  it.each([
    [0, 0],
    [190, -170],
    [-190, 170],
    [360, 0],
    [540, -180],
    [-45, -45]
  ])('wrap(%d) = %d', (a, b) => {
    expect(wrap(a)).toBe(b)
  })
})

describe('stylePrompt', () => {
  it('stil öznesini yerleştirir', () => {
    expect(stylePrompt('{S} walks forward.', 'tired soldier')).toBe('A tired soldier walks forward.')
    expect(stylePrompt('{S} runs.', 'The knight.')).toBe('The knight runs.')
    expect(stylePrompt('{S} idles.', '')).toBe('A person idles.')
  })
})

describe('animasyon sistemleri kataloğu', () => {
  it.each(ANIM_SYSTEMS.map((s) => [s.kind, s] as const))('%s: klipler tutarlı', (kind, info) => {
    const sys = newAnimSystem(kind, 'KAR001')
    expect(sys.clips.length).toBeGreaterThan(0)
    const keys = sys.clips.map((c) => c.key)
    expect(new Set(keys).size, 'klip anahtarları benzersiz').toBe(keys.length)
    for (const c of sys.clips) {
      // Poz eşleme kaynakları sistemde var olan klipler olmalı
      if (c.from) expect(keys, `${c.key}.from`).toContain(c.from)
      if (c.to) expect(keys, `${c.key}.to`).toContain(c.to)
      expect(c.seconds).toBeGreaterThan(0)
      expect(c.prompt).toContain('{S}')
    }
    if (info.axes) expect(sys.axes).toEqual(info.axes)
  })

  it('her sistem bağımsız kopya oluşturur', () => {
    const a = newAnimSystem('blendspace2d', 'X')
    a.clips[0].seconds = 99
    expect(newAnimSystem('blendspace2d', 'X').clips[0].seconds).not.toBe(99)
  })
})

describe('productionPhases', () => {
  it.each(ANIM_SYSTEMS.map((s) => [s.kind] as const))('%s: bağımlı klipler kaynaklarından sonra üretilir', (kind) => {
    const sys = newAnimSystem(kind, 'X')
    const phases = productionPhases(sys)
    const phaseOf = new Map<string, number>()
    phases.forEach((ph, i) => ph.forEach((c) => phaseOf.set(c.key, i)))
    expect(phaseOf.size).toBe(sys.clips.filter((c) => c.enabled).length)
    for (const c of sys.clips) {
      for (const dep of [c.from, c.to]) {
        if (dep && dep !== c.key) expect(phaseOf.get(dep)!, `${c.key} ← ${dep}`).toBeLessThan(phaseOf.get(c.key)!)
      }
    }
  })

  it('kapalı klipleri atlar', () => {
    const sys = newAnimSystem('blendspace1d', 'X')
    sys.clips[0].enabled = false
    expect(productionPhases(sys).flat()).not.toContainEqual(sys.clips[0])
  })
})

describe('sampleFor', () => {
  it('Blend Space 2D: yön ve cm/sn hız', () => {
    const sys = newAnimSystem('blendspace2d', 'X')
    const fwd = sys.clips.find((c) => c.moveDir === 0 && c.speed > 0)!
    expect(sampleFor(sys, fwd)).toEqual({ x: 0, y: Math.round(fwd.speed * 100) })
    const idle = sys.clips.find((c) => c.role === 'idle')!
    expect(sampleFor(sys, idle)).toEqual({ x: 0, y: 0 })
  })

  it('ölçülen yön yakınsa ölçümü kullanır, uzaksa planı korur', () => {
    const sys = newAnimSystem('blendspace2d', 'X')
    const right = sys.clips.find((c) => c.moveDir === 90)!
    expect(sampleFor(sys, right, { speed: 1, direction: 84, displacementSpeed: 1.4 }).x).toBe(84)
    expect(sampleFor(sys, right, { speed: 1, direction: 10, displacementSpeed: 1.4 }).x).toBe(90)
  })

  it('döngülerde yer değiştirme hızını kullanır', () => {
    const sys = newAnimSystem('blendspace1d', 'X')
    const loop = sys.clips.find((c) => c.loop && c.speed > 0)!
    expect(sampleFor(sys, loop, { speed: 9, direction: 0, displacementSpeed: 1.37 }).x).toBe(137)
  })
})

describe('Kimodo kök yolu', () => {
  it('kare sayısı en az 8', () => {
    expect(framesFor(0.1)).toBe(8)
    expect(framesFor(2)).toBe(60)
  })

  it('döngüler temiz pencere için daha uzun üretilir', () => {
    expect(generationSeconds(spec({ seconds: 1.2 }))).toBeGreaterThan(1.2 * 2)
    expect(generationSeconds(spec({ role: 'idle', seconds: 3 }))).toBeGreaterThanOrEqual(5)
    expect(generationSeconds(spec({ role: 'action', loop: false, seconds: 30 }))).toBe(10)
  })

  it('ileri yürüyüş +Z yönünde, sabit hıza oturur', () => {
    const p = buildPath(spec({ speed: 1.5 }), 4)
    const fps = 30
    expect(p.points[0]).toEqual([0, 0])
    expect(Math.abs(p.end.x)).toBeLessThan(1e-3)
    expect(p.end.z).toBeGreaterThan(0)
    // Hızlanma bittikten sonra kare başına mesafe 1.5 m/sn'ye denk
    const step = dist(p.points[90], p.points[91]) * fps
    expect(step).toBeCloseTo(1.5, 2)
  })

  it('sağa yürüyüş Kimodo’da -X yönünde', () => {
    const p = buildPath(spec({ speed: 1.5, moveDir: 90 }), 3)
    expect(p.end.x).toBeLessThan(-1)
    expect(Math.abs(p.end.z)).toBeLessThan(1e-3)
  })

  it('yerinde dönüş: yer değiştirmez, hedef açıya varır', () => {
    const p = buildPath(spec({ role: 'turn', loop: false, turn: 90 }), 1.4)
    expect(dist(p.points[0], [p.end.x, p.end.z])).toBe(0)
    expect(p.end.heading).toBeCloseTo(90, 0)
  })

  it('duruş: sonda hız sıfır', () => {
    const p = buildPath(spec({ role: 'stop', loop: false, speed: 3.2, speedEnd: 0 }), 1.5)
    const n = p.points.length
    expect(dist(p.points[n - 2], p.points[n - 1])).toBeLessThan(1e-3)
  })

  it('pivot 180° döner', () => {
    const p = buildPath(spec({ role: 'pivot', loop: false, speed: 1.5, speedEnd: 1.5, turn: 180 }), 1.6)
    expect(p.end.heading).toBeCloseTo(180, 0)
  })

  it('istek: döngüde poz kısıtı yok, yol kısıtı var', () => {
    const pose = { local_joints_rot: [[0, 0, 0]], root_y: 0.9, root_idx: 0 }
    const req = buildKimodoRequest(spec({ speed: 1.5 }), ['walk'], [1.2], { from: pose, to: pose })
    expect(req.loop).toBe(true)
    expect(req.loop_min).toBeLessThan(req.loop_max!)
    expect(req.constraints.map((c) => c.type)).toEqual(['path'])
  })

  it('istek: tek seferlik klipte uç pozlar eşlenir, son poz yolun sonunda', () => {
    const pose = { local_joints_rot: [[0, 0, 0]], root_y: 0.9, root_idx: 0 }
    const s = spec({ role: 'stop', loop: false, speed: 1.5, speedEnd: 0, seconds: 1.4 })
    const req = buildKimodoRequest(s, ['stop'], [1.4], { from: pose, to: pose })
    const poses = req.constraints.filter((c) => c.type === 'pose')
    expect(poses.map((c) => c.frame)).toEqual([0, -1])
    const path = buildPath(s, generationSeconds(s))
    expect(poses[1]).toMatchObject({ x: path.end.x, z: path.end.z })
  })

  it('çok parçalı istekte süreler toplanır', () => {
    const req = buildKimodoRequest(spec({ role: 'action', loop: false, constrainPath: false }), ['a', 'b'], [1, 2], {})
    expect(req.durations).toEqual([1, 2])
    expect(req.constraints).toEqual([])
  })
})
