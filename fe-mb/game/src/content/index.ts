/**
 * The content registry: every JSON under ./data parsed through its strict
 * Zod schema at module load, keyed by id, deep-frozen. A dangling id is the
 * cross-reference lint's job (./lint.ts, run by `npm run lint:content` and
 * the content unit test); a malformed file throws here with its name and
 * the failing path.
 */
import type { z } from 'zod'
import {
  BattlefieldSchema, CardSchema, CharacterSchema, CheckEventSchema, ClassSchema, DialogueTreeSchema, DungeonDefSchema,
  EncounterTableSchema, EnemyAIProfileSchema, EnemyGroupSchema, ItemSchema, OverworldSheetSchema,
  QuestSchema, RegionSchema, TownDefSchema,
  type Battlefield, type Card, type Character, type CheckEvent, type ClassDef, type DialogueTree, type DungeonDef,
  type EncounterTable, type EnemyAIProfile, type EnemyGroup, type Item, type OverworldNode,
  type OverworldSheet, type QuestDef, type RegionDef, type TownDef, type UnitCharacter,
} from './schemas'

import cardsJson from './data/cards.json'
import classesJson from './data/classes.json'
import itemsJson from './data/items.json'
import charactersJson from './data/characters.json'
import regionsJson from './data/regions.json'
import battlefieldsJson from './data/battlefields.json'
import worldJson from './data/overworld/world.json'

import egAshfallRaiders from './data/enemyGroups/ashfall_raiders.json'
import egAshfordCompany from './data/enemyGroups/ashford_company.json'
import egBanditLookouts from './data/enemyGroups/bandit_lookouts.json'
import egBandits from './data/enemyGroups/bandits.json'
import egBrigands from './data/enemyGroups/brigands.json'
import egDarensGang from './data/enemyGroups/darens_gang.json'
import egMageCircle from './data/enemyGroups/mage_circle.json'
import egShieldWall from './data/enemyGroups/shield_wall.json'
import egSmugglerCrew from './data/enemyGroups/smuggler_crew.json'
import egThornwoodAmbush from './data/enemyGroups/thornwood_ambush.json'
import egWolfAlphaPack from './data/enemyGroups/wolf_alpha_pack.json'
import egWolves from './data/enemyGroups/wolves.json'

import aiAlphaWolf from './data/enemyAI/alpha_wolf.json'
import aiBandit from './data/enemyAI/bandit.json'
import aiBanditArcher from './data/enemyAI/bandit_archer.json'
import aiCleric from './data/enemyAI/cleric.json'
import aiEmberMage from './data/enemyAI/ember_mage.json'
import aiRaiderMage from './data/enemyAI/raider_mage.json'
import aiShieldKnight from './data/enemyAI/shield_knight.json'
import aiThief from './data/enemyAI/thief.json'
import aiWarlord from './data/enemyAI/warlord.json'
import aiWolf from './data/enemyAI/wolf.json'

import etAshfallRoad from './data/encounters/ashfall_road.json'
import etBorderlandsRoad from './data/encounters/borderlands_road.json'
import etThornwoodRoad from './data/encounters/thornwood_road.json'

import ceAmbushToll from './data/checkEvents/ambush_toll.json'
import ceDarensCamp from './data/checkEvents/darens_camp.json'
import ceSouthRoadAmbush from './data/checkEvents/south_road_ambush.json'
import ceBanditHideout from './data/checkEvents/bandit_hideout.json'
import ceBorderlandShrine from './data/checkEvents/borderland_shrine.json'
import ceRuinedChapel from './data/checkEvents/ruined_chapel.json'
import ceWarlordsCamp from './data/checkEvents/warlords_camp.json'
import ceAncientInscription from './data/checkEvents/ancient_inscription.json'
import ceAncientShrine from './data/checkEvents/ancient_shrine.json'
import ceBadAir from './data/checkEvents/bad_air.json'
import ceBlackWater from './data/checkEvents/black_water.json'
import ceCollapsedShaft from './data/checkEvents/collapsed_shaft.json'
import ceDrippingFont from './data/checkEvents/dripping_font.json'
import ceEarlierCompany from './data/checkEvents/earlier_company.json'
import cePaleGrowth from './data/checkEvents/pale_growth.json'
import ceBanditParley from './data/checkEvents/bandit_parley.json'
import ceBlockedPassage from './data/checkEvents/blocked_passage.json'
import ceBridgeCrossing from './data/checkEvents/bridge_crossing.json'
import ceDisarmTrap from './data/checkEvents/disarm_trap.json'
import ceInjuredKnight from './data/checkEvents/injured_knight.json'
import ceInterrogateSurvivor from './data/checkEvents/interrogate_survivor.json'
import ceScoutAhead from './data/checkEvents/scout_ahead.json'
import ceSmugglerCache from './data/checkEvents/smuggler_cache.json'
import ceStuckCaravan from './data/checkEvents/stuck_caravan.json'
import ceThievesCrossroads from './data/checkEvents/thieves_crossroads.json'
import ceWanderingBlacksmith from './data/checkEvents/wandering_blacksmith.json'

