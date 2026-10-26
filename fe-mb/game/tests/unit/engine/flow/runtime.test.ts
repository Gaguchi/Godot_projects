/**
 * flow/runtime.ts — the ONE dispatch chokepoint (CONTRACT §2). Pinned here: persistence precedes notification,
 * a refused pump halts pumping and reports, quitting mid-enemy-turn schedules nothing (and Continue resumes it),
 * and the opt-in dev guard asserts the invariants at the action that broke them.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Action, PumpAction } from '../../../../src/engine/actions'
import { fixtureFor } from '../../../../src/engine/flow/fixtures'
import { nextPump } from '../../../../src/engine/flow/pump'
import { createRuntime } from '../../../../src/engine/flow/runtime'
import type { GameState, SaveFile } from '../../../../src/engine/types'
import { env } from '../../../helpers/env'
import { envWithChance } from '../../../helpers/overworld'

const SEED = 7

/** A scheduler that never fires on its own — the test decides when a pump runs. */
function manualScheduler(): { readonly schedule: (pump: PumpAction, run: () => void) => () => void; readonly pending: { pump: PumpAction; run: () => void }[] } {
  const pending: { pump: PumpAction; run: () => void }[] = []
  return {
    pending,
    schedule: (pump, run) => {
      const entry = { pump, run }
      pending.push(entry)
      return () => {
        const i = pending.indexOf(entry)
        if (i >= 0) pending.splice(i, 1)
      }
    },
  }
}

describe('runtime — persistence precedes notification', () => {
  it('a throwing state listener does not skip the urgent null-save', () => {
    const quiet = envWithChance(0)
    const writes: { file: SaveFile; urgent: boolean }[] = []
    const rt = createRuntime({ env: quiet, initial: fixtureFor('overworld', 5, quiet), persist: (file, urgent) => { writes.push({ file, urgent }) } })
    const run = rt.getState().run
    if (run === null) throw new Error('no run')
    // one hit point each and an empty bag: the next hop starves the company off the road
    const weak = { ...run, party: Object.fromEntries(Object.entries(run.party).map(([id, u]) => [id, { ...u, hp: { ...u.hp, current: 1 } }])), bag: [] }
    rt.dispatch({ type: 'dev/seedState', state: { ...rt.getState(), run: weak } })
    const edge = quiet.content.overworld.edges.find((e) => e.from === weak.nodeId || e.to === weak.nodeId)
    if (edge === undefined) throw new Error('the start node has no road')

    // the listener blows up on exactly the commit that ends the run — the one whose save must already be written
    rt.subscribe((s) => { if (s.run === null) throw new Error('listener blew up') })
    rt.dispatch({ type: 'travel/goTo', nodeId: edge.from === weak.nodeId ? edge.to : edge.from })
    expect(() => rt.drain()).toThrow(/listener blew up/)

    expect(rt.getState().run).toBeNull()
    const nullSave = writes.filter((w) => w.file.run === null)
    expect(nullSave.length, 'the run-ended save never reached storage').toBeGreaterThan(0)
    expect(nullSave[nullSave.length - 1]?.urgent).toBe(true)
    rt.destroy()
  })

  it('a persist that throws is reported and never stops the listeners', () => {
    const errors: unknown[] = []
    const seen: GameState[] = []
    const rt = createRuntime({ env, initial: fixtureFor('overworld', SEED, env), persist: () => { throw new Error('disk full') }, onError: (e) => errors.push(e) })
    rt.subscribe((s) => seen.push(s))
    rt.dispatch({ type: 'meta/toTitle' })
    expect(errors).toHaveLength(1)
    expect(seen).toHaveLength(1)
    rt.destroy()
  })
})

