// SPDX-License-Identifier: AGPL-3.0-only
// Oyun tasarımı yardımcıları: boş tasarım, şema yerleşimi, yapay zekâ bağlamı ve GDD (Markdown) çıktısı.
import type { DesignGraph, DesignNodeType, GameDesign, Project, UiScreen } from './types'

export const NODE_TYPES: { value: DesignNodeType; label: string; color: string }[] = [
  { value: 'action', label: 'Eylem', color: '#3b82f6' },
  { value: 'challenge', label: 'Zorluk', color: '#ef4444' },
  { value: 'reward', label: 'Ödül', color: '#eab308' },
  { value: 'progress', label: 'İlerleme', color: '#22c55e' },
  { value: 'decision', label: 'Karar', color: '#a855f7' },
  { value: 'story', label: 'Hikâye', color: '#ec4899' },
  { value: 'state', label: 'Durum', color: '#64748b' }
]

export const SCOPES: { value: DesignGraph['scope']; label: string; hint: string }[] = [
  { value: 'core', label: 'Çekirdek döngü', hint: 'saniyeler: oyuncunun sürekli tekrarladığı eylem' },
  { value: 'session', label: 'Oturum döngüsü', hint: 'dakikalar: görev / maç / bölüm' },
  { value: 'meta', label: 'Meta döngü', hint: 'günler: gelişim, koleksiyon, ekonomi' },
  { value: 'story', label: 'Hikâye döngüsü', hint: 'anlatının tekrar eden ritmi' },
  { value: 'other', label: 'Serbest akış', hint: 'herhangi bir akış şeması' }
]

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

export function defaultDesign(): GameDesign {
  return { pitch: '', fantasy: '', audience: '', pillars: [], mechanics: [], loops: [], story: { premise: '', themes: [], acts: [], characters: [] }, screens: [] }
}

/** Eski / eksik tasarımı tamamlar */
export function normalizeDesign(d?: Partial<GameDesign>): GameDesign {
  const b = defaultDesign()
  return { ...b, ...d, story: { ...b.story, ...d?.story }, loops: d?.loops ?? [], screens: d?.screens ?? [] }
}

/** Döngüler doğal olarak çember: düğümleri çemberin üzerine dizer */
export function circleLayout<T extends { x: number; y: number }>(nodes: T[], radius?: number): T[] {
  const n = nodes.length
  const r = radius ?? Math.max(160, n * 55)
  return nodes.map((nd, i) => {
    const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2
    return { ...nd, x: Math.round(r + r * Math.cos(a)), y: Math.round(r + r * Math.sin(a)) }
  })
}

/** Ekran akışı için katman katman (soldan sağa) yerleşim */
export function screenLayout(screens: UiScreen[]): Record<string, { x: number; y: number }> {
  const depth = new Map<string, number>()
  const ids = new Set(screens.map((s) => s.id))
  const incoming = new Set(screens.flatMap((s) => s.next.filter((n) => ids.has(n) && n !== s.id)))
  const roots = screens.filter((s) => !incoming.has(s.id))
  const queue = (roots.length ? roots : screens.slice(0, 1)).map((s) => s.id)
  for (const id of queue) depth.set(id, 0)
  while (queue.length) {
    const id = queue.shift()!
    const d = depth.get(id)!
    for (const n of screens.find((s) => s.id === id)?.next ?? []) {
      if (ids.has(n) && !depth.has(n)) {
        depth.set(n, d + 1)
        queue.push(n)
      }
    }
  }
  for (const s of screens) if (!depth.has(s.id)) depth.set(s.id, 0)
  const rows = new Map<number, number>()
  const out: Record<string, { x: number; y: number }> = {}
  for (const s of screens) {
    const d = depth.get(s.id)!
    const r = rows.get(d) ?? 0
    rows.set(d, r + 1)
    out[s.id] = { x: d * 260, y: r * 130 }
  }
  return out
}

function loopLine(g: DesignGraph): string {
  const name = (id: string) => g.nodes.find((n) => n.id === id)?.label ?? id
  const steps = g.edges.map((e) => `${name(e.from)} → ${name(e.to)}${e.label ? ` (${e.label})` : ''}`)
  return steps.length ? steps.join('; ') : g.nodes.map((n) => n.label).join(' → ')
}

