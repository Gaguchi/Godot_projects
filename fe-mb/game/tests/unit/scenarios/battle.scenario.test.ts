/** Golden headless battles: whole fights through the reducer, ≥ 3 rounds of enemy turns, HP actually moving (§7.1, §7.2). */
import { describe, expect, it } from 'vitest'
import { autoBattle, greedyPolicy } from '../../../src/engine/combat/sim'
import { authored, env, mc, oak, spec, unit } from '../../helpers/battles'

const e = env()

describe('battle scenarios', () => {
  it('starters vs a bandit pack: enemies act every round, blood is drawn early, the fight ends inside the cap', () => {
    const result = autoBattle(spec({ party: [mc(), oak()], enemies: { kind: 'group', enemyGroupId: 'bandits_small', level: 1 }, seed: 42 }), e, greedyPolicy)
    expect(['victory', 'defeat']).toContain(result.outcome)
    expect(result.rounds).toBeLessThanOrEqual(e.rules.combat.roundCap)
    expect(result.firstBloodRound).not.toBeNull()
    const enemyActs = result.effects.filter((x) => x.kind === 'enemyActed')
    expect(enemyActs.length).toBeGreaterThan(0)
    const hits = result.effects.filter((x) => x.kind === 'unitHit' && x.hpLost > 0)
    expect(hits.length).toBeGreaterThan(0)
  })

  it('a lone MC against three sturdy bandits loses — the AI closes and hits', () => {
    const tough = [authored('b1', 'bandit', 6, 4, { hp: 40 }), authored('b2', 'bandit', 6, 5, { hp: 40 }), authored('b3', 'bandit', 7, 4, { hp: 40 })]
    const result = autoBattle(spec({ party: [mc()], enemies: { kind: 'authored', units: tough }, seed: 5 }), e, greedyPolicy)
    expect(result.outcome).toBe('defeat')
    expect(result.rounds).toBeGreaterThanOrEqual(2)
  })

  it('an unarmed bandit against the starters is a win in a few rounds', () => {
    const result = autoBattle(spec({ party: [mc(), oak()], enemies: { kind: 'authored', units: [authored('b', 'bandit', 5, 4, { hp: 8 })] }, seed: 6 }), e, greedyPolicy)
    expect(result.outcome).toBe('victory')
    expect(result.rounds).toBeLessThanOrEqual(4)
  })

  it('a grind through ≥ 3 FULL rounds: every enemy keeps acting and every cycle restores the turn (§7.1)', () => {
    const sturdy = [authored('b1', 'bandit', 6, 4, { hp: 70 }), authored('b2', 'bandit', 6, 5, { hp: 70 })]
    const result = autoBattle(spec({ party: [mc({ hp: 140 }), oak({ hp: 140 })], enemies: { kind: 'authored', units: sturdy }, seed: 12 }), e, greedyPolicy)
    expect(result.rounds).toBeGreaterThanOrEqual(3)
    // one snapshot per round boundary — the walk `RoundCapError` would carry
    expect(result.dump.length).toBeGreaterThanOrEqual(3)
    for (const snapshot of result.dump.slice(0, 3)) {
      const active = unit(snapshot, snapshot.turn.unitId)
      expect(active.ap).toBe(e.rules.combat.apPerTurn)
      expect(active.hasMovedThisTurn).toBe(false)
      expect(active.actionsTaken).toBe(0)
      expect(active.coverUsed).toEqual([])
      if (active.team === 'party') expect(snapshot.decks[active.id]!.hand).toHaveLength(e.rules.combat.handSize)
    }
    const acted = result.effects.filter((x) => x.kind === 'enemyActed')
    // both enemies are still swinging after three rounds, not a single opening flurry
    expect(new Set(acted.map((x) => x.unitId))).toEqual(new Set(['b1', 'b2']))
    expect(acted.length).toBeGreaterThanOrEqual(result.dump.length)
  })
})
