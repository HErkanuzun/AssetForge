// SPDX-License-Identifier: AGPL-3.0-only
import { translate, type Locale } from '../../../shared/i18n'
import type { AriaLabelConfig } from '@xyflow/react'

export function flowLabels(locale: Locale): Partial<AriaLabelConfig> {
  return {
    'node.a11yDescription.default': translate(locale, 'flow.nodeHelp'),
    'node.a11yDescription.keyboardDisabled': translate(locale, 'flow.node'),
    'edge.a11yDescription.default': translate(locale, 'flow.edgeHelp'),
    'controls.ariaLabel': translate(locale, 'flow.controls'),
    'controls.zoomIn.ariaLabel': translate(locale, 'flow.zoomIn'),
    'controls.zoomOut.ariaLabel': translate(locale, 'flow.zoomOut'),
    'controls.fitView.ariaLabel': translate(locale, 'flow.fitView'),
    'controls.interactive.ariaLabel': translate(locale, 'flow.interactive'),
    'minimap.ariaLabel': translate(locale, 'flow.minimap'),
    'handle.ariaLabel': translate(locale, 'flow.handle')
  }
}
