// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { legacyEvent } from '../src/shared/i18n/events'
import fs from 'node:fs'
import path from 'node:path'
import { parse } from '@babel/parser'
import { NODE_DEFS } from '../src/shared/nodes'
import { ANIM_SYSTEMS } from '../src/shared/animSystems'
import { PIPELINE_TEMPLATES } from '../src/shared/templates'
import { nodeDefinition, pipelineText, clipText, axisText, pipelineTitle, serverTitle } from '../src/shared/i18n/metadata'
import { nodeDetailRows } from '../src/shared/i18n/nodeDetails'
import { systemRows } from '../src/shared/i18n/systems'
import { templateRows } from '../src/shared/i18n/templates'
import { panelLabel, hasPanelTranslation } from '../src/shared/i18n/display'
import { LOCALES, catalogs } from '../src/shared/i18n'
import { message, renderMessage, emitMessage, type MessageDescriptor } from '../src/shared/i18n/message'
import { UiError, errorEnvelope, errorMessage, restoreError } from '../src/shared/i18n/errors'
import { judgeMotion, type MotionMetrics } from '../src/shared/motionQa'
import { judgeAudio, type AudioMetrics } from '../src/shared/audioQa'
import { newAnimSystem } from '../src/shared/animSystems'

describe('asynchronous feedback descriptors', () => {
  it('projects only exact historical application events without rewriting their source', () => {
    const text = catalogs.tr['event.briefReady']
    expect(renderMessage('en', legacyEvent(text))).toBe(catalogs.en['event.briefReady'])
    expect(renderMessage('zh-CN', legacyEvent('Üretim kiti güncellendi: 3 kalem'))).toBe('生产套件已更新：3 项')
    expect(legacyEvent('RAW_EXTERNAL_LOG Özel')).toBe('RAW_EXTERNAL_LOG Özel')
    expect(legacyEvent(text + ' user suffix')).toBe(text + ' user suffix')
  })
  it('projects unchanged default pipeline and server names while preserving custom names', () => {
    const template = PIPELINE_TEMPLATES[0]
    expect(renderMessage('zh-CN', pipelineTitle(template.id, template.name))).toBe(pipelineText('zh-CN', template))
    expect(pipelineTitle(template.id, '用户自定义')).toBe('用户自定义')
    expect(renderMessage('zh-CN', serverTitle('local', 'Bu bilgisayar'))).toBe('本机')
    expect(serverTitle('custom', 'Bu bilgisayar')).toBe('Bu bilgisayar')
    expect(serverTitle('local', '用户服务器')).toBe('用户服务器')
  })
  it('keeps nested application explanations reactive and external details verbatim after JSON transport', () => {
    const value = message('provider.error', { provider: 'Meshy', hint: message('provider.invalidKey'), status: 401, detail: 'Özel 服务 <raw>' })
    const restored = restoreError(JSON.parse(JSON.stringify(errorEnvelope(new UiError(value)))))
    expect(renderMessage('en', errorMessage(restored))).toContain('API key is invalid')
    expect(renderMessage('zh-CN', errorMessage(restored))).toContain('API 密钥无效')
    expect(renderMessage('zh-CN', errorMessage(restored))).toContain('Özel 服务 <raw>')
  })
  it('preserves legacy log callbacks and separately carries display metadata', () => {
    let legacy = ''
    let descriptor: MessageDescriptor | undefined
    emitMessage(
      (text, value) => {
        legacy = text
        descriptor = value
      },
      message('feedback.namedDetail', { name: '用户 Özel', detail: message('connect.canceled') })
    )
    expect(legacy).toBe('用户 Özel: İptal edildi')
    expect(renderMessage('zh-CN', descriptor!)).toBe('用户 Özel：已取消')
  })
  it('rejects untrusted descriptor keys and recursive parameter objects', () => {
    expect(errorEnvelope(Object.assign(new Error('raw'), { uiMessage: { key: '__proto__' } }))).toEqual({ error: 'raw' })
    const cyclic: Record<string, unknown> = { key: 'feedback.namedDetail', params: {} }
    cyclic.params = { detail: cyclic }
    expect(errorEnvelope(Object.assign(new Error('raw'), { uiMessage: cyclic }))).toEqual({ error: 'raw' })
  })
  it('translates only unchanged built-in animation axes', () => {
    const info = ANIM_SYSTEMS.find((row) => !!row.axes)!
    const system = newAnimSystem(info.kind, 'character', '用户 Özel', 'A person')
    expect(axisText('zh-CN', system, 'x')).not.toBe(info.axes!.x.name)
    system.axes!.x.name = '用户 Speed'
    expect(axisText('zh-CN', system, 'x')).toBe('用户 Speed')
  })
})

