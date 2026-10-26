/**
 * run/difficulty.ts — difficulty by map position, not party level (brief §2.13; DECISIONS tier rule).
 * There is no XP and no level-up: the AREA sets the enemy level band and a deterministic per-node salt
 * picks inside it, so the same road is the same fight on every replay and in every save.
 */
import { fnv1a } from '../content'
import type { DungeonDef, EngineEnv, NodeId, RegionTier, UnitStats } from '../types'

/** The node's authored `areaTier` (content); `rules.travel.tierByDistance` is only the authoring default. */
export function areaTier(nodeId: NodeId, env: EngineEnv): RegionTier {
  const node = env.content.overworld.nodes.find((n) => n.id === nodeId)
  if (node === undefined) throw new Error(`run/difficulty: unknown overworld node '${nodeId}'`)
  return node.areaTier
}

/** `regions[def.regionId].tier` — enemies and loot rows inside a dungeon use it. */
export function dungeonTier(def: DungeonDef, env: EngineEnv): RegionTier {
  const region = env.content.regions[def.regionId]
  if (region === undefined) throw new Error(`run/difficulty: dungeon '${def.id}' names unknown region '${def.regionId}'`)
  return region.tier
}

/**
 * level = band[0] + (fnv1a(salt) % saltMod); salt = node id (travel) or `<dungeon>:<room>`. Clamped to band[1]
 * so the band stays an invariant even if `saltMod` is ever widened past the band (the formula alone would leak).
 */
export function enemyLevelFor(tier: RegionTier, salt: string, env: EngineEnv): number {
  const [lo, hi] = env.rules.difficulty.levelBand[tier]
  return Math.min(hi, lo + (fnv1a(salt) % env.rules.difficulty.saltMod))
}

/** hp = round(startingHp × enemyHpMultiplier) + hpPerLevel·(L−1); str/def (+mag if > 0) += floor((L−1)/strDefMagEvery); skl/spd/res += floor((L−1)/sklSpdResEvery); lck flat.
 *  Ported verbatim from `phaser/src/systems/difficulty.ts#scaleEnemyForLevel` with the divisors read from rules. */
export function scaleEnemy(base: UnitStats, baseHp: number, level: number, env: EngineEnv): { readonly stats: UnitStats; readonly hp: number } {
  const { enemyHpMultiplier, hpPerLevel, strDefMagEvery, sklSpdResEvery } = env.rules.difficulty.enemyScaling
  const above = Math.max(0, level - 1)
  const every = (n: number, div: number): number => n + Math.floor(above / div)
  return {
    stats: {
      str: every(base.str, strDefMagEvery),
      // A 0 MAG chassis (bandit, wolf) never grows magic — the scale keeps physical and magical identities apart.
      mag: base.mag > 0 ? every(base.mag, strDefMagEvery) : base.mag,
      skl: every(base.skl, sklSpdResEvery),
      spd: every(base.spd, sklSpdResEvery),
      def: every(base.def, strDefMagEvery),
      res: every(base.res, sklSpdResEvery),
      lck: base.lck,
    },
    hp: Math.round(baseHp * enemyHpMultiplier) + above * hpPerLevel,
  }
}
