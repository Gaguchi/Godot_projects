import { describe, expect, it } from 'vitest'
import { autoPick, checkCandidates, chooseCheck, dismissCheck, evaluateCheck, openCheckEvent, verdictOf } from '../../../../src/engine/run/checks'
import { withRules } from '../../../../src/engine/content'
import type { ActiveDungeon, RunState, Unit } from '../../../../src/engine/types'
import { env, envWith, kinds, makeRun, unit } from './narrativeFixture'

const STR7 = { kind: 'stat', stat: 'str', threshold: 7 } as const

/** Oak has STR 6 (shield_knight), the mc STR 5 (lord); Kael carries STR 7 via a fixture override. */
const withKael = (hp = 20): RunState => {
  const base = makeRun()
  const kael: Unit = unit('kael', 'bandit_archer', { name: 'Kael', stats: { str: 7 }, hp: { current: hp, max: 20 } })
  return { ...base, party: { ...base.party, kael }, partyOrder: [...base.partyOrder, 'kael'] }
}

describe('checks — the resolver', () => {
  it("stat checks pass iff a LIVING unit's stat >= threshold (a dead unit with a passing stat does not pass)", () => {
    const alive = withKael(20)
    expect(evaluateCheck(STR7, alive.party['kael'] ?? null, alive, env)).toBe(true)
    expect(evaluateCheck(STR7, alive.party['oak'] ?? null, alive, env)).toBe(false)
    expect(evaluateCheck(STR7, null, alive, env)).toBe(false)
    const dead = withKael(0)
    expect(evaluateCheck(STR7, dead.party['kael'] ?? null, dead, env)).toBe(false)
    // The rule is data: with the knob off the corpse would pass (never shipped that way — the party never holds a dead unit).
    const lax = withRules(env, { checks: { ...env.rules.checks, statCheckRequiresLiving: false } })
    expect(evaluateCheck(STR7, dead.party['kael'] ?? null, dead, lax)).toBe(true)
  })

  it('class checks need a living member', () => {
    const alive = withKael(20)
    expect(evaluateCheck({ kind: 'class', classId: 'bandit_archer' }, null, alive, env)).toBe(true)
    expect(evaluateCheck({ kind: 'class', classId: 'bandit_archer' }, null, withKael(0), env)).toBe(false)
    expect(evaluateCheck({ kind: 'class', classId: 'warlord' }, null, alive, env)).toBe(false)
  })

  it('gold/food compare party totals', () => {
    const run = makeRun({ gold: 30 }) // bag: one ration = 3 charges
    expect(evaluateCheck({ kind: 'gold', amount: 30 }, null, run, env)).toBe(true)
    expect(evaluateCheck({ kind: 'gold', amount: 31 }, null, run, env)).toBe(false)
    expect(evaluateCheck({ kind: 'food', amount: 3 }, null, run, env)).toBe(true)
    expect(evaluateCheck({ kind: 'food', amount: 4 }, null, run, env)).toBe(false)
  })

  it('candidates sort by stat desc with meetsThreshold; non-stat checks have none', () => {
    const run = withKael(20)
    const c = checkCandidates(STR7, run)
    expect(c.map((x) => [x.unitId, x.statValue, x.meetsThreshold])).toEqual([['kael', 7, true], ['oak', 6, false], ['mc', 5, false], ['lilina', 1, false]])
    expect(c[0]?.name).toBe('Kael')
    expect(c[0]?.classId).toBe('bandit_archer')
    expect(checkCandidates(STR7, withKael(0)).map((x) => x.unitId)).not.toContain('kael')
    expect(checkCandidates({ kind: 'gold', amount: 1 }, run)).toEqual([])
  })

  it('auto-pick chooses the best living candidate; null for class/gold/food and when the knob is off', () => {
    const run = withKael(20)
    expect(autoPick(STR7, run, env)?.id).toBe('kael')
    expect(autoPick(STR7, withKael(0), env)?.id).toBe('oak')
    expect(autoPick({ kind: 'gold', amount: 1 }, run, env)).toBeNull()
    const noPick = withRules(env, { checks: { ...env.rules.checks, autoPickBestCandidate: false } })
    expect(autoPick(STR7, run, noPick)).toBeNull()
  })
})

