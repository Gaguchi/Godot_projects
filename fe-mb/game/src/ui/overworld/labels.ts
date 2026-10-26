/**
 * ui/overworld/labels.ts — where a place-name is lettered on the sheet.
 *
 * A cartographer does not print every name in the same spot under its mark: they hang the name wherever the sheet
 * is empty. The first build did print them all in the same spot, and on a crowded map that produced twelve
 * measured collisions — names struck through by their own road, names painted over by a neighbour's disc
 * (GATE2-4, GATE3-10). The old `labelNudge` only dodged the viewport edge, which is not the collision that hurt.
 *
 * So: each mark offers a ring of CANDIDATE positions, every one of them is PRICED, and the cheapest wins. A seat
 * pays for what it touches — another mark, a name already placed, a road (its OWN roads included, since those are
 * the ones that run through it), anything the sheet has reserved (the region titles), anything outside the ruled
 * border — and, because a clean seat can still be the wrong seat, it also pays for the paper between the name and
 * the mark it belongs to, and a flat fine if some OTHER mark ends up nearer than its own. The plan is
 * computed in SHEET space, so it does not depend on the camera: the same name sits in the same place at every
 * scroll position, and "zero overlaps" is a property of the sheet rather than of one screenshot.
 *
 * Pure: the width of a name is measured by an injected function, so the browser can hand it a real text metric
 * and a test can hand it a deterministic one.
 */
import { edgePolyline, type Point } from './roadInk'

