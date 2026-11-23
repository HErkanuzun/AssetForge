// SPDX-License-Identifier: AGPL-3.0-only
import { UiError } from '../../shared/i18n/errors'
import { message, type MessageDescriptor } from '../../shared/i18n/message'
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

const ERRORS = {
  400: 'provider.invalidRequest',
  401: 'provider.invalidKey',
  402: 'provider.noCredit',
  403: 'provider.forbidden',
  404: 'provider.notFound',
  429: 'provider.rateLimit'
} as const

async function request<T>(method: string, url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const key = getSecret('meshy')
  if (!key) throw new UiError(message('error.51df629f9b'))
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
    throw new UiError(message('provider.error', { provider: 'Meshy', hint: message(ERRORS[res.status as keyof typeof ERRORS] ?? 'provider.failed'), status: res.status, detail: detail.slice(0, 300) }))
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

export async function waitTask(
  resource: MeshyResource,
  id: string,
  onProgress: (p: number, note: string, descriptor?: MessageDescriptor) => void,
  signal?: AbortSignal,
  timeoutMs = 40 * 60 * 1000
): Promise<MeshyTask> {
  const start = Date.now()
  for (;;) {
    const t = await getTask(resource, id, signal)
    if (t.status === 'SUCCEEDED') return t
    if (t.status === 'FAILED' || t.status === 'CANCELED') {
      throw new UiError(message('error.57ec37d6f7', { p0: message(t.status === 'FAILED' ? 'status.failed' : 'status.canceled'), p1: t.task_error?.message ?? message('provider.unknownError') }))
    }
    onProgress(
      t.progress ?? 0,
      t.status === 'PENDING' ? `sırada (${t.preceding_tasks ?? '?'} görev önde)` : 'işleniyor',
      t.status === 'PENDING' ? message('meshy.queued', { count: t.preceding_tasks ?? '?' }) : message('status.running')
    )
    if (Date.now() - start > timeoutMs) throw new UiError(message('error.c4b4beb00e', { p0: String(id) }))
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