describe('localized metadata stays separate from execution data', () => {
  it('covers source-defined renderer option labels, descriptions and help regardless of language', () => {
    const missing: string[] = []
    const technical = new Set(['1K', '2K', '4K', '8K', 'Claude (Anthropic)', 'WSL2 + Docker', 'Unreal', 'VFX', 'OpenRouter', 'Blender MCP', 'Unreal Engine', 'WAV 22 kHz'])
    const root = 'src/renderer/src'
    const files = fs
      .readdirSync(root, { recursive: true })
      .filter((name) => /\.tsx?$/.test(String(name)))
      .map((name) => path.join(root, String(name)))
    files.push('src/shared/design.ts')
    for (const file of files) {
      const ast = parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['typescript', 'jsx'] })
      const visit = (value: unknown): void => {
        if (!value || typeof value !== 'object') return
        const node = value as { type?: string; key?: { name?: string }; value?: { type?: string; value?: string } }
        if (node.type === 'ObjectProperty' && ['label', 'help', 'desc', 'hint'].includes(node.key?.name ?? '') && node.value?.type === 'StringLiteral') {
          const text = node.value.value!
          if (text && !technical.has(text) && !hasPanelTranslation(text) && !Object.hasOwn(catalogs.en, text)) missing.push(`${file}: ${text}`)
        }
        for (const child of Object.values(value))
          if (Array.isArray(child)) child.forEach(visit)
          else visit(child)
      }
      visit(ast)
    }
    expect(missing).toEqual([])
  })
  it('classifies every node metadata label and help, including plain ASCII text', () => {
    const texts = NODE_DEFS.flatMap((def) => [
      def.label,
      def.description,
      ...def.inputs.map((p) => p.label),
      ...def.outputs.map((p) => p.label),
      ...def.params.flatMap((p) => [p.label, p.help ?? '', ...(p.options?.map((o) => o.label) ?? [])])
    ])
    // File formats, API methods, fixed numeric sizes/ratios, and model/product names.
    const technical = new Set([
      '',
      '0.25 – 4',
      '1024×1024',
      '16:9',
      '1:1',
      '2K',
      '3:4',
      '4:3',
      '4K',
      '512×512',
      '8K',
      '9:16',
      'ElevenLabs SFX',
      'FBX',
      'FLAC',
      'GET',
      'GLB',
      'GPT Image 2',
      'MP3',
      'Meshy 6',
      'Meshy 6 Lite',
      'Meshy 7.1',
      'Nano Banana',
      'Nano Banana 2',
      'Nano Banana 2 Lite',
      'Opus',
      'POST',
      'Smart Topology T2',
      'Smart Topology T2.5',
      'Sound v2',
      'Sound v3',
      'WAV'
    ])
    const missing = [...new Set(texts.filter((text) => !technical.has(text) && !hasPanelTranslation(text)))].sort()
    expect(missing).toEqual([])
  })
  it('covers every animation system explanation, axis and built-in clip/group label', () => {
    const texts = ANIM_SYSTEMS.flatMap((info) => [
      info.title,
      info.short,
      info.what,
      info.when,
      info.pro,
      info.auto,
      info.limits,
      ...Object.values(info.axes ?? {}).map((axis) => axis.name),
      ...info.clips().flatMap((clip) => [clip.label, clip.group])
    ])
    expect([...new Set(texts.filter((text) => text && !hasPanelTranslation(text)))].sort()).toEqual([])
  })
  it.each(LOCALES)('preserves node defaults, ports, IDs and option values in %s', (locale) => {
    const original = structuredClone(NODE_DEFS)
    for (const def of NODE_DEFS) {
      const display = nodeDefinition(locale, def.type)!
      expect(display.type).toBe(def.type)
      expect(display.inputs.map((p) => [p.id, p.type, p.optional])).toEqual(def.inputs.map((p) => [p.id, p.type, p.optional]))
      expect(display.outputs.map((p) => [p.id, p.type])).toEqual(def.outputs.map((p) => [p.id, p.type]))
      expect(display.params.map((p) => [p.id, p.type, p.default, p.source, p.options?.map((o) => o.value)])).toEqual(
        def.params.map((p) => [p.id, p.type, p.default, p.source, p.options?.map((o) => o.value)])
      )
      expect(display.description).toBe(nodeDetailRows[`node.${def.type}.description` as keyof typeof nodeDetailRows][locale === 'en' ? 0 : locale === 'zh-CN' ? 1 : 2])
    }
    expect(NODE_DEFS).toEqual(original)
  })
  it.each(['en', 'zh-CN'] as const)('projects templates by stable ID and preserves renamed content in %s', (locale) => {
    for (const original of PIPELINE_TEMPLATES) {
      const copy = structuredClone(original)
      expect(pipelineText(locale, copy)).toBe(templateRows[`template.${original.id}.name` as keyof typeof templateRows][locale === 'en' ? 0 : 1])
      expect(pipelineText(locale, copy, 'description')).not.toBe(original.description)
      copy.name = '用户的 Özel {name}'
      expect(pipelineText(locale, copy)).toBe(copy.name)
      expect(pipelineText(locale, { ...original, id: 'custom' })).toBe(original.name)
    }
    for (const system of ANIM_SYSTEMS) {
      for (const clip of system.clips()) {
        const saved = structuredClone(clip)
        expect(clipText(locale, system.kind, clip)).toBe(panelLabel(locale, clip.label))
        expect(clipText(locale, system.kind, { ...clip, label: '自定义动作' })).toBe('自定义动作')
        expect(clip).toEqual(saved)
      }
    }
  })
  it('has complete display rows with matching literal placeholders', () => {
    for (const [key, row] of Object.entries({ ...nodeDetailRows, ...systemRows, ...templateRows })) {
      const slots = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
      expect(
        row.every((text) => text.trim().length > 0),
        key
      ).toBe(true)
      expect(slots(row[1]), key).toEqual(slots(row[0]))
      expect(slots(row[2]), key).toEqual(slots(row[0]))
    }
  })
})

