/**
 * PROPOSAL B — the Action union and the Effect union.
 *
 * Target location: `game/src/engine/actions.ts`.
 *
 * ACTION CLASSES
 *  - `GameAction`  mutates a persisted slice (meta / run / combat / ledger).
 *                  Every GameAction is appended to the intent log; the log +
 *                  runSeed IS the run. Namespaced `<slice-or-domain>/<verb>`.
 *  - `AutoAction`  a GameAction the DRIVER dispatches on the engine's behalf
 *                  when `flow/pump.ts: pendingAutoAction(state)` says so
 *                  (`travel/hop`, `combat/aiStep`). Logged like any other, so
 *                  the log is unambiguous; the pump is pure, so a replay can
 *                  also PROVE each logged auto action is the one the pump
 *                  would have produced.
 *  - `UiAction`    touches only `state.ui`. Not logged, not persisted, not
 *                  replayed; always accepted (even mid enemy turn).
 *  - `DevAction`   test/CLI/`?screen=` seams. Logged (so a dev-seeded session
 *                  still replays) but refused in production builds.
 *
 * INPUT GATE (determinism): the store refuses any player GameAction while
 * `pendingAutoAction(state) !== null`, except `INTERRUPT_SAFE` ones. So the
 * sequence of states is a pure function of the log — no race between a click
 * and an enemy step.
 *
 * REFUSALS: an illegal action returns the SAME state object plus a `refused`
 * effect (reason string). Reducers never throw on player input; they throw
 * only on programmer errors (unknown content id at seed time — brief §7.20).
 */

import type {
  ActiveStatus,
  BattleResult,
  BattleSpec,
  CardId,
  CharacterId,
  CheckEventId,
  DamageType,
  DialogueId,
  DialogueNodeId,
  DungeonId,
  EncounterId,
  FlagKey,
  FlagScope,
  FlagValue,
  GameState,
  ItemId,
  Modal,
  NodeId,
  QuestEffect,
  QuestId,
  Rarity,
  RngState,
  RoomId,
  SaveFile,
  Screen,
  StageId,
  StatusId,
  TileId,
  TownTab,
  UnitCore,
  UnitId,
} from './types'

// ───────────────────────────────────────────────────────────────────────────
// META  (brief §2.14 rule 6, §2.15)
// ───────────────────────────────────────────────────────────────────────────
export type MetaAction =
  | { readonly type: 'meta/markTutorialSeen' }
  | { readonly type: 'meta/setAudioMuted'; readonly muted: boolean }

// ───────────────────────────────────────────────────────────────────────────
// FLOW / TITLE / SAVE  (brief §1 flow, §2.14)
// ───────────────────────────────────────────────────────────────────────────
export type FlowAction =
  /** Title → New Run. Deletes the autosave (driver effect `persist:clearRun`),
   *  `meta.totalRuns++`, `gameStarted = true`, seeds the run (`run/newRun.ts`)
   *  with `seed ?? derived from meta.totalRuns` (driver supplies a real seed
   *  from `crypto.getRandomValues` — the ONLY non-deterministic input, and it
   *  is logged). Routes to the tutorial battle if `!meta.tutorialSeen`, else prologue. */
  | { readonly type: 'run/new'; readonly seed: number }
  /** Title → Continue: no state change beyond routing (the run was hydrated at boot). */
  | { readonly type: 'run/continue' }
  /** Pause → Save & Quit to Title. Screen becomes title; the run stays hydrated
   *  and autosaved; the enemy-turn pump is naturally paused because the pump
   *  only fires when `screen.kind === 'combat'`. INTERRUPT_SAFE. */
  | { readonly type: 'flow/quitToTitle' }
  /** Win / Game Over → Return to Title (ledger stays for the session). */
  | { readonly type: 'flow/dismissLedger' }
  /** Boot: driver parsed + validated `embermarch:run` / `embermarch:meta` → atomic hydrate. */
  | { readonly type: 'save/hydrate'; readonly file: SaveFile }
  /** Title → New Run confirmation path; also used by tests. Driver clears storage. */
  | { readonly type: 'save/deleteRun' }
  /** Tutorial overlay "Skip" (marks `tutorialSeen`, ends the tutorial battle without payout). */
  | { readonly type: 'tutorial/skip' }

