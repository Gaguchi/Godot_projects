import { describe, it, expect } from 'vitest';
import { drawCards, discardHand, reshuffleIfNeeded } from '../../src/game/systems/deckManager';
import { createUnit } from '../../src/game/entities/Unit';
import type { Unit } from '../../src/data/schemas';

function makeUnit(): ReturnType<typeof createUnit> {
  const data: Unit = {
    id: 'test', name: 'T', class: 'LORD', level: 1,
    stats: { hp: 1, str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0, mov: 1 },
    deck: ['a','a','a','b','b','b','c','c','c','d','d','d'],
  };
  return createUnit(data, { x: 0, y: 0 });
}

describe('deckManager', () => {
  it('draws N cards from draw pile to hand', () => {
    const u = makeUnit();
    drawCards(u, 5);
    expect(u.hand).toHaveLength(5);
    expect(u.draw).toHaveLength(7);
  });

  it('does not mutate the original deck array (reference safety)', () => {
    const u = makeUnit();
    const originalDeck = u.data.deck;
    drawCards(u, 5);
    expect(u.data.deck).toBe(originalDeck);
    expect(u.data.deck).toHaveLength(12);
  });

  it('discards hand', () => {
    const u = makeUnit();
    drawCards(u, 5);
    discardHand(u);
    expect(u.hand).toHaveLength(0);
    expect(u.discard).toHaveLength(5);
  });

  it('reshuffles discard into draw when draw is empty', () => {
    const u = makeUnit();
    drawCards(u, 12);
    discardHand(u);
    expect(u.draw).toHaveLength(0);
    expect(u.discard).toHaveLength(12);
    reshuffleIfNeeded(u);
    expect(u.draw).toHaveLength(12);
    expect(u.discard).toHaveLength(0);
  });

  it('drawing past draw pile auto-reshuffles', () => {
    const u = makeUnit();
    drawCards(u, 12);
    discardHand(u);
    drawCards(u, 5);
    expect(u.hand).toHaveLength(5);
    expect(u.draw).toHaveLength(7);
  });
});
