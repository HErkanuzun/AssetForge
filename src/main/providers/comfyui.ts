// Yerel ComfyUI sunucusu ile görsel üretimi (API formatında workflow JSON).
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { ensureDir, resourcePath, sleep } from '../util'

interface HistoryImage {
  filename: string
  subfolder: string
  type: string
}

const esc = (s: string) => JSON.stringify(s).slice(1, -1)

export async function comfyGenerate(opts: {
  url: string
  workflowPath: string
  prompt: string
  negative: string
  seed: number
  outDir: string
  baseName: string
  log: (m: string) => void
  signal?: AbortSignal
}): Promise<string[]> {
  const wfFile = opts.workflowPath || resourcePath('comfyui', 'default_workflow_api.json')
  if (!fs.existsSync(wfFile)) throw new Error(`ComfyUI workflow bulunamadı: ${wfFile}`)
  const seed = opts.seed >= 0 ? opts.seed : Math.floor(Math.random() * 2 ** 31)
  const wfText = fs
    .readFileSync(wfFile, 'utf8')
    .replaceAll('{{PROMPT}}', esc(opts.prompt))
    .replaceAll('{{NEGATIVE}}', esc(opts.negative))
    .replaceAll('"{{SEED}}"', String(seed))
  const workflow = JSON.parse(wfText)
  const base = opts.url.replace(/\/$/, '')

  let res: Response
  try {
    res = await fetch(`${base}/prompt`, {
      method: 'POST',
      signal: opts.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: randomUUID() })
    })
  } catch {
    throw new Error(`ComfyUI'a ulaşılamadı (${base}). ComfyUI açık mı?`)
  }
  if (!res.ok) throw new Error(`ComfyUI workflow reddetti (${res.status}): ${(await res.text()).slice(0, 400)}`)
  const { prompt_id } = (await res.json()) as { prompt_id: string }
  opts.log(`ComfyUI işi: ${prompt_id} (seed ${seed})`)

  const deadline = Date.now() + 20 * 60 * 1000
  for (;;) {
    await sleep(2000, opts.signal)
    const h = await fetch(`${base}/history/${prompt_id}`, { signal: opts.signal })
    const hist = (await h.json()) as Record<string, { outputs: Record<string, { images?: HistoryImage[] }>; status?: { status_str?: string } }>
    const entry = hist[prompt_id]
    if (entry) {
      if (entry.status?.status_str === 'error') throw new Error('ComfyUI workflow hata verdi (ComfyUI konsoluna bakın)')
      const images = Object.values(entry.outputs).flatMap((o) => o.images ?? []).filter((i) => i.type === 'output')
      if (images.length) {
        ensureDir(opts.outDir)
        const files: string[] = []
        for (const [i, img] of images.entries()) {
          const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder, type: img.type })
          const r = await fetch(`${base}/view?${q}`, { signal: opts.signal })
          const dest = path.join(opts.outDir, `${opts.baseName}_${i + 1}${path.extname(img.filename) || '.png'}`)
          fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
          files.push(dest)
        }
        return files
      }
    }
    if (Date.now() > deadline) throw new Error('ComfyUI zaman aşımı')
  }
}
