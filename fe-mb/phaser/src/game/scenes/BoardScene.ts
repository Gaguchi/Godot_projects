import Phaser from 'phaser'
import { shallow } from 'zustand/shallow'
import { useCombatStore } from '../../state/combatStore'
import { useCombatUiStore } from '../../state/combatUiStore'
import { useRunStore } from '../../state/runStore'
import { CombatRuntime } from '../runtime/CombatRuntime'
import { createRng } from '../../systems/rng'
import { seedStubBattle } from './seedStubBattle'
import { sfx } from '../../audio/engine'
import { tilesInRange, tilesInAoe, tilesReachable, findMovePath } from '../../systems/targeting'
import { planTurn } from '../../systems/enemyAI'
import { computeForecast, type ForecastCard } from '../../systems/damage'
import type { CombatEffect, CombatEvent } from '../../domain/combatState'
import cardsJson from '../../data/content/cards.json'
import classesJson from '../../data/content/classes.json'
import { asTileId, asUnitId } from '../../domain/ids'
// ALL canvas colors live in the one named-constant palette module — numeric
// mirrors of the index.css tokens (Phaser can't read CSS vars).
import {
  TILE_BASE, TILE_FILL_ALPHA, TILE_STROKE, TILE_STROKE_ALPHA, TILE_SPRITE_TINT,
  FRAME_SHADOW, FRAME_SHADOW_ALPHA, FRAME_FILL, FRAME_FILL_ALPHA, FRAME_EDGE, FRAME_EDGE_ALPHA,
  MOVE_RANGE, MOVE_RANGE_IDLE_ALPHA, MOVE_RANGE_MODE_ALPHA, MOVE_RANGE_DRAG_ALPHA,
  CARD_TARGET_FILL, CARD_TARGET_EDGE, CARD_TARGET_ALPHA, CARD_TARGET_HOT_ALPHA, CARD_TARGET_EDGE_ALPHA,
  DANGER_UNION, DANGER_UNION_ALPHA,
  HOVER_MOVE_ALLY, HOVER_MOVE_ENEMY, HOVER_ATTACK_ENEMY, HOVER_ATTACK_ALLY, HOVER_ALPHA,
  AOE_PREVIEW, AOE_FILL_ALPHA, AOE_EDGE_ALPHA,
  UNIT_ALLY, UNIT_ENEMY, UNIT_ALLY_RIM, UNIT_ENEMY_RIM, FLASH_WHITE, BLACK,
  ACTIVE_RING, TARGET_RING, HP_BAR_BG,
  hpTierFor, HP_TIER_FILL,
  TEXT_NAME, TEXT_OUTLINE, TEXT_HEAL, TEXT_DAMAGE, TEXT_MAGIC, KO_TEXT, KO_BG,
} from '../boardPalette'

const classMovMap = new Map<string, number>(
  classesJson.map((c) => [c.id, c.startingMov]),
)
function movementRangeForClass(classId: string): number {
  return classMovMap.get(classId) ?? 4
}

// Geometry lives in domain/boardGeometry (shared with the HUD's card drag).
import { TILE as GEO_TILE, gridOriginX, gridOriginY, tileAtStagePoint } from '../../domain/boardGeometry'
const TILE: typeof GEO_TILE = GEO_TILE
// Current board origin — recomputed per battle in drawGrid from the actual
// grid dimensions so every board centers on the stage (boardGeometry math).
let GRID_OFFSET_X = gridOriginX(14)
let GRID_OFFSET_Y = gridOriginY(10)
const GRID_W = 14
const GRID_H = 10

interface UnitView {
  container: Phaser.GameObjects.Container
  // Shape (not Arc) so allies can be a disc and enemies an angular star —
  // a non-colour team signal. fillColor / setFillStyle live on Shape.
  body: Phaser.GameObjects.Shape
  hpBar: Phaser.GameObjects.Rectangle
  glow: Phaser.GameObjects.Arc | null
  sprite?: Phaser.GameObjects.Sprite | undefined
  nameText: Phaser.GameObjects.Text
}

/** Character sprite ids loaded in preload(); keys are `unit_<id>`. */
const UNIT_SPRITES = ['roy', 'marcus', 'lilina', 'garrik', 'lyra', 'kael', 'bandit', 'bandit_archer', 'brigand_chief', 'wolf', 'daren', 'warlord', 'shield_knight', 'raider_mage', 'raider_cleric', 'thief', 'ember_mage', 'alpha_wolf'] as const

/** Map a combat unit to its character sprite texture key (or null -> shape token). */
function unitSpriteKey(name: string, cls: string): string | null {
  const n = name.toLowerCase()
  // Class-specific plates FIRST — the generic name loop below would eat
  // 'Alpha Wolf' (includes 'wolf') and similar.
  if (cls === 'alpha_wolf' || n.includes('alpha wolf')) return 'unit_alpha_wolf'
  if (cls === 'shield_knight') return 'unit_shield_knight'
  if (cls === 'raider_mage') return 'unit_raider_mage'
  if (cls === 'raider_cleric') return 'unit_raider_cleric'
  if (cls === 'ember_mage') return 'unit_ember_mage'
  if (cls === 'thief' || n.includes('thief')) return 'unit_thief'
  for (const e of ['roy', 'marcus', 'lilina', 'garrik', 'lyra', 'kael', 'daren', 'wolf']) if (n.includes(e)) return `unit_${e}`
  if (n.includes('archer')) return 'unit_bandit_archer'
  if (n.includes('warlord') || cls.includes('warlord')) return 'unit_warlord'
  if (n.includes('brigand') || n.includes('chief')) return 'unit_brigand_chief'
  if (n.includes('bandit') || cls.includes('bandit')) return 'unit_bandit'
  if (cls.includes('lord')) return 'unit_roy'
  if (cls.includes('knight')) return 'unit_marcus'
  if (cls.includes('mage')) return 'unit_lilina'
  return null
}

type CardData = typeof cardsJson[number]
const cardsMap = new Map<string, CardData>(cardsJson.map((c) => [c.id, c]))

function tileXY(tileId: string): [number, number] {
  const [xs, ys] = tileId.split(',')
  return [parseInt(xs!, 10), parseInt(ys!, 10)]
}

function tileToWorld(tileId: string): { x: number; y: number } {
  const [x, y] = tileXY(tileId)
  return {
    x: GRID_OFFSET_X + x * TILE + TILE / 2,
    y: GRID_OFFSET_Y + y * TILE + TILE / 2,
  }
}

