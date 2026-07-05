/**
 * Dev tool: stretch a region's hand-authored node coords so the map sheet fits
 * its stage zone. Topology is untouched (edges reference ids, not coordinates).
 * Rewrites the JSON in place.
 *
 * Two independent axes:
 *   - X (overworld-grounding T1): respread x into [pad .. width-pad] so the
 *     camera genuinely pans left→right. Runs by default; skipped when Y flags
 *     are given without an explicit --pad (so a Y-only pass leaves every x
 *     byte-identical).
 *   - Y (splitview respread): linearly remap each node's y from the map's
 *     current [yMin..yMax] span into [--y-min .. --y-max], preserving relative
 *     layout. --height sets the map's top-level height to match the new zone.
 *
 *   npx tsx scripts/cli/respread-overworld.ts borderlands
 *   npx tsx scripts/cli/respread-overworld.ts borderlands --pad 120
 *   npx tsx scripts/cli/respread-overworld.ts borderlands --y-min 70 --y-max 380 --height 444
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { respreadNodes, type PositionedNode } from '../../src/systems/overworldLayout'

const USAGE = `usage: tsx scripts/cli/respread-overworld.ts <region> [--pad N] [--y-min N --y-max N] [--height N]
  --pad N     respread node x into [N .. width-N] (default 120; default mode when no Y flags)
  --y-min N   with --y-max: remap node y from the current span into [y-min .. y-max]
  --y-max N   (linear, preserves relative layout; rounds to ints)
  --height N  set the map JSON's top-level height
Y flags without an explicit --pad leave x untouched.`

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE)
  process.exit(0)
}

/** Numeric value of `--flag N`, or undefined when the flag is absent. */
function numFlag(name: string): number | undefined {
  const i = args.indexOf(name)
  if (i < 0) return undefined
  const v = Number(args[i + 1])
  if (!Number.isFinite(v)) {
    console.error(`${name} expects a number, got "${args[i + 1] ?? ''}"`)
    process.exit(1)
  }
  return v
}

const here = dirname(fileURLToPath(import.meta.url))
const region = args[0]
if (!region || region.startsWith('--')) {
  console.error(USAGE)
  process.exit(1)
}

const yMin = numFlag('--y-min')
const yMax = numFlag('--y-max')
const height = numFlag('--height')
if ((yMin === undefined) !== (yMax === undefined)) {
  console.error('--y-min and --y-max must be given together')
  process.exit(1)
}
const remapY = yMin !== undefined && yMax !== undefined
const padGiven = args.includes('--pad')
const pad = numFlag('--pad') ?? 120
// X respread is the legacy default; once Y flags appear, x only moves on request.
const respreadX = padGiven || !remapY

const file = join(here, '../../src/data/content/overworld', `${region}.json`)
const map = JSON.parse(readFileSync(file, 'utf8')) as {
  width: number
  height: number
  nodes: (PositionedNode & Record<string, unknown>)[]
}

const report: string[] = []

if (respreadX) {
  const before = map.nodes.map((n) => n.position.x)
  map.nodes = respreadNodes(map.nodes, { xMin: pad, xMax: map.width - pad }).map((n) => ({
    ...n,
    position: { x: Math.round(n.position.x), y: n.position.y },
  }))
  report.push(`x [${Math.min(...before)}..${Math.max(...before)}] -> [${pad}..${map.width - pad}]`)
}

if (remapY && yMin !== undefined && yMax !== undefined) {
  const before = map.nodes.map((n) => n.position.y)
  const lo = Math.min(...before)
  const hi = Math.max(...before)
  const range = hi - lo || 1
  map.nodes = map.nodes.map((n) => ({
    ...n,
    position: {
      x: n.position.x,
      y: Math.round(yMin + ((n.position.y - lo) / range) * (yMax - yMin)),
    },
  }))
  report.push(`y [${lo}..${hi}] -> [${yMin}..${yMax}]`)
}

if (height !== undefined) {
  report.push(`height ${map.height} -> ${height}`)
  map.height = height
}

writeFileSync(file, JSON.stringify(map, null, 2) + '\n')
console.log(`respread ${region}: ${report.join(', ')} (${map.nodes.length} nodes)`)
