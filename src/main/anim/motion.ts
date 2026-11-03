// SPDX-License-Identifier: AGPL-3.0-only
// Klip rolünden Kimodo isteği: kare kare kök yolu (hız/yön/dönüş) + poz eşleme kısıtları.
// Açı kuralı (AssetForge/Unreal): sağ = +. Kimodo dünyası: Y yukarı, metre, bakış 0 → +Z, sağ → -X.

import type { AnimClipRole } from '../../shared/types'

export const KIMODO_FPS = 30

export interface KimodoSpec {
  role: AnimClipRole
  loop: boolean
  seconds: number
  speed: number
  speedEnd?: number
  moveDir: number
  turn: number
  constrainPath: boolean
  /** Başlangıç pozu: bu asset'in son pozu */
  fromAssetId?: string
  /** Bitiş pozu: bu asset'in ilk pozu */
  toAssetId?: string
  seed?: number
  system?: string
  key?: string
}

export interface CanonicalPose {
  local_joints_rot: number[][]
  root_y: number
  root_idx: number
}

export interface KimodoGenRequest {
  texts: string[]
  durations: number[]
  loop: boolean
  loop_min?: number
  loop_max?: number
  loop_keep_turn?: boolean
  constraints: Record<string, unknown>[]
}

const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x))
  return t * t * (3 - 2 * t)
}
/** a..b aralığında 0→1 yumuşak geçiş */
const ramp = (u: number, a: number, b: number) => (b <= a ? (u >= b ? 1 : 0) : smooth((u - a) / (b - a)))
const rad = (d: number) => (d * Math.PI) / 180

export const framesFor = (seconds: number, fps = KIMODO_FPS) => Math.max(8, Math.floor(seconds * fps))

/** Üretilecek süre: döngülerde temiz pencere bulmak için daha uzun üretilir */
export function generationSeconds(spec: KimodoSpec): number {
  if (!spec.loop) return Math.min(10, Math.max(0.6, spec.seconds))
  if (spec.role === 'idle') return Math.min(10, Math.max(5, spec.seconds * 2 + 1.5))
  return Math.min(9.5, Math.max(4.5, spec.seconds * 2.5 + 1.2))
}

export interface PathProfile {
  points: [number, number][]
  headings: number[]
  end: { x: number; z: number; heading: number }
}

/** Rol → kare başına kök konumu ve bakış (sağ +, derece) */
export function buildPath(spec: KimodoSpec, seconds: number, fps = KIMODO_FPS): PathProfile {
  const n = framesFor(seconds, fps)
  const T = (n - 1) / fps
  const s0 = spec.speed || 0
  const s1 = spec.speedEnd ?? s0
  const turn = spec.turn || 0
  const speedAt = (t: number): number => {
    const u = T > 0 ? t / T : 0
    switch (spec.role) {
      case 'idle':
      case 'turn':
      case 'aim':
        return 0
      case 'loop':
      case 'jump_loop':
        return s0 * smooth(t / 0.6)
      case 'start':
        return s0 + (s1 - s0) * ramp(u, 0.12, 0.7)
      case 'stop':
        return s0 + (s1 - s0) * ramp(u, 0, 0.65)
      case 'pivot':
        return u < 0.45 ? s0 * (1 - ramp(u, 0, 0.45)) : s1 * ramp(u, 0.45, 0.95)
      default:
        return s0 + (s1 - s0) * u
    }
  }
  const headingAt = (t: number): number => {
    const u = T > 0 ? t / T : 0
    switch (spec.role) {
      case 'loop':
      case 'jump_loop':
        return spec.seconds > 0 ? (turn / spec.seconds) * t : 0
      case 'start':
        return turn * ramp(u, 0.05, 0.6)
      case 'stop':
        return turn * ramp(u, 0, 0.6)
      case 'turn':
        return turn * ramp(u, 0.1, 0.8)
      case 'pivot':
        return turn * ramp(u, 0.3, 0.6)
      default:
        return turn * u
    }
  }
  const points: [number, number][] = []
  const headings: number[] = []
  let x = 0
  let z = 0
  const dt = 1 / fps
  for (let i = 0; i < n; i++) {
    const t = i * dt
    const h = headingAt(t)
    points.push([round(x), round(z)])
    headings.push(round(h, 2))
    // bir sonraki kareye ilerle (orta nokta ile)
    const tm = t + dt / 2
    const v = speedAt(tm)
    const m = rad(headingAt(tm) + spec.moveDir)
    x += -Math.sin(m) * v * dt
    z += Math.cos(m) * v * dt
  }
  const last = points[points.length - 1]
  return { points, headings, end: { x: last[0], z: last[1], heading: headings[headings.length - 1] } }
}

const round = (v: number, d = 4) => Math.round(v * 10 ** d) / 10 ** d

/** Spec + promptlar + komşu pozlar → Kimodo /generate gövdesi */
export function buildKimodoRequest(spec: KimodoSpec, texts: string[], durations: number[], poses: { from?: CanonicalPose; to?: CanonicalPose }): KimodoGenRequest {
  const multi = texts.length > 1
  const total = multi ? durations.reduce((a, b) => a + b, 0) : generationSeconds(spec)
  const req: KimodoGenRequest = {
    texts,
    durations: multi ? durations : [total],
    loop: spec.loop,
    constraints: []
  }
  if (spec.loop) {
    if (spec.role === 'idle') {
      req.loop_min = Math.max(0.8, spec.seconds * 0.75)
      req.loop_max = Math.max(1.2, spec.seconds * 1.35)
    } else {
      req.loop_min = Math.max(0.5, spec.seconds * 0.6)
      req.loop_max = Math.max(1.0, spec.seconds * 1.8 + 0.4)
    }
    req.loop_keep_turn = Math.abs(spec.turn) > 1
  }
  const path = buildPath(spec, total)
  if (spec.constrainPath) req.constraints.push({ type: 'path', points: path.points, headings: path.headings })
  // Döngüler kesildiği için uç pozları anlamsız; yalnızca tek seferlik kliplerde poz eşleme
  if (!spec.loop) {
    if (poses.from) req.constraints.push({ type: 'pose', frame: 0, pose: poses.from, x: 0, z: 0, heading: 0 })
    if (poses.to) {
      const end = spec.constrainPath ? path.end : { x: 0, z: 0, heading: spec.turn }
      req.constraints.push({ type: 'pose', frame: -1, pose: poses.to, x: end.x, z: end.z, heading: end.heading })
    }
  }
  return req
}
