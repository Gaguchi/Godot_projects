import { describe, it, expect } from 'vitest'
import { buildInitiativeQueue } from '../../../src/systems/turnOrder'
import type { Unit } from '../../../src/domain/unit'
import { asUnitId, asClassId } from '../../../src/domain/ids'

const mk = (id: string, spd: number): Unit => ({
  id: asUnitId(id), name: id, classId: asClassId('lord'), level: 1,
  hp: { current: 1, max: 1 }, stats: { str: 0, mag: 0, skl: 0, spd, def: 0, res: 0, lck: 0 },
  position: null, ap: 3, armor: 0, statuses: [],
})

describe('buildInitiativeQueue', () => {
  it('orders by SPD descending', () => {
    const q = buildInitiativeQueue([mk('a', 5), mk('b', 8), mk('c', 3)])
    expect(q.map(id => id as unknown as string)).toEqual(['b', 'a', 'c'])
  })

  it('tie-breaks alphabetically by id', () => {
    const q = buildInitiativeQueue([mk('z', 5), mk('a', 5)])
    expect(q.map(id => id as unknown as string)).toEqual(['a', 'z'])
  })

  it('applies SPD modifiers', () => {
    const q = buildInitiativeQueue(
      [mk('a', 5), mk('b', 7)],
      [{ unitId: asUnitId('b'), spdDelta: -3 }],
    )
    expect(q.map(id => id as unknown as string)).toEqual(['a', 'b'])
  })

  it('party beats enemy on SPD tie (FE-style)', () => {
    const partyUnit = mk('roy', 5)
    const enemyUnit: Unit = { ...mk('bandit_a', 5), classId: asClassId('bandit') }
    const q = buildInitiativeQueue([enemyUnit, partyUnit])
    expect(q.map(id => id as unknown as string)).toEqual(['roy', 'bandit_a'])
  })

  it('SPD tie within team falls back to alphabetic id', () => {
    const enemy1: Unit = { ...mk('bandit_z', 5), classId: asClassId('bandit') }
    const enemy2: Unit = { ...mk('bandit_a', 5), classId: asClassId('bandit') }
    const q = buildInitiativeQueue([enemy1, enemy2])
    expect(q.map(id => id as unknown as string)).toEqual(['bandit_a', 'bandit_z'])
  })

  it('full mixed group: SPD desc, party-first within tie', () => {
    const units: Unit[] = [
      mk('roy', 5),
      { ...mk('bandit_a', 5), classId: asClassId('bandit') },
      mk('lilina', 5),
      { ...mk('bandit_b', 4), classId: asClassId('bandit') },
      mk('marcus', 3),
    ]
    const q = buildInitiativeQueue(units).map((id) => id as unknown as string)
    // SPD 5 ties: party first (lilina, roy alpha), then bandit_a; SPD 4: bandit_b; SPD 3: marcus
    expect(q).toEqual(['lilina', 'roy', 'bandit_a', 'bandit_b', 'marcus'])
  })
})
