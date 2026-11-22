// SPDX-License-Identifier: AGPL-3.0-only
import { catalogs } from './index'
import { message, type UiMessage } from './message'

/** Only call for application event records, never user or assistant content. */
export function legacyEvent(text: string): UiMessage {
  for (const key of ['event.refused', 'event.claudeRefused', 'event.length', 'event.briefLength', 'event.briefReady', 'connect.canceled'] as const) {
    if (text === catalogs.tr[key]) return message(key)
  }
  const rounds = /^Tur sınırına \((\d+)\) ulaşıldı; devam etmek için yaz\.$/.exec(text)
  if (rounds) return message('event.rounds', { count: Number(rounds[1]) })
  const kit = /^Üretim kiti güncellendi: (\d+) kalem$/.exec(text)
  if (kit) return message('event.kitUpdated', { count: Number(kit[1]) })
  // Unknown historical diagnostics and generated content remain verbatim.
  return text
}
