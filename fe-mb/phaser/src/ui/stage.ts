/**
 * Fixed design-resolution constants + the overlay portal target. Kept in a
 * non-component module so GameStage.tsx can stay component-only (Fast Refresh).
 *
 * The whole game is authored at STAGE_W×STAGE_H and uniformly scaled to fit the
 * window (see GameStage.tsx). 1280×720 matches the Phaser game size.
 */
export const STAGE_W = 1280
export const STAGE_H = 720

/** The element id of the scaled stage — also the portal target for overlays. */
export const STAGE_ID = 'game-stage'

/**
 * Portal target for react-aria overlays (Modal/Popover/Tooltip). They portal to
 * document.body by default, which is OUTSIDE the scaled stage — so without this
 * they'd render unscaled and viewport-relative (clipped/misaligned). Pointing
 * them at the stage element makes them scale and clip WITH the game.
 */
export function stagePortalContainer(): Element | undefined {
  if (typeof document === 'undefined') return undefined
  return document.getElementById(STAGE_ID) ?? undefined
}
