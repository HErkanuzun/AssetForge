// OpenAI uyumlu sohbet uçları: Ollama, LM Studio, vLLM, OpenRouter, OpenAI…
// (Claude çağrıları Anthropic SDK ile claude.ts'te yapılır; bu dosya yalnızca diğer sağlayıcılar içindir.)
import { z } from 'zod'
import type { LlmProvider } from '../../shared/types'
import { providerKey } from '../settings'

export type OaPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
export interface OaToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}
export type OaMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | OaPart[] }
  | { role: 'assistant'; content: string | null; tool_calls?: OaToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export interface OaTool {
  type: 'function'
  function: { name: string; description: string; parameters: unknown }
}

function endpoint(p: LlmProvider): string {
  const base = (p.baseUrl || 'http://127.0.0.1:11434/v1').replace(/\/+$/, '')
  return base.endsWith('/chat/completions') ? base : base + '/chat/completions'
}

function headers(p: LlmProvider): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = providerKey(p)
  if (key) h.Authorization = `Bearer ${key}`
  if (/openrouter\.ai/.test(p.baseUrl)) {
    h['HTTP-Referer'] = 'https://assetforge.local'
    h['X-Title'] = 'AssetForge'
  }
  return h
}

async function post(p: LlmProvider, body: unknown, signal?: AbortSignal): Promise<Response> {
  let res: Response
  try {
    res = await fetch(endpoint(p), { method: 'POST', headers: headers(p), body: JSON.stringify(body), signal })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new Error(`${p.name} sunucusuna bağlanılamadı (${endpoint(p)}). Sunucu açık mı?`)
  }
  if (!res.ok) {
    const t = (await res.text()).slice(0, 600)
    throw new Error(`${p.name} hatası (${res.status}): ${t}`)
  }
  return res
}

/** Anthropic biçimli içerik bloklarını OpenAI parçalarına çevirir */
export function toOaParts(content: { type: string; text?: string; source?: { type: string; media_type?: string; data?: string } }[], vision: boolean): OaPart[] {
  const out: OaPart[] = []
  for (const b of content) {
    if (b.type === 'text' && b.text) out.push({ type: 'text', text: b.text })
    else if (b.type === 'image' && vision && b.source?.type === 'base64') out.push({ type: 'image_url', image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } })
    else if (b.type === 'image' && !vision) out.push({ type: 'text', text: '[görsel — bu model görsel girdi desteklemiyor]' })
  }
  return out
}

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(t)
  } catch {
    const a = t.indexOf('{')
    const b = t.lastIndexOf('}')
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1))
    throw new Error('Model JSON döndürmedi')
  }
}

/** Şemaya uyan JSON üretimi (response_format json_schema; desteklenmiyorsa talimatla) */
export async function oaStructured<S extends z.ZodType>(p: LlmProvider, schema: S, system: string, parts: OaPart[], maxTokens: number): Promise<z.infer<S>> {
  const jsonSchema = z.toJSONSchema(schema)
  const messages: OaMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: parts }
  ]
  let useFormat = true
  let note = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    const msgs = note ? [...messages, { role: 'user' as const, content: note }] : messages
    const body: Record<string, unknown> = { model: p.model, messages: msgs, max_tokens: maxTokens, temperature: 0.4 }
    if (useFormat) body.response_format = { type: 'json_schema', json_schema: { name: 'result', schema: jsonSchema, strict: false } }
    else msgs[0] = { role: 'system', content: `${system}\n\nReturn ONLY a JSON object (no prose, no code fences) matching this JSON Schema:\n${JSON.stringify(jsonSchema)}` }
    let res: Response
    try {
      res = await post(p, body)
    } catch (e) {
      // Bazı sunucular response_format'ı tanımaz → talimatla tekrar dene
      if (useFormat && /\b400\b|response_format|json_schema/i.test((e as Error).message)) {
        useFormat = false
        continue
      }
      throw e
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const text = data.choices?.[0]?.message?.content ?? ''
    try {
      const r = schema.safeParse(extractJson(text))
      if (r.success) return r.data
      note = `Your previous JSON did not match the schema: ${r.error.message.slice(0, 800)}. Return corrected JSON only.`
    } catch (e) {
      note = `${(e as Error).message}. Return ONLY the JSON object.`
    }
  }
  throw new Error(`${p.name}: şemaya uygun yanıt alınamadı`)
}

export interface OaStreamResult {
  content: string
  toolCalls: OaToolCall[]
  finish: string
}

/** Akışlı sohbet + araç çağrıları */
export async function oaChatStream(
  p: LlmProvider,
  messages: OaMessage[],
  tools: OaTool[],
  on: { text: (d: string) => void; thinking: (on: boolean) => void },
  signal?: AbortSignal
): Promise<OaStreamResult> {
  const body: Record<string, unknown> = { model: p.model, messages, stream: true, max_tokens: 8000 }
  if (tools.length) body.tools = tools
  const res = await post(p, body, signal)
  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let content = ''
  let finish = ''
  let thinking = false
  const calls: { id: string; name: string; args: string }[] = []
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') continue
      let ev: {
        choices?: {
          delta?: { content?: string; reasoning?: string; reasoning_content?: string; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] }
          finish_reason?: string
        }[]
      }
      try {
        ev = JSON.parse(payload)
      } catch {
        continue
      }
      const ch = ev.choices?.[0]
      if (!ch) continue
      const d = ch.delta ?? {}
      if ((d.reasoning || d.reasoning_content) && !thinking) {
        thinking = true
        on.thinking(true)
      }
      if (d.content) {
        if (thinking) {
          thinking = false
          on.thinking(false)
        }
        content += d.content
        on.text(d.content)
      }
      for (const tc of d.tool_calls ?? []) {
        const c = (calls[tc.index] ??= { id: '', name: '', args: '' })
        if (tc.id) c.id = tc.id
        if (tc.function?.name) c.name += tc.function.name
        if (tc.function?.arguments) c.args += tc.function.arguments
      }
      if (ch.finish_reason) finish = ch.finish_reason
    }
  }
  if (thinking) on.thinking(false)
  // Bazı yerel modeller düşünceyi <think>…</think> ile metne gömer
  content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  const toolCalls = calls
    .filter((c) => c && c.name)
    .map((c, i) => ({ id: c.id || `call_${Date.now()}_${i}`, type: 'function' as const, function: { name: c.name, arguments: c.args || '{}' } }))
  return { content, toolCalls, finish: toolCalls.length ? 'tool_calls' : finish }
}

export async function oaTest(p: LlmProvider): Promise<string> {
  const res = await post(p, { model: p.model, messages: [{ role: 'user', content: 'Sadece "hazır" yaz.' }], max_tokens: 20 })
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; model?: string }
  return `${data.model ?? p.model}: ${(data.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim().slice(0, 60)}`
}
