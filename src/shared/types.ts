// SPDX-License-Identifier: AGPL-3.0-only
// Uygulamanın her katmanında (main, preload, arayüz) paylaşılan veri tipleri.

export type AssetKind = 'model' | 'character' | 'creature' | 'vehicle' | 'weapon' | 'texture' | 'image' | 'sfx' | 'music' | 'vfx' | 'animation'

export interface AssetSpec {
  id: string
  name: string
  kind: AssetKind
  category: string
  subcategory: string
  description: string
  /** Ham boyut metni, ör. "4x4x0.3" veya "1,80 m" */
  size: string
  materials: string
  variants: string
  /** Üçgen bütçesi (0 = Proje Kitabı varsayılanı) */
  triBudget: number
  budgetNote: string
  priority: string
  status: string
  /** Hangi tablodan geldiği (ör. "Modeller") */
  source: string
  /** Eşlenmemiş tüm sütunlar; prompt motoru bunları da okur */
  extra: Record<string, string>
  /** Brief'ten doğan asset'ler: ana asset ve kit üyeleri */
  briefId?: string
  parentId?: string
  /** Kit içindeki görevi, ör. "engine_loop", "door_open", "dust_sand" */
  role?: string
  /** Karmaşıklık seviyesi (Brief'te seçilen) */
  tier?: string
  /** Görsel stil (ör. "stylized low poly", "realistic PBR") */
  style?: string
  /** Referans görsel dosyaları */
  refs?: string[]
  /** İlişkili kütüphane asset'leri (ör. araç → kum dokusu) */
  links?: string[]
  /** Brief'in önerdiği hat */
  pipelineId?: string
  /** Dinamik ses ayarı (motor sesi gibi) */
  dynamic?: DynamicSoundSpec
}

export interface DynamicSoundSpec {
  type: 'engine'
  layers: number
  idleRpm: number
  maxRpm: number
  /** Motor karakteri: ör. "inline-4 petrol", "V8 muscle", "diesel truck" */
  engine: string
}

export interface PaletteEntry {
  code: string
  group: string
  name: string
  hex: string
  usage: string
}

export interface MaterialEntry {
  name: string
  group: string
  description: string
  palette: string
  notes: string
  priority: string
}

export interface CategoryRule {
  code: string
  name: string
  styleNotes: string
  triBudget: number
  textureRes: TextureRes
}

export type TextureRes = '1k' | '2k' | '4k' | '8k'

export interface NamingRules {
  staticMesh: string
  skeletalMesh: string
  texture: string
  materialInstance: string
  sound: string
}

export interface Bible {
  projectName: string
  genre: string
  setting: string
  loreSummary: string
  artDirection: string
  realism: string
  moodKeywords: string[]
  forbidden: string[]
  audioDirection: string
  palette: PaletteEntry[]
  materials: MaterialEntry[]
  categories: CategoryRule[]
  technical: {
    defaultTriBudget: number
    textureRes: TextureRes
    pbr: boolean
    ueContentRoot: string
    /** Opsiyonel master materyal yolu (ör. /Game/Materials/M_Master) — boşsa FBX materyali kullanılır */
    masterMaterial: string
    naming: NamingRules
  }
}

export interface PipelineNode {
  id: string
  type: string
  position: { x: number; y: number }
  params: Record<string, ParamValue>
}

export interface PipelineEdge {
  id: string
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}

export interface Pipeline {
  id: string
  name: string
  description: string
  nodes: PipelineNode[]
  edges: PipelineEdge[]
}

export interface Project {
  version: 1
  name: string
  bible: Bible
  assets: AssetSpec[]
  pipelines: Pipeline[]
  /** Animasyon Stüdyosu klipleri */
  clips?: AnimClip[]
  /** Animasyon sistemleri (Blend Space, Motion Matching ...) */
  animSystems?: AnimSystem[]
}

export type ParamValue = string | number | boolean

export interface GeneratedPrompt {
  target: string
  prompt: string
  negative_prompt: string
  texture_prompt: string
  duration_seconds: number
  loop: boolean
  pose: 'none' | 'a-pose' | 't-pose'
  rationale: string
}

export interface QAReport {
  score: number
  pass: boolean
  issues: string[]
  strengths: string[]
  prompt_fix: string
  summary: string
  technical: string[]
}

export type MeshyResource = 'text-to-3d' | 'image-to-3d' | 'multi-image-to-3d' | 'retexture' | 'remesh' | 'rigging' | 'text-to-image'

export interface ModelStats {
  tris: number
  originalTris: number
  verts: number
  objects: number
  materials: number
  hasUV: boolean
  dims: [number, number, number]
  rigged: boolean
  decimated: boolean
  scaled: number
}

