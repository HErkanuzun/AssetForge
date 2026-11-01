import type { Bible, Pipeline, PipelineEdge, PipelineNode, Project } from './types'
import { defaultParams } from './nodes'

type NodeSpec = [id: string, type: string, params?: Record<string, string | number | boolean>]
type EdgeSpec = [from: string, fromPort: string, to: string, toPort: string]

function chain(id: string, name: string, description: string, nodes: NodeSpec[], edges: EdgeSpec[]): Pipeline {
  const pnodes: PipelineNode[] = nodes.map(([nid, type, params], i) => ({
    id: nid,
    type,
    position: { x: 40 + i * 235, y: 120 + (i % 2) * 110 },
    params: { ...defaultParams(type), ...(params ?? {}) }
  }))
  const pedges: PipelineEdge[] = edges.map(([s, sh, t, th]) => ({
    id: `${s}.${sh}->${t}.${th}`,
    source: s,
    sourceHandle: sh,
    target: t,
    targetHandle: th
  }))
  return { id, name, description, nodes: pnodes, edges: pedges }
}

export const PIPELINE_TEMPLATES: Pipeline[] = [
  chain(
    'tpl_prop_text3d',
    'Prop — Metin→3D (QA)',
    'Hızlı prop/yapı parçası: prompt → Meshy metin→3D (dokulu) → Blender temizlik → kalite kontrol → Unreal.',
    [
      ['asset', 'asset.input'],
      ['prompt', 'prompt.generate', { target: 'meshy_text3d' }],
      ['gen', 'model.meshy.text3d'],
      ['blender', 'blender.process'],
      ['qa', 'qa.review'],
      ['export', 'export.ue']
    ],
    [
      ['asset', 'asset', 'prompt', 'asset'],
      ['prompt', 'prompt', 'gen', 'prompt'],
      ['gen', 'model', 'blender', 'model'],
      ['blender', 'model', 'qa', 'subject'],
      ['qa', 'subject', 'export', 'subject']
    ]
  ),
  chain(
    'tpl_prop_concept3d',
    'Prop — Konsept→Görsel→3D (QA)',
    'En yüksek kalite: önce referans görsel üretilip onaylanır, sonra görselden 3D yapılır. İki kalite kapısı vardır.',
    [
      ['asset', 'asset.input'],
      ['prompt', 'prompt.generate', { target: 'meshy_image_ref' }],
      ['img', 'image.meshy'],
      ['qa_img', 'qa.review', { min_score: 7 }],
      ['gen', 'model.meshy.image3d'],
      ['blender', 'blender.process'],
      ['qa', 'qa.review'],
      ['export', 'export.ue']
    ],
    [
      ['asset', 'asset', 'prompt', 'asset'],
      ['prompt', 'prompt', 'img', 'prompt'],
      ['img', 'image', 'qa_img', 'subject'],
      ['qa_img', 'subject', 'gen', 'image'],
      ['prompt', 'prompt', 'gen', 'prompt'],
      ['gen', 'model', 'blender', 'model'],
      ['blender', 'model', 'qa', 'subject'],
      ['qa', 'subject', 'export', 'subject']
    ]
  ),
  chain(
    'tpl_character_rig',
    'Karakter — Riglenmiş (A-pose)',
    'İnsansı karakter: A-pose konsept → görsel→3D → rig (yürüme/koşma dahil) → Unreal. Rig yalnızca iki ayaklı insansılarda çalışır.',
    [
      ['asset', 'asset.input'],
      ['prompt', 'prompt.generate', { target: 'meshy_image_character' }],
      ['img', 'image.meshy', { pose_mode: 'a-pose', aspect_ratio: '3:4' }],
      ['qa_img', 'qa.review'],
      ['gen', 'model.meshy.image3d', { pose_mode: 'a-pose', target_polycount: 0 }],
      ['rig', 'model.meshy.rig'],
      ['export', 'export.ue']
    ],
    [
      ['asset', 'asset', 'prompt', 'asset'],
      ['prompt', 'prompt', 'img', 'prompt'],
      ['img', 'image', 'qa_img', 'subject'],
      ['qa_img', 'subject', 'gen', 'image'],
      ['prompt', 'prompt', 'gen', 'prompt'],
      ['gen', 'model', 'rig', 'model'],
      ['rig', 'model', 'export', 'subject']
    ]
  ),
  chain(
    'tpl_sfx',
    'Ses Efekti (ElevenLabs)',
    'Ses listesindeki satırdan SFX/ambiyans: prompt → ElevenLabs (varyasyonlu) → Unreal.',
    [
      ['asset', 'asset.input'],
      ['prompt', 'prompt.generate', { target: 'elevenlabs_sfx' }],
      ['sfx', 'audio.elevenlabs'],
      ['export', 'export.ue']
    ],
    [
      ['asset', 'asset', 'prompt', 'asset'],
      ['prompt', 'prompt', 'sfx', 'prompt'],
      ['sfx', 'audio', 'export', 'subject']
    ]
  ),
  chain(
    'tpl_existing_model',
    'Mevcut Model → Temizlik → Unreal',
    "Elinizdeki modeli (ör. önceki Meshy çıktıları) boyuta ölçekler, bütçeye indirir, kalite kontrolden geçirir ve Unreal'a aktarır. \"Yerel Model\" node'unda dosya yolunu ayarlayın.",
    [
      ['file', 'model.file'],
      ['blender', 'blender.process'],
      ['qa', 'qa.review', { on_fail: 'continue', max_retries: 0 }],
      ['export', 'export.ue']
    ],
    [
      ['file', 'model', 'blender', 'model'],
      ['blender', 'model', 'qa', 'subject'],
      ['qa', 'subject', 'export', 'subject']
    ]
  ),
  chain(
    'tpl_texture_comfy',
    'Doku — ComfyUI (QA)',
    'Malzeme/zemin dokusu: tileable prompt → yerel ComfyUI → kalite kontrol → Unreal.',
    [
      ['asset', 'asset.input'],
      ['prompt', 'prompt.generate', { target: 'comfy_texture' }],
      ['img', 'image.comfyui'],
      ['qa', 'qa.review'],
      ['export', 'export.ue']
    ],
    [
      ['asset', 'asset', 'prompt', 'asset'],
      ['prompt', 'prompt', 'img', 'prompt'],
      ['img', 'image', 'qa', 'subject'],
      ['qa', 'subject', 'export', 'subject']
    ]
  )
]


