/**
 * PNG encoding + the annotated coordinate-grid review render. Shared by the
 * sprite CLIs (bake-sprites, gen-variants, sprite-lab). Node-only (node:zlib),
 * zero external deps, deterministic bytes.
 */
import { deflateSync } from 'node:zlib'
import type { RenderedImage, Rgba } from '../../src/systems/pixel/renderSprite'

// ---- minimal PNG encoder (RGBA, 8-bit, no interlace) -------------------------

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)])
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

export function encodePng(img: RenderedImage): Buffer {
  const { width, height, rgba } = img
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))])
}

// ---- annotated grid review ---------------------------------------------------

const DIGITS: Record<string, readonly number[]> = {
  '0': [7, 5, 5, 5, 7], '1': [2, 2, 2, 2, 2], '2': [7, 1, 7, 4, 7], '3': [7, 1, 7, 1, 7],
  '4': [5, 5, 7, 1, 1], '5': [7, 4, 7, 1, 7], '6': [7, 4, 7, 5, 7], '7': [7, 1, 2, 2, 2],
  '8': [7, 5, 7, 5, 7], '9': [7, 5, 7, 1, 7],
}

function px(buf: Uint8Array, W: number, H: number, x: number, y: number, c: Rgba): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return
  const i = (y * W + x) * 4
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = c[3]
}

function stamp(buf: Uint8Array, W: number, H: number, x: number, y: number, text: string, c: Rgba): void {
  let cx = x
  for (const ch of text) {
    const glyph = DIGITS[ch]
    if (glyph) {
      for (let row = 0; row < 5; row++) {
        const bits = glyph[row]!
        for (let col = 0; col < 3; col++) if ((bits & (4 >> col)) !== 0) px(buf, W, H, cx + col, y + row, c)
      }
    }
    cx += 4
  }
}

const BG: Rgba = [30, 26, 22, 255]
const CHECK_A: Rgba = [56, 52, 48, 255]
const CHECK_B: Rgba = [42, 38, 34, 255]
const MINOR: Rgba = [70, 64, 56, 255]
const MAJOR: Rgba = [122, 112, 96, 255]
const LABEL: Rgba = [206, 196, 174, 255]

export function makeGridReview(native: RenderedImage, scale: number): RenderedImage {
  const { width: w, height: h, rgba } = native
  const M = 12
  const W = M + w * scale
  const H = M + h * scale
  const out = new Uint8Array(W * H * 4)
  for (let i = 0; i < W * H; i++) {
    out[i * 4] = BG[0]; out[i * 4 + 1] = BG[1]; out[i * 4 + 2] = BG[2]; out[i * 4 + 3] = 255
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4
      const a = rgba[si + 3]!
      const c: Rgba = a > 0 ? [rgba[si]!, rgba[si + 1]!, rgba[si + 2]!, 255] : ((x + y) & 1) ? CHECK_A : CHECK_B
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) px(out, W, H, M + x * scale + dx, M + y * scale + dy, c)
    }
  }
  for (let gx = 0; gx <= w; gx++) {
    const c = gx % 8 === 0 ? MAJOR : gx % 4 === 0 ? MINOR : null
    if (!c) continue
    for (let oy = M; oy < H; oy++) px(out, W, H, M + gx * scale, oy, c)
  }
  for (let gy = 0; gy <= h; gy++) {
    const c = gy % 8 === 0 ? MAJOR : gy % 4 === 0 ? MINOR : null
    if (!c) continue
    for (let ox = M; ox < W; ox++) px(out, W, H, ox, M + gy * scale, c)
  }
  for (let gx = 0; gx < w; gx += 8) stamp(out, W, H, M + gx * scale + 1, 3, String(gx), LABEL)
  for (let gy = 0; gy < h; gy += 8) stamp(out, W, H, 1, M + gy * scale + 1, String(gy), LABEL)
  return { width: W, height: H, rgba: out }
}
