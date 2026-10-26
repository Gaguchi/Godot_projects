/**
 * Brief §2.13 balance targets / §7.2: the sweep asserts the HARD invariants (every battle terminates, zero
 * stalemates, first blood happens, same seed → same outcome) and REPORTS the win rates; the win-rate bands are the
 * `balance` CLI gate's business, so tuning can move numbers without reddening the engine suite.
 *
 * The ROUND band is asserted here as well as in the gate (0048): `npm run verify` was green for the whole of the
 * regression that made every stub battle a 2-round coin flip, because nothing the unit suite ran looked at
 * `rules.balance.turns` at all. A field that collapses to instant kills now reddens the engine suite too.
 */
import { describe, expect, it } from 'vitest'
import { RoundCapError, carefulPolicy, greedyPolicy, sweep } from '../../../src/engine/combat/sim'
import { createEnv } from '../../../src/engine/content'
import { battleSpecFor } from '../../../src/engine/run/battle'
import { seedNewRun } from '../../../src/engine/run/newRun'
import { at, authored, env, mc, oak, spec, unitFromClass } from '../../helpers/battles'

const e = env()
const SEEDS = e.rules.balance.simSeeds

function starters() {
  return [mc(), oak(), unitFromClass('lilina', 'mage', 'party', { handLeft: 'fire_tome' })]
}

describe('balance sweep — hard invariants', () => {
  it(`${SEEDS} seeds × starters vs bandits_small: terminates, 0 stalemates, blood is drawn, replays`, () => {
    const specs = Array.from({ length: SEEDS }, (_, i) => ({ label: 'starters-vs-bandits', spec: spec({ party: starters(), enemies: { kind: 'group', enemyGroupId: 'bandits_small', level: 1 }, seed: 100 + i }) }))
    const rows = sweep(specs, e, greedyPolicy)
    const row = rows[0]!
    expect(row.runs).toBe(SEEDS)
    expect(row.stalemates).toBe(0)
    expect(row.meanRounds).not.toBeNull()
    expect(row.meanRounds!).toBeLessThanOrEqual(e.rules.combat.roundCap)
    expect(row.bloodlessRuns).toBe(0)
    expect(row.meanFirstBloodRound).not.toBeNull()
    expect(row.meanFirstBloodRound!).toBeLessThanOrEqual(e.rules.balance.firstBloodByRound + 1)
    // eslint-disable-next-line no-console
    console.log(`[balance] starters vs bandits_small: win ${(row.winRate * 100).toFixed(0)}% over ${row.runs} seeds, mean ${row.meanRounds!.toFixed(1)} rounds (${row.minRounds}-${row.maxRounds}), first blood round ${row.meanFirstBloodRound?.toFixed(1)} (target win ${e.rules.balance.startersVsStubWin.map((x) => x * 100).join('-')}%)`)
    const again = sweep(specs.slice(0, 3), e, greedyPolicy)[0]!
    expect(again.winRate).toBe(sweep(specs.slice(0, 3), e, greedyPolicy)[0]!.winRate)
  })

  it('a tier-3 group at level 5 still resolves without a round cap', () => {
    const specs = Array.from({ length: 5 }, (_, i) => ({ label: 'starters-vs-ashfall', spec: spec({ party: starters(), enemies: { kind: 'group', enemyGroupId: 'ashfall_raiders', level: 5 }, seed: 300 + i, regionTier: 3 }) }))
    const row = sweep(specs, e, greedyPolicy)[0]!
    expect(row.stalemates).toBe(0)
    expect(row.runs).toBe(5)
  })
})

/**
 * The band the CI gate reads, measured on the SHIPPED rules and the SHIPPED party — the one thing the engine suite
 * could not see before (0048). `tests/helpers/battles.ts#env` pins `enemyHpMultiplier` to 1 and `unitFromClass`
 * reads `startingHp` raw, so every sweep above runs a field with a fifth of the shipped threat and a third of the
 * shipped party pool: `npm run verify` stayed green through the whole regression that turned every stub battle
 * into a 2-round coin flip. These specs are the gate's own `stub` scenario, built through the real run builders.
 */
