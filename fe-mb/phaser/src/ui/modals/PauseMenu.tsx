import React, { useEffect, useState } from 'react'
import { Dialog, Button, Heading } from '../components'
import { useMetaStore } from '../../state/metaStore'

export interface PauseMenuProps {
  open: boolean
  /** When true, Save Game is enabled (only meaningful inside an active run). */
  canSave: boolean
  onClose: () => void
  onResume: () => void
  onSaveGame: () => void
  onLoadGame: () => void
  onReturnToTitle: () => void
  onQuit: () => void
}

/* ------------------------------------------------------------------------- */
/* Local material bits (tokens only — no invented palette)                    */
/* ------------------------------------------------------------------------- */

/**
 * The ledger page under the modal: linen ground, feint ruling, the double
 * margin rule every ledger carries, brass pins at the corners. Decorative
 * only — it never eats pointer events.
 *
 * The gradient deliberately stops at `--canvas-mid` instead of running down to
 * `--canvas-deep`: the bake-off audit measured muted text at only 4.16:1 over
 * the deep band, and a modal is short enough that its whole body would sit in
 * it. Capping at mid keeps every small-text pair on this page above AA.
 */
function Sheet({ ruleGap = 30, gutter = 26 }: { ruleGap?: number; gutter?: number }): React.JSX.Element {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(168deg, #f3ecda 0%, var(--canvas-base) 42%, var(--canvas-mid) 100%)' }}
      />
      {/* linen weave — multiply so the texture actually bites on a light ground */}
      <div
        aria-hidden
        className="iron-grain pointer-events-none absolute inset-0"
        style={{ mixBlendMode: 'multiply', opacity: 0.4 }}
      />
      {/* the ruling: widely spaced, barely inked */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent 0 ${ruleGap - 1}px, rgba(42,33,25,0.09) ${ruleGap - 1}px ${ruleGap}px)`,
        }}
      />
      {/* double margin rule */}
      {[0, 4].map((dx) => (
        <div
          key={dx}
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px"
          style={{ left: gutter + dx, background: dx === 0 ? 'rgba(42,33,25,0.34)' : 'rgba(42,33,25,0.16)' }}
        />
      ))}
      <Pins />
    </>
  )
}

/** Brass pins holding the page to the table — daylight contact shadow, no bloom. */
function Pins(): React.JSX.Element {
  const spots: React.CSSProperties[] = [
    { top: 8, left: 8 }, { top: 8, right: 8 }, { bottom: 8, left: 8 }, { bottom: 8, right: 8 },
  ]
  return (
    <>
      {spots.map((pos, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute h-2 w-2 rounded-full"
          style={{
            ...pos,
            background: 'radial-gradient(circle at 36% 32%, #f0d79a 0%, var(--iron-edge) 52%, #6d5218 100%)',
            boxShadow: '0 1px 2px rgba(46,32,16,0.5)',
          }}
        />
      ))}
    </>
  )
}

/** Flat ink rule — a page is ruled with ink, never with a glowing seam. */
function Rule({ className, weight = 0.28 }: { className?: string; weight?: number }): React.JSX.Element {
  return (
    <div aria-hidden className={`h-px ${className ?? ''}`} style={{ background: `rgba(42,33,25,${weight})` }} />
  )
}

/** Mount-reveal: fade + 6px rise on enter. Rides the --dur tokens, so the
 *  global reduced-motion override collapses it to instant. */
function Rise({
  children,
  delayMs = 0,
  className,
}: {
  children: React.ReactNode
  delayMs?: number
  className?: string
}): React.JSX.Element {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(6px)',
        transition: `opacity var(--dur-quick) var(--ease-out-quart) ${delayMs}ms, transform var(--dur-quick) var(--ease-out-quart) ${delayMs}ms`,
      }}
    >
      {children}
    </div>
  )
}

/**
 * One written line of the menu. The label sits on the ruled line; a brass tick
 * appears in the margin when the line is under the pointer or the keyboard,
 * so the "current line" read never depends on colour alone.
 */
function LedgerLine({ children, last }: { children: React.ReactNode; last?: boolean }): React.JSX.Element {
  return (
    <div className="group relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-[-14px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rotate-45 opacity-0 transition-opacity duration-[var(--dur-quick)] group-hover:opacity-100 group-focus-within:opacity-100"
        style={{ background: 'var(--iron-edge)' }}
      />
      {children}
      {!last && <Rule weight={0.18} />}
    </div>
  )
}

/* Icon.tsx has no speaker glyphs — small local inline SVGs in the same
   stroke family (1.8, round caps, currentColor). */
function SpeakerGlyph({ muted }: { muted: boolean }): React.JSX.Element {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 9.5 H7.5 L12.5 5.5 V18.5 L7.5 14.5 H4 Z" />
      {muted ? (
        <>
          <path d="M16.5 9.5 L20.5 14.5" />
          <path d="M20.5 9.5 L16.5 14.5" />
        </>
      ) : (
        <>
          <path d="M15.5 9.5 a4 4 0 0 1 0 5" />
          <path d="M17.5 7.5 a7 7 0 0 1 0 9" />
        </>
      )}
    </svg>
  )
}

/* ------------------------------------------------------------------------- */

/** Shared geometry: text starts just right of the margin rule. */
const COL = 'pl-[42px] pr-6'

/**
 * Top-level pause menu. Triggered by Esc anywhere except title (combat,
 * overworld, town, camp, dungeon). The menu items map to existing modals
 * — pause is just the dispatch hub.
 *
 * Field Ledger fiction: the quartermaster lays a slip of the ledger on the
 * table while the column halts. Linen ground, walnut ink, the menu written
 * out as ruled lines. Resume is the ONE piece of leather on the page — the
 * material contract is "canvas = read, leather = act" — so the eye lands on
 * it without any light trickery; everything else is ink on a ruled line.
 */
export function PauseMenu({
  open, canSave, onClose, onResume, onSaveGame, onLoadGame, onReturnToTitle, onQuit,
}: PauseMenuProps): React.JSX.Element {
  const audioMuted = useMetaStore((st) => st.audioMuted)
  const dispatchMeta = useMetaStore((st) => st.dispatch)
  const [confirmTitle, setConfirmTitle] = useState(false)

  React.useEffect(() => {
    if (!open) setConfirmTitle(false)
  }, [open])

  /** Ledger lines share one voice: display small-caps, walnut ink, left-hung.
   *  `!` overrides are required, not decoration: the `.btn-forged` recipe is
   *  unlayered CSS and would otherwise beat every Tailwind utility here. On
   *  hover the ghost's default brass RECTANGLE is swapped for a brass edge at
   *  the margin — a strap sliding under the line, not a web outline. */
  const lineClass =
    'voice-display w-full !justify-start !px-0 !py-2.5 !text-[0.78rem] !tracking-[0.16em] ' +
    '!text-[color:var(--color-parchment)] ' +
    'data-[hovered]:!border-transparent data-[hovered]:![box-shadow:inset_4px_0_0_var(--iron-edge)]'

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      aria-label="Pause Menu"
      backdrop="veil"
      unpadded
      className="w-[392px]"
    >
      <div
        id="pause-menu"
        className="page-canvas relative cursor-default select-none overflow-hidden rounded-[var(--radius-md)]"
        style={{ background: 'var(--canvas-base)' }}
      >
        <Sheet />

        <div className="relative flex flex-col">
          {/* header — stamped between the ledger's double head-rule */}
          <div className={`${COL} pb-3 pt-6`}>
            <Heading
              level={2}
              /* `!` beats Heading.tsx's baked-in `text-amber-100`, which is a
                 same-rank utility and would otherwise keep the title bone-white
                 on a linen page. */
              className="voice-display m-0 text-lg uppercase !tracking-[0.3em] !text-[color:var(--color-parchment)]"
            >
              Paused
            </Heading>
            <p className="mb-0 mt-1 font-body text-xs italic text-[color:var(--color-parchment-dim)]">
              the world holds its breath
            </p>
          </div>
          <div className={COL}>
            <Rule weight={0.46} />
            <div className="h-[3px]" />
            <Rule weight={0.22} />
          </div>

          {/* body — menu or confirm, crossfading via keyed mount */}
          {confirmTitle ? (
            <Rise key="confirm" className={`${COL} pb-5 pt-4`}>
              <p
                className="voice-display m-0 text-base tracking-[0.06em] text-[color:var(--color-damage-text)]"
              >
                Return to Title?
              </p>
              <p className="mb-0 mt-1.5 font-body text-sm text-[color:var(--color-parchment-dim)]">
                Unsaved progress will be lost — the march ends here.
              </p>
              <div className="mt-4 flex gap-2">
                <Button variant="danger" onPress={onReturnToTitle}>
                  Return to Title
                </Button>
                <Button variant="ghost" autoFocus onPress={() => setConfirmTitle(false)}>
                  Cancel
                </Button>
              </div>
            </Rise>
          ) : (
            <div key="menu" className={`${COL} flex flex-col pb-3 pt-4`}>
              {/* the one piece of leather on the page */}
              <Rise delayMs={0}>
                <Button
                  id="pause-resume"
                  variant="primary"
                  autoFocus
                  onPress={onResume}
                  className="voice-display w-full py-3 tracking-[0.16em]"
                >
                  Resume
                </Button>
              </Rise>

              <Rise delayMs={30} className="mt-4">
                <LedgerLine>
                  <Button
                    id="pause-save"
                    variant="ghost"
                    isDisabled={!canSave}
                    onPress={onSaveGame}
                    className={lineClass}
                    {...(canSave
                      ? {}
                      : { style: { opacity: 1, filter: 'none', color: 'var(--color-text-muted)' } })}
                  >
                    Save Game
                  </Button>
                  {!canSave && (
                    <p className="mb-1.5 -mt-1 font-body text-[0.72rem] italic text-[color:var(--color-text-muted)]">
                      nothing to save outside a campaign
                    </p>
                  )}
                </LedgerLine>
              </Rise>
              <Rise delayMs={60}>
                <LedgerLine>
                  <Button id="pause-load" variant="ghost" onPress={onLoadGame} className={lineClass}>
                    Load Game
                  </Button>
                </LedgerLine>
              </Rise>

              {/* staying above, leaving below — a heavier rule divides them */}
              <Rise delayMs={90} className="py-2">
                <Rule weight={0.42} />
              </Rise>

              <Rise delayMs={120}>
                <LedgerLine>
                  <Button
                    id="pause-title"
                    variant="ghost"
                    onPress={() => setConfirmTitle(true)}
                    className={lineClass}
                  >
                    Return to Title
                  </Button>
                </LedgerLine>
              </Rise>
              <Rise delayMs={150}>
                <LedgerLine last>
                  <Button id="pause-quit" variant="ghost" onPress={onQuit} className={lineClass}>
                    Quit
                  </Button>
                </LedgerLine>
              </Rise>
            </div>
          )}

          {/* footer — sound toggle out of the action stack, two visual channels
              (pip fill + written state), on the page's foot band */}
          <div
            className={`${COL} flex items-center justify-between py-2.5`}
            style={{ borderTop: '1px solid rgba(42,33,25,0.3)', background: 'rgba(42,33,25,0.05)' }}
          >
            <span className="font-body text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              Sound
            </span>
            <Button
              id="pause-sound"
              variant="ghost"
              aria-label={audioMuted ? 'Sound: Off' : 'Sound: On'}
              onPress={() => dispatchMeta({ type: 'setAudioMuted', payload: { muted: !audioMuted } })}
              className="gap-2 px-2 py-1 text-[color:var(--color-parchment-dim)]"
            >
              <SpeakerGlyph muted={audioMuted} />
              <span className={`ap-pip ${audioMuted ? 'ap-pip--empty' : 'ap-pip--full'}`} />
              <span className="numeral text-[0.65rem]">{audioMuted ? 'OFF' : 'ON'}</span>
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
