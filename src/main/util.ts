import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** Paketlenmiş uygulamada process.resourcesPath, geliştirmede proje/resources */
export function resourcePath(...parts: string[]): string {
  return app.isPackaged ? path.join(process.resourcesPath, ...parts) : path.join(app.getAppPath(), 'resources', ...parts)
}

export async function downloadTo(url: string, dest: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`İndirme başarısız (${res.status}): ${url.slice(0, 120)}`)
  ensureDir(path.dirname(dest))
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
  return dest
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.glb': 'application/octet-stream',
  '.gltf': 'application/octet-stream',
  '.fbx': 'application/octet-stream',
  '.obj': 'application/octet-stream'
}

export function fileToDataUri(file: string): string {
  const mime = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`
}

export type ImageMedia = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'

export function sniffImage(buf: Buffer): ImageMedia | null {
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png'
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg'
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp'
  if (buf.subarray(0, 3).toString() === 'GIF') return 'image/gif'
  return null
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('İptal edildi'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new Error('İptal edildi'))
      },
      { once: true }
    )
  })
}

/** Ham 16-bit PCM'i WAV dosyasına sarar (Unreal WAV'ı doğrudan import eder). */
export function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1, bits = 16): Buffer {
  const header = Buffer.alloc(44)
  const byteRate = (sampleRate * channels * bits) / 8
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE((channels * bits) / 8, 32)
  header.writeUInt16LE(bits, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

export function truncateWords(s: string, max: number): string {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const i = cut.lastIndexOf(' ')
  return (i > max * 0.7 ? cut.slice(0, i) : cut).replace(/[,;:\s]+$/, '')
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
