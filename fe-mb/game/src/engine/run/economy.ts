/**
 * run/economy.ts — prices, shop stock, inn, bounty (brief §2.6, §2.10, §2.13).
 * Every number is content (`Item.buyPrice`, `Item.sellPrice`, `TownDef.innHealCostPerUnit`) or
 * `rules.economy`; this module only combines them.
 */
import type { Legality } from '../actions'
import { createRng } from '../rng'
import { deriveState } from '../rngState'
import { rngLabels } from '../rules'
import type { BagEntry, EngineEnv, Item, ItemId, Prisoner, RegionTier, RunState, TownDef, UnitId } from '../types'
import { isGear, itemDef } from './bag'
import { livingUnits } from './party'

/** `undefined` buyPrice ⇒ null ⇒ unbuyable (never 0 by construction — brief §2.13 "a 0g giveaway is impossible"). */
export function buyPrice(item: Item): number | null {
  return item.buyPrice ?? null
}

/**
 * Buyable gear sells for `buyPrice × sellRatio` — ONE authored number per item (brief §8.13); the authored
 * `sellPrice` is load-bearing only for drop-only gear (epic/legendary), which has no buy price to derive from.
 * The content lint keeps the two in agreement for shipped items (tests assert it too).
 */
export function sellPrice(item: Item, env: EngineEnv): number {
  return item.buyPrice === undefined ? item.sellPrice : Math.floor(item.buyPrice * env.rules.economy.sellRatio)
}

/**
 * What the shop pays for ONE BAG ENTRY. `sellPrice` prices a WHOLE item, and a ration is a stack: a 1-of-3 ration
 * fetched the same coin as a full one while `town/sell`'s `foodChanged` correctly subtracted only the charge that
 * was left, so the purse and the larder disagreed about what had been sold. Prorated by remaining charges, never
 * below 1 — a single hop's food is still goods. Gear (`charges` absent ⇒ 1) is unaffected.
 * The shop quotes this and `run/town.ts#sell` pays it: one number, one owner.
 */
export function entrySellPrice(entry: Pick<BagEntry, 'itemId' | 'charges'>, env: EngineEnv): number {
  const item = itemDef(entry.itemId, env)
  const full = sellPrice(item, env)
  const stack = item.charges ?? 1
  if (stack <= 1 || entry.charges >= stack) return full
  return Math.max(1, Math.floor((full * entry.charges) / stack))
}

function regionTierOf(regionId: string, env: EngineEnv): RegionTier {
  const region = env.content.regions[regionId]
  if (region === undefined) throw new Error(`run/economy: unknown region '${regionId}'`)
  return region.tier
}

/**
 * Stock = `town.shopStockIds` ∪ region-'none' consumables (potions/food everywhere) ∪ same-region gear in the
 * tier's rarities — never epic/legendary, never an item without a buy price (a shop cannot list what it cannot
 * sell) — plus 1-2 ROTATING picks: other regions' gear inside the SAME rarity gate, drawn from
 * `deriveState(run.rng, rngLabels.shop(town, day))`. Derived on every call, never stored (§2.9 "variety by
 * content rotation"); the rarity gate holds for every listed item, only the region mixes. Registry order.
 */
export function shopStock(town: TownDef, run: RunState, env: EngineEnv): readonly Item[] {
  const allowed = env.rules.economy.shopRarityByRegionTier[regionTierOf(town.regionId, env)]
  const never = env.rules.economy.shopNeverSells
  const all = Object.values(env.content.items)
  const sellable = (i: Item): boolean => buyPrice(i) !== null && !never.includes(i.rarity)

  const stocked = new Set<ItemId>()
  for (const i of all) {
    if (!sellable(i)) continue
    if (town.shopStockIds.includes(i.id)) stocked.add(i.id)
    else if (i.region === 'none' && !isGear(i)) stocked.add(i.id)
    else if (i.region === town.regionId && allowed.includes(i.rarity)) stocked.add(i.id)
  }

  const rotatingPool = all.filter((i) => sellable(i) && !stocked.has(i.id) && isGear(i) && i.region !== 'none' && allowed.includes(i.rarity))
  const r = createRng(deriveState(run.rng, rngLabels.shop(town.id, run.daysElapsed)))
  const [lo, hi] = env.rules.economy.shopRotatingSlots
  const picks = Math.min(r.nextInt(lo, hi), rotatingPool.length)
  for (const i of r.shuffle(rotatingPool).slice(0, picks)) stocked.add(i.id)

  return all.filter((i) => stocked.has(i.id))
}

/** Wounded = living units below max HP; cost = wounded × the town's per-unit price (content only, CONTRACT-CHANGES 0017). */
export function innCost(town: TownDef, run: RunState, _env: EngineEnv): { readonly wounded: readonly UnitId[]; readonly total: number } {
  const wounded = livingUnits(run).filter((u) => u.hp.current < u.hp.max).map((u) => u.id)
  return { wounded, total: wounded.length * town.innHealCostPerUnit }
}

/** The inn's own refusal, in the innkeeper's words. Exported so the flow gate and the reducer speak one sentence. */
export const NOBODY_WOUNDED = 'nobody is wounded'

/**
 * The whole rule behind a bed: somebody has to be hurt, and the purse has to cover the bill. Read by BOTH
 * `flow/legality.ts` (§4's `town/innHeal` row) and `run/town.ts#innHeal`, so the disabled control, the CLI's menu
 * and the reducer's refusal are ONE sentence with ONE home — the `canEnterDungeon` / `campRestWouldMend` shape.
 * A night that mends nobody still takes the gold, so it is illegal rather than merely pointless.
 */
export function canInnHeal(town: TownDef, run: RunState, env: EngineEnv): Legality {
  const cost = innCost(town, run, env)
  if (cost.wounded.length === 0) return { ok: false, reason: NOBODY_WOUNDED }
  if (run.gold < cost.total) return { ok: false, reason: `the innkeeper wants ${cost.total} gold` }
  return { ok: true }
}

/** bountyValue ?? tier by level (20 / 40 / 60 — Godot game_manager.gd:555-563 verbatim, brief §2.6). */
export function bountyFor(p: Pick<Prisoner, 'bountyValue' | 'level'>, env: EngineEnv): number {
  if (p.bountyValue !== null && p.bountyValue > 0) return p.bountyValue
  const tier = env.rules.economy.bountyTiers.find((t) => p.level <= t.maxLevel)
  if (tier === undefined) throw new Error('run/economy: rules.economy.bountyTiers has no terminal tier')
  return tier.gold
}

/**
 * Signed; clamps at 0 (§7.22 "gold went negative"). Same reference when nothing changes.
 *
 * This is the ONE door gold enters a run through, so it is also the one owner of `stats.goldEarned` — the
 * `grantLoot`(gearFound) / `removeFallen`(unitsLost) shape. Every income counts here and NOWHERE else: a battle
 * purse, a bounty, quest gold, a check event, dungeon treasure, the empty-room fallback, a sale. Two callers used
 * to bump the counter by hand and the other six did not, so the ledger's "gold earned" was a number the player
 * could disprove by counting their own coins (272 taken in, 202 printed). What is COUNTED is what actually moved:
 * the clamp is applied first, and a negative delta — spending — never touches the counter.
 */
export function addGold(run: RunState, delta: number): RunState {
  const gold = Math.max(0, run.gold + delta)
  if (gold === run.gold) return run
  const earned = gold - run.gold
  if (earned < 0) return { ...run, gold }
  return { ...run, gold, stats: { ...run.stats, goldEarned: run.stats.goldEarned + earned } }
}