describe('feedback transport and live locale rendering', () => {
  it('round trips descriptors through IPC/HTTP JSON and renders with the latest locale', () => {
    const detail = '用户原文 <tag> $& {name}'
    const original = new UiError(message('connect.retryKey', { detail }))
    const received = restoreError(JSON.parse(JSON.stringify(errorEnvelope(original))))
    const display = errorMessage(received)
    expect(renderMessage('en', display)).toContain(detail)
    expect(renderMessage('zh-CN', display)).toBe(`${detail}；可以复制其他密钥，仍在等待。`)
    expect(renderMessage('tr', display)).toBe(original.message)
    expect(restoreError({ error: 'External diagnostic' }).message).toBe('External diagnostic')
    expect(errorMessage({ uiMessage: { key: 'toString' } })).toBe('[object Object]')
  })
  it('keeps technical QA scores and generation fixes identical while localizing issues', () => {
    const metrics: MotionMetrics = { frames: 30, fps: 30, seconds: 1, footSkate: 1.2, skateRatio: 0.8, penetration: 0.1, contactRatio: 0.3, jitter: 1500, pop: 0.3 }
    const motion = judgeMotion(metrics, { stationary: true })
    expect(motion.uiIssues?.length).toBe(motion.issues.length)
    expect(motion.uiIssues?.map((value) => renderMessage('tr', value))).toEqual(motion.issues)
    expect(motion.uiIssues?.map((value) => renderMessage('zh-CN', value)).join(' ')).toContain('脚部')
    expect(motion.promptFix).toContain('feet stay firmly planted')
    const audio: AudioMetrics = { seconds: 1, peakDb: -80, rmsDb: -90, clipped: 0, leadingSilence: 1, trailingSilence: 1, seamJump: 0, seamLevelDb: 0 }
    const result = judgeAudio('用户音频.wav', audio)
    expect(result.score).toBe(0)
    expect(renderMessage('en', result.uiIssues![0])).toBe('用户音频.wav: file is almost completely silent')
    expect(result.fixes).toEqual(['clearly audible, present sound'])
  })
})
