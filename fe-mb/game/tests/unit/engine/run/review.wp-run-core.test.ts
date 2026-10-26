/**
 * Adversarial review of WP-RUN-CORE (not written by the implementer). Three extra edge-case tests: multi-cycle
 * equip conservation, a multi-battle loot chain with owned-exclusion and fall-down over the REAL pool, and a
 * multi-step run state that must stay JSON-safe. A failure here documents a defect; do not "fix" the test.
 */
import { describe, expect, it } from 'vitest'
import { deriveState } from '../../../../src/engine/rngState'
import { rngLabels } from '../../../../src/engine/rules'
import { addFood, cells, consumeFood, footprint, foodCount, ownedItemIds, placeInBag } from '../../../../src/engine/run/bag'
import { planEquip, planUnequip } from '../../../../src/engine/run/equipment'
import { grantLoot, lootPool, lootRowFor, rollLoot } from '../../../../src/engine/run/loot'
import { damageParty, healParty, recruitCharacter, removeFallen } from '../../../../src/engine/run/party'
import type { BagEntry, Item, Unit } from '../../../../src/engine/types'
import { env, fillBag, itemWhere, newRun, withUnit } from '../../../helpers/runs'

const byId = (id: string): Item => env.content.items[id]!

/** Every item the company holds, as a sorted multiset (bag entries + both hands of every unit). */
function multiset(units: readonly Unit[], bag: readonly BagEntry[]): readonly string[] {
  return [...bag.map((e) => e.itemId), ...units.flatMap((u) => [u.handLeft, u.handRight])].filter((id): id is string => id !== null).sort()
}

/** Σ footprints — equals `cells(bag).size` iff no two entries overlap and none leaves the grid. */
function footprintSum(bag: readonly BagEntry[]): number {
  return bag.reduce((s, e) => {
    const { w, h } = footprint(byId(e.itemId))
    return s + w * h
  }, 0)
}

/** Walks a value and lists every path holding `undefined`, a Set or a Map — none may exist in persisted state. */
function nonJsonPaths(value: unknown, path = 'run', out: string[] = []): string[] {
  if (value === undefined) out.push(path)
  else if (value instanceof Set || value instanceof Map) out.push(`${path} <${value.constructor.name}>`)
  else if (Array.isArray(value)) value.forEach((v, i) => nonJsonPaths(v, `${path}[${i}]`, out))
  else if (value !== null && typeof value === 'object') for (const [k, v] of Object.entries(value)) nonJsonPaths(v, `${path}.${k}`, out)
  return out
}

describe('review — equip plans over 3 full cycles conserve every item and never overlap a cell', () => {
  it('2H on, 1H+1H back on, 2H on again … the multiset of (bag ∪ hands) is invariant and cells == Σ footprints', () => {
    const run = newRun()
    // The Foundling with a buckler in the off hand: both hands full AND a chassis trained to a two-handed arm.
    // Oak ships with both hands full but `shield_knight` is trained to no two-handed item in the shelf (0121),
    // so the cycle below is run on the Lord, whose greatsword is a hand `canHold` allows.
    const lord = Object.values(run.party).find((u) => u.classId === 'lord')!
    const holder: Unit = { ...lord, handRight: itemWhere((i) => i.weaponClass === 'shield' && i.twoHanded !== true).id }
    const left = holder.handLeft!
    const right = holder.handRight!
    const twoHanded = itemWhere((i) => i.twoHanded === true && i.weaponClass === 'greatsword')
    let bag = placeInBag(run.bag, [twoHanded.id], env)!
    let unit = holder
    const start = multiset([unit], bag)

    for (let cycle = 0; cycle < 3; cycle++) {
      const on = planEquip(unit, 'left', twoHanded.id, bag, env)
      expect(on.ok).toBe(true)
      if (!on.ok) return
      unit = on.unit
      bag = on.bag
      expect([unit.handLeft, unit.handRight]).toEqual([twoHanded.id, null])
      expect(multiset([unit], bag)).toEqual(start)
      expect(cells(bag, env).size).toBe(footprintSum(bag))

      const back = planEquip(unit, 'left', left, bag, env)
      expect(back.ok).toBe(true)
      if (!back.ok) return
      unit = back.unit
      bag = back.bag
      expect(unit.handRight).toBeNull() // the 2H came off; the right hand is merely unlocked, not refilled
      const offhand = planEquip(unit, 'right', right, bag, env)
      expect(offhand.ok).toBe(true)
      if (!offhand.ok) return
      unit = offhand.unit
      bag = offhand.bag
      expect([unit.handLeft, unit.handRight]).toEqual([left, right])
      expect(multiset([unit], bag)).toEqual(start)
      expect(cells(bag, env).size).toBe(footprintSum(bag))
    }

    // Unequip both hands, then re-equip — still conserved, still overlap-free.
    const offL = planUnequip(unit, 'left', bag, env)
    expect(offL.ok).toBe(true)
    if (!offL.ok) return
    const offR = planUnequip(offL.unit, 'right', offL.bag, env)
    expect(offR.ok).toBe(true)
    if (!offR.ok) return
    expect([offR.unit.handLeft, offR.unit.handRight]).toEqual([null, null])
    expect(multiset([offR.unit], offR.bag)).toEqual(start)
    expect(cells(offR.bag, env).size).toBe(footprintSum(offR.bag))
    // Every bag entry lies inside the grid.
    for (const e of offR.bag) {
      const { w, h } = footprint(byId(e.itemId))
      expect(e.x + w).toBeLessThanOrEqual(env.rules.bag.width)
      expect(e.y + h).toBeLessThanOrEqual(env.rules.bag.height)
    }
  })
})

