// SPDX-License-Identifier: AGPL-3.0-only
// Unreal Editor köprüsü: Python Remote Execution, yoksa Unreal MCP sunucusu.
// UE tarafında: Python Editor Script Plugin açık + Project Settings → Python → "Enable Remote Execution".
// Protokol: UDP multicast (239.0.0.1:6766) ile keşif, ardından UE bizim açtığımız TCP sunucusuna bağlanır.
import { randomUUID } from 'node:crypto'
import dgram from 'node:dgram'
import net from 'node:net'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { UeNode } from '../../shared/types'
import { getSettings } from '../settings'

const GROUP = '239.0.0.1'
const PORT = 6766
const BIND = '127.0.0.1'
const MAGIC = 'ue_py'

interface Msg {
  version: number
  magic: string
  type: string
  source: string
  dest?: string
  data?: Record<string, unknown>
}

const nodeId = randomUUID()

function openUdp(onMsg: (m: Msg) => void): Promise<dgram.Socket> {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    sock.on('error', reject)
    sock.on('message', (buf) => {
      try {
        const m = JSON.parse(buf.toString('utf8')) as Msg
        if (m.magic === MAGIC && m.source !== nodeId && (!m.dest || m.dest === nodeId)) onMsg(m)
      } catch {
        /* yabancı paket */
      }
    })
    sock.bind(PORT, () => {
      try {
        sock.setMulticastInterface(BIND)
        sock.addMembership(GROUP, BIND)
        sock.setMulticastLoopback(true)
        sock.setMulticastTTL(0)
      } catch (e) {
        return reject(e)
      }
      resolve(sock)
    })
  })
}

function send(sock: dgram.Socket, m: Omit<Msg, 'version' | 'magic' | 'source'>): void {
  const payload = Buffer.from(JSON.stringify({ version: 1, magic: MAGIC, source: nodeId, ...m }))
  sock.send(payload, PORT, GROUP)
}

export async function discoverUe(timeoutMs = 1500): Promise<UeNode[]> {
  const found = new Map<string, UeNode>()
  const sock = await openUdp((m) => {
    if (m.type !== 'pong') return
    const d = m.data ?? {}
    found.set(m.source, {
      nodeId: m.source,
      projectName: String(d.project_name ?? ''),
      engineVersion: String(d.engine_version ?? ''),
      machine: String(d.machine ?? '')
    })
  })
  try {
    send(sock, { type: 'ping' })
    await new Promise((r) => setTimeout(r, timeoutMs / 2))
    send(sock, { type: 'ping' })
    await new Promise((r) => setTimeout(r, timeoutMs / 2))
  } finally {
    sock.close()
  }
  return [...found.values()]
}

export interface UeExecResult {
  success: boolean
  result: string
  output: string
}

/** Python kodunu açık Unreal Editor'de çalıştırır. */
export async function execInUe(code: string, target?: string, timeoutMs = 10 * 60 * 1000): Promise<UeExecResult> {
  const nodes = await discoverUe()
  const ue = target ? nodes.find((n) => n.nodeId === target) : nodes[0]
  if (!ue) throw new Error('Açık bir Unreal Editor bulunamadı (Python Remote Execution açık mı?)')

  const server = net.createServer()
  await new Promise<void>((r) => server.listen(0, BIND, () => r()))
  const port = (server.address() as net.AddressInfo).port
  const sock = await openUdp(() => {})

  try {
    const conn = await new Promise<net.Socket>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Unreal komut bağlantısı açmadı')), 8000)
      server.once('connection', (c) => {
        clearTimeout(t)
        resolve(c)
      })
      send(sock, { type: 'open_connection', dest: ue.nodeId, data: { command_ip: BIND, command_port: port } })
    })

    const result = await new Promise<UeExecResult>((resolve, reject) => {
      let buf = ''
      const t = setTimeout(() => reject(new Error('Unreal komutu zaman aşımına uğradı')), timeoutMs)
      conn.on('data', (d) => {
        buf += d.toString('utf8')
        try {
          const m = JSON.parse(buf) as Msg
          if (m.type !== 'command_result') return
          clearTimeout(t)
          const data = (m.data ?? {}) as { success?: boolean; result?: string; output?: { type: string; output: string }[] }
          resolve({
            success: !!data.success,
            result: String(data.result ?? ''),
            output: (data.output ?? []).map((o) => o.output).join('\n')
          })
        } catch {
          /* mesaj henüz tamamlanmadı */
        }
      })
      conn.on('error', reject)
      const msg: Msg = {
        version: 1,
        magic: MAGIC,
        type: 'command',
        source: nodeId,
        dest: ue.nodeId,
        data: { command: code, unattended: true, exec_mode: 'ExecuteFile' }
      }
      conn.write(JSON.stringify(msg))
    })
    conn.destroy()
    return result
  } finally {
    send(sock, { type: 'close_connection', dest: ue.nodeId })
    sock.close()
    server.close()
  }
}

