/**
 * tile-demo — composite a small biome map with DUAL-GRID autotiling to prove the
 * layered approach: per-cell opaque base + per-biome transition overlays (offset
 * half a tile, 4-corner marching-squares lookup) feather biomes into each other.
 * Writes public/art/terrain/_demo.png.  npm run tile-demo
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DIR = join(HERE, '..', '..', 'public', 'art', 'terrain')
const T = 128

const CHAR: Record<string, string> = { w: 'water', d: 'dirt', s: 'stone', g: 'grass' }
const ORDER = ['water', 'dirt', 'stone', 'grass'] // precedence low -> high (drawn last = on top)
const MAP = [
  'wwwddddddd',
  'wwddddggdd',
  'wdddgggggd',
  'dddgggggsd',
  'ddddgggsss',
  'dddddddsss',
]

const cache = new Map<string, PNG>()
function tile(biome: string, cfg: number): PNG {
  const key = cfg === 15 ? biome : `${biome}_${cfg}`
  let png = cache.get(key)
  if (!png) { png = PNG.sync.read(readFileSync(join(DIR, `${key}.png`))); cache.set(key, png) }
  return png
}

function over(dst: Uint8Array, CW: number, CH: number, src: PNG, ox: number, oy: number): void {
  for (let y = 0; y < src.height; y++) {
    const cy = oy + y
    if (cy < 0 || cy >= CH) continue
    for (let x = 0; x < src.width; x++) {
      const cx = ox + x
      if (cx < 0 || cx >= CW) continue
      const si = (y * src.width + x) * 4
      const a = src.data[si + 3]! / 255
      if (a === 0) continue
      const di = (cy * CW + cx) * 4
      for (let k = 0; k < 3; k++) dst[di + k] = Math.round(src.data[si + k]! * a + dst[di + k]! * (1 - a))
      dst[di + 3] = 255
    }
  }
}

function main(): void {
  const rows = MAP.length, cols = MAP[0]!.length
  const CW = cols * T, CH = rows * T
  const canvas = new Uint8Array(CW * CH * 4)
  const at = (r: number, c: number): string | null => {
    const ch = MAP[r]?.[c]
    return ch ? CHAR[ch] ?? null : null
  }
  // base: each cell drawn with its own biome (opaque)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const b = at(r, c); if (b) over(canvas, CW, CH, tile(b, 15), c * T, r * T)
  }
  // per-biome dual-grid transition overlays, low->high precedence
  for (const B of ORDER) {
    for (let dr = 0; dr <= rows; dr++) for (let dc = 0; dc <= cols; dc++) {
      const cfg = (at(dr - 1, dc - 1) === B ? 1 : 0) | (at(dr - 1, dc) === B ? 2 : 0)
        | (at(dr, dc - 1) === B ? 4 : 0) | (at(dr, dc) === B ? 8 : 0)
      if (cfg === 0) continue
      over(canvas, CW, CH, tile(B, cfg), dc * T - T / 2, dr * T - T / 2)
    }
  }
  const png = new PNG({ width: CW, height: CH })
  png.data = Buffer.from(canvas)
  writeFileSync(join(DIR, '_demo.png'), PNG.sync.write(png))
  console.log(`wrote ${CW}x${CH} dual-grid demo -> public/art/terrain/_demo.png`)
}

main()
