// AssetForge araç kaydı — hem uygulama içi Yapımcı asistanı hem de dışarıya açılan MCP sunucusu bu araçları kullanır.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { AssetKind, AssetSpec, Bible, Job, Project } from '../../shared/types'
import { suggestPipeline } from '../../shared/templates'
import type { Runner } from '../engine/runner'
import { kimodoStatus } from '../integrations/kimodo'
import { discoverUe, execInUe } from '../integrations/ue'
import { listBriefs, listJobs, loadBrief, loadProject, saveProject } from '../project'
import { ANIM_SYSTEMS, animSystemInfo, newAnimSystem, stylePrompt } from '../../shared/animSystems'
import { applyPlan, buildSystemInUe, getSystem, listSystems, produceSystem, saveSystem, systemStates } from '../anim/systems'
import { planAnimSystem } from '../providers/claude'
import { assetContext, bibleContext } from '../providers/claude'
import { getSecret, getSettings } from '../settings'

export interface ToolCtx {
  dir: string
  runner: Runner
  /** Proje diskte değişti → arayüz yenilensin */
  notify: (p: Project) => void
  source: 'assistant' | 'mcp'
}

export interface ToolResult {
  text: string
  /** Proje klasörü içindeki görsel dosyaları (modele görsel olarak gider) */
  images?: string[]
  isError?: boolean
}

export interface AgentTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  /** Girdiyi doğrula */
  parse: (input: unknown) => { ok: true; data: unknown } | { ok: false; error: string }
  /** Onay gerekiyorsa kullanıcıya gösterilecek metin; null = onaysız */
  confirm?: (data: unknown) => string | null
  readOnly?: boolean
  run: (ctx: ToolCtx, data: unknown) => Promise<ToolResult>
}

function tool<S extends z.ZodObject>(def: {
  name: string
  description: string
  schema: S
  readOnly?: boolean
  confirm?: (d: z.infer<S>) => string | null
  run: (ctx: ToolCtx, d: z.infer<S>) => Promise<ToolResult | string>
}): AgentTool {
  const json = z.toJSONSchema(def.schema) as Record<string, unknown>
  delete json.$schema
  return {
    name: def.name,
    description: def.description,
    inputSchema: json,
    readOnly: def.readOnly,
    parse: (input) => {
      const r = def.schema.safeParse(input ?? {})
      return r.success ? { ok: true, data: r.data } : { ok: false, error: r.error.message }
    },
    confirm: def.confirm ? (d) => def.confirm!(d as z.infer<S>) : undefined,
    run: async (ctx, d) => {
      const r = await def.run(ctx, d as z.infer<S>)
      return typeof r === 'string' ? { text: r } : r
    }
  }
}

const KINDS = ['model', 'character', 'creature', 'vehicle', 'weapon', 'texture', 'image', 'sfx', 'music', 'vfx', 'animation'] as const
const PREFIX: Record<string, string> = {
  character: 'KAR',
  creature: 'YRT',
  vehicle: 'ARA',
  weapon: 'SLH',
  model: 'PRP',
  texture: 'DOK',
  image: 'GRS',
  sfx: 'SES',
  music: 'MZK',
  vfx: 'VFX',
  animation: 'ANM'
}

function nextId(p: Project, kind: string): string {
  const pre = PREFIX[kind] ?? 'AST'
  let n = 1
  while (p.assets.some((a) => a.id === `${pre}${String(n).padStart(3, '0')}`)) n++
  return `${pre}${String(n).padStart(3, '0')}`
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + `… (+${s.length - n} karakter)` : s
}

function jobsFor(dir: string, assetId: string): Job[] {
  return listJobs(dir, 500)
    .filter((j) => j.assetId === assetId)
    .sort((a, b) => b.createdAt - a.createdAt)
}

