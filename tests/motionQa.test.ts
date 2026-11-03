// SPDX-License-Identifier: AGPL-3.0-only
// Hareket kalite kontrolü. Eşikler NVIDIA Kimodo'nun 8 demo çıktısıyla ayarlandı (hepsi geçer;
// ayakları sürekli kayan yapay yürüyüş kalır). Buradaki testler yapay iskeletle çalışır.
import { describe, expect, it } from 'vitest'
import { findFeet, forwardKinematics, parseBvh } from '../src/shared/bvh'
import { judgeMotion, measureMotion } from '../src/shared/motionQa'

// Bacaklar düz: kalça 98 cm'de iken parmak kökü y = 0 (zeminde)
const leg = (side: 'Left' | 'Right', x: number) => `
  JOINT ${side}UpLeg
  {
    OFFSET ${x} 0 0
    CHANNELS 3 Zrotation Yrotation Xrotation
    JOINT ${side}Leg
    {
      OFFSET 0 -45 0
      CHANNELS 3 Zrotation Yrotation Xrotation
      JOINT ${side}Foot
      {
        OFFSET 0 -45 0
        CHANNELS 3 Zrotation Yrotation Xrotation
        JOINT ${side}ToeBase
        {
          OFFSET 0 -8 12
          CHANNELS 3 Zrotation Yrotation Xrotation
          End Site
          {
            OFFSET 0 0 5
          }
        }
      }
    }
  }`

/** frames: kare başına kalça [x, y, z] (cm); diğer dönüşler 0 */
function bvh(hips: [number, number, number][], scale = 1): string {
  const s = (v: number) => v * scale
  const head = `HIERARCHY
ROOT Hips
{
  OFFSET 0 0 0
  CHANNELS 6 Xposition Yposition Zposition Zrotation Yrotation Xrotation${leg('Left', s(10))}${leg('Right', s(-10))}
}
MOTION
Frames: ${hips.length}
Frame Time: 0.0333333
`.replace(/OFFSET ([-\d.]+) ([-\d.]+) ([-\d.]+)/g, (_m, a, b, c) => `OFFSET ${s(+a)} ${s(+b)} ${s(+c)}`)
  return head + hips.map(([x, y, z]) => [s(x), s(y), s(z), ...Array.from({ length: 3 + 4 * 3 * 2 }, () => 0)].join(' ')).join('\n') + '\n'
}

const frames = (n: number, f: (i: number) => [number, number, number]) => Array.from({ length: n }, (_, i) => f(i))
const standing = frames(60, () => [0, 98, 0])

describe('BVH', () => {
  it('hiyerarşiyi ve kareleri okur', () => {
    const b = parseBvh(bvh(standing))
    expect(b.frames).toBe(60)
    expect(b.frameTime).toBeCloseTo(1 / 30)
    expect(b.joints.filter((j) => !j.end).map((j) => j.name)).toEqual(['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'])
    expect(b.data[0].length).toBe(6 + 8 * 3)
  })

  it('ileri kinematik: konum kanalları OFFSET yerine geçer, dönüşler zincire uygulanır', () => {
    const p = forwardKinematics(parseBvh(bvh([[5, 98, -3]])))[0]
    const toe = parseBvh(bvh(standing)).joints.findIndex((j) => j.name === 'LeftToeBase')
    expect(p[toe][0]).toBeCloseTo(15)
    expect(p[toe][1]).toBeCloseTo(0)
    expect(p[toe][2]).toBeCloseTo(9)
    // Z ekseninde 90° dönen kök: (0, -45, 0) çocuğu +X'e döner
    const text = `HIERARCHY\nROOT A\n{\n OFFSET 0 0 0\n CHANNELS 6 Xposition Yposition Zposition Zrotation Yrotation Xrotation\n JOINT B\n {\n  OFFSET 0 -45 0\n  CHANNELS 3 Zrotation Yrotation Xrotation\n  End Site\n  {\n   OFFSET 0 -10 0\n  }\n }\n}\nMOTION\nFrames: 1\nFrame Time: 0.033\n0 100 0 90 0 0 0 0 0\n`
    const q = forwardKinematics(parseBvh(text))[0]
    expect(q[1][0]).toBeCloseTo(45)
    expect(q[1][1]).toBeCloseTo(100)
    expect(q[2][0]).toBeCloseTo(55)
  })

  it('ayakları farklı adlandırmalarda bulur', () => {
    const names = (list: string[]) => list.map((name, i) => ({ name, parent: i - 1, offset: [0, 0, 0] as [number, number, number], channels: [], start: 0, end: false }))
    expect(findFeet(names(['Hips', 'LeftFoot', 'LeftToeBase', 'LeftToeEnd', 'RightFoot', 'RightToeBase']))).toEqual({ left: { ankle: 1, toe: 2 }, right: { ankle: 4, toe: 5 } })
    expect(findFeet(names(['pelvis', 'foot_l', 'ball_l', 'foot_r', 'ball_r']))).toEqual({ left: { ankle: 1, toe: 2 }, right: { ankle: 3, toe: 4 } })
    expect(findFeet(names(['mixamorig:Hips', 'mixamorig:LeftFoot', 'mixamorig:RightFoot']))).toEqual({ left: { ankle: 1, toe: 1 }, right: { ankle: 2, toe: 2 } })
    expect(findFeet(names(['Hips', 'Spine']))).toBeNull()
  })

  it('bozuk dosyada açık hata', () => {
    expect(() => parseBvh('nope')).toThrow(/HIERARCHY/)
    expect(() => parseBvh(bvh(standing).replace('Frames: 60', 'Frames: 61'))).toThrow()
  })
})

