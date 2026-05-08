import { describe, it, expect } from 'vitest'
import { CardSchema, ItemSchema, ClassSchema, QuestSchema, DialogueTreeSchema, BattleMapSchema, WorldMapSchema, PredicateSchema } from '../../../src/data/schemas'

describe('Zod schemas', () => {
  it('CardSchema parses valid card JSON', () => {
    expect(() => CardSchema.parse({
      id: 'slash', name: 'Slash', apCost: 1,
      effects: [{ kind: 'Damage', params: { base: 4, stat: 'str' } }],
      range: { min: 1, max: 1 }, targetKind: 'enemy', weaponType: 'sword', damageStat: 'str',
    })).not.toThrow()
  })

  it('rejects card with negative apCost', () => {
    expect(() => CardSchema.parse({
      id: 'x', name: 'X', apCost: -1, effects: [], range: { min: 1, max: 1 },
      targetKind: 'enemy', weaponType: null,
    })).toThrow()
  })

  it('PredicateSchema parses recursive allOf', () => {
    expect(() => PredicateSchema.parse({
      kind: 'allOf',
      preds: [
        { kind: 'flag', key: 'a' },
        { kind: 'not', pred: { kind: 'flag', key: 'b' } },
      ],
    })).not.toThrow()
  })

  it('QuestSchema parses minimal quest', () => {
    expect(() => QuestSchema.parse({
      id: 'q1', name: 'Quest 1', initialStage: 's1',
      stages: { s1: { id: 's1', onEnter: [], listeners: [], transitions: [], onExit: [] } },
    })).not.toThrow()
  })

  it('BattleMapSchema enforces 14x10', () => {
    expect(() => BattleMapSchema.parse({
      id: 'b1', width: 12, height: 10,
      terrain: [], spawnZones: { party: [], enemy: [] },
      obstacles: [], source: 'handcrafted',
    })).toThrow()
  })

  // Smoke-touch remaining imports so tsc's noUnusedLocals stays happy without
  // changing the spec semantics.
  it('imports all listed schemas', () => {
    expect(typeof ItemSchema.parse).toBe('function')
    expect(typeof ClassSchema.parse).toBe('function')
    expect(typeof DialogueTreeSchema.parse).toBe('function')
    expect(typeof WorldMapSchema.parse).toBe('function')
  })
})
