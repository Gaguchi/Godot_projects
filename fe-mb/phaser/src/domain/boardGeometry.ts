/**
 * Combat board geometry — single source of truth shared by the Phaser
 * BoardScene (rendering/picking) and the React HUD (card drag-to-target).
 * Pure constants + math; no framework.
 */
export const TILE = 48

/** Stage design size (matches ui/stage.ts — duplicated to stay framework-free). */
const STAGE_W = 1280

/** Top edge of the card-hand command zone; the board must clear it. Also the
 *  self-play drop threshold for card drags. */
export const HAND_TOP_Y = 560

/** Top of the play band — below the herald plaque + initiative strip. */
const BAND_TOP = 96
const BAND_H = HAND_TOP_Y - BAND_TOP

/**
 * Board origin, derived from grid dimensions: the grid centers horizontally
 * on the stage and vertically inside the band between the top chrome and the
 * hand. (Was fixed at 240,120 — a 5×6 tutorial board sat pinned top-left in
 * a black void.)
 */
export function gridOriginX(gridWidth: number): number {
  return Math.round((STAGE_W - gridWidth * TILE) / 2)
}
export function gridOriginY(gridHeight: number): number {
  return Math.max(BAND_TOP, BAND_TOP + Math.round((BAND_H - gridHeight * TILE) / 2))
}

/** Stage-space point → board tile id, or null when outside the grid. */
export function tileAtStagePoint(
  stageX: number,
  stageY: number,
  gridWidth: number,
  gridHeight: number,
): string | null {
  const tx = Math.floor((stageX - gridOriginX(gridWidth)) / TILE)
  const ty = Math.floor((stageY - gridOriginY(gridHeight)) / TILE)
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
