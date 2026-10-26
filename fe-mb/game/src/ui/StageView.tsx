/**
 * ui/StageView.tsx — the fixed 1280×720 stage (named so it never collides with `ui/stage.ts` on a case-insensitive disk), uniformly scaled to the window and letterboxed on ash. Every layout
 * number in the UI is a stage pixel; overlays portal INTO `#game-stage` so they scale with the game. `clientToStage`
 * is the ONE DOM reader (Playwright reaches it through `window.__game`).
 */
import React, { useEffect, useState } from 'react'
import { STAGE_H, STAGE_ID, STAGE_W } from './stage'

function scaleFor(): number {
  return Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H)
}

export function Stage({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  const [scale, setScale] = useState(() => (typeof window === 'undefined' ? 1 : scaleFor()))
  useEffect(() => {
    const onResize = (): void => setScale(scaleFor())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const left = Math.floor((window.innerWidth - STAGE_W * scale) / 2)
  const top = Math.floor((window.innerHeight - STAGE_H * scale) / 2)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--color-ash)', overflow: 'hidden' }}>
      <div
        id={STAGE_ID}
        style={{
          position: 'absolute',
          left,
          top,
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          overflow: 'hidden',
          background: 'var(--color-ash)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** Client (viewport) coordinates → stage coordinates under the current scale. */
export function clientToStage(clientX: number, clientY: number): { readonly x: number; readonly y: number } | null {
  const el = document.getElementById(STAGE_ID)
  if (el === null) return null
  const rect = el.getBoundingClientRect()
  if (rect.width === 0) return null
  const scale = rect.width / STAGE_W
  return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale }
}

/** Portal target for modals/tooltips: the stage element, so they scale and clip with the game. */
export function stagePortalContainer(): Element | undefined {
  return document.getElementById(STAGE_ID) ?? undefined
}
