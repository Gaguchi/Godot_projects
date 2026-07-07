import React, { useEffect, useRef, useState } from 'react'
import { Card, Tooltip } from '../../components'
import type { CardType } from '../../components/Card'
import { useCombatStore } from '../../../state/combatStore'
import { useCombatUiStore } from '../../../state/combatUiStore'
import { createRng } from '../../../systems/rng'
import { tilesInRange } from '../../../systems/targeting'
import { isEnemyUnit } from '../../../systems/team'
import { asCardId, asTileId, asUnitId } from '../../../domain/ids'
import { clientToStage, tileAtStagePoint } from '../../../domain/boardGeometry'
import cardsJson from '../../../data/content/cards.json'

const cardsMap = new Map(cardsJson.map((c) => [c.id, c]))
type CardJson = typeof cardsJson[number]

/** Archetype for the card-type gem (shape = the colour-blind-safe signal). */
function deriveCardType(card: CardJson): CardType {
  const dmg = card.effects.find((e) => e.kind === 'Damage')
  if (dmg) {
    const dt = (dmg.params as { damageType?: string }).damageType
    return dt === 'magic' ? 'arcane' : 'attack'
  }
  if (card.effects.some((e) => e.kind === 'GrantArmor' || e.kind === 'Heal')) return 'ward'
  return 'focus' // draw / gain-ap / utility
}

/** Headline number to print on the card + what kind it is (for colour). */
function deriveMagnitude(card: CardJson): { magnitude: number | null; magnitudeKind: 'damage' | 'armor' | 'heal' | null } {
  for (const e of card.effects) {
    const p = e.params as { base?: number; amount?: number }
    if (e.kind === 'Damage' && typeof (p.base ?? p.amount) === 'number') {
      return { magnitude: (p.base ?? p.amount)!, magnitudeKind: 'damage' }
    }
    if (e.kind === 'Heal' && typeof (p.amount ?? p.base) === 'number') {
      return { magnitude: (p.amount ?? p.base)!, magnitudeKind: 'heal' }
    }
    if (e.kind === 'GrantArmor' && typeof p.amount === 'number') {
      return { magnitude: p.amount, magnitudeKind: 'armor' }
    }
  }
  return { magnitude: null, magnitudeKind: null }
}

const TARGET_LABEL: Record<string, string> = {
  enemy: 'one foe',
  ally: 'an ally',
  self: 'self',
  tile: 'a tile',
  all_enemies: 'all foes',
  all_allies: 'all allies',
}

/** Slay-the-Spire drag: press a card, drag onto the board, release on a
 *  valid target to play instantly. An amber arrow tracks the cursor; release
 *  anywhere invalid cancels. Click-to-select (pin + confirm) still works. */
interface DragState {
  cardId: string
  originX: number   // stage coords of the card (arrow tail)
  originY: number
  x: number         // current cursor, stage coords
  y: number
  active: boolean   // true once movement passes the drag threshold
}

