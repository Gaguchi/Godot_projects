/**
 * Board-sprite baker — downsamples the ComfyUI character renders in
 * `public/sprites/units/*.png` (832×1216) to board size (÷8 → 104×152) with a
 * box filter, into `public/sprites/units/board/`. BoardScene draws THESE;
 * portraits keep the originals.
 *
 * Why: the board used to scale the 1216px originals straight down to a 48px
 * tile under `pixelArt: true` (nearest filtering). A 25× nearest downscale
 * keeps 1 source pixel in 25 — that was the "characters look pixelated"
 * complaint. Box-filtering offline + LINEAR filtering at runtime fixes it.
 *
 *   npm run bake-board-sprites
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const SRC_DIR = join(ROOT, 'public', 'sprites', 'units')
const OUT_DIR = join(SRC_DIR, 'board')
const FACTOR = 8

/** Alpha-weighted box downsample so transparent pixels don't darken edges. */
function downsample(src: PNG, f: number): PNG {
  const w = Math.floor(src.width / f)
  const h = Math.floor(src.height / f)
  const out = new PNG({ width: w, height: h })
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < f; sy++) {
        for (let sx = 0; sx < f; sx++) {
          const i = (((y * f) + sy) * src.width + (x * f) + sx) * 4
          const pa = src.data[i + 3]!
          r += src.data[i]! * pa
          g += src.data[i + 1]! * pa
          b += src.data[i + 2]! * pa
          a += pa
        }
      }
      const o = (y * w + x) * 4
      if (a > 0) {
        out.data[o] = Math.round(r / a)
        out.data[o + 1] = Math.round(g / a)
        out.data[o + 2] = Math.round(b / a)
      }
      out.data[o + 3] = Math.round(a / (f * f))
    }
  }
  return out
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true })
  const files = readdirSync(SRC_DIR).filter((f) => f.endsWith('.png')).sort()
  for (const f of files) {
    const src = PNG.sync.read(readFileSync(join(SRC_DIR, f)))
    const out = downsample(src, FACTOR)
    writeFileSync(join(OUT_DIR, f), PNG.sync.write(out))
    console.log(`${f}: ${src.width}×${src.height} → ${out.width}×${out.height}`)
  }
  console.log(`baked ${files.length} board sprites into ${OUT_DIR}`)
}

main()
