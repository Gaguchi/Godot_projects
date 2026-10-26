/**
 * ui/stage.ts — the stage constants (brief §2.1; CONTRACT §2 ui). The ONLY home for these numbers: the CSS grid,
 * `ui/combat/geometry.ts` and the Playwright specs all import them; nothing else measures. DOM-free, node-importable.
 */
export const STAGE_W = 1280
export const STAGE_H = 720
/** Top of the play band — clears the herald plaque (centre) and the initiative strip (top-left). */
export const BAND_TOP = 120
/** Top edge of the card-hand command zone; the board must clear it. */
export const HAND_TOP = 560
/** Base tile pitch (unit chrome is tuned here) and the bounds `tileSize` snaps to. */
export const TILE = 48
export const TILE_MIN = 40
export const TILE_MAX = 96
/** The DOM id of the scaled stage element — overlays portal INTO it so they scale with the game. */
export const STAGE_ID = 'game-stage'
