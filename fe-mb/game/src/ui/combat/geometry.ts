/**
 * ui/combat/geometry.ts — board geometry shared by the board AND Playwright (clicks are computed here; nothing else
 * measures). DOM-free.
 *
 * The field is 1x pixel art, so there is ONE pitch: 48 stage px a tile, the size the ground, the dirt tiles and the
 * boulders are drawn at (`tools/pxworld/src/px-combat/export_game.py`). The 14×10 field fills the FIELD box exactly;
 * the 5×5 tutorial board sits in the middle of it at the same pitch, so a unit is the same size in every battle.
 * A board too big for the box would shrink to fit (never run under the windows), and says so once.
 */
import type { BattleField, BattleFieldToken, CombatGrid, GameState, TileKey } from '../../engine/types'

/** The pitch the field's art is drawn at. */
export const PITCH = 48
/** The clear ground between the turn list and the forecast, above the hand: where a board may sit (stage px). */
export const FIELD = { x: 303, y: 18, w: 672, h: 480 } as const

let warnedBig = false

/** 48, unless the board does not fit the field's box at 48: then the largest whole pitch that does. */
export function tileSize(w: number, h: number): number {
  const fit = Math.min(Math.floor(FIELD.w / Math.max(1, w)), Math.floor(FIELD.h / Math.max(1, h)))
  if (fit < PITCH && !warnedBig) {
    warnedBig = true
    console.warn(`ui/combat/geometry: a ${w}x${h} board does not fit the field at ${PITCH}px tiles; it is drawn at ${fit}px and its art is scaled.`)
  }
  return Math.max(2, Math.min(PITCH, fit))
}

/** Top-left of the grid on the stage: centred in the field's box on both axes. */
export function gridOrigin(w: number, h: number): { readonly x: number; readonly y: number } {
  const t = tileSize(w, h)
  return {
    x: FIELD.x + Math.round((FIELD.w - w * t) / 2),
    y: FIELD.y + Math.round((FIELD.h - h * t) / 2),
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

/* ── the read-only field beside the Field Report ────────────────────────────────────────────────────────────
   CONTRACT §2 (WP-UI-COMBAT) promises that the last hit and the death play on the frozen field under the report.
   They never did at first: the report sheet was centred on the same stage as the board and covered it entirely
   (GATE3-12), so the whole read-only field — tokens at their last tiles, the fallen where they fell — was behind
   an opaque page.

   The field is a PLATE on the left of the table and the report sits beside it (board F64Report). The plate is the
   field's own size, so the 14×10 field is shown exactly as it was fought on, moved aside and not shrunk: one art
   pixel is still one stage pixel. The plate box is stage space and lives here because `geometry.ts` is the one
   module that measures; the board keeps its own `left`/`top`, and the transform below moves it into the plate. */
export const PLATE = { x: 28, y: 18, w: FIELD.w, h: FIELD.h } as const

/** How far the whole field (its ground too) moves aside for the report. */
export const PLATE_SHIFT = { x: PLATE.x - FIELD.x, y: PLATE.y - FIELD.y } as const

/** The transform that seats a `w × h` board, drawn at `gridOrigin`, inside `PLATE` — centred, aspect kept, and
 *  never enlarged (a small board stays the size it was fought at). */
export function plateTransform(w: number, h: number): string {
  const t = tileSize(w, h)
  const o = gridOrigin(w, h)
  const scale = Math.min(1, PLATE.w / (w * t), PLATE.h / (h * t))
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
