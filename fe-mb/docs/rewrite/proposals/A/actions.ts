/**
 * PROPOSAL A — `src/engine/actions.ts`
 *
 * The complete `Action` discriminated union (every rule in brief §2 has a
 * door here and nowhere else) and the `Effect` union the reducer emits.
 *
 *   GameState × Action ──reduce(env)──▶ { state: GameState, effects: Effect[] }
 *
 * Conventions
 * - `type` is `'<domain>/<verb>'`. The prefix routes to the sub-reducer
 *   (`meta/ run/ travel/ town/ camp/ dungeon/ dialogue/ check/ name/ quest/
 *   combat/ tutorial/ battleEnd/ ui/ save/ dev/`).
 * - Illegal actions (wrong screen, insufficient AP, out of range…) leave the
 *   state UNCHANGED and emit exactly one `{kind:'refused'}` effect. The UI
 *   renders disabled-with-reason from the same `legal*` selectors the reducer
 *   uses, so a refusal in play is a bug, never a flow.
 * - Three actions are PUMPS (`travel/step`, `combat/enemyStep`,
 *   `combat/enemyAct`): dispatched by the runtime, never by a screen. The
 *   engine says WHICH pump is due (`flow/pump.ts#nextPump`); the runtime only
 *   decides WHEN.
 * - Effects are semantic, carry no milliseconds, and are never stored.
 *   `DomainEvent ⊂ Effect`: the quest/telemetry events of brief §2.12 are
 *   just effects with a `domain: true` marker, emitted from reducers, never
 *   from screens (§7.8, §7.13).
 *
 * Intended location: `game/src/engine/actions.ts`.
 */

import type {
  BattleSpec,
  BattleTag,
  CombatState,
  DamageType,
  FlagScope,
  FlagValue,
  GameState,
  HandSlot,
  Modal,
  PartyUnit,
  QuestEffect,
  Rarity,
  RunState,
  SaveFile,
  Screen,
  StatusId,
  TileKey,
  TownTab,
} from './types'

// ═══════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

// ── meta / title ─────────────────────────────────────────────────────────

export type MetaAction =
  /** Title "New Run": seeds a fresh run (§2.13 kit) via `run/newRun.ts#seedNewRun`,
   *  deletes any existing run, `meta.totalRuns++`, then routes to the tutorial
   *  battle (first run, `!meta.tutorialSeen`) or the prologue. `seed` comes
   *  from the impure host (UI `Date.now()`, CLI `--seed`). */
  | { readonly type: 'meta/newRun'; readonly seed: number }
  /** Title "Continue" when a run is already in memory (after `meta/toTitle`). */
  | { readonly type: 'meta/continueRun' }
  /** Pause "Save & Quit to Title": screen → title, run kept (the autosave holds it). */
  | { readonly type: 'meta/toTitle' }
  | { readonly type: 'meta/setAudioMuted'; readonly muted: boolean }

// ── run: party, bag, gear, naming ────────────────────────────────────────

export type RunAction =
  /** Atomic dry-run plan (§2.7): displaced items must fit the bag or refused. */
  | { readonly type: 'run/equip'; readonly unitId: string; readonly itemId: string; readonly slot: HandSlot }
  | { readonly type: 'run/unequip'; readonly unitId: string; readonly slot: HandSlot }
  | { readonly type: 'run/moveBagItem'; readonly itemId: string; readonly x: number; readonly y: number }
  /** Discard a bag row outright (frees cells for pending loot). */
  | { readonly type: 'run/discardItem'; readonly itemId: string }
  /** Move one `pendingLoot` id into the bag (refused if it does not fit). */
  | { readonly type: 'run/takeLoot'; readonly itemId: string }
  /** Forfeit one `pendingLoot` id (the only way a guaranteed drop is lost — by choice). */
  | { readonly type: 'run/forfeitLoot'; readonly itemId: string }
  | { readonly type: 'run/setMcName'; readonly name: string }
  | { readonly type: 'run/setCompanyName'; readonly name: string }

