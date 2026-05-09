import React from 'react'
import { Card, Tooltip } from '../../components'
import { useCombatStore } from '../../../state/combatStore'
import { createRng } from '../../../systems/rng'
import { asCardId } from '../../../domain/ids'
import cardsJson from '../../../data/content/cards.json'

const cardsMap = new Map(cardsJson.map((c) => [c.id, c]))

function getCardDamageBase(card: typeof cardsJson[number]): number | null {
  for (const e of card.effects) {
    if (e.kind === 'Damage' || e.kind === 'Heal') {
      const params = e.params as { base?: number; amount?: number }
      const base = params.base ?? params.amount
      if (typeof base === 'number') return base
    }
  }
  return null
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

  if (!activeId || team !== 'party' || !unit || !deck) return null
  const ap = unit.ap
  const handIds = deck.hand.slice(0, 5).map((id) => id as unknown as string)

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 items-end pointer-events-auto z-10">
      {/* No motion.div needed at the row level; lift animation lives on each Card. */}
      {handIds.map((cardId) => {
        const card = cardsMap.get(cardId)
        if (!card) return null
        const dmg = getCardDamageBase(card)
        const isSelected =
          selectedId !== null && (selectedId as unknown as string) === cardId

        const cardEl = (
          <Card
            cardName={card.name}
            apCost={card.apCost}
            availableAp={ap}
            isSelected={isSelected}
            onPress={() => {
              if (subPhase === 'RESOLVING') return
              dispatch(
                { type: 'selectCard', payload: { cardId: asCardId(cardId) } },
                createRng(rngState),
              )
            }}
          >
            <div className="flex flex-col h-full justify-between text-center">
              <div className="text-xs leading-tight font-bold">{card.name}</div>
              {dmg !== null && (
                <div className="text-2xl text-amber-400">{dmg}</div>
              )}
              <div className="flex justify-between text-[10px]">
                <span className="text-amber-300">{card.apCost} AP</span>
                <span className="text-stone-500">
                  {card.targetKind.replace('_', ' ')}
                </span>
              </div>
            </div>
          </Card>
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
        return <React.Fragment key={cardId}>{cardEl}</React.Fragment>
      })}
    </div>
  )
}
