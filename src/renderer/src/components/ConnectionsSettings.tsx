// SPDX-License-Identifier: AGPL-3.0-only
// Ayarlar: yapay zeka sağlayıcıları ve görev atamaları (ModelSettings), MCP sunucusu ve dış araçlar (McpSettings)
import { useEffect, useState } from 'react'
import type { LlmProvider, LlmRoles, McpServerConfig, McpServerStatus } from '../../../shared/types'
import { useStore } from '../store'
import { Icon } from './icons'
import { Toggle } from './ui'

const PRESETS: { label: string; p: Omit<LlmProvider, 'id'> }[] = [
  { label: 'Ollama (yerel)', p: { name: 'Ollama', kind: 'openai', baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen3:14b', vision: false } },
  { label: 'LM Studio (yerel)', p: { name: 'LM Studio', kind: 'openai', baseUrl: 'http://127.0.0.1:1234/v1', model: 'local-model', vision: false } },
  { label: 'OpenRouter', p: { name: 'OpenRouter', kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-4-maverick', vision: true } },
  { label: 'OpenAI (görsel + ses)', p: { name: 'OpenAI', kind: 'openai', baseUrl: 'https://api.openai.com/v1', model: '', vision: true } },
  { label: 'Kokoro TTS (yerel ses)', p: { name: 'Kokoro', kind: 'openai', baseUrl: 'http://127.0.0.1:8880/v1', model: '', vision: false } },
  { label: 'LocalAI (yerel görsel + ses)', p: { name: 'LocalAI', kind: 'openai', baseUrl: 'http://127.0.0.1:8080/v1', model: '', vision: false } },
  { label: 'OpenAI uyumlu (özel)', p: { name: 'Özel', kind: 'openai', baseUrl: 'http://127.0.0.1:8000/v1', model: '', vision: false } },
  { label: 'Anthropic uyumlu uç', p: { name: 'Claude (özel uç)', kind: 'anthropic', baseUrl: '', model: 'claude-sonnet-5-5', vision: true } }
]

const MCP_PRESETS: { label: string; s: Omit<McpServerConfig, 'id'> }[] = [
  {
    label: 'Blender MCP',
    s: { name: 'Blender', transport: 'stdio', command: 'uvx', args: 'blender-mcp', env: '', url: '', headers: '', enabled: true, autoApprove: false }
  },
  {
    label: 'Dosya sistemi',
    s: {
      name: 'Dosyalar',
      transport: 'stdio',
      command: 'npx',
      args: '-y @modelcontextprotocol/server-filesystem C:/Projelerim/MyGame',
      env: '',
      url: '',
      headers: '',
      enabled: true,
      autoApprove: false
    }
  },
  { label: 'Özel (komut)', s: { name: 'Araç', transport: 'stdio', command: '', args: '', env: '', url: '', headers: '', enabled: true, autoApprove: false } },
  { label: 'Özel (HTTP)', s: { name: 'Sunucu', transport: 'http', command: '', args: '', env: '', url: 'http://127.0.0.1:8000/mcp', headers: '', enabled: true, autoApprove: false } }
]

export const CLAUDE_MODELS = [
  { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 (önerilen)' },
  { value: 'claude-fable-5-1', label: 'Claude Fable 5.1 (en güçlü, pahalı)' },
  { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (hızlı/ucuz)' },
  { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (en ucuz)' }
]

const rid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`

function copy(text: string, toast: (t: string, k?: 'ok') => void) {
  navigator.clipboard.writeText(text).then(() => toast('Kopyalandı', 'ok'))
}

function useSettingsPatch() {
  const { settings, setSettings, toast } = useStore()
  const patch = async (p: Parameters<typeof window.forge.settings.set>[0]) => setSettings(await window.forge.settings.set(p))
  return { s: settings!, patch, toast }
}

/** Yapay zeka sağlayıcıları ve görev atamaları */
export function ModelSettings() {
  const { s, patch, toast } = useSettingsPatch()
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [testing, setTesting] = useState('')
  const custom = s.llmProviders.filter((p) => !p.builtin)

  const setProviders = (list: LlmProvider[]) => patch({ llmProviders: list })
  const editProvider = (id: string, ch: Partial<LlmProvider>) => setProviders(custom.map((p) => (p.id === id ? { ...p, ...ch } : p)))
  const setRole = (role: keyof LlmRoles, id: string) => patch({ llmRoles: { ...s.llmRoles, [role]: id } })

  const test = async (id: string) => {
    setTesting(id)
    try {
      toast(`Bağlantı tamam — ${await window.forge.llm.test(id)}`, 'ok')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setTesting('')
    }
  }

  const roleOpts = s.llmProviders.map((p) => (
    <option key={p.id} value={p.id}>
      {p.name} · {p.model || '?'}
    </option>
  ))

  return (
    <section className="card">
      <h2>Sağlayıcılar</h2>
      <p className="muted small">
        Claude varsayılandır. Yerel modeller (Ollama, LM Studio, vLLM) ya da başka API’ler (OpenRouter, OpenAI uyumlu her uç) eklenebilir ve görevlere ayrı ayrı atanabilir. Yerel modellerde araç
        kullanımı (tool calling) destekleyen bir model seçin — ör. Qwen3, Llama 3.3/4, Mistral Small 3. OpenAI uyumlu kayıtlar ayrıca hatlardaki <b>OpenAI Uyumlu Görsel</b> ve <b>Ses Satırı (TTS)</b>{' '}
        düğümlerinde kullanılır (görsel/ses modelinin adı düğümde seçilir); <b>HTTP İsteği</b> düğümü de anahtarını buradan alabilir.
      </p>
      <div className="prov">
        <b>Claude (Anthropic)</b>
        <span className="muted small">Anthropic API · anahtar “Hesaplar ve API”de</span>
        <select className="input" value={s.claudeModel} onChange={(e) => patch({ claudeModel: e.target.value })} title="Claude modeli">
          {CLAUDE_MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <span className="chip ok" style={{ justifySelf: 'start' }}>
          görsel ✓
        </span>
        <button className="btn" disabled={testing === 'claude'} onClick={() => test('claude')}>
          {testing === 'claude' ? <span className="spinner" /> : 'Test'}
        </button>
      </div>
      {custom.map((p) => (
        <div key={p.id} className="prov" style={{ gridTemplateColumns: '1fr 1.5fr 1.1fr 0.9fr auto' }}>
          <input className="input" value={p.name} onChange={(e) => editProvider(p.id, { name: e.target.value })} title="Ad" />
          <input
            className="input"
            value={p.baseUrl}
            placeholder={p.kind === 'anthropic' ? 'boş = api.anthropic.com' : 'http://127.0.0.1:11434/v1'}
            onChange={(e) => editProvider(p.id, { baseUrl: e.target.value })}
            title="Adres"
          />
          <input className="input" value={p.model} placeholder="model adı" onChange={(e) => editProvider(p.id, { model: e.target.value })} title="Model" />
          <div className="row">
            <input
              className="input"
              type="password"
              placeholder={p.hasKey ? '•••• kayıtlı' : 'anahtar (ops.)'}
              value={keys[p.id] ?? ''}
              onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value })}
              onBlur={async () => {
                if (keys[p.id] === undefined) return
                await patch({ providerKeys: { [p.id]: keys[p.id] } })
                setKeys(({ [p.id]: _x, ...rest }) => rest)
                toast('Anahtar kaydedildi', 'ok')
              }}
            />
          </div>
          <div className="row">
            <button className="btn" disabled={testing === p.id} onClick={() => test(p.id)}>
              {testing === p.id ? <span className="spinner" /> : 'Test'}
            </button>
            <button className="btn ghost" title="Sil" onClick={() => setProviders(custom.filter((x) => x.id !== p.id))}>
              <Icon name="trash" size={14} />
            </button>
          </div>
          <div className="row small muted" style={{ gridColumn: '1 / -1' }}>
            <select className="input" style={{ width: 200, height: 30, padding: '0 8px' }} value={p.kind} onChange={(e) => editProvider(p.id, { kind: e.target.value as LlmProvider['kind'] })}>
              <option value="openai">OpenAI uyumlu API</option>
              <option value="anthropic">Anthropic uyumlu API</option>
            </select>
            <Toggle value={p.vision} onChange={(v) => editProvider(p.id, { vision: v })} label="Görsel girdi destekliyor" />
          </div>
        </div>
      ))}
      <div className="presets">
        {PRESETS.map((x) => (
          <button key={x.label} className="btn" onClick={() => setProviders([...custom, { ...x.p, id: rid('llm') }])}>
            <Icon name="plus" size={13} /> {x.label}
          </button>
        ))}
      </div>

      <h3 style={{ marginTop: 10 }}>Görev atamaları</h3>
      <div className="kv2" style={{ gridTemplateColumns: '190px 1fr', alignItems: 'center' }}>
        <span>Yapımcı asistanı</span>
        <select className="input" value={s.llmRoles.assistant} onChange={(e) => setRole('assistant', e.target.value)}>
          {roleOpts}
        </select>
        <span>Prompt motoru · Proje Kitabı · hareket</span>
        <select className="input" value={s.llmRoles.prompts} onChange={(e) => setRole('prompts', e.target.value)}>
          {roleOpts}
        </select>
        <span>Görsel kalite kontrol</span>
        <select className="input" value={s.llmRoles.vision} onChange={(e) => setRole('vision', e.target.value)}>
          {s.llmProviders
            .filter((p) => p.vision)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.model}
              </option>
            ))}
        </select>
        <span>Web araması (Claude)</span>
        <Toggle value={s.webSearch} onChange={(v) => patch({ webSearch: v })} label="Referans ve teknik araştırma için" />
      </div>
      <p className="dim small" style={{ marginTop: 8 }}>
        Brief sohbeti şimdilik Claude ile çalışır.
      </p>
    </section>
  )
}

/** AssetForge MCP sunucusu (dışarı açma) ve dış MCP araç sunucuları */
export function McpSettings() {
  const { s, patch, toast } = useSettingsPatch()
  const [mcp, setMcp] = useState<{ servers: McpServerStatus[]; expose: { running: boolean; url: string } } | null>(null)
  const [testing, setTesting] = useState('')

  const refreshMcp = () => window.forge.mcp.status().then(setMcp, () => undefined)
  useEffect(() => {
    refreshMcp()
  }, [])

  const setServers = (list: McpServerConfig[]) => patch({ mcpServers: list })
  const editServer = (id: string, ch: Partial<McpServerConfig>) => setServers(s.mcpServers.map((x) => (x.id === id ? { ...x, ...ch } : x)))

  const url = `http://127.0.0.1:${s.mcpExpose.port}/mcp`
  const ccCmd = `claude mcp add --transport http assetforge ${url} --header "Authorization: Bearer ${s.mcpExpose.token}"`
  const desktop = JSON.stringify({ mcpServers: { assetforge: { command: 'npx', args: ['-y', 'mcp-remote', `${url}?token=${s.mcpExpose.token}`] } } }, null, 2)

  return (
    <>
      <section className="card">
        <h2>Claude’u bağla — AssetForge MCP sunucusu</h2>
        <p className="muted small">
          AssetForge kendi araçlarını (asset oluşturma, üretim başlatma, sonuçları görme, animasyon, Unreal Python) MCP üzerinden dışarı açar. Claude Code ya da Claude Desktop bağlanınca projeni
          sohbetten yönetebilir. Yalnızca bu bilgisayardan (127.0.0.1) ve aşağıdaki gizli anahtarla erişilir.
        </p>
        <div className="row" style={{ marginBottom: 8 }}>
          <Toggle value={s.mcpExpose.enabled} onChange={(v) => patch({ mcpExpose: { ...s.mcpExpose, enabled: v } }).then(refreshMcp)} label="Sunucu açık" />
          <span className="dim small">Port</span>
          <input
            className="input"
            type="number"
            style={{ width: 90 }}
            value={s.mcpExpose.port}
            onChange={(e) => patch({ mcpExpose: { ...s.mcpExpose, port: Number(e.target.value) || 9560 } }).then(refreshMcp)}
          />
          <span className={`chip ${mcp?.expose.running ? 'ok' : ''}`}>{mcp?.expose.running ? `çalışıyor · ${url}` : 'kapalı'}</span>
          <span className="spacer" />
          <button
            className="btn ghost"
            onClick={() => {
              const t = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('')
              patch({ mcpExpose: { ...s.mcpExpose, token: t } }).then(refreshMcp)
            }}
          >
            <Icon name="refresh" size={13} /> Anahtarı yenile
          </button>
        </div>
        <div className="dim small">Claude Code (terminalde bir kez çalıştır):</div>
        <div className="row" style={{ alignItems: 'stretch' }}>
          <div className="codebox" style={{ flex: 1 }}>
            {ccCmd}
          </div>
          <button className="btn" onClick={() => copy(ccCmd, toast)}>
            Kopyala
          </button>
        </div>
        <div className="dim small">Claude Desktop (claude_desktop_config.json):</div>
        <div className="row" style={{ alignItems: 'stretch' }}>
          <div className="codebox" style={{ flex: 1 }}>
            {desktop}
          </div>
          <button className="btn" onClick={() => copy(desktop, toast)}>
            Kopyala
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Dış araç sunucuları (MCP)</h2>
        <p className="muted small">Blender MCP, Unreal MCP, dosya sistemi, arama gibi MCP sunucularını ekle; araçları Yapımcı’ya katılır. “Onaysız çalıştır” kapalıyken her çağrı için onay istenir.</p>
        {s.mcpServers.map((x) => {
          const st = mcp?.servers.find((y) => y.id === x.id)
          return (
            <div key={x.id} className="mcp-row">
              <div className="row" style={{ marginBottom: 8 }}>
                <input className="input" style={{ width: 160 }} value={x.name} onChange={(e) => editServer(x.id, { name: e.target.value })} />
                <select className="input" style={{ width: 120 }} value={x.transport} onChange={(e) => editServer(x.id, { transport: e.target.value as 'stdio' | 'http' })}>
                  <option value="stdio">Komut</option>
                  <option value="http">HTTP</option>
                </select>
                {x.transport === 'stdio' ? (
                  <>
                    <input className="input" style={{ width: 110 }} placeholder="komut" value={x.command} onChange={(e) => editServer(x.id, { command: e.target.value })} />
                    <input className="input" style={{ flex: 1 }} placeholder="argümanlar" value={x.args} onChange={(e) => editServer(x.id, { args: e.target.value })} />
                  </>
                ) : (
                  <input className="input" style={{ flex: 1 }} placeholder="https://…/mcp" value={x.url} onChange={(e) => editServer(x.id, { url: e.target.value })} />
                )}
              </div>
              <div className="row">
                <Toggle value={x.enabled} onChange={(v) => editServer(x.id, { enabled: v })} label="Etkin" />
                <Toggle value={x.autoApprove} onChange={(v) => editServer(x.id, { autoApprove: v })} label="Onaysız çalıştır" />
                <span className="spacer" />
                {st?.connected && <span className="chip ok">{st.tools.length} araç</span>}
                {st?.error && (
                  <span className="chip pink ellipsis" style={{ maxWidth: 280 }} title={st.error}>
                    {st.error}
                  </span>
                )}
                <button
                  className="btn"
                  disabled={testing === x.id}
                  onClick={async () => {
                    setTesting(x.id)
                    const r = await window.forge.mcp.test(x.id)
                    setTesting('')
                    await refreshMcp()
                    if (r.connected) toast(`${x.name}: ${r.tools.length} araç — ${r.tools.slice(0, 6).join(', ')}`, 'ok')
                    else toast(`${x.name}: ${r.error}`, 'error')
                  }}
                >
                  {testing === x.id ? <span className="spinner" /> : 'Bağlan / test'}
                </button>
                <button className="btn ghost" onClick={() => setServers(s.mcpServers.filter((y) => y.id !== x.id))}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
              <details style={{ marginTop: 6 }}>
                <summary className="dim small" style={{ cursor: 'pointer' }}>
                  {x.transport === 'stdio' ? 'Ortam değişkenleri' : 'Başlıklar'}
                </summary>
                <textarea
                  className="input"
                  rows={3}
                  style={{ width: '100%', marginTop: 6, fontFamily: 'Cascadia Mono, Consolas, monospace', fontSize: 12 }}
                  placeholder={x.transport === 'stdio' ? 'API_KEY=…' : 'Authorization: Bearer …'}
                  value={x.transport === 'stdio' ? x.env : x.headers}
                  onChange={(e) => editServer(x.id, x.transport === 'stdio' ? { env: e.target.value } : { headers: e.target.value })}
                />
              </details>
            </div>
          )
        })}
        <div className="presets">
          {MCP_PRESETS.map((x) => (
            <button key={x.label} className="btn" onClick={() => setServers([...s.mcpServers, { ...x.s, id: rid('mcp') }])}>
              <Icon name="plus" size={13} /> {x.label}
            </button>
          ))}
        </div>
      </section>
    </>
  )
}
