import type { UnitInstance } from '../entities/Unit';
import type { EnemyInstance } from '../entities/Enemy';
import type { GridCoord } from '../render/gridRenderer';

export type EnemyAction =
  | { kind: 'move'; to: GridCoord }
  | { kind: 'attack'; target: UnitInstance }
  | { kind: 'wait' };

function manhattan(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function decideEnemyAction(
  enemy: EnemyInstance,
  party: UnitInstance[],
): EnemyAction {
  const alive = party.filter(p => p.alive);
  if (alive.length === 0) return { kind: 'wait' };

  // Closest alive unit
  let closest = alive[0]!;
  let bestDist = manhattan(enemy.pos, closest.pos);
  for (const p of alive) {
    const d = manhattan(enemy.pos, p.pos);
    if (d < bestDist) { closest = p; bestDist = d; }
  }

  // In attack range?
  if (bestDist >= enemy.data.attack.range.min && bestDist <= enemy.data.attack.range.max) {
    return { kind: 'attack', target: closest };
  }

  // Step toward closest, up to mov tiles
  const stepCount = Math.min(enemy.data.stats.mov, bestDist - 1);
  const dx = Math.sign(closest.pos.x - enemy.pos.x);
  const dy = Math.sign(closest.pos.y - enemy.pos.y);
  let nx = enemy.pos.x;
  let ny = enemy.pos.y;
  let stepsLeft = stepCount;
  // Greedy: prioritize axis with greater distance
  while (stepsLeft > 0) {
    const ddx = closest.pos.x - nx;
    const ddy = closest.pos.y - ny;
    if (Math.abs(ddx) >= Math.abs(ddy) && dx !== 0) { nx += dx; }
    else if (dy !== 0) { ny += dy; }
    else if (dx !== 0) { nx += dx; }
    else break;
    stepsLeft--;
  }
  return { kind: 'move', to: { x: nx, y: ny } };
}
