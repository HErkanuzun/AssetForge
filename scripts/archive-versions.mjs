// SPDX-License-Identifier: AGPL-3.0-only
// versions/ klasörünü doldurur: her sürüm için kurulum dosyası, kaynak kodu ve sürüm notları.
//   node scripts/archive-versions.mjs             → dist/ içindeki kurulumları ve git etiketlerini arşivler
//   node scripts/archive-versions.mjs --download  → eksik kurulumları GitHub Releases'ten indirir
// versions/ git'e girmez (README.md hariç); bu bilgisayardaki yerel arşivdir.
import { execFileSync } from 'node:child_process'
import { copyFileSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const VERSIONS = join(root, 'versions')
const DIST = join(root, 'dist')
const REPO = 'HErkanuzun/AssetForge'
const download = process.argv.includes('--download')

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const semver = (v) => v.split('.').map(Number)
const byVersion = (a, b) => {
  const [x, y] = [semver(a), semver(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]
  return 0
}
const mb = (f) => `${(statSync(f).size / 1024 / 1024).toFixed(0)} MB`

function notes(version) {
  const lines = readFileSync(join(root, 'CHANGELOG.md'), 'utf8').split(/\r?\n/)
  const start = lines.findIndex((l) => l.startsWith(`## [${version}]`))
  if (start < 0) return null
  let end = lines.findIndex((l, i) => i > start && l.startsWith('## ['))
  if (end < 0) end = lines.length
  return lines.slice(start, end).join('\n').trim()
}

async function fetchInstaller(version, target) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/v${version}`, { headers: { 'User-Agent': 'assetforge-archive' } })
  if (!res.ok) return `GitHub'da v${version} sürümü yok`
  const asset = (await res.json()).assets?.find((a) => a.name.endsWith('.exe'))
  if (!asset) return 'sürümde kurulum dosyası yok'
  const part = target + '.part'
  const dl = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'assetforge-archive' } })
  if (!dl.ok || !dl.body) return `indirme başarısız (${dl.status})`
  await pipeline(Readable.fromWeb(dl.body), createWriteStream(part))
  renameSync(part, target)
  return null
}

const tags = git('tag', '--list', 'v*')
  .split('\n')
  .map((t) => t.replace(/^v/, ''))
  .filter((v) => /^\d+\.\d+\.\d+$/.test(v))
const built = existsSync(DIST)
  ? readdirSync(DIST)
      .map((f) => /^AssetForge-Setup-(\d+\.\d+\.\d+)\.exe$/.exec(f)?.[1])
      .filter(Boolean)
  : []
const all = [...new Set([...tags, ...built])].sort(byVersion)

mkdirSync(VERSIONS, { recursive: true })
const rows = []
for (const v of all) {
  const dir = join(VERSIONS, `v${v}`)
  mkdirSync(dir, { recursive: true })
  const setup = join(dir, `AssetForge-Setup-${v}.exe`)
  const source = join(dir, `AssetForge-${v}-source.zip`)
  const status = []

  if (!existsSync(setup) && existsSync(join(DIST, `AssetForge-Setup-${v}.exe`))) {
    copyFileSync(join(DIST, `AssetForge-Setup-${v}.exe`), setup)
    status.push('kurulum dist/ klasöründen kopyalandı')
  }
  if (!existsSync(setup) && download && tags.includes(v)) {
    process.stdout.write(`v${v}: kurulum indiriliyor… `)
    const err = await fetchInstaller(v, setup)
    console.log(err ?? 'tamam')
    if (!err) status.push('kurulum GitHub’dan indirildi')
  }
  if (tags.includes(v) && !existsSync(source)) {
    git('archive', '--format=zip', `--prefix=AssetForge-${v}/`, '-o', source, `v${v}`)
    status.push('kaynak kodu arşivlendi')
  }
  const n = notes(v)
  writeFileSync(
    join(dir, 'NOTES.md'),
    `# AssetForge v${v}\n\n${tags.includes(v) ? `Git etiketi: \`v${v}\` (${git('log', '-1', '--format=%h %cs', `v${v}`)})\n\n` : 'Bu sürümün git etiketi yok (yerel derleme).\n\n'}${n ?? 'CHANGELOG.md içinde bu sürüm için not yok.'}\n`
  )
  if (status.length) console.log(`v${v}: ${status.join(', ')}`)
  rows.push(
    `| v${v} | ${existsSync(setup) ? `[kurulum](v${v}/AssetForge-Setup-${v}.exe) (${mb(setup)})` : '—'} | ${existsSync(source) ? `[kaynak](v${v}/AssetForge-${v}-source.zip)` : '—'} | [notlar](v${v}/NOTES.md) |`
  )
}

writeFileSync(
  join(VERSIONS, 'INDEX.md'),
  `# Yerel sürüm arşivi\n\nSon güncelleme: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}. Geri dönme yolları için README.md'ye bak.\n\n| Sürüm | Kurulum | Kaynak kodu | Notlar |\n|---|---|---|---|\n${rows.reverse().join('\n')}\n`
)
console.log(`versions/: ${all.length} sürüm (INDEX.md güncellendi)`)
