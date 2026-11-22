import {message} from '../../../shared/i18n/message'
import {panelLabel} from '../../../shared/i18n/display'
import { useLocale } from '../i18n'
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

function copy(text: string, toast: (t: string, k?: 'ok') => void, message: string) {
  navigator.clipboard.writeText(text).then(() => toast(message, 'ok'))
}

function useSettingsPatch() {
  const { settings, setSettings, toast } = useStore()
  const patch = async (p: Parameters<typeof window.forge.settings.set>[0]) => setSettings(await window.forge.settings.set(p))
  return { s: settings!, patch, toast }
}

/** Yapay zeka sağlayıcıları ve görev atamaları */
export function ModelSettings() {
  const {t, locale} = useLocale()

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
      toast(message('mcp.connected', {detail:await window.forge.llm.test(id)}), 'ok')
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
      <h2> {t('panel.5ec0b592ec')} </h2>
      <p className="muted small"> {t('panel.e5d507feef')} <b> {t('panel.a0a1f1e10e')} </b> {t('panel.4bd2c412ba')} <b> {t('panel.5c60ddab3a')} </b>{' '} {t('panel.9935a4f461')} <b> {t('panel.ecaaf35030')} </b> {t('panel.0adeea5aaf')} </p>
      <div className="prov">
        <b>Claude (Anthropic)</b>
        <span className="muted small"> {t('panel.2519c1391b')} </span>
        <select className="input" value={s.claudeModel} onChange={(e) => patch({ claudeModel: e.target.value })} title={t('panel.8ac1d85f31')}>
          {CLAUDE_MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {panelLabel(locale,m.label)}
            </option>
          ))}
        </select>
        <span className="chip ok" style={{ justifySelf: 'start' }}> {t('panel.c79dc9d317')} </span>
        <button className="btn" disabled={testing === 'claude'} onClick={() => test('claude')}>
          {testing === 'claude' ? <span className="spinner" /> : t('panel.532eaabd95')}
        </button>
      </div>
      {custom.map((p) => (
        <div key={p.id} className="prov" style={{ gridTemplateColumns: '1fr 1.5fr 1.1fr 0.9fr auto' }}>
          <input className="input" value={p.name} onChange={(e) => editProvider(p.id, { name: e.target.value })} title={t('surface.name')} />
          <input
            className="input"
            value={p.baseUrl}
            placeholder={p.kind === 'anthropic' ? t('panel.1fc9f698e1') : 'http://127.0.0.1:11434/v1'}
            onChange={(e) => editProvider(p.id, { baseUrl: e.target.value })}
            title={t('panel.32c6bebf1c')}
          />
          <input className="input" value={p.model} placeholder={t('panel.86f89b0613')} onChange={(e) => editProvider(p.id, { model: e.target.value })} title={t('panel.5e2c614c23')} />
          <div className="row">
            <input
              className="input"
              type="password"
              placeholder={p.hasKey ? t('panel.48407c23fc') : t('panel.3c522ef9ee')}
              value={keys[p.id] ?? ''}
              onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value })}
              onBlur={async () => {
                if (keys[p.id] === undefined) return
                await patch({ providerKeys: { [p.id]: keys[p.id] } })
                setKeys(({ [p.id]: _x, ...rest }) => rest)
                toast(message('panel.4b627954b4'), 'ok')
              }}
            />
          </div>
          <div className="row">
            <button className="btn" disabled={testing === p.id} onClick={() => test(p.id)}>
              {testing === p.id ? <span className="spinner" /> : t('panel.532eaabd95')}
            </button>
            <button className="btn ghost" title={t('panel.f698e9b40f')} onClick={() => setProviders(custom.filter((x) => x.id !== p.id))}>
              <Icon name="trash" size={14} />
            </button>
          </div>
          <div className="row small muted" style={{ gridColumn: '1 / -1' }}>
            <select className="input" style={{ width: 200, height: 30, padding: '0 8px' }} value={p.kind} onChange={(e) => editProvider(p.id, { kind: e.target.value as LlmProvider['kind'] })}>
              <option value="openai"> {t('panel.5755b72b49')} </option>
              <option value="anthropic"> {t('panel.2050a93474')} </option>
            </select>
            <Toggle value={p.vision} onChange={(v) => editProvider(p.id, { vision: v })} label={t('panel.998ee7cf86')} />
          </div>
        </div>
      ))}
      <div className="presets">
        {PRESETS.map((x) => (
          <button key={panelLabel(locale,x.label)} className="btn" onClick={() => setProviders([...custom, { ...x.p, id: rid('llm') }])}>
            <Icon name="plus" size={13} /> {x.label}
          </button>
        ))}
      </div>

      <h3 style={{ marginTop: 10 }}> {t('panel.742531c466')} </h3>
      <div className="kv2" style={{ gridTemplateColumns: '190px 1fr', alignItems: 'center' }}>
        <span> {t('panel.1c52f4ac47')} </span>
        <select className="input" value={s.llmRoles.assistant} onChange={(e) => setRole('assistant', e.target.value)}>
          {roleOpts}
        </select>
        <span> {t('panel.b60e86fadf')} </span>
        <select className="input" value={s.llmRoles.prompts} onChange={(e) => setRole('prompts', e.target.value)}>
          {roleOpts}
        </select>
        <span> {t('panel.c0196cdf35')} </span>
        <select className="input" value={s.llmRoles.vision} onChange={(e) => setRole('vision', e.target.value)}>
          {s.llmProviders
            .filter((p) => p.vision)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.model}
              </option>
            ))}
        </select>
        <span> {t('panel.90c5b03541')} </span>
        <Toggle value={s.webSearch} onChange={(v) => patch({ webSearch: v })} label={t('panel.af57907550')} />
      </div>
      <p className="dim small" style={{ marginTop: 8 }}> {t('panel.abf5cc3ffd')} </p>
    </section>
  )
}