/** Asset üretimi ve ajanlar için kısa tasarım özeti (İngilizce başlıklar, içerik kullanıcının dilinde) */
export function designContext(d?: GameDesign): string {
  if (!d) return ''
  const lines: string[] = []
  if (d.pitch) lines.push(`PITCH: ${d.pitch}`)
  if (d.fantasy) lines.push(`PLAYER FANTASY: ${d.fantasy}`)
  if (d.pillars.length) lines.push(`DESIGN PILLARS: ${d.pillars.join(' | ')}`)
  if (d.mechanics.length) lines.push(`MECHANICS: ${d.mechanics.map((m) => m.name).join(', ')}`)
  for (const g of d.loops.slice(0, 4)) lines.push(`${g.scope.toUpperCase()} LOOP "${g.name}": ${loopLine(g)}`)
  if (d.story.premise) lines.push(`STORY PREMISE: ${d.story.premise}`)
  if (d.story.characters.length) lines.push(`CHARACTERS: ${d.story.characters.map((c) => `${c.name} (${c.role})`).join(', ')}`)
  if (d.screens.length) lines.push(`UI SCREENS: ${d.screens.map((s) => s.name).join(', ')}`)
  return lines.length ? `GAME DESIGN\n${lines.join('\n')}` : ''
}

const WIDGET_TR: Record<string, string> = { text: 'Metin', button: 'Düğme', image: 'Görsel', bar: 'Çubuk', list: 'Liste', icon: 'İkon', input: 'Giriş', panel: 'Panel' }

/** Tasarım dokümanı (GDD) — Markdown */
export function designMarkdown(p: Project): string {
  const d = normalizeDesign(p.design)
  const b = p.bible
  const out: string[] = [`# ${b.projectName || p.name} — Oyun Tasarım Dokümanı`, '']
  if (b.genre) out.push(`**Tür:** ${b.genre}  `)
  if (d.audience) out.push(`**Hedef kitle:** ${d.audience}  `)
  if (b.setting) out.push(`**Mekân / dönem:** ${b.setting}`)
  out.push('')
  if (d.pitch) out.push('## Tek cümlede', '', d.pitch, '')
  if (d.fantasy) out.push('## Oyuncu fantezisi', '', d.fantasy, '')
  if (d.pillars.length) out.push('## Tasarım sütunları', '', ...d.pillars.map((x) => `- ${x}`), '')
  if (d.mechanics.length) out.push('## Mekanikler', '', ...d.mechanics.map((m) => `- **${m.name}:** ${m.description}`), '')
  if (d.loops.length) {
    out.push('## Döngüler', '')
    for (const g of d.loops) {
      const scope = SCOPES.find((s) => s.value === g.scope)?.label ?? g.scope
      out.push(`### ${g.name} (${scope})`, '')
      if (g.description) out.push(g.description, '')
      out.push('```mermaid', 'flowchart LR')
      for (const n of g.nodes) out.push(`  ${n.id}["${n.label.replace(/"/g, "'")}"]`)
      for (const e of g.edges) out.push(`  ${e.from} -->${e.label ? `|${e.label.replace(/[|"]/g, ' ')}|` : ''} ${e.to}`)
      out.push('```', '')
      const notes = g.nodes.filter((n) => n.note)
      if (notes.length) out.push(...notes.map((n) => `- **${n.label}:** ${n.note}`), '')
    }
  }
  const st = d.story
  if (st.premise || st.acts.length || st.characters.length) {
    out.push('## Hikâye', '')
    if (st.premise) out.push(st.premise, '')
    if (st.themes.length) out.push(`**Temalar:** ${st.themes.join(', ')}`, '')
    for (const a of st.acts) {
      out.push(`### ${a.title}`, '', a.summary, '')
      if (a.beats.length) out.push(...a.beats.map((x, i) => `${i + 1}. ${x}`), '')
    }
    if (st.characters.length) {
      out.push('### Karakterler', '')
      for (const c of st.characters) out.push(`- **${c.name}** (${c.role}): ${c.description}${c.arc ? ` — *Gelişim:* ${c.arc}` : ''}`)
      out.push('')
    }
  }
  if (d.screens.length) {
    out.push('## Arayüz ekranları', '')
    const byId = new Map(d.screens.map((s) => [s.id, s.name]))
    for (const s of d.screens) {
      out.push(`### ${s.name} (${s.layer === 'hud' ? 'HUD' : s.layer === 'popup' ? 'açılır pencere' : 'menü'})`, '', s.purpose, '')
      if (s.when) out.push(`**Ne zaman:** ${s.when}`, '')
      if (s.widgets.length) out.push(...s.widgets.map((w) => `- ${WIDGET_TR[w.type] ?? w.type}: ${w.label}${w.binding ? ` ← \`${w.binding}\`` : ''}`), '')
      const nx = s.next.map((n) => byId.get(n)).filter(Boolean)
      if (nx.length) out.push(`**Geçişler:** ${nx.join(', ')}`, '')
    }
  }
  return out.join('\n')
}
