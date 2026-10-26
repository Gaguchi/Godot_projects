/**
 * Combat board geometry — single source of truth shared by the Phaser
 * BoardScene (rendering/picking) and the React HUD (card drag-to-target).
 * Pure constants + math; no framework.
 */

/** Base tile pitch. Unit chrome (rings, HP bar, name) is tuned at this size
 *  and scales by `tileSize(w,h) / TILE` for other pitches. */
export const TILE = 48

/** Tile pitch bounds. Min keeps a 14×10 board readable; max stops a 5×5
 *  tutorial board from becoming a wall of four-inch tiles. */
export const TILE_MIN = 40
export const TILE_MAX = 96

/** Stage design size (matches ui/stage.ts — duplicated to stay framework-free). */
const STAGE_W = 1280

/** Top edge of the card-hand command zone; the board must clear it. Also the
 *  self-play drop threshold for card drags. */
export const HAND_TOP_Y = 560

/** Top of the play band — clears the herald plaque (center) and the
 *  initiative strip (top-left corner, ~112px tall incl. its top offset). */
const BAND_TOP = 120
const BAND_H = HAND_TOP_Y - BAND_TOP

/** Horizontal breathing room either side of the widest board, and vertical
 *  breathing room so the frame never touches the plaque or the card hand. */
const BAND_MARGIN_X = 40
const BAND_PAD_Y = 8

/**
 * Tile pitch for a grid: the largest even size in [TILE_MIN, TILE_MAX] that
 * fits the board inside the play band. A 5×5 tutorial board lands at 84px
 * (was a fixed 48 — 240px square, 5% of the stage); the standard 14×10 board
 * lands at 42px so its last row no longer runs 16px under the card hand.
 */
export function tileSize(gridWidth: number, gridHeight: number): number {
  const fitW = Math.floor((STAGE_W - BAND_MARGIN_X * 2) / Math.max(1, gridWidth))
  const fitH = Math.floor((BAND_H - BAND_PAD_Y * 2) / Math.max(1, gridHeight))
  const t = Math.min(TILE_MAX, fitW, fitH)
  return Math.max(TILE_MIN, t - (t % 2))
}

/**
 * Board origin, derived from grid dimensions: the grid centers horizontally
 * on the stage and vertically inside the band between the top chrome and the
 * hand. (Was fixed at 240,120 — a 5×6 tutorial board sat pinned top-left in
 * a black void.)
 */
export function gridOriginX(gridWidth: number, gridHeight: number): number {
  return Math.round((STAGE_W - gridWidth * tileSize(gridWidth, gridHeight)) / 2)
}
export function gridOriginY(gridWidth: number, gridHeight: number): number {
  const t = tileSize(gridWidth, gridHeight)
  return Math.max(BAND_TOP, BAND_TOP + Math.round((BAND_H - gridHeight * t) / 2))
}

/** Stage-space point → board tile id, or null when outside the grid. */
export function tileAtStagePoint(
  stageX: number,
  stageY: number,
  gridWidth: number,
  gridHeight: number,
): string | null {
  const t = tileSize(gridWidth, gridHeight)
  const tx = Math.floor((stageX - gridOriginX(gridWidth, gridHeight)) / t)
  const ty = Math.floor((stageY - gridOriginY(gridWidth, gridHeight)) / t)
  if (tx < 0 || ty < 0 || tx >= gridWidth || ty >= gridHeight) return null
  return `${tx},${ty}`
}

/** Client (viewport) coords → stage coords, honoring the GameStage scale. */
export function clientToStage(clientX: number, clientY: number): { x: number; y: number } | null {
  const el = typeof document !== 'undefined' ? document.getElementById('game-stage') : null
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width === 0) return null
  const scale = rect.width / 1280
  return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale }
}
