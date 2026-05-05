import { describe, it, expect } from 'vitest';
import { validTilesForCard, aoeTilesAt } from '../../src/game/systems/targeting';
import type { Card } from '../../src/data/schemas';

const ironStrike: Card = {
  id: 'iron_strike', name: 'Iron Strike', cost: 1, damage_base: 4,
  stat: 'STR', target: 'ENEMY', range: { min: 1, max: 1 },
  aoe: { shape: 'single', radius: 0 }, description: '',
};

const fireball: Card = {
  id: 'fireball', name: 'Fireball', cost: 2, damage_base: 5,
  stat: 'MAG', target: 'GROUND', range: { min: 2, max: 4 },
  aoe: { shape: 'circle', radius: 1 }, description: '',
};

describe('validTilesForCard', () => {
  it('returns adjacent tiles for melee card', () => {
    const tiles = validTilesForCard(ironStrike, { x: 5, y: 5 });
    expect(tiles).toHaveLength(4); // N, S, E, W
    expect(tiles).toContainEqual({ x: 5, y: 4 });
    expect(tiles).toContainEqual({ x: 5, y: 6 });
    expect(tiles).toContainEqual({ x: 4, y: 5 });
    expect(tiles).toContainEqual({ x: 6, y: 5 });
  });

  it('returns ring of tiles for ranged card', () => {
    const tiles = validTilesForCard(fireball, { x: 5, y: 5 });
    // Manhattan distance 2-4, all in-bounds
    expect(tiles.length).toBeGreaterThan(20);
  });

  it('clips to grid bounds', () => {
    const tiles = validTilesForCard(ironStrike, { x: 0, y: 0 });
    expect(tiles).toHaveLength(2); // E, S only
  });
});

describe('aoeTilesAt', () => {
  it('single AOE returns just the target', () => {
    const tiles = aoeTilesAt(ironStrike, { x: 5, y: 5 });
    expect(tiles).toEqual([{ x: 5, y: 5 }]);
  });

  it('circle radius 1 returns center + 4 neighbors', () => {
    const tiles = aoeTilesAt(fireball, { x: 5, y: 5 });
    expect(tiles).toHaveLength(5);
  });
});
