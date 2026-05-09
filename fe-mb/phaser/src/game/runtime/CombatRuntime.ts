import type { UnitId } from '../../domain/ids'

// CombatRuntime is a plain mutable POJO scoped to the Phaser CombatScene.
// It holds sprite refs, tween handles, hover state — anything per-frame mutable.
// State that must survive save/load lives in combatStore, not here.

export interface RuntimeUnitSprite {
  id: string
  // In a real Phaser scene this is Phaser.GameObjects.Sprite. We type it as `unknown`
  // here so the runtime stays Phaser-agnostic for testing; the scene casts on use.
  sprite: unknown
}

export class CombatRuntime {
  spriteByUnitId = new Map<string, RuntimeUnitSprite>()
  tilesContainer: unknown = null
  hoverTileId: string | null = null
  activeTweens: unknown[] = []
  awaitingAnimations = false

  registerUnit(id: UnitId, sprite: unknown): void {
    this.spriteByUnitId.set(id as unknown as string, { id: id as unknown as string, sprite })
  }

  unregisterUnit(id: UnitId): void {
    this.spriteByUnitId.delete(id as unknown as string)
  }

  reset(): void {
    this.spriteByUnitId.clear()
    this.tilesContainer = null
    this.hoverTileId = null
    this.activeTweens = []
    this.awaitingAnimations = false
  }
}
