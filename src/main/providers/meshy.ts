// Meshy REST API istemcisi (https://docs.meshy.ai)
import path from 'node:path'
import type { MeshyResource } from '../../shared/types'
import { getSecret } from '../settings'
import { downloadTo, sleep } from '../util'

const BASE = 'https://api.meshy.ai'
const VERSION: Record<MeshyResource, string> = {
  'text-to-3d': 'v2',
  'image-to-3d': 'v1',
  'multi-image-to-3d': 'v1',
  retexture: 'v1',
  remesh: 'v1',
  rigging: 'v1',
  'text-to-image': 'v1'
}

export interface MeshyTask {
  id: string
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED'
  progress: number
  model_urls?: Record<string, string>
  thumbnail_url?: string
  texture_urls?: Record<string, string>[]
  image_urls?: string[]
  result?: {
    rigged_character_glb_url?: string
    rigged_character_fbx_url?: string
    basic_animations?: Record<string, string> | null
  }
  task_error?: { message?: string }
  consumed_credits?: number
  preceding_tasks?: number
}

const ERRORS: Record<number, string> = {
  400: 'Geçersiz istek',
  401: 'Meshy API anahtarı geçersiz veya eksik',
  402: 'Meshy kredisi yetersiz (veya ücretsiz plan API desteklemiyor)',
  403: 'Bu işlem için yetki yok',
  404: 'Görev bulunamadı',
  429: 'Meshy istek sınırı aşıldı'
}

async function request<T>(method: string, url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const key = getSecret('meshy')
  if (!key) throw new Error('Meshy API anahtarı yok (Ayarlar)')
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(BASE + url, {
      method,
      signal,
      headers: { Authorization: `Bearer ${key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    })
    if (res.ok) return (await res.json()) as T
    const retryable = res.status === 429 || res.status >= 500
    if (retryable && attempt < 4) {
      await sleep(2000 * 2 ** attempt, signal)
      continue
    }
    const detail = await res.text().catch(() => '')
    throw new Error(`${ERRORS[res.status] ?? 'Meshy hatası'} (${res.status}) ${detail.slice(0, 300)}`)
  }
}

export async function createTask(resource: MeshyResource, body: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
  const clean = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined && v !== ''))
  const r = await request<{ result: string }>('POST', `/openapi/${VERSION[resource]}/${resource}`, clean, signal)
  return r.result
}

export function getTask(resource: MeshyResource, id: string, signal?: AbortSignal): Promise<MeshyTask> {
  return request<MeshyTask>('GET', `/openapi/${VERSION[resource]}/${resource}/${id}`, undefined, signal)
}

export async function waitTask(resource: MeshyResource, id: string, onProgress: (p: number, note: string) => void, signal?: AbortSignal, timeoutMs = 40 * 60 * 1000): Promise<MeshyTask> {
  const start = Date.now()
  for (;;) {
    const t = await getTask(resource, id, signal)
    if (t.status === 'SUCCEEDED') return t
    if (t.status === 'FAILED' || t.status === 'CANCELED') {
      throw new Error(`Meshy görevi ${t.status === 'FAILED' ? 'başarısız' : 'iptal'}: ${t.task_error?.message ?? 'bilinmeyen hata'}`)
    }
    onProgress(t.progress ?? 0, t.status === 'PENDING' ? `sırada (${t.preceding_tasks ?? '?'} görev önde)` : 'işleniyor')
    if (Date.now() - start > timeoutMs) throw new Error(`Meshy görevi zaman aşımına uğradı (${id})`)
    await sleep(5000, signal)
  }
}

export async function balance(): Promise<number> {
  const r = await request<{ balance: number }>('GET', '/openapi/v1/balance')
  return r.balance
}

const TEXTURE_NAMES: Record<string, string> = {
  base_color: 'BaseColor',
  normal: 'Normal',
  roughness: 'Roughness',
  metallic: 'Metallic',
  emission: 'Emissive'
}

/** Görev sonucundaki model, önizleme ve dokuları klasöre indirir. */
export async function downloadModelTask(
  task: MeshyTask,
  dir: string,
  base: string,
  signal?: AbortSignal
): Promise<{ glb?: string; fbx?: string; thumbnail?: string; textures: Record<string, string> }> {
  const out: { glb?: string; fbx?: string; thumbnail?: string; textures: Record<string, string> } = { textures: {} }
  if (task.model_urls?.glb) out.glb = await downloadTo(task.model_urls.glb, path.join(dir, `${base}.glb`), signal)
  if (task.model_urls?.fbx) out.fbx = await downloadTo(task.model_urls.fbx, path.join(dir, `${base}.fbx`), signal)
  if (task.thumbnail_url) out.thumbnail = await downloadTo(task.thumbnail_url, path.join(dir, `${base}_thumb.png`), signal)
  const tex = task.texture_urls?.[0] ?? {}
  for (const [k, url] of Object.entries(tex)) {
    if (!url || !TEXTURE_NAMES[k]) continue
    out.textures[TEXTURE_NAMES[k]] = await downloadTo(url, path.join(dir, `T_${base}_${TEXTURE_NAMES[k]}.png`), signal)
  }
  return out
}
