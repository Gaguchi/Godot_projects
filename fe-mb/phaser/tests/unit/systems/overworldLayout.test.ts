import { describe, it, expect } from 'vitest'
import { respreadNodes, samplePolyline, pointAtArcLength } from '../../../src/systems/overworldLayout'

const NODES = [
  { id: 'a', position: { x: 100, y: 400 } },
  { id: 'b', position: { x: 760, y: 180 } },
  { id: 'c', position: { x: 380, y: 540 } },
]

describe('respreadNodes', () => {
  it('stretches x to the target span, preserving order and ids', () => {
    const out = respreadNodes(NODES, { xMin: 100, xMax: 2000 })
    expect(out.map((n) => n.id)).toEqual(['a', 'b', 'c'])
    expect(out[0]!.position.x).toBe(100) // min → xMin
    expect(out[1]!.position.x).toBe(2000) // max → xMax
    expect(out[2]!.position.x).toBeCloseTo(
      100 + ((380 - 100) / (760 - 100)) * (2000 - 100),
      0,
    )
  })

  it('leaves y untouched and never mutates the input', () => {
    const out = respreadNodes(NODES, { xMin: 100, xMax: 2000 })
    expect(out[1]!.position.y).toBe(180)
    expect(NODES[1]!.position.x).toBe(760)
  })

  it('handles a single node and empty input', () => {
    expect(respreadNodes([], { xMin: 0, xMax: 10 })).toEqual([])
    const one = respreadNodes([{ id: 'x', position: { x: 5, y: 5 } }], { xMin: 0, xMax: 10 })
    expect(one[0]!.position.x).toBe(0) // lo===hi → maps to xMin
  })
})

describe('samplePolyline', () => {
  it('samples a quadratic Bézier into segments+1 points hitting both ends', () => {
    const pts = samplePolyline('M 0 0 Q 50 100 100 0', 10)
    expect(pts).toHaveLength(11)
    expect(pts[0]).toEqual({ x: 0, y: 0 })
    expect(pts[10]!.x).toBeCloseTo(100, 5)
    expect(pts[10]!.y).toBeCloseTo(0, 5)
    // the control point bows the midpoint off the straight chord (y should dip)
    expect(pts[5]!.y).toBeGreaterThan(10)
  })

  it('falls back to a 2-point line, and returns [] for garbage', () => {
    expect(samplePolyline('M 0 0 L 10 10')).toEqual([{ x: 0, y: 0 }, { x: 10, y: 10 }])
    expect(samplePolyline('nonsense')).toEqual([])
  })
})

describe('pointAtArcLength', () => {
  it('returns the arc-length midpoint of a straight 3-point line at f=0.5', () => {
    const pts = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }]
    const { p } = pointAtArcLength(pts, 0.5)
    expect(p.x).toBeCloseTo(5, 5)
    expect(p.y).toBeCloseTo(0, 5)
  })

  it('clamps f and reports a tangent angle', () => {
    const pts = [{ x: 0, y: 0 }, { x: 0, y: 10 }]
    expect(pointAtArcLength(pts, -1).p).toEqual({ x: 0, y: 0 })
    expect(pointAtArcLength(pts, 2).p).toEqual({ x: 0, y: 10 })
    expect(pointAtArcLength(pts, 0.5).angle).toBeCloseTo(Math.PI / 2, 5)
  })
})
