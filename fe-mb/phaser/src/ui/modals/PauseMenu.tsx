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
/* Local material bits (tokens only — no new hex literals)                    */
/* ------------------------------------------------------------------------- */

/** Fading horizontal hairline — the ornamental rule from materials §2.3. */
function Rule({ className }: { className?: string }): React.JSX.Element {
  return (
    <div
      aria-hidden
      className={`h-px ${className ?? ''}`}
      style={{
        background:
          'linear-gradient(90deg, transparent, color-mix(in oklab, var(--iron-edge) 85%, transparent), transparent)',
      }}
    />
  )
}

/** Corner rivets — the silhouette irregularity that kills the web-card read. */
function Rivets(): React.JSX.Element {
  const spots: React.CSSProperties[] = [
    { top: 7, left: 7 },
    { top: 7, right: 7 },
    { bottom: 7, left: 7 },
    { bottom: 7, right: 7 },
  ]
  return (
    <>
      {spots.map((pos, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute h-1.5 w-1.5 rounded-full"
          style={{
            ...pos,
            background:
              'radial-gradient(circle at 35% 35%, color-mix(in oklab, var(--color-parchment) 35%, var(--iron-edge)), var(--iron-edge) 72%)',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.6)',
          }}
        />
      ))}
    </>
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

/**
 * Top-level pause menu. Triggered by Esc anywhere except title (combat,
 * overworld, town, camp, dungeon). The menu items map to existing modals
 * — pause is just the dispatch hub.
 *
 * Fiction: the campfire idiom — the world holds its breath (veil backdrop,
 * the map stays readable) while a forged-iron plaque offers the way back in.
 * Exactly one lit action (Resume); leaving actions sit below a rule and stay
 * quiet until the confirm step, where Cancel is the focused safe default.
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

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      aria-label="Pause Menu"
      backdrop="veil"
      unpadded
      className="w-[380px]"
    >
      <div id="pause-menu" className="relative cursor-default select-none overflow-hidden rounded-md">
        {/* material: grain + one hearth pool behind the header/Resume zone */}
        <div aria-hidden className="iron-grain pointer-events-none absolute inset-0" />
        <div
          aria-hidden
          className="hearth-glow pointer-events-none absolute inset-x-0 top-0 h-56"
        />
        <Rivets />

        <div className="relative flex flex-col">
          {/* header — engraved plate line with flanking rules */}
          <div className="px-8 pb-2 pt-6">
            <div className="flex items-center gap-3">
              <Rule className="flex-1" />
              <Heading
                level={2}
                className="voice-display m-0 text-lg uppercase tracking-[0.3em] text-[color:var(--color-parchment)]"
              >
                Paused
              </Heading>
              <Rule className="flex-1" />
            </div>
            <p className="mb-0 mt-1.5 text-center font-body text-xs italic text-[color:var(--color-text-muted)]">
              the world holds its breath
            </p>
          </div>

          {/* body — menu or confirm, crossfading via keyed mount */}
          {confirmTitle ? (
            <Rise key="confirm" className="px-6 pb-5 pt-3">
              <p
                className="voice-display m-0 text-center text-base tracking-[0.06em]"
                style={{ color: 'color-mix(in oklab, var(--color-damage-text) 70%, var(--color-parchment))' }}
              >
                Return to Title?
              </p>
              <p className="mb-0 mt-2 text-center font-body text-sm text-[color:var(--color-parchment-dim)]">
                Unsaved progress will be lost — the march ends here.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button variant="ghost" autoFocus onPress={() => setConfirmTitle(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onPress={onReturnToTitle}>
                  Return to Title
                </Button>
              </div>
            </Rise>
          ) : (
            <div key="menu" className="flex flex-col px-6 pb-4 pt-3">
              <Rise delayMs={0}>
                <Button
                  id="pause-resume"
                  variant="primary"
                  autoFocus
                  onPress={onResume}
                  className="voice-display w-full py-3 tracking-[0.14em]"
                >
                  Resume
                </Button>
              </Rise>
              <Rise delayMs={30} className="mt-2">
                <Button
                  id="pause-save"
                  variant="secondary"
                  isDisabled={!canSave}
                  onPress={onSaveGame}
                  className="w-full"
                >
                  Save Game
                </Button>
                {!canSave && (
                  <p className="mb-0 mt-1 text-center font-body text-[0.7rem] italic text-[color:var(--color-text-muted)]">
                    nothing to save outside a campaign
                  </p>
                )}
              </Rise>
              <Rise delayMs={60} className="mt-2">
                <Button id="pause-load" variant="secondary" onPress={onLoadGame} className="w-full">
                  Load Game
                </Button>
              </Rise>

              {/* staying above, leaving below */}
              <Rise delayMs={90}>
                <Rule className="mx-4 my-3" />
              </Rise>

              <Rise delayMs={120}>
                <Button
                  id="pause-title"
                  variant="ghost"
                  onPress={() => setConfirmTitle(true)}
                  className="w-full"
                >
                  Return to Title
                </Button>
              </Rise>
              <Rise delayMs={150} className="mt-1">
                <Button id="pause-quit" variant="ghost" onPress={onQuit} className="w-full">
                  Quit
                </Button>
              </Rise>
            </div>
          )}

          {/* footer — sound toggle out of the action stack, two visual channels */}
          <div
            className="flex items-center justify-between px-6 py-2.5"
            style={{ borderTop: '1px solid color-mix(in oklab, var(--iron-edge) 45%, transparent)' }}
          >
            <span className="font-body text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              Sound
            </span>
            <Button
              id="pause-sound"
              variant="ghost"
              aria-label={audioMuted ? 'Sound: Off' : 'Sound: On'}
              onPress={() => dispatchMeta({ type: 'setAudioMuted', payload: { muted: !audioMuted } })}
              className="gap-2 px-3 py-1"
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
