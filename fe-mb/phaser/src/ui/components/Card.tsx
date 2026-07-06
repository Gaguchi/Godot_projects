import React from 'react'
import { Button as RACButton } from 'react-aria-components'

/** Card archetype. The GEM SHAPE is the primary (colour-blind-safe) signal;
 *  hue is a redundant secondary channel. */
export type CardType = 'attack' | 'arcane' | 'ward' | 'focus'

export interface CardProps {
  onPress: () => void
  cardName: string
  apCost: number
  availableAp: number
  cardType: CardType
  /** Headline magnitude (damage / armor / heal). null = no numeric headline. */
  magnitude?: number | null
  magnitudeKind?: 'damage' | 'armor' | 'heal' | null
  /** Short target descriptor, e.g. "one enemy", "self", "an ally". */
  targetLabel: string
  /** Deck provenance (gear-as-deck): hand_left/hand_right show a subtle L/R
   *  chip so players can trace a card back to the item that grants it. */
  source?: 'innate' | 'hand_left' | 'hand_right' | null
  isSelected?: boolean
  className?: string
}

const GEM_COLOR: Record<CardType, string> = {
  attack: 'var(--color-gem-attack)',
  arcane: 'var(--color-gem-arcane)',
  ward: 'var(--color-gem-ward)',
  focus: 'var(--color-gem-focus)',
}

/** Distinct silhouette per type — readable without colour. */
function Gem({ type, size = 14 }: { type: CardType; size?: number }): React.JSX.Element {
  const shape =
    type === 'attack' ? (
      <path d="M12 2 L15 9 L12 22 L9 9 Z" /> // blade
    ) : type === 'arcane' ? (
      <path d="M12 2 L21 12 L12 22 L3 12 Z" /> // diamond
    ) : type === 'ward' ? (
      <path d="M12 2 L20 5 V12 c0 5 -3 8 -8 10 c-5 -2 -8 -5 -8 -10 V5 Z" /> // shield
    ) : (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      </> // eye / focus
    )
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
      aria-hidden
      style={{ color: GEM_COLOR[type] }}
    >
      {shape}
    </svg>
  )
}

const MAG_COLOR: Record<NonNullable<CardProps['magnitudeKind']>, string> = {
  damage: 'var(--color-damage-text)', // AA-safe red for the headline numeral
  armor: 'var(--color-gem-ward)',
  heal: 'var(--hp-ok)',
}
const MAG_WORD: Record<NonNullable<CardProps['magnitudeKind']>, string> = {
  damage: 'damage',
  armor: 'armor',
  heal: 'heal',
}

/**
 * Combat card — a forged iron artifact (the game's core mechanic, no longer a
 * blank spreadsheet cell). Anatomy: iron frame + corner rivets, a type-gem
 * header banner (gem SHAPE = type, colour-blind-safe), a candle-lit art well
 * with a procedural sigil, a headline numeral, a target tag, and a wax-seal AP
 * coin. Hover lifts UP/forward (never sinks); selected lights an emissive edge;
 * unaffordable desaturates with a "spent" hatch — never just dims to grey.
 *
 * Click is a RAC Button (hover/press/focus state machine + keyboard). Motion is
 * transform/opacity-only and honours prefers-reduced-motion via motion-safe:.
 */
