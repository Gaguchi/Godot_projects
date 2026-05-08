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
