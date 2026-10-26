/**
 * The cartographer's rule for place-names (`src/ui/overworld/labels.ts`).
 *
 * GATE2-4 measured twelve collisions on the shipped sheet at the default camera — names painted over by a
 * neighbour's disc, names struck through by their own road — and GATE3-10 saw the same thing from the chair. The
 * only test that existed asserted the OLD behaviour (a name near the viewport edge is nudged inward), which is a
 * different problem entirely, so 1107 green tests never saw the real one.
 *
 * The case that would have caught it is the last one here: place every name on the real world map and measure
 * every pair. The obstacle set is the same one the map draws — the other marks, the names already placed, the
 * roads (sampled off the same Bézier the SVG draws, a mark's OWN roads included) and the region titles.
 */
import { describe, expect, it } from 'vitest'
import world from '../../../src/content/data/overworld/world.json'
import regionData from '../../../src/content/data/regions.json'
import { labelRect, markRect, pawnRect, planLabels, type LabelMark, type LabelRoad, type Rect } from '../../../src/ui/overworld/labels'
import { edgePolyline, hashEdge } from '../../../src/ui/overworld/roadInk'

/** Cinzel at 11px, near enough: the algorithm takes the measure as an argument precisely so a test can pin it. */
const measure = (name: string): number => name.length * 6.85 + 2

const SHEET = { width: world.width, height: world.height }

function area(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w <= 0 || h <= 0 ? 0 : w * h
}

/** Deliberately NOT the module's own clipping test — dense sampling, so the check cannot agree by construction. */
function roadCrosses(road: LabelRoad, box: Rect): boolean {
  const line = edgePolyline(road.from, road.to, road.hash, 40)
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]
    const b = line[i]
    if (a === undefined || b === undefined) continue
    for (let t = 0; t <= 1; t += 0.02) {
      const x = a.x + (b.x - a.x) * t
      const y = a.y + (b.y - a.y) * t
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) return true
    }
  }
  return false
}

const plainInput = (marks: readonly LabelMark[], roads: readonly LabelRoad[] = []): Parameters<typeof planLabels>[0] =>
  ({ marks, roads, reserved: [], sheet: { width: 2000, height: 2000 }, measure })