/**
 * BoardScene — the Phaser canvas layer of combat. Owns:
 *   - Grid tiles (rectangles, range/AOE/move-range highlighting)
 *   - Unit sprites (positions, HP bars, active-turn glow)
 *   - In-world animations (PlayTween, HitFlash, FloatDamage, ShakeCamera)
 *   - Spatial pickers (tile click → move/target; unit click → enter move mode)
 *   - Damage/AOE preview on tile hover during SELECTING_TARGET
 *   - Enemy AI turn loop
 *
 * Does NOT own:
 *   - HUD chrome (TopBar, ModeLabel, MoveBtn, EndTurnBtn, CardHand,
 *     CaptureBtn). All UI buttons live in React DOM via CombatHud.
 *
 * The class key 'combat' is preserved for backward compat with
 * seedStubBattle and existing scene config.
 */
export class BoardScene extends Phaser.Scene {
  private runtime!: CombatRuntime
  private unsubEffects: (() => void) | null = null
  private unsubState: (() => void) | null = null
  private unitViews = new Map<string, UnitView>()
  /** Chess-style unit drag (press → drag → drop on a reachable tile). */
  private unitPress: {
    unitId: string
    startX: number
    startY: number
    originX: number
    originY: number
    dragging: boolean
  } | null = null
  /** Tile currently under a unit drag — brightened in renderTargeting. */
  private dragHoverTile: string | null = null
  private tileRects = new Map<string, Phaser.GameObjects.Rectangle>()
  private tileSprites: Phaser.GameObjects.Image[] = []
  private aoePreview: Phaser.GameObjects.Graphics | null = null
  private damagePreview: Phaser.GameObjects.Text | null = null
  private koSkull: Phaser.GameObjects.Text | null = null
  private pendingAnimations = 0
  private enemyTurnQueue: CombatEvent[] = []
  private enemyTurnRunning = false
  /**
   * Path the next moveUnit-driven PlayTween should walk through, captured
   * before dispatch so we can animate tile-by-tile. Cleared after use.
   */
  private pendingMovePath: { unitId: string; path: string[] } | null = null
  /**
   * Active walk tween chain — set when we're animating along pendingMovePath
   * so a second click can skip-to-end (the animation finishes immediately).
   */
  private activeWalkSkip: (() => void) | null = null
  /** Unit being hovered (for hover-overlay rendering). Null = no hover. */
  private hoverUnitId: string | null = null
  /** Valid target tile under the cursor during SELECTING_TARGET — brightens
   *  toward commitment in renderTargeting. Null = none. */
  private cardHoverTile: string | null = null
  /** Tab toggle: render union of all enemy threat zones. */
  private globalDangerZone = false
  /**
   * Units currently mid-walk-animation. renderUnits() must NOT snap their
   * container.setPosition to the logical tile while we're tweening through
   * the path, or the visual teleports to the destination instantly.
   */
  private walkingUnits = new Set<string>()

  constructor() { super('combat') }

  preload(): void {
    // Character sprites for the cast. BootScene was removed (it was a stub),
    // so 'combat' is the first scene to run — texture loading lives here.
    for (const u of UNIT_SPRITES) this.load.image(`unit_${u}`, `/sprites/units/${u}.png`)
    // Board floor: baked painted terrain variants (story 282 — tiles read as
    // ground, not flat rects). Darkened via tint to keep the moody board.
    for (let i = 1; i <= 8; i++) this.load.image(`board_grass_${i}`, `/art/terrain/grass_${i}.png`)
    for (let i = 1; i <= 4; i++) this.load.image(`board_dirt_${i}`, `/art/terrain/dirt_${i}.png`)
  }

