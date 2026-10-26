/**
 * The fight that ends a run gets its report before the ledger (CONTRACT-CHANGES 0082).
 *
 * Before this, `flow/settle.ts` rule 1 resolved a lost battle and called `endRun('lost')` in the SAME pass, so the
 * browser went combat → gameOver and the one battle whose report a player most wants — the one that killed them —
 * was the only battle with no report at all (GATE3-13). Nothing in the 1164-test suite noticed, because no test
 * drove a non-tutorial battle to a defeat through the reducer and then asked what screen it landed on.
 *
 * The rules this file pins:
 *   1. a lost battle rests at `battleEnd` with a report whose outcome is `defeat`, and the run is still there;
 *   2. `battleEnd/dismiss` is what ends it — ledger, `runsLost++`, an urgent null save, screen `gameOver`;
 *   3. that window is the ONLY one in which a wiped company may hold a run (`flow/invariants.ts`);
 *   4. a WON field on which the MC fell is read the same way: report first, then the run ends on dismiss;
 *   5. defeat off the field (starvation, quest damage) is untouched — still terminal in the same pass.
 */
import { describe, expect, it } from 'vitest'
import { fixtureFor } from '../../../../src/engine/flow/fixtures'
import { checkInvariants } from '../../../../src/engine/flow/invariants'
import { isMcAlive, livingUnits } from '../../../../src/engine/run/party'
import type { CombatState, GameState } from '../../../../src/engine/types'
import { env } from '../../../helpers/env'
import { Session } from '../../../helpers/session'

const SEED = 7

/** Cut one team down where it stood and set the phase settle will resolve. */
function decide(state: GameState, loser: 'party' | 'enemy'): GameState {
  const combat = state.combat
  if (combat === null) throw new Error('fixture: no battle')
  const units = { ...combat.units }
  for (const u of Object.values(units)) {
    if (u.team === loser && u.position !== null) units[u.id] = { ...u, hp: { ...u.hp, current: 0 }, position: null, lastTile: u.position }
  }
  const ended: CombatState = { ...combat, units, phase: loser === 'party' ? 'defeat' : 'victory' }
  return { ...state, combat: ended }
}

