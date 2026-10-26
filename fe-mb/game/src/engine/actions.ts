/**
 * ENGINE CONTRACT — the `Action` union (every rule in brief §2 has a door
 * here and nowhere else) and the reducer's result shape.
 *
 *   GameState × Action ──reduce(env)──▶ { state: GameState, effects: Effect[] }
 *
 * Conventions
 * - `type` is `'<domain>/<verb>'`. The prefix routes to the sub-reducer
 *   (`meta/ run/ travel/ town/ camp/ dungeon/ dialogue/ check/ name/ combat/
 *   tutorial/ battleEnd/ quest/ ui/ save/ dev/`).
 * - Illegal actions (wrong screen, insufficient AP, out of range…) leave the
 *   state UNCHANGED (same reference) and emit exactly one `refused` effect.
 *   The UI renders disabled-with-reason from the same selectors the reducer
 *   uses, so a refusal in play is a bug, never a flow. Reducers never throw on
 *   player input; they throw only on programmer errors (unknown content id at
 *   seed time, §7.20).
 * - Two actions are PUMPS (`travel/step`, `combat/enemyStep`): dispatched by
 *   the runtime, never by a screen. The engine says WHICH pump is due
 *   (`flow/pump.ts#nextPump`); the runtime only decides WHEN.
 * - `ui/*` actions touch only `state.ui`: never persisted, always accepted
 *   (even mid enemy turn), and NEVER read by `isLegal` / `nextPump` — legality
 *   is a function of the persisted slices only (the host pauses pumps with
 *   `runtime.setPaused`), so a replay may drop them losslessly.
 * - `dev/*` actions are seams for `?screen=`, the CLI and tests; the host
 *   refuses them in production builds.
 *
 * Contract change rules: `docs/rewrite/CONTRACT.md` → CONTRACT-CHANGES.md.
 */

import type {
  ActiveStatus,
  BattleSpec,
  CardUid,
  FlagScope,
  FlagValue,
  GameState,
  HandSlot,
  ItemId,
  Modal,
  NodeId,
  QuestEffect,
  RngState,
  RoomId,
  SaveFile,
  Screen,
  TileKey,
  TownTab,
  Unit,
  UnitId,
} from './types'
import type { Effect } from './effects'

// ── meta / title (§1 flow, §2.14 rule 6) ────────────────────────────────

export type MetaAction =
  /** Title "New Run": deletes any existing run, `meta.totalRuns++`, `gameStarted = true`,
   *  seeds the run (`run/newRun.ts`, §2.13 kit), then routes to the tutorial battle
   *  (first run, `!meta.tutorialSeen`) or the prologue. `seed` is the ONE
   *  non-deterministic input; the host supplies it (UI: crypto/Date, CLI: `--seed`). */
  | { readonly type: 'meta/newRun'; readonly seed: number }
  /** Title "Continue": the run is already in memory (hydrated at boot or kept after `meta/toTitle`); routes to
   *  `flow/pump.ts#resumeScreen(state)` — derived from the slots (combat, Field Report, town, camp, dungeon, prologue, overworld). */
  | { readonly type: 'meta/continueRun' }
  /** Pause "Save & Quit to Title": screen → title, run and combat kept exactly (the autosave holds them). No pump is
   *  ever due on the title screen (`nextPump` carries the screen term), so a mid-enemy-turn quit simply parks the battle. */
  | { readonly type: 'meta/toTitle' }
  /** Win / Game Over "Return to Title": clears `ledger`. */
  | { readonly type: 'meta/dismissLedger' }
  | { readonly type: 'meta/setAudioMuted'; readonly muted: boolean }

// ── run: party, bag, gear, naming (§2.7, §2.13, §2.16) ──────────────────

export type RunAction =
  /** Atomic dry-run plan (`run/equipment.ts`): displaced items must fit the spatial bag or the whole action is refused. */
  | { readonly type: 'run/equip'; readonly unitId: UnitId; readonly itemId: ItemId; readonly slot: HandSlot }
  | { readonly type: 'run/unequip'; readonly unitId: UnitId; readonly slot: HandSlot }
  /** Move a bag entry (identified by its current cell) to a new top-left cell; refused if it overlaps. */
  | { readonly type: 'run/moveBagItem'; readonly fromX: number; readonly fromY: number; readonly x: number; readonly y: number }
  /** Discard a bag entry outright (frees cells for pending loot). */
  | { readonly type: 'run/discardItem'; readonly x: number; readonly y: number }
  /** Move one `pendingLoot` id into the bag (refused if it does not fit). */
  | { readonly type: 'run/takeLoot'; readonly itemId: ItemId }
  /** Forfeit one `pendingLoot` id — the only way a guaranteed drop is lost: by choice. */
  | { readonly type: 'run/forfeitLoot'; readonly itemId: ItemId }
  | { readonly type: 'run/reorderParty'; readonly order: readonly UnitId[] }
  | { readonly type: 'run/setMcName'; readonly name: string }
  | { readonly type: 'run/setCompanyName'; readonly name: string }

