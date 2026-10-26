/**
 * run/dungeon.ts — the run side of the crawl (brief §2.11, §7.18). ONE dungeon registry (content); the overworld
 * node id IS the dungeon id and threads end to end: `canEnterDungeon` reads the def by `run.nodeId`, the graph is
 * generated from `rngLabels.dungeon(id)`, every room's battle carries `origin { kind: 'dungeon', dungeonId, roomId }`
 * and `battleEnd/dismiss` routes back here by that origin (§7.18: never again "every dungeon opens Smuggler's Cave").
 *
 * Pure over `RunState`: every function returns a new run (or the SAME reference plus one `refused` when a player
 * action is illegal — the reducer contract, actions.ts). Room contents resolve on ENTRY (`moveToRoom`): combat /
 * elite / boss park a `pendingCombat` for `flow/settle.ts` to seed; an event room opens its check event; rest and
 * treasure pay out immediately and clear themselves. Battle and event rooms are cleared later by the packages that
 * resolve them (`run/battle.ts#applyBattleResult`, `run/checks.ts#dismissCheck`) through `markRoomCleared`.
 */
import type { SliceResult } from '../actions'
import type { ActionType } from '../actions'
import type { Effect } from '../effects'
import type { ActiveDungeon, DungeonDef, DungeonRoom, EngineEnv, PendingCombat, RoomId, RoomType, RunState } from '../types'
import { rngLabels } from '../rules'
import { deriveState } from '../rngState'
import { generateDungeon, successors } from '../procgen/dungeonGraph'
import { dungeonOf, isNodeLocked, nodeOf, refKey } from './overworld'
import { dungeonTier, enemyLevelFor } from './difficulty'
import { healParty } from './party'
import { consumeFood } from './bag'
import { grantLoot, lootPool, lootRowFor, rollLoot } from './loot'
import { addGold } from './economy'
import { openCheckEvent } from './checks'

/** What an event room with nothing authored left in its deck says for itself (see `moveToRoom`, case 'event'). */
export const EMPTY_ROOM_TEXT = 'Picked over long before you — but there are coins in the ash of the fire pit.'

/**
 * The one-way door, said BEFORE it (RE-GATE C 3.12). `leaveDungeon` refuses with "the only way out is through the
 * boss" from the moment `position !== null`, so stepping into the FIRST room commits the company to the whole
 * descent — no inn, no camp, no retreat — and nothing anywhere said so beforehand: the quick menu's Enter was
 * fully lit and the screen's only warning was about money. A player walked in with the mage at 3 HP.
 *
 * This is a WARNING, not a refusal: it is printed beside a legal control, so it is body prose (a whole sentence,
 * ARCHITECTURE §5.1) rather than a lowercase fragment. It has one home and three readers — the node card, the
 * mouth of the descent, and the headless node menu.
 */
export const DESCENT_IS_ONE_WAY = 'Step past the first room and the only way out is through whatever waits at the bottom.'

/** Is the company still free to turn around? True at the mouth and once the boss has fallen — the two states
 *  `leaveDungeon` allows. Read by the surfaces that warn, so the warning and the rule cannot drift. */
export function descentIsOpen(run: RunState): boolean {
  const d = run.activeDungeon
  return d === null || d.position === null || d.bossCleared
}

function refused(run: RunState, action: ActionType, reason: string): SliceResult<RunState> {
  return { state: run, effects: [{ kind: 'refused', action, reason }] }
}

/** Current node is a DUNGEON with a def, not already inside, and not locked: `node.locked && !run.unlockedNodes[node.id]`
 *  ⇒ `{ ok: false, reason }` (the quick menu renders it; `unlockNode` is the only writer — brief §2.11). */
export function canEnterDungeon(run: RunState, env: EngineEnv): { readonly ok: true; readonly def: DungeonDef } | { readonly ok: false; readonly reason: string } {
  const node = nodeOf(run.nodeId, env)
  if (node.type !== 'DUNGEON') return { ok: false, reason: `${node.name} is not a dungeon` }
  const def = dungeonOf(run, env)
  if (def === null) return { ok: false, reason: `${node.name} has no dungeon` }
  // The dungeon's NAME, never its id: a refusal reason is read by the player (ARCHITECTURE §5.1).
  if (run.activeDungeon !== null) return { ok: false, reason: `already inside ${env.content.dungeons[run.activeDungeon.dungeonId]?.name ?? node.name}` }
  // Locked = sealed until a quest opens it (Smuggler's Cave via Blood Ties). Visible and traversable on the map;
  // only the way IN is refused, with a reason the quick menu can show as disabled-with-reason.
  if (isNodeLocked(run, node)) return { ok: false, reason: `${node.name} is sealed — there is no way in yet` }
  // Cleared = the boss fell: its guaranteed drop and treasure are gone with it. Re-entry costs no hop or food and the
  // graph is a pure function of (runSeed, dungeonId), so an open door would be a farm (review WP-DUNGEON).
  if (run.clearedDungeons[def.id] === true) return { ok: false, reason: `${node.name} is cleared — nothing left to take` }
  return { ok: true, def }
}

