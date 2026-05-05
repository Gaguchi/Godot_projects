import type { Unit as UnitData, StatBlock } from '../../data/schemas';
import type { GridCoord } from '../render/gridRenderer';

export interface UnitInstance {
  data: UnitData;
  pos: GridCoord;
  currentHp: number;
  hand: string[]; // card IDs
  draw: string[];
  discard: string[];
  alive: boolean;
}

export function createUnit(data: UnitData, pos: GridCoord): UnitInstance {
  return {
    data,
    pos: { ...pos },
    currentHp: data.stats.hp,
    hand: [],
    draw: [...data.deck],
    discard: [],
    alive: true,
  };
}

export function applyDamage(u: UnitInstance, amount: number): void {
  u.currentHp = Math.max(0, Math.min(u.data.stats.hp, u.currentHp - amount));
  if (u.currentHp === 0) u.alive = false;
}

export function isDead(u: UnitInstance): boolean {
  return !u.alive;
}

export function statValue(u: UnitInstance, stat: keyof StatBlock): number {
  return u.data.stats[stat];
}
