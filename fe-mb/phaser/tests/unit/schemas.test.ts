import { describe, it, expect } from 'vitest';
import { CardSchema, UnitSchema, EnemySchema } from '../../src/data/schemas';

describe('CardSchema', () => {
  it('accepts a valid attack card', () => {
    const card = {
      id: 'iron_strike',
      name: 'Iron Strike',
      cost: 1,
      damage_base: 4,
      stat: 'STR',
      target: 'ENEMY',
      range: { min: 1, max: 1 },
      aoe: { shape: 'single', radius: 0 },
      description: 'Single target attack.',
    };
    expect(CardSchema.parse(card)).toEqual(card);
  });

  it('rejects negative cost', () => {
    const bad = { id: 'x', name: 'X', cost: -1, damage_base: 0, stat: 'STR',
      target: 'ENEMY', range: { min: 1, max: 1 },
      aoe: { shape: 'single', radius: 0 }, description: '' };
    expect(() => CardSchema.parse(bad)).toThrow();
  });

  it('accepts AOE card', () => {
    const fireball = {
      id: 'fireball', name: 'Fireball', cost: 2, damage_base: 5,
      stat: 'MAG', target: 'GROUND',
      range: { min: 2, max: 4 },
      aoe: { shape: 'circle', radius: 1 },
      description: 'AOE.',
    };
    expect(CardSchema.parse(fireball)).toEqual(fireball);
  });
});

describe('UnitSchema', () => {
  it('accepts a valid unit', () => {
    const roy = {
      id: 'roy', name: 'Roy', class: 'LORD', level: 1,
      stats: { hp: 22, str: 6, mag: 0, skl: 6, spd: 7, lck: 7, def: 5, res: 2, mov: 5 },
      deck: ['iron_strike', 'iron_strike', 'iron_strike'],
    };
    expect(UnitSchema.parse(roy)).toEqual(roy);
  });
});

describe('EnemySchema', () => {
  it('accepts a valid enemy', () => {
    const bandit = {
      id: 'bandit', name: 'Bandit', level: 1,
      stats: { hp: 18, str: 5, mag: 0, skl: 4, spd: 4, lck: 2, def: 3, res: 1, mov: 4 },
      attack: { damage: 5, range: { min: 1, max: 1 }, type: 'physical' },
      ai: 'closest_target',
    };
    expect(EnemySchema.parse(bandit)).toEqual(bandit);
  });
});
