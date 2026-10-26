/**
 * ui/combat/CardHand.tsx — five tooled-leather tabs (`.forged-card`), numbers largest. Gem SHAPE carries the card's
 * type (attack diamond / ward shield / arcane circle / focus square); the hue is secondary. A card the unit cannot
 * afford stays visible, dimmed, with the reason. Selection = `aria-pressed` (a hard brass edge, never a bloom).
 *
 * THE NUMBER ON THE FACE IS WHAT THE CARD DOES, not what it was authored with. A face that reads `4` on a mage with
 * MAG 7 is a lie the player picks from: the same play lands for 10 once the forecast finally opens, which is after
 * the choice the number was supposed to inform. The face therefore carries the card's POWER — base + the damage
 * stat + empower + the quiver baked onto this instance — computed by `attackPower`, the very function the forecast
 * and the reducer both run. The only thing the face cannot know is the target's own defense, and that is the one
 * term the forecast adds when a foe is finally pinned.
 *
 * The hand also keeps its FRAME on the enemy's turn. Unmounting it dropped 165px out of the stage and made the
 * layout jump every phase; the rail states who is acting instead.
 */
import React from 'react'
import { cardFace } from '../../engine/combat/words'
import { displayName } from '../../engine/run/party'
import type { Card, CombatState, CombatUnit, QuiverModifier, RunState } from '../../engine/types'
import { useTip } from '../components/Tooltip'

/**
 * The card's WORDS — the face, the shape of a blast, the status word — live in `engine/combat/words.ts`, because
 * the headless game prints a hand too (CONTRACT §10) and `scripts/**` may not import `ui/**` (FINAL GATE A 1.3,
 * the 0094 shape). They are re-exported here so the screens keep asking the card for its own vocabulary.
 */
export { cardFace, cardIntentLines, cardPower, STATUS_WORD } from '../../engine/combat/words'

export type CardType = 'attack' | 'ward' | 'arcane' | 'focus'

export function cardType(card: Card): CardType {
  if (card.effects.some((e) => e.kind === 'Damage')) return 'attack'
  if (card.effects.some((e) => e.kind === 'Heal' || e.kind === 'GrantArmor')) return 'ward'
  if (card.effects.some((e) => e.kind === 'DrawCards' || e.kind === 'GainAp')) return 'focus'
  return 'arcane'
}

/**
 * The card's foot, lettered. `.card__foot` is the display face with `text-transform: uppercase`, which re-cuts a
 * digit as an inscription — "DRAW · +1 AP" and "BURN 2 TURNS" print their numbers as small capitals, and a number
 * baked into a derived string cannot wear `.numeral` on its own (FINAL GATE B B.3, ARCHITECTURE §5.1). So the
 * numbers are lifted out here, at the surface, with the unit that belongs to them INSIDE the same span — the
 * sentence stays one authored string for every other reader of `cardFace`.
 */
const FOOT_NUMBER = '[+−-]?[0-9]+(?: (?:ap|hp|turns?))?'
const FOOT_SPLIT = new RegExp(`(${FOOT_NUMBER})`, 'gi')
const IS_FOOT_NUMBER = new RegExp(`^${FOOT_NUMBER}$`, 'i')
export function footParts(foot: string): readonly React.ReactNode[] {
  return foot.split(FOOT_SPLIT).filter((p) => p !== '').map((part, i) => (
    IS_FOOT_NUMBER.test(part)
      ? <b key={i} className="numeral">{part}</b>
      : <React.Fragment key={i}>{part}</React.Fragment>
  ))
}

function Gem({ type }: { readonly type: CardType }): React.JSX.Element {
  const color = `var(--color-gem-${type})`
  switch (type) {
    case 'attack': return <svg className="card__gem" viewBox="0 0 12 12"><path d="M6 0 12 6 6 12 0 6Z" fill={color} /></svg>
    case 'ward': return <svg className="card__gem" viewBox="0 0 12 12"><path d="M6 0 11 2v4c0 3-2.5 5-5 6-2.5-1-5-3-5-6V2Z" fill={color} /></svg>
    case 'arcane': return <svg className="card__gem" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5.5" fill={color} /></svg>
    case 'focus': return <svg className="card__gem" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" fill={color} /></svg>
  }
}

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
    return <HandRail name={active === undefined ? null : run === null ? active.name : displayName(active, run)} />
  }
  return (
    <div className="hand" data-testid="hand">
      {deck.hand.map((uid) => {
        const inst = deck.cards[uid]
        const card = inst === undefined ? undefined : cards[inst.cardId]
        if (card === undefined) return null
        return (
          <HandCard
            key={uid}
            card={card}
            cardId={inst!.cardId}
            source={active}
            mod={inst!.mod}
            pressed={selectedUid === uid}
            short={card.apCost > active.ap}
            onSelect={() => onSelect(uid)}
            {...(onCardPointerDown !== undefined ? { onGrab: (e: React.PointerEvent) => onCardPointerDown(uid, e) } : {})}
          />
        )
      })}
    </div>
  )
}

/**
 * The hand's place while somebody else is acting. The band the hand and the commands sit in is 165px of the stage;
 * unmounting it made the whole surface jump on every phase change and left the player watching an empty brown
 * shelf. The rail holds the frame and states, in words, the one thing the enemy phase is about.
 */
function HandRail({ name }: { readonly name: string | null }): React.JSX.Element {
  return (
    <div className="hand hand--waiting" data-testid="hand" data-waiting="true">
      {[0, 1, 2, 3, 4].map((i) => <span key={i} className="card-well" aria-hidden />)}
      <span className="hand__waiting" aria-live="polite">{name === null ? 'The field is still' : `${name} is acting`}</span>
    </div>
  )
}

/**
 * One tab in the hand. A card the unit cannot afford stays readable and says why ON THE GLASS — and it is
 * `aria-disabled`, not natively `disabled`, so the reason is reachable by Tab rather than being a dead rectangle
 * the keyboard cannot land on. The press is swallowed here, so an unaffordable card still selects nothing.
 */
function HandCard({ card, cardId, source, mod, pressed, short, onSelect, onGrab }: {
  readonly card: Card
  readonly cardId: string
  readonly source: CombatUnit
  readonly mod: QuiverModifier | null
  readonly pressed: boolean
  readonly short: boolean
  readonly onSelect: () => void
  readonly onGrab?: (e: React.PointerEvent) => void
}): React.JSX.Element {
  const type = cardType(card)
  const face = cardFace(card, source, mod)
  const { tipRef, tipProps, tip } = useTip(short ? `needs ${card.apCost} AP` : null)
  return (
    <>
      <button
        ref={tipRef}
        type="button"
        className="forged-card card"
        data-testid={`card-${cardId}`}
        aria-pressed={pressed}
        aria-disabled={short || undefined}
        onClick={() => { if (!short) onSelect() }}
        onPointerDown={(e) => { if (!short) onGrab?.(e) }}
        style={{ touchAction: 'none', cursor: short ? 'default' : 'pointer' }}
        {...tipProps}
      >
        <span className="card__cost">{card.apCost}</span>
        <Gem type={type} />
        <span className="card__name">{card.name}</span>
        <span className={`card__number card__number--${type}`}>{face.number}</span>
        <span className="card__foot">{footParts(face.foot)}</span>
      </button>
      {tip}
    </>
  )
}
