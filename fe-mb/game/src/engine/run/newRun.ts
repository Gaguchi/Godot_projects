/**
 * run/newRun.ts — ONE `seedNewRun` (brief §2.13 kit, §2.16 cast, §8.3).
 * runId `run-${seed}`, rng {seed, counter 0}, day = rules.economy.startDay, gold = startGold,
 * bag = startKit placed first-fit (charges from the item def), party = every `starter: true` unit
 * character via `buildUnitFromCharacter` in characters.json order, gear equipped from
 * `startingGear`, nodeId = overworld.startNodeId (visited), everything else empty/null/idle.
 *
 * The kit is DATA (`rules.economy.startKit`: 2 rations × 4 charges = 8 hops, 1 Healing Potion — DECISIONS, owner answer 2026-10-18)
 * and the cast is content (`starter: true`), so neither number nor name appears here. Content that cannot seed
 * a run (no starter, kit that does not fit, a missing MC while `mcDeathIsDefeat`) throws (§7.20).
 */
import type { EngineEnv, RunState, Unit, UnitCharacter, UnitId } from '../types'
import { placeInBag } from './bag'
import { MC_ID, buildUnitFromCharacter } from './party'

export function seedNewRun(seed: number, env: EngineEnv): RunState {
  const { economy, party: partyRules, knobs } = env.rules
  const sheet = env.content.overworld

  const starters = Object.values(env.content.characters).filter((c): c is UnitCharacter => c.kind === 'unit' && c.starter)
  if (starters.length === 0) throw new Error('run/newRun: characters.json declares no starter')
  if (starters.length > partyRules.cap) throw new Error(`run/newRun: ${starters.length} starters exceed the party cap`)
  const party: Record<UnitId, Unit> = {}
  const partyOrder: UnitId[] = []
  for (const def of starters) {
    const unit = buildUnitFromCharacter(def, env)
    party[unit.id] = unit
    partyOrder.push(unit.id)
  }
  // The foundling carries the egg: with the knob on, a run without an MC would be lost by settle step 1b at once.
  if (knobs.mcDeathIsDefeat && party[MC_ID] === undefined) throw new Error(`run/newRun: no starter has id '${MC_ID}' while rules.knobs.mcDeathIsDefeat is on`)

  const kitIds = economy.startKit.flatMap((k) => Array.from({ length: k.count }, () => k.itemId))
  const starterBagIds = starters.flatMap((c) => c.bag ?? [])
  const bag = placeInBag([], [...kitIds, ...starterBagIds], env)
  if (bag === null) throw new Error('run/newRun: the starting kit does not fit the bag')

  return {
    runId: `run-${seed}`,
    runSeed: seed,
    rng: { seed, counter: 0 },
    daysElapsed: economy.startDay,

    party,
    partyOrder,
    bag,
    gold: economy.startGold,
    mcName: null,
    companyName: null,
    prisoners: [],
    deathLog: [],

    nodeId: sheet.startNodeId,
    // `refKey('overworld', sheet.id, nodeId)` — the `<mapKind>:<mapId>:<nodeId>` format documented on `RefKey`.
    visitedNodes: { [`overworld:${sheet.id}:${sheet.startNodeId}`]: true },
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
  }
}
