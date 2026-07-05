import { regionPalette, type RegionPalette } from './palette'

/**
 * Pure road geometry + ink style table for the parchment overworld (split-view
 * spec 2026-06-12). Roads are hand-inked cartography, not carved terrain: every
 * edge gets a dashed travel-route base stroke (the classic dotted map line),
 * and hover/planned/active legs are drawn OVER that base as solid "wet ink"
 * strokes — see OverworldRoads for the two-pass render.
 */

export type RoadState = 'active' | 'planned' | 'hover' | 'adjacent' | 'distant'

/** One ink treatment: a stroke plus optional underlay / comet companions. */
export interface RoadInk {
  /** Stroke color of the ink line. */
  body: string
  width: number
  opacity: number
  /** SVG strokeDasharray for the dotted travel-route look; undefined = solid. */
  dash?: string
  /** Darker pooled-ink stroke drawn beneath — makes an over-stroke read freshly drawn. */
  underlay?: string
  /** Marching comet over-stroke color (the active hop only). */
  comet?: string
}

/**
 * Ink vocabulary per road state, derived from the region palette so a region
 * swap restyles every road in one place:
 *   - distant/adjacent: dashed base ink (faint far away, firm next to you)
 *   - hover: solid ink with a soft inkSoft halo — "the quill hovers here"
 *   - planned: wet-ink overdraw in the route accent over a darker underlay
 *   - active: accent solid + an ember comet marching along the hop
 */
export function roadStyles(palette: RegionPalette): Record<RoadState, RoadInk> {
  return {
    distant: { body: palette.ink, width: 2.2, opacity: 0.62, dash: '7 4' },
    adjacent: { body: palette.ink, width: 2.4, opacity: 0.85, dash: '7 4' },
    hover: { body: palette.ink, width: 2.6, opacity: 1, underlay: palette.inkSoft },
    planned: { body: palette.accent, width: 3, opacity: 1, underlay: palette.ink },
    active: {
      body: palette.accent,
      width: 3.2,
      opacity: 1,
      comet: palette.ember !== '' ? palette.ember : 'var(--color-hearth)',
    },
  }
}

/** Backward-compatible static table (borderlands ink) for palette-less callers. */
export const ROAD: Record<RoadState, RoadInk> = roadStyles(regionPalette('borderlands'))

/**
 * Deterministic hash of an edge id-pair → small int. Order-insensitive so the
 * curve looks identical whether the edge is stored as `a→b` or `b→a`.
 */
export function hashEdgeId(from: string, to: string): number {
  const s = from < to ? `${from}|${to}` : `${to}|${from}`
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h | 0
}

/**
 * Build an SVG path `d` for a road edge between two node centers: a quadratic
 * Bézier bowed perpendicular by a seeded offset so each road meanders like a
 * worn path. Stable across renders (seeded by `hashEdgeId`).
 */
export function edgePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  hash: number,
): string {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  if (len < 1) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
  const nx = -dy / len
  const ny = dx / len
  const sign = (hash & 1) === 0 ? 1 : -1
  const ratio = 0.06 + ((Math.abs(hash >>> 1) % 100) / 100) * 0.1
  const mag = sign * Math.min(38, len * ratio)
  const cx = (from.x + to.x) / 2 + nx * mag
  const cy = (from.y + to.y) / 2 + ny * mag
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`
}

/** Order-insensitive edge key for matching a planned/hover leg to a map edge. */
export function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}
