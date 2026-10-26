import { describe, expect, it } from 'vitest'
import { generateDungeon, roomIdOf, successors, validateDungeon } from '../../../../src/engine/procgen/dungeonGraph'
import { createEnv, withRules } from '../../../../src/engine/content'
import { deriveState } from '../../../../src/engine/rngState'
import { rngLabels } from '../../../../src/engine/rules'
import type { DungeonDef, DungeonGraph, DungeonRoom, EngineEnv, RoomId, RoomType } from '../../../../src/engine/types'

const env = createEnv()
const defs = Object.values(env.content.dungeons)
const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1)

/** The run-side derivation (`run/dungeon.ts#enterDungeon`): the dungeon stream depends on (runSeed, dungeonId) only. */
function gen(seed: number, def: DungeonDef, e: EngineEnv = env) {
  return generateDungeon(deriveState({ seed, counter: 0 }, rngLabels.dungeon(def.id)), def, e)
}

function rooms(g: DungeonGraph): readonly DungeonRoom[] {
  return Object.values(g.rooms)
}

/** Structural + type fingerprint, so "different graphs" means different, not just different objects. */
function fingerprint(g: DungeonGraph): string {
  return g.rows.map((row) => row.map((id) => `${id}:${g.rooms[id]!.type}>${(g.edges[id] ?? []).join('+')}`).join(' ')).join('|')
}

