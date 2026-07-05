/**
 * Deterministic art generators for the Oregon-Trail travel band
 * (split-view spec 2026-06-12). Everything here is a pure function of the
 * region id — no React, no I/O, no randomness (Math.random is banned):
 * positions and shapes derive from an FNV-1a hash of a seed string, mixed
 * per-feature with the same imul integer-hash pattern PaperMap uses.
 * Generators return SVG path data / plain position records; TravelBand owns
 * the actual rendering. All coordinates are band-local (640-wide tile,
 * 264-tall band, mid-silhouette baseline at y≈215).
 *
 * Visual intent per region:
 *  - borderlands: low rolling hill humps on the horizon, sparse lone
 *    round-canopy trees, the odd run of fence posts — settled farmland.
 *  - thornwood: a dense jagged spruce treeline; tall isoceles spikes of
 *    varying height with a slight lean — the forest as a wall.
 *  - ashfall: jagged rock spires and crags with 2-3 ember-glow vents
 *    burning on the flanks — a scorched land.
 *
 * Seamless-loop discipline: every shape is constrained to fit fully inside
 * the [0, 640] tile (the base horizon band spans the full width), so tiling
 * N copies side by side and translating by exactly one tile width loops with
 * no visible seam. The half-tile-offset back row masks the sparse gap that
 * the edge margin leaves at each tile boundary.
 */

export const SILHOUETTE_TILE_W = 640
export const BAND_DESIGN_H = 264
/** Mid-layer silhouettes stand on this band-local y; the ground strip
 *  (y 204→264) overlaps their feet so they read as seated in the terrain. */
export const MID_BASELINE = 215

export interface EmberDot {
  x: number
  y: number
  r: number
}

export interface SilhouetteTile {
  /** Single SVG path `d` (subpaths allowed) for the filled silhouette. */
  d: string
  /** Optional second path drawn at a slightly lighter fill — ashfall alternates
   *  crags between two lightnesses so the spires don't read as one flat mass.
   *  Empty string elsewhere. */
  dAlt: string
  /** Ember-glow vents riding the silhouette (ashfall crags); empty elsewhere. */
  embers: EmberDot[]
}

export interface GroundPropsTile {
  /** Stroked grass-tuft strokes (render with fill="none"). */
  tufts: string
  /** Small filled stone blobs. */
  stones: string
  /** Darker seating arc under each stone (drawn behind/below at lower alpha). */
  stoneBottoms: string
  /** Two wavy wheel-rut stroke paths (q-curves, ±1.5px jitter); render
   *  fill="none" with a varied dash array applied per element by the caller. */
  ruts: [string, string]
  /** Dash arrays for the two ruts (period divides 640 for a seamless loop). */
  rutDashes: [string, string]
}

export interface EmberMote {
  /** Position as a percentage of the band box (CSS left/top). */
  leftPct: number
  topPct: number
  /** Dot diameter in px. */
  size: number
  /** Negative delay so the field is mid-flight on first paint. */
  delaySec: number
  durSec: number
}

/** FNV-1a over a seed string → 32-bit unsigned seed. */
export function hashSeed(seed: string): number {
  let acc = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    acc ^= seed.charCodeAt(i)
    acc = Math.imul(acc, 0x01000193)
  }
  return acc >>> 0
}

/** Deterministic [0,1) from (seed, i, j) — same mixing recipe as PaperMap's h(). */
function h01(seed: number, i: number, j = 0): number {
  let n = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(seed | 0, 2246822519)) >>> 0
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

