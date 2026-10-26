/**
 * ENGINE CONTRACT — the `Effect` union: the reducer's DESCRIPTION of what
 * happened. Semantic only: no durations, no pixels, no sprite handles
 * (brief §2.1). The UI consumes and forgets them; the CLI prints them; tests
 * assert on them. They are never state.
 *
 * One flat union. The brief's "domain events" (§2.12 table) are ordinary
 * members (`flagSet`, `questStarted`, `locationArrived`, …) emitted from
 * reducers only — never from a screen (§7.8, §7.13). A test asserts every
 * `Effect['kind']` has at least one emit site.
 *
 * Contract change rules: `docs/rewrite/CONTRACT.md` → CONTRACT-CHANGES.md.
 */

import type {
  BattleId,
  BattleReport,
  CardId,
  CardUid,
  DamageType,
  FlagScope,
  FlagValue,
  ItemId,
  NodeId,
  Rarity,
  RefKey,
  RoomId,
  RoomType,
  Screen,
  StatusId,
  Team,
  TileKey,
  UnitId,
} from './types'
import type { ActionType } from './actions'

/** Sound cues (brief §4): the UI maps cue → `<audio>` pool. */
export type SoundCue =
  | 'cardPlay' | 'hitPhysical' | 'hitMagic' | 'heal' | 'death' | 'gold' | 'button'
  | 'victory' | 'defeat' | 'capture' | 'captureFail' | 'hop' | 'starve' | 'footsteps'

export type UnitHitCause = 'card' | 'enemyAction' | 'poison' | 'burn' | 'riposte' | 'quiver' | 'item'