/** graph = generateDungeon(deriveState(run.rng, rngLabels.dungeon(id)), def, env); position null; `dungeonEntered`.
 *  `run.rng` is NOT advanced: the dungeon stream derives from the run SEED by label (§2.14), which is exactly what
 *  makes the graph a function of (runSeed, dungeonId) rather than of everything the player did before entering. */
export function enterDungeon(run: RunState, env: EngineEnv): SliceResult<RunState> {
  const gate = canEnterDungeon(run, env)
  if (!gate.ok) return refused(run, 'dungeon/enter', gate.reason)
  const { graph } = generateDungeon(deriveState(run.rng, rngLabels.dungeon(gate.def.id)), gate.def, env)
  const activeDungeon: ActiveDungeon = { dungeonId: gate.def.id, graph, position: null, cleared: {}, bossCleared: false }
  return { state: { ...run, activeDungeon }, effects: [{ kind: 'dungeonEntered', dungeonId: gate.def.id }] }
}

/**
 * What a room is, in the words the player reads — a `RoomId` is a raw grid code (`r0c1`) and ARCHITECTURE §5.1
 * bans one in copy. `ui/screens/Dungeon.tsx` and the headless descent both label a room from here, so the chart
 * and the terminal never call the same room two things (CONTRACT-CHANGES 0093).
 */
export const ROOM_LABEL: Readonly<Record<RoomType, string>> = {
  combat: 'a fight',
  elite: 'an elite',
  event: 'something',
  treasure: 'treasure',
  rest: 'a rest',
  boss: 'the boss',
}

/** Row-0 rooms at the entrance; graph successors otherwise — only once the current room is cleared. */
export function reachableRooms(run: RunState): readonly RoomId[] {
  const d = run.activeDungeon
  if (d === null) return []
  if (d.position === null) return successors(d.graph, null)
  if (d.cleared[d.position] !== true) return []
  return successors(d.graph, d.position)
}

function groupFor(def: DungeonDef, roomType: 'combat' | 'elite' | 'boss'): string {
  switch (roomType) {
    case 'combat': return def.combatEnemyGroupId
    case 'elite': return def.eliteEnemyGroupId
    case 'boss': return def.bossEnemyGroupId
  }
}

/** Successor check → position = room → visited (refKey dungeon) → `roomEntered`/`locationArrived` →
 *  combat/elite/boss → pendingCombat{origin dungeon, enemies: group per def}; event → pendingCheckEvent{source dungeon}
 *  (or `rules.dungeon.eventGoldFallback` flat when the room has no event); rest → healParty(restHealFraction) free + cleared;
 *  treasure → `rollLoot(lootRowFor('dungeonTreasure', tier), lootPool(run, 'dungeonTreasure'), deriveState(run.rng,
 *  rngLabels.treasure(dungeonId, roomId)))` → grantLoot('treasure') + treasureGold + cleared. */
