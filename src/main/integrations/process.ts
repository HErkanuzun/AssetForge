// SPDX-License-Identifier: AGPL-3.0-only
// Dış programları çalıştırır; çıktıyı satır satır akıtır (Kimodo, ComfyUI kurulumu, terminal ajanları).
import { spawn } from 'node:child_process'

export type LogFn = (line: string) => void

export interface RunOptions {
  env?: Record<string, string>
  log?: LogFn
  timeoutMs?: number
  cwd?: string
  /** Standart girdiye yazılıp kapatılır (uzun görev metni komut satırı sınırına takılmasın) */
  input?: string
  signal?: AbortSignal
}

function decode(buf: Buffer): string {
  // wsl.exe kendi mesajlarını UTF-16LE yazar
  if (buf.length > 1 && buf.includes(0)) return buf.toString('utf16le')
  return buf.toString('utf8')
}

export function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    if (opts.signal?.aborted) return resolve({ code: -1, out: 'iptal edildi' })
    const proc = spawn(cmd, args, { windowsHide: true, cwd: opts.cwd, env: { ...process.env, ...opts.env } })
    let out = ''
    let pending = ''
    const onData = (d: Buffer) => {
      const text = decode(d)
      out = (out + text).slice(-20000)
      if (!opts.log) return
      pending += text
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() ?? ''
      for (const l of lines) if (l.trim()) opts.log(l.trim())
    }
    proc.stdout.on('data', onData)
    proc.stderr.on('data', onData)
    proc.stdin.on('error', () => undefined)
    if (opts.input !== undefined) proc.stdin.end(opts.input)
    const timer = opts.timeoutMs ? setTimeout(() => proc.kill(), opts.timeoutMs) : null
    const onAbort = () => proc.kill()
    opts.signal?.addEventListener('abort', onAbort, { once: true })
    let done = false
    const finish = (code: number | null) => {
      if (done) return
      done = true
      if (timer) clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onAbort)
      if (pending.trim() && opts.log) opts.log(pending.trim())
      resolve({ code: code ?? -1, out })
    }
    proc.on('error', (e) => {
      out += String(e)
      finish(-1)
    })
    // Arka planda süreç başlatan komutlarda (ComfyUI start) torun süreç çıktı kanalını açık tutar;
    // 'close' sunucu kapanana kadar gelmez. Süreç çıkınca kalan çıktı için kısa bekle, sonra bitir.
    proc.on('exit', (code) => setTimeout(() => finish(code), 1000))
    proc.on('close', (code) => finish(code))
  })
}
