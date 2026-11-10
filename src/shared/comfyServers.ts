// SPDX-License-Identifier: AGPL-3.0-only
// ComfyUI sunucu listesi için saf yardımcılar (Electron'a bağlı değil; ayarlar, motor ve arayüz ortak kullanır).
import type { ComfyOutputKind, ComfyServer } from './types'

export const DEFAULT_COMFY_URL = 'http://127.0.0.1:8188'

/** Adres bu bilgisayarı mı gösteriyor? Uzak sunucu kurulamaz/başlatılamaz. */
export function isLocalUrl(url: string): boolean {
  try {
    return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)
  } catch {
    return false
  }
}

export function portOf(url: string): number {
  try {
    const u = new URL(url)
    return Number(u.port) || (u.protocol === 'https:' ? 443 : 80)
  } catch {
    return 8188
  }
}

/** Kullanıcının yazdığı adresi düzeltir: şema yoksa http, sondaki eğik çizgi yok */
export function normalizeComfyUrl(input: string): string {
  let u = input.trim()
  if (!u) return ''
  if (!/^[a-z]+:\/\//i.test(u)) u = `http://${u}`
  return u.replace(/\/+$/, '')
}

/**
 * Eski tek adresli ayardan sunucu listesine geçiş. Her zaman tek bir "bu bilgisayar" (AssetForge kurulumu)
 * kaydı bulunur; eski adres uzaksa o ayrı bir sunucu olarak eklenir ve kurulum kaydı kapalı başlar.
 */
export function migrateComfyServers(loaded: { comfyServers?: ComfyServer[]; comfyUrl?: string }): ComfyServer[] {
  if (Array.isArray(loaded.comfyServers) && loaded.comfyServers.length) {
    let seen = false
    const list = loaded.comfyServers.map((s) => {
      const managed = !!s.managed && !seen
      if (managed) seen = true
      return { ...s, managed }
    })
    return seen ? list : [{ id: 'local', name: 'Bu bilgisayar (AssetForge kurulumu)', url: DEFAULT_COMFY_URL, enabled: false, managed: true }, ...list]
  }
  const url = normalizeComfyUrl(loaded.comfyUrl || DEFAULT_COMFY_URL)
  if (isLocalUrl(url)) return [{ id: 'local', name: 'Bu bilgisayar', url, enabled: true, managed: true }]
  return [
    { id: 'local', name: 'Bu bilgisayar (AssetForge kurulumu)', url: DEFAULT_COMFY_URL, enabled: false, managed: true },
    { id: 'remote', name: 'Uzak ComfyUI', url, enabled: true }
  ]
}

export interface ServerCandidate {
  id: string
  online: boolean
  /** Eksik düğüm/model yok (bilinmiyorsa true) */
  fits: boolean
  /** Sunucunun kendi kuyruğu */
  queue: number
  /** Bu uygulamanın o sunucuya gönderip henüz bitmemiş işleri */
  inflight: number
}

/** Otomatik seçim sırası: açık ve uygun olanlar, en kısa kuyruk önce; eşitlikte listedeki sıra */
export function rankServers(c: ServerCandidate[]): ServerCandidate[] {
  return c
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => x.online && x.fits)
    .sort((a, b) => a.x.queue + a.x.inflight - (b.x.queue + b.x.inflight) || a.i - b.i)
    .map(({ x }) => x)
}

export const KIND_LABEL: Record<ComfyOutputKind, string> = { image: 'görsel', model: '3D', audio: 'ses', anim: 'animasyon' }
