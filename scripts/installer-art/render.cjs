// SPDX-License-Identifier: AGPL-3.0-only
// Kurulum görsellerini art.html'den üretir (24 bit BMP, NSIS'in istediği boyutlarda).
//   npx electron scripts/installer-art/render.cjs
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const OUT = path.join(__dirname, '../../build')
const ART = [
  { v: 'sidebar', w: 164, h: 314, file: 'installerSidebar.bmp' },
  { v: 'uninstall', w: 164, h: 314, file: 'uninstallerSidebar.bmp' },
  { v: 'header', w: 150, h: 57, file: 'installerHeader.bmp' }
]

/** NativeImage BGRA → alt-üst 24 bit BMP */
function toBmp(img, w, h) {
  const bgra = img.toBitmap()
  const row = Math.ceil((w * 3) / 4) * 4
  const buf = Buffer.alloc(54 + row * h)
  buf.write('BM', 0)
  buf.writeUInt32LE(buf.length, 2)
  buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(w, 18)
  buf.writeInt32LE(h, 22)
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(24, 28)
  buf.writeUInt32LE(row * h, 34)
  buf.writeInt32LE(2835, 38)
  buf.writeInt32LE(2835, 42)
  for (let y = 0; y < h; y++) {
    const dst = 54 + (h - 1 - y) * row
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4
      buf[dst + x * 3] = bgra[s]
      buf[dst + x * 3 + 1] = bgra[s + 1]
      buf[dst + x * 3 + 2] = bgra[s + 2]
    }
  }
  return buf
}

// Her görselden sonra pencere kapanınca uygulama kendiliğinden çıkmasın
app.on('window-all-closed', () => undefined)

app.whenReady().then(async () => {
  for (const a of ART) {
    const win = new BrowserWindow({ width: a.w, height: a.h, show: false, useContentSize: true, frame: false, webPreferences: { offscreen: true, zoomFactor: 1 } })
    await win.loadFile(path.join(__dirname, 'art.html'), { query: { v: a.v } })
    await new Promise((r) => setTimeout(r, 400))
    const img = (await win.webContents.capturePage({ x: 0, y: 0, width: a.w, height: a.h })).resize({ width: a.w, height: a.h, quality: 'best' })
    fs.writeFileSync(path.join(OUT, a.file), toBmp(img, a.w, a.h))
    console.log(`${a.file} ${a.w}x${a.h}`)
    win.destroy()
  }
  app.quit()
})
