import { describe, expect, it, vi } from 'vitest'
import { DESCENT_IS_ONE_WAY, EMPTY_ROOM_TEXT, canEnterDungeon, descentIsOpen, enterDungeon, leaveDungeon, markRoomCleared, moveToRoom, reachableRooms } from '../../../../src/engine/run/dungeon'
import { generateDungeon } from '../../../../src/engine/procgen/dungeonGraph'
import { dungeonTier, enemyLevelFor } from '../../../../src/engine/run/difficulty'
import { lootPool, lootRowFor, rollLoot } from '../../../../src/engine/run/loot'
import { foodCount } from '../../../../src/engine/run/bag'
import { refKey } from '../../../../src/engine/run/overworld'
import { createEnv } from '../../../../src/engine/content'
import { deriveState } from '../../../../src/engine/rngState'
import { rngLabels } from '../../../../src/engine/rules'
import { fixtureRun, fixtureUnit } from './fixtures.dungeon'
import type { DungeonGraph, DungeonRoom, RoomId, RunState } from '../../../../src/engine/types'

// WP-OVERWORLD may still be a stub: fall back to contract-shaped fixtures ONLY on a TODO throw (see fixtures.dungeon.ts).
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
// A spy on the real `rollLoot`, so the treasure test can prove WHICH stream the roll came from.
vi.mock('../../../../src/engine/run/loot', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../src/engine/run/loot')>()
  return { ...real, rollLoot: vi.fn(real.rollLoot) }
})

const env = createEnv()
const defs = Object.values(env.content.dungeons)
const cfg = env.rules.dungeon
const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1)

/** A run standing on the DUNGEON node `dungeonId` (unlocked, so the gate is about the node, not the lock). */
function at(dungeonId: string, seed = 12345, patch: Partial<RunState> = {}): RunState {
  return fixtureRun(env, { nodeId: dungeonId, runSeed: seed, rng: { seed, counter: 0 }, unlockedNodes: { [dungeonId]: true as const }, ...patch })
}

function inside(dungeonId: string, seed = 12345, patch: Partial<RunState> = {}): RunState {
  const res = enterDungeon(at(dungeonId, seed, patch), env)
  expect(res.effects.find((e) => e.kind === 'refused')).toBeUndefined()
  return res.state
}

const graphOf = (run: RunState): DungeonGraph => run.activeDungeon!.graph
const roomsOf = (run: RunState): readonly DungeonRoom[] => Object.values(graphOf(run).rooms)
const noRefusal = (effects: readonly { kind: string }[]) => expect(effects.find((e) => e.kind === 'refused')).toBeUndefined()

/** Row-0 → `roomId` along first predecessors. */
function pathTo(graph: DungeonGraph, roomId: RoomId): RoomId[] {
  const pred = new Map<RoomId, RoomId>()
  for (const [from, tos] of Object.entries(graph.edges)) for (const to of tos) if (!pred.has(to)) pred.set(to, from)
  const path = [roomId]
  let cur = roomId
  while (graph.rooms[cur]!.row > 0) {
    cur = pred.get(cur)!
    path.unshift(cur)
  }
  return path
}

/** What other packages do after a room resolves (battle payout / narration close): drop the slot, mark it cleared. */
function settle(run: RunState): RunState {
  return markRoomCleared({ ...run, pendingCombat: null, pendingCheckEvent: null }, run.activeDungeon!.position!, env).state
}

/** Move + settle through every room on the first path to `roomId`, stopping BEFORE entering it. */
function approach(run: RunState, roomId: RoomId): RunState {
  let cur = run
  for (const id of pathTo(graphOf(run), roomId).slice(0, -1)) {
    const res = moveToRoom(cur, id, env)
    noRefusal(res.effects)
    cur = settle(res.state)
  }
  return cur
}

/** The first (dungeon, seed) whose graph holds a room matching `pred`. */
function findRoom(pred: (r: DungeonRoom) => boolean, dungeonIds: readonly string[] = defs.map((d) => d.id), patch: Partial<RunState> = {}): { run: RunState; room: DungeonRoom } {
  for (const id of dungeonIds) {
    for (const seed of SEEDS) {
      const run = inside(id, seed, patch)
      const room = graphOf(run).rows.flat().map((rid) => graphOf(run).rooms[rid]!).find(pred)
      if (room !== undefined) return { run, room }
    }
  }
  throw new Error('no dungeon/seed produced such a room')
}

