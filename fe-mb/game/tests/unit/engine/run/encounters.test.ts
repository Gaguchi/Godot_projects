import { describe, expect, it } from 'vitest'
import { createEnv } from '../../../../src/engine/content'
import { rollChanceFor, rollEncounter, rollHop } from '../../../../src/engine/run/encounters'
import { predicateState } from '../../../../src/engine/run/predicates'
import type { EncounterTable, RegionDef, RngState } from '../../../../src/engine/types'
import { env, newRun } from '../../../helpers/runs'
import { anyDialogueId, envWithChance, firstNodeOfType, neighbourOf } from '../../../helpers/overworld'

const region: RegionDef = { id: 'borderlands', name: 'R', color: '#000000', tier: 1, encounterChancePerHop: 0.4, battlefieldIds: ['open_ground'] }

describe('run/encounters — rollChanceFor (brief §2.9 cooldown)', () => {
  it('first pass = base chance; an edge override wins over the region knob', () => {
    expect(rollChanceFor(null, region, null, 10, env)).toBe(0.4)
    expect(rollChanceFor({ from: 'a', to: 'b', encounterTableId: 't', rollChance: 0.9 }, region, null, 10, env)).toBe(0.9)
  })
  it('re-crossing within cooldownDays scales by max(floor, daysSince/cooldownDays); ≥ cooldownDays restores 1', () => {
    const { cooldownDays, cooldownFloor } = env.rules.travel
    expect(rollChanceFor(null, region, { count: 1, lastDay: 10 }, 10, env)).toBeCloseTo(0.4 * cooldownFloor)
    expect(rollChanceFor(null, region, { count: 1, lastDay: 10 }, 11, env)).toBeCloseTo(0.4 * Math.max(cooldownFloor, 1 / cooldownDays))
    expect(rollChanceFor(null, region, { count: 1, lastDay: 10 }, 10 + cooldownDays, env)).toBe(0.4)
  })
})

describe('run/encounters — rollEncounter', () => {
  const rng: RngState = { seed: 42, counter: 0 }
  const table: EncounterTable = {
    id: 't',
    regionId: 'borderlands',
    entries: [
      { id: 'fx_common', weight: 5, oneShot: false, conditions: [], outcome: { kind: 'dialogue', dialogueId: anyDialogueId() } },
      { id: 'fx_once', weight: 100, oneShot: true, conditions: [], outcome: { kind: 'dialogue', dialogueId: anyDialogueId() } },
      { id: 'fx_gated', weight: 100, oneShot: false, conditions: [{ kind: 'never' }], outcome: { kind: 'dialogue', dialogueId: anyDialogueId() } },
    ],
  }
  const pred = predicateState(newRun(1))

  it('honours one-shots, predicates and weights, and advances the stream it was given', () => {
    const first = rollEncounter(table, pred, {}, rng)
    expect(first.roll?.entryId).toBe('fx_once') // 100 vs 5 — the gated entry never qualifies
    expect(first.rng.counter).toBeGreaterThan(rng.counter)
    const after = rollEncounter(table, pred, { fx_once: true }, rng)
    expect(after.roll?.entryId).toBe('fx_common')
    expect(after.roll?.oneShot).toBe(false)
  })
  it('is deterministic for the same state and returns null (rng untouched) when nothing qualifies', () => {
    expect(rollEncounter(table, pred, {}, rng)).toEqual(rollEncounter(table, pred, {}, rng))
    const none = rollEncounter({ ...table, entries: [table.entries[2]!] }, pred, {}, rng)
    expect(none.roll).toBeNull()
    expect(none.rng).toBe(rng)
  })
})

describe('run/encounters — rollHop', () => {
  /**
   * RE-GATE C 3.19. The list used to be TOWN + DUNGEON + BOSS, which took the roll off 22.8% of all hop
   * directions and, because the road to the throne is town-and-dungeon heavy, off the golden path hardest of all:
   * the region knob said 0.4 / 0.55 / 0.7 and the journey heard much less. The RULE is unchanged and still under
   * test here; what moved is the list it reads (0124), so the case is written against the list rather than
   * against the three types that happened to be on it.
   */
  it('never rolls into a node type rules.travel.noRollInto names — and rolls into every other, without advancing run.rng', () => {
    const run = newRun(3)
    const chance1 = envWithChance(1)
    // The market is on the shipped list and stays quiet…
    const town = firstNodeOfType('TOWN')
    expect(chance1.rules.travel.noRollInto).toEqual(['TOWN', 'BOSS'])
    for (let pass = 1; pass <= 5; pass++) expect(rollHop(run, run.nodeId, town.id, pass, chance1)).toBeNull()
    // …and the dungeon mouth, which came OFF it (0124), is a road like any other: the same crossing is quiet only
    // when the list is widened back to what it was. The road has to be real for the two answers to differ at all —
    // `rollHop` looks the edge up after the type check, so a non-adjacent node is null either way.
    const dungeon = firstNodeOfType('DUNGEON')
    const edge = chance1.content.overworld.edges.find((e) => e.from === dungeon.id || e.to === dungeon.id)!
    const outside = edge.from === dungeon.id ? edge.to : edge.from
    const standing = { ...run, nodeId: outside }
    const widened = createEnv(chance1.content, { ...chance1.rules, travel: { ...chance1.rules.travel, noRollInto: ['TOWN', 'DUNGEON', 'BOSS'] } })
    expect(rollHop(standing, outside, dungeon.id, 1, widened)).toBeNull()
    expect(rollHop(standing, outside, dungeon.id, 1, chance1)).not.toBeNull()
    const next = neighbourOf(run)
    rollHop(run, run.nodeId, next, 1, env)
    expect(run.rng).toEqual(newRun(3).rng)
  })
  it('is a pure function of (run, edge, pass): same inputs → same roll; chance 0 → quiet', () => {
    const run = newRun(5)
    const next = neighbourOf(run)
    const e1 = envWithChance(1)
    expect(rollHop(run, run.nodeId, next, 1, e1)).toEqual(rollHop(run, run.nodeId, next, 1, e1))
    expect(rollHop(run, run.nodeId, next, 1, e1)).not.toBeNull()
    expect(rollHop(run, run.nodeId, next, 1, envWithChance(0))).toBeNull()
  })
})
