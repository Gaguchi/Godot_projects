import type { UnitId, CardId, TileId } from './ids'
import type { Unit } from './unit'
import type { CardEffect } from './card'
import type { RngState } from './rng'

export type CombatPhase = 'BOOT' | 'DEPLOY' | 'COMBAT' | 'VICTORY' | 'DEFEAT'
export type CombatSubPhase = 'IDLE' | 'SELECTING_CARD' | 'SELECTING_TARGET' | 'RESOLVING'

export interface DeckState {
  draw: CardId[]
  hand: CardId[]
  discard: CardId[]
}

export interface CombatGrid {
  width: number
  height: number
  obstacles: Set<TileId>
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
  effectQueue: CombatEffect[]
}

// --- CombatEvent: dispatched into the reducer ---

export type CombatEvent =
  | { type: 'startBattle'; payload: { units: Unit[]; grid: CombatGrid; rngSeed: RngState; decks?: Record<string, DeckState> } }
  | { type: 'startTurn'; payload: { unitId: UnitId } }
  | { type: 'selectCard'; payload: { cardId: CardId } }
  | { type: 'cancelSelection' }
  | { type: 'playCard'; payload: { cardId: CardId; srcId: UnitId; targets: TileId[] } }
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
