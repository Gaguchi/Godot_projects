import React from 'react'
import { getCharacter, type PortraitShape } from '../data/characters'
import { spriteIdForUnit, spritePathFor } from '../../data/unitSprites'
import { Icon } from './Icon'

export interface CharacterPortraitProps {
  /** Speaker name (matches dialogue node.speaker). Empty → narrator. */
  speaker: string | undefined
  /** Active speakers pulse subtly. Inactive (recently spoke) dim. */
  active?: boolean
  /** Pixel size (default 96). */
  size?: number
  /** Combat team, when known. Enemy units whose speaker isn't in the
   *  character registry get the enemy accent family (never the hash palette,
   *  which can hand an ally-ish teal to a brigand). */
  team?: 'party' | 'enemy'
  /** Unit id + class, when the caller has a combat Unit — resolves board art
   *  via unitSprites (id first, class fallback) for units the dialogue
   *  registry doesn't know. */
  unitId?: string | null
  classId?: string
  className?: string
}

// Combat units resolve art through the same id-keyed module the board uses
// (data/unitSprites.ts — pure data, so the React↔Phaser fence allows it).
// Display names are never matched.

/**
 * Character portrait. Renders the authored sprite (head/torso crop of the
 * full-body ComfyUI unit sprite) when the registry has one — falling back to
 * the board-sprite name mapping for combat units the registry doesn't know —
 * and only then to a colored shape with the speaker's initials. Subtle
 * breath/idle animation when active.
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
  team,
  unitId,
  classId,
  className,
}: CharacterPortraitProps): React.JSX.Element {
  const c = getCharacter(speaker)
  const isNarrator = c.faction === 'narrator'
  const [spriteFailed, setSpriteFailed] = React.useState(false)
  const unitSpriteId = (unitId != null || classId != null)
    ? spriteIdForUnit(unitId, classId ?? '')
    : null
  const spriteSrc = c.sprite ?? (unitSpriteId ? spritePathFor(unitSpriteId) : null)
  const showSprite = !!spriteSrc && !spriteFailed && !isNarrator

  // Registry miss on an enemy: force the enemy accent family so red = foe
  // survives even for unmapped classes (the identity hash must never dress a
  // brigand in an ally-ish hue).
  const enemyAccent = team === 'enemy' && c.faction !== 'enemy'

  const shapeClass = SHAPE_CLASSES[c.shape] ?? SHAPE_CLASSES.circle

  const animClass = active
    ? 'motion-safe:animate-[portraitBreath_2.5s_ease-in-out_infinite]'
    : 'opacity-70 saturate-50'

  const fontSize = Math.round(size * 0.34)

  // Identity (or enemy-team) accent, derived at the consumer via color-mix:
  // fill = accent sunk into ink; ring/border = accent at edge strength.
  const accent = enemyAccent ? 'var(--color-enemy)' : c.accent
  const accentStyle = {
    background: `color-mix(in oklab, ${accent} 26%, var(--color-ink))`,
    borderColor: `color-mix(in oklab, ${accent} 70%, transparent)`,
    '--tw-ring-color': `color-mix(in oklab, ${accent} 55%, transparent)`,
  } as React.CSSProperties

  return (
    <>
      <div
        role="img"
        aria-label={isNarrator ? 'Narrator' : c.displayName}
        className={
          'flex items-center justify-center select-none overflow-hidden ' +
          'border-2 ring-2 ring-offset-2 ring-offset-ink shadow-lg ' +
          'transition-[transform,filter] duration-200 ' +
          shapeClass + ' ' + animClass + ' ' +
          (className ?? '')
        }
        style={{ width: size, height: size, ...accentStyle }}
      >
        {showSprite ? (
          // Full-body sprite, cropped to head/torso: the frame shows the top
          // ~45% of the image, anchored center-top.
          <img
            src={spriteSrc as string}
            alt=""
            draggable={false}
            className="w-full h-full object-cover"
            style={{ objectPosition: '50% 12%', transform: `scale(1.9)`, transformOrigin: '50% 8%' }}
            onError={() => setSpriteFailed(true)}
          />
        ) : isNarrator ? (
          <span className="flex" style={{ color: 'var(--color-text-muted)' }}>
            <Icon name="narrator" size={Math.round(size * 0.5)} />
          </span>
        ) : (
          <span
            className="font-bold tracking-tight"
            style={{
              fontSize,
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.02em',
              color: 'var(--color-parchment)',
            }}
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
