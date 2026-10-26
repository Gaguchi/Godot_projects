/**
 * GATE3-15 / GATE3-17. `npm run cli -- balance` was green — stub 69%, boss 43%, zero stalemates — while the actual
 * game killed by attrition: a dungeon descent cleared 0 of 24 seeds and a full road leg 3 of 24, because BOTH gate
 * scenarios seed a fresh, full-HP party and neither carries damage, food or gold from one fight to the next.
 *
 * These are the unit-suite half of the attrition gate. The CLI's `balance` command asserts the shipped BANDS over
 * `rules.balance.attrition.seeds` paths (minutes of work); what is pinned here is cheaper and structural — that a
 * path really is driven end to end through the reducer, that HP is carried between rooms, and that the supply
 * economy is solvent — so `npm run verify` reddens if the machinery rots even when nobody runs the gate.
 */
import { describe, expect, it } from 'vitest'
import { attritionDungeon, attritionRoad } from '../../../scripts/cli'
import { createEnv } from '../../../src/engine/content'
import { foodCount } from '../../../src/engine/run/bag'
import { seedNewRun } from '../../../src/engine/run/newRun'

const env = createEnv()
const A = env.rules.balance.attrition
const SEEDS = [A.firstSeed, A.firstSeed + 1, A.firstSeed + 2]

describe('attrition — a dungeon descent', () => {
  it('drives room to room and ends in a terminal outcome', () => {
    for (const seed of SEEDS) {
      const r = attritionDungeon('smugglers_cave', seed, env)
      expect(['cleared', 'wiped'], `seed ${seed}`).toContain(r.outcome)
      expect(r.steps, `seed ${seed}`).toBeGreaterThan(0)
      expect(r.fights, `seed ${seed}`).toBeGreaterThan(0)
    }
  }, 120_000)

  /** The thing the battle sweeps cannot see: room 2 is entered on whatever room 1 left. */
  it('carries damage from one room into the next', () => {
    const runs = SEEDS.map((seed) => attritionDungeon('smugglers_cave', seed, env))
    expect(runs.some((r) => r.lowWaterHpFraction < 1)).toBe(true)
    for (const r of runs) if (r.outcome === 'cleared') expect(r.lowWaterHpFraction).toBeLessThan(1)
  }, 120_000)

  /** A descent is committed (`run/dungeon.ts#leaveDungeon` is legal only at the entrance or after the boss), so a
   *  route with no reachable rest is a death sentence — the shipped 5-in-90 weighting put every rest in the row
   *  before the boss (`dungeonGraph.test.ts` measures the graph; this measures the outcome). */
  it('is survivable: at least one of three seeds reaches the boss alive', () => {
    const cleared = SEEDS.filter((seed) => attritionDungeon('smugglers_cave', seed, env).outcome === 'cleared')
    expect(cleared.length).toBeGreaterThan(0)
  }, 120_000)
})

describe('attrition — a road leg', () => {
  it('walks the sheet toward the throne, fighting what the road rolls', () => {
    const r = attritionRoad('the_iron_throne', A.firstSeed + 2, env)
    expect(['cleared', 'wiped']).toContain(r.outcome)
    expect(r.steps).toBeGreaterThan(3)
  }, 180_000)

  /** GATE3-17: the auto-drive ran the larder dry on day 7 and starved to the wipe with 70 gold unspent. */
  it('does not starve a party that buys rations at the towns it passes', () => {
    const runs = SEEDS.map((seed) => attritionRoad('the_iron_throne', seed, env))
    expect(runs.reduce((n, r) => n + r.starvingSteps, 0)).toBeLessThanOrEqual(A.maxStarvingSteps)
  }, 240_000)
})

describe('supply economy', () => {
  const ration = env.content.items['food_rations']!
  const perHop = Math.ceil((ration.buyPrice ?? 0) / (ration.charges ?? 1))

  it('starts the company with more road than a low-supply warning', () => {
    const run = seedNewRun(1, env)
    expect(foodCount(run.bag, env)).toBeGreaterThan(env.rules.travel.lowFoodWarnAt + 3)
  })

  /**
   * The relationship the shipped numbers got wrong: 50 gold for 3 charges is ~17 gold a hop against a fight that
   * paid ~45, so two thirds of every purse went to bread and the party met the last region in the iron it started
   * in. A won fight has to buy several hops of road or the economy has only one sink.
   */
  it('pays for several hops of road per won fight', () => {
    const { base, perLevel } = env.rules.economy.killGold
    const pack = 3 // the smallest shipped enemy group
    const purse = pack * (base + perLevel)
    expect(purse / perHop).toBeGreaterThanOrEqual(3)
  })

  it('quotes the ration at a price the starting purse can restock from', () => {
    expect(ration.buyPrice).toBeLessThanOrEqual(env.rules.economy.startGold / 2)
    expect(ration.sellPrice).toBe(Math.floor((ration.buyPrice ?? 0) / 2))
  })
})
