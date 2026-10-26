/**
 * run/equipment.ts acceptance (brief §2.7, §10 "planEquip swaps the old item to the bag, refuses when the bag is
 * full, rejects 1H into a locked right slot, rejects non-gear and not-in-bag items; the whole plan is atomic;
 * bag is 32 cells").
 */
import { describe, expect, it } from 'vitest'
import { cells, placeInBag } from '../../../../src/engine/run/bag'
import { canHold, planEquip, planUnequip } from '../../../../src/engine/run/equipment'
import type { BagEntry, Unit } from '../../../../src/engine/types'
import { env, fillBag, itemWhere, newRun, smallestItem, withBag } from '../../../helpers/runs'

const potion = smallestItem()
const twoHanded = itemWhere((i) => i.twoHanded === true && i.weaponClass !== 'bow')
const twoHandedBow = itemWhere((i) => i.twoHanded === true && i.weaponClass === 'bow')
const oneHandedBow = itemWhere((i) => i.twoHanded !== true && i.weaponClass === 'bow')
const crossbow = itemWhere((i) => i.weaponClass === 'crossbow')
const quivers = Object.values(env.content.items).filter((i) => i.kind === 'quiver')
const quiverA = quivers[0]!
const quiverB = quivers[1]!

/**
 * A holder with BOTH hands full whose chassis is also trained to a two-handed arm (0121). Oak ships with both
 * hands full, but `shield_knight` is trained to lance / axe / sword / shield and the shelf's only two-handed
 * items are greatswords and bows — so he can never legally hold one, and the 2H cases below cannot use him.
 * The Foundling can (Lord: sword / greatsword / shield), so he takes the buckler in his off hand, which is a hand
 * `canHold` allows and therefore a state the game can actually reach.
 */
function twoHandsFull(): { unit: Unit; bagWith: (ids: readonly string[]) => readonly BagEntry[] } {
  const run = newRun()
  const lord = Object.values(run.party).find((u) => u.classId === 'lord')!
  const buckler = itemWhere((i) => i.weaponClass === 'shield' && i.twoHanded !== true)
  const unit: Unit = { ...lord, handRight: buckler.id }
  return { unit, bagWith: (ids) => placeInBag(run.bag, ids, env)! }
}

/** An archer chassis for the quiver and 2H-bow rules: a quiver is an ARCHER's kit
 *  (`rules.gear.quiverPairsWith`), so the hand that takes one has to be a hand that could draw the bow. */
function archer(): Unit {
  return { ...Object.values(newRun().party)[0]!, classId: 'bandit_archer', handLeft: null, handRight: null }
}

