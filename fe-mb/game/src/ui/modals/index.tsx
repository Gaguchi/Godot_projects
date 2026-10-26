/**
 * ui/modals/index.tsx — the modal layer above the screens, rendered from `state.ui.modal` (ephemeral view state;
 * `ui/openModal` / `ui/closeModal`). Esc on a run screen with nothing open opens Pause; Esc with a modal open
 * closes it (the loadout handles its own Esc the same way).
 *
 * `battleEnd` is pausable: the battle is over, `CombatScreen`'s key owner stands down there (0042), and a player
 * reading a Field Report must be able to save and quit like anywhere else. The live COMBAT screen is not — there
 * Esc belongs to the board (cancel a selection, CONTRACT §7 "Esc cancels without pause") and the way to the menu
 * is the HUD chip, so a key never has two owners at once.
 *
 * This layer is also where the world STOPS: an open modal pauses the runtime's pump loop, since legality and
 * `nextPump` are forbidden from reading `state.ui`.
 */
import React, { useEffect } from 'react'
import { overlayOf } from '../../engine/flow/pump'
import type { GameState, Modal } from '../../engine/types'
import { dispatch, getState, setPaused, useGame } from '../store'
import { LoadoutModal } from './Loadout'
import { PauseModal } from './Pause'
import { QuestLogModal } from './QuestLog'

const selectModal = (s: GameState): Modal | null => s.ui.modal
const PAUSABLE = new Set(['overworld', 'town', 'camp', 'dungeon', 'battleEnd'])

export function Modals(): React.JSX.Element | null {
  const modal = useGame(selectModal)

  // A modal STOPS the world. `nextPump` cannot see `state.ui` (CONTRACT §3), so the host does the pausing here —
  // otherwise days pass, food drains and encounters roll behind the "PAUSED" card (`runtime.setPaused`).
  const paused = modal !== null
  useEffect(() => {
    setPaused(paused)
    return () => setPaused(false)
  }, [paused])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const s = getState()
      if (s.ui.modal !== null) {
        if (s.ui.modal.kind !== 'loadout') { e.preventDefault(); dispatch({ type: 'ui/closeModal' }) }
        return
      }
      if (PAUSABLE.has(s.screen.kind) && overlayOf(s) === null) { e.preventDefault(); dispatch({ type: 'ui/openModal', modal: { kind: 'pause' } }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  if (modal === null) return null
  switch (modal.kind) {
    case 'loadout': return <LoadoutModal initialUnitId={modal.unitId} />
    case 'pause': return <PauseModal />
    case 'questLog': return <QuestLogModal />
    default: return null
  }
}