describe('runtime — pumps', () => {
  it('toTitle during an enemy turn schedules no pump; continueRun resumes it', () => {
    const sched = manualScheduler()
    const rt = createRuntime({ env, initial: fixtureFor('combat', SEED, env), schedule: sched.schedule })
    for (let i = 0; i < 32; i++) {
      const combat = rt.getState().combat
      if (combat === null || combat.units[combat.turn.unitId]?.team === 'enemy') break
      rt.dispatch({ type: 'combat/endTurn' })
    }
    expect(nextPump(rt.getState())).toEqual({ type: 'combat/enemyStep' })
    expect(sched.pending).toHaveLength(1)
    rt.dispatch({ type: 'meta/toTitle' })
    expect(sched.pending).toHaveLength(0)
    expect(rt.pump()).toBe(false)
    rt.dispatch({ type: 'meta/continueRun' })
    expect(sched.pending.map((p) => p.pump)).toEqual([{ type: 'combat/enemyStep' }])
    rt.destroy()
  })

  it('setPaused stops the world and un-pausing schedules the due pump again', () => {
    const sched = manualScheduler()
    const map = fixtureFor('overworld', SEED, env)
    const run = map.run
    if (run === null) throw new Error('no run')
    const edge = env.content.overworld.edges.find((e) => e.from === run.nodeId || e.to === run.nodeId)
    if (edge === undefined) throw new Error('the start node has no road')
    const rt = createRuntime({ env, initial: map, schedule: sched.schedule })
    rt.dispatch({ type: 'travel/goTo', nodeId: edge.from === run.nodeId ? edge.to : edge.from })
    expect(sched.pending).toHaveLength(1)

    rt.setPaused(true)
    expect(rt.isPaused()).toBe(true)
    expect(sched.pending).toHaveLength(0)
    expect(rt.pump()).toBe(false)
    const parked = rt.getState()
    rt.dispatch({ type: 'ui/toggleDanger' })
    expect(rt.getState().run).toBe(parked.run)
    expect(sched.pending).toHaveLength(0)

    rt.setPaused(false)
    expect(sched.pending.map((p) => p.pump)).toEqual([{ type: 'travel/step' }])
    rt.destroy()
  })

  it('a refused pump halts pumping and reports', () => {
    const errors: unknown[] = []
    const rt = createRuntime({ env, initial: fixtureFor('overworld', SEED, env), onError: (e) => errors.push(e) })
    // `travel/step` is not due here: dispatching it by hand is exactly the "nextPump and isLegal disagree" bug
    expect(() => rt.dispatch({ type: 'travel/step' })).toThrow(/was refused/)
    expect(errors).toHaveLength(1)
    expect(rt.pump()).toBe(false)
    // a player dispatch clears the halt
    rt.dispatch({ type: 'ui/toggleDanger' })
    expect(rt.pump()).toBe(false)
    rt.destroy()
  })

  it('drain throws past its cap rather than spinning', () => {
    const rt = createRuntime({ env, initial: fixtureFor('combat', SEED, env) })
    for (let i = 0; i < 32; i++) {
      const combat = rt.getState().combat
      if (combat === null || combat.units[combat.turn.unitId]?.team === 'enemy') break
      rt.dispatch({ type: 'combat/endTurn' })
    }
    expect(nextPump(rt.getState())).toEqual({ type: 'combat/enemyStep' })
    expect(() => rt.drain(0)).toThrow(/without reaching a quiescent state/)
    rt.destroy()
  })
})

describe('runtime — the dev guard', () => {
  it('the dev runtime asserts invariants after every commit', () => {
    const errors: unknown[] = []
    const good = createRuntime({ env, initial: fixtureFor('overworld', SEED, env), dev: true, onError: (e) => errors.push(e) })
    good.dispatch({ type: 'meta/toTitle' })
    good.dispatch({ type: 'meta/continueRun' })
    expect(errors).toEqual([])
    good.destroy()

    // a state the slots contradict fails AT the action that installed it
    const bad = createRuntime({ env, initial: fixtureFor('overworld', SEED, env), dev: true, onError: (e) => errors.push(e) })
    const won = fixtureFor('win', SEED, env)
    const broken: GameState = { ...won, screen: { kind: 'title' } }
    expect(() => bad.dispatch({ type: 'dev/seedState', state: broken })).toThrow(/invariants violated/)
    expect(errors).toHaveLength(1)
    bad.destroy()
  })

  it('the dev runtime freezes the state it commits', () => {
    const rt = createRuntime({ env, initial: fixtureFor('overworld', SEED, env), dev: true })
    rt.dispatch({ type: 'ui/toggleDanger' })
    const s = rt.getState()
    expect(Object.isFrozen(s)).toBe(true)
    expect(Object.isFrozen(s.run)).toBe(true)
    expect(() => { (s.run as unknown as { gold: number }).gold = 999 }).toThrow()
    rt.destroy()
  })

  it('production (dev off) does not freeze and does not assert', () => {
    const rt = createRuntime({ env, initial: fixtureFor('overworld', SEED, env) })
    rt.dispatch({ type: 'ui/toggleDanger' })
    expect(Object.isFrozen(rt.getState())).toBe(false)
    rt.destroy()
  })
})

describe('runtime — bookkeeping', () => {
  it('logs every action (pumps included) when asked, and destroy stops everything', () => {
    const rt = createRuntime({ env, initial: fixtureFor('overworld', SEED, env), log: true })
    rt.dispatch({ type: 'ui/toggleDanger' })
    rt.dispatch({ type: 'meta/toTitle' })
    expect(rt.actions.map((a: Action) => a.type)).toEqual(['ui/toggleDanger', 'meta/toTitle'])
    rt.destroy()
    expect(rt.dispatch({ type: 'meta/continueRun' })).toEqual([])
  })

  it('a re-entrant dispatch is queued and applied after the current commit', () => {
    const rt = createRuntime({ env, initial: fixtureFor('overworld', SEED, env) })
    const seen: string[] = []
    let fired = false
    rt.subscribe((s) => {
      seen.push(s.screen.kind)
      if (!fired) { fired = true; rt.dispatch({ type: 'meta/continueRun' }) }
    })
    rt.dispatch({ type: 'meta/toTitle' })
    expect(seen).toEqual(['title', 'overworld'])
    rt.destroy()
  })

  it('settled() resolves once every effect listener promise of the last commit has drained', async () => {
    const rt = createRuntime({ env, initial: fixtureFor('overworld', SEED, env) })
    let resolved = false
    const gate = vi.fn(async () => { await Promise.resolve(); resolved = true })
    rt.onEffects(() => gate())
    rt.dispatch({ type: 'ui/toggleDanger' })
    await rt.settled()
    expect(resolved).toBe(true)
    rt.destroy()
  })
})