export function moveToRoom(run: RunState, roomId: RoomId, env: EngineEnv): SliceResult<RunState> {
  const d = run.activeDungeon
  if (d === null) return refused(run, 'dungeon/moveTo', 'not inside a dungeon')
  const room: DungeonRoom | undefined = d.graph.rooms[roomId]
  if (room === undefined) return refused(run, 'dungeon/moveTo', 'there is no such room down here')
  if (!reachableRooms(run).includes(roomId)) {
    // Words, not the grid code: a `RoomId` is `r3c2` and a refusal reason is read by the player (ARCHITECTURE
    // §5.1). These are the two sentences `ui/screens/Dungeon.tsx` already puts under an unreachable mark.
    const reason = d.position !== null && d.cleared[d.position] !== true
      ? 'this room is not settled yet'
      : 'no way through to there from this room'
    return refused(run, 'dungeon/moveTo', reason)
  }
  const def = env.content.dungeons[d.dungeonId]
  if (def === undefined) throw new Error(`moveToRoom: unknown dungeon '${d.dungeonId}'`)

  const ref = refKey('dungeon', d.dungeonId, roomId)
  let next: RunState = {
    ...run,
    activeDungeon: { ...d, position: roomId },
    visitedNodes: { ...run.visitedNodes, [ref]: true },
  }
  const effects: Effect[] = [
    { kind: 'roomEntered', dungeonId: d.dungeonId, roomId, roomType: room.type },
    { kind: 'locationArrived', ref },
  ]
  const cfg = env.rules.dungeon

  switch (room.type) {
    case 'combat':
    case 'elite':
    case 'boss': {
      // Dungeon fights are level-scaled like travel fights (§2.8): the def's region tier picks the band and the
      // `<dungeon>:<room>` salt picks within it, so every room of a run is fixed and no two rooms need agree.
      // Only the BOSS room can name capture targets (`DungeonDef.bossCaptureTargets`, CONTRACT-CHANGES 0030):
      // Daren dies or yields in the Smuggler's Cave exactly as he does at his camp.
      const level = enemyLevelFor(dungeonTier(def, env), `${d.dungeonId}:${roomId}`, env)
      const pendingCombat: PendingCombat = {
        origin: { kind: 'dungeon', dungeonId: d.dungeonId, roomId, roomType: room.type },
        enemies: { kind: 'group', enemyGroupId: groupFor(def, room.type), level },
        captureTargets: room.type === 'boss' ? def.bossCaptureTargets ?? [] : [],
      }
      next = { ...next, pendingCombat }
      break
    }
    case 'event': {
      if (room.checkEventId !== null) {
        // The room stays uncleared until `dismissCheck` (source 'dungeon') calls `markRoomCleared`.
        const opened = openCheckEvent(next, room.checkEventId, 'dungeon', env)
        next = opened.state
        effects.push(...opened.effects)
      } else {
        // No authored event left in the deck: a fixed purse, no roll (rules.dungeon.eventGoldFallback). It still
        // gets a LINE — every other room type announces itself (a fight, an overlay, wounds closing, gear in the
        // bag), and this one used to move the purse in total silence, so the player walked into a room and read
        // nothing at all.
        next = addGold(next, cfg.eventGoldFallback)
        effects.push(
          { kind: 'toast', text: EMPTY_ROOM_TEXT },
          { kind: 'goldChanged', delta: cfg.eventGoldFallback, reason: 'event' },
        )
        const cleared = markRoomCleared(next, roomId, env)
        next = cleared.state
        effects.push(...cleared.effects)
      }
      break
    }
    case 'rest': {
      // Free by rule (restFoodCost 0 — "reward for getting this far", §2.11); the knob stays honoured if it moves.
      if (cfg.restFoodCost > 0) {
        const fed = consumeFood(next, cfg.restFoodCost, 'rest', env)
        next = fed.state
        effects.push(...fed.effects)
      }
      const healed = healParty(next, cfg.restHealFraction, true, 'dungeonRest', env)
      next = healed.state
      effects.push(...healed.effects)
      const cleared = markRoomCleared(next, roomId, env)
      next = cleared.state
      effects.push(...cleared.effects)
      break
    }
    case 'treasure': {
      // Guaranteed gear from its own labelled stream (no battle, so no `loot:<battleId>`), then the fixed purse.
      const tier = dungeonTier(def, env)
      const rolled = rollLoot(lootRowFor('dungeonTreasure', tier, env), lootPool(next, 'dungeonTreasure', env), deriveState(run.rng, rngLabels.treasure(d.dungeonId, roomId)), env)
      const granted = grantLoot(next, rolled.itemIds, 'treasure', env)
      next = addGold(granted.state, cfg.treasureGold)
      effects.push(...granted.effects, { kind: 'goldChanged', delta: cfg.treasureGold, reason: 'treasure' })
      const cleared = markRoomCleared(next, roomId, env)
      next = cleared.state
      effects.push(...cleared.effects)
      break
    }
  }
  return { state: next, effects }
}

/** Called by `applyBattleResult` for dungeon battles and by `dismissCheck` for event rooms; boss → bossCleared + clearedDungeons.
 *  Idempotent: clearing a cleared room returns the same reference and emits nothing. Throws outside a dungeon or on an
 *  unknown room — those are programmer errors, never player input. `env` is unread: the rule needs no number. */
export function markRoomCleared(run: RunState, roomId: RoomId, _env: EngineEnv): SliceResult<RunState> {
  const d = run.activeDungeon
  if (d === null) throw new Error(`markRoomCleared('${roomId}'): no active dungeon`)
  const room = d.graph.rooms[roomId]
  if (room === undefined) throw new Error(`markRoomCleared: no room '${roomId}' in ${d.dungeonId}`)
  if (d.cleared[roomId] === true) return { state: run, effects: [] }
  const isBoss = room.type === 'boss'
  const activeDungeon: ActiveDungeon = { ...d, cleared: { ...d.cleared, [roomId]: true }, bossCleared: d.bossCleared || isBoss }
  const state: RunState = isBoss
    ? { ...run, activeDungeon, clearedDungeons: { ...run.clearedDungeons, [d.dungeonId]: true } }
    : { ...run, activeDungeon }
  return { state, effects: isBoss ? [{ kind: 'dungeonCleared', dungeonId: d.dungeonId }] : [] }
}

/** Legal only at the entrance (position null) or after the boss is cleared — combat is single-attempt and so is the
 *  descent (§2.14): once a room is entered, the only way out is through the boss. */
export function leaveDungeon(run: RunState): { readonly ok: true; readonly run: RunState } | { readonly ok: false; readonly reason: string } {
  const d = run.activeDungeon
  if (d === null) return { ok: false, reason: 'not inside a dungeon' }
  if (d.position !== null && !d.bossCleared) return { ok: false, reason: 'the only way out is through the boss' }
  return { ok: true, run: { ...run, activeDungeon: null } }
}
