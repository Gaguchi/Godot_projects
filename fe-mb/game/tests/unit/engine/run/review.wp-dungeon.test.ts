/**
 * review.wp-dungeon.test.ts — adversarial review tests for WP-DUNGEON (written by the reviewer, not the implementer).
 *
 * 1. Multi-cycle: full crawls entrance → boss → exit over EVERY shipped dungeon × seeds × two path policies, driven
 *    only through the package's public functions plus the sibling seam (`markRoomCleared` is exactly what
 *    `applyBattleResult` / `dismissCheck` call). Every input is deep-frozen (a mutation throws), the state must stay
 *    JSON-safe, `run.rng` must never move (every dungeon stream derives by label), and a crawl must replay deep-equal.
 * 2. Boundaries: a treasure room on a FULL bag parks the gear in `pendingLoot` (never discarded), still pays the purse
 *    and clears; unreachable moves (the boss from the entrance, a cleared room again, the abandoned row-0 sibling)
 *    are refused with the SAME reference and exactly one `refused`.
 * 3. [REVIEW DEFECT] re-entry after a clear: `RunState.clearedDungeons` has a writer (`markRoomCleared`) and no reader
 *    anywhere in `src/`, so a cleared dungeon can be re-entered at zero cost (no hop, no food, no day) and re-crawled
 *    for the SAME graph — another guaranteed boss drop and another 50g per treasure room, indefinitely (brief §7.8:
 *    a declaration lands with its reader). The test asserts the gate and FAILS until one lands.
 *
 * WP-OVERWORLD may still be a stub: the same `orFixture` fallback as dungeon.test.ts (see fixtures.dungeon.ts).
 */
import { describe, expect, it, vi } from 'vitest'
import { canEnterDungeon, enterDungeon, leaveDungeon, markRoomCleared, moveToRoom, reachableRooms } from '../../../../src/engine/run/dungeon'
import { refKey } from '../../../../src/engine/run/overworld'
import { createEnv } from '../../../../src/engine/content'
import { fixtureRun } from './fixtures.dungeon'
import type { Effect } from '../../../../src/engine/effects'
import type { BagEntry, DungeonGraph, DungeonRoom, RoomId, RunState } from '../../../../src/engine/types'

vi.mock('../../../../src/engine/run/overworld', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../src/engine/run/overworld')>()
  const fx = await import('./fixtures.dungeon')
  return {
    ...real,
    nodeOf: fx.orFixture(real.nodeOf, fx.nodeOf),
    isNodeLocked: fx.orFixture(real.isNodeLocked, fx.isNodeLocked),
    dungeonOf: fx.orFixture(real.dungeonOf, fx.dungeonOf),
    refKey: fx.orFixture(real.refKey, fx.refKey),
  }
})

const env = createEnv()
const cfg = env.rules.dungeon
const DUNGEONS = Object.keys(env.content.dungeons).sort()
const SEEDS = [1, 2, 3, 4, 5, 6]

/** Freeze every object reachable from `v` — any in-place mutation by the engine then throws (ES modules are strict). */
function deepFreeze<T>(v: T): T {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v)
    for (const k of Object.keys(v as object)) deepFreeze((v as Record<string, unknown>)[k])
  }
  return v
}

/** A run standing on the DUNGEON node `dungeonId`, unlocked, with a fresh run stream at `seed`. */
function at(dungeonId: string, seed: number, patch: Partial<RunState> = {}): RunState {
  return fixtureRun(env, { nodeId: dungeonId, runSeed: seed, rng: { seed, counter: 0 }, unlockedNodes: { [dungeonId]: true as const }, ...patch })
}

const graphOf = (run: RunState): DungeonGraph => run.activeDungeon!.graph
const refusals = (effects: readonly Effect[]): readonly Effect[] => effects.filter((e) => e.kind === 'refused')

/** The sibling seam: `applyBattleResult` / `dismissCheck` drop the slot and call `markRoomCleared` on the current room. */
function resolveRoom(run: RunState): { readonly state: RunState; readonly effects: readonly Effect[] } {
  const pos = run.activeDungeon!.position!
  return markRoomCleared(deepFreeze({ ...run, pendingCombat: null, pendingCheckEvent: null }), pos, env)
}

interface Step {
  readonly roomId: RoomId
  /** The state right after `moveToRoom`, before the sibling seam resolves the room. */
  readonly entered: RunState
  readonly effects: readonly Effect[]
}