describe('review — a chain of tier-3 boss drops over the REAL pool', () => {
  const row = lootRowFor('dungeon:boss', 3, env)
  const top = Object.values(env.content.items).filter((i) => i.rarity === 'epic' || i.rarity === 'legendary')

  it('every drop is unowned at roll time, placed gear drains the top tiers, overflow parks (first-fit fragments), and the chain replays', () => {
    // Note for readers: with the kit in the bag and no rotation, a 2×3 bow can overflow with 15 cells free (no
    // 2-wide × 3-tall hole) — that is first-fit by contract, not a defect; the item parks in `pendingLoot`.
    const chain = (seed: number): readonly string[] => {
      let run = newRun(seed)
      const drops: string[] = []
      for (let i = 0; i < top.length; i++) {
        const pool = lootPool(run, 'dungeon:boss', env)
        const rolled = rollLoot(row, pool, deriveState(run.rng, rngLabels.loot(rngLabels.battleDungeon('iron_mine', `r5c0#${i}`))), env)
        expect(rolled.itemIds).toHaveLength(1)
        const id = rolled.itemIds[0]!
        expect(ownedItemIds(run)).not.toContain(id)
        expect(['epic', 'legendary']).toContain(byId(id).rarity)
        const granted = grantLoot(run, rolled.itemIds, 'loot', env)
        if (granted.overflow.length > 0) expect(granted.state.pendingLoot).toContain(id) // never discarded
        expect(cells(granted.state.bag, env).size).toBe(footprintSum(granted.state.bag))
        expect(granted.state.stats.gearFound).toBe(run.stats.gearFound + 1)
        run = granted.state
        drops.push(id)
      }
      // Everything PLACED is excluded from the pool for good.
      for (const e of run.bag) expect(lootPool(run, 'dungeon:boss', env).map((i) => i.id)).not.toContain(e.itemId)
      expect(run.stats.gearFound).toBe(top.length)
      return drops
    }
    expect(chain(11)).toEqual(chain(11))
    expect(chain(11)).not.toEqual(chain(12))
  })

  it('DOCUMENTS A DEFECT: a guaranteed drop waiting in pendingLoot can be rolled AGAIN by the next source (lootPool excludes bag + hands only)', () => {
    // Reachable path: a treasure room overflows an epic → `dungeon/moveTo` the boss room is legal with pendingLoot
    // non-empty → the boss roll draws from a pool that still holds the parked epic → two copies of a unique item.
    const full = fillBag(newRun(5))
    const epic = top.find((i) => i.rarity === 'epic')!
    const parked = grantLoot(full, [epic.id], 'treasure', env)
    expect(parked.state.pendingLoot).toEqual([epic.id])
    const pool = lootPool(parked.state, 'dungeon:boss', env)
    // Brief §2.13: "exclude already-owned ids … 4 epics / 3 legendaries cannot survive duplicates". A parked drop is
    // owned in every sense that matters; the pool should not offer it a second time.
    expect(pool.map((i) => i.id)).not.toContain(epic.id)
    let rerolled = false
    for (let i = 0; i < 40 && !rerolled; i++) {
      const r = rollLoot(row, pool, deriveState(parked.state.rng, rngLabels.loot(rngLabels.battleDungeon('iron_mine', `r5c0#${i}`))), env)
      rerolled = r.itemIds.includes(epic.id)
    }
    expect(rerolled).toBe(false)
  })
})

