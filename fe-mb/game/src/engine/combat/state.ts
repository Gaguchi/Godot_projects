/**
 * combat/state.ts — immutable-update helpers shared by every combat module (ARCHITECTURE §7: reducers
 * return new objects; inputs are never mutated). No rule lives here — it only spells the copy-on-write
 * pattern once so no module reaches into `state.units[...]` by hand.
 */
import type { CombatState, CombatUnit, DeckState, UnitId } from '../types'

/** A missing unit id in combat state is a programmer error (§7.20), never player input. */
export function unitOrThrow(state: CombatState, id: UnitId): CombatUnit {
  const u = state.units[id]
  if (u === undefined) throw new Error(`combat: unknown unit '${id}'`)
  return u
}

export function withUnit(state: CombatState, unit: CombatUnit): CombatState {
  return { ...state, units: { ...state.units, [unit.id]: unit } }
}

export function withDeck(state: CombatState, unitId: UnitId, deck: DeckState): CombatState {
  return { ...state, decks: { ...state.decks, [unitId]: deck } }
}
