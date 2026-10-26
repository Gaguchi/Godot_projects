/**
 * ui/screens/Title.tsx — the reference PAGE (crafting-game-ui project-hooks): a linen ledger sheet pinned to the
 * camp table; the walnut title between two ink rules; ONE piece of leather — Continue when a run is parked,
 * New Run otherwise; everything else recedes to ghosts. Roguelite save model (brief §2.14): Continue appears only
 * while an autosave exists; New Run deletes it.
 *
 * `note` is the boot notice: when the autosave could not be read it was CLEARED, and the player must be told in
 * words rather than left with a Title screen whose Continue has quietly vanished (brief §2.14 "a schema bump nukes
 * saves with a loud warning"). It is a boot-time string, not game state — `main.tsx` hands it to `<App/>`.
 *
 * Quit is shown only under the desktop shell (`electron/main.cjs`): `window.close()` is a no-op in a normally
 * opened browser tab, and a control that presses with no outcome is worse than no control at all. The browser
 * stays a first-class target (DECISIONS) — it is simply the browser that owns the window there.
 */
import React, { useCallback } from 'react'
import { Button } from '../components/Button'
import { InkRule, LedgerPage } from '../components/LedgerPage'
import { placeName } from '../names'
import { dispatch, useEnv, useGame } from '../store'
import type { GameState } from '../../engine/types'

const GAME_TITLE = 'Embermarch'
const GAME_TAGLINE = 'a tactical roguelite'

function newSeed(): number {
  // The ONE non-deterministic input of a run: the host supplies it (ARCHITECTURE §2).
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] ?? 1
}

const selectTitle = (s: GameState): { readonly hasRun: boolean; readonly day: number | null; readonly nodeId: string | null } => ({
  hasRun: s.run !== null,
  day: s.run?.daysElapsed ?? null,
  nodeId: s.run?.nodeId ?? null,
})

export function TitleScreen({ note = null }: { readonly note?: string | null } = {}): React.JSX.Element {
  const env = useEnv()
  const { hasRun, day, nodeId } = useGame(selectTitle, (a, b) => a.hasRun === b.hasRun && a.day === b.day && a.nodeId === b.nodeId)
  // The parked run is described by the PLACE it is parked in, not by the node's id (`darens_camp` → "Daren's Camp").
  const place = placeName(nodeId, env)
  const onContinue = useCallback(() => { dispatch({ type: 'meta/continueRun' }) }, [])
  const onNew = useCallback(() => { dispatch({ type: 'meta/newRun', seed: newSeed() }) }, [])
  const onQuit = useCallback(() => { window.close() }, [])
  const inShell = typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent)
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg, var(--iron-800) 0%, var(--iron-900) 60%, var(--color-ash) 100%)' }}>
      <div className="iron-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <LedgerPage width={820} height={668} testId="title-page">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'center', gap: 4 }}>
          <div style={{ width: 620 }}>
            <InkRule brackets />
            <h1 className="voice-display" style={{ textAlign: 'center', fontSize: 72, fontWeight: 700, letterSpacing: '0.12em', margin: '6px 0', color: 'var(--color-ink)', textShadow: '0 1px 0 rgba(255,252,244,0.6)' }}>
              {GAME_TITLE}
            </h1>
            <InkRule brackets />
          </div>
          <p className="voice-display" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.24em', textTransform: 'uppercase', fontSize: 14, margin: '10px 0 40px' }}>
            {GAME_TAGLINE}
          </p>
          <nav aria-label="Main menu" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, minWidth: 290 }}>
            {hasRun ? (
              <>
                <Button variant="primary" onPress={onContinue} autoFocus testId="title-continue" style={{ width: 290, fontSize: '0.95rem' }}>
                  Continue
                </Button>
                <span className="numeral" style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: -6 }}>
                  day {day} · {place}
                </span>
                <Button variant="ghost" onPress={onNew} testId="title-new">New Run</Button>
              </>
            ) : (
              <Button variant="primary" onPress={onNew} autoFocus testId="title-new" style={{ width: 290, fontSize: '0.95rem' }}>
                New Run
              </Button>
            )}
            {inShell && <Button variant="ghost" onPress={onQuit} testId="title-quit">Quit</Button>}
          </nav>
          {note !== null && (
            <div
              role="status"
              data-testid="title-notice"
              style={{
                marginTop: 26, maxWidth: 560, padding: '10px 18px', textAlign: 'center',
                borderTop: '1px solid currentColor', borderBottom: '1px solid currentColor',
                color: 'var(--color-damage-text)', fontSize: 13, lineHeight: 1.5,
              }}
            >
              {note}
            </div>
          )}
        </div>
        <p style={{ position: 'absolute', bottom: 22, left: 0, right: 0, textAlign: 'center', fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>
          steel remembers
        </p>
      </LedgerPage>
    </div>
  )
}