describe('review — a multi-step run stays JSON-safe and its resource invariants hold', () => {
  it('recruit → starvation ×3 → food dry → addFood → overflow → fallen: no undefined/Set anywhere, strict round trip', () => {
    const recruit = Object.values(env.content.characters).find((c) => c.kind === 'unit' && c.recruitable && !c.starter)!
    let run = recruitCharacter(newRun(3), recruit.id, env).state
    expect(run.party[recruit.id]).toBeDefined()

    // Three starvation cycles: HP never below 0, nobody logged twice, party/partyOrder stay in step.
    for (let i = 0; i < 3; i++) {
      const r = damageParty(run, env.rules.travel.starvationDamage, 'starvation', env)
      run = r.state
      for (const u of Object.values(run.party)) expect(u.hp.current).toBeGreaterThan(0)
      expect(Object.keys(run.party).sort()).toEqual([...run.partyOrder].sort())
      expect(new Set(run.deathLog.map((d) => d.unitId)).size).toBe(run.deathLog.length)
    }
    // Food: drain the kit hop by hop, then refill past a ration boundary; every entry keeps 1..charges.
    const ration = itemWhere((i) => i.kind === 'food')
    const max = ration.charges ?? 1
    let hops = 0
    while (foodCount(run.bag, env) > 0) {
      run = consumeFood(run, 1, 'hop', env).state
      hops++
      for (const e of run.bag.filter((b) => b.itemId === ration.id)) {
        expect(e.charges).toBeGreaterThanOrEqual(1)
        expect(e.charges).toBeLessThanOrEqual(max)
      }
    }
    expect(hops).toBe(env.rules.economy.startKit.reduce((s, k) => (byId(k.itemId).kind === 'food' ? s + k.count * max : s), 0))
    run = addFood(run, max + 1, 'quest', env).state
    expect(foodCount(run.bag, env)).toBe(max + 1)
    expect(run.bag.filter((b) => b.itemId === ration.id).map((b) => b.charges).sort()).toEqual([1, max].sort())
    run = healParty(run, 'full', true, 'inn', env).state

    // Guaranteed loot into a full bag parks in pendingLoot; a fallen companion leaves party AND partyOrder.
    const full = fillBag(run)
    const epic = Object.values(env.content.items).find((i) => i.rarity === 'epic')!
    const parked = grantLoot(full, [epic.id], 'trophy', env)
    expect(parked.state.pendingLoot).toEqual([epic.id])
    const fallen = removeFallen(parked.state, [{ unitId: recruit.id, cause: 'event', battleId: null }], env).state
    expect(fallen.party[recruit.id]).toBeUndefined()
    expect(fallen.partyOrder).not.toContain(recruit.id)
    expect(fallen.deathLog.map((d) => d.unitId)).toEqual([recruit.id])
    // The dead do not re-join, even with room in the wagon.
    expect(recruitCharacter(fallen, recruit.id, env).state).toBe(fallen)

    expect(nonJsonPaths(fallen)).toEqual([])
    expect(JSON.parse(JSON.stringify(fallen))).toStrictEqual(fallen)
    // And the original inputs were never touched along the way.
    expect(nonJsonPaths(withUnit(newRun(3), fallen.party[fallen.partyOrder[0]!]!))).toEqual([])
  })
})