// ---------------------------------------------------------------------------
// Yedek yol: Unreal'ın MCP sunucusu (Project Settings → Unreal MCP). Remote Execution
// kapalıysa Python, adında "python" geçen bir araç seti aracıyla (ör. ExecutePython) çalıştırılır.

interface McpConn {
  url: string
  client: Client
  python?: { toolset: string; tool: string; arg: string } | null
  /** describe_toolset çıktıları (araç arama için) */
  described?: { name: string; text: string }[]
}
let mcpConn: McpConn | null = null

async function ueMcp(): Promise<McpConn> {
  const url = getSettings().ueMcpUrl
  if (!url) throw new Error('Unreal MCP adresi ayarlı değil (Ayarlar → Unreal Engine)')
  if (mcpConn && mcpConn.url === url) return mcpConn
  await mcpConn?.client.close().catch(() => undefined)
  mcpConn = null
  const client = new Client({ name: 'assetforge', version: '0.5.0' })
  const timer = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Unreal MCP sunucusu yanıt vermedi')), 5000))
  await Promise.race([client.connect(new StreamableHTTPClientTransport(new URL(url))), timer])
  mcpConn = { url, client }
  return mcpConn
}

function mcpText(r: unknown): { text: string; isError: boolean } {
  const res = r as { content?: { type: string; text?: string }[]; isError?: boolean }
  return { text: (res.content ?? []).map((c) => c.text ?? '').join('\n'), isError: !!res.isError }
}

/** Unreal MCP araç seti aracını çağırır (call_tool meta-aracı). JSON dönerse çözülmüş hali döner. */
export async function ueTool(toolset: string, tool: string, args: Record<string, unknown>, timeoutMs = 10 * 60 * 1000): Promise<unknown> {
  const c = await ueMcp()
  let r: unknown
  try {
    r = await c.client.callTool({ name: 'call_tool', arguments: { toolset_name: toolset, tool_name: tool, arguments: args } }, undefined, { timeout: timeoutMs })
  } catch (e) {
    mcpConn = null // editör yeniden başlamış olabilir; bir sonraki çağrı yeniden bağlansın
    throw e
  }
  const { text, isError } = mcpText(r)
  if (isError) throw new Error(`${tool}: ${text.slice(0, 600)}`)
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** list_toolsets çıktısından araç seti adlarını ("- Ad: açıklama") çıkarır */
export function parseToolsets(text: string): { name: string; desc: string }[] {
  return text
    .split('\n')
    .map((l) => /^- ([\w.]+):\s*(.*)$/.exec(l.trim()))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ name: m[1], desc: m[2] }))
}

