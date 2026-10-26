/**
 * The authored BOARD (0112). RE-GATE C 3.17: `run/battle.ts` handed every non-tutorial fight `obstacles: []` while
 * DECISIONS reads "flat boards, AUTHORED obstacles, cosmetic floor" and no content schema had an `obstacles` field
 * at all — so the entire tactical layer was a bare rectangle with no cover and no chokepoint.
 *
 * These cases hold the whole channel end to end: the shipped boards are sound and connected, every origin that can
 * start a battle lays one out, the board is a pure function of (runSeed, battleId), and — the case that would have
 * caught the one board this pass authored wrong — a battle can actually be SEEDED on every shipped board with
 * every shipped pack, which `chapel_yard` could not until its wall came off the engagement band.
 */
import { describe, expect, it } from 'vitest'
import { battlefieldFaults, createEnv } from '../../../src/engine/content'
import { content } from '../../../src/content/index'
import { seedBattle } from '../../../src/engine/combat/seed'
import { tileKey } from '../../../src/engine/combat/grid'
import { battleSpecFor } from '../../../src/engine/run/battle'
import { seedNewRun } from '../../../src/engine/run/newRun'
import type { BattleSpec, PendingCombat, RunState } from '../../../src/engine/types'

const env = createEnv()
const fields = Object.values(env.content.battlefields)

describe('content — the authored battlefield', () => {
  it('ships boards, and they are named places rather than ids', () => {
    expect(fields.length).toBeGreaterThan(0)
    for (const f of fields) expect(f.name, f.id).not.toMatch(/_/)
  })

  it('every shipped board is in bounds, clear of the deployment slots and ONE connected floor', () => {
    for (const f of fields) expect(battlefieldFaults(f, env.rules), f.id).toEqual([])
  })

  it('the boards are not a bare rectangle: every one of them puts something on the field', () => {
    for (const f of fields) expect(f.obstacles.length, f.id).toBeGreaterThan(0)
  })

  it('catches an unwalkable board, a board over a deployment slot and a board off the edge', () => {
    const [px, py] = env.rules.combat.partySlots[0]!
    expect(battlefieldFaults({ id: 'x', name: 'X', obstacles: [[px, py]] }, env.rules).join('\n')).toMatch(/deployment slot/)
    expect(battlefieldFaults({ id: 'x', name: 'X', obstacles: [[99, 0]] }, env.rules).join('\n')).toMatch(/off the/)
    // a wall clean across the board: the far side is walled off from the near side
    const wall = Array.from({ length: env.rules.combat.grid.height }, (_, y) => [6, y] as [number, number])
    expect(battlefieldFaults({ id: 'x', name: 'X', obstacles: wall }, env.rules).join('\n')).toMatch(/pieces/)
  })

  it('a battle can be seeded on every shipped board with every shipped pack', () => {
    const run = seedNewRun(1, env)
    const party = Object.values(run.party)
    for (const field of fields) {
      const obstacles = field.obstacles.map(([x, y]) => tileKey(x, y))
      for (const enemyGroupId of Object.keys(env.content.enemyGroups)) {
        for (const level of [1, 3, 5, 7]) {
          const spec: BattleSpec = {
            battleId: 'battle:sim', tag: 'sim', origin: { kind: 'sim' }, regionTier: 1, enemyGroupId,
            grid: { ...env.rules.combat.grid, obstacles, terrain: null },
            party, enemies: { kind: 'group', enemyGroupId, level }, consumables: [], captureTargets: [],
            rng: run.rng,
          }
          expect(() => seedBattle(spec, env), `${field.id} × ${enemyGroupId} L${level}`).not.toThrow()
        }
      }
    }
  })
})

describe('run/battle — the board comes from content, per origin', () => {
  const run = seedNewRun(7, env)
  const specFor = (pending: PendingCombat, over: Partial<RunState> = {}): BattleSpec => battleSpecFor({ ...run, ...over }, pending, env)
  const group = { kind: 'group', enemyGroupId: 'bandits_small', level: 1 } as const
  const boss = env.content.overworld.nodes.find((n) => n.type === 'BOSS')!

  it('a road fight is laid out on one of its DESTINATION region’s boards', () => {
    const to = 'old_mill_crossing'
    const node = env.content.overworld.nodes.find((n) => n.id === to)!
    const region = env.content.regions[node.regionId]!
    const spec = specFor({ origin: { kind: 'travel', to, from: run.nodeId, encounterId: 'e' }, enemies: group, captureTargets: [] })
    expect(spec.grid.obstacles.length).toBeGreaterThan(0)
    const drawn = region.battlefieldIds.map((id) => env.content.battlefields[id]!.obstacles.map(([x, y]) => tileKey(x, y)).sort())
    expect(drawn).toContainEqual([...spec.grid.obstacles].sort())
  })

  it('a dungeon room is laid out on one of the DUNGEON’s boards', () => {
    const def = env.content.dungeons['smugglers_cave']!
    const spec = specFor({ origin: { kind: 'dungeon', dungeonId: def.id, roomId: 'r1c0', roomType: 'combat' }, enemies: group, captureTargets: [] })
    const drawn = def.battlefieldIds.map((id) => env.content.battlefields[id]!.obstacles.map(([x, y]) => tileKey(x, y)).sort())
    expect(drawn).toContainEqual([...spec.grid.obstacles].sort())
  })

  it('the throne is a PLACE: the boss node’s own board wins over its region’s list', () => {
    expect(boss.battlefieldId).toBeDefined()
    const spec = specFor({ origin: { kind: 'finalBoss', nodeId: boss.id }, enemies: { kind: 'group', enemyGroupId: boss.enemyGroupId!, level: 5 }, captureTargets: [] }, { nodeId: boss.id })
    const hall = env.content.battlefields[boss.battlefieldId!]!.obstacles.map(([x, y]) => tileKey(x, y)).sort()
    expect([...spec.grid.obstacles].sort()).toEqual(hall)
  })

  it('the board is a pure function of (runSeed, battleId) — the same fight re-lays the same field', () => {
    const pending: PendingCombat = { origin: { kind: 'travel', to: 'old_mill_crossing', from: run.nodeId, encounterId: 'e' }, enemies: group, captureTargets: [] }
    const a = battleSpecFor(run, pending, env)
    const b = battleSpecFor(seedNewRun(7, env), pending, env)
    expect(b.grid.obstacles).toEqual(a.grid.obstacles)
    // and a different run draws its own field, so the sheet is not one board wearing ten names
    const others = new Set<string>()
    for (let seed = 1; seed <= 40; seed++) others.add([...battleSpecFor(seedNewRun(seed, env), pending, env).grid.obstacles].sort().join('|'))
    expect(others.size).toBeGreaterThan(1)
  })

  it('the tutorial keeps its own authored board', () => {
    const spec = battleSpecFor(run, { origin: { kind: 'tutorial' }, enemies: { kind: 'authored', units: [] }, captureTargets: [] }, env)
    expect(spec.grid.width).toBe(env.rules.combat.tutorialGrid.width)
  })

  it('the shipped registry is the one the lint reads', () => {
    expect(Object.keys(content.battlefields).sort()).toEqual(Object.keys(env.content.battlefields).sort())
  })
})
