/**
 * Combat board geometry — single source of truth shared by the Phaser
 * BoardScene (rendering/picking) and the React HUD (card drag-to-target).
 * Pure constants + math; no framework.
 */
export const TILE = 48
export const GRID_OFFSET_X = 240
export const GRID_OFFSET_Y = 120

/** Stage-space point → board tile id, or null when outside the grid. */
export function tileAtStagePoint(
  stageX: number,
  stageY: number,
  gridWidth: number,
  gridHeight: number,
): string | null {
  const tx = Math.floor((stageX - GRID_OFFSET_X) / TILE)
  const ty = Math.floor((stageY - GRID_OFFSET_Y) / TILE)
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