/** Enter, then walk to the boss choosing the reachable room at `pick(n)`; every input deep-frozen. */
function crawl(start: RunState, pick: (n: number) => number): { readonly run: RunState; readonly steps: readonly Step[] } {
  const entered = enterDungeon(deepFreeze(start), env)
  expect(entered.effects).toEqual([{ kind: 'dungeonEntered', dungeonId: start.nodeId }])
  let run = entered.state
  const steps: Step[] = []
  for (let guard = 0; guard <= cfg.rows + 1; guard++) {
    if (run.activeDungeon!.bossCleared) break
    const next = reachableRooms(run)
    expect(next.length, `stuck at ${run.activeDungeon!.position ?? 'the entrance'}`).toBeGreaterThan(0)
    const roomId = next[pick(next.length)]!
    const moved = moveToRoom(deepFreeze(run), roomId, env)
    expect(refusals(moved.effects), `${start.nodeId}: move to ${roomId}`).toEqual([])
    const resolved = resolveRoom(moved.state)
    steps.push({ roomId, entered: moved.state, effects: [...moved.effects, ...resolved.effects] })
    run = resolved.state
  }
  return { run, steps }
}

const rightmost = (n: number): number => n - 1
const leftmost = (): number => 0

/** Row-0 → `roomId` along first predecessors, resolving each room on the way; stops BEFORE entering `roomId`. */
function walkTo(run: RunState, roomId: RoomId): RunState {
  const graph = graphOf(run)
  const pred = new Map<RoomId, RoomId>()
  for (const [from, tos] of Object.entries(graph.edges)) for (const to of tos) if (!pred.has(to)) pred.set(to, from)
  const path: RoomId[] = []
  let cur = roomId
  while (graph.rooms[cur]!.row > 0) {
    cur = pred.get(cur)!
    path.unshift(cur)
  }
  let state = run
  for (const id of path) {
    const moved = moveToRoom(deepFreeze(state), id, env)
    expect(refusals(moved.effects)).toEqual([])
    state = resolveRoom(moved.state).state
  }
  return state
}

describe('review: full crawls (multi-cycle)', () => {
  it('entrance → boss → exit over every dungeon × 6 seeds × 2 policies: frozen inputs, JSON-safe state, run.rng untouched, replay-equal', () => {
    for (const id of DUNGEONS) {
      for (const seed of SEEDS) {
        for (const pick of [rightmost, leftmost]) {
          const label = `${id} seed ${seed} ${pick === rightmost ? 'right' : 'left'}`
          const start = deepFreeze(at(id, seed))
          const a = crawl(start, pick)
          const b = crawl(start, pick)
          expect(a.run, label).toEqual(b.run) // replay-deterministic
          expect(JSON.parse(JSON.stringify(a.run)), label).toEqual(a.run) // JSON-safe: no Set/Map/undefined anywhere
          expect(a.run.rng, label).toEqual(start.rng) // no dungeon roll touches the run stream
          const graph = graphOf(a.run)

          // One room per row, rows strictly ascending 0..rows, ending on the boss.
          expect(a.steps.map((s) => graph.rooms[s.roomId]!.row), label).toEqual(graph.rows.map((_, i) => i))
          expect(a.steps[a.steps.length - 1]!.roomId, label).toBe(graph.bossId)

          // Exactly the walked rooms are visited (refKey dungeon) and cleared.
          const walked = a.steps.map((s) => s.roomId)
          expect(Object.keys(a.run.activeDungeon!.cleared).sort(), label).toEqual([...walked].sort())
          const refs = Object.keys(a.run.visitedNodes).filter((k) => k.startsWith('dungeon:'))
          expect(refs.sort(), label).toEqual(walked.map((r) => refKey('dungeon', id, r)).sort())

          for (const s of a.steps) {
            const room = graph.rooms[s.roomId]!
            const at = `${label} ${s.roomId} (${room.type})`
            expect(s.effects[0], at).toEqual({ kind: 'roomEntered', dungeonId: id, roomId: s.roomId, roomType: room.type })
            expect(s.effects[1], at).toEqual({ kind: 'locationArrived', ref: refKey('dungeon', id, s.roomId) })
            const clearedOnEntry = s.entered.activeDungeon!.cleared[s.roomId] === true
            switch (room.type) {
              case 'combat':
              case 'elite':
              case 'boss':
                expect(s.entered.pendingCombat?.origin, at).toEqual({ kind: 'dungeon', dungeonId: id, roomId: s.roomId, roomType: room.type })
                expect(s.entered.pendingCheckEvent, at).toBeNull()
                expect(clearedOnEntry, at).toBe(false) // battle rooms clear at payout, never on entry
                break
              case 'event':
                expect(s.entered.pendingCombat, at).toBeNull()
                if (room.checkEventId !== null) {
                  expect(s.entered.pendingCheckEvent, at).toEqual({ checkEventId: room.checkEventId, source: 'dungeon', result: null })
                  expect(clearedOnEntry, at).toBe(false) // clears on check/dismiss
                } else {
                  expect(s.entered.pendingCheckEvent, at).toBeNull()
                  expect(clearedOnEntry, at).toBe(true) // the flat purse self-clears
                }
                break
              case 'rest':
              case 'treasure':
                expect(s.entered.pendingCombat, at).toBeNull()
                expect(s.entered.pendingCheckEvent, at).toBeNull()
                expect(clearedOnEntry, at).toBe(true)
                break
            }
          }

          // dungeonCleared fires exactly once, at the boss, and the run remembers the clear.
          expect(a.steps.flatMap((s) => s.effects.filter((e) => e.kind === 'dungeonCleared')), label).toEqual([{ kind: 'dungeonCleared', dungeonId: id }])
          expect(a.run.clearedDungeons, label).toEqual({ [id]: true })
          expect(reachableRooms(a.run), label).toEqual([])

          // Exit: legal only now; the party stands on the dungeon node with the dungeon gone.
          const left = leaveDungeon(deepFreeze(a.run))
          expect(left.ok, label).toBe(true)
          if (left.ok) {
            expect(left.run.activeDungeon, label).toBeNull()
            expect(left.run.nodeId, label).toBe(id)
            expect(left.run.clearedDungeons, label).toEqual({ [id]: true })
            expect(JSON.parse(JSON.stringify(left.run)), label).toEqual(left.run)
          }
        }
      }
    }
  })
})