// ── travel (overworld state machine, §2.9 / §7.16) ───────────────────────

export type TravelAction =
  /** Click a node = go (§2.9: no plan/confirm bar). BFS path over visible edges; `nodeId === current` re-enters
   *  the node (no hop, no food) → status 'atNode' (quick menu). Legal with NO overlay OR with the quick menu open
   *  (a node click from the quick menu replaces the atNode record; `journeyEnded{reason:'stayed'}` for the
   *  abandoned one); refused while a hop is walking/suspended or any other overlay is open. Resets `ui.mapPan`. */
  | { readonly type: 'travel/goTo'; readonly nodeId: NodeId }
  /** THE pump. Two internal phases: BEGIN the next hop (food/starvation/day/roll or
   *  scout-consume; suspend on an encounter) or LAND the hop in flight (traversal++,
   *  visited, locationArrived, decision-node pause). */
  | { readonly type: 'travel/step' }
  /** Quick-menu "Continue Travel" (atNode with path remaining → walking). */
  | { readonly type: 'travel/continue' }
  /** Quick-menu "Stay Here" / close: clears `pendingTravel`. */
  | { readonly type: 'travel/stay' }
  /** Quick-menu "Challenge the boss" at the BOSS node → `pendingCombat{origin finalBoss}` with the node's enemyGroupId. */
  | { readonly type: 'travel/challengeBoss' }

// ── town (§2.10) ─────────────────────────────────────────────────────────

export type TownAction =
  /** Quick menu at a TOWN node → `run.town = { townId }`, screen town. Leaves `ui` untouched (the menu item dispatches `ui/setTownTab` next). */
  | { readonly type: 'town/enter' }
  /** `run.town = null`, screen overworld. */
  | { readonly type: 'town/leave' }
  /** Inn: heals every wounded unit to full; cost = wounded × `innHealCostPerUnit`; refused if gold short. Its OWN action. */
  | { readonly type: 'town/innHeal' }
  /** Price from `Item.buyPrice` (absent ⇒ refused: unbuyable by construction). Bag must fit the item's gridSize. */
  | { readonly type: 'town/buy'; readonly itemId: ItemId }
  /** Sell the bag entry at (x, y) for `run/economy.ts#entrySellPrice` (charges and all). */
  | { readonly type: 'town/sell'; readonly x: number; readonly y: number }
  /** Tavern quest board row "Talk to {npc}" → `pendingDialogue{source 'tavern'}`. Refused if the row's `visibleIf` fails. */
  | { readonly type: 'town/talk'; readonly questId: string; readonly dialogueId: string }
  | { readonly type: 'town/turnInPrisoner'; readonly unitId: UnitId }
  | { readonly type: 'town/turnInAllPrisoners' }

// ── camp (§2.10) ─────────────────────────────────────────────────────────

export type CampAction =
  | { readonly type: 'camp/enter' }
  /** Heal all `floor(max × 0.2)` for 1 food via `consumeFood` (day/hop counters untouched); refused at 0 food or if the visit's action is taken. */
  | { readonly type: 'camp/rest' }
  /** 1 food; pre-rolls every edge within BFS depth 3 into `scoutedEdges['<from>-><to>#<pass>']`; same refusals as rest. */
  | { readonly type: 'camp/scout' }
  | { readonly type: 'camp/leave' }

// ── dungeon (§2.11) ──────────────────────────────────────────────────────

export type DungeonAction =
  /** From the quick menu at a DUNGEON node. Refused (reason rendered by the menu) while the node is `locked` and
   *  not in `run.unlockedNodes`. Graph generated from `deriveState(run.rng, rngLabels.dungeon(id))` and stored. */
  | { readonly type: 'dungeon/enter' }
  /** Move to a successor room and enter it: combat/elite/boss → `pendingCombat`; event → `pendingCheckEvent`;
   *  rest → heal 30% free; treasure → guaranteed gear + 50g. */
  | { readonly type: 'dungeon/moveTo'; readonly roomId: RoomId }
  /** Legal only at the entrance (position null) or after the boss is cleared. */
  | { readonly type: 'dungeon/leave' }

