// ElevenLabs ses efekti API'si (https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert)
import { getSecret } from '../settings'
import { pcmToWav, sleep } from '../util'

export interface SfxRequest {
  text: string
  durationSeconds?: number
  loop: boolean
  promptInfluence: number
  modelId: string
  outputFormat: string
}

export async function soundEffect(req: SfxRequest, signal?: AbortSignal): Promise<{ data: Buffer; ext: 'wav' | 'mp3' | 'opus' }> {
  const key = getSecret('elevenlabs')
  if (!key) throw new Error('ElevenLabs API anahtarı yok (Ayarlar)')
  const body: Record<string, unknown> = {
    text: req.text,
    loop: req.loop,
    prompt_influence: Math.min(1, Math.max(0, req.promptInfluence)),
    model_id: req.modelId
  }
  if (req.durationSeconds && req.durationSeconds > 0) body.duration_seconds = Math.min(30, Math.max(0.5, req.durationSeconds))

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/sound-generation?output_format=${encodeURIComponent(req.outputFormat)}`, {
      method: 'POST',
      signal,
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (res.ok) {
      const data = Buffer.from(await res.arrayBuffer())
      if (req.outputFormat.startsWith('pcm_')) {
        const rate = Number(req.outputFormat.split('_')[1]) || 24000
        return { data: pcmToWav(data, rate), ext: 'wav' }
      }
      if (req.outputFormat.startsWith('wav_')) return { data, ext: 'wav' }
      if (req.outputFormat.startsWith('opus_')) return { data, ext: 'opus' }
      return { data, ext: 'mp3' }
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(3000 * 2 ** attempt, signal)
      continue
    }
    const detail = await res.text().catch(() => '')
    const hint = res.status === 401 ? 'API anahtarı geçersiz' : res.status === 403 ? 'Bu çıktı formatı planınızda yok olabilir (Ayarlar → ses formatı)' : 'ElevenLabs hatası'
    throw new Error(`${hint} (${res.status}) ${detail.slice(0, 300)}`)
  }
}