/**
 * A room the DECK did not reach. Every shipped dungeon now authors `rules.dungeon.minRoomEvents` events (0108), so
 * a graph that outruns its deck is rare by design — the generator side of that is measured in
 * `tests/unit/engine/procgen/dungeonGraph.test.ts`. The graph is ordinary state, so the reducer's fallback path is
 * driven here by handing it the room the deck ran out on.
 */
function exhausted(found: { run: RunState; room: DungeonRoom }): { run: RunState; room: DungeonRoom } {
  const room: DungeonRoom = { ...found.room, checkEventId: null }
  const d = found.run.activeDungeon!
  const run: RunState = { ...found.run, activeDungeon: { ...d, graph: { ...d.graph, rooms: { ...d.graph.rooms, [room.id]: room } } } }
  return { run, room }
}

describe('canEnterDungeon', () => {
  it('refuses when the current node is not a DUNGEON', () => {
    const gate = canEnterDungeon(fixtureRun(env), env)
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.reason).toMatch(/not a dungeon/)
  })

  it('a locked dungeon refuses dungeon/enter with a reason until unlockNode', () => {
    const node = env.content.overworld.nodes.find((n) => n.id === 'smugglers_cave')!
    expect(node.locked).toBe(true)
    const locked = fixtureRun(env, { nodeId: 'smugglers_cave' })
    const gate = canEnterDungeon(locked, env)
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.reason).toMatch(/sealed/)
    const res = enterDungeon(locked, env)
    expect(res.state).toBe(locked)
    expect(res.effects).toEqual([{ kind: 'refused', action: 'dungeon/enter', reason: expect.any(String) }])

    // `unlockNode smugglers_cave` (Blood Ties, find_daren.onEnter) is the only writer of `unlockedNodes`.
    const unlocked = { ...locked, unlockedNodes: { smugglers_cave: true as const } }
    const open = canEnterDungeon(unlocked, env)
    expect(open.ok).toBe(true)
    if (open.ok) expect(open.def.id).toBe('smugglers_cave')
    expect(enterDungeon(unlocked, env).state.activeDungeon?.dungeonId).toBe('smugglers_cave')
  })

  it('an unlocked DUNGEON node enters directly and refuses re-entry while inside', () => {
    const run = fixtureRun(env, { nodeId: 'iron_mine' })
    const gate = canEnterDungeon(run, env)
    expect(gate.ok).toBe(true)
    const entered = enterDungeon(run, env).state
    const again = canEnterDungeon(entered, env)
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.reason).toMatch(/inside/)
  })
})

describe('enterDungeon', () => {
  it('generates the graph from deriveState(run.rng, rngLabels.dungeon(id)), parks the party at the entrance and leaves run.rng untouched', () => {
    for (const def of defs) {
      const run = at(def.id)
      const res = enterDungeon(run, env)
      expect(res.effects).toEqual([{ kind: 'dungeonEntered', dungeonId: def.id }])
      const d = res.state.activeDungeon!
      expect(d.dungeonId).toBe(def.id)
      expect(d.position).toBeNull()
      expect(d.cleared).toEqual({})
      expect(d.bossCleared).toBe(false)
      expect(d.graph).toEqual(generateDungeon(deriveState(run.rng, rngLabels.dungeon(def.id)), def, env).graph)
      expect(res.state.rng).toEqual(run.rng)
    }
  })

  it('is deterministic per (runSeed, dungeonId) and two dungeon ids differ', () => {
    expect(graphOf(inside('smugglers_cave', 5))).toEqual(graphOf(inside('smugglers_cave', 5)))
    expect(graphOf(inside('smugglers_cave', 5))).not.toEqual(graphOf(inside('iron_mine', 5)))
    expect(graphOf(inside('smugglers_cave', 5))).not.toEqual(graphOf(inside('smugglers_cave', 6)))
  })
})

