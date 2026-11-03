// SPDX-License-Identifier: AGPL-3.0-only
// Asset listesi için küçük, yalnızca okuyan tablo okuyucular (bağımlılık: yalnızca fflate).
// .xlsx: sayfa adları, paylaşılan/satır içi/zengin metin, sayılar, mantıksal değerler,
// formül sonuçları (önbellekteki değer) ve tarih biçimli hücreler. CSV/TSV: RFC 4180.
import { strFromU8, unzipSync } from 'fflate'

export type Sheet = { name: string; rows: string[][] }

const MAX_UNZIPPED = 200 * 1024 * 1024

// Ad alanı önekine izin ver: <c>, <x:c> …
const tag = (name: string) => `(?:[\\w.-]+:)?${name}`

function decodeXml(s: string): string {
  return s
    .replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (_m, e: string) => {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      return { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e] ?? _m
    })
    .replace(/_x([0-9a-fA-F]{4})_/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
}

function attr(tagText: string, name: string): string | undefined {
  const m = new RegExp(`\\s(?:[\\w.-]+:)?${name}="([^"]*)"`).exec(tagText)
  return m ? decodeXml(m[1]) : undefined
}

/** <si> / <is> içindeki tüm <t> parçalarını birleştirir (fonetik <rPh> hariç) */
function richText(xml: string): string {
  const clean = xml.replace(new RegExp(`<${tag('rPh')}[\\s>][\\s\\S]*?</${tag('rPh')}>`, 'g'), '')
  let out = ''
  for (const m of clean.matchAll(new RegExp(`<${tag('t')}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag('t')}>`, 'g'))) out += m[1]
  return decodeXml(out)
}

/** "BC12" → 54 (0 tabanlı sütun) */
export function columnIndex(ref: string): number {
  let n = 0
  for (const ch of ref.toUpperCase()) {
    const c = ch.charCodeAt(0)
    if (c < 65 || c > 90) break
    n = n * 26 + (c - 64)
  }
  return n - 1
}

const BUILTIN_DATE_FMTS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47])

/** Biçim kodu tarih/saat mi? Tırnak, köşeli parantez ve kaçışlı karakterleri yok sayar. */
export function isDateFormat(code: string): boolean {
  const bare = code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '')
  return /[dmyhs]/i.test(bare) && !/^[#0.,%\s]*$/.test(bare)
}

/** Excel seri tarihi → YYYY-AA-GG */
export function serialToDate(serial: number, date1904 = false): string {
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)
  return new Date(epoch + Math.round(serial * 86400000)).toISOString().slice(0, 10)
}

function dateStyles(stylesXml: string | undefined): Set<number> {
  const out = new Set<number>()
  if (!stylesXml) return out
  const custom = new Map<number, string>()
  for (const m of stylesXml.matchAll(new RegExp(`<${tag('numFmt')}\\s[^>]*>`, 'g'))) {
    const id = Number(attr(m[0], 'numFmtId'))
    const code = attr(m[0], 'formatCode') ?? ''
    custom.set(id, code)
  }
  const xfs = new RegExp(`<${tag('cellXfs')}[^>]*>([\\s\\S]*?)</${tag('cellXfs')}>`).exec(stylesXml)?.[1] ?? ''
  let i = 0
  for (const m of xfs.matchAll(new RegExp(`<${tag('xf')}[\\s/>][^>]*>?`, 'g'))) {
    const id = Number(attr(m[0], 'numFmtId') ?? 0)
    if (BUILTIN_DATE_FMTS.has(id) || (custom.has(id) && isDateFormat(custom.get(id)!))) out.add(i)
    i++
  }
  return out
}

function resolveTarget(target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const parts = ('xl/' + target).split('/')
  const out: string[] = []
  for (const p of parts) {
    if (p === '..') out.pop()
    else if (p && p !== '.') out.push(p)
  }
  return out.join('/')
}

function numberText(v: string): string {
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : v
}

/**
 * CSV/TSV ayrıştırıcı (RFC 4180): tırnak içindeki ayırıcıları, satır sonlarını ve "" kaçışını destekler.
 * Ayırıcı verilmezse ilk satırda tırnak dışında en çok geçen ; , veya sekme seçilir.
 */
export function parseDelimited(text: string, sep?: string): string[][] {
  const delim = sep ?? guessDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
    } else if (ch === '"' && cell.trim() === '') {
      quoted = true
      cell = ''
    } else if (ch === delim) {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell.trim())
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell.trim())
    rows.push(row)
  }
  return rows
}

