/**
 * run/battle.ts through the flow — the ONE payout (CONTRACT §3 rule 1, brief §2.8). A battle pays out exactly
 * once, on the pass that resolves it; the Field Report is the RECORD of that payout, so closing it, saving on it
 * or reloading it can never pay again. Overflow is never discarded — it waits, and Continue waits with it.
 */
import { describe, expect, it } from 'vitest'
import { fixtureFor } from '../../../../src/engine/flow/fixtures'
import { initialState } from '../../../../src/engine/flow/lifecycle'
import { placeInBag } from '../../../../src/engine/run/bag'
import { runLedger } from '../../../../src/engine/run/battle'
import { removeFallen } from '../../../../src/engine/run/party'
import { fromSaveFile, toSaveFile } from '../../../../src/engine/save/codec'
import type { CombatState, GameState, RunState } from '../../../../src/engine/types'
import { env } from '../../../helpers/env'
import { Session } from '../../../helpers/session'

const SEED = 7

/** Every enemy at 0 HP with its tile recorded — the shape `resolveBattle` reads. */
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

/** The same victory, with `unitId` cut down on the board: hp 0, off the board, its last tile recorded. */
function withPartyDeath(state: GameState, unitId: string): GameState {
  const won = forceVictory(state)
  const combat = won.combat
  if (combat === null) throw new Error('fixture: no battle')
  const u = combat.units[unitId]
  if (u === undefined || u.position === null) throw new Error(`fixture: '${unitId}' is not on the board`)
  const units = { ...combat.units, [unitId]: { ...u, hp: { ...u.hp, current: 0 }, position: null, lastTile: u.position } }
  return { ...won, combat: { ...combat, units } }
}

/** A party unit that is NOT the MC (an MC death ends the run before any ledger is read). */
function companionId(state: GameState): string {
  const combat = state.combat
  if (combat === null) throw new Error('fixture: no battle')
  const id = Object.values(combat.units).find((u) => u.team === 'party' && u.id !== 'mc' && u.position !== null)?.id
  if (id === undefined) throw new Error('fixture: the party has no companion on the board')
  return id
}

/** Fill every free cell with the smallest item content has. */
function fillBag(run: RunState): RunState {
  const smallest = Object.values(env.content.items).find((i) => i.gridSize.width === 1 && i.gridSize.height === 1)
  if (smallest === undefined) throw new Error('content has no 1×1 item')
  let bag = run.bag
  for (let i = 0; i < 200; i++) {
    const next = placeInBag(bag, [smallest.id], env)
    if (next === null) return { ...run, bag }
    bag = next
  }
  throw new Error('the bag never filled')
}

