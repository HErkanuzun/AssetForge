// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { catalogs, formatDate, formatMessage, formatNumber, formatRelativeTime, isLocale, LOCALES, resolveLocale, systemLocale, translate } from '../src/shared/i18n'

describe('interface localization', () => {
  it.each(['zh-CN', 'zh-SG', 'zh-Hans', 'zh-Hans-CN', 'zh_CN'])('recognizes Simplified Chinese: %s', (tag) => {
    expect(systemLocale(tag)).toBe('zh-CN')
  })
  it.each(['zh-TW', 'zh-Hant', 'zh', 'de-DE', '', 'en-US'])('falls back to English: %s', (tag) => {
    expect(systemLocale(tag)).toBe('en')
  })
  it('uses saved choices and normalizes invalid disk values', () => {
    expect(resolveLocale('en', 'zh-CN')).toBe('en')
    expect(resolveLocale('tr', 'en-US')).toBe('tr')
    expect(resolveLocale(undefined, 'tr-TR')).toBe('tr')
    expect(resolveLocale('unsupported', 'zh-CN')).toBe('zh-CN')
    expect(isLocale({ locale: 'en' })).toBe(false)
    expect(isLocale('en-US')).toBe(false)
  })
  it('requires matching message keys and interpolation names in every catalog', () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    for (const locale of LOCALES) {
      expect(Object.keys(catalogs[locale]).sort()).toEqual(Object.keys(catalogs.en).sort())
      for (const key of Object.keys(catalogs.en) as (keyof typeof catalogs.en)[]) {
        expect(catalogs[locale][key].trim(), `${locale}:${key}`).not.toBe('')
        expect(placeholders(catalogs[locale][key]), `${locale}:${key}`).toEqual(placeholders(catalogs.en[key]))
      }
    }
  })
  it('interpolates data without recursive substitution or replacement metacharacters', () => {
    expect(translate('zh-CN', 'app.running', { count: 3 })).toBe('3 个任务正在生产')
    expect(formatMessage('{detail}', { detail: '$& {count} <tag>' })).toBe('$& {count} <tag>')
    expect(formatMessage('{toString}')).toBe('{toString}')
  })
  it('falls back to English for a missing translation at runtime', () => {
    const old = catalogs['zh-CN']['app.loading']
    try {
      catalogs['zh-CN']['app.loading'] = ''
      expect(translate('zh-CN', 'app.loading')).toBe('Loading…')
    } finally {
      catalogs['zh-CN']['app.loading'] = old
    }
  })
  it('formats numbers, dates and relative time in the chosen locale', () => {
    expect(formatNumber('en', 12345)).toBe('12,345')
    expect(formatRelativeTime('zh-CN', -2, 'day')).toBe('前天')
    expect(formatDate('en', '2026-01-02T12:00:00Z', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })).toBe('January 2, 2026')
  })
})
