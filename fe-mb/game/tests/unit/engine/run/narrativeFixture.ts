/**
 * WP-NARRATIVE test fixtures: a hand-built `RunState` (never `seedNewRun` — the narrative modules are tested on
 * fixture inputs, CONTRACT §7/§8) plus fixture-content envs built through the REAL Zod schemas so an invalid
 * fixture fails the way invalid content would.
 */
import { content, type ContentRegistry } from '../../../../src/content/index'
import { CheckEventSchema, DialogueTreeSchema, QuestSchema } from '../../../../src/content/schemas'
import { createEnv } from '../../../../src/engine/content'
import type { BagEntry, CheckEvent, DialogueTree, EngineEnv, QuestDef, RunState, Unit, UnitStats } from '../../../../src/engine/types'

/** The shipped content + shipped rules, built once per test file. */
export const env: EngineEnv = createEnv()

/** A unit on its class chassis (stats, hp, mov from `classes.json`) with optional overrides. */
export function unit(id: string, classId: string, patch: Partial<Omit<Unit, 'stats'>> & { readonly stats?: Partial<UnitStats> } = {}, e: EngineEnv = env): Unit {
  const cls = e.content.classes[classId]
  if (cls === undefined) throw new Error(`fixture: unknown class '${classId}'`)
  const { stats, ...rest } = patch
  return {
    id,
    name: id,
    classId,
    team: 'party',
    level: 1,
    hp: { current: cls.startingHp, max: cls.startingHp },
    stats: { ...cls.baseStats, ...stats },
    mov: cls.startingMov,
    handLeft: null,
    handRight: null,
    passives: [],
    signatureCardIds: [],
    ...rest,
  }
}

export const RATIONS: BagEntry = { itemId: 'food_rations', x: 0, y: 0, charges: 3 }
export const POTION: BagEntry = { itemId: 'healing_potion', x: 1, y: 0, charges: 1 }

/** A three-unit company at the start hub, day 1, with the §2.13 kit. Every field of `RunState` is populated. */
export function makeRun(patch: Partial<RunState> = {}, e: EngineEnv = env): RunState {
  const mc = unit('mc', 'lord', { name: 'The Foundling', handLeft: 'iron_sword' }, e)
  const oak = unit('oak', 'shield_knight', { name: 'Bagrat "Oak"', handLeft: 'iron_lance', handRight: 'iron_buckler', passives: ['genatsvale'] }, e)
  const lilina = unit('lilina', 'mage', { name: 'Lilina', handLeft: 'fire_tome' }, e)
  const start = e.content.overworld.startNodeId
  return {
    runId: 'run-1',
    runSeed: 1,
    rng: { seed: 1, counter: 0 },
    daysElapsed: e.rules.economy.startDay,
    party: { mc, oak, lilina },
    partyOrder: ['mc', 'oak', 'lilina'],
    bag: [RATIONS, POTION],
    gold: e.rules.economy.startGold,
    mcName: null,
    companyName: null,
    prisoners: [],
    deathLog: [],
    nodeId: start,
    visitedNodes: { [`overworld:${e.content.overworld.id}:${start}`]: true },
    clearedEncounters: {},
    oneShotsFired: {},
    edgeTraversals: {},
    scoutedEdges: {},
    spawnedNodes: {},
    unlockedNodes: {},
    clearedDungeons: {},
    flags: {},
    questStates: {},
    pendingTravel: null,
    pendingDialogue: null,
    pendingCheckEvent: null,
    pendingCombat: null,
    pendingNamePrompt: null,
    pendingFollowUps: [],
    pendingLoot: [],
    activeDungeon: null,
    town: null,
    camp: null,
    campAction: null,
    lastBattle: null,
    stats: { battlesWon: 0, enemiesDefeated: 0, enemiesCaptured: 0, unitsLost: 0, goldEarned: 0, gearFound: 0, hops: 0 },
    ...patch,
  }
}

/** Shipped content with extra fixture rows (validated through the schemas, keyed by id). */
export function envWith(extra: { readonly quests?: readonly unknown[]; readonly dialogues?: readonly unknown[]; readonly checkEvents?: readonly unknown[] }): EngineEnv {
  const quests: Record<string, QuestDef> = { ...content.quests }
  for (const q of extra.quests ?? []) { const p = QuestSchema.parse(q); quests[p.id] = p }
  const dialogues: Record<string, DialogueTree> = { ...content.dialogues }
  for (const d of extra.dialogues ?? []) { const p = DialogueTreeSchema.parse(d); dialogues[p.id] = p }
  const checkEvents: Record<string, CheckEvent> = { ...content.checkEvents }
  for (const c of extra.checkEvents ?? []) { const p = CheckEventSchema.parse(c); checkEvents[p.id] = p }
  const reg: ContentRegistry = { ...content, quests, dialogues, checkEvents }
  return createEnv(reg)
}

export const kinds = <T extends { readonly kind: string }>(effects: readonly T[]): readonly string[] => effects.map((e) => e.kind)
