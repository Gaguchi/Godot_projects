/**
 * run/scout.ts — camp Scout (brief §2.10 unified rule): costs 1 food, BFS EDGE depth 3 from the current
 * node, pre-rolls every edge with the SAME labels a real hop would use (`hop:<from>-><to>#(count+1)`), stores the
 * result (null = quiet) under the DIRECTED key `from->to#pass` (CONTRACT-CHANGES 0028) in `scoutedEdges`. What you
 * see is what you get — and only the crossing the scouts actually walked: the roll is directional (`noRollInto`
 * and the RNG labels both read the orientation), so the road walked back rolls fresh.
 *
 * One-shots: the rolls run in BFS order and THREAD an accumulating fired set — a one-shot entry pre-rolled for
 * edge N counts as fired for edges N+1… of the same scout, so it is stored under at most one key. (The stored
 * copy is re-validated again when the hop consumes it: `run/travel.ts#travelStep`.) `oneShotsFired` itself is
 * NOT written by scouting — only by `openEncounter` when the roll is consumed.
 */
import type { ActionType, Legality, SliceResult } from '../actions'
import type { Effect } from '../effects'
import type { EncounterRoll, EngineEnv, NodeId, RunState } from '../types'
import { consumeFood, foodCount } from './bag'
import { NO_RATIONS, spendCampAction } from './camp'
import { rollHopWith } from './encounters'
import { adjacency, edgeDirPassKey, edgeKey } from './overworld'

function refused(run: RunState, action: ActionType, reason: string): SliceResult<RunState> {
  return { state: run, effects: [{ kind: 'refused', action, reason }] }
}

/** Every road within `depth` hops of the current node, once each, oriented away from the party, BFS order. */
export function scoutableEdges(run: RunState, depth: number, env: EngineEnv): readonly { readonly from: NodeId; readonly to: NodeId; readonly pass: number }[] {
  const adj = adjacency(run, env)
  const dist: Record<NodeId, number> = { [run.nodeId]: 0 }
  const queue: NodeId[] = [run.nodeId]
  const seenEdges = new Set<string>()
  const out: { from: NodeId; to: NodeId; pass: number }[] = []
  for (let i = 0; i < queue.length; i++) {
    const from = queue[i]!
    const d = dist[from]!
    if (d >= depth) continue
    for (const to of adj[from] ?? []) {
      const key = edgeKey(from, to)
      if (!seenEdges.has(key)) {
        seenEdges.add(key)
        out.push({ from, to, pass: (run.edgeTraversals[key]?.count ?? 0) + 1 })
      }
      if (dist[to] === undefined) {
        dist[to] = d + 1
        queue.push(to)
      }
    }
  }
  return out
}

/**
 * WHAT THE SCOUTS SAW, in the one set of words every surface uses. The ration buys INFORMATION, so the sentence it
 * buys has one home: the camp report, the map's road marks and hover preview, and the headless roads line all read
 * it from here (RE-GATE C 3.9 — the report used to exist only on the camp screen the player had already left by
 * the time the road mattered). `quiet` is the channel that is not the words: a mark, an ink, a colour.
 */
export interface Sighting {
  readonly report: string
  readonly quiet: boolean
  /** What the mark on the road draws. `quiet` = nothing waiting; the rest name what does. */
  readonly kind: 'quiet' | 'battle' | 'dialogue' | 'checkEvent'
}

export function sightingOf(roll: EncounterRoll | null): Sighting {
  if (roll === null) return { report: 'The road is quiet', quiet: true, kind: 'quiet' }
  switch (roll.outcome.kind) {
    case 'battle': return { report: 'Armed men on the road', quiet: false, kind: 'battle' }
    case 'dialogue': return { report: 'Someone waits by the road', quiet: false, kind: 'dialogue' }
    case 'checkEvent': return { report: 'Something on the road', quiet: false, kind: 'checkEvent' }
  }
}

/** The pass a hop from `from` to `to` would consume — the same number `scout` filed its roll under. */
function passFor(run: RunState, from: NodeId, to: NodeId): number {
  return (run.edgeTraversals[edgeKey(from, to)]?.count ?? 0) + 1
}

/** What the scouts saw on ONE crossing, or null when nobody walked it: the record is directional, so the road
 *  walked the other way (or walked again on a later pass) has no sighting and rolls fresh (`run/travel.ts`). */
export function sightingFor(run: RunState, from: NodeId, to: NodeId): Sighting | null {
  const key = edgeDirPassKey(from, to, passFor(run, from, to))
  if (!(key in run.scoutedEdges)) return null
  return sightingOf(run.scoutedEdges[key] ?? null)
}

/** Every crossing the company has a live sighting for, in BFS order out of the current node — the report the
 *  ration paid for, addressed by road rather than by storage key. */
export function scoutedRoads(run: RunState, env: EngineEnv): readonly { readonly from: NodeId; readonly to: NodeId; readonly sighting: Sighting }[] {
  const out: { from: NodeId; to: NodeId; sighting: Sighting }[] = []
  for (const e of scoutableEdges(run, env.rules.camp.scoutDepth, env)) {
    const sighting = sightingFor(run, e.from, e.to)
    if (sighting !== null) out.push({ from: e.from, to: e.to, sighting })
  }
  return out
}

/** The ration the scouts eat before they walk. Read by `flow/legality.ts` AND by `scout`, so SCOUT goes unlit with
 *  the sentence the reducer would have refused with — the camp screen has no refusal surface, so a lit card that
 *  swallowed the press said nothing at all (RE-GATE C 3.1, 0116). */
export function canScout(run: RunState, env: EngineEnv): Legality {
  return foodCount(run.bag, env) >= env.rules.camp.scoutFoodCost ? { ok: true } : { ok: false, reason: NO_RATIONS }
}

export function scout(run: RunState, env: EngineEnv): SliceResult<RunState> {
  if (run.camp === null) return refused(run, 'camp/scout', 'not in camp')
  if (run.camp.actionTaken) return refused(run, 'camp/scout', 'the camp has done its one thing for today')
  const gate = canScout(run, env)
  if (!gate.ok) return refused(run, 'camp/scout', gate.reason)
  const fed = consumeFood(run, env.rules.camp.scoutFoodCost, 'scout', env)
  const effects: Effect[] = [...fed.effects]
  const st = fed.state

  const scoutedEdges: Record<string, EncounterRoll | null> = { ...st.scoutedEdges }
  const fired: Record<string, true> = { ...st.oneShotsFired }
  const keys: string[] = []
  for (const e of scoutableEdges(st, env.rules.camp.scoutDepth, env)) {
    const passKey = edgeDirPassKey(e.from, e.to, e.pass)
    const roll = rollHopWith(st, e.from, e.to, e.pass, fired, env)
    if (roll !== null && roll.oneShot) fired[roll.entryId] = true // threaded, never written back to the run
    scoutedEdges[passKey] = roll
    keys.push(passKey)
  }
  effects.push({ kind: 'scouted', edgeKeys: keys })
  return { state: spendCampAction({ ...st, scoutedEdges }, env), effects }
}
