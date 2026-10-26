/**
 * procgen/battleFloor.ts — the combat grid for a spec (brief §2.1 grid, §4 board terrain).
 *
 * Obstacles and `terrain` come from the spec verbatim (authored for tutorial/boss/sims, none for travel/dungeon —
 * `terrain` is null from every shipped producer and only read when `knobs.terrain === 'on'`, CONTRACT-CHANGES 0017).
 * The cosmetic floor is `generateDirtRegion(w, h, createRng(deriveState(spec.rng, rngLabels.floor(battleId))))`
 * as sorted keys: it derives from the combat stream's SEED by label, so it never consumes a combat roll and a
 * reload (or a replay from any counter) draws the same field. Rules never read `floor` (types.ts#CombatGrid).
 * `boardFloor.ts` / `autotile.ts` are the ported, final pieces; this file only adapts them to the contract.
 */
import type { BattleSpec, CombatGrid, EngineEnv, TileKey } from '../types'
import { createRng } from '../rng'
import { deriveState } from '../rngState'
import { rngLabels } from '../rules'
import { generateDirtRegion } from '../boardFloor'
import { cellKey } from '../autotile'

/**
 * `env` is part of the contract signature for symmetry with every other producer; the grid needs no rule (its
 * numbers are the spec's own width/height), so it is deliberately unread here.
 */
export function battleGrid(spec: Pick<BattleSpec, 'grid' | 'battleId' | 'rng'>, _env: EngineEnv): CombatGrid {
  const { width, height } = spec.grid
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`battleGrid(${spec.battleId}): invalid board ${width}×${height}`)
  }

  // Membership over `cellKey` instead of parsing: the TileKey parser lives only in combat/grid.ts (CONTRACT §2),
  // which procgen may not import (§6 fence). Same "x,y" format as `autotile.cellKey`.
  const onBoard = new Set<TileKey>()
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) onBoard.add(cellKey(x, y))

  // Sorted + deduped so the array round-trips and compares structurally (§7.9); a stray key is an authoring bug
  // and fails loudly here rather than as a unit that can never be reached (§7.20).
  const obstacles = [...new Set(spec.grid.obstacles)].sort()
  for (const key of obstacles) {
    if (!onBoard.has(key)) throw new Error(`battleGrid(${spec.battleId}): obstacle '${key}' is outside the ${width}×${height} board`)
  }

  let terrain: CombatGrid['terrain'] = null
  if (spec.grid.terrain !== null) {
    for (const key of Object.keys(spec.grid.terrain)) {
      if (!onBoard.has(key)) throw new Error(`battleGrid(${spec.battleId}): terrain tile '${key}' is outside the ${width}×${height} board`)
    }
    terrain = { ...spec.grid.terrain }
  }

  const floorRng = createRng(deriveState(spec.rng, rngLabels.floor(spec.battleId)))
  const floor = [...generateDirtRegion(width, height, floorRng)].sort()

  return { width, height, obstacles, floor, terrain }
}
