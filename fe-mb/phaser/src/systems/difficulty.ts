import type { UnitStats } from '../domain/unit'
import regionsJson from '../data/content/regions.json'

/**
 * Difficulty scaling by map position (ship plan §12).
 *
 * There is NO party leveling — party power grows through GEAR. Enemy levels
 * therefore climb gently: region tier sets the band (Borderlands 1-2,
 * Thornwood 3-4, Ashfall 5-6), a deterministic per-node salt picks within it,
 * and `scaleEnemyForLevel` applies a gear-pace stat curve (+2 HP per level,
 * +1 str/def every 2 levels, +1 skl/spd/res every 3). Loot rarity keys off
 * the same level (systems/loot.ts), closing the risk→reward loop.
 */

const TIER_BY_REGION = new Map<string, number>(regionsJson.map(r => [r.id, r.tier]))

export function regionTierOf(regionOrMapId: string): 1 | 2 | 3 {
  const t = TIER_BY_REGION.get(regionOrMapId) ?? 1
  return (t < 1 ? 1 : t > 3 ? 3 : t) as 1 | 2 | 3
}

/** Deterministic tiny hash — same salt always lands the same level. */
function hashSalt(salt: string): number {
  let h = 2166136261
  for (let i = 0; i < salt.length; i++) {
    h = Math.imul(h ^ salt.charCodeAt(i), 16777619) >>> 0
  }
  return h
}

/** Enemy level band per region tier: 1→[1,2], 2→[3,4], 3→[5,6]. */
export function enemyLevelFor(regionOrMapId: string, salt: string): number {
  const tier = regionTierOf(regionOrMapId)
  const base = tier * 2 - 1
  return base + (hashSalt(salt) % 2)
}

export interface ScaledEnemy {
  stats: UnitStats
  hp: number
}

/** Gear-pace enemy growth curve (party has no levels — gear must keep up). */
export function scaleEnemyForLevel(base: UnitStats, baseHp: number, level: number): ScaledEnemy {
  const lvl = Math.max(1, level)
  const b = lvl - 1
  const every = (n: number, div: number): number => n + Math.floor(b / div)
  return {
    stats: {
      str: every(base.str, 2),
      mag: base.mag > 0 ? every(base.mag, 2) : base.mag,
      skl: every(base.skl, 3),
      spd: every(base.spd, 3),
      def: every(base.def, 2),
      res: every(base.res, 3),
      lck: base.lck,
    },
    hp: baseHp + b * 2,
  }
}
