/**
 * run/difficulty.ts acceptance (brief §2.13 "difficulty by map position, not party level"; DECISIONS tier rule).
 */
import { describe, expect, it } from 'vitest'
import { content } from '../../../../src/content/index'
import { createEnv, tierForDistance } from '../../../../src/engine/content'
import { areaTier, dungeonTier, enemyLevelFor, scaleEnemy } from '../../../../src/engine/run/difficulty'
import type { RegionTier, UnitStats } from '../../../../src/engine/types'
import { env } from '../../../helpers/runs'

describe('area tier', () => {
  it('areaTier reads the authored tier of every node (never recomputed) and throws on an unknown id', () => {
    for (const node of env.content.overworld.nodes) expect(areaTier(node.id, env)).toBe(node.areaTier)
    expect(() => areaTier('no_such_node', env)).toThrow(/unknown overworld node/)
  })

  it('every authored tier matches the band rules.travel.tierByDistance gives its hop distance, and createEnv refuses one that does not', () => {
    // The knob's ONE reader (CONTRACT-CHANGES 0032): without this gate `tierByDistance` was declared-never-called
    // and an authored tier could drift from the map silently.
    for (const node of env.content.overworld.nodes) {
      const hops = env.content.nodeDistance[node.id]
      if (hops === undefined) continue
      expect(node.areaTier).toBe(tierForDistance(hops, env.rules))
    }
    const near = content.overworld.nodes.find((n) => (createEnv().content.nodeDistance[n.id] ?? 99) <= 2)!
    const wrong = { ...content, overworld: { ...content.overworld, nodes: content.overworld.nodes.map((n) => (n.id === near.id ? { ...n, areaTier: 3 as RegionTier } : n)) } }
    expect(() => createEnv(wrong)).toThrow(/authored areaTier 3/)
  })

  it("dungeonTier is the dungeon's region tier", () => {
    for (const d of Object.values(env.content.dungeons)) expect(dungeonTier(d, env)).toBe(env.content.regions[d.regionId]!.tier)
  })
})

describe('enemyLevelFor', () => {
  const tiers: readonly RegionTier[] = [1, 2, 3]

  it('stays inside the tier band and is deterministic per salt', () => {
    for (const tier of tiers) {
      const [lo, hi] = env.rules.difficulty.levelBand[tier]
      for (const node of env.content.overworld.nodes) {
        const level = enemyLevelFor(tier, node.id, env)
        expect(level).toBeGreaterThanOrEqual(lo)
        expect(level).toBeLessThanOrEqual(hi)
        expect(enemyLevelFor(tier, node.id, env)).toBe(level)
      }
    }
  })

  it('the salt spreads levels across the band (both ends occur) and dungeon rooms salt as <dungeon>:<room>', () => {
    for (const tier of tiers) {
      const [lo, hi] = env.rules.difficulty.levelBand[tier]
      const seen = new Set<number>()
      for (const node of env.content.overworld.nodes) seen.add(enemyLevelFor(tier, node.id, env))
      for (const d of Object.values(env.content.dungeons)) for (const room of ['r0c0', 'r1c2', 'r5c0']) seen.add(enemyLevelFor(tier, `${d.id}:${room}`, env))
      expect(seen.has(lo)).toBe(true)
      expect(seen.has(hi)).toBe(true)
    }
  })

  it('tiers are ordered: every tier-3 level beats every tier-1 level', () => {
    const [, hi1] = env.rules.difficulty.levelBand[1]
    const [lo3] = env.rules.difficulty.levelBand[3]
    expect(lo3).toBeGreaterThan(hi1)
  })
})

describe('scaleEnemy', () => {
  const base: UnitStats = { str: 5, mag: 0, skl: 3, spd: 4, def: 2, res: 1, lck: 2 }
  const caster: UnitStats = { ...base, mag: 7 }

  it('level 1 is the identity on stats; hp is the pool times the enemy multiplier', () => {
    const pool = Math.round(18 * env.rules.difficulty.enemyScaling.enemyHpMultiplier)
    expect(scaleEnemy(base, 18, 1, env)).toEqual({ stats: base, hp: pool })
    expect(scaleEnemy(base, 18, 0, env)).toEqual({ stats: base, hp: pool })
  })

  it('hp += hpPerLevel·(L−1); str/def (+mag if > 0) every strDefMagEvery; skl/spd/res every sklSpdResEvery; lck flat', () => {
    const { enemyHpMultiplier, hpPerLevel, strDefMagEvery, sklSpdResEvery } = env.rules.difficulty.enemyScaling
    for (const level of [2, 3, 4, 5, 6, 7]) {
      const above = level - 1
      const a = Math.floor(above / strDefMagEvery)
      const b = Math.floor(above / sklSpdResEvery)
      expect(scaleEnemy(base, 18, level, env)).toEqual({
        stats: { str: base.str + a, mag: 0, skl: base.skl + b, spd: base.spd + b, def: base.def + a, res: base.res + b, lck: base.lck },
        hp: Math.round(18 * enemyHpMultiplier) + above * hpPerLevel,
      })
      expect(scaleEnemy(caster, 15, level, env).stats.mag).toBe(caster.mag + a)
    }
  })

  it('never mutates its input', () => {
    const copy = { ...base }
    scaleEnemy(base, 18, 7, env)
    expect(base).toEqual(copy)
  })
})
