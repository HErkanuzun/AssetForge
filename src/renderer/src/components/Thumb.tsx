// SPDX-License-Identifier: AGPL-3.0-only
import type { AssetKind, Job } from '../../../shared/types'
import { forgeUrl, useStore } from '../store'
import KindArt from './KindArt'
import { formatRelativeTime, type Locale } from '../../../shared/i18n'

/** Asset önizlemesi: üretilmiş görsel varsa o, yoksa türün illüstrasyonu */
export function AssetThumb({ id, kind, seed = 0 }: { id?: string; kind: AssetKind; seed?: number }) {
  const { thumbs } = useStore()
  const img = id ? thumbs[id] : undefined
  return img ? <img src={forgeUrl(img)} alt="" draggable={false} /> : <KindArt kind={kind} seed={seed} />
}

/** İşin genel ilerleme yüzdesi (düğümlerin ortalaması) */
export function jobProgress(j: Job): number {
  if (j.status === 'done') return 100
  const nodes = Object.values(j.nodes)
  if (!nodes.length) return 0
  return Math.round(nodes.reduce((s, n) => s + (n.status === 'done' || n.status === 'skipped' ? 100 : n.progress || 0), 0) / nodes.length)
}

export function hashSeed(s: string): number {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

export function ago(t: number, locale: Locale): string {
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return formatRelativeTime(locale, 0, 'second')
  if (s < 3600) return formatRelativeTime(locale, -Math.floor(s / 60), 'minute')
  if (s < 86400) return formatRelativeTime(locale, -Math.floor(s / 3600), 'hour')
  return formatRelativeTime(locale, -Math.floor(s / 86400), 'day')
}
