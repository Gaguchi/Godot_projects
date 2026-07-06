import React from 'react'
import { Card, Tooltip } from '../../components'
import type { CardType } from '../../components/Card'
import { useCombatStore } from '../../../state/combatStore'
import { createRng } from '../../../systems/rng'
import { asCardId } from '../../../domain/ids'
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
        return <React.Fragment key={cardId}>{cardEl}</React.Fragment>
      })}
    </div>
  )
}
