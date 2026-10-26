import type { UnitId, CardId, TileId } from './ids'
import type { Unit } from './unit'
import type { CardEffect, CardSource } from './card'
import type { QuiverModifier } from './item'
import type { RngState } from './rng'

export type CombatPhase = 'BOOT' | 'DEPLOY' | 'COMBAT' | 'VICTORY' | 'DEFEAT'
export type CombatSubPhase = 'IDLE' | 'SELECTING_CARD' | 'SELECTING_TARGET' | 'SELECTING_MOVE' | 'RESOLVING'

export interface DeckState {
  draw: CardId[]
  hand: CardId[]
  discard: CardId[]
  /** Card provenance set at deck-build time (innate / hand_left / hand_right). */
  sources?: Record<string, CardSource>
  /** Quiver modifiers keyed by CardId — applied when the card resolves. */
  cardMods?: Record<string, QuiverModifier>
}

export interface CombatGrid {
  width: number
  height: number
  obstacles: Set<TileId>
  /** Authored cosmetic floor: tile ids ("x,y") that wear dirt over the grass.
   *  Absent = BoardScene generates patches from the battle rng
   *  (systems/boardFloor). Never read by gameplay. */
  floor?: readonly string[]
}

export interface CombatTurn {
  number: number
  unitId: UnitId | null
  team: 'party' | 'enemy'
}

export interface CombatState {
  phase: CombatPhase
  subPhase: CombatSubPhase
  turn: CombatTurn
  units: Record<string, Unit>          // keyed by UnitId-as-string
  decks: Record<string, DeckState>
  grid: CombatGrid
  rng: RngState
  selectedCardId: CardId | null
  pinnedTargetTile: TileId | null
  effectQueue: CombatEffect[]
  /** Battle identity tag set at seed time ('finalBoss' completes the run on
   *  victory; 'boss:<dungeonId>' marks dungeon bosses). null = ordinary. */
  battleTag: string | null
}

// --- CombatEvent: dispatched into the reducer ---

export type CombatEvent =
  | { type: 'startBattle'; payload: { units: Unit[]; grid: CombatGrid; rngSeed: RngState; decks?: Record<string, DeckState>; battleTag?: string } }
  | { type: 'startTurn'; payload: { unitId: UnitId } }
  | { type: 'selectCard'; payload: { cardId: CardId } }
  | { type: 'cancelSelection' }
  | { type: 'pinTarget'; payload: { tileId: TileId } }
  | { type: 'unpinTarget' }
  | {
      type: 'playCard'
      payload: {
        cardId: CardId
        srcId: UnitId
        targets: TileId[]
        // Optional inline card definition for full resolution. If absent, reducer
        // emits a WaitForAnimations stub (legacy/test path). Production callers
        // (CombatScene) supply this so the reducer can apply damage + AP cost.
        // targetKind routes beneficial riders (GrantArmor/Heal on enemy-target
        // cards go to the SOURCE); aoeRadius expands targets at resolution.
        card?: {
          apCost: number
          damageStat?: 'str' | 'mag' | 'skl'
          targetKind?: string
          aoeRadius?: number
          effects: Array<{ kind: string; params: Record<string, unknown> }>
        }
      }
    }
  | { type: 'enterMoveMode'; payload: { unitId: UnitId } }
  | { type: 'moveUnit'; payload: { unitId: UnitId; tileId: TileId } }
  | { type: 'endTurn' }
  | { type: 'tickStatus' }
  | { type: 'capture'; payload: { targetId: UnitId; attackerIds: UnitId[] } }
  | { type: 'animationsCompleted' }

// --- CombatEffect: drained by Phaser CombatScene, not state ---

export interface SpriteRef { id: string }

export type CombatEffect =
  | { kind: 'PlayTween'; sprite: SpriteRef; props: Record<string, unknown>; durationMs: number }
  | { kind: 'FloatDamage'; tile: TileId; amount: number; damageKind: 'physical' | 'magic' | 'heal' }
  | { kind: 'ShakeCamera'; intensity: number; durationMs: number }
  | { kind: 'PlaySfx'; key: string }
  | { kind: 'HitFlash'; sprite: SpriteRef; durationMs: number }
  | { kind: 'WaitForAnimations' }
  | { kind: 'ApplyCardEffect'; effect: CardEffect }   // logged for replay; resolution lives in reducer
