// SPDX-License-Identifier: AGPL-3.0-only
// Ajan Görevi motorlarını gerçek CLI / API ile dener. Normalde atlanır:
//   AF_AGENT_LIVE=claude-code npx vitest run tests/agent.live.test.ts
//   AF_AGENT_LIVE=codex       npx vitest run tests/agent.live.test.ts
//   AF_AGENT_LIVE=api         npx vitest run tests/agent.live.test.ts   (Ayarlar'daki LLM, API ücreti)
// Görev araçsızdır (MCP yok): ajan çıktı klasörüne küçük bir OBJ küp yazar.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { runTaskAgent, walk, type AgentEngine } from '../src/main/agent/taskAgent'
import { kindOfFile } from '../src/main/providers/comfyui'

const engine = process.env.AF_AGENT_LIVE as AgentEngine | undefined
const live = describe.skipIf(!engine)

live(`canlı ajan (${engine})`, () => {
  it(
    'çıktı klasörüne model dosyası yazar',
    async () => {
      const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-agent-live-'))
      const summary = await runTaskAgent({
        engine: engine!,
        providerId: '',
        mcp: 'none',
        system: 'You are a production agent inside AssetForge. Work on your own without asking questions.',
        task: `Write a Wavefront OBJ file of a 1 m cube (8 vertices, 6 quad faces) named cube.obj into this folder: ${outDir}\nThen reply with one short sentence in Turkish.`,
        images: [],
        readDirs: [],
        outDir,
        maxRounds: 6,
        timeoutMin: 5,
        shell: false,
        cliModel: process.env.AF_AGENT_MODEL ?? '',
        log: (m) => console.log(`  ${m}`),
        cost: () => undefined,
        signal: new AbortController().signal
      })
      console.log(`  özet: ${summary}`)
      const models = walk(outDir).filter((f) => kindOfFile(f) === 'model')
      expect(models.map((f) => path.basename(f))).toContain('cube.obj')
      const obj = fs.readFileSync(path.join(outDir, 'cube.obj'), 'utf8')
      expect(obj.split('\n').filter((l) => l.startsWith('v ')).length).toBe(8)
    },
    6 * 60 * 1000
  )

  // Terminal + Blender: AF_AGENT_BLENDER="C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"
  it.skipIf(!process.env.AF_AGENT_BLENDER)(
    'terminalden Blender ile parçalı araba modeli (GLB + önizleme)',
    async () => {
      const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-agent-car-'))
      const summary = await runTaskAgent({
        engine: engine!,
        providerId: '',
        mcp: 'none',
        system: 'You are a production agent inside AssetForge, a game-asset pipeline for Unreal Engine 5. Work on your own without asking questions. Check your result before finishing.',
        task: [
          'Build a simple low-poly game car in Blender from the command line and save it into the output folder.',
          `Blender: "${process.env.AF_AGENT_BLENDER}" (run it with --background --python <script>; write the script into the output folder first).`,
          'Requirements: real scale (about 4.2 m long, 1.8 m wide, 1.4 m high), body as one object named "Body", four SEPARATE wheel objects named Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR with their origins at the wheel centres (so they can spin and be moved for suspension), simple materials, under 5000 triangles.',
          `Export: car.glb into ${outDir}, and render a preview image car_preview.png there (Workbench or Eevee, 512x512).`,
          'Reply with one short Turkish sentence.'
        ].join('\n'),
        images: [],
        readDirs: [],
        outDir,
        maxRounds: 20,
        timeoutMin: 10,
        shell: true,
        cliModel: process.env.AF_AGENT_MODEL ?? '',
        log: (m) => console.log(`  ${m}`),
        cost: () => undefined,
        signal: new AbortController().signal
      })
      console.log(`  özet: ${summary}\n  klasör: ${outDir}`)
      const names = walk(outDir).map((f) => path.basename(f))
      expect(names).toContain('car.glb')
      expect(names).toContain('car_preview.png')
      // GLB içindeki düğüm adları: tekerlekler ayrı objeler olmalı
      const glb = fs.readFileSync(path.join(outDir, 'car.glb'))
      const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { nodes: { name?: string }[] }
      const nodes = json.nodes.map((n) => n.name ?? '')
      for (const w of ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR']) expect(nodes).toContain(w)
    },
    12 * 60 * 1000
  )
})