describe('a lost battle is read before the run ends', () => {
  it('rests on its field report — the run is still in hand and the page says the field was lost', () => {
    const s = new Session(fixtureFor('combat', SEED, env))
    s.do({ type: 'dev/seedState', state: decide(s.state, 'party') })

    expect(s.state.screen.kind).toBe('battleEnd')
    expect(s.state.combat).toBeNull()
    expect(s.state.ledger).toBeNull()
    expect(s.state.run).not.toBeNull()
    const report = s.state.run?.lastBattle
    expect(report?.outcome).toBe('defeat')
    expect(report?.tag).not.toBe('tutorial')
    // the frozen field is there to be drawn: every unit has a tile, the fallen included
    expect(report?.field.tokens.length ?? 0).toBeGreaterThan(0)
    expect(report?.field.tokens.every((t) => t.tile !== null)).toBe(true)
    expect(report?.field.tokens.some((t) => t.fallen)).toBe(true)
  })

  it('and turning the page is what ends it: ledger, runsLost, urgent null save, gameOver', () => {
    const s = new Session(fixtureFor('combat', SEED, env))
    const lostBefore = s.state.meta.runsLost
    s.do({ type: 'dev/seedState', state: decide(s.state, 'party') })
    const before = s.effects.length

    s.do({ type: 'battleEnd/dismiss' })

    expect(s.state.screen.kind).toBe('gameOver')
    expect(s.state.run).toBeNull()
    expect(s.state.combat).toBeNull()
    expect(s.state.ledger?.outcome).toBe('lost')
    expect(s.state.meta.runsLost).toBe(lostBefore + 1)
    const tail = s.effects.slice(before)
    const ended = tail.findIndex((e) => e.kind === 'runEnded')
    const saved = tail.findIndex((e, i) => i > ended && e.kind === 'autosave' && e.urgent)
    expect(ended).toBeGreaterThanOrEqual(0)
    expect(saved).toBeGreaterThan(ended)
  })

  it('the ledger names everyone who fell in it, with the cause', () => {
    const s = new Session(fixtureFor('combat', SEED, env))
    const party = Object.values(s.state.combat?.units ?? {}).filter((u) => u.team === 'party').map((u) => u.id).sort()
    s.do({ type: 'dev/seedState', state: decide(s.state, 'party') })
    s.do({ type: 'battleEnd/dismiss' })
    expect([...(s.state.ledger?.fallen ?? [])].map((f) => f.unitId).sort()).toEqual(party)
    expect(s.state.ledger?.fallen.every((f) => f.cause === 'battle')).toBe(true)
  })

  it('a wiped company may hold a run ONLY under its own report — anywhere else it is an invariant violation', () => {
    const s = new Session(fixtureFor('combat', SEED, env))
    s.do({ type: 'dev/seedState', state: decide(s.state, 'party') })
    const parked = s.state
    expect(livingUnits(parked.run!).length === 0 || !isMcAlive(parked.run!)).toBe(true)
    expect(checkInvariants(parked, env)).toEqual([])
    // the same slots on any other screen are exactly what the invariant is for
    const offReport = { ...parked, screen: { kind: 'overworld' as const } }
    expect(checkInvariants(offReport, env).join(' ')).toMatch(/no living unit|MC is dead/)
  })

  it('a WON field the MC did not walk off is read the same way: report first, run ends on dismiss', () => {
    const s = new Session(fixtureFor('combat', SEED, env))
    const won = decide(s.state, 'enemy')
    const mc = won.combat?.units['mc']
    if (mc === undefined || mc.position === null) throw new Error('fixture: no MC on the board')
    s.do({
      type: 'dev/seedState',
      state: { ...won, combat: { ...won.combat!, units: { ...won.combat!.units, mc: { ...mc, hp: { ...mc.hp, current: 0 }, position: null, lastTile: mc.position } } } },
    })
    expect(s.state.screen.kind).toBe('battleEnd')
    expect(s.state.run?.lastBattle?.outcome).toBe('victory')
    expect(s.state.ledger).toBeNull()
    s.do({ type: 'battleEnd/dismiss' })
    expect(s.state.screen.kind).toBe('gameOver')
    expect(s.state.ledger?.outcome).toBe('lost')
  })

  it('defeat off the field is untouched: a wipe on the road still ends the run in the same pass', () => {
    const s = new Session(fixtureFor('overworld', SEED, env))
    s.do({ type: 'quest/applyEffects', effects: [{ kind: 'damageParty', amount: 999 }] })
    expect(s.state.screen.kind).toBe('gameOver')
    expect(s.state.run).toBeNull()
    expect(s.state.ledger?.outcome).toBe('lost')
  })
})

describe('the two terminal fixtures carry what their screens are for', () => {
  it('win: a real finalBoss victory with the trophy DECISIONS promises, named from content', () => {
    const won = fixtureFor('win', SEED, env)
    expect(won.screen.kind).toBe('win')
    expect(won.ledger?.outcome).toBe('won')
    const trophy = won.ledger?.trophyItemId ?? null
    expect(trophy, 'the win screen has no trophy to name').not.toBeNull()
    expect(env.content.items[trophy!]?.rarity).toBe('legendary')
    expect(won.ledger?.stats.battlesWon ?? 0).toBeGreaterThan(0)
  })

  it('gameOver: a real defeat, so the page has names on it', () => {
    const lost = fixtureFor('gameOver', SEED, env)
    expect(lost.screen.kind).toBe('gameOver')
    expect(lost.ledger?.outcome).toBe('lost')
    expect(lost.ledger?.fallen.length ?? 0).toBeGreaterThan(0)
    expect(lost.ledger?.fallen.every((f) => f.name.length > 0)).toBe(true)
    // and the count and the names agree — the double-count this ledger used to print
    expect(lost.ledger?.stats.unitsLost).toBe(lost.ledger?.fallen.length)
  })
})