export interface Rect { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

/** Offset of the label's CENTRE from the mark's centre, in sheet pixels. */
export interface LabelSpot { readonly dx: number; readonly dy: number }

export interface LabelMark {
  readonly id: string
  readonly name: string
  readonly position: Point
}

export interface LabelRoad {
  readonly from: Point
  readonly to: Point
  readonly hash: number
}

export interface LabelPlanInput {
  readonly marks: readonly LabelMark[]
  readonly roads: readonly LabelRoad[]
  /** Anything already lettered on the sheet that a name must not sit on (the region titles). */
  readonly reserved: readonly Rect[]
  readonly sheet: { readonly width: number; readonly height: number }
  /** Rendered width of a name, in sheet pixels. */
  readonly measure: (name: string) => number
}

/** The mark's own footprint: disc 38, seal/invite ring 46, the visited/locked badge out to 21px. */
const MARK_R = 25
/**
 * Where the COMPANY stands when it is at a mark, as an offset box from that mark's centre — `.ow-pawn` is 48×56
 * with `margin-left: -24` / `margin-top: -80`, so the figure occupies the paper directly ABOVE the disc.
 *
 * The planner used to know nothing about it, and hung names over the mark wherever the sheet below was busy: at
 * half the early nodes the company then painted over the very place-name it was standing on — 720px² of it, which
 * is exactly this box's width by a line of type (RE-GATE B 2.5 / C 3.10). The company can stand at ANY mark, so
 * the box is excluded at EVERY mark rather than at the one the party happens to occupy: the plan stays a property
 * of the sheet (the same name in the same place at every camera position and on every day of the run), instead of
 * every name on the map shuffling one hop at a time.
 */
const PAWN = { dx: -24, dy: -80, w: 48, h: 56 } as const

/**
 * The two flat costs of a seat that is not clean, in the order they matter.
 *
 * A road drawn through a name is the defect this module exists for: it is on the sheet on every day of the run,
 * and it makes the name unreadable rather than merely hidden — so it is the dearest thing a seat can cost. The
 * company standing on a name is the same size of sin one day in ten: dear enough to lose to any clean seat and to
 * a name that merely brushes the ruled border, cheap enough to be taken rather than letter a name across a road.
 */
const ROAD_COST = 900
const PAWN_COST = 400
/**
 * The two costs of a seat that is CLEAN and still wrong — the half of the problem that "touches nothing" cannot
 * see. A name is attached to a mark by nothing but the paper between them, so the sheet's crowded corners bought
 * their zero collisions by lettering names a long way out: fifteen of forty-six sat closer to a NEIGHBOUR's disc
 * than to their own, and the north-west corner read as a chain in which every name belonged to the next dot along
 * (FINAL GATE B B.1).
 *
 * `REACH_COST` is the smooth term: every pixel of paper between a name and its mark costs something, so of two
 * clean seats the nearer one wins. On its own it is not enough — the ring is offered row by row rather than by
 * distance, and a seat 140px out along the first row was being taken over a seat 32px out on the second.
 *
 * `MISREAD_COST` is the flat one, and it is the defect stated as a rule: a seat from which some OTHER mark is
 * nearer than this name's own is a seat that names the wrong dot. It is dear enough to outrank most of the ring
 * and deliberately CHEAPER than `PAWN_COST`, so a name never buys proximity by seating itself under the company's
 * own token — that one is absolute.
 */
const REACH_COST = 1
const MISREAD_COST = 300
/** A scout's annotation on a road (`Roads.tsx#ScoutMark`) is the same size of sin as the company's own token: it
 *  is paper the sheet may draw on, one ration at a time, so a name may not be lettered where one can appear. */
const SIGHT_COST = 400

/**
 * The paper a scout mark covers on a road. Like `PAWN`, it is excluded on EVERY road rather than on the roads that
 * happen to be scouted today: a mark appears the moment a ration is spent, and the plan has to be a property of
 * the sheet — names that re-shuffle when the player scouts are worse than names that leave a roundel of room.
 * The roundel is drawn at the mid-point of the inked curve, r 7.6 (`Roads.tsx`), plus this module's `PAD`.
 */
const SIGHT_R = 12
export function sightRect(road: LabelRoad): Rect {
  const line = edgePolyline(road.from, road.to, road.hash, 2)
  const mid = line[1] ?? road.from
  return { x: mid.x - SIGHT_R, y: mid.y - SIGHT_R, w: SIGHT_R * 2, h: SIGHT_R * 2 }
}

/** The paper the company's own token covers when it stands at this mark. */
export function pawnRect(mark: LabelMark): Rect {
  return { x: mark.position.x + PAWN.dx, y: mark.position.y + PAWN.dy, w: PAWN.w, h: PAWN.h }
}
/** Line box of a name at the shipped 11px display size. */
export const LABEL_H = 15
/** Breathing room between a name and anything it must not touch. */
const PAD = 4
/** The paper's own edge — a name may never be lettered off the sheet. */
const SHEET_EDGE = 6
/** The sheet's ruled double border sits at 16px and 22px; a name prefers to stay inside it, but a mark parked
 *  against the border would rather touch the rule than be struck through by a road. */
const SHEET_RULE = 26

/**
 * The ring of places a name may hang, best first: under the mark (the cartographer's default), then over it, then
 * out to either side, then further out in rows. It is GENERATED rather than hand-listed because the company's own
 * token rules out most of the near seats above a mark (see `PAWN`), and a crowded corner of the sheet then needs
 * somewhere further out that is still clean — a short hand-written list simply ran out of paper and the name took
 * its least-bad seat, which is how a name ends up under a figure or across a road.
 *
 * Rows are ordered by how a cartographer reads them: under first, over second, level with the mark next, then
 * outward. Within a row, centred first, then out to each side. That order is only a TIE-BREAK now — the ring is
 * not sorted by distance (a seat 140px out along the first row comes before a seat 32px out on the second), which
 * is why the scoring, not the ordering, is what keeps a name near its mark.
 */
function spotsFor(halfWidth: number): readonly LabelSpot[] {
  const side = MARK_R + PAD + halfWidth
  const rows = [32, -32, 0, 50, -50, 68, -68, 86, -100, 104, -132, 122, -160, 150, -190]
  const columns = (dy: number): readonly number[] =>
    dy === 0 ? [side, -side, side + 26, -(side + 26), side + 52, -(side + 52), side + 84, -(side + 84)]
      : [0, 34, -34, 17 + halfWidth, -(17 + halfWidth), 68, -68, side, -side, 102, -102, 140, -140]
  return rows.flatMap((dy) => columns(dy).map((dx) => ({ dx, dy })))
}

export function labelRect(mark: LabelMark, spot: LabelSpot, width: number): Rect {
  return { x: mark.position.x + spot.dx - width / 2, y: mark.position.y + spot.dy - LABEL_H / 2, w: width, h: LABEL_H }
}

export function markRect(mark: LabelMark): Rect {
  return { x: mark.position.x - MARK_R, y: mark.position.y - MARK_R, w: MARK_R * 2, h: MARK_R * 2 }
}

function overlap(a: Rect, b: Rect, pad = 0): number {
  const w = Math.min(a.x + a.w + pad, b.x + b.w) - Math.max(a.x - pad, b.x)
  const h = Math.min(a.y + a.h + pad, b.y + b.h) - Math.max(a.y - pad, b.y)
  return w <= 0 || h <= 0 ? 0 : w * h
}

/** Cohen–Sutherland outcode test: does the segment p→q touch the rect at all? */
function segmentHits(p: Point, q: Point, r: Rect): boolean {
  const code = (pt: Point): number =>
    (pt.x < r.x ? 1 : 0) | (pt.x > r.x + r.w ? 2 : 0) | (pt.y < r.y ? 4 : 0) | (pt.y > r.y + r.h ? 8 : 0)
  let ax = p.x
  let ay = p.y
  let bx = q.x
  let by = q.y
  let ca = code({ x: ax, y: ay })
  let cb = code({ x: bx, y: by })
  for (let guard = 0; guard < 8; guard++) {
    if ((ca | cb) === 0) return true
    if ((ca & cb) !== 0) return false
    const out = ca !== 0 ? ca : cb
    let nx = 0
    let ny = 0
    if ((out & 8) !== 0) { ny = r.y + r.h; nx = ax + ((bx - ax) * (ny - ay)) / (by - ay) }
    else if ((out & 4) !== 0) { ny = r.y; nx = ax + ((bx - ax) * (ny - ay)) / (by - ay) }
    else if ((out & 2) !== 0) { nx = r.x + r.w; ny = ay + ((by - ay) * (nx - ax)) / (bx - ax) }
    else { nx = r.x; ny = ay + ((by - ay) * (nx - ax)) / (bx - ax) }
    if (out === ca) { ax = nx; ay = ny; ca = code({ x: ax, y: ay }) } else { bx = nx; by = ny; cb = code({ x: bx, y: by }) }
  }
  return false
}

function polylineHits(line: readonly Point[], r: Rect): boolean {
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]
    const b = line[i]
    if (a !== undefined && b !== undefined && segmentHits(a, b, r)) return true
  }
  return false
}