describe('reachableRooms / moveToRoom', () => {
  it('offers the row-0 rooms at the entrance and refuses any other room with the same reference', () => {
    const run = inside('thornwood_depths')
    expect(reachableRooms(run)).toEqual(graphOf(run).rows[0])
    const deeper = graphOf(run).rows[1]![0]!
    const res = moveToRoom(run, deeper, env)
    expect(res.state).toBe(run)
    expect(res.effects).toEqual([{ kind: 'refused', action: 'dungeon/moveTo', reason: expect.any(String) }])
    expect(moveToRoom(run, 'r9c9', env).state).toBe(run)
    expect(moveToRoom(fixtureRun(env), 'r0c0', env).effects).toEqual([{ kind: 'refused', action: 'dungeon/moveTo', reason: expect.any(String) }])
    expect(reachableRooms(fixtureRun(env))).toEqual([])
  })

  it('entering a room marks it visited (refKey dungeon) and emits roomEntered then locationArrived', () => {
    const run = inside('ancient_ruins')
    const roomId = graphOf(run).rows[0]![0]!
    const res = moveToRoom(run, roomId, env)
    const ref = refKey('dungeon', 'ancient_ruins', roomId)
    expect(res.state.activeDungeon!.position).toBe(roomId)
    expect(res.state.visitedNodes[ref]).toBe(true)
    expect(res.effects[0]).toEqual({ kind: 'roomEntered', dungeonId: 'ancient_ruins', roomId, roomType: 'combat' })
    expect(res.effects[1]).toEqual({ kind: 'locationArrived', ref })
  })

  it('nothing is reachable until the current room is cleared; clearing opens exactly its successors', () => {
    const run = inside('obsidian_cavern')
    const roomId = graphOf(run).rows[0]![0]!
    const entered = moveToRoom(run, roomId, env).state
    expect(reachableRooms(entered)).toEqual([])
    // The reason is READ by the player, so it names no grid code (ARCHITECTURE §5.1; CONTRACT-CHANGES 0093).
    const blocked = moveToRoom(entered, graphOf(run).edges[roomId]![0]!, env).effects[0]
    expect(blocked).toMatchObject({ kind: 'refused', reason: 'this room is not settled yet' })
    const cleared = markRoomCleared({ ...entered, pendingCombat: null }, roomId, env)
    expect(cleared.effects).toEqual([])
    expect(cleared.state.activeDungeon!.cleared).toEqual({ [roomId]: true })
    expect(reachableRooms(cleared.state)).toEqual(graphOf(run).edges[roomId])
  })

  it('victory in a combat room returns to the dungeon: the run stays inside and leaving is refused', () => {
    const run = inside('smugglers_cave')
    const roomId = graphOf(run).rows[0]![1]!
    const after = settle(moveToRoom(run, roomId, env).state)
    expect(after.activeDungeon).not.toBeNull()
    expect(after.activeDungeon!.position).toBe(roomId)
    expect(after.activeDungeon!.bossCleared).toBe(false)
    expect(leaveDungeon(after)).toEqual({ ok: false, reason: expect.stringMatching(/boss/) })
  })
})

describe('room contents per dungeon', () => {
  for (const def of defs) {
    it(`entering from node ${def.id} loads dungeon ${def.id}'s groups and roomEvents`, () => {
      // Combat: the def's combat group, the dungeon origin, a tier-scaled level, no capture targets.
      const run = inside(def.id)
      const first = graphOf(run).rows[0]![0]!
      const combat = moveToRoom(run, first, env).state.pendingCombat
      expect(combat).toEqual({
        origin: { kind: 'dungeon', dungeonId: def.id, roomId: first, roomType: 'combat' },
        enemies: { kind: 'group', enemyGroupId: def.combatEnemyGroupId, level: enemyLevelFor(dungeonTier(def, env), `${def.id}:${first}`, env) },
        captureTargets: [],
      })
      expect(env.content.enemyGroups[def.combatEnemyGroupId]).toBeDefined()

      // Events: only this dungeon's deck, never another dungeon's.
      for (const seed of SEEDS.slice(0, 30)) {
        for (const r of roomsOf(inside(def.id, seed))) {
          if (r.type === 'event' && r.checkEventId !== null) expect(def.roomEvents).toContain(r.checkEventId)
        }
      }

      // Elite: reached by walking a path to it.
      const elite = findRoom((r) => r.type === 'elite', [def.id])
      const eliteCombat = moveToRoom(approach(elite.run, elite.room.id), elite.room.id, env).state.pendingCombat
      expect(eliteCombat).toMatchObject({
        origin: { kind: 'dungeon', dungeonId: def.id, roomId: elite.room.id, roomType: 'elite' },
        enemies: { kind: 'group', enemyGroupId: def.eliteEnemyGroupId },
      })

      // Boss: the sink room queues the boss group.
      const bossId = graphOf(run).bossId
      const bossCombat = moveToRoom(approach(run, bossId), bossId, env).state.pendingCombat
      expect(bossCombat).toMatchObject({
        origin: { kind: 'dungeon', dungeonId: def.id, roomId: bossId, roomType: 'boss' },
        enemies: { kind: 'group', enemyGroupId: def.bossEnemyGroupId },
      })
    })
  }
})

