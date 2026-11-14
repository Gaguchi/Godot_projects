/**
 * tests/unit/ui/geometry.test.ts — the board geometry is the ONE measurer (ARCHITECTURE §7): the board, the tokens,
 * the floats and the Playwright clicks all read it, so its arithmetic is pinned here rather than in a screenshot.
 *
 * The field is 1x pixel art, so every battle is drawn at ONE pitch (48): a unit is the same size on the 5×5
 * tutorial board as on the 14×10 field. A board too big for the field's box shrinks to fit rather than running
 * under the windows round it.
 */
import { describe, expect, it } from 'vitest'
import { FIELD, PITCH, gridOrigin, parseTile, tileAtStagePoint, tileCentre, tileRect, tileSize } from '../../../src/ui/combat/geometry'

describe('tileSize', () => {
  it('draws the tutorial board and the field at the one pitch the art is drawn at', () => {
    expect(PITCH).toBe(48)
    expect(tileSize(5, 5)).toBe(48)
    expect(tileSize(14, 10)).toBe(48)
  })

  it('never exceeds the pitch, whatever the board', () => {
    for (let w = 3; w <= 20; w++) {
      for (let h = 3; h <= 20; h++) expect(tileSize(w, h)).toBeLessThanOrEqual(PITCH)
    }
  })

  it('shrinks a board that is too big instead of running it under the windows', () => {
    // The regression this guards: a floored pitch silently ran 11+ rows under the hand.
    for (const [w, h] of [[14, 11], [14, 12], [15, 10], [20, 20]] as const) {
      const t = tileSize(w, h)
      const o = gridOrigin(w, h)
      expect(t).toBeLessThan(PITCH)
      expect(o.x).toBeGreaterThanOrEqual(FIELD.x)
      expect(o.y).toBeGreaterThanOrEqual(FIELD.y)
      expect(o.x + w * t).toBeLessThanOrEqual(FIELD.x + FIELD.w)
      expect(o.y + h * t).toBeLessThanOrEqual(FIELD.y + FIELD.h)
    }
  })
})

describe('gridOrigin', () => {
  it('fills the field box with the 14×10 field, exactly', () => {
    expect(gridOrigin(14, 10)).toEqual({ x: FIELD.x, y: FIELD.y })
    expect(14 * tileSize(14, 10)).toBe(FIELD.w)
    expect(10 * tileSize(14, 10)).toBe(FIELD.h)
  })

  it('centres a smaller board in the field box', () => {
    const o = gridOrigin(5, 5)
    expect(o.x - FIELD.x).toBe(FIELD.x + FIELD.w - (o.x + 5 * 48))
    expect(o.y - FIELD.y).toBe(FIELD.y + FIELD.h - (o.y + 5 * 48))
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
    expect(r).toEqual({ x: o.x + 5 * 48, y: o.y + 3 * 48, size: 48 })
    expect(parseTile('5,3')).toEqual({ x: 5, y: 3 })
  })

  it('returns null off the board', () => {
    const o = gridOrigin(14, 10)
    expect(tileAtStagePoint(o.x - 1, o.y + 1, 14, 10)).toBeNull()
    expect(tileAtStagePoint(o.x + 1, o.y - 1, 14, 10)).toBeNull()
    expect(tileAtStagePoint(o.x + 14 * 48 + 1, o.y + 1, 14, 10)).toBeNull()
    expect(tileAtStagePoint(o.x + 1, o.y + 10 * 48 + 1, 14, 10)).toBeNull()
  })
})