export type Effect =
  // ── control / presentation ──
  /** An illegal action left the state UNCHANGED (same reference). In play this is a bug, never a flow. */
  | { readonly kind: 'refused'; readonly action: ActionType; readonly reason: string }
  | { readonly kind: 'sound'; readonly cue: SoundCue }
  | { readonly kind: 'toast'; readonly text: string }
  /** The runtime persists this dispatch's state BEFORE any state or effect listener runs (both urgent and not —
   *  `flow/runtime.ts#commit`); `urgent` ⇒ the host writes synchronously instead of coalescing (run ended / screen changed). */
  | { readonly kind: 'autosave'; readonly urgent: boolean }
  | { readonly kind: 'screenChanged'; readonly from: Screen; readonly to: Screen }

  // ── combat ──
  | { readonly kind: 'battleStarted'; readonly battleId: BattleId; readonly enemyIds: readonly UnitId[] }
  | { readonly kind: 'turnStarted'; readonly unitId: UnitId; readonly team: Team; readonly round: number }
  /** `path` includes the destination, excludes the origin. */
  | { readonly kind: 'unitMoved'; readonly unitId: UnitId; readonly from: TileKey; readonly path: readonly TileKey[] }
  /** `cardUid` names the hand instance that left (two copies of a card id are distinct fly-outs). */
  | { readonly kind: 'cardPlayed'; readonly unitId: UnitId; readonly cardUid: CardUid; readonly cardId: CardId; readonly tile: TileKey | null; readonly apCost: number }
  | { readonly kind: 'enemyActed'; readonly unitId: UnitId; readonly actionId: string; readonly tile: TileKey }
  | {
      readonly kind: 'unitHit'
      readonly unitId: UnitId
      /** The FINAL target's tile (the protector's when redirected) — a lethal hit's unit has `position` null in `state`. */
      readonly tile: TileKey
      readonly sourceId: UnitId | null
      readonly hpLost: number
      readonly armorLost: number
      readonly damageType: DamageType
      readonly lethal: boolean
      /** Genatsvale: the ally the blow was aimed at (the float renders on `unitId`'s tile). */
      readonly redirectedFrom: UnitId | null
      readonly cause: UnitHitCause
    }
  | { readonly kind: 'unitHealed'; readonly unitId: UnitId; readonly amount: number; readonly cause: 'card' | 'item' | 'enemyAction' }
  | { readonly kind: 'armorGranted'; readonly unitId: UnitId; readonly amount: number; readonly capped: boolean }
  | { readonly kind: 'armorShredded'; readonly unitId: UnitId; readonly amount: number }
  | { readonly kind: 'statusApplied'; readonly unitId: UnitId; readonly status: StatusId; readonly stacks: number; readonly turns: number }
  | { readonly kind: 'statusRemoved'; readonly unitId: UnitId; readonly status: StatusId; readonly reason: 'expired' | 'cleansed' | 'consumed' }
  | { readonly kind: 'statusTicked'; readonly unitId: UnitId; readonly status: StatusId; readonly damage: number }
  | { readonly kind: 'riposte'; readonly fromId: UnitId; readonly toId: UnitId; readonly amount: number }
  | { readonly kind: 'covered'; readonly protectorId: UnitId; readonly protecteeId: UnitId }
  | { readonly kind: 'apChanged'; readonly unitId: UnitId; readonly ap: number; readonly delta: number }
  /** `uids` are the new hand instances in draw order (the draw-in targets them). */
  | { readonly kind: 'cardsDrawn'; readonly unitId: UnitId; readonly uids: readonly CardUid[]; readonly reshuffled: boolean }
  | { readonly kind: 'itemUsed'; readonly unitId: UnitId; readonly itemId: ItemId }
  | { readonly kind: 'captureRolled'; readonly targetId: UnitId; readonly attackerId: UnitId; readonly chance: number; readonly success: boolean }
  /** `tile` = where it fell (`CombatUnit.lastTile`); `position` is already null in `state`. */
  | { readonly kind: 'unitDied'; readonly unitId: UnitId; readonly tile: TileKey; readonly team: Team; readonly cause: 'damage' | 'dot' | 'riposte' }
  | { readonly kind: 'unitCaptured'; readonly unitId: UnitId; readonly tile: TileKey }
  | { readonly kind: 'battleEnded'; readonly battleId: BattleId; readonly outcome: 'victory' | 'defeat' }
  /** The ONE payout happened (`applyBattleResult`); the CLI prints the Field Report from it. */
  | { readonly kind: 'battleResolved'; readonly report: BattleReport }
  | { readonly kind: 'battleVictory'; readonly battleId: BattleId; readonly survivors: readonly UnitId[]; readonly capturedIds: readonly UnitId[] }
  | { readonly kind: 'battleDefeat'; readonly battleId: BattleId }

  // ── run / economy ──
  | { readonly kind: 'goldChanged'; readonly delta: number; readonly reason: 'battle' | 'shop' | 'inn' | 'bounty' | 'quest' | 'event' | 'treasure' | 'dev' }
  | { readonly kind: 'foodChanged'; readonly delta: number; readonly reason: 'hop' | 'rest' | 'scout' | 'shop' | 'quest' | 'event' | 'dev' }
  | { readonly kind: 'starvation'; readonly unitIds: readonly UnitId[]; readonly amount: number }
  | { readonly kind: 'itemAcquired'; readonly itemId: ItemId; readonly rarity: Rarity; readonly source: 'loot' | 'shop' | 'quest' | 'event' | 'treasure' | 'trophy' | 'dev' }
  | { readonly kind: 'itemRemoved'; readonly itemId: ItemId; readonly reason: 'sold' | 'consumed' | 'discarded' | 'forfeited' }
  /** Guaranteed drop(s) waiting in `run.pendingLoot` for a bag slot. */
  | { readonly kind: 'lootOverflow'; readonly itemIds: readonly ItemId[] }
  | { readonly kind: 'partyHealed'; readonly unitIds: readonly UnitId[]; readonly reason: 'inn' | 'campRest' | 'dungeonRest' | 'quest' }
  | { readonly kind: 'partyDamaged'; readonly unitIds: readonly UnitId[]; readonly amount: number; readonly reason: 'quest' | 'event' }
  | { readonly kind: 'prisonerTaken'; readonly unitId: UnitId; readonly name: string; readonly bountyValue: number | null }
  | { readonly kind: 'prisonerTurnedIn'; readonly unitId: UnitId; readonly gold: number }
  | { readonly kind: 'unitRecruited'; readonly characterId: string }
  /** Permadeath record written (battle payout, starvation, quest damage). */
  | { readonly kind: 'unitLost'; readonly unitId: UnitId; readonly cause: 'battle' | 'starvation' | 'event' }
  | { readonly kind: 'nameSet'; readonly target: 'mc' | 'company'; readonly name: string }

  // ── overworld / dungeon ──
  | { readonly kind: 'hopStarted'; readonly from: NodeId; readonly to: NodeId; readonly westward: boolean; readonly hopsLeft: number }
  | { readonly kind: 'hopLanded'; readonly nodeId: NodeId }
  | { readonly kind: 'encounterRolled'; readonly edgeKey: string; readonly pass: number; readonly result: 'quiet' | 'dialogue' | 'battle' | 'checkEvent'; readonly entryId: string | null; readonly scouted: boolean }
  | { readonly kind: 'journeyEnded'; readonly nodeId: NodeId; readonly reason: 'arrived' | 'stayed' }
  | { readonly kind: 'scouted'; readonly edgeKeys: readonly string[] }
  | { readonly kind: 'locationArrived'; readonly ref: RefKey }
  | { readonly kind: 'dungeonEntered'; readonly dungeonId: string }
  | { readonly kind: 'roomEntered'; readonly dungeonId: string; readonly roomId: RoomId; readonly roomType: RoomType }
  | { readonly kind: 'dungeonCleared'; readonly dungeonId: string }

  // ── narrative ──
  | { readonly kind: 'flagSet'; readonly key: string; readonly value: FlagValue; readonly scope: FlagScope }
  | { readonly kind: 'questStarted'; readonly questId: string; readonly stage: string }
  | { readonly kind: 'questStageAdvanced'; readonly questId: string; readonly from: string; readonly to: string }
  | { readonly kind: 'questCompleted'; readonly questId: string }
  | { readonly kind: 'dialogueOpened'; readonly dialogueId: string; readonly nodeId: string }
  | { readonly kind: 'dialogueClosed'; readonly dialogueId: string }
  | { readonly kind: 'checkResolved'; readonly checkEventId: string; readonly choiceId: string; readonly passed: boolean; readonly attemptingUnitId: UnitId | null }

  // ── run lifecycle ──
  | { readonly kind: 'runStarted'; readonly runId: string; readonly seed: number }
  | { readonly kind: 'runEnded'; readonly outcome: 'won' | 'lost' }

export type EffectKind = Effect['kind']
