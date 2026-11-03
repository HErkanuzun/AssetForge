// SPDX-License-Identifier: AGPL-3.0-only
// THIRD_PARTY_NOTICES.md üretir: yapay zekâ servisleri/modelleri + uygulamayla dağıtılan npm paketleri.
//   node scripts/third-party-notices.mjs          → dosyayı yazar
//   node scripts/third-party-notices.mjs --check  → dosya güncel değilse hata verir (CI)
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const read = (f) => readFileSync(new URL(f, root), 'utf8')
const OUT = 'THIRD_PARTY_NOTICES.md'

const HEADER = `# Third-party notices

AssetForge is licensed under the [GNU AGPL-3.0](LICENSE) (see also [COMMERCIAL.md](COMMERCIAL.md)). It talks to AI services and local tools that have their own licenses and terms, and it ships open-source npm packages.

**The AGPL covers AssetForge's code, not the assets you make with it.** What you may do with generated models, textures, sounds and animations depends on the terms of the service or model that produced them. Check them before commercial use.

## AI services (online, your own account)

AssetForge calls these with **your** API keys. Your use, and the ownership and allowed use of their output, are governed by each provider's terms.

| Service | Used for | Terms |
|---|---|---|
| Anthropic Claude | Prompt engine, brief chat, vision QA, Producer agent | [Commercial Terms](https://www.anthropic.com/legal/commercial-terms) |
| Meshy | Text/image to 3D, retexture, rigging | [Terms of Use](https://www.meshy.ai/terms-of-use) |
| ElevenLabs | Sound effects, engine audio | [Terms of Use](https://elevenlabs.io/terms-of-use) |
| OpenRouter (optional) | Other LLMs | [Terms](https://openrouter.ai/terms) |

## Models and tools (run on your machine, downloaded by you)

AssetForge does not include these. Its setup steps download them from their official sources, and their licenses apply.

| Component | Used for | License |
|---|---|---|
| NVIDIA Kimodo (code) | Text to motion | Apache-2.0 — [nv-tlabs/kimodo](https://github.com/nv-tlabs/kimodo) |
| Kimodo-SOMA-RP-v1.2 (default model weights) | Text to motion | [NVIDIA Open Model License](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/) (commercial use allowed). Other Kimodo checkpoints may use other NVIDIA licenses: check the model card before switching. |
| Meta Llama 3 8B Instruct | Kimodo's text encoder | [Meta Llama 3 Community License](https://www.llama.com/llama3/license/) (accepted on Hugging Face) |
| Blender | Cleanup, LODs, retargeting (headless) | GPL-2.0-or-later. AssetForge's Blender scripts (\`resources/python\`) are AGPL-3.0, which is compatible. |
| ComfyUI | Textures and images (HTTP API) | GPL-3.0 |
| Unreal Engine 5 | Import and animation systems (Python Remote Execution) | [Unreal Engine EULA](https://www.unrealengine.com/eula) |

Product names are trademarks of their owners. AssetForge is not affiliated with or endorsed by them.

## Electron and Chromium

The Windows app is built on [Electron](https://www.electronjs.org/) (MIT), which includes Chromium and other components. Their licenses ship with the app as \`LICENSE.electron.txt\` and \`LICENSES.chromium.html\` in the installation folder.

## npm packages shipped with the app

Generated from \`package-lock.json\` by \`node scripts/third-party-notices.mjs\`. Each package's full license text is included in its folder under \`resources/app.asar\` in the installation.
`

function pkgInfo(path, entry) {
  const name = entry.name ?? path.replace(/^.*node_modules\//, '')
  let license = entry.license
  let repo = ''
  const pj = new URL(`${path}/package.json`, root)
  if (existsSync(pj)) {
    const p = JSON.parse(readFileSync(pj, 'utf8'))
    license ??= typeof p.license === 'string' ? p.license : p.license?.type
    const r = typeof p.repository === 'string' ? p.repository : p.repository?.url
    repo = (r ?? p.homepage ?? '')
      .replace(/^git\+/, '')
      .replace(/\.git$/, '')
      .replace(/^git:\/\//, 'https://')
      .replace(/^github:/, 'https://github.com/')
    if (repo && !/^https?:/.test(repo) && /^[\w.-]+\/[\w.-]+$/.test(repo)) repo = `https://github.com/${repo}`
  }
  return { name, version: entry.version, license: license ?? 'not declared', repo }
}

const lock = JSON.parse(read('package-lock.json'))
const rows = Object.entries(lock.packages)
  .filter(([path, e]) => path && !e.dev && !e.devOptional && !e.link)
  .map(([path, e]) => pkgInfo(path, e))
  .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))

const unique = [...new Map(rows.map((r) => [`${r.name}@${r.version}`, r])).values()]
const counts = {}
for (const r of unique) counts[r.license] = (counts[r.license] ?? 0) + 1
const summary = Object.entries(counts)
  .sort((a, b) => b[1] - a[1])
  .map(([l, n]) => `${l} (${n})`)
  .join(', ')

const table = unique.map((r) => `| ${r.repo ? `[${r.name}](${r.repo})` : r.name} | ${r.version} | ${r.license} |`).join('\n')
const undeclared = unique.filter((r) => r.license === 'not declared')
const note = undeclared.length
  ? `\n\nPackages without a declared license (kept as transitive dependencies of the packages above; their authors are credited here): ${undeclared.map((r) => `\`${r.name}\``).join(', ')}.`
  : ''

const out = `${HEADER}\n${unique.length} packages: ${summary}.\n\n| Package | Version | License |\n|---|---|---|\n${table}${note}\n`

if (process.argv.includes('--check')) {
  const cur = existsSync(new URL(OUT, root)) ? read(OUT).replace(/\r\n/g, '\n') : ''
  if (cur !== out) {
    console.error(`${OUT} güncel değil. Çalıştır: node scripts/third-party-notices.mjs`)
    process.exit(1)
  }
  console.log(`${OUT} güncel (${unique.length} paket)`)
} else {
  writeFileSync(new URL(OUT, root), out)
  console.log(`${OUT}: ${unique.length} paket — ${summary}`)
}
