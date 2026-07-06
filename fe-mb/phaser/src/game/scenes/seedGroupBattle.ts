import classesJson from '../../data/content/classes.json'
import cardsJson from '../../data/content/cards.json'
import bandits from '../../data/content/enemyGroups/bandits.json'
import wolves from '../../data/content/enemyGroups/wolves.json'
import brigands from '../../data/content/enemyGroups/brigands.json'
import darens from '../../data/content/enemyGroups/darens_gang.json'
import { asUnitId, asClassId, asTileId } from '../../domain/ids'
import type { Unit } from '../../domain/unit'
import type { CombatEvent, CombatGrid, DeckState } from '../../domain/combatState'
import type { RngState } from '../../domain/rng'
import type { EnemyGroup } from '../../domain/encounter'
import { buildDeckForUnit } from '../../systems/deckBuilder'
import { scaleEnemyForLevel } from '../../systems/difficulty'
import { getItemDef } from '../../data/itemRegistry'

export const ENEMY_GROUPS: Record<string, EnemyGroup> = {
  bandits_small: bandits as EnemyGroup,
  wolves: wolves as EnemyGroup,
  brigands: brigands as EnemyGroup,
  darens_gang: darens as EnemyGroup,
}

const DAMAGE_CARD_IDS = new Set(
  cardsJson.filter(c => c.effects.some(e => e.kind === 'Damage')).map(c => c.id),
)

const PARTY_SLOTS: Array<[number, number]> = [
  [2, 4], [2, 5], [1, 4], [1, 5], [0, 4], [0, 5],
]

/**
 * Seed a battle against a named enemy group scaled to `nodeLevel`
 * (systems/difficulty). Members keep their authored level when it is higher
 * than the node level (named lieutenants stay strong in easy regions).
 * Used by travel-encounter battles; dungeon rooms use seedDungeonBattle.
 */
export function seedGroupBattle(
  enemyGroupId: string,
  nodeLevel: number,
  rngSeed: RngState,
  party: Unit[],
): Extract<CombatEvent, { type: 'startBattle' }> {
  const group = ENEMY_GROUPS[enemyGroupId]
  if (!group) throw new Error(`seedGroupBattle: unknown enemy group ${enemyGroupId}`)

  const classMap = new Map(classesJson.map((c) => [c.id, c]))

  const enemies: Unit[] = []
  let enemyIdx = 0
  for (const member of group.members) {
    const cls = classMap.get(member.classId)
    if (!cls) continue
    for (let i = 0; i < member.count; i++) {
      const level = Math.max(member.level, nodeLevel)
      const scaled = scaleEnemyForLevel(cls.baseStats, cls.startingHp, level)
      const x = 9 + (enemyIdx % 2)
      const y = 3 + Math.floor(enemyIdx / 2) * 2
      enemies.push({
        id: asUnitId(`${enemyGroupId}_${enemyIdx}`),
        name: member.name,
        classId: asClassId(cls.id),
        team: 'enemy',
        level,
        hp: { current: scaled.hp, max: scaled.hp },
        stats: scaled.stats,
        position: asTileId(`${x},${y}`),
        ap: 3,
        armor: 0,
        statuses: [],
      })
      enemyIdx++
    }
  }

  const partyUnits = party.slice(0, PARTY_SLOTS.length).map((u, i) => {
    const [x, y] = PARTY_SLOTS[i]!
    return { ...u, team: 'party' as const, position: asTileId(`${x},${y}`), ap: 3, armor: 0, statuses: [] }
  })

  const units = [...partyUnits, ...enemies]
  const decks: Record<string, DeckState> = {}
  for (const u of units) {
    const cls = classMap.get(u.classId as unknown as string)
    if (!cls) continue
    decks[u.id as unknown as string] = buildDeckForUnit(u, {
      itemById: getItemDef,
      innateCardIds: cls.innateCardIds,
      cardDealsDamage: id => DAMAGE_CARD_IDS.has(id),
    })
  }

  const grid: CombatGrid = { width: 14, height: 10, obstacles: new Set() }
  return { type: 'startBattle', payload: { units, grid, rngSeed, decks } }
}
