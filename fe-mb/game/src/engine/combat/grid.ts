/**
 * combat/grid.ts — geometry over `CombatGrid` (brief §2.1, §2.3, §2.5, §7.3, §7.4).
 * The ONLY module that parses `TileKey`. No LOS anywhere.
 */
import type { CombatGrid, CombatState, CombatUnit, TileKey, UnitId } from '../types'
import { isImmobilized } from './statuses'

/** `"x,y"` — identical to `autotile.cellKey`. */
export function tileKey(x: number, y: number): TileKey {
  return `${x},${y}`
}

export function parseTile(t: TileKey): { readonly x: number; readonly y: number } {
  const comma = t.indexOf(',')
  const x = Number(t.slice(0, comma))
  const y = Number(t.slice(comma + 1))
  if (comma < 0 || !Number.isInteger(x) || !Number.isInteger(y)) throw new Error(`combat/grid: malformed tile key '${t}'`)
  return { x, y }
}

export function manhattan(a: TileKey, b: TileKey): number {
  const p = parseTile(a)
  const q = parseTile(b)
  return Math.abs(p.x - q.x) + Math.abs(p.y - q.y)
}

/** N/E/S/W, unfiltered (callers apply `inBounds`). The fixed order is what makes every BFS below deterministic. */
export function neighbours4(t: TileKey): readonly TileKey[] {
  const { x, y } = parseTile(t)
  return [tileKey(x, y - 1), tileKey(x + 1, y), tileKey(x, y + 1), tileKey(x - 1, y)]
}

export function inBounds(grid: CombatGrid, t: TileKey): boolean {
  const { x, y } = parseTile(t)
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height
}

/** Binary search over the SORTED `grid.obstacles` (default string order — `combat/seed.ts` sorts them that way). */
export function isObstacle(grid: CombatGrid, t: TileKey): boolean {
  let lo = 0
  let hi = grid.obstacles.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const v = grid.obstacles[mid]!
    if (v === t) return true
    if (v < t) lo = mid + 1
    else hi = mid - 1
  }
  return false
}

/**
 * THE liveness test (§7.3, §2.6): alive, not captured, on the board. Corpses and captives have `position`
 * null, so they never block a tile or receive a target — a live unit standing where one fell is targetable.
 */
export function isLiving(u: CombatUnit): boolean {
  return u.hp.current > 0 && !u.captured && u.position !== null
}

/** Tiles of LIVING, uncaptured, on-board units (§7.3: corpses never block). */
export function occupiedTiles(units: Readonly<Record<UnitId, CombatUnit>>, except?: UnitId): ReadonlySet<TileKey> {
  const out = new Set<TileKey>()
  for (const u of Object.values(units)) {
    if (u.id === except || u.position === null || !isLiving(u)) continue
    out.add(u.position)
  }
  return out
}

/** The LIVING, uncaptured unit on `t`, else null. No tile→unit lookup exists without this alive filter. */
export function unitAt(state: CombatState, t: TileKey): CombatUnit | null {
  for (const u of Object.values(state.units)) {
    if (u.position === t && isLiving(u)) return u
  }
  return null
}

/** 4-dir BFS from `origin` up to `steps` moves; value = path excluding the origin. `blocked` ∪ obstacles are walls. */
function bfsPaths(grid: CombatGrid, origin: TileKey, steps: number, blocked: ReadonlySet<TileKey>): Record<TileKey, readonly TileKey[]> {
  const out: Record<TileKey, readonly TileKey[]> = {}
  if (steps <= 0) return out
  const queue: { readonly t: TileKey; readonly path: readonly TileKey[] }[] = [{ t: origin, path: [] }]
  const seen = new Set<TileKey>([origin])
  for (let i = 0; i < queue.length; i++) {
    const { t, path } = queue[i]!
    if (path.length >= steps) continue
    for (const n of neighbours4(t)) {
      if (seen.has(n) || !inBounds(grid, n) || isObstacle(grid, n) || blocked.has(n)) continue
      seen.add(n)
      const next = [...path, n]
      out[n] = next
      queue.push({ t: n, path: next })
    }
  }
  return out
}

/** 4-dir BFS ≤ `mov` (0 when immobilized) through in-bounds, non-obstacle, unoccupied tiles; value = path (excl. origin). */
export function reachable(state: CombatState, unitId: UnitId): Readonly<Record<TileKey, readonly TileKey[]>> {
  const u = state.units[unitId]
  if (u === undefined || u.position === null || !isLiving(u)) return {}
  const mov = isImmobilized(u) ? 0 : u.mov
  return bfsPaths(state.grid, u.position, mov, occupiedTiles(state.units, unitId))
}

/** Shortest 4-dir path of length ≤ mov or null. `blocked` = obstacles ∪ occupied; a blocked destination is unreachable. */
export function findPath(grid: CombatGrid, origin: TileKey, dest: TileKey, mov: number, blocked: ReadonlySet<TileKey>): readonly TileKey[] | null {
  if (origin === dest) return []
  return bfsPaths(grid, origin, mov, blocked)[dest] ?? null
}

/** Flood from `dest` with living units as walls (`allow` = the mover's own tile). AI stepping, §2.5/§7.4 — never axis-greedy. */
export function distanceField(grid: CombatGrid, dest: TileKey, blocked: ReadonlySet<TileKey>, allow: TileKey): Readonly<Record<TileKey, number>> {
  const dist: Record<TileKey, number> = { [dest]: 0 }
  const queue: TileKey[] = [dest]
  for (let i = 0; i < queue.length; i++) {
    const t = queue[i]!
    const d = dist[t]!
    for (const n of neighbours4(t)) {
      if (n in dist || !inBounds(grid, n) || isObstacle(grid, n)) continue
      if (blocked.has(n) && n !== allow) continue
      dist[n] = d + 1
      queue.push(n)
    }
  }
  return dist
}

/** manhattan ∈ [min, max] from origin, in bounds, obstacles excluded, no LOS. Row-major, so callers inherit a stable order. */
export function tilesInRange(grid: CombatGrid, origin: TileKey, min: number, max: number): readonly TileKey[] {
  const o = parseTile(origin)
  const out: TileKey[] = []
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const d = Math.abs(o.x - x) + Math.abs(o.y - y)
      if (d < min || d > max) continue
      const t = tileKey(x, y)
      if (isObstacle(grid, t)) continue
      out.push(t)
    }
  }
  return out
}

/** manhattan ≤ radius around centre, centre included, in bounds. */
export function tilesInAoe(grid: CombatGrid, centre: TileKey, radius: number): readonly TileKey[] {
  const c = parseTile(centre)
  const out: TileKey[] = []
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (Math.abs(c.x - x) + Math.abs(c.y - y) <= radius) out.push(tileKey(x, y))
    }
  }
  return out
}