import dgAncientRuins from './data/dungeons/ancient_ruins.json'
import dgIronMine from './data/dungeons/iron_mine.json'
import dgObsidianCavern from './data/dungeons/obsidian_cavern.json'
import dgSmugglersCave from './data/dungeons/smugglers_cave.json'
import dgThornwoodDepths from './data/dungeons/thornwood_depths.json'

import twAshfallOutpost from './data/towns/ashfall_outpost.json'
import twPineCrossing from './data/towns/pine_crossing.json'
import twRiversideMarket from './data/towns/riverside_market.json'
import twSouthJunction from './data/towns/south_junction.json'
import twThornwoodChapel from './data/towns/thornwood_chapel.json'

import qBloodTies from './data/quests/blood_ties.json'
import qMissingCaravan from './data/quests/missing_caravan.json'

import dlBanditThreat from './data/dialogue/bandit_threat.json'
import dlDeserterPlea from './data/dialogue/deserter_plea.json'
import dlDeserterRepays from './data/dialogue/deserter_repays.json'
import dlDesertersBrothers from './data/dialogue/deserters_brothers.json'
import dlPrologue from './data/dialogue/prologue.json'
import dlRoadMerchant from './data/dialogue/road_merchant.json'
import dlSqBloodTiesAccept from './data/dialogue/sq_blood_ties_accept.json'
import dlSqBloodTiesDarenCaptured from './data/dialogue/sq_blood_ties_daren_captured.json'
import dlSqBloodTiesDarenKilled from './data/dialogue/sq_blood_ties_daren_killed.json'
import dlSqCaravanAccept from './data/dialogue/sq_caravan_accept.json'
import dlSqCaravanFound from './data/dialogue/sq_caravan_found.json'
import dlSqCaravanReward from './data/dialogue/sq_caravan_reward.json'
import dlWoundedTraveler from './data/dialogue/wounded_traveler.json'

// ---------------------------------------------------------------- loading

export class ContentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContentError'
  }
}