describe('level scaling', () => {
  it("dungeon enemies are level-scaled to the dungeon region's tier band", () => {
    const bands = env.rules.difficulty.levelBand
    for (const def of defs) {
      const tier = env.content.regions[def.regionId]!.tier
      expect(dungeonTier(def, env)).toBe(tier)
      for (const seed of SEEDS.slice(0, 10)) {
        const run = inside(def.id, seed)
        for (const roomId of graphOf(run).rows[0]!) {
          const enemies = moveToRoom(run, roomId, env).state.pendingCombat!.enemies
          expect(enemies.kind).toBe('group')
          if (enemies.kind !== 'group') continue
          expect(enemies.level).toBeGreaterThanOrEqual(bands[tier][0])
          expect(enemies.level).toBeLessThanOrEqual(bands[tier][1])
        }
      }
    }
    // The bands actually differ across the shipped dungeons (tier 1 borderlands vs tier 3 ashfall).
    expect(dungeonTier(env.content.dungeons['smugglers_cave']!, env)).toBe(1)
    expect(dungeonTier(env.content.dungeons['iron_mine']!, env)).toBe(3)
  })
})

describe('rest room', () => {
  it('the rest room heals rules.dungeon.restHealFraction of max for no food', () => {
    const units = [fixtureUnit(env, 'mc', 'lord', 1), fixtureUnit(env, 'oak', 'knight', 1), fixtureUnit(env, 'lilina', 'mage', 1)]
    const run = inside('ancient_ruins', 3, { party: Object.fromEntries(units.map((u) => [u.id, u])) })
    const restId = graphOf(run).rows[cfg.rows - 1]![0]!
    expect(graphOf(run).rooms[restId]!.type).toBe('rest')
    const before = approach(run, restId)
    const res = moveToRoom(before, restId, env)
    noRefusal(res.effects)
    // The FRACTION is tuning (0055 raised it); what this pins is that the room heals by it and charges no food.
    expect(cfg.restHealFraction).toBeGreaterThan(0)
    expect(cfg.restFoodCost).toBe(0)
    for (const u of Object.values(res.state.party)) {
      const was = before.party[u.id]!.hp.current
      expect(u.hp.current).toBe(Math.min(u.hp.max, was + Math.floor(u.hp.max * cfg.restHealFraction)))
      expect(u.hp.current).toBeGreaterThan(was)
    }
    expect(res.state.bag).toEqual(before.bag)
    expect(foodCount(res.state.bag, env)).toBe(foodCount(before.bag, env))
    expect(res.effects).toContainEqual({ kind: 'partyHealed', unitIds: units.map((u) => u.id), reason: 'dungeonRest' })
    expect(res.state.activeDungeon!.cleared[restId]).toBe(true)
    expect(reachableRooms(res.state)).toEqual([graphOf(run).bossId])
  })
})