// Brief'ten otomatik kurulan üretim hatları
PIPELINE_TEMPLATES.push(
  chain(
    'tpl_character_game',
    'Karakter — Oyuna Hazır (Manny)',
    'A-pose konsept → görsel→3D (bütçeli) → Meshy rig → Blender: Manny kemik adları + bütçeye indirme → kalite kontrol → Unreal: LOD 50/25/10, IK Rig, Manny→karakter retargeter.',
    [
      ['asset', 'asset.input'],
      ['prompt', 'prompt.generate', { target: 'meshy_image_character' }],
      ['img', 'image.meshy', { pose_mode: 'a-pose', aspect_ratio: '3:4' }],
      ['qa_img', 'qa.review'],
      ['gen', 'model.meshy.image3d', { pose_mode: 'a-pose' }],
      ['rig', 'model.meshy.rig'],
      ['blender', 'blender.process', { skeleton: 'manny', origin: 'keep' }],
      ['qa', 'qa.review', { on_fail: 'continue' }],
      ['export', 'export.ue', { lods: '0.5,0.25,0.1', ik_rig: true }]
    ],
    [
      ['asset', 'asset', 'prompt', 'asset'],
      ['prompt', 'prompt', 'img', 'prompt'],
      ['img', 'image', 'qa_img', 'subject'],
      ['qa_img', 'subject', 'gen', 'image'],
      ['prompt', 'prompt', 'gen', 'prompt'],
      ['gen', 'model', 'rig', 'model'],
      ['rig', 'model', 'blender', 'model'],
      ['blender', 'model', 'qa', 'subject'],
      ['qa', 'subject', 'export', 'subject']
    ]
  ),
  chain(
    'tpl_vehicle_body',
    'Araç — Gövde (Konsept→3D)',
    'Araç gövdesi: referans görsel → kalite kapısı → görsel→3D → Blender (boyut, bütçe, pivot) → kalite kontrol → Unreal. Süspansiyon/teker rigi Araç modülünde.',
    [
      ['asset', 'asset.input'],
      ['prompt', 'prompt.generate', { target: 'meshy_image_ref', extra: 'This is a game vehicle: show the full vehicle from a three-quarter front view, wheels clearly visible and separated from the body, doors and windows readable.' }],
      ['img', 'image.meshy', { aspect_ratio: '4:3' }],
      ['qa_img', 'qa.review'],
      ['gen', 'model.meshy.image3d'],
      ['blender', 'blender.process'],
      ['qa', 'qa.review'],
      ['export', 'export.ue']
    ],
    [
      ['asset', 'asset', 'prompt', 'asset'],
      ['prompt', 'prompt', 'img', 'prompt'],
      ['img', 'image', 'qa_img', 'subject'],
      ['qa_img', 'subject', 'gen', 'image'],
      ['prompt', 'prompt', 'gen', 'prompt'],
      ['gen', 'model', 'blender', 'model'],
      ['blender', 'model', 'qa', 'subject'],
      ['qa', 'subject', 'export', 'subject']
    ]
  ),
  chain(
    'tpl_engine_dynamic',
    'Dinamik Motor Sesi (MetaSound)',
    'Motor karakteri → farklı devirlerde döngü katmanları (ElevenLabs) → Unreal: RPM + Throttle girişli MetaSound. Oyunda AudioComponent ile devir parametresi verilir.',
    [
      ['asset', 'asset.input'],
      ['prompt', 'prompt.generate', { target: 'elevenlabs_engine' }],
      ['engine', 'audio.engine'],
      ['export', 'export.ue']
    ],
    [
      ['asset', 'asset', 'prompt', 'asset'],
      ['prompt', 'prompt', 'engine', 'prompt'],
      ['engine', 'audio', 'export', 'subject']
    ]
  ),
  chain(
    'tpl_anim_kimodo',
    'Animasyon — Kimodo → Karakter',
    'Metinden hareket (NVIDIA Kimodo) → Blender: Manny adları + root motion → Unreal: ortak SOMA iskeleti → ana karaktere otomatik retarget.',
    [
      ['asset', 'asset.input'],
      ['anim', 'anim.kimodo'],
      ['export', 'export.ue']
    ],
    [
      ['asset', 'asset', 'anim', 'asset'],
      ['anim', 'anim', 'export', 'subject']
    ]
  ),
  chain(
    'tpl_vfx_sprite',
    'VFX — Sprite/Flipbook',
    'Duman, toz, kıvılcım gibi parçacık sprite’ı: prompt → görsel (siyah zemin) → kalite kontrol → Unreal doku. Niagara şablonları VFX modülünde.',
    [
      ['asset', 'asset.input'],
      ['prompt', 'prompt.generate', { target: 'vfx_sprite' }],
      ['img', 'image.meshy', { remove_background: false, pose_mode: '' }],
      ['qa', 'qa.review', { on_fail: 'continue' }],
      ['export', 'export.ue']
    ],
    [
      ['asset', 'asset', 'prompt', 'asset'],
      ['prompt', 'prompt', 'img', 'prompt'],
      ['img', 'image', 'qa', 'subject'],
      ['qa', 'subject', 'export', 'subject']
    ]
  )
)

