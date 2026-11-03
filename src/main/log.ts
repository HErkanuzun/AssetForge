// SPDX-License-Identifier: AGPL-3.0-only
// Dosya günlüğü: ana süreçteki console.* çağrıları, yakalanmamış hatalar ve arayüz hataları
// %APPDATA%\AssetForge\logs\main.log dosyasına yazılır. Anahtarlar ve token'lar maskelenir.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { format } from 'node:util'

const MAX_BYTES = 2 * 1024 * 1024

let file = ''
let known: string[] = []

// Anahtar biçimleri (servis önekleriyle) ve genel taşıyıcı/token kalıpları
const PATTERNS: [RegExp, string][] = [
  [/sk-ant-[A-Za-z0-9_-]{8,}/g, 'sk-ant-***'],
  [/sk-or-v1-[A-Za-z0-9]{8,}/g, 'sk-or-***'],
  [/\bmsy_[A-Za-z0-9_-]{8,}/g, 'msy_***'],
  [/\bhf_[A-Za-z0-9]{8,}/g, 'hf_***'],
  [/\bsk_[A-Za-z0-9]{16,}/g, 'sk_***'],
  [/\bsk-[A-Za-z0-9_-]{20,}/g, 'sk-***'],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 ***'],
  [/(\b(?:access_token|refresh_token|code_verifier|api_key|apikey|token|key|code|password|secret)=)[^&\s"']+/gi, '$1***'],
  [/("(?:token|apiKey|api_key|key|authorization|password|secret)"\s*:\s*")[^"]+/gi, '$1***'],
  [/\b[a-f0-9]{32}\b/g, '***']
]

const home = os.homedir()

/** Günlüğe ya da tanılama dosyasına girecek metinden gizli bilgileri ve kullanıcı adını temizler */
export function redact(text: string, secrets: string[] = known): string {
  let out = text
  for (const s of secrets) if (s && s.length >= 6) out = out.split(s).join('***')
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep)
  if (home && home.length > 3) {
    out = out.split(home).join('~')
    out = out.split(home.replace(/\\/g, '/')).join('~')
    out = out.split(home.replace(/\\/g, '\\\\')).join('~')
  }
  return out
}

/** Ayarlardaki gerçek anahtar değerleri: biçimi bilinmeyen anahtarlar da maskelensin */
export function setLogSecrets(values: string[]): void {
  known = [...new Set(values.filter((v) => v && v.length >= 6))].sort((a, b) => b.length - a.length)
}

export function logFile(): string {
  return file
}

export function logDir(): string {
  return file ? path.dirname(file) : ''
}

function rotate(): void {
  try {
    if (fs.statSync(file).size < MAX_BYTES) return
    fs.renameSync(file, file.replace(/\.log$/, '.old.log'))
  } catch {
    /* dosya yok */
  }
}

let written = 0

export function writeLog(level: string, text: string): void {
  if (!file) return
  const line = `[${new Date().toISOString()}] [${level}] ${redact(text)}\n`
  try {
    fs.appendFileSync(file, line)
    written += line.length
    if (written > 256 * 1024) {
      written = 0
      rotate()
    }
  } catch {
    /* günlük yazılamıyorsa uygulama çalışmaya devam etsin */
  }
}

/** Son `max` satır (önce eski dosya, sonra güncel) */
export function tailLog(max = 400): string[] {
  const read = (f: string) => {
    try {
      return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)
    } catch {
      return []
    }
  }
  return [...read(file.replace(/\.log$/, '.old.log')), ...read(file)].slice(-max)
}

/** Uygulama başında bir kez: console.* çağrılarını ayrıca dosyaya yazar, yakalanmamış hataları kaydeder */
export function initLog(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
  file = path.join(dir, 'main.log')
  rotate()
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const orig = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      orig(...args)
      writeLog(level === 'log' ? 'info' : level, format(...args))
    }
  }
  process.on('uncaughtException', (e) => console.error('[uncaughtException]', e))
  process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e))
}
