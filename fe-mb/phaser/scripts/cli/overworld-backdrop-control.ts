/**
 * Rasterize a COMPOSITION control image for the overworld backdrop bake
 * (overworld-grounding plan, Phase 2). This is the low-frequency reference the
 * blur/composition ControlNet conditions on — it does NOT contain the road or
 * the node markers (SVG owns those). Its only job is to enforce, at bake time:
 *   - a WIDE horizontal traversable plane (not a centred mountain hero shot)
 *   - dark framing at top (sky) and bottom/edges (foreground) — value staging
 *   - a lit warm midground band where the node graph lives
 *   - soft bright CLEARINGS exactly where nodes sit, so terrain reserves quiet
 *     ground there instead of growing a tree/peak through a node.
 * All node clearings are compressed into the LAND band (map-y is layout, not
 * perspective height — the whole graph sits on the ground plane; higher map-y
 * reads as nearer/foreground, lower as further/near-horizon).
 *
 *   npx tsx scripts/cli/overworld-backdrop-control.ts borderlands
 *   npx tsx scripts/cli/overworld-backdrop-control.ts borderlands --w 1536 --h 512 --mood calm
 *
 * Mood presets steer the palette for the "escalating dread" arc:
 *   calm (Borderlands), eerie (Thornwood), hellish (Ashfall).
 */
import { readFileSync, mkdirSync, createWriteStream } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const arg = (f: string): string | undefined => {
  const i = process.argv.indexOf(f)
  return i >= 0 ? process.argv[i + 1] : undefined
}

type RGB = [number, number, number]
interface Mood {
  skyTop: RGB
  horizon: RGB
  glow: RGB
  landNear: RGB // lit midground just below horizon
  fore: RGB // dark foreground framing
  clearing: RGB // warm lift at node clearings
}
const MOODS: Record<string, Mood> = {
  // Borderlands — calmer, warm golden-hour grassland (approachable start).
  calm: { skyTop: [38, 44, 56], horizon: [120, 108, 88], glow: [196, 150, 92], landNear: [104, 96, 66], fore: [30, 30, 22], clearing: [150, 128, 84] },
  // Thornwood — cold, shadowed, eerie forest.
  eerie: { skyTop: [22, 30, 30], horizon: [70, 86, 78], glow: [96, 120, 96], landNear: [44, 58, 44], fore: [14, 20, 16], clearing: [96, 116, 92] },
  // Ashfall — hellish ember-lit volcanic.
  hellish: { skyTop: [30, 16, 14], horizon: [120, 60, 36], glow: [210, 96, 40], landNear: [70, 38, 28], fore: [18, 10, 8], clearing: [190, 96, 44] },
}

const region = process.argv[2]
if (!region) {
  console.error('usage: tsx scripts/cli/overworld-backdrop-control.ts <region> [--w N --h N --mood calm|eerie|hellish]')
  process.exit(1)
}
const W = Number(arg('--w') ?? 1536)
const H = Number(arg('--h') ?? 512)
const mood = MOODS[arg('--mood') ?? 'calm'] ?? MOODS['calm']!

const file = join(HERE, '../../src/data/content/overworld', `${region}.json`)
const map = JSON.parse(readFileSync(file, 'utf8')) as {
  width: number
  height: number
  nodes: { id: string; position: { x: number; y: number } }[]
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
const clamp = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v)

const HORIZON = 0.40 // sky/land split (fraction of height)
const LAND_TOP = HORIZON
const LAND_BOT = 0.92

// Map node positions into the LAND band. x spans full width; y (layout) maps to
// near-horizon..foreground so the graph sits on the receding ground plane.
const ys = map.nodes.map((n) => n.position.y)
const yLo = Math.min(...ys)
const yHi = Math.max(...ys)
const clearings = map.nodes.map((n) => ({
  cx: (n.position.x / map.width) * W,
  cy: (LAND_TOP + ((n.position.y - yLo) / (yHi - yLo || 1)) * (LAND_BOT - LAND_TOP)) * H,
}))
const CLEAR_R = Math.max(W, H) * 0.085

const png = new PNG({ width: W, height: H })
for (let y = 0; y < H; y++) {
  const ny = y / H
  for (let x = 0; x < W; x++) {
    const nx = x / W
    let col: RGB
    if (ny < HORIZON) {
      // sky: dark top → warm haze at horizon, with a soft golden glow band
      const t = ny / HORIZON
      col = mix(mood.skyTop, mood.horizon, t * t)
      const glowBand = Math.max(0, 1 - Math.abs(ny - HORIZON * 0.92) / 0.14)
      col = mix(col, mood.glow, glowBand * 0.55)
    } else {
      // land: lit near-horizon midground → dark foreground (value recede)
      const t = (ny - HORIZON) / (1 - HORIZON)
      col = mix(mood.landNear, mood.fore, Math.pow(t, 0.8))
    }
    // left/right + bottom framing vignette (darken edges → eye stays centre-band)
    const edge = Math.min(nx, 1 - nx) // 0 at sides, 0.5 centre
    const vig = Math.min(1, edge / 0.22) * (ny < 0.96 ? 1 : 0.6)
    col = mix([col[0] * 0.45, col[1] * 0.45, col[2] * 0.45], col, vig)
    // node clearings: additive warm lift (reserves quiet bright ground)
    for (const c of clearings) {
      const d = Math.hypot(x - c.cx, y - c.cy)
      if (d < CLEAR_R) {
        const k = Math.pow(1 - d / CLEAR_R, 2) * 0.5
        col = mix(col, mood.clearing, k)
      }
    }
    const i = (y * W + x) * 4
    png.data[i] = clamp(col[0])
    png.data[i + 1] = clamp(col[1])
    png.data[i + 2] = clamp(col[2])
    png.data[i + 3] = 255
  }
}

const outDir = join(HERE, 'comfy', 'control')
mkdirSync(outDir, { recursive: true })
const out = join(outDir, `${region}.png`)
png.pack().pipe(createWriteStream(out)).on('finish', () => {
  console.log(`control image: ${out} (${W}x${H}, ${map.nodes.length} clearings, mood=${arg('--mood') ?? 'calm'})`)
})
