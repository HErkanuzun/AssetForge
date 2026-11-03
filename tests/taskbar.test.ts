// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import type { Job, NodeRunState } from '../src/shared/types'
import { jobsProgress, pageFromArgv } from '../src/main/taskbar'

const node = (status: NodeRunState['status'], progress = 0): NodeRunState => ({ status, progress, logs: [], attempts: 0 })
const job = (status: Job['status'], nodes: NodeRunState[]): Job => ({ id: Math.random().toString(36), status, nodes: Object.fromEntries(nodes.map((n, i) => [`n${i}`, n])) }) as unknown as Job

describe('pageFromArgv', () => {
  it('geçerli sayfayı bulur', () => {
    expect(pageFromArgv(['C:\\AssetForge.exe', '--page=library'])).toBe('library')
    expect(pageFromArgv(['x', '--allow-file-access', '--page=settings'])).toBe('settings')
  })
  it('bilinmeyen ya da hatalı değerleri yok sayar', () => {
    expect(pageFromArgv(['x'])).toBeNull()
    expect(pageFromArgv(['--page=hacker'])).toBeNull()
    expect(pageFromArgv(['--page=library;calc'])).toBeNull()
    expect(pageFromArgv(['--page='])).toBeNull()
  })
})

describe('jobsProgress', () => {
  it('iş yoksa ya da hepsi bittiyse null', () => {
    expect(jobsProgress([])).toBeNull()
    expect(jobsProgress([job('done', [node('done', 100)]), job('failed', [node('failed', 30)])])).toBeNull()
  })
  it('düğüm ilerlemelerinin ortalaması; biten ve atlanan düğümler tam sayılır', () => {
    expect(jobsProgress([job('running', [node('done', 0), node('running', 50), node('idle'), node('skipped')])])).toBeCloseTo(0.625)
  })
  it('birden çok işin ortalaması; sıradaki iş 0 sayılır', () => {
    expect(jobsProgress([job('running', [node('done', 100)]), job('queued', [node('idle')])])).toBeCloseTo(0.5)
    expect(jobsProgress([job('queued', [])])).toBe(0)
  })
})