export type Artifact =
  | { kind: 'asset'; asset: AssetSpec }
  | { kind: 'prompt'; prompt: GeneratedPrompt }
  | { kind: 'image'; files: string[]; meshyTaskId?: string; meshyResource?: MeshyResource }
  | {
      kind: 'model'
      file: string
      glb?: string
      meshyTaskId?: string
      meshyResource?: MeshyResource
      thumbnail?: string
      previews?: string[]
      textures?: Record<string, string>
      stats?: ModelStats
      rigged?: boolean
      animations?: Record<string, string>
      textured?: boolean
    }
  /** target: istenen süre ve döngü (kalite kontrol karşılaştırır) */
  | { kind: 'audio'; files: string[]; target?: { seconds?: number; loop?: boolean } }
  | { kind: 'audioset'; layers: { file: string; baseRpm: number; label: string }[]; dynamic: DynamicSoundSpec; target?: { seconds?: number; loop?: boolean } }
  | { kind: 'animation'; clip: string; bvh: string; fbx: string; seconds: number; rootMotion: string; loop?: boolean; motion?: ClipMotionInfo }
  | { kind: 'report'; report: QAReport }

export type NodeStatus = 'idle' | 'running' | 'done' | 'failed' | 'skipped' | 'retrying'

export interface NodeRunState {
  status: NodeStatus
  progress: number
  logs: string[]
  outputs?: Record<string, Artifact>
  attempts: number
  error?: string
}

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'canceled'

export interface Job {
  id: string
  pipelineId: string
  pipelineName: string
  assetId: string
  assetName: string
  status: JobStatus
  createdAt: number
  finishedAt?: number
  outDir: string
  nodes: Record<string, NodeRunState>
  cost: { claudeUsd: number; meshyCredits: number; audioChars: number }
  error?: string
  warnings: string[]
}

export interface SettingsPublic {
  claudeModel: string
  hasKeys: { anthropic: boolean; meshy: boolean; elevenlabs: boolean; huggingface: boolean; comfy: boolean }
  /** Manny/Quinn IK Rig yolu (retarget kaynağı) */
  mannyIkRig: string
  wslDistro: string
  kimodoUrl: string
  kimodoBackend: 'native' | 'wsl'
  kimodoHome: string
  comfyUrl: string
  comfyWorkflow: string
  blenderPath: string
  projectDir: string
  audioFormat: string
  concurrency: number
  llmProviders: LlmProvider[]
  llmRoles: LlmRoles
  mcpServers: McpServerConfig[]
  mcpExpose: McpExpose
  webSearch: boolean
}

export interface SettingsPatch {
  claudeModel?: string
  comfyUrl?: string
  comfyWorkflow?: string
  blenderPath?: string
  projectDir?: string
  audioFormat?: string
  concurrency?: number
  mannyIkRig?: string
  wslDistro?: string
  kimodoUrl?: string
  kimodoBackend?: 'native' | 'wsl'
  kimodoHome?: string
  secrets?: { anthropic?: string; meshy?: string; elevenlabs?: string; huggingface?: string; comfy?: string }
  llmProviders?: LlmProvider[]
  llmRoles?: LlmRoles
  mcpServers?: McpServerConfig[]
  mcpExpose?: McpExpose
  webSearch?: boolean
  /** Sağlayıcı anahtarları (id → anahtar; boş = sil) */
  providerKeys?: Record<string, string>
}

export interface ImportResult {
  assets: AssetSpec[]
  palette: PaletteEntry[]
  materials: MaterialEntry[]
  sheets: { name: string; rows: number; usedAs: string }[]
}

export interface UeNode {
  nodeId: string
  projectName: string
  engineVersion: string
  machine: string
}

// ---------------------------------------------------------------------------
// Brief Chat (Atölye)

export interface BriefOption {
  label: string
  description?: string
}

export interface BriefQuestion {
  toolUseId: string
  question: string
  options: BriefOption[]
  multi: boolean
}

export type BriefViewItem =
  | { kind: 'user'; text: string; images?: string[]; links?: string[] }
  | { kind: 'assistant'; text: string }
  | { kind: 'question'; question: BriefQuestion; answer?: string }
  | { kind: 'event'; text: string }

export interface BriefSpec {
  name: string
  kind: AssetKind
  category: string
  description: string
  style: string
  tier: string
  triBudget: number
  size: string
  palette: string[]
  materials: string
  world: string
  notes: string
}