/** İşin çıktılarını (dosyalar, istatistik, QA) özetler */
function jobSummary(j: Job, withLogs = false): string {
  const lines = [`İş ${j.id} · ${j.pipelineName} (${j.pipelineId}) · durum: ${j.status} · ${new Date(j.createdAt).toLocaleString('tr-TR')}`]
  if (j.error) lines.push(`Hata: ${j.error}`)
  if (j.warnings.length) lines.push(`Uyarılar: ${j.warnings.join(' | ')}`)
  lines.push(`Maliyet: Claude $${j.cost.claudeUsd.toFixed(3)} · Meshy ${j.cost.meshyCredits} kredi · ses ${j.cost.audioChars} karakter`)
  for (const [nodeId, st] of Object.entries(j.nodes)) {
    const outs = Object.entries(st.outputs ?? {}).map(([port, o]) => {
      switch (o.kind) {
        case 'model':
          return `${port}=model ${o.file}${o.stats ? ` (${o.stats.tris} üçgen, UV ${o.stats.hasUV ? 'var' : 'yok'}, ${o.stats.dims.map((d) => d.toFixed(2)).join('×')} m${o.rigged ? ', rigli' : ''})` : ''}`
        case 'image':
          return `${port}=görsel ${o.files.join(', ')}`
        case 'audio':
          return `${port}=ses ${o.files.join(', ')}`
        case 'audioset':
          return `${port}=dinamik ses ${o.layers.length} katman`
        case 'animation':
          return `${port}=animasyon ${o.clip} ${o.seconds.toFixed(1)} sn`
        case 'report':
          return `${port}=QA ${o.report.score}/10 ${o.report.pass ? 'GEÇTİ' : 'KALDI'} — ${o.report.summary}${o.report.issues.length ? ` Sorunlar: ${o.report.issues.join('; ')}` : ''}`
        case 'prompt':
          return `${port}=prompt "${clip(o.prompt.prompt, 300)}"`
        default:
          return `${port}=${o.kind}`
      }
    })
    lines.push(`- ${nodeId}: ${st.status}${st.attempts > 1 ? ` (${st.attempts}. deneme)` : ''}${st.error ? ` HATA: ${st.error}` : ''}${outs.length ? ' → ' + outs.join(' · ') : ''}`)
    if (withLogs && (st.status === 'failed' || st.status === 'running' || st.status === 'retrying')) lines.push(...st.logs.slice(-12).map((l) => `    ${l}`))
  }
  return lines.join('\n')
}

function previewsOf(j: Job): string[] {
  const out: string[] = []
  for (const st of Object.values(j.nodes))
    for (const o of Object.values(st.outputs ?? {})) {
      if (o.kind === 'model') out.push(...(o.previews ?? []), ...(o.thumbnail ? [o.thumbnail] : []))
      if (o.kind === 'image') out.push(...o.files)
    }
  return [...new Set(out)].filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && fs.existsSync(f))
}

function mutate(ctx: ToolCtx, fn: (p: Project) => void): Project {
  const p = loadProject(ctx.dir)
  fn(p)
  saveProject(ctx.dir, p)
  ctx.notify(p)
  return p
}

const AssetFields = z.object({
  id: z.string().optional().describe('Var olan asset id’si (güncelleme). Boşsa yeni asset oluşturulur.'),
  name: z.string().optional(),
  kind: z.enum(KINDS).optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  description: z.string().optional().describe('Görsel/işitsel tarif — prompt motoru bunu okur. Somut olun: biçim, malzeme, yıpranma, ölçek, renk.'),
  size: z.string().optional().describe('ör. "5.2x2.0x1.9" metre ya da "1,80 m"'),
  materials: z.string().optional(),
  variants: z.string().optional(),
  triBudget: z.number().optional().describe('Üçgen bütçesi (0 = Proje Kitabı varsayılanı)'),
  priority: z.string().optional(),
  status: z.string().optional(),
  parentId: z.string().optional().describe('Kit üyesiyse ana asset id’si (ör. animasyon → karakter)'),
  style: z.string().optional(),
  tier: z.string().optional(),
  links: z.array(z.string()).optional().describe('İlişkili kütüphane asset id’leri'),
  extra: z.record(z.string(), z.string()).optional().describe('Ek alanlar. Animasyon için: Kimodo (satır başına segment), Süre (virgülle saniyeler), Döngü (evet/hayır), RootMotion (root|inplace|raw)')
})

