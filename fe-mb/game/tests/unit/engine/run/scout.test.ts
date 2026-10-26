import { describe, expect, it } from 'vitest'
import { createEnv } from '../../../../src/engine/content'
import { foodCount } from '../../../../src/engine/run/bag'
import { rollHop, rollHopWith } from '../../../../src/engine/run/encounters'
import { edgeDirPassKey, edgeKey, nodeOf } from '../../../../src/engine/run/overworld'
import { scout, scoutableEdges, scoutedRoads, sightingFor, sightingOf } from '../../../../src/engine/run/scout'
import { startTravel, travelStep } from '../../../../src/engine/run/travel'
import type { EncounterRoll, RunState } from '../../../../src/engine/types'
import { env, newRun, withBag } from '../../../helpers/runs'
import { anyDialogueId, envWithChance, envWithOnly, firstNodeOfType, neighbourOf } from '../../../helpers/overworld'

const inCamp = (run: RunState): RunState => ({ ...run, nodeId: firstNodeOfType('CAMP').id, camp: { actionTaken: false } })

describe('run/scout (brief §2.10 unified rule)', () => {
  it('scoutableEdges: every road within depth hops, once, with the pass a real hop would use', () => {
    const run = inCamp(newRun(1))
    const edges = scoutableEdges(run, env.rules.camp.scoutDepth, env)
    expect(edges.length).toBeGreaterThan(0)
    const keys = edges.map((e) => edgeKey(e.from, e.to))
    expect(new Set(keys).size).toBe(keys.length)
    for (const e of edges) expect(e.pass).toBe(1)
    expect(scoutableEdges(run, 1, env).length).toBeLessThanOrEqual(edges.length)
    const crossed = { ...run, edgeTraversals: { [keys[0]!]: { count: 2, lastDay: 1 } } }
    expect(scoutableEdges(crossed, 3, env).find((e) => edgeKey(e.from, e.to) === keys[0])?.pass).toBe(3)
  })

  it('costs 1 food, stores every roll under its DIRECTED key, and is the visit\'s one action', () => {
    const e = envWithChance(1)
    const run = inCamp(newRun(9))
    const edges = scoutableEdges(run, e.rules.camp.scoutDepth, e)
    const r = scout(run, e)
    expect(foodCount(r.state.bag, e)).toBe(foodCount(run.bag, e) - e.rules.camp.scoutFoodCost)
    expect(r.state.daysElapsed).toBe(run.daysElapsed)
    expect(r.state.camp).toEqual({ actionTaken: true })
    expect(Object.keys(r.state.scoutedEdges).sort()).toEqual(edges.map((x) => edgeDirPassKey(x.from, x.to, x.pass)).sort())
    // The FIRST edge of the sweep rolls against the run's own fired set, so it must equal a fresh hop roll.
    // Later edges may not: `scout` threads the one-shots it has already pre-rolled (see the next case).
    const first = edges[0]!
    expect(r.state.scoutedEdges[edgeDirPassKey(first.from, first.to, first.pass)]).toEqual(rollHop(run, first.from, first.to, first.pass, e))
    expect(r.state.oneShotsFired).toEqual(run.oneShotsFired) // scouting never fires a one-shot
    expect(r.effects).toContainEqual({ kind: 'scouted', edgeKeys: Object.keys(r.state.scoutedEdges) })
    const again = scout(r.state, e)
    expect(again.state).toBe(r.state)
    expect(again.effects[0]?.kind).toBe('refused')
  })

  it('the sweep THREADS its fired set: every stored roll is the roll that edge made in sweep order', () => {
    const e = envWithChance(1)
    for (const seed of [1, 2, 5, 8, 9, 10]) {
      const run = inCamp(newRun(seed))
      const stored = scout(run, e).state.scoutedEdges
      const fired: Record<string, true> = { ...run.oneShotsFired }
      for (const x of scoutableEdges(run, e.rules.camp.scoutDepth, e)) {
        const roll = rollHopWith(run, x.from, x.to, x.pass, fired, e)
        if (roll !== null && roll.oneShot) fired[roll.entryId] = true
        expect(stored[edgeDirPassKey(x.from, x.to, x.pass)]).toEqual(roll)
      }
    }
  })

  it('is refused outside camp and at 0 food', () => {
    const run = newRun(1)
    expect(scout(run, env).state).toBe(run)
    const hungry = withBag(inCamp(run), [])
    expect(scout(hungry, env).state).toBe(hungry)
  })

  it('a one-shot pre-rolled for one road is stored under at most one key', () => {
    const e = envWithOnly({ kind: 'dialogue', dialogueId: anyDialogueId() }, { oneShot: true })
    const r = scout(inCamp(newRun(3)), e)
    const hits = Object.values(r.state.scoutedEdges).filter((x) => x !== null)
    expect(hits).toHaveLength(1)
  })

  it('the next hop over a scouted road consumes the stored result instead of rolling', () => {
    const e = envWithOnly({ kind: 'dialogue', dialogueId: anyDialogueId() })
    const camp = inCamp(newRun(11))
    const scouted = scout({ ...camp, pendingTravel: null }, e).state
    const left = { ...scouted, camp: null }
    const next = neighbourOf(left, e)
    const passKey = edgeDirPassKey(left.nodeId, next, 1)
    expect(passKey in left.scoutedEdges).toBe(true)
    const begin = travelStep(startTravel(left, next, e).state, e)
    expect(passKey in begin.state.scoutedEdges).toBe(false)
    expect(begin.effects.find((x) => x.kind === 'encounterRolled')).toMatchObject({ scouted: true, result: 'dialogue' })
  })

  /**
   * RE-GATE C 3.9. The ration bought a report only the camp screen could read: the sheet, the node card, the hover
   * preview and the CLI all ignored `run.scoutedEdges`, so the intel was behind the player by the time the road was
   * chosen. `sightingOf` / `sightingFor` / `scoutedRoads` are the ONE reading every one of those surfaces takes.
   */
  it('says what the scouts saw in one set of words, for every outcome a road can hold', () => {
    expect(sightingOf(null)).toEqual({ report: 'The road is quiet', quiet: true, kind: 'quiet' })
    const roll = (kind: 'battle' | 'dialogue' | 'checkEvent'): EncounterRoll =>
      ({ entryId: 'x', oneShot: false, outcome: kind === 'battle' ? { kind, enemyGroupId: 'wolves' } : kind === 'dialogue' ? { kind, dialogueId: anyDialogueId() } : { kind, checkEventId: 'blocked_passage' } })
    expect(sightingOf(roll('battle'))).toEqual({ report: 'Armed men on the road', quiet: false, kind: 'battle' })
    expect(sightingOf(roll('dialogue'))).toEqual({ report: 'Someone waits by the road', quiet: false, kind: 'dialogue' })
    expect(sightingOf(roll('checkEvent'))).toEqual({ report: 'Something on the road', quiet: false, kind: 'checkEvent' })
  })

  it('reads a stored sighting by ROAD — one per crossing the ration paid for, and nothing for a road nobody walked', () => {
    const e = envWithChance(1)
    const camp = inCamp(newRun(9))
    // before the ration: the roads are roads
    const next = neighbourOf(camp, e)
    expect(sightingFor(camp, camp.nodeId, next)).toBeNull()

    const scouted = scout(camp, e).state
    const roads = scoutedRoads(scouted, e)
    expect(roads).toHaveLength(Object.keys(scouted.scoutedEdges).length)
    for (const r of roads) expect(r.sighting).toEqual(sightingOf(scouted.scoutedEdges[edgeDirPassKey(r.from, r.to, 1)] ?? null))
    expect(sightingFor(scouted, camp.nodeId, next)).not.toBeNull()
    // the record is DIRECTIONAL and per pass: the road walked the other way, or walked again, has no sighting
    expect(sightingFor(scouted, next, camp.nodeId)).toBeNull()
    const walked = { ...scouted, edgeTraversals: { [edgeKey(camp.nodeId, next)]: { count: 1, lastDay: 1 } } }
    expect(sightingFor(walked, camp.nodeId, next)).toBeNull()
  })

  it('a road scouted AWAY from a no-roll node still refuses to roll when it is walked back INTO one (§2.9)', () => {
    // The shipped `noRollInto` no longer holds DUNGEON (0124) and the throne is seven hops from any camp the
    // scouts can reach, so the DIRECTIONAL rule is exercised on a widened list. What is under test is that a roll
    // stored for A→B is never spent on the crossing B→A into a no-roll node — not which types are on the list.
    const base = envWithOnly({ kind: 'dialogue', dialogueId: anyDialogueId() })
    const e = createEnv(base.content, { ...base.rules, travel: { ...base.rules.travel, noRollInto: ['TOWN', 'DUNGEON', 'BOSS'] } })
    const camp = inCamp(newRun(9))
    const scouted = scout({ ...camp, pendingTravel: null }, e).state
    const noRoll: readonly string[] = e.rules.travel.noRollInto
    // a road the scouts walked OUT of a no-roll node: the stored roll is a real encounter, but the crossing back is INTO the town
    const out = scoutableEdges(camp, e.rules.camp.scoutDepth, e).find((x) => noRoll.includes(nodeOf(x.from, e).type))
    expect(out).toBeDefined()
    if (out === undefined) return
    const key = edgeDirPassKey(out.from, out.to, out.pass)
    const stored: EncounterRoll | null = scouted.scoutedEdges[key] ?? null
    expect(stored).not.toBeNull()
    expect(edgeDirPassKey(out.to, out.from, out.pass) in scouted.scoutedEdges).toBe(false)

    const walker: RunState = { ...scouted, camp: null, nodeId: out.to, pendingTravel: null }
    const begin = travelStep(startTravel(walker, out.from, e).state, e)
    expect(begin.effects.find((x) => x.kind === 'encounterRolled')).toMatchObject({ scouted: false, result: 'quiet' })
    expect(begin.state.pendingTravel?.hop?.encounter).toBeNull()
    expect(begin.state.scoutedEdges[key]).toEqual(stored) // the scouts' own crossing is untouched
  })
})
