// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { createApi, type ForgeBridge } from '../src/shared/forgeApi'
import { addClient, emit, removeClient, setDesktopSink } from '../src/main/web/hub'
import { allowed } from '../src/main/web/policy'

describe('locale bridge and authorization', () => {
  it('subscribes through the shared bridge and cleans up the listener', () => {
    const callbacks = new Map<string, (value: unknown) => void>()
    const bridge: ForgeBridge = {
      web: false,
      call: async <T>() => undefined as T,
      on: <T>(channel: string, cb: (value: T) => void) => {
        callbacks.set(channel, cb as (value: unknown) => void)
        return () => {
          callbacks.delete(channel)
        }
      },
      pathForFile: () => '',
      dropFile: async () => ''
    }
    for (const web of [false, true]) {
      const values: string[] = []
      const api = createApi({ ...bridge, web })
      const off = api.settings.onLocale((locale) => values.push(locale))
      callbacks.get('settings:locale')?.('zh-CN')
      off()
      expect(values).toEqual(['zh-CN'])
      expect(callbacks.size).toBe(0)
    }
  })

  it('broadcasts only the locale to owner, editor, viewer and desktop', () => {
    const received: unknown[] = []
    setDesktopSink((c, p) => received.push([c, p]))
    const roles = ['owner', 'editor', 'viewer'] as const
    for (const role of roles) addClient({ id: `locale-${role}`, userId: role, name: role, role, since: 0, send: (c, p) => received.push([c, p]) })
    try {
      emit('settings:locale', 'zh-CN')
      expect(received).toEqual(Array.from({ length: 4 }, () => ['settings:locale', 'zh-CN']))
      expect(allowed('owner', 'settings:set')).toBe(true)
      expect(allowed('editor', 'settings:set')).toBe(false)
      expect(allowed('viewer', 'settings:set')).toBe(false)
    } finally {
      for (const role of roles) removeClient(`locale-${role}`)
      setDesktopSink(null)
    }
  })
})