/** describe_toolset çıktısında Python çalıştıran aracı ve kod parametresinin adını bulur */
export function findPythonTool(describe: string): { tool: string; arg: string } | null {
  const m = /\b((?:Execute|Run|Exec)_?Python(?:Code|Script)?|(?:execute|run|exec)_python(?:_code|_script)?)\b/i.exec(describe)
  if (!m) return null
  const after = describe.slice(m.index, m.index + 1500)
  const arg = /["'`]?(code|python_code|script|command|source)["'`]?\s*[:(]/.exec(after)?.[1] ?? 'code'
  return { tool: m[1], arg }
}

/** Tüm araç setlerinin açıklamalarını bir kez okur (Python/editör/araç geçenler önce) */
async function describeAll(c: McpConn, stopWhen?: (text: string) => boolean): Promise<{ name: string; text: string }[]> {
  if (c.described) return c.described
  const list = mcpText(await c.client.callTool({ name: 'list_toolsets', arguments: {} })).text
  const rank = (s: { name: string; desc: string }) => (/python|script|vehicle|editor/i.test(`${s.name} ${s.desc}`) ? 0 : 1)
  const out: { name: string; text: string }[] = []
  for (const s of parseToolsets(list).sort((a, b) => rank(a) - rank(b))) {
    const text = mcpText(await c.client.callTool({ name: 'describe_toolset', arguments: { toolset_name: s.name } })).text
    out.push({ name: s.name, text })
    if (stopWhen?.(text)) return out // erken bulundu; tam liste değil, önbelleğe alma
  }
  c.described = out
  return out
}

async function mcpPythonTool(c: McpConn): Promise<NonNullable<McpConn['python']>> {
  if (c.python) return c.python
  for (const d of await describeAll(c, (t) => !!findPythonTool(t))) {
    const f = findPythonTool(d.text)
    if (f) return (c.python = { toolset: d.name, ...f })
  }
  c.python = null
  throw new Error('Unreal MCP sunucusunda Python çalıştıran bir araç yok (ör. ExecutePython)')
}

/** Adı verilen aracı (ör. CreateVehiclePhysicsAsset) içeren araç setini bulur; yoksa null */
export async function ueFindToolset(tool: string): Promise<string | null> {
  const c = await ueMcp()
  const re = new RegExp(`\\b${tool}\\b`)
  for (const d of await describeAll(c)) if (re.test(d.text)) return d.name
  return null
}

/** Python'u Unreal MCP üzerinden çalıştırır; print çıktısı output'a gelir */
export async function execInUeMcp(code: string, timeoutMs = 10 * 60 * 1000): Promise<UeExecResult> {
  const c = await ueMcp()
  const py = await mcpPythonTool(c)
  try {
    const r = await ueTool(py.toolset, py.tool, { [py.arg]: code }, timeoutMs)
    const out = typeof r === 'string' ? r : String((r as { returnValue?: unknown }).returnValue ?? JSON.stringify(r))
    return { success: !/^Traceback|\nTraceback \(most recent/m.test(out), result: '', output: out.replace(/\r\n?/g, '\n').replace(/\n\n/g, '\n') }
  } catch (e) {
    return { success: false, result: (e as Error).message, output: '' }
  }
}

/** Önce Remote Execution, bulunamazsa Unreal MCP. */
export async function runInUe(code: string, timeoutMs = 10 * 60 * 1000): Promise<UeExecResult & { via: 'remote' | 'mcp' }> {
  const nodes = await discoverUe().catch(() => [])
  if (nodes.length) return { ...(await execInUe(code, nodes[0].nodeId, timeoutMs)), via: 'remote' }
  try {
    return { ...(await execInUeMcp(code, timeoutMs)), via: 'mcp' }
  } catch (e) {
    throw new Error(`Açık bir Unreal Editor bulunamadı: Remote Execution yanıt vermedi, MCP: ${(e as Error).message}`, { cause: e })
  }
}

/** Unreal'a herhangi bir yoldan ulaşılabiliyor mu (ayarlar ekranı için) */
export async function ueStatus(): Promise<{ remote: UeNode[]; mcp: boolean; python: string }> {
  const remote = await discoverUe(1200).catch(() => [])
  try {
    const c = await ueMcp()
    const py = await mcpPythonTool(c).catch(() => null)
    return { remote, mcp: true, python: py ? `${py.toolset}.${py.tool}` : '' }
  } catch {
    return { remote, mcp: false, python: '' }
  }
}
