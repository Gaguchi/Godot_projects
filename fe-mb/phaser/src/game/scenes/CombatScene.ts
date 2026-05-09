import Phaser from 'phaser'
import { useCombatStore } from '../../state/combatStore'
import { useRunStore } from '../../state/runStore'
import { CombatRuntime } from '../runtime/CombatRuntime'
import { createRng } from '../../systems/rng'
import { seedStubBattle } from './seedStubBattle'
import type { CombatEffect } from '../../domain/combatState'
import cardsJson from '../../data/content/cards.json'
import { asCardId } from '../../domain/ids'

const TILE = 48
const GRID_OFFSET_X = 240
const GRID_OFFSET_Y = 120
const GRID_W = 14
const GRID_H = 10
const CARD_W = 96
const CARD_H = 132
const CARD_SPACING = 110
const CARD_HAND_Y = 620   // baseline y for cards (canvas height - margin)

interface UnitView {
  container: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Arc
  hpBar: Phaser.GameObjects.Rectangle
  glow: Phaser.GameObjects.Arc | null
}

interface CardView {
  cardId: string
  container: Phaser.GameObjects.Container
  bg: Phaser.GameObjects.Rectangle
  border: Phaser.GameObjects.Rectangle
  baseY: number
  baseX: number
  hovered: boolean
}

type CardData = typeof cardsJson[number]
const cardsMap = new Map<string, CardData>(cardsJson.map((c) => [c.id, c]))

function getCardDamageBase(card: CardData): number | null {
  for (const e of card.effects) {
    if (e.kind === 'Damage' || e.kind === 'Heal') {
      const base = (e.params as { base?: number; amount?: number }).base
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

export class CombatScene extends Phaser.Scene {
  private runtime!: CombatRuntime
  private unsubEffects: (() => void) | null = null
  private unsubState: (() => void) | null = null
  private unitViews = new Map<string, UnitView>()
  private cardViews: CardView[] = []

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
    this.renderCardHand()

    // Re-render on any state update
    this.unsubState = useCombatStore.subscribe(() => {
      this.renderUnits()
      this.renderCardHand()
    })

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

  private renderCardHand(): void {
    const cs = useCombatStore.getState()
    const state = cs.state
    const activeId = state.turn.unitId === null ? null : (state.turn.unitId as unknown as string)

    // Clear existing cards
    for (const view of this.cardViews) view.container.destroy()
    this.cardViews = []

    if (!activeId || state.turn.team !== 'party') return
    const deck = state.decks[activeId]
    if (!deck) return

    const activeUnit = state.units[activeId]
    const ap = activeUnit?.ap ?? 0

    const handIds = deck.hand.slice(0, 5)
    const totalWidth = (handIds.length - 1) * CARD_SPACING
    const startX = (this.scale.width - totalWidth) / 2

    handIds.forEach((cardIdBranded, idx) => {
      const cardIdStr = cardIdBranded as unknown as string
      const card = cardsMap.get(cardIdStr)
      if (!card) return

      const x = startX + idx * CARD_SPACING
      const y = CARD_HAND_Y
      const affordable = card.apCost <= ap

      const container = this.add.container(x, y)
      const border = this.add.rectangle(0, 0, CARD_W + 4, CARD_H + 4, 0x000000, 0)
        .setStrokeStyle(2, 0x4a3a20)
      const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x1a1410)
        .setStrokeStyle(1, 0x2a2010)
      const nameText = this.add.text(0, -CARD_H / 2 + 14, card.name, {
        fontFamily: 'monospace', fontSize: '11px', color: '#e0d0a0',
        wordWrap: { width: CARD_W - 12 }, align: 'center',
      }).setOrigin(0.5, 0)
      const dmgBase = getCardDamageBase(card)
      const dmgText = this.add.text(0, -8, dmgBase !== null ? String(dmgBase) : '—', {
        fontFamily: 'monospace', fontSize: '20px',
        color: dmgBase !== null ? '#ffaa44' : '#666',
      }).setOrigin(0.5)
      const apText = this.add.text(-CARD_W / 2 + 6, CARD_H / 2 - 16, `${card.apCost} AP`, {
        fontFamily: 'monospace', fontSize: '10px', color: '#a0d0ff',
      }).setOrigin(0, 0)
      const targetKindText = this.add.text(CARD_W / 2 - 6, CARD_H / 2 - 16, card.targetKind.replace('_', ' '), {
        fontFamily: 'monospace', fontSize: '8px', color: '#888',
      }).setOrigin(1, 0)

      container.add([bg, border, nameText, dmgText, apText, targetKindText])

      const isSelected = state.selectedCardId !== null
        && (state.selectedCardId as unknown as string) === cardIdStr

      // Visual states
      if (!affordable) {
        container.setAlpha(0.45)
      } else if (isSelected) {
        border.setStrokeStyle(2, 0xfacc15)
        bg.setFillStyle(0x2a2418)
      }

      // Interactivity
      const hitArea = new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H)
      container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains)

      const view: CardView = {
        cardId: cardIdStr,
        container,
        bg,
        border,
        baseY: y,
        baseX: x,
        hovered: false,
      }

      container.on('pointerover', () => {
        if (!affordable) return
        view.hovered = true
        container.setY(view.baseY - 24)
        // dim siblings
        for (const v of this.cardViews) {
          if (v !== view && !v.hovered) v.container.setAlpha(v === view ? 1 : 0.5)
        }
      })
      container.on('pointerout', () => {
        view.hovered = false
        container.setY(view.baseY)
        // restore siblings
        for (const v of this.cardViews) v.container.setAlpha(v.cardId === cardIdStr || true ? 1 : 1)
        if (!affordable) container.setAlpha(0.45)
      })
      container.on('pointerdown', () => {
        if (!affordable) return
        cs.dispatch({ type: 'selectCard', payload: { cardId: asCardId(cardIdStr) } }, createRng(state.rng))
      })

      this.cardViews.push(view)
    })

    // Re-apply alpha for non-affordable cards (after the listeners are attached, the hover-out
    // restoration above sets affordable cards to 1; the unaffordable ones got 0.45 above)
    for (const v of this.cardViews) {
      const card = cardsMap.get(v.cardId)
      if (card && card.apCost > ap) v.container.setAlpha(0.45)
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
    for (const view of this.cardViews) view.container.destroy()
    this.cardViews = []
  }
}
