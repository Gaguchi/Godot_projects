import React, { useState } from 'react'
import { Focusable } from 'react-aria-components'
import { Button, Tooltip } from '../components'
import { GAME_TITLE, GAME_TAGLINE } from '../strings'
import { listSlots, isSlotEmpty } from '../../persistence/saveSlots'

/**
 * Title screen — first thing the player sees on boot.
 *
 * "Forged & Lit" identity: not a centered login form on a void, but a
 * candle-lit place. A hammered-iron plate carries the engraved title with an
 * amber emissive edge that flickers like firelight; embers drift up from the
 * hearth pool behind it. New Game is the single primary (hearth-lit) action;
 * Load/Quit are demoted to ghosts so the eye lands on the one thing you do here.
 * All three share ONE voice: display caps with tracking — hierarchy comes from
 * the hearth light, not from switching typefaces mid-menu.
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
            background:
              'radial-gradient(circle, color-mix(in oklab, var(--color-parchment) 35%, var(--color-hearth)) 0%, var(--color-hearth) 50%, transparent 70%)',
            boxShadow: '0 0 6px color-mix(in oklab, var(--color-hearth) 80%, transparent)',
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
  // Does any chronicle exist? Read once on mount — the title screen remounts
  // whenever the player returns to it, so this stays fresh.
  const [hasSave] = useState(() => listSlots().some((s) => !isSlotEmpty(s)))
  // Disabled buttons swallow pointer events, so RAC's own hover detection
  // never fires — drive the disabled-reason tooltip from the wrapper's hover.
  const [showLoadHint, setShowLoadHint] = useState(false)

  const loadButton = (
    <Button
      id="title-load-game"
      variant="ghost"
      isDisabled={!hasSave}
      onPress={onLoadGame}
      // Disabled native buttons swallow pointer events, which would keep the
      // wrapping Tooltip Focusable from ever seeing hover — let them pass through.
      className="voice-display w-full text-sm tracking-[0.18em] data-[disabled]:pointer-events-none"
    >
      Load Game
    </Button>
  )

  return (
    <div
      id="title-screen"
      className="relative flex h-full w-full select-none flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          'linear-gradient(to bottom, var(--color-ink) 0%, color-mix(in oklab, var(--color-ink) 55%, var(--color-ash)) 58%, var(--color-ash) 100%)',
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
            style={{
              boxShadow:
                'var(--bevel-iron), 0 0 60px color-mix(in oklab, var(--color-hearth) 28%, transparent)',
            }}
          >
            {/* emissive amber edges — firelight catching the forged metal: a
                bright outer rim + a tighter inner bevel-catch + a top specular */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-[2px] rounded-[4px]"
              style={{
                boxShadow:
                  'inset 0 0 0 1px color-mix(in oklab, var(--color-hearth) 55%, transparent), inset 0 0 14px color-mix(in oklab, var(--color-hearth) 18%, transparent)',
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-3 top-[3px] h-px rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent, color-mix(in oklab, var(--color-parchment) 60%, transparent), transparent)',
              }}
            />
            <h1
              className="voice-display text-6xl uppercase text-[color:var(--color-parchment)] sm:text-7xl"
              style={{
                letterSpacing: '0.2em',
                textShadow:
                  '0 1px 0 var(--color-ash), 0 0 18px color-mix(in oklab, var(--color-hearth) 45%, transparent), 0 0 2px color-mix(in oklab, var(--color-hearth) 60%, transparent)',
              }}
            >
              {GAME_TITLE}
            </h1>
          </div>
        </div>

        <div className="voice-display mt-5 text-[0.78rem] uppercase tracking-[0.58em] text-[color:var(--color-parchment-dim)]">
          {GAME_TAGLINE}
        </div>

        {/* Action hierarchy: New Game is the one lit action; the rest recede.
            One voice for all three — display caps; light does the ranking. */}
        <nav className="mt-14 flex w-72 flex-col items-stretch gap-3">
          <Button
            id="title-new-game"
            variant="primary"
            onPress={onNewGame}
            className="voice-display py-3.5 text-base tracking-[0.18em]"
          >
            New Game
          </Button>
          {hasSave ? (
            loadButton
          ) : (
            <Tooltip
              placement="right"
              isOpen={showLoadHint}
              content={<span className="font-body italic">No chronicle yet — forge a new one.</span>}
              trigger={
                <Focusable>
                  <div
                    className="flex w-full flex-col items-stretch"
                    onPointerEnter={() => setShowLoadHint(true)}
                    onPointerLeave={() => setShowLoadHint(false)}
                  >
                    {loadButton}
                  </div>
                </Focusable>
              }
            />
          )}
          <Button
            id="title-quit"
            variant="ghost"
            onPress={onQuit}
            className="voice-display text-sm tracking-[0.18em]"
          >
            Quit
          </Button>
        </nav>
      </div>

      {/* maker's mark, bottom — quiet, in the body voice */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[0.65rem] italic tracking-wide text-[color:var(--color-text-muted)] opacity-60">
        steel remembers
      </div>
    </div>
  )
}
