// SPDX-License-Identifier: AGPL-3.0-only
// Excel (.xlsx) / CSV asset listesi içe aktarıcı.
// Her sayfada "ID" / "Kod" başlıklı satırı bulur, sütunları Türkçe/İngilizce eş anlamlılarla eşler.
import fs from 'node:fs'
import path from 'node:path'
import type { AssetKind, AssetSpec, ImportResult, MaterialEntry, PaletteEntry } from '../../shared/types'
import { parseTriBudget } from '../../shared/templates'
import { parseDelimited, readXlsx } from './spreadsheet'

const fold = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşüâîû]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' })[c] ?? c)
    .replace(/\s+/g, ' ')
    .trim()

type Field = 'id' | 'name' | 'category' | 'subcategory' | 'description' | 'size' | 'materials' | 'variants' | 'budget' | 'priority' | 'status'

const SYNONYMS: Record<Field, string[]> = {
  id: ['id', 'kod', 'code'],
  name: ['ad', 'isim', 'name', 'asset'],
  category: ['kategori', 'category'],
  subcategory: ['alt kategori', 'subcategory'],
  description: ['tasarim notu', 'aciklama', 'description', 'gorunum', 'siluet ve anatomi', 'not'],
  size: ['boyut (m)', 'boyut', 'boy / kutle', 'boy', 'size', 'dimensions'],
  materials: ['renk / malzeme (palet)', 'renk (palet)', 'renk / malzeme', 'renk', 'malzeme', 'material'],
  variants: ['varyant', 'varyasyon', 'variants'],
  budget: ['ucgen butcesi', 'poligon butcesi', 'tri budget', 'polycount', 'butce'],
  priority: ['oncelik', 'priority'],
  status: ['durum', 'status']
}

function sheetKind(name: string): AssetKind | 'palette' | 'materials' | null {
  const n = fold(name)
  if (/palet|palette/.test(n)) return 'palette'
  if (/malzeme|material/.test(n)) return 'materials'
  if (/yaratik|creature|monster/.test(n)) return 'creature'
  if (/karakter|character/.test(n)) return 'character'
  if (/ses|sound|sfx|audio/.test(n)) return 'sfx'
  if (/muzik|music/.test(n)) return 'music'
  if (/doku|texture/.test(n)) return 'texture'
  if (/vfx|efekt/.test(n)) return 'vfx'
  if (/model|prop|mesh|asset/.test(n)) return 'model'
  return null
}

type Table = { name: string; rows: string[][] }

async function readTables(file: string): Promise<Table[]> {
  const ext = path.extname(file).toLowerCase()
  if (ext === '.csv' || ext === '.tsv') {
    const text = (await fs.promises.readFile(file, 'utf8')).replace(/^﻿/, '')
    return [{ name: path.basename(file, ext), rows: parseDelimited(text, ext === '.tsv' ? '\t' : undefined) }]
  }
  if (ext === '.xls') throw new Error('Eski .xls biçimi desteklenmiyor. Dosyayı Excel’de .xlsx olarak kaydedip tekrar dene.')
  return readXlsx(await fs.promises.readFile(file))
}

function findHeader(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = rows[i].map(fold)
    if (cells.some((c) => c === 'id' || c === 'kod' || c === 'code' || c === 'materyal') && cells.filter(Boolean).length >= 3) return i
  }
  return -1
}

function mapColumns(header: string[]): { fields: Partial<Record<Field, number>>; extra: number[] } {
  const fields: Partial<Record<Field, number>> = {}
  const used = new Set<number>()
  const folded = header.map(fold)
  for (const field of Object.keys(SYNONYMS) as Field[]) {
    for (const syn of SYNONYMS[field]) {
      const idx = folded.findIndex((h, i) => !used.has(i) && h === syn)
      if (idx >= 0) {
        fields[field] = idx
        used.add(idx)
        break
      }
    }
  }
  // Tam eşleşme yoksa "başlıyor" eşleşmesi dene
  for (const field of Object.keys(SYNONYMS) as Field[]) {
    if (fields[field] !== undefined) continue
    const idx = folded.findIndex((h, i) => !used.has(i) && h && SYNONYMS[field].some((s) => h.startsWith(s)))
    if (idx >= 0) {
      fields[field] = idx
      used.add(idx)
    }
  }
  const extra = header.map((_, i) => i).filter((i) => !used.has(i) && header[i])
  return { fields, extra }
}

