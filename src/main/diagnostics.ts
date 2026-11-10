// SPDX-License-Identifier: AGPL-3.0-only
// Tanılama dosyası: sürümler, sistem, ayar özeti (anahtar değerleri olmadan), Kimodo durumu ve son günlük satırları.
// Hata bildirirken GitHub issue'ya eklenmek üzere tasarlandı; tüm metin redact() ile temizlenir.
import { app, BrowserWindow, dialog } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { redact, tailLog } from './log'
import { kimodoStatus } from './integrations/kimodo'
import { serverStates } from './integrations/comfyServers'
import { agentClis } from './agent/taskAgent'
import { getSecret, getSettings } from './settings'

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | { error: string }> {
  return Promise.race([p.catch((e: Error) => ({ error: e.message })), new Promise<{ error: string }>((r) => setTimeout(() => r({ error: `${ms / 1000} sn içinde yanıt yok` }), ms))])
}

const yes = (b: boolean) => (b ? 'evet' : 'hayır')
const exists = (p: string) => (p ? (fs.existsSync(p) ? 'var' : 'YOK') : 'ayarlanmamış')

async function gpu(): Promise<string> {
  try {
    const info = (await app.getGPUInfo('basic')) as { gpuDevice?: { vendorId: number; deviceId: number; driverVersion?: string; active?: boolean }[] }
    // 0x1414 = Microsoft Basic Render Driver (yazılımsal); listede gürültü yapar
    const vendor: Record<number, string> = { 0x10de: 'NVIDIA', 0x1002: 'AMD', 0x8086: 'Intel' }
    const devices = (info.gpuDevice ?? [])
      .filter((d) => d.vendorId !== 0x1414)
      .map((d) => `${vendor[d.vendorId] ?? '0x' + d.vendorId.toString(16)} 0x${d.deviceId.toString(16)} sürücü ${d.driverVersion ?? '?'}`)
    return [...new Set(devices)].join('; ') || 'bilinmiyor'
  } catch {
    return 'bilinmiyor'
  }
}