describe('payout — exactly once', () => {
  it('a victory pays its gold on the resolving pass, and closing the report pays nothing more', () => {
    const s = new Session(fixtureFor('combat', SEED, env))
    const before = s.state.run?.gold ?? -1
    s.do({ type: 'dev/seedState', state: forceVictory(s.state) })
    expect(s.state.screen.kind).toBe('battleEnd')
    const report = s.state.run?.lastBattle
    if (report === undefined || report === null) throw new Error('no report')
    const after = s.state.run?.gold ?? -1
    expect(after).toBe(before + report.goldEarned)
    expect(s.kinds('battleResolved')).toHaveLength(1)
    s.do({ type: 'battleEnd/dismiss' })
    s.settle()
    expect(s.state.run?.gold).toBe(after)
    expect(s.kinds('battleResolved')).toHaveLength(1)
  })

  it('counts each dropped item once — `grantLoot` is the only door gear enters through', () => {
    // `run/loot.ts#grantLoot` already bumps `stats.gearFound` per hand-slot item, and the payout used to add
    // `loot.length` on top, so the win / game-over ledger reported double the gear the run ever found.
    const s = new Session(fixtureFor('combat', 2, env)) // seed 2's travel row drops exactly one hand-slot item
    const before = s.state.run?.stats.gearFound ?? -1
    s.do({ type: 'dev/seedState', state: forceVictory(s.state) })
    const report = s.state.run?.lastBattle
    if (report === undefined || report === null) throw new Error('no report')
    expect(report.loot).toHaveLength(1)
    expect(s.state.run?.stats.gearFound).toBe(before + 1)
  })

  it('counts each death once — `removeFallen` is the only door a name enters the death log through', () => {
    // `applyBattleResult` calls `removeFallen` (which bumps `stats.unitsLost` per NEW death log entry) and then
    // used to add `result.fallen.length` on top, so the win / game-over ledger reported twice the units a run had
    // actually lost — a count that contradicted the names printed beside it, and a persisted field, so a save
    // carried the inflated number forward.
    const s = new Session(fixtureFor('combat', SEED, env))
    const before = s.state.run?.stats.unitsLost ?? -1
    const dead = companionId(s.state)
    s.do({ type: 'dev/seedState', state: withPartyDeath(s.state, dead) })
    const run = s.state.run
    if (run === null || run === undefined) throw new Error('no run')
    expect(run.lastBattle?.fallen.map((f) => f.unitId)).toEqual([dead])
    expect(run.deathLog.map((d) => d.unitId)).toEqual([dead])
    expect(run.stats.unitsLost).toBe(before + 1)
    // the ledger and the names it prints beside the count can never disagree again
    expect(run.stats.unitsLost).toBe(run.deathLog.length)
    expect(runLedger(run, 'lost', null).stats.unitsLost).toBe(runLedger(run, 'lost', null).fallen.length)
  })

  it('a battle death and a road death are counted the same way', () => {
    // Starvation goes through `removeFallen` once; the battle path used to charge twice, so the two ledgers
    // disagreed about what one dead companion was worth.
    const s = new Session(fixtureFor('combat', SEED, env))
    const dead = companionId(s.state)
    s.do({ type: 'dev/seedState', state: withPartyDeath(s.state, dead) })
    const battleRun = s.state.run
    if (battleRun === null || battleRun === undefined) throw new Error('no run')

    const road = fixtureFor('overworld', SEED, env).run
    if (road === null) throw new Error('no run')
    const starved = removeFallen(road, [{ unitId: dead, cause: 'starvation', battleId: null }], env)
    expect(starved.state.stats.unitsLost).toBe(road.stats.unitsLost + 1)
    expect(battleRun.stats.unitsLost).toBe(starved.state.stats.unitsLost)
  })

  it('the report, the death log and the ledger all carry the name the PLAYER gave', () => {
    // `unit.name` is the authored placeholder ("The Foundling"); the CLI field report printed the player's name
    // on one line and the placeholder on the next, and every future consumer of the report would have too.
    // `run/party.ts#displayName` owns that rule, so the engine resolves it once, at write time.
    const s = new Session(fixtureFor('combat', SEED, env))
    const run = s.state.run
    if (run === null) throw new Error('no run')
    const named = { ...s.state, run: { ...run, mcName: 'Roswyn' } }
    s.do({ type: 'dev/seedState', state: withPartyDeath(named, 'mc') })
    // The field report comes FIRST now (0082) — a won field on which the MC fell is still a page the player reads.
    expect(s.state.screen.kind).toBe('battleEnd')
    expect(s.state.run?.lastBattle?.fallen.map((f) => f.name)).toEqual(['Roswyn'])
    // Turning it ends the run (DECISIONS: mcDeathIsDefeat), and the ledger is the record.
    s.do({ type: 'battleEnd/dismiss' })
    const ledger = s.state.ledger
    expect(ledger).not.toBeNull()
    expect(ledger?.fallen.map((f) => f.name)).toEqual(['Roswyn'])
    expect(ledger?.fallen.map((f) => f.name)).not.toContain(env.content.characters['mc']?.displayName)
  })

  it('a surviving MC is named in the report and in the ledger without a remap downstream', () => {
    const s = new Session(fixtureFor('combat', SEED, env))
    const run = s.state.run
    if (run === null) throw new Error('no run')
    const named = { ...s.state, run: { ...run, mcName: 'Roswyn' } }
    s.do({ type: 'dev/seedState', state: forceVictory(named) })
    const after = s.state.run
    if (after === null || after === undefined) throw new Error('no run')
    expect(after.lastBattle?.survivors.find((u) => u.unitId === 'mc')?.name).toBe('Roswyn')
    expect(runLedger(after, 'won', null).survivors.find((u) => u.unitId === 'mc')?.name).toBe('Roswyn')
  })

  it('a save taken on the Field Report cannot pay out twice', () => {
    const s = new Session(fixtureFor('battleEnd', SEED, env))
    const gold = s.state.run?.gold ?? -1
    const file = toSaveFile(s.state, env)
    expect(file.combat).toBeNull()
    expect(file.run?.lastBattle).not.toBeNull()
    const reloaded = new Session(fromSaveFile(file))
    reloaded.do({ type: 'meta/continueRun' })
    expect(reloaded.state.screen.kind).toBe('battleEnd')
    expect(reloaded.state.run?.gold).toBe(gold)
    reloaded.do({ type: 'battleEnd/dismiss' })
    expect(reloaded.state.run?.gold).toBe(gold)
  })

  it('the tutorial is not a payout: no gold, no loot, no death log, no HP write-back', () => {
    const s = new Session(initialState())
    s.do({ type: 'meta/newRun', seed: SEED })
    const run = s.state.run
    if (run === null) throw new Error('no run')
    const hp = Object.fromEntries(Object.entries(run.party).map(([id, u]) => [id, u.hp.current]))
    const gold = run.gold
    s.settle()
    expect(s.state.run?.lastBattle?.tag).toBe('tutorial')
    expect(s.state.run?.lastBattle?.goldEarned).toBe(0)
    expect(s.state.run?.lastBattle?.loot).toEqual([])
    expect(s.state.run?.gold).toBe(gold)
    expect(s.state.run?.deathLog).toEqual([])
    for (const [id, current] of Object.entries(hp)) expect(s.state.run?.party[id]?.hp.current, id).toBe(current)
  })
})

