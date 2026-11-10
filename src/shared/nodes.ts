// SPDX-License-Identifier: AGPL-3.0-only
// Node editöründeki tüm node tiplerinin tanımı. Hem arayüz hem çalıştırma motoru bunu kullanır.

export type PortType = 'asset' | 'prompt' | 'image' | 'model' | 'audio' | 'anim' | 'media' | 'report'

export interface PortDef {
  id: string
  label: string
  type: PortType
  optional?: boolean
}

export interface ParamOption {
  value: string
  label: string
}

export interface ParamDef {
  id: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'bool'
  default: string | number | boolean
  options?: ParamOption[]
  /** Seçenekler ayarlardan gelir: llm = LLM sağlayıcıları, mcp = MCP sunucuları, comfyWorkflow = workflow kitaplığı, comfyServer = ComfyUI sunucuları */
  source?: 'llm' | 'mcp' | 'comfyWorkflow' | 'comfyServer'
  help?: string
}

export type NodeCategory = 'input' | 'prompt' | 'agent' | 'comfy' | 'image' | '3d' | 'audio' | 'anim' | 'process' | 'qa' | 'output'

export interface NodeDef {
  type: string
  label: string
  category: NodeCategory
  description: string
  inputs: PortDef[]
  outputs: PortDef[]
  params: ParamDef[]
}

export const CATEGORY_META: Record<NodeCategory, { label: string; color: string }> = {
  input: { label: 'Girdi', color: '#64748b' },
  prompt: { label: 'Prompt', color: '#a855f7' },
  agent: { label: 'Ajan', color: '#6366f1' },
  comfy: { label: 'ComfyUI', color: '#84cc16' },
  image: { label: 'Görsel', color: '#0ea5e9' },
  '3d': { label: '3D', color: '#f97316' },
  audio: { label: 'Ses', color: '#22c55e' },
  anim: { label: 'Animasyon', color: '#ec4899' },
  process: { label: 'İşleme', color: '#eab308' },
  qa: { label: 'Kalite', color: '#ef4444' },
  output: { label: 'Çıktı', color: '#14b8a6' }
}

export const PORT_COLORS: Record<PortType, string> = {
  asset: '#94a3b8',
  prompt: '#c084fc',
  image: '#38bdf8',
  model: '#fb923c',
  audio: '#4ade80',
  anim: '#f472b6',
  media: '#f8fafc',
  report: '#f87171'
}

const MEDIA: PortType[] = ['image', 'model', 'audio', 'anim']

/** Çıkış portu giriş portuna bağlanabilir mi? "media" her medya tipini kabul eder. */
export function portsCompatible(out: PortType, inp: PortType): boolean {
  if (out === inp) return true
  if (inp === 'media' && MEDIA.includes(out)) return true
  if (out === 'media' && MEDIA.includes(inp)) return true
  return false
}

// ---------------------------------------------------------------------------
// Prompt hedefleri: her AI servisinin sınırları ve iyi prompt kuralları.
// Prompt motoru (Claude) bu kurallara göre yazar; uzunluk limiti kodda da doğrulanır.

export interface PromptTarget {
  id: string
  label: string
  maxChars: number
  usesNegative: boolean
  usesTexturePrompt: boolean
  usesDuration: boolean
  rules: string[]
}

