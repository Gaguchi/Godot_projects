/**
 * run/bag.ts acceptance (brief §2.7 spatial bag, §2.9 food per hop, §7.22 signed resource deltas, §10).
 */
import { describe, expect, it } from 'vitest'
import * as bag from '../../../../src/engine/run/bag'
import type { BagEntry } from '../../../../src/engine/types'
import { env, fillBag, itemWhere, newRun, smallestItem, withBag } from '../../../helpers/runs'

const potion = smallestItem()
const ration = itemWhere((i) => i.kind === 'food')
const greatsword = itemWhere((i) => i.gridSize.width === 2 && i.gridSize.height === 3)
const cellsTotal = env.rules.bag.width * env.rules.bag.height
const rationCharges = ration.charges ?? 1

const potionsAt = (pred: (x: number, y: number) => boolean): BagEntry[] => {
  const out: BagEntry[] = []
  for (let y = 0; y < env.rules.bag.height; y++) for (let x = 0; x < env.rules.bag.width; x++) if (pred(x, y)) out.push({ itemId: potion.id, x, y, charges: 1 })
  return out
}

describe('bag — spatial footprints', () => {
  it('footprint comes from Item.gridSize', () => {
    expect(bag.footprint(greatsword)).toEqual({ w: greatsword.gridSize.width, h: greatsword.gridSize.height })
    expect(bag.footprint(potion)).toEqual({ w: 1, h: 1 })
  })

  it('bag is 32 cells: that many 1×1 potions fit and one more does not', () => {
    expect(bag.placeInBag([], Array<string>(cellsTotal).fill(potion.id), env)).toHaveLength(cellsTotal)
    expect(bag.placeInBag([], Array<string>(cellsTotal + 1).fill(potion.id), env)).toBeNull()
  })

  it('a 2×3 greatsword needs a 2×3 hole — a checkerboard of free cells is not enough', () => {
    const board = potionsAt((x, y) => (x + y) % 2 === 0)
    expect(bag.cells(board, env).size).toBe(cellsTotal / 2)
    expect(bag.findSlot(board, greatsword.id, env)).toBeNull()
    // Free the three potions inside the top-left 2×3 block → the sword fits exactly there.
    const freed = board.filter((e) => !((e.x === 0 && e.y === 0) || (e.x === 1 && e.y === 1) || (e.x === 0 && e.y === 2)))
    expect(bag.findSlot(freed, greatsword.id, env)).toEqual({ x: 0, y: 0 })
    const placed = bag.placeInBag(freed, [greatsword.id], env)
    expect(placed).not.toBeNull()
    expect(bag.cells(placed!, env).size).toBe(bag.cells(freed, env).size + greatsword.gridSize.width * greatsword.gridSize.height)
  })

  it('first fit is row-major: the first free cell scanning each row left to right', () => {
    const row0 = potionsAt((x, y) => y === 0 && x !== 3)
    expect(bag.findSlot(row0, potion.id, env)).toEqual({ x: 3, y: 0 })
    // A 1×2 ration cannot use the row-0 gap (it would hang into row 1 — allowed) unless row 1 is free: it is.
    expect(bag.findSlot(row0, ration.id, env)).toEqual({ x: 3, y: 0 })
    const rowsBlocked = [...row0, ...potionsAt((x, y) => y === 1 && x === 3)]
    expect(bag.findSlot(rowsBlocked, ration.id, env)).toEqual({ x: 0, y: 1 })
  })

  it('fits rejects out-of-bounds and overlapping placements', () => {
    const one = [{ itemId: ration.id, x: 0, y: 0, charges: rationCharges }]
    expect(bag.fits(one, potion, 0, 1, env)).toBe(false) // covered by the 1×2 ration
    expect(bag.fits(one, potion, 1, 0, env)).toBe(true)
    expect(bag.fits([], greatsword, env.rules.bag.width - 1, 0, env)).toBe(false)
    expect(bag.fits([], greatsword, 0, env.rules.bag.height - 1, env)).toBe(false)
    expect(bag.fits([], potion, -1, 0, env)).toBe(false)
    // `ignore` lets an entry be re-placed over its own cells.
    expect(bag.fits(one, ration, 0, 0, env, one[0])).toBe(true)
  })

  it('placeInBag is all-or-nothing and never mutates its input', () => {
    const run = fillBag(newRun(), 1)
    const before = [...run.bag]
    expect(bag.placeInBag(run.bag, [potion.id, potion.id], env)).toBeNull()
    expect(run.bag).toEqual(before)
    const one = bag.placeInBag(run.bag, [potion.id], env)
    expect(one).toHaveLength(run.bag.length + 1)
    expect(one).not.toBe(run.bag)
  })

  it('placeInBag takes charges from the item def: rations carry theirs, everything else 1', () => {
    const placed = bag.placeInBag([], [ration.id, potion.id], env)!
    expect(placed[0]!.charges).toBe(rationCharges)
    expect(placed[1]!.charges).toBe(1)
  })

  it('entryAt / removeAt address the top-left cell; removeFirst drops one copy by id', () => {
    const two = bag.placeInBag([], [ration.id, ration.id], env)!
    expect(bag.entryAt(two, two[1]!.x, two[1]!.y)).toBe(two[1])
    expect(bag.entryAt(two, two[1]!.x, two[1]!.y + 1)).toBeNull() // not the top-left
    expect(bag.removeAt(two, two[0]!.x, two[0]!.y)).toEqual([two[1]])
    expect(bag.removeAt(two, 7, 3)).toBe(two) // nothing there → same reference
    expect(bag.removeFirst(two, ration.id)).toEqual([two[1]])
    expect(bag.removeFirst(two, potion.id)).toBe(two)
  })

  it('moveEntry re-anchors an entry and refuses overlap or leaving the grid', () => {
    const two = bag.placeInBag([], [ration.id, ration.id], env)!
    const a = two[0]!
    expect(bag.moveEntry(two, a.x, a.y, 5, 0, env)).toEqual([{ ...a, x: 5, y: 0 }, two[1]])
    expect(bag.moveEntry(two, a.x, a.y, two[1]!.x, two[1]!.y, env)).toBeNull() // onto the other ration
    expect(bag.moveEntry(two, a.x, a.y, 0, env.rules.bag.height - 1, env)).toBeNull() // hangs off the bottom
    expect(bag.moveEntry(two, 6, 3, 0, 0, env)).toBeNull() // nothing at the source
    expect(bag.moveEntry(two, a.x, a.y, a.x, a.y, env)).toEqual(two) // onto itself is fine
  })
})

