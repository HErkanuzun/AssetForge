// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => process.cwd(), isPackaged: false }, safeStorage: { isEncryptionAvailable: () => false } }))

import { claudeMcpConfig, codexMcpArgs, mcpKey } from '../src/main/agent/taskAgent'
import { FEEDBACK_NODES, nearestPrompt } from '../src/main/engine/graph'
import { NODE_DEF_MAP } from '../src/shared/nodes'
import type { McpServerConfig, Pipeline } from '../src/shared/types'

const blender: McpServerConfig = {
  id: 'mcp_1',
  name: 'Blender',
  transport: 'stdio',
  command: 'uvx',
  args: 'blender-mcp --port "9876"',
  env: 'BLENDER_HOST=localhost',
  url: '',
  headers: '',
  enabled: true
}
const remote: McpServerConfig = { ...blender, id: 'mcp_2', name: 'Unreal MCP', transport: 'http', command: '', args: '', env: '', url: 'http://127.0.0.1:8000/mcp', headers: 'Authorization: Bearer x' }

describe('Ajan Görevi düğümü', () => {
  it('tanımı: girişler isteğe bağlı, model/görsel/ses çıkışı, LLM ve MCP ayarlardan', () => {
    const d = NODE_DEF_MAP['agent.task']
    expect(d).toBeDefined()
    expect(d.inputs.every((i) => i.optional)).toBe(true)
    expect(d.outputs.map((o) => o.id)).toEqual(['model', 'image', 'audio'])
    expect(d.params.find((p) => p.id === 'provider')?.source).toBe('llm')
    expect(d.params.find((p) => p.id === 'mcp')?.source).toBe('mcp')
  })

  it('kalite kontrol geri bildirimi ajan düğümüne gelir', () => {
    expect(FEEDBACK_NODES.has('agent.task')).toBe(true)
    const p: Pipeline = {
      id: 'x',
      name: 'x',
      description: '',
      nodes: [
        { id: 'asset', type: 'asset.input', position: { x: 0, y: 0 }, params: {} },
        { id: 'agent', type: 'agent.task', position: { x: 0, y: 0 }, params: {} },
        { id: 'blender', type: 'blender.process', position: { x: 0, y: 0 }, params: {} },
        { id: 'qa', type: 'qa.review', position: { x: 0, y: 0 }, params: {} }
      ],
      edges: [
        { id: 'a', source: 'asset', sourceHandle: 'asset', target: 'agent', targetHandle: 'asset' },
        { id: 'b', source: 'agent', sourceHandle: 'model', target: 'blender', targetHandle: 'model' },
        { id: 'c', source: 'blender', sourceHandle: 'model', target: 'qa', targetHandle: 'subject' }
      ]
    }
    expect(nearestPrompt(p, 'qa')).toBe('agent')
  })

  it('MCP sunucu adı CLI anahtarına çevrilir', () => {
    expect(mcpKey(blender)).toBe('blender')
    expect(mcpKey(remote)).toBe('unreal_mcp')
  })

  it('Claude Code MCP yapılandırması', () => {
    expect(claudeMcpConfig([blender, remote])).toEqual({
      mcpServers: {
        blender: { type: 'stdio', command: 'uvx', args: ['blender-mcp', '--port', '9876'], env: { BLENDER_HOST: 'localhost' } },
        unreal_mcp: { type: 'http', url: 'http://127.0.0.1:8000/mcp', headers: { Authorization: 'Bearer x' } }
      }
    })
  })

  it('Codex -c ayarları geçerli TOML değerleri', () => {
    expect(codexMcpArgs([blender, remote])).toEqual([
      '-c',
      'mcp_servers.blender.command="uvx"',
      '-c',
      'mcp_servers.blender.args=["blender-mcp","--port","9876"]',
      '-c',
      'mcp_servers.blender.env={"BLENDER_HOST"="localhost"}',
      '-c',
      'mcp_servers.unreal_mcp.url="http://127.0.0.1:8000/mcp"',
      '-c',
      'mcp_servers.unreal_mcp.http_headers={"Authorization"="Bearer x"}'
    ])
  })
})
