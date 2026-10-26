/**
 * ui/overworld/roadInk.ts — pure road geometry + the ink vocabulary. Roads are hand-inked cartography, not carved
 * terrain: every edge is a dashed travel-route stroke; hover / planned / active legs are over-drawn as solid
 * "wet ink". Curves are seeded by the edge's id pair so a road meanders the same way every render.
 */
import type { RegionPalette } from './palette'

export type RoadState = 'active' | 'planned' | 'hover' | 'adjacent' | 'distant'

export interface RoadInk {
  readonly body: string
  readonly width: number
  readonly opacity: number
  /** SVG strokeDasharray for the dotted travel-route look; undefined = solid. */
  readonly dash?: string
  /** Darker pooled-ink stroke beneath — makes an over-stroke read freshly drawn. */
  readonly underlay?: string
  /** Marching ember comet over-stroke (the active hop only). */
  readonly comet?: string
}

export function roadStyles(p: RegionPalette): Readonly<Record<RoadState, RoadInk>> {
  return {
    distant: { body: p.ink, width: 2.2, opacity: 0.55, dash: '7 4' },
    adjacent: { body: p.ink, width: 2.5, opacity: 0.9, dash: '7 4' },
    hover: { body: p.ink, width: 2.8, opacity: 1, underlay: p.inkSoft },
    planned: { body: p.accent, width: 3, opacity: 1, underlay: p.ink },
    active: { body: p.accent, width: 3.2, opacity: 1, comet: p.ember },
  }
}

/** Order-insensitive FNV hash of an edge id pair — the curve looks identical whether stored a→b or b→a. */
export function hashEdge(from: string, to: string): number {
  const s = from < to ? `${from}|${to}` : `${to}|${from}`
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h | 0
}

export interface Point { readonly x: number; readonly y: number }

/** The control point of the bowed road — one source of truth for the drawn path and for geometry work. */
export function edgeControl(from: Point, to: Point, hash: number): Point | null {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  if (len < 1) return null
  const nx = -dy / len
  const ny = dx / len
  const sign = (hash & 1) === 0 ? 1 : -1
  const ratio = 0.06 + ((Math.abs(hash >>> 1) % 100) / 100) * 0.1
  const mag = sign * Math.min(38, len * ratio)
  return { x: (from.x + to.x) / 2 + nx * mag, y: (from.y + to.y) / 2 + ny * mag }
}

/** A quadratic Bézier bowed perpendicular by a seeded offset so each road meanders like a worn path. */
export function edgePath(from: Point, to: Point, hash: number): string {
  const c = edgeControl(from, to, hash)
  if (c === null) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
  return `M ${from.x} ${from.y} Q ${c.x} ${c.y} ${to.x} ${to.y}`
}

/**
 * The same curve as a polyline. Label placement has to know where the ink actually runs — a name struck through
 * by its own road is the defect (GATE2-4) — and the road is drawn as a Bézier, not as the straight line between
 * two marks, so sampling the real curve is the only honest answer.
 */
export function edgePolyline(from: Point, to: Point, hash: number, samples = 14): readonly Point[] {
  const c = edgeControl(from, to, hash)
  if (c === null) return [from, to]
  const out: Point[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const m = 1 - t
    out.push({ x: m * m * from.x + 2 * m * t * c.x + t * t * to.x, y: m * m * from.y + 2 * m * t * c.y + t * t * to.y })
  }
  return out
}
