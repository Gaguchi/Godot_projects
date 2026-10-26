/**
 * combat/ai.ts — TAUNT is honoured by the ACT step, not only by the free move (Gate 3 finding 2).
 *
 * `pickTarget` has always filtered its pool by `isTaunting`, but `pickTarget` is only consulted for the free
 * move; the blow itself went through `actionOptions` → `bestTile`, which scored candidate tiles purely by
 * kills / expected damage / target frailty. So the tank walked into the enemy's face and the enemy swung past
 * it at whoever was frailest — spending a turn on Cover protected nobody, and `iron_tower_shield_cover` ships
 * in the starting kit. These cases pin the repro from the playthrough plus the two edges: a taunt only claims
 * blows the enemy could actually land on it, and it never invents reach.
 */
import { describe, expect, it } from 'vitest'
import { planEnemyStep } from '../../../../src/engine/combat/ai'
import type { ActiveStatus, CombatState, CombatUnit, UnitId } from '../../../../src/engine/types'
import { manhattan } from '../../../../src/engine/combat/grid'
import { activate, authored, env, mc, oak, patchUnit, placeAt, seed, unitFromClass } from '../../../helpers/battles'

const e = env()

const TAUNT: ActiveStatus = { id: 'taunt', stacks: 1, turns: 1, expiresAt: 'ownerTurnStart', sourceId: 'oak' }

function taunting(state: CombatState, id: UnitId): CombatState {
  return patchUnit(state, id, { statuses: [TAUNT] })
}

/** Who the planned blow actually lands on. */
function actedOn(state: CombatState): { readonly kind: string; readonly tile: string | null; readonly unit: CombatUnit | null } {
  const plan = planEnemyStep(state, e)
  if (plan.step.kind !== 'act') return { kind: plan.step.kind, tile: null, unit: null }
  const tile = plan.step.tile
  const unit = Object.values(state.units).find((u) => u.position === tile) ?? null
  return { kind: 'act', tile, unit }
}

/**
 * The lived repro: a bandit at 3,3 with the tank in its face at 3,4 and a 5-HP mage one tile west at 2,3.
 * The bandit has already moved, so the only decision left is where to swing.
 */
function board(): CombatState {
  let st = seed({
    // no Genatsvale here: this is about the taunt alone, not the redirect
    party: [mc(), oak({ passives: [] }), unitFromClass('lilina', 'mage', 'party', { handLeft: 'fire_tome' })],
    enemies: { kind: 'authored', units: [authored('b', 'bandit', 3, 3)] },
    seed: 13,
  })
  st = placeAt(st, 'oak', 3, 4)
  st = placeAt(st, 'lilina', 2, 3)
  st = placeAt(st, 'mc', 8, 8)
  st = patchUnit(st, 'lilina', { hp: { current: 5, max: 26 } })
  return patchUnit(activate(st, 'b'), 'b', { hasMovedThisTurn: true })
}

