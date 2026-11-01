// NVIDIA Kimodo (metinden insan hareketi) — kurulum, servis yönetimi ve üretim istemcisi.
// İki çalıştırma yolu:
//   native : Windows'ta doğrudan Python 3.12 + CUDA PyTorch (BIOS sanallaştırması gerekmez)
//   wsl    : WSL2 Ubuntu içinde Docker + NVIDIA Container Toolkit
// Her iki yol da aynı forge_kimodo_server.py servisini (port 9551) çalıştırır.
import { spawn } from 'node:child_process'
import path from 'node:path'
import type { KimodoSetupStep, KimodoStatus } from '../../shared/types'
import { getSecret, getSettings } from '../settings'
import { resourcePath } from '../util'

type LogFn = (line: string) => void

function decode(buf: Buffer): string {
  // wsl.exe kendi mesajlarını UTF-16LE yazar
  if (buf.length > 1 && buf.includes(0)) return buf.toString('utf16le')
  return buf.toString('utf8')
}

function run(cmd: string, args: string[], opts: { env?: Record<string, string>; log?: LogFn; timeoutMs?: number } = {}): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { windowsHide: true, env: { ...process.env, ...(opts.env ?? {}) } })
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
    const timer = opts.timeoutMs ? setTimeout(() => proc.kill(), opts.timeoutMs) : null
    proc.on('error', (e) => resolve({ code: -1, out: String(e) }))
    proc.on('close', (code) => {
      if (timer) clearTimeout(timer)
      if (pending.trim() && opts.log) opts.log(pending.trim())
      resolve({ code: code ?? -1, out })
    })
  })
}

const nativeScript = () => resourcePath('kimodo', 'setup_native.ps1')
const wslScript = () => resourcePath('kimodo', 'setup_wsl.sh')

function toWslPath(p: string): string {
  const abs = path.resolve(p)
  return `/mnt/${abs[0].toLowerCase()}${abs.slice(2).replace(/\\/g, '/')}`
}

function tokenEnv(): Record<string, string> {
  const t = getSecret('huggingface')
  return t ? { HF_TOKEN: t, WSLENV: 'HF_TOKEN/u' } : {}
}

function native(step: string, log?: LogFn, timeoutMs?: number) {
  const s = getSettings()
  return run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', nativeScript(), '-Step', step, '-Root', s.kimodoHome], {
    env: tokenEnv(),
    log,
    timeoutMs
  })
}

function wsl(step: string, log?: LogFn, timeoutMs?: number) {
  const s = getSettings()
  const script = toWslPath(wslScript())
  const src = toWslPath(path.dirname(wslScript()))
  const cmd = `tr -d '\\r' < '${script}' > /tmp/forge_setup.sh && bash /tmp/forge_setup.sh ${step} '${src}'`
  return run('wsl.exe', ['-d', s.wslDistro, '-u', 'root', '--', 'bash', '-c', cmd], { env: tokenEnv(), log, timeoutMs })
}

function parseJson<T>(out: string): T | null {
  const line = out
    .split(/\r?\n/)
    .reverse()
    .find((l) => l.trim().startsWith('{'))
  try {
    return line ? (JSON.parse(line) as T) : null
  } catch {
    return null
  }
}

async function health(): Promise<{ ok: boolean; model?: string; device?: string; busy?: boolean; postprocess?: boolean }> {
  try {
    const r = await fetch(getSettings().kimodoUrl.replace(/\/$/, '') + '/health', { signal: AbortSignal.timeout(2500) })
    if (!r.ok) return { ok: false }
    return { ok: true, ...((await r.json()) as object) }
  } catch {
    return { ok: false }
  }
}

async function virtualizationEnabled(): Promise<boolean> {
  const r = await run('powershell.exe', ['-NoProfile', '-Command', '(Get-CimInstance Win32_Processor | Select-Object -First 1).VirtualizationFirmwareEnabled'], { timeoutMs: 15000 })
  return /true/i.test(r.out)
}

