import React, { useEffect, useState } from 'react'
import { STAGE_W, STAGE_H, STAGE_ID } from './stage'

function fitScale(): number {
  return Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H)
}

/**
 * Letterboxed, scale-to-fit stage. A full-viewport wrapper (black bars) centers
 * a fixed 1280×720 inner stage that is CSS-`transform`-scaled to fit.
 *
 * Why a transform (not width/height %): a `transform` on the stage makes it the
 * containing block for `position: fixed` descendants, so every modal / HUD /
 * pause button laid out as `fixed` resolves against the STAGE, not the window —
 * they scale and clip with the game instead of floating off-screen.
 *
 * The Phaser canvas lives inside the stage at its native 1280×720 and is scaled
 * by the same transform; after each rescale we refresh Phaser's input bounds
 * (it reads getBoundingClientRect, which includes our transform) so clicks on
 * the board still map to the right tiles.
 */
export function GameStage({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [scale, setScale] = useState<number>(() => fitScale())

  useEffect(() => {
    const onResize = (): void => setScale(fitScale())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // After the transform commits, sync Phaser's cached canvas bounds so pointer
  // input stays aligned with the visually-scaled canvas.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const g = (window as unknown as { __game?: { scale?: { refresh?: () => void } } }).__game
      g?.scale?.refresh?.()
    })
    return () => cancelAnimationFrame(id)
  }, [scale])

  return (
    <div
      id="stage-letterbox"
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#050403',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        id={STAGE_ID}
        style={{
          position: 'relative',
          width: STAGE_W,
          height: STAGE_H,
          flex: '0 0 auto',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          // a faint forged edge so the playfield reads as a framed panel
          boxShadow: '0 0 0 1px rgba(120,98,60,0.25), 0 24px 80px rgba(0,0,0,0.7)',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}