function guessDelimiter(text: string): string {
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 }
  let quoted = false
  for (const ch of text) {
    if (ch === '"') quoted = !quoted
    else if (!quoted && (ch === '\n' || ch === '\r')) break
    else if (!quoted && ch in counts) counts[ch]++
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return n > 0 ? best : ','
}

export function readXlsx(data: Uint8Array): Sheet[] {
  let total = 0
  const files = unzipSync(data, {
    filter: (f) => {
      if (!/^(xl\/(workbook\.xml|sharedStrings\.xml|styles\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^/]+\.xml))$/.test(f.name)) return false
      total += f.originalSize
      if (total > MAX_UNZIPPED) throw new Error('Excel dosyası açıldığında çok büyük (200 MB üstü)')
      return true
    }
  })
  const text = (name: string) => (files[name] ? strFromU8(files[name]) : undefined)

  const workbook = text('xl/workbook.xml')
  if (!workbook) throw new Error('Geçerli bir .xlsx dosyası değil (xl/workbook.xml yok)')
  const date1904 = /date1904="(1|true)"/.test(workbook)

  const rels = new Map<string, string>()
  for (const m of (text('xl/_rels/workbook.xml.rels') ?? '').matchAll(/<(?:[\w.-]+:)?Relationship\s[^>]*>/g)) {
    const id = attr(m[0], 'Id')
    const target = attr(m[0], 'Target')
    if (id && target) rels.set(id, resolveTarget(target))
  }

  const shared: string[] = []
  const ss = text('xl/sharedStrings.xml')
  if (ss) for (const m of ss.matchAll(new RegExp(`<${tag('si')}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag('si')}>|<${tag('si')}\\s*/>`, 'g'))) shared.push(m[1] ? richText(m[1]) : '')

  const dates = dateStyles(text('xl/styles.xml'))

  const sheets: Sheet[] = []
  for (const m of workbook.matchAll(new RegExp(`<${tag('sheet')}\\s[^>]*>`, 'g'))) {
    const name = attr(m[0], 'name') ?? `Sheet${sheets.length + 1}`
    const path = rels.get(attr(m[0], 'id') ?? '')
    const xml = path ? text(path) : undefined
    if (!xml) continue
    sheets.push({ name, rows: readSheet(xml, shared, dates, date1904) })
  }
  return sheets
}

function readSheet(xml: string, shared: string[], dates: Set<number>, date1904: boolean): string[][] {
  const rows: string[][] = []
  const rowRe = new RegExp(`<${tag('row')}(\\s[^>]*?)?(?:/>|>([\\s\\S]*?)</${tag('row')}>)`, 'g')
  const cellRe = new RegExp(`<${tag('c')}(\\s[^>]*?)?(?:/>|>([\\s\\S]*?)</${tag('c')}>)`, 'g')
  const vRe = new RegExp(`<${tag('v')}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag('v')}>`)
  const isRe = new RegExp(`<${tag('is')}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag('is')}>`)
  for (const rm of xml.matchAll(rowRe)) {
    const rAttr = rm[1] ?? ''
    const r = Number(attr(rAttr, 'r')) || rows.length + 1
    while (rows.length < r - 1) rows.push([])
    const row: string[] = []
    for (const cm of (rm[2] ?? '').matchAll(cellRe)) {
      const a = cm[1] ?? ''
      const body = cm[2] ?? ''
      const ref = attr(a, 'r')
      const col = ref ? columnIndex(ref) : row.length
      const t = attr(a, 't') ?? 'n'
      const raw = vRe.exec(body)?.[1]
      let val = ''
      if (t === 'inlineStr') val = richText(isRe.exec(body)?.[1] ?? '')
      else if (raw === undefined) val = ''
      else if (t === 's') val = shared[Number(raw)] ?? ''
      else if (t === 'b') val = raw.trim() === '1' ? 'true' : 'false'
      else if (t === 'str' || t === 'e') val = decodeXml(raw)
      else if (t === 'd') val = decodeXml(raw).slice(0, 10)
      else {
        const n = Number(raw)
        val = dates.has(Number(attr(a, 's') ?? 0)) && Number.isFinite(n) ? serialToDate(n, date1904) : numberText(raw)
      }
      while (row.length < col) row.push('')
      row[col] = val.trim()
    }
    rows[r - 1] = row
  }
  return rows
}
