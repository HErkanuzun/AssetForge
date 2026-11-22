import {panelLabel} from '../../../shared/i18n/display'
import {translate,type Locale} from '../../../shared/i18n'
import { useLocale } from '../i18n'
// SPDX-License-Identifier: AGPL-3.0-only
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { createContext, memo, useContext } from 'react'
import { CATEGORY_META, NODE_DEF_MAP, PORT_COLORS, PROMPT_TARGETS } from '../../../shared/nodes'
import type { NodeRunState, ParamValue } from '../../../shared/types'
import { StatusPill } from './ui'

export type ForgeNodeData = { defType: string; params: Record<string, ParamValue> }
export type ForgeRFNode = Node<ForgeNodeData, 'forge'>

/** Seçili işin node durumları — node'lar canlı durumu buradan okur */
export const RunStateCtx = createContext<Record<string, NodeRunState>>({})

function summary(type: string, params: Record<string, ParamValue>, locale:Locale): string {
  switch (type) {
    case 'prompt.generate':
      return panelLabel(locale,PROMPT_TARGETS[String(params.target)]?.label ?? '')
    case 'model.meshy.text3d':
    case 'model.meshy.image3d':
      return `${params.ai_model} · ${params.texture_resolution}${params.enable_pbr ? ' PBR' : ''}`
    case 'qa.review':
      return translate(locale,'node.qaSummary', {score:String(params.min_score),count:String(params.max_retries)})
    case 'audio.elevenlabs':
      return translate(locale,'node.variations', {count:String(params.variations)})
    case 'blender.process':
      return String(params.format).toUpperCase()
    case 'model.meshy.remesh':
      return `${params.topology} · ${Number(params.target_polycount) || translate(locale,'surface.budget')}`
    default:
      return ''
  }
}

function ForgeNodeView({ id, data, selected }: NodeProps<ForgeRFNode>) {
  const {t,locale} = useLocale()

  const def = NODE_DEF_MAP[data.defType]
  const run = useContext(RunStateCtx)[id]
  if (!def) return <div className="fnode"> {t('panel.a1062b9666')} {data.defType}</div>
  const color = CATEGORY_META[def.category].color
  const rows = Math.max(def.inputs.length, def.outputs.length)

  return (
    <div className={`fnode ${selected ? 'selected' : ''} ${run ? 'r-' + run.status : ''}`} style={{ ['--accent' as string]: color }}>
      <div className="fnode-head">
        <span className="fnode-cat">{panelLabel(locale,CATEGORY_META[def.category].label)}</span>
        <span className="fnode-title">{panelLabel(locale,def.label)}</span>
      </div>
      <div className="fnode-ports">
        {Array.from({ length: rows }).map((_, i) => {
          const inp = def.inputs[i]
          const out = def.outputs[i]
          return (
            <div className="fnode-row" key={i}>
              <div className="port in">
                {inp && (
                  <>
                    <Handle type="target" position={Position.Left} id={inp.id} style={{ background: PORT_COLORS[inp.type] }} />
                    <span>
                      {panelLabel(locale,inp.label)}
                      {inp.optional ? '?' : ''}
                    </span>
                  </>
                )}
              </div>
              <div className="port out">
                {out && (
                  <>
                    <span>{panelLabel(locale,out.label)}</span>
                    <Handle type="source" position={Position.Right} id={out.id} style={{ background: PORT_COLORS[out.type] }} />
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {summary(def.type, data.params, locale) && <div className="fnode-summary">{summary(def.type, data.params, locale)}</div>}
      {run && run.status !== 'idle' && (
        <div className="fnode-run">
          <StatusPill status={run.status} />
          {run.attempts > 1 && <span className="muted small"> {t('panel.25b80b3556')} {run.attempts}</span>}
          {run.status === 'running' && (
            <div className="progress">
              <div style={{ width: `${run.progress}%` }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const ForgeNode = memo(ForgeNodeView)
