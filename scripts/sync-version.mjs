// `npm version` sırasında çalışır (package.json "version" betiği):
// yeni sürüm numarasını README'lere, ROADMAP'e ve llms.txt'ye yazar,
// CHANGELOG'daki [Unreleased] maddelerini yeni sürümün başlığı altına taşır.
import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const read = (f) => readFileSync(new URL(f, root), 'utf8')
const write = (f, s) => writeFileSync(new URL(f, root), s)
const V = /\d+\.\d+\.\d+/

const version = JSON.parse(read('package.json')).version
const today = new Date().toISOString().slice(0, 10)
const monthYear = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })

const changes = []
const update = (file, fn) => {
  const before = read(file)
  const after = fn(before)
  if (after !== before) {
    write(file, after)
    changes.push(file)
  }
}

for (const f of ['README.md', 'README.tr.md', 'README.es.md', 'README.zh-CN.md']) {
  update(f, (s) =>
    s
      // rozet: ...-0.4.0%20alpha-orange
      .replace(new RegExp(`-${V.source}(?=%20alpha)`, 'g'), `-${version}`)
      // metin: **0.4.0 (alpha)** / **0.4.0（alpha）**
      .replace(new RegExp(`\\*\\*${V.source}(?=\\s?[(（]alpha)`, 'g'), `**${version}`)
  )
}

update('ROADMAP.md', (s) => s.replace(new RegExp(`^## Where we are: v${V.source} \\(alpha\\), .*$`, 'm'), `## Where we are: v${version} (alpha), ${monthYear}`))

update('llms.txt', (s) => s.replace(new RegExp(`Current version: ${V.source}`), `Current version: ${version}`))

update('CHANGELOG.md', (s) => {
  if (s.includes(`## [${version}]`)) return s
  const m = s.match(/## \[Unreleased\]\r?\n([\s\S]*?)(?=\r?\n## \[)/)
  if (!m || !m[1].trim()) throw new Error('CHANGELOG.md: [Unreleased] altında yayınlanacak madde yok')
  return s.replace(m[0], `## [Unreleased]\n\n## [${version}] - ${today}\n${m[1].replace(/\s+$/, '')}\n`)
})

console.log(`v${version}: ${changes.join(', ') || 'değişiklik yok'}`)
