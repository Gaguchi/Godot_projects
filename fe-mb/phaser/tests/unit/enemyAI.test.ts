import { describe, it, expect } from 'vitest';
import { decideEnemyAction } from '../../src/game/systems/enemyAI';
import { createUnit } from '../../src/game/entities/Unit';
import { createEnemy } from '../../src/game/entities/Enemy';
import type { Unit, Enemy } from '../../src/data/schemas';

const banditData: Enemy = {
  id: 'bandit', name: 'B', level: 1,
  stats: { hp: 18, str: 5, mag: 0, skl: 4, spd: 4, lck: 2, def: 3, res: 1, mov: 4 },
  attack: { damage: 5, range: { min: 1, max: 1 }, type: 'physical' }, ai: 'closest_target',
};
const royData: Unit = {
  id: 'roy', name: 'Roy', class: 'LORD', level: 1,
  stats: { hp: 22, str: 6, mag: 0, skl: 6, spd: 7, lck: 7, def: 5, res: 2, mov: 5 },
  deck: ['x'],
};

describe('decideEnemyAction', () => {
  it('moves toward closest party unit', () => {
    const e = createEnemy(banditData, { x: 10, y: 5 });
    const u = createUnit(royData, { x: 5, y: 5 });
    const action = decideEnemyAction(e, [u]);
    expect(action.kind).toBe('move');
    if (action.kind === 'move') {
      // Should move 4 tiles (mov=4) toward Roy
      expect(action.to.x).toBeLessThan(e.pos.x);
    }
  });

  it('attacks when adjacent', () => {
    const e = createEnemy(banditData, { x: 5, y: 5 });
    const u = createUnit(royData, { x: 6, y: 5 });
    const action = decideEnemyAction(e, [u]);
    expect(action.kind).toBe('attack');
    if (action.kind === 'attack') {
      expect(action.target).toBe(u);
    }
  });

  it('skips dead targets', () => {
    const e = createEnemy(banditData, { x: 5, y: 5 });
    const u1 = createUnit(royData, { x: 6, y: 5 });
    const u2 = createUnit({ ...royData, id: 'm' }, { x: 8, y: 5 });
    u1.alive = false;
    const action = decideEnemyAction(e, [u1, u2]);
    expect(action.kind).toBe('move');
  });
});
