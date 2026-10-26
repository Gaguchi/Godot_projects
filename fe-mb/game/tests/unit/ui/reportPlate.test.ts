/**
 * The read-only field under the Field Report is a PLATE beside the page, not a board behind it.
 *
 * CONTRACT §2 (WP-UI-COMBAT) promises the last hit and the death play on the frozen field under the report — which
 * is why `combat/resolve.ts` freezes `BattleReport.field` and why every corpse keeps a `lastTile`. It never
 * happened: the sheet was centred on the same stage as the board and covered it whole (GATE3-12). `plateTransform`
 * is the geometry that moves it aside; this pins the arithmetic so a future page width cannot quietly re-cover it.
 */
import { describe, expect, it } from 'vitest'
import { PLATE, gridOrigin, plateTransform, tileSize } from '../../../src/ui/combat/geometry'
import { STAGE_H, STAGE_W } from '../../../src/ui/stage'

/** Apply the CSS `translate(...) scale(...)` (with `transform-origin: 0 0`) to the board's own stage box. */
function placed(w: number, h: number): { x: number; y: number; w: number; h: number } {
  const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/.exec(plateTransform(w, h))
  if (m === null) throw new Error(`plateTransform produced an unreadable transform: ${plateTransform(w, h)}`)
  const [dx, dy, scale] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = tileSize(w, h)
  const o = gridOrigin(w, h)
  return { x: o.x + dx, y: o.y + dy, w: w * t * scale, h: h * t * scale }
}

/** The Field Report's sheet, as the stylesheet lays it out: `justify-items: end` with a 34px right pad. */
const SHEET_W = 604
const SHEET_RIGHT_PAD = 34

describe('the report plate', () => {
  for (const [w, h, label] of [[14, 10, 'the 14×10 field'], [5, 5, 'the tutorial board']] as const) {
    it(`${label} lands inside the plate box, whole and centred`, () => {
      const p = placed(w, h)
      expect(p.x).toBeGreaterThanOrEqual(PLATE.x - 0.5)
      expect(p.y).toBeGreaterThanOrEqual(PLATE.y - 0.5)
      expect(p.x + p.w).toBeLessThanOrEqual(PLATE.x + PLATE.w + 0.5)
      expect(p.y + p.h).toBeLessThanOrEqual(PLATE.y + PLATE.h + 0.5)
      // centred in the box on both axes (to within the 1px rounding the transform uses)
      expect(Math.abs((p.x - PLATE.x) - (PLATE.x + PLATE.w - (p.x + p.w)))).toBeLessThanOrEqual(1.5)
      expect(Math.abs((p.y - PLATE.y) - (PLATE.y + PLATE.h - (p.y + p.h)))).toBeLessThanOrEqual(1.5)
      // and the aspect is kept — a squashed board is a lie about where anything stood
      expect((p.w / p.h) / ((w * tileSize(w, h)) / (h * tileSize(w, h)))).toBeCloseTo(1, 3)
    })

    it(`${label} clears the report sheet entirely — the defect was that it did not`, () => {
      const p = placed(w, h)
      const sheetLeft = STAGE_W - SHEET_RIGHT_PAD - SHEET_W
      expect(p.x + p.w).toBeLessThanOrEqual(sheetLeft)
      // sanity: the UNTRANSFORMED board is what used to sit under the sheet
      const t = tileSize(w, h)
      const o = gridOrigin(w, h)
      expect(o.x + w * t).toBeGreaterThan(sheetLeft)
    })
  }

  it('the plate box is on the stage', () => {
    expect(PLATE.x).toBeGreaterThanOrEqual(0)
    expect(PLATE.y).toBeGreaterThanOrEqual(0)
    expect(PLATE.x + PLATE.w).toBeLessThanOrEqual(STAGE_W)
    expect(PLATE.y + PLATE.h).toBeLessThanOrEqual(STAGE_H)
  })
})
