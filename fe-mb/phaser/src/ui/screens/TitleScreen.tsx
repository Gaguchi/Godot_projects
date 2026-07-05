import React from 'react'
import { Button } from '../components'

/**
 * Title screen — first thing the player sees on boot.
 *
 * "Forged & Lit" identity: not a centered login form on a void, but a
 * candle-lit place. A hammered-iron plate carries the engraved title with an
 * amber emissive edge that flickers like firelight; embers drift up from the
 * hearth pool behind it. New Game is the single primary (hearth-lit) action;
 * Load/Quit are demoted to ghosts so the eye lands on the one thing you do here.
 *
 * Buttons remain <Button> wrappers (RAC state machines: hover/press/focus +
 * keyboard activation). All motion is transform/opacity-only and respects
 * prefers-reduced-motion via the --dur tokens / animation overrides in index.css.
 */
export interface TitleScreenProps {
  onNewGame: () => void
  onLoadGame: () => void
  onQuit: () => void
}

/** A few embers rising from the hearth — pure CSS, staggered, cheap. */
function Embers(): React.JSX.Element {
  const embers = [
    { left: '32%', delay: '0s', drift: '14px', size: 3, dur: '6.5s' },
    { left: '44%', delay: '1.8s', drift: '-10px', size: 2, dur: '7.5s' },
    { left: '52%', delay: '3.2s', drift: '8px', size: 2, dur: '6s' },
    { left: '60%', delay: '0.9s', drift: '-16px', size: 3, dur: '8s' },
    { left: '68%', delay: '4.1s', drift: '12px', size: 2, dur: '7s' },
    { left: '38%', delay: '5.0s', drift: '-6px', size: 2, dur: '6.8s' },
  ]
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 motion-reduce:hidden">
      {embers.map((e, i) => (
        <span
          key={i}
          className="absolute bottom-[34%] rounded-full"
          style={{
            left: e.left,
            width: e.size,
            height: e.size,
            background: 'radial-gradient(circle, #f3c46a 0%, #e8a93a 50%, transparent 70%)',
            boxShadow: '0 0 6px rgba(232,169,58,0.8)',
            // @ts-expect-error custom property for the keyframe drift
            '--ember-drift': e.drift,
            animation: `emberRise ${e.dur} linear infinite`,
            animationDelay: e.delay,
          }}
        />
      ))}
    </div>
  )
}

export function TitleScreen({ onNewGame, onLoadGame, onQuit }: TitleScreenProps): React.JSX.Element {
  return (
    <div
      id="title-screen"
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          'linear-gradient(to bottom, #1a1410 0%, #0d0a07 58%, #050403 100%)',
      }}
    >
      {/* hearth pool + faint grain, behind everything */}
      <div aria-hidden className="hearth-glow absolute inset-0" />
      <div aria-hidden className="iron-grain absolute inset-0 opacity-[0.06]" />
      <Embers />

      <div className="relative z-10 flex flex-col items-center px-6">
        {/* Engraved iron title plate with amber emissive edge */}
        <div className="hearth-flicker relative">
          <div
            className="surface-iron relative rounded-md px-10 py-5 sm:px-14 sm:py-6"
            style={{ boxShadow: 'var(--bevel-iron), 0 0 60px rgba(232,169,58,0.28)' }}
          >
            {/* emissive amber edges — firelight catching the forged metal: a
                bright outer rim + a tighter inner bevel-catch + a top specular */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-[2px] rounded-[4px]"
              style={{ boxShadow: 'inset 0 0 0 1px rgba(232,169,58,0.55), inset 0 0 14px rgba(232,169,58,0.18)' }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-3 top-[3px] h-px rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,225,170,0.6), transparent)' }}
            />
            <h1
              className="voice-display select-none text-6xl text-amber-100 sm:text-7xl"
              style={{
                letterSpacing: '0.2em',
                textShadow:
                  '0 1px 0 #000, 0 0 18px rgba(232,169,58,0.45), 0 0 2px rgba(232,169,58,0.6)',
              }}
            >
              FE_MB
            </h1>
          </div>
        </div>

        <div className="mt-5 voice-display text-[0.78rem] uppercase tracking-[0.58em] text-parchment">
          tactical&nbsp;roguelite
        </div>

        {/* Action hierarchy: New Game is the one lit action; the rest recede. */}
        <nav className="mt-14 flex w-72 flex-col items-stretch gap-3">
          <Button
            id="title-new-game"
            variant="primary"
            onPress={onNewGame}
            className="voice-display py-3.5 text-base tracking-[0.18em]"
          >
            New Game
          </Button>
          <Button
            id="title-load-game"
            variant="ghost"
            onPress={onLoadGame}
            className="tracking-[0.14em] text-parchment-dim data-[hovered]:text-amber-100"
          >
            Load Game
          </Button>
          <Button
            id="title-quit"
            variant="ghost"
            onPress={onQuit}
            className="tracking-[0.14em] text-parchment-dim data-[hovered]:text-amber-100"
          >
            Quit
          </Button>
        </nav>
      </div>

      {/* maker's mark, bottom — quiet, in the body voice */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[0.65rem] italic tracking-wide text-stone-700">
        steel remembers
      </div>
    </div>
  )
}
