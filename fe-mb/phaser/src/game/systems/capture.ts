import type { UnitInstance } from '../entities/Unit';
import type { EnemyInstance } from '../entities/Enemy';

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function canAttemptCapture(u: UnitInstance, e: EnemyInstance): boolean {
  return e.alive && manhattan(u.pos, e.pos) === 1;
}

export function captureChance(
  _attacker: UnitInstance,
  enemy: EnemyInstance,
  adjacentAllies: UnitInstance[],
): number {
  const hpFraction = enemy.currentHp / enemy.data.stats.hp;
  const baseChance = (1 - hpFraction) * 0.6; // up to 60% from HP
  const surroundBonus = adjacentAllies.filter(a =>
    a.alive && manhattan(a.pos, enemy.pos) === 1
  ).length * 0.25;
  return Math.min(0.95, baseChance + surroundBonus);
}

export function attemptCapture(
  attacker: UnitInstance,
  enemy: EnemyInstance,
  adjacentAllies: UnitInstance[],
): boolean {
  const chance = captureChance(attacker, enemy, adjacentAllies);
  // attacker is passed through for future stat-based modifiers
  return Math.random() < chance;
}
