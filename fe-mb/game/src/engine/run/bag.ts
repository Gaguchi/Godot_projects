/**
 * run/bag.ts — the spatial 8×4 bag, food charges, ownership (brief §2.7, §2.9, §7.22).
 *
 * Footprints come from `Item.gridSize`; placement is first-fit ROW-MAJOR (scan y, then x) with no
 * rotation — a 2×3 greatsword needs a contiguous 2×3 hole, six scattered cells will not do (§2.7
 * "implement the grid or drop the field"). `consumeFood` is the ONLY food-spend primitive (the hop
 * executor, camp Rest and Scout all call it) and it never touches day/hop counters (§7.22: "one
 * action per resource verb"). Every function returns a NEW array/object; inputs are never mutated.
 *
 * Bag entries are addressed by their TOP-LEFT cell (`entryAt(x, y)`); the UI derives the covered
 * cells from `footprint` when it needs a hit test.
 */
import type { SliceResult } from '../actions'
import type { Effect } from '../effects'
import type { BagEntry, EngineEnv, Item, ItemId, RunState } from '../types'

/** Content lookup that fails loudly (brief §7.20: an unknown content id is a programmer error, never a stub). */
export function itemDef(itemId: ItemId, env: EngineEnv): Item {
  const item = env.content.items[itemId]
  if (item === undefined) throw new Error(`run/bag: unknown item '${itemId}'`)
  return item
}

/**
 * Hand-slot gear = what a hand can hold (brief §2.7): weapon / shield / tome / staff / quiver. Food and
 * potions are bag-only. This is the ONE home of that kind list — `equipment.ts` (what is equippable) and
 * `loot.ts` (`rules.loot.handSlotOnly`) both read it here so the two can never disagree.
 */
const GEAR_KINDS: readonly Item['kind'][] = ['weapon', 'shield', 'tome', 'staff', 'quiver']

export function isGear(item: Item): boolean {
  return GEAR_KINDS.includes(item.kind)
}

export function footprint(item: Item): { readonly w: number; readonly h: number } {
  return { w: item.gridSize.width, h: item.gridSize.height }
}

/** Same `"x,y"` key format as `autotile.cellKey` / `TileKey`, so a bag cell and a board tile read alike. */
function cellKey(x: number, y: number): string {
  return `${x},${y}`
}

function entryCells(entry: BagEntry, env: EngineEnv): readonly string[] {
  const { w, h } = footprint(itemDef(entry.itemId, env))
  const out: string[] = []
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push(cellKey(entry.x + dx, entry.y + dy))
  return out
}

/** Occupied "x,y" cells. */
export function cells(bag: readonly BagEntry[], env: EngineEnv): ReadonlySet<string> {
  const out = new Set<string>()
  for (const e of bag) for (const c of entryCells(e, env)) out.add(c)
  return out
}

/** In bounds and no overlap with `taken`. */
function freeAt(taken: ReadonlySet<string>, item: Item, x: number, y: number, env: EngineEnv): boolean {
  const { w, h } = footprint(item)
  const { width, height } = env.rules.bag
  if (x < 0 || y < 0 || x + w > width || y + h > height) return false
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (taken.has(cellKey(x + dx, y + dy))) return false
  return true
}

/** `ignore` (matched by its top-left cell) is left out of the occupancy check — the entry being moved. */
export function fits(bag: readonly BagEntry[], item: Item, x: number, y: number, env: EngineEnv, ignore?: BagEntry): boolean {
  const others = ignore === undefined ? bag : bag.filter((e) => !(e.x === ignore.x && e.y === ignore.y))
  return freeAt(cells(others, env), item, x, y, env)
}

/** First fit, row-major, or null. */
export function findSlot(bag: readonly BagEntry[], itemId: ItemId, env: EngineEnv): { readonly x: number; readonly y: number } | null {
  const item = itemDef(itemId, env)
  const taken = cells(bag, env)
  const { width, height } = env.rules.bag
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (freeAt(taken, item, x, y, env)) return { x, y }
    }
  }
  return null
}

/** All-or-nothing placement (equip plans, loot, start kit). Charges from the item def (food) or 1. */
export function placeInBag(bag: readonly BagEntry[], itemIds: readonly ItemId[], env: EngineEnv): readonly BagEntry[] | null {
  let next = bag
  for (const itemId of itemIds) {
    const slot = findSlot(next, itemId, env)
    if (slot === null) return null
    next = [...next, { itemId, x: slot.x, y: slot.y, charges: itemDef(itemId, env).charges ?? 1 }]
  }
  return next
}

/** The entry whose TOP-LEFT cell is (x, y). */
export function entryAt(bag: readonly BagEntry[], x: number, y: number): BagEntry | null {
  return bag.find((e) => e.x === x && e.y === y) ?? null
}

/** Returns the SAME array when nothing sat at (x, y), so a caller can detect a no-op by identity. */
export function removeAt(bag: readonly BagEntry[], x: number, y: number): readonly BagEntry[] {
  const i = bag.findIndex((e) => e.x === x && e.y === y)
  return i < 0 ? bag : [...bag.slice(0, i), ...bag.slice(i + 1)]
}

/** First match by id in bag order (consumed potions, `applyBattleResult`). Same array when absent. */
export function removeFirst(bag: readonly BagEntry[], itemId: ItemId): readonly BagEntry[] {
  const i = bag.findIndex((e) => e.itemId === itemId)
  return i < 0 ? bag : [...bag.slice(0, i), ...bag.slice(i + 1)]
}

