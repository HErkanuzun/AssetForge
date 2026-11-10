// SPDX-License-Identifier: AGPL-3.0-only
import type {
  AnimSystem,
  AnimSystemClipState,
  AnimSystemKind,
  AgentConversation,
  AgentCliInfo,
  ComfyLocalStatus,
  ConnectEvent,
  ConnectService,
  AgentEvent,
  AgentInput,
  McpServerStatus,
  AnimSegment,
  AssetKind,
  AssetSpec,
  Bible,
  DesignSection,
  GameDesign,
  Brief,
  BriefEvent,
  BriefInput,
  ImportResult,
  Job,
  KimodoStatus,
  Project,
  SettingsPatch,
  SettingsPublic,
  UeNode
} from '../shared/types'

export interface ForgeApi {
  settings: {
    get(): Promise<SettingsPublic>
    set(patch: SettingsPatch): Promise<SettingsPublic>
  }
  project: {
    load(): Promise<Project>
    save(p: Project): Promise<void>
    pickDir(): Promise<Project | null>
  }
  pickFiles(filters: { name: string; extensions: string[] }[], multi?: boolean): Promise<string[]>
  importAssets(file: string): Promise<ImportResult>
  extractBible(pdfs: string[], current: Bible, categoryHint: string): Promise<{ data: Partial<Bible>; usd: number }>
  design: {
    generate(project: Project, section: DesignSection, instruction: string, engine: 'api' | 'claude-code' | 'codex'): Promise<{ data: Partial<GameDesign>; usd: number }>
    exportMd(project: Project): Promise<string>
    /** Tasarımı ve asset kurallarını Unreal Agent Skill olarak yazar */
    teachUe(project: Project): Promise<string[]>
  }
  run: {
    start(pipelineId: string, assetIds: string[]): Promise<Job[]>
    cancel(jobId: string): Promise<void>
  }
  jobs(): Promise<Job[]>
  /** Görev çubuğu kısayolundan sayfa açma isteği */
  onNavigate(cb: (page: string) => void): () => void
  onJobUpdate(cb: (job: Job) => void): () => void
  ueDiscover(): Promise<UeNode[]>
  ueStatus(): Promise<{ remote: UeNode[]; mcp: boolean; python: string }>
  testClaude(): Promise<string>
  testMeshy(): Promise<number>
  /** ComfyUI sürümü ve GPU */
  testComfy(): Promise<string>
  openPath(p: string): Promise<string>
  showItem(p: string): Promise<void>
  /** Sürükle-bırak ile gelen dosyanın diskteki yolu */
  pathForFile(f: File): string
  brief: {
    create(seed?: { title?: string; kind?: AssetKind }): Promise<Brief>
    list(): Promise<Brief[]>
    get(id: string): Promise<Brief | null>
    send(id: string, input: BriefInput): Promise<Brief>
    patch(id: string, patch: Partial<Pick<Brief, 'title' | 'kit' | 'status' | 'committedAssetIds'>>): Promise<Brief>
    remove(id: string): Promise<void>
    toAssets(id: string): Promise<AssetSpec[]>
    onEvent(cb: (e: BriefEvent) => void): () => void
  }
  library: {
    thumbs(): Promise<Record<string, string>>
  }
  agent: {
    list(): Promise<AgentConversation[]>
    get(id: string): Promise<AgentConversation | null>
    create(providerId?: string): Promise<AgentConversation>
    send(id: string, input: AgentInput): Promise<AgentConversation>
    approve(id: string, toolId: string, ok: boolean): Promise<void>
    stop(id: string): Promise<void>
    remove(id: string): Promise<void>
    onEvent(cb: (e: AgentEvent) => void): () => void
    /** Dış MCP istemcisi (ör. Claude Code) bir araç çağırdı */
    /** Kurulu Claude Code / Codex CLI ve sürümleri (force = yeniden tara) */
    clis(force?: boolean): Promise<AgentCliInfo[]>
    onExternal(cb: (toolName: string) => void): () => void
  }
  onProjectChanged(cb: (p: Project) => void): () => void
  llm: {
    test(providerId: string): Promise<string>
  }
  /** Hızlı bağlantı: servis sayfasını tarayıcıda açar, anahtarı otomatik yakalar */
  connect: {
    start(service: ConnectService): Promise<void>
    cancel(): Promise<void>
    /** Bekleyen bağlantıda panodaki metni hemen dene */
    tryClipboard(): Promise<void>
    onEvent(cb: (e: ConnectEvent) => void): () => void
  }
  diag: {
    /** Tanılama dosyasını kaydeder; kaydedilen yol ya da iptalde null */
    save(): Promise<string | null>
    openLogs(): Promise<void>
  }
  mcp: {
    status(): Promise<{ servers: McpServerStatus[]; expose: { running: boolean; url: string } }>
    test(id: string): Promise<McpServerStatus>
  }
  /** AssetForge'un kurduğu yerel ComfyUI */
  comfy: {
    status(): Promise<ComfyLocalStatus>
    step(step: string): Promise<void>
    logs(): Promise<string>
    /** Düğüm editörünü tarayıcıda açar */
    open(): Promise<void>
    onLog(cb: (line: string) => void): () => void
  }
  kimodo: {
    status(): Promise<KimodoStatus>
    step(step: string): Promise<void>
    logs(): Promise<string>
    suggest(text: string, character: string): Promise<{ segments: AnimSegment[]; loop: boolean; name: string; usd: number }>
    onLog(cb: (line: string) => void): () => void
  }
  animsys: {
    list(characterId?: string): Promise<AnimSystem[]>
    create(kind: AnimSystemKind, characterId: string, name?: string, style?: string): Promise<AnimSystem>
    save(sys: AnimSystem): Promise<AnimSystem>
    remove(id: string, withAssets?: boolean): Promise<void>
    states(id: string): Promise<AnimSystemClipState[]>
    plan(id: string, request: string): Promise<{ system: AnimSystem; rationale: string; usd: number }>
    produce(id: string, opts?: { keys?: string[]; force?: boolean }): Promise<{ clips: number; phases: number }>
    stop(id: string): Promise<void>
    build(id: string): Promise<NonNullable<AnimSystem['lastBuild']>>
  }
}

declare global {
  interface Window {
    forge: ForgeApi
  }
}