// ── travel (overworld state machine, §2.9 / §7.16) ───────────────────────

export type TravelAction =
  /** Click a node = go. BFS path over visible edges; `nodeId === current`
   *  re-enters the node (no hop, no food) → status 'atNode'. Refused while
   *  a hop is in flight or any pending slot is open. */
  | { readonly type: 'travel/goTo'; readonly nodeId: string }
  /** THE pump. Two internal phases: begin the next hop (food/starvation/day/
   *  roll or scout-consume) or land the hop in flight (traversal++, visited,
   *  LocationArrived, decision-node pause). */
  | { readonly type: 'travel/step' }
  /** Quick-menu "Continue Travel" (status atNode with path remaining → walking). */
  | { readonly type: 'travel/continue' }
  /** Quick-menu "Stay Here" / close: clears `pendingTravel`. */
  | { readonly type: 'travel/stay' }
  /** Quick-menu "Challenge the boss" at the boss node → finalBoss battle. */
  | { readonly type: 'travel/challengeBoss' }

// ── town (§2.10) ─────────────────────────────────────────────────────────

export type TownAction =
  | { readonly type: 'town/enter' }
  | { readonly type: 'town/setTab'; readonly tab: TownTab }
  | { readonly type: 'town/leave' }
  /** Inn: heals every wounded unit to full; cost = wounded × innHealCostPerUnit; refused if gold short. */
  | { readonly type: 'town/innHeal' }
  | { readonly type: 'town/buy'; readonly itemId: string }
  | { readonly type: 'town/sell'; readonly itemId: string }
  /** Tavern quest board "Talk to {npc}" → `pendingDialogue`. Entry must be visible. */
  | { readonly type: 'town/talk'; readonly dialogueId: string }
  | { readonly type: 'town/turnInPrisoner'; readonly unitId: string }
  | { readonly type: 'town/turnInAllPrisoners' }

// ── camp (§2.10) ─────────────────────────────────────────────────────────

export type CampAction =
  | { readonly type: 'camp/enter' }
  /** Heal all `floor(max×0.2)` for 1 food via `consumeFood` (day/hop counters untouched). */
  | { readonly type: 'camp/rest' }
  /** 1 food; pre-rolls every edge within BFS depth 3 into `scoutedEdges`. */
  | { readonly type: 'camp/scout' }
  | { readonly type: 'camp/leave' }

// ── dungeon (§2.11) ──────────────────────────────────────────────────────

export type DungeonAction =
  /** From the quick menu at a DUNGEON node; gate predicate must pass. Graph
   *  generated from `deriveRng(run, 'dungeon:<id>')` and stored. */
  | { readonly type: 'dungeon/enter' }
  /** Move to a successor room and enter it: combat/elite/boss → battle;
   *  event → pendingCheckEvent; rest → heal 30%; treasure → gear + 50g. */
  | { readonly type: 'dungeon/moveTo'; readonly roomId: string }
  /** Leave: legal only at the entrance (position null) or after the boss. */
  | { readonly type: 'dungeon/leave' }

// ── dialogue / check events / naming (§2.12, §2.16) ──────────────────────

export type DialogueAction =
  /** `attemptingUnitId` only matters for a stat check; omitted ⇒ best living candidate. */
  | { readonly type: 'dialogue/choose'; readonly choiceId: string; readonly attemptingUnitId?: string }
  /** Legal only on a node with zero choices (narration beat) — ends or advances. */
  | { readonly type: 'dialogue/continue' }

export type CheckAction =
  | { readonly type: 'check/choose'; readonly choiceId: string; readonly attemptingUnitId?: string }
  /** Closes the narration; clears the slot; travel/dungeon flow resumes. */
  | { readonly type: 'check/dismiss' }

export type NameAction =
  | { readonly type: 'name/submit'; readonly name: string }

// ── combat (§2.1–2.6) ────────────────────────────────────────────────────

