import { create } from 'zustand';
import type { UnitInstance } from '../game/entities/Unit';
import type { EnemyInstance } from '../game/entities/Enemy';

export type CombatPhase = 'BOOT' | 'DEPLOY' | 'COMBAT' | 'VICTORY' | 'DEFEAT';
export type SubPhase = 'IDLE' | 'SELECTING_CARD' | 'SELECTING_TARGET' | 'RESOLVING';

export interface GridCoord {
  readonly x: number;
  readonly y: number;
}

interface CombatState {
  phase: CombatPhase;
  subPhase: SubPhase;
  selectedCardId: string | null;
  hoveredTile: GridCoord | null;
  ap: number;
  party: UnitInstance[];
  enemies: EnemyInstance[];
  setPhase: (p: CombatPhase) => void;
  setSubPhase: (p: SubPhase) => void;
  selectCard: (cardId: string) => void;
  cancelSelection: () => void;
  setHoveredTile: (tile: GridCoord | null) => void;
  setAP: (n: number) => void;
  spendAP: (n: number) => void;
  setBattle: (party: UnitInstance[], enemies: EnemyInstance[]) => void;
  reset: () => void;
}

const initial = {
  phase: 'BOOT' as CombatPhase,
  subPhase: 'IDLE' as SubPhase,
  selectedCardId: null,
  hoveredTile: null,
  ap: 0,
  party: [] as UnitInstance[],
  enemies: [] as EnemyInstance[],
};

export const useCombatStore = create<CombatState>((set) => ({
  ...initial,
  setPhase: (phase) => set({ phase }),
  setSubPhase: (subPhase) => set({ subPhase }),
  selectCard: (cardId) => set({ selectedCardId: cardId, subPhase: 'SELECTING_TARGET' }),
  cancelSelection: () => set({ selectedCardId: null, subPhase: 'IDLE', hoveredTile: null }),
  setHoveredTile: (hoveredTile) => set({ hoveredTile }),
  setAP: (ap) => set({ ap }),
  spendAP: (n) => set((s) => ({ ap: Math.max(0, s.ap - n) })),
  setBattle: (party, enemies) => set({ party, enemies }),
  reset: () => set(initial),
}));
