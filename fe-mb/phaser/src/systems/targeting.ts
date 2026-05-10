import type { Card } from '../domain/card'
import type { TileId } from '../domain/ids'

export interface TargetingState {
  width: number
  height: number
  obstacles: Set<TileId>
}

function tileToXY(t: TileId): [number, number] {
  const [xs, ys] = (t as unknown as string).split(',')
  return [parseInt(xs!, 10), parseInt(ys!, 10)]
}

function xyToTile(x: number, y: number): TileId {
  return (`${x},${y}`) as unknown as TileId
}

export function manhattan(a: TileId, b: TileId): number {
  const [ax, ay] = tileToXY(a)
  const [bx, by] = tileToXY(b)
  return Math.abs(ax - bx) + Math.abs(ay - by)
}

export function tilesInRange(origin: TileId, minR: number, maxR: number, state: TargetingState): TileId[] {
  const [ox, oy] = tileToXY(origin)
  const out: TileId[] = []
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const t = xyToTile(x, y)
      if (state.obstacles.has(t)) continue
      const d = Math.abs(ox - x) + Math.abs(oy - y)
      if (d >= minR && d <= maxR) out.push(t)
    }
  }
  return out
}

export function tilesInAoe(center: TileId, radius: number, state: TargetingState): TileId[] {
  return tilesInRange(center, 0, radius, state)
}

export function validTargets(card: Card, source: TileId, state: TargetingState): TileId[] {
  return tilesInRange(source, card.range.min, card.range.max, state)
}

/**
 * BFS on the grid from `origin` outward, returning all tiles the unit can
 * reach within `maxSteps` (4-directional). Obstacles and `blocked` tiles
 * (typically tiles occupied by other units) are impassable.
 *
 * The origin itself is not included in the result.
 */
export function tilesReachable(
  origin: TileId,
  maxSteps: number,
  state: TargetingState,
  blocked: Set<string>,
): TileId[] {
  if (maxSteps <= 0) return []
  const [ox, oy] = tileToXY(origin)
  const visited = new Map<string, number>()
  const originKey = `${ox},${oy}`
  visited.set(originKey, 0)
  const queue: Array<[number, number, number]> = [[ox, oy, 0]]
  const out: TileId[] = []

  while (queue.length > 0) {
    const [x, y, dist] = queue.shift()!
    if (dist >= maxSteps) continue
    const neighbors: Array<[number, number]> = [
      [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
    ]
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) continue
      const nKey = `${nx},${ny}`
      if (visited.has(nKey)) continue
      const nTile = xyToTile(nx, ny)
      if (state.obstacles.has(nTile)) continue
      if (blocked.has(nKey)) continue
      visited.set(nKey, dist + 1)
      out.push(nTile)
      queue.push([nx, ny, dist + 1])
    }
  }

  return out
}

/**
 * BFS shortest-path from `origin` to `dest` respecting `maxSteps`, terrain
 * obstacles, and unit-blocked tiles. Returns the ordered list of tiles
 * EXCLUDING the origin (so a path of length N is N moves). Returns `null`
 * when destination is unreachable within the step budget.
 *
 * Used by the walk-the-path movement animation — the BoardScene tweens the
 * unit through each returned tile in sequence.
 */
export function findMovePath(
  origin: TileId,
  dest: TileId,
  maxSteps: number,
  state: TargetingState,
  blocked: Set<string>,
): TileId[] | null {
  if (maxSteps <= 0) return null
  if ((origin as unknown as string) === (dest as unknown as string)) return []
  const [ox, oy] = tileToXY(origin)
  const [dx, dy] = tileToXY(dest)
  const originKey = `${ox},${oy}`
  const destKey = `${dx},${dy}`
  const visited = new Map<string, { dist: number; parent: string | null }>()
  visited.set(originKey, { dist: 0, parent: null })
  const queue: Array<[number, number, number]> = [[ox, oy, 0]]

  while (queue.length > 0) {
    const [x, y, dist] = queue.shift()!
    if (dist >= maxSteps) continue
    const neighbors: Array<[number, number]> = [
      [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
    ]
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) continue
      const nKey = `${nx},${ny}`
      if (visited.has(nKey)) continue
      const nTile = xyToTile(nx, ny)
      if (state.obstacles.has(nTile)) continue
      if (blocked.has(nKey) && nKey !== destKey) continue
      visited.set(nKey, { dist: dist + 1, parent: `${x},${y}` })
      if (nKey === destKey) {
        // Trace back
        const path: TileId[] = []
        let cur: string | null = destKey
        while (cur !== null && cur !== originKey) {
          path.push(xyToTile(...cur.split(',').map(Number) as [number, number]))
          cur = visited.get(cur)?.parent ?? null
        }
        return path.reverse()
      }
      queue.push([nx, ny, dist + 1])
    }
  }
  return null
}
