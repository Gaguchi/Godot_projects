import classesJson from '../../data/content/classes.json'
import { asUnitId, asClassId, asCardId, asTileId } from '../../domain/ids'
import type { Unit } from '../../domain/unit'
import type { CombatEvent, CombatGrid, DeckState } from '../../domain/combatState'
import type { RngState } from '../../domain/rng'

/**
 * Stub battle bootstrapper. Returns a `startBattle` CombatEvent with three
 * party members (Roy/Marcus/Lilina) on the left and three Bandit enemies on
 * the right of a 14×10 grid.
 *
 * Pure function — no Phaser, no React, no I/O. CombatScene calls this when
 * `state.phase === 'BOOT'` to seed an initial battle.
 *
 * Spawn zones:
 *   - Party: columns 0-2 (left side)
 *   - Enemies: columns 11-13 (right side)
 */
export function seedStubBattle(rngSeed: RngState): Extract<CombatEvent, { type: 'startBattle' }> {
  const classMap = new Map(classesJson.map((c) => [c.id, c]))
  const find = (id: string): typeof classesJson[number] => {
    const c = classMap.get(id)
    if (!c) throw new Error(`seedStubBattle: missing class ${id}`)
    return c
  }

  const lord = find('lord')
  const knight = find('knight')
  const mage = find('mage')
  const bandit = find('bandit')

  const mk = (
    id: string,
    name: string,
    cls: typeof lord,
    x: number,
    y: number,
  ): Unit => ({
    id: asUnitId(id),
    name,
    classId: asClassId(cls.id),
    level: 1,
    hp: { current: cls.startingHp, max: cls.startingHp },
    stats: { ...cls.baseStats },
    position: asTileId(`${x},${y}`),
    ap: 3,
    armor: 0,
    statuses: [],
  })

  const units: Unit[] = [
    // Party — left columns
    mk('roy', 'Roy', lord, 1, 4),
    mk('marcus', 'Marcus', knight, 1, 5),
    mk('lilina', 'Lilina', mage, 0, 4),
    // Enemies — right columns
    mk('bandit_a', 'Bandit', bandit, 12, 4),
    mk('bandit_b', 'Bandit', bandit, 12, 5),
    mk('bandit_c', 'Bandit', bandit, 13, 4),
  ]

  // Build a starter deck for each unit from class.innateCardIds. Hand =
  // innate cards (4-5); draw pile is one extra copy so reshuffle has fuel.
  const decks: Record<string, DeckState> = {}
  const classFor = (classId: string): typeof lord => {
    const c = classMap.get(classId)
    if (!c) throw new Error(`seedStubBattle: missing class ${classId}`)
    return c
  }
  for (const u of units) {
    const cls = classFor(u.classId as unknown as string)
    const cardIds = cls.innateCardIds.map((id) => asCardId(id))
    decks[u.id as unknown as string] = {
      draw: [...cardIds],
      hand: [...cardIds],
      discard: [],
    }
  }

  const grid: CombatGrid = {
    width: 14,
    height: 10,
    obstacles: new Set(),
  }

  return {
    type: 'startBattle',
    payload: { units, grid, rngSeed, decks },
  }
}
