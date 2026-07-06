import type { RNG } from '../domain/rng'
import type { Item, Rarity } from '../domain/item'
import type { ItemId } from '../domain/ids'
import { isHandSlotItem } from '../domain/item'

/**
 * Battle loot drops (ship plan §11). On victory there is a LOOT_DROP_CHANCE
 * of finding exactly one gear item; rarity is weighted by the strongest
 * defeated enemy's level:
 *
 *   level 1-2 → 80% common, 20% uncommon
 *   level 3-4 → 50% common, 40% uncommon, 10% rare
 *   level 5+  → 30% uncommon, 50% rare, 20% epic
 *
 * Deterministic given the RNG. If the pool has no item of the rolled rarity,
 * the roll falls through to the next lower tier (then drops nothing).
 */
export const LOOT_DROP_CHANCE = 0.4

type RarityWeight = Array<[Rarity, number]>

function rarityTable(maxEnemyLevel: number): RarityWeight {
  if (maxEnemyLevel <= 2) return [['common', 80], ['uncommon', 20]]
  if (maxEnemyLevel <= 4) return [['common', 50], ['uncommon', 40], ['rare', 10]]
  return [['uncommon', 30], ['rare', 50], ['epic', 20]]
}

const RARITY_FALLBACK: Record<Rarity, Rarity | null> = {
  legendary: 'epic',
  epic: 'rare',
  rare: 'uncommon',
  uncommon: 'common',
  common: null,
}

function pickRarity(table: RarityWeight, roll: number): Rarity {
  const total = table.reduce((sum, [, w]) => sum + w, 0)
  let acc = 0
  const point = roll * total
  for (const [rarity, w] of table) {
    acc += w
    if (point < acc) return rarity
  }
  return table[table.length - 1]![0]
}

export function rollBattleLoot(
  maxEnemyLevel: number,
  rng: RNG,
  pool: readonly Item[],
): ItemId[] {
  if (rng.next() >= LOOT_DROP_CHANCE) return []
  let rarity: Rarity | null = pickRarity(rarityTable(maxEnemyLevel), rng.next())
  const gear = pool.filter(isHandSlotItem)
  while (rarity !== null) {
    const candidates = gear.filter(i => i.rarity === rarity)
    if (candidates.length > 0) return [rng.pick(candidates).id]
    rarity = RARITY_FALLBACK[rarity]
  }
  return []
}
