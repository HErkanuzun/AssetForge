// SPDX-License-Identifier: AGPL-3.0-only
import { extraEn, extraZh, extraTr } from './extra'
import { pagesEn, pagesZh, pagesTr } from './pages'
import { panelsEn, panelsZh, panelsTr } from './panels'
import { feedbackEn, feedbackZh, feedbackTr } from './feedback'
export const LOCALES = ['en', 'zh-CN', 'tr'] as const
export type Locale = (typeof LOCALES)[number]
export const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', 'zh-CN': '简体中文', tr: 'Türkçe' }

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

export function systemLocale(value: string): Locale {
  const tag = value.replaceAll('_', '-').toLowerCase()
  if (/^zh-(?:cn|sg|hans)(?:-|$)/.test(tag)) return 'zh-CN'
  if (/^tr(?:-|$)/.test(tag)) return 'tr'
  return 'en'
}

export function resolveLocale(saved: unknown, system: string): Locale {
  return isLocale(saved) ? saved : systemLocale(system)
}

const en = {
  ...feedbackEn,
  ...extraEn,
  ...pagesEn,
  ...panelsEn,
  'language.label': 'Interface language',
  'language.help': 'Applies immediately. Your project content stays in its original language.',
  'language.saveFailed': 'Could not save the language: {detail}',
  'language.invalid': 'Unsupported interface language.',
  'app.loading': 'Loading…',
  'app.settingsOwnerOnly': 'Settings are available only to the project owner.',
  'app.workshop': 'Workshop',
  'app.library': 'Library',
  'app.animation': 'Animation',
  'app.animationStudio': 'Animation Studio',
  'app.pipelines': 'Pipelines',
  'app.productionPipelines': 'Production Pipelines',
  'app.jobs': 'Production',
  'app.queue': 'Production Queue',
  'app.design': 'Game Design',
  'app.bible': 'Project Bible',
  'app.settings': 'Settings',
  'app.assets': 'assets',
  'app.asset': 'asset',
  'app.brief': 'Workshop · Brief',
  'app.readOnly': 'View only',
  'app.readOnlyHelp': 'The project owner assigned you the viewer role: changes cannot be saved and production cannot be started.',
  'app.running': '{count} jobs in production',
  'app.waiting': ' · {count} waiting',
  'app.assistant': 'Producer',
  'app.assistantHelp': 'Producer assistant (Ctrl+J)',
  'app.webUser': 'Connected from a browser ({role})',
  'app.logout': 'Sign out',
  'role.owner': 'Owner',
  'role.editor': 'Editor',
  'role.viewer': 'Viewer',
  'status.queued': 'Queued',
  'status.running': 'Running',
  'status.done': 'Done',
  'status.failed': 'Failed',
  'status.canceled': 'Canceled',
  'status.skipped': 'Skipped',
  'status.retrying': 'Retrying',
  'status.idle': 'Waiting'
} as const

