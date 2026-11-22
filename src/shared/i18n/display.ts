// SPDX-License-Identifier: AGPL-3.0-only
import { catalogs, translate, formatRelativeTime, type Locale } from './index'
import { panelRows } from './panels'

const panelText = new Map<string, readonly [string, string, string]>([
  ...Object.keys(catalogs.en).map(key => {
    const k = key as keyof typeof catalogs.en
    return [catalogs.tr[k], [catalogs.en[k], catalogs['zh-CN'][k], catalogs.tr[k]]] as const
  }),
  ...Object.values(panelRows).map(row => [row[2], row] as const)
])

/** For application-owned immutable metadata only; never pass project or user text. */
export function panelLabel(locale: Locale, source: string): string {
  const row = panelText.get(source)
  return row ? row[locale === 'en' ? 0 : locale === 'zh-CN' ? 1 : 2] : source
}

/** Only known application status values are projected. Unknown/custom values stay intact. */
export function assetStatus(locale: Locale, value: string): string {
  if (value === 'Üretildi') return translate(locale, 'surface.generated')
  if (value === 'Brief') return translate(locale, 'surface.briefStatus')
  return value
}

export function lastSeen(locale: Locale, time?: number, now = Date.now()): string {
  if (!time) return translate(locale, 'web.never')
  const minutes = Math.round((time - now) / 60_000)
  if (Math.abs(minutes) < 60) return formatRelativeTime(locale, minutes, 'minute')
  const hours = Math.round(minutes / 60)
  return Math.abs(hours) < 48 ? formatRelativeTime(locale, hours, 'hour') : formatRelativeTime(locale, Math.round(hours / 24), 'day')
}

export function timeLeft(locale: Locale, time: number, now = Date.now()): string {
  const hours = Math.max(0, Math.round((time - now) / 3600_000))
  return new Intl.NumberFormat(locale, { style: 'unit', unit: hours < 48 ? 'hour' : 'day', unitDisplay: 'long' }).format(hours < 48 ? hours : Math.round(hours / 24))
}
