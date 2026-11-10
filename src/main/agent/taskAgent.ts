// SPDX-License-Identifier: AGPL-3.0-only
// Hat içindeki "Ajan Görevi" düğümü: seçilen LLM, seçilen araçlarla (MCP, terminal) bir görevi
// kendi başına yapar ve dosyaları düğümün klasörüne bırakır. Üç motor: API (Claude / OpenAI uyumlu),
// Claude Code CLI, Codex CLI.
import type Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'
import type { LlmProvider, McpServerConfig } from '../../shared/types'
import { oaChatStream, type OaMessage, type OaPart, type OaTool } from '../ai/openai'
import { run } from '../integrations/process'
import { callClaude, clientFor, usageCost } from '../providers/claude'
import { allProviders, getSettings } from '../settings'
import { ensureDir, sniffImage } from '../util'
import { externalTools, splitArgs } from './mcpClient'
import type { AgentTool, ToolCtx, ToolResult } from './tools'

export type AgentEngine = 'api' | 'claude-code' | 'codex'

export interface TaskAgentOptions {
  engine: AgentEngine
  /** API motoru için LLM sağlayıcısı ('' = Yapımcı rolündeki) */
  providerId: string
  /** '' = tüm etkin MCP sunucuları, 'none' = hiçbiri, yoksa sunucu id'si */
  mcp: string
  system: string
  task: string
  /** Modelin görmesi için girdi görselleri (API motoru) */
  images: string[]
  /** Ajanın okuyabilmesi gereken klasörler (girdi dosyaları) */
  readDirs: string[]
  outDir: string
  maxRounds: number
  timeoutMin: number
  /** Terminal komutu çalıştırabilsin mi */
  shell: boolean
  /** CLI motorları için model (boş = CLI varsayılanı) */
  cliModel: string
  log: (m: string) => void
  cost: (usd: number) => void
  signal: AbortSignal
}

/** Seçime göre MCP sunucuları */
export function mcpSelection(sel: string): McpServerConfig[] {
  if (sel === 'none') return []
  return getSettings().mcpServers.filter((s) => s.enabled && (!sel || s.id === sel))
}

export const mcpKey = (s: McpServerConfig) =>
  s.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || s.id.replace(/[^a-zA-Z0-9]/g, '_')

function kv(lines: string, sep: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const l of lines.split(/\r?\n/)) {
    const i = l.indexOf(sep)
    if (i > 0) out[l.slice(0, i).trim()] = l.slice(i + 1).trim()
  }
  return out
}

/** Claude Code --mcp-config JSON'u */
export function claudeMcpConfig(servers: McpServerConfig[]): { mcpServers: Record<string, unknown> } {
  const mcpServers: Record<string, unknown> = {}
  for (const s of servers)
    mcpServers[mcpKey(s)] = s.transport === 'stdio' ? { type: 'stdio', command: s.command, args: splitArgs(s.args), env: kv(s.env, '=') } : { type: 'http', url: s.url, headers: kv(s.headers, ':') }
  return { mcpServers }
}

const toml = (v: string) => JSON.stringify(v)
const tomlTable = (o: Record<string, string>) =>
  `{${Object.entries(o)
    .map(([k, v]) => `${toml(k)}=${toml(v)}`)
    .join(',')}}`

/** Codex -c mcp_servers.* ayarları */
export function codexMcpArgs(servers: McpServerConfig[]): string[] {
  const out: string[] = []
  for (const s of servers) {
    const k = `mcp_servers.${mcpKey(s)}`
    if (s.transport === 'stdio') {
      out.push('-c', `${k}.command=${toml(s.command)}`, '-c', `${k}.args=[${splitArgs(s.args).map(toml).join(',')}]`)
      const env = kv(s.env, '=')
      if (Object.keys(env).length) out.push('-c', `${k}.env=${tomlTable(env)}`)
    } else {
      out.push('-c', `${k}.url=${toml(s.url)}`)
      const h = kv(s.headers, ':')
      if (Object.keys(h).length) out.push('-c', `${k}.http_headers=${tomlTable(h)}`)
    }
  }
  return out
}

