import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

/* --- minimal PNG writer --- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([length, typeBuf, data, crc])
}

function encodePng(size, rgba) {
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* --- vector-ish cat glyph, supersampled --- */

const insideEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

function insideTriangle(px, py, a, b, c) {
  const sign = (p1, p2, p3) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
  const d1 = sign([px, py], a, b)
  const d2 = sign([px, py], b, c)
  const d3 = sign([px, py], c, a)
  const neg = d1 < 0 || d2 < 0 || d3 < 0
  const pos = d1 > 0 || d2 > 0 || d3 > 0
  return !(neg && pos)
}

function inCat(x, y) {
  const head = insideEllipse(x, y, 0.5, 0.575, 0.335, 0.295)
  const leftEar = insideTriangle(x, y, [0.215, 0.44], [0.3, 0.13], [0.465, 0.36])
  const rightEar = insideTriangle(x, y, [0.785, 0.44], [0.7, 0.13], [0.535, 0.36])
  if (!(head || leftEar || rightEar)) return false
  if (insideEllipse(x, y, 0.385, 0.545, 0.052, 0.062)) return false
  if (insideEllipse(x, y, 0.615, 0.545, 0.052, 0.062)) return false
  if (insideTriangle(x, y, [0.47, 0.628], [0.53, 0.628], [0.5, 0.665])) return false
  return true
}

function render(size, background, foreground) {
  const rgba = Buffer.alloc(size * size * 4)
  const samples = 4
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let cover = 0
      let bgCover = 0
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = (x + (sx + 0.5) / samples) / size
          const py = (y + (sy + 0.5) / samples) / size
          if (inCat(px, py)) cover += 1
          if (background && insideRounded(px, py, 0.5, 0.5, 0.5, 0.115)) bgCover += 1
        }
      }
      const total = samples * samples
      const glyph = cover / total
      const bg = background ? bgCover / total : 0
      const index = (y * size + x) * 4

      if (background) {
        const mix = glyph
        rgba[index] = Math.round(background[0] * (1 - mix) + foreground[0] * mix)
        rgba[index + 1] = Math.round(background[1] * (1 - mix) + foreground[1] * mix)
        rgba[index + 2] = Math.round(background[2] * (1 - mix) + foreground[2] * mix)
        rgba[index + 3] = Math.round(255 * bg)
      } else {
        rgba[index] = foreground[0]
        rgba[index + 1] = foreground[1]
        rgba[index + 2] = foreground[2]
        rgba[index + 3] = Math.round(255 * glyph)
      }
    }
  }
  return rgba
}

function insideRounded(px, py, cx, cy, half, radius) {
  const dx = Math.abs(px - cx) - (half - radius)
  const dy = Math.abs(py - cy) - (half - radius)
  if (dx <= 0 || dy <= 0) return Math.abs(px - cx) <= half && Math.abs(py - cy) <= half
  return dx * dx + dy * dy <= radius * radius
}

fs.mkdirSync(path.join(process.cwd(), 'assets'), { recursive: true })

// assets/icon.png and assets/icon.ico are the supplied artwork — a bare glyph
// with no plate or border behind it — so this script never paints one back on.
fs.writeFileSync(
  path.join(process.cwd(), 'assets', 'tray.png'),
  encodePng(32, render(32, null, [255, 255, 255])),
)
fs.writeFileSync(
  path.join(process.cwd(), 'assets', 'tray-dark.png'),
  encodePng(32, render(32, null, [20, 24, 30])),
)

console.log('icons written:', fs.readdirSync(path.join(process.cwd(), 'assets')))
