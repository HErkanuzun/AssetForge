// AssetForge'u MCP sunucusu olarak dışarı açar: Claude Code, Claude Desktop ya da herhangi bir MCP istemcisi
// projeyi okuyup asset üretebilir, işleri izleyebilir, Unreal'a komut gönderebilir.
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import fs from 'node:fs'
import http from 'node:http'
import { getSettings } from '../settings'
import { sniffImage } from '../util'
import { builtinTools, type ToolCtx } from './tools'

const INSTRUCTIONS = `AssetForge: AI-driven game asset factory for an Unreal Engine 5 project.
Use project_overview first. Assets live in a library (list_assets/get_asset/upsert_asset); production runs through pipelines (list_pipelines/run_pipeline) that call Meshy (3D), ElevenLabs (audio), ComfyUI (textures), Blender (cleanup, LODs, Manny skeleton) and import into Unreal. Check results with view_asset (rendered previews) and get_job (QA report). Animations come from NVIDIA Kimodo via generate_animation and are retargeted to the character. unreal_python runs Python in the open Unreal Editor. The user's language is Turkish.`

let srv: http.Server | null = null
let current = ''

export function mcpUrl(): string {
  return `http://127.0.0.1:${getSettings().mcpExpose.port}/mcp`
}

function build(ctx: Omit<ToolCtx, 'source'>, onCall: (name: string) => void): Server {
  const tools = builtinTools()
  const s = new Server({ name: 'assetforge', version: '0.2.0' }, { capabilities: { tools: {} }, instructions: INSTRUCTIONS })
  s.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as { type: 'object'; properties?: Record<string, object> },
      annotations: { readOnlyHint: !!t.readOnly, destructiveHint: !!t.confirm, openWorldHint: false }
    }))
  }))
  s.setRequestHandler(CallToolRequestSchema, async (req) => {
    const t = tools.find((x) => x.name === req.params.name)
    if (!t) return { content: [{ type: 'text', text: `Bilinmeyen araç: ${req.params.name}` }], isError: true }
    const parsed = t.parse(req.params.arguments ?? {})
    if (!parsed.ok) return { content: [{ type: 'text', text: `Geçersiz girdi: ${parsed.error}` }], isError: true }
    onCall(t.name)
    try {
      const r = await t.run({ ...ctx, source: 'mcp' }, parsed.data)
      const content: ({ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string })[] = [{ type: 'text', text: r.text }]
      for (const f of r.images ?? []) {
        const buf = fs.readFileSync(f)
        const mt = sniffImage(buf)
        if (mt && buf.length < 4_500_000) content.push({ type: 'image', data: buf.toString('base64'), mimeType: mt })
      }
      return { content, isError: !!r.isError }
    } catch (e) {
      return { content: [{ type: 'text', text: `Hata: ${(e as Error).message}` }], isError: true }
    }
  })
  return s
}

/** Ayarlara göre başlat / yeniden başlat / durdur */
export async function syncMcpServer(ctx: () => Omit<ToolCtx, 'source'>, onCall: (name: string) => void): Promise<void> {
  const cfg = getSettings().mcpExpose
  const want = cfg.enabled ? `${cfg.port}|${cfg.token}` : ''
  if (want === current) return
  if (srv) {
    await new Promise<void>((r) => srv!.close(() => r()))
    srv = null
  }
  current = want
  if (!cfg.enabled) return

  srv = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    // DNS rebinding ve yetkisiz erişime karşı: yalnızca localhost + token
    const host = (req.headers.host ?? '').split(':')[0]
    if (!['127.0.0.1', 'localhost'].includes(host)) return void res.writeHead(403).end('forbidden host')
    const auth = req.headers.authorization ?? ''
    if (auth !== `Bearer ${cfg.token}` && url.searchParams.get('token') !== cfg.token) return void res.writeHead(401).end('unauthorized')
    if (url.pathname !== '/mcp') return void res.writeHead(404).end('not found')
    if (req.method !== 'POST') return void res.writeHead(405, { Allow: 'POST' }).end('method not allowed')

    let body = ''
    for await (const chunk of req) body += chunk
    let json: unknown
    try {
      json = JSON.parse(body)
    } catch {
      return void res.writeHead(400).end('invalid json')
    }
    // Durumsuz mod: her istek için yeni sunucu + taşıyıcı
    const server = build(ctx(), onCall)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    res.on('close', () => {
      transport.close().catch(() => undefined)
      server.close().catch(() => undefined)
    })
    try {
      await server.connect(transport)
      await transport.handleRequest(req, res, json)
    } catch (e) {
      if (!res.headersSent) res.writeHead(500).end((e as Error).message)
    }
  })
  await new Promise<void>((resolve) => {
    srv!.once('error', (e) => {
      console.error('[mcp] sunucu başlatılamadı:', (e as Error).message)
      srv = null
      current = ''
      resolve()
    })
    srv!.listen(cfg.port, '127.0.0.1', () => resolve())
  })
}

export function mcpServerRunning(): boolean {
  return !!srv?.listening
}