// ───────────────────────────────────────────────────────────────────────────
// RUN — company, bag, gear, naming, flags  (brief §2.7, §2.13, §2.16)
// ───────────────────────────────────────────────────────────────────────────
export type RunAction =
  | { readonly type: 'run/setMcName'; readonly name: string }
  | { readonly type: 'run/setCompanyName'; readonly name: string }
  /** Answers `pendingNamePrompt`; routes to setMcName/setCompanyName by target and clears the slot. */
  | { readonly type: 'run/submitName'; readonly name: string }
  /** Atomic dry-run plan (equipment.ts): displaced gear must fit the spatial bag or the whole action is refused. */
  | { readonly type: 'run/equip'; readonly unitId: UnitId; readonly itemId: ItemId; readonly slot: 'left' | 'right' }
  | { readonly type: 'run/unequip'; readonly unitId: UnitId; readonly slot: 'left' | 'right' }
  | { readonly type: 'run/moveItemInBag'; readonly itemId: ItemId; readonly fromX: number; readonly fromY: number; readonly x: number; readonly y: number }
  | { readonly type: 'run/reorderParty'; readonly order: readonly UnitId[] }
  /** QuestEffect twin, exposed as an action for the CLI/tests. Idempotent on party/deathLog membership; cap 6. */
  | { readonly type: 'run/recruitCharacter'; readonly characterId: CharacterId }
  /** Full-unit add — tests/CLI only (brief §2.16). */
  | { readonly type: 'run/addUnit'; readonly unit: UnitCore }
  | { readonly type: 'run/setFlag'; readonly key: FlagKey; readonly value: FlagValue; readonly scope: FlagScope }
  | { readonly type: 'run/clearFlagScope'; readonly scope: Exclude<FlagScope, 'permanent'> }
  /** Signed, clamped at 0 (brief §7.22). Quests/events/dev. */
  | { readonly type: 'run/addGold'; readonly amount: number }
  /** Signed; adds/removes ration CHARGES; clamps at 0; never touches day/hop counters. */
  | { readonly type: 'run/addFood'; readonly amount: number }
  /** Camp Rest / Scout spend food through THIS (brief §2.10) — never the hop executor. */
  | { readonly type: 'run/consumeFood'; readonly count: number }
  | { readonly type: 'run/addItem'; readonly itemId: ItemId; readonly source: 'quest' | 'event' | 'dev' }
  /** Apply a list of quest effects (quest engine, dialogue choice, check outcome, dev). */
  | { readonly type: 'quest/applyEffects'; readonly effects: readonly QuestEffect[]; readonly source: 'dialogue' | 'checkEvent' | 'quest' | 'captureTarget' | 'dev' }
  | { readonly type: 'quest/start'; readonly questId: QuestId }
  | { readonly type: 'quest/advance'; readonly questId: QuestId; readonly toStage: StageId }
  | { readonly type: 'quest/complete'; readonly questId: QuestId }

// ───────────────────────────────────────────────────────────────────────────
// TRAVEL — the state machine  (brief §2.9, §7.16)
// ───────────────────────────────────────────────────────────────────────────
export type TravelAction =
  /** Click a node: BFS path over undirected edges; `phase: walking`. Clicking the
   *  CURRENT node opens the node menu with no hop and no food. Refused while not idle. */
  | { readonly type: 'travel/go'; readonly toNodeId: NodeId }
  /** AUTO. One hop: +1 day, −1 food (or 3 HP each at 0 food), then ONE encounter
   *  roll (or the stored scout result); lands or suspends. Refused unless `walking`. */
  | { readonly type: 'travel/hop' }
  /** Node menu at an intermediate decision node → keep walking. */
  | { readonly type: 'travel/continue' }
  /** Node menu → stop here (drops the remaining path). */
  | { readonly type: 'travel/stay' }
  /** Click the current node while idle → node menu. */
  | { readonly type: 'travel/openMenu' }
  | { readonly type: 'travel/closeMenu' }

