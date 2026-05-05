import type { UnitInstance } from '../entities/Unit';
import type { EnemyInstance } from '../entities/Enemy';

export type Side = 'party' | 'enemy';

export interface TurnManager {
  party: UnitInstance[];
  enemies: EnemyInstance[];
  partyIdx: number;
  enemyIdx: number;
  currentSide: Side;
  currentActor: UnitInstance | EnemyInstance;
}

export function createTurnManager(
  party: UnitInstance[],
  enemies: EnemyInstance[],
): TurnManager {
  if (party.length === 0) throw new Error('party cannot be empty');
  if (enemies.length === 0) throw new Error('enemies cannot be empty');
  return {
    party, enemies,
    partyIdx: 0, enemyIdx: 0,
    currentSide: 'party',
    currentActor: party[0]!,
  };
}

export function advanceTurn(tm: TurnManager): void {
  if (tm.currentSide === 'party') {
    tm.currentSide = 'enemy';
    tm.enemyIdx = nextAliveIdx(tm.enemies, tm.enemyIdx);
    tm.currentActor = tm.enemies[tm.enemyIdx]!;
  } else {
    tm.currentSide = 'party';
    tm.partyIdx = nextAliveIdx(tm.party, tm.partyIdx);
    tm.currentActor = tm.party[tm.partyIdx]!;
  }
}

function nextAliveIdx<T extends { alive: boolean }>(arr: T[], from: number): number {
  for (let i = 1; i <= arr.length; i++) {
    const idx = (from + i) % arr.length;
    if (arr[idx]?.alive) return idx;
  }
  return from;
}
