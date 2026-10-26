/**
 * flow/settle.ts — the rules that run after every reduce (CONTRACT §3). What is pinned here:
 *  · every rule carries a title term, rule 1 included — a parked run is inert until Continue;
 *  · a resolved battle is resolved ONCE (no re-seeding after the report closes);
 *  · follow-ups open one at a time;
 *  · the pass budget is a fixed point or a THROW, never a half-settled state.
 */
import { describe, expect, it } from 'vitest'
import { QuestSchema } from '../../../../src/content/schemas'
import { content } from '../../../../src/content/index'
import { fixtureFor } from '../../../../src/engine/flow/fixtures'
import { initialState } from '../../../../src/engine/flow/lifecycle'
import { overlayOf } from '../../../../src/engine/flow/pump'
import { SettleCapError, settle } from '../../../../src/engine/flow/settle'
import { reduce } from '../../../../src/engine/reducer'
import { startQuest } from '../../../../src/engine/run/quests'
import type { CombatState, GameState, QuestDef } from '../../../../src/engine/types'
import { env, envWithContent } from '../../../helpers/env'
import { Session } from '../../../helpers/session'

const SEED = 7

/** The FLOW-04 file: a battle whose phase is `victory`, saved and re-opened on the Title screen. */
function parkedVictoryOnTitle(): GameState {
  const battle = fixtureFor('combat', SEED, env)
  const combat = battle.combat
  if (combat === null) throw new Error('fixture: no battle')
  const units = { ...combat.units }
  for (const u of Object.values(units)) {
    if (u.team === 'enemy' && u.position !== null) units[u.id] = { ...u, hp: { ...u.hp, current: 0 }, position: null, lastTile: u.position }
  }
  const ended: CombatState = { ...combat, units, phase: 'victory' }
  return { ...battle, combat: ended, screen: { kind: 'title' } }
}

describe('settle — rule 1 never fires on the title screen', () => {
  it('a finished battle parked on title stays parked: a ui/* toggle resolves nothing and pays nothing', () => {
    const parked = parkedVictoryOnTitle()
    const gold = parked.run?.gold ?? -1
    const r = reduce(parked, { type: 'ui/toggleDanger' }, env)
    expect(r.state.screen.kind).toBe('title')
    expect(r.state.combat?.phase).toBe('victory')
    expect(r.state.run?.gold).toBe(gold)
    expect(r.state.run?.lastBattle).toBeNull()
    expect(r.effects.some((e) => e.kind === 'battleResolved' || e.kind === 'goldChanged')).toBe(false)
  })

  it('…and Continue is what resolves it: one payout, on the screen the player is looking at', () => {
    const parked = parkedVictoryOnTitle()
    const gold = parked.run?.gold ?? -1
    const r = reduce(parked, { type: 'meta/continueRun' }, env)
    expect(r.state.screen.kind).toBe('battleEnd')
    expect(r.state.combat).toBeNull()
    expect(r.state.run?.lastBattle?.outcome).toBe('victory')
    expect(r.state.run?.gold ?? -1).toBeGreaterThanOrEqual(gold)
  })
})

describe('settle — resolution happens once', () => {
  it('a won battle is not re-seeded after battleEnd/dismiss', () => {
    const s = new Session(fixtureFor('battleEnd', SEED, env))
    expect(s.state.screen.kind).toBe('battleEnd')
    expect(s.state.run?.pendingCombat ?? null).toBeNull()
    const gold = s.state.run?.gold ?? -1
    s.do({ type: 'battleEnd/dismiss' })
    s.settle()
    expect(s.state.screen.kind).not.toBe('combat')
    expect(s.state.combat).toBeNull()
    expect(s.state.run?.gold).toBe(gold)
    expect(s.state.run?.lastBattle ?? null).toBeNull()
  })

  it('the tutorial routes to the report on either outcome and pays nothing', () => {
    const s = new Session(initialState())
    s.do({ type: 'meta/newRun', seed: SEED })
    const gold = s.state.run?.gold ?? -1
    s.settle()
    expect(s.state.screen.kind).toBe('battleEnd')
    expect(s.state.run?.lastBattle?.tag).toBe('tutorial')
    expect(s.state.run?.lastBattle?.goldEarned).toBe(0)
    expect(s.state.run?.lastBattle?.loot).toEqual([])
    expect(s.state.run?.gold).toBe(gold)
  })
})

