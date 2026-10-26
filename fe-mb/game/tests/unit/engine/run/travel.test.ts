import { describe, expect, it } from 'vitest'
import type { Effect } from '../../../../src/engine/effects'
import { foodCount } from '../../../../src/engine/run/bag'
import { edgeKey, findPath, refKey } from '../../../../src/engine/run/overworld'
import { livingUnits } from '../../../../src/engine/run/party'
import { challengeBoss, continueTravel, resumeTravel, startTravel, stayHere, throneWarning, travelStep } from '../../../../src/engine/run/travel'
import type { EngineEnv, RunState } from '../../../../src/engine/types'
import { env, newRun, withBag } from '../../../helpers/runs'
import { anyCheckEventId, anyDialogueId, at, envWithChance, envWithOnly, farNode, firstNodeOfType, neighbourOf } from '../../../helpers/overworld'

const quiet = envWithChance(0)
const kinds = (effects: readonly Effect[]): string[] => effects.map((e) => e.kind)
const refusedOnly = (r: { state: RunState; effects: readonly Effect[] }, prev: RunState): void => {
  expect(r.state).toBe(prev)
  expect(r.effects.filter((e) => e.kind === 'refused')).toHaveLength(1)
}

/** Walk until the party stands still (atNode), returning every effect on the way. */
function walk(run: RunState, e: EngineEnv, maxSteps = 40): { run: RunState; effects: Effect[] } {
  const effects: Effect[] = []
  let st = run
  for (let i = 0; i < maxSteps && st.pendingTravel?.status === 'walking'; i++) {
    const r = travelStep(st, e)
    expect(r.effects.some((x) => x.kind === 'refused')).toBe(false)
    st = r.state
    effects.push(...r.effects)
  }
  return { run: st, effects }
}

describe('run/travel — startTravel', () => {
  it('the current node re-enters with no hop and no food; an unreachable node is refused with the same reference', () => {
    const run = newRun(1)
    const same = startTravel(run, run.nodeId, quiet)
    expect(same.state.pendingTravel).toEqual({ path: [], hopsTotal: 0, status: 'atNode', hop: null })
    expect(same.state.daysElapsed).toBe(run.daysElapsed)
    expect(foodCount(same.state.bag, quiet)).toBe(foodCount(run.bag, quiet))
    const hidden = quiet.content.overworld.nodes.find((n) => n.hidden === true)!
    refusedOnly(startTravel(run, hidden.id, quiet), run)
  })
  it('a node click from the quick menu replaces the atNode record and reports the abandoned one', () => {
    const run = startTravel(newRun(1), newRun(1).nodeId, quiet).state
    const r = startTravel(run, neighbourOf(run), quiet)
    expect(r.state.pendingTravel?.status).toBe('walking')
    expect(r.effects).toContainEqual({ kind: 'journeyEnded', nodeId: run.nodeId, reason: 'stayed' })
  })
})