/** Re-anchor the entry at (fromX, fromY) to (x, y); null when nothing is there or it would overlap / leave the grid. */
export function moveEntry(bag: readonly BagEntry[], fromX: number, fromY: number, x: number, y: number, env: EngineEnv): readonly BagEntry[] | null {
  const entry = entryAt(bag, fromX, fromY)
  if (entry === null) return null
  if (!fits(bag, itemDef(entry.itemId, env), x, y, env, entry)) return null
  return bag.map((e) => (e === entry ? { ...e, x, y } : e))
}

/** Exported for the shop (`run/town.ts` reports `foodChanged` on a ration bought or sold). */
export function isFood(entry: BagEntry, env: EngineEnv): boolean {
  return itemDef(entry.itemId, env).kind === 'food'
}

/** Σ charges over food entries. Needs `env` because a last-charge ration and a potion both carry `charges: 1` (CONTRACT-CHANGES 0023). */
export function foodCount(bag: readonly BagEntry[], env: EngineEnv): number {
  return bag.reduce((sum, e) => (isFood(e, env) ? sum + e.charges : sum), 0)
}

/** Take up to `count` charges, first-match in bag order; a ration at 0 leaves the bag. */
function takeCharges(bag: readonly BagEntry[], count: number, env: EngineEnv): { readonly bag: readonly BagEntry[]; readonly taken: number } {
  let next = bag
  let taken = 0
  while (taken < count) {
    const i = next.findIndex((e) => isFood(e, env) && e.charges > 0)
    if (i < 0) break
    const e = next[i]!
    const left = e.charges - 1
    next = left > 0 ? next.map((b, j) => (j === i ? { ...b, charges: left } : b)) : [...next.slice(0, i), ...next.slice(i + 1)]
    taken++
  }
  return { bag: next, taken }
}

/** Decrements charges first-match, removes a ration at 0; `consumed` may be < count when the bag runs dry. */
export function consumeFood(run: RunState, count: number, reason: 'hop' | 'rest' | 'scout', env: EngineEnv): SliceResult<RunState> & { readonly consumed: number } {
  const { bag, taken } = takeCharges(run.bag, count, env)
  if (taken === 0) return { state: run, effects: [], consumed: 0 }
  return { state: { ...run, bag }, effects: [{ kind: 'foodChanged', delta: -taken, reason }], consumed: taken }
}

/**
 * The ration item: the one food def in content (the kit's `food_rations`). Looked up by KIND so no content id
 * is hard-coded in the engine; a second food item would need a rule to choose — throw rather than guess.
 */
function rationDef(env: EngineEnv): Item & { readonly charges: number } {
  const foods = Object.values(env.content.items).filter((i) => i.kind === 'food')
  const ration = foods[0]
  if (ration === undefined || foods.length > 1) throw new Error(`run/bag: expected exactly one food item, found ${foods.length}`)
  if (ration.charges === undefined) throw new Error(`run/bag: food '${ration.id}' has no charges`)
  return { ...ration, charges: ration.charges }
}

/**
 * Signed charges; clamps at 0 (§7.22: a negative delta is a real spend, never a no-op). Positive charges first
 * TOP UP partially used rations, then add rations of `item.charges` (+ a partial one). Rations that do not fit
 * go to `pendingLoot` as whole rations (`lootOverflow`) — a granted resource is never silently dropped (§2.13).
 * `foodChanged.delta` reports what actually landed in the bag.
 */
export function addFood(run: RunState, delta: number, reason: 'quest' | 'event' | 'dev' | 'shop', env: EngineEnv): SliceResult<RunState> {
  if (delta < 0) {
    const { bag, taken } = takeCharges(run.bag, -delta, env)
    if (taken === 0) return { state: run, effects: [] }
    return { state: { ...run, bag }, effects: [{ kind: 'foodChanged', delta: -taken, reason }] }
  }
  if (delta === 0) return { state: run, effects: [] }

  const ration = rationDef(env)
  let remaining = delta
  let added = 0
  let bag: readonly BagEntry[] = run.bag.map((e) => {
    if (remaining <= 0 || e.itemId !== ration.id || e.charges >= ration.charges) return e
    const top = Math.min(ration.charges - e.charges, remaining)
    remaining -= top
    added += top
    return { ...e, charges: e.charges + top }
  })
  const overflow: ItemId[] = []
  while (remaining > 0) {
    const chunk = Math.min(ration.charges, remaining)
    remaining -= chunk
    const slot = findSlot(bag, ration.id, env)
    if (slot === null) {
      overflow.push(ration.id)
      continue
    }
    bag = [...bag, { itemId: ration.id, x: slot.x, y: slot.y, charges: chunk }]
    added += chunk
  }
  const effects: Effect[] = []
  if (added > 0) effects.push({ kind: 'foodChanged', delta: added, reason })
  if (overflow.length > 0) effects.push({ kind: 'lootOverflow', itemIds: overflow })
  return {
    state: { ...run, bag, pendingLoot: overflow.length > 0 ? [...run.pendingLoot, ...overflow] : run.pendingLoot },
    effects,
  }
}

/** Bag + every hand, deduplicated in first-seen order (loot exclusion, `hasItem`). */
export function ownedItemIds(run: RunState): readonly ItemId[] {
  const seen = new Set<ItemId>()
  const out: ItemId[] = []
  const add = (id: ItemId | null): void => {
    if (id !== null && !seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  for (const e of run.bag) add(e.itemId)
  for (const u of Object.values(run.party)) {
    add(u.handLeft)
    add(u.handRight)
  }
  return out
}

/** Potion ids in the bag, one per drinkable — `BattleSpec.consumables`. */
export function consumableIds(run: RunState, env: EngineEnv): readonly ItemId[] {
  return run.bag.filter((e) => itemDef(e.itemId, env).kind === 'potion').map((e) => e.itemId)
}
