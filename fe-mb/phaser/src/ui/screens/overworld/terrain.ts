/**
 * Pure helpers for the overworld dual-grid terrain renderer: a deterministic biome
 * grid (value-noise fBm) + the 4-corner dual-grid config lookup. No React, no I/O,
 * no Math.random — the grid is fully determined by the map id.
 */
export const BIOMES = ['water', 'grass', 'dirt', 'stone'] as const
export type Biome = (typeof BIOMES)[number]
// precedence low -> high (drawn last = feathers on top of the earlier ones)
export const BIOME_ORDER: readonly Biome[] = ['water', 'dirt', 'stone', 'grass']

function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const tl = hash2(xi, yi, seed), tr = hash2(xi + 1, yi, seed)
  const bl = hash2(xi, yi + 1, seed), br = hash2(xi + 1, yi + 1, seed)
  return (tl * (1 - u) + tr * u) * (1 - v) + (bl * (1 - u) + br * u) * v
}
function fbm(x: number, y: number, seed: number): number {
  let val = 0, amp = 0.5, freq = 1
  for (let i = 0; i < 4; i++) { val += amp * valueNoise(x * freq, y * freq, seed + i * 1013); freq *= 2; amp *= 0.5 }
  return val
}
export function seedFromId(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
/** Deterministic biome per cell: mostly grass/dirt with water pools + stone ridges. */
export function biomeGrid(cols: number, rows: number, seed: number): Biome[][] {
  const SCALE = 0.16
  const grid: Biome[][] = []
  for (let r = 0; r < rows; r++) {
    const row: Biome[] = []
    for (let c = 0; c < cols; c++) {
      const e = fbm(c * SCALE, r * SCALE, seed)
      row.push(e < 0.30 ? 'water' : e < 0.56 ? 'grass' : e < 0.84 ? 'dirt' : 'stone')
    }
    grid.push(row)
  }
  return grid
}
// flowers was dropped — too thin/low-contrast a subject for RemBG (it ghosts).
export const DECORATIONS = ['pine', 'tree', 'bush', 'rock'] as const
export type DecoKind = (typeof DECORATIONS)[number]
export interface Decoration { x: number; y: number; kind: DecoKind; scale: number }

/**
 * Deterministic decoration scatter, in CELL coordinates (x,y are fractional cell
 * positions). Biome drives which props appear and how dense — leafy trees + flowers
 * on grass, sparse bushes/rocks on dirt, mossy rocks on stone, nothing on water.
 * Fully determined by the seed, returned in painter order (low y first).
 */
export function decorationScatter(grid: Biome[][], rows: number, cols: number, seed: number): Decoration[] {
  const out: Decoration[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const b = grid[r]![c]!
    if (b === 'water') continue
    const roll = hash2(c, r, seed ^ 0x9e3779b9)
    const density = b === 'grass' ? 0.13 : b === 'dirt' ? 0.06 : 0.10 // stone slightly rocky
    if (roll > density) continue
    const pick = hash2(c, r, seed ^ 0x85ebca6b)
    let kind: DecoKind
    if (b === 'stone') kind = pick < 0.82 ? 'rock' : 'bush'
    else if (b === 'dirt') kind = pick < 0.5 ? 'bush' : pick < 0.82 ? 'rock' : 'pine'
    else kind = pick < 0.42 ? 'pine' : pick < 0.72 ? 'tree' : 'bush' // grass
    const jx = hash2(c, r, seed ^ 0xc2b2ae35)
    const jy = hash2(c, r, seed ^ 0x27d4eb2f)
    const scale = 0.72 + 0.5 * hash2(c, r, seed ^ 0x165667b1)
    out.push({ x: c + 0.18 + 0.64 * jx, y: r + 0.18 + 0.64 * jy, kind, scale })
  }
  out.sort((a, b) => a.y - b.y)
  return out
}

/** 4-corner dual-grid mask (TL=1,TR=2,BL=4,BR=8) for biome B at display cell (dr,dc). */
export function dualConfig(grid: Biome[][], rows: number, cols: number, dr: number, dc: number, B: Biome): number {
  const at = (r: number, c: number): Biome | null => (r >= 0 && r < rows && c >= 0 && c < cols ? grid[r]![c]! : null)
  return (at(dr - 1, dc - 1) === B ? 1 : 0) | (at(dr - 1, dc) === B ? 2 : 0)
    | (at(dr, dc - 1) === B ? 4 : 0) | (at(dr, dc) === B ? 8 : 0)
}
