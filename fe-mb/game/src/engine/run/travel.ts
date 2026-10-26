/**
 * run/travel.ts — the hop state machine (brief §2.9, §7.16). ONE pump (`travel/step`).
 *
 * `travelStep`:
 *  hop === null (BEGIN): to = path[0]; pass = traversals[key].count + 1; consumeFood(1) or starvation
 *    (rules.travel.starvationDamage to each living unit; deaths → removeFallen — a wipe / MC death then ends the
 *    run in `flow/settle.ts` step 1b); day += daysPerHop; stats.hops++;
 *    encounter = scoutedEdges[`${from}->${to}#${pass}`] !== undefined ? take-and-delete AND RE-VALIDATE : rollHop(...);
 *      re-validation of a stored roll: `roll.oneShot && oneShotsFired[roll.entryId]`, or the entry's `conditions`
 *      failing against `predicateState(run)` ⇒ treat as null (quiet) — emitted as `encounterRolled { scouted: true, result: 'quiet' }`;
 *    hop = { from, to, pass, encounter, resolved: encounter === null }; encounter → `openEncounter` + status 'suspended'.
 *  hop !== null && hop.resolved (LAND): nodeId = to; traversals[key] = { count: pass, lastDay: day }; visited;
 *    path.shift(); `locationArrived`;
 *    FIRST arrival at a DISCOVERY node with `discoveryEventId` (refKey not in visitedNodes before this landing) →
 *      `openEncounter({ entryId: node.id, outcome: { kind: 'checkEvent', checkEventId }, oneShot: true }, 'discovery')`,
 *      status 'suspended', `encounterRolled { result: 'checkEvent', scouted: false }` — the quick menu opens after
 *      `check/dismiss` via settle rule 5 (a second visit is an ordinary decision-node pause);
 *    else decision node or empty path → 'atNode' (quick menu) else stay 'walking'.
 * A suspended hop never re-rolls: the suspender's close calls `resumeTravel`, which only flips `resolved`.
 */
import type { ActionType, SliceResult } from '../actions'
import type { Effect } from '../effects'
import type { EncounterRoll, EngineEnv, NodeId, PendingCombat, PendingTravel, RunState } from '../types'
import { consumeFood } from './bag'
import { openCheckEvent } from './checks'
import { openDialogue } from './dialogue'
import { areaTier, enemyLevelFor } from './difficulty'
import { rollHop } from './encounters'
import { edgeDirPassKey, edgeKey, findPath, isDecisionNode, nodeOf, refKey } from './overworld'
import { damageParty } from './party'
import { evaluate, predicateState } from './predicates'

function refused(run: RunState, action: ActionType, reason: string): SliceResult<RunState> {
  return { state: run, effects: [{ kind: 'refused', action, reason }] }
}

/** Path via `findPath`; `[]` ⇒ atNode (quick menu, no hop, no food); else pendingTravel { walking, hop null }.
 *  Legal from the quick menu too: an existing `atNode` record is replaced (`journeyEnded { reason: 'stayed' }` for it). */
export function startTravel(run: RunState, nodeId: NodeId, env: EngineEnv): SliceResult<RunState> {
  const path = findPath(run, nodeId, env)
  if (path === null) return refused(run, 'travel/goTo', `no road leads to ${nodeId}`)
  const effects: Effect[] = []
  if (run.pendingTravel?.status === 'atNode') effects.push({ kind: 'journeyEnded', nodeId: run.nodeId, reason: 'stayed' })
  const pendingTravel: PendingTravel = path.length === 0
    ? { path: [], hopsTotal: 0, status: 'atNode', hop: null } // re-enter the current node: quick menu, no hop, no food
    : { path, hopsTotal: path.length, status: 'walking', hop: null }
  return { state: { ...run, pendingTravel }, effects }
}

export function travelStep(run: RunState, env: EngineEnv): SliceResult<RunState> {
  const pt = run.pendingTravel
  if (pt === null || pt.status !== 'walking') return refused(run, 'travel/step', 'not walking')
  if (pt.hop === null) return beginHop(run, pt, env)
  if (!pt.hop.resolved) return refused(run, 'travel/step', 'the hop in flight is still suspended')
  return landHop(run, pt, env)
}

/** A stored Scout roll is only as good as the world it was rolled in: a one-shot fired since, or an entry whose
 *  conditions no longer hold, reads as "the road is quiet" (brief §2.10 "what you see is what you get", re-validated). */
function stillValid(roll: EncounterRoll, run: RunState, env: EngineEnv): boolean {
  if (roll.oneShot && run.oneShotsFired[roll.entryId] === true) return false
  const entry = Object.values(env.content.encounterTables).flatMap((t) => t.entries).find((e) => e.id === roll.entryId)
  if (entry === undefined) return false
  const pred = predicateState(run)
  return entry.conditions.every((c) => evaluate(c, pred))
}