describe('generateDungeon', () => {
  it('100 seeds × every dungeon: every generated graph passes validateDungeon', () => {
    for (const def of defs) {
      for (const seed of SEEDS) {
        const { graph } = gen(seed, def)
        expect(validateDungeon(graph, env), `${def.id} seed ${seed}`).toEqual([])
      }
    }
  })

  it('is deterministic per (runSeed, dungeonId): the same input yields a deep-equal graph and rng', () => {
    for (const def of defs) {
      const a = gen(42, def)
      const b = gen(42, def)
      expect(a.graph).toEqual(b.graph)
      expect(a.rng).toEqual(b.rng)
    }
  })

  it('two dungeon ids yield different graphs for the same run seed', () => {
    const [a, b] = [env.content.dungeons['smugglers_cave']!, env.content.dungeons['iron_mine']!]
    expect(fingerprint(gen(7, a).graph)).not.toBe(fingerprint(gen(7, b).graph))
    const differing = SEEDS.filter((seed) => fingerprint(gen(seed, a).graph) !== fingerprint(gen(seed, b).graph)).length
    expect(differing).toBeGreaterThan(SEEDS.length * 0.95)
  })

  it('different run seeds yield different graphs for the same dungeon', () => {
    const def = env.content.dungeons['smugglers_cave']!
    const prints = new Set(SEEDS.map((seed) => fingerprint(gen(seed, def).graph)))
    expect(prints.size).toBeGreaterThan(SEEDS.length * 0.9)
  })

  it('advances the rng it is handed and never mutates the input state', () => {
    const def = env.content.dungeons['ancient_ruins']!
    const input = deriveState({ seed: 3, counter: 0 }, rngLabels.dungeon(def.id))
    const frozen = Object.freeze({ ...input })
    const { rng } = generateDungeon(frozen, def, env)
    expect(rng.seed).toBe(input.seed)
    expect(rng.counter).toBeGreaterThan(input.counter)
    expect(frozen).toEqual(input)
  })

  it('has rules.dungeon.rows data rows plus one boss row; row 0 is all combat, the last data row all rest, the boss row is [bossId]', () => {
    const cfg = env.rules.dungeon
    for (const def of defs) {
      for (const seed of SEEDS.slice(0, 20)) {
        const { graph } = gen(seed, def)
        expect(graph.dungeonId).toBe(def.id)
        expect(graph.rows).toHaveLength(cfg.rows + 1)
        expect(graph.rows[0]!.every((id) => graph.rooms[id]!.type === cfg.forcedFirstRow)).toBe(true)
        expect(graph.rows[cfg.rows - 1]!.every((id) => graph.rooms[id]!.type === cfg.forcedLastRow)).toBe(true)
        expect(graph.rows[cfg.rows]).toEqual([graph.bossId])
        expect(graph.bossId).toBe(roomIdOf(cfg.rows, 0))
        expect(graph.rooms[graph.bossId]!.type).toBe('boss')
        expect(rooms(graph).filter((r) => r.type === 'boss')).toHaveLength(1)
      }
    }
  })

  it('has unique ids that encode row and column', () => {
    for (const def of defs) {
      const { graph } = gen(11, def)
      const ids = rooms(graph).map((r) => r.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const r of rooms(graph)) expect(r.id).toBe(roomIdOf(r.row, r.col))
      expect(graph.rows.flat().sort()).toEqual([...ids].sort())
    }
  })

  it('starts the first two paths in distinct columns, so the entrance always offers a choice', () => {
    for (const def of defs) for (const seed of SEEDS) expect(gen(seed, def).graph.rows[0]!.length).toBeGreaterThanOrEqual(2)
  })

  it('puts no elite or rest room before rules.dungeon.noSpecialBeforeRow', () => {
    for (const def of defs) {
      for (const seed of SEEDS) {
        for (const r of rooms(gen(seed, def).graph)) {
          if (r.row < env.rules.dungeon.noSpecialBeforeRow) expect(['elite', 'rest']).not.toContain(r.type)
        }
      }
    }
  })

  it('every edge advances exactly one row and never crosses another', () => {
    for (const def of defs) {
      for (const seed of SEEDS) {
        const { graph } = gen(seed, def)
        const edges = Object.entries(graph.edges).flatMap(([from, tos]) => tos.map((to) => ({ from: graph.rooms[from]!, to: graph.rooms[to]! })))
        for (const e of edges) expect(e.to.row).toBe(e.from.row + 1)
        for (const a of edges) {
          for (const b of edges) {
            if (a.from.row !== b.from.row) continue
            const crossed = (a.from.col < b.from.col && a.to.col > b.to.col) || (a.from.col > b.from.col && a.to.col < b.to.col)
            expect(crossed, `${def.id} seed ${seed}: ${a.from.id}→${a.to.id} × ${b.from.id}→${b.to.id}`).toBe(false)
          }
        }
      }
    }
  })

  it('reaches the single boss from every last-row room and every room from row 0', () => {
    for (const def of defs) {
      for (const seed of SEEDS) {
        const { graph } = gen(seed, def)
        for (const id of graph.rows[env.rules.dungeon.rows - 1]!) expect(graph.edges[id]).toContain(graph.bossId)
        const seen = new Set<RoomId>(graph.rows[0])
        const queue = [...seen]
        for (let i = 0; i < queue.length; i++) for (const to of graph.edges[queue[i]!] ?? []) if (!seen.has(to)) { seen.add(to); queue.push(to) }
        expect(seen.size).toBe(rooms(graph).length)
        expect(seen.has(graph.bossId)).toBe(true)
        for (const r of rooms(graph)) expect((graph.edges[r.id] ?? []).length > 0 || r.type === 'boss').toBe(true)
      }
    }
  })

  it('never puts the same special (elite/rest) on two consecutive rooms of a path', () => {
    for (const def of defs) {
      for (const seed of SEEDS) {
        const { graph } = gen(seed, def)
        for (const [from, tos] of Object.entries(graph.edges)) {
          const a = graph.rooms[from]!
          if (a.type !== 'elite' && a.type !== 'rest') continue
          for (const to of tos) expect(graph.rooms[to]!.type, `${def.id} seed ${seed}: ${from}→${to}`).not.toBe(a.type)
        }
      }
    }
  })

  it('gives every fork destinations of distinct types (outside the forced rest row)', () => {
    for (const def of defs) {
      for (const seed of SEEDS) {
        const { graph } = gen(seed, def)
        for (const [from, tos] of Object.entries(graph.edges)) {
          if (tos.length < 2 || graph.rooms[tos[0]!]!.row === env.rules.dungeon.rows - 1) continue
          const types = tos.map((t) => graph.rooms[t]!.type)
          expect(new Set(types).size, `${def.id} seed ${seed}: fork at ${from}`).toBe(types.length)
        }
      }
    }
  })

  it('draws event rooms from def.roomEvents without replacement and carries null once the deck is exhausted', () => {
    const cave = env.content.dungeons['smugglers_cave']!
    expect(cave.roomEvents.length).toBeGreaterThan(0)
    let sawAnEvent = false
    let sawExhaustion = false
    for (const seed of SEEDS) {
      const { graph } = gen(seed, cave)
      const events = graph.rows.flat().map((id) => graph.rooms[id]!).filter((r) => r.type === 'event')
      const drawn = events.map((r) => r.checkEventId).filter((id): id is string => id !== null)
      expect(new Set(drawn).size).toBe(drawn.length)
      for (const id of drawn) expect(cave.roomEvents).toContain(id)
      // Row-major: the first `roomEvents.length` event rooms get an id, the rest null.
      events.forEach((r, i) => expect(r.checkEventId === null).toBe(i >= cave.roomEvents.length))
      if (events.length > 0) sawAnEvent = true
      for (const r of rooms(graph)) if (r.type !== 'event') expect(r.checkEventId).toBeNull()
    }
    expect(sawAnEvent).toBe(true)

    // The shipped decks are long enough that exhaustion is rare (see the coverage case below), so the null path is
    // proven on a deliberately thin def and on one with no deck at all.
    const thin = { ...cave, roomEvents: [cave.roomEvents[0]!] }
    for (const seed of SEEDS) {
      const events = rooms(gen(seed, thin).graph).filter((r) => r.type === 'event')
      if (events.length > 1) sawExhaustion = true
      events.forEach((r, i) => expect(r.checkEventId === null).toBe(i >= 1))
    }
    expect(sawExhaustion).toBe(true)
    const mine = { ...env.content.dungeons['iron_mine']!, roomEvents: [] }
    for (const seed of SEEDS.slice(0, 20)) for (const r of rooms(gen(seed, mine).graph)) expect(r.checkEventId).toBeNull()
  })

  /**
   * THE DECK IS DEALT ACROSS THE WHOLE GRAPH, so a def's `roomEvents` has to be as long as the graphs the
   * generator actually produces — not as long as one walked path. Smuggler's Cave shipped two events for a graph
   * that dealt four, and half of every dungeon's event rooms fell through to `EMPTY_ROOM_TEXT` (RE-GATE C 3.8).
   * The floor lives in `rules.dungeon.minRoomEvents`; this case is the MEASUREMENT that keeps that number honest,
   * so retuning `rules.dungeon.weights` reddens it rather than silently thinning the decks again.
   */
  it('the authored decks cover the event rooms the generator deals (rules.dungeon.minRoomEvents)', () => {
    const seeds = Array.from({ length: 400 }, (_, i) => i + 1)
    const counts: number[] = []
    let short = 0
    for (const def of defs) {
      expect(def.roomEvents.length, `${def.id} deck`).toBeGreaterThanOrEqual(env.rules.dungeon.minRoomEvents)
      for (const seed of seeds) {
        const events = rooms(gen(seed, def).graph).filter((r) => r.type === 'event').length
        counts.push(events)
        if (events > def.roomEvents.length) short++
      }
    }
    const sorted = [...counts].sort((a, b) => a - b)
    const p98 = sorted[Math.floor(sorted.length * 0.98)]!
    expect(env.rules.dungeon.minRoomEvents).toBeGreaterThanOrEqual(p98)
    expect(short / counts.length).toBeLessThan(0.02)
    // …and the measurement has teeth: the two-card deck that shipped would have been short on half of these graphs.
    expect(counts.filter((n) => n > 2).length / counts.length).toBeGreaterThan(0.4)
  })

  /** Derived from `rules.dungeon.weights` rather than from the numbers that happened to ship: the old version
   *  spelled the 45/20/15/5/5 table out as `treasure > rest`, so retuning the table (0055) reddened a test that
   *  was meant to police the GENERATOR, not the tuning. */
  it('follows the mid-row weights: every positive weight appears, and a heavier weight draws more often', () => {
    const counts: Record<RoomType, number> = { combat: 0, event: 0, treasure: 0, rest: 0, elite: 0, boss: 0 }
    const cfg = env.rules.dungeon
    for (const def of defs) {
      for (const seed of SEEDS) {
        // The window is the rows where every positive weight is EQUALLY eligible: at or past `noEliteBeforeRow`
        // (below it the elite is banned outright) and two rows clear of the end (the row before the forced Rest
        // row can never be Rest — "no consecutive special" — so counting it would charge Rest a filter no other
        // type pays and turn a constraint into a weight miss).
        for (const r of rooms(gen(seed, def).graph)) if (r.row >= cfg.noEliteBeforeRow && r.row < cfg.rows - 2) counts[r.type]++
      }
    }
    const ranked = (Object.entries(cfg.weights) as [Exclude<RoomType, 'boss'>, number][]).sort((a, b) => b[1] - a[1])
    for (const [type, weight] of ranked) if (weight > 0) expect(counts[type], type).toBeGreaterThan(0)
    // Weight order ⇒ draw order, with a tolerance for the constraint filters (a forced child bans a special).
    for (let i = 0; i < ranked.length - 1; i++) {
      const [a, wa] = ranked[i]!
      const [b, wb] = ranked[i + 1]!
      if (wa > wb * 1.5) expect(counts[a], `${a} (w${wa}) vs ${b} (w${wb})`).toBeGreaterThan(counts[b])
    }
  })

  /**
   * RE-GATE C 3.18: the descent screen draws a branching chart and the blind playthrough walked a CORRIDOR —
   * fifteen of nineteen rooms had exactly one exit, because four traces over four columns overlap almost
   * completely. Phase 2b (`rules.dungeon.branchChance`) offers every single-exit room a second edge, and
   * `rules.dungeon.paths` widens the traced set that edge can reach. Measured, not asserted by construction:
   * the shipped knobs must leave most of the descent a CHOICE.
   */
  it('is a branch, not a corridor: a large share of rooms offer more than one way on', () => {
    let forks = 0
    let total = 0
    for (const def of defs) {
      for (const seed of SEEDS) {
        for (const r of rooms(gen(seed, def).graph)) {
          if (r.type === 'boss') continue
          total++
          if ((gen(seed, def).graph.edges[r.id] ?? []).length > 1) forks++
        }
      }
    }
    expect(forks / total).toBeGreaterThan(0.35)
  })

  it('the weave adds edges but never a room, a crossing or a skipped row', () => {
    const bare = withRules(env, { dungeon: { ...env.rules.dungeon, branchChance: 0 } })
    for (const def of defs) {
      for (const seed of SEEDS.slice(0, 20)) {
        const woven = gen(seed, def).graph
        const traced = gen(seed, def, bare).graph
        expect(Object.keys(woven.rooms).sort(), `${def.id}#${seed}`).toEqual(Object.keys(traced.rooms).sort())
        const count = (g: typeof woven) => Object.values(g.edges).reduce((n, tos) => n + tos.length, 0)
        expect(count(woven)).toBeGreaterThanOrEqual(count(traced))
        expect(validateDungeon(woven, env), `${def.id}#${seed}`).toEqual([])
      }
    }
  })

  /** RE-GATE C 3.18's other half: two of three entrances led STRAIGHT into an elite, i.e. the dungeon's hardest
   *  pack as the company's second room, on whatever the forced row-0 fight left it. */
  it('never puts an elite in the room after the entrance', () => {
    for (const def of defs) {
      for (const seed of SEEDS) {
        const { graph } = gen(seed, def)
        for (const r of rooms(graph)) {
          if (r.row < env.rules.dungeon.noEliteBeforeRow) expect(r.type, `${def.id}#${seed} ${r.id}`).not.toBe('elite')
        }
      }
    }
  })

  /**
   * GATE3-15. `forcedLastRow: 'rest'` plus a rest weight of 5 in 90 put EVERY rest room in the row before the
   * boss: the blind playthrough walked four rooms of a committed descent (there is no way out but the boss) with
   * no heal at all and lost the run in the second fight. The rule is not "some graph somewhere has an early
   * rest" — it is that the room you can actually walk to has one, so this measures REACHABLE rests over the
   * shipped graphs.
   */
  it('offers a rest before the forced last row on most descents, so a committed party can recover mid-dungeon', () => {
    const cfg = env.rules.dungeon
    let withEarlyRest = 0
    let total = 0
    for (const def of defs) {
      for (const seed of SEEDS) {
        const { graph } = gen(seed, def)
        // Walk the least-dangerous route a careful player takes; a rest anywhere on it above the last data row counts.
        const rank: Record<RoomType, number> = { rest: 0, treasure: 1, event: 2, combat: 3, elite: 5, boss: 6 }
        let at: RoomId | null = null
        let early = false
        for (let i = 0; i < cfg.rows; i++) {
          const next: readonly RoomId[] = [...successors(graph, at)].sort((a, b) => rank[graph.rooms[a]!.type] - rank[graph.rooms[b]!.type] || (a < b ? -1 : 1))
          const pick: RoomId | undefined = next[0]
          if (pick === undefined) break
          at = pick
          const room = graph.rooms[pick]!
          if (room.type === 'rest' && room.row < cfg.rows - 1) early = true
        }
        total++
        if (early) withEarlyRest++
      }
    }
    expect(withEarlyRest / total).toBeGreaterThan(0.5)
  })

  it('is parametric: the research-canonical 15×7 / 6-path variant (rules.dungeon.canonicalVariant) also validates', () => {
    const canon = env.rules.dungeon.canonicalVariant
    const big = withRules(env, {
      dungeon: { ...env.rules.dungeon, rows: canon.rows, cols: canon.cols, paths: canon.paths, noSpecialBeforeRow: 5 },
    })
    for (const seed of SEEDS.slice(0, 25)) {
      const { graph } = gen(seed, env.content.dungeons['thornwood_depths']!, big)
      expect(graph.rows).toHaveLength(canon.rows + 1)
      expect(validateDungeon(graph, big)).toEqual([])
    }
  })
})

