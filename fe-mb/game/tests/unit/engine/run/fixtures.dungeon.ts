/**
 * Fixtures for `run/dungeon.ts` tests (WP-DUNGEON).
 *
 * `run/dungeon.ts` calls into WP-OVERWORLD (`nodeOf`, `isNodeLocked`, `dungeonOf`, `refKey`), which lands in
 * parallel and may still throw `TODO(run/overworld)`. `orFixture(real, fixture)` calls the REAL function first and
 * falls back to the contract-shaped fixture below only on a `TODO(` throw, so the dungeon tests exercise this
 * package's logic today and become integration tests the moment the sibling lands — with no edit here. Every
 * fixture follows the sibling's CONTRACT doc comment; a divergence found later is a finding, not a fixture bug.
 * (WP-RUN-CORE and WP-NARRATIVE have landed; the tests call them directly.)
 */
import type { DungeonDef, EngineEnv, OverworldNode, RunState, Unit, UnitId } from '../../../../src/engine/types'

const TODO_RE = /^TODO\(/

export function orFixture<A extends readonly unknown[], R>(real: (...args: A) => R, fixture: (...args: A) => R): (...args: A) => R {
  return (...args: A): R => {
    try {
      return real(...args)
    } catch (e) {
      if (e instanceof Error && TODO_RE.test(e.message)) return fixture(...args)
      throw e
    }
  }
}

// ── run/overworld.ts (CONTRACT §2) ────────────────────────────────────────

/** Throws on an unknown id (programmer error). */
export function nodeOf(id: string, env: EngineEnv): OverworldNode {
  const node = env.content.overworld.nodes.find((n) => n.id === id)
  if (node === undefined) throw new Error(`fixture nodeOf: unknown node '${id}'`)
  return node
}

/** `node.locked === true && !run.unlockedNodes[node.id]`. */
export function isNodeLocked(run: RunState, node: OverworldNode): boolean {
  return node.locked === true && run.unlockedNodes[node.id] !== true
}

/** The dungeon def whose id equals the current node id, null off a DUNGEON node. */
export function dungeonOf(run: RunState, env: EngineEnv): DungeonDef | null {
  const node = nodeOf(run.nodeId, env)
  if (node.type !== 'DUNGEON') return null
  return env.content.dungeons[node.id] ?? null
}

/** `${kind}:${mapId}:${nodeId}`. */
export function refKey(kind: 'overworld' | 'dungeon', mapId: string, nodeId: string): string {
  return `${kind}:${mapId}:${nodeId}`
}

// ── run fixtures ──────────────────────────────────────────────────────────

export function fixtureUnit(env: EngineEnv, id: UnitId, classId: string, hp?: number): Unit {
  const cls = env.content.classes[classId]
  if (cls === undefined) throw new Error(`fixtureUnit: unknown class '${classId}'`)
  return {
    id,
    name: id,
    classId,
    team: 'party',
    level: 1,
    hp: { current: hp ?? cls.startingHp, max: cls.startingHp },
    stats: { ...cls.baseStats },
    mov: cls.startingMov,
    handLeft: null,
    handRight: null,
    passives: [],
    signatureCardIds: [],
  }
}

/** A minimal but complete RunState standing at `nodeId` (default: the start hub) with a three-unit party. */
export function fixtureRun(env: EngineEnv, patch: Partial<RunState> = {}): RunState {
  const units = [fixtureUnit(env, 'mc', 'lord'), fixtureUnit(env, 'oak', 'knight'), fixtureUnit(env, 'lilina', 'mage')]
  const party: Record<UnitId, Unit> = {}
  for (const u of units) party[u.id] = u
  return {
    runId: 'run-fixture',
    runSeed: 12345,
    rng: { seed: 12345, counter: 0 },
    daysElapsed: env.rules.economy.startDay,
    party,
    partyOrder: units.map((u) => u.id),
    bag: [
      // Rations are 1×2 (items.json): x = 0 and x = 1 do not overlap; the potion is 1×1.
      { itemId: 'food_rations', x: 0, y: 0, charges: 3 },
      { itemId: 'food_rations', x: 1, y: 0, charges: 3 },
      { itemId: 'healing_potion', x: 2, y: 0, charges: 1 },
    ],
    gold: env.rules.economy.startGold,
    mcName: null,
    companyName: null,
    prisoners: [],
    deathLog: [],
    nodeId: env.content.overworld.startNodeId,
    visitedNodes: {},
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
