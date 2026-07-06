import type { ItemId } from '../domain/ids'
import type { Item } from '../domain/item'
import { isHandSlotItem } from '../domain/item'

/**
 * Pure hand-slot equipment rules (ship plan 2026-03-29 §3).
 *
 * - Any 1H gear item (weapon/shield/quiver/tome/staff) can go in either slot.
 * - A two-handed weapon always sits in handLeft and locks handRight.
 * - Equipping over an occupied slot swaps: the old item returns to the bag.
 * - Every displaced item must fit back into the bag or the plan is rejected
 *   (actions are atomic — no partial equips).
 *
 * Bag model mirrors runStore: flat list of single-cell placements on an 8×4
 * grid (gridSize is cosmetic for now, matching buyItem's placement rule).
 */

export const BAG_WIDTH = 8
export const BAG_HEIGHT = 4
export const BAG_CAPACITY = BAG_WIDTH * BAG_HEIGHT

export type HandSlot = 'left' | 'right'

export interface HandSlots {
  handLeft?: ItemId | null
  handRight?: ItemId | null
}

export interface BagEntry {
  itemId: ItemId
  gridX: number
  gridY: number
}

export type ItemLookup = (id: ItemId) => Item | undefined

export type EquipPlan =
  | { ok: true; handLeft: ItemId | null; handRight: ItemId | null; bag: BagEntry[] }
  | { ok: false; reason: string }

function firstFreeCell(bag: BagEntry[]): { x: number; y: number } | null {
  const occupied = new Set(bag.map(b => `${b.gridX},${b.gridY}`))
  for (let y = 0; y < BAG_HEIGHT; y++) {
    for (let x = 0; x < BAG_WIDTH; x++) {
      if (!occupied.has(`${x},${y}`)) return { x, y }
    }
  }
  return null
}

/** Append items to the bag at the first free cells; null if they don't all fit. */
function returnToBag(bag: BagEntry[], ids: ItemId[]): BagEntry[] | null {
  let next = bag.slice()
  for (const id of ids) {
    const cell = firstFreeCell(next)
    if (!cell) return null
    next = [...next, { itemId: id, gridX: cell.x, gridY: cell.y }]
  }
  return next
}

export function planEquip(
  hands: HandSlots,
  slot: HandSlot,
  itemId: ItemId,
  bag: readonly BagEntry[],
  lookup: ItemLookup,
): EquipPlan {
  const item = lookup(itemId)
  if (!item) return { ok: false, reason: `unknown item ${itemId as unknown as string}` }
  if (!isHandSlotItem(item)) return { ok: false, reason: `${item.name} is not equippable` }

  const bagIdx = bag.findIndex(b => b.itemId === itemId)
  if (bagIdx === -1) return { ok: false, reason: `${item.name} is not in the bag` }

  const left = hands.handLeft ?? null
  const right = hands.handRight ?? null
  const leftItem = left ? lookup(left) : undefined
  const leftIs2H = leftItem?.twoHanded === true

  // Item leaves the bag first.
  const bagWithout = [...bag.slice(0, bagIdx), ...bag.slice(bagIdx + 1)]

  if (item.twoHanded === true) {
    // 2H always occupies LEFT and clears both hands.
    const displaced = [left, right].filter((x): x is ItemId => x !== null)
    const nextBag = returnToBag(bagWithout, displaced)
    if (!nextBag) return { ok: false, reason: 'bag is full — cannot return displaced gear' }
    return { ok: true, handLeft: itemId, handRight: null, bag: nextBag }
  }

  if (slot === 'right' && leftIs2H) {
    return { ok: false, reason: 'off-hand is locked by a two-handed weapon' }
  }

  const displaced = slot === 'left' ? left : right
  // Replacing a 2H in LEFT unlocks the right slot (which was empty by invariant).
  const nextBag = returnToBag(bagWithout, displaced ? [displaced] : [])
  if (!nextBag) return { ok: false, reason: 'bag is full — cannot return displaced gear' }
  return {
    ok: true,
    handLeft: slot === 'left' ? itemId : left,
    handRight: slot === 'right' ? itemId : right,
    bag: nextBag,
  }
}

export function planUnequip(
  hands: HandSlots,
  slot: HandSlot,
  bag: readonly BagEntry[],
  lookup: ItemLookup,
): EquipPlan {
  const current = (slot === 'left' ? hands.handLeft : hands.handRight) ?? null
  if (!current) return { ok: false, reason: 'slot is already empty' }
  const item = lookup(current)
  const nextBag = returnToBag(bag.slice(), [current])
  if (!nextBag) return { ok: false, reason: `bag is full — cannot unequip ${item?.name ?? 'item'}` }
  return {
    ok: true,
    handLeft: slot === 'left' ? null : (hands.handLeft ?? null),
    handRight: slot === 'right' ? null : (hands.handRight ?? null),
    bag: nextBag,
  }
}
