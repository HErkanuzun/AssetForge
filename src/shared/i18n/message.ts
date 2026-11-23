// SPDX-License-Identifier: AGPL-3.0-only
import { catalogs, formatMessage, type Locale, type MessageArgs, type MessageParams, type MessageKey } from './index'

export interface MessageDescriptor {
  key: MessageKey
  params?: Record<string, string | number | MessageDescriptor>
}
export type UiMessage = string | MessageDescriptor

/** Keep keys across async boundaries so already visible feedback follows locale changes. */
type DescriptorArgs<K extends MessageKey> = MessageArgs<K> extends [params?: never] ? [params?: never] : [params: Record<keyof MessageParams<K>, string | number | MessageDescriptor>]

export function message<K extends MessageKey>(key: K, ...args: DescriptorArgs<K>): MessageDescriptor {
  return { key, ...(args[0] ? { params: args[0] } : {}) }
}

export function renderMessage(locale: Locale, value: UiMessage): string {
  if (typeof value === 'string') return value
  const params = Object.fromEntries(Object.entries(value.params ?? {}).map(([key, part]) => [key, typeof part === 'object' ? renderMessage(locale, part) : part]))
  return formatMessage(catalogs[locale]?.[value.key] || catalogs.en[value.key], params)
}

/** A second argument carries display metadata without changing legacy log callbacks. */
export function emitMessage(log: (text: string, descriptor?: MessageDescriptor) => void, value: MessageDescriptor): void {
  log(renderMessage('tr', value), value)
}
