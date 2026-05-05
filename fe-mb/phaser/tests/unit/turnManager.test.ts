import { describe, it, expect } from 'vitest';
import { createTurnManager, advanceTurn } from '../../src/game/systems/turnManager';
import { createUnit } from '../../src/game/entities/Unit';
import { createEnemy } from '../../src/game/entities/Enemy';
import type { Unit, Enemy } from '../../src/data/schemas';

const royData: Unit = {
  id: 'roy', name: 'Roy', class: 'LORD', level: 1,
  stats: { hp: 22, str: 6, mag: 0, skl: 6, spd: 7, lck: 7, def: 5, res: 2, mov: 5 },
  deck: ['x'],
};
const banditData: Enemy = {
  id: 'bandit', name: 'B', level: 1,
  stats: { hp: 18, str: 5, mag: 0, skl: 4, spd: 4, lck: 2, def: 3, res: 1, mov: 4 },
  attack: { damage: 5, range: { min: 1, max: 1 }, type: 'physical' }, ai: 'closest_target',
};

describe('turnManager', () => {
  it('starts with first party unit', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    const e = createEnemy(banditData, { x: 5, y: 5 });
    const tm = createTurnManager([u], [e]);
    expect(tm.currentSide).toBe('party');
    expect(tm.currentActor).toBe(u);
  });

  it('advances party -> enemy -> party', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    const e = createEnemy(banditData, { x: 5, y: 5 });
    const tm = createTurnManager([u], [e]);
    advanceTurn(tm);
    expect(tm.currentSide).toBe('enemy');
    expect(tm.currentActor).toBe(e);
    advanceTurn(tm);
    expect(tm.currentSide).toBe('party');
    expect(tm.currentActor).toBe(u);
  });

  it('skips dead actors', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    const e1 = createEnemy(banditData, { x: 5, y: 5 });
    const e2 = createEnemy(banditData, { x: 6, y: 5 });
    e1.alive = false;
    const tm = createTurnManager([u], [e1, e2]);
    advanceTurn(tm);
    expect(tm.currentActor).toBe(e2);
  });
});