export type CombatAction =
  | { readonly type: 'combat/selectCard'; readonly cardUid: string }
  | { readonly type: 'combat/pinTarget'; readonly tile: TileKey }
  | { readonly type: 'combat/enterMove' }
  | { readonly type: 'combat/enterCapture' }
  /** Esc / right-click: selection → idle. Never opens pause. */
  | { readonly type: 'combat/cancel' }
  /** Full validation in the reducer: AP, hand membership, range, targetKind,
   *  living target per tile, AOE expansion, foe/ally split. `tile` is the
   *  target/centre tile; null for self / all_enemies / all_allies. */
  | { readonly type: 'combat/playCard'; readonly cardUid: string; readonly tile: TileKey | null }
  /** Free move: 4-dir BFS ≤ mov through free non-obstacle tiles; refused if moved/immobilized. */
  | { readonly type: 'combat/moveUnit'; readonly unitId: string; readonly tile: TileKey }
  /** 1-AP self drink from `combat.consumables` by the ACTIVE PARTY unit. */
  | { readonly type: 'combat/useItem'; readonly itemId: string }
  /** 2 AP, adjacent, `rng.next() < chance` from `combat.rng`, written back. */
  | { readonly type: 'combat/capture'; readonly targetId: string }
  | { readonly type: 'combat/endTurn' }
  /** Tab: danger-zone union toggle (one owner: this action). */
  | { readonly type: 'combat/toggleDanger' }
  /** PUMP: plan ONE enemy step from (state, state.rng) — move, act or end —
   *  and apply it. Writes the advanced rng back. Never dispatched by a screen. */
  | { readonly type: 'combat/enemyStep' }
  /** The planned attack/heal/status step. Also dispatchable by tests. */
  | { readonly type: 'combat/enemyAct'; readonly unitId: string; readonly actionId: string; readonly tile: TileKey }

export type TutorialAction =
  /** Marks `tutorialSeen`, ends the tutorial battle without loot, → prologue. */
  | { readonly type: 'tutorial/skip' }

export type BattleEndAction =
  /** Field Report "Continue". Refused while `pendingLoot` is non-empty.
   *  Routes: dungeon (combat/elite) → dungeon; dungeon boss → exit + overworld;
   *  travel → resume hop; finalBoss → win ledger. Opens victoryEvent /
   *  capture-target dialogue first if set. */
  | { readonly type: 'battleEnd/dismiss' }

// ── ui chrome ────────────────────────────────────────────────────────────

export type UiAction =
  | { readonly type: 'ui/openModal'; readonly modal: NonNullable<Modal> }
  | { readonly type: 'ui/closeModal' }

// ── save / resume (§2.14) ────────────────────────────────────────────────

export type SaveAction =
  /** Title "Continue" at boot: the host parsed+validated the file; the engine
   *  installs meta/run/combat/screen atomically with `modal: null`. */
  | { readonly type: 'save/resume'; readonly file: SaveFile }

// ── quest seams (content-driven in play; exposed for CLI/tests) ──────────

export type QuestAction =
  | { readonly type: 'quest/start'; readonly questId: string }
  | { readonly type: 'quest/advance'; readonly questId: string; readonly toStage: string }
  | { readonly type: 'quest/complete'; readonly questId: string }
  | { readonly type: 'quest/setFlag'; readonly key: string; readonly value: FlagValue; readonly scope: FlagScope }

// ── dev fast-paths (`?screen=`, CLI, tests) ──────────────────────────────

export type DevAction =
  | { readonly type: 'dev/seedState'; readonly state: GameState }
  | { readonly type: 'dev/patchRun'; readonly patch: Partial<RunState> }
  | { readonly type: 'dev/setScreen'; readonly screen: Screen }
  | { readonly type: 'dev/applyQuestEffects'; readonly effects: readonly QuestEffect[] }
  | { readonly type: 'dev/startBattle'; readonly spec: BattleSpec }
  | { readonly type: 'dev/addUnit'; readonly unit: PartyUnit }
  | { readonly type: 'dev/addItem'; readonly itemId: string }
  | { readonly type: 'dev/addGold'; readonly amount: number }
  | { readonly type: 'dev/addFood'; readonly amount: number }
  | { readonly type: 'dev/teleport'; readonly nodeId: string }

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
  | UiAction
  | SaveAction
  | QuestAction
  | DevAction

