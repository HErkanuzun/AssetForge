// Unreal Editor Python Remote Execution köprüsü.
// UE tarafında: Python Editor Script Plugin açık + Project Settings → Python → "Enable Remote Execution".
// Protokol: UDP multicast (239.0.0.1:6766) ile keşif, ardından UE bizim açtığımız TCP sunucusuna bağlanır.
import { randomUUID } from 'node:crypto'
import dgram from 'node:dgram'
import net from 'node:net'
import type { UeNode } from '../../shared/types'

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
