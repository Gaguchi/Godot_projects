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
  /** Combat team, when known. Enemy units whose speaker isn't in the
   *  character registry get the enemy accent family (never the hash palette,
   *  which can hand an ally-ish teal to a brigand). */
  team?: 'party' | 'enemy'
  className?: string
}

const spritePath = (id: string): string => `/sprites/units/${id}.png`

/**
 * Mirror of BoardScene's `unitSpriteKey()` name→sprite mapping (the layer
 * fence forbids importing BoardScene from React). Lets combat units whose
 * name has no registry entry (e.g. "Brigand") still render their board
 * sprite as a head-crop instead of an initials placeholder.
 * KEEP IN SYNC with BoardScene.ts `unitSpriteKey`.
 */
function unitSpritePathForName(name: string): string | null {
  const n = name.toLowerCase()
  if (n.includes('alpha wolf')) return spritePath('alpha_wolf')
  if (n.includes('shield knight')) return spritePath('shield_knight')
  if (n.includes('raider mage')) return spritePath('raider_mage')
  if (n.includes('raider cleric')) return spritePath('raider_cleric')
  if (n.includes('ember mage')) return spritePath('ember_mage')
  if (n.includes('thief')) return spritePath('thief')
  for (const e of ['roy', 'marcus', 'lilina', 'garrik', 'lyra', 'kael', 'daren', 'wolf'] as const) {
    if (n.includes(e)) return spritePath(e)
  }
  if (n.includes('archer')) return spritePath('bandit_archer')
  if (n.includes('warlord')) return spritePath('warlord')
  if (n.includes('brigand') || n.includes('chief')) return spritePath('brigand_chief')
  if (n.includes('bandit')) return spritePath('bandit')
  return null
}

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
  className,
}: CharacterPortraitProps): React.JSX.Element {
  const c = getCharacter(speaker)
  const isNarrator = c.faction === 'narrator'
  const [spriteFailed, setSpriteFailed] = React.useState(false)
  const spriteSrc = c.sprite ?? (speaker ? unitSpritePathForName(speaker) : null)
  const showSprite = !!spriteSrc && !spriteFailed && !isNarrator

  // Registry miss on an enemy: force the enemy accent family so red = foe
  // survives even for unmapped classes (hash palette must never dress a
  // brigand in ally teal).
  const enemyAccent = team === 'enemy' && c.faction !== 'enemy'

  const shapeClass = SHAPE_CLASSES[c.shape] ?? SHAPE_CLASSES.circle

  const animClass = active
    ? 'motion-safe:animate-[portraitBreath_2.5s_ease-in-out_infinite]'
    : 'opacity-70 saturate-50'

  const fontSize = Math.round(size * 0.34)

  const accentClasses = enemyAccent ? '' : `${c.bgColor} ${c.ringColor} `
  const enemyStyle: React.CSSProperties = enemyAccent
    ? ({
        background: 'color-mix(in oklab, var(--color-enemy) 26%, var(--color-ink))',
        borderColor: 'color-mix(in oklab, var(--color-enemy) 70%, transparent)',
        '--tw-ring-color': 'color-mix(in oklab, var(--color-enemy) 55%, transparent)',
      } as React.CSSProperties)
    : {}

  return (
    <>
      <div
        role="img"
        aria-label={isNarrator ? 'Narrator' : c.displayName}
        className={
          'flex items-center justify-center select-none overflow-hidden ' +
          'border-2 ring-2 ring-offset-2 ring-offset-ink shadow-lg ' +
          'transition-[transform,filter] duration-200 ' +
          accentClasses +
          shapeClass + ' ' + animClass + ' ' +
          (className ?? '')
        }
        style={{ width: size, height: size, ...enemyStyle }}
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
          <span className={`${c.textColor} flex`}>
            <Icon name="narrator" size={Math.round(size * 0.5)} />
          </span>
        ) : (
          <span
            className={`font-bold tracking-tight ${enemyAccent ? '' : c.textColor}`}
            style={{
              fontSize,
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.02em',
              ...(enemyAccent ? { color: 'var(--color-parchment)' } : {}),
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