describe('checks — check events (ambush_toll: gold 30 / fight / spd 8)', () => {
  const open = (run: RunState = makeRun()) => openCheckEvent(run, 'ambush_toll', 'travel', env).state

  it('openCheckEvent sets the slot with a null result and throws while a dialogue is open', () => {
    const r = openCheckEvent(makeRun(), 'ambush_toll', 'dungeon', env)
    expect(r.state.pendingCheckEvent).toEqual({ checkEventId: 'ambush_toll', source: 'dungeon', result: null })
    expect(r.effects).toEqual([])
    const talking = makeRun({ pendingDialogue: { dialogueId: 'prologue', nodeId: 'start', source: 'prologue', busts: [null, null] } })
    expect(() => openCheckEvent(talking, 'ambush_toll', 'travel', env)).toThrow(/one suspender at a time/)
    expect(() => openCheckEvent(makeRun(), 'no_such_event', 'travel', env)).toThrow(/unknown check event/)
  })

  it('chooseCheck resolves a resource check, applies the outcome, stores the result and emits checkResolved', () => {
    const rich = open(makeRun({ gold: 50 }))
    const r = chooseCheck(rich, 'pay_toll', null, env)
    expect(r.state.gold).toBe(20)
    expect(r.state.pendingCheckEvent?.result).toMatchObject({ choiceId: 'pay_toll', passed: true, attemptingUnitId: null, deferredEffects: [] })
    expect(r.state.pendingCheckEvent?.result?.narration).toMatch(/Coin changes hands/)
    expect(r.effects[0]).toEqual({ kind: 'checkResolved', checkEventId: 'ambush_toll', choiceId: 'pay_toll', passed: true, attemptingUnitId: null })
    expect(kinds(r.effects)).toEqual(['checkResolved', 'goldChanged'])

    const poor = open(makeRun({ gold: 10 }))
    const f = chooseCheck(poor, 'pay_toll', null, env)
    expect(f.state.gold).toBe(10)
    expect(f.state.pendingCheckEvent?.result?.passed).toBe(false)
    expect(f.state.pendingCombat?.origin).toEqual({ kind: 'quest', nodeId: poor.nodeId })
  })

  it('chooseCheck on a stat check auto-picks the best living unit when no unit is given and honours an explicit one', () => {
    const run = open(withKael(20)) // slip_away is SPD 8: nobody passes (class SPD 5/5/5, Oak 2) — the best is still auto-picked and fails
    const auto = chooseCheck(run, 'slip_away', null, env)
    expect(auto.state.pendingCheckEvent?.result?.passed).toBe(false)
    expect(auto.state.pendingCheckEvent?.result?.attemptingUnitId).toBe(checkCandidates({ kind: 'stat', stat: 'spd', threshold: 8 }, run)[0]?.unitId)
    const explicit = chooseCheck(run, 'slip_away', 'oak', env)
    expect(explicit.state.pendingCheckEvent?.result).toMatchObject({ attemptingUnitId: 'oak', passed: false })
    expect(explicit.state.pendingCombat).not.toBeNull()
    const unknown = chooseCheck(run, 'slip_away', 'nobody', env)
    expect(unknown.state).toBe(run)
    expect(kinds(unknown.effects)).toEqual(['refused'])
  })

  /**
   * RE-GATE C 3.11 — declining an impossible crossing came back sealed PASSED, on the card and in the headless
   * frame. The engine still resolves a checkless choice as `passed: true` (the outcome branch has to pick a side);
   * what changed is that the SEAL reads the choice, not the boolean.
   */
  it('a choice with no check is untested — never passed, and never failed', () => {
    const bridge = openCheckEvent(makeRun(), 'bridge_crossing', 'travel', env).state
    expect(verdictOf(bridge.pendingCheckEvent!, env)).toBeNull() // nothing is sealed until it is chosen

    const long = chooseCheck(bridge, 'take_long_way', null, env)
    expect(long.state.pendingCheckEvent?.result?.passed).toBe(true) // the engine's own branch pick, unchanged
    expect(verdictOf(long.state.pendingCheckEvent!, env)).toBe('untested')

    // a real roll the company cannot make is a VERDICT, not silence: the ambush's SPD 8 scatter, which 0120 left
    // standing on purpose — a Kael door is fine, a card of nothing BUT Kael doors is what the lint now refuses
    const tried = chooseCheck(open(), 'slip_away', null, env)
    expect(tried.state.pendingCheckEvent?.result?.passed).toBe(false)
    expect(verdictOf(tried.state.pendingCheckEvent!, env)).toBe('failed')
    // and a passed roll seals passed: the toll paid with coin in hand
    const paid = chooseCheck(openCheckEvent(makeRun({ gold: 50 }), 'ambush_toll', 'travel', env).state, 'pay_toll', null, env)
    expect(verdictOf(paid.state.pendingCheckEvent!, env)).toBe('passed')
  })

  it('chooseCheck / dismissCheck refusals leave the state reference unchanged with exactly one refused', () => {
    const none = makeRun()
    expect(chooseCheck(none, 'fight', null, env).state).toBe(none)
    expect(kinds(chooseCheck(none, 'fight', null, env).effects)).toEqual(['refused'])
    expect(dismissCheck(none, env).state).toBe(none)
    const opened = open()
    const unknownChoice = chooseCheck(opened, 'bribe', null, env)
    expect(unknownChoice.state).toBe(opened)
    expect(kinds(unknownChoice.effects)).toEqual(['refused'])
    const unresolved = dismissCheck(opened, env)
    expect(unresolved.state).toBe(opened)
    expect(kinds(unresolved.effects)).toEqual(['refused'])
    const resolved = chooseCheck(opened, 'fight', null, env).state
    const twice = chooseCheck(resolved, 'fight', null, env)
    expect(twice.state).toBe(resolved)
    expect(kinds(twice.effects)).toEqual(['refused'])
  })

  it('dismissCheck clears the slot', () => {
    const resolved = chooseCheck(open(), 'fight', null, env).state
    const r = dismissCheck(resolved, env)
    expect(r.state.pendingCheckEvent).toBeNull()
    expect(r.state.pendingCombat).not.toBeNull()
    expect(r.effects).toEqual([])
  })

  it('startDialogue in a check outcome opens only after check/dismiss', () => {
    const talky = {
      id: 'fx_talky',
      title: 'A hooded figure waits by the road.',
      description: 'He has a job.',
      choices: [{ id: 'listen', text: 'Hear him out.', onPass: { narration: 'He clears his throat.', effects: [{ kind: 'addGold', amount: 1 }, { kind: 'startDialogue', dialogueId: 'sq_blood_ties_accept' }, { kind: 'setFlag', key: 'fx_listened', value: true, scope: 'run' }] } }],
    }
    const fx = envWith({ checkEvents: [talky] })
    const opened = openCheckEvent(makeRun({ gold: 0 }), 'fx_talky', 'travel', fx).state
    const chosen = chooseCheck(opened, 'listen', null, fx)
    // Immediate effects landed in order, the dialogue did not open, and it waits in deferredEffects.
    expect(chosen.state.gold).toBe(1)
    expect(chosen.state.flags['fx_listened']?.value).toBe(true)
    expect(chosen.state.pendingDialogue).toBeNull()
    expect(chosen.state.pendingCheckEvent?.result?.deferredEffects).toEqual([{ kind: 'startDialogue', dialogueId: 'sq_blood_ties_accept' }])
    expect(kinds(chosen.effects)).toEqual(['checkResolved', 'goldChanged', 'flagSet'])
    const dismissed = dismissCheck(chosen.state, fx)
    expect(dismissed.state.pendingCheckEvent).toBeNull()
    expect(dismissed.state.pendingDialogue).toMatchObject({ dialogueId: 'sq_blood_ties_accept', nodeId: 'start', source: 'quest' })
    expect(kinds(dismissed.effects)).toEqual(['dialogueOpened'])
  })

  it('dismissCheck on a dungeon event marks the current room cleared', () => {
    const graph = {
      dungeonId: 'smugglers_cave',
      rooms: { r0c0: { id: 'r0c0', row: 0, col: 0, type: 'combat' as const, checkEventId: null }, r1c0: { id: 'r1c0', row: 1, col: 0, type: 'event' as const, checkEventId: 'blocked_passage' }, r2c0: { id: 'r2c0', row: 2, col: 0, type: 'boss' as const, checkEventId: null } },
      rows: [['r0c0'], ['r1c0'], ['r2c0']],
      edges: { r0c0: ['r1c0'], r1c0: ['r2c0'], r2c0: [] },
      bossId: 'r2c0',
    }
    const activeDungeon: ActiveDungeon = { dungeonId: 'smugglers_cave', graph, position: 'r1c0', cleared: { r0c0: true }, bossCleared: false }
    const run = makeRun({ nodeId: 'smugglers_cave', activeDungeon, gold: 100 })
    const opened = openCheckEvent(run, 'blocked_passage', 'dungeon', env).state
    const choice = env.content.checkEvents['blocked_passage']?.choices[0]?.id ?? ''
    const resolved = chooseCheck(opened, choice, null, env).state
    const r = dismissCheck(resolved, env)
    expect(r.state.pendingCheckEvent).toBeNull()
    expect(r.state.activeDungeon?.cleared['r1c0']).toBe(true)
    expect(r.state.activeDungeon?.bossCleared).toBe(false)
  })
})
