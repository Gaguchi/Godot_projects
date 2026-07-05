/**
 * Sprite baker — reads authored sprites under `src/data/content/sprites/*.json`,
 * renders each via the pure renderer, and writes the canonical PNG plus review
 * images (clean upscale, coordinate-grid, and for parts sprites a part-map +
 * silhouette). PNG encoding + the grid render live in ./png.
 *
 *   npm run bake-sprites
 *   npx tsx scripts/cli/bake-sprites.ts --only unit_mage --review-scale 6
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  renderSprite, renderSilhouette, renderPartsMap, addOutline, upscale,
  type SpriteSpec, type Rgba,
} from '../../src/systems/pixel/renderSprite'
import { encodePng, makeGridReview } from './png'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const SRC_DIR = join(ROOT, 'src', 'data', 'content', 'sprites')
const OUT_DIR = join(ROOT, 'public', 'sprites')
const REVIEW_DIR = join(OUT_DIR, 'review')

const INK: Rgba = [26, 20, 16, 255] // #1a1410 — shadow-edge outline
const SELOUT: Rgba = [58, 46, 34, 255] // #3a2e22 — warmer light-facing rim
const PARTS_COLORS: readonly Rgba[] = [
  [232, 201, 120, 255], [123, 166, 221, 255], [208, 104, 92, 255], [138, 99, 214, 255],
  [127, 207, 159, 255], [232, 169, 58, 255], [196, 149, 106, 255], [180, 170, 160, 255],
]
const SIL_COLOR: Rgba = [236, 224, 196, 255]

interface SpriteFile extends SpriteSpec {
  scale?: number
  outline?: boolean
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function main(): void {
  const only = arg('--only')
  const reviewScale = Number(arg('--review-scale') ?? 12)

  let files: string[]
  if (only) {
    if (!existsSync(join(SRC_DIR, `${only}.json`))) {
      console.error(`no sprite source at ${join(SRC_DIR, `${only}.json`)} (filename must equal id)`)
      process.exit(1)
    }
    files = [`${only}.json`]
  } else {
    try {
      files = readdirSync(SRC_DIR).filter((f) => f.endsWith('.json')).sort()
    } catch {
      console.error(`no sprite source dir at ${SRC_DIR}`)
      process.exit(1)
      return
    }
  }

  mkdirSync(OUT_DIR, { recursive: true })
  mkdirSync(REVIEW_DIR, { recursive: true })

  let baked = 0
  for (const file of files) {
    const spec = JSON.parse(readFileSync(join(SRC_DIR, file), 'utf8')) as SpriteFile
    const rendered = renderSprite(spec)
    const native = spec.outline ? addOutline(rendered, INK, SELOUT) : rendered
    writeFileSync(join(OUT_DIR, `${spec.id}.png`), encodePng(native))
    writeFileSync(join(REVIEW_DIR, `${spec.id}.png`), encodePng(upscale(native, reviewScale)))
    writeFileSync(join(REVIEW_DIR, `${spec.id}_grid.png`), encodePng(makeGridReview(native, reviewScale)))

    let extra = ''
    if (spec.parts && spec.parts.length > 0) {
      writeFileSync(join(REVIEW_DIR, `${spec.id}_parts.png`), encodePng(makeGridReview(renderPartsMap(spec, PARTS_COLORS), reviewScale)))
      writeFileSync(join(REVIEW_DIR, `${spec.id}_silhouette.png`), encodePng(makeGridReview(renderSilhouette(spec, SIL_COLOR), reviewScale)))
      extra = `, _parts, _silhouette (${spec.parts.length} parts)`
    }

    const colours = Object.values(spec.palette).filter((c) => c !== null).length
    console.log(`  ✓ ${spec.id.padEnd(18)} ${spec.w}x${spec.h}  ${colours} colours  -> ${spec.id}.png (+ review, _grid${extra} @${reviewScale}x)`)
    baked++
  }

  console.log(`baked ${baked} sprite${baked === 1 ? '' : 's'}`)
}

main()
