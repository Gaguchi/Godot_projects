/**
 * 47-case blob autotiler for a terrain painted OVER a base ground (dirt on
 * grass). Pure: a set of painted cells in, a tile key per cell out. The key
 * names match the PNGs under `public/art/terrain/px/` and the map builder's
 * palette (`../phaser/tools/map-builder.html`), so a floor drawn in the builder and one
 * generated at runtime resolve to the same art.
 *
 * Naming: 8 authored pieces cover the common cases (`edge_n` = ground to the
 * north, `outer_nw` = convex corner with ground N+W). Everything else is a
 * generated piece `b<missing orth>_<notched diag>` — e.g. `bN_SE` = ground to
 * the north AND a concave notch to the south-east; `b0_0` never occurs (that
 * is the plain fill tile). `bNESW_0` is a fully isolated cell.
 */

/** `sand` exists only in the map builder's palette today (overworld sheet);
 *  the board ships `dirt` + `grass` PNGs under public/art/terrain/px/. */
export type TerrainKey = 'dirt' | 'grass' | 'sand'

const ORTH: ReadonlyArray<readonly [string, number, number]> = [
  ['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0],
]
const DIAG: ReadonlyArray<readonly [string, number, number, string, string]> = [
  ['NE', 1, -1, 'N', 'E'], ['SE', 1, 1, 'S', 'E'], ['SW', -1, 1, 'S', 'W'], ['NW', -1, -1, 'N', 'W'],
]
/** Authored pieces keyed by the SORTED set of missing orthogonal neighbours
 *  (so E+S and S+E both resolve to the same corner). */
const AUTHORED: Readonly<Record<string, string>> = {
  N: 'edge_s', S: 'edge_n', W: 'edge_e', E: 'edge_w',
  NW: 'outer_se', EN: 'outer_sw', SW: 'outer_ne', ES: 'outer_nw',
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`
}

/**
 * Tile key for painted cell (x,y). Cells outside `painted` are ground. Only
 * call for cells that ARE painted — for a ground cell the answer is "no tile".
 */
export function autotileKey(painted: ReadonlySet<string>, x: number, y: number, terrain: TerrainKey): string {
  const missing: string[] = []
  for (const [d, dx, dy] of ORTH) if (!painted.has(cellKey(x + dx, y + dy))) missing.push(d)
  const notch: string[] = []
  for (const [d, dx, dy, a, b] of DIAG) {
    if (!painted.has(cellKey(x + dx, y + dy)) && !missing.includes(a) && !missing.includes(b)) notch.push(d)
  }
  if (notch.length === 0) {
    if (missing.length === 0) return `px_${terrain}`
    const authored = AUTHORED[[...missing].sort().join('')]
    if (authored) return `px_${terrain}_${authored}`
  }
  const m = missing.length === 0 ? '0' : missing.join('')
  const n = notch.length === 0 ? '0' : notch.join('')
  return `px_${terrain}_b${m}_${n}`
}

/** Every key `autotileKey` can produce for a terrain — the preload manifest. */
export function allTileKeys(terrain: TerrainKey): readonly string[] {
  const keys = new Set<string>([`px_${terrain}`])
  // Enumerate all 256 neighbourhoods on a 3×3 stamp around the centre cell.
  for (let mask = 0; mask < 256; mask++) {
    const painted = new Set<string>([cellKey(0, 0)])
    const around: ReadonlyArray<readonly [number, number]> = [
      [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
    ]
    around.forEach(([dx, dy], i) => { if ((mask >> i) & 1) painted.add(cellKey(dx, dy)) })
    keys.add(autotileKey(painted, 0, 0, terrain))
  }
  return [...keys].sort()
}
