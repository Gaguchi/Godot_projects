import { create } from 'zustand'

/**
 * Lightweight UI-only store for combat-scene chrome that doesn't belong in
 * the combatReducer (no replay implications, no save persistence). Phaser
 * BoardScene writes to it (e.g. on unit click); React HUD reads from it.
 *
 * Keep this small. Anything that affects gameplay state goes through the
 * reducer.
 */
export interface CombatUiState {
  /** Unit whose detail panel is pinned. Null = panel hidden. */
  pinnedDetailUnitId: string | null
  setPinnedDetailUnit(id: string | null): void
}

export const useCombatUiStore = create<CombatUiState>((set) => ({
  pinnedDetailUnitId: null,
  setPinnedDetailUnit: (id) => set({ pinnedDetailUnitId: id }),
}))