describe('successors', () => {
  it('lists row 0 at the entrance, the boss from every last-row room, and nothing from the boss', () => {
    const { graph } = gen(5, env.content.dungeons['obsidian_cavern']!)
    expect(successors(graph, null)).toEqual(graph.rows[0])
    for (const id of graph.rows[env.rules.dungeon.rows - 1]!) expect(successors(graph, id)).toEqual([graph.bossId])
    expect(successors(graph, graph.bossId)).toEqual([])
    expect(successors(graph, 'r9c9')).toEqual([])
  })
})

describe('validateDungeon', () => {
  /** A hand-built 3-row graph so every rule can be broken one at a time. */
  const tinyEnv = withRules(env, { dungeon: { ...env.rules.dungeon, rows: 3, cols: 3, paths: 2, noSpecialBeforeRow: 1, noEliteBeforeRow: 1 } })
  function room(row: number, col: number, type: RoomType, checkEventId: string | null = null): DungeonRoom {
    return { id: roomIdOf(row, col), row, col, type, checkEventId }
  }
  function tiny(patch: Partial<DungeonGraph> = {}): DungeonGraph {
    const list = [room(0, 0, 'combat'), room(0, 1, 'combat'), room(1, 0, 'event'), room(1, 1, 'treasure'), room(2, 0, 'rest'), room(2, 1, 'rest'), room(3, 0, 'boss')]
    const rooms: Record<RoomId, DungeonRoom> = {}
    for (const r of list) rooms[r.id] = r
    return {
      dungeonId: 'tiny',
      rooms,
      rows: [['r0c0', 'r0c1'], ['r1c0', 'r1c1'], ['r2c0', 'r2c1'], ['r3c0']],
      edges: { r0c0: ['r1c0', 'r1c1'], r0c1: ['r1c1'], r1c0: ['r2c0'], r1c1: ['r2c0', 'r2c1'], r2c0: ['r3c0'], r2c1: ['r3c0'], r3c0: [] },
      bossId: 'r3c0',
      ...patch,
    }
  }
  const retype = (g: DungeonGraph, id: RoomId, type: RoomType, checkEventId: string | null = null): DungeonGraph =>
    ({ ...g, rooms: { ...g.rooms, [id]: { ...g.rooms[id]!, type, checkEventId } } })

  it('accepts the hand-built graph', () => {
    expect(validateDungeon(tiny(), tinyEnv)).toEqual([])
  })
  it('flags a room whose id field disagrees with its key or its row/col', () => {
    const g = tiny()
    expect(validateDungeon({ ...g, rooms: { ...g.rooms, r0c0: { ...g.rooms['r0c0']!, id: 'r9c9' } } }, tinyEnv).join('\n')).toMatch(/id field/)
    expect(validateDungeon({ ...g, rooms: { ...g.rooms, r0c0: { ...g.rooms['r0c0']!, col: 2 } } }, tinyEnv).join('\n')).toMatch(/does not encode/)
  })
  it('flags duplicate and missing ids in rows', () => {
    expect(validateDungeon(tiny({ rows: [['r0c0', 'r0c0'], ['r1c0', 'r1c1'], ['r2c0', 'r2c1'], ['r3c0']] }), tinyEnv).join('\n')).toMatch(/duplicate room id 'r0c0'/)
    expect(validateDungeon(tiny({ rows: [['r0c0'], ['r1c0', 'r1c1'], ['r2c0', 'r2c1'], ['r3c0']] }), tinyEnv).join('\n')).toMatch(/'r0c1' is missing from rows/)
  })
  it('flags crossing edges and edges that skip a row', () => {
    const crossed = tiny({ edges: { r0c0: ['r1c1'], r0c1: ['r1c0'], r1c0: ['r2c0'], r1c1: ['r2c0', 'r2c1'], r2c0: ['r3c0'], r2c1: ['r3c0'], r3c0: [] } })
    expect(validateDungeon(crossed, tinyEnv).join('\n')).toMatch(/cross/)
    const skipping = tiny({ edges: { ...tiny().edges, r0c1: ['r1c1', 'r2c1'] } })
    expect(validateDungeon(skipping, tinyEnv).join('\n')).toMatch(/does not advance exactly one row/)
  })
  it('flags a dead end, an unreachable boss and an unknown destination', () => {
    const deadEnd = tiny({ edges: { ...tiny().edges, r2c1: [] } })
    const msgs = validateDungeon(deadEnd, tinyEnv).join('\n')
    expect(msgs).toMatch(/dead end/)
    expect(msgs).toMatch(/does not lead to the boss/)
    expect(validateDungeon(tiny({ edges: { ...tiny().edges, r1c0: ['r2c5'] } }), tinyEnv).join('\n')).toMatch(/unknown destination 'r2c5'/)
  })
  it('flags the forced rows and the early-special ban', () => {
    expect(validateDungeon(retype(tiny(), 'r0c1', 'event'), tinyEnv).join('\n')).toMatch(/row 0 room 'r0c1' is event/)
    expect(validateDungeon(retype(tiny(), 'r2c1', 'combat'), tinyEnv).join('\n')).toMatch(/last data row room 'r2c1' is combat/)
    expect(validateDungeon(retype(tiny(), 'r1c0', 'elite'), withRules(tinyEnv, { dungeon: { ...tinyEnv.rules.dungeon, noSpecialBeforeRow: 2 } })).join('\n')).toMatch(/elite before row 2/)
  })
  it('flags consecutive same-type specials and a fork with duplicate destination types', () => {
    expect(validateDungeon(retype(tiny(), 'r1c0', 'rest'), tinyEnv).join('\n')).toMatch(/consecutive rest: r1c0→r2c0/)
    expect(validateDungeon(retype(tiny(), 'r1c1', 'event'), tinyEnv).join('\n')).toMatch(/fork at 'r0c0'/)
    // Elite → forced Rest is the canonical pre-boss pattern and stays legal (with the elite row floor lowered:
    // the shipped `noEliteBeforeRow` of 2 is a separate rule with its own case above).
    expect(validateDungeon(retype(tiny(), 'r1c0', 'elite'), tinyEnv)).toEqual([])
  })
  it('flags a boss that is not the single last-row sink', () => {
    expect(validateDungeon(retype(tiny(), 'r1c0', 'boss'), tinyEnv).join('\n')).toMatch(/exactly one boss room/)
    expect(validateDungeon(tiny({ edges: { ...tiny().edges, r3c0: ['r1c0'] } }), tinyEnv).join('\n')).toMatch(/boss 'r3c0' has successors/)
  })
  it('flags event ids drawn twice, on non-event rooms, or outside the dungeon\'s roomEvents', () => {
    const twice = retype(retype(tiny(), 'r1c0', 'event', 'blocked_passage'), 'r1c1', 'event', 'blocked_passage')
    expect(validateDungeon(twice, tinyEnv).join('\n')).toMatch(/drawn twice/)
    expect(validateDungeon(retype(tiny(), 'r1c1', 'treasure', 'blocked_passage'), tinyEnv).join('\n')).toMatch(/treasure room carries checkEventId/)
    const foreign = { ...retype(tiny(), 'r1c0', 'event', 'ancient_shrine'), dungeonId: 'smugglers_cave' }
    expect(validateDungeon(foreign, tinyEnv).join('\n')).toMatch(/not in smugglers_cave.roomEvents/)
  })
})
