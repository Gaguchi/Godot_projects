/** The headless CLI reaches the screens without a browser (ARCHITECTURE §6; CONTRACT §10). Spawns tsx, so it is slow. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterAll, describe, expect, it } from 'vitest'

function cli(args: readonly string[]): { readonly stdout: string; readonly status: number | null } {
  // node --import tsx: no shell, so an argument with spaces and semicolons (--cmds) survives intact on Windows too
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/cli.ts', ...args], { encoding: 'utf8', cwd: process.cwd(), timeout: 120_000 })
  return { stdout: r.stdout + r.stderr, status: r.status }
}

/** The REPL's `state` prints `JSON.stringify(state, null, 1)`, so the dump is the tail from the last `{\n "meta"`. */
function lastState(stdout: string): { screen: { kind: string }; run: { runSeed: number; nodeId: string } | null } {
  const i = stdout.lastIndexOf('\n{\n "meta"')
  expect(i, 'no state dump in the output').toBeGreaterThanOrEqual(0)
  // A `}` in column 0 closes the dump; summary lines may follow it.
  const rest = stdout.slice(i + 1)
  return JSON.parse(rest.slice(0, rest.lastIndexOf('\n}') + 2)) as ReturnType<typeof lastState>
}

const scratch = mkdtempSync(join(tmpdir(), 'embermarch-cli-'))
afterAll(() => { rmSync(scratch, { recursive: true, force: true }) })