export const PROMPT_TARGETS: Record<string, PromptTarget> = {
  meshy_text3d: {
    id: 'meshy_text3d',
    label: 'Meshy Metin→3D',
    maxChars: 800,
    usesNegative: false,
    usesTexturePrompt: true,
    usesDuration: false,
    rules: [
      'Write in English. Describe ONE isolated object only; never a scene, background, ground plane, lighting or camera.',
      'Lead with the object type and silhouette, then construction details, proportions and real-world size, then materials and wear.',
      'For modular kit pieces state that it is a single modular piece with clean flat edges for snapping.',
      'Avoid brand names, text/logos, and vague style words without concrete visual meaning.',
      'texture_prompt: describe surface colors (translate palette hex codes into precise color names), material response (rough/metallic/wet), dirt, rust, decals-free wear. Max 800 chars.'
    ]
  },
  meshy_retexture: {
    id: 'meshy_retexture',
    label: 'Meshy Yeniden Doku',
    maxChars: 800,
    usesNegative: false,
    usesTexturePrompt: true,
    usesDuration: false,
    rules: [
      'Write in English. The geometry already exists: describe ONLY surface appearance.',
      'Name concrete materials per part (e.g. "riveted scrap steel panels, olive canvas tarp straps"), colors as precise names, roughness, metalness, wear, grime and moisture.',
      'Put the full description in both prompt and texture_prompt.'
    ]
  },
  meshy_image_ref: {
    id: 'meshy_image_ref',
    label: 'Konsept Görsel (Görsel→3D için)',
    maxChars: 1500,
    usesNegative: false,
    usesTexturePrompt: true,
    usesDuration: false,
    rules: [
      'Write in English. This image will be converted to a 3D model, so it must be a clean reference image.',
      'Single subject, centered, entire object visible and not cropped, three-quarter front view, slight elevation.',
      'Plain seamless light-grey background, soft even studio lighting, no cast shadows on the background, no motion blur, no depth of field.',
      'No text, watermark, UI, people or additional props unless they are part of the asset.',
      'Describe materials and colors precisely from the palette so the texture is baked correctly.'
    ]
  },
  meshy_image_character: {
    id: 'meshy_image_character',
    label: 'Karakter Konsepti (A-pose)',
    maxChars: 1500,
    usesNegative: false,
    usesTexturePrompt: true,
    usesDuration: false,
    rules: [
      'Write in English. Full-body character turnaround reference for 3D conversion and auto-rigging.',
      'Standing in a neutral A-pose, arms slightly away from the body, legs slightly apart, facing the viewer, whole body visible head to toe.',
      'Plain light-grey background, flat even lighting, no props in hands, no cape or loose cloth hiding the limbs.',
      'Describe silhouette, outfit layers, armor plates, materials and colors precisely.',
      'Set pose to "a-pose".'
    ]
  },
  comfy_texture: {
    id: 'comfy_texture',
    label: 'ComfyUI Tileable Doku',
    maxChars: 900,
    usesNegative: true,
    usesTexturePrompt: false,
    usesDuration: false,
    rules: [
      'Write in English for Stable Diffusion style models: comma-separated descriptive phrases, most important first.',
      'Seamless tileable texture, top-down orthographic view, flat even diffuse lighting, no shadows, no perspective, no objects, physically plausible albedo.',
      'negative_prompt: list artifacts to avoid (perspective, vignette, text, watermark, seams, harsh shadows, blurry, low detail).'
    ]
  },
  comfy_concept: {
    id: 'comfy_concept',
    label: 'ComfyUI Konsept Görsel',
    maxChars: 900,
    usesNegative: true,
    usesTexturePrompt: false,
    usesDuration: false,
    rules: [
      'Write in English for Stable Diffusion style models: comma-separated descriptive phrases, most important first.',
      'Match the art direction, palette and mood of the project bible.',
      'negative_prompt: text, watermark, blurry, deformed, extra limbs, low quality, off-palette colors.'
    ]
  },
  elevenlabs_sfx: {
    id: 'elevenlabs_sfx',
    label: 'ElevenLabs Ses Efekti',
    maxChars: 450,
    usesNegative: false,
    usesTexturePrompt: false,
    usesDuration: true,
    rules: [
      'Write in English. One sound event or one continuous ambience per prompt; no music, no voice unless asked.',
      'Describe the sound source, action, materials involved, acoustic space (open forest, small metal room), distance/perspective and intensity.',
      'duration_seconds: 0.5 to 30. Use the asset length column if present (pick a sensible value inside the range). For loops use 6-10 seconds.',
      'loop: true for ambiences, engines, rain, hums; false for one-shots.'
    ]
  },
  elevenlabs_engine: {
    id: 'elevenlabs_engine',
    label: 'Motor Karakteri (dinamik ses)',
    maxChars: 260,
    usesNegative: false,
    usesTexturePrompt: false,
    usesDuration: false,
    rules: [
      'Write in English. Describe ONLY the timbre of this vehicle engine: engine type and cylinder count, intake/exhaust character, mechanical details (valve clatter, turbo whistle, rattling body panels), microphone perspective (exterior rear, close).',
      'Do NOT mention RPM, revving, acceleration, gear shifts, starting or stopping: the pipeline appends a steady RPM per layer and renders several seamless loops that Unreal crossfades by RPM.',
      'Keep it short and concrete (max 260 characters). loop: true.'
    ]
  },
  vfx_sprite: {
    id: 'vfx_sprite',
    label: 'VFX Sprite (Niagara için)',
    maxChars: 1200,
    usesNegative: false,
    usesTexturePrompt: false,
    usesDuration: false,
    rules: [
      'Write in English. A single particle sprite texture for a game VFX (smoke puff, dust cloud, spark, debris chunk, splash, flame).',
      'Isolated element centered on a pure black background, soft edges fading to black so it can be used additively or as alpha, no hard crop, nothing touching the borders.',
      'Orthographic, no scene, no ground, no text. Match the material colors described (e.g. dust tinted like the referenced sand/soil).',
      'If a flipbook is requested, describe a 4x4 grid of evolving frames of the same element.'
    ]
  },
  kimodo_motion: {
    id: 'kimodo_motion',
    label: 'Kimodo Hareket Promptu',
    maxChars: 300,
    usesNegative: false,
    usesTexturePrompt: false,
    usesDuration: true,
    rules: [
      'Write in English, present tense, starting with "A person". One clear full-body action, with speed, style and emotion (e.g. "A person sprints forward, then slows down and stops, out of breath.").',
      'No props, weapons, vehicles or other characters unless the action is clearly mimed. No camera or environment words.',
      'duration_seconds: realistic length of the action, 2-10 seconds. loop: true for cyclic locomotion (walk, run, idle).'
    ]
  }
}