describe('treasure room', () => {
  it('the treasure room grants gear + 50g from rngLabels.treasure', () => {
    const { run, room } = findRoom((r) => r.type === 'treasure')
    const def = env.content.dungeons[run.activeDungeon!.dungeonId]!
    const before = approach(run, room.id)
    vi.mocked(rollLoot).mockClear()
    const res = moveToRoom(before, room.id, env)
    noRefusal(res.effects)

    expect(cfg.treasureGold).toBe(50)
    expect(res.state.gold).toBe(before.gold + cfg.treasureGold)
    expect(res.effects).toContainEqual({ kind: 'goldChanged', delta: cfg.treasureGold, reason: 'treasure' })
    // GATE3-02: treasure is one of the six sources the run ledger's 'gold earned' used to walk past.
    expect(res.state.stats.goldEarned).toBe(before.stats.goldEarned + cfg.treasureGold)

    // The roll came from the treasure label off the run SEED, not from a battle label and not from run.rng's position.
    const stream = deriveState(before.rng, rngLabels.treasure(def.id, room.id))
    expect(vi.mocked(rollLoot)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(rollLoot).mock.calls[0]![2]).toEqual(stream)
    expect(vi.mocked(rollLoot).mock.calls[0]![3]).toBe(env)
    expect(res.state.rng).toEqual(before.rng)

    const expected = rollLoot(lootRowFor('dungeonTreasure', dungeonTier(def, env), env), lootPool(before, 'dungeonTreasure', env), stream, env)
    expect(expected.itemIds).toHaveLength(1)
    const itemId = expected.itemIds[0]!
    const item = env.content.items[itemId]!
    expect(['rare', 'epic']).toContain(item.rarity)
    const beforeIds = before.bag.map((e) => e.itemId)
    const gained = [...res.state.bag.map((e) => e.itemId).filter((id, i, all) => all.indexOf(id) === i && !beforeIds.includes(id)), ...res.state.pendingLoot]
    expect(gained).toEqual([itemId])
    expect(res.effects).toContainEqual({ kind: 'itemAcquired', itemId, rarity: item.rarity, source: 'treasure' })
    expect(res.state.stats.gearFound).toBe(before.stats.gearFound + 1)
    expect(res.state.activeDungeon!.cleared[room.id]).toBe(true)
  })
})

describe('event room', () => {
  it('an event room opens its check event from roomEvents (source dungeon) and clears only on dismiss', () => {
    const { run, room } = findRoom((r) => r.type === 'event' && r.checkEventId !== null, ['smugglers_cave', 'ancient_ruins'])
    const def = env.content.dungeons[run.activeDungeon!.dungeonId]!
    expect(def.roomEvents).toContain(room.checkEventId)
    const before = approach(run, room.id)
    const res = moveToRoom(before, room.id, env)
    noRefusal(res.effects)
    expect(res.state.pendingCheckEvent).toEqual({ checkEventId: room.checkEventId, source: 'dungeon', result: null })
    expect(res.state.gold).toBe(before.gold)
    expect(res.state.activeDungeon!.cleared[room.id]).toBeUndefined()
    expect(reachableRooms(res.state)).toEqual([])
    // `run/checks.ts#dismissCheck` (source 'dungeon') calls markRoomCleared on the current room.
    const done = markRoomCleared({ ...res.state, pendingCheckEvent: null }, room.id, env).state
    expect(done.activeDungeon!.cleared[room.id]).toBe(true)
    expect(reachableRooms(done)).toEqual(graphOf(run).edges[room.id])
  })

  it('an event room with no authored event pays rules.dungeon.eventGoldFallback flat and clears itself', () => {
    // Every shipped dungeon ships an event deck, so the fallback is reached by EXHAUSTING it: a graph with more
    // event rooms than authored events leaves the tail rooms with `checkEventId: null`.
    expect(env.content.dungeons['iron_mine']!.roomEvents.length).toBeGreaterThan(0)
    const { run, room } = exhausted(findRoom((r) => r.type === 'event' && r.checkEventId !== null, ['iron_mine']))
    expect(room.checkEventId).toBeNull()
    const before = approach(run, room.id)
    const res = moveToRoom(before, room.id, env)
    noRefusal(res.effects)
    expect(res.state.pendingCheckEvent).toBeNull()
    expect(res.state.gold).toBe(before.gold + cfg.eventGoldFallback)
    expect(res.effects).toContainEqual({ kind: 'goldChanged', delta: cfg.eventGoldFallback, reason: 'event' })
    expect(res.state.stats.goldEarned).toBe(before.stats.goldEarned + cfg.eventGoldFallback)
    expect(res.state.activeDungeon!.cleared[room.id]).toBe(true)
    expect(reachableRooms(res.state)).toEqual(graphOf(run).edges[room.id])
  })

  it('...and says so: the room the purse moves in is never a silent one', () => {
    // Every other room type announces itself — a fight, a check overlay, wounds closing, gear in the bag. This one
    // emitted `goldChanged` alone, so the player walked into a room, the purse changed, and there was nothing at
    // all to read. `toast` is the engine's one channel for a line no panel owns.
    const { run, room } = exhausted(findRoom((r) => r.type === 'event' && r.checkEventId !== null, ['iron_mine']))
    const res = moveToRoom(approach(run, room.id), room.id, env)
    const spoken = res.effects.filter((e) => e.kind === 'toast')
    expect(spoken).toEqual([{ kind: 'toast', text: EMPTY_ROOM_TEXT }])
    // the line comes before the coin moves, so the reason is on screen with the number
    expect(res.effects.findIndex((e) => e.kind === 'toast')).toBeLessThan(res.effects.findIndex((e) => e.kind === 'goldChanged'))
    // an AUTHORED event room still speaks through its overlay, not through a toast
    const authoredRoom = findRoom((r) => r.type === 'event' && r.checkEventId !== null, ['smugglers_cave', 'ancient_ruins'])
    const opened = moveToRoom(approach(authoredRoom.run, authoredRoom.room.id), authoredRoom.room.id, env)
    expect(opened.effects.some((e) => e.kind === 'toast')).toBe(false)
    expect(opened.state.pendingCheckEvent).not.toBeNull()
  })
})