function parseFile<S extends z.ZodTypeAny>(file: string, schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.length ? i.path.join('.') : '<root>'}: ${i.message}`).join('\n')
    throw new ContentError(`content/${file} failed validation:\n${issues}`)
  }
  return result.data
}

function parseList<S extends z.ZodTypeAny>(file: string, schema: S, data: unknown): z.output<S>[] {
  if (!Array.isArray(data)) throw new ContentError(`content/${file}: expected an array`)
  return data.map((row, i) => parseFile(`${file}[${i}]`, schema, row))
}

type Keyed<T> = Readonly<Record<string, T>>

function keyById<T extends { readonly id: string }>(what: string, rows: readonly T[]): Keyed<T> {
  const out: Record<string, T> = {}
  for (const row of rows) {
    if (row.id in out) throw new ContentError(`content/${what}: duplicate id '${row.id}'`)
    out[row.id] = row
  }
  return out
}

function parseDir<S extends z.ZodTypeAny>(dir: string, schema: S, files: readonly (readonly [string, unknown])[]): z.output<S>[] {
  return files.map(([name, data]) => parseFile(`${dir}/${name}.json`, schema, data))
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v)
  }
  return value
}

// --------------------------------------------------------------- registry

export interface ContentRegistry {
  readonly cards: Keyed<Card>
  readonly classes: Keyed<ClassDef>
  readonly items: Keyed<Item>
  readonly characters: Keyed<Character>
  readonly enemyGroups: Keyed<EnemyGroup>
  /** Keyed by classId. */
  readonly enemyAI: Keyed<EnemyAIProfile>
  readonly encounterTables: Keyed<EncounterTable>
  readonly checkEvents: Keyed<CheckEvent>
  readonly dungeons: Keyed<DungeonDef>
  readonly towns: Keyed<TownDef>
  /** The one open sheet. */
  readonly overworld: OverworldSheet
  readonly quests: Keyed<QuestDef>
  readonly dialogues: Keyed<DialogueTree>
  readonly regions: Keyed<RegionDef>
  /** Authored boards: the obstacle sets a fight can be laid out on (0112). */
  readonly battlefields: Keyed<Battlefield>
}

function loadContent(): ContentRegistry {
  const enemyAI = parseDir('enemyAI', EnemyAIProfileSchema, [
    ['alpha_wolf', aiAlphaWolf], ['bandit', aiBandit], ['bandit_archer', aiBanditArcher], ['cleric', aiCleric],
    ['ember_mage', aiEmberMage], ['raider_mage', aiRaiderMage], ['shield_knight', aiShieldKnight], ['thief', aiThief],
    ['warlord', aiWarlord], ['wolf', aiWolf],
  ])
  const aiByClass: Record<string, EnemyAIProfile> = {}
  for (const p of enemyAI) {
    if (p.classId in aiByClass) throw new ContentError(`content/enemyAI: duplicate profile for class '${p.classId}'`)
    aiByClass[p.classId] = p
  }

  const registry: ContentRegistry = {
    cards: keyById('cards.json', parseList('cards.json', CardSchema, cardsJson)),
    classes: keyById('classes.json', parseList('classes.json', ClassSchema, classesJson)),
    items: keyById('items.json', parseList('items.json', ItemSchema, itemsJson)),
    characters: keyById('characters.json', parseList('characters.json', CharacterSchema, charactersJson)),
    enemyGroups: keyById('enemyGroups', parseDir('enemyGroups', EnemyGroupSchema, [
      ['ashfall_raiders', egAshfallRaiders], ['ashford_company', egAshfordCompany], ['bandit_lookouts', egBanditLookouts], ['bandits', egBandits], ['brigands', egBrigands],
      ['darens_gang', egDarensGang], ['mage_circle', egMageCircle], ['shield_wall', egShieldWall], ['thornwood_ambush', egThornwoodAmbush],
      ['smuggler_crew', egSmugglerCrew], ['wolf_alpha_pack', egWolfAlphaPack], ['wolves', egWolves],
    ])),
    enemyAI: aiByClass,
    encounterTables: keyById('encounters', parseDir('encounters', EncounterTableSchema, [
      ['ashfall_road', etAshfallRoad], ['borderlands_road', etBorderlandsRoad], ['thornwood_road', etThornwoodRoad],
    ])),
    checkEvents: keyById('checkEvents', parseDir('checkEvents', CheckEventSchema, [
      ['ambush_toll', ceAmbushToll], ['darens_camp', ceDarensCamp], ['south_road_ambush', ceSouthRoadAmbush], ['bandit_hideout', ceBanditHideout], ['borderland_shrine', ceBorderlandShrine], ['ruined_chapel', ceRuinedChapel], ['warlords_camp', ceWarlordsCamp], ['ancient_inscription', ceAncientInscription], ['ancient_shrine', ceAncientShrine],
      ['bandit_parley', ceBanditParley], ['blocked_passage', ceBlockedPassage], ['bridge_crossing', ceBridgeCrossing],
      ['disarm_trap', ceDisarmTrap], ['injured_knight', ceInjuredKnight], ['interrogate_survivor', ceInterrogateSurvivor],
      ['scout_ahead', ceScoutAhead], ['smuggler_cache', ceSmugglerCache], ['stuck_caravan', ceStuckCaravan],
      ['thieves_crossroads', ceThievesCrossroads], ['wandering_blacksmith', ceWanderingBlacksmith],
      // the underground deck (0108): a dungeon graph deals up to nine event rooms and every one of them must draw
      ['bad_air', ceBadAir], ['black_water', ceBlackWater], ['collapsed_shaft', ceCollapsedShaft],
      ['dripping_font', ceDrippingFont], ['earlier_company', ceEarlierCompany], ['pale_growth', cePaleGrowth],
    ])),
    dungeons: keyById('dungeons', parseDir('dungeons', DungeonDefSchema, [
      ['ancient_ruins', dgAncientRuins], ['iron_mine', dgIronMine], ['obsidian_cavern', dgObsidianCavern],
      ['smugglers_cave', dgSmugglersCave], ['thornwood_depths', dgThornwoodDepths],
    ])),
    towns: keyById('towns', parseDir('towns', TownDefSchema, [
      ['ashfall_outpost', twAshfallOutpost], ['pine_crossing', twPineCrossing], ['riverside_market', twRiversideMarket],
      ['south_junction', twSouthJunction], ['thornwood_chapel', twThornwoodChapel],
    ])),
    overworld: parseFile('overworld/world.json', OverworldSheetSchema, worldJson),
    quests: keyById('quests', parseDir('quests', QuestSchema, [['blood_ties', qBloodTies], ['missing_caravan', qMissingCaravan]])),
    dialogues: keyById('dialogue', parseDir('dialogue', DialogueTreeSchema, [
      ['bandit_threat', dlBanditThreat], ['deserter_plea', dlDeserterPlea], ['deserter_repays', dlDeserterRepays],
      ['deserters_brothers', dlDesertersBrothers], ['prologue', dlPrologue], ['road_merchant', dlRoadMerchant],
      ['sq_blood_ties_accept', dlSqBloodTiesAccept], ['sq_blood_ties_daren_captured', dlSqBloodTiesDarenCaptured],
      ['sq_blood_ties_daren_killed', dlSqBloodTiesDarenKilled], ['sq_caravan_accept', dlSqCaravanAccept],
      ['sq_caravan_found', dlSqCaravanFound], ['sq_caravan_reward', dlSqCaravanReward], ['wounded_traveler', dlWoundedTraveler],
    ])),
    regions: keyById('regions.json', parseList('regions.json', RegionSchema, regionsJson)),
    battlefields: keyById('battlefields.json', parseList('battlefields.json', BattlefieldSchema, battlefieldsJson)),
  }
  return deepFreeze(registry)
}

/** The validated, frozen content registry. Importing this module validates everything. */
export const content: ContentRegistry = loadContent()

// -------------------------------------------------------------- accessors

function must<T>(table: Keyed<T>, what: string, id: string): T {
  const row = table[id]
  if (row === undefined) throw new ContentError(`unknown ${what} '${id}'`)
  return row
}

export const getCard = (id: string): Card => must(content.cards, 'card', id)
export const getClass = (id: string): ClassDef => must(content.classes, 'class', id)
export const getItem = (id: string): Item => must(content.items, 'item', id)
export const getCharacter = (id: string): Character => must(content.characters, 'character', id)
export const getEnemyGroup = (id: string): EnemyGroup => must(content.enemyGroups, 'enemy group', id)
export const getEnemyAI = (classId: string): EnemyAIProfile => must(content.enemyAI, 'enemy AI profile for class', classId)
export const getEncounterTable = (id: string): EncounterTable => must(content.encounterTables, 'encounter table', id)
export const getCheckEvent = (id: string): CheckEvent => must(content.checkEvents, 'check event', id)
export const getDungeon = (id: string): DungeonDef => must(content.dungeons, 'dungeon', id)
export const getTown = (id: string): TownDef => must(content.towns, 'town', id)
export const getQuest = (id: string): QuestDef => must(content.quests, 'quest', id)
export const getDialogue = (id: string): DialogueTree => must(content.dialogues, 'dialogue', id)
export const getRegion = (id: string): RegionDef => must(content.regions, 'region', id)
export const getBattlefield = (id: string): Battlefield => must(content.battlefields, 'battlefield', id)

const nodesById: Keyed<OverworldNode> = deepFreeze(keyById('overworld/world.json nodes', content.overworld.nodes))
export const getNode = (id: string): OverworldNode => must(nodesById, 'overworld node', id)

/** Unit characters only (the ones that can stand on a board). */
export function getUnitCharacter(id: string): UnitCharacter {
  const c = getCharacter(id)
  if (c.kind !== 'unit') throw new ContentError(`character '${id}' is an npc, not a unit`)
  return c
}

/** The party at run start, in characters.json order. */
export function starterCharacters(): readonly UnitCharacter[] {
  return Object.values(content.characters).filter((c): c is UnitCharacter => c.kind === 'unit' && c.starter)
}

/**
 * Sprite lookup order (brief §3 keeps it): exact unit id, id minus one `_N`
 * pack suffix, the character whose id equals the class id, any unit character
 * of that class with art, else null (render as a shape token). Board bakes
 * live at /sprites/units/board/<spriteId>.png, portraits at /sprites/units/.
 */
export function spriteIdFor(unitId: string | null | undefined, classId: string): string | null {
  if (unitId) {
    const direct = content.characters[unitId]?.spriteId
    if (direct) return direct
    const stripped = content.characters[unitId.replace(/_\d+$/, '')]?.spriteId
    if (stripped) return stripped
  }
  const byClassId = content.characters[classId]
  if (byClassId?.kind === 'unit' && byClassId.classId === classId && byClassId.spriteId) return byClassId.spriteId
  for (const c of Object.values(content.characters)) {
    if (c.kind === 'unit' && c.classId === classId && c.spriteId) return c.spriteId
  }
  return null
}

export * from './schemas'
