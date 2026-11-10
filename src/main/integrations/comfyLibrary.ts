// SPDX-License-Identifier: AGPL-3.0-only
// ComfyUI workflow kitaplığı: kullanıcının eklediği API formatı workflow'lar AssetForge'un veri klasöründe
// saklanır (asıl dosya taşınsa da bozulmaz). Düğümler kitaplıktan seçer; her workflow bir sunucu tercih edebilir.
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { ComfyFit, ComfyWorkflowEntry } from '../../shared/types'
import { analyzeWorkflow } from '../providers/comfyui'
import { clearLegacyComfyWorkflow, getSettings, saveComfyWorkflows } from '../settings'
import { ensureDir, newId, resourcePath } from '../util'
import { fitOn, listServers } from './comfyServers'

const dir = () => ensureDir(path.join(app.getPath('userData'), 'comfy-workflows'))
const fileOf = (id: string) => path.join(dir(), `${id.replace(/[^\w-]/g, '')}.json`)
export const BUILTIN_WORKFLOW = () => resourcePath('comfyui', 'default_workflow_api.json')

export const listWorkflows = (): ComfyWorkflowEntry[] => getSettings().comfyWorkflows

function uniqueName(want: string): string {
  const names = new Set(listWorkflows().map((w) => w.name))
  if (!names.has(want)) return want
  for (let i = 2; ; i++) if (!names.has(`${want} (${i})`)) return `${want} (${i})`
}

/** Dosyadan ya da yapıştırılan JSON'dan ekler. Arayüz formatı ve bozuk JSON anlaşılır hatayla reddedilir. */
export function importWorkflow(o: { file?: string; json?: string; name?: string }): ComfyWorkflowEntry {
  const text = o.json ?? (o.file ? fs.readFileSync(o.file, 'utf8') : '')
  if (!text.trim()) throw new Error('Workflow boş')
  const sum = analyzeWorkflow(text.replace(/^﻿/, ''))
  const fallback = o.file
    ? path
        .basename(o.file)
        .replace(/\.json$/i, '')
        .replace(/[_-]+/g, ' ')
    : `Workflow ${listWorkflows().length + 1}`
  const entry: ComfyWorkflowEntry = {
    id: newId('wf'),
    name: uniqueName((o.name ?? '').trim() || fallback),
    ...sum,
    serverId: '',
    addedAt: Date.now(),
    source: o.file
  }
  fs.writeFileSync(fileOf(entry.id), text.replace(/^﻿/, ''))
  saveComfyWorkflows([...listWorkflows(), entry])
  return entry
}

export function updateWorkflow(id: string, patch: { name?: string; serverId?: string }): ComfyWorkflowEntry {
  const list = listWorkflows()
  const w = list.find((x) => x.id === id)
  if (!w) throw new Error('Workflow bulunamadı')
  const next = { ...w, ...(patch.name?.trim() ? { name: patch.name.trim() } : {}), ...(patch.serverId !== undefined ? { serverId: patch.serverId } : {}) }
  saveComfyWorkflows(list.map((x) => (x.id === id ? next : x)))
  return next
}

/** Dosyayı yeniden okuyup özetini tazeler (kullanıcı ComfyUI'da yeniden dışa aktarıp yerine koyduysa) */
export function replaceWorkflow(id: string, o: { file?: string; json?: string }): ComfyWorkflowEntry {
  const list = listWorkflows()
  const w = list.find((x) => x.id === id)
  if (!w) throw new Error('Workflow bulunamadı')
  const text = (o.json ?? (o.file ? fs.readFileSync(o.file, 'utf8') : '')).replace(/^﻿/, '')
  const next = { ...w, ...analyzeWorkflow(text), source: o.file ?? w.source }
  fs.writeFileSync(fileOf(id), text)
  saveComfyWorkflows(list.map((x) => (x.id === id ? next : x)))
  return next
}

export function removeWorkflow(id: string): void {
  saveComfyWorkflows(listWorkflows().filter((x) => x.id !== id))
  fs.rmSync(fileOf(id), { force: true })
}

export function duplicateWorkflow(id: string): ComfyWorkflowEntry {
  const w = listWorkflows().find((x) => x.id === id)
  if (!w) throw new Error('Workflow bulunamadı')
  const copy = { ...w, id: newId('wf'), name: uniqueName(`${w.name} kopya`), addedAt: Date.now() }
  fs.copyFileSync(fileOf(id), fileOf(copy.id))
  saveComfyWorkflows([...listWorkflows(), copy])
  return copy
}

export function setDefaultWorkflow(id: string): void {
  if (id && !listWorkflows().some((w) => w.id === id)) throw new Error('Workflow bulunamadı')
  saveComfyWorkflows(listWorkflows(), id)
}

export function workflowText(id: string): string {
  return fs.readFileSync(id ? fileOf(id) : BUILTIN_WORKFLOW(), 'utf8')
}

export function workflowFilePath(id: string): string {
  return id ? fileOf(id) : BUILTIN_WORKFLOW()
}

/**
 * Düğümdeki "workflow" değerinden dosya: kitaplık kimliği, eski sürümlerden kalan dosya yolu ya da boş (= varsayılan).
 * Boşsa Ayarlar'daki varsayılan, o da yoksa yerleşik SDXL şablonu.
 */
export function resolveWorkflow(param: string): { path: string; name: string; serverId: string } {
  const v = param.trim().replace(/^"|"$/g, '')
  const lib = listWorkflows()
  const pick = (w: ComfyWorkflowEntry) => ({ path: fileOf(w.id), name: w.name, serverId: w.serverId })
  if (v) {
    const w = lib.find((x) => x.id === v)
    if (w) return pick(w)
    if (fs.existsSync(v)) return { path: v, name: path.basename(v), serverId: '' }
    throw new Error(`ComfyUI workflow bulunamadı: ${v}. Düğümde kitaplıktan bir workflow seçin.`)
  }
  const s = getSettings()
  const d = lib.find((x) => x.id === s.comfyDefaultWorkflow)
  if (d) return pick(d)
  if (s.comfyWorkflow && fs.existsSync(s.comfyWorkflow)) return { path: s.comfyWorkflow, name: path.basename(s.comfyWorkflow), serverId: '' }
  return { path: BUILTIN_WORKFLOW(), name: 'Yerleşik SDXL', serverId: '' }
}

/** Her sunucuda: açık mı, eksik düğüm/model var mı (Ayarlar'daki "Sunucularda denetle") */
export async function fitWorkflow(id: string): Promise<ComfyFit[]> {
  const text = workflowText(id)
  return Promise.all(listServers().map((s) => fitOn(s, text, true)))
}

/** Eski sürümlerin "varsayılan workflow" dosya yolu kitaplığa bir kez taşınır */
export function migrateLegacyWorkflow(): void {
  const s = getSettings()
  if (!s.comfyWorkflow) return
  try {
    if (fs.existsSync(s.comfyWorkflow)) {
      const w = importWorkflow({ file: s.comfyWorkflow })
      setDefaultWorkflow(w.id)
    }
    clearLegacyComfyWorkflow()
  } catch (e) {
    // Bozuk ya da arayüz formatında: yolu bırak, kullanıcı Ayarlar'da görüp düzeltsin
    console.error('[comfy] eski varsayılan workflow taşınamadı:', (e as Error).message)
  }
}