describe('settle — follow-ups open one at a time', () => {
  it('two queued scenes open in order: the second only after the first closes', () => {
    const map = fixtureFor('overworld', SEED, env)
    const run = map.run
    if (run === null) throw new Error('fixture: no run')
    const [first, second] = Object.keys(env.content.dialogues).filter((id) => id !== 'prologue').slice(0, 2)
    if (first === undefined || second === undefined) throw new Error('content has fewer than two dialogues')
    const queued: GameState = {
      ...map,
      run: { ...run, pendingFollowUps: [{ kind: 'dialogue', dialogueId: first, source: 'victory' }, { kind: 'dialogue', dialogueId: second, source: 'victory' }] },
    }
    const opened = settle({ state: queued, effects: [] }, env).state
    expect(opened.run?.pendingDialogue?.dialogueId).toBe(first)
    expect(opened.run?.pendingFollowUps).toHaveLength(1)
    // the queue does NOT drain while a suspender is open
    expect(settle({ state: opened, effects: [] }, env).state).toBe(opened)
    const closed: GameState = { ...opened, run: { ...opened.run!, pendingDialogue: null } }
    expect(settle({ state: closed, effects: [] }, env).state.run?.pendingDialogue?.dialogueId).toBe(second)
  })
})

describe('settle — the pass budget', () => {
  /** Two stages whose transitions are both `always` — `settleQuests` changes the run on every flow pass. */
  const cycleQuest = QuestSchema.parse({
    id: 'fx_settle_cycle',
    name: 'Cycle',
    initialStage: 'a',
    stages: {
      a: { id: 'a', label: 'A stage', onEnter: [], transitions: [{ when: { kind: 'always' }, to: 'b' }], onExit: [] },
      b: { id: 'b', label: 'A stage', onEnter: [], transitions: [{ when: { kind: 'always' }, to: 'a' }], onExit: [] },
    },
  }) as QuestDef

  it('a settle cycle throws SettleCapError with the walk instead of half-settling', () => {
    const cycleEnv = envWithContent({ quests: { ...content.quests, [cycleQuest.id]: cycleQuest } })
    const map = fixtureFor('overworld', SEED, cycleEnv)
    const run = map.run
    if (run === null) throw new Error('fixture: no run')
    const spinning: GameState = { ...map, run: startQuest(run, cycleQuest.id, cycleEnv).state }
    let thrown: unknown = null
    try {
      settle({ state: spinning, effects: [] }, cycleEnv)
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(SettleCapError)
    const err = thrown as SettleCapError
    expect(err.name).toBe('SettleCapError')
    expect(err.dump.length).toBe(cycleEnv.rules.quests.maxSettlePasses * 4 + 1)
    expect(err.message).toMatch(/no fixed point/)
  })

  it('settle is idempotent at every state a real journey visits', () => {
    const s = new Session(initialState())
    s.do({ type: 'meta/newRun', seed: SEED })
    for (let i = 0; i < 12; i++) {
      expect(settle({ state: s.state, effects: [] }, env).state, `step ${i}`).toBe(s.state)
      s.settle()
      expect(settle({ state: s.state, effects: [] }, env).state, `settled ${i}`).toBe(s.state)
      if (s.state.screen.kind === 'battleEnd') { s.do({ type: 'battleEnd/dismiss' }); continue }
      if (overlayOf(s.state)?.kind === 'dialogue') { s.closeDialogue(); continue }
      break
    }
  })
})
