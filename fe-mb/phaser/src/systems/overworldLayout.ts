/**
 * Pure helpers for the grounded overworld map (no React, no Phaser, no I/O,
 * no Math.random). Two jobs:
 *   1. respreadNodes — stretch hand-authored node x-coords to fill the strip so
 *      the camera genuinely pans left→right (topology is untouched: edges
 *      reference ids, not positions).
 *   2. samplePolyline / pointAtArcLength — let the caravan walk the ACTUAL bowed
 *      road spline at even speed, sampling the curve once per hop instead of
 *      lerping the straight chord (which cuts the corner of the Bézier).
 */

export interface XY {
  x: number
  y: number
}

export interface PositionedNode {
  id: string
  position: XY
}

/**
 * Linearly stretch node x-coords to span [xMin, xMax], preserving relative
 * spacing, ordering, and y. Pure — never mutates the input. Edge topology is
 * unaffected because edges connect ids, not coordinates.
 */
export function respreadNodes<T extends PositionedNode>(
  nodes: readonly T[],
  span: { xMin: number; xMax: number },
): T[] {
  if (nodes.length === 0) return []
  const xs = nodes.map((n) => n.position.x)
  const lo = Math.min(...xs)
  const hi = Math.max(...xs)
  const range = hi - lo || 1
  return nodes.map((n) => ({
    ...n,
    position: {
      x: span.xMin + ((n.position.x - lo) / range) * (span.xMax - span.xMin),
      y: n.position.y,
    },
  }))
}

/**
 * Sample a quadratic-Bézier path string ("M x0 y0 Q cx cy x1 y1") into a
 * polyline of `segments + 1` points. Falls back to a 2-point line for a plain
 * "M x0 y0 L x1 y1". Returns [] if the string matches neither.
 */
export function samplePolyline(path: string, segments = 24): XY[] {
  const q = path.match(
    /M\s*(-?[\d.]+)\s+(-?[\d.]+)\s+Q\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/,
  )
  if (q) {
    const [x0, y0, cx, cy, x1, y1] = q.slice(1).map(Number) as [
      number, number, number, number, number, number,
    ]
    const pts: XY[] = []
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const mt = 1 - t
      pts.push({
        x: mt * mt * x0 + 2 * mt * t * cx + t * t * x1,
        y: mt * mt * y0 + 2 * mt * t * cy + t * t * y1,
      })
    }
    return pts
  }
  const l = path.match(/M\s*(-?[\d.]+)\s+(-?[\d.]+)\s+L\s*(-?[\d.]+)\s+(-?[\d.]+)/)
  if (l) {
    const [x0, y0, x1, y1] = l.slice(1).map(Number) as [number, number, number, number]
    return [{ x: x0, y: y0 }, { x: x1, y: y1 }]
  }
  return []
}

/**
 * Point + heading at fraction f∈[0,1] of a polyline's ARC length (even-speed
 * travel, so the token doesn't accelerate through the curve's straight parts).
 * `angle` is the local tangent in radians (for facing the token).
 */
export function pointAtArcLength(pts: readonly XY[], f: number): { p: XY; angle: number } {
  if (pts.length === 0) return { p: { x: 0, y: 0 }, angle: 0 }
  if (pts.length === 1) return { p: pts[0]!, angle: 0 }
  const segLens: number[] = []
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y)
    segLens.push(d)
    total += d
  }
  if (total === 0) return { p: pts[0]!, angle: 0 }
  let target = Math.max(0, Math.min(1, f)) * total
  for (let i = 0; i < segLens.length; i++) {
    const len = segLens[i]!
    if (target <= len || i === segLens.length - 1) {
      const t = len ? target / len : 0
      const a = pts[i]!
      const b = pts[i + 1]!
      return {
        p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      }
    }
    target -= len
  }
  return { p: pts[pts.length - 1]!, angle: 0 }
}