describe('planEquip', () => {
  it('swaps the old item to the bag', () => {
    const { unit, bagWith } = twoHandsFull()
    const spare = itemWhere((i) => i.weaponClass === unit.handLeft!.split('_')[1] && i.id !== unit.handLeft && i.twoHanded !== true)
    const bag = bagWith([spare.id])
    const plan = planEquip(unit, 'left', spare.id, bag, env)
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.unit.handLeft).toBe(spare.id)
    expect(plan.unit.handRight).toBe(unit.handRight)
    expect(plan.bag.map((e) => e.itemId)).toContain(unit.handLeft)
    expect(plan.bag.map((e) => e.itemId)).not.toContain(spare.id)
    expect(plan.bag).toHaveLength(bag.length)
  })

  it('a two-handed item occupies LEFT and locks RIGHT, emptying both hands into the bag', () => {
    const { unit, bagWith } = twoHandsFull()
    const bag = bagWith([twoHanded.id])
    const plan = planEquip(unit, 'right', twoHanded.id, bag, env) // slot is ignored for 2H: it always takes left
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.unit.handLeft).toBe(twoHanded.id)
    expect(plan.unit.handRight).toBeNull()
    const ids = plan.bag.map((e) => e.itemId)
    expect(ids).toContain(unit.handLeft)
    expect(ids).toContain(unit.handRight)
    expect(ids).not.toContain(twoHanded.id)
  })

  it('rejects a 1H into a locked right slot; replacing the 2H in LEFT unlocks it', () => {
    const { bagWith } = twoHandsFull()
    const locked: Unit = { ...archer(), handLeft: twoHandedBow.id, handRight: null }
    const bag = bagWith([potion.id, quiverA.id])
    const refused = planEquip(locked, 'right', quiverA.id, bag, env)
    expect(refused).toEqual({ ok: false, reason: expect.stringContaining('locked') })
    const replaced = planEquip(locked, 'left', quiverA.id, bag, env)
    expect(replaced.ok).toBe(true)
    if (!replaced.ok) return
    expect(replaced.unit.handLeft).toBe(quiverA.id)
    expect(replaced.unit.handRight).toBeNull()
    expect(replaced.bag.map((e) => e.itemId)).toContain(twoHandedBow.id)
  })

  it('quiver rules: a quiver is ordinary 1H gear — either slot, two at once, beside a crossbow; never beside a 2H bow', () => {
    const base = archer()
    const bag = placeInBag([], [quiverA.id, quiverB.id, oneHandedBow.id, crossbow.id, twoHandedBow.id], env)!
    const left = planEquip(base, 'left', quiverA.id, bag, env)
    expect(left.ok).toBe(true)
    if (!left.ok) return
    const right = planEquip(left.unit, 'right', quiverB.id, left.bag, env) // two quivers: legal, merely useless
    expect(right.ok).toBe(true)
    if (!right.ok) return
    expect([right.unit.handLeft, right.unit.handRight]).toEqual([quiverA.id, quiverB.id])
    const bowPair = planEquip(left.unit, 'right', oneHandedBow.id, left.bag, env)
    expect(bowPair.ok).toBe(true)
    const crossbowPair = planEquip(left.unit, 'right', crossbow.id, left.bag, env)
    expect(crossbowPair.ok).toBe(true)
    // The 2H bow takes left and locks right: the quiver comes off and cannot go back on.
    const longbow = planEquip(left.unit, 'left', twoHandedBow.id, left.bag, env)
    expect(longbow.ok).toBe(true)
    if (!longbow.ok) return
    expect(longbow.unit.handRight).toBeNull()
    expect(planEquip(longbow.unit, 'right', quiverA.id, longbow.bag, env).ok).toBe(false)
  })

  it('rejects non-gear and not-in-bag items', () => {
    const { unit, bagWith } = twoHandsFull()
    const bag = bagWith([])
    expect(planEquip(unit, 'left', potion.id, bag, env)).toEqual({ ok: false, reason: expect.stringContaining(potion.name) })
    expect(planEquip(unit, 'left', twoHanded.id, bag, env)).toEqual({ ok: false, reason: expect.stringContaining('not in the bag') })
    expect(planEquip(unit, 'left', 'no_such_item', bag, env)).toEqual({ ok: false, reason: expect.stringContaining('no_such_item') })
  })

  it('refuses when the displaced gear has no room, and the whole plan is atomic (inputs untouched)', () => {
    const run = newRun()
    const holder: Unit = { ...archer(), handLeft: twoHandedBow.id, handRight: null }
    // Bag: full except the single cell the 1×1 quiver sits in — the 2×3 sword coming off has nowhere to go.
    const full = fillBag(withBag(run, placeInBag([], [quiverA.id], env)!))
    const bagBefore = JSON.stringify(full.bag)
    const unitBefore = JSON.stringify(holder)
    const plan = planEquip(holder, 'left', quiverA.id, full.bag, env)
    expect(plan.ok).toBe(false)
    expect(JSON.stringify(full.bag)).toBe(bagBefore)
    expect(JSON.stringify(holder)).toBe(unitBefore)
  })

  it('the equipped item frees its cells first: a same-size swap succeeds in an otherwise full bag', () => {
    const { unit, bagWith } = twoHandsFull()
    const held = env.content.items[unit.handLeft!]!
    const spare = itemWhere((i) => i.id !== held.id && i.kind === held.kind && i.twoHanded !== true && i.gridSize.width === held.gridSize.width && i.gridSize.height === held.gridSize.height)
    const run = fillBag(withBag(newRun(), placeInBag([], [spare.id], env)!))
    expect(cells(run.bag, env).size).toBe(env.rules.bag.width * env.rules.bag.height)
    const plan = planEquip(unit, 'left', spare.id, run.bag, env)
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.bag.map((e) => e.itemId)).toContain(held.id)
    expect(cells(plan.bag, env).size).toBe(env.rules.bag.width * env.rules.bag.height)
    void bagWith
  })

  it('bag is 32 cells (rules.bag)', () => {
    expect(env.rules.bag.width * env.rules.bag.height).toBe(32)
  })
})

