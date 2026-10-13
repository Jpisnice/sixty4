// Draws the app icons (6 off-white tiles on ink, one marigold) as PNGs with zlib only.
// Usage: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs'
import { crc32, deflateSync } from 'node:zlib'

const BG = [0x08, 0x09, 0x0a]
const FG = [0xf7, 0xf8, 0xf8]
const ACCENT = [0xe3, 0x9a, 0x3b]

function draw(size) {
  const px = Buffer.alloc(size * size * 4)
  // Tiles sit inside the middle 60% so the icon survives maskable cropping.
  const box = size * 0.6
  const gap = box * 0.08
  const tw = (box - 2 * gap) / 3
  const th = tw * 0.8
  const top = (size - (2 * th + gap)) / 2
  const left = (size - box) / 2
  const r = tw * 0.18
  const inTile = (x, y) => {
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 3; col++) {
        const x0 = left + col * (tw + gap)
        const y0 = top + row * (th + gap)
        const dx = Math.max(x0 + r - x, 0, x - (x0 + tw - r))
        const dy = Math.max(y0 + r - y, 0, y - (y0 + th - r))
        if (x >= x0 && x <= x0 + tw && y >= y0 && y <= y0 + th && dx * dx + dy * dy <= r * r)
          return row * 3 + col
      }
    return -1
  }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const t = inTile(x + 0.5, y + 0.5)
      const c = t < 0 ? BG : t === 0 ? ACCENT : FG
      px.set([...c, 255], (y * size + x) * 4)
    }
  return png(size, px)
}

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) writeFileSync(`public/icon-${size}.png`, draw(size))
console.log('Wrote public/icon-192.png and public/icon-512.png')
