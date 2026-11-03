// SPDX-License-Identifier: AGPL-3.0-only
// Asistan yanıtları için küçük, güvenli markdown görüntüleyici (HTML enjekte etmez)
import { Fragment, type ReactNode } from 'react'

function inline(s: string, key: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <b key={key + i}>{p.slice(2, -2)}</b>
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2) return <code key={key + i}>{p.slice(1, -1)}</code>
    return <Fragment key={key + i}>{p}</Fragment>
  })
}

export default function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = []
  const lines = text.split(/\r?\n/)
  let list: { ordered: boolean; items: string[] } | null = null
  const flush = () => {
    if (!list) return
    const items = list.items.map((it, i) => <li key={i}>{inline(it, `l${out.length}-${i}-`)}</li>)
    out.push(list.ordered ? <ol key={out.length}>{items}</ol> : <ul key={out.length}>{items}</ul>)
    list = null
  }
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (l.startsWith('```')) {
      flush()
      const code: string[] = []
      while (++i < lines.length && !lines[i].startsWith('```')) code.push(lines[i])
      out.push(<pre key={out.length}>{code.join('\n')}</pre>)
      continue
    }
    const ul = /^\s*[-*•]\s+(.*)$/.exec(l)
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(l)
    if (ul || ol) {
      const ordered = !!ol
      if (!list || list.ordered !== ordered) {
        flush()
        list = { ordered, items: [] }
      }
      list.items.push((ul ?? ol)![1])
      continue
    }
    flush()
    const h = /^#{1,4}\s+(.*)$/.exec(l)
    if (h) out.push(<h4 key={out.length}>{inline(h[1], `h${out.length}`)}</h4>)
    else if (l.trim()) out.push(<p key={out.length}>{inline(l, `p${out.length}`)}</p>)
  }
  flush()
  return <div className="md">{out}</div>
}