// ───────────────────────────────────────────────────────────────────────────
// TOWN / CAMP / DUNGEON / BOSS  (brief §2.10, §2.11, §2.15)
// ───────────────────────────────────────────────────────────────────────────
export type NodeAction =
  | { readonly type: 'town/enter' }                       // from node menu; `venue = town`
  | { readonly type: 'town/leave' }
  /** Inn: heals every wounded unit to full for `innHealCostPerUnit` × wounded; refused if gold short. Its OWN action (§2.10). */
  | { readonly type: 'town/innHeal' }
  /** Price from `Item.buyPrice` (absent = refused: unbuyable by construction). Bag must fit the item's gridSize. */
  | { readonly type: 'town/buy'; readonly itemId: ItemId }
  | { readonly type: 'town/sell'; readonly itemId: ItemId; readonly x: number; readonly y: number }
  /** Tavern quest board row → `pendingDialogue{source:'tavern'}`. Refused if `visibleIf` fails. */
  | { readonly type: 'town/talk'; readonly questId: QuestId; readonly dialogueId: DialogueId }
  | { readonly type: 'town/turnInPrisoner'; readonly unitId: UnitId }
  | { readonly type: 'town/turnInAllPrisoners' }
  | { readonly type: 'camp/enter' }
  /** Heal all `floor(max × 0.2)` for 1 food; refused at 0 food or if `actionTaken`. */
  | { readonly type: 'camp/rest' }
  /** 1 food; pre-rolls every edge within BFS depth 3 into `scoutedEdges['<edge>#<pass>']`; refused at 0 food or if `actionTaken`. */
  | { readonly type: 'camp/scout' }
  | { readonly type: 'camp/leave' }
  /** From the node menu at a DUNGEON node; gated by the node's `requires` predicate; generates the graph from `deriveRng(run.rng, 'dungeon:<id>')`. */
  | { readonly type: 'dungeon/enter'; readonly dungeonId: DungeonId }
  /** Pick a reachable next room. combat/elite/boss → seed battle; event → reveal + `pendingCheckEvent`; rest → +30% free; treasure → guaranteed gear + 50g. */
  | { readonly type: 'dungeon/moveTo'; readonly roomId: RoomId }
  /** Only legal after the boss room is cleared (or from the entrance before any room). */
  | { readonly type: 'dungeon/exit' }
  /** Node menu at the BOSS node → final boss battle (`battleTag: 'finalBoss'`). */
  | { readonly type: 'boss/challenge' }

// ───────────────────────────────────────────────────────────────────────────
// DIALOGUE / CHECK EVENTS  (brief §2.12)
// ───────────────────────────────────────────────────────────────────────────
export type NarrativeAction =
  /** Dev/tavern/quest entry point; UI uses `town/talk`. */
  | { readonly type: 'dialogue/start'; readonly dialogueId: DialogueId; readonly source: 'dev' | 'quest' }
  /** `dialogueRunner.step`: refused (not thrown) on hidden/disabled/unknown from the UI; `attemptingUnitId` for stat checks
   *  (null → auto-pick best living candidate — the CLI relies on it). Applies node `onEnter` + choice effects, then
   *  either moves to `next`/`onPass`/`onFail` or ends. Ending resolves: pendingCombat → seed battle; travel suspended → land. */
  | { readonly type: 'dialogue/choose'; readonly choiceId: string; readonly attemptingUnitId: UnitId | null }
  /** Check event choice: deterministic single-unit resolver; effects applied; stage → `result` with narration. */
  | { readonly type: 'check/choose'; readonly choiceId: string; readonly attemptingUnitId: UnitId | null }
  /** Dismiss the narration. Resolves: travel suspended → land; dungeon → roomResolved; victory → nothing more. */
  | { readonly type: 'check/close' }

