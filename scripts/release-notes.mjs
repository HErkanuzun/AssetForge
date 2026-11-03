// CHANGELOG.md'den tek bir sürümün bölümünü çıkarır: node scripts/release-notes.mjs 0.4.2 > notes.md
import { readFileSync } from 'node:fs'

const version = (process.argv[2] ?? '').replace(/^v/, '')
if (!version) {
  console.error('Kullanım: node scripts/release-notes.mjs <sürüm>')
  process.exit(1)
}

const lines = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8').split(/\r?\n/)
const start = lines.findIndex((l) => l.startsWith(`## [${version}]`))
if (start < 0) {
  console.error(`CHANGELOG.md içinde [${version}] bölümü yok`)
  process.exit(1)
}
let end = lines.findIndex((l, i) => i > start && l.startsWith('## ['))
if (end < 0) end = lines.length
console.log(
  lines
    .slice(start + 1, end)
    .join('\n')
    .trim()
)
