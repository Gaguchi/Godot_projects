/**
 * run/battle.ts — the run ⇄ combat seam (brief §2.6, §2.8, §2.12, §7.30). The ONE payout.
 */
import type { SliceResult } from '../actions'
import type { Effect } from '../effects'
import type { BattleId, BattleOrigin, BattleReport, BattleResult, BattleSpec, BattleTag, CaptureTarget, EngineEnv, PendingCombat, PendingFollowUp, Prisoner, QuestEffect, RegionTier, RunLedger, RunState, UnitId } from '../types'
import { tutorialSpec } from '../combat/tutorial'
import { tileKey } from '../combat/grid'
import { createRng } from '../rng'
import { deriveState } from '../rngState'
import { rngLabels } from '../rules'
import { consumableIds, removeFirst } from './bag'
import { areaTier, dungeonTier, enemyLevelFor } from './difficulty'
import { markRoomCleared } from './dungeon'
import { addGold } from './economy'
import { clearFlagScope, setFlag } from './flags'
import { grantLoot, lootPool, lootRowFor, rollLoot } from './loot'
import { MC_ID, displayName, livingUnits, removeFallen } from './party'

/** The `rngLabels.battle*` string by origin (travel: group+node+day; quest: `battleQuest`; dungeon: dungeon+room;
 *  tutorial/finalBoss fixed) — that string IS the `BattleId` and the combat stream's label (no re-prefixing). */
export function battleIdFor(origin: BattleOrigin, enemyGroupId: string | null, run: RunState, env: EngineEnv): BattleId {
  void env // the label formats are fixed by `rngLabels`; the env stays in the signature for parity with the other builders
  const group = enemyGroupId ?? 'authored'
  switch (origin.kind) {
    case 'tutorial': return rngLabels.battleTutorial
    case 'finalBoss': return rngLabels.battleFinalBoss
    case 'travel': return rngLabels.battleTravel(group, origin.to, run.daysElapsed)
    case 'quest': return rngLabels.battleQuest(group, origin.nodeId, run.daysElapsed)
    case 'dungeon': return rngLabels.battleDungeon(origin.dungeonId, origin.roomId)
    case 'sim': return 'battle:sim'
  }
}

function tagFor(origin: BattleOrigin): BattleTag {
  switch (origin.kind) {
    case 'tutorial': return 'tutorial'
    case 'travel': return 'travel'
    case 'quest': return 'quest'
    case 'dungeon': return `dungeon:${origin.roomType}`
    case 'finalBoss': return 'finalBoss'
    case 'sim': return 'sim'
  }
}

/** The area the fight happens in: the road's destination, the node, or the dungeon's region. */
function tierFor(origin: BattleOrigin, run: RunState, env: EngineEnv): RegionTier {
  switch (origin.kind) {
    case 'dungeon': {
      const def = env.content.dungeons[origin.dungeonId]
      if (def === undefined) throw new Error(`run/battle: unknown dungeon '${origin.dungeonId}'`)
      return dungeonTier(def, env)
    }
    case 'travel': return areaTier(origin.to, env)
    case 'quest':
    case 'finalBoss': return areaTier(origin.nodeId, env)
    case 'tutorial':
    case 'sim': return areaTier(run.nodeId, env)
  }
}

/** The salt `enemyLevelFor` hashes: the node for road/quest fights, `<dungeon>:<room>` inside. */
function saltFor(origin: BattleOrigin, run: RunState): string {
  switch (origin.kind) {
    case 'dungeon': return `${origin.dungeonId}:${origin.roomId}`
    case 'travel': return origin.to
    case 'quest':
    case 'finalBoss': return origin.nodeId
    case 'tutorial':
    case 'sim': return run.nodeId
  }
}

/**
 * The BOARD the fight is laid out on (RE-GATE C 3.17; DECISIONS "flat boards, AUTHORED obstacles"). Every origin
 * names its field the same way: a NODE's own `battlefieldId` wins where one is authored (the throne hall is a
 * place, not a draw), a dungeon draws from its own list, and everything else draws from the region the fight
 * happens in. The draw is one `pick` off a stream labelled `field:<battleId>`, derived from the run seed and never
 * written back — so the board is a pure function of (runSeed, battleId) exactly like the enemy level and the
 * cosmetic floor, and a reload re-lays the same field.
 */