export async function buildDiagnostics(): Promise<string> {
  const s = getSettings()
  const gb = (n: number) => `${(n / 1024 ** 3).toFixed(1)} GB`
  const cpus = os.cpus()
  const kimodo = await withTimeout(kimodoStatus(), 8000)
  const lines: string[] = [
    '# AssetForge tanılama',
    '',
    `Oluşturma: ${new Date().toISOString()}`,
    'Bu dosyada API anahtarları, token’lar ve kullanıcı adınız yoktur (maskelenir). Paylaşmadan önce yine de göz atabilirsiniz.',
    '',
    '## Sürümler',
    `AssetForge ${app.getVersion()} (${app.isPackaged ? 'kurulu' : 'geliştirme'})`,
    `Electron ${process.versions.electron} · Chromium ${process.versions.chrome} · Node ${process.versions.node}`,
    '',
    '## Sistem',
    `${os.type()} ${os.release()} ${os.arch()} · dil ${app.getLocale()}`,
    `CPU: ${cpus[0]?.model?.trim() ?? '?'} × ${cpus.length}`,
    `Bellek: ${gb(os.totalmem())} toplam, ${gb(os.freemem())} boş`,
    `GPU: ${await gpu()}`,
    '',
    '## Ayarlar (özet)',
    `Proje klasörü: ${s.projectDir} (${exists(s.projectDir)})`,
    `Claude modeli: ${s.claudeModel} · web araması: ${yes(s.webSearch)} · eşzamanlı iş: ${s.concurrency}`,
    `Anahtarı olan servisler: ${(['anthropic', 'meshy', 'elevenlabs', 'huggingface', 'comfy'] as const).filter((n) => getSecret(n)).join(', ') || 'yok'}${s.llmProviders.length ? ` · ek sağlayıcı anahtarı: ${s.llmProviders.filter((p) => getSecret(`llm:${p.id}`)).length}/${s.llmProviders.length}` : ''}`,
    `Ek LLM sağlayıcıları: ${s.llmProviders.map((p) => `${p.name} (${p.kind}, ${p.baseUrl || 'varsayılan'}, ${p.model || '-'})`).join('; ') || 'yok'}`,
    `Roller: asistan=${s.llmRoles.assistant}, istemler=${s.llmRoles.prompts}, görsel=${s.llmRoles.vision}`,
    `Blender: ${s.blenderPath || '-'} (${exists(s.blenderPath)})`,
    ...(await withTimeout(serverStates(), 10000).then((st) =>
      'error' in st
        ? [`ComfyUI sunucuları: alınamadı (${st.error})`]
        : s.comfyServers.map((x) => {
            const z = st.find((y) => y.id === x.id)
            return `ComfyUI “${x.name}”${x.managed ? ' (AssetForge kurulumu)' : ''}: ${x.url}${x.enabled ? '' : ' · kapalı'} · ${z?.online ? `${z.info}${z.queue ? ` · kuyruk ${z.queue}` : ''}` : `ulaşılamıyor (${(z?.error ?? '?').slice(0, 80)})`}${getSecret(`comfy:${x.id}`) ? ' · token var' : ''}`
          })
    )),
    `ComfyUI workflow kitaplığı: ${s.comfyWorkflows.length} workflow · varsayılan sunucu ${s.comfyDefaultServer || 'auto'}${s.comfyWorkflow ? ` · taşınamayan eski workflow yolu ${exists(s.comfyWorkflow)}` : ''}`,
    `Ajan CLI'ları: ${(await agentClis(true).catch(() => [])).map((c) => `${c.name} ${c.installed ? (c.version ?? c.error ?? 'kurulu') : 'yok'}`).join(' · ') || '?'}`,
    `Ses biçimi: ${s.audioFormat}`,
    `Kimodo: ${s.kimodoBackend} · ${s.kimodoUrl} · klasör ${exists(s.kimodoHome)}${s.kimodoBackend === 'wsl' ? ` · WSL ${s.wslDistro}` : ''}`,
    `MCP sunucusu: ${s.mcpExpose.enabled ? `açık, port ${s.mcpExpose.port}` : 'kapalı'}`,
    `Dış MCP sunucuları: ${s.mcpServers.map((m) => `${m.name} (${m.transport}${m.enabled ? '' : ', kapalı'})`).join('; ') || 'yok'}`,
    '',
    '## Kimodo durumu',
    'error' in kimodo && !('steps' in kimodo)
      ? `alınamadı: ${kimodo.error}`
      : [
          `çalışıyor: ${yes(kimodo.running)} · sağlıklı: ${yes(kimodo.healthy)}${kimodo.device ? ` · cihaz ${kimodo.device}` : ''}${kimodo.model ? ` · model ${kimodo.model}` : ''}`,
          ...kimodo.steps.map((st) => `- [${st.done ? 'x' : ' '}] ${st.label}`),
          ...(kimodo.error ? [`hata: ${kimodo.error}`] : [])
        ].join('\n'),
    '',
    '## Son günlük satırları',
    '```',
    ...tailLog(300),
    '```',
    ''
  ]
  return redact(lines.join('\n'))
}

/** Kaydetme penceresini açar; kaydedilen yolu döndürür (iptal → null) */
export async function saveDiagnostics(win: BrowserWindow | null): Promise<string | null> {
  const text = await buildDiagnostics()
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
  const opts = { title: 'Tanılama dosyasını kaydet', defaultPath: path.join(app.getPath('desktop'), `AssetForge-tanilama-${stamp}.txt`), filters: [{ name: 'Metin', extensions: ['txt'] }] }
  const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
  if (r.canceled || !r.filePath) return null
  fs.writeFileSync(r.filePath, text)
  return r.filePath
}