describe('scripts/cli.ts', () => {
  it('play --cmds walks a fresh run through the tutorial, the field report and the prologue', () => {
    const r = cli(['play', '--cmds', 'new 7; fight; dismiss; choose 1; choose 1; choose 1; choose 1; choose 1; choose 1; choose 1; choose 1; choose 1; choose 1; show', '--json'])
    expect(r.status).toBe(0)
    // a frame is headed by the screen's NAME, never its routing kind (CONTRACT-CHANGES 0138)
    expect(r.stdout).toContain('== The Field ==')
    expect(r.stdout).toContain('FIELD REPORT')
    expect(r.stdout).toContain('== Prologue ==')
    const tail = r.stdout.trim().split('\n').pop() ?? ''
    const summary = JSON.parse(tail) as { screen: string; run: { nodeId: string } | null }
    expect(['prologue', 'overworld']).toContain(summary.screen)
    expect(summary.run?.nodeId).toBeDefined()
  }, 180_000)

  it('every ?screen= fixture dumps as JSON', () => {
    for (const screen of ['title', 'overworld', 'town', 'camp', 'dungeon', 'combat', 'battleEnd', 'win', 'gameOver']) {
      const r = cli(['dump-state', '--screen', screen, '--seed', '2'])
      expect(r.status, screen).toBe(0)
      const state = JSON.parse(r.stdout) as { screen: { kind: string } }
      expect(state.screen.kind, screen).toBe(screen)
    }
  }, 300_000)

  it('lint exits 0 on the shipped content; simulate prints a row', () => {
    expect(cli(['lint']).status).toBe(0)
    const sim = cli(['simulate', '--runs', '3', '--json'])
    expect(sim.status).toBe(0)
    const rows = JSON.parse(sim.stdout.trim().split('\n').pop() ?? '[]') as { label: string; runs: number; stalemates: number }[]
    expect(rows[0]?.runs).toBe(3)
    expect(rows[0]?.stalemates).toBe(0)
  }, 180_000)

  // ── CLI-01: a seed is an integer or the run is unloadable ──

  it('a non-numeric seed never mints a run — the flag exits 1, the REPL verb refuses and stays on Title', () => {
    const asFlag = cli(['play', '--seed', 'abc', '--cmds', 'new; show'])
    expect(asFlag.status).toBe(1)
    expect(asFlag.stdout).toContain("seed must be an integer, got 'abc'")

    const asVerb = cli(['play', '--cmds', 'new abc; state'])
    expect(asVerb.stdout).toContain("? seed must be an integer, got 'abc'")
    // The old code minted `runSeed: NaN`, which JSON.stringify writes as null and `parseSave` then rejects forever.
    expect(lastState(asVerb.stdout).run).toBeNull()

    expect(cli(['dump-state', '--screen', 'overworld', '--seed', '1e999']).status).toBe(1)
  }, 180_000)

  // ── CLI-03: a typo may never end the session ──

  it('a malformed tile argument prints a usage hint and the session survives', () => {
    const r = cli(['play', '--screen', 'combat', '--seed', '2', '--cmds', 'move; move abc; play 0 1,x; show'])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('? move <x,y>')
    expect(r.stdout).toContain('? play <n>')
    // still alive: `show` rendered the board after all three typos
    expect(r.stdout.lastIndexOf('== The Field ==')).toBeGreaterThan(r.stdout.indexOf('? play <n>'))
  }, 180_000)

  it('sell refuses a partial cell instead of silently selling slot 0,0', () => {
    const r = cli(['play', '--screen', 'town', '--seed', '2', '--cmds', 'sell abc; sell 0; sell ,; show'])
    expect(r.status).toBe(0)
    expect(r.stdout).not.toContain('itemRemoved')
    expect(r.stdout.match(/\? sell <x,y>/g)).toHaveLength(3)
  }, 180_000)

  // ── CLI-06: a broken invocation is never exit 0 ──

  it('an unknown command, an unknown flag and an unknown screen all exit 1', () => {
    expect(cli(['bogus-command']).status).toBe(1)
    expect(cli(['play', '--bogus', '5', '--cmds', 'new 7']).status).toBe(1)
    const screen = cli(['dump-state', '--screen', 'bogus', '--seed', '2'])
    expect(screen.status).toBe(1)
    expect(screen.stdout).toContain("unknown screen 'bogus'")
    expect(cli(['simulate', '--runs', 'abc']).status).toBe(1)
    expect(cli(['simulate', '--runs', '2', '--policy', 'bogus']).status).toBe(1)
    expect(cli(['combat', '--scenario', 'nonsense']).status).toBe(1)
  }, 300_000)

  it('a scripted run with an unknown verb exits 1; refusals stay non-fatal', () => {
    const broken = cli(['play', '--cmds', 'new 7; frobnicate; show'])
    expect(broken.status).toBe(1)
    expect(broken.stdout).toContain("? unknown command 'frobnicate'")

    const refused = cli(['play', '--cmds', 'new 7; go nowhere; show'])
    expect(refused.status).toBe(0)
    // A refusal is reported in the CLI's one refusal voice, against the verb the player TYPED — never an action
    // type and never a machine code (CONTRACT-CHANGES 0093).
    expect(refused.stdout).toContain('✗ go: ')
    expect(refused.stdout).toContain('command(s) refused')
  }, 180_000)

  // ── CLI-07: a run-less battle resolves instead of hanging ──

  it('combat --scenario resolves its run-less battle and prints the field report', () => {
    const r = cli(['combat', '--scenario', 'stub', '--seed', '3', '--cmds', 'fight; end'])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('FIELD REPORT')
    expect(r.stdout).toContain('(no run: nothing is paid out')
    // and the finished battle stops pretending to be live
    expect(r.stdout).toContain('the battle is over')
    expect(r.stdout).not.toContain('✗ end:')
  }, 180_000)

  // ── CLI-02: travel actually travels ──

  it('travel --auto walks to the node it was given and prints a line per hop', () => {
    const r = cli(['travel', '--to', 'riverside_market', '--seed', '7', '--auto'])
    expect(r.status).toBe(0)
    expect(r.stdout).not.toMatch(/refused/i)
    expect(r.stdout).toMatch(/^day \d+ · at .+ · food \d+ · /m)
    expect(r.stdout).toContain('· at Riverside Market ·')
    expect(r.stdout).toContain('arrived at Riverside Market')
  }, 180_000)

  it('travel names an unknown node instead of walking nowhere', () => {
    const r = cli(['travel', '--to', 'nowhere'])
    expect(r.status).toBe(1)
    expect(r.stdout).toContain("unknown node 'nowhere'")
  }, 180_000)

  // ── CLI-08: replay knows where a log started ──

  it('replay round-trips a logged run and refuses a log whose origin it cannot know', () => {
    const logged = cli(['play', '--cmds', 'new 7; log'])
    expect(logged.status).toBe(0)
    const envelope = JSON.parse(logged.stdout.trim().split('\n').pop() ?? '{}') as { initial: unknown; actions: unknown[] }
    expect(envelope.actions.length).toBeGreaterThan(0)

    const dumped = cli(['play', '--cmds', 'new 7; state'])
    const snapshotPath = join(scratch, 'snap.json')
    const envelopePath = join(scratch, 'envelope.json')
    const barePath = join(scratch, 'bare.json')
    const initialPath = join(scratch, 'initial.json')
    writeFileSync(snapshotPath, JSON.stringify(lastState(dumped.stdout)))
    writeFileSync(envelopePath, JSON.stringify(envelope))
    writeFileSync(barePath, JSON.stringify(envelope.actions))
    writeFileSync(initialPath, JSON.stringify(envelope.initial))

    const fromEnvelope = cli(['replay', snapshotPath, envelopePath])
    expect(fromEnvelope.stdout.trim(), fromEnvelope.stdout).toContain('"ok":true')
    expect(fromEnvelope.status).toBe(0)

    const fromBare = cli(['replay', snapshotPath, barePath, '--initial', initialPath])
    expect(fromBare.stdout).toContain('"ok":true')
    expect(fromBare.status).toBe(0)
  }, 300_000)

  it('replay says the log has the wrong origin instead of fabricating a divergence', () => {
    const logged = cli(['play', '--screen', 'overworld', '--seed', '2', '--cmds', 'go riverside_market; log'])
    const envelope = JSON.parse(logged.stdout.trim().split('\n').pop() ?? '{}') as { initial: unknown; actions: unknown[] }
    const snapshotPath = join(scratch, 'fixture-snap.json')
    const barePath = join(scratch, 'fixture-bare.json')
    writeFileSync(snapshotPath, JSON.stringify(envelope.initial))
    writeFileSync(barePath, JSON.stringify(envelope.actions))

    const r = cli(['replay', snapshotPath, barePath])
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('does not start from a fresh title state')
  }, 300_000)

  // ── CLI-05: the remaining commands are exercised at all ──

  it('dialogue walks a tree two nodes deep', () => {
    const r = cli(['dialogue', 'prologue', '--cmds', '1;1'])
    expect(r.status).toBe(0)
    expect(r.stdout.match(/== The Road ==/g)?.length).toBe(3)
    expect(r.stdout).toContain('The borderlands grow restless')
    expect(cli(['dialogue', 'no_such_dialogue']).status).toBe(1)
  }, 180_000)

  it('simulate honours --rules and --policy', () => {
    const patched = cli(['simulate', '--runs', '2', '--rules', 'difficulty.enemyScaling.enemyHpMultiplier=1', '--json'])
    expect(patched.status).toBe(0)
    const plain = cli(['simulate', '--runs', '2', '--json'])
    expect(plain.status).toBe(0)
    // the knob has to LAND: a fifth of the enemy pool cannot possibly produce the same row (BAL-05)
    expect(patched.stdout).not.toBe(plain.stdout)
    const random = cli(['simulate', '--runs', '2', '--policy', 'random', '--json'])
    expect(random.status).toBe(0)
    expect(cli(['simulate', '--runs', '2', '--rules', 'combat.nope=3']).status).toBe(1)
  }, 300_000)

  /** CONTRACT §10 / BRIEF §7.2: "a round cap throws with the per-round dump" — the stuck field reaches the
   *  operator, it is never swallowed into a tidy statistic or a bare stack trace (0048). */
  it('simulate fails loudly on a round cap and prints the stalled field', () => {
    const r = cli(['simulate', '--runs', '2', '--rules', 'combat.roundCap=2'])
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('round cap 2 hit')
    expect(r.stdout).toMatch(/round-cap dump: \d+ state\(s\)/)
    expect(r.stdout).toMatch(/^party:/m)
  }, 300_000)
})