describe('balance sweep — the SHIPPED field is a fight, not a coin flip', () => {
  const shipped = createEnv()
  const b = shipped.rules.balance
  const stub = (seed: number) => ({
    label: 'stub',
    spec: battleSpecFor(seedNewRun(seed, shipped), { origin: { kind: 'sim' }, enemies: { kind: 'group', enemyGroupId: 'bandits_small', level: 1 }, captureTargets: [] }, shipped),
  })

  it(`${b.simSeeds} shipped stub battles average ${b.turns[0]}-${b.turns[1]} rounds and none runs past the ceiling`, () => {
    const row = sweep(Array.from({ length: b.simSeeds }, (_, i) => stub(2000 + i)), shipped, carefulPolicy)[0]!
    expect(row.runs).toBe(b.simSeeds)
    expect(row.stalemates).toBe(0)
    expect(row.meanRounds).not.toBeNull()
    // BRIEF §10 states the target as an average; the ceiling is asserted per battle beside it
    expect(row.meanRounds!).toBeGreaterThanOrEqual(b.turns[0])
    expect(row.meanRounds!).toBeLessThanOrEqual(b.turns[1])
    expect(row.maxRounds!).toBeLessThanOrEqual(b.roundsCeiling)
    // and every battle draws blood — a mean over the battles that did cannot see one that never does
    expect(row.bloodlessRuns).toBe(0)
    expect(row.worstFirstBloodRound!).toBeLessThanOrEqual(b.firstBloodByRound)
  }, 120_000)

  /** BAL-02: the field the gate measured was 13 wins and 7 defeats decided in round 2, every defeat the MC alone
   *  dying with two companions untouched. Both HP levers exist so that neither side is a two-phase pool. */
  it('neither side dies inside two enemy phases: both HP levers are above 1', () => {
    expect(shipped.rules.party.hpMultiplier).toBeGreaterThan(1)
    expect(shipped.rules.difficulty.enemyScaling.enemyHpMultiplier).toBeGreaterThan(1)
  })
})

/** §7.2: a stuck field is an engine smoke alarm. `sweep` may only turn one into a counter when asked, and even
 *  then the per-round dump rides on the row — never a tidy STALEMATE statistic with the evidence dropped. */
describe('balance sweep — a round cap is evidence, not a statistic', () => {
  // a full wall down column 4: manhattan 3 satisfies the seeder's turn-1 engagement rule, but no path exists either
  // way, and a melee-only company has nothing that reaches over it (there is no LOS in this engine, so the mage is
  // deliberately left at home — she would simply shoot the bandit through the wall)
  const wall = Array.from({ length: e.rules.combat.grid.height }, (_, y) => at(4, y))
  const walled = { label: 'walled', spec: spec({ party: [mc(), oak()], enemies: { kind: 'authored', units: [authored('b', 'bandit', 5, 4)] }, grid: { obstacles: wall }, seed: 1 }) }

  it('sweeps re-throw the RoundCapError by default, dump attached', () => {
    let thrown: unknown = null
    try {
      sweep([walled], e, greedyPolicy)
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(RoundCapError)
    expect((thrown as RoundCapError).dump.length).toBeGreaterThanOrEqual(e.rules.combat.roundCap)
  })

  it('an opted-in sweep counts the stalemate AND keeps the first error on the row', () => {
    const row = sweep([walled, walled], e, greedyPolicy, { tolerateRoundCap: true })[0]!
    expect(row.runs).toBe(2)
    expect(row.stalemates).toBe(2)
    expect(row.firstStalemate).toBeInstanceOf(RoundCapError)
    expect(row.firstStalemate!.dump.length).toBeGreaterThanOrEqual(e.rules.combat.roundCap)
  })

  /** 0048: a stalemate used to be charged to `meanRounds` at the full `roundCap`, so ONE capped battle in twenty
   *  added +3.0 rounds and reported a second, phantom `rounds` miss beside the real `stalemates` one. */
  it('a stalemate is carried by the counter alone — it never pads the round figures', () => {
    const clean = { label: 'mixed', spec: spec({ party: starters(), enemies: { kind: 'group', enemyGroupId: 'bandits_small', level: 1 }, seed: 100 }) }
    const honest = sweep([clean], e, greedyPolicy)[0]!
    const mixed = sweep([clean, { ...walled, label: 'mixed' }], e, greedyPolicy, { tolerateRoundCap: true })[0]!
    expect(mixed.runs).toBe(2)
    expect(mixed.stalemates).toBe(1)
    expect(mixed.meanRounds).toBe(honest.meanRounds)
    expect(mixed.maxRounds).toBe(honest.maxRounds)
    expect(mixed.meanRounds!).toBeLessThan(e.rules.combat.roundCap)
  })

  it('every round figure is null when nothing completed', () => {
    const row = sweep([walled], e, greedyPolicy, { tolerateRoundCap: true })[0]!
    expect(row.meanRounds).toBeNull()
    expect(row.minRounds).toBeNull()
    expect(row.maxRounds).toBeNull()
    expect(row.worstFirstBloodRound).toBeNull()
  })

  it('a healthy sweep carries no stalemate evidence', () => {
    const row = sweep([{ label: 'clean', spec: spec({ party: starters(), enemies: { kind: 'group', enemyGroupId: 'bandits_small', level: 1 }, seed: 100 }) }], e, greedyPolicy)[0]!
    expect(row.stalemates).toBe(0)
    expect(row.firstStalemate).toBeNull()
  })
})
