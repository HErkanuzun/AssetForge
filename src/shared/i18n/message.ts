// SPDX-License-Identifier: AGPL-3.0-only
import { catalogs, formatMessage, type Locale, type MessageArgs, type MessageKey } from './index'

export interface MessageDescriptor {
  key: MessageKey
  params?: Record<string, string | number>
}
export type UiMessage = string | MessageDescriptor

/** Keep keys across async boundaries so already visible feedback follows locale changes. */
export function message<K extends MessageKey>(key: K, ...args: MessageArgs<K>): MessageDescriptor {
  return {key, ...(args[0] ? {params:args[0]} : {})}
}

export function renderMessage(locale: Locale, value: UiMessage): string {
  if (typeof value === 'string') return value
  return formatMessage(catalogs[locale]?.[value.key] || catalogs.en[value.key], value.params)
}