/** Dosya yazma / listeleme / (izinliyse) terminal: API motorunun yerleşik araçları */
function localTools(o: TaskAgentOptions): AgentTool[] {
  const inside = (p: string) => {
    const f = path.resolve(o.outDir, p)
    if (!f.toLowerCase().startsWith(path.resolve(o.outDir).toLowerCase())) throw new Error('Yalnızca çıktı klasörüne yazılabilir')
    return f
  }
  const obj = (input: unknown) => (input && typeof input === 'object' ? { ok: true as const, data: input as Record<string, string> } : { ok: false as const, error: 'object bekleniyor' })
  const tools: AgentTool[] = [
    {
      name: 'list_output_files',
      description: 'Lists the files currently in the output folder (name and size).',
      inputSchema: { type: 'object', properties: {} },
      parse: obj,
      run: async () => {
        const files = walk(o.outDir).map((f) => `${path.relative(o.outDir, f)} (${fs.statSync(f).size} bytes)`)
        return { text: files.join('\n') || '(empty)' }
      }
    },
    {
      name: 'write_text_file',
      description: 'Writes a UTF-8 text file into the output folder (e.g. a script, notes, an OBJ). Path is relative to the output folder.',
      inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
      parse: obj,
      run: async (_c, d) => {
        const { path: rel, content } = d as Record<string, string>
        const f = inside(rel)
        ensureDir(path.dirname(f))
        fs.writeFileSync(f, content, 'utf8')
        return { text: `written: ${f}` }
      }
    }
  ]
  if (o.shell)
    tools.push({
      name: 'run_command',
      description:
        'Runs a PowerShell command on the user’s Windows PC with the output folder as working directory. Use it for command-line tools (blender --background, ffmpeg, python…). Returns exit code and output (last 8000 chars). Max 10 minutes.',
      inputSchema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
      parse: obj,
      run: async (_c, d) => {
        const cmd = (d as Record<string, string>).command
        o.log(`$ ${cmd.slice(0, 200)}`)
        const r = await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { cwd: o.outDir, timeoutMs: 10 * 60 * 1000, signal: o.signal })
        return { text: `exit ${r.code}\n${r.out.slice(-8000)}`, isError: r.code !== 0 }
      }
    })
  return tools
}

export function walk(dir: string): string[] {
  const out: string[] = []
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const f = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(f))
    else out.push(f)
  }
  return out
}

function imageB64(f: string): { media: string; data: string } | null {
  try {
    const buf = fs.readFileSync(f)
    const media = sniffImage(buf)
    if (!media || buf.length > 4_500_000) return null
    return { media, data: buf.toString('base64') }
  } catch {
    return null
  }
}

const short = (v: unknown, n = 160) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return s.length > n ? s.slice(0, n) + '…' : s
}

async function callTool(tools: AgentTool[], o: TaskAgentOptions, name: string, input: unknown): Promise<ToolResult> {
  const t = tools.find((x) => x.name === name)
  if (!t) return { text: `Unknown tool: ${name}`, isError: true }
  const parsed = t.parse(input)
  if (!parsed.ok) return { text: `INVALID_INPUT: ${parsed.error}`, isError: true }
  o.log(`→ ${name} ${short(input)}`)
  try {
    const r = await t.run({ dir: o.outDir } as ToolCtx, parsed.data)
    if (r.isError) o.log(`  ✗ ${short(r.text, 300)}`)
    return r
  } catch (e) {
    o.log(`  ✗ ${(e as Error).message}`)
    return { text: `Error: ${(e as Error).message}`, isError: true }
  }
}

// --------------------------------------------------------------------------- API motoru

async function apiAgent(o: TaskAgentOptions): Promise<string> {
  const providers = allProviders()
  const p: LlmProvider | undefined = o.providerId ? providers.find((x) => x.id === o.providerId) : (providers.find((x) => x.id === getSettings().llmRoles.assistant) ?? providers[0])
  if (!p) throw new Error('Seçilen LLM sağlayıcısı bulunamadı (Ayarlar → Yapay zekâ)')
  const errors: string[] = []
  const mcp = o.mcp === 'none' ? [] : await externalTools(o.outDir, { onlyIds: mcpSelection(o.mcp).map((s) => s.id), headless: true, errors })
  for (const e of errors) o.log(`⚠ MCP bağlanamadı — ${e}`)
  if (o.mcp && o.mcp !== 'none' && !mcp.length) throw new Error(`MCP sunucusuna bağlanılamadı: ${errors.join('; ') || o.mcp}`)
  const tools = [...localTools(o), ...mcp]
  o.log(`${p.name} (${p.model || getSettings().claudeModel}) · ${tools.length} araç`)
  return p.kind === 'anthropic' ? anthropicAgent(p, tools, o) : openaiAgent(p, tools, o)
}

type AMsg = Anthropic.Beta.BetaMessageParam
type ABlock = Anthropic.Beta.BetaContentBlockParam