describe('payout — the report is the record', () => {
  it('every unplaced drop in the report is exactly what is waiting in pendingLoot', () => {
    const s = new Session(fixtureFor('combat', SEED, env))
    const run = s.state.run
    if (run === null) throw new Error('no run')
    s.do({ type: 'dev/seedState', state: forceVictory({ ...s.state, run: fillBag(run) }) })
    const report = s.state.run?.lastBattle
    if (report === undefined || report === null) throw new Error('no report')
    expect(report.loot.filter((l) => !l.placed).map((l) => l.itemId)).toEqual([...(s.state.run?.pendingLoot ?? [])])
  })

  it('overflow is never discarded: Continue waits, Take needs room, Leave is always available', () => {
    const s = new Session(fixtureFor('battleEnd', SEED, env))
    const run = s.state.run
    if (run === null) throw new Error('no run')
    const itemId = Object.values(env.content.items).find((i) => i.gridSize.width === 1 && i.gridSize.height === 1)!.id
    const full = fillBag(run)
    s.do({ type: 'dev/seedState', state: { ...s.state, run: { ...full, pendingLoot: [itemId] } } })
    s.refuse({ type: 'battleEnd/dismiss' }, 'take or forfeit the found gear first')
    s.refuse({ type: 'run/takeLoot', itemId }, 'no room in the bag — discard something first')
    // free one cell the way the loadout does, and the same verb now works
    const freed = { ...s.state.run!, bag: s.state.run!.bag.slice(0, -1) }
    s.do({ type: 'dev/seedState', state: { ...s.state, run: freed } })
    s.do({ type: 'run/takeLoot', itemId })
    expect(s.state.run?.pendingLoot).toEqual([])
    expect(s.kinds('itemAcquired').some((e) => e.itemId === itemId)).toBe(true)
    s.do({ type: 'battleEnd/dismiss' })
  })

  it('forfeiting clears the wait without putting the item anywhere', () => {
    const s = new Session(fixtureFor('battleEnd', SEED, env))
    const run = s.state.run
    if (run === null) throw new Error('no run')
    const itemId = Object.keys(env.content.items)[0]!
    s.do({ type: 'dev/seedState', state: { ...s.state, run: { ...run, pendingLoot: [itemId] } } })
    const bag = s.state.run?.bag
    s.do({ type: 'run/forfeitLoot', itemId })
    expect(s.state.run?.pendingLoot).toEqual([])
    expect(s.state.run?.bag).toEqual(bag)
    expect(s.kinds('itemRemoved').some((e) => e.itemId === itemId && e.reason === 'forfeited')).toBe(true)
  })
})