// ── dialogue / check events / naming (§2.12, §2.16) ──────────────────────

export type DialogueAction =
  /** `attemptingUnitId` only matters for a stat check; omitted ⇒ best living candidate (the CLI relies on it).
   *  Refused (not thrown) on hidden/disabled/unknown choices. */
  | { readonly type: 'dialogue/choose'; readonly choiceId: string; readonly attemptingUnitId: UnitId | null }
  /** Legal only on a node with zero choices (a narration beat): closes the tree. */
  | { readonly type: 'dialogue/continue' }

export type CheckAction =
  /** Resolves the check and applies the outcome's effects EXCEPT `startDialogue`, which waits in
   *  `result.deferredEffects` (one suspender slot at a time). */
  | { readonly type: 'check/choose'; readonly choiceId: string; readonly attemptingUnitId: UnitId | null }
  /** Closes the narration; clears the slot; applies `deferredEffects`; travel/dungeon flow resumes via settle. */
  | { readonly type: 'check/dismiss' }

export type NameAction =
  /** Answers `pendingNamePrompt`; routes to mcName/companyName by target; refused if empty after trim. */
  | { readonly type: 'name/submit'; readonly name: string }

// ── combat (§2.1–2.6, §2.16). Every legality rule lives in the reducer. ─

export type CombatAction =
  | { readonly type: 'combat/selectCard'; readonly cardUid: CardUid }
  | { readonly type: 'combat/pinTarget'; readonly tile: TileKey }
  | { readonly type: 'combat/enterMove' }
  | { readonly type: 'combat/enterCapture' }
  /** Esc / right-click: selection → idle. Never opens pause. */
  | { readonly type: 'combat/cancel' }
  /** Play `cardUid` from the ACTIVE unit's hand at `tile` (null for self / all_* cards — selectors then centre
   *  on the source, see `combat/targeting.ts#recipients`). Validates AP, hand membership, range (manhattan,
   *  obstacles excluded, no LOS; the authored range of a card carrying `Move` already includes the approach),
   *  targetKind vs occupant team, then resolves: discard FIRST → cover redirect → AOE expansion → effects in
   *  order (`Move` steps toward the target, `combat/cards.ts`) → quiver mods → AP −cost → checkEnd. */
  | { readonly type: 'combat/playCard'; readonly cardUid: CardUid; readonly tile: TileKey | null }
  /** The active unit's free move: 4-dir BFS ≤ mov through free non-obstacle tiles; refused if moved/immobilized. */
  | { readonly type: 'combat/moveUnit'; readonly tile: TileKey }
  /** 1-AP self drink from `combat.consumables` by the ACTIVE PARTY unit. */
  | { readonly type: 'combat/useItem'; readonly itemId: ItemId }
  /** 2 AP; target = living uncaptured enemy orthogonally adjacent; `rng.next() < chance` from `combat.rng`, written back either way. */
  | { readonly type: 'combat/capture'; readonly targetId: UnitId }
  /** endTurn order (§2.1): tick ending unit's ownerTurnEnd statuses → checkEnd → successor (AP 3, hasMoved false,
   *  coverUsed [], ownerTurnStart decrement, armor per knob) → ending unit discards, successor draws to 5 → selection idle. */
  | { readonly type: 'combat/endTurn' }
  /** PUMP: plan ONE enemy step from (state, combat.rng) — move, act or end — and apply it; writes the advanced rng back. */
  | { readonly type: 'combat/enemyStep' }
  /** The planned attack/heal/buff step for an ENEMY unit. `actionsTaken++`; under the `'ap'` budget knob it also
   *  costs `rules.combat.enemyActionApCost`. Also dispatchable by tests. */
  | { readonly type: 'combat/enemyAct'; readonly unitId: UnitId; readonly actionId: string; readonly tile: TileKey }

export type TutorialAction =
  /** Marks `tutorialSeen`, drops the tutorial battle without a report or payout, → prologue dialogue. */
  | { readonly type: 'tutorial/skip' }

export type BattleEndAction =
  /** Field Report "Continue". Refused while `pendingLoot` is non-empty. Clears `lastBattle` and routes by
   *  `origin`: tutorial → `tutorialSeen` + prologue dialogue (either outcome); travel → overworld (the hop resumes
   *  via settle); quest → overworld; dungeon combat/elite → dungeon; dungeon boss → exit + overworld; finalBoss →
   *  `endRun('won')`. Post-battle dialogues / the group `victoryEvent` are NOT opened here: they wait in
   *  `run.pendingFollowUps` and settle opens them one at a time once the report is gone. */
  | { readonly type: 'battleEnd/dismiss' }