export type ActionType = Action['type']

/** Pump actions: the runtime dispatches them; screens never do. */
export type PumpAction = Extract<Action, { type: 'travel/step' | 'combat/enemyStep' }>

// ═══════════════════════════════════════════════════════════════════════════
// EFFECTS
// ═══════════════════════════════════════════════════════════════════════════

/** Sound cues (brief §4): the UI maps cue → `<audio>` pool. */
export type SoundCue =
  | 'cardPlay' | 'hitPhysical' | 'hitMagic' | 'heal' | 'death' | 'gold'
  | 'button' | 'victory' | 'defeat' | 'capture' | 'captureFail' | 'hop' | 'starve'

/** Presentation effects — what the UI animates. No timings, ever. */
export type PresentationEffect =
  | { readonly kind: 'refused'; readonly action: ActionType; readonly reason: string }
  | { readonly kind: 'sound'; readonly cue: SoundCue }
  | { readonly kind: 'banner'; readonly text: string; readonly tone: 'neutral' | 'victory' | 'defeat' | 'warning' }
  | { readonly kind: 'toast'; readonly text: string }
  // combat
  | { readonly kind: 'turnStarted'; readonly unitId: string; readonly round: number }
  | { readonly kind: 'unitMoved'; readonly unitId: string; readonly from: TileKey; readonly to: TileKey; readonly path: readonly TileKey[] }
  | { readonly kind: 'cardPlayed'; readonly unitId: string; readonly cardId: string; readonly tile: TileKey | null }
  | { readonly kind: 'enemyActed'; readonly unitId: string; readonly actionId: string; readonly tile: TileKey }
  | {
      readonly kind: 'unitHit'
      readonly unitId: string
      readonly sourceId: string | null
      readonly hpLost: number
      readonly armorLost: number
      readonly damageType: DamageType
      readonly lethal: boolean
      /** Genatsvale: the ally the blow was aimed at (float renders on `unitId`'s tile). */
      readonly redirectedFrom: string | null
      readonly cause: 'card' | 'enemyAction' | 'poison' | 'burn' | 'riposte' | 'quiver'
    }
  | { readonly kind: 'unitHealed'; readonly unitId: string; readonly amount: number; readonly cause: 'card' | 'item' | 'enemyAction' }
  | { readonly kind: 'armorGranted'; readonly unitId: string; readonly amount: number }
  | { readonly kind: 'statusApplied'; readonly unitId: string; readonly status: StatusId; readonly stacks: number; readonly turns: number }
  | { readonly kind: 'statusRemoved'; readonly unitId: string; readonly status: StatusId; readonly reason: 'expired' | 'cleansed' | 'consumed' }
  | { readonly kind: 'apChanged'; readonly unitId: string; readonly delta: number }
  | { readonly kind: 'cardsDrawn'; readonly unitId: string; readonly count: number; readonly reshuffled: boolean }
  | { readonly kind: 'itemUsed'; readonly unitId: string; readonly itemId: string }
  | { readonly kind: 'captureRolled'; readonly targetId: string; readonly chance: number; readonly success: boolean }
  | { readonly kind: 'unitDied'; readonly unitId: string; readonly team: 'party' | 'enemy' }
  | { readonly kind: 'unitCaptured'; readonly unitId: string }
  | { readonly kind: 'battleEnded'; readonly battleId: string; readonly outcome: 'victory' | 'defeat' }
  // overworld
  | { readonly kind: 'hopStarted'; readonly from: string; readonly to: string; readonly westward: boolean }
  | { readonly kind: 'hopLanded'; readonly nodeId: string }
  | { readonly kind: 'encounterRolled'; readonly edgeKey: string; readonly pass: number; readonly result: 'quiet' | 'dialogue' | 'battle' | 'checkEvent' }
  | { readonly kind: 'starvation'; readonly hpLost: number; readonly unitIds: readonly string[] }
  | { readonly kind: 'foodChanged'; readonly delta: number; readonly reason: 'hop' | 'rest' | 'scout' | 'shop' | 'quest' | 'dev' }
  | { readonly kind: 'goldChanged'; readonly delta: number; readonly reason: 'battle' | 'shop' | 'inn' | 'bounty' | 'quest' | 'treasure' | 'event' | 'dev' }
  | { readonly kind: 'itemAcquired'; readonly itemId: string; readonly rarity: Rarity; readonly source: 'loot' | 'shop' | 'quest' | 'treasure' | 'dev' }
  | { readonly kind: 'lootOverflow'; readonly itemIds: readonly string[] }
  | { readonly kind: 'partyHealed'; readonly unitIds: readonly string[]; readonly reason: 'inn' | 'rest' | 'dungeonRest' | 'quest' }
  | { readonly kind: 'scouted'; readonly edgeKeys: readonly string[] }
  | { readonly kind: 'prisonerTurnedIn'; readonly unitId: string; readonly gold: number }
  | { readonly kind: 'dungeonRoomEntered'; readonly dungeonId: string; readonly roomId: string; readonly roomType: string }
  | { readonly kind: 'nameSet'; readonly target: 'mc' | 'company'; readonly name: string }
  | { readonly kind: 'autosaveHint'; readonly urgent: boolean }