/** Asset türüne/rolüne göre önerilen hat */
export function suggestPipeline(a: { kind: string; role?: string; dynamic?: unknown; category?: string }): string {
  if (a.dynamic) return 'tpl_engine_dynamic'
  switch (a.kind) {
    case 'character':
      return 'tpl_character_game'
    case 'creature':
      return 'tpl_prop_concept3d'
    case 'vehicle':
      return 'tpl_vehicle_body'
    case 'sfx':
    case 'music':
      return 'tpl_sfx'
    case 'texture':
      return 'tpl_texture_comfy'
    case 'vfx':
      return 'tpl_vfx_sprite'
    case 'animation':
      return 'tpl_anim_kimodo'
    case 'weapon':
    case 'model':
    default:
      return 'tpl_prop_concept3d'
  }
}

export function defaultBible(): Bible {
  return {
    projectName: '',
    genre: '',
    setting: '',
    loreSummary: '',
    artDirection: '',
    realism: 'Stylized-realistic, PBR',
    moodKeywords: [],
    forbidden: ['text', 'logos', 'brand names'],
    audioDirection: '',
    palette: [],
    materials: [],
    categories: [],
    technical: {
      defaultTriBudget: 8000,
      textureRes: '2k',
      pbr: true,
      ueContentRoot: '/Game/AssetForge',
      masterMaterial: '',
      naming: { staticMesh: 'SM_', skeletalMesh: 'SK_', texture: 'T_', materialInstance: 'MI_', sound: 'S_' }
    }
  }
}

export function defaultProject(name: string): Project {
  return {
    version: 1,
    name,
    bible: defaultBible(),
    assets: [],
    pipelines: PIPELINE_TEMPLATES.map((p) => structuredClone(p))
  }
}

/** "4x4x0.3", "1,80 m (ayarlanabilir)", "0,5 m / 15 kg" → metre cinsinden boyutlar */
export function parseSizeMeters(size: string): number[] {
  if (!size) return []
  const head = size.split('/')[0].replace(/,/g, '.')
  const nums = head.match(/\d+(?:\.\d+)?/g)
  if (!nums) return []
  const values = nums.map(Number).filter((n) => n > 0)
  if (/\bcm\b/i.test(head)) return values.map((v) => v / 100)
  return values
}

/** "1-4K + Nanite yok" → 4000, "12000" → 12000 */
export function parseTriBudget(text: string): number {
  if (!text) return 0
  let best = 0
  for (const m of text.replace(/,/g, '.').matchAll(/(\d+(?:\.\d+)?)\s*([kK])?/g)) {
    const v = Number(m[1]) * (m[2] ? 1000 : 1)
    if (v > best) best = v
  }
  return Math.round(best)
}

/** Türkçe karakterleri sadeleştirip PascalCase güvenli isim üretir. */
export function safeName(s: string): string {
  const map: Record<string, string> = { ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I', ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U', â: 'a', î: 'i', û: 'u' }
  const ascii = s.replace(/[çÇğĞıİöÖşŞüÜâîû]/g, (c) => map[c] ?? c).normalize('NFKD').replace(/[^\x00-\x7F]/g, '')
  return ascii
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('')
    .slice(0, 48)
}

export function assetBaseName(asset: { id: string; name: string }): string {
  const code = asset.id.replace(/[^A-Za-z0-9]/g, '')
  const n = safeName(asset.name)
  return code ? `${code}_${n}` : n
}
