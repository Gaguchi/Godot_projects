import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { CombatState, CombatEvent, CombatEffect } from '../domain/combatState'
import type { RNG } from '../domain/rng'
import { reduce, initialCombatState } from '../systems/combatReducer'

export interface CombatStoreState {
  state: CombatState
  effectQueue: CombatEffect[]
  lastEffectId: number
  dispatch(event: CombatEvent, rng: RNG): void
  drainEffects(): CombatEffect[]
  __resetForTest(): void
}

export const useCombatStore = create<CombatStoreState>()(
  subscribeWithSelector((set, get) => ({
    state: initialCombatState(),
    effectQueue: [],
    lastEffectId: 0,
    dispatch(event, rng) {
      const { state: nextState, effects } = reduce(get().state, event, rng)
      set(s => ({
        state: nextState,
        effectQueue: [...s.effectQueue, ...effects],
        lastEffectId: s.lastEffectId + 1,
      }))
    },
    drainEffects() {
      const out = get().effectQueue
      set({ effectQueue: [] })
      return out
    },
    __resetForTest() {
      set({ state: initialCombatState(), effectQueue: [], lastEffectId: 0 })
    },
  }))
)
