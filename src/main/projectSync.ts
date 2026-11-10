// SPDX-License-Identifier: AGPL-3.0-only
// Aynı projeyi birden çok kişi düzenlerken kaydetme: her yüklemeye bir sürüm numarası (rev) verilir.
// Kaydeden istemcinin sürümü eskiyse, onun değişiklikleri (yüklediği sürüme göre) diskteki güncel hale işlenir:
// farklı asset'leri, hatları, düğümleri düzenleyen kişilerin değişiklikleri birbirini silmez.
// Aynı alanı iki kişi aynı anda değiştirirse son kaydeden kazanır.
import type { Project } from '../shared/types'
import { loadProject, saveProject } from './project'

const HISTORY = 60
let counter = 0
const history = new Map<number, { dir: string; project: Project }>()

const strip = (p: Project): Project => {
  const { rev: _rev, ...rest } = p
  return rest as Project
}

function remember(dir: string, p: Project): number {
  const rev = ++counter
  history.set(rev, { dir, project: structuredClone(strip(p)) })
  for (const k of history.keys()) {
    if (history.size <= HISTORY) break
    history.delete(k)
  }
  return rev
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
/** Anahtar sırasından bağımsız JSON (birleştirme anahtarları farklı sırayla üretebilir) */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (isObj(v))
    return `{${Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(',')}}`
  return JSON.stringify(v) ?? 'null'
}
const same = (a: unknown, b: unknown) => a === b || stable(a) === stable(b)
const hasIds = (v: unknown): v is { id: string }[] => Array.isArray(v) && v.length > 0 && v.every((x) => isObj(x) && typeof x.id === 'string')

function mergeById(base: { id: string }[], mine: { id: string }[], theirs: { id: string }[]): unknown[] {
  const b = new Map(base.map((x) => [x.id, x]))
  const m = new Map(mine.map((x) => [x.id, x]))
  const out: unknown[] = []
  for (const t of theirs) {
    const inBase = b.get(t.id)
    const inMine = m.get(t.id)
    if (inBase && !inMine) continue // ben sildim
    if (inMine) out.push(inBase ? merge3(inBase, inMine, t) : inMine)
    else out.push(t) // onlar ekledi
  }
  const kept = new Set(theirs.map((t) => t.id))
  for (const x of mine) {
    if (kept.has(x.id)) continue
    // Ben ekledim ya da onlar sildi ama ben değiştirdim: emeğim kaybolmasın
    if (!b.has(x.id) || !same(b.get(x.id), x)) out.push(x)
  }
  return out
}

/** Üç yönlü birleştirme: base = istemcinin yüklediği, mine = istemcinin gönderdiği, theirs = diskteki güncel */
export function merge3<T>(base: T, mine: T, theirs: T): T {
  if (same(mine, base)) return theirs
  if (same(theirs, base)) return mine
  if (isObj(base) && isObj(mine) && isObj(theirs)) {
    const out: Record<string, unknown> = {}
    for (const k of new Set([...Object.keys(theirs), ...Object.keys(mine)])) {
      const v = merge3(base[k], mine[k], theirs[k])
      if (v !== undefined) out[k] = v
    }
    return out as T
  }
  const arr = (v: unknown) => (Array.isArray(v) ? v : [])
  if ((hasIds(mine) || hasIds(theirs) || hasIds(base)) && Array.isArray(mine) && Array.isArray(theirs)) {
    return mergeById(arr(base) as { id: string }[], mine as { id: string }[], theirs as { id: string }[]) as T
  }
  return mine
}

/** Diskten yükler ve bu hale bir sürüm numarası verir */
export function loadSynced(dir: string): Project {
  const p = loadProject(dir)
  return { ...p, rev: remember(dir, p) }
}

/**
 * İstemcinin kaydı. Sürümü güncelse doğrudan yazılır; değilse güncel hale birleştirilir.
 * merged=true ise istemci dönen projeyi almalıdır (başkalarının değişiklikleri eklendi).
 */
export function saveSynced(dir: string, client: Project): { project: Project; rev: number; merged: boolean } {
  const mine = strip(client)
  const base = client.rev ? history.get(client.rev) : undefined
  let out = mine
  let merged = false
  if (base && base.dir === dir) {
    const theirs = loadProject(dir)
    if (!same(theirs, base.project)) {
      out = merge3(base.project, mine, theirs)
      merged = !same(out, mine)
    }
  }
  saveProject(dir, out)
  const rev = remember(dir, out)
  return { project: { ...out, rev }, rev, merged }
}

/** Asistan, MCP ya da sistem projeyi kendisi kaydetti: yayınlanacak hale sürüm numarası ver */
export function adoptSynced(dir: string, p: Project): Project {
  return { ...strip(p), rev: remember(dir, p) }
}
