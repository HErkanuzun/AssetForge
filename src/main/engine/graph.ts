// Pipeline grafiği üzerinde saf yardımcılar (Electron'a bağımlı değil, test edilir).
import type { Pipeline } from '../../shared/types'

/** Kaynaktan hedefe çalışma sırası; eşit seviyede soldan sağa (x konumu). Döngü varsa hata. */
export function topoSort(p: Pipeline): string[] {
  const indeg = new Map(p.nodes.map((n) => [n.id, 0]))
  for (const e of p.edges) if (indeg.has(e.target) && indeg.has(e.source)) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1)
  const order: string[] = []
  const queue = [...p.nodes]
    .sort((a, b) => a.position.x - b.position.x)
    .filter((n) => indeg.get(n.id) === 0)
    .map((n) => n.id)
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const e of p.edges.filter((e) => e.source === id)) {
      const d = (indeg.get(e.target) ?? 0) - 1
      indeg.set(e.target, d)
      if (d === 0) queue.push(e.target)
    }
  }
  if (order.length !== p.nodes.length) throw new Error('Pipeline döngü içeriyor (bir node kendine geri bağlanmış)')
  return order
}

/** Bir node'u besleyen tüm üst node'lar */
export function ancestors(p: Pipeline, id: string): Set<string> {
  const out = new Set<string>()
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    for (const e of p.edges) {
      if (e.target === cur && !out.has(e.source)) {
        out.add(e.source)
        stack.push(e.source)
      }
    }
  }
  return out
}

/** Bir node'un etkilediği tüm alt node'lar */
export function descendants(p: Pipeline, id: string): Set<string> {
  const out = new Set<string>()
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    for (const e of p.edges) {
      if (e.source === cur && !out.has(e.target)) {
        out.add(e.target)
        stack.push(e.target)
      }
    }
  }
  return out
}

/** QA node'una en yakın üst Prompt Motoru (geriye doğru BFS) */
export function nearestPrompt(p: Pipeline, qaId: string): string | null {
  const types = new Map(p.nodes.map((n) => [n.id, n.type]))
  const seen = new Set<string>([qaId])
  let frontier = [qaId]
  while (frontier.length) {
    const next: string[] = []
    for (const cur of frontier)
      for (const e of p.edges)
        if (e.target === cur && !seen.has(e.source)) {
          if (types.get(e.source) === 'prompt.generate') return e.source
          seen.add(e.source)
          next.push(e.source)
        }
    frontier = next
  }
  return null
}
