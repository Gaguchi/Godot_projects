import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { CombatState, CombatEvent, CombatEffect } from '../domain/combatState'
import type { RNG } from '../domain/rng'

export interface CombatStoreState {
  state: CombatState | null
  effectQueue: CombatEffect[]
  lastEffectId: number      // event-shaped subscription target
  dispatch(event: CombatEvent, rng: RNG): void
  drainEffects(): CombatEffect[]
  __resetForTest(): void
}

export const useCombatStore = create<CombatStoreState>()(
  subscribeWithSelector((set, get) => ({
    state: null,
    effectQueue: [],
    lastEffectId: 0,
    dispatch(_event, _rng) {
      // Real reducer wiring lands in Task 29 (after combatReducer in Task 28).
      // For now: each dispatch advances lastEffectId so subscribers fire.
      set(s => ({ lastEffectId: s.lastEffectId + 1 }))
    },
    drainEffects() {
      const out = get().effectQueue
      set({ effectQueue: [] })
      return out
    },
    __resetForTest() { set({ state: null, effectQueue: [], lastEffectId: 0 }) },
  }))
)
