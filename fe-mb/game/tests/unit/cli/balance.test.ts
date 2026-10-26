/**
 * The `balance` gate CONTRACT §10 and BRIEF §10 name: `rules.balance` seeds × scenarios, exit 1 on a miss.
 * The gate itself is what CI runs, so what is pinned here is the GATE's own behaviour — that a missed band
 * is a non-zero exit with a MISS line, and that held bands are a clean exit 0. The shipped numbers are the
 * threat-tuning package's business (a narrowed band here would just re-assert `rules.ts`).
 */
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

function cli(args: readonly string[]): { readonly stdout: string; readonly status: number | null } {
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/cli.ts', ...args], { encoding: 'utf8', cwd: process.cwd(), timeout: 300_000 })
  return { stdout: r.stdout + r.stderr, status: r.status }
}

const FEW_SEEDS = 'balance.simSeeds=3'
/** The attrition rows walk whole PATHS, so a gate run with the shipped 24 seeds is minutes of work; every case
 *  here shrinks them to one path per scenario and widens their bands the same way the battle bands are widened. */
const FEW_PATHS = 'balance.attrition.seeds=1;balance.attrition.dungeonClearRate=0,1;balance.attrition.roadClearRate=0,1;balance.attrition.lowWaterHpFraction=0,1;balance.attrition.maxStarvingSteps=999'
const EVERY_BAND_WIDE = `${FEW_SEEDS};${FEW_PATHS};balance.turns=1,999;balance.roundsCeiling=999;balance.startersVsStubWin=0,1;balance.bossWithEpicWin=0,1;balance.firstBloodByRound=999`

describe('cli balance', () => {
  it('exits 1 and names the miss when a band cannot be met', () => {
    const r = cli(['balance', '--rules', `${EVERY_BAND_WIDE};balance.turns=999,1000;balance.roundsCeiling=1000`])
    expect(r.status).toBe(1)
    expect(r.stdout).toMatch(/^MISS stub rounds: /m)
    expect(r.stdout).toMatch(/^MISS boss rounds: /m)
  }, 300_000)

  it('exits 0 and reports every band as ok when they hold', () => {
    const r = cli(['balance', '--rules', EVERY_BAND_WIDE])
    expect(r.status, r.stdout).toBe(0)
    expect(r.stdout).not.toContain('MISS')
    for (const label of ['stub', 'boss']) {
      for (const band of ['win rate', 'stalemates', 'rounds', 'first blood']) {
        expect(r.stdout, `${label} ${band}`).toContain(`ok   ${label} ${band}:`)
      }
    }
  }, 300_000)

  it('prints the win band as whole percents, not a float artifact', () => {
    const r = cli(['balance', '--rules', EVERY_BAND_WIDE.replace('balance.startersVsStubWin=0,1', 'balance.startersVsStubWin=0.55,0.75')])
    expect(r.stdout).toContain('(band 55%-75%, 95% CI ')
    expect(r.stdout).not.toContain('55.00000000000001')
  }, 300_000)

  /** 0048: a 20-percentage-point band cannot be resolved by 20 seeds, so the gate prints the sample it drew and a
   *  Wilson interval beside every win rate — a MISS has to be readable as "out of band" vs "too few seeds". */
  it('names the seed range it measured and brackets each win rate with a confidence interval', () => {
    const r = cli(['balance', '--rules', EVERY_BAND_WIDE])
    expect(r.stdout).toMatch(/^3 seeds per scenario \(2000-2002\), careful-player policy$/m)
    expect(r.stdout).toMatch(/stub win rate: \d+% \(band 0%-100%, 95% CI \d+%-\d+%\)/)
  }, 300_000)

  /** BRIEF §10 states the round target as an AVERAGE, so `balance.turns` is what the MEAN is held to — but a mean
   *  alone passes a bimodal field, so the per-battle span is printed and `balance.roundsCeiling` is asserted per
   *  battle beside it (0048; the two were one number until 0110 separated them). */
  it('reports the per-battle round span beside the mean and fails when one battle runs past the ceiling', () => {
    const ok = cli(['balance', '--rules', EVERY_BAND_WIDE])
    expect(ok.stdout).toMatch(/stub rounds: mean [\d.]+, per battle \d+-\d+ \(mean band 1-999, no battle past 999\)/)
    // the ceiling alone: the MEAN still sits inside [1, 999], so only the per-battle rule can fail
    const tight = cli(['balance', '--rules', `${EVERY_BAND_WIDE};balance.roundsCeiling=3`])
    expect(tight.status).toBe(1)
    expect(tight.stdout).toMatch(/^MISS stub rounds: /m)
  }, 300_000)

  /** A battle in which nobody ever loses HP is invisible to `meanFirstBloodRound` (it averages the battles that
   *  DID draw blood), so the gate asserts the worst battle and the bloodless count (0048). */
  it('asserts first blood on the worst battle, not on the average', () => {
    const r = cli(['balance', '--rules', EVERY_BAND_WIDE])
    expect(r.stdout).toMatch(/stub first blood: mean [\d.]+, worst \d+, 0 bloodless \(by round 999\)/)
    const strict = cli(['balance', '--rules', `${EVERY_BAND_WIDE};balance.firstBloodByRound=0`])
    expect(strict.status).toBe(1)
    expect(strict.stdout).toMatch(/^MISS stub first blood: /m)
  }, 300_000)

  /**
   * GATE3-15/17: the gate was green on stub 69% / boss 43% while a dungeon descent cleared 0 of 24 seeds and a
   * road leg starved out. Both battle scenarios seed a fresh full-HP party, so no row measured a PATH — HP
   * carried room to room, food burned hop by hop. These rows do.
   */
  it('measures whole paths, not just fights: a dungeon descent and a road leg with their own bands', () => {
    const r = cli(['balance', '--rules', EVERY_BAND_WIDE])
    expect(r.status, r.stdout).toBe(0)
    expect(r.stdout).toMatch(/^1 paths per scenario \(3000-3000\), careful-player policy$/m)
    for (const label of ['dungeon path', 'road leg']) {
      expect(r.stdout, label).toContain(`${label}: runs 1  cleared `)
      expect(r.stdout, label).toContain(`ok   ${label} cleared:`)
      expect(r.stdout, label).toContain(`ok   ${label} pressure:`)
    }
    expect(r.stdout).toContain('ok   road leg supply:')
  }, 600_000)

  it('fails when a path is a death sentence or a corridor', () => {
    // one path either clears or it does not, so a band that excludes both 0% and 100% always misses
    const dead = cli(['balance', '--rules', `${EVERY_BAND_WIDE};balance.attrition.dungeonClearRate=0.4,0.6`])
    expect(dead.status).toBe(1)
    expect(dead.stdout).toMatch(/^MISS dungeon path cleared: /m)
    const starved = cli(['balance', '--rules', `${EVERY_BAND_WIDE};balance.attrition.maxStarvingSteps=-1`])
    expect(starved.status).toBe(1)
    expect(starved.stdout).toMatch(/^MISS road leg supply: /m)
  }, 600_000)

  it('rejects an unknown knob instead of silently ignoring it', () => {
    const r = cli(['balance', '--rules', 'balance.nope=1'])
    expect(r.status).toBe(1)
    expect(r.stdout).toContain("--rules: unknown knob 'balance.nope'")
  }, 180_000)
})
