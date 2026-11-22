// SPDX-License-Identifier: AGPL-3.0-only
// Audit direct display boundaries, including ASCII text. --inventory includes
// metadata and feedback producers for the broader review in ui-audit.md.
import fs from 'node:fs'
import path from 'node:path'
import { parse } from '@babel/parser'

const inventory = process.argv.includes('--inventory')
const findings = []
const technical = new Set([
  'AssetForge',
  '· MCP',
  'Workflow → Export (API)',
  'AF:prompt',
  'AF:image',
  'AF:seed',
  'http://192.168.1.20:8188',
  'Claude (Anthropic)',
  'Claude Desktop (claude_desktop_config.json):',
  'HTTP',
  'https://…/mcp',
  '_hf',
  'assetforge.json',
  '--listen 0.0.0.0',
  'http://computer-name:',
  'Cloudflare Tunnel:',
  'cloudflared tunnel --url http://127.0.0.1:',
  'NVIDIA Kimodo',
  'ID',
  'PBR',
  '/Game/Materials/M_Master',
  '· LOD1',
  '· LOD2',
  '15k · NPC',
  '150k',
  'm · UV',
  'id:',
  'Delete',
  'Blender',
  'Meshy',
  'ElevenLabs',
  'Hugging Face',
  'v',
  '(alpha)',
  'GitHub',
  'A tired soldier', // AI prompt example; execution prompts remain English.
  'Gradio',
  'WSL2 + Docker',
  'http://127.0.0.1:11434/v1',
  'API_KEY=…',
  'Authorization: Bearer …'
])
const visibleAttrs = new Set(['title', 'placeholder', 'label', 'help', 'desc', 'aria-label', 'alt'])
function textOf(n) {
  if (n?.type === 'StringLiteral') return n.value
  if (n?.type === 'TemplateLiteral') return n.quasis.map((q, i) => q.value.cooked + (i < n.expressions.length ? `{p${i}}` : '')).join('')
  return null
}
function add(file, node, text, kind, strict) {
  if (!text || !/\p{L}/u.test(text.replace(/\{\w+\}/g, ''))) return
  text = text.replace(/\s+/g, ' ').trim()
  const allowed = technical.has(text) || /^(?:Remote Execution:| · Python:|Claude \(MCP\) →|\{p0\}: \{p1\}|\{p0\} · \{p1\}|\{p0\} m\/s)/.test(text)
  findings.push({ file, line: node.loc.start.line, kind, text, status: strict && !allowed ? 'review' : allowed ? 'technical-or-data' : 'producer-inventory' })
}
function expression(file, n) {
  if (!n) return
  const text = textOf(n)
  if (text !== null) add(file, n, text, 'display-expression', true)
  if (n.type === 'ConditionalExpression') {
    expression(file, n.consequent)
    expression(file, n.alternate)
  }
  if (n.type === 'LogicalExpression') expression(file, n.right)
}
for (const root of ['src/renderer/src', 'src/main', 'src/shared']) {
  for (const name of fs.readdirSync(root, { recursive: true }).filter((name) => /\.tsx?$/.test(name) && !name.startsWith('i18n' + path.sep))) {
    const file = path.join(root, name).replaceAll('\\', '/'),
      source = fs.readFileSync(file, 'utf8')
    const ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
    function walk(n, parent) {
      if (!n || typeof n !== 'object') return
      if (n.type === 'JSXText') add(file, n, n.value, 'jsx-text', true)
      if (n.type === 'JSXExpressionContainer' && parent?.type !== 'JSXAttribute') expression(file, n.expression)
      if (n.type === 'JSXAttribute' && visibleAttrs.has(n.name.name)) expression(file, n.value?.type === 'JSXExpressionContainer' ? n.value.expression : n.value)
      if (n.type === 'CallExpression' && ['toast', 'confirm', 'alert', 'prompt'].includes(n.callee.name)) expression(file, n.arguments[0])
      if (inventory && n.type === 'ObjectProperty' && ['label', 'help', 'hint', 'description', 'error', 'summary', 'notes', 'title'].includes(n.key?.name))
        add(file, n, textOf(n.value), 'display-metadata', false)
      if (inventory && ((n.type === 'NewExpression' && n.callee.name === 'Error') || (n.type === 'CallExpression' && ['log', 'warn'].includes(n.callee.property?.name))))
        add(file, n, textOf(n.arguments[0]), 'feedback-producer', false)
      for (const [key, value] of Object.entries(n))
        if (key !== 'loc') {
          if (Array.isArray(value)) value.forEach((child) => walk(child, n))
          else if (value && typeof value === 'object') walk(value, n)
        }
    }
    walk(ast)
  }
}
const pending = findings.filter((row) => row.status === 'review')
if (inventory) console.log(JSON.stringify(findings, null, 2))
else {
  for (const row of pending) console.error(`${row.file}:${row.line} ${row.kind}: ${JSON.stringify(row.text)}`)
  console.log(`Direct UI string audit: ${findings.length} candidates, ${pending.length} require review. Metadata and producer inventory: --inventory.`)
}
if (pending.length) process.exitCode = 1
