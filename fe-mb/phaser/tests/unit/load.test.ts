import { describe, it, expect } from 'vitest';
import { loadGameData } from '../../src/data/load';

describe('loadGameData', () => {
  it('loads and validates all data files', () => {
    const data = loadGameData();
    expect(data.cards).toHaveLength(9);
    expect(data.units).toHaveLength(3);
    expect(data.enemies).toHaveLength(3);
    expect(data.cards.find(c => c.id === 'iron_strike')).toBeDefined();
    expect(data.units.find(u => u.id === 'roy')?.deck).toHaveLength(12);
  });

  it('exposes lookup maps', () => {
    const data = loadGameData();
    expect(data.cardById('iron_strike')?.name).toBe('Iron Strike');
    expect(data.unitById('roy')?.class).toBe('LORD');
    expect(data.enemyById('bandit')?.stats.hp).toBe(18);
  });

  it('returns undefined for unknown ids', () => {
    const data = loadGameData();
    expect(data.cardById('xxx')).toBeUndefined();
  });
});
