/**
 * flow/pump.ts — the pure flow derivations every consumer shares (§7.13, §7.16).
 * `overlayOf` is the ONE derivation the UI, `isLegal` and the pumps use; `nextPump` says WHICH pump is
 * due (the runtime decides WHEN); `resumeScreen` says where Continue lands. None of them reads `state.ui`.
 */
import type { PumpAction } from '../actions'
import type { GameState, Overlay, ScreenKind } from '../types'
import { tutorialStep } from '../combat/tutorial'

/** Priority: namePrompt > checkEvent > dialogue > quickMenu (pendingTravel atNode) > tutorial (combat.tag). null = none.
 *  A name prompt fired mid-dialogue therefore shows ON TOP of the dialogue, which continues after `name/submit`.
 *  Nothing overlays the title screen: a parked run stays exactly as saved until Continue. */
export function overlayOf(state: GameState): Overlay | null {
  const run = state.run
  const screen = state.screen.kind
  if (screen === 'title') return null
  if (run !== null) {
    if (run.pendingNamePrompt !== null) return { kind: 'namePrompt', prompt: run.pendingNamePrompt }
    if (run.pendingCheckEvent !== null) return { kind: 'checkEvent', event: run.pendingCheckEvent }
    if (run.pendingDialogue !== null) return { kind: 'dialogue', dialogue: run.pendingDialogue }
    // The quick menu belongs to the map: inside a town/camp/dungeon entered from it, the atNode record waits quietly.
    if (screen === 'overworld' && run.pendingTravel?.status === 'atNode') return { kind: 'quickMenu', nodeId: run.nodeId }
  }
  if (screen === 'combat' && state.combat !== null) {
    const step = tutorialStep(state.combat)
    if (step !== null) return { kind: 'tutorial', step }
  }
  if (screen === 'battleEnd' && run?.lastBattle?.tag === 'tutorial') return { kind: 'tutorial', step: 'victory' }
  return null
}

/**
 * Total over the screen — the ONLY two rules, both carrying a screen term (CONTRACT-CHANGES 0002):
 *   screen combat ∧ combat.phase === 'combat' ∧ units[turn.unitId].team === 'enemy' → `combat/enemyStep`
 *   screen overworld ∧ pendingTravel?.status === 'walking' ∧ overlayOf === null      → `travel/step`
 *   else null.
 * No pump is ever due on the title screen: `meta/toTitle` mid-enemy-turn parks the battle (`combat` kept) and
 * `meta/continueRun` resumes it with no input. A pump that `isLegal` would refuse is a contract bug — the
 * runtime asserts it (`flow/runtime.ts`). `state.ui` is never read; the host pauses with `runtime.setPaused`.
 */
export function nextPump(state: GameState): PumpAction | null {
  const screen = state.screen.kind
  if (screen === 'combat' && state.combat !== null && state.combat.phase === 'combat') {
    const active = state.combat.units[state.combat.turn.unitId]
    return active !== undefined && active.team === 'enemy' ? { type: 'combat/enemyStep' } : null
  }
  if (screen === 'overworld' && state.run?.pendingTravel?.status === 'walking' && overlayOf(state) === null) return { type: 'travel/step' }
  return null
}

/** `nextPump(state) === null && overlayOf(state) === null && screen.kind !== 'title'` — the state waits for the player. */
export function isQuiescent(state: GameState): boolean {
  return nextPump(state) === null && overlayOf(state) === null && state.screen.kind !== 'title'
}

/**
 * The screen the slots imply — derived ONLY from persisted state, in this order (CONTRACT-CHANGES 0008):
 *   ledger → win | gameOver (by outcome)          run === null → title
 *   combat !== null → combat                        run.lastBattle → battleEnd
 *   run.pendingDialogue?.source === 'prologue' → prologue
 *   run.town → town      run.camp → camp      run.activeDungeon → dungeon      else → overworld
 * `continueRun` and `hydrate` route through it; `flow/invariants.ts` asserts `screen.kind === 'title' || screen.kind === resumeScreen(state)`.
 */
export function resumeScreen(state: GameState): ScreenKind {
  if (state.ledger !== null) return state.ledger.outcome === 'won' ? 'win' : 'gameOver'
  const run = state.run
  if (run === null) return 'title'
  if (state.combat !== null) return 'combat'
  if (run.lastBattle !== null) return 'battleEnd'
  if (run.pendingDialogue?.source === 'prologue') return 'prologue'
  if (run.town !== null) return 'town'
  if (run.camp !== null) return 'camp'
  if (run.activeDungeon !== null) return 'dungeon'
  return 'overworld'
}