async function anthropicAgent(p: LlmProvider, tools: AgentTool[], o: TaskAgentOptions): Promise<string> {
  const model = p.builtin ? getSettings().claudeModel : p.model
  const client = clientFor(p)
  const first: ABlock[] = []
  for (const f of o.images.slice(0, 4)) {
    const img = imageB64(f)
    if (img) first.push({ type: 'image', source: { type: 'base64', media_type: img.media as 'image/png', data: img.data } })
  }
  first.push({ type: 'text', text: o.task })
  const history: AMsg[] = [{ role: 'user', content: first }]
  const toolDefs = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema as Anthropic.Beta.BetaTool.InputSchema })) as Anthropic.Beta.BetaToolUnion[]
  let last = ''
  for (let round = 0; round < o.maxRounds; round++) {
    const msg = await callClaude(() =>
      client.beta.messages.create(
        { model, max_tokens: 16000, system: o.system, tools: toolDefs, messages: history, thinking: { type: 'adaptive' }, output_config: { effort: 'medium' } },
        { signal: o.signal }
      )
    )
    if (p.builtin) o.cost(usageCost(model, msg.usage))
    history.push({ role: 'assistant', content: msg.content as ABlock[] })
    const said = msg.content
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    if (said) {
      last = said
      o.log(`💬 ${short(said, 400)}`)
    }
    if (msg.stop_reason === 'pause_turn') continue
    if (msg.stop_reason !== 'tool_use') return last
    const results: ABlock[] = []
    for (const b of msg.content) {
      if (b.type !== 'tool_use') continue
      const r = await callTool(tools, o, b.name, b.input)
      const blocks: ({ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/png'; data: string } })[] = [{ type: 'text', text: r.text }]
      for (const f of (r.images ?? []).slice(0, 3)) {
        const img = imageB64(f)
        if (img) blocks.push({ type: 'image', source: { type: 'base64', media_type: img.media as 'image/png', data: img.data } })
      }
      results.push({ type: 'tool_result', tool_use_id: b.id, content: blocks, is_error: r.isError || undefined })
    }
    history.push({ role: 'user', content: results })
    if (o.signal.aborted) throw new Error('İptal edildi')
  }
  o.log(`Tur sınırına (${o.maxRounds}) ulaşıldı`)
  return last
}

async function openaiAgent(p: LlmProvider, tools: AgentTool[], o: TaskAgentOptions): Promise<string> {
  const parts: OaPart[] = [{ type: 'text', text: o.task }]
  if (p.vision)
    for (const f of o.images.slice(0, 4)) {
      const img = imageB64(f)
      if (img) parts.push({ type: 'image_url', image_url: { url: `data:${img.media};base64,${img.data}` } })
    }
  const history: OaMessage[] = [{ role: 'user', content: parts }]
  const oaTools: OaTool[] = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } }))
  let last = ''
  for (let round = 0; round < o.maxRounds; round++) {
    const r = await oaChatStream(p, [{ role: 'system', content: o.system }, ...history], oaTools, { text: () => undefined, thinking: () => undefined }, o.signal)
    history.push({ role: 'assistant', content: r.content || null, ...(r.toolCalls.length ? { tool_calls: r.toolCalls } : {}) })
    if (r.content) {
      last = r.content
      o.log(`💬 ${short(r.content, 400)}`)
    }
    if (!r.toolCalls.length) return last
    const imgParts: OaPart[] = []
    for (const tc of r.toolCalls) {
      let input: unknown = {}
      try {
        input = JSON.parse(tc.function.arguments || '{}')
      } catch {
        history.push({ role: 'tool', tool_call_id: tc.id, content: 'INVALID_JSON: resend the call with valid JSON arguments.' })
        continue
      }
      const res = await callTool(tools, o, tc.function.name, input)
      history.push({ role: 'tool', tool_call_id: tc.id, content: (res.isError ? 'ERROR: ' : '') + res.text })
      if (p.vision)
        for (const f of (res.images ?? []).slice(0, 3)) {
          const img = imageB64(f)
          if (img) imgParts.push({ type: 'image_url', image_url: { url: `data:${img.media};base64,${img.data}` } })
        }
    }
    if (imgParts.length) history.push({ role: 'user', content: [{ type: 'text', text: 'Images returned by the tools above:' }, ...imgParts] })
    if (o.signal.aborted) throw new Error('İptal edildi')
  }
  o.log(`Tur sınırına (${o.maxRounds}) ulaşıldı`)
  return last
}

// --------------------------------------------------------------------------- CLI motorları