describe('hareket ölçümü', () => {
  it('yerinde duran temiz klip: kayma, zemine girme, titreme yok', () => {
    const m = measureMotion(parseBvh(bvh(standing)))
    expect(m).toMatchObject({ frames: 60, fps: 30, footSkate: 0, penetration: 0, contactRatio: 1, jitter: 0, pop: 0 })
    expect(judgeMotion(m)).toMatchObject({ score: 10, pass: true, issues: [] })
  })

  it('metre ve santimetre aynı sonucu verir', () => {
    const slide = frames(60, (i) => [i * 2, 98, 0])
    const cm = measureMotion(parseBvh(bvh(slide)))
    const m = measureMotion(parseBvh(bvh(slide, 0.01)))
    expect(m.footSkate).toBeCloseTo(cm.footSkate, 2)
    expect(cm.footSkate).toBeCloseTo(0.6, 1)
  })

  it('ayakları yerde kayan klip kalır ve düzeltme önerir', () => {
    const m = measureMotion(parseBvh(bvh(frames(60, (i) => [i * (100 / 30), 98, 0]))))
    expect(m.footSkate).toBeCloseTo(1, 1)
    expect(m.skateRatio).toBe(1)
    const q = judgeMotion(m)
    expect(q.pass).toBe(false)
    expect(q.issues[0]).toMatch(/kayıyor/)
    expect(q.promptFix).toMatch(/planted/)
  })

  it('zemine giren ayak', () => {
    const m = measureMotion(parseBvh(bvh(frames(60, () => [0, 88, 0]))))
    expect(m.penetration).toBeCloseTo(0.1, 2)
    expect(judgeMotion(m).issues.join()).toMatch(/zeminin 10 cm altına/)
  })

  it('titreme ve tek karelik sıçrama', () => {
    const shaky = measureMotion(parseBvh(bvh(frames(60, (i) => [0, 98 + (i % 2 ? 1 : -1), 0]))))
    expect(shaky.jitter).toBeGreaterThan(1200)
    expect(judgeMotion(shaky).pass).toBe(false)
    const popped = measureMotion(parseBvh(bvh(frames(60, (i) => [i === 30 ? 30 : 0, 98, 0]))))
    expect(popped.pop).toBeCloseTo(0.3, 2)
    expect(judgeMotion(popped).issues.join()).toMatch(/ani sıçrama/)
  })

  it('akıcı ama hızlı hareket kopukluk sayılmaz', () => {
    // 3 m/sn'ye yumuşakça hızlanan kalça (kayan ayaklar ayrı ölçülür)
    const m = measureMotion(parseBvh(bvh(frames(60, (i) => [((300 / 30) * (i * i)) / 120, 98 + 20 * Math.sin(i / 5), 0]))))
    expect(m.pop).toBeLessThan(0.05)
  })
})

describe('hedeflere uyum', () => {
  const clean = measureMotion(parseBvh(bvh(standing)))
  it('hız, yön ve dönüş sapmaları puan düşürür ve düzeltme önerir', () => {
    const q = judgeMotion(clean, { speed: 3, measuredSpeed: 1.5, direction: 0, measuredDirection: 60, turn: 90, measuredTurn: 20 })
    expect(q.score).toBe(4)
    expect(q.pass).toBe(false)
    expect(q.promptFix).toMatch(/faster/)
    expect(q.promptFix).toMatch(/turns 90 degrees to the right/)
  })
  it('tolerans içindeki sapmalar geçer; yön açısı 360° sarmalanır', () => {
    expect(judgeMotion(clean, { speed: 1.4, measuredSpeed: 1.25, direction: 175, measuredDirection: -170, turn: 0, measuredTurn: 8 }).score).toBe(10)
  })
  it('yerinde durması gereken hareket ve döngü dikişi', () => {
    const jumping = { ...clean, contactRatio: 0.2 }
    expect(judgeMotion(jumping, { stationary: true }).issues.join()).toMatch(/Yerinde/)
    expect(judgeMotion(clean, { loopCost: 0.05 }).score).toBe(9)
  })
})