export type MessageKey = keyof typeof en
type Catalog = Record<MessageKey, string>
const zh: Catalog = {
  ...feedbackZh,
  ...extraZh,
  ...pagesZh,
  ...panelsZh,
  'language.label': '界面语言',
  'language.help': '切换后立即生效，项目内容保留原始语言。',
  'language.saveFailed': '无法保存语言设置：{detail}',
  'language.invalid': '不支持此界面语言。',
  'app.loading': '正在加载…',
  'app.settingsOwnerOnly': '仅项目所有者可以访问设置。',
  'app.workshop': '工作台',
  'app.library': '资源库',
  'app.animation': '动画',
  'app.animationStudio': '动画工作室',
  'app.pipelines': '流水线',
  'app.productionPipelines': '生产流水线',
  'app.jobs': '生产',
  'app.queue': '生产队列',
  'app.design': '游戏设计',
  'app.bible': '项目设定集',
  'app.settings': '设置',
  'app.assets': '项资源',
  'app.asset': '项资源',
  'app.brief': '工作台 · 创作需求',
  'app.readOnly': '只读模式',
  'app.readOnlyHelp': '项目所有者为你分配了查看者角色：无法保存更改或启动生产。',
  'app.running': '{count} 个任务正在生产',
  'app.waiting': ' · {count} 个等待中',
  'app.assistant': '制作助手',
  'app.assistantHelp': '制作助手（Ctrl+J）',
  'app.webUser': '通过浏览器连接（{role}）',
  'app.logout': '退出登录',
  'role.owner': '所有者',
  'role.editor': '编辑者',
  'role.viewer': '查看者',
  'status.queued': '排队中',
  'status.running': '运行中',
  'status.done': '已完成',
  'status.failed': '失败',
  'status.canceled': '已取消',
  'status.skipped': '已跳过',
  'status.retrying': '重试中',
  'status.idle': '等待中'
}
const tr: Catalog = {
  ...feedbackTr,
  ...extraTr,
  ...pagesTr,
  ...panelsTr,
  'language.label': 'Arayüz dili',
  'language.help': 'Hemen uygulanır. Proje içeriğiniz özgün dilinde kalır.',
  'language.saveFailed': 'Dil kaydedilemedi: {detail}',
  'language.invalid': 'Desteklenmeyen arayüz dili.',
  'app.loading': 'Yükleniyor…',
  'app.settingsOwnerOnly': 'Ayarlar yalnızca proje sahibine açık.',
  'app.workshop': 'Atölye',
  'app.library': 'Kütüphane',
  'app.animation': 'Animasyon',
  'app.animationStudio': 'Animasyon Stüdyosu',
  'app.pipelines': 'Hatlar',
  'app.productionPipelines': 'Üretim Hatları',
  'app.jobs': 'Üretim',
  'app.queue': 'Üretim Kuyruğu',
  'app.design': 'Oyun Tasarımı',
  'app.bible': 'Proje Kitabı',
  'app.settings': 'Ayarlar',
  'app.assets': 'asset',
  'app.asset': 'asset',
  'app.brief': 'Atölye · Brief',
  'app.readOnly': 'Yalnızca görüntüleme',
  'app.readOnlyHelp': 'Proje sahibi size izleyici rolü verdi: değişiklikler kaydedilmez, üretim başlatılamaz',
  'app.running': '{count} iş üretimde',
  'app.waiting': ' · {count} bekliyor',
  'app.assistant': 'Yapımcı',
  'app.assistantHelp': 'Yapımcı asistanı (Ctrl+J)',
  'app.webUser': 'Tarayıcıdan bağlısınız ({role})',
  'app.logout': 'Çıkış',
  'role.owner': 'Sahip',
  'role.editor': 'Editör',
  'role.viewer': 'İzleyici',
  'status.queued': 'sırada',
  'status.running': 'çalışıyor',
  'status.done': 'bitti',
  'status.failed': 'hata',
  'status.canceled': 'iptal',
  'status.skipped': 'atlandı',
  'status.retrying': 'yeniden',
  'status.idle': 'bekliyor'
}
export const catalogs = { en, 'zh-CN': zh, tr } satisfies Record<Locale, Catalog>
type Slots<S extends string> = S extends `${string}{${infer P}}${infer Rest}` ? P | Slots<Rest> : never
export type PlainMessageKey = { [K in MessageKey]: [Slots<(typeof en)[K]>] extends [never] ? K : never }[MessageKey]
export type MessageParams<K extends MessageKey> = Record<Slots<(typeof en)[K]>, string | number>
export type MessageArgs<K extends MessageKey> = [Slots<(typeof en)[K]>] extends [never] ? [params?: never] : [params: MessageParams<K>]

/** Interpolation treats values as data; callers rendering HTML must escape the final text. */
export function formatMessage(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (token, name: string) => (Object.hasOwn(params, name) ? String(params[name]) : token))
}

export function translate<K extends MessageKey>(locale: Locale, key: K, ...args: MessageArgs<K>): string {
  return formatMessage(catalogs[locale]?.[key] || en[key], args[0])
}

export const formatNumber = (locale: Locale, value: number, options?: Intl.NumberFormatOptions): string => new Intl.NumberFormat(locale, options).format(value)
export const formatDate = (locale: Locale, value: string | number | Date, options?: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat(locale, options ?? { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
export const formatRelativeTime = (locale: Locale, value: number, unit: Intl.RelativeTimeFormatUnit): string => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit)