/** Pixels by which the box pokes past an inset margin, summed over the four sides. */
function beyond(r: Rect, sheet: { readonly width: number; readonly height: number }, m: number): number {
  return Math.max(0, m - r.x) + Math.max(0, m - r.y)
    + Math.max(0, r.x + r.w - (sheet.width - m)) + Math.max(0, r.y + r.h - (sheet.height - m))
}

/**
 * One placement per mark. Marks are served in reading order (top, then left, then id) so the plan is stable and
 * reproducible; a mark with nowhere clean to go takes its least-bad candidate rather than vanishing.
 */
export function planLabels(input: LabelPlanInput): ReadonlyMap<string, LabelSpot> {
  const { marks, roads, reserved, sheet, measure } = input
  const order = [...marks].sort((a, b) =>
    a.position.y - b.position.y || a.position.x - b.position.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  // The mark's OWN footprint is not an obstacle for its own name — the name hangs off it by design. Its PAWN box
  // is, and its neighbours' are too: a figure standing at the next mark along erases a name just as thoroughly.
  const markBoxes = marks.map((m) => ({ id: m.id, rect: markRect(m) }))
  const pawnBoxes = marks.map((m) => pawnRect(m))
  const sightBoxes = roads.map((r) => sightRect(r))
  const lines = roads.map((r) => edgePolyline(r.from, r.to, r.hash))
  const placed: Rect[] = []
  const out = new Map<string, LabelSpot>()

  for (const mark of order) {
    const width = Math.max(8, measure(mark.name))
    let best: { spot: LabelSpot; penalty: number } | null = null
    for (const spot of spotsFor(width / 2)) {
      const box = labelRect(mark, spot, width)
      let penalty = beyond(box, sheet, SHEET_EDGE) * 1000 + beyond(box, sheet, SHEET_RULE) * 45
      for (const m of markBoxes) { if (m.id !== mark.id) penalty += overlap(box, m.rect, PAD) * 4 }
      for (const p of pawnBoxes) { if (overlap(box, p) > 0) { penalty += PAWN_COST; break } }
      for (const g of sightBoxes) { if (overlap(box, g) > 0) { penalty += SIGHT_COST; break } }
      for (const p of placed) penalty += overlap(box, p, PAD) * 4
      for (const q of reserved) penalty += overlap(box, q, PAD) * 4
      for (const line of lines) { if (polylineHits(line, box)) { penalty += ROAD_COST; break } }
      const reach = Math.hypot(spot.dx, spot.dy)
      penalty += reach * REACH_COST
      const cx = box.x + box.w / 2
      const cy = box.y + box.h / 2
      for (const m of marks) { if (m.id !== mark.id && Math.hypot(cx - m.position.x, cy - m.position.y) <= reach) { penalty += MISREAD_COST; break } }
      // No early exit on a clean seat any more: "touches nothing" is now the FLOOR of the score, not the whole of
      // it, so every candidate is priced and the cheapest wins. Ties keep ring order, so the plan is still stable.
      if (best === null || penalty < best.penalty) best = { spot, penalty }
    }
    const chosen = best?.spot ?? { dx: 0, dy: 32 }
    out.set(mark.id, chosen)
    placed.push(labelRect(mark, chosen, width))
  }
  return out
}

/** The boxes the plan occupies — the sheet keeps its drawn wilderness out of them. */
export function planRects(marks: readonly LabelMark[], plan: ReadonlyMap<string, LabelSpot>, measure: (name: string) => number): readonly Rect[] {
  return marks.map((m) => labelRect(m, plan.get(m.id) ?? { dx: 0, dy: 32 }, Math.max(8, measure(m.name))))
}
