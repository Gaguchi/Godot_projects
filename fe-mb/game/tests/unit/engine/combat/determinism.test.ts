/** Brief §2.14 / §7.19: the AI is a pure function of (state, combat.rng); a battle is a pure function of its spec. */
import { describe, expect, it } from 'vitest'
import { planEnemyStep } from '../../../../src/engine/combat/ai'
import { autoBattle, greedyPolicy, randomPolicy } from '../../../../src/engine/combat/sim'
import { activate, authored, env, mc, oak, seed, spec } from '../../../helpers/battles'

const e = env()

describe('combat — determinism', () => {
  it('planning the same state twice yields the same step and the same advanced rng', () => {
    const seeded = seed({ party: [mc(), oak()], enemies: { kind: 'group', enemyGroupId: 'bandits_small', level: 1 }, seed: 4 })
    const st = activate(seeded, Object.values(seeded.units).find((u) => u.team === 'enemy')!.id)
    const a = planEnemyStep(st, e)
    const b = planEnemyStep(st, e)
    expect(a).toEqual(b)
  })

  it('the same spec fights the same battle: outcome, rounds, and every effect', () => {
    const s = spec({ party: [mc(), oak()], enemies: { kind: 'group', enemyGroupId: 'bandits_small', level: 1 }, seed: 21 })
    const a = autoBattle(s, e, greedyPolicy)
    const b = autoBattle(s, e, greedyPolicy)
    expect(a.outcome).toBe(b.outcome)
    expect(a.rounds).toBe(b.rounds)
    expect(a.effects).toEqual(b.effects)
    expect(a.finalState).toEqual(b.finalState)
  })

  it('the random policy is a function of combat.rng too (fuzz runs replay)', () => {
    const s = spec({ party: [mc()], enemies: { kind: 'authored', units: [authored('b', 'bandit', 4, 4)] }, seed: 8 })
    const a = autoBattle(s, e, randomPolicy)
    const b = autoBattle(s, e, randomPolicy)
    expect(a.rounds).toBe(b.rounds)
    expect(a.outcome).toBe(b.outcome)
  })

  it('the random policy RETURNS its advanced stream, so consecutive draws are not the same one (§2.5, §7.19)', () => {
    const battle = seed({ party: [mc()], enemies: { kind: 'authored', units: [authored('b', 'bandit', 4, 4)] }, seed: 8 })
    const st = activate(battle, 'mc')
    const first = randomPolicy(st, e)
    expect('rng' in first).toBe(true)
    if (!('rng' in first)) return
    // same state, same draw — the policy is pure
    expect(randomPolicy(st, e)).toEqual(first)
    // but the stream it hands back moves, so the NEXT decision draws a different number
    expect(first.rng).not.toEqual(st.rng)
    const second = randomPolicy({ ...st, rng: first.rng }, e)
    expect('rng' in second ? second.rng : st.rng).not.toEqual(first.rng)
    const drawn = new Set<string>()
    let cursor = st.rng
    for (let i = 0; i < 12; i++) {
      const d = randomPolicy({ ...st, rng: cursor }, e)
      if (!('rng' in d)) break
      drawn.add(JSON.stringify(d.action))
      cursor = d.rng
    }
    expect(drawn.size).toBeGreaterThan(1)
  })

  it('the fuzzer offers the potion and capture paths, not just cards and moves', () => {
    const battle = seed({
      party: [mc()],
      enemies: { kind: 'authored', units: [authored('b', 'bandit', 3, 4, { hp: 4 })] },
      consumables: ['healing_potion'],
      seed: 8,
    })
    const st = activate(battle, 'mc')
    const kinds = new Set<string>()
    let cursor = st.rng
    for (let i = 0; i < 200; i++) {
      const d = randomPolicy({ ...st, rng: cursor }, e)
      if (!('rng' in d)) break
      kinds.add(d.action.type)
      cursor = d.rng
    }
    expect(kinds.has('combat/useItem')).toBe(true)
    expect(kinds.has('combat/capture')).toBe(true)
  })
})