describe('combat/ai — a taunt claims the blow, not just the walk', () => {
  it('without a taunt the bandit swings past the tank at the dying mage', () => {
    const acted = actedOn(board())
    expect(acted.kind).toBe('act')
    expect(acted.tile).toBe('2,3')
    expect(acted.unit?.id).toBe('lilina')
  })

  it('with the tank taunting, the same board sends the blow into the tank', () => {
    const acted = actedOn(taunting(board(), 'oak'))
    expect(acted.kind).toBe('act')
    expect(acted.tile).toBe('3,4')
    expect(acted.unit?.id).toBe('oak')
  })

  it('an archer honours it too: in reach of the taunter, it shoots the taunter and not the frail mage', () => {
    let st = seed({
      party: [mc(), oak({ passives: [] }), unitFromClass('lilina', 'mage', 'party', { handLeft: 'fire_tome' })],
      enemies: { kind: 'authored', units: [authored('a', 'bandit_archer', 5, 3)] },
      seed: 21,
    })
    st = placeAt(st, 'oak', 3, 3) // 2 tiles west — inside the 2-3 band
    st = placeAt(st, 'lilina', 5, 5) // 2 tiles south — also inside the band
    st = placeAt(st, 'mc', 9, 9)
    st = patchUnit(st, 'lilina', { hp: { current: 4, max: 26 } })
    st = patchUnit(activate(st, 'a'), 'a', { hasMovedThisTurn: true })
    expect(actedOn(st).unit?.id).toBe('lilina')
    expect(actedOn(taunting(st, 'oak')).unit?.id).toBe('oak')
  })

  /**
   * 0111. A taunt still invents no reach — nothing here extends a range or a movement — but the blow it cannot
   * land on the taunter is not landed on somebody else either: the foe is DRAWN OFF. Before, an archer that could
   * not shoot the tank shot the dying mage instead, from a tile the walk toward the tank had gained it nothing on,
   * which is why the tank's one defensive verb read as a no-op from the chair (RE-GATE C 3.19).
   */
  function outOfBand(): CombatState {
    let st = seed({
      party: [mc(), oak({ passives: [] }), unitFromClass('lilina', 'mage', 'party', { handLeft: 'fire_tome' })],
      enemies: { kind: 'authored', units: [authored('a', 'bandit_archer', 5, 3)] },
      seed: 21,
    })
    st = placeAt(st, 'oak', 12, 8) // far out of the 2-3 band and out of the free move's reach
    st = placeAt(st, 'lilina', 5, 5)
    st = placeAt(st, 'mc', 9, 9)
    st = patchUnit(st, 'lilina', { hp: { current: 4, max: 26 } })
    return st
  }

  it('out of the archer’s band the taunt takes the blow off the mage rather than moving it onto the tank', () => {
    const st = patchUnit(activate(outOfBand(), 'a'), 'a', { hasMovedThisTurn: true })
    expect(actedOn(st).unit?.id).toBe('lilina')          // no taunt: the dying mage
    const drawn = actedOn(taunting(st, 'oak'))
    expect(drawn.kind).toBe('endTurn')                    // taunted: nobody
    expect(drawn.unit).toBeNull()
  })

  it('the drawn-off foe closes on the taunter instead of standing still', () => {
    const st = taunting(activate(outOfBand(), 'a'), 'oak')
    const plan = planEnemyStep(st, e)
    expect(plan.step.kind).toBe('move')
    const oakAt = st.units['oak']?.position ?? ''
    const before = manhattan(st.units['a']?.position ?? '', oakAt)
    const after = manhattan(plan.step.kind === 'move' ? plan.step.to : '', oakAt)
    expect(after).toBeLessThan(before)
  })

  it('a taunt is a provocation, not a stun: a taunted HEALER still mends its own', () => {
    let st = seed({
      party: [mc(), oak({ passives: [] }), unitFromClass('lilina', 'mage', 'party', { handLeft: 'fire_tome' })],
      enemies: { kind: 'authored', units: [authored('h', 'cleric', 5, 3), authored('w', 'bandit', 5, 4)] },
      seed: 21,
    })
    st = placeAt(st, 'oak', 4, 3)
    st = placeAt(st, 'lilina', 1, 0)
    st = placeAt(st, 'mc', 2, 0)
    st = patchUnit(st, 'w', { hp: { current: 5, max: 90 } })
    st = patchUnit(activate(taunting(st, 'oak'), 'h'), 'h', { hasMovedThisTurn: true })
    const acted = actedOn(st)
    expect(acted.kind).toBe('act')
    expect(acted.unit?.id).toBe('w')
  })

  it('the taunt filter runs BEFORE the kill score: a lethal blow elsewhere does not break it', () => {
    // The mage is one hit from death and the tank is untouched — the old scorer took the kill every time.
    const st = taunting(board(), 'oak')
    const acted = actedOn(st)
    expect(acted.unit?.id).toBe('oak')
    expect(st.units['lilina']?.hp.current).toBe(5)
  })
})
