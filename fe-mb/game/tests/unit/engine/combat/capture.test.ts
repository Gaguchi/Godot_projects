/**
 * combat/capture.ts — "the only die in combat" (brief §2.6), and RE-GATE C 3.18: it stopped being one.
 *
 * `captureContext` counted the captor among the allies with hands on the target, so a lone captor started a full
 * adjacency step up the curve and two units on a wounded foe already clamped to 1.0 — six of seven captures in a
 * shipped playthrough rolled `chance: 1`, and the % the button shows before committing read 100 every time it
 * mattered. The captor is not their own support; each MATE who pins the target is.
 */
import { describe, expect, it } from 'vitest'
import { capture, captureChance, captureContext, hasAdjacentFoe } from '../../../../src/engine/combat/capture'
import type { CombatState } from '../../../../src/engine/types'
import { activate, authored, env, mc, oak, patchUnit, placeAt, seed, unit, unitFromClass } from '../../../helpers/battles'

/** The foe on 4,4 with three orthogonal neighbours free; the company placed one at a time by the case. */
function board(hp: number): CombatState {
  const st = seed({
    party: [mc(), oak(), unitFromClass('lilina', 'mage', 'party', { handLeft: 'fire_tome' })],
    enemies: { kind: 'authored', units: [authored('foe', 'bandit', 4, 4, { hp: 100 })] },
  })
  const placed = placeAt(placeAt(placeAt(st, 'mc', 3, 4), 'oak', 0, 0), 'lilina', 9, 9)
  return activate(patchUnit(placed, 'foe', { hp: { current: hp, max: 100 } }), 'mc')
}

const chanceOf = (st: CombatState): number => {
  const ctx = captureContext(st, 'mc', 'foe', env())
  return captureChance(unit(st, 'foe'), ctx.supportingAllies, ctx.bountyHunter, env())
}

describe('combat/capture — the captor is not their own help', () => {
  it('counts the OTHER allies with hands on the target, never the captor', () => {
    const alone = board(50)
    expect(hasAdjacentFoe(alone, unit(alone, 'mc'))).toBe(true)
    expect(captureContext(alone, 'mc', 'foe', env())).toEqual({ adjacent: true, supportingAllies: 0, bountyHunter: false })

    const pair = placeAt(alone, 'oak', 5, 4)
    expect(captureContext(pair, 'mc', 'foe', env()).supportingAllies).toBe(1)
    const three = placeAt(pair, 'lilina', 4, 3)
    expect(captureContext(three, 'mc', 'foe', env()).supportingAllies).toBe(2)

    // a fallen mate holds nobody down, and a foe standing beside its own kin is not helping the captor either
    const down = patchUnit(three, 'oak', { hp: { current: 0, max: 40 }, position: null, lastTile: '5,4' })
    expect(captureContext(down, 'mc', 'foe', env()).supportingAllies).toBe(1)
  })

  it('a lone captor on a dying foe is a real risk, not a certainty', () => {
    // 7% HP, one captor: the wound alone, and nothing else — this used to read 1.0 with an ally beside it
    const dying = board(7)
    expect(chanceOf(dying)).toBeCloseTo(0.558, 3)
    expect(chanceOf(dying)).toBeLessThan(1)
    // one mate pinning him is a real step up, and still short of certain
    const helped = placeAt(dying, 'oak', 5, 4)
    expect(chanceOf(helped)).toBeCloseTo(0.808, 3)
    expect(chanceOf(helped)).toBeLessThan(1)
    // the whole company on a foe at 7% is the one shape that earns a certainty
    expect(chanceOf(placeAt(helped, 'lilina', 4, 3))).toBe(1)
    // and a foe at full strength is barely worth trying
    expect(chanceOf(board(100))).toBe(0)
  })

  it('the roll uses the number the button showed, and both outcomes happen', () => {
    const dying = board(7)
    let taken = 0
    let missed = 0
    for (let s = 1; s <= 40; s++) {
      const st: CombatState = { ...dying, rng: { seed: s, counter: 0 } }
      const r = capture(st, 'foe', env())
      const rolled = r.effects.find((e) => e.kind === 'captureRolled')
      expect(rolled).toBeDefined()
      if (rolled?.kind !== 'captureRolled') throw new Error('no roll')
      expect(rolled.chance).toBe(chanceOf(st)) // forecast == applied (§7.20)
      expect(rolled.chance).toBeLessThan(1)
      if (rolled.success) taken++
      else missed++
      // the AP is spent either way, and the rng moves on either way
      expect(unit(r.state, 'mc').ap).toBe(unit(st, 'mc').ap - env().rules.combat.capture.apCost)
      expect(r.state.rng).not.toEqual(st.rng)
    }
    expect(taken).toBeGreaterThan(0)
    expect(missed).toBeGreaterThan(0)
  })
})
