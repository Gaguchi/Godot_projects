import Phaser from 'phaser'
import { shallow } from 'zustand/shallow'
import { useCombatStore } from '../../state/combatStore'
import { useCombatUiStore } from '../../state/combatUiStore'
import { useRunStore } from '../../state/runStore'
import { CombatRuntime } from '../runtime/CombatRuntime'
import { createRng } from '../../systems/rng'
import { seedStubBattle } from './seedStubBattle'
import { tilesInRange, tilesInAoe, tilesReachable, findMovePath } from '../../systems/targeting'
import { planTurn } from '../../systems/enemyAI'
import { computeForecast, type ForecastCard } from '../../systems/damage'
import type { CombatEffect, CombatEvent } from '../../domain/combatState'
import cardsJson from '../../data/content/cards.json'
import classesJson from '../../data/content/classes.json'
import { asTileId, asUnitId } from '../../domain/ids'

const classMovMap = new Map<string, number>(
  classesJson.map((c) => [c.id, c.startingMov]),
)
function movementRangeForClass(classId: string): number {
  return classMovMap.get(classId) ?? 4
}

const TILE = 48
const GRID_OFFSET_X = 240
const GRID_OFFSET_Y = 120
const GRID_W = 14
const GRID_H = 10

interface UnitView {
  container: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Arc
  hpBar: Phaser.GameObjects.Rectangle
  glow: Phaser.GameObjects.Arc | null
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
  private tileRects = new Map<string, Phaser.GameObjects.Rectangle>()
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
  /** Tab toggle: render union of all enemy threat zones. */
  private globalDangerZone = false
  /**
   * Units currently mid-walk-animation. renderUnits() must NOT snap their
   * container.setPosition to the logical tile while we're tweening through
   * the path, or the visual teleports to the destination instantly.
   */
  private walkingUnits = new Set<string>()