describe('bag — food charges', () => {
  it('a fresh run carries the kit food: Σ count × charges over the food entries', () => {
    const run = newRun()
    const expected = env.rules.economy.startKit.reduce((sum, k) => {
      const item = env.content.items[k.itemId]!
      return item.kind === 'food' ? sum + k.count * (item.charges ?? 1) : sum
    }, 0)
    expect(bag.foodCount(run.bag, env)).toBe(expected)
  })

  it('a potion is not food: foodCount ignores charges:1 potions', () => {
    const run = withBag(newRun(), bag.placeInBag([], [potion.id, potion.id], env)!)
    expect(bag.foodCount(run.bag, env)).toBe(0)
  })

  it('consumeFood decrements charges first-match, removes a ration at 0, and never touches the day', () => {
    const run = newRun()
    const start = bag.foodCount(run.bag, env)
    const rations = run.bag.filter((e) => e.itemId === ration.id).length
    const r1 = bag.consumeFood(run, 1, 'hop', env)
    expect(r1.consumed).toBe(1)
    expect(bag.foodCount(r1.state.bag, env)).toBe(start - 1)
    expect(r1.state.bag.filter((e) => e.itemId === ration.id)).toHaveLength(rations)
    expect(r1.effects).toEqual([{ kind: 'foodChanged', delta: -1, reason: 'hop' }])
    expect(r1.state.daysElapsed).toBe(run.daysElapsed)
    expect(r1.state.stats.hops).toBe(run.stats.hops)
    const rest = bag.consumeFood(r1.state, rationCharges - 1, 'rest', env)
    expect(rest.state.bag.filter((e) => e.itemId === ration.id)).toHaveLength(rations - 1)
    expect(rest.effects[0]).toMatchObject({ kind: 'foodChanged', reason: 'rest' })
  })

  it('consumeFood runs dry: consumed < count, the bag holds no food, and 0 food is a same-reference no-op', () => {
    const run = newRun()
    const total = bag.foodCount(run.bag, env)
    const dry = bag.consumeFood(run, total + 5, 'scout', env)
    expect(dry.consumed).toBe(total)
    expect(bag.foodCount(dry.state.bag, env)).toBe(0)
    const none = bag.consumeFood(dry.state, 1, 'hop', env)
    expect(none.state).toBe(dry.state)
    expect(none.consumed).toBe(0)
    expect(none.effects).toEqual([])
  })

  it('addFood with a negative delta is a real spend, clamped at 0 (§7.22: not a no-op)', () => {
    const run = newRun()
    const total = bag.foodCount(run.bag, env)
    const spent = bag.addFood(run, -1, 'quest', env)
    expect(bag.foodCount(spent.state.bag, env)).toBe(total - 1)
    expect(spent.effects).toEqual([{ kind: 'foodChanged', delta: -1, reason: 'quest' }])
    const clamped = bag.addFood(run, -(total + 10), 'event', env)
    expect(bag.foodCount(clamped.state.bag, env)).toBe(0)
    expect(clamped.effects).toEqual([{ kind: 'foodChanged', delta: -total, reason: 'event' }])
    expect(bag.addFood(run, 0, 'dev', env).state).toBe(run)
  })

  it('addFood tops up a partial ration before adding a new one', () => {
    const run = bag.consumeFood(newRun(), 1, 'hop', env).state
    const entries = run.bag.length
    const topped = bag.addFood(run, 1, 'quest', env)
    expect(topped.state.bag).toHaveLength(entries)
    expect(bag.foodCount(topped.state.bag, env)).toBe(bag.foodCount(run.bag, env) + 1)
    const more = bag.addFood(topped.state, rationCharges + 1, 'dev', env)
    expect(more.state.bag).toHaveLength(entries + 2)
    expect(more.effects).toEqual([{ kind: 'foodChanged', delta: rationCharges + 1, reason: 'dev' }])
  })

  it('addFood into a full bag overflows whole rations to pendingLoot instead of dropping them', () => {
    const run = fillBag(newRun())
    const before = bag.foodCount(run.bag, env)
    const r = bag.addFood(run, rationCharges, 'quest', env)
    expect(bag.foodCount(r.state.bag, env)).toBe(before)
    expect(r.state.pendingLoot).toEqual([ration.id])
    expect(r.effects).toEqual([{ kind: 'lootOverflow', itemIds: [ration.id] }])
  })
})

describe('bag — ownership', () => {
  it('ownedItemIds = bag ∪ every hand, deduplicated in first-seen order', () => {
    const run = newRun()
    const owned = bag.ownedItemIds(run)
    for (const e of run.bag) expect(owned).toContain(e.itemId)
    for (const u of Object.values(run.party)) {
      if (u.handLeft !== null) expect(owned).toContain(u.handLeft)
      if (u.handRight !== null) expect(owned).toContain(u.handRight)
    }
    expect(new Set(owned).size).toBe(owned.length)
    expect(owned.length).toBeLessThan(run.bag.length + Object.values(run.party).length * 2)
  })

  it('consumableIds lists potions only, one per bag entry', () => {
    const run = withBag(newRun(), bag.placeInBag([], [potion.id, ration.id, potion.id], env)!)
    expect(bag.consumableIds(run, env)).toEqual([potion.id, potion.id])
  })
})
