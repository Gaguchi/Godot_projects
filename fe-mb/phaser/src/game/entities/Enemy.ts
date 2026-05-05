import type { Enemy as EnemyData } from '../../data/schemas';
import type { GridCoord } from '../render/gridRenderer';

export interface EnemyInstance {
  data: EnemyData;
  pos: GridCoord;
  currentHp: number;
  alive: boolean;
}

export function createEnemy(data: EnemyData, pos: GridCoord): EnemyInstance {
  return {
    data,
    pos: { ...pos },
    currentHp: data.stats.hp,
    alive: true,
  };
}

export function applyDamageEnemy(e: EnemyInstance, amount: number): void {
  e.currentHp = Math.max(0, Math.min(e.data.stats.hp, e.currentHp - amount));
  if (e.currentHp === 0) e.alive = false;
}