function obstaclesFor(origin: BattleOrigin, run: RunState, battleId: BattleId, env: EngineEnv): readonly string[] {
  const ids = ((): readonly string[] => {
    if (origin.kind === 'dungeon') {
      const def = env.content.dungeons[origin.dungeonId]
      if (def === undefined) throw new Error(`run/battle: unknown dungeon '${origin.dungeonId}'`)
      return def.battlefieldIds
    }
    const nodeId = origin.kind === 'travel' ? origin.to : origin.kind === 'quest' || origin.kind === 'finalBoss' ? origin.nodeId : run.nodeId
    const node = env.content.overworld.nodes.find((n) => n.id === nodeId)
    if (node === undefined) throw new Error(`run/battle: unknown overworld node '${nodeId}'`)
    if (node.battlefieldId !== undefined) return [node.battlefieldId]
    const region = env.content.regions[node.regionId]
    if (region === undefined) throw new Error(`run/battle: node '${nodeId}' names unknown region '${node.regionId}'`)
    return region.battlefieldIds
  })()
  const picked = createRng(deriveState(run.rng, rngLabels.battlefield(battleId))).pick(ids)
  const field = env.content.battlefields[picked]
  if (field === undefined) throw new Error(`run/battle: unknown battlefield '${picked}'`)
  return field.obstacles.map(([x, y]) => tileKey(x, y))
}

/** tag/tier by origin (areaTier of the node or dungeonTier); `enemies` from `pending.enemies` with the group level
 *  raised to `enemyLevelFor(tier, salt)` (finalBoss: also `rules.difficulty.bossLevel`); `enemyGroupId` = the group
 *  spec's id or null (authored); party = living units at run HP; consumables = bag potions; grid = rules grid
 *  (tutorial grid for tutorial), `terrain: null`, obstacles per origin; `rng = deriveState(run.rng, battleId)`. */
export function battleSpecFor(run: RunState, pending: PendingCombat, env: EngineEnv): BattleSpec {
  const origin = pending.origin
  if (origin.kind === 'tutorial') {
    const mc = run.party[MC_ID]
    if (mc === undefined) throw new Error(`run/battle: the tutorial needs the party unit '${MC_ID}'`)
    return tutorialSpec(mc, deriveState(run.rng, rngLabels.battleTutorial), env)
  }
  const tier = tierFor(origin, run, env)
  const enemyGroupId = pending.enemies.kind === 'group' ? pending.enemies.enemyGroupId : null
  let enemies = pending.enemies
  if (enemies.kind === 'group') {
    let level = Math.max(enemies.level, enemyLevelFor(tier, saltFor(origin, run), env))
    if (origin.kind === 'finalBoss') level = Math.max(level, env.rules.difficulty.bossLevel)
    enemies = { ...enemies, level }
  }
  const battleId = battleIdFor(origin, enemyGroupId, run, env)
  const { width, height } = env.rules.combat.grid
  return {
    battleId,
    tag: tagFor(origin),
    origin,
    regionTier: tier,
    enemyGroupId,
    grid: { width, height, obstacles: obstaclesFor(origin, run, battleId, env), terrain: null },
    party: livingUnits(run),
    enemies,
    consumables: consumableIds(run, env),
    captureTargets: pending.captureTargets,
    rng: deriveState(run.rng, battleId),
  }
}

/**
 * ONE atomic payout (never for tag 'tutorial'), in order: survivor HP write-back → removeFallen → gold → loot
 * (rollLoot with deriveState(run.rng, rngLabels.loot(battleId)) + grantLoot; guaranteed tags never discard) →
 * prisoners append (cap) → consumed items removed first-match → stats → clearFlagScope('battle') → dungeon room
 * cleared → clearedEncounters[encounterId] on travel victory → captureTargets → flags now, dialogues queued →
 * `pendingFollowUps = [...captureTargetDialogues (source 'captureTarget'), victoryEvent (source 'victory')]` →
 * `lastBattle` report (with `field`). Nothing is OPENED here — `flow/settle.ts` step 3 opens one follow-up at a
 * time after the report closes.
 * Emits battleResolved, battleVictory | battleDefeat, unitLost per fallen, prisonerTaken, itemAcquired.
 */