export interface KitItem {
  key: string
  group: 'model' | 'doku' | 'ses' | 'vfx' | 'animasyon'
  kind: AssetKind
  name: string
  role: string
  purpose: string
  description: string
  priority: string
  include: boolean
  /** Kütüphanede zaten varsa onun id'si (yeniden üretilmez) */
  existingId?: string
  dynamic?: DynamicSoundSpec
  /** Animasyon kitleri için Kimodo prompt'u ve süresi */
  motion?: { prompt: string; seconds: number; loop: boolean }
}

export interface Brief {
  id: string
  title: string
  status: 'drafting' | 'ready' | 'committed'
  createdAt: number
  updatedAt: number
  spec: BriefSpec
  kit: KitItem[]
  refs: string[]
  links: string[]
  view: BriefViewItem[]
  /** Claude mesaj geçmişi (append-only, thinking blokları dahil olduğu gibi saklanır) */
  history: unknown[]
  pending?: BriefQuestion
  /** ask_question dışındaki araçların, kullanıcı cevabıyla birlikte gönderilecek sonuçları */
  pendingResults?: unknown[]
  summary?: string
  costUsd: number
  committedAssetIds?: string[]
}

export type BriefEvent =
  { type: 'delta'; briefId: string; text: string } | { type: 'thinking'; briefId: string; on: boolean } | { type: 'brief'; brief: Brief } | { type: 'error'; briefId: string; error: string }

export interface BriefInput {
  text: string
  images?: string[]
  links?: string[]
  /** Bekleyen soruya cevap */
  answer?: string
}

// ---------------------------------------------------------------------------
// Animasyon (Kimodo)

export interface AnimSegment {
  text: string
  seconds: number
}

export interface AnimClip {
  id: string
  characterId: string
  name: string
  segments: AnimSegment[]
  loop: boolean
  rootMotion: 'root' | 'inplace' | 'raw'
  seed: number
  steps: number
  status: 'idle' | 'queued' | 'running' | 'done' | 'failed'
  error?: string
  bvh?: string
  fbx?: string
  seconds?: number
  updatedAt: number
}

// ---------------------------------------------------------------------------
// Animasyon sistemleri: birbiriyle senkron, birbirini tamamlayan klip setleri

export type AnimSystemKind = 'single' | 'montage' | 'blendspace1d' | 'blendspace2d' | 'statemachine' | 'aimoffset' | 'motionmatching'

/** Klibin sistemdeki görevi — kök yolu ve poz eşleme bundan türetilir */
export type AnimClipRole = 'idle' | 'loop' | 'start' | 'stop' | 'turn' | 'pivot' | 'action' | 'jump_start' | 'jump_loop' | 'land' | 'aim' | 'other'

export interface AnimSystemClip {
  /** Sistem içi anahtar, ör. "walk_fwd" */
  key: string
  label: string
  /** Kart grubu, ör. "Döngüler", "Başlangıçlar" */
  group: string
  role: AnimClipRole
  /** Kimodo promptu (İngilizce, "A person ..." ile başlar) */
  prompt: string
  seconds: number
  loop: boolean
  rootMotion: 'root' | 'inplace'
  /** Hedef hız (m/sn); start/stop/pivot için başlangıç hızı */
  speed: number
  /** Bitiş hızı (m/sn) — start: 0→speed, stop: speed→0 gibi */
  speedEnd?: number
  /** Hareket yönü, bakışa göre derece (0 ileri, 90 sağ, -90 sol, 180 geri) */
  moveDir: number
  /** Klip boyunca toplam dönüş, derece (sağ +) */
  turn: number
  /** Başlangıç pozu bu klibin son pozuna eşlenir */
  from?: string
  /** Bitiş pozu bu klibin ilk pozuna eşlenir */
  to?: string
  /** Kök yolu kısıtı uygulansın mı (hız/yön/dönüş tam tutsun) */
  constrainPath: boolean
  /** Blend Space / Aim Offset koordinatı (boşsa ölçümden) */
  sample?: { x: number; y?: number }
  /** Aim Offset için hedef açılar */
  aim?: { yaw: number; pitch: number }
  enabled: boolean
  seed?: number
  /** Üretimde oluşturulan ANM asset'i */
  assetId?: string
}

export interface AnimSystemAxis {
  name: string
  min: number
  max: number
  grid: number
}

export interface AnimSystem {
  id: string
  name: string
  kind: AnimSystemKind
  characterId: string
  /** Kimodo özne ifadesi, ör. "A tired soldier" (her prompta aynı stil) */
  style: string
  description: string
  clips: AnimSystemClip[]
  axes?: { x: AnimSystemAxis; y?: AnimSystemAxis }
  createdAt: number
  updatedAt: number
  producing?: boolean
  lastBuild?: { at: number; ok: boolean; notes: string[]; errors: string[]; script?: string; assets?: string[] }
}

