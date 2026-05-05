import { describe, it, expect } from 'vitest';
import { createUnit, applyDamage, isDead } from '../../src/game/entities/Unit';
import type { Unit } from '../../src/data/schemas';

const royData: Unit = {
  id: 'roy', name: 'Roy', class: 'LORD', level: 1,
  stats: { hp: 22, str: 6, mag: 0, skl: 6, spd: 7, lck: 7, def: 5, res: 2, mov: 5 },
  deck: ['iron_strike'],
};

describe('Unit entity', () => {
  it('starts with full HP', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    expect(u.currentHp).toBe(22);
    expect(isDead(u)).toBe(false);
  });

  it('takes damage', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    applyDamage(u, 10);
    expect(u.currentHp).toBe(12);
  });

  it('cannot drop below 0', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    applyDamage(u, 100);
    expect(u.currentHp).toBe(0);
    expect(isDead(u)).toBe(true);
  });

  it('heal does not exceed max', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    applyDamage(u, 5);
    applyDamage(u, -10); // negative damage = heal
    expect(u.currentHp).toBe(22);
  });
});