// ───────────────────────────────────────────────────────────────────────────
// COMBAT  (brief §2.1–2.6, §2.16). Every legality rule lives in the reducer.
// ───────────────────────────────────────────────────────────────────────────
export type CombatAction =
  /** Seed from a BattleSpec (`combat/seed.ts`). Used by the run flow internally and by the CLI/sims directly. Throws on bad content. */
  | { readonly type: 'combat/start'; readonly spec: BattleSpec }
  | { readonly type: 'combat/selectCard'; readonly cardId: CardId }
  | { readonly type: 'combat/pinTarget'; readonly tile: TileId }
  | { readonly type: 'combat/cancel' }
  /** Play `cardId` from the ACTIVE unit's hand at `tile` (null for self / all_* cards). Validates AP, hand membership,
   *  range (manhattan, obstacles excluded), targetKind vs occupant team, then resolves: discard first, cover redirect,
   *  AOE expansion, effect order, quiver mods, AP −cost, checkEnd. */
  | { readonly type: 'combat/playCard'; readonly cardId: CardId; readonly tile: TileId | null }
  | { readonly type: 'combat/enterMoveMode' }
  /** Free move: refused if moved this turn, immobilized, out of MOV range (4-dir BFS through free tiles), occupied, obstacle, OOB. */
  | { readonly type: 'combat/moveUnit'; readonly tile: TileId }
  /** 1 AP self-drink from `combat.consumables`; refused at 0 AP / not the active PARTY unit / item absent. */
  | { readonly type: 'combat/useItem'; readonly itemId: ItemId }
  /** 2 AP; target must be a living, uncaptured enemy orthogonally adjacent to the active unit; rolls `combat.rng` and writes it back. */
  | { readonly type: 'combat/capture'; readonly targetId: UnitId }
  /** endTurn order (brief §2.1): tick ending unit's ownerTurnEnd statuses → checkEnd → next unit (AP 3, hasMoved false,
   *  coverUsed [], ownerTurnStart statuses decrement) → ending unit discards hand, next draws to 5 (reshuffle via rng) → clear selection. */
  | { readonly type: 'combat/endTurn' }
  /** AUTO. Exactly one planned step for the active ENEMY unit: move | act | endTurn (`combat/ai.ts: planStep`). */
  | { readonly type: 'combat/aiStep' }
  /** Field Report → Continue. Clears `combat` + `lastBattle`; routes by `origin` (tutorial→prologue, travel→land hop,
   *  dungeon→room resolved, finalBoss→win ledger, quest→resume). Defeat never reaches this (run is already a ledger). */
  | { readonly type: 'battle/continue' }

// ───────────────────────────────────────────────────────────────────────────
// UI (ephemeral)  — never logged
// ───────────────────────────────────────────────────────────────────────────
export type UiAction =
  | { readonly type: 'ui/openModal'; readonly modal: Exclude<Modal, null> }
  | { readonly type: 'ui/closeModal' }
  | { readonly type: 'ui/setTownTab'; readonly tab: TownTab }
  | { readonly type: 'ui/toggleDangerZones' }
  | { readonly type: 'ui/toggleDevHud' }

// ───────────────────────────────────────────────────────────────────────────
// DEV — seams for `?screen=`, the CLI and tests (refused when `import.meta.env.PROD`)
// ───────────────────────────────────────────────────────────────────────────
export type DevAction =
  /** Replace the whole game state (validated through the save schema first). */
  | { readonly type: 'dev/seedState'; readonly state: GameState }
  /** Force the route for screenshots; the invariant check is suspended for dev-jumped states. */
  | { readonly type: 'dev/jumpTo'; readonly screen: Screen }
  | { readonly type: 'dev/setRunRng'; readonly rng: RngState }
  | { readonly type: 'dev/setCombatRng'; readonly rng: RngState }
  | { readonly type: 'dev/teleport'; readonly nodeId: NodeId }
  | { readonly type: 'dev/applyStatus'; readonly unitId: UnitId; readonly status: ActiveStatus }

// ───────────────────────────────────────────────────────────────────────────
// Unions
// ───────────────────────────────────────────────────────────────────────────
export type GameAction =
  | MetaAction | FlowAction | RunAction | TravelAction | NodeAction | NarrativeAction | CombatAction | DevAction

export type Action = GameAction | UiAction

export type AutoAction = Extract<GameAction, { type: 'travel/hop' | 'combat/aiStep' }>

/** Player actions accepted even while an auto action is pending. */
export const INTERRUPT_SAFE: ReadonlySet<GameAction['type']> = new Set<GameAction['type']>([
  'flow/quitToTitle',
  'save/hydrate',
])

/** Actions after which the driver persists SYNCHRONOUSLY (before subscribers run),
 *  so a terminal screen can never render with a stale save (§2.14 rule 6). */
export const PERSIST_SYNC: ReadonlySet<GameAction['type']> = new Set<GameAction['type']>([
  'run/new', 'save/deleteRun', 'flow/quitToTitle', 'battle/continue', 'combat/endTurn', 'combat/playCard', 'combat/aiStep',
])