/** AssetForge MCP sunucusu (dışarı açma) ve dış MCP araç sunucuları */
export function McpSettings() {
  const {t, locale} = useLocale()

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
        <h2> {t('panel.c64b666ef9')} </h2>
        <p className="muted small"> {t('panel.72e1b62251')} </p>
        <div className="row" style={{ marginBottom: 8 }}>
          <Toggle value={s.mcpExpose.enabled} onChange={(v) => patch({ mcpExpose: { ...s.mcpExpose, enabled: v } }).then(refreshMcp)} label={t('panel.8583da6400')} />
          <span className="dim small"> {t('panel.72e9a59f5a')} </span>
          <input
            className="input"
            type="number"
            style={{ width: 90 }}
            value={s.mcpExpose.port}
            onChange={(e) => patch({ mcpExpose: { ...s.mcpExpose, port: Number(e.target.value) || 9560 } }).then(refreshMcp)}
          />
          <span className={`chip ${mcp?.expose.running ? 'ok' : ''}`}>{mcp?.expose.running ? t('backend.running', {url}) : t('comfy.off')}</span>
          <span className="spacer" />
          <button
            className="btn ghost"
            onClick={() => {
              const t = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('')
              patch({ mcpExpose: { ...s.mcpExpose, token: t } }).then(refreshMcp)
            }}
          >
            <Icon name="refresh" size={13} /> {t('panel.0059a87193')} </button>
        </div>
        <div className="dim small"> {t('panel.2a3590f035')} </div>
        <div className="row" style={{ alignItems: 'stretch' }}>
          <div className="codebox" style={{ flex: 1 }}>
            {ccCmd}
          </div>
          <button className="btn" onClick={() => copy(ccCmd, toast, panelLabel(locale,'Kopyalandı'))}> {t('panel.a8bcca42d9')} </button>
        </div>
        <div className="dim small">Claude Desktop (claude_desktop_config.json):</div>
        <div className="row" style={{ alignItems: 'stretch' }}>
          <div className="codebox" style={{ flex: 1 }}>
            {desktop}
          </div>
          <button className="btn" onClick={() => copy(desktop, toast, panelLabel(locale,'Kopyalandı'))}> {t('panel.a8bcca42d9')} </button>
        </div>
      </section>

      <section className="card">
        <h2> {t('panel.2d6e2ae842')} </h2>
        <p className="muted small"> {t('panel.30de7ccd31')} </p>
        {s.mcpServers.map((x) => {
          const st = mcp?.servers.find((y) => y.id === x.id)
          return (
            <div key={x.id} className="mcp-row">
              <div className="row" style={{ marginBottom: 8 }}>
                <input className="input" style={{ width: 160 }} value={x.name} onChange={(e) => editServer(x.id, { name: e.target.value })} />
                <select className="input" style={{ width: 120 }} value={x.transport} onChange={(e) => editServer(x.id, { transport: e.target.value as 'stdio' | 'http' })}>
                  <option value="stdio"> {t('panel.7a0b514ce1')} </option>
                  <option value="http">HTTP</option>
                </select>
                {x.transport === 'stdio' ? (
                  <>
                    <input className="input" style={{ width: 110 }} placeholder={t('panel.b68070a072')} value={x.command} onChange={(e) => editServer(x.id, { command: e.target.value })} />
                    <input className="input" style={{ flex: 1 }} placeholder={t('panel.8f2a7d93f7')} value={x.args} onChange={(e) => editServer(x.id, { args: e.target.value })} />
                  </>
                ) : (
                  <input className="input" style={{ flex: 1 }} placeholder="https://…/mcp" value={x.url} onChange={(e) => editServer(x.id, { url: e.target.value })} />
                )}
              </div>
              <div className="row">
                <Toggle value={x.enabled} onChange={(v) => editServer(x.id, { enabled: v })} label={t('panel.de91313104')} />
                <Toggle value={x.autoApprove} onChange={(v) => editServer(x.id, { autoApprove: v })} label={t('panel.7414ad9940')} />
                <span className="spacer" />
                {st?.connected && <span className="chip ok">{t('mcp.tools', {count:st.tools.length})}</span>}
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
                    if (r.connected) toast(message('mcp.testResult', {name:x.name,count:r.tools.length,list:r.tools.slice(0,6).join(', ')}), 'ok')
                    else toast(`${x.name}: ${r.error}`, 'error')
                  }}
                >
                  {testing === x.id ? <span className="spinner" /> : t('panel.2422c0dd94')}
                </button>
                <button className="btn ghost" onClick={() => setServers(s.mcpServers.filter((y) => y.id !== x.id))}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
              <details style={{ marginTop: 6 }}>
                <summary className="dim small" style={{ cursor: 'pointer' }}>
                  {x.transport === 'stdio' ? t('panel.63bfca12e1') : t('panel.edc9e28349')}
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