  create(): void {
    this.runtime = new CombatRuntime()

    const cs = useCombatStore.getState()
    if (cs.state.phase === 'BOOT') {
      const runState = useRunStore.getState()
      const runRng = runState.rngState
      const recruitedParty = runState.party.partyOrder
        .map((id) => runState.party.units[id as unknown as string])
        .filter((u): u is NonNullable<typeof u> => u !== undefined)
      const event = seedStubBattle(runRng, recruitedParty)
      cs.dispatch(event, createRng(runRng))
    }

    this.drawGrid()
    this.renderUnits()
    this.renderTargeting()

    // ESC cancels active selection (still wired here so canvas-only focus
    // also dismisses; HUD ESC is handled by RAC Dialog wrappers separately).
    this.input.keyboard?.on('keydown-ESC', () => {
      const cs2 = useCombatStore.getState()
      if (cs2.state.subPhase !== 'IDLE') {
        cs2.dispatch({ type: 'cancelSelection' }, createRng(cs2.state.rng))
      }
    })

    // Chess-style unit dragging: press tracking is per-unit; the move/up
    // phase is scene-level so the drag survives leaving the hit circle.
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onUnitDragMove(pointer))
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onUnitDragEnd(pointer))

    // Tab toggles the global enemy threat overlay.
    this.input.keyboard?.on('keydown-TAB', (event: KeyboardEvent) => {
      event.preventDefault()
      this.globalDangerZone = !this.globalDangerZone
      this.renderTargeting()
    })

    this.input.mouse?.disableContextMenu()
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        const cs2 = useCombatStore.getState()
        if (cs2.state.subPhase !== 'IDLE') {
          cs2.dispatch({ type: 'cancelSelection' }, createRng(cs2.state.rng))
        }
      } else if (pointer.leftButtonDown() && this.activeWalkSkip) {
        // Click-to-skip: a walk animation is in flight; instant-finish.
        this.activeWalkSkip()
      }
    })

    // Narrow subscribe: only fire renders + AI check when render-relevant
    // slices change. Without the selector + shallow equality, every dispatch
    // (including pure effect-queue mutations) would re-run all three methods.
    // See CONTEXT.md §1 invariant #5.
    this.unsubState = useCombatStore.subscribe(
      (s) => ({
        units: s.state.units,
        turnUnitId: s.state.turn.unitId,
        turnTeam: s.state.turn.team,
        subPhase: s.state.subPhase,
        selectedCardId: s.state.selectedCardId,
        pinnedTargetTile: s.state.pinnedTargetTile,
        phase: s.state.phase,
        gridW: s.state.grid.width,
        gridH: s.state.grid.height,
      }),
      () => {
        this.ensureGridMatchesState()
        this.renderUnits()
        this.renderTargeting()
        this.maybeRunEnemyTurn()
      },
      { equalityFn: shallow },
    )

    this.unsubEffects = useCombatStore.subscribe(
      (s) => s.lastEffectId,
      () => {
        const drained = useCombatStore.getState().drainEffects()
        for (const e of drained) this.handleEffect(e)
      },
    )
  }

  /** Redraw the tile layer when a new battle changes grid dimensions
   *  (tutorial 5×5 → standard 14×10). Scene persists across battles. */
  private lastGridDims = ''
  private boardDecor: Phaser.GameObjects.GameObject[] = []
  private ensureGridMatchesState(): void {
    const g = useCombatStore.getState().state.grid
    const dims = `${g.width}x${g.height}`
    if (dims === this.lastGridDims) return
    for (const rect of this.tileRects.values()) rect.destroy()
    this.tileRects.clear()
    for (const img of this.tileSprites) img.destroy()
    this.tileSprites = []
    for (const d of this.boardDecor) d.destroy()
    this.boardDecor = []
    this.drawGrid()
  }

  private drawGrid(): void {
    const gDims = useCombatStore.getState().state.grid
    this.lastGridDims = `${gDims.width}x${gDims.height}`
    // Deterministic pseudo-random per-tile so each board feels textured
    // rather than identical squares. Same seed every load for the same
    // grid size so it doesn't shimmer on render. Warm ink base with a subtle
    // chess-read alternation so tiles are countable at a glance (the old
    // cold navy noise fought the warm Forged & Lit chrome).
    const tileTint = (x: number, y: number): number => this.tileBaseFill(x, y)
    // Draw the ACTUAL battle grid (tutorial is 5×5, standard fights 14×10) —
    // not the max dimensions.
    const g = useCombatStore.getState().state.grid
    const gridW = Math.min(g.width || GRID_W, GRID_W)
    const gridH = Math.min(g.height || GRID_H, GRID_H)
    // Center the board for THIS battle (shared math with the HUD's picking).
    GRID_OFFSET_X = gridOriginX(gridW)
    GRID_OFFSET_Y = gridOriginY(gridH)
    // The field sits ON something: a soft ground-shadow slab under the grid
    // and a forged-iron frame just outside it (created first = drawn below).
    const bw = gridW * TILE
    const bh = gridH * TILE
    const cx = GRID_OFFSET_X + bw / 2
    const cy = GRID_OFFSET_Y + bh / 2
    this.boardDecor.push(
      this.add.rectangle(cx, cy + 10, bw + 36, bh + 36, FRAME_SHADOW, FRAME_SHADOW_ALPHA),
      this.add.rectangle(cx, cy, bw + 14, bh + 14, FRAME_FILL, FRAME_FILL_ALPHA)
        .setStrokeStyle(2, FRAME_EDGE, FRAME_EDGE_ALPHA),
    )
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        // Painted ground variant under the interactive rect (deterministic pick).
        const th = ((x * 2654435761) ^ (y * 40503)) >>> 0
        const texKey = th % 5 === 0 ? `board_dirt_${(th % 4) + 1}` : `board_grass_${(th % 8) + 1}`
        if (this.textures.exists(texKey)) {
          const img = this.add.image(
            GRID_OFFSET_X + x * TILE + TILE / 2,
            GRID_OFFSET_Y + y * TILE + TILE / 2,
            texKey,
          ).setDisplaySize(TILE - 2, TILE - 2).setTint(TILE_SPRITE_TINT)
          this.tileSprites.push(img)
        }
        const rect = this.add.rectangle(
          GRID_OFFSET_X + x * TILE + TILE / 2,
          GRID_OFFSET_Y + y * TILE + TILE / 2,
          TILE - 2, TILE - 2,
          tileTint(x, y),
          TILE_FILL_ALPHA,
        ).setStrokeStyle(1, TILE_STROKE, TILE_STROKE_ALPHA)
        const tileId = `${x},${y}`
        rect.setInteractive({ useHandCursor: false })
        rect.on('pointerover', () => this.onTileHover(tileId))
        rect.on('pointerout', () => this.onTileOut())
        rect.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if (!pointer.rightButtonDown()) this.onTileClick(tileId)
        })
        this.tileRects.set(tileId, rect)
      }
    }
  }

  // Default tile fill — recomputed in renderTargeting to avoid the
  // identical-grid look on every reset. Warm ink family (the old cold navy
  // fought the amber chrome) with a subtle chess alternation so tiles are
  // countable at a glance, plus per-tile variance so the field feels worn.
  private tileBaseFill(x: number, y: number): number {
    const h = ((x * 73856093) ^ (y * 19349663)) >>> 0
    const base = TILE_BASE // --color-ink (boardPalette)
    const checker = (x + y) % 2 === 0 ? 5 : -3
    const variance = ((h % 7) - 3) + checker
    const r = ((base >> 16) & 0xff) + variance
    const g = ((base >> 8) & 0xff) + variance
    const b = (base & 0xff) + Math.floor(variance / 2)
    return (Math.max(0, r) << 16) | (Math.max(0, g) << 8) | Math.max(0, b)
  }

  private renderTargeting(): void {
    const state = useCombatStore.getState().state

    for (const [tileId, rect] of this.tileRects.entries()) {
      const [tx, ty] = tileId.split(',').map(Number)
      rect.setFillStyle(this.tileBaseFill(tx!, ty!), TILE_FILL_ALPHA)
      // Strokes are overlay-state too (card targeting paints red edges).
      rect.setStrokeStyle(1, TILE_STROKE, TILE_STROKE_ALPHA)
    }
    if (this.aoePreview) { this.aoePreview.destroy(); this.aoePreview = null }
    if (this.damagePreview) { this.damagePreview.destroy(); this.damagePreview = null }
    if (this.koSkull) { this.koSkull.destroy(); this.koSkull = null }

    // Hover overlay layer (IDLE phase only). Renders BENEFORE the selection
    // overlay so SELECTING_* tiles remain authoritative when both apply.
    if (state.subPhase === 'IDLE' && this.hoverUnitId) {
      this.renderHoverOverlay(this.hoverUnitId, state)
    }

    // Tab-toggled global danger zone (always rendered, but darker tone so
    // it doesn't fight the hover layer).
    if (state.subPhase === 'IDLE' && this.globalDangerZone) {
      this.renderGlobalDangerZone(state)
    }

    // FE convention: the ACTIVE unit's movement range is visible from the
    // moment its turn starts — no Move-button ceremony. Softer tint than
    // explicit move-mode; suppressed while a card is being targeted.
    if (state.subPhase === 'IDLE') {
      for (const t of this.reachableForActive()) {
        const rect = this.tileRects.get(t)
        if (rect) rect.setFillStyle(MOVE_RANGE, t === this.dragHoverTile ? MOVE_RANGE_DRAG_ALPHA : MOVE_RANGE_IDLE_ALPHA)
      }
    }

    if (state.subPhase === 'SELECTING_MOVE') {
      const activeId = state.turn.unitId === null ? null : (state.turn.unitId as unknown as string)
      if (!activeId) return
      const activeUnit = state.units[activeId]
      if (!activeUnit?.position) return
      if (activeUnit.hasMovedThisTurn) return
      const sourceTileId = activeUnit.position as unknown as string
      const range = movementRangeForClass(activeUnit.classId as unknown as string)
      const blocked = new Set<string>()
      for (const u of Object.values(state.units)) {
        if (u.hp.current <= 0 || !u.position) continue
        if ((u.id as unknown as string) === activeId) continue
        blocked.add(u.position as unknown as string)
      }
      const valid = tilesReachable(asTileId(sourceTileId), range, {
        width: state.grid.width,
        height: state.grid.height,
        obstacles: state.grid.obstacles,
      }, blocked)
      for (const t of valid) {
        const rect = this.tileRects.get(t as unknown as string)
        if (rect) rect.setFillStyle(MOVE_RANGE, MOVE_RANGE_MODE_ALPHA)
      }
      return
    }

    if (state.subPhase !== 'SELECTING_TARGET' || state.selectedCardId === null) return
    const card = cardsMap.get(state.selectedCardId as unknown as string)
    if (!card) return

    const activeId = state.turn.unitId === null ? null : (state.turn.unitId as unknown as string)
    if (!activeId) return
    const activeUnit = state.units[activeId]
    if (!activeUnit?.position) return

    const valid = tilesInRange(
      asTileId(activeUnit.position as unknown as string),
      card.range.min,
      card.range.max,
      { width: state.grid.width, height: state.grid.height, obstacles: state.grid.obstacles },
    )
    // Valid card targets read attack-red (genre vocabulary: red = strike),
    // with a brighter ember edge so the family holds even over tan ground.
    // The hovered / pinned tile brightens toward commitment.
    const pinnedTile = state.pinnedTargetTile === null
      ? null
      : (state.pinnedTargetTile as unknown as string)
    for (const t of valid) {
      const tStr = t as unknown as string
      const rect = this.tileRects.get(tStr)
      if (!rect) continue
      const hot = tStr === pinnedTile || tStr === this.cardHoverTile
      rect.setFillStyle(CARD_TARGET_FILL, hot ? CARD_TARGET_HOT_ALPHA : CARD_TARGET_ALPHA)
      rect.setStrokeStyle(hot ? 2 : 1.25, CARD_TARGET_EDGE, CARD_TARGET_EDGE_ALPHA)
    }
  }

  private renderHoverOverlay(unitId: string, state: ReturnType<typeof useCombatStore.getState>['state']): void {
    const u = state.units[unitId]
    if (!u || !u.position || u.hp.current <= 0) return
    const isEnemy = (u.classId as unknown as string).includes('bandit')
      || (u.classId as unknown as string).includes('brigand')
      || (u.classId as unknown as string).includes('wolf')
    const range = movementRangeForClass(u.classId as unknown as string)
    const blocked = new Set<string>()
    for (const other of Object.values(state.units)) {
      if (other.hp.current <= 0 || !other.position) continue
      if ((other.id as unknown as string) === unitId) continue
      blocked.add(other.position as unknown as string)
    }
    const reachable = tilesReachable(
      asTileId(u.position as unknown as string),
      range,
      { width: state.grid.width, height: state.grid.height, obstacles: state.grid.obstacles },
      blocked,
    )
    // Move tiles
    const moveColor = isEnemy ? HOVER_MOVE_ENEMY : HOVER_MOVE_ALLY
    for (const t of reachable) {
      const rect = this.tileRects.get(t as unknown as string)
      if (rect) rect.setFillStyle(moveColor, HOVER_ALPHA)
    }
    // Attack ring: tiles 1 step beyond reachable (basic melee threat)
    const attackTiles = new Set<string>()
    const reachSet = new Set<string>(reachable.map((t) => t as unknown as string))
    reachSet.add(u.position as unknown as string)
    for (const tileStr of reachSet) {
      const [tx, ty] = tileStr.split(',').map(Number)
      const nbrs: Array<[number, number]> = [[tx! + 1, ty!], [tx! - 1, ty!], [tx!, ty! + 1], [tx!, ty! - 1]]
      for (const [nx, ny] of nbrs) {
        if (nx < 0 || ny < 0 || nx >= state.grid.width || ny >= state.grid.height) continue
        const k = `${nx},${ny}`
        if (reachSet.has(k)) continue
        attackTiles.add(k)
      }
    }
    const attackColor = isEnemy ? HOVER_ATTACK_ENEMY : HOVER_ATTACK_ALLY
    for (const t of attackTiles) {
      const rect = this.tileRects.get(t)
      if (rect) rect.setFillStyle(attackColor, HOVER_ALPHA)
    }
  }

  private renderGlobalDangerZone(state: ReturnType<typeof useCombatStore.getState>['state']): void {
    const enemyTiles = new Set<string>()
    for (const u of Object.values(state.units)) {
      if (u.hp.current <= 0 || !u.position) continue
      const isEnemy = (u.classId as unknown as string).includes('bandit')
        || (u.classId as unknown as string).includes('brigand')
        || (u.classId as unknown as string).includes('wolf')
      if (!isEnemy) continue
      const range = movementRangeForClass(u.classId as unknown as string)
      const blocked = new Set<string>()
      for (const other of Object.values(state.units)) {
        if (other.hp.current <= 0 || !other.position) continue
        if ((other.id as unknown as string) === (u.id as unknown as string)) continue
        blocked.add(other.position as unknown as string)
      }
      const reachable = tilesReachable(
        asTileId(u.position as unknown as string),
        range,
        { width: state.grid.width, height: state.grid.height, obstacles: state.grid.obstacles },
        blocked,
      )
      enemyTiles.add(u.position as unknown as string)
      for (const t of reachable) enemyTiles.add(t as unknown as string)
      // Attack reach: 1 step beyond
      const reachSet = new Set<string>(reachable.map((t) => t as unknown as string))
      reachSet.add(u.position as unknown as string)
      for (const tileStr of reachSet) {
        const [tx, ty] = tileStr.split(',').map(Number)
        const nbrs2: Array<[number, number]> = [[tx! + 1, ty!], [tx! - 1, ty!], [tx!, ty! + 1], [tx!, ty! - 1]]
        for (const [nx, ny] of nbrs2) {
          if (nx < 0 || ny < 0 || nx >= state.grid.width || ny >= state.grid.height) continue
          enemyTiles.add(`${nx},${ny}`)
        }
      }
    }
    for (const t of enemyTiles) {
      const rect = this.tileRects.get(t)
      if (rect) {
        // Soft red-purple — only overrides default-empty tiles, lets selection
        // overlays win when both fire.
        rect.setFillStyle(DANGER_UNION, DANGER_UNION_ALPHA)
      }
    }
  }

  private onTileHover(tileId: string): void {
    const state = useCombatStore.getState().state

    // Unit hover: if there's a living unit on this tile and we're idle,
    // mark it for the hover overlay.
    if (state.subPhase === 'IDLE') {
      const occupant = Object.values(state.units).find(
        (u) => u.position && (u.position as unknown as string) === tileId && u.hp.current > 0,
      )
      const newHover = occupant ? (occupant.id as unknown as string) : null
      if (newHover !== this.hoverUnitId) {
        this.hoverUnitId = newHover
        this.renderTargeting()
      }
    }

    if (state.subPhase !== 'SELECTING_TARGET' || state.selectedCardId === null) return
    const card = cardsMap.get(state.selectedCardId as unknown as string)
    if (!card) return

    const activeId = state.turn.unitId === null ? null : (state.turn.unitId as unknown as string)
    if (!activeId) return
    const activeUnit = state.units[activeId]
    if (!activeUnit?.position) return
    const targetState = {
      width: state.grid.width,
      height: state.grid.height,
      obstacles: state.grid.obstacles,
    }
    const valid = tilesInRange(
      asTileId(activeUnit.position as unknown as string),
      card.range.min,
      card.range.max,
      targetState,
    )
    if (!new Set(valid.map((t) => t as unknown as string)).has(tileId)) {
      if (this.cardHoverTile !== null) {
        this.cardHoverTile = null
        this.renderTargeting()
      }
      return
    }

    // Brighten the hovered valid tile (renderTargeting reads cardHoverTile).
    if (this.cardHoverTile !== tileId) {
      this.cardHoverTile = tileId
      this.renderTargeting()
    }

    if (this.aoePreview) { this.aoePreview.destroy(); this.aoePreview = null }
    const radius = card.aoeRadius ?? 0
    if (radius > 0) {
      const tiles = tilesInAoe(asTileId(tileId), radius, targetState)
      const g = this.add.graphics()
      g.fillStyle(AOE_PREVIEW, AOE_FILL_ALPHA)
      g.lineStyle(1, AOE_PREVIEW, AOE_EDGE_ALPHA)
      for (const t of tiles) {
        const { x, y } = tileToWorld(t as unknown as string)
        g.fillRect(x - TILE / 2 + 2, y - TILE / 2 + 2, TILE - 4, TILE - 4)
        g.strokeRect(x - TILE / 2 + 2, y - TILE / 2 + 2, TILE - 4, TILE - 4)
      }
      this.aoePreview = g
    }

    if (this.damagePreview) { this.damagePreview.destroy(); this.damagePreview = null }
    if (this.koSkull) { this.koSkull.destroy(); this.koSkull = null }
    const targetUnit = Object.values(state.units).find(
      (u) => u.position && (u.position as unknown as string) === tileId,
    )
    if (targetUnit && (targetUnit.classId as unknown as string).includes('bandit')) {
      const forecast = computeForecast(card as ForecastCard, activeUnit, targetUnit, 0)
      if (forecast && (forecast.damageBefore > 0 || forecast.heal > 0)) {
        const { x, y } = tileToWorld(tileId)
        const label = forecast.heal > 0 ? `+${forecast.heal}` : `-${forecast.damageBefore}`
        const color = forecast.heal > 0 ? TEXT_HEAL : TEXT_DAMAGE
        this.damagePreview = this.add.text(x, y - 30, label, {
          fontFamily: 'monospace', fontSize: '20px', color,
        }).setOrigin(0.5)
        if (forecast.lethal) {
          // Lethal-hit indicator. Was an emoji skull; now a typographic
          // "KO" badge for the no-pictograph directive (story 283).
          this.koSkull = this.add.text(x, y - 6, 'KO', {
            fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold',
            color: KO_TEXT, backgroundColor: KO_BG, padding: { left: 5, right: 5, top: 1, bottom: 1 },
          }).setOrigin(0.5)
        }
      }
    }
  }

  private clearHoverUnit(): void {
    if (this.hoverUnitId !== null) {
      this.hoverUnitId = null
      this.renderTargeting()
    }
  }

  private onTileOut(): void {
    if (this.aoePreview) { this.aoePreview.destroy(); this.aoePreview = null }
    if (this.damagePreview) { this.damagePreview.destroy(); this.damagePreview = null }
    if (this.koSkull) { this.koSkull.destroy(); this.koSkull = null }
    if (this.cardHoverTile !== null) {
      this.cardHoverTile = null
      this.renderTargeting()
    }
    this.clearHoverUnit()
  }

  private onUnitClick(unitIdStr: string): void {
    const cs = useCombatStore.getState()
    const state = cs.state
    if (state.phase !== 'COMBAT') return
    const unit = state.units[unitIdStr]
    if (!unit || unit.hp.current <= 0) return

    // During target selection, a click on a unit must TARGET that unit's tile.
    // The unit's interactive hit-area sits over its tile, so onTileClick would
    // never fire for an occupied tile — delegate to it here so enemies/allies
    // can be clicked directly. (Range/validity is enforced inside onTileClick.)
    if (state.subPhase === 'SELECTING_TARGET' && state.selectedCardId !== null) {
      if (unit.position) this.onTileClick(unit.position as unknown as string)
      return
    }

    // Otherwise, pin the detail panel (works for any unit).
    useCombatUiStore.getState().setPinnedDetailUnit(unitIdStr)

    // Existing move-mode behavior only fires for the active party unit.
    if (state.turn.team !== 'party') return
    if (state.subPhase === 'RESOLVING') return
    const activeId = state.turn.unitId === null ? null : (state.turn.unitId as unknown as string)
    if (activeId !== unitIdStr) return
    if (unit.hasMovedThisTurn) return
    if (state.subPhase === 'SELECTING_MOVE') {
      cs.dispatch({ type: 'cancelSelection' }, createRng(state.rng))
      return
    }
    cs.dispatch({ type: 'enterMoveMode', payload: { unitId: unit.id } }, createRng(state.rng))
  }

  private beginUnitPress(unitIdStr: string, pointer: Phaser.Input.Pointer): void {
    const view = this.unitViews.get(unitIdStr)
    this.unitPress = {
      unitId: unitIdStr,
      startX: pointer.worldX,
      startY: pointer.worldY,
      originX: view?.container.x ?? pointer.worldX,
      originY: view?.container.y ?? pointer.worldY,
      dragging: false,
    }
  }

  private onUnitDragMove(pointer: Phaser.Input.Pointer): void {
    const press = this.unitPress
    if (!press) return
    const state = useCombatStore.getState().state
    const activeId = state.turn.unitId === null ? null : (state.turn.unitId as unknown as string)
    const unit = state.units[press.unitId]
    const draggable =
      state.phase === 'COMBAT' && state.turn.team === 'party' &&
      state.subPhase === 'IDLE' && activeId === press.unitId &&
      !!unit && !unit.hasMovedThisTurn
    if (!press.dragging) {
      const dist = Math.hypot(pointer.worldX - press.startX, pointer.worldY - press.startY)
      if (dist <= 10 || !draggable) return
      press.dragging = true
    }
    const view = this.unitViews.get(press.unitId)
    if (view) {
      view.container.setPosition(pointer.worldX, pointer.worldY - 10)
      view.container.setDepth(10000)
    }
    const tile = tileAtStagePoint(pointer.worldX, pointer.worldY, state.grid.width, state.grid.height)
    const next = tile && this.reachableForActive().has(tile) ? tile : null
    if (next !== this.dragHoverTile) {
      this.dragHoverTile = next
      this.renderTargeting()
    }
  }

  private onUnitDragEnd(pointer: Phaser.Input.Pointer): void {
    const press = this.unitPress
    this.unitPress = null
    if (!press) return
    if (!press.dragging) {
      // plain click → original unit-click semantics (pin / target / move-mode)
      this.onUnitClick(press.unitId)
      return
    }
    this.dragHoverTile = null
    const state = useCombatStore.getState().state
    const tile = tileAtStagePoint(pointer.worldX, pointer.worldY, state.grid.width, state.grid.height)
    const view = this.unitViews.get(press.unitId)
    // Return the piece to its origin square first: on a legal drop the walk
    // animation carries it to the destination; on an illegal one it just
    // snaps home (chess piece behavior).
    if (view) {
      view.container.setPosition(press.originX, press.originY)
      view.container.setDepth(press.originY)
    }
    if (tile) this.tryMoveActiveUnit(tile)
    this.renderTargeting()
  }

  /** Reachable tiles for the ACTIVE unit this turn (FE movement range).
   *  Empty when it isn't a party turn, the unit moved, or combat is over. */
  private reachableForActive(): Set<string> {
    const state = useCombatStore.getState().state
    if (state.phase !== 'COMBAT' || state.turn.team !== 'party') return new Set()
    const activeId = state.turn.unitId === null ? null : (state.turn.unitId as unknown as string)
    if (!activeId) return new Set()
    const u = state.units[activeId]
    if (!u?.position || u.hasMovedThisTurn) return new Set()
    const blocked = new Set<string>()
    for (const o of Object.values(state.units)) {
      if (o.hp.current <= 0 || !o.position) continue
      if ((o.id as unknown as string) === activeId) continue
      blocked.add(o.position as unknown as string)
    }
    const valid = tilesReachable(
      asTileId(u.position as unknown as string),
      movementRangeForClass(u.classId as unknown as string),
      { width: state.grid.width, height: state.grid.height, obstacles: state.grid.obstacles },
      blocked,
    )
    return new Set(valid.map((t) => t as unknown as string))
  }

  /** Move the active unit to `tileId` with the walk animation (shared by
   *  move-mode clicks, FE direct clicks, and chess-style unit drags). */
  private tryMoveActiveUnit(tileId: string): boolean {
    const cs = useCombatStore.getState()
    const state = cs.state
    const activeId = state.turn.unitId === null ? null : (state.turn.unitId as unknown as string)
    if (!activeId) return false
    const activeUnit = state.units[activeId]
    if (!activeUnit?.position || activeUnit.hasMovedThisTurn) return false
    if (!this.reachableForActive().has(tileId)) return false
    const sourceTileId = activeUnit.position as unknown as string
    const blocked = new Set<string>()
    for (const u of Object.values(state.units)) {
      if (u.hp.current <= 0 || !u.position) continue
      if ((u.id as unknown as string) === activeId) continue
      blocked.add(u.position as unknown as string)
    }
    const path = findMovePath(
      asTileId(sourceTileId),
      asTileId(tileId),
      movementRangeForClass(activeUnit.classId as unknown as string),
      { width: state.grid.width, height: state.grid.height, obstacles: state.grid.obstacles },
      blocked,
    )
    if (path && path.length > 0) {
      this.pendingMovePath = { unitId: activeId, path: path.map((t) => t as unknown as string) }
      this.walkingUnits.add(activeId)
    }
    cs.dispatch({
      type: 'moveUnit',
      payload: { unitId: asUnitId(activeId), tileId: asTileId(tileId) },
    }, createRng(state.rng))
    return true
  }

  private onTileClick(tileId: string): void {
    const cs = useCombatStore.getState()
    const state = cs.state

    // FE direct move: with the range already showing in IDLE, clicking a
    // reachable tile just moves — the Move button/mode remains as a fallback.
    if (state.subPhase === 'IDLE' && this.tryMoveActiveUnit(tileId)) return

    if (state.subPhase === 'SELECTING_MOVE') {
      this.tryMoveActiveUnit(tileId)
      return
    }

    if (state.subPhase !== 'SELECTING_TARGET' || state.selectedCardId === null) return
    const card = cardsMap.get(state.selectedCardId as unknown as string)
    if (!card) return
    const activeId = state.turn.unitId === null ? null : (state.turn.unitId as unknown as string)
    if (!activeId) return
    const activeUnit = state.units[activeId]
    if (!activeUnit?.position) return
    const valid = tilesInRange(
      asTileId(activeUnit.position as unknown as string),
      card.range.min,
      card.range.max,
      { width: state.grid.width, height: state.grid.height, obstacles: state.grid.obstacles },
    )
    if (!new Set(valid.map((t) => t as unknown as string)).has(tileId)) {
      // Clicking an INVALID tile/unit mid-targeting cancels the selection —
      // silent dead clicks made targeting feel broken (playtest feedback).
      cs.dispatch({ type: 'cancelSelection' }, createRng(state.rng))
      return
    }

    // Pin-then-play: first click pins the target (opens forecast panel);
    // a second click on the same tile confirms and plays the card.
    const pinned = state.pinnedTargetTile === null
      ? null
      : (state.pinnedTargetTile as unknown as string)
    if (pinned !== tileId) {
      cs.dispatch({
        type: 'pinTarget',
        payload: { tileId: asTileId(tileId) },
      }, createRng(state.rng))
      return
    }

    const cardPayload: {
      apCost: number
      damageStat?: 'str' | 'mag' | 'skl'
      targetKind?: string
      aoeRadius?: number
      effects: Array<{ kind: string; params: Record<string, unknown> }>
    } = { apCost: card.apCost, effects: card.effects, targetKind: card.targetKind }
    if (card.damageStat) cardPayload.damageStat = card.damageStat as 'str' | 'mag' | 'skl'
    if (card.aoeRadius) cardPayload.aoeRadius = card.aoeRadius

    cs.dispatch({
      type: 'playCard',
      payload: {
        cardId: state.selectedCardId,
        srcId: activeUnit.id,
        targets: [asTileId(tileId)],
        card: cardPayload,
      },
    }, createRng(state.rng))
  }

  private renderUnits(): void {
    const state = useCombatStore.getState().state
    const activeId = state.turn.unitId === null ? null : (state.turn.unitId as unknown as string)
    const seenIds = new Set<string>()

    for (const unit of Object.values(state.units)) {
      const idStr = unit.id as unknown as string
      seenIds.add(idStr)

      let view = this.unitViews.get(idStr)
      if (!view) {
        const cls = unit.classId as unknown as string
        const isEnemy = ['bandit', 'brigand', 'wolf'].some((k) => cls.includes(k))
        // Team is a SHAPE (disc = ally / spiked star = enemy) AND a colour, so
        // the read survives colour-blindness — never colour alone.
        const fill = isEnemy ? UNIT_ENEMY : UNIT_ALLY
        const rim = isEnemy ? UNIT_ENEMY_RIM : UNIT_ALLY_RIM
        const container = this.add.container(0, 0)
        const body: Phaser.GameObjects.Shape = isEnemy
          ? this.add.star(0, 0, 4, 9, 17, fill).setStrokeStyle(2.5, rim)
          : this.add.circle(0, 0, 16, fill).setStrokeStyle(2.5, rim)
        // a soft top highlight so the token reads as a lit forged piece
        const sheen = this.add.circle(-5, -5, isEnemy ? 4 : 5, FLASH_WHITE, 0.18)
        const nameText = this.add.text(0, -24, unit.name, {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '11px',
          color: TEXT_NAME,
          stroke: TEXT_OUTLINE,
          strokeThickness: 3,
        }).setOrigin(0.5)
        // name (~-24) + HP bar (~+20) kept inside one tile pitch so a lower
        // unit's name no longer collides with the HP bar of the unit above.
        const hpBarBg = this.add.rectangle(0, 20, 36, 6, HP_BAR_BG).setStrokeStyle(1, BLACK, 0.6)
        const hpBar = this.add.rectangle(-16, 20, 32, 4, HP_TIER_FILL.ok).setOrigin(0, 0.5)
        // Transparent >=44px hit target — the visible token (~32px) is below the
        // accessible minimum, so interactivity lives on a roomier invisible circle.
        const hit = this.add.circle(0, 0, 22, BLACK, 0.001)
        container.add([body, sheen, nameText, hpBarBg, hpBar, hit])
        // Character sprite replaces the shape token when its texture is loaded;
        // a team-coloured base ellipse keeps the ally/enemy read colour-blind-safe.
        const spriteKey = unitSpriteKey(unit.name, cls)
        let sprite: Phaser.GameObjects.Sprite | undefined
        if (spriteKey && this.textures.exists(spriteKey)) {
          body.setVisible(false); sheen.setVisible(false); nameText.setY(-40)
          const baseRing = this.add.ellipse(0, 14, 28, 10, fill, 0.45).setStrokeStyle(1.5, rim, 0.85)
          sprite = this.add.sprite(0, 2, spriteKey).setOrigin(0.5, 0.82)
          sprite.setScale(48 / (this.textures.get(spriteKey).getSourceImage().height || 1216))
          container.add([baseRing, sprite])
          container.sendToBack(sprite)
          container.sendToBack(baseRing)
        }
        hit.setInteractive({ useHandCursor: true })
        hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if (pointer.rightButtonDown()) return
          this.beginUnitPress(idStr, pointer)
        })
        view = { container, body, hpBar, glow: null, sprite, nameText }
        this.unitViews.set(idStr, view)
      }
      if (!view) continue

      if (unit.position && !this.walkingUnits.has(idStr)) {
        const { x, y } = tileToWorld(unit.position as unknown as string)
        view.container.setPosition(x, y)
      }
      // Painter's order: lower rows render in front, so tall sprites never
      // get sliced by the unit below. Names show only for the ACTIVE unit —
      // a wall of floating labels was the #1 clutter in playtest.
      view.container.setDepth(view.container.y)
      view.nameText.setVisible(activeId === idStr)

      const hpFraction = unit.hp.current / Math.max(1, unit.hp.max)
      view.hpBar.width = Math.max(0, 32 * hpFraction)
      // Shared HP tiers (boardPalette = single source; hpTier.ts mirrors it
      // for the DOM readouts, so bar and text can never disagree).
      view.hpBar.fillColor = HP_TIER_FILL[hpTierFor(unit.hp.current, unit.hp.max)]

      view.container.setVisible(unit.hp.current > 0)

      if (view.glow) { view.glow.destroy(); view.glow = null }
      if (activeId === idStr) {
        // hearth-amber ring marks the active unit
        const glow = this.add.circle(0, 0, 23, ACTIVE_RING, 0.22).setStrokeStyle(2.5, ACTIVE_RING, 0.95)
        view.container.add(glow)
        view.container.sendToBack(glow)
        view.glow = glow
      } else if (
        state.subPhase === 'SELECTING_TARGET' &&
        state.pinnedTargetTile !== null &&
        unit.position !== null &&
        (unit.position as unknown as string) === (state.pinnedTargetTile as unknown as string) &&
        unit.hp.current > 0
      ) {
        // ember-red ring marks the pinned card target — "who I am hitting"
        // mirrors the active-unit ring so the commitment pair reads at a glance.
        const ring = this.add.circle(0, 0, 23, TARGET_RING, 0.18).setStrokeStyle(2.5, TARGET_RING, 0.95)
        view.container.add(ring)
        view.container.sendToBack(ring)
        view.glow = ring
      }
    }

    for (const [id, view] of this.unitViews.entries()) {
      if (!seenIds.has(id)) {
        view.container.destroy()
        this.unitViews.delete(id)
      }
    }
  }

  private handleEffect(e: CombatEffect): void {
    if (e.kind === 'PlayTween') {
      const view = this.unitViews.get(e.sprite.id)
      if (!view) return
      const targetTile = (e.props as { targetTile?: string }).targetTile
      if (!targetTile) return

      // Walk-the-path: if a path was captured before dispatch, walk it.
      const walk = this.pendingMovePath
      if (walk && walk.unitId === e.sprite.id && walk.path.length > 0) {
        this.pendingMovePath = null
        this.walkAlongPath(view, walk.path, e.sprite.id)
        return
      }

      // Compute the path from current visual position to targetTile when
      // the move is multi-tile (enemy AI emits these). This keeps the
      // tween smooth for enemy turns without changing the event shape.
      const visualTile = this.worldToTile(view.container.x, view.container.y)
      const dx = Math.abs(visualTile.x - tileXY(targetTile)[0])
      const dy = Math.abs(visualTile.y - tileXY(targetTile)[1])
      if (dx + dy > 1) {
        const state = useCombatStore.getState().state
        const blocked = new Set<string>()
        for (const u of Object.values(state.units)) {
          if (u.hp.current <= 0 || !u.position) continue
          if ((u.id as unknown as string) === e.sprite.id) continue
          blocked.add(u.position as unknown as string)
        }
        const sourceTileStr = `${visualTile.x},${visualTile.y}`
        const path = findMovePath(
          asTileId(sourceTileStr),
          asTileId(targetTile),
          dx + dy + 2, // small buffer so detours don't fail
          { width: state.grid.width, height: state.grid.height, obstacles: state.grid.obstacles },
          blocked,
        )
        if (path && path.length > 0) {
          this.walkAlongPath(view, path.map((t) => t as unknown as string), e.sprite.id)
          return
        }
      }

      // Otherwise — yoyo lunge (used by attacks).
      const lungeDest = tileToWorld(targetTile)
      const orig = { x: view.container.x, y: view.container.y }
      this.pendingAnimations++
      this.tweens.add({
        targets: view.container,
        x: lungeDest.x, y: lungeDest.y,
        duration: e.durationMs / 2,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => {
          view.container.setPosition(orig.x, orig.y)
          this.pendingAnimations--
          this.maybeAnimationsComplete()
        },
      })
    } else if (e.kind === 'HitFlash') {
      const view = this.unitViews.get(e.sprite.id)
      if (!view) return
      this.pendingAnimations++
      const restore = (): void => { this.pendingAnimations--; this.maybeAnimationsComplete() }
      if (view.sprite) {
        const s = view.sprite
        s.setAlpha(0.4)
        this.time.delayedCall(e.durationMs, () => { s.setAlpha(1); restore() })
      } else {
        const origColor = view.body.fillColor
        view.body.setFillStyle(FLASH_WHITE)
        this.time.delayedCall(e.durationMs, () => { view.body.setFillStyle(origColor); restore() })
      }
    } else if (e.kind === 'FloatDamage') {
      const tileStr = e.tile as unknown as string
      const { x, y } = tileToWorld(tileStr)
      sfx(e.damageKind === 'heal' ? 'heal' : e.damageKind === 'magic' ? 'hitMagic' : 'hitPhysical')
      const color = e.damageKind === 'heal' ? TEXT_HEAL
        : e.damageKind === 'magic' ? TEXT_MAGIC
          : TEXT_DAMAGE
      const sign = e.damageKind === 'heal' ? '+' : '-'
      const txt = this.add.text(x, y - 10, `${sign}${e.amount}`, {
        fontFamily: 'monospace', fontSize: '20px', color, stroke: TEXT_OUTLINE, strokeThickness: 3,
      }).setOrigin(0.5)
      this.pendingAnimations++
      this.tweens.add({
        targets: txt,
        y: y - 50,
        alpha: 0,
        duration: 600,
        ease: 'Quad.easeOut',
        onComplete: () => {
          txt.destroy()
          this.pendingAnimations--
          this.maybeAnimationsComplete()
        },
      })
    } else if (e.kind === 'ShakeCamera') {
      this.cameras.main.shake(e.durationMs, e.intensity)
    } else if (e.kind === 'WaitForAnimations') {
      this.maybeAnimationsComplete()
    }
  }

  private worldToTile(x: number, y: number): { x: number; y: number } {
    const tx = Math.round((x - GRID_OFFSET_X - TILE / 2) / TILE)
    const ty = Math.round((y - GRID_OFFSET_Y - TILE / 2) / TILE)
    return { x: tx, y: ty }
  }

  /**
   * Animate a unit through `path` tile-by-tile, ~120ms per step. Sets
   * `activeWalkSkip` so a second click can skip to the final tile.
   */
  private walkAlongPath(view: UnitView, path: string[], unitId: string): void {
    if (path.length === 0) return
    const STEP_MS = 120
    this.pendingAnimations++
    this.walkingUnits.add(unitId)
    let index = 0
    let cancelled = false

    const finishImmediately = (): void => {
      if (cancelled) return
      cancelled = true
      const last = path[path.length - 1]!
      const dest = tileToWorld(last)
      this.tweens.killTweensOf(view.container)
      view.container.setPosition(dest.x, dest.y)
      this.walkingUnits.delete(unitId)
      this.activeWalkSkip = null
      this.pendingAnimations--
      this.maybeAnimationsComplete()
    }

    this.activeWalkSkip = finishImmediately

    const stepNext = (): void => {
      if (cancelled) return
      if (index >= path.length) {
        cancelled = true
        this.walkingUnits.delete(unitId)
        this.activeWalkSkip = null
        this.pendingAnimations--
        this.maybeAnimationsComplete()
        return
      }
      const tile = path[index]!
      index++
      const { x, y } = tileToWorld(tile)
      this.tweens.add({
        targets: view.container,
        x, y,
        duration: STEP_MS,
        ease: 'Linear',
        onComplete: stepNext,
      })
    }
    stepNext()
  }

  private maybeAnimationsComplete(): void {
    if (this.pendingAnimations > 0) return
    const cs = useCombatStore.getState()
    if (cs.state.subPhase === 'RESOLVING') {
      cs.dispatch({ type: 'animationsCompleted' }, createRng(cs.state.rng))
    }
    if (this.enemyTurnRunning) {
      this.time.delayedCall(300, () => this.dispatchNextEnemyEvent())
    }
  }

  private maybeRunEnemyTurn(): void {
    if (this.enemyTurnRunning) return
    const cs = useCombatStore.getState()
    const state = cs.state
    if (state.phase !== 'COMBAT') return
    if (state.subPhase !== 'IDLE') return
    if (state.turn.team !== 'enemy') return
    if (state.turn.unitId === null) return

    this.enemyTurnQueue = planTurn(state, createRng(state.rng), state.turn.unitId)
    this.enemyTurnRunning = true
    this.time.delayedCall(500, () => this.dispatchNextEnemyEvent())
  }

  private dispatchNextEnemyEvent(): void {
    const cs = useCombatStore.getState()
    if (this.enemyTurnQueue.length === 0) {
      this.enemyTurnRunning = false
      // Queue drained: if turn flipped to a NEW enemy, plan its turn now.
      // Without this, the loop gets stuck because the subscription that
      // would have called maybeRunEnemyTurn fired earlier (during dispatch)
      // when enemyTurnRunning was still true.
      this.maybeRunEnemyTurn()
      return
    }
    const next = this.enemyTurnQueue.shift()!
    // Same race-fix as player onTileClick: mark walkingUnits before dispatch
    // so renderUnits' synchronous snapping doesn't beat walkAlongPath.
    if (next.type === 'moveUnit') {
      this.walkingUnits.add(next.payload.unitId as unknown as string)
    }
    cs.dispatch(next, createRng(cs.state.rng))
    if (next.type === 'endTurn') {
      this.enemyTurnRunning = false
      // Same race-fix as above: if the reducer advanced to another enemy,
      // start that turn immediately.
      this.maybeRunEnemyTurn()
      return
    }
    // For animation-producing events (playCard etc.), the next dispatch
    // is scheduled by maybeAnimationsComplete after the tween finishes.
    // For non-animation events (moveUnit), schedule ourselves so the
    // queue keeps draining.
    if (next.type === 'moveUnit') {
      this.time.delayedCall(150, () => this.dispatchNextEnemyEvent())
    }
  }

  shutdown(): void {
    this.runtime.reset()
    if (this.unsubEffects) { this.unsubEffects(); this.unsubEffects = null }
    if (this.unsubState) { this.unsubState(); this.unsubState = null }
    for (const view of this.unitViews.values()) view.container.destroy()
    this.unitViews.clear()
    for (const rect of this.tileRects.values()) rect.destroy()
    this.tileRects.clear()
    if (this.aoePreview) { this.aoePreview.destroy(); this.aoePreview = null }
    if (this.damagePreview) { this.damagePreview.destroy(); this.damagePreview = null }
    if (this.koSkull) { this.koSkull.destroy(); this.koSkull = null }
  }
}