describe('run/travel — one quiet hop (brief §2.9 per hop)', () => {
  it('BEGIN spends a day and a food and rolls; LAND moves, bumps the traversal, marks visited, arrives', () => {
    const run = newRun(1)
    const next = neighbourOf(run)
    const key = edgeKey(run.nodeId, next)
    const started = startTravel(run, next, quiet).state
    const begin = travelStep(started, quiet)
    expect(begin.state.daysElapsed).toBe(run.daysElapsed + quiet.rules.travel.daysPerHop)
    expect(foodCount(begin.state.bag, quiet)).toBe(foodCount(run.bag, quiet) - quiet.rules.travel.foodPerHop)
    expect(begin.state.stats.hops).toBe(run.stats.hops + 1)
    expect(begin.state.nodeId).toBe(run.nodeId) // not there yet
    expect(begin.state.edgeTraversals[key]).toBeUndefined() // bumps only on LAND (§7.19)
    expect(begin.state.pendingTravel?.hop).toEqual({ from: run.nodeId, to: next, pass: 1, encounter: null, resolved: true })
    expect(kinds(begin.effects)).toEqual(expect.arrayContaining(['foodChanged', 'hopStarted', 'encounterRolled']))
    expect(begin.effects.find((e) => e.kind === 'encounterRolled')).toMatchObject({ result: 'quiet', scouted: false, pass: 1, edgeKey: key })

    const land = travelStep(begin.state, quiet)
    expect(land.state.nodeId).toBe(next)
    expect(land.state.edgeTraversals[key]).toEqual({ count: 1, lastDay: begin.state.daysElapsed })
    expect(land.state.visitedNodes[refKey('overworld', quiet.content.overworld.id, next)]).toBe(true)
    expect(land.state.pendingTravel).toEqual({ path: [], hopsTotal: 1, status: 'atNode', hop: null })
    expect(kinds(land.effects)).toEqual(expect.arrayContaining(['hopLanded', 'locationArrived', 'journeyEnded']))
  })

  it('at 0 food every living unit takes starvationDamage instead', () => {
    const run = withBag(newRun(1), [])
    const next = neighbourOf(run)
    const begin = travelStep(startTravel(run, next, quiet).state, quiet)
    for (const u of livingUnits(run)) expect(begin.state.party[u.id]!.hp.current).toBe(u.hp.current - quiet.rules.travel.starvationDamage)
    expect(begin.effects).toContainEqual({ kind: 'starvation', unitIds: livingUnits(run).map((u) => u.id), amount: quiet.rules.travel.starvationDamage })
  })

  it('≥ 3 full hop cycles: day, food and hop counters move once per hop and the walk ends at the destination', () => {
    const run = newRun(2)
    const town = farNode(run, 3, 6, quiet)
    const path = findPath(run, town.id, quiet)!
    expect(path.length).toBeGreaterThanOrEqual(3)
    let st = startTravel(run, town.id, quiet).state
    let hops = 0
    const foodAtStart = foodCount(run.bag, quiet)
    // chain through pauses: continue whenever the walk stops short of the destination
    for (let guard = 0; guard < 60 && st.nodeId !== town.id; guard++) {
      const w = walk(st, quiet)
      st = w.run
      hops += w.effects.filter((e) => e.kind === 'hopLanded').length
      if (st.nodeId !== town.id) st = continueTravel(st)
    }
    expect(st.nodeId).toBe(town.id)
    expect(hops).toBe(path.length)
    expect(st.daysElapsed).toBe(run.daysElapsed + path.length * quiet.rules.travel.daysPerHop)
    expect(foodCount(st.bag, quiet)).toBe(Math.max(0, foodAtStart - path.length * quiet.rules.travel.foodPerHop))
    expect(st.stats.hops).toBe(run.stats.hops + path.length)
    expect(st.pendingTravel?.status).toBe('atNode')
  })
})

describe('run/travel — encounters suspend the hop and never re-roll (brief §7.16, §7.19)', () => {
  it('a dialogue roll opens pendingDialogue, marks a one-shot fired, and the hop lands after resumeTravel', () => {
    const e = envWithOnly({ kind: 'dialogue', dialogueId: anyDialogueId() }, { oneShot: true })
    const run = newRun(4)
    const next = neighbourOf(run, e)
    const begin = travelStep(startTravel(run, next, e).state, e)
    expect(begin.state.pendingTravel?.status).toBe('suspended')
    expect(begin.state.pendingTravel?.hop?.resolved).toBe(false)
    expect(begin.state.pendingDialogue?.dialogueId).toBe(anyDialogueId())
    expect(begin.state.oneShotsFired['fx_entry']).toBe(true)
    expect(begin.state.nodeId).toBe(run.nodeId)
    refusedOnly(travelStep(begin.state, e), begin.state) // a suspended hop does not step
    const resumed = resumeTravel(begin.state)
    expect(resumed.pendingTravel?.status).toBe('walking')
    expect(resumed.pendingTravel?.hop?.resolved).toBe(true)
    const land = travelStep(resumed, e)
    expect(land.state.nodeId).toBe(next)
    expect(land.effects.some((x) => x.kind === 'encounterRolled')).toBe(false) // landing never rolls
  })

  it('a battle roll parks pendingCombat with a travel origin, the group, the area level, and capture targets', () => {
    const groupId = Object.keys(env.content.enemyGroups)[0]!
    const e = envWithOnly({ kind: 'battle', enemyGroupId: groupId })
    const run = newRun(6)
    const next = neighbourOf(run, e)
    const begin = travelStep(startTravel(run, next, e).state, e)
    expect(begin.state.pendingCombat).toMatchObject({ origin: { kind: 'travel', from: run.nodeId, to: next, encounterId: 'fx_entry' }, enemies: { kind: 'group', enemyGroupId: groupId }, captureTargets: [] })
    expect(begin.state.pendingTravel?.status).toBe('suspended')
  })

  it('a check-event roll opens pendingCheckEvent with source travel', () => {
    const e = envWithOnly({ kind: 'checkEvent', checkEventId: anyCheckEventId() })
    const run = newRun(7)
    const begin = travelStep(startTravel(run, neighbourOf(run, e), e).state, e)
    expect(begin.state.pendingCheckEvent).toMatchObject({ checkEventId: anyCheckEventId(), source: 'travel', result: null })
  })
})

