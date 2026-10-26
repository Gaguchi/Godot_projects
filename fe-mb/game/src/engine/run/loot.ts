/**
 * run/loot.ts — loot by SOURCE (brief §2.13). Ported shape of `rollBattleLoot`: pure, RNG-param,
 * weighted rows, fall DOWN on an emptied tier, hand-slot gear only, owned ids excluded, region filter
 * for travel/quest/dungeon-combat rows; the caller derives the stream with
 * `deriveState(run.rng, rngLabels.loot(battleId))` (or `rngLabels.treasure`).
 *
 * The row is chosen by (battleTag × regionTier), NOT by the strongest enemy's level: a tier-3 dungeon boss
 * drops epic/legendary whatever its members are, and travel never drops epic (§2.13 "§5 wins over §11").
 */
import type { SliceResult } from '../actions'
import type { Effect } from '../effects'
import { createRng } from '../rng'
import { rngState } from '../rngState'
import type { LootRow, RarityWeights } from '../rules'
import type { BattleTag, EngineEnv, Item, ItemId, Rarity, RegionTier, RngState, RunState } from '../types'
import { isGear, itemDef, ownedItemIds, placeInBag } from './bag'

export function lootRowFor(tag: BattleTag | 'dungeonTreasure', tier: RegionTier, env: EngineEnv): LootRow {
  return tag === 'dungeonTreasure' ? env.rules.loot.dungeonTreasure : env.rules.loot.rows[tag][tier]
}

/** The region of the node the company stands on — inside a dungeon that is the dungeon's node (node id = dungeon id). */
function currentRegionId(run: RunState, env: EngineEnv): string {
  const node = env.content.overworld.nodes.find((n) => n.id === run.nodeId)
  if (node === undefined) throw new Error(`run/loot: run stands on unknown node '${run.nodeId}'`)
  return node.regionId
}

/** Hand-slot gear; region filter per `rules.loot.regionFilteredTags` (`item.region === current || 'none'`); minus `ownedItemIds(run)`. */
export function lootPool(run: RunState, tag: BattleTag | 'dungeonTreasure', env: EngineEnv): readonly Item[] {
  const { handSlotOnly, regionFilteredTags, excludeOwned } = env.rules.loot
  const region = tag !== 'dungeonTreasure' && regionFilteredTags.includes(tag) ? currentRegionId(run, env) : null
  // bag + hands + drops still parked in pendingLoot: a guaranteed epic waiting for a bag slot must not roll twice
  const owned = new Set<ItemId>(excludeOwned ? [...ownedItemIds(run), ...run.pendingLoot] : [])
  return Object.values(env.content.items).filter(
    (i) => (!handSlotOnly || isGear(i)) && (region === null || i.region === region || i.region === 'none') && !owned.has(i.id),
  )
}

/** Weighted pick over the tiers with weight > 0 (a 0 tier is never rolled); null when every weight is 0. */
function pickRarity(weights: RarityWeights, roll: number): Rarity | null {
  const entries = (Object.keys(weights) as Rarity[]).map((r) => [r, weights[r]] as const).filter(([, w]) => w > 0)
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  if (total <= 0) return null
  const point = roll * total
  let acc = 0
  for (const [rarity, w] of entries) {
    acc += w
    if (point < acc) return rarity
  }
  return entries[entries.length - 1]![0]
}

/**
 * Chance gate → weighted rarity → fall DOWN (`rules.loot.fallDown`, CONTRACT-CHANGES 0024) while the tier's pool
 * is empty → exactly one item (or none). The gate always consumes one draw, even at chance 0 or 1, so the stream
 * position after a roll depends only on the row's shape — a replay never desynchronises on a tutorial battle.
 */
export function rollLoot(row: LootRow, pool: readonly Item[], rng: RngState, env: EngineEnv): { readonly itemIds: readonly ItemId[]; readonly rng: RngState } {
  const r = createRng(rng)
  if (r.next() >= row.chance) return { itemIds: [], rng: rngState(r) }
  let rarity = pickRarity(row.weights, r.next())
  while (rarity !== null) {
    const candidates = pool.filter((i) => i.rarity === rarity)
    if (candidates.length > 0) return { itemIds: [r.pick(candidates).id], rng: rngState(r) }
    rarity = env.rules.loot.fallDown[rarity]
  }
  return { itemIds: [], rng: rngState(r) }
}

/**
 * Places what fits (first-fit); the rest goes to `pendingLoot` (`lootOverflow`) — never silently dropped, and
 * `battleEnd/dismiss` stays refused until the player takes or forfeits it (§2.13). `itemAcquired` fires only for
 * what entered the bag (`run/takeLoot` fires it later for a pickup). `stats.gearFound` counts every hand-slot
 * item that entered play (placed or waiting) — this is the ONE door gear enters a run through, so the counter has
 * exactly one owner.
 */
export function grantLoot(run: RunState, itemIds: readonly ItemId[], source: 'loot' | 'treasure' | 'quest' | 'trophy', env: EngineEnv): SliceResult<RunState> & { readonly placed: readonly ItemId[]; readonly overflow: readonly ItemId[] } {
  if (itemIds.length === 0) return { state: run, effects: [], placed: [], overflow: [] }
  let bag = run.bag
  const placed: ItemId[] = []
  const overflow: ItemId[] = []
  const effects: Effect[] = []
  let gear = 0
  for (const itemId of itemIds) {
    const item = itemDef(itemId, env)
    if (isGear(item)) gear++
    const next = placeInBag(bag, [itemId], env)
    if (next === null) {
      overflow.push(itemId)
      continue
    }
    bag = next
    placed.push(itemId)
    effects.push({ kind: 'itemAcquired', itemId, rarity: item.rarity, source })
  }
  if (overflow.length > 0) effects.push({ kind: 'lootOverflow', itemIds: overflow })
  return {
    state: {
      ...run,
      bag,
      pendingLoot: overflow.length > 0 ? [...run.pendingLoot, ...overflow] : run.pendingLoot,
      stats: gear > 0 ? { ...run.stats, gearFound: run.stats.gearFound + gear } : run.stats,
    },
    effects,
    placed,
    overflow,
  }
}
