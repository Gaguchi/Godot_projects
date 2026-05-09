import Phaser from 'phaser'
import { useCombatStore } from '../../state/combatStore'
import { useRunStore } from '../../state/runStore'
import { CombatRuntime } from '../runtime/CombatRuntime'
import { createRng } from '../../systems/rng'
import { seedStubBattle } from './seedStubBattle'
import type { CombatEffect } from '../../domain/combatState'

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

function tileToWorld(tileId: string): { x: number; y: number } {
  const [xs, ys] = tileId.split(',')
  const x = parseInt(xs!, 10)
  const y = parseInt(ys!, 10)
  return {
    x: GRID_OFFSET_X + x * TILE + TILE / 2,
    y: GRID_OFFSET_Y + y * TILE + TILE / 2,
  }
}

export class CombatScene extends Phaser.Scene {
  private runtime!: CombatRuntime
  private unsubEffects: (() => void) | null = null
  private unsubState: (() => void) | null = null
  private unitViews = new Map<string, UnitView>()

  constructor() { super('combat') }

  create(): void {
    this.runtime = new CombatRuntime()

    // F-02: seed stub battle if combatStore hasn't started one yet.
    const cs = useCombatStore.getState()
    if (cs.state.phase === 'BOOT') {
      const runRng = useRunStore.getState().rngState
      const event = seedStubBattle(runRng)
      cs.dispatch(event, createRng(runRng))
    }

    this.add.text(20, 20, 'CombatScene — units seeded', {
      fontFamily: 'monospace', fontSize: '14px', color: '#a0a0c0',
    })

    this.drawGrid()
    this.renderUnits()

    // Re-render on any state update
    this.unsubState = useCombatStore.subscribe(() => this.renderUnits())

    // Drain effects on lastEffectId change
    this.unsubEffects = useCombatStore.subscribe(
      (s) => s.lastEffectId,
      () => {
        const drained = useCombatStore.getState().drainEffects()
        for (const e of drained) this.handleEffect(e)
      }
    )
  }

  private drawGrid(): void {
    // Tile fills (plain terrain colour)
    const fills = this.add.graphics()
    fills.fillStyle(0x0c1018, 1)
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        fills.fillRect(GRID_OFFSET_X + x * TILE, GRID_OFFSET_Y + y * TILE, TILE - 1, TILE - 1)
      }
    }
    // Grid lines
    const g = this.add.graphics()
    g.lineStyle(1, 0x333344, 0.6)
    for (let x = 0; x <= GRID_W; x++) {
      g.lineBetween(GRID_OFFSET_X + x * TILE, GRID_OFFSET_Y, GRID_OFFSET_X + x * TILE, GRID_OFFSET_Y + GRID_H * TILE)
    }
    for (let y = 0; y <= GRID_H; y++) {
      g.lineBetween(GRID_OFFSET_X, GRID_OFFSET_Y + y * TILE, GRID_OFFSET_X + GRID_W * TILE, GRID_OFFSET_Y + y * TILE)
    }
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
        view = { container, body, hpBar, glow: null }
        this.unitViews.set(idStr, view)
      }

      if (unit.position) {
        const { x, y } = tileToWorld(unit.position as unknown as string)
        view.container.setPosition(x, y)
      }

      // Update HP bar width
      const hpFraction = unit.hp.current / Math.max(1, unit.hp.max)
      view.hpBar.width = Math.max(0, 32 * hpFraction)
      view.hpBar.fillColor = hpFraction > 0.5 ? 0x44cc44 : hpFraction > 0.2 ? 0xddaa44 : 0xcc4444

      // Hide if dead
      view.container.setVisible(unit.hp.current > 0)

      // Active-turn glow
      if (view.glow) {
        view.glow.destroy()
        view.glow = null
      }
      if (activeId === idStr) {
        const glow = this.add.circle(0, 0, 22, 0xfacc15, 0.25).setStrokeStyle(2, 0xfacc15, 0.9)
        view.container.add(glow)
        view.container.sendToBack(glow)
        view.glow = glow
      }
    }

    // Clean up units removed from state
    for (const [id, view] of this.unitViews.entries()) {
      if (!seenIds.has(id)) {
        view.container.destroy()
        this.unitViews.delete(id)
      }
    }
  }

  private handleEffect(e: CombatEffect): void {
    // Foundation: log only. Real animation handling lands in F-06.
    // eslint-disable-next-line no-console
    console.debug('[CombatScene] effect:', e.kind)
  }

  shutdown(): void {
    this.runtime.reset()
    if (this.unsubEffects) { this.unsubEffects(); this.unsubEffects = null }
    if (this.unsubState) { this.unsubState(); this.unsubState = null }
    for (const view of this.unitViews.values()) view.container.destroy()
    this.unitViews.clear()
  }
}