export interface ClipMotionInfo {
  measured: { seconds: number; distance: number; speed: number; displacementSpeed: number; direction: number; turn: number }
  markers: { L: number[]; R: number[] }
  loop: { start: number; end: number; cost: number; sourceFrames: number } | null
  frames: number
  fps: number
}

export interface AnimSystemClipState {
  key: string
  assetId?: string
  status: 'none' | 'waiting' | 'queued' | 'running' | 'done' | 'failed'
  progress: number
  error?: string
  motion?: ClipMotionInfo
  bvhUrl?: string
  /** Son üretimin kalite kontrol sonucu (ayak kayması, titreme, hedef hız/yön) */
  qa?: { score: number; pass: boolean; summary: string; issues: string[]; technical: string[] }
}

export interface KimodoSetupStep {
  id: string
  label: string
  done: boolean
  hint?: string
}

export interface KimodoStatus {
  backend: 'native' | 'wsl'
  steps: KimodoSetupStep[]
  running: boolean
  healthy: boolean
  model?: string
  device?: string
  busy?: boolean
  postprocess?: boolean
  /** BIOS sanallaştırma (yalnızca WSL yolu için gerekli) */
  virtualization?: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Yapay zeka sağlayıcıları, Yapımcı asistanı ve MCP bağlantıları

export type LlmKind = 'anthropic' | 'openai'

export interface LlmProvider {
  id: string
  name: string
  /** anthropic: Claude API (veya uyumlu uç) · openai: OpenAI uyumlu (Ollama, LM Studio, OpenRouter, vLLM…) */
  kind: LlmKind
  baseUrl: string
  model: string
  /** Görsel girdi destekliyor mu (kalite kontrol ve önizleme incelemesi için) */
  vision: boolean
  /** Yerleşik Claude sağlayıcısı (silinemez; modeli Claude modeli ayarından gelir) */
  builtin?: boolean
  hasKey?: boolean
}

export interface LlmRoles {
  /** Yapımcı asistanı */
  assistant: string
  /** Prompt motoru, Proje Kitabı çıkarımı, hareket segmentleri */
  prompts: string
  /** Görsel kalite kontrol */
  vision: string
}

export interface McpServerConfig {
  id: string
  name: string
  transport: 'stdio' | 'http'
  /** stdio: çalıştırılacak komut (ör. npx, uvx, python) */
  command: string
  /** stdio: argümanlar (boşlukla ayrılmış, tırnak desteklenir) */
  args: string
  /** stdio: KEY=VALUE satırları */
  env: string
  /** http: Streamable HTTP adresi */
  url: string
  /** http: "Başlık: değer" satırları */
  headers: string
  enabled: boolean
  /** Araçları onay sormadan çalıştır */
  autoApprove: boolean
}

export interface McpServerStatus {
  id: string
  connected: boolean
  tools: string[]
  error?: string
}

export interface McpExpose {
  enabled: boolean
  port: number
  token: string
}

export type AgentViewItem =
  | { kind: 'user'; text: string; images?: string[]; context?: string }
  | { kind: 'assistant'; text: string }
  | {
      kind: 'tool'
      id: string
      name: string
      input: unknown
      status: 'running' | 'done' | 'error' | 'awaiting' | 'denied'
      /** Onay isteniyorsa kullanıcıya gösterilecek açıklama */
      ask?: string
      result?: string
      images?: string[]
    }
  | { kind: 'event'; text: string }

export interface AgentConversation {
  id: string
  title: string
  providerId: string
  model: string
  createdAt: number
  updatedAt: number
  view: AgentViewItem[]
  /** Sağlayıcıya özgü mesaj geçmişi (olduğu gibi saklanır) */
  history: unknown[]
  costUsd: number
  busy?: boolean
}

export interface AgentContext {
  page: string
  selectedAssets: string[]
  briefId?: string
}

export interface AgentInput {
  text: string
  images?: string[]
  context?: AgentContext
}

export type AgentEvent =
  { type: 'delta'; convId: string; text: string } | { type: 'thinking'; convId: string; on: boolean } | { type: 'conv'; conv: AgentConversation } | { type: 'error'; convId: string; error: string }

/** Hızlı bağlantı: tarayıcıda giriş / anahtar sayfası */
export type ConnectService = 'anthropic' | 'meshy' | 'elevenlabs' | 'huggingface' | 'openrouter'

export interface ConnectEvent {
  service: ConnectService
  phase: 'waiting' | 'checking' | 'done' | 'error' | 'canceled'
  message: string
  /** Hata olsa da pano izlenmeye devam ediyor */
  pending?: boolean
}