  constructor() { super('combat') }

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
        phase: s.state.phase,
      }),
      () => {
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

  private drawGrid(): void {
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const rect = this.add.rectangle(
          GRID_OFFSET_X + x * TILE + TILE / 2,
          GRID_OFFSET_Y + y * TILE + TILE / 2,
          TILE - 2, TILE - 2,
          0x0c1018,
        ).setStrokeStyle(1, 0x333344, 0.6)
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

  private renderTargeting(): void {
    const state = useCombatStore.getState().state

    for (const rect of this.tileRects.values()) {
      rect.setFillStyle(0x0c1018)
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
        if (rect) rect.setFillStyle(0x1f4a5a)
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
    for (const t of valid) {
      const rect = this.tileRects.get(t as unknown as string)
      if (rect) rect.setFillStyle(0x4a3a20)
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
    const moveColor = isEnemy ? 0x4a2a4a : 0x1f4a5a
    for (const t of reachable) {
      const rect = this.tileRects.get(t as unknown as string)
      if (rect) rect.setFillStyle(moveColor)
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
    const attackColor = isEnemy ? 0x6a1a1a : 0x6a3a1a
    for (const t of attackTiles) {
      const rect = this.tileRects.get(t)
      if (rect) rect.setFillStyle(attackColor)
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
        // Soft purple — only overrides default-empty tiles, lets selection
        // overlays win when both fire.
        rect.setFillStyle(0x3a1a3a)
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
    if (!new Set(valid.map((t) => t as unknown as string)).has(tileId)) return

    if (this.aoePreview) { this.aoePreview.destroy(); this.aoePreview = null }
    const radius = card.aoeRadius ?? 0
    if (radius > 0) {
      const tiles = tilesInAoe(asTileId(tileId), radius, targetState)
      const g = this.add.graphics()
      g.fillStyle(0x9966cc, 0.25)
      g.lineStyle(1, 0x9966cc, 0.8)
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
        const color = forecast.heal > 0 ? '#88ee88' : '#ff6644'
        this.damagePreview = this.add.text(x, y - 30, label, {
          fontFamily: 'monospace', fontSize: '20px', color,
        }).setOrigin(0.5)
        if (forecast.lethal) {
          // Lethal-hit indicator. Was an emoji skull; now a typographic
          // "KO" badge for the no-pictograph directive (story 283).
          this.koSkull = this.add.text(x, y - 6, 'KO', {
            fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold',
            color: '#ffe9b0', backgroundColor: '#7c1d1d', padding: { left: 5, right: 5, top: 1, bottom: 1 },
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
    this.clearHoverUnit()
  }

  private onUnitClick(unitIdStr: string): void {
    const cs = useCombatStore.getState()
    const state = cs.state
    if (state.phase !== 'COMBAT') return
    const unit = state.units[unitIdStr]
    if (!unit || unit.hp.current <= 0) return

    // Always pin the detail panel on click (works for any unit).
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

  private onTileClick(tileId: string): void {
    const cs = useCombatStore.getState()
    const state = cs.state

    if (state.subPhase === 'SELECTING_MOVE') {
      const activeId = state.turn.unitId === null ? null : (state.turn.unitId as unknown as string)
      if (!activeId) return
      const activeUnit = state.units[activeId]
      if (!activeUnit?.position || activeUnit.hasMovedThisTurn) return
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
      if (!new Set(valid.map((t) => t as unknown as string)).has(tileId)) return
      // Compute the path from source to destination so the visual tween can
      // walk it tile-by-tile. The reducer still teleports the position.
      const path = findMovePath(
        asTileId(sourceTileId),
        asTileId(tileId),
        range,
        { width: state.grid.width, height: state.grid.height, obstacles: state.grid.obstacles },
        blocked,
      )
      if (path && path.length > 0) {
        this.pendingMovePath = { unitId: activeId, path: path.map((t) => t as unknown as string) }
        // Mark BEFORE dispatch so the synchronous renderUnits subscription
        // sees walkingUnits.has(activeId) and skips snapping the container
        // to the new logical position. handleEffect's walkAlongPath then
        // animates from origin → destination. Without this, renderUnits
        // teleports first, walkAlongPath has nothing to animate.
        this.walkingUnits.add(activeId)
      }
      cs.dispatch({
        type: 'moveUnit',
        payload: { unitId: asUnitId(activeId), tileId: asTileId(tileId) },
      }, createRng(state.rng))
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
    if (!new Set(valid.map((t) => t as unknown as string)).has(tileId)) return

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
      effects: Array<{ kind: string; params: Record<string, unknown> }>
    } = { apCost: card.apCost, effects: card.effects }
    if (card.damageStat) cardPayload.damageStat = card.damageStat as 'str' | 'mag' | 'skl'

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
        const isEnemy = (unit.classId as unknown as string).startsWith('bandit')
          || (unit.classId as unknown as string).startsWith('mage_bandit')
        const color = isEnemy ? 0xcc4444 : 0x6688cc
        const container = this.add.container(0, 0)
        const body = this.add.circle(0, 0, 16, color).setStrokeStyle(2, 0x000000)
        const nameText = this.add.text(0, -28, unit.name, {
          fontFamily: 'monospace', fontSize: '10px', color: '#e0d0a0',
        }).setOrigin(0.5)
        const hpBarBg = this.add.rectangle(0, 22, 34, 5, 0x222222)
        const hpBar = this.add.rectangle(-16, 22, 32, 3, 0x44cc44).setOrigin(0, 0.5)
        container.add([body, nameText, hpBarBg, hpBar])
        body.setInteractive({ useHandCursor: true })
        body.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if (pointer.rightButtonDown()) return
          this.onUnitClick(idStr)
        })
        view = { container, body, hpBar, glow: null }
        this.unitViews.set(idStr, view)
      }

      if (unit.position && !this.walkingUnits.has(idStr)) {
        const { x, y } = tileToWorld(unit.position as unknown as string)
        view.container.setPosition(x, y)
      }

      const hpFraction = unit.hp.current / Math.max(1, unit.hp.max)
      view.hpBar.width = Math.max(0, 32 * hpFraction)
      view.hpBar.fillColor = hpFraction > 0.5 ? 0x44cc44 : hpFraction > 0.2 ? 0xddaa44 : 0xcc4444

      view.container.setVisible(unit.hp.current > 0)

      if (view.glow) { view.glow.destroy(); view.glow = null }
      if (activeId === idStr) {
        const glow = this.add.circle(0, 0, 22, 0xfacc15, 0.25).setStrokeStyle(2, 0xfacc15, 0.9)
        view.container.add(glow)
        view.container.sendToBack(glow)
        view.glow = glow
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
      const origColor = view.body.fillColor
      view.body.setFillStyle(0xffffff)
      this.pendingAnimations++
      this.time.delayedCall(e.durationMs, () => {
        view.body.setFillStyle(origColor)
        this.pendingAnimations--
        this.maybeAnimationsComplete()
      })
    } else if (e.kind === 'FloatDamage') {
      const tileStr = e.tile as unknown as string
      const { x, y } = tileToWorld(tileStr)
      const color = e.damageKind === 'heal' ? '#44dd66'
        : e.damageKind === 'magic' ? '#88aaff'
          : '#ff6644'
      const sign = e.damageKind === 'heal' ? '+' : '-'
      const txt = this.add.text(x, y - 10, `${sign}${e.amount}`, {
        fontFamily: 'monospace', fontSize: '20px', color, stroke: '#000', strokeThickness: 3,
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
