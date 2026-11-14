/**
 * ui/overworld/sheetArt.ts — where the pixel art sits on the overworld sheet, and the geometry the map screen reads
 * off it. The numbers are `sheetArt.json`, written by tools/pxworld (`src/px-big-b/export_game.py`) from the same
 * render as `public/art/world/heart.png`; nothing here is authored by hand.
 *
 * Only the heartland is drawn (the Borderlands, owner 2026-10-25). A place beyond it has no sprite box, no name box
 * and no drawn road: the map letters it on the unsurveyed dark and joins it with a plain dotted line.
 */
import raw from './sheetArt.json'

export interface Pt { readonly x: number; readonly y: number }
export type Box = readonly [x0: number, y0: number, x1: number, y1: number]

interface SheetArt {
  /** The drawn heartland's rectangle on the sheet. */
  readonly heart: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  /** Where the company stands in Frontier Camp's yard. */
  readonly campStand: readonly [number, number]
  /** `company.png`: its size and the group's foot inside it. */
  readonly company: { readonly w: number; readonly h: number; readonly ax: number; readonly ay: number }
  readonly overview: { readonly w: number; readonly h: number; readonly scale: number; readonly cx: number; readonly cy: number; readonly labels: Readonly<Record<string, readonly [number, number]>>; readonly throne: readonly [number, number] }
  /** Each drawn place's sprite box. */
  readonly feet: Readonly<Record<string, Box>>
  /** Each drawn place's name box: x, y, w, h. Laid out once over the whole heartland, roomy enough for a plate. */
  readonly labels: Readonly<Record<string, readonly [number, number, number, number]>>
  /** Each drawn road as painted, `from|to` -> x0, y0, x1, y1, ... about every 4 px. */
  readonly roads: Readonly<Record<string, readonly number[]>>
  /** The boards where roads leave the heartland. */
  readonly signs: readonly { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly tip: string; readonly region: string; readonly to: string }[]
}

export const art = raw as unknown as SheetArt

const lines = new Map<string, readonly Pt[]>()

/** The road from `from` to `to` as a walkable line: as painted where the art has it, else straight, a point every ~4 px. */
export function roadLine(from: string, to: string, at: (id: string) => Pt | undefined): readonly Pt[] {
  const key = `${from}|${to}`
  const hit = lines.get(key)
  if (hit !== undefined) return hit
  const fwd = art.roads[key]
  const flat = fwd ?? art.roads[`${to}|${from}`]
  const a = at(from)
  const b = at(to)
  let pts: Pt[] = []
  if (flat !== undefined) {
    for (let i = 0; i + 1 < flat.length; i += 2) pts.push({ x: flat[i]!, y: flat[i + 1]! })
    if (fwd === undefined) pts.reverse()
    // a road that leaves the survey is painted only as far as the heartland's edge: the rest of the way is straight
    const first = pts[0]
    const last = pts[pts.length - 1]
    if (a !== undefined && first !== undefined && far(a, first)) pts = [...straight(a, first), ...pts]
    if (b !== undefined && last !== undefined && far(last, b)) pts = [...pts, ...straight(last, b)]
  } else if (a !== undefined && b !== undefined) {
    pts = straight(a, b)
  }
  lines.set(key, pts)
  return pts
}

const far = (p: Pt, q: Pt): boolean => Math.hypot(q.x - p.x, q.y - p.y) > 14

function straight(a: Pt, b: Pt): Pt[] {
  const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 4))
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) out.push({ x: Math.round(a.x + ((b.x - a.x) * i) / n), y: Math.round(a.y + ((b.y - a.y) * i) / n) })
  return out
}

const surveyed = (p: Pt): boolean => p.x >= art.heart.x && p.x < art.heart.x + art.heart.w && p.y >= art.heart.y && p.y < art.heart.y + art.heart.h

/** The stretches of the road from `from` to `to` that no art shows: the map joins them with a dotted line. */
export function roadGaps(from: string, to: string, at: (id: string) => Pt | undefined): readonly (readonly [Pt, Pt])[] {
  const a = at(from)
  const b = at(to)
  if (a === undefined || b === undefined) return []
  const fwd = art.roads[`${from}|${to}`]
  const flat = fwd ?? art.roads[`${to}|${from}`]
  if (flat === undefined || flat.length < 4) return [[a, b]]
  const head: Pt = { x: flat[0]!, y: flat[1]! }
  const tail: Pt = { x: flat[flat.length - 2]!, y: flat[flat.length - 1]! }
  const [nearA, nearB] = fwd !== undefined ? [head, tail] : [tail, head]
  const out: (readonly [Pt, Pt])[] = []
  if (!surveyed(a) && far(a, nearA)) out.push([a, nearA])
  if (!surveyed(b) && far(nearB, b)) out.push([nearB, b])
  return out
}

export const isDrawnRoad = (a: string, b: string): boolean => art.roads[`${a}|${b}`] !== undefined || art.roads[`${b}|${a}`] !== undefined

/** The company's own box round its foot: beads and names keep off it. */
export const companyBox = (p: Pt): Box => [p.x - 22, p.y - 46, p.x + 22, p.y + 6]

export const overlaps = (a: Box, b: Box): boolean => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]

const inBox = (p: Pt, b: Box, pad: number): boolean => p.x >= b[0] - pad && p.x <= b[2] + pad && p.y >= b[1] - pad && p.y <= b[3] + pad

/**
 * Where the company stands at a place: in the yard at the camp; elsewhere on the road it came in by (or the first
 * road the place has), just clear of the place's buildings, so the minis never stand on a roof.
 */
export function standPoint(nodeId: string, cameFrom: string | null, neighbours: readonly string[], at: (id: string) => Pt | undefined, startId: string): Pt {
  if (nodeId === startId) return { x: art.campStand[0], y: art.campStand[1] }
  const here = at(nodeId)
  const via = cameFrom ?? neighbours[0] ?? null
  if (here === undefined) return { x: 0, y: 0 }
  if (via === null) return { x: here.x, y: here.y + 12 }
  const line = roadLine(nodeId, via, at)
  const foot = art.feet[nodeId]
  if (foot === undefined) return line[Math.min(5, line.length - 1)] ?? here
  // just clear of the buildings: the minis never stand on a roof (the place's name moves off them, not they off it)
  for (const p of line) if (!inBox(p, foot, 8)) return p
  return here
}


/** Bead seats along a road, about every 15 px, leaving both ends and any `clear` box open. */
export function beadSeats(line: readonly Pt[], clear: readonly Box[], lead = 13, tail = 9): readonly Pt[] {
  const out: Pt[] = []
  for (let i = lead; i < line.length - tail; i += 4) {
    const p = line[i]!
    if (clear.some((b) => inBox(p, b, 5))) continue
    out.push(p)
  }
  return out
}

/** Sheet px -> overview px. */
export function toOverview(p: Pt): Pt {
  const o = art.overview
  return { x: (p.x - o.cx) / o.scale + o.w / 2, y: (p.y - o.cy) / o.scale + o.h / 2 }
}