describe('run/travel — quick menu verbs', () => {
  it('continueTravel resumes a paused walk; stayHere clears the itinerary', () => {
    const run = newRun(1)
    const paused: RunState = { ...run, pendingTravel: { path: [neighbourOf(run)], hopsTotal: 2, status: 'atNode', hop: null } }
    expect(continueTravel(paused).pendingTravel?.status).toBe('walking')
    expect(continueTravel({ ...paused, pendingTravel: { ...paused.pendingTravel!, path: [] } })).toEqual({ ...paused, pendingTravel: { ...paused.pendingTravel!, path: [] } })
    expect(stayHere(paused).pendingTravel).toBeNull()
    expect(stayHere(run)).toBe(run)
  })
  it('challengeBoss is refused off the BOSS node and parks a finalBoss battle on it', () => {
    const run = newRun(1)
    refusedOnly(challengeBoss(run, env), run)
    const boss = firstNodeOfType('BOSS')
    const r = challengeBoss(at(run, boss.id), env)
    expect(r.state.pendingCombat).toMatchObject({ origin: { kind: 'finalBoss', nodeId: boss.id }, enemies: { kind: 'group', enemyGroupId: boss.enemyGroupId, level: env.rules.difficulty.bossLevel } })
  })

  /** RE-GATE C 3.14: the dungeon mouth warns before it commits the company (0113) and the LAST door said nothing
   *  at all — no name for who waits, no line saying this is the last battle, no word that there is no retreat and
   *  no inn behind it. A blind run walked in on day 15 with two units because nothing suggested otherwise. */
  it('says what waits behind the last door, and only at the last door', () => {
    const run = newRun(1)
    expect(throneWarning(run, env)).toBeNull()
    for (const type of ['TOWN', 'CAMP', 'DUNGEON'] as const) {
      expect(throneWarning(at(run, firstNodeOfType(type).id), env)).toBeNull()
    }
    const boss = firstNodeOfType('BOSS')
    const said = throneWarning(at(run, boss.id), env)
    expect(said).not.toBeNull()
    if (said === null) return
    // Every word is derived from the node's own content: the group, whoever leads it, and the place.
    const group = env.content.enemyGroups[boss.enemyGroupId!]!
    expect(said).toContain(group.name)
    expect(said).toContain(group.members[0]!.name)
    expect(said).toContain(boss.name)
    // ...and it carries the two facts that make it a warning rather than a label.
    expect(said).toContain('no retreat')
    expect(said).toContain('no inn')
    // ARCHITECTURE §5.1: body prose beside a LEGAL verb — whole sentences with stops, no id anywhere.
    expect(said.endsWith('.')).toBe(true)
    expect(said).not.toContain(boss.id)
    expect(said).not.toMatch(/[a-z]_[a-z]/)
  })
})