function beginHop(run: RunState, pt: PendingTravel, env: EngineEnv): SliceResult<RunState> {
  const to = pt.path[0]
  if (to === undefined) return refused(run, 'travel/step', 'no path left to walk')
  const from = run.nodeId
  const key = edgeKey(from, to)
  const pass = (run.edgeTraversals[key]?.count ?? 0) + 1
  const effects: Effect[] = []
  let st = run

  // Food first; an empty bag costs every living unit `starvationDamage` (a wipe / MC death ends the run in settle 1b).
  const fed = consumeFood(st, env.rules.travel.foodPerHop, 'hop', env)
  st = fed.state
  effects.push(...fed.effects)
  if (fed.consumed < env.rules.travel.foodPerHop) {
    const starved = damageParty(st, env.rules.travel.starvationDamage, 'starvation', env)
    st = starved.state
    effects.push(...starved.effects)
  }
  st = { ...st, daysElapsed: st.daysElapsed + env.rules.travel.daysPerHop, stats: { ...st.stats, hops: st.stats.hops + 1 } }

  const fromNode = nodeOf(from, env)
  const toNode = nodeOf(to, env)
  effects.push({ kind: 'hopStarted', from, to, westward: toNode.position.x < fromNode.position.x, hopsLeft: pt.path.length })

  // The roll: a Scout result for this exact crossing is consumed instead of rolling (and re-validated); else roll now.
  const passKey = edgeDirPassKey(from, to, pass)
  let encounter: EncounterRoll | null
  let scouted = false
  if (passKey in st.scoutedEdges) {
    scouted = true
    const stored = st.scoutedEdges[passKey] ?? null
    const rest: Record<string, EncounterRoll | null> = { ...st.scoutedEdges }
    delete rest[passKey]
    st = { ...st, scoutedEdges: rest }
    encounter = stored !== null && stillValid(stored, st, env) ? stored : null
  } else {
    encounter = rollHop(st, from, to, pass, env)
  }
  effects.push({ kind: 'encounterRolled', edgeKey: key, pass, result: encounter === null ? 'quiet' : encounter.outcome.kind, entryId: encounter?.entryId ?? null, scouted })

  const hop = { from, to, pass, encounter, resolved: encounter === null }
  if (encounter === null) return { state: { ...st, pendingTravel: { ...pt, hop } }, effects }
  st = openEncounter({ ...st, pendingTravel: { ...pt, hop, status: 'suspended' } }, encounter, 'travel', env)
  return { state: st, effects }
}

function landHop(run: RunState, pt: PendingTravel, env: EngineEnv): SliceResult<RunState> {
  const hop = pt.hop
  if (hop === null) return refused(run, 'travel/step', 'nothing to land')
  const to = hop.to
  const key = edgeKey(hop.from, to)
  const ref = refKey('overworld', env.content.overworld.id, to)
  const firstVisit = run.visitedNodes[ref] !== true
  const path = pt.path.slice(1)
  const node = nodeOf(to, env)
  // `isDecisionNode` reads the PRE-landing visited set: an unvisited node pauses the walk exactly once.
  const isDestination = path.length === 0
  const pauses = isDecisionNode(node, run, isDestination, env)

  let st: RunState = {
    ...run,
    nodeId: to,
    edgeTraversals: { ...run.edgeTraversals, [key]: { count: hop.pass, lastDay: run.daysElapsed } },
    visitedNodes: { ...run.visitedNodes, [ref]: true },
    pendingTravel: { ...pt, path, hop: null, status: pauses ? 'atNode' : 'walking' },
  }
  const effects: Effect[] = [{ kind: 'hopLanded', nodeId: to }, { kind: 'locationArrived', ref }]

  if (firstVisit && node.type === 'DISCOVERY' && node.discoveryEventId !== undefined) {
    // The node's own one-time event: open it as a suspender; `resumeTravel` lands on the quick menu afterwards.
    const roll: EncounterRoll = { entryId: node.id, outcome: { kind: 'checkEvent', checkEventId: node.discoveryEventId }, oneShot: true }
    st = openEncounter({ ...st, pendingTravel: { ...pt, path, hop: null, status: 'suspended' } }, roll, 'discovery', env)
    effects.push({ kind: 'encounterRolled', edgeKey: key, pass: hop.pass, result: 'checkEvent', entryId: node.id, scouted: false })
    return { state: st, effects }
  }
  if (isDestination) effects.push({ kind: 'journeyEnded', nodeId: to, reason: 'arrived' })
  return { state: st, effects }
}

/** Marks one-shots fired; dialogue → pendingDialogue{source}; battle → pendingCombat{origin travel, enemies group, captureTargets};
 *  checkEvent → pendingCheckEvent{source} (`'discovery'` for a DISCOVERY node's own event). */