/** CLI'yi PATH'te ya da bilinen kurulum yerlerinde bulur */
export function findCli(name: 'claude' | 'codex'): string {
  const exe = `${name}.exe`
  for (const d of (process.env.PATH ?? '').split(path.delimiter)) {
    if (d && fs.existsSync(path.join(d, exe))) return path.join(d, exe)
  }
  const home = process.env.USERPROFILE ?? ''
  const local = process.env.LOCALAPPDATA ?? ''
  const known = name === 'claude' ? [path.join(home, '.local', 'bin', exe)] : [path.join(local, 'Programs', 'OpenAI', 'Codex', 'bin', exe)]
  for (const f of known) if (fs.existsSync(f)) return f
  throw new Error(
    name === 'claude'
      ? 'Claude Code bulunamadı. Kurulum: https://claude.com/claude-code (sonra bir kez "claude" yazıp giriş yapın)'
      : 'Codex CLI bulunamadı. Kurulum: https://developers.openai.com/codex (sonra bir kez "codex login")'
  )
}

async function runCli(cmd: string, args: string[], o: TaskAgentOptions): Promise<{ code: number; out: string }> {
  // AssetForge bir Claude Code oturumundan açıldıysa iç içe çalıştırma kilidini kaldır
  const env = { CLAUDECODE: '', CLAUDE_CODE_ENTRYPOINT: '' }
  return run(cmd, args, { cwd: o.outDir, input: o.task, env, log: (l) => o.log(l.slice(0, 400)), timeoutMs: o.timeoutMin * 60_000, signal: o.signal })
}

async function claudeCodeAgent(o: TaskAgentOptions): Promise<string> {
  const exe = findCli('claude')
  const servers = mcpSelection(o.mcp)
  const meta = ensureDir(path.join(o.outDir, '.agent'))
  const cfg = path.join(meta, 'mcp.json')
  fs.writeFileSync(cfg, JSON.stringify(claudeMcpConfig(servers), null, 1))
  const allowed = ['Read', 'Write', 'Edit', 'Glob', 'Grep', ...(o.shell ? ['Bash', 'PowerShell'] : []), ...servers.map((s) => `mcp__${mcpKey(s)}`)]
  const args = [
    '-p',
    '--output-format',
    'text',
    '--permission-mode',
    'acceptEdits',
    '--append-system-prompt',
    o.system,
    ...(o.cliModel ? ['--model', o.cliModel] : []),
    ...o.readDirs.flatMap((d) => ['--add-dir', d]),
    '--mcp-config',
    cfg,
    '--strict-mcp-config',
    '--allowedTools',
    ...allowed
  ]
  o.log(`Claude Code · MCP: ${servers.map((s) => s.name).join(', ') || 'yok'}${o.shell ? ' · terminal açık' : ''}`)
  const r = await runCli(exe, args, o)
  if (r.code !== 0) throw new Error(`Claude Code hata kodu ${r.code}: ${r.out.slice(-600)}`)
  return r.out.trim().slice(-4000)
}

async function codexAgent(o: TaskAgentOptions): Promise<string> {
  const exe = findCli('codex')
  const servers = mcpSelection(o.mcp)
  const meta = ensureDir(path.join(o.outDir, '.agent'))
  const lastFile = path.join(meta, 'last.txt')
  const args = [
    'exec',
    '--skip-git-repo-check',
    '--ephemeral',
    '-s',
    'workspace-write',
    '-C',
    o.outDir,
    '-o',
    lastFile,
    ...(o.cliModel ? ['-m', o.cliModel] : []),
    ...o.readDirs.flatMap((d) => ['--add-dir', d]),
    ...codexMcpArgs(servers),
    '-'
  ]
  o.log(`Codex · MCP: ${servers.map((s) => s.name).join(', ') || 'yok'}`)
  // Codex sistem talimatı almaz; görevin başına ekle
  const r = await runCli(exe, args, { ...o, task: `${o.system}\n\n${o.task}` })
  if (r.code !== 0) throw new Error(`Codex hata kodu ${r.code}: ${r.out.slice(-600)}`)
  return fs.existsSync(lastFile) ? fs.readFileSync(lastFile, 'utf8').trim() : r.out.trim().slice(-4000)
}

export async function runTaskAgent(o: TaskAgentOptions): Promise<string> {
  ensureDir(o.outDir)
  if (o.engine === 'claude-code') return claudeCodeAgent(o)
  if (o.engine === 'codex') return codexAgent(o)
  return apiAgent(o)
}
