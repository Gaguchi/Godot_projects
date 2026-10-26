/**
 * tests/unit/ui/geometry.test.ts — the board geometry is the ONE measurer (ARCHITECTURE §7): the CSS grid, the
 * tokens, the floats and the Playwright clicks all read it, so its arithmetic is pinned here rather than in a
 * screenshot. The fit must WIN over the TILE_MIN floor — a floored pitch silently ran a tall board under the hand.
 */
import { describe, expect, it } from 'vitest'
import { BAND_TOP, HAND_TOP, STAGE_W, TILE_MAX } from '../../../src/ui/stage'
import { gridOrigin, initiativeVisible, parseTile, tileAtStagePoint, tileCentre, tileRect, tileSize } from '../../../src/ui/combat/geometry'

describe('tileSize', () => {
  it('gives the tutorial board 84px tiles and the field board 42px', () => {
    expect(tileSize(5, 5)).toBe(84)
    expect(tileSize(14, 10)).toBe(42)
  })

  it('is always even and never above TILE_MAX', () => {
    for (let w = 3; w <= 20; w++) {
      for (let h = 3; h <= 20; h++) {
        const t = tileSize(w, h)
        expect(t % 2).toBe(0)
        expect(t).toBeLessThanOrEqual(TILE_MAX)
      }
    }
  })

  it('shrinks a tall board instead of running it under the hand', () => {
    // The regression: `Math.max(TILE_MIN, …)` overrode the fit, so 11+ rows overflowed the play band.
    for (const [w, h] of [[14, 11], [14, 12], [14, 14], [20, 20]] as const) {
      const bottom = gridOrigin(w, h).y + h * tileSize(w, h)
      expect(bottom).toBeLessThanOrEqual(HAND_TOP)
    }
  })
})

describe('gridOrigin', () => {
  it('centres the board horizontally and inside the play band', () => {
    const o = gridOrigin(14, 10)
    expect(o.x).toBe(Math.round((STAGE_W - 14 * 42) / 2))
    expect(o.y).toBeGreaterThanOrEqual(BAND_TOP)
    expect(o.y + 10 * 42).toBeLessThanOrEqual(HAND_TOP)
  })
})

describe('tileRect / tileCentre / tileAtStagePoint', () => {
  it('round-trips every tile of the field board', () => {
    for (let x = 0; x < 14; x++) {
      for (let y = 0; y < 10; y++) {
        const tile = `${x},${y}`
        const c = tileCentre(14, 10, tile)
        expect(tileAtStagePoint(c.x, c.y, 14, 10)).toBe(tile)
      }
    }
  })

  it('places a tile at origin + index × pitch', () => {
    const o = gridOrigin(14, 10)
    const r = tileRect(14, 10, '5,3')
    expect(r).toEqual({ x: o.x + 5 * 42, y: o.y + 3 * 42, size: 42 })
    expect(parseTile('5,3')).toEqual({ x: 5, y: 3 })
  })

  it('returns null off the board', () => {
    const o = gridOrigin(14, 10)
    expect(tileAtStagePoint(o.x - 1, o.y + 1, 14, 10)).toBeNull()
    expect(tileAtStagePoint(o.x + 1, o.y - 1, 14, 10)).toBeNull()
    expect(tileAtStagePoint(o.x + 14 * 42 + 1, o.y + 1, 14, 10)).toBeNull()
    expect(tileAtStagePoint(o.x + 1, o.y + 10 * 42 + 1, 14, 10)).toBeNull()
  })
})

describe('initiativeVisible', () => {
  it('fits the strip beside the centred herald plaque, never under it', () => {
    const slots = initiativeVisible()
    const stripRight = 12 + 12 * 2 + slots * 44 + (slots - 1) * 8
    const plaqueLeft = (STAGE_W - 440) / 2
    expect(slots).toBeGreaterThan(0)
    expect(stripRight).toBeLessThanOrEqual(plaqueLeft)
  })

  it('gives back fewer slots when the plaque grows', () => {
    expect(initiativeVisible(700)).toBeLessThan(initiativeVisible(440))
  })
})
