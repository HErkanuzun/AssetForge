// SPDX-License-Identifier: AGPL-3.0-only
// Bir işlemi kimin çağırdığı: masaüstü penceresi (her zaman sahip) ya da web'den bağlanan bir kullanıcı.
// İşleyiciler gerektiğinde currentCaller() ile öğrenir (ör. proje kaydında terminal izni denetimi).
import { AsyncLocalStorage } from 'node:async_hooks'
import type { WebRole } from '../../shared/types'

export interface Caller {
  kind: 'desktop' | 'web'
  name: string
  role: WebRole
  userId?: string
  /** Tarayıcı sekmesinin kimliği: kendi kaydının olayı kendisine geri gönderilmez */
  clientId?: string
}

export const DESKTOP: Caller = { kind: 'desktop', name: 'Bu bilgisayar', role: 'owner', clientId: 'desktop' }

const store = new AsyncLocalStorage<Caller>()

export const currentCaller = (): Caller => store.getStore() ?? DESKTOP
export const runAs = <T>(c: Caller, fn: () => T): T => store.run(c, fn)