export function Card({
  onPress,
  cardName,
  apCost,
  availableAp,
  cardType,
  magnitude,
  magnitudeKind,
  targetLabel,
  source,
  isSelected,
  className,
}: CardProps): React.JSX.Element {
  const affordable = apCost <= availableAp
  const reason = affordable ? undefined : `needs ${apCost} AP, you have ${availableAp}`
  const gemColor = GEM_COLOR[cardType]

  return (
    <div className="relative" data-testid={`card-${cardName.toLowerCase().replace(/\s+/g, '-')}`}>
      <RACButton
        onPress={onPress}
        isDisabled={!affordable}
        aria-label={`${cardName}, ${apCost} action points, targets ${targetLabel}`}
        data-selected={isSelected || undefined}
        data-disabled-reason={reason}
        className={
          'forged-card relative block h-36 w-24 rounded-md p-[3px] outline-none ' +
          // bevel owns box-shadow, so focus uses outline (canonical hearth ring)
          'data-[focus-visible]:[outline:2px_solid_var(--color-hearth)] data-[focus-visible]:[outline-offset:2px] ' +
          (affordable ? 'cursor-pointer ' : 'cursor-not-allowed ') +
          (isSelected
            ? '-translate-y-3 '
            : affordable
              ? 'motion-safe:data-[hovered]:-translate-y-6 motion-safe:data-[hovered]:scale-[1.05] ' +
                'motion-safe:data-[pressed]:-translate-y-4 motion-safe:data-[pressed]:scale-[1.02] '
              : '') +
          (className ?? '')
        }
      >
        {/* corner rivets */}
        {['left-1 top-1', 'right-1 top-1', 'left-1 bottom-1', 'right-1 bottom-1'].map((pos) => (
          <span
            key={pos}
            aria-hidden
            className={`absolute ${pos} h-1 w-1 rounded-full`}
            style={{ background: 'var(--iron-edge)', boxShadow: 'inset 0 1px 1px #000' }}
          />
        ))}

        {/* candle-lit inner well */}
        <div
          className="relative flex h-full flex-col overflow-hidden rounded-[4px]"
          style={{ background: 'radial-gradient(120% 82% at 50% 0%, #36291c 0%, #120d09 78%)' }}
        >
          {/* header banner: gem + name (fixed 2-line height so gems/baselines
              align across the hand even when a name wraps) */}
          <div
            className="flex min-h-[2.2em] items-start gap-1 px-1.5 pb-1 pt-1.5"
            style={{ background: `linear-gradient(to bottom, color-mix(in oklab, ${gemColor} 34%, transparent), transparent)` }}
          >
            <span className="mt-px shrink-0"><Gem type={cardType} size={13} /></span>
            <span className="voice-display text-[0.62rem] leading-[1.05] text-amber-50">{cardName}</span>
          </div>

          {/* art well: faint procedural sigil with the headline magnitude over it */}
          <div className="relative grid flex-1 place-items-center">
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: `radial-gradient(circle at 50% 45%, color-mix(in oklab, ${gemColor} 28%, transparent) 0%, transparent 68%)` }}
            />
            <span
              aria-hidden
              className={`absolute ${magnitude != null ? 'opacity-[0.16]' : isSelected ? 'opacity-70' : 'opacity-40'} transition-opacity`}
            >
              <Gem type={cardType} size={46} />
            </span>
            {magnitude != null && (
              <span
                className="numeral relative text-[2.6rem] leading-none"
                style={{ color: magnitudeKind ? MAG_COLOR[magnitudeKind] : 'var(--color-parchment)', textShadow: '0 1px 4px #000' }}
              >
                {magnitude}
              </span>
            )}
          </div>

          {/* footer: effect kind (left) + target tag (right) */}
          <div className="flex items-end justify-between px-1.5 pb-1.5 text-[0.5rem] uppercase tracking-wide text-[color:var(--color-text-muted)]">
            <span>{magnitudeKind ? MAG_WORD[magnitudeKind] : ''}</span>
            <span>{targetLabel}</span>
          </div>
        </div>

        {/* AP coin — amber, the single AP currency (matches the HUD AP pips) */}
        <span
          className="numeral absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full text-[0.8rem] text-stone-950"
          style={{
            background: 'radial-gradient(circle at 35% 28%, #f6cd76, var(--color-hearth) 72%)',
            boxShadow: '0 2px 5px #000, inset 0 1px 1px rgba(255,224,160,0.9)',
            border: '1px solid color-mix(in oklab, var(--color-hearth) 70%, #000)',
          }}
        >
          {apCost}
        </span>

        {/* gear-source chip: L/R = which hand's item grants this card */}
        {(source === 'hand_left' || source === 'hand_right') && (
          <span
            aria-label={source === 'hand_left' ? 'from left-hand gear' : 'from right-hand gear'}
            className="absolute -left-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-sm text-[0.55rem] font-bold text-amber-100"
            style={{
              background: 'linear-gradient(to bottom, #4a4038, #221c16)',
              border: '1px solid rgba(201,152,92,0.4)',
              boxShadow: '0 1px 3px #000',
            }}
          >
            {source === 'hand_left' ? 'L' : 'R'}
          </span>
        )}

        {/* unaffordable: "spent" hatch — reads as "can't afford yet", not "broken" */}
        {!affordable && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-md"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(0,0,0,0.42) 0 4px, transparent 4px 9px)',
            }}
          />
        )}
      </RACButton>
    </div>
  )
}