export function isUiAction(a: Action): a is UiAction {
  return a.type.startsWith('ui/')
}
export function isAutoAction(a: Action): a is AutoAction {
  return a.type === 'travel/hop' || a.type === 'combat/aiStep'
}

// ───────────────────────────────────────────────────────────────────────────
// EFFECTS — the reducer's description of what happened. SEMANTIC ONLY:
// no durations, no pixels, no sprite handles. The UI consumes and forgets
// them; the CLI prints them; tests assert on them. They are never state.
// Some are DRIVER effects (persist/quit) — the store handles those itself.
// ───────────────────────────────────────────────────────────────────────────
export type Effect =
  // ── combat, per unit ──
  | { readonly kind: 'unitHit'; readonly unitId: UnitId; readonly tile: TileId; readonly amount: number; readonly hpLost: number; readonly armorLost: number; readonly damageType: DamageType; readonly sourceId: UnitId | null; readonly redirectedFrom: UnitId | null; readonly lethal: boolean }
  | { readonly kind: 'unitHealed'; readonly unitId: UnitId; readonly tile: TileId; readonly amount: number }
  | { readonly kind: 'armorGained'; readonly unitId: UnitId; readonly amount: number; readonly capped: boolean }
  | { readonly kind: 'armorShredded'; readonly unitId: UnitId; readonly amount: number }
  | { readonly kind: 'statusApplied'; readonly unitId: UnitId; readonly status: StatusId; readonly stacks: number; readonly turns: number }
  | { readonly kind: 'statusRemoved'; readonly unitId: UnitId; readonly status: StatusId; readonly reason: 'expired' | 'cleansed' | 'consumed' }
  | { readonly kind: 'statusTicked'; readonly unitId: UnitId; readonly status: StatusId; readonly damage: number }
  | { readonly kind: 'riposte'; readonly fromId: UnitId; readonly toId: UnitId; readonly amount: number }
  | { readonly kind: 'covered'; readonly protectorId: UnitId; readonly protecteeId: UnitId }
  | { readonly kind: 'unitMoved'; readonly unitId: UnitId; readonly path: readonly TileId[] }   // path incl. destination, excl. origin
  | { readonly kind: 'unitDied'; readonly unitId: UnitId; readonly team: 'party' | 'enemy'; readonly cause: 'damage' | 'dot' | 'riposte' | 'starvation' | 'event' }
  | { readonly kind: 'captureRolled'; readonly targetId: UnitId; readonly attackerId: UnitId; readonly chance: number; readonly success: boolean }
  | { readonly kind: 'cardPlayed'; readonly unitId: UnitId; readonly cardId: CardId; readonly tile: TileId | null; readonly apCost: number }
  | { readonly kind: 'cardsDrawn'; readonly unitId: UnitId; readonly count: number; readonly reshuffled: boolean }
  | { readonly kind: 'apChanged'; readonly unitId: UnitId; readonly ap: number; readonly delta: number }
  | { readonly kind: 'itemUsed'; readonly unitId: UnitId; readonly itemId: ItemId }
  | { readonly kind: 'turnStarted'; readonly unitId: UnitId; readonly team: 'party' | 'enemy'; readonly round: number }
  | { readonly kind: 'battleStarted'; readonly battleId: string; readonly enemyIds: readonly UnitId[] }
  | { readonly kind: 'battleVictory'; readonly battleId: string; readonly survivors: readonly UnitId[]; readonly capturedIds: readonly UnitId[] }
  | { readonly kind: 'battleDefeat'; readonly battleId: string }
  // ── run / economy ──
  | { readonly kind: 'goldChanged'; readonly delta: number; readonly reason: 'battle' | 'shop' | 'inn' | 'bounty' | 'quest' | 'event' | 'treasure' | 'dev' }
  | { readonly kind: 'foodChanged'; readonly delta: number; readonly reason: 'hop' | 'rest' | 'scout' | 'shop' | 'quest' | 'event' | 'dev' }
  | { readonly kind: 'starvation'; readonly unitIds: readonly UnitId[]; readonly amount: number }
  | { readonly kind: 'itemAcquired'; readonly itemId: ItemId; readonly rarity: Rarity; readonly source: 'loot' | 'shop' | 'quest' | 'event' | 'treasure' | 'trophy' }
  | { readonly kind: 'lootOverflow'; readonly itemId: ItemId }     // guaranteed drop waiting for a bag slot (blocks battle/continue)
  | { readonly kind: 'prisonerTaken'; readonly unitId: UnitId; readonly name: string; readonly bountyValue: number }
  | { readonly kind: 'prisonerTurnedIn'; readonly unitId: UnitId; readonly gold: number }
  | { readonly kind: 'unitRecruited'; readonly unitId: UnitId; readonly characterId: CharacterId }
  | { readonly kind: 'unitLost'; readonly unitId: UnitId; readonly cause: 'battle' | 'starvation' | 'event' }
  | { readonly kind: 'partyHealed'; readonly unitIds: readonly UnitId[]; readonly reason: 'inn' | 'campRest' | 'dungeonRest' | 'quest' }
  | { readonly kind: 'nameSet'; readonly target: 'mc' | 'company'; readonly name: string }
  // ── overworld ──
  | { readonly kind: 'hopStarted'; readonly from: NodeId; readonly to: NodeId; readonly hopsLeft: number }
  | { readonly kind: 'encounterRolled'; readonly from: NodeId; readonly to: NodeId; readonly result: 'none' | 'dialogue' | 'battle' | 'checkEvent'; readonly entryId: EncounterId | null; readonly scouted: boolean }
  | { readonly kind: 'locationArrived'; readonly ref: string }           // refKey (overworld node or dungeon room)
  | { readonly kind: 'journeyEnded'; readonly nodeId: NodeId; readonly reason: 'arrived' | 'stayed' }
  | { readonly kind: 'scouted'; readonly edges: readonly string[] }      // EdgePassKeys recorded
  | { readonly kind: 'dungeonEntered'; readonly dungeonId: DungeonId }
  | { readonly kind: 'roomEntered'; readonly roomId: RoomId; readonly roomType: 'combat' | 'elite' | 'event' | 'treasure' | 'rest' | 'boss' }
  | { readonly kind: 'dungeonCleared'; readonly dungeonId: DungeonId }
  // ── narrative ──
  | { readonly kind: 'flagSet'; readonly key: FlagKey; readonly value: FlagValue; readonly scope: FlagScope }
  | { readonly kind: 'questStarted'; readonly questId: QuestId }
  | { readonly kind: 'questStageAdvanced'; readonly questId: QuestId; readonly from: StageId; readonly to: StageId }
  | { readonly kind: 'questCompleted'; readonly questId: QuestId }
  | { readonly kind: 'dialogueOpened'; readonly dialogueId: DialogueId; readonly nodeId: DialogueNodeId }
  | { readonly kind: 'dialogueClosed'; readonly dialogueId: DialogueId }
  | { readonly kind: 'checkResolved'; readonly eventId: CheckEventId; readonly choiceId: string; readonly passed: boolean; readonly attemptingUnitId: UnitId | null }
  // ── run lifecycle ──
  | { readonly kind: 'runStarted'; readonly runId: string; readonly seed: number }
  | { readonly kind: 'runEnded'; readonly outcome: 'won' | 'lost' }
  | { readonly kind: 'screenChanged'; readonly from: Screen; readonly to: Screen }
  // ── presentation hints (still semantic: WHAT, never HOW LONG) ──
  | { readonly kind: 'banner'; readonly text: string; readonly tone: 'turn' | 'phase' | 'victory' | 'defeat' | 'arrival' | 'info' }
  | { readonly kind: 'sound'; readonly cue: 'cardPlay' | 'hitPhysical' | 'hitMagic' | 'heal' | 'death' | 'gold' | 'button' | 'victory' | 'defeat' | 'capture' | 'footsteps' }
  | { readonly kind: 'refused'; readonly action: GameAction['type']; readonly reason: string }
  // ── driver effects (handled by ui/store.ts, never rendered) ──
  | { readonly kind: 'persist'; readonly what: 'run' | 'meta' | 'clearRun' }
  | { readonly kind: 'quitApp' }

/** A battle payout is reported as ONE effect too, so the CLI can print the Field Report. */
export type BattleResolvedEffect = { readonly kind: 'battleResolved'; readonly result: BattleResult }
export type AnyEffect = Effect | BattleResolvedEffect

export interface ReduceResult {
  readonly state: GameState
  readonly effects: readonly AnyEffect[]
}
