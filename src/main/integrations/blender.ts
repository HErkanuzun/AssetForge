import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { ModelStats } from '../../shared/types'
import { ensureDir, resourcePath } from '../util'

export interface BlenderResult {
  file: string
  previews: string[]
  stats: ModelStats
}

export function runBlender(opts: {
  blenderPath: string
  input: string
  outDir: string
  name: string
  format: 'fbx' | 'glb'
  targetTris: number
  targetSize: number[]
  origin: string
  preview: boolean
  skeleton?: 'none' | 'manny'
  log: (m: string) => void
  signal?: AbortSignal
}): Promise<BlenderResult> {
  if (!opts.blenderPath || !fs.existsSync(opts.blenderPath)) {
    return Promise.reject(new Error('Blender bulunamadı. Ayarlar → Blender yolu'))
  }
  ensureDir(opts.outDir)
  const out = path.join(opts.outDir, `${opts.name}.${opts.format}`)
  const statsFile = path.join(opts.outDir, 'blender_stats.json')
  const previewDir = opts.preview ? path.join(opts.outDir, 'previews') : ''
  const args = [
    '-b',
    '--factory-startup',
    '-P',
    resourcePath('python', 'blender_process.py'),
    '--',
    '--in',
    opts.input,
    '--out',
    out,
    '--name',
    opts.name,
    '--format',
    opts.format,
    '--target-tris',
    String(Math.max(0, Math.round(opts.targetTris))),
    '--target-size',
    opts.targetSize.join(','),
    '--origin',
    opts.origin,
    '--preview-dir',
    previewDir,
    '--stats',
    statsFile,
    '--skeleton',
    opts.skeleton ?? 'none'
  ]
  return new Promise((resolve, reject) => {
    const proc = spawn(opts.blenderPath, args, { windowsHide: true })
    let tail = ''
    const onData = (d: Buffer) => {
      const text = d.toString()
      tail = (tail + text).slice(-4000)
      for (const line of text.split(/\r?\n/)) if (line.startsWith('[FORGE] ')) opts.log('Blender: ' + line.slice(8))
    }
    proc.stdout.on('data', onData)
    proc.stderr.on('data', onData)
    opts.signal?.addEventListener('abort', () => proc.kill(), { once: true })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0 || !fs.existsSync(statsFile)) {
        return reject(new Error(`Blender hata ile bitti (kod ${code}). Son çıktı:\n${tail.slice(-1200)}`))
      }
      const raw = JSON.parse(fs.readFileSync(statsFile, 'utf8')) as ModelStats & { previews: string[] }
      const { previews, ...stats } = raw
      resolve({ file: out, previews, stats })
    })
  })
}

export interface AnimResult {
  file: string
  frames: number
  fps: number
  duration: number
}

/** Kimodo BVH → Manny adlı iskelet + root motion → FBX animasyon */
export function runBlenderAnim(opts: {
  blenderPath: string
  bvh: string
  out: string
  rootMotion: string
  log: (m: string) => void
  signal?: AbortSignal
}): Promise<AnimResult> {
  if (!opts.blenderPath || !fs.existsSync(opts.blenderPath)) {
    return Promise.reject(new Error('Blender bulunamadı. Ayarlar → Blender yolu'))
  }
  ensureDir(path.dirname(opts.out))
  const statsFile = opts.out.replace(/\.fbx$/i, '') + '_stats.json'
  const args = ['-b', '--factory-startup', '-P', resourcePath('python', 'blender_anim.py'), '--', '--in', opts.bvh, '--out', opts.out, '--stats', statsFile, '--root-motion', opts.rootMotion]
  return new Promise((resolve, reject) => {
    const proc = spawn(opts.blenderPath, args, { windowsHide: true })
    let tail = ''
    const onData = (d: Buffer) => {
      const text = d.toString()
      tail = (tail + text).slice(-4000)
      for (const line of text.split(/\r?\n/)) if (line.startsWith('[FORGE] ')) opts.log('Blender: ' + line.slice(8))
    }
    proc.stdout.on('data', onData)
    proc.stderr.on('data', onData)
    opts.signal?.addEventListener('abort', () => proc.kill(), { once: true })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0 || !fs.existsSync(statsFile)) return reject(new Error(`Blender animasyon dönüşümü başarısız (kod ${code}):\n${tail.slice(-1200)}`))
      const st = JSON.parse(fs.readFileSync(statsFile, 'utf8')) as { frames: number; fps: number; duration: number }
      resolve({ file: opts.out, ...st })
    })
  })
}