const opts = (...pairs: [string, string][]): ParamOption[] => pairs.map(([value, label]) => ({ value, label }))

const MESHY_3D_MODELS = opts(
  ['latest', 'Meshy en güncel'],
  ['meshy-7.1', 'Meshy 7.1'],
  ['meshy-6', 'Meshy 6'],
  ['meshy-6-lite', 'Meshy 6 Lite (ucuz)'],
  ['meshy-t2.5', 'Smart Topology T2.5'],
  ['meshy-t2', 'Smart Topology T2']
)
const POSE = opts(['', 'Yok'], ['a-pose', 'A-pose'], ['t-pose', 'T-pose'], ['auto', 'Prompttan al'])
const TEX_RES = opts(['2k', '2K'], ['4k', '4K'], ['8k', '8K'])
const BUDGET_HELP = '0 = asset listesindeki / Proje Kitabındaki bütçe'

export const NODE_DEFS: NodeDef[] = [
  {
    type: 'asset.input',
    label: 'Asset',
    category: 'input',
    description: 'Çalıştırırken seçilen asset satırı (asset listesinden). Her hat bununla başlar.',
    inputs: [],
    outputs: [{ id: 'asset', label: 'Asset', type: 'asset' }],
    params: []
  },
  {
    type: 'model.file',
    label: 'Yerel Model',
    category: 'input',
    description: 'Diskteki bir modeli (GLB/FBX/OBJ) hatta sokar — ör. daha önce üretilmiş Meshy çıktıları. {id} yazılırsa asset ID ile değiştirilir.',
    inputs: [],
    outputs: [{ id: 'model', label: 'Model', type: 'model' }],
    params: [
      { id: 'file', label: 'Dosya yolu', type: 'text', default: '', help: 'ör. C:\\Projelerim\\Export\\{id}.glb' },
      { id: 'rigged', label: 'Riglenmiş', type: 'bool', default: false }
    ]
  },
  {
    type: 'image.file',
    label: 'Yerel Görsel',
    category: 'input',
    description: 'Diskteki konsept/referans görseli hatta sokar (görsel→3D için). {id} asset ID ile değiştirilir.',
    inputs: [],
    outputs: [{ id: 'image', label: 'Görsel', type: 'image' }],
    params: [{ id: 'file', label: 'Dosya yolu', type: 'text', default: '' }]
  },
  {
    type: 'prompt.generate',
    label: 'Prompt Motoru',
    category: 'prompt',
    description: 'Claude, Proje Kitabı + asset bilgisi + hedef servisin kurallarıyla prompt yazar. Kalite kontrol başarısız olursa geri bildirimle yeniden yazar.',
    inputs: [{ id: 'asset', label: 'Asset', type: 'asset' }],
    outputs: [{ id: 'prompt', label: 'Prompt', type: 'prompt' }],
    params: [
      {
        id: 'target',
        label: 'Hedef servis',
        type: 'select',
        default: 'meshy_text3d',
        options: Object.values(PROMPT_TARGETS).map((t) => ({ value: t.id, label: t.label }))
      },
      { id: 'extra', label: 'Ek talimat', type: 'textarea', default: '', help: 'Bu hatta her prompta eklenecek özel yönlendirme' }
    ]
  },
  {
    type: 'image.meshy',
    label: 'Meshy Görsel',
    category: 'image',
    description: 'Meshy text-to-image ile konsept/referans görsel üretir.',
    inputs: [{ id: 'prompt', label: 'Prompt', type: 'prompt' }],
    outputs: [{ id: 'image', label: 'Görsel', type: 'image' }],
    params: [
      {
        id: 'ai_model',
        label: 'Model',
        type: 'select',
        default: 'nano-banana-2',
        options: opts(
          ['nano-banana-2', 'Nano Banana 2'],
          ['nano-banana-2-lite', 'Nano Banana 2 Lite'],
          ['nano-banana', 'Nano Banana'],
          ['nano-banana-pro', 'Nano Banana Pro (Pro plan)'],
          ['gpt-image-2', 'GPT Image 2']
        )
      },
      { id: 'aspect_ratio', label: 'En-boy', type: 'select', default: '1:1', options: opts(['1:1', '1:1'], ['4:3', '4:3'], ['3:4', '3:4'], ['16:9', '16:9'], ['9:16', '9:16']) },
      { id: 'multi_view', label: 'Çoklu açı', type: 'bool', default: false, help: 'Birden çok açıdan görsel üretir (3D için daha iyi)' },
      { id: 'pose_mode', label: 'Poz', type: 'select', default: 'auto', options: POSE },
      { id: 'remove_background', label: 'Arka planı kaldır', type: 'bool', default: true }
    ]
  },
  {
    type: 'image.comfyui',
    label: 'ComfyUI Görsel',
    category: 'image',
    description: 'Bilgisayarındaki ComfyUI ile (API formatı workflow) görsel/doku üretir. Ücretsiz, yerel. Görselden başka çıktılar için “ComfyUI İş Akışı” düğümünü kullanın.',
    inputs: [{ id: 'prompt', label: 'Prompt', type: 'prompt' }],
    outputs: [{ id: 'image', label: 'Görsel', type: 'image' }],
    params: [
      { id: 'workflow', label: 'Workflow', type: 'select', default: '', source: 'comfyWorkflow', help: 'Ayarlar → Yerel araçlar → ComfyUI → Workflow kitaplığı' },
      { id: 'server', label: 'ComfyUI sunucusu', type: 'select', default: '', source: 'comfyServer', help: 'Otomatik = açık, gerekli düğüm ve modelleri olan, kuyruğu en kısa sunucu' },
      { id: 'seed', label: 'Seed', type: 'number', default: -1, help: '-1 = rastgele' }
    ]
  },
  {
    type: 'comfy.workflow',
    label: 'ComfyUI İş Akışı',
    category: 'comfy',
    description:
      'Herhangi bir ComfyUI workflow’unu çalıştırır ve çıktısını (görsel, 3D model, ses, animasyon) hatta verir. Yerel modeller ücretsizdir; Meshy, Tripo, Rodin, Hunyuan3D, ElevenLabs gibi partner düğümleri Comfy hesabı kredisiyle çalışır. Girişlerin gideceği düğümlerin başlığını AF:prompt, AF:image, AF:model, AF:audio, AF:seed yapın.',
    inputs: [
      { id: 'prompt', label: 'Prompt', type: 'prompt', optional: true },
      { id: 'image', label: 'Görsel', type: 'image', optional: true },
      { id: 'model', label: 'Model', type: 'model', optional: true },
      { id: 'audio', label: 'Ses', type: 'audio', optional: true }
    ],
    outputs: [
      { id: 'image', label: 'Görsel', type: 'image' },
      { id: 'model', label: 'Model', type: 'model' },
      { id: 'audio', label: 'Ses', type: 'audio' },
      { id: 'anim', label: 'Animasyon', type: 'anim' }
    ],
    params: [
      {
        id: 'workflow',
        label: 'Workflow',
        type: 'select',
        default: '',
        source: 'comfyWorkflow',
        help: 'Ayarlar → Yerel araçlar → ComfyUI → Workflow kitaplığına ekleyin (ComfyUI → Workflow → Export (API))'
      },
      {
        id: 'server',
        label: 'ComfyUI sunucusu',
        type: 'select',
        default: '',
        source: 'comfyServer',
        help: 'Otomatik = açık, gerekli düğüm ve modelleri olan, kuyruğu en kısa sunucu. Örn. 3D’yi bir bilgisayarda, sesi diğerinde üretin.'
      },
      { id: 'text', label: 'Metin (prompt bağlı değilse)', type: 'textarea', default: '' },
      { id: 'seed', label: 'Seed', type: 'number', default: -1, help: '-1 = her çalıştırmada yeni' },
      { id: 'seconds', label: 'Süre (sn, ses/animasyon)', type: 'number', default: 0, help: '0 = prompttaki süre ya da workflow’daki değer' },
      { id: 'timeout', label: 'Zaman aşımı (dk)', type: 'number', default: 30 }
    ]
  },
  {
    type: 'agent.task',
    label: 'Ajan Görevi',
    category: 'agent',
    description:
      'Seçtiğin yapay zekâ (Claude, OpenAI uyumlu bir model, Claude Code ya da Codex) bu adımı kendi başına yapar: bağladığın araçları (Blender MCP, Unreal MCP, terminal…) kullanır, dosyaları bu düğümün klasörüne bırakır. Model / görsel / ses olarak sonraki düğümlere geçer. Kalite kontrol geri bildirimi bu düğüme gelir.',
    inputs: [
      { id: 'asset', label: 'Asset', type: 'asset', optional: true },
      { id: 'prompt', label: 'Prompt', type: 'prompt', optional: true },
      { id: 'image', label: 'Görsel', type: 'image', optional: true },
      { id: 'model', label: 'Model', type: 'model', optional: true },
      { id: 'audio', label: 'Ses', type: 'audio', optional: true }
    ],
    outputs: [
      { id: 'model', label: 'Model', type: 'model' },
      { id: 'image', label: 'Görsel', type: 'image' },
      { id: 'audio', label: 'Ses', type: 'audio' }
    ],
    params: [
      {
        id: 'engine',
        label: 'Motor',
        type: 'select',
        default: 'api',
        options: opts(['api', 'API (Ayarlar’daki LLM)'], ['claude-code', 'Claude Code (aboneliğinle)'], ['codex', 'Codex CLI (aboneliğinle)']),
        help: 'API: Ayarlar → Yapay zekâ’daki sağlayıcı. Claude Code / Codex: bilgisayarında kurulu, giriş yapılmış CLI'
      },
      { id: 'provider', label: 'LLM (API motoru)', type: 'select', default: '', source: 'llm', help: 'Boş = Yapımcı asistanının modeli' },
      { id: 'mcp', label: 'Araçlar (MCP)', type: 'select', default: '', source: 'mcp', help: 'Ayarlar → MCP’de eklediğin sunucular. Bu düğümde onay sormadan çalışırlar' },
      { id: 'shell', label: 'Terminal kullanabilsin', type: 'bool', default: false, help: 'Komut çalıştırabilir (blender --background, ffmpeg, python…). Yalnızca güvendiğin görevlerde aç' },
      {
        id: 'task',
        label: 'Görev',
        type: 'textarea',
        default: '',
        help: 'Ne yapsın? Ör. "Blender’da asset’in low-poly modelini kur, tekerlekleri ayrı obje yap, GLB olarak kaydet". {asset} = asset adı'
      },
      { id: 'expect', label: 'Beklenen çıktı', type: 'select', default: 'model', options: opts(['model', '3D model'], ['image', 'Görsel'], ['audio', 'Ses'], ['any', 'Ne üretirse']) },
      { id: 'cli_model', label: 'CLI modeli', type: 'text', default: '', help: 'Claude Code / Codex için; boş = CLI varsayılanı' },
      { id: 'max_rounds', label: 'En fazla tur (API)', type: 'number', default: 40 },
      { id: 'timeout', label: 'Zaman aşımı (dk)', type: 'number', default: 30 }
    ]
  },
  {
    type: 'model.meshy.text3d',
    label: 'Meshy Metin→3D',
    category: '3d',
    description: 'Prompttan 3D model üretir (önizleme + isteğe bağlı doku/refine).',
    inputs: [{ id: 'prompt', label: 'Prompt', type: 'prompt' }],
    outputs: [{ id: 'model', label: 'Model', type: 'model' }],
    params: [
      { id: 'ai_model', label: 'Model', type: 'select', default: 'latest', options: MESHY_3D_MODELS },
      { id: 'refine', label: 'Doku üret (refine)', type: 'bool', default: true },
      { id: 'enable_pbr', label: 'PBR haritaları', type: 'bool', default: true },
      { id: 'texture_resolution', label: 'Doku çözünürlüğü', type: 'select', default: '2k', options: TEX_RES },
      { id: 'should_remesh', label: 'Remesh (poly kontrolü)', type: 'bool', default: true },
      { id: 'target_polycount', label: 'Hedef poligon', type: 'number', default: 0, help: BUDGET_HELP },
      { id: 'pose_mode', label: 'Poz', type: 'select', default: 'auto', options: POSE }
    ]
  },
  {
    type: 'model.meshy.image3d',
    label: 'Meshy Görsel→3D',
    category: '3d',
    description: 'Görselden (tek veya çoklu açı) 3D model üretir.',
    inputs: [
      { id: 'image', label: 'Görsel', type: 'image' },
      { id: 'prompt', label: 'Doku promptu', type: 'prompt', optional: true }
    ],
    outputs: [{ id: 'model', label: 'Model', type: 'model' }],
    params: [
      { id: 'ai_model', label: 'Model', type: 'select', default: 'latest', options: MESHY_3D_MODELS },
      { id: 'should_texture', label: 'Doku üret', type: 'bool', default: true },
      { id: 'enable_pbr', label: 'PBR haritaları', type: 'bool', default: true },
      { id: 'texture_resolution', label: 'Doku çözünürlüğü', type: 'select', default: '2k', options: TEX_RES },
      { id: 'should_remesh', label: 'Remesh (poly kontrolü)', type: 'bool', default: true },
      { id: 'target_polycount', label: 'Hedef poligon', type: 'number', default: 0, help: BUDGET_HELP },
      { id: 'pose_mode', label: 'Poz', type: 'select', default: 'auto', options: POSE }
    ]
  },
  {
    type: 'model.meshy.retexture',
    label: 'Meshy Yeniden Doku',
    category: '3d',
    description: 'Var olan modele prompt ile yeni doku giydirir.',
    inputs: [
      { id: 'model', label: 'Model', type: 'model' },
      { id: 'prompt', label: 'Doku promptu', type: 'prompt' }
    ],
    outputs: [{ id: 'model', label: 'Model', type: 'model' }],
    params: [
      { id: 'ai_model', label: 'Model', type: 'select', default: 'latest', options: opts(['latest', 'En güncel'], ['meshy-6', 'Meshy 6'], ['meshy-6-lite', 'Meshy 6 Lite']) },
      { id: 'enable_original_uv', label: 'Orijinal UV koru', type: 'bool', default: true },
      { id: 'enable_pbr', label: 'PBR haritaları', type: 'bool', default: true },
      { id: 'texture_resolution', label: 'Doku çözünürlüğü', type: 'select', default: '2k', options: TEX_RES }
    ]
  },
  {
    type: 'model.meshy.remesh',
    label: 'Meshy Remesh',
    category: '3d',
    description: 'Poligon bütçesine indirir / topolojiyi düzenler (LOD için de kullanılır).',
    inputs: [{ id: 'model', label: 'Model', type: 'model' }],
    outputs: [{ id: 'model', label: 'Model', type: 'model' }],
    params: [
      { id: 'topology', label: 'Topoloji', type: 'select', default: 'triangle', options: opts(['triangle', 'Üçgen'], ['quad', 'Quad']) },
      { id: 'target_polycount', label: 'Hedef poligon', type: 'number', default: 0, help: BUDGET_HELP }
    ]
  },
  {
    type: 'model.meshy.rig',
    label: 'Meshy Rig',
    category: '3d',
    description: 'Dokulu insansı (iki ayaklı) modeli rigler; yürüme/koşma animasyonu da verir.',
    inputs: [{ id: 'model', label: 'Model', type: 'model' }],
    outputs: [{ id: 'model', label: 'Riglenmiş model', type: 'model' }],
    params: [{ id: 'height_meters', label: 'Boy (m)', type: 'number', default: 0, help: '0 = asset boyutundan' }]
  },
  {
    type: 'blender.process',
    label: 'Blender Temizlik',
    category: 'process',
    description: 'Blender arka planda: ölçeği asset boyutuna oturtur, pivotu tabana alır, bütçeye göre azaltır, isimlendirir, FBX çıkarır ve kalite kontrol için önizleme render eder.',
    inputs: [{ id: 'model', label: 'Model', type: 'model' }],
    outputs: [{ id: 'model', label: 'Model', type: 'model' }],
    params: [
      { id: 'format', label: 'Çıktı formatı', type: 'select', default: 'fbx', options: opts(['fbx', 'FBX'], ['glb', 'GLB']) },
      { id: 'fit_size', label: 'Boyuta ölçekle', type: 'bool', default: true },
      { id: 'decimate', label: 'Bütçeye indir', type: 'bool', default: true },
      { id: 'origin', label: 'Pivot', type: 'select', default: 'bottom', options: opts(['bottom', 'Taban ortası'], ['center', 'Merkez'], ['keep', 'Değiştirme']) },
      { id: 'preview', label: 'Önizleme render', type: 'bool', default: true },
      {
        id: 'skeleton',
        label: 'İskelet standardı',
        type: 'select',
        default: 'none',
        options: opts(['none', 'Değiştirme'], ['manny', 'UE5 Manny/Quinn adları']),
        help: 'Rigli karakterlerde kemik adlarını Manny standardına çevirir; IK Rig ve retarget otomatik eşleşir'
      }
    ]
  },
  {
    type: 'rig.assembly',
    label: 'Montaj ve Hareket Rigi',
    category: 'process',
    description:
      'Modeli Blender’da ölçer; yapay zekâ ölçülü görünüşlere bakıp hareketli parçaları (tekerlek, kapı, kaput, bagaj, kapak…) keser, pivotlarına kemik koyar, efekt noktalarını (egzoz, far, toz), ezilme bölgelerini (morph target + hasar maskesi) ve açılma/kapanma kliplerini ekler, kit seslerini kliplere eşler. Kontrol render’larına bakıp kendi planını düzeltir. Unreal Export bunu iskeletli mesh + araç / obje Blueprint’i olarak kurar.',
    inputs: [
      { id: 'model', label: 'Model', type: 'model' },
      { id: 'image', label: 'Referans görsel', type: 'image', optional: true }
    ],
    outputs: [{ id: 'model', label: 'Rigli model', type: 'model' }],
    params: [
      {
        id: 'engine',
        label: 'Motor',
        type: 'select',
        default: 'api',
        options: opts(['api', 'API (Ayarlar’daki LLM)'], ['claude-code', 'Claude Code (aboneliğinle)'], ['codex', 'Codex CLI (aboneliğinle)']),
        help: 'Claude Code / Codex: kontrol render’larına kendisi bakar, Blender’ı kendisi çalıştırır'
      },
      { id: 'provider', label: 'LLM (API motoru, görsel destekli)', type: 'select', default: '', source: 'llm', help: 'Boş = Ayarlar’daki kalite kontrol (görsel) modeli' },
      { id: 'extra', label: 'Ek talimat', type: 'textarea', default: '', help: 'Ör. "4 kapı ve bagaj açılsın, kaput açılmasın"' },
      { id: 'length', label: 'Gerçek uzunluk (m)', type: 'number', default: 0, help: '0 = asset boyutundan ya da modelden' },
      { id: 'rounds', label: 'Kontrol turu', type: 'number', default: 2, help: 'Yapay zekâ kontrol render’larına bakıp planı en fazla bu kadar düzeltir' },
      { id: 'plan', label: 'Elle plan (JSON)', type: 'textarea', default: '', help: 'Doluysa yapay zekâ atlanır; biçim resources/python/forge_assembly.py başında' }
    ]
  },
  {
    type: 'qa.review',
    label: 'Kalite Kontrol',
    category: 'qa',
    description:
      'Model ve görsel: teknik kontrol (poligon, UV, ölçü) + Claude görsel inceleme. Animasyon: ayak kayması, zemine girme, titreme, kopukluk, hedef hız/yön/dönüş. Ses: sessizlik, kırpılma, seviye, süre, döngü dikişi (ücretsiz, yerel ölçüm). Puan düşükse en yakın Prompt Motoruna ya da Kimodo düğümüne geri bildirim gönderip yeniden ürettirir.',
    inputs: [{ id: 'subject', label: 'İncelenecek', type: 'media' }],
    outputs: [
      { id: 'subject', label: 'Onaylı', type: 'media' },
      { id: 'report', label: 'Rapor', type: 'report' }
    ],
    params: [
      { id: 'min_score', label: 'Geçme puanı (0-10)', type: 'number', default: 7 },
      { id: 'max_retries', label: 'En fazla yeniden deneme', type: 'number', default: 2 },
      { id: 'on_fail', label: 'Hâlâ başarısızsa', type: 'select', default: 'stop', options: opts(['stop', 'Durdur'], ['continue', 'Uyarıyla devam']) },
      { id: 'focus', label: 'Ek kriter', type: 'textarea', default: '', help: 'Ör. "silüet uzaktan okunmalı"' }
    ]
  },
  {
    type: 'audio.elevenlabs',
    label: 'ElevenLabs SFX',
    category: 'audio',
    description: 'Ses efekti / ambiyans üretir. Varyasyon sayısı kadar dosya çıkarır.',
    inputs: [{ id: 'prompt', label: 'Prompt', type: 'prompt' }],
    outputs: [{ id: 'audio', label: 'Ses', type: 'audio' }],
    params: [
      { id: 'model_id', label: 'Model', type: 'select', default: 'eleven_text_to_sound_v2', options: opts(['eleven_text_to_sound_v2', 'Sound v2'], ['eleven_text_to_sound_v3', 'Sound v3']) },
      { id: 'variations', label: 'Varyasyon', type: 'number', default: 2 },
      { id: 'duration', label: 'Süre (sn)', type: 'number', default: 0, help: '0 = prompt motoru seçsin' },
      { id: 'loop', label: 'Döngü', type: 'select', default: 'auto', options: opts(['auto', 'Prompttan al'], ['yes', 'Evet'], ['no', 'Hayır']) },
      { id: 'prompt_influence', label: 'Prompt etkisi (0-1)', type: 'number', default: 0.4 }
    ]
  },
  {
    type: 'audio.engine',
    label: 'Dinamik Motor Sesi',
    category: 'audio',
    description:
      'Aynı motordan farklı devirlerde kusursuz döngü katmanları üretir. Unreal export bunları RPM ve Throttle girişli bir MetaSound’a bağlar: oyunda devir değiştikçe perde ve katmanlar akıcı geçiş yapar.',
    inputs: [{ id: 'prompt', label: 'Motor karakteri', type: 'prompt' }],
    outputs: [{ id: 'audio', label: 'Ses seti', type: 'audio' }],
    params: [
      { id: 'layers', label: 'Katman sayısı', type: 'number', default: 5, help: '2-8; fazlası daha akıcı geçiş' },
      { id: 'idle_rpm', label: 'Rölanti devri', type: 'number', default: 900 },
      { id: 'max_rpm', label: 'En yüksek devir', type: 'number', default: 7000 },
      { id: 'seconds', label: 'Katman süresi (sn)', type: 'number', default: 6 },
      { id: 'model_id', label: 'Model', type: 'select', default: 'eleven_text_to_sound_v2', options: opts(['eleven_text_to_sound_v2', 'Sound v2'], ['eleven_text_to_sound_v3', 'Sound v3']) },
      { id: 'prompt_influence', label: 'Prompt etkisi (0-1)', type: 'number', default: 0.55 }
    ]
  },
  {
    type: 'anim.kimodo',
    label: 'Kimodo Hareket',
    category: 'anim',
    description: 'NVIDIA Kimodo ile metinden insan hareketi üretir (SOMA iskeleti), Blender’da Manny adlarına çevirip root motion’lı FBX yapar. Unreal export ana karaktere otomatik retarget eder.',
    inputs: [{ id: 'asset', label: 'Asset', type: 'asset' }],
    outputs: [{ id: 'anim', label: 'Animasyon', type: 'anim' }],
    params: [
      { id: 'prompt', label: 'Hareket', type: 'textarea', default: '', help: 'Boş = asset açıklamasından Claude yazar. Her satır = sıralı bir segment' },
      { id: 'seconds', label: 'Süre (sn)', type: 'text', default: '', help: 'ör. "4" veya segment başına "3 2"; boş = otomatik' },
      { id: 'root_motion', label: 'Root motion', type: 'select', default: 'root', options: opts(['root', 'Root kemiğine aktar'], ['inplace', 'Yerinde (in-place)'], ['raw', 'Ham']) },
      { id: 'steps', label: 'Difüzyon adımı', type: 'number', default: 100 },
      { id: 'seed', label: 'Seed', type: 'number', default: -1, help: '-1 = rastgele' }
    ]
  },
  {
    type: 'export.ue',
    label: 'Unreal Export',
    category: 'output',
    description: 'Dosyaları isimlendirme kurallarıyla export klasörüne koyar; Unreal açıksa Python Remote Execution ile otomatik import eder.',
    inputs: [{ id: 'subject', label: 'Asset', type: 'media' }],
    outputs: [],
    params: [
      { id: 'auto_import', label: "Unreal'a otomatik import", type: 'bool', default: true },
      { id: 'content_path', label: 'İçerik yolu', type: 'text', default: '', help: 'Boş = <UE kökü>/<kategori>' },
      { id: 'lods', label: 'LOD oranları', type: 'text', default: '0.5,0.25,0.1', help: 'İskeletli mesh için; boş = LOD yok' },
      { id: 'ik_rig', label: 'IK Rig + Manny retarget', type: 'bool', default: true, help: 'İskeletli mesh için IK Rig ve Manny→karakter retargeter kurar' },
      { id: 'template', label: 'Araç şablonu', type: 'text', default: '', help: 'Montajlı araç için kopyalanacak araç Blueprint’i (/Game/...). Boş = projedeki KV şablonlarından uygun olanı' },
      { id: 'kit_wait', label: 'Kit seslerini bekle (dk)', type: 'number', default: 20, help: 'Montajlı araçta kapı / motor / korna sesleri hâlâ üretiliyorsa en fazla bu kadar beklenir' }
    ]
  }
]

export const NODE_DEF_MAP: Record<string, NodeDef> = Object.fromEntries(NODE_DEFS.map((d) => [d.type, d]))

export function defaultParams(type: string): Record<string, string | number | boolean> {
  const def = NODE_DEF_MAP[type]
  if (!def) return {}
  return Object.fromEntries(def.params.map((p) => [p.id, p.default]))
}
