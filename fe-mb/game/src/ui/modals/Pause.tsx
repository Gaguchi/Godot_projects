/**
 * ui/modals/Pause.tsx — Esc on any run screen: a small leather card — Resume, the company (loadout), Contracts
 * (the quest log), sound on/off (`meta/setAudioMuted`), Save & quit to the title (the autosave already holds the run).
 *
 * The five verbs are NOT of equal rank and no longer look it. Resume is the one thing the card exists to undo, so
 * it is the brass strap across the top; the two places to go are a pair beneath it; the sound setting is a switch,
 * not a button whose label happens to end in a value; and leaving the run sits below a rule, alone, because it is
 * the only one of the five that ends the session (crafting-game-ui signal C: one primary per view, and never five
 * identical slabs).
 */
import React from 'react'
import type { GameState } from '../../engine/types'
import { Button } from '../components/Button'
import { Switch } from '../components/Switch'
import { dispatch, useGame, useLegal } from '../store'

const selectMuted = (s: GameState): boolean => s.meta.audioMuted

export function PauseModal(): React.JSX.Element {
  const muted = useGame(selectMuted)
  const quit = useLegal({ type: 'meta/toTitle' })
  return (
    <div className="event" data-testid="pause">
      <div className="event__scrim" onClick={() => dispatch({ type: 'ui/closeModal' })} />
      <div className="hud-panel pause">
        <div className="place__eyebrow voice-display">Paused</div>
        <div className="pause__title voice-display">The road waits</div>
        <div className="pause__verbs">
          <Button variant="primary" className="pause__resume" onPress={() => dispatch({ type: 'ui/closeModal' })} testId="pause-resume" autoFocus>Resume</Button>
          <div className="pause__pair">
            <Button variant="secondary" onPress={() => dispatch({ type: 'ui/openModal', modal: { kind: 'loadout', unitId: null } })} testId="pause-company">The company</Button>
            <Button variant="secondary" onPress={() => dispatch({ type: 'ui/openModal', modal: { kind: 'questLog' } })} testId="pause-quests">Contracts</Button>
          </div>
          <Switch label="Sound" on={!muted} onToggle={() => dispatch({ type: 'meta/setAudioMuted', muted: !muted })} testId="pause-sound" />
        </div>
        <div className="hud-divider pause__rule" />
        <div className="pause__leave">
          <Button variant="ghost" disabledReason={quit.ok ? null : quit.reason} onPress={() => dispatch({ type: 'meta/toTitle' })} testId="pause-quit">Save &amp; quit</Button>
          <span className="pause__hint"><span className="keycap">Esc</span> resumes</span>
        </div>
      </div>
    </div>
  )
}
