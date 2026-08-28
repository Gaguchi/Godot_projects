import React, { useState } from 'react'
import { Button, Tooltip, Focusable } from '../components'
import { GAME_TITLE, GAME_TAGLINE } from '../strings'
import { listSlots, isSlotEmpty } from '../../persistence/saveSlots'

/**
 * Title screen — first thing the player sees on boot.
 *
 * "Field Ledger" identity: not a candle-lit crypt, but the company ledger open
 * on the camp table in daylight. Linen canvas ground, walnut ink title stamped
 * between two flat ink rules, brass corner brackets holding the page down.
 * Nothing glows. New Game is the single primary action and it is the one piece
 * of LEATHER on the page — the material contract is "canvas = read, leather =
 * act" — so the eye lands on it without any light trickery. Load/Quit recede
 * to ghosts. All three share ONE voice: display small-caps with tracking.
 *
 * Buttons remain <Button> wrappers (RAC state machines: hover/press/focus +
 * keyboard activation). All motion is transform/opacity-only and respects
 * prefers-reduced-motion via the --dur tokens / animation overrides in index.css.
 */
/** Width of the ledger sheet on the 1280-wide stage — the table shows either
 *  side of it, so the page reads as an object rather than a background. */
const SHEET_W = 820

export interface TitleScreenProps {
  onNewGame: () => void
  onLoadGame: () => void
  onQuit: () => void
}

/** Dust lifting off the camp track in daylight — pure CSS, staggered, cheap.
 *  (Reuses the `emberRise` keyframe; there is no fire in Field Ledger.) */
