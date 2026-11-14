/**
 * ui/combat/CardHand.tsx — the hand (board Hyb64Combat): up to five card faces along the foot of the stage, the same
 * faces the deck's page in The Company shows (`ui/filigree/cards.tsx`), each a button. A card the unit cannot afford
 * stays on the glass, dimmed, and says what it needs. The picked card rises out of the row and takes the lit frame
 * (`aria-pressed`); a hard brass edge, never a bloom.
 *
 * The hand also keeps its FRAME on the enemy's turn. Unmounting it dropped the bottom of the stage out and made the
 * layout jump every phase; five empty wells hold the row and a plate says who is acting instead.
 *
 * A hand of more than five (a draw mid-turn) closes its cards up so the row never runs under the commands.
 */
import React from 'react'
import type { Card, CombatState, RunState } from '../../engine/types'
import { useTip } from '../components/Tooltip'
import { CARD_TALL, CardInner, lineOf, type CardLine } from '../filigree/cards'
import { useKitState } from '../filigree/kit'
import { fieldNames } from './names'

/**
 * The card's WORDS — the face, the shape of a blast, the status word — live in `engine/combat/words.ts`, because
 * the headless game prints a hand too (CONTRACT §10) and `scripts/**` may not import `ui/**` (FINAL GATE A 1.3,
 * the 0094 shape). They are re-exported here so the screens keep asking the card for its own vocabulary.
 */
export { cardFace, cardIntentLines, cardPower, STATUS_WORD } from '../../engine/combat/words'
export { cardType, type CardType } from '../filigree/cards'

/** The hand's row on the stage: five faces 136 wide, 6 apart, between the acting window and the commands. */
export const HAND = { x: 322, y: 514, w: 704, cardW: 136, rise: 20 } as const

interface Props {
  readonly combat: CombatState
  readonly run: RunState | null
  readonly cards: Readonly<Record<string, Card>>
  readonly selectedUid: string | null
  readonly onSelect: (uid: string) => void
  /** Start of a StS drag-to-target gesture (brief §2.8); the screen owns the drag, the hand only reports the grab. */
  readonly onCardPointerDown?: (uid: string, e: React.PointerEvent) => void
}

export function CardHand({ combat, run, cards, selectedUid, onSelect, onCardPointerDown }: Props): React.JSX.Element {
  const active = combat.units[combat.turn.unitId]
  const deck = combat.decks[combat.turn.unitId]
  if (active === undefined || deck === undefined || active.team !== 'party') {
    return <HandRail name={active === undefined ? null : fieldNames(combat, run)[active.id]?.name ?? active.name} />
  }
  const held = deck.hand.flatMap((uid) => {
    const inst = deck.cards[uid]
    const card = inst === undefined ? undefined : cards[inst.cardId]
    return inst === undefined || card === undefined ? [] : [{ uid, cardId: inst.cardId, card, line: lineOf(card, uid, active, inst.mod) }]
  })
  const step = held.length <= 1 ? 0 : Math.min(HAND.cardW + 6, Math.floor((HAND.w - HAND.cardW) / (held.length - 1)))
  return (
    <div className="hand" data-testid="hand" style={{ left: HAND.x, top: HAND.y, width: HAND.w, height: HAND.rise + CARD_TALL + 2 }}>
      {held.map((h, i) => (
        <HandCard
          key={h.uid}
          line={h.line}
          cardId={h.cardId}
          x={i * step}
          pressed={selectedUid === h.uid}
          short={h.card.apCost > active.ap}
          need={h.card.apCost}
          onSelect={() => onSelect(h.uid)}
          {...(onCardPointerDown !== undefined ? { onGrab: (e: React.PointerEvent) => onCardPointerDown(h.uid, e) } : {})}
        />
      ))}
    </div>
  )
}

/** The hand's place while somebody else is acting: the row's five wells, and who has the turn. */
function HandRail({ name }: { readonly name: string | null }): React.JSX.Element {
  return (
    <div className="hand hand--waiting" data-testid="hand" data-waiting="true" style={{ left: HAND.x, top: HAND.y, width: HAND.w, height: HAND.rise + CARD_TALL + 2 }}>
      {[0, 1, 2, 3, 4].map((i) => <span key={i} className="card-well" style={{ left: i * (HAND.cardW + 6), top: HAND.rise, width: HAND.cardW, height: CARD_TALL + 2 }} aria-hidden />)}
      <span className="hand__waiting" aria-live="polite"><span className="plate">{name === null ? 'The field is still' : `${name} is acting`}</span></span>
    </div>
  )
}

/**
 * One face in the hand. A card the unit cannot afford stays readable and says why ON THE GLASS — and it is
 * `aria-disabled`, not natively `disabled`, so the reason is reachable by Tab rather than being a dead rectangle
 * the keyboard cannot land on. The press is swallowed here, so an unaffordable card still selects nothing.
 */
function HandCard({ line, cardId, x, pressed, short, need, onSelect, onGrab }: {
  readonly line: CardLine
  readonly cardId: string
  readonly x: number
  readonly pressed: boolean
  readonly short: boolean
  readonly need: number
  readonly onSelect: () => void
  readonly onGrab?: (e: React.PointerEvent) => void
}): React.JSX.Element {
  const k = useKitState(short)
  const { tipRef, tipProps, tip } = useTip(short ? `needs ${need} AP` : null)
  const lit = pressed || (!short && k.hovered)
  return (
    <>
      <button
        ref={tipRef}
        type="button"
        className={`fw${lit ? ' fw--lit' : ''} card${pressed ? ' card--held' : ''}${short ? ' card--short' : ''}${k.cls.includes('foc') ? ' foc-ring' : ''}`}
        data-testid={`card-${cardId}`}
        aria-pressed={pressed}
        aria-disabled={short || undefined}
        aria-label={`${line.name}, ${line.ap} AP: ${line.words}`}
        onClick={() => { if (!short) onSelect() }}
        style={{ left: x, top: pressed ? 0 : HAND.rise, width: HAND.cardW, height: CARD_TALL + 2, touchAction: 'none', cursor: short ? 'default' : 'pointer' }}
        {...k.handlers}
        {...tipProps}
        onPointerEnter={() => { k.handlers.onPointerEnter(); tipProps.onPointerEnter() }}
        onPointerLeave={() => { k.handlers.onPointerLeave(); tipProps.onPointerLeave() }}
        onPointerDown={(e) => { k.handlers.onPointerDown(); if (!short) onGrab?.(e) }}
        onFocus={(e) => { k.handlers.onFocus(e); tipProps.onFocus() }}
        onBlur={() => { k.handlers.onBlur(); tipProps.onBlur() }}
      >
        <CardInner c={line} w={HAND.cardW} tall />
      </button>
      {tip}
    </>
  )
}