/** Round to 0.1px so path strings stay short. */
function r1(n: number): string {
  return (Math.round(n * 10) / 10).toString()
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** Closed circle as two arcs (usable as a subpath inside one big `d`). */
function circlePath(cx: number, cy: number, r: number): string {
  return `M${r1(cx - r)} ${r1(cy)} a${r1(r)} ${r1(r)} 0 1 0 ${r1(r * 2)} 0 a${r1(r)} ${r1(r)} 0 1 0 ${r1(-r * 2)} 0 Z`
}

/** Flat horizon band the features stand on — spans the full tile so the
 *  repeat is seamless; descends to the tile bottom where the opaque ground
 *  strip covers it. */
function horizonBand(top: number): string {
  return `M0 ${r1(top)} L${SILHOUETTE_TILE_W} ${r1(top)} L${SILHOUETTE_TILE_W} ${BAND_DESIGN_H} L0 ${BAND_DESIGN_H} Z`
}

/** Borderlands: rolling hill humps + lone round-canopy trees + a fence run. */
function borderlandsTile(seed: number, lift: number): string {
  const base = MID_BASELINE
  const parts: string[] = [horizonBand(base - 2)]

  // overlapping hill humps chained across the tile (quad apex = half the
  // control offset, hence the *2 on the control y)
  let x = 6 + h01(seed, 0) * 24
  let i = 0
  while (x < 590) {
    const w = 110 + h01(seed, i, 1) * 130
    const hh = (9 + h01(seed, i, 2) * 22) * lift
    const x1 = Math.min(SILHOUETTE_TILE_W, x + w)
    const xm = (x + x1) / 2
    parts.push(
      `M${r1(x)} ${base} Q${r1(xm)} ${r1(base - hh * 2)} ${r1(x1)} ${base} L${r1(x1)} ${BAND_DESIGN_H} L${r1(x)} ${BAND_DESIGN_H} Z`,
    )
    x += w * (0.55 + h01(seed, i, 3) * 0.3)
    i++
  }

  // sparse lone trees: thin trunk + a 2-circle canopy blob
  const trees = 2 + Math.floor(h01(seed, 9) * 2)
  for (let t = 0; t < trees; t++) {
    const tx = 40 + h01(seed, t, 11) * 560
    const th = (15 + h01(seed, t, 12) * 10) * lift
    const cr = (8 + h01(seed, t, 13) * 5) * lift
    parts.push(`M${r1(tx - 1.5)} ${base} L${r1(tx - 1)} ${r1(base - th)} L${r1(tx + 1)} ${r1(base - th)} L${r1(tx + 1.5)} ${base} Z`)
    const cy = base - th - cr * 0.8
    parts.push(circlePath(tx, cy, cr))
    parts.push(circlePath(tx + cr * 0.55, cy + cr * 0.3, cr * 0.7))
  }

  // the odd fence: a short run of posts with one rail
  const fx = 60 + h01(seed, 21) * 480
  const posts = 3 + Math.floor(h01(seed, 22) * 3)
  for (let p = 0; p < posts; p++) {
    const px = fx + p * 13
    const ph = (8 + h01(seed, p, 23) * 3) * lift
    parts.push(`M${r1(px)} ${base} L${r1(px)} ${r1(base - ph)} L${r1(px + 2.2)} ${r1(base - ph)} L${r1(px + 2.2)} ${base} Z`)
  }
  const fxEnd = fx + (posts - 1) * 13 + 2.2
  parts.push(`M${r1(fx)} ${r1(base - 5.5)} L${r1(fxEnd)} ${r1(base - 5.5)} L${r1(fxEnd)} ${r1(base - 4)} L${r1(fx)} ${r1(base - 4)} Z`)

  return parts.join(' ')
}

/** Thornwood: dense spruce treeline — 3 silhouette variants, bimodal height,
 *  ±6° lean, ragged notches, and occasional clearings so the eye never reads a
 *  for-loop. Everything is hash-derived so the wall stays deterministic. */
function thornwoodTile(seed: number, lift: number): string {
  const base = MID_BASELINE
  const parts: string[] = [horizonBand(base - 3)]
  let x = 10 + h01(seed, 0) * 12
  let i = 0
  while (x < 624) {
    // clearing: now and then skip a tree and jump the cursor forward → a gap
    // in the treeline. Never on the first few so the tile edge stays covered.
    if (i > 2 && h01(seed, i, 9) < 0.12) {
      x += 24 + h01(seed, i, 10) * 30
      i++
      continue
    }
    const w = 9 + h01(seed, i, 1) * 8
    // bimodal height: ~35% are stunted understory spruce, the rest tall.
    const short = h01(seed, i, 8) < 0.35
    const hgt = (short ? 16 + h01(seed, i, 2) * 16 : 38 + h01(seed, i, 2) * 44) * lift
    // lean in degrees → horizontal apex offset (tan≈deg/57 over the height)
    const leanDeg = (h01(seed, i, 3) - 0.5) * 12 // ±6°
    const lean = (leanDeg / 57) * hgt
    const variant = Math.floor(h01(seed, i, 7) * 3)
    const x0 = clamp(x - w, 0, SILHOUETTE_TILE_W)
    const x1 = clamp(x + w, 0, SILHOUETTE_TILE_W)
    const apexX = clamp(x + lean, 2, 638)
    // a small ragged notch knocked into one shoulder, side chosen by hash
    const notch = (h01(seed, i, 6) - 0.5) * w * 0.5
    if (variant === 0) {
      // narrow 5-point spike with a pinched waist at 55% height
      parts.push(
        `M${r1(x0)} ${base} ` +
          `L${r1(x - w * 0.32 + lean * 0.5)} ${r1(base - hgt * 0.55)} ` +
          `L${r1(apexX)} ${r1(base - hgt)} ` +
          `L${r1(x + w * 0.32 + lean * 0.5 + notch)} ${r1(base - hgt * 0.52)} ` +
          `L${r1(x1)} ${base} Z`,
      )
    } else if (variant === 1) {
      // tiered spruce — two stepped boughs, ragged on the lean side
      parts.push(
        `M${r1(x0)} ${base} ` +
          `L${r1(x - w * 0.6 + lean * 0.3)} ${r1(base - hgt * 0.34)} ` +
          `L${r1(x - w * 0.28 + lean * 0.55)} ${r1(base - hgt * 0.38)} ` +
          `L${r1(x - w * 0.34 + lean * 0.7)} ${r1(base - hgt * 0.68)} ` +
          `L${r1(apexX)} ${r1(base - hgt)} ` +
          `L${r1(x + w * 0.34 + lean * 0.7 + notch)} ${r1(base - hgt * 0.66)} ` +
          `L${r1(x + w * 0.6 + lean * 0.3)} ${r1(base - hgt * 0.32)} ` +
          `L${r1(x1)} ${base} Z`,
      )
    } else {
      // broad fir — wider skirt, single ragged shoulder kink
      parts.push(
        `M${r1(x0)} ${base} ` +
          `L${r1(x - w * 0.5 + lean * 0.4)} ${r1(base - hgt * 0.45)} ` +
          `L${r1(x - w * 0.2 + lean * 0.6 + notch)} ${r1(base - hgt * 0.5)} ` +
          `L${r1(apexX)} ${r1(base - hgt)} ` +
          `L${r1(x + w * 0.46 + lean * 0.4)} ${r1(base - hgt * 0.42)} ` +
          `L${r1(x1)} ${base} Z`,
      )
    }
    x += 12 + h01(seed, i, 4) * 14 // dense packing — canopies overlap
    i++
  }
  return parts.join(' ')
}

/** Ashfall: jagged crag spires with shoulder notches + ember vents. Adjacent
 *  apex heights are forced to differ ≥18px so the ridge never flattens into a
 *  comb, and crags alternate between two fill paths (±6% lightness applied by
 *  the renderer) to break up the silhouette mass. */
function ashfallTile(seed: number, lift: number): SilhouetteTile {
  const base = MID_BASELINE
  const parts: string[] = [horizonBand(base - 3)]
  const partsAlt: string[] = []
  let x = 16 + h01(seed, 0) * 30
  let i = 0
  let prevHgt = -100 // sentinel so the first crag is never rejected
  while (x < 580) {
    const w = 22 + h01(seed, i, 1) * 30
    let hgt = (30 + h01(seed, i, 2) * 62) * lift
    // enforce a ≥18px apex step vs the previous crag: nudge away from it
    if (Math.abs(hgt - prevHgt) < 18) {
      hgt += hgt >= prevHgt ? 18 : -18
      hgt = clamp(hgt, 22 * lift, 96 * lift)
    }
    prevHgt = hgt
    const lean = (h01(seed, i, 3) - 0.5) * 18
    const x0 = clamp(x - w, 0, SILHOUETTE_TILE_W)
    const x1 = clamp(x + w, 0, SILHOUETTE_TILE_W)
    const apex = clamp(x + lean, 4, 636)
    // clamp every flank x so no crag overhangs the tile and clips at the seam
    const crag =
      `M${r1(x0)} ${base} ` +
      `L${r1(clamp(x - w * 0.55, 0, SILHOUETTE_TILE_W))} ${r1(base - hgt * 0.38)} ` +
      `L${r1(clamp(x - w * 0.28 + lean * 0.4, 0, SILHOUETTE_TILE_W))} ${r1(base - hgt * 0.6)} ` +
      `L${r1(apex)} ${r1(base - hgt)} ` +
      `L${r1(clamp(x + w * 0.3 + lean * 0.3, 0, SILHOUETTE_TILE_W))} ${r1(base - hgt * 0.52)} ` +
      `L${r1(clamp(x + w * 0.6, 0, SILHOUETTE_TILE_W))} ${r1(base - hgt * 0.3)} ` +
      `L${r1(x1)} ${base} Z`
    // alternate crags into the lighter path so neighbours read as separate rock
    if (i % 2 === 1) partsAlt.push(crag)
    else parts.push(crag)
    x += w * (1.1 + h01(seed, i, 4) * 0.6)
    i++
  }
  // 2-3 ember vents at fixed hash positions on the crag flanks
  const embers: EmberDot[] = []
  const n = 2 + Math.floor(h01(seed, 77) * 2)
  for (let e = 0; e < n; e++) {
    embers.push({
      x: 60 + h01(seed, e, 78) * 520,
      y: base - (14 + h01(seed, e, 79) * 38) * lift,
      r: 1.4 + h01(seed, e, 80) * 1.1,
    })
  }
  return { d: parts.join(' '), dAlt: partsAlt.join(' '), embers }
}

/**
 * The 640px-wide mid-layer silhouette tile for a region. `row` picks the
 * layout seed AND the height scale: 'front' = full height, 'back' = 0.62×
 * (the depth row rendered at ~0.45 opacity, offset half a tile).
 */
export function silhouetteTile(regionId: string, row: 'front' | 'back'): SilhouetteTile {
  const seed = hashSeed(`${regionId}/band/${row}`)
  const lift = row === 'front' ? 1 : 0.62
  switch (regionId) {
    case 'thornwood':
      return { d: thornwoodTile(seed, lift), dAlt: '', embers: [] }
    case 'ashfall':
      return ashfallTile(seed, lift)
    default:
      return { d: borderlandsTile(seed, lift), dAlt: '', embers: [] }
  }
}

/**
 * Scattered ground props in a 640 tile: grass tufts + stones, placed in the
 * soil bands above (y 210-224) and below (y 248-260) the road track
 * (y 228-244) so nothing sits on the carriageway. Ashfall trades grass for
 * rubble (fewer tufts, more stones).
 */
export function groundPropsTile(regionId: string): GroundPropsTile {
  const seed = hashSeed(`${regionId}/band/props`)
  const tuftCount = regionId === 'ashfall' ? 6 : 14
  const stoneCount = regionId === 'ashfall' ? 12 : 7
  const tufts: string[] = []
  const stones: string[] = []
  const stoneBottoms: string[] = []

  // Tufts: advance a cursor with a hashed step but enforce ≥14px spacing so
  // no two clumps collide; each clump is 2-4 tapered blades of varied height.
  let tx = 10 + h01(seed, 0, 0) * 14
  for (let i = 0; i < tuftCount && tx < 632; i++) {
    const upper = h01(seed, i, 2) < 0.45
    const y = upper ? 210 + h01(seed, i, 3) * 14 : 248 + h01(seed, i, 3) * 12
    const blades = 2 + Math.floor(h01(seed, i, 4) * 3) // 2-4
    const sub: string[] = []
    for (let b = 0; b < blades; b++) {
      const bx = tx + (b - (blades - 1) / 2) * 2.4
      const bh = 4 + h01(seed, i, 30 + b) * 5 // varied blade height
      const curl = (h01(seed, i, 40 + b) - 0.5) * 2.4
      sub.push(`M${r1(bx)} ${r1(y)} q${r1(curl)} ${r1(-bh * 0.6)} ${r1(curl * 0.4)} ${r1(-bh)}`)
    }
    tufts.push(sub.join(' '))
    // ≥14px before the next clump
    tx += 14 + h01(seed, i, 5) * 26
  }

  for (let i = 0; i < stoneCount; i++) {
    const x = 12 + h01(seed, i, 11) * 616
    const upper = h01(seed, i, 12) < 0.5
    const y = upper ? 212 + h01(seed, i, 13) * 12 : 250 + h01(seed, i, 13) * 10
    const rx = 2 + h01(seed, i, 14) * 2.4
    const ry = rx * 0.62
    stones.push(`M${r1(x - rx)} ${r1(y)} a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(rx * 2)} 0 a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(-rx * 2)} 0 Z`)
    // a 1px-darker bottom arc just below the stone so it seats in the soil
    stoneBottoms.push(`M${r1(x - rx)} ${r1(y + 0.6)} a${r1(rx)} ${r1(ry)} 0 0 0 ${r1(rx * 2)} 0`)
  }

  // Two wavy wheel ruts: q-curve chains across 640 with ±1.5px y jitter. Both
  // start AND end on the same baseline y so tiling loops seamlessly; the dash
  // periods divide 640 (16 segments of 40, 20 of 32).
  const rutA = wavyRut(seed, 1, 232, 16)
  const rutB = wavyRut(seed, 2, 239, 20)
  return {
    tufts: tufts.join(' '),
    stones: stones.join(' '),
    stoneBottoms: stoneBottoms.join(' '),
    ruts: [rutA, rutB],
    rutDashes: ['20 14', '18 16'],
  }
}

/** A gently wavy horizontal rut across one 640 tile: `segs` quadratic arcs
 *  with ±1.5px y jitter, pinned to `y` at both ends for seamless tiling. */
function wavyRut(seed: number, salt: number, y: number, segs: number): string {
  const step = SILHOUETTE_TILE_W / segs
  let d = `M0 ${r1(y)}`
  for (let s = 0; s < segs; s++) {
    const x1 = (s + 1) * step
    // last segment lands exactly back on y so the tile edge matches
    const yEnd = s === segs - 1 ? y : y + (h01(seed, s, 50 + salt) - 0.5) * 3
    const cx = s * step + step / 2
    const cy = y + (h01(seed, s, 60 + salt) - 0.5) * 3
    d += ` Q${r1(cx)} ${r1(cy)} ${r1(x1)} ${r1(yEnd)}`
  }
  return d
}

/**
 * Atmosphere ember motes (ashfall): hash-positioned dots that drift up-left
 * and fade on a staggered loop. Negative delays mean the swarm is already
 * mid-flight when the band mounts instead of launching in lockstep.
 */
export function emberMotes(regionId: string, count = 8): EmberMote[] {
  const seed = hashSeed(`${regionId}/band/motes`)
  const out: EmberMote[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      leftPct: 4 + h01(seed, i, 1) * 92,
      topPct: 28 + h01(seed, i, 2) * 58,
      size: 2 + h01(seed, i, 3) * 1.6,
      delaySec: -(h01(seed, i, 4) * 7),
      durSec: 5 + h01(seed, i, 5) * 4,
    })
  }
  return out
}

/**
 * Region-tinted fog texture as an SVG feTurbulence data-URI (same technique
 * as OverworldScene's fog layer). `fogRgb` is the palette's "r, g, b"
 * triplet; it lands in the feColorMatrix constant channels with a 0.4 alpha,
 * so the element using it can stay a cheap repeating background-image.
 */
export function fogTextureUri(fogRgb: string): string {
  const parts = fogRgb.split(',').map((s) => Number(s.trim()) / 255)
  const r = (parts[0] ?? 0.7).toFixed(3)
  const g = (parts[1] ?? 0.6).toFixed(3)
  const b = (parts[2] ?? 0.4).toFixed(3)
  return (
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'>" +
    "<filter id='f'><feTurbulence type='fractalNoise' baseFrequency='0.012 0.02' numOctaves='2' seed='7' stitchTiles='stitch'/>" +
    `<feColorMatrix values='0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 0.4 0'/></filter>` +
    "<rect width='100%' height='100%' filter='url(%23f)'/></svg>"
  )
}
