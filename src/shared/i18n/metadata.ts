// SPDX-License-Identifier: AGPL-3.0-only
import { NODE_DEF_MAP } from '../nodes'
import { PIPELINE_TEMPLATES } from '../templates'
import type { Pipeline } from '../types'
import { panelLabel } from './display'
import type { Locale } from './index'
import { animSystemInfo } from '../animSystems'
import type { AnimSystemClip, AnimSystemKind } from '../types'
import type { AnimSystem } from '../types'
import { message, renderMessage, type UiMessage } from './message'
import type { MessageKey } from './index'
import { templateRows } from './templates'

export function pipelineTitle(id: string, name: string): UiMessage {
  const original = PIPELINE_TEMPLATES.find((template) => template.id === id)
  const key = `template.${id}.name`
  return original?.name === name && Object.hasOwn(templateRows, key) ? { key: key as MessageKey } : name
}

export function serverTitle(id: string, name: string): UiMessage {
  if (id === 'local' && name === 'Bu bilgisayar (AssetForge kurulumu)') return message('comfy.localManaged')
  if (id === 'local' && name === 'Bu bilgisayar') return message('comfy.local')
  if (id === 'remote' && name === 'Uzak ComfyUI') return message('comfy.remote')
  return name
}

export const serverText = (locale: Locale, id: string, name: string): string => renderMessage(locale, serverTitle(id, name))

export function axisText(locale: Locale, system: AnimSystem, axis: 'x' | 'y'): string {
  const value = system.axes?.[axis]?.name ?? axis.toUpperCase()
  const original = animSystemInfo(system.kind).axes?.[axis]?.name
  return value === original ? panelLabel(locale, value) : value
}

export function systemName(locale: Locale, system: AnimSystem, characterName: string): string {
  const title = animSystemInfo(system.kind).title
  return system.name === `${characterName} · ${title}` ? `${characterName} · ${panelLabel(locale, title)}` : system.name
}

export function clipText(locale: Locale, kind: AnimSystemKind, clip: AnimSystemClip, field: 'label' | 'group' = 'label'): string {
  const original = animSystemInfo(kind)
    .clips()
    .find((c) => c.key === clip.key)
  return original && original[field] === clip[field] ? panelLabel(locale, original[field]) : clip[field]
}

/** Project immutable definitions for display, leaving execution defaults and option values intact. */
export function nodeDefinition(locale: Locale, type: string) {
  const def = NODE_DEF_MAP[type]
  return (
    def && {
      ...def,
      label: panelLabel(locale, def.label),
      description: panelLabel(locale, def.description),
      inputs: def.inputs.map((port) => ({ ...port, label: panelLabel(locale, port.label) })),
      outputs: def.outputs.map((port) => ({ ...port, label: panelLabel(locale, port.label) })),
      params: def.params.map((param) => ({
        ...param,
        label: panelLabel(locale, param.label),
        help: param.help && panelLabel(locale, param.help),
        options: param.options?.map((option) => ({ ...option, label: panelLabel(locale, option.label) }))
      }))
    }
  )
}

/** A stable ID and an unchanged default field are both required; custom names are data. */
export function pipelineText(locale: Locale, pipeline: Pick<Pipeline, 'id' | 'name' | 'description'>, field: 'name' | 'description' = 'name'): string {
  const original = PIPELINE_TEMPLATES.find((template) => template.id === pipeline.id)
  return original && original[field] === pipeline[field] ? panelLabel(locale, original[field]) : pipeline[field]
}