describe('review: boundaries', () => {
  it('a treasure room on a FULL bag parks the gear in pendingLoot (never discarded), still pays the purse and clears', () => {
    let found: { readonly run: RunState; readonly room: DungeonRoom } | null = null
    outer: for (const id of DUNGEONS) {
      for (const seed of SEEDS) {
        const run = enterDungeon(at(id, seed), env).state
        const room = Object.values(graphOf(run).rooms).find((r) => r.type === 'treasure')
        if (room !== undefined) {
          found = { run, room }
          break outer
        }
      }
    }
    expect(found).not.toBeNull()
    const { run, room } = found!
    const before = walkTo(run, room.id)

    // One 1×1 potion on every cell of the bag: nothing else can fit.
    const { width, height } = env.rules.bag
    const full: BagEntry[] = []
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) full.push({ itemId: 'healing_potion', x, y, charges: 1 })
    const stuffed = deepFreeze({ ...before, bag: full })

    const res = moveToRoom(stuffed, room.id, env)
    expect(refusals(res.effects)).toEqual([])
    expect(res.state.bag).toEqual(full)
    expect(res.state.pendingLoot).toHaveLength(1)
    const itemId = res.state.pendingLoot[0]!
    expect(['rare', 'epic']).toContain(env.content.items[itemId]!.rarity)
    expect(res.effects).toContainEqual({ kind: 'lootOverflow', itemIds: [itemId] })
    expect(res.effects).toContainEqual({ kind: 'goldChanged', delta: cfg.treasureGold, reason: 'treasure' })
    expect(res.state.gold).toBe(before.gold + cfg.treasureGold)
    expect(res.state.activeDungeon!.cleared[room.id]).toBe(true)
    expect(res.state.rng).toEqual(before.rng)
    expect(JSON.parse(JSON.stringify(res.state))).toEqual(res.state)
  })

  it('unreachable moves are refused with the same reference: the boss from the entrance, a cleared room again, the abandoned row-0 sibling', () => {
    const run = deepFreeze(enterDungeon(at('smugglers_cave', 3), env).state)
    const graph = graphOf(run)

    const boss = moveToRoom(run, graph.bossId, env)
    expect(boss.state).toBe(run)
    expect(boss.effects).toEqual([{ kind: 'refused', action: 'dungeon/moveTo', reason: expect.any(String) }])

    const [first, sibling] = [graph.rows[0]![0]!, graph.rows[0]![1]!]
    const cleared = deepFreeze(resolveRoom(moveToRoom(run, first, env).state).state)
    const again = moveToRoom(cleared, first, env)
    expect(again.state).toBe(cleared)
    expect(again.effects).toEqual([{ kind: 'refused', action: 'dungeon/moveTo', reason: expect.any(String) }])

    const abandoned = moveToRoom(cleared, sibling, env)
    expect(abandoned.state).toBe(cleared)
    expect(abandoned.effects).toHaveLength(1)
    expect(reachableRooms(cleared)).toEqual(graph.edges[first])

    // Re-clearing a cleared room is a no-op with the same reference (the seam may fire twice on a resumed save).
    const twice = markRoomCleared(cleared, first, env)
    expect(twice.state).toBe(cleared)
    expect(twice.effects).toEqual([])
  })
})

describe('review: [DEFECT] cleared dungeons', () => {
  it('a cleared dungeon cannot be re-entered to farm its boss and treasure again (clearedDungeons needs a reader)', () => {
    const start = at('smugglers_cave', 2)
    const first = crawl(start, rightmost)
    const left = leaveDungeon(first.run)
    expect(left.ok).toBe(true)
    if (!left.ok) return
    expect(left.run.clearedDungeons).toEqual({ smugglers_cave: true })

    // Re-entry costs nothing (no hop, no food, no day) and the graph is a pure function of (runSeed, dungeonId), so
    // the same boss room (a guaranteed epic at tier 1) and the same treasure rooms (+50g each) are one click away.
    const gate = canEnterDungeon(left.run, env)
    expect(gate.ok, 'a cleared dungeon must refuse dungeon/enter with a reason: its boss drop is guaranteed and re-entry is free').toBe(false)
  })
})