/**
 * RE-GATE C 3.13. No class or weapon restriction existed anywhere: `equip` put a Volcanic Tower Shield in the
 * Mage's off hand and the game said nothing, and a Lord could hold a tome. DECISIONS removed the weapon TRIANGLE
 * (+15 hit / +1 damage); that was never the same as no restriction at all, and the game's own vocabulary — Lord,
 * Mage, Shield Knight, a `weaponClass` on all 51 items — promised a rule that was not there.
 */
describe('canHold — a chassis is trained to its own arms', () => {
  const shield = itemWhere((i) => i.weaponClass === 'shield')
  const tome = itemWhere((i) => i.weaponClass === 'tome')
  const sword = itemWhere((i) => i.weaponClass === 'sword' && i.twoHanded !== true)

  it('refuses the shipped offenders by name, in a sentence the player can read', () => {
    expect(canHold('mage', shield, env)).toEqual({ ok: false, reason: 'Mages do not carry shields' })
    expect(canHold('lord', tome, env)).toEqual({ ok: false, reason: 'Lords do not carry tomes' })
    expect(canHold('shield_knight', tome, env)).toEqual({ ok: false, reason: 'Shield Knights do not carry tomes' })
    // §5.1: a refusal is a fragment completing an implied "because ..." — a NAME keeps its capital, but nothing
    // here is an id, a formula or a machine code, and it carries no terminal stop.
    for (const r of [canHold('mage', shield, env), canHold('lord', tome, env)]) {
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.reason.endsWith('.')).toBe(false)
      expect(r.reason).not.toMatch(/[a-z][A-Z]|_/)
    }
  })

  it('lets every chassis hold what it ships with, and a quiver only where the bow is', () => {
    expect(canHold('lord', sword, env).ok).toBe(true)
    expect(canHold('mage', tome, env).ok).toBe(true)
    expect(canHold('bandit_archer', quiverA, env).ok).toBe(true)
    expect(canHold('mage', quiverA, env)).toEqual({ ok: false, reason: 'Mages do not carry quivers' })
    // A wolf is trained to nothing and holds nothing — the empty list means exactly what it says.
    expect(canHold('wolf', sword, env).ok).toBe(false)
  })

  it('the reducer and the loadout read the SAME answer: planEquip refuses on training before it looks at space', () => {
    const run = newRun()
    const mage = Object.values(run.party).find((u) => u.classId === 'mage')!
    const bag = placeInBag(run.bag, [shield.id], env)!
    expect(planEquip(mage, 'right', shield.id, bag, env)).toEqual({ ok: false, reason: 'Mages do not carry shields' })
    // ...and putting something DOWN is never refused for training: a hand that already holds it must be emptiable.
    expect(planUnequip({ ...mage, handRight: shield.id }, 'right', run.bag, env).ok).toBe(true)
  })
})

describe('planUnequip', () => {
  it('puts the item in the bag and clears the hand; a 2H leaves the right hand free', () => {
    const { unit, bagWith } = twoHandsFull()
    const bag = bagWith([])
    const plan = planUnequip(unit, 'right', bag, env)
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.unit.handRight).toBeNull()
    expect(plan.unit.handLeft).toBe(unit.handLeft)
    expect(plan.bag.map((e) => e.itemId)).toContain(unit.handRight)
    const twoH = planUnequip({ ...unit, handLeft: twoHanded.id, handRight: null }, 'left', bag, env)
    expect(twoH.ok).toBe(true)
    if (!twoH.ok) return
    expect(twoH.unit).toMatchObject({ handLeft: null, handRight: null })
  })

  it('refuses on an empty hand or a full bag', () => {
    const { unit } = twoHandsFull()
    expect(planUnequip({ ...unit, handRight: null }, 'right', [], env)).toEqual({ ok: false, reason: expect.stringContaining('empty') })
    const full = fillBag(newRun())
    expect(planUnequip(unit, 'left', full.bag, env).ok).toBe(false)
  })
})
