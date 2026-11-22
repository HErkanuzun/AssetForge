// SPDX-License-Identifier: AGPL-3.0-only
import { catalogs, type MessageKey } from './index'
import { message, renderMessage, type MessageDescriptor, type UiMessage } from './message'

/** Carries presentation separately from the legacy diagnostic message. */
export class UiError extends Error {
  readonly uiMessage: MessageDescriptor
  constructor(value: MessageDescriptor, options?: ErrorOptions) {
    super(renderMessage('tr', value), options)
    this.uiMessage = value
  }
}

export function errorMessage(value: unknown): UiMessage {
  const descriptor = value && typeof value === 'object' && 'uiMessage' in value ? value.uiMessage : null
  if (descriptor && typeof descriptor === 'object' && 'key' in descriptor && typeof descriptor.key === 'string' && Object.hasOwn(catalogs.en, descriptor.key)) {
    const params = 'params' in descriptor ? descriptor.params : undefined
    if (validParams(params, 0)) {
      return { key: descriptor.key as MessageKey, ...(params ? { params: params as MessageDescriptor['params'] } : {}) }
    }
  }
  return value instanceof Error ? value.message : String(value)
}

function validParams(params: unknown, depth: number): boolean {
  if (params === undefined) return true
  if (depth > 8 || !params || typeof params !== 'object' || Array.isArray(params)) return false
  return Object.values(params).every(
    (v) => typeof v === 'string' || typeof v === 'number' || (!!v && typeof v === 'object' && typeof v.key === 'string' && Object.hasOwn(catalogs.en, v.key) && validParams(v.params, depth + 1))
  )
}

export function errorEnvelope(value: unknown): { error: string; uiMessage?: MessageDescriptor } {
  const display = errorMessage(value)
  return { error: value instanceof Error ? value.message : String(value), ...(typeof display === 'string' ? {} : { uiMessage: display }) }
}

export function restoreError(value: { error: string; uiMessage?: MessageDescriptor }): Error {
  const display = errorMessage(value)
  return typeof display === 'string' ? new Error(value.error) : Object.assign(new Error(value.error), { uiMessage: display })
}

export const canceledError = () => new UiError(message('connect.canceled'))
