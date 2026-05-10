import type { Unit } from '../domain/unit'
import { asUnitId, asClassId, asTileId } from '../domain/ids'

/**
 * Reusable mock data for Storybook stories. These are NOT for production:
 * stories load them via decorators in `src/storybook/decorators.tsx`.
 */

export const mockRoy = (): Unit => ({
  id: asUnitId('roy'),
  name: 'Roy',
  classId: asClassId('lord'),
  level: 5,
  hp: { current: 22, max: 22 },
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1, lck: 4 },
  position: asTileId('1,4'),
  ap: 3,
  armor: 0,
  statuses: [],
})

export const mockMarcus = (): Unit => ({
  id: asUnitId('marcus'),
  name: 'Marcus',
  classId: asClassId('knight'),
  level: 5,
  hp: { current: 28, max: 28 },
  stats: { str: 7, mag: 0, skl: 4, spd: 3, def: 8, res: 1, lck: 2 },
  position: asTileId('2,4'),
  ap: 3,
  armor: 0,
  statuses: [],
})

export const mockLilina = (): Unit => ({
  id: asUnitId('lilina'),
  name: 'Lilina',
  classId: asClassId('mage'),
  level: 5,
  hp: { current: 18, max: 18 },
  stats: { str: 1, mag: 7, skl: 5, spd: 5, def: 2, res: 7, lck: 3 },
  position: asTileId('1,3'),
  ap: 3,
  armor: 0,
  statuses: [],
})

export const mockBandit = (id = 'bandit_a', position = '6,4'): Unit => ({
  id: asUnitId(id),
  name: 'Bandit',
  classId: asClassId('bandit'),
  level: 3,
  hp: { current: 18, max: 18 },
  stats: { str: 5, mag: 0, skl: 3, spd: 4, def: 2, res: 1, lck: 2 },
  position: asTileId(position),
  ap: 3,
  armor: 0,
  statuses: [],
})

export const mockBanditArcher = (id = 'bandit_archer', position = '8,3'): Unit => ({
  id: asUnitId(id),
  name: 'Bandit Archer',
  classId: asClassId('bandit'),
  level: 3,
  hp: { current: 14, max: 14 },
  stats: { str: 4, mag: 0, skl: 5, spd: 5, def: 2, res: 1, lck: 2 },
  position: asTileId(position),
  ap: 3,
  armor: 0,
  statuses: [],
})

export const mockParty = (): Unit[] => [mockRoy(), mockMarcus(), mockLilina()]

export const mockEnemies = (): Unit[] => [
  mockBandit('bandit_a', '6,4'),
  mockBandit('bandit_b', '7,5'),
  mockBanditArcher('bandit_archer', '8,3'),
]
