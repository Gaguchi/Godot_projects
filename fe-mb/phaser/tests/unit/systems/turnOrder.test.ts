import { describe, it, expect } from 'vitest'
import { buildInitiativeQueue } from '../../../src/systems/turnOrder'
import type { Unit } from '../../../src/domain/unit'
import { asUnitId, asClassId } from '../../../src/domain/ids'

const mk = (id: string, spd: number): Unit => ({
  id: asUnitId(id), name: id, classId: asClassId('lord'), level: 1,
  hp: { current: 1, max: 1 }, stats: { str: 0, mag: 0, skl: 0, spd, def: 0, res: 0 },
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
})
