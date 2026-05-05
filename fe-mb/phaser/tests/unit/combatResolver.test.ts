import { describe, it, expect } from 'vitest';
import { resolveCard } from '../../src/game/systems/combatResolver';
import { createUnit } from '../../src/game/entities/Unit';
import { createEnemy } from '../../src/game/entities/Enemy';
import type { Card, Unit, Enemy } from '../../src/data/schemas';

const ironStrike: Card = {
  id: 'iron_strike', name: 'Iron Strike', cost: 1, damage_base: 4,
  stat: 'STR', target: 'ENEMY', range: { min: 1, max: 1 },
  aoe: { shape: 'single', radius: 0 }, description: '',
};

const heal: Card = {
  id: 'heal', name: 'Heal', cost: 1, damage_base: -6, stat: 'MAG',
  target: 'ALLY', range: { min: 1, max: 2 },
  aoe: { shape: 'single', radius: 0 }, description: '',
};

const fireball: Card = {
  id: 'fireball', name: 'Fireball', cost: 2, damage_base: 5, stat: 'MAG',
  target: 'GROUND', range: { min: 2, max: 4 },
  aoe: { shape: 'circle', radius: 1 }, description: '',
};

const royData: Unit = {
  id: 'roy', name: 'Roy', class: 'LORD', level: 1,
  stats: { hp: 22, str: 6, mag: 0, skl: 6, spd: 7, lck: 7, def: 5, res: 2, mov: 5 },
  deck: ['iron_strike'],
};

const lilinaData: Unit = {
  id: 'lilina', name: 'Lilina', class: 'MAGE', level: 1,
  stats: { hp: 16, str: 2, mag: 8, skl: 5, spd: 4, lck: 6, def: 2, res: 6, mov: 4 },
  deck: ['fireball'],
};

const banditData: Enemy = {
  id: 'bandit', name: 'Bandit', level: 1,
  stats: { hp: 18, str: 5, mag: 0, skl: 4, spd: 4, lck: 2, def: 3, res: 1, mov: 4 },
  attack: { damage: 5, range: { min: 1, max: 1 }, type: 'physical' },
  ai: 'closest_target',
};

describe('resolveCard', () => {
  it('applies physical damage with DR', () => {
    // Iron Strike: 4 + 6 (STR) - floor(3/2) = 9
    const roy = createUnit(royData, { x: 0, y: 0 });
    const bandit = createEnemy(banditData, { x: 1, y: 0 });
    const result = resolveCard(ironStrike, roy, [bandit]);
    expect(result.targets).toHaveLength(1);
    expect(result.targets[0]?.damage).toBe(9);
    expect(bandit.currentHp).toBe(9);
  });

  it('applies magic damage to RES', () => {
    // Fireball: 5 + 8 (MAG) - floor(1/2) = 13
    const lilina = createUnit(lilinaData, { x: 0, y: 0 });
    const bandit = createEnemy(banditData, { x: 3, y: 0 });
    const result = resolveCard(fireball, lilina, [bandit]);
    expect(result.targets[0]?.damage).toBe(13);
  });

  it('heal applies as negative damage to ally', () => {
    const roy = createUnit(royData, { x: 0, y: 0 });
    roy.currentHp = 10;
    const result = resolveCard(heal, roy, [roy]);
    expect(result.targets[0]?.damage).toBe(-6);
    expect(roy.currentHp).toBe(16);
  });

  it('clamps damage to 0 minimum (no negative-damage heals from attacks)', () => {
    // Mage with 0 STR vs high-DEF target
    const wimp: Unit = { ...royData, stats: { ...royData.stats, str: 0 } };
    const tank: Enemy = { ...banditData, stats: { ...banditData.stats, def: 50 } };
    const u = createUnit(wimp, { x: 0, y: 0 });
    const e = createEnemy(tank, { x: 1, y: 0 });
    const result = resolveCard(ironStrike, u, [e]);
    expect(result.targets[0]?.damage).toBe(0);
  });
});
