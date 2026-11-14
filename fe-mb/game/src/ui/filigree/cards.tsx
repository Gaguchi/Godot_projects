/**
 * ui/filigree/cards.tsx — a card as a face, for every screen that shows one: the hand in a fight and the deck's page
 * in The Company. One reading, one drawing, so a card looks and counts the same wherever it is met.
 *
 * THE NUMBER ON THE FACE IS WHAT THE CARD DOES in the hands that hold it: base + the damage stat + empower + the
 * quiver baked onto the instance (`engine/combat/words.ts#cardFace`, which runs `attackPower`, the function the
 * forecast and the reducer both run). The only thing a face cannot know is the target's own defence, and that is
 * the one term the forecast adds when a foe is pinned.
 *
 * A face reads top to bottom: what it costs, its name, its KIND as an icon (a blade for a blow, a shield for a ward
 * or a mend, a seal for a hex, a card for a draw: shape first, hue second) beside the one number it is about, what
 * that number is a number of, and who it lands on.
 */
import React from 'react'
import { cardFace, cardIntentLines } from '../../engine/combat/words'
import type { Card, CombatUnit, QuiverModifier } from '../../engine/types'
import { KIcon } from './items'
import { Numeral } from './kit'

export type CardType = 'attack' | 'ward' | 'arcane' | 'focus'

export function cardType(card: Card): CardType {
  if (card.effects.some((e) => e.kind === 'Damage')) return 'attack'
  if (card.effects.some((e) => e.kind === 'Heal' || e.kind === 'GrantArmor')) return 'ward'
  if (card.effects.some((e) => e.kind === 'DrawCards' || e.kind === 'GainAp')) return 'focus'
  return 'arcane'
}

export const TYPE_ICON: Readonly<Record<CardType, string>> = { attack: 'attack', ward: 'ward', arcane: 'arcane', focus: 'focus' }

export interface CardLine {
  readonly key: string
  readonly ap: number
  readonly name: string
  /** The one number the card is about, what it is a number OF, and who it lands on. */
  readonly num: string
  readonly what: string
  readonly rest: string
  readonly type: CardType
  /** Everything the card does, in words: the face's own tooltip. */
  readonly words: string
  /** The next thing it does after what the face is about, or null. */
  readonly more: string | null
}

export function lineOf(card: Card, key: string, who: CombatUnit | null, mod: QuiverModifier | null): CardLine {
  const f = cardFace(card, who, mod)
  const [what = '', ...rest] = f.foot.split(' · ')
  const lines = cardIntentLines(card, who, mod)
  // the face is about ONE effect (a blow first, else the first thing the card does); `more` is the next thing it does
  const blow = card.effects.findIndex((e) => e.kind === 'Damage')
  const faceAt = blow >= 0 ? blow : 0
  return { key, ap: card.apCost, name: card.name, num: f.number, what, rest: rest.join(' · '), type: cardType(card), words: lines.join('; '), more: lines.find((_, i) => i !== faceAt) ?? null }
}

export const CARD_TALL = 170
export const CARD_SHORT = 112

/** The inside of a face, laid out for a frame `w` wide. `tall` has room for who it lands on and the next effect. */
export function CardInner({ c, w, tall }: { readonly c: CardLine; readonly w: number; readonly tall: boolean }): React.JSX.Element {
  const cast = /^[0-9+\-/]+$/.test(c.num)
  const inner = w - 24
  return (
    <>
      <span className="abs s13 dim nowrap" style={{ right: 14, top: 11 }}>{c.ap} AP</span>
      <span className="abs s15 bone nowrap fcard__clip" style={{ left: 12, top: 30, width: inner }}>{c.name}</span>
      <KIcon name={TYPE_ICON[c.type]} style={{ position: 'absolute', left: 14, top: 58 }} />
      <span className="abs nowrap card__number" style={{ left: 50, top: 55 }} data-n={c.num}>{cast ? <Numeral text={c.num} label={`${c.num} ${c.what}`} /> : <span className="s20 ochre">{c.num}</span>}</span>
      {tall ? (
        <>
          <span className="abs s13 dim nowrap" style={{ left: 50, top: 82 }}>{c.what}</span>
          <span className="abs fgroove" style={{ left: 12, top: 104, width: inner }} />
          {/* who it lands on; a card with no target (a draw) says the next thing it does there instead */}
          <span className={`abs s13 nowrap fcard__clip ${c.rest === '' ? 'dim' : 'bone'}`} style={{ left: 12, top: 111, width: inner }}>{c.rest === '' ? c.more ?? '' : c.rest}</span>
          {c.rest !== '' && c.more !== null && <span className="abs s13 dim nowrap fcard__clip" style={{ left: 12, top: 130, width: inner }}>{c.more}</span>}
        </>
      ) : (
        <span className="abs s13 dim nowrap fcard__clip" style={{ left: 12, top: 82, width: inner }}>{c.what}{c.rest !== '' && <span className="bone"> · {c.rest}</span>}</span>
      )}
    </>
  )
}