// ── quest seams (content-driven in play; exposed for CLI/tests) ──────────

export type QuestAction =
  | { readonly type: 'quest/start'; readonly questId: string }
  | { readonly type: 'quest/advance'; readonly questId: string; readonly toStage: string }
  | { readonly type: 'quest/complete'; readonly questId: string }
  | { readonly type: 'quest/setFlag'; readonly key: string; readonly value: FlagValue; readonly scope: FlagScope }
  | { readonly type: 'quest/applyEffects'; readonly effects: readonly QuestEffect[] }

// ── ui chrome (ephemeral; never logged) ──────────────────────────────────

export type UiAction =
  | { readonly type: 'ui/openModal'; readonly modal: Modal }
  | { readonly type: 'ui/closeModal' }
  | { readonly type: 'ui/setTownTab'; readonly tab: TownTab }
  | { readonly type: 'ui/toggleDanger' }
  | { readonly type: 'ui/toggleDevHud' }
  /** Overworld sheet camera; null = follow the current node. */
  | { readonly type: 'ui/setMapPan'; readonly pan: { readonly x: number; readonly y: number } | null }

// ── save / resume (§2.14) ────────────────────────────────────────────────

export type SaveAction =
  /** Boot: the host parsed+validated the file (`save/codec.ts#parseSave`); the engine installs meta/run/combat
   *  atomically with default `ui`, `ledger: null` and `screen: title` — the player presses Continue (or New Run)
   *  on the Title screen; Continue routes via `resumeScreen`. */
  | { readonly type: 'save/resume'; readonly file: SaveFile }

// ── dev fast-paths (`?screen=`, CLI, tests; refused in production) ───────

export type DevAction =
  /** Replace the whole game state (the host validates it through the save schema first). */
  | { readonly type: 'dev/seedState'; readonly state: GameState }
  | { readonly type: 'dev/setScreen'; readonly screen: Screen }
  /** Seed a battle directly from a spec (sims, `?screen=combat`). */
  | { readonly type: 'dev/startBattle'; readonly spec: BattleSpec }
  /** Full-unit add — tests/CLI only (§2.16). */
  | { readonly type: 'dev/addUnit'; readonly unit: Unit }
  | { readonly type: 'dev/addItem'; readonly itemId: ItemId }
  /** Signed, clamped at 0. */
  | { readonly type: 'dev/addGold'; readonly amount: number }
  /** Signed ration CHARGES, clamped at 0; day/hop counters untouched. */
  | { readonly type: 'dev/addFood'; readonly amount: number }
  | { readonly type: 'dev/teleport'; readonly nodeId: NodeId }
  | { readonly type: 'dev/setRunRng'; readonly rng: RngState }
  | { readonly type: 'dev/setCombatRng'; readonly rng: RngState }
  | { readonly type: 'dev/applyStatus'; readonly unitId: UnitId; readonly status: ActiveStatus }

export type Action =
  | MetaAction
  | RunAction
  | TravelAction
  | TownAction
  | CampAction
  | DungeonAction
  | DialogueAction
  | CheckAction
  | NameAction
  | CombatAction
  | TutorialAction
  | BattleEndAction
  | QuestAction
  | UiAction
  | SaveAction
  | DevAction

export type ActionType = Action['type']

/** Pump actions: the runtime dispatches them; screens never do. */
export type PumpAction = Extract<Action, { type: 'travel/step' | 'combat/enemyStep' }>

/** Everything except `ui/*`. The runtime logs EVERY action (ui included); because legality never reads `ui`,
 *  a replay may filter the log to `GameAction` and still reach the same persisted slices. */
export type GameAction = Exclude<Action, UiAction>

export function isUiAction(a: Action): a is UiAction {
  return a.type.startsWith('ui/')
}

export function isPumpAction(a: Action): a is PumpAction {
  return a.type === 'travel/step' || a.type === 'combat/enemyStep'
}

export function isDevAction(a: Action): a is DevAction {
  return a.type.startsWith('dev/')
}

// ═══════════════════════════════════════════════════════════════════════════
// REDUCER RESULT SHAPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ReduceResult {
  readonly state: GameState
  readonly effects: readonly Effect[]
}

/** Per-slice reducers and rule functions return the slice they own plus effects. */
export interface SliceResult<S> {
  readonly state: S
  readonly effects: readonly Effect[]
}

export type Legality = { readonly ok: true } | { readonly ok: false; readonly reason: string }
