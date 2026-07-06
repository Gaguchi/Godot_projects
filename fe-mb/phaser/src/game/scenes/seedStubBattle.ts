import classesJson from '../../data/content/classes.json'
import cardsJson from '../../data/content/cards.json'
import { asUnitId, asClassId, asTileId } from '../../domain/ids'
import type { Unit } from '../../domain/unit'
import type { CombatEvent, CombatGrid, DeckState } from '../../domain/combatState'
import type { RngState } from '../../domain/rng'
import { buildDeckForUnit } from '../../systems/deckBuilder'
import { getItemDef } from '../../data/itemRegistry'

const DAMAGE_CARD_IDS = new Set(
  cardsJson.filter(c => c.effects.some(e => e.kind === 'Damage')).map(c => c.id),
)

/**
 * Stub battle bootstrapper. Returns a `startBattle` CombatEvent with party
 * units on the left and three Bandit enemies on the right of a 14×10 grid.
 *
 * Pure function — no Phaser, no React, no I/O. CombatScene calls this when
 * `state.phase === 'BOOT'` to seed an initial battle.
 *
 * Party-resolution:
 *   - If `recruitedParty` is non-empty, use those units (positioned in left
 *     columns) — this is the live recruited party from runStore.
 *   - If empty (pre-recruit boot / page-reload starting state), fall back to
 *     the hardcoded Roy/Marcus/Lilina trio so the battle still seeds.
 *
 * Spawn zones:
 *   - Party: columns 0-2 (left side)
 *   - Enemies: columns 8-9 (engagement-range right side)
 */
export function seedStubBattle(
  rngSeed: RngState,
  recruitedParty: Unit[] = [],
): Extract<CombatEvent, { type: 'startBattle' }> {
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
    team: 'party' | 'enemy' = 'party',
  ): Unit => ({
    id: asUnitId(id),
    name,
    classId: asClassId(cls.id),
    team,
    level: 1,
    hp: { current: cls.startingHp, max: cls.startingHp },
    stats: { ...cls.baseStats },
    position: asTileId(`${x},${y}`),
    ap: 3,
    armor: 0,
    statuses: [],
  })

  // Build the party half of the unit list.
  const PARTY_SLOTS: Array<[number, number]> = [
    [2, 4], [2, 5], [1, 4], [1, 5], [0, 4], [0, 5],
  ]
  const partyUnits: Unit[] = recruitedParty.length > 0
    ? recruitedParty.slice(0, PARTY_SLOTS.length).map((u, i) => {
        const [x, y] = PARTY_SLOTS[i]!
        return { ...u, team: 'party' as const, position: asTileId(`${x},${y}`), ap: 3, armor: 0, statuses: [] }
      })
    : [
        mk('roy', 'Roy', lord, 2, 4),
        mk('marcus', 'Marcus', knight, 2, 5),
        mk('lilina', 'Lilina', mage, 1, 4),
      ]

  const units: Unit[] = [
    ...partyUnits,
    mk('bandit_a', 'Bandit', bandit, 8, 4, 'enemy'),
    mk('bandit_b', 'Bandit', bandit, 8, 5, 'enemy'),
    mk('bandit_c', 'Bandit', bandit, 9, 4, 'enemy'),
  ]

  // Gear-as-deck (ship plan §2): deck = class innates + hand-slot gear cards.
  // Units without gear naturally fall back to innate-only decks.
  const decks: Record<string, DeckState> = {}
  const classFor = (classId: string): typeof lord => {
    const c = classMap.get(classId)
    if (!c) throw new Error(`seedStubBattle: missing class ${classId}`)
    return c
  }
  for (const u of units) {
    const cls = classFor(u.classId as unknown as string)
    decks[u.id as unknown as string] = buildDeckForUnit(u, {
      itemById: getItemDef,
      innateCardIds: cls.innateCardIds,
      cardDealsDamage: id => DAMAGE_CARD_IDS.has(id),
    })
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