export async function kimodoStatus(): Promise<KimodoStatus> {
  const s = getSettings()
  const h = await health()
  const base = { running: h.ok, healthy: h.ok, model: h.model, device: h.device, busy: h.busy, postprocess: h.postprocess }
  const hasToken = !!getSecret('huggingface')

  if (s.kimodoBackend === 'native') {
    const st = parseJson<Record<string, boolean>>((await native('status', undefined, 60000)).out) ?? {}
    const steps: KimodoSetupStep[] = [
      { id: 'env', label: 'Python 3.12 + PyTorch (CUDA)', done: !!(st.venv && st.torch), hint: '~3 GB indirme' },
      { id: 'clone', label: 'Kimodo deposu (NVIDIA)', done: !!st.cloned },
      { id: 'deps', label: 'Kimodo bağımlılıkları', done: !!st.kimodo },
      { id: 'token', label: 'Hugging Face erişimi (Llama-3-8B)', done: !!st.token && hasToken, hint: hasToken ? undefined : 'Ayarlar → Hugging Face anahtarı' },
      { id: 'start', label: 'Üretim servisi', done: h.ok || !!st.running, hint: st.running && !h.ok ? 'yükleniyor… (ilk açılışta modeller iner)' : undefined }
    ]
    return { backend: 'native', steps, ...base, running: h.ok || !!st.running }
  }

  const virt = await virtualizationEnabled()
  const list = await run('wsl.exe', ['-l', '-q'], { timeoutMs: 15000 })
  const hasDistro = list.out.split(/\r?\n/).some((l) => l.replace(/\0/g, '').trim() === s.wslDistro)
  const st = hasDistro ? (parseJson<Record<string, boolean>>((await wsl('status', undefined, 60000)).out) ?? {}) : {}
  const steps: KimodoSetupStep[] = [
    { id: 'vm', label: 'Sanal Makine Platformu + Ubuntu', done: hasDistro, hint: virt ? 'yönetici onayı + yeniden başlatma' : 'BIOS’ta SVM/VT-x kapalı — önce açılmalı' },
    { id: 'docker', label: 'Docker + NVIDIA Container Toolkit', done: !!(st.docker && st.toolkit) },
    { id: 'clone', label: 'Kimodo depoları', done: !!st.cloned },
    { id: 'token', label: 'Hugging Face erişimi (Llama-3-8B)', done: !!st.token && hasToken, hint: hasToken ? undefined : 'Ayarlar → Hugging Face anahtarı' },
    { id: 'build', label: 'Docker imajı (~15 GB)', done: !!st.image },
    { id: 'start', label: 'Üretim servisi', done: h.ok || !!st.running }
  ]
  return { backend: 'wsl', steps, virtualization: virt, ...base, running: h.ok || !!st.running }
}

/** Tek bir kurulum adımını çalıştırır; satır satır log akar. */
export async function kimodoStep(step: string, log: LogFn): Promise<void> {
  const s = getSettings()
  if (s.kimodoBackend === 'native') {
    const r = await native(step, log, 3 * 60 * 60 * 1000)
    if (r.code !== 0) throw new Error(`Adım başarısız (${step}, kod ${r.code})`)
    return
  }
  if (step === 'vm') {
    if (!(await virtualizationEnabled())) {
      throw new Error('BIOS’ta sanallaştırma kapalı (AMD: SVM Mode, Intel: VT-x). Bilgisayarı yeniden başlatıp BIOS’tan açın ya da Kimodo’yu "Yerel Windows" yoluyla çalıştırın.')
    }
    log('Sanal Makine Platformu etkinleştiriliyor (yönetici onayı istenecek)…')
    await run('powershell.exe', ['-NoProfile', '-Command', "Start-Process wsl.exe -ArgumentList '--install','--no-distribution' -Verb RunAs -Wait"], { log })
    log(`${s.wslDistro} kuruluyor…`)
    const r = await run('wsl.exe', ['--install', '-d', s.wslDistro, '--no-launch'], { log, timeoutMs: 30 * 60 * 1000 })
    if (r.code !== 0) throw new Error('Ubuntu kurulamadı; Windows yeniden başlatma isteyebilir. Yeniden başlattıktan sonra adımı tekrarlayın.')
    return
  }
  const r = await wsl(step, log, 3 * 60 * 60 * 1000)
  if (r.code !== 0) throw new Error(`Adım başarısız (${step}, kod ${r.code})`)
}

export async function kimodoLogs(): Promise<string> {
  const s = getSettings()
  const r = s.kimodoBackend === 'native' ? await native('logs', undefined, 30000) : await wsl('logs', undefined, 30000)
  return r.out
}

export interface KimodoRequest {
  texts: string[]
  durations: number[]
  seed?: number
  steps?: number
  numSamples?: number
  loop?: boolean
  loop_min?: number
  loop_max?: number
  loop_keep_turn?: boolean
  constraints?: Record<string, unknown>[]
}

export interface KimodoResult {
  bvh: string[]
  fps: number
  frames: number[]
  seconds: number
  /** Döngü/ölçüm/ayak basışları/uç pozlar (forge_motion.py) */
  motion?: Record<string, unknown>[]
}

export async function kimodoGenerate(req: KimodoRequest, signal?: AbortSignal): Promise<KimodoResult> {
  const h = await health()
  if (!h.ok) throw new Error('Kimodo servisi çalışmıyor. Animasyon Stüdyosu → Kimodo kurulumu → "Servisi başlat"')
  const url = getSettings().kimodoUrl.replace(/\/$/, '') + '/generate'
  const body = {
    texts: req.texts,
    durations: req.durations,
    seed: req.seed !== undefined && req.seed >= 0 ? req.seed : undefined,
    steps: req.steps ?? 100,
    num_samples: req.numSamples ?? 1,
    loop: req.loop ?? false,
    loop_min: req.loop_min,
    loop_max: req.loop_max,
    loop_keep_turn: req.loop_keep_turn,
    constraints: req.constraints ?? []
  }
  const timeout = AbortSignal.timeout(20 * 60 * 1000)
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout
  })
  const data = (await r.json()) as KimodoResult & { error?: string }
  if (!r.ok || data.error) throw new Error(`Kimodo: ${data.error ?? r.status}`)
  return data
}
