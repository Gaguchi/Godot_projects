/**
 * cut-tiles — turn ONE seamless base biome texture into a DUAL-GRID transition set.
 * The proper-approach insight: transition tiles aren't AI-generated, they're the base
 * texture cut by a fixed library of 16 corner masks (marching squares). A display
 * tile in a dual-grid samples the 4 logic-cell corners around it -> a 4-bit config
 * (TL=1,TR=2,BL=4,BR=8). We render that config's mask: bilinearly interpolate the 4
 * corner bits across the tile and feather the 0.5 contour -> clean outer corners,
 * edges, and diagonals fall out automatically.
 *
 *   npm run cut-tiles -- --id tile_grass --name grass
 * Outputs public/art/terrain/<name>.png (opaque base, cfg 15) + <name>_<1..14>.png
 * (transparent-edged transitions). cfg 0 (empty) is just "draw nothing".
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const LAB = join(ROOT, 'public', 'sprites', 'lab')
const OUT = join(ROOT, 'public', 'art', 'terrain')
const TILE = 128
const FEATHER = 0.11

function arg(f: string): string | undefined {
  const i = process.argv.indexOf(f)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function boxDownsample(src: PNG, size: number): Uint8Array {
  const { width: sw, height: sh, data } = src
  const out = new Uint8Array(size * size * 4)
  const fx = sw / size
  const fy = sh / size
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx))
      const y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy))
      let r = 0, g = 0, b = 0, n = 0
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * sw + sx) * 4
          r += data[i]!; g += data[i + 1]!; b += data[i + 2]!; n++
        }
      }
      const o = (y * size + x) * 4
      out[o] = Math.round(r / n); out[o + 1] = Math.round(g / n); out[o + 2] = Math.round(b / n); out[o + 3] = 255
    }
  }
  return out
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function writeRGBA(path: string, data: Uint8Array, size: number): void {
  const png = new PNG({ width: size, height: size })
  png.data = Buffer.from(data)
  writeFileSync(path, PNG.sync.write(png))
}

function main(): void {
  const id = arg('--id') ?? 'tile_grass'
  const name = arg('--name') ?? id.replace(/^tile_/, '')
  const file = arg('--file') // arbitrary source PNG (e.g. a CC0 base texture); else lab/<id>
  const src = PNG.sync.read(readFileSync(file ?? join(LAB, `${id}@review.png`)))
  const base = boxDownsample(src, TILE)
  mkdirSync(OUT, { recursive: true })
  writeRGBA(join(OUT, `${name}.png`), base, TILE) // cfg 15 = full opaque base

  for (let cfg = 1; cfg < 15; cfg++) {
    const tl = cfg & 1 ? 1 : 0, tr = cfg & 2 ? 1 : 0, bl = cfg & 4 ? 1 : 0, br = cfg & 8 ? 1 : 0
    const out = new Uint8Array(TILE * TILE * 4)
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const u = (x + 0.5) / TILE, v = (y + 0.5) / TILE
        const f = tl * (1 - u) * (1 - v) + tr * u * (1 - v) + bl * (1 - u) * v + br * u * v
        const a = smoothstep(0.5 - FEATHER, 0.5 + FEATHER, f)
        const i = (y * TILE + x) * 4
        out[i] = base[i]!; out[i + 1] = base[i + 1]!; out[i + 2] = base[i + 2]!; out[i + 3] = Math.round(a * 255)
      }
    }
    writeRGBA(join(OUT, `${name}_${cfg}.png`), out, TILE)
  }
  console.log(`cut ${name}: base + 14 transition tiles -> public/art/terrain/`)
}

main()
