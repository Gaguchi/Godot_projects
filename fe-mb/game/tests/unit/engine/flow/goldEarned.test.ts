/**
 * GATE3-02 — "gold earned" on the last screen of the run counts EVERY coin the company took in.
 *
 * `stats.goldEarned` had two hand-written owners (the battle payout and the bounty desk) and six sources that
 * moved the purse without telling it: quest gold, a check event's purse, dungeon treasure, the empty-room
 * fallback and a sale at the shop. Two blind playthroughs ended reading `202 gold` against 272 actually earned
 * and `146` against 316 — a number the player can disprove by counting their own coins.
 *
 * The counter now has ONE door, `run/economy.ts#addGold`, the way `gearFound` has `grantLoot` and `unitsLost` has
 * `removeFallen`. These tests hold it to the cross-check that door makes possible: over any stretch of play,
 * `Δstats.goldEarned` equals the sum of the POSITIVE `goldChanged` deltas the same stretch emitted — an
 * independent measure, since the effects are what the UI animates and the counter is what the ledger prints.
 */
import { describe, expect, it } from 'vitest'
import { fixtureFor } from '../../../../src/engine/flow/fixtures'
import { openCheckEvent } from '../../../../src/engine/run/checks'
import type { CombatState, GameState, Prisoner, RunState } from '../../../../src/engine/types'
import { env } from '../../../helpers/env'
import { Session } from '../../../helpers/session'

const SEED = 7

/** Every positive coin the session's own effects reported — what the player watched arrive. */
function incomeFromEffects(s: Session): number {
  return s.kinds('goldChanged').reduce((sum, e) => sum + Math.max(0, e.delta), 0)
}

function runOf(s: Session): RunState {
  const run = s.state.run
  if (run === null) throw new Error('session: no run')
  return run
}

/** Every enemy down — the shape `resolveBattle` reads, so the payout comes out of the real settle. */
function forceVictory(state: GameState): GameState {
  const combat = state.combat
  if (combat === null) throw new Error('fixture: no battle')
  const units = { ...combat.units }
  for (const u of Object.values(units)) {
    if (u.team === 'enemy' && u.position !== null) units[u.id] = { ...u, hp: { ...u.hp, current: 0 }, position: null, lastTile: u.position }
  }
  const ended: CombatState = { ...combat, units, phase: 'victory' }
  return { ...state, combat: ended }
}

/** The first check-event choice anywhere in content that pays gold with no check that could fail. */
function freeGoldEvent(): { readonly eventId: string; readonly choiceId: string; readonly amount: number } {
  for (const ev of Object.values(env.content.checkEvents)) {
    for (const choice of ev.choices) {
      if (choice.check !== undefined) continue
      const gold = choice.onPass.effects.find((e) => e.kind === 'addGold' && e.amount > 0)
      if (gold !== undefined && gold.kind === 'addGold') return { eventId: ev.id, choiceId: choice.id, amount: gold.amount }
    }
  }
  throw new Error('content has no unchecked check-event choice that pays gold')
}

describe('the ledger’s gold earned counts every coin', () => {
  it('a run that earns from a battle, a bounty, a sale and a contract counts all four', () => {
    const s = new Session(fixtureFor('combat', SEED, env))
    const start = runOf(s).stats.goldEarned
    expect(start).toBe(0)

    // 1. a battle purse, through the real settle
    s.do({ type: 'dev/seedState', state: forceVictory(s.state) })
    expect(s.state.screen.kind).toBe('battleEnd')
    const afterBattle = runOf(s).stats.goldEarned
    expect(afterBattle).toBeGreaterThan(start)
    expect(afterBattle).toBe(runOf(s).lastBattle!.goldEarned)

    // 2. a contract's reward (`run/questEffects.ts#addGold` — never counted before)
    s.do({ type: 'quest/applyEffects', effects: [{ kind: 'addGold', amount: 37 }] })
    expect(runOf(s).stats.goldEarned).toBe(afterBattle + 37)

    // 3. and 4.: the town — a bounty, and a sale off the shop counter
    const town = fixtureFor('town', SEED, env)
    const prisoner: Prisoner = { unitId: 'brigand_1', name: 'Brigand', classId: 'fighter', level: 1, bountyValue: 20, capturedAtBattleId: 'b1' }
    const carried: RunState = { ...town.run!, stats: runOf(s).stats, gold: runOf(s).gold, prisoners: [prisoner] }
    s.do({ type: 'dev/seedState', state: { ...town, run: carried } })
    const beforeDesk = runOf(s).stats.goldEarned
    s.do({ type: 'town/turnInAllPrisoners' })
    expect(runOf(s).stats.goldEarned).toBe(beforeDesk + 20)

    const cell = runOf(s).bag[0]
    if (cell === undefined) throw new Error('fixture: the bag is empty')
    const beforeSale = runOf(s).stats.goldEarned
    const purse = runOf(s).gold
    s.do({ type: 'town/sell', x: cell.x, y: cell.y })
    const paid = runOf(s).gold - purse
    expect(paid).toBeGreaterThan(0)
    expect(runOf(s).stats.goldEarned).toBe(beforeSale + paid)

    // the whole session, measured the other way: every coin the EFFECTS reported is in the counter
    expect(runOf(s).stats.goldEarned).toBe(incomeFromEffects(s))
    expect(runOf(s).stats.goldEarned).toBeGreaterThan(afterBattle + 37)
  })

  it('a check event’s purse is counted, and spending is not un-earning', () => {
    const { eventId, choiceId, amount } = freeGoldEvent()
    const map = fixtureFor('overworld', SEED, env)
    const opened = openCheckEvent(map.run!, eventId, 'travel', env)
    const s = new Session({ ...map, run: opened.state })
    const before = runOf(s).stats.goldEarned
    s.do({ type: 'check/choose', choiceId, attemptingUnitId: null })
    expect(runOf(s).stats.goldEarned).toBe(before + amount)
    expect(runOf(s).stats.goldEarned).toBe(incomeFromEffects(s))

    // an inn bill, a purchase or a toll moves the purse DOWN and leaves the record of what was earned alone
    const spent = new Session({ ...s.state, run: { ...runOf(s), gold: 500 } })
    const earned = runOf(spent).stats.goldEarned
    spent.do({ type: 'quest/applyEffects', effects: [{ kind: 'addGold', amount: -50 }] })
    expect(runOf(spent).gold).toBe(450)
    expect(runOf(spent).stats.goldEarned).toBe(earned)
  })
})
