import { describe, it, expect } from 'vitest';
import { canAttemptCapture, captureChance } from '../../src/game/systems/capture';
import { createUnit } from '../../src/game/entities/Unit';
import { createEnemy } from '../../src/game/entities/Enemy';
import type { Unit, Enemy } from '../../src/data/schemas';

const royData: Unit = {
  id: 'roy', name: 'Roy', class: 'LORD', level: 1,
  stats: { hp: 22, str: 6, mag: 0, skl: 6, spd: 7, lck: 7, def: 5, res: 2, mov: 5 }, deck: ['x'],
};
const banditData: Enemy = {
  id: 'b', name: 'B', level: 1,
  stats: { hp: 18, str: 5, mag: 0, skl: 4, spd: 4, lck: 2, def: 3, res: 1, mov: 4 },
  attack: { damage: 5, range: { min: 1, max: 1 }, type: 'physical' }, ai: 'closest_target',
};

describe('capture', () => {
  it('cannot capture if not adjacent', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    const e = createEnemy(banditData, { x: 5, y: 5 });
    expect(canAttemptCapture(u, e)).toBe(false);
  });

  it('can capture if adjacent', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    const e = createEnemy(banditData, { x: 1, y: 0 });
    expect(canAttemptCapture(u, e)).toBe(true);
  });

  it('chance scales with low HP', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    const fullHp = createEnemy(banditData, { x: 1, y: 0 });
    const lowHp = createEnemy(banditData, { x: 1, y: 0 });
    lowHp.currentHp = 2;
    expect(captureChance(u, fullHp, [])).toBeLessThan(captureChance(u, lowHp, []));
  });

  it('chance scales with adjacent allies (surround)', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    const e = createEnemy(banditData, { x: 1, y: 0 });
    const ally = createUnit({ ...royData, id: 'm' }, { x: 2, y: 0 });
    e.currentHp = 5;
    const aloneChance = captureChance(u, e, []);
    const surrounded = captureChance(u, e, [ally]);
    expect(surrounded).toBeGreaterThan(aloneChance);
  });
});