export async function importAssetList(file: string): Promise<ImportResult> {
  const tables = await readTables(file)
  const result: ImportResult = { assets: [], palette: [], materials: [], sheets: [] }

  for (const t of tables) {
    const kind = sheetKind(t.name) ?? (tables.length === 1 ? 'model' : null)
    const h = findHeader(t.rows)
    if (!kind || h < 0) {
      result.sheets.push({ name: t.name, rows: 0, usedAs: 'atlandı' })
      continue
    }
    const header = t.rows[h]
    const body = t.rows.slice(h + 1).filter((r) => r.some(Boolean))
    const col = (r: string[], i?: number) => (i === undefined ? '' : (r[i] ?? '').trim())

    if (kind === 'palette') {
      const f = header.map(fold)
      const at = (names: string[]) => f.findIndex((x) => names.includes(x))
      const [ci, gi, ni, hi, ui] = [at(['kod', 'code']), at(['grup', 'group']), at(['ad', 'name']), at(['hex']), at(['kullanim', 'usage'])]
      for (const r of body) {
        if (!r[ci]) continue
        result.palette.push({ code: r[ci], group: r[gi] ?? '', name: r[ni] ?? '', hex: r[hi] ?? '', usage: r[ui] ?? '' } satisfies PaletteEntry)
      }
      result.sheets.push({ name: t.name, rows: result.palette.length, usedAs: 'palet' })
      continue
    }
    if (kind === 'materials') {
      const f = header.map(fold)
      const at = (names: string[]) => f.findIndex((x) => names.some((n) => x.startsWith(n)))
      const idx = {
        name: at(['materyal', 'material', 'ad']),
        group: at(['grup', 'group']),
        desc: at(['aciklama', 'description']),
        pal: at(['palet', 'palette']),
        notes: at(['parametre', 'not', 'notes']),
        pri: at(['oncelik', 'priority'])
      }
      for (const r of body) {
        if (!r[idx.name]) continue
        result.materials.push({
          name: r[idx.name],
          group: r[idx.group] ?? '',
          description: r[idx.desc] ?? '',
          palette: r[idx.pal] ?? '',
          notes: r[idx.notes] ?? '',
          priority: r[idx.pri] ?? ''
        } satisfies MaterialEntry)
      }
      result.sheets.push({ name: t.name, rows: result.materials.length, usedAs: 'malzemeler' })
      continue
    }

    const { fields, extra } = mapColumns(header)
    let count = 0
    for (const r of body) {
      const id = col(r, fields.id)
      const name = col(r, fields.name)
      if (!id && !name) continue
      const budgetText = col(r, fields.budget)
      const extras: Record<string, string> = {}
      for (const i of extra) if (r[i]) extras[header[i]] = r[i]
      const asset: AssetSpec = {
        id: id || `${t.name}-${count + 1}`,
        name: name || id,
        kind,
        category: col(r, fields.category) || (id.includes('-') ? id.split('-')[0] : ''),
        subcategory: col(r, fields.subcategory),
        description: col(r, fields.description),
        size: col(r, fields.size),
        materials: col(r, fields.materials),
        variants: col(r, fields.variants),
        triBudget: parseTriBudget(budgetText),
        budgetNote: budgetText,
        priority: col(r, fields.priority),
        status: col(r, fields.status),
        source: t.name,
        extra: extras
      }
      // Modeller sayfasındaki karakter/robot kategorileri
      if (kind === 'model' && /^KAR/i.test(asset.category)) asset.kind = 'character'
      result.assets.push(asset)
      count++
    }
    result.sheets.push({ name: t.name, rows: count, usedAs: kind })
  }
  return result
}