describe('boss row + exit', () => {
  it('the boss room queues the boss group under origin roomType boss (the dungeon:boss loot row) and the exit opens only once it is cleared', () => {
    const run = inside('smugglers_cave')
    const def = env.content.dungeons['smugglers_cave']!
    const bossId = graphOf(run).bossId
    const before = approach(run, bossId)
    expect(graphOf(run).rooms[before.activeDungeon!.position!]!.type).toBe('rest')
    const res = moveToRoom(before, bossId, env)
    noRefusal(res.effects)
    expect(res.state.pendingCombat).toEqual({
      origin: { kind: 'dungeon', dungeonId: 'smugglers_cave', roomId: bossId, roomType: 'boss' },
      enemies: { kind: 'group', enemyGroupId: def.bossEnemyGroupId, level: enemyLevelFor(dungeonTier(def, env), `smugglers_cave:${bossId}`, env) },
      captureTargets: def.bossCaptureTargets ?? [],
    })
    // Shipped content names nobody here — Daren has ONE home (his camp), so the cave fields its own crew — but the
    // BOSS row is still the only room that reads `bossCaptureTargets` (CONTRACT-CHANGES 0030), proved on a patch.
    expect(def.bossCaptureTargets).toBeUndefined()
    const named = { unitId: 'daren', capturedDialogueId: 'sq_blood_ties_daren_captured', killedDialogueId: 'sq_blood_ties_daren_killed', capturedFlag: 'daren_captured', killedFlag: 'daren_killed' } as const
    const namedEnv = createEnv({
      ...env.content,
      dungeons: { ...env.content.dungeons, smugglers_cave: { ...def, bossEnemyGroupId: 'darens_gang', bossCaptureTargets: [named] } },
    })
    const namedRun = enterDungeon(at('smugglers_cave'), namedEnv).state
    const namedBoss = graphOf(namedRun).bossId
    const namedRes = moveToRoom(approach(namedRun, namedBoss), namedBoss, namedEnv)
    expect(namedRes.state.pendingCombat?.captureTargets).toEqual([named])
    const namedPlain = Object.values(graphOf(namedRun).rooms).find((r) => r.type === 'combat')!
    expect(moveToRoom(approach(namedRun, namedPlain.id), namedPlain.id, namedEnv).state.pendingCombat?.captureTargets).toEqual([])
    // an ordinary combat room in the same dungeon names nobody
    const plain = Object.values(graphOf(run).rooms).find((r) => r.type === 'combat')!
    expect(moveToRoom(approach(run, plain.id), plain.id, env).state.pendingCombat?.captureTargets).toEqual([])
    // `battleSpecFor` maps roomType 'boss' to tag 'dungeon:boss', whose loot row is guaranteed at every tier.
    expect(env.rules.loot.rows['dungeon:boss'][dungeonTier(def, env)].chance).toBe(1)
    expect(res.state.activeDungeon!.bossCleared).toBe(false)
    expect(leaveDungeon(res.state).ok).toBe(false)

    const cleared = markRoomCleared({ ...res.state, pendingCombat: null }, bossId, env)
    expect(cleared.effects).toEqual([{ kind: 'dungeonCleared', dungeonId: 'smugglers_cave' }])
    expect(cleared.state.activeDungeon!.bossCleared).toBe(true)
    expect(cleared.state.activeDungeon!.cleared[bossId]).toBe(true)
    expect(cleared.state.clearedDungeons).toEqual({ smugglers_cave: true })
    expect(reachableRooms(cleared.state)).toEqual([])
    // Idempotent: a second clear is a no-op with the same reference and no second `dungeonCleared`.
    const again = markRoomCleared(cleared.state, bossId, env)
    expect(again.state).toBe(cleared.state)
    expect(again.effects).toEqual([])

    const left = leaveDungeon(cleared.state)
    expect(left.ok).toBe(true)
    if (left.ok) {
      expect(left.run.activeDungeon).toBeNull()
      expect(left.run.clearedDungeons).toEqual({ smugglers_cave: true })
      expect(left.run.nodeId).toBe('smugglers_cave')
    }
  })

  it('leaveDungeon is legal at the entrance and refused mid-crawl', () => {
    const run = inside('iron_mine')
    const atEntrance = leaveDungeon(run)
    expect(atEntrance.ok).toBe(true)
    if (atEntrance.ok) expect(atEntrance.run.activeDungeon).toBeNull()
    const moved = moveToRoom(run, graphOf(run).rows[0]![0]!, env).state
    expect(leaveDungeon(moved)).toEqual({ ok: false, reason: expect.stringMatching(/boss/) })
    expect(leaveDungeon(fixtureRun(env))).toEqual({ ok: false, reason: expect.any(String) })
  })

  /**
   * RE-GATE C 3.12: the descent is a one-way door and NOTHING said so before it. `descentIsOpen` is the reading
   * the three warning surfaces share (node card, the mouth, the headless node menu) and it has to be the exact
   * complement of `leaveDungeon`'s rule, or a warning would stand beside a door that is already shut.
   */
  it('descentIsOpen answers exactly where leaveDungeon does, so the warning stands only while the door is open', () => {
    const run = inside('iron_mine')
    expect(descentIsOpen(run)).toBe(true)
    expect(leaveDungeon(run).ok).toBe(true)
    const moved = moveToRoom(run, graphOf(run).rows[0]![0]!, env).state
    expect(descentIsOpen(moved)).toBe(false)
    expect(leaveDungeon(moved).ok).toBe(false)
    // outside a dungeon there is no door to warn about
    expect(descentIsOpen(fixtureRun(env))).toBe(true)
  })

  it('the warning is a whole sentence of body prose, and the refusal is still a fragment', () => {
    // ARCHITECTURE §5.1: a refusal is a lowercase fragment with no stop; this one stands beside a LEGAL verb, so
    // it is prose in its own right and reads as a sentence.
    expect(DESCENT_IS_ONE_WAY).toMatch(/^[A-Z].*\.$/)
    const run = inside('iron_mine')
    const shut = leaveDungeon(moveToRoom(run, graphOf(run).rows[0]![0]!, env).state)
    expect(shut.ok).toBe(false)
    if (!shut.ok) expect(shut.reason).toMatch(/^[a-z].*[^.]$/)
  })

  it('markRoomCleared throws outside a dungeon or for an unknown room (programmer errors, never player input)', () => {
    expect(() => markRoomCleared(fixtureRun(env), 'r0c0', env)).toThrow(/no active dungeon/)
    expect(() => markRoomCleared(inside('iron_mine'), 'r9c9', env)).toThrow(/no room 'r9c9'/)
  })
})
