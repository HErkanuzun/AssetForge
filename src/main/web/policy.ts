// SPDX-License-Identifier: AGPL-3.0-only
// Web kullanıcılarının rolleri: sahip her şeyi yapar; editör üretir ve düzenler ama Ayarlar'a, anahtarlara,
// kurulumlara ve bu bilgisayarın dosya/klasör pencerelerine dokunamaz; izleyici yalnızca bakar.
// Listede olmayan her işlem yalnızca sahibe açıktır (yeni eklenen işlemler güvenli tarafta kalsın).
import type { Project, WebRole } from '../../shared/types'

const VIEW = new Set([
  'settings:get',
  'project:load',
  'jobs:list',
  'ue:status',
  'comfy:status',
  'comfy:servers',
  'backends:status',
  'brief:list',
  'brief:get',
  'library:thumbs',
  'kimodo:status',
  'animsys:list',
  'animsys:states',
  'agent:clis',
  'agent:list',
  'agent:get',
  'mcp:status',
  'web:me'
])

const EDIT = new Set([
  'project:save',
  'assets:import',
  'bible:extract',
  'design:generate',
  'design:exportMd',
  'design:teachUe',
  'run:start',
  'run:cancel',
  'brief:create',
  'brief:send',
  'brief:patch',
  'brief:delete',
  'brief:toAssets',
  'kimodo:suggest',
  'animsys:create',
  'animsys:save',
  'animsys:delete',
  'animsys:plan',
  'animsys:produce',
  'animsys:stop',
  'animsys:build',
  'agent:create',
  'agent:send',
  'agent:approve',
  'agent:stop',
  'agent:delete',
  'comfy:wf:fit'
])

export function allowed(role: WebRole, channel: string): boolean {
  if (role === 'owner') return true
  if (VIEW.has(channel)) return true
  return role === 'editor' && EDIT.has(channel)
}

/** Editör, terminal izni kapalı bir Ajan Görevi'ni açamaz (bu bilgisayarda komut çalıştırmak sahibin kararı) */
export function shellEscalation(before: Project | null, after: Project): string | null {
  const was = new Set<string>()
  for (const pl of before?.pipelines ?? []) for (const n of pl.nodes) if (n.type === 'agent.task' && n.params.shell === true) was.add(`${pl.id}/${n.id}`)
  for (const pl of after.pipelines ?? [])
    for (const n of pl.nodes) {
      if (n.type === 'agent.task' && n.params.shell === true && !was.has(`${pl.id}/${n.id}`)) {
        return `“${pl.name}” hattındaki Ajan Görevi için terminal izni yalnızca sahip tarafından açılabilir`
      }
    }
  return null
}

export const ROLE_LABEL: Record<WebRole, string> = { owner: 'Sahip', editor: 'Editör', viewer: 'İzleyici' }

const ABS_WIN = /^(?:[A-Za-z]:[\\/]|\\\\)/
const UE_PATH = /^\/(?:Game|Script|Engine)\//
const DOTDOT = /(?:^|[\\/])\.\.(?:[\\/]|$)/

/** Dosya yoluna benzeyen kısa metin (sohbet metinleri ve Unreal içerik yolları sayılmaz) */
export function pathLike(s: string, posix = process.platform !== 'win32'): boolean {
  if (s.length > 1024 || s.includes('\n')) return false
  return ABS_WIN.test(s) || /^file:/i.test(s) || DOTDOT.test(s) || (posix && s.startsWith('/') && !UE_PATH.test(s))
}

/** Bir değerin içindeki tüm metinler (projede zaten kayıtlı yolları bilmek için) */
export function stringsOf(v: unknown, out = new Set<string>(), depth = 0): Set<string> {
  if (typeof v === 'string') out.add(v)
  else if (v && typeof v === 'object' && depth < 40) for (const x of Object.values(v)) stringsOf(x, out, depth + 1)
  return out
}

/**
 * Editör/izleyici bu bilgisayardaki proje klasörü dışındaki dosyaları okutamaz (asistan görseli, PDF, referans…).
 * Projede zaten kayıtlı yollar (ör. Unreal dışa aktarma klasörü) serbesttir. İlk yabancı yolu döner.
 */
export function foreignPath(v: unknown, inside: (p: string) => boolean, known: Set<string>, posix = process.platform !== 'win32', depth = 0): string | null {
  if (typeof v === 'string') return pathLike(v, posix) && !known.has(v) && (/^file:/i.test(v) || !inside(v)) ? v : null
  if (!v || typeof v !== 'object' || depth > 40) return null
  for (const x of Object.values(v)) {
    const bad = foreignPath(x, inside, known, posix, depth + 1)
    if (bad) return bad
  }
  return null
}
