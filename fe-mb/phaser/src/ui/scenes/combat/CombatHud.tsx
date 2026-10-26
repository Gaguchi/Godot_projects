import React from 'react'
import { TopBar } from './TopBar'
import { ModeLabel } from './ModeLabel'
import { MoveBtn } from './MoveBtn'
import { EndTurnBtn } from './EndTurnBtn'
import { CardHand } from './CardHand'
import { CaptureBtn } from './CaptureBtn'
import { InitiativeStrip } from './InitiativeStrip'
import { ForecastPanel } from './ForecastPanel'
import { UnitDetailPanel } from './UnitDetailPanel'
import { PhaseBanner } from './PhaseBanner'
import { Keycap } from './hudBits'
import { Button } from '../../components/Button'
import { useCombatStore } from '../../../state/combatStore'
import { useCombatUiStore } from '../../../state/combatUiStore'

/**
 * Clickable danger-zone toggle (bottom-left chip): a Tab keycap + label +
 * state pip. BoardScene owns the actual overlay state (`globalDangerZone`),
 * flipped by its Phaser `keydown-TAB` handler on `window` — so the chip
 * REUSES that exact channel by synthesizing a Tab keydown instead of holding
 * a second copy of the state. The chip's own lit/unlit read mirrors the
 * toggle by listening for the same window-level Tab keydowns (covers both
 * the physical key and the chip).
 */
function DangerZoneToggle(): React.JSX.Element {
  const [on, setOn] = React.useState(false)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Tab') setOn((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggle = (): void => {
    // Phaser's KeyboardManager listens for keydown on window and routes by
    // event.keyCode — synthesize the same event the physical key produces.
    const ev = new KeyboardEvent('keydown', {
      key: 'Tab',
      code: 'Tab',
      keyCode: 9,
      bubbles: true,
      cancelable: true,
    })
    if (ev.keyCode !== 9) {
      Object.defineProperty(ev, 'keyCode', { get: () => 9 })
    }
    window.dispatchEvent(ev)
  }

  return (
    <Button
      id="danger-zone-toggle"
      variant="secondary"
      onPress={toggle}
      aria-pressed={on}
      aria-label="Toggle danger zones"
      className="gap-2 !px-2.5 !py-1.5 !text-[0.62rem]"
      style={on ? { borderColor: 'color-mix(in oklab, var(--color-ember) 70%, transparent)' } : {}}
    >
      <Keycap label="Tab" />
      <span
        className="leading-none"
        style={{ color: on ? 'var(--color-parchment)' : 'var(--color-text-muted)' }}
      >
        Danger zone
      </span>
      {/* state pip — second (non-colour-position) channel for the toggle read */}
      <span
        aria-hidden
        className="inline-block h-[7px] w-[7px] rounded-full"
        style={{
          background: on ? 'var(--color-ember)' : 'color-mix(in oklab, var(--color-ash) 70%, transparent)',
          border: on
            ? '1px solid var(--color-ember)'
            : '1px solid color-mix(in oklab, var(--iron-edge) 80%, transparent)',
          boxShadow: on ? '0 0 6px color-mix(in oklab, var(--color-ember) 70%, transparent)' : 'none',
        }}
      />
    </Button>
  )
}

/** Total command-zone exit budget: card drop (~160ms via --dur-quick) plus
 *  the 4-card stagger tail, with a little slack before the hard unmount.
 *  The battle-end Dialog opens ~250ms after phase flips, so the exit reads
 *  as a handoff — cards bow out, then the verdict takes the stage. */
const COMMAND_EXIT_MS = 380

/** Keep the command zone mounted just long enough to play its exit
 *  (cards drop + fade with a stagger, buttons/chips fade), then unmount so
 *  nothing stale lingers behind the battle-end modal's scrim. */
function useCommandZoneExit(active: boolean): { mounted: boolean; exiting: boolean } {
  const [mounted, setMounted] = React.useState(active)
  React.useEffect(() => {
    if (active) {
      setMounted(true)
      return
    }
    const t = window.setTimeout(() => setMounted(false), COMMAND_EXIT_MS)
    return () => window.clearTimeout(t)
  }, [active])
  return { mounted: mounted || active, exiting: mounted && !active }
}

/** Accelerating fade for the button/chip clusters — an exit, not an entrance.
 *  Rides --dur-quick so reduced motion collapses it to an instant hide. */
const ZONE_FADE_CLASS =
  'transition-opacity [transition-duration:var(--dur-quick)] ease-[cubic-bezier(0.32,0,0.67,0)]'

/**
 * Top-level combat HUD overlay rendered over the Phaser canvas.
 *
 * The outer wrapper has `pointer-events: none` so the canvas underneath
 * receives clicks for tile/unit picking. Each interactive HUD element wraps
 * itself in `pointer-events: auto`.
 *
 * The command zone (card hand, Move/End Turn, capture actions, danger-zone
 * chip) only exists while phase === 'COMBAT' — when the battle resolves it
 * plays a short exit and unmounts, handing the screen to the battle-end
 * modal. TopBar stays (it swaps itself to a neutral "Battle Ended" plate).
 */
export function CombatHud(): React.JSX.Element {
  const pinnedDetailUnitId = useCombatUiStore((s) => s.pinnedDetailUnitId)
  const setPinned = useCombatUiStore((s) => s.setPinnedDetailUnit)
  const inCombat = useCombatStore((s) => s.state.phase === 'COMBAT')
  const { mounted: commandMounted, exiting: commandExiting } = useCommandZoneExit(inCombat)
  const zoneFade = `${ZONE_FADE_CLASS} ${
    commandExiting ? 'opacity-0 pointer-events-none' : 'pointer-events-auto'
  }`
  return (
    <div
      id="combat-hud"
      className="pointer-events-none absolute inset-0 z-[100]"
    >
      {/* Top-center column: herald plaque > mode strip. Children flow in
          the column — the old top-[6.25rem] / top-[13rem] magic-offset chain
          is gone. The turn queue lives in the top-LEFT corner (mirroring the
          pause button top-right): stacked under the plaque it ran 80px down
          over the board's first two rows. boardGeometry BAND_TOP clears it. */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[90] flex flex-col items-center gap-2">
        <div className="pointer-events-auto"><TopBar /></div>
        <ModeLabel />
      </div>
      <div className="absolute top-3 left-3 z-[90]">
        <InitiativeStrip />
      </div>
      <PhaseBanner />
      <ForecastPanel />
      {commandMounted && <CardHand exiting={commandExiting} />}
      {/* Hard-gated (no fade): its inner pointer-events-auto would stay
          clickable through a fading wrapper, and it is almost always already
          null when the battle resolves (no live adjacent enemies). */}
      {inCombat && <CaptureBtn />}
      <UnitDetailPanel pinnedUnitId={pinnedDetailUnitId} onClose={() => setPinned(null)} />
      {commandMounted && (
        <div className={`absolute bottom-4 right-4 flex gap-3 ${zoneFade}`}>
          <MoveBtn />
          <EndTurnBtn />
        </div>
      )}
      {commandMounted && (
        <div className={`absolute bottom-3 left-3 ${zoneFade}`}>
          <DangerZoneToggle />
        </div>
      )}
    </div>
  )
}