export function openEncounter(run: RunState, roll: EncounterRoll, source: 'travel' | 'discovery', env: EngineEnv): RunState {
  const st: RunState = roll.oneShot ? { ...run, oneShotsFired: { ...run.oneShotsFired, [roll.entryId]: true } } : run
  switch (roll.outcome.kind) {
    case 'dialogue':
      return openDialogue(st, roll.outcome.dialogueId, 'travel', env).state
    case 'checkEvent':
      return openCheckEvent(st, roll.outcome.checkEventId, source, env).state
    case 'battle': {
      const hop = st.pendingTravel?.hop ?? null
      // A road battle belongs to its hop (day-salted label, travel loot row, `clearedEncounters` on victory); a roll
      // opened while standing still (discovery deck battles, dev) is a quest-origin fight at this node.
      const origin: PendingCombat['origin'] = hop !== null
        ? { kind: 'travel', from: hop.from, to: hop.to, encounterId: roll.entryId }
        : { kind: 'quest', nodeId: st.nodeId }
      const at = hop?.to ?? st.nodeId
      const pendingCombat: PendingCombat = {
        origin,
        enemies: { kind: 'group', enemyGroupId: roll.outcome.enemyGroupId, level: enemyLevelFor(areaTier(at, env), at, env) },
        captureTargets: roll.outcome.captureTargets ?? [],
      }
      return { ...st, pendingCombat }
    }
  }
}

/** suspended → walking with `hop.resolved = true` (called by `flow/settle.ts` only). A suspended LANDED hop
 *  (a discovery event) has no hop record left: it resumes on the quick menu instead. */
export function resumeTravel(run: RunState): RunState {
  const pt = run.pendingTravel
  if (pt === null || pt.status !== 'suspended') return run
  if (pt.hop === null) return { ...run, pendingTravel: { ...pt, status: 'atNode' } }
  return { ...run, pendingTravel: { ...pt, status: 'walking', hop: { ...pt.hop, resolved: true } } }
}

/** Quick menu "Continue Travel": atNode with path remaining → walking. */
export function continueTravel(run: RunState): RunState {
  const pt = run.pendingTravel
  if (pt === null || pt.status !== 'atNode' || pt.path.length === 0) return run
  return { ...run, pendingTravel: { ...pt, status: 'walking' } }
}

/** Quick menu "Stay Here": clears pendingTravel. */
export function stayHere(run: RunState): RunState {
  return run.pendingTravel === null ? run : { ...run, pendingTravel: null }
}

/**
 * The LAST door, said before it (RE-GATE C 3.14). The dungeon mouth has warned properly since 0113
 * (`run/dungeon.ts#DESCENT_IS_ONE_WAY`) and the throne said nothing at all: the node card and the headless menu
 * offered `Challenge the throne` over an empty frame — no name for who waits, no line saying this is the last
 * battle, no warning that there is no retreat and no inn behind it. A blind playthrough walked in on day 15 with
 * two units because nothing suggested otherwise.
 *
 * Every word of it is derived from the node's own content — the group's name, the name of whoever leads it, the
 * place — so a different final boss re-writes the warning by itself. Body prose, whole sentences with stops
 * (ARCHITECTURE §5.1): it stands beside a LEGAL verb rather than refusing one, exactly like the descent's.
 * `null` when the node is not a throne, which is the same shape `challengeBoss` refuses on.
 */
export function throneWarning(run: RunState, env: EngineEnv): string | null {
  const node = nodeOf(run.nodeId, env)
  if (node.type !== 'BOSS' || node.enemyGroupId === undefined) return null
  const group = env.content.enemyGroups[node.enemyGroupId]
  if (group === undefined) return null
  const leader = group.members[0]?.name ?? null
  const held = leader === null ? `${group.name} holds ${node.name}.` : `${group.name} holds ${node.name}, and ${leader} holds them.`
  return `${held} There is no retreat from this door and no inn behind it: the company either wins here or ends here.`
}

/** BOSS node quick menu: pendingCombat { origin finalBoss, enemies: group from the node, level per `battleSpecFor` }. */
export function challengeBoss(run: RunState, env: EngineEnv): SliceResult<RunState> {
  const node = nodeOf(run.nodeId, env)
  if (node.type !== 'BOSS' || node.enemyGroupId === undefined) return refused(run, 'travel/challengeBoss', `${node.name} holds no boss`)
  if (run.pendingCombat !== null) return refused(run, 'travel/challengeBoss', 'a battle is already waiting')
  const pendingCombat: PendingCombat = {
    origin: { kind: 'finalBoss', nodeId: node.id },
    enemies: { kind: 'group', enemyGroupId: node.enemyGroupId, level: env.rules.difficulty.bossLevel },
    captureTargets: [],
  }
  // The quick menu closes with the challenge: settle seeds the battle only once no overlay is up, and the boss
  // fight ends the run either way, so the itinerary has nothing left to resume.
  return { state: { ...run, pendingTravel: null, pendingCombat }, effects: [] }
}