export function applyBattleResult(run: RunState, result: BattleResult, env: EngineEnv): SliceResult<RunState> & { readonly report: BattleReport } {
  if (result.tag === 'tutorial') throw new Error('run/battle: the tutorial never pays out')
  const victory = result.outcome === 'victory'
  const effects: Effect[] = []
  let st = run

  // 1. wounds carry: every survivor leaves at the HP it had on the board
  const party = { ...st.party }
  for (const [id, hp] of Object.entries(result.survivorHp)) {
    const u = party[id]
    if (u !== undefined && u.hp.current !== hp) party[id] = { ...u, hp: { ...u.hp, current: hp } }
  }
  st = { ...st, party }

  // 2. permadeath
  const removed = removeFallen(st, result.fallen.map((f) => ({ unitId: f.unitId, cause: 'battle' as const, battleId: result.battleId })), env)
  st = removed.state
  effects.push(...removed.effects)

  // 3. gold
  if (result.goldEarned > 0) {
    st = addGold(st, result.goldEarned)
    effects.push({ kind: 'goldChanged', delta: result.goldEarned, reason: 'battle' })
  }

  // 4. loot by source (victory only); a guaranteed drop that does not fit waits in pendingLoot
  const loot: BattleReport['loot'][number][] = []
  if (victory) {
    const tier = tierFor(result.origin, st, env)
    const rolled = rollLoot(lootRowFor(result.tag, tier, env), lootPool(st, result.tag, env), deriveState(st.rng, rngLabels.loot(result.battleId)), env)
    const granted = grantLoot(st, rolled.itemIds, result.tag === 'finalBoss' ? 'trophy' : 'loot', env)
    st = granted.state
    effects.push(...granted.effects)
    for (const itemId of rolled.itemIds) {
      const item = env.content.items[itemId]
      if (item === undefined) throw new Error(`run/battle: loot rolled unknown item '${itemId}'`)
      loot.push({ itemId, rarity: item.rarity, placed: granted.placed.includes(itemId) })
    }
  }

  // 5. prisoners (the wagon may have a cap — rules.economy.prisonerCap, null = none)
  const cap = env.rules.economy.prisonerCap
  const prisoners: Prisoner[] = [...st.prisoners]
  const taken: Prisoner[] = []
  for (const p of result.capturedEnemies) {
    if (cap !== null && prisoners.length >= cap) break
    prisoners.push(p)
    taken.push(p)
    effects.push({ kind: 'prisonerTaken', unitId: p.unitId, name: p.name, bountyValue: p.bountyValue })
  }
  st = { ...st, prisoners }

  // 6. potions drunk on the board leave the bag now (first match by id)
  let bag = st.bag
  for (const itemId of result.consumedItems) {
    bag = removeFirst(bag, itemId)
    effects.push({ kind: 'itemRemoved', itemId, reason: 'consumed' })
  }
  st = { ...st, bag }

  // 7. ledger stats. THREE counters are deliberately ABSENT because steps 2, 3 and 4 already own them, and a
  // counter with two owners always reports double: `run/loot.ts#grantLoot` is the ONE door gear enters a run
  // through (`gearFound`), `run/party.ts#removeFallen` is the ONE door a name enters `deathLog` through
  // (`unitsLost`) — adding `result.fallen.length` here made the ledger contradict the names printed beside it —
  // and `run/economy.ts#addGold` is the ONE door gold enters through (`goldEarned`, CONTRACT-CHANGES 0091), so
  // step 3's purse is already counted; adding it again reported every battle twice.
  st = {
    ...st,
    stats: {
      ...st.stats,
      battlesWon: st.stats.battlesWon + (victory ? 1 : 0),
      enemiesDefeated: st.stats.enemiesDefeated + result.enemiesDefeated,
      enemiesCaptured: st.stats.enemiesCaptured + taken.length,
    },
  }

  // 8. battle-scoped flags die with the battle
  st = clearFlagScope(st, 'battle')

  // 9. the room / the road remembers a victory
  if (victory && result.origin.kind === 'dungeon') {
    const cleared = markRoomCleared(st, result.origin.roomId, env)
    st = cleared.state
    effects.push(...cleared.effects)
  }
  if (victory && result.origin.kind === 'travel') {
    st = { ...st, clearedEncounters: { ...st.clearedEncounters, [result.origin.encounterId]: true } }
  }

  // 10. named enemies: flags now, their scenes queued in order; then the group's victory event
  const followUps: PendingFollowUp[] = [...st.pendingFollowUps]
  for (const effect of resolveCaptureTargets(result.captureTargets, result.capturedIds, result.survivingEnemyIds)) {
    if (effect.kind === 'setFlag') {
      const flagged = setFlag(st, effect.key, effect.value, effect.scope)
      st = flagged.state
      effects.push(...flagged.effects)
    } else if (effect.kind === 'startDialogue') {
      followUps.push({ kind: 'dialogue', dialogueId: effect.dialogueId, source: 'captureTarget' })
    }
  }
  if (victory && result.origin.kind !== 'tutorial') {
    const groupId = result.origin.kind === 'travel' || result.origin.kind === 'quest' || result.origin.kind === 'dungeon' || result.origin.kind === 'finalBoss'
      ? groupIdFor(result, env)
      : null
    const victoryEvent = groupId === null ? undefined : env.content.enemyGroups[groupId]?.victoryEvent
    if (victoryEvent !== undefined) followUps.push({ kind: 'checkEvent', checkEventId: victoryEvent, source: 'victory' })
  }
  st = { ...st, pendingFollowUps: followUps }

  // 11. the Field Report
  const report: BattleReport = {
    battleId: result.battleId,
    tag: result.tag,
    outcome: result.outcome,
    rounds: result.rounds,
    field: result.field,
    enemiesDefeated: result.enemiesDefeated,
    goldEarned: result.goldEarned,
    // The report is a RECORD the CLI, the save and every future consumer read: it carries the name the player
    // gave, not the authored placeholder, so nothing downstream has to remap `mc` a second time (`displayName`
    // is the one owner of that rule).
    survivors: Object.entries(result.survivorHp).flatMap(([unitId, current]) => {
      const u = st.party[unitId]
      return u === undefined ? [] : [{ unitId, name: displayName(u, st), hp: { current, max: u.hp.max } }]
    }),
    fallen: result.fallen.map((f) => ({ ...f, name: displayName({ id: f.unitId, name: f.name }, st) })),
    loot,
    prisoners: taken,
    consumedItems: result.consumedItems,
  }
  effects.push({ kind: 'battleResolved', report })
  if (victory) effects.push({ kind: 'battleVictory', battleId: result.battleId, survivors: Object.keys(result.survivorHp), capturedIds: result.capturedIds })
  else effects.push({ kind: 'battleDefeat', battleId: result.battleId })
  return { state: st, effects, report }
}

