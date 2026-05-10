import Phaser from 'phaser'
import { useCombatStore } from '../../state/combatStore'
import { useRunStore } from '../../state/runStore'
import { CombatRuntime } from '../runtime/CombatRuntime'
import { createRng } from '../../systems/rng'
import { seedStubBattle } from './seedStubBattle'
import { tilesInRange, tilesInAoe, tilesReachable } from '../../systems/targeting'
import { planTurn } from '../../systems/enemyAI'
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

function getCardDamageBase(card: CardData): number | null {
  for (const e of card.effects) {
    if (e.kind === 'Damage' || e.kind === 'Heal') {
      const base =
        (e.params as { base?: number; amount?: number }).base
        ?? (e.params as { amount?: number }).amount
      if (typeof base === 'number') return base
    }
  }
  return null
}

function tileToWorld(tileId: string): { x: number; y: number } {
  const [xs, ys] = tileId.split(',')
  const x = parseInt(xs!, 10)
  const y = parseInt(ys!, 10)
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
  private pendingAnimations = 0
  private enemyTurnQueue: CombatEvent[] = []
  private enemyTurnRunning = false

  constructor() { super('combat') }

  create(): void {
    this.runtime = new CombatRuntime()

    const cs = useCombatStore.getState()
    if (cs.state.phase === 'BOOT') {
      const runRng = useRunStore.getState().rngState
      const event = seedStubBattle(runRng)
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

    this.input.mouse?.disableContextMenu()
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        const cs2 = useCombatStore.getState()
        if (cs2.state.subPhase !== 'IDLE') {
          cs2.dispatch({ type: 'cancelSelection' }, createRng(cs2.state.rng))
        }
      }
    })

    this.unsubState = useCombatStore.subscribe(() => {
      this.renderUnits()
      this.renderTargeting()
      this.maybeRunEnemyTurn()
    })

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

  private onTileHover(tileId: string): void {
    const state = useCombatStore.getState().state
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
    const dmgBase = getCardDamageBase(card)
    if (dmgBase !== null) {
      const targetUnit = Object.values(state.units).find(
        (u) => u.position && (u.position as unknown as string) === tileId,
      )
      if (targetUnit && (targetUnit.classId as unknown as string).includes('bandit')) {
        let dmg = dmgBase
        const stat = card.damageStat
        if (stat === 'str') dmg += activeUnit.stats.str
        else if (stat === 'mag') dmg += activeUnit.stats.mag
        else if (stat === 'skl') dmg += activeUnit.stats.skl
        dmg = Math.max(0, dmg - Math.floor(targetUnit.stats.def / 2))
        const { x, y } = tileToWorld(tileId)
        this.damagePreview = this.add.text(x, y - 30, `-${dmg}`, {
          fontFamily: 'monospace', fontSize: '20px', color: '#ff6644',
        }).setOrigin(0.5)
      }
    }
  }

  private onTileOut(): void {
    if (this.aoePreview) { this.aoePreview.destroy(); this.aoePreview = null }
    if (this.damagePreview) { this.damagePreview.destroy(); this.damagePreview = null }
  }

  private onUnitClick(unitIdStr: string): void {
    const cs = useCombatStore.getState()
    const state = cs.state
    if (state.phase !== 'COMBAT') return
    if (state.turn.team !== 'party') return
    if (state.subPhase === 'RESOLVING') return
    const activeId = state.turn.unitId === null ? null : (state.turn.unitId as unknown as string)
    if (activeId !== unitIdStr) return
    const unit = state.units[unitIdStr]
    if (!unit || unit.hp.current <= 0) return
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

      if (unit.position) {
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
      const dest = tileToWorld(targetTile)
      const orig = { x: view.container.x, y: view.container.y }
      this.pendingAnimations++
      this.tweens.add({
        targets: view.container,
        x: dest.x, y: dest.y,
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
  }
}
