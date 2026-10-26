/**
 * ui/combat/geometry.ts — board geometry shared by the CSS grid AND Playwright (clicks are computed here; nothing
 * else measures). DOM-free. A 5×5 tutorial board gets 84px tiles, the 14×10 field 42px: the largest even pitch in
 * [TILE_MIN, TILE_MAX] that fits the play band (brief §2.1).
 */
import type { BattleField, BattleFieldToken, CombatGrid, GameState, TileKey } from '../../engine/types'
import { BAND_TOP, HAND_TOP, STAGE_W, TILE_MAX, TILE_MIN } from '../stage'

const BAND_H = HAND_TOP - BAND_TOP
const BAND_MARGIN_X = 40
const BAND_PAD_Y = 8

let warnedTiny = false

/**
 * The largest EVEN pitch that fits the play band, capped at `TILE_MAX`. The fit wins: a board too tall for the band
 * shrinks rather than overflowing under the hand (a `Math.max(TILE_MIN, …)` floor here silently pushed 11+ rows over
 * `HAND_TOP`). `TILE_MIN` survives as an assertion — an authored board that small is a content bug, not a layout one.
 */
export function tileSize(w: number, h: number): number {
  const fitW = Math.floor((STAGE_W - BAND_MARGIN_X * 2) / Math.max(1, w))
  const fitH = Math.floor((BAND_H - BAND_PAD_Y * 2) / Math.max(1, h))
  const t = Math.min(TILE_MAX, fitW, fitH)
  const even = Math.max(2, t - (t % 2))
  if (even < TILE_MIN && !warnedTiny) {
    warnedTiny = true
    console.warn(`ui/combat/geometry: a ${w}x${h} board only fits ${even}px tiles (TILE_MIN is ${TILE_MIN}) — the board is too big for the play band.`)
  }
  return even
}

/* ── the initiative strip's fit beside the herald plaque (both are absolutely placed in combat.css) ── */
/** `.strip` inset from the stage edge, its own padding, one entry and the gap between two (combat.css). */
export const STRIP_INSET = 12
const STRIP_PAD_X = 12
const STRIP_ENTRY_W = 44
const STRIP_GAP = 8
/** `.plaque` min-width; it is centred, so this is the widest strip that still clears it. */
export const PLAQUE_MIN_W = 440

/**
 * How many initiative faces fit to the LEFT of the centred herald plaque. Hard-coding 8 ran the strip under the
 * plaque at 8+ units (party 3 + a five-strong pack), hiding the last portrait entirely.
 */
export function initiativeVisible(plaqueWidth: number = PLAQUE_MIN_W): number {
  const plaqueLeft = (STAGE_W - plaqueWidth) / 2
  const room = plaqueLeft - STRIP_INSET * 2 - STRIP_PAD_X * 2 + STRIP_GAP
  return Math.max(1, Math.floor(room / (STRIP_ENTRY_W + STRIP_GAP)))
}

/** Top-left of the grid on the stage: centred horizontally, centred in the band vertically. */
export function gridOrigin(w: number, h: number): { readonly x: number; readonly y: number } {
  const t = tileSize(w, h)
  return {
    x: Math.round((STAGE_W - w * t) / 2),
    y: Math.max(BAND_TOP, BAND_TOP + Math.round((BAND_H - h * t) / 2)),
  }
}

export function parseTile(tile: TileKey): { readonly x: number; readonly y: number } {
  const [xs, ys] = tile.split(',')
  return { x: Number(xs), y: Number(ys) }
}

/** Stage-space rectangle of a tile (top-left + pitch). */
export function tileRect(w: number, h: number, tile: TileKey): { readonly x: number; readonly y: number; readonly size: number } {
  const size = tileSize(w, h)
  const o = gridOrigin(w, h)
  const { x, y } = parseTile(tile)
  return { x: o.x + x * size, y: o.y + y * size, size }
}

/** Stage-space centre of a tile — where a token sits and where a Playwright click lands. */
export function tileCentre(w: number, h: number, tile: TileKey): { readonly x: number; readonly y: number } {
  const r = tileRect(w, h, tile)
  return { x: r.x + r.size / 2, y: r.y + r.size / 2 }
}

/* ── the read-only field under the Field Report ─────────────────────────────────────────────────────────────
   CONTRACT §2 (WP-UI-COMBAT) promises that the last hit and the death play on the frozen field under the report.
   They never did: the report sheet was centred on the same 1280×720 stage as the board and covered it entirely
   (GATE3-12 measured the card at 320-960 × 100-620 over a board at 346-934 × 130-550), so the whole read-only
   field — tokens at their last tiles, the corpses where they fell — was behind an opaque page.

   The field becomes a PLATE on the left of the table and the page sits beside it. The plate box is stage space and
   lives here because `geometry.ts` is the one module that measures; the board keeps its own `left`/`top`, and the
   transform below moves and scales it into the plate. Board art scales cleanly (it is already `image-rendering:
   pixelated` at an arbitrary pitch), and nothing on the report screen is clickable, so no hit target moves. */
export const PLATE = { x: 36, y: 156, w: 484, h: 360 } as const

/** The transform that seats a `w × h` board, drawn at `gridOrigin`, inside `PLATE` — centred, aspect kept. */
export function plateTransform(w: number, h: number): string {
  const t = tileSize(w, h)
  const o = gridOrigin(w, h)
  const scale = Math.min(PLATE.w / (w * t), PLATE.h / (h * t))
  const dx = PLATE.x + (PLATE.w - w * t * scale) / 2 - o.x
  const dy = PLATE.y + (PLATE.h - h * t * scale) / 2 - o.y
  return `translate(${Math.round(dx)}px, ${Math.round(dy)}px) scale(${scale.toFixed(4)})`
}

export function tileAtStagePoint(x: number, y: number, w: number, h: number): TileKey | null {
  const size = tileSize(w, h)
  const o = gridOrigin(w, h)
  const tx = Math.floor((x - o.x) / size)
  const ty = Math.floor((y - o.y) / size)
  if (tx < 0 || ty < 0 || tx >= w || ty >= h) return null
  return `${tx},${ty}`
}

/** What the Board draws: the live battle on the combat screen, the frozen field under the Field Report. */
export interface BoardView {
  readonly source: 'combat' | 'report'
  readonly grid: CombatGrid
  readonly tokens: readonly BattleFieldToken[]
  readonly activeUnitId: string | null
}

export function boardView(state: GameState): BoardView | null {
  const combat = state.combat
  if (state.screen.kind === 'combat' && combat !== null) {
    return {
      source: 'combat',
      grid: combat.grid,
      activeUnitId: combat.phase === 'combat' ? combat.turn.unitId : null,
      tokens: Object.values(combat.units).flatMap((u) => {
        const tile = u.position ?? u.lastTile
        if (tile === null) return []
        return [{ unitId: u.id, name: u.name, classId: u.classId, team: u.team, tile, hp: u.hp, armor: u.armor, fallen: u.hp.current <= 0 && !u.captured, captured: u.captured }]
      }),
    }
  }
  const field: BattleField | null = state.screen.kind === 'battleEnd' ? state.run?.lastBattle?.field ?? null : null
  if (field === null) return null
  return { source: 'report', grid: field.grid, tokens: field.tokens, activeUnitId: null }
}
