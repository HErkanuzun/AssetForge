// SPDX-License-Identifier: AGPL-3.0-only
// Olay dağıtımı: iş ilerlemesi, proje değişikliği, sohbet akışı… masaüstü penceresine ve bağlı tarayıcılara gider.
// Kurulum günlükleri ve anahtar bağlama olayları yalnızca sahiplere gider.
import type { WebRole } from '../../shared/types'

export interface HubClient {
  id: string
  userId: string
  name: string
  role: WebRole
  since: number
  send: (channel: string, payload: unknown) => void
  /** Bağlantıyı kapatır (tarayıcı yeniden bağlanınca güncel rolle gelir) */
  close?: () => void
}

const OWNER_ONLY = new Set(['connect:event', 'comfy:log', 'kimodo:log', 'backends:log'])
/** Yalnızca masaüstü penceresine (görev çubuğundan sayfa açma) */
const DESKTOP_ONLY = new Set(['nav:page'])

let desktop: ((channel: string, payload: unknown) => void) | null = null
const clients = new Map<string, HubClient>()

export function setDesktopSink(fn: ((channel: string, payload: unknown) => void) | null): void {
  desktop = fn
}

export function addClient(c: HubClient): void {
  clients.set(c.id, c)
}

export function removeClient(id: string): void {
  clients.delete(id)
}

/** Kullanıcı silinince ya da rolü değişince açık bağlantıları kapat (yeniden giriş yapsınlar) */
export function dropUser(userId: string): void {
  for (const [id, c] of clients) {
    if (c.userId !== userId) continue
    clients.delete(id)
    try {
      c.close?.()
    } catch {
      /* zaten kapanmış */
    }
  }
}

export const onlineClients = (): HubClient[] => [...clients.values()]

/** except: olayı tetikleyen istemci (kendi kaydının yankısını almaz); 'desktop' masaüstü penceresidir */
export function emit(channel: string, payload: unknown, except?: string): void {
  if (except !== 'desktop') desktop?.(channel, payload)
  if (DESKTOP_ONLY.has(channel)) return
  for (const c of clients.values()) {
    if (c.id === except) continue
    if (OWNER_ONLY.has(channel) && c.role !== 'owner') continue
    try {
      c.send(channel, payload)
    } catch {
      clients.delete(c.id)
    }
  }
}
