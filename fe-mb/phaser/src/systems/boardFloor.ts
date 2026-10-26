/**
 * Cosmetic floor for a combat board: which cells wear dirt over the grass.
 * Pure and deterministic — the same rng yields the same floor, so a battle
 * looks identical on reload. Gameplay never reads this (obstacles live on
 * `CombatGrid`); it exists so the field reads as a PLACE with regions and
 * edges instead of per-tile texture noise.
 *
 * Shape recipe (SLYNYRD "negative space is your friend"): a few seed cells,
 * grown by two cellular-automata passes into blobs, capped so most of the
 * board stays flat grass. Single stray cells are culled — an isolated dirt
 * tile reads as a mistake, not a patch.
 */
import type { RNG } from '../domain/rng'
import { cellKey } from './autotile'

const N8: ReadonlyArray<readonly [number, number]> = [
  [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
]

export function generateDirtRegion(width: number, height: number, rng: RNG): Set<string> {
  const area = width * height
  if (area === 0) return new Set()
  // 1–3 seed patches for a small board, up to ~6 on a 14×10 field.
  const seeds = Math.max(1, Math.min(6, Math.round(area / 24)))
  let cells = new Set<string>()
  for (let i = 0; i < seeds; i++) {
    const sx = rng.nextInt(0, width - 1)
    const sy = rng.nextInt(0, height - 1)
    cells.add(cellKey(sx, sy))
    // each seed drags 2–4 neighbours with it so passes have something to grow
    const arms = rng.nextInt(2, 4)
    for (let a = 0; a < arms; a++) {
      const [dx, dy] = rng.pick(N8)
      const nx = sx + dx, ny = sy + dy
      if (nx >= 0 && ny >= 0 && nx < width && ny < height) cells.add(cellKey(nx, ny))
    }
  }
  // Two smoothing passes: a grass cell with ≥4 dirt neighbours turns, a dirt
  // cell with ≤1 dirt neighbour is culled. Growth is capped at ~35% of the board.
  const cap = Math.floor(area * 0.35)
  for (let pass = 0; pass < 2; pass++) {
    const next = new Set<string>()
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let n = 0
        for (const [dx, dy] of N8) if (cells.has(cellKey(x + dx, y + dy))) n++
        const isDirt = cells.has(cellKey(x, y))
        if (isDirt ? n >= 2 : n >= 4) next.add(cellKey(x, y))
      }
    }
    if (next.size > cap) break
    cells = next
  }
  // Final cull of orphans (cells with no orthogonal dirt neighbour).
  for (const key of [...cells]) {
    const [x, y] = key.split(',').map(Number) as [number, number]
    const orth = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const
    if (!orth.some(([dx, dy]) => cells.has(cellKey(x + dx, y + dy)))) cells.delete(key)
  }
  return cells
}
