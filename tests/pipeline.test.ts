// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { ancestors, descendants, nearestPrompt, topoSort } from '../src/main/engine/graph'
import { NODE_DEF_MAP, NODE_DEFS, defaultParams, portsCompatible } from '../src/shared/nodes'
import { PIPELINE_TEMPLATES, defaultProject, suggestPipeline } from '../src/shared/templates'
import type { Pipeline } from '../src/shared/types'

function graph(nodes: [string, string, number][], edges: [string, string][]): Pipeline {
  return {
    id: 'p',
    name: 'p',
    description: '',
    nodes: nodes.map(([id, type, x]) => ({ id, type, position: { x, y: 0 }, params: {} })),
    edges: edges.map(([s, t]) => ({ id: `${s}->${t}`, source: s, sourceHandle: 'o', target: t, targetHandle: 'i' }))
  }
}

describe('pipeline grafiği', () => {
  const g = graph(
    [
      ['asset', 'asset.input', 0],
      ['prompt', 'prompt.generate', 100],
      ['mesh', 'meshy.text3d', 200],
      ['qa', 'qa.review', 300],
      ['out', 'ue.export', 400]
    ],
    [
      ['asset', 'prompt'],
      ['prompt', 'mesh'],
      ['mesh', 'qa'],
      ['qa', 'out']
    ]
  )

  it('kaynaktan hedefe sıralar', () => {
    expect(topoSort(g)).toEqual(['asset', 'prompt', 'mesh', 'qa', 'out'])
  })

  it('aynı seviyedeki node’ları soldan sağa sıralar', () => {
    const p = graph(
      [
        ['b', 'x', 200],
        ['a', 'x', 100],
        ['c', 'x', 300]
      ],
      []
    )
    expect(topoSort(p)).toEqual(['a', 'b', 'c'])
  })

  it('döngüyü yakalar', () => {
    const p = graph(
      [
        ['a', 'x', 0],
        ['b', 'x', 1]
      ],
      [
        ['a', 'b'],
        ['b', 'a']
      ]
    )
    expect(() => topoSort(p)).toThrow(/döngü/)
  })

  it('ataları ve torunları bulur', () => {
    expect([...ancestors(g, 'qa')].sort()).toEqual(['asset', 'mesh', 'prompt'])
    expect([...descendants(g, 'prompt')].sort()).toEqual(['mesh', 'out', 'qa'])
    expect(ancestors(g, 'asset').size).toBe(0)
  })

  it('QA için en yakın prompt motorunu bulur', () => {
    expect(nearestPrompt(g, 'qa')).toBe('prompt')
    expect(nearestPrompt(g, 'asset')).toBeNull()
  })

  it('geri bildirim hazır şablonlarda doğru düğüme gider (animasyon: Kimodo, ses: prompt motoru)', () => {
    const tpl = (id: string) => PIPELINE_TEMPLATES.find((t) => t.id === id)!
    const qa = (id: string) => tpl(id).nodes.find((n) => n.type === 'qa.review')!.id
    expect(nearestPrompt(tpl('tpl_anim_kimodo'), qa('tpl_anim_kimodo'))).toBe('anim')
    expect(nearestPrompt(tpl('tpl_sfx'), qa('tpl_sfx'))).toBe('prompt')
    expect(nearestPrompt(tpl('tpl_engine_dynamic'), qa('tpl_engine_dynamic'))).toBe('prompt')
  })
})

describe('node tanımları', () => {
  it('node tipleri benzersiz', () => {
    const types = NODE_DEFS.map((d) => d.type)
    expect(new Set(types).size).toBe(types.length)
  })

  it('her node’un port ve parametre kimlikleri benzersiz', () => {
    for (const d of NODE_DEFS) {
      for (const list of [d.inputs, d.outputs, d.params]) {
        const ids = list.map((x) => x.id)
        expect(new Set(ids).size, `${d.type}`).toBe(ids.length)
      }
    }
  })

  it('select parametrelerinin varsayılanı seçeneklerden biri', () => {
    for (const d of NODE_DEFS)
      for (const p of d.params.filter((x) => x.type === 'select')) {
        expect(
          p.options?.map((o) => o.value),
          `${d.type}.${p.id}`
        ).toContain(p.default)
      }
  })

  it('port uyumluluğu: media her medya tipini kabul eder', () => {
    expect(portsCompatible('model', 'model')).toBe(true)
    expect(portsCompatible('model', 'media')).toBe(true)
    expect(portsCompatible('media', 'audio')).toBe(true)
    expect(portsCompatible('prompt', 'media')).toBe(false)
    expect(portsCompatible('asset', 'prompt')).toBe(false)
  })

  it('bilinmeyen node için boş parametre döner', () => {
    expect(defaultParams('yok.boyle')).toEqual({})
  })
})

describe('hazır hat şablonları', () => {
  it.each(PIPELINE_TEMPLATES.map((p) => [p.id, p] as const))('%s geçerli bir graf', (_id, p) => {
    const ids = new Set(p.nodes.map((n) => n.id))
    expect(ids.size, 'node kimlikleri benzersiz').toBe(p.nodes.length)

    for (const n of p.nodes) expect(NODE_DEF_MAP[n.type], `bilinmeyen node tipi: ${n.type}`).toBeDefined()

    const byId = new Map(p.nodes.map((n) => [n.id, n]))
    for (const e of p.edges) {
      const src = byId.get(e.source)
      const dst = byId.get(e.target)
      expect(src, `kenar kaynağı yok: ${e.id}`).toBeDefined()
      expect(dst, `kenar hedefi yok: ${e.id}`).toBeDefined()
      const out = NODE_DEF_MAP[src!.type].outputs.find((o) => o.id === e.sourceHandle)
      const inp = NODE_DEF_MAP[dst!.type].inputs.find((i) => i.id === e.targetHandle)
      expect(out, `${src!.type} çıkışı yok: ${e.sourceHandle}`).toBeDefined()
      expect(inp, `${dst!.type} girişi yok: ${e.targetHandle}`).toBeDefined()
      expect(portsCompatible(out!.type, inp!.type), `${e.id}: ${out!.type} → ${inp!.type}`).toBe(true)
    }

    // Zorunlu girişlerin hepsi bağlı
    for (const n of p.nodes) {
      for (const inp of NODE_DEF_MAP[n.type].inputs.filter((i) => !i.optional)) {
        expect(
          p.edges.some((e) => e.target === n.id && e.targetHandle === inp.id),
          `${p.id}/${n.id}: zorunlu giriş bağlı değil (${inp.id})`
        ).toBe(true)
      }
    }

    expect(() => topoSort(p)).not.toThrow()
  })

  it('şablon kimlikleri benzersiz', () => {
    const ids = PIPELINE_TEMPLATES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('her asset türü için önerilen hat var', () => {
    const ids = new Set(PIPELINE_TEMPLATES.map((p) => p.id))
    for (const kind of ['model', 'character', 'creature', 'vehicle', 'weapon', 'texture', 'image', 'sfx', 'music', 'vfx', 'animation']) {
      expect(ids, kind).toContain(suggestPipeline({ kind }))
    }
    expect(ids).toContain(suggestPipeline({ kind: 'sfx', dynamic: true }))
  })

  it('yeni proje şablonların bağımsız kopyasını alır', () => {
    const a = defaultProject('A')
    a.pipelines[0].nodes[0].params.x = 1
    expect(defaultProject('B').pipelines[0].nodes[0].params.x).toBeUndefined()
  })
})
