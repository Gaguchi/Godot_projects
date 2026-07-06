import classesJson from '../../data/content/classes.json'
import smugglers from '../../data/content/dungeons/smugglers_cave.json'
import ancient from '../../data/content/dungeons/ancient_ruins.json'
import depths from '../../data/content/dungeons/thornwood_depths.json'
import iron from '../../data/content/dungeons/iron_mine.json'
import obsidian from '../../data/content/dungeons/obsidian_cavern.json'
import bandits from '../../data/content/enemyGroups/bandits.json'
import wolves from '../../data/content/enemyGroups/wolves.json'
import brigands from '../../data/content/enemyGroups/brigands.json'
import darens from '../../data/content/enemyGroups/darens_gang.json'
import shieldWall from '../../data/content/enemyGroups/shield_wall.json'
import mageCircle from '../../data/content/enemyGroups/mage_circle.json'
import wolfAlphaPack from '../../data/content/enemyGroups/wolf_alpha_pack.json'
import thornwoodAmbush from '../../data/content/enemyGroups/thornwood_ambush.json'
import ashfallRaiders from '../../data/content/enemyGroups/ashfall_raiders.json'
import cardsJson from '../../data/content/cards.json'
import { asUnitId, asClassId, asTileId } from '../../domain/ids'
import type { Unit } from '../../domain/unit'
import type { CombatEvent, CombatGrid, DeckState } from '../../domain/combatState'
import type { RngState } from '../../domain/rng'
import type { DungeonDef } from '../../domain/dungeon'
import type { EnemyGroup } from '../../domain/encounter'
import { buildDeckForUnit } from '../../systems/deckBuilder'
import { getItemDef } from '../../data/itemRegistry'

const DAMAGE_CARD_IDS = new Set(
  cardsJson.filter(c => c.effects.some(e => e.kind === 'Damage')).map(c => c.id),
)

const DUNGEONS: Record<string, DungeonDef> = {
  smugglers_cave: smugglers as DungeonDef,
  ancient_ruins: ancient as DungeonDef,
  thornwood_depths: depths as DungeonDef,
  iron_mine: iron as DungeonDef,
  obsidian_cavern: obsidian as DungeonDef,
}

const GROUPS: Record<string, EnemyGroup> = {
  bandits_small: bandits as EnemyGroup,
  wolves: wolves as EnemyGroup,
  brigands: brigands as EnemyGroup,
  darens_gang: darens as EnemyGroup,
  shield_wall: shieldWall as EnemyGroup,
  mage_circle: mageCircle as EnemyGroup,
  wolf_alpha_pack: wolfAlphaPack as EnemyGroup,
  thornwood_ambush: thornwoodAmbush as EnemyGroup,
  ashfall_raiders: ashfallRaiders as EnemyGroup,
}

/**
 * GP-F4: Seed a dungeon battle. Looks up the DungeonDef by id, picks the
 * appropriate enemy group based on room type (combat / elite / boss), and
 * expands the EnemyGroup members into Unit instances on the right side of
 * the grid. Party units are seeded by the caller (overworld / boot).
 */
export function seedDungeonBattle(
  dungeonId: string,
  roomType: 'combat' | 'elite' | 'boss',
  rngSeed: RngState,
  party: Unit[],
): Extract<CombatEvent, { type: 'startBattle' }> {
  const dungeon = DUNGEONS[dungeonId]
  if (!dungeon) throw new Error(`seedDungeonBattle: unknown dungeon ${dungeonId}`)

  const groupId = roomType === 'boss' ? dungeon.bossEnemyGroupId
    : roomType === 'elite' ? dungeon.eliteEnemyGroupId
    : dungeon.combatEnemyGroupId

  const group = GROUPS[groupId]
  if (!group) throw new Error(`seedDungeonBattle: unknown enemy group ${groupId}`)

  const classMap = new Map(classesJson.map((c) => [c.id, c]))

  const enemies: Unit[] = []
  let enemyIdx = 0
  for (const member of group.members) {
    const cls = classMap.get(member.classId)
    if (!cls) continue
    for (let i = 0; i < member.count; i++) {
      const x = 12 + (enemyIdx % 2)
      const y = 4 + Math.floor(enemyIdx / 2)
      enemies.push({
        id: asUnitId(`${groupId}_${enemyIdx}`),
        name: member.name,
        classId: asClassId(cls.id),
        team: 'enemy',
        level: member.level,
        hp: { current: cls.startingHp, max: cls.startingHp },
        stats: { ...cls.baseStats },
        position: asTileId(`${x},${y}`),
        ap: 3,
        armor: 0,
        statuses: [],
      })
      enemyIdx++
    }
  }

  // Gear-as-deck: party decks include hand-slot gear cards; enemies are
  // innate-only until enemy gear content lands (Phase 45).
  const decks: Record<string, DeckState> = {}
  for (const u of [...party, ...enemies]) {
    const cls = classMap.get(u.classId as unknown as string)
    if (!cls) continue
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
    payload: { units: [...party, ...enemies], grid, rngSeed, decks },
  }
}
