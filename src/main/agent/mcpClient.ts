// Dış MCP sunucuları (Blender MCP, Unreal MCP, dosya sistemi, arama…) → Yapımcı asistanına araç olarak eklenir.
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import fs from 'node:fs'
import path from 'node:path'
import type { McpServerConfig, McpServerStatus } from '../../shared/types'
import { getSettings } from '../settings'
import { ensureDir } from '../util'
import type { AgentTool } from './tools'

interface Conn {
  key: string
  client: Client
  tools: { name: string; description?: string; inputSchema: Record<string, unknown> }[]
}

const conns = new Map<string, Conn>()
const errors = new Map<string, string>()
const pending = new Map<string, Promise<Conn>>()

/** "a b 'c d'" → ['a','b','c d'] */
export function splitArgs(s: string): string[] {
  const out: string[] = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) out.push(m[1] ?? m[2] ?? m[3])
  return out
}

function kv(lines: string, sep: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const l of lines.split(/\r?\n/)) {
    const i = l.indexOf(sep)
    if (i > 0) out[l.slice(0, i).trim()] = l.slice(i + 1).trim()
  }
  return out
}

const keyOf = (c: McpServerConfig) => JSON.stringify([c.transport, c.command, c.args, c.env, c.url, c.headers])

async function open(cfg: McpServerConfig): Promise<Conn> {
  const client = new Client({ name: 'assetforge', version: '0.2.0' })
  const transport =
    cfg.transport === 'stdio'
      ? new StdioClientTransport({ command: cfg.command, args: splitArgs(cfg.args), env: { ...getDefaultEnvironment(), ...kv(cfg.env, '=') }, stderr: 'pipe' })
      : new StreamableHTTPClientTransport(new URL(cfg.url), { requestInit: { headers: kv(cfg.headers, ':') } })
  const timer = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Bağlantı zaman aşımı (30 sn)')), 30000))
  await Promise.race([client.connect(transport), timer])
  const { tools } = await Promise.race([client.listTools(), timer])
  return { key: keyOf(cfg), client, tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema as Record<string, unknown> })) }
}

async function ensure(cfg: McpServerConfig): Promise<Conn> {
  const cur = conns.get(cfg.id)
  if (cur && cur.key === keyOf(cfg)) return cur
  if (cur) await close(cfg.id)
  const p = pending.get(cfg.id)
  if (p) return p
  const job = open(cfg)
    .then((c) => {
      conns.set(cfg.id, c)
      errors.delete(cfg.id)
      c.client.onclose = () => conns.delete(cfg.id)
      return c
    })
    .catch((e: Error) => {
      errors.set(cfg.id, e.message)
      throw e
    })
    .finally(() => pending.delete(cfg.id))
  pending.set(cfg.id, job)
  return job
}

export async function close(id?: string): Promise<void> {
  for (const [k, c] of conns) {
    if (id && k !== id) continue
    conns.delete(k)
    await c.client.close().catch(() => undefined)
  }
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 20) || 'mcp'

/** Etkin tüm MCP sunucularının araçları (bağlanamayanlar atlanır) */
export async function externalTools(dir: string): Promise<AgentTool[]> {
  const out: AgentTool[] = []
  const servers = getSettings().mcpServers.filter((s) => s.enabled)
  const conns = await Promise.all(
    servers.map((s) =>
      ensure(s).then(
        (c) => [s, c] as const,
        () => null
      )
    )
  )
  for (const pair of conns) {
    if (!pair) continue
    const [cfg, conn] = pair
    for (const t of conn.tools) {
      const name = `${slug(cfg.name)}__${t.name}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
      out.push({
        name,
        description: `[${cfg.name} — dış MCP] ${t.description ?? t.name}`.slice(0, 1000),
        inputSchema: t.inputSchema?.type ? t.inputSchema : { type: 'object', properties: {} },
        parse: (input) => (input && typeof input === 'object' ? { ok: true, data: input } : { ok: false, error: 'object bekleniyor' }),
        confirm: cfg.autoApprove ? undefined : (d) => `${cfg.name} → ${t.name}\n${JSON.stringify(d, null, 1).slice(0, 1200)}`,
        run: async (_ctx, data) => {
          const res = await conn.client.callTool({ name: t.name, arguments: data as Record<string, unknown> }, undefined, { timeout: 10 * 60 * 1000 })
          const texts: string[] = []
          const images: string[] = []
          for (const c of (res.content ?? []) as { type: string; text?: string; data?: string; mimeType?: string; resource?: { uri?: string; text?: string } }[]) {
            if (c.type === 'text' && c.text) texts.push(c.text)
            else if (c.type === 'image' && c.data) {
              const ext = (c.mimeType ?? 'image/png').split('/')[1]?.replace('jpeg', 'jpg') ?? 'png'
              const f = path.join(ensureDir(path.join(dir, 'assistant', 'media')), `${slug(cfg.name)}_${Date.now()}_${images.length}.${ext}`)
              fs.writeFileSync(f, Buffer.from(c.data, 'base64'))
              images.push(f)
            } else if (c.type === 'resource' && c.resource) texts.push(c.resource.text ?? c.resource.uri ?? '')
          }
          if (res.structuredContent && !texts.length) texts.push(JSON.stringify(res.structuredContent))
          return { text: texts.join('\n').slice(0, 20000) || '(boş yanıt)', images, isError: !!res.isError }
        }
      })
    }
  }
  return out
}

export async function mcpStatus(): Promise<McpServerStatus[]> {
  return getSettings().mcpServers.map((s) => {
    const c = conns.get(s.id)
    return { id: s.id, connected: !!c, tools: c?.tools.map((t) => t.name) ?? [], error: errors.get(s.id) }
  })
}

/** Bağlanıp araç listesini döndürür (Ayarlar → Test) */
export async function mcpTest(id: string): Promise<McpServerStatus> {
  const cfg = getSettings().mcpServers.find((s) => s.id === id)
  if (!cfg) throw new Error('Sunucu bulunamadı')
  await close(id)
  try {
    const c = await ensure(cfg)
    return { id, connected: true, tools: c.tools.map((t) => t.name) }
  } catch (e) {
    return { id, connected: false, tools: [], error: (e as Error).message }
  }
}
