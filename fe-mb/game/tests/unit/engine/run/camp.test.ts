import { describe, expect, it } from 'vitest'
import { foodCount } from '../../../../src/engine/run/bag'
import { NOTHING_TO_MEND, NO_RATIONS, campActionsUsed, campRest, campRestWouldMend, canCampRest, enterCamp, leaveCamp } from '../../../../src/engine/run/camp'
import { canScout, scout } from '../../../../src/engine/run/scout'
import { livingUnits } from '../../../../src/engine/run/party'
import type { RunState } from '../../../../src/engine/types'
import { env, newRun, withBag, withUnit } from '../../../helpers/runs'
import { at, firstNodeOfType, nodesOfType } from '../../../helpers/overworld'

const camp = firstNodeOfType('CAMP')
const inCamp = (run: RunState): RunState => enterCamp(at(run, camp.id), env).state
const wound = (run: RunState, by: number): RunState => livingUnits(run).reduce((r, u) => withUnit(r, { ...u, hp: { ...u.hp, current: Math.max(1, u.hp.current - by) } }), run)

describe('run/camp (brief §2.10: one action per visit; Rest never ages the run)', () => {
  it('only a CAMP node opens; leave clears', () => {
    const run = newRun(1)
    const town = at(run, firstNodeOfType('TOWN').id) // the start node is itself a camp, so refuse from a town
    expect(enterCamp(town, env).state).toBe(town)
    const c = inCamp(run)
    expect(c.camp).toEqual({ actionTaken: false })
    expect(leaveCamp(c).camp).toBeNull()
  })

  it('Rest heals floor(max × 0.2) for 1 food through consumeFood; day and hop counters do not move', () => {
    const run = wound(inCamp(newRun(1)), 10)
    const r = campRest(run, env)
    expect(foodCount(r.state.bag, env)).toBe(foodCount(run.bag, env) - env.rules.camp.restFoodCost)
    expect(r.state.daysElapsed).toBe(run.daysElapsed)
    expect(r.state.stats.hops).toBe(run.stats.hops)
    for (const u of livingUnits(run)) {
      expect(r.state.party[u.id]!.hp.current).toBe(Math.min(u.hp.max, u.hp.current + Math.floor(u.hp.max * env.rules.camp.restHealFraction)))
    }
    expect(r.effects).toContainEqual({ kind: 'foodChanged', delta: -env.rules.camp.restFoodCost, reason: 'rest' })
    expect(r.state.camp).toEqual({ actionTaken: true })
    const again = campRest(r.state, env)
    expect(again.state).toBe(r.state)
    expect(again.effects[0]?.kind).toBe('refused')
  })

  it('leaving and re-entering a camp on the same day does not restore the day\'s action', () => {
    const rested = campRest(wound(inCamp(newRun(1)), 10), env).state
    expect(rested.camp).toEqual({ actionTaken: true })
    expect(rested.campAction).toEqual({ nodeId: camp.id, day: rested.daysElapsed, actions: env.rules.camp.actionsPerVisit })
    // Leave + Camp again is two clicks off the quick menu: no hop, no day, no food.
    const back = enterCamp(leaveCamp(rested), env).state
    expect(back.camp).toEqual({ actionTaken: true })
    expect(campRest(back, env).state).toBe(back)
    expect(scout(back, env).state).toBe(back)
    // A new day at the same camp — or the same day at a different camp — is a new visit.
    const tomorrow = enterCamp(leaveCamp({ ...rested, daysElapsed: rested.daysElapsed + 1 }), env).state
    expect(tomorrow.camp).toEqual({ actionTaken: false })
    expect(campActionsUsed(tomorrow)).toBe(0)
    const otherCamp = at(leaveCamp(rested), nodesOfType('CAMP')[1]!.id)
    expect(enterCamp(otherCamp, env).state.camp).toEqual({ actionTaken: false })
  })

  it('Rest is refused at 0 food and outside a camp, leaving the state untouched', () => {
    const hungry = withBag(wound(inCamp(newRun(1)), 10), [])
    const r = campRest(hungry, env)
    expect(r.state).toBe(hungry)
    expect(r.effects).toEqual([{ kind: 'refused', action: 'camp/rest', reason: NO_RATIONS }])
    const run = at(newRun(1), firstNodeOfType('TOWN').id)
    expect(campRest(run, env).state).toBe(run)
  })

  /**
   * RE-GATE C 3.1/3.2 — the camp priced its own ration in the reducer only, so with an empty satchel REST and
   * SCOUT stayed lit, still advertised the heal, and swallowed the press in silence on the one screen with no
   * refusal surface. The predicate now lives with the verb and both sides read it — and the sentence it carries is
   * a lowercase fragment (§5.1), not the Title-Case 'No food' the two reducers used to invent.
   */
  it('an empty satchel is the SAME answer from the gate and from the reducer, for Rest and for Scout', () => {
    const hungry = withBag(wound(inCamp(newRun(1)), 10), [])
    expect(foodCount(hungry.bag, env)).toBe(0)
    for (const gate of [canCampRest(hungry, env), canScout(hungry, env)]) {
      expect(gate).toEqual({ ok: false, reason: NO_RATIONS })
    }
    expect(campRest(hungry, env).effects).toEqual([{ kind: 'refused', action: 'camp/rest', reason: NO_RATIONS }])
    expect(scout(hungry, env).effects).toEqual([{ kind: 'refused', action: 'camp/scout', reason: NO_RATIONS }])
    // and the reason is prose, not a machine label
    expect(NO_RATIONS).not.toMatch(/^[A-Z]/)
    expect(NO_RATIONS).not.toMatch(/\.$/)
    // with rations in the satchel both gates open again; Rest keeps its own second rule
    const fed = inCamp(newRun(1))
    expect(canScout(fed, env)).toEqual({ ok: true })
    expect(canCampRest(fed, env)).toEqual({ ok: false, reason: NOTHING_TO_MEND })
    expect(canCampRest(wound(fed, 5), env)).toEqual({ ok: true })
  })

  it('Rest with nobody wounded is refused, not a ration and the night spent on nothing', () => {
    // `healParty(fraction, onlyWounded: false)` "rests" a company already at full HP: it healed nobody but still
    // spent the ration AND the node's one camp action for the day, so the button was live and did nothing.
    const whole = inCamp(newRun(1))
    expect(campRestWouldMend(whole)).toBe(false)
    const r = campRest(whole, env)
    expect(r.state).toBe(whole)
    expect(r.effects).toEqual([{ kind: 'refused', action: 'camp/rest', reason: NOTHING_TO_MEND }])
    expect(foodCount(r.state.bag, env)).toBe(foodCount(whole.bag, env))
    expect(campActionsUsed(r.state)).toBe(0)
    // one scratch on one unit is enough to make the fire worth a ration again
    const scratched = wound(whole, 1)
    expect(campRestWouldMend(scratched)).toBe(true)
    expect(campRest(scratched, env).state).not.toBe(scratched)
  })
})
