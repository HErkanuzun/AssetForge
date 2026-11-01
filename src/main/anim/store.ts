// Klip hareket bilgisi deposu: <proje>/anim/<assetId>.motion.json
// (ölçüm, ayak basışları, döngü penceresi ve poz eşleme için kanonik uç pozlar)

import fs from 'node:fs'
import path from 'node:path'
import type { ClipMotionInfo } from '../../shared/types'
import { ensureDir } from '../util'
import type { CanonicalPose } from './motion'

export interface StoredMotion extends ClipMotionInfo {
  poses?: { first: CanonicalPose; last: CanonicalPose }
  bvh?: string
  fbx?: string
  clip?: string
  at?: number
}

export const motionFile = (dir: string, assetId: string) => path.join(dir, 'anim', `${assetId}.motion.json`)

export function saveMotion(dir: string, assetId: string, m: StoredMotion): void {
  ensureDir(path.join(dir, 'anim'))
  fs.writeFileSync(motionFile(dir, assetId), JSON.stringify(m))
}

export function loadMotion(dir: string, assetId?: string): StoredMotion | null {
  if (!assetId) return null
  try {
    return JSON.parse(fs.readFileSync(motionFile(dir, assetId), 'utf8')) as StoredMotion
  } catch {
    return null
  }
}

/** UI için pozsuz özet */
export function motionInfo(m: StoredMotion | null): ClipMotionInfo | undefined {
  if (!m) return undefined
  return { measured: m.measured, markers: m.markers, loop: m.loop, frames: m.frames, fps: m.fps }
}
