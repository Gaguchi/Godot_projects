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
 * The Iron Throne — hand-crafted final boss (ship plan §12).
 * The Warlord (high stats, AOE sweep, executes the weakest) holds the throne
 * with two veteran guards. battleTag 'finalBoss' completes the run on victory.
 */
export function seedBossBattle(
  rngSeed: RngState,
  party: Unit[],
): Extract<CombatEvent, { type: 'startBattle' }> {
  const classMap = new Map(classesJson.map((c) => [c.id, c]))
  const warlord = classMap.get('warlord')
  const bandit = classMap.get('bandit')
  if (!warlord || !bandit) throw new Error('seedBossBattle: missing warlord/bandit class')

  // Boss stats are AUTHORED, not formula-lifted: there is no party leveling
  // yet, so enemy power must scale against GEAR power (see balance notes).
  // The Warlord's threat is HP + armor + the executioner/sweep AI, not raw
  // one-shot damage.
  const mkEnemy = (
    id: string, name: string, cls: typeof warlord, level: number, x: number, y: number,
    over: Partial<Pick<Unit, 'stats' | 'armor'>> & { hp?: number } = {},
  ): Unit => ({
    id: asUnitId(id),
    name,
    classId: asClassId(cls.id),
    team: 'enemy',
    level,
    hp: { current: over.hp ?? cls.startingHp, max: over.hp ?? cls.startingHp },
    stats: { ...cls.baseStats, ...(over.stats ?? {}) },
    position: asTileId(`${x},${y}`),
    ap: 3,
    armor: over.armor ?? 0,
    statuses: [],
  })

  const PARTY_SLOTS: Array<[number, number]> = [
    [2, 4], [2, 5], [1, 4], [1, 5], [0, 4], [0, 5],
  ]
  const partyUnits = party.slice(0, PARTY_SLOTS.length).map((u, i) => {
    const [x, y] = PARTY_SLOTS[i]!
    return { ...u, team: 'party' as const, position: asTileId(`${x},${y}`), ap: 3, armor: 0, statuses: [] }
  })

  const units: Unit[] = [
    ...partyUnits,
    // Slow juggernaut: party acts first, must chew through 55 HP + 6 armor
    // while the sweep punishes clumping and the executioner punishes wounds.
    mkEnemy('warlord_boss', 'The Warlord', warlord, 7, 10, 4, {
      hp: 55, armor: 6, stats: { ...warlord.baseStats, spd: 3 },
    }),
    mkEnemy('throne_guard_a', 'Throne Guard', bandit, 5, 9, 3, { hp: 24, armor: 2 }),
    mkEnemy('throne_guard_b', 'Throne Guard', bandit, 5, 9, 6, { hp: 24, armor: 2 }),
  ]

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

  return {
    type: 'startBattle',
    payload: { units, grid, rngSeed, decks, battleTag: 'finalBoss' },
  }
}
