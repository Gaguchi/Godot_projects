/**
 * run/encounters.ts — the per-hop encounter roll (brief §2.9, §7.19). Rolls are per EDGE, not per node.
 * Two derived streams per crossing, both labelled with the traversal `pass` so a road re-crossed on a later day
 * rolls differently and a suspended hop (which never re-rolls — the roll is a stored record) stays exact:
 *   hop stream        — did anything happen?   (`rngLabels.hop`)
 *   encounter stream  — which entry?            (`rngLabels.encounter`)
 * Neither advances `run.rng` (children derive from the parent SEED, `rngState.ts`).
 */
import type { EdgeTraversal, EncounterRoll, EncounterTable, EngineEnv, NodeId, OverworldEdge, PredicateState, RegionDef, RngState, RunState } from '../types'
import { createRng } from '../rng'
import { deriveState, rngState } from '../rngState'
import { rngLabels } from '../rules'
import { edgeKey, edgeOf, nodeOf, regionOf } from './overworld'
import { evaluate, predicateState } from './predicates'

/** (edge.rollChance ?? region.encounterChancePerHop) × cooldown — `encounterChancePerHop` is required by the
 *  region schema, so there is no third fallback (CONTRACT-CHANGES 0032 deleted the unreachable knob);
 *  cooldown = 1 on first pass or ≥ cooldownDays since, else max(cooldownFloor, daysSince / cooldownDays). */
export function rollChanceFor(edge: OverworldEdge | null, region: RegionDef, traversal: EdgeTraversal | null, today: number, env: EngineEnv): number {
  const base = edge?.rollChance ?? region.encounterChancePerHop
  if (traversal === null) return base
  const { cooldownDays, cooldownFloor } = env.rules.travel
  const since = today - traversal.lastDay
  const cooldown = since >= cooldownDays ? 1 : Math.max(cooldownFloor, since / cooldownDays)
  return base * cooldown
}

/** Filter by predicates and `oneShotsFired`; weighted by `rng.next() × Σweight`; last-entry fallback; the rng returned advanced. */
export function rollEncounter(table: EncounterTable, pred: PredicateState, oneShotsFired: Readonly<Record<string, true>>, rng: RngState): { readonly roll: EncounterRoll | null; readonly rng: RngState } {
  const eligible = table.entries.filter((e) => !(e.oneShot && oneShotsFired[e.id] === true) && e.conditions.every((c) => evaluate(c, pred)))
  if (eligible.length === 0) return { roll: null, rng }
  const r = createRng(rng)
  const total = eligible.reduce((sum, e) => sum + e.weight, 0)
  let cursor = r.next() * total
  // The last eligible entry is the fallback: a float cursor that lands exactly on `total` still picks something.
  let picked = eligible[eligible.length - 1]!
  for (const e of eligible) {
    if (cursor < e.weight) {
      picked = e
      break
    }
    cursor -= e.weight
  }
  return { roll: { entryId: picked.id, outcome: picked.outcome, oneShot: picked.oneShot }, rng: rngState(r) }
}

/** The whole hop roll: no roll into `noRollInto` types; `hopRng = deriveRng(run.rng, rngLabels.hop(...))`; if it fires,
 *  `rollEncounter(table, predicateState(run), oneShotsFired, deriveRng(run.rng, rngLabels.encounter(...)))`.
 *  Labels carry `pass` so re-crossings differ. Scout stores exactly this result. */
export function rollHop(run: RunState, from: NodeId, to: NodeId, pass: number, env: EngineEnv): EncounterRoll | null {
  return rollHopWith(run, from, to, pass, run.oneShotsFired, env)
}

/** `rollHop` with an explicit fired set — Scout threads the one-shots it has already pre-rolled through the
 *  remaining edges of the same sweep (`run/scout.ts`), so a one-shot lands under at most one key. */
export function rollHopWith(run: RunState, from: NodeId, to: NodeId, pass: number, oneShotsFired: Readonly<Record<string, true>>, env: EngineEnv): EncounterRoll | null {
  const noRoll: readonly string[] = env.rules.travel.noRollInto
  if (noRoll.includes(nodeOf(to, env).type)) return null
  const edge = edgeOf(from, to, env)
  if (edge === null) return null
  const table = env.content.encounterTables[edge.encounterTableId]
  if (table === undefined) throw new Error(`run/encounters: road ${edgeKey(from, to)} names unknown encounter table '${edge.encounterTableId}'`)
  // The road's table decides the region knob (a table belongs to one region); the from-node is the fallback.
  const region = env.content.regions[table.regionId] ?? regionOf(from, env)
  const chance = rollChanceFor(edge, region, run.edgeTraversals[edgeKey(from, to)] ?? null, run.daysElapsed, env)
  const sheet = env.content.overworld.id
  const hopRng = createRng(deriveState(run.rng, rngLabels.hop(sheet, from, to, pass)))
  if (hopRng.next() >= chance) return null
  return rollEncounter(table, predicateState(run), oneShotsFired, deriveState(run.rng, rngLabels.encounter(sheet, from, to, pass))).roll
}