/** The enemy group a battle was seeded from: encoded in the battle id for road/quest fights, looked up for dungeons. */
function groupIdFor(result: BattleResult, env: EngineEnv): string | null {
  const origin = result.origin
  if (origin.kind === 'dungeon') {
    const def = env.content.dungeons[origin.dungeonId]
    if (def === undefined) return null
    return origin.roomType === 'boss' ? def.bossEnemyGroupId : origin.roomType === 'elite' ? def.eliteEnemyGroupId : def.combatEnemyGroupId
  }
  if (origin.kind === 'finalBoss') return env.content.overworld.nodes.find((n) => n.id === origin.nodeId)?.enemyGroupId ?? null
  // `battle:<group>:<node>:d<day>` / `battle:quest:<group>:<node>:d<day>`
  const parts = result.battleId.split(':')
  const group = origin.kind === 'quest' ? parts[2] : parts[1]
  return group !== undefined && env.content.enemyGroups[group] !== undefined ? group : null
}

/** captured → capturedFlag + capturedDialogueId; dead → killedFlag + killedDialogueId; still standing → nothing.
 *  Every dialogue is returned in target order (the caller queues them — no "first only" rule any more). */
export function resolveCaptureTargets(targets: readonly CaptureTarget[], capturedIds: readonly UnitId[], survivingEnemyIds: readonly UnitId[]): readonly QuestEffect[] {
  const out: QuestEffect[] = []
  for (const t of targets) {
    if (capturedIds.includes(t.unitId)) {
      out.push({ kind: 'setFlag', key: t.capturedFlag, value: true, scope: 'run' }, { kind: 'startDialogue', dialogueId: t.capturedDialogueId })
    } else if (!survivingEnemyIds.includes(t.unitId)) {
      out.push({ kind: 'setFlag', key: t.killedFlag, value: true, scope: 'run' }, { kind: 'startDialogue', dialogueId: t.killedDialogueId })
    }
  }
  return out
}

/** Includes `runId` / `runSeed` so the Win / Game Over "Restart" can dispatch `meta/newRun { seed }`. */
export function runLedger(run: RunState, outcome: 'won' | 'lost', trophyItemId: string | null): RunLedger {
  return {
    outcome,
    runId: run.runId,
    runSeed: run.runSeed,
    mcName: run.mcName,
    companyName: run.companyName,
    daysElapsed: run.daysElapsed,
    stats: run.stats,
    fallen: run.deathLog,
    survivors: livingUnits(run).map((u) => ({ unitId: u.id, name: displayName(u, run), classId: u.classId })),
    trophyItemId,
  }
}
