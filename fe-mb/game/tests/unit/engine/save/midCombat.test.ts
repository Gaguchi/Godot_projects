/**
 * Brief §7.31 / §2.14 rule 3-4: combat state is a first-class schema'd field, resumed EXACTLY. A mid-battle
 * snapshot (selection included, CONTRACT-CHANGES 0016) reloads verbatim, `obstacles` stays an array, and — once
 * the flow + combat packages have landed — seed, 3 dispatches, snapshot, reload, replay the same 3 ⇒ deep-equal.
 */
import { describe, expect, it } from 'vitest'
import { fromSaveFile, parseSave, serialize, toSaveFile } from '../../../../src/engine/save/codec'
import { replay, verifyReplay } from '../../../../src/engine/save/replay'
import { fixtureFor } from '../../../../src/engine/flow/fixtures'
import { nextPump } from '../../../../src/engine/flow/pump'
import { createRuntime } from '../../../../src/engine/flow/runtime'
import type { Action } from '../../../../src/engine/actions'
import { hydratedExpectation, landed, populatedMidCombat, roundTrip, testEnv } from '../../../helpers/saves'

const env = testEnv()

describe('save/midCombat', () => {
  it('a mid-selection snapshot round-trips verbatim: selection, corpses (lastTile), statuses, cover ledger, quiver mods, rng', () => {
    const state = populatedMidCombat()
    const back = roundTrip(state, env)
    expect(back).toEqual(hydratedExpectation(state))
    const combat = back.combat!
    expect(combat.selection).toEqual({ kind: 'card', cardUid: 'iron_sword_slash#1', pinnedTile: '6,4' })
    expect(combat.units.darens_gang_0).toMatchObject({ position: null, lastTile: '4,4', hp: { current: 0, max: 22 } })
    expect(combat.units.darens_gang_1).toMatchObject({ position: null, lastTile: '8,6', captured: true })
    expect(combat.units.daren?.statuses).toEqual([{ id: 'poison', stacks: 2, turns: 2, expiresAt: 'ownerTurnEnd', sourceId: 'kael' }])
    expect(combat.units.oak?.coverUsed).toEqual(['mc'])
    expect(combat.decks.kael?.cards['iron_bow_quick_shot#2']?.mod).toEqual({ kind: 'poison', value: 2, turns: 2 })
    expect(combat.rng).toEqual({ seed: 2077, counter: 17 })
  })

  it('obstacles come back as a sorted string[] (never a Set), so isObstacle can binary-search after a reload', () => {
    const back = roundTrip(populatedMidCombat(), env)
    const obstacles = back.combat!.grid.obstacles
    expect(Array.isArray(obstacles)).toBe(true)
    expect([...obstacles].sort()).toEqual([...obstacles])
    expect(obstacles.includes('3,4')).toBe(true)
  })

  it('a parked enemy turn round-trips with the enemy as the acting unit and selection idle', () => {
    const state = populatedMidCombat({ turn: { round: 3, unitId: 'daren', acted: ['mc', 'daren'] }, selection: { kind: 'idle' } })
    const back = roundTrip(state, env)
    expect(back.combat?.turn).toEqual({ round: 3, unitId: 'daren', acted: ['mc', 'daren'] })
    expect(back.combat?.selection).toEqual({ kind: 'idle' })
    expect(back.screen.kind).toBe('title') // no pump is due on title; Continue → resumeScreen → combat
  })

  it('a save taken on the Field Report has combat null and lastBattle set, so it can never pay out twice', () => {
    const state = populatedMidCombat()
    const onReport = { ...state, combat: null, run: { ...state.run!, lastBattle: null } }
    const file = toSaveFile(onReport, env)
    expect(file.combat).toBeNull()
    expect(file.run?.pendingCombat).toBeNull()
  })

  it('seed, 3 dispatches, snapshot, reload into a fresh state, replay the same 3 ⇒ deep-equal (real reducer)', (ctx) => {
    if (!landed(() => fixtureFor('combat', 7, env))) return ctx.skip()
    const initial = fixtureFor('combat', 7, env)
    const rt = createRuntime({ env, initial, log: true })
    rt.drain()
    const start = rt.getState()
    const player: readonly Action[] = [{ type: 'combat/enterMove' }, { type: 'combat/cancel' }, { type: 'combat/endTurn' }]
    for (const a of player) rt.dispatch(a)
    const snapshot = rt.getState()
    const logged = rt.actions.slice(rt.actions.length - player.length)
    expect(logged).toEqual(player)

    // Reload: the persisted file hydrates to the same slices.
    const parsed = parseSave(serialize(toSaveFile(snapshot, env)), env)
    expect(parsed.ok, parsed.ok ? '' : parsed.detail).toBe(true)
    if (!parsed.ok) return
    const reloaded = fromSaveFile(parsed.value)
    expect(reloaded.combat).toEqual(snapshot.combat)
    expect(reloaded.run).toEqual(snapshot.run)
    expect(reloaded.meta).toEqual(snapshot.meta)

    // Replay the same three from the pre-dispatch state.
    const folded = replay(start, player, env)
    expect(folded.combat).toEqual(snapshot.combat)
    expect(folded.run).toEqual(snapshot.run)
    expect(verifyReplay(start, player, snapshot, env)).toEqual({ ok: true })
    expect(verifyReplay(initial, rt.actions, snapshot, env)).toEqual({ ok: true })

    // A hydrated enemy turn resumes from nextPump with no input once Continue routes to the combat screen.
    const resumed = createRuntime({ env, initial: reloaded, log: true })
    expect(nextPump(reloaded)).toBeNull()
    resumed.dispatch({ type: 'meta/continueRun' })
    expect(resumed.getState().screen.kind).toBe(snapshot.combat ? 'combat' : resumed.getState().screen.kind)
    resumed.drain()
    expect(nextPump(resumed.getState())).toBeNull()
  })
})