/** Domain events (brief §2.12 table). Emitted from reducers only; the runtime
 *  forwards them to the dev HUD / telemetry. A test asserts every kind has an
 *  emit site (§7.8). */
export type DomainEvent =
  | { readonly kind: 'BattleStarted'; readonly domain: true; readonly battleId: string; readonly tag: BattleTag; readonly enemies: readonly string[] }
  | { readonly kind: 'BattleVictory'; readonly domain: true; readonly battleId: string; readonly survivors: readonly string[]; readonly capturedIds: readonly string[] }
  | { readonly kind: 'BattleDefeat'; readonly domain: true; readonly battleId: string }
  | { readonly kind: 'UnitDied'; readonly domain: true; readonly unitId: string; readonly cause: 'battle' | 'starvation' | 'event' }
  | { readonly kind: 'EnemyCaptured'; readonly domain: true; readonly unitId: string; readonly classId: string; readonly level: number }
  | { readonly kind: 'LocationArrived'; readonly domain: true; readonly nodeId: string; readonly where: 'overworld' | 'dungeon' }
  | { readonly kind: 'FlagSet'; readonly domain: true; readonly key: string; readonly value: FlagValue; readonly scope: FlagScope }
  | { readonly kind: 'QuestStarted'; readonly domain: true; readonly questId: string; readonly stage: string }
  | { readonly kind: 'QuestStageAdvanced'; readonly domain: true; readonly questId: string; readonly from: string; readonly to: string }
  | { readonly kind: 'QuestCompleted'; readonly domain: true; readonly questId: string }
  | { readonly kind: 'ItemAcquired'; readonly domain: true; readonly itemId: string; readonly source: 'loot' | 'shop' | 'quest' | 'treasure' }
  | { readonly kind: 'UnitRecruited'; readonly domain: true; readonly characterId: string }
  | { readonly kind: 'PrisonerTurnedIn'; readonly domain: true; readonly unitId: string; readonly gold: number }
  | { readonly kind: 'RunEnded'; readonly domain: true; readonly outcome: 'won' | 'lost' }

export type Effect = PresentationEffect | DomainEvent

export type EffectKind = Effect['kind']

// ═══════════════════════════════════════════════════════════════════════════
// REDUCER SIGNATURE
// ═══════════════════════════════════════════════════════════════════════════

export interface ReduceResult {
  readonly state: GameState
  readonly effects: readonly Effect[]
}

/** Per-domain reducers share this shape; `combat/reducer.ts` works on `CombatState`. */
export interface SubReduceResult<S> {
  readonly state: S
  readonly effects: readonly Effect[]
}

export type CombatReduceResult = SubReduceResult<CombatState>