export function builtinTools(): AgentTool[] {
  return [
    tool({
      name: 'project_overview',
      description:
        'Projenin genel durumu: Proje Kitabı özeti, asset sayıları (tür/durum), hatlar, süren ve son başarısız işler, bağlı servisler (anahtarlar, Blender, Kimodo, Unreal). Bir işe başlamadan önce çağır.',
      schema: z.object({}),
      readOnly: true,
      run: async (ctx) => {
        const p = loadProject(ctx.dir)
        const jobs = listJobs(ctx.dir, 100)
        const by = (f: (a: AssetSpec) => string) => Object.entries(p.assets.reduce<Record<string, number>>((m, a) => ((m[f(a) || '—'] = (m[f(a) || '—'] ?? 0) + 1), m), {}))
        const s = getSettings()
        const [ue, km] = await Promise.all([discoverUe(800).catch(() => []), kimodoStatus().catch(() => null)])
        return [
          `PROJE: ${p.bible.projectName || p.name} · ${p.bible.genre} · ${p.bible.setting}`,
          `Sanat yönü: ${clip(p.bible.artDirection, 400)}`,
          `Gerçekçilik: ${p.bible.realism}`,
          `Asset: ${p.assets.length} — türler: ${by((a) => a.kind)
            .map(([k, n]) => `${k} ${n}`)
            .join(', ')} — durumlar: ${by((a) => a.status)
            .map(([k, n]) => `${k} ${n}`)
            .join(', ')}`,
          `Hatlar: ${p.pipelines.map((x) => `${x.id} (${x.name})`).join('; ')}`,
          `Süren işler: ${
            jobs
              .filter((j) => j.status === 'running' || j.status === 'queued')
              .map((j) => `${j.assetName} [${j.pipelineName}]`)
              .join('; ') || 'yok'
          }`,
          `Son başarısızlar: ${
            jobs
              .filter((j) => j.status === 'failed')
              .slice(0, 5)
              .map((j) => `${j.assetName}: ${clip(j.error ?? '', 120)}`)
              .join(' | ') || 'yok'
          }`,
          `Brief'ler: ${
            listBriefs(ctx.dir)
              .slice(0, 8)
              .map((b) => `${b.id} "${b.spec.name || b.title}" (${b.status})`)
              .join('; ') || 'yok'
          }`,
          `Servisler: Claude anahtarı ${getSecret('anthropic') ? 'var' : 'YOK'} · Meshy ${getSecret('meshy') ? 'var' : 'YOK'} · ElevenLabs ${getSecret('elevenlabs') ? 'var' : 'YOK'} · Blender ${s.blenderPath && fs.existsSync(s.blenderPath) ? 'bulundu' : 'YOK'} · Kimodo ${km?.healthy ? 'hazır' : km?.running ? 'açılıyor' : 'kapalı'} · Unreal ${ue.length ? ue.map((n) => `${n.projectName} (UE ${n.engineVersion})`).join(', ') : 'açık değil'}`
        ].join('\n')
      }
    }),

    tool({
      name: 'list_assets',
      description: 'Kütüphanedeki asset’leri listeler (id | ad | tür | durum | kategori | ana asset). Filtreler isteğe bağlı.',
      schema: z.object({
        kind: z.enum(KINDS).optional(),
        status: z.string().optional(),
        query: z.string().optional().describe('ad/açıklama/kategori içinde ara'),
        limit: z.number().int().min(1).max(500).optional()
      }),
      readOnly: true,
      run: async (ctx, d) => {
        const p = loadProject(ctx.dir)
        const q = d.query?.toLocaleLowerCase('tr')
        const list = p.assets.filter(
          (a) => (!d.kind || a.kind === d.kind) && (!d.status || a.status === d.status) && (!q || `${a.id} ${a.name} ${a.description} ${a.category}`.toLocaleLowerCase('tr').includes(q))
        )
        const rows = list
          .slice(0, d.limit ?? 120)
          .map((a) => `${a.id} | ${a.name} | ${a.kind} | ${a.status || '—'} | ${a.category}${a.parentId ? ` | ana: ${a.parentId}` : ''}${a.triBudget ? ` | ${a.triBudget} üçgen` : ''}`)
        return `${list.length} asset${list.length > rows.length ? ` (ilk ${rows.length})` : ''}\n${rows.join('\n')}`
      }
    }),

    tool({
      name: 'get_asset',
      description: 'Bir asset’in tüm tanımı ve son üretim işlerinin çıktıları (dosyalar, üçgen sayısı, QA puanı ve sorunları).',
      schema: z.object({ id: z.string() }),
      readOnly: true,
      run: async (ctx, d) => {
        const p = loadProject(ctx.dir)
        const a = p.assets.find((x) => x.id === d.id)
        if (!a) return { text: `Asset bulunamadı: ${d.id}`, isError: true }
        const jobs = jobsFor(ctx.dir, a.id).slice(0, 3)
        const kids = p.assets.filter((x) => x.parentId === a.id).map((x) => `${x.id} ${x.name} (${x.kind}, ${x.status})`)
        return [
          assetContext(a),
          `Durum: ${a.status || '—'}${a.pipelineId ? ` · önerilen hat: ${a.pipelineId}` : ''}${a.parentId ? ` · ana asset: ${a.parentId}` : ''}`,
          kids.length ? `Kit üyeleri: ${kids.join('; ')}` : '',
          jobs.length ? `\nSON İŞLER:\n${jobs.map((j) => jobSummary(j)).join('\n\n')}` : '\nHenüz üretilmedi.'
        ]
          .filter(Boolean)
          .join('\n')
      }
    }),

    tool({
      name: 'view_asset',
      description: 'Asset’in üretilmiş önizleme görsellerini getirir (3B model render’ları, doku/görsel). Sonucu gözle değerlendirmek, kalite eleştirisi yapmak için kullan.',
      schema: z.object({ id: z.string(), max: z.number().int().min(1).max(6).optional() }),
      readOnly: true,
      run: async (ctx, d) => {
        const done = jobsFor(ctx.dir, d.id).filter((j) => j.status === 'done' || previewsOf(j).length)
        for (const j of done) {
          const imgs = previewsOf(j)
          if (imgs.length) return { text: `${d.id} önizlemeleri (iş ${j.id}, ${j.pipelineName}): ${imgs.map((f) => path.basename(f)).join(', ')}`, images: imgs.slice(0, d.max ?? 4) }
        }
        return `${d.id} için önizleme görseli yok (henüz üretilmemiş ya da ses/animasyon asset’i).`
      }
    }),

    tool({
      name: 'upsert_asset',
      description:
        'Asset oluşturur ya da günceller. id verilirse yalnızca verilen alanlar değişir; verilmezse yeni asset (name ve kind zorunlu) oluşur ve id döner. Açıklamayı prompt motoru okur: somut, görsel, ölçülü yaz.',
      schema: AssetFields,
      run: async (ctx, d) => {
        let out: AssetSpec | undefined
        let created = false
        mutate(ctx, (p) => {
          const cur = d.id ? p.assets.find((a) => a.id === d.id) : undefined
          if (cur) {
            const { id: _id, extra, ...rest } = d
            Object.assign(cur, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)))
            if (extra) cur.extra = { ...cur.extra, ...extra }
            out = cur
            return
          }
          if (!d.name || !d.kind) throw new Error('Yeni asset için name ve kind gerekli')
          created = true
          out = {
            id: d.id || nextId(p, d.kind),
            name: d.name,
            kind: d.kind as AssetKind,
            category: d.category ?? '',
            subcategory: d.subcategory ?? '',
            description: d.description ?? '',
            size: d.size ?? '',
            materials: d.materials ?? '',
            variants: d.variants ?? '',
            triBudget: d.triBudget ?? 0,
            budgetNote: '',
            priority: d.priority ?? 'P1',
            status: d.status ?? 'Bekliyor',
            source: ctx.source === 'mcp' ? 'Claude (MCP)' : 'Yapımcı',
            extra: d.extra ?? {},
            parentId: d.parentId,
            style: d.style,
            tier: d.tier,
            links: d.links
          }
          out.pipelineId = suggestPipeline(out)
          p.assets.push(out)
        })
        return `${created ? 'Oluşturuldu' : 'Güncellendi'}: ${out!.id} "${out!.name}" (${out!.kind}) · önerilen hat ${out!.pipelineId ?? suggestPipeline(out!)}`
      }
    }),

    tool({
      name: 'delete_asset',
      description: 'Asset’i kütüphaneden siler (üretilmiş dosyalar diskte kalır).',
      schema: z.object({ id: z.string() }),
      confirm: (d) => `${d.id} kütüphaneden silinsin mi?`,
      run: async (ctx, d) => {
        let found = false
        mutate(ctx, (p) => {
          found = p.assets.some((a) => a.id === d.id)
          p.assets = p.assets.filter((a) => a.id !== d.id)
        })
        return found ? `Silindi: ${d.id}` : { text: `Bulunamadı: ${d.id}`, isError: true }
      }
    }),

    tool({
      name: 'get_bible',
      description: 'Proje Kitabı: sanat yönü, gerçekçilik, palet, malzemeler, kategori kuralları, teknik bütçeler ve isimlendirme.',
      schema: z.object({}),
      readOnly: true,
      run: async (ctx) => {
        const b = loadProject(ctx.dir).bible
        return `${bibleContext(b)}\n\nTEKNİK: ${JSON.stringify(b.technical)}`
      }
    }),

    tool({
      name: 'update_bible',
      description: 'Proje Kitabı alanlarını günceller (yalnızca verilenler). Sanat yönü tüm üretimi etkiler; değiştirmeden önce kullanıcıyla netleştir.',
      schema: z.object({
        projectName: z.string().optional(),
        genre: z.string().optional(),
        setting: z.string().optional(),
        loreSummary: z.string().optional(),
        artDirection: z.string().optional(),
        realism: z.string().optional(),
        moodKeywords: z.array(z.string()).optional(),
        forbidden: z.array(z.string()).optional(),
        audioDirection: z.string().optional(),
        palette: z
          .array(z.object({ code: z.string(), group: z.string(), name: z.string(), hex: z.string(), usage: z.string() }))
          .optional()
          .describe('Verilirse paletin tamamının yerine geçer'),
        defaultTriBudget: z.number().optional(),
        ueContentRoot: z.string().optional(),
        masterMaterial: z.string().optional()
      }),
      confirm: (d) => `Proje Kitabı güncellensin mi? Alanlar: ${Object.keys(d).join(', ')}`,
      run: async (ctx, d) => {
        mutate(ctx, (p) => {
          const { defaultTriBudget, ueContentRoot, masterMaterial, ...rest } = d
          Object.assign(p.bible, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as Partial<Bible>)
          if (defaultTriBudget !== undefined) p.bible.technical.defaultTriBudget = defaultTriBudget
          if (ueContentRoot !== undefined) p.bible.technical.ueContentRoot = ueContentRoot
          if (masterMaterial !== undefined) p.bible.technical.masterMaterial = masterMaterial
        })
        return `Proje Kitabı güncellendi: ${Object.keys(d).join(', ')}`
      }
    }),

    tool({
      name: 'list_pipelines',
      description: 'Üretim hatları (pipeline) ve düğüm zincirleri. Hangi asset için hangi hattın uygun olduğunu seçmek için.',
      schema: z.object({}),
      readOnly: true,
      run: async (ctx) =>
        loadProject(ctx.dir)
          .pipelines.map((x) => `${x.id} — ${x.name}\n  ${x.description}\n  düğümler: ${x.nodes.map((n) => n.type).join(' → ')}`)
          .join('\n')
    }),

    tool({
      name: 'run_pipeline',
      description:
        'Seçilen asset’ler için bir üretim hattı başlatır (Meshy/ElevenLabs/Claude kredisi harcar). İş id’leri döner; durum için get_job / wait_for_job. Animasyonları ana karakter üretildikten SONRA çalıştır (retarget karakter iskeletine yapılır).',
      schema: z.object({ pipelineId: z.string(), assetIds: z.array(z.string()).min(1) }),
      confirm: (d) => `"${d.pipelineId}" hattı ${d.assetIds.length} asset için çalıştırılsın mı? (${d.assetIds.join(', ')}) — servis kredisi harcar.`,
      run: async (ctx, d) => {
        const p = loadProject(ctx.dir)
        const jobs = ctx.runner.start(p, ctx.dir, d.pipelineId, d.assetIds)
        return `Başladı: ${jobs.map((j) => `${j.id} (${j.assetName})`).join(', ')}`
      }
    }),

    tool({
      name: 'list_jobs',
      description: 'Üretim işlerini listeler (en yeni önce).',
      schema: z.object({ status: z.enum(['queued', 'running', 'done', 'failed', 'canceled']).optional(), assetId: z.string().optional(), limit: z.number().int().min(1).max(100).optional() }),
      readOnly: true,
      run: async (ctx, d) => {
        const list = listJobs(ctx.dir, 300).filter((j) => (!d.status || j.status === d.status) && (!d.assetId || j.assetId === d.assetId))
        return (
          list
            .slice(0, d.limit ?? 25)
            .map((j) => `${j.id} | ${j.assetName} (${j.assetId}) | ${j.pipelineName} | ${j.status}${j.error ? ` | ${clip(j.error, 100)}` : ''}`)
            .join('\n') || 'İş yok.'
        )
      }
    }),

    tool({
      name: 'get_job',
      description: 'Bir işin ayrıntısı: düğüm durumları, çıktılar, QA raporu, hata ve son loglar.',
      schema: z.object({ id: z.string() }),
      readOnly: true,
      run: async (ctx, d) => {
        const j = listJobs(ctx.dir, 500).find((x) => x.id === d.id)
        return j ? jobSummary(j, true) : { text: `İş bulunamadı: ${d.id}`, isError: true }
      }
    }),

    tool({
      name: 'wait_for_job',
      description: 'İş bitene (done/failed/canceled) ya da süre dolana kadar bekler, sonra özetini döndürür. Uzun işler için birkaç kez çağırılabilir.',
      schema: z.object({ id: z.string(), timeoutSec: z.number().int().min(5).max(600).optional() }),
      readOnly: true,
      run: async (ctx, d) => {
        const end = Date.now() + (d.timeoutSec ?? 180) * 1000
        for (;;) {
          const j = listJobs(ctx.dir, 500).find((x) => x.id === d.id)
          if (!j) return { text: `İş bulunamadı: ${d.id}`, isError: true }
          if (['done', 'failed', 'canceled'].includes(j.status)) return jobSummary(j, true)
          if (Date.now() > end) return `Hâlâ sürüyor:\n${jobSummary(j, true)}`
          await new Promise((r) => setTimeout(r, 3000))
        }
      }
    }),

    tool({
      name: 'cancel_job',
      description: 'Süren bir işi iptal eder.',
      schema: z.object({ id: z.string() }),
      run: async (ctx, d) => {
        ctx.runner.cancel(d.id)
        return `İptal istendi: ${d.id}`
      }
    }),

    tool({
      name: 'generate_animation',
      description:
        'NVIDIA Kimodo ile metinden insan animasyonu üretir ve karakterin Manny iskeletine retarget eder. segments: İngilizce, kısa, fiziksel hareket tarifleri ("A person walks forward slowly, then stops."), her biri 2-10 sn. Döngü klipleri için rootMotion=inplace.',
      schema: z.object({
        characterId: z.string(),
        name: z.string(),
        segments: z
          .array(z.object({ text: z.string(), seconds: z.number().min(1).max(10) }))
          .min(1)
          .max(8),
        loop: z.boolean().optional(),
        rootMotion: z.enum(['root', 'inplace', 'raw']).optional()
      }),
      confirm: (d) => `"${d.name}" animasyonu üretilsin mi? ${d.segments.length} segment, ${d.segments.reduce((s, x) => s + x.seconds, 0)} sn (yerel GPU).`,
      run: async (ctx, d) => {
        let id = ''
        const p = mutate(ctx, (pr) => {
          const ch = pr.assets.find((a) => a.id === d.characterId)
          if (!ch) throw new Error(`Karakter bulunamadı: ${d.characterId}`)
          id = nextId(pr, 'animation')
          pr.assets.push({
            id,
            name: d.name,
            kind: 'animation',
            category: ch.category,
            subcategory: 'animasyon',
            description: d.segments.map((s) => s.text).join(' → '),
            size: '',
            materials: '',
            variants: '',
            triBudget: 0,
            budgetNote: '',
            priority: 'P1',
            status: 'Sırada',
            source: ctx.source === 'mcp' ? 'Claude (MCP)' : 'Yapımcı',
            parentId: ch.id,
            extra: {
              Kimodo: d.segments.map((s) => s.text).join('\n'),
              Süre: d.segments.map((s) => s.seconds).join(','),
              Döngü: d.loop ? 'evet' : 'hayır',
              RootMotion: d.rootMotion ?? (d.loop ? 'inplace' : 'root')
            },
            pipelineId: 'tpl_anim_kimodo'
          })
        })
        const jobs = ctx.runner.start(p, ctx.dir, 'tpl_anim_kimodo', [id])
        return `Animasyon ${id} oluşturuldu, iş ${jobs[0].id} başladı.`
      }
    }),

    tool({
      name: 'list_anim_systems',
      description:
        'Animasyon sistemlerini listeler (Blend Space 1D/2D, Montage, Aim Offset, zıplama durum makinesi, Motion Matching). Her klibin durumu, ölçülen hızı ve sync marker sayısı. systemId verilirse ayrıntı.',
      schema: z.object({ characterId: z.string().optional(), systemId: z.string().optional() }),
      readOnly: true,
      run: async (ctx, d) => {
        if (d.systemId) {
          const sys = getSystem(ctx.dir, d.systemId)
          const st = new Map(systemStates(ctx.dir, sys).map((x) => [x.key, x]))
          const lines = [
            `${sys.id} · ${sys.name} · ${animSystemInfo(sys.kind).title} (${animSystemInfo(sys.kind).ue}) · stil: "${sys.style}" · karakter ${sys.characterId}${sys.producing ? ' · ÜRETİLİYOR' : ''}`
          ]
          for (const c of sys.clips) {
            const s = st.get(c.key)
            const m = s?.motion?.measured
            lines.push(
              `- ${c.key} [${c.role}${c.loop ? ', döngü' : ''}${c.enabled ? '' : ', KAPALI'}] ${c.label}: hedef ${c.speed}${c.speedEnd !== undefined ? '→' + c.speedEnd : ''} m/sn yön ${c.moveDir}° dönüş ${c.turn}°${c.from ? ` ←${c.from}` : ''}${c.to ? ` →${c.to}` : ''} · ${s?.status ?? 'none'}${m ? ` · ölçülen ${m.speed.toFixed(2)} m/sn, ${m.turn}°, L${s!.motion!.markers.L.length}/R${s!.motion!.markers.R.length}` : ''}${s?.error ? ' · HATA ' + s.error : ''}\n    "${stylePrompt(c.prompt, sys.style)}"`
            )
          }
          if (sys.lastBuild) lines.push(`Son Unreal kurulumu: ${sys.lastBuild.ok ? 'tamam' : 'sorunlu'} — ${[...sys.lastBuild.errors, ...sys.lastBuild.notes].join(' | ')}`)
          return lines.join('\n')
        }
        const all = listSystems(ctx.dir, d.characterId)
        const kinds = ANIM_SYSTEMS.map((k) => `${k.kind} = ${k.title} (${k.ue}): ${k.short}`).join('\n')
        const list = all.map((x) => `${x.id} · ${x.name} · ${x.kind} · ${x.clips.filter((c) => c.enabled).length} klip · karakter ${x.characterId}`).join('\n')
        return `${list || 'Henüz sistem yok.'}\n\nKurulabilecek türler:\n${kinds}`
      }
    }),

    tool({
      name: 'create_anim_system',
      description:
        'Karakter için animasyon sistemi oluşturur (şablon klip seti). request verilirse Claude seti karaktere/tarife göre uyarlar (hız, prompt, ek/çıkarılan klipler). Üretim başlatmaz — sonra produce_anim_system.',
      schema: z.object({
        characterId: z.string(),
        kind: z.enum(['single', 'montage', 'blendspace1d', 'blendspace2d', 'statemachine', 'aimoffset', 'motionmatching']),
        name: z.string().optional(),
        style: z.string().optional().describe('Kimodo özne ifadesi, ör. "A tired soldier"'),
        request: z.string().optional().describe('Türkçe tarif: karakterin hareket karakteri, istenen/istenmeyen klipler')
      }),
      run: async (ctx, d) => {
        const p = loadProject(ctx.dir)
        const ch = p.assets.find((a) => a.id === d.characterId)
        if (!ch) throw new Error(`Karakter bulunamadı: ${d.characterId}`)
        let sys = saveSystem(ctx, newAnimSystem(d.kind, ch.id, d.name || `${ch.name} · ${animSystemInfo(d.kind).title}`, d.style || 'A person'))
        let note = ''
        if (d.request) {
          const { data } = await planAnimSystem(p.bible, { kind: sys.kind, title: animSystemInfo(sys.kind).title, style: sys.style, clips: sys.clips }, `${ch.name}: ${ch.description}`, d.request)
          sys = saveSystem(ctx, { ...applyPlan(sys, data), description: d.request })
          note = `\nPlan: ${data.rationale}`
        }
        return `Sistem ${sys.id} oluşturuldu: ${sys.name} · ${sys.clips.filter((c) => c.enabled).length} klip · stil "${sys.style}".${note}\nAnimasyon → Sistemler sekmesinde görünür.`
      }
    }),

    tool({
      name: 'produce_anim_system',
      description:
        'Sistemin kliplerini Kimodo ile poz eşleme sırasıyla üretir (önce bekleme/döngüler, sonra geçişler). Arka planda çalışır; list_anim_systems ile izle. keys verilirse yalnızca o klipler (force ile yeniden).',
      schema: z.object({ systemId: z.string(), keys: z.array(z.string()).optional(), force: z.boolean().optional() }),
      confirm: (d) => `Animasyon sistemi ${d.systemId} üretilsin mi?${d.keys?.length ? ` (${d.keys.join(', ')})` : ''} Yerel GPU’da uzun sürebilir.`,
      run: async (ctx, d) => {
        const r = produceSystem(ctx, d.systemId, { keys: d.keys, force: d.force })
        return r.clips ? `${r.clips} klip ${r.phases} fazda sıraya alındı.` : 'Üretilecek eksik klip yok (force ile yeniden üretebilirsin).'
      }
    }),

    tool({
      name: 'build_anim_system',
      description:
        'Üretilmiş klipleri Unreal’da sisteme dönüştürür: Blend Space (ölçülen hızlarla), Aim Offset (additive), Montage, Pose Search Schema + Database (Motion Matching), döngü bayrakları ve L/R sync marker’lar. Unreal açık olmalı.',
      schema: z.object({ systemId: z.string() }),
      confirm: (d) => `${d.systemId} Unreal’da kurulsun mu? (mevcut aynı adlı sistem asset’leri yeniden oluşturulur)`,
      run: async (ctx, d) => {
        const b = await buildSystemInUe(ctx, d.systemId)
        const lines = [...b.errors.map((e) => '✕ ' + e), ...b.notes].join('\n')
        return { text: `${b.ok ? 'Kuruldu' : 'Sorunlar var'}\n${lines}\nBetik: ${b.script}`, isError: !b.ok && !b.notes.length }
      }
    }),

    tool({
      name: 'list_briefs',
      description: 'Atölye’deki tasarım brief’leri (Brief sohbetinden çıkan tasarımlar ve üretim kitleri).',
      schema: z.object({}),
      readOnly: true,
      run: async (ctx) =>
        listBriefs(ctx.dir)
          .map((b) => `${b.id} | ${b.spec.name || b.title} | ${b.spec.kind} | ${b.status} | kit ${b.kit.filter((k) => k.include).length}/${b.kit.length}`)
          .join('\n') || 'Brief yok.'
    }),

    tool({
      name: 'get_brief',
      description: 'Bir brief’in tasarım kartı (stil, seviye, bütçe, palet, oyun dünyası) ve üretim kiti.',
      schema: z.object({ id: z.string() }),
      readOnly: true,
      run: async (ctx, d) => {
        const b = loadBrief(ctx.dir, d.id)
        if (!b) return { text: `Brief bulunamadı: ${d.id}`, isError: true }
        return `${JSON.stringify(b.spec, null, 1)}\nKİT:\n${b.kit.map((k) => `${k.include ? '[x]' : '[ ]'} ${k.group}/${k.kind} ${k.name} — ${k.purpose}${k.dynamic ? ' (dinamik motor sesi)' : ''}${k.motion ? ` (Kimodo: ${k.motion.prompt})` : ''}`).join('\n')}${b.summary ? `\nÖZET: ${b.summary}` : ''}`
      }
    }),

    tool({
      name: 'kimodo_status',
      description: 'NVIDIA Kimodo animasyon servisinin kurulum adımları ve durumu.',
      schema: z.object({}),
      readOnly: true,
      run: async () => {
        const s = await kimodoStatus()
        return `${s.healthy ? 'HAZIR' : s.running ? 'açılıyor' : 'kapalı'} (${s.backend})${s.model ? ` · ${s.model} ${s.device ?? ''}` : ''}\n${s.steps.map((x) => `${x.done ? '✓' : '✗'} ${x.label}${x.hint ? ` — ${x.hint}` : ''}`).join('\n')}`
      }
    }),

    tool({
      name: 'unreal_status',
      description: 'Açık Unreal Editor örneklerini bulur (Python Remote Execution açık olmalı).',
      schema: z.object({}),
      readOnly: true,
      run: async () => {
        const n = await discoverUe(1500)
        return n.length ? n.map((x) => `${x.projectName} · UE ${x.engineVersion} · ${x.machine} · ${x.nodeId}`).join('\n') : 'Açık Unreal Editor bulunamadı.'
      }
    }),

    tool({
      name: 'unreal_python',
      description:
        'Açık Unreal Editor’de Python çalıştırır (unreal modülü). Sahne kurma, asset düzenleme, materyal/Niagara/Blueprint işleri, sorgular için. print() çıktısı döner. Değişiklikten önce ne yapacağını açıkla.',
      schema: z.object({ code: z.string().describe('Çalıştırılacak Python kodu') }),
      confirm: (d) => `Unreal’da şu Python çalıştırılsın mı?\n\n${clip(d.code, 1500)}`,
      run: async (_ctx, d) => {
        const r = await execInUe(d.code)
        return { text: `${r.success ? 'Başarılı' : 'HATA'}\n${clip(r.output, 6000)}${r.result && r.result !== 'None' ? `\nSonuç: ${clip(r.result, 2000)}` : ''}`, isError: !r.success }
      }
    })
  ]
}
