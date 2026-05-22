import React from 'react'
import { getCharacter, type PortraitShape } from '../data/characters'
import { Icon } from './Icon'

export interface CharacterPortraitProps {
  /** Speaker name (matches dialogue node.speaker). Empty → narrator. */
  speaker: string | undefined
  /** Active speakers pulse subtly. Inactive (recently spoke) dim. */
  active?: boolean
  /** Pixel size (default 96). */
  size?: number
  className?: string
}

/**
 * Placeholder character portrait. Renders a colored shape with the speaker's
 * initials, plus a subtle breath/idle animation when active.
 *
 * Shape varies by character archetype (square = warrior, diamond = mystic,
 * hex = leader/named NPC, circle = generic, triangle = mystic alt). Color is
 * the character's accent (per ui/data/characters.ts).
 *
 * For the narrator (empty speaker), returns a neutral stone-tone disc
 * meant to read as "no character — narration."
 */
export function CharacterPortrait({
  speaker,
  active,
  size = 96,
  className,
}: CharacterPortraitProps): React.JSX.Element {
  const c = getCharacter(speaker)
  const isNarrator = c.faction === 'narrator'

  const shapeClass = SHAPE_CLASSES[c.shape] ?? SHAPE_CLASSES.circle

  const animClass = active
    ? 'motion-safe:animate-[portraitBreath_2.5s_ease-in-out_infinite]'
    : 'opacity-70 saturate-50'

  const fontSize = Math.round(size * 0.34)

  return (
    <>
      <div
        role="img"
        aria-label={isNarrator ? 'Narrator' : c.displayName}
        className={
          'flex items-center justify-center select-none ' +
          'border-2 ring-2 ring-offset-2 ring-offset-stone-950 shadow-lg ' +
          'transition-[transform,filter] duration-200 ' +
          c.bgColor + ' ' + c.ringColor + ' ' +
          shapeClass + ' ' + animClass + ' ' +
          (className ?? '')
        }
        style={{ width: size, height: size }}
      >
        {isNarrator ? (
          <span className={`${c.textColor} flex`}>
            <Icon name="narrator" size={Math.round(size * 0.5)} />
          </span>
        ) : (
          <span
            className={`font-bold tracking-tight ${c.textColor}`}
            style={{ fontSize, fontFamily: 'serif', letterSpacing: '-0.05em' }}
          >
            {c.initials || '?'}
          </span>
        )}
      </div>
      {/* Breath keyframes injected once; React dedupes via styled-components-like usage */}
      <style>{`
        @keyframes portraitBreath {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.03); filter: brightness(1.08); }
        }
      `}</style>
    </>
  )
}

const SHAPE_CLASSES: Record<PortraitShape, string> = {
  circle: 'rounded-full',
  square: 'rounded-md',
  hex: '[clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]',
  // Diamond uses clip-path so the shape is angled but the initials stay upright.
  diamond: '[clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]',
  triangle: '[clip-path:polygon(50%_0%,0%_100%,100%_100%)]',
}