export function CardHand(): React.JSX.Element | null {
  const dispatch = useCombatStore((s) => s.dispatch)
  const activeId = useCombatStore((s) => s.state.turn.unitId)
  const team = useCombatStore((s) => s.state.turn.team)
  const selectedId = useCombatStore((s) => s.state.selectedCardId)
  const subPhase = useCombatStore((s) => s.state.subPhase)
  const unit = useCombatStore((s) =>
    activeId ? s.state.units[activeId as unknown as string] : undefined,
  )
  const deck = useCombatStore((s) =>
    activeId ? s.state.decks[activeId as unknown as string] : undefined,
  )
  const rngState = useCombatStore((s) => s.state.rng)

  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  dragRef.current = drag

  /** Play cardId at tileId (or self-cast with no tile) through the same
   *  dispatch path the click flow uses. */
  const playAt = (cardId: string, tileId: string | null): void => {
    const s = useCombatStore.getState().state
    const card = cardsMap.get(cardId)
    const srcId = s.turn.unitId
    if (!card || !srcId) return
    const payload: {
      apCost: number
      damageStat?: 'str' | 'mag' | 'skl'
      targetKind?: string
      aoeRadius?: number
      effects: Array<{ kind: string; params: Record<string, unknown> }>
    } = { apCost: card.apCost, effects: card.effects, targetKind: card.targetKind }
    if (card.damageStat) payload.damageStat = card.damageStat as 'str' | 'mag' | 'skl'
    const aoe = (card as CardJson & { aoeRadius?: number }).aoeRadius
    if (aoe) payload.aoeRadius = aoe
    useCombatStore.getState().dispatch({
      type: 'playCard',
      payload: {
        cardId: asCardId(cardId),
        srcId: asUnitId(srcId as unknown as string),
        targets: tileId ? [asTileId(tileId)] : [],
        card: payload,
      },
    }, createRng(s.rng))
  }

  /** Is tileId a legal drop for cardId right now? Mirrors the board click
   *  validation: range from the active unit + occupant vs targetKind. */
  const isValidDrop = (cardId: string, tileId: string): boolean => {
    const s = useCombatStore.getState().state
    const card = cardsMap.get(cardId)
    const srcId = s.turn.unitId ? (s.turn.unitId as unknown as string) : null
    const src = srcId ? s.units[srcId] : undefined
    if (!card || !src?.position) return false
    const inRange = tilesInRange(src.position, card.range.min, card.range.max, {
      width: s.grid.width, height: s.grid.height, obstacles: s.grid.obstacles,
    }).some((t) => (t as unknown as string) === tileId)
    if (!inRange) return false
    const occ = Object.values(s.units).find(
      (u) => u.hp.current > 0 && u.position && (u.position as unknown as string) === tileId,
    )
    switch (card.targetKind) {
      case 'enemy': case 'all_enemies': return !!occ && isEnemyUnit(occ)
      case 'ally': case 'all_allies': return !!occ && !isEnemyUnit(occ)
      case 'self': return tileId === (src.position as unknown as string)
      default: return true // tile-target AOEs land anywhere in range
    }
  }

  const beginDrag = (cardId: string, e: React.PointerEvent): void => {
    if (e.button !== 0) return
    const pt = clientToStage(e.clientX, e.clientY)
    if (!pt) return
    setDrag({ cardId, originX: pt.x, originY: pt.y, x: pt.x, y: pt.y, active: false })
  }

  // Window-level move/up so the drag survives leaving the card bounds.
  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent): void => {
      const d = dragRef.current
      if (!d) return
      const pt = clientToStage(e.clientX, e.clientY)
      if (!pt) return
      const dist = Math.hypot(pt.x - d.originX, pt.y - d.originY)
      const activating = !d.active && dist > 14
      if (activating) {
        // entering drag mode: select the card so the board lights valid
        // targets, and clear any pinned detail panel out of the way
        useCombatUiStore.getState().setPinnedDetailUnit(null)
        const s = useCombatStore.getState().state
        if ((s.selectedCardId as unknown as string) !== d.cardId) {
          useCombatStore.getState().dispatch(
            { type: 'selectCard', payload: { cardId: asCardId(d.cardId) } },
            createRng(s.rng),
          )
        }
      }
      setDrag({ ...d, x: pt.x, y: pt.y, active: d.active || activating })
    }
    const onUp = (e: PointerEvent): void => {
      const d = dragRef.current
      setDrag(null)
      if (!d) return
      const s = useCombatStore.getState().state
      if (!d.active) return // plain click: RAC Button onPress handles it
      const pt = clientToStage(e.clientX, e.clientY)
      const card = cardsMap.get(d.cardId)
      const tile = pt ? tileAtStagePoint(pt.x, pt.y, s.grid.width, s.grid.height) : null
      if (card && card.targetKind === 'self') {
        // StS skill convention: release above the hand plays a self card.
        if (pt && pt.y < 560) { playAt(d.cardId, null); return }
        useCombatStore.getState().dispatch({ type: 'cancelSelection' }, createRng(s.rng))
        return
      }
      if (tile && isValidDrop(d.cardId, tile)) {
        playAt(d.cardId, tile)
        return
      }
      useCombatStore.getState().dispatch({ type: 'cancelSelection' }, createRng(s.rng))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null])

  if (!activeId || team !== 'party' || !unit || !deck) return null
  const ap = unit.ap
  const handIds = deck.hand.slice(0, 5).map((id) => id as unknown as string)

  return (
    <>
    {drag?.active && (
      <svg
        aria-hidden
        className="fixed inset-0 pointer-events-none z-[70]"
        width="1280"
        height="720"
        viewBox="0 0 1280 720"
      >
        <path
          d={`M ${drag.originX} ${drag.originY} Q ${(drag.originX + drag.x) / 2} ${Math.min(drag.originY, drag.y) - 90} ${drag.x} ${drag.y}`}
          stroke="#e8a93a"
          strokeWidth={3.5}
          strokeDasharray="10 7"
          strokeLinecap="round"
          fill="none"
          opacity={0.95}
        />
        <circle cx={drag.x} cy={drag.y} r={7} fill="none" stroke="#e8a93a" strokeWidth={3} />
        <circle cx={drag.x} cy={drag.y} r={2.5} fill="#e8a93a" />
      </svg>
    )}
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-end gap-2.5 pointer-events-auto z-10">
      {handIds.map((cardId) => {
        const card = cardsMap.get(cardId)
        if (!card) return null
        const mag = deriveMagnitude(card)
        const isSelected =
          selectedId !== null && (selectedId as unknown as string) === cardId

        const cardEl = (
          <Card
            cardName={card.name}
            apCost={card.apCost}
            availableAp={ap}
            cardType={deriveCardType(card)}
            magnitude={mag.magnitude}
            magnitudeKind={mag.magnitudeKind}
            targetLabel={TARGET_LABEL[card.targetKind] ?? card.targetKind}
            source={deck.sources?.[cardId] ?? null}
            isSelected={isSelected}
            onPress={() => {
              if (subPhase === 'RESOLVING') return
              dispatch(
                { type: 'selectCard', payload: { cardId: asCardId(cardId) } },
                createRng(rngState),
              )
            }}
          />
        )

        if (card.apCost > ap) {
          return (
            <Tooltip
              key={cardId}
              trigger={cardEl}
              content={`Needs ${card.apCost} AP, you have ${ap}`}
            />
          )
        }
        return (
          <div
            key={cardId}
            className="touch-none"
            style={drag?.active && drag.cardId === cardId ? { opacity: 0.35 } : undefined}
            onPointerDownCapture={(e) => beginDrag(cardId, e)}
          >
            {cardEl}
          </div>
        )
      })}
    </div>
    </>
  )
}
