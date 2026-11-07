// SPDX-License-Identifier: AGPL-3.0-only
// Discover locally installed agent CLIs without installing or modifying them.
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { CliAgentStatus } from '../../shared/types'

const execFileAsync = promisify(execFile)

const CANDIDATES = [
  { id: 'claude-code', name: 'Claude Code', command: 'claude' },
  { id: 'codex', name: 'Codex CLI', command: 'codex' },
  { id: 'gemini-cli', name: 'Gemini CLI', command: 'gemini' },
  { id: 'opencode', name: 'OpenCode', command: 'opencode' },
  { id: 'goose', name: 'Goose', command: 'goose' },
  { id: 'aider', name: 'Aider', command: 'aider' },
  { id: 'cursor-agent', name: 'Cursor Agent', command: 'agent' },
  { id: 'qwen-code', name: 'Qwen Code', command: 'qwen' }
] as const

function executableCandidates(command: string): string[] {
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  if (path.isAbsolute(command)) return [command]
  if (process.platform !== 'win32') return dirs.map((dir) => path.join(dir, command))

  const extensions = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .filter(Boolean)
  const hasExtension = !!path.extname(command)
  return dirs.flatMap((dir) =>
    (hasExtension ? [''] : extensions).map((ext) => path.join(dir, command + ext))
  )
}

function findExecutable(command: string): string | undefined {
  for (const candidate of executableCandidates(command)) {
    try {
      const stat = fs.statSync(candidate)
      if (!stat.isFile()) continue
      if (process.platform !== 'win32') fs.accessSync(candidate, fs.constants.X_OK)
      return candidate
    } catch {
      // Keep scanning PATH entries.
    }
  }
  return undefined
}

async function detect(candidate: (typeof CANDIDATES)[number]): Promise<CliAgentStatus> {
  const executablePath = findExecutable(candidate.command)
  if (!executablePath) {
    return { ...candidate, installed: false }
  }

  try {
    const { stdout, stderr } = await execFileAsync(executablePath, ['--version'], {
      timeout: 5000,
      windowsHide: true,
      maxBuffer: 32 * 1024,
      // Windows npm/pip shims are commonly .cmd/.bat files.
      shell: process.platform === 'win32' && /\.(cmd|bat)$/i.test(executablePath)
    })
    const version = (stdout || stderr).trim().split(/\r?\n/, 1)[0].slice(0, 160)
    return { ...candidate, installed: true, executablePath, version: version || 'Installed' }
  } catch (e) {
    const error = (e as Error).message.slice(0, 180)
    return { ...candidate, installed: true, executablePath, error }
  }
}

/** Detect known agent CLIs on PATH; this never installs, authenticates, or launches an agent session. */
export async function discoverCliAgents(): Promise<CliAgentStatus[]> {
  return Promise.all(CANDIDATES.map(detect))
}