function Embers(): React.JSX.Element {
  const embers = [
    { left: '32%', delay: '0s', drift: '14px', size: 3, dur: '9.5s' },
    { left: '44%', delay: '1.8s', drift: '-10px', size: 2, dur: '11s' },
    { left: '52%', delay: '3.2s', drift: '8px', size: 2, dur: '9s' },
    { left: '60%', delay: '0.9s', drift: '-16px', size: 3, dur: '12s' },
    { left: '68%', delay: '4.1s', drift: '12px', size: 2, dur: '10s' },
    { left: '38%', delay: '5.0s', drift: '-6px', size: 2, dur: '10.5s' },
  ]
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 motion-reduce:hidden">
      {embers.map((e, i) => (
        <span
          key={i}
          className="absolute bottom-[26%] rounded-full"
          style={{
            left: e.left,
            width: e.size,
            height: e.size,
            background: 'rgba(255, 252, 242, 0.85)',
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
      className="page-canvas relative flex h-full w-full select-none flex-col items-center justify-center overflow-hidden"
      style={{
        /* the camp table: planed oak, lit from the upper left */
        background:
          'linear-gradient(168deg, #3f2e1d 0%, #2e2115 46%, #241a10 100%)',
      }}
    >
      {/* --- the camp table: planed oak boards, key light from the left --- */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: [
            'repeating-linear-gradient(92deg, rgba(0,0,0,0.30) 0 2px, rgba(255,232,190,0.05) 2px 4px, transparent 4px 132px)',
            'repeating-linear-gradient(92deg, rgba(255,232,190,0.022) 0 1px, transparent 1px 7px)',
          ].join(', '),
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'linear-gradient(103deg, rgba(255,238,205,0.10) 0%, transparent 42%, rgba(0,0,0,0.30) 100%)' }}
      />

      {/* --- the ledger sheet lying open on it --------------------------- */}
      <div
        aria-hidden
        className="absolute"
        style={{
          top: 26,
          bottom: 26,
          left: '50%',
          width: SHEET_W,
          marginLeft: -SHEET_W / 2,
          background:
            'linear-gradient(168deg, #f3ecda 0%, var(--canvas-base) 46%, var(--canvas-mid) 84%, var(--canvas-deep) 100%)',
          boxShadow:
            '0 14px 30px rgba(12,7,3,0.6), 0 1px 0 rgba(255,253,247,0.55) inset, 0 -2px 0 rgba(122,92,52,0.18) inset',
        }}
      />
      {/* linen weave — multiply, so texture actually bites on a light ground */}
      <div
        aria-hidden
        className="iron-grain absolute"
        style={{
          top: 26, bottom: 26, left: '50%', width: SHEET_W, marginLeft: -SHEET_W / 2,
          mixBlendMode: 'multiply', opacity: 0.5,
        }}
      />
      {/* the ledger's ruling: widely spaced, barely inked */}
      <div
        aria-hidden
        className="absolute"
        style={{
          top: 26, bottom: 26, left: '50%', width: SHEET_W, marginLeft: -SHEET_W / 2,
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent 0 35px, rgba(42,33,25,0.10) 35px 36px)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, #000 16%, #000 84%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 16%, #000 84%, transparent 100%)',
        }}
      />
      {/* the double margin rule every ledger page carries */}
      {[0, 4].map((dx) => (
        <div
          key={dx}
          aria-hidden
          className="absolute"
          style={{
            top: 26, bottom: 26, width: 1,
            left: `calc(50% - ${SHEET_W / 2 - 52 - dx}px)`,
            background: dx === 0 ? 'rgba(42,33,25,0.42)' : 'rgba(42,33,25,0.20)',
          }}
        />
      ))}
      {/* brass pins holding the sheet to the boards */}
      {[
        { top: 44, dx: -SHEET_W / 2 + 22 },
        { top: 44, dx: SHEET_W / 2 - 22 },
        { bottom: 44, dx: -SHEET_W / 2 + 22 },
        { bottom: 44, dx: SHEET_W / 2 - 22 },
      ].map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute h-2.5 w-2.5 rounded-full"
          style={{
            ...(p.top != null ? { top: p.top } : { bottom: p.bottom }),
            left: `calc(50% + ${p.dx}px)`,
            background:
              'radial-gradient(circle at 36% 32%, #f0d79a 0%, var(--iron-edge) 52%, #6d5218 100%)',
            boxShadow: '0 1px 2px rgba(20,12,4,0.6)',
          }}
        />
      ))}
      <div
        aria-hidden
        className="hearth-glow absolute"
        style={{ top: 26, bottom: 26, left: '50%', width: SHEET_W, marginLeft: -SHEET_W / 2 }}
      />
      <Embers />

      <div className="relative z-10 -mt-6 flex flex-col items-center px-6">
        {/* Title stamped straight onto the page between two flat ink rules,
            with brass corner brackets pinning the sheet down. */}
        <div className="relative px-12 py-5 sm:px-16">
          {[
            'left-0 top-0 border-l-2 border-t-2',
            'right-0 top-0 border-r-2 border-t-2',
            'left-0 bottom-0 border-b-2 border-l-2',
            'right-0 bottom-0 border-b-2 border-r-2',
          ].map((pos) => (
            <span
              key={pos}
              aria-hidden
              className={`absolute ${pos} h-4 w-4`}
              style={{ borderColor: 'var(--color-hearth-soft)' }}
            />
          ))}
          <div
            aria-hidden
            className="absolute inset-x-8 top-[2px] h-px"
            style={{ background: 'rgba(42,33,25,0.45)' }}
          />
          <h1
            className="voice-display text-6xl uppercase text-[color:var(--color-ink)]"
            style={{ letterSpacing: '0.16em', fontWeight: 700, textShadow: '0 1px 0 rgba(255,252,244,0.6)' }}
          >
            {GAME_TITLE}
          </h1>
          <div
            aria-hidden
            className="absolute inset-x-8 bottom-[2px] h-px"
            style={{ background: 'rgba(42,33,25,0.45)' }}
          />
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
                  {/* Wraps the DISABLED Load button so it can still explain
                      itself: a disabled <button> emits no pointer events, so
                      the hover target has to live outside it. role/tabIndex
                      make the wrapper a real focus stop — without them RAC
                      warns "Focusable child must have an interactive ARIA
                      role" on every boot, and keyboard users never reach the
                      disabled-reason tooltip at all. */}
                  <div
                    role="button"
                    aria-disabled="true"
                    tabIndex={0}
                    className="flex w-full flex-col items-stretch"
                    onPointerEnter={() => setShowLoadHint(true)}
                    onPointerLeave={() => setShowLoadHint(false)}
                    onFocus={() => setShowLoadHint(true)}
                    onBlur={() => setShowLoadHint(false)}
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

      {/* maker's mark, bottom — quiet, in the body voice. parchment-dim, not
          muted: it sits on the sheet's darkest gradient band (--canvas-deep),
          where dim is the AA-safe quiet rank. */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-[0.7rem] italic tracking-wide text-[color:var(--color-parchment-dim)]">
        steel remembers
      </div>
    </div>
  )
}
