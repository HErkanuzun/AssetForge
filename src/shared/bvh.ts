// SPDX-License-Identifier: AGPL-3.0-only
// BVH okuyucu ve ileri kinematik: eklem dönüşlerinden her karedeki dünya konumlarını hesaplar.
// Kalite kontrolü (ayak kayması, zemine girme, titreme) ve önizleme için kullanılır. Bağımlılık yok.

export interface BvhJoint {
  name: string
  parent: number
  offset: [number, number, number]
  channels: string[]
  /** Kanalların kare satırındaki başlangıç sütunu */
  start: number
  /** End Site (uç nokta) mı */
  end: boolean
}

export interface Bvh {
  joints: BvhJoint[]
  frames: number
  frameTime: number
  /** [kare][kanal] */
  data: Float64Array[]
}

export function parseBvh(text: string): Bvh {
  const tokens = text.split(/\s+/).filter(Boolean)
  let i = 0
  const next = () => tokens[i++]
  const num = () => {
    const v = Number(next())
    if (!Number.isFinite(v)) throw new Error(`BVH: sayı bekleniyordu (${tokens[i - 1]})`)
    return v
  }
  if (next() !== 'HIERARCHY') throw new Error('BVH: HIERARCHY ile başlamıyor')
  const joints: BvhJoint[] = []
  const stack: number[] = []
  let col = 0
  while (i < tokens.length) {
    const t = next()
    if (t === 'ROOT' || t === 'JOINT' || t === 'End') {
      const end = t === 'End'
      const name = end ? `${joints[stack[stack.length - 1]]?.name ?? 'root'}_end` : next()
      if (end) next() // "Site"
      if (next() !== '{') throw new Error(`BVH: ${name} için { bekleniyordu`)
      joints.push({ name, parent: stack.length ? stack[stack.length - 1] : -1, offset: [0, 0, 0], channels: [], start: col, end })
      stack.push(joints.length - 1)
    } else if (t === 'OFFSET') {
      joints[stack[stack.length - 1]].offset = [num(), num(), num()]
    } else if (t === 'CHANNELS') {
      const j = joints[stack[stack.length - 1]]
      const n = num()
      j.start = col
      for (let k = 0; k < n; k++) j.channels.push(next())
      col += n
    } else if (t === '}') {
      stack.pop()
    } else if (t === 'MOTION') {
      break
    } else {
      throw new Error(`BVH: beklenmeyen "${t}"`)
    }
  }
  if (next() !== 'Frames:') throw new Error('BVH: "Frames:" yok')
  const frames = num()
  if (next() !== 'Frame' || next() !== 'Time:') throw new Error('BVH: "Frame Time:" yok')
  const frameTime = num()
  const data: Float64Array[] = []
  for (let f = 0; f < frames; f++) {
    const row = new Float64Array(col)
    for (let c = 0; c < col; c++) row[c] = num()
    data.push(row)
  }
  return { joints, frames, frameTime, data }
}

type Mat3 = number[] // satır öncelikli 3×3

const mul = (a: Mat3, b: Mat3): Mat3 => {
  const r: number[] = Array.from({ length: 9 }, () => 0)
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) r[y * 3 + x] = a[y * 3] * b[x] + a[y * 3 + 1] * b[3 + x] + a[y * 3 + 2] * b[6 + x]
  return r
}

function axisRot(axis: string, deg: number): Mat3 {
  const a = (deg * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  if (axis === 'X') return [1, 0, 0, 0, c, -s, 0, s, c]
  if (axis === 'Y') return [c, 0, s, 0, 1, 0, -s, 0, c]
  return [c, -s, 0, s, c, 0, 0, 0, 1]
}

/**
 * Her karede her eklemin dünya konumu: [kare][eklem] = [x, y, z] (dosya birimlerinde).
 * Dönüş kanalları yazıldıkları sırayla çarpılır (BVH kuralı). Konum kanalı olan eklemde
 * kanal değerleri OFFSET'in yerine geçer (Kimodo ve çoğu dışa aktarıcı böyle yazar).
 */
export function forwardKinematics(bvh: Bvh): [number, number, number][][] {
  const out: [number, number, number][][] = []
  const n = bvh.joints.length
  for (const row of bvh.data) {
    const rot: Mat3[] = Array.from({ length: n })
    const pos: [number, number, number][] = Array.from({ length: n })
    for (let j = 0; j < n; j++) {
      const jt = bvh.joints[j]
      let local: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]
      const t: [number, number, number] = [...jt.offset]
      jt.channels.forEach((ch, k) => {
        const v = row[jt.start + k]
        const axis = ch[0].toUpperCase()
        if (/position$/i.test(ch)) t['XYZ'.indexOf(axis)] = v
        else local = mul(local, axisRot(axis, v))
      })
      if (jt.parent < 0) {
        rot[j] = local
        pos[j] = t
      } else {
        const pr = rot[jt.parent]
        const pp = pos[jt.parent]
        pos[j] = [pp[0] + pr[0] * t[0] + pr[1] * t[1] + pr[2] * t[2], pp[1] + pr[3] * t[0] + pr[4] * t[1] + pr[5] * t[2], pp[2] + pr[6] * t[0] + pr[7] * t[1] + pr[8] * t[2]]
        rot[j] = mul(pr, local)
      }
    }
    out.push(pos)
  }
  return out
}

/** Ayak eklemleri: [ayak bileği, parmak kökü] sol ve sağ için (Kimodo SOMA, Mixamo, UE Manny adları) */
export function findFeet(joints: BvhJoint[]): { left: { ankle: number; toe: number }; right: { ankle: number; toe: number } } | null {
  const pick = (side: 'l' | 'r', part: 'ankle' | 'toe') => {
    const sideRe = side === 'l' ? /(^|[^a-z])(left|l)([^a-z]|$)|^left|left/i : /(^|[^a-z])(right|r)([^a-z]|$)|^right|right/i
    const partRe = part === 'ankle' ? /(foot|ankle)(?!.*(toe|ball|end))/i : /(toe|ball)(?!.*end)/i
    return joints.findIndex((j) => !j.end && sideRe.test(j.name) && partRe.test(j.name) && !/end$/i.test(j.name))
  }
  const l = { ankle: pick('l', 'ankle'), toe: pick('l', 'toe') }
  const r = { ankle: pick('r', 'ankle'), toe: pick('r', 'toe') }
  if (l.ankle < 0 || r.ankle < 0) return null
  // Parmak yoksa bilekle ölç
  if (l.toe < 0) l.toe = l.ankle
  if (r.toe < 0) r.toe = r.ankle
  return { left: l, right: r }
}
