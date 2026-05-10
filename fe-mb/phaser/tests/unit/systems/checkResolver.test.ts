import { describe, it, expect } from 'vitest'
import { evaluateCheck, getCheckCandidates } from '../../../src/systems/checkResolver'
import type { Unit } from '../../../src/domain/unit'
import { asUnitId, asClassId } from '../../../src/domain/ids'

const mk = (id: string, classId: string, str: number, lck = 0, hp = 20): Unit => ({
  id: asUnitId(id),
  name: id.toUpperCase(),
  classId: asClassId(classId),
  level: 1,
  hp: { current: hp, max: 20 },
  stats: { str, mag: 0, skl: 4, spd: 5, def: 3, res: 1, lck },
  position: null,
  ap: 3,
  armor: 0,
  statuses: [],
})

describe('evaluateCheck', () => {
  const baseParty = { gold: 50, foodCount: 3, party: [mk('roy', 'lord', 5), mk('marc', 'knight', 8)] }

  it('stat: passes when attempting unit meets threshold', () => {
    const u = baseParty.party[1]!
    expect(evaluateCheck({ kind: 'stat', stat: 'str', threshold: 7 }, u, baseParty)).toBe(true)
  })

  it('stat: fails when attempting unit below threshold', () => {
    const u = baseParty.party[0]!
    expect(evaluateCheck({ kind: 'stat', stat: 'str', threshold: 7 }, u, baseParty)).toBe(false)
  })

  it('stat: fails when attempting unit is null', () => {
    expect(evaluateCheck({ kind: 'stat', stat: 'str', threshold: 5 }, null, baseParty)).toBe(false)
  })

  it('stat: dead attempting unit fails', () => {
    const dead = mk('dead', 'lord', 99, 0, 0)
    expect(evaluateCheck({ kind: 'stat', stat: 'str', threshold: 5 }, dead, baseParty)).toBe(false)
  })

  it('stat: threshold exactly equal passes', () => {
    const u = mk('exact', 'lord', 7)
    expect(evaluateCheck({ kind: 'stat', stat: 'str', threshold: 7 }, u, baseParty)).toBe(true)
  })

  it('class: passes when at least one living party member has the class', () => {
    expect(evaluateCheck({ kind: 'class', classId: asClassId('knight') }, null, baseParty)).toBe(true)
    expect(evaluateCheck({ kind: 'class', classId: asClassId('cleric') }, null, baseParty)).toBe(false)
  })

  it('class: dead member of the class does not satisfy', () => {
    const onlyDead = { ...baseParty, party: [mk('dead', 'cleric', 5, 0, 0)] }
    expect(evaluateCheck({ kind: 'class', classId: asClassId('cleric') }, null, onlyDead)).toBe(false)
  })

  it('gold: party gold ≥ amount', () => {
    expect(evaluateCheck({ kind: 'gold', amount: 50 }, null, baseParty)).toBe(true)
    expect(evaluateCheck({ kind: 'gold', amount: 51 }, null, baseParty)).toBe(false)
  })

  it('food: party food count ≥ amount', () => {
    expect(evaluateCheck({ kind: 'food', amount: 3 }, null, baseParty)).toBe(true)
    expect(evaluateCheck({ kind: 'food', amount: 4 }, null, baseParty)).toBe(false)
  })
})

describe('getCheckCandidates', () => {
  const party = [
    mk('roy', 'lord', 5),
    mk('marc', 'knight', 8),
    mk('lila', 'mage', 1),
    mk('dead', 'bandit', 9, 0, 0),
  ]

  it('stat: returns living party sorted by stat descending', () => {
    const c = getCheckCandidates({ kind: 'stat', stat: 'str', threshold: 7 }, party)
    expect(c.map((e) => e.unitId as unknown as string)).toEqual(['marc', 'roy', 'lila'])
    expect(c[0]!.statValue).toBe(8)
    expect(c[0]!.meetsThreshold).toBe(true)
    expect(c[2]!.meetsThreshold).toBe(false)
  })

  it('non-stat checks return empty list (no picker needed)', () => {
    expect(getCheckCandidates({ kind: 'class', classId: asClassId('lord') }, party)).toEqual([])
    expect(getCheckCandidates({ kind: 'gold', amount: 100 }, party)).toEqual([])
    expect(getCheckCandidates({ kind: 'food', amount: 1 }, party)).toEqual([])
  })

  it('handles empty party', () => {
    expect(getCheckCandidates({ kind: 'stat', stat: 'str', threshold: 5 }, [])).toEqual([])
  })

  it('lck stat works', () => {
    const lckParty = [mk('a', 'lord', 5, 8), mk('b', 'lord', 5, 2)]
    const c = getCheckCandidates({ kind: 'stat', stat: 'lck', threshold: 4 }, lckParty)
    expect(c[0]!.statValue).toBe(8)
    expect(c[0]!.meetsThreshold).toBe(true)
    expect(c[1]!.meetsThreshold).toBe(false)
  })
})