describe('place-name placement', () => {
  it('letters a lone name under its mark — the cartographer\'s default is not thrown away', () => {
    const plan = planLabels(plainInput([{ id: 'a', name: 'Trader\'s Rest', position: { x: 900, y: 900 } }]))
    expect(plan.get('a')).toEqual({ dx: 0, dy: 32 })
  })

  it('moves a name off its own road rather than letting the road strike it through', () => {
    const mark: LabelMark = { id: 'a', name: 'Frontier Camp', position: { x: 900, y: 900 } }
    // a road leaving the mark to the south-east, straight through where the name would default to
    const road: LabelRoad = { from: { x: 900, y: 900 }, to: { x: 1100, y: 1100 }, hash: 0 }
    const plan = planLabels(plainInput([mark], [road]))
    const spot = plan.get('a')!
    expect(spot).not.toEqual({ dx: 0, dy: 32 })
    expect(roadCrosses(road, labelRect(mark, spot, measure(mark.name)))).toBe(false)
  })

  it('two marks too close to share the default spot do not share a name box', () => {
    const marks: readonly LabelMark[] = [
      { id: 'a', name: 'Thornwood Chapel', position: { x: 900, y: 900 } },
      { id: 'b', name: 'Dark Hollow', position: { x: 900, y: 953 } },
    ]
    const plan = planLabels(plainInput(marks))
    const boxes = marks.map((m) => labelRect(m, plan.get(m.id)!, measure(m.name)))
    expect(area(boxes[0]!, boxes[1]!)).toBe(0)
    expect(area(boxes[0]!, markRect(marks[1]!))).toBe(0)
    expect(area(boxes[1]!, markRect(marks[0]!))).toBe(0)
  })

  it('never letters a name off the paper', () => {
    // hard against the sheet's left edge: the name has to hang to the right, not run off the sheet
    const mark: LabelMark = { id: 'a', name: 'Frontier Camp', position: { x: 30, y: 900 } }
    const plan = planLabels(plainInput([mark]))
    const box = labelRect(mark, plan.get('a')!, measure(mark.name))
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.w).toBeLessThanOrEqual(2000)
  })

  /**
   * FINAL GATE B B.1. Zero collisions was bought by lettering names a long way out: the ring is offered ROW by
   * row, not by distance, so a seat 140px out along the first row was taken before a seat 32px out on the second
   * — `if (penalty === 0) break` made any clean seat win outright. Fifteen of forty-six names then sat closer to
   * a NEIGHBOUR's mark than to their own. The scoring, not the ordering, is what keeps a name near its mark.
   */
  it('of two clean seats it takes the NEARER one, even where the ring offers the far one first', () => {
    const mark: LabelMark = { id: 'a', name: 'Iron Mine', position: { x: 900, y: 900 } }
    // A band of reserved paper across the row directly UNDER the mark, wide enough to spoil every column in that
    // row except the two furthest out (dx ±140, 144px from the mark). The row ABOVE is untouched.
    const reserved: readonly Rect[] = [{ x: 800, y: 918, w: 200, h: 30 }]
    const plan = planLabels({ marks: [mark], roads: [], reserved, sheet: { width: 2000, height: 2000 }, measure })
    const spot = plan.get('a')!
    // the far clean seat the old ring handed out first — 144px out, taken because it came earlier in the ring
    expect(spot).not.toEqual({ dx: 140, dy: 32 })
    // the near seats ABOVE the mark are the company's own paper (`PAWN`), so the nearest one left is level with
    // it, ~61px out: a third of the distance, and the same zero penalty.
    expect(Math.hypot(spot.dx, spot.dy)).toBeLessThan(70)
    // …and it is still a CLEAN seat: the reserved band is not touched to get there
    const box = labelRect(mark, spot, measure(mark.name))
    expect(area(box, reserved[0]!)).toBe(0)
  })

  it('is a function of the sheet alone — the same plan whatever order the marks arrive in', () => {
    const marks: readonly LabelMark[] = [
      { id: 'a', name: 'Pine Crossing', position: { x: 900, y: 900 } },
      { id: 'b', name: 'Watchtower Ridge', position: { x: 900, y: 952 } },
      { id: 'c', name: 'Border Fortress', position: { x: 980, y: 926 } },
    ]
    const forward = planLabels(plainInput(marks))
    const backward = planLabels(plainInput([...marks].reverse()))
    for (const m of marks) expect(backward.get(m.id)).toEqual(forward.get(m.id))
  })

  it('places every name on the shipped sheet with nothing touching anything (GATE2-4)', () => {
    const marks: readonly LabelMark[] = world.nodes.map((n) => ({ id: n.id, name: n.name, position: n.position }))
    const at = new Map(marks.map((m) => [m.id, m.position] as const))
    const roads: readonly LabelRoad[] = world.edges.map((e) => ({ from: at.get(e.from)!, to: at.get(e.to)!, hash: hashEdge(e.from, e.to) }))
    // the region titles the sheet letters under each cluster (ui/overworld/Sheet.tsx#regionWashes)
    const reserved: readonly Rect[] = regionData.flatMap((r) => {
      const own = world.nodes.filter((n) => n.regionId === r.id)
      if (own.length === 0) return []
      const xs = own.map((n) => n.position.x)
      const ys = own.map((n) => n.position.y)
      const w = r.name.length * 30 * 0.98
      return [{ x: (Math.min(...xs) + Math.max(...xs)) / 2 - w / 2, y: Math.max(...ys) + 78 - 26, w, h: 34 }]
    })

    const plan = planLabels({ marks, roads, reserved, sheet: SHEET, measure })
    expect(plan.size).toBe(marks.length)
    const boxes = marks.map((m) => ({ m, box: labelRect(m, plan.get(m.id)!, measure(m.name)) }))

    const collisions: string[] = []
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i]!
      for (let j = i + 1; j < boxes.length; j++) {
        if (area(a.box, boxes[j]!.box) > 0) collisions.push(`name x name: ${a.m.name} / ${boxes[j]!.m.name}`)
      }
      for (const m of marks) {
        if (m.id !== a.m.id && area(a.box, markRect(m)) > 0) collisions.push(`name x mark: ${a.m.name} / ${m.name}`)
      }
      for (const r of reserved) {
        if (area(a.box, r) > 0) collisions.push(`name x region title: ${a.m.name}`)
      }
      for (const road of roads) {
        if (roadCrosses(road, a.box)) { collisions.push(`name x road: ${a.m.name}`); break }
      }
      // …and the company standing at the mark the name belongs to: `.ow-pawn` occupies the paper directly above
      // its disc, and the planner used to hang names there, so the marker for WHERE YOU ARE erased the name of
      // where you are — 720px² of it, measured at Riverside Market and Trader's Rest (RE-GATE B 2.5 / C 3.10).
      // This one is absolute: a name may never be seated under its own company token.
      if (area(a.box, pawnRect(a.m)) > 0) collisions.push(`name x own company: ${a.m.name}`)
      expect(a.box.x, a.m.name).toBeGreaterThanOrEqual(0)
      expect(a.box.x + a.box.w, a.m.name).toBeLessThanOrEqual(SHEET.width)
      expect(a.box.y, a.m.name).toBeGreaterThanOrEqual(0)
      expect(a.box.y + a.box.h, a.m.name).toBeLessThanOrEqual(SHEET.height)
    }
    expect(collisions).toEqual([])

    // A NEIGHBOUR's token is the softer half of the same finding, and it cannot always be dodged: a mark parked
    // against the top rule of the sheet has nowhere above it to letter its name, and the gate's own ruling is
    // that a road drawn through a name (permanent, on every day of the run) beats a figure standing on it (one
    // day in ten) — `ROAD_COST` > `PAWN_COST`. The measured four nodes are down to one; this pins that.
    const shadowed = boxes.filter((a) => marks.some((m) => m.id !== a.m.id && area(a.box, pawnRect(m)) > 0)).map((a) => a.m.name)
    expect(shadowed.length, `names a neighbour's company token can cover: ${shadowed.join(', ')}`).toBeLessThanOrEqual(1)

    // …and the half of the problem that "touches nothing" cannot see (FINAL GATE B B.1): a name is attached to a
    // mark by the paper between them and nothing else, so a name nearer some OTHER disc reads as naming that one.
    // Seventeen of the forty-seven did before `REACH_COST` / `MISREAD_COST`; five remain, all of them in corners
    // where the near paper is genuinely spent (Frontier Camp is 60px from the sheet's left rule with four roads
    // leaving it). The ratchet holds the count and the worst ratio, and it is the number the gate measured.
    const attribution = boxes.map((a) => {
      const cx = a.box.x + a.box.w / 2
      const cy = a.box.y + a.box.h / 2
      const own = Math.hypot(cx - a.m.position.x, cy - a.m.position.y)
      let near = Infinity
      let nearName = ''
      for (const m of marks) {
        if (m.id === a.m.id) continue
        const d = Math.hypot(cx - m.position.x, cy - m.position.y)
        if (d < near) { near = d; nearName = m.name }
      }
      return { name: a.m.name, own, near, nearName, ratio: own / near }
    })
    const misread = attribution.filter((r) => r.own >= r.near)
    expect(misread.length, `names nearer a neighbour's mark than their own: ${misread.map((r) => `${r.name} (${Math.round(r.own)} vs ${r.nearName} ${Math.round(r.near)})`).join(', ')}`).toBeLessThanOrEqual(5)
    const worst = attribution.reduce((m, r) => (r.ratio > m.ratio ? r : m), attribution[0]!)
    expect(worst.ratio, `${worst.name} is ${worst.ratio.toFixed(2)}x further from its own mark than from ${worst.nearName}`).toBeLessThanOrEqual(2)
  })
})
