// Draws the three PWA home-screen icons and encodes them as PNG files using
// only Node built-ins (node:zlib for the deflate/zlib stream, node:fs for
// writing the files, and a small hand-rolled CRC-32 for the chunk
// checksums). No image library - this runs once to produce three static
// files, so a dependency like `sharp` or `pngjs` would be a heavy install
// for a one-off drawing.
//
// The glyph is a white Erlenmeyer flask (narrow neck with a flared lip,
// widening into a trapezoidal body with a flat base, lower body filled a
// lighter teal to suggest liquid) on a solid `#00695C` square. Geometry is
// evaluated per-pixel from a handful of straight edges, so it stays crisp
// and legible at 48px without needing anti-aliasing.

import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'node:buffer'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../public/icons')

const BACKGROUND = [0x00, 0x69, 0x5c] // #00695C
const GLYPH = [0xff, 0xff, 0xff] // white
const LIQUID = [0x80, 0xcb, 0xc4] // #80CBC4, a lighter teal

// Flask geometry, in coordinates normalised to the icon's size (0..1 on
// both axes, origin top-left). Designed so the glyph reads clearly at 48px:
// a narrow neck, a slightly flared lip, and a wide trapezoidal body with a
// flat base. The lower part of the body is recoloured as "liquid".
const LIP_Y0 = 0.16
const LIP_Y1 = 0.22
const LIP_HALF_WIDTH = 0.09
const NECK_Y0 = LIP_Y1
const NECK_Y1 = 0.4
const NECK_HALF_WIDTH = 0.055
const BODY_Y0 = NECK_Y1
const BODY_Y1 = 0.8
const BODY_BASE_HALF_WIDTH = 0.3
const LIQUID_Y0 = 0.6

/**
 * @param {number} gx normalised x (0..1) in the *unscaled* glyph's own space
 * @param {number} gy normalised y (0..1) in the *unscaled* glyph's own space
 * @returns {readonly [number, number, number] | null} RGB of the glyph at
 *   this point, or null if the point is outside the glyph (background shows
 *   through).
 */
function glyphColorAt(gx, gy) {
  const dx = Math.abs(gx - 0.5)

  if (gy >= LIP_Y0 && gy < LIP_Y1) {
    return dx <= LIP_HALF_WIDTH ? GLYPH : null
  }

  if (gy >= NECK_Y0 && gy < NECK_Y1) {
    return dx <= NECK_HALF_WIDTH ? GLYPH : null
  }

  if (gy >= BODY_Y0 && gy <= BODY_Y1) {
    const t = (gy - BODY_Y0) / (BODY_Y1 - BODY_Y0)
    const halfWidth = NECK_HALF_WIDTH + t * (BODY_BASE_HALF_WIDTH - NECK_HALF_WIDTH)
    if (dx > halfWidth) return null
    return gy >= LIQUID_Y0 ? LIQUID : GLYPH
  }

  return null
}

/**
 * Renders the flask glyph into an RGBA pixel buffer.
 *
 * @param {number} size icon width/height in pixels (icons are square)
 * @param {number} safeZoneScale shrink factor applied to the glyph about the
 *   icon's centre. 1 draws the glyph at its natural size (fine for the
 *   regular, non-maskable icons); a maskable icon must keep its important
 *   content inside the central 80% "safe zone" circle that OS launchers use
 *   when clipping to a shape, so it is drawn with a scale comfortably under
 *   that 0.4-radius bound.
 * @returns {Buffer} raw RGBA pixels, row-major, 4 bytes per pixel
 */
function renderIcon(size, safeZoneScale) {
  const pixels = Buffer.alloc(size * size * 4)

  for (let py = 0; py < size; py += 1) {
    const ny = (py + 0.5) / size
    for (let px = 0; px < size; px += 1) {
      const nx = (px + 0.5) / size

      // Map the canvas point back into the unscaled glyph's coordinate
      // space: shrinking the glyph by `safeZoneScale` about the centre
      // means a canvas point q corresponds to unscaled point (q - 0.5) /
      // safeZoneScale + 0.5.
      const gx = (nx - 0.5) / safeZoneScale + 0.5
      const gy = (ny - 0.5) / safeZoneScale + 0.5

      const color = glyphColorAt(gx, gy) ?? BACKGROUND
      const offset = (py * size + px) * 4
      pixels[offset] = color[0]
      pixels[offset + 1] = color[1]
      pixels[offset + 2] = color[2]
      pixels[offset + 3] = 0xff
    }
  }

  return pixels
}

// --- Minimal PNG encoder -----------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)

  const crcInput = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcInput), 0)

  return Buffer.concat([length, typeBuf, data, crc])
}

/**
 * Encodes raw RGBA pixels as an 8-bit, truecolour-with-alpha PNG (colour
 * type 6). Each scanline is emitted with filter type 0 (None) - simplest to
 * write correctly, and small enough at these icon sizes that a smarter
 * filter is not worth the extra code.
 */
function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8 // bit depth
  ihdrData[9] = 6 // colour type: truecolour + alpha
  ihdrData[10] = 0 // compression method
  ihdrData[11] = 0 // filter method
  ihdrData[12] = 0 // interlace method
  const ihdr = chunk('IHDR', ihdrData)

  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0 // filter type: None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const idat = chunk('IDAT', deflateSync(raw))

  const iend = chunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdr, idat, iend])
}

// --- Generate the three icons --------------------------------------------

mkdirSync(outDir, { recursive: true })

const icons = [
  { file: 'icon-192.png', size: 192, safeZoneScale: 1 },
  { file: 'icon-512.png', size: 512, safeZoneScale: 1 },
  // Keeps the glyph's furthest points (the base corners, at radius ~0.424
  // from centre) safely inside the 0.4-radius maskable safe zone.
  { file: 'maskable-512.png', size: 512, safeZoneScale: 0.85 },
]

for (const { file, size, safeZoneScale } of icons) {
  const pixels = renderIcon(size, safeZoneScale)
  const png = encodePng(size, size, pixels)
  const outPath = resolve(outDir, file)
  writeFileSync(outPath, png)
  console.log(`Wrote ${outPath} (${size}x${size}, ${png.length} bytes)`)
}
