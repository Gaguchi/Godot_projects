import React from 'react'

/**
 * Centralized inline-SVG icon set. Replaces every unicode pictograph / emoji
 * the codebase was using as a visual identity element (story 283).
 *
 * Add new names as needed. Keep paths simple and stroke-based when possible
 * so they read at small sizes and theme cleanly via `currentColor`.
 *
 * Usage:
 *   <Icon name="town" size={28} />
 *   <Icon name="camp" size={24} className="text-amber-300" />
 *
 * Project rule: NO emoji or pictograph unicode chars in player-visible JSX
 * text. Use this component (or a labeled text alternative) instead.
 */
export type IconName =
  | 'town' | 'camp' | 'dungeon' | 'exit'
  | 'combat' | 'elite' | 'boss' | 'rest' | 'shop' | 'event' | 'treasure'
  | 'visited' | 'quest' | 'narrator'
  | 'chevron-right' | 'chevron-down' | 'arrow-right'
  | 'pause' | 'skull' | 'check' | 'cross'

export interface IconProps {
  name: IconName
  size?: number
  className?: string
  'aria-label'?: string
}

const STROKE = 'currentColor'
const FILL_NONE = 'none'

export function Icon({ name, size = 20, className, ...rest }: IconProps): React.JSX.Element {
  const ariaLabel = rest['aria-label']
  const ariaProps = ariaLabel ? { role: 'img', 'aria-label': ariaLabel } : { 'aria-hidden': true }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill={FILL_NONE}
      stroke={STROKE}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...ariaProps}
    >
      {RENDER[name]}
    </svg>
  )
}

const RENDER: Record<IconName, React.JSX.Element> = {
  // Settlement: walled gate + roof
  town: (
    <>
      <path d="M4 20 V11 L12 5 L20 11 V20 Z" />
      <path d="M10 20 V14 H14 V20" />
      <path d="M4 20 H20" />
    </>
  ),

  // Camp: tent triangle with center pole + small flag
  camp: (
    <>
      <path d="M3 20 L12 5 L21 20 Z" />
      <path d="M12 5 V20" />
    </>
  ),

  // Dungeon: cave-mouth arch with pickaxe-like notch
  dungeon: (
    <>
      <path d="M4 20 V13 a8 8 0 0 1 16 0 V20 Z" />
      <path d="M10 20 V16 a2 2 0 0 1 4 0 V20" />
    </>
  ),

  // Exit: signpost + arrow
  exit: (
    <>
      <path d="M12 4 V20" />
      <path d="M12 7 H19 L21 9 L19 11 H12" />
    </>
  ),

  // Combat: crossed swords
  combat: (
    <>
      <path d="M5 5 L19 19" />
      <path d="M19 5 L5 19" />
      <path d="M4 5 L7 5 L7 8" />
      <path d="M20 5 L17 5 L17 8" />
    </>
  ),

  // Elite: skull-like double horns over combat
  elite: (
    <>
      <path d="M6 14 V11 a6 6 0 0 1 12 0 V14" />
      <path d="M9 14 V18" />
      <path d="M15 14 V18" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="15" cy="12" r="1" />
    </>
  ),

  // Boss: crown
  boss: (
    <>
      <path d="M4 18 L6 8 L10 13 L12 6 L14 13 L18 8 L20 18 Z" />
      <path d="M4 18 H20" />
    </>
  ),

  // Rest: campfire (three flame strokes)
  rest: (
    <>
      <path d="M12 4 C9 8 9 11 12 14 C15 11 15 8 12 4 Z" />
      <path d="M6 20 L18 20" />
      <path d="M8 18 L10 14" />
      <path d="M16 18 L14 14" />
    </>
  ),

  // Shop: market awning + coin
  shop: (
    <>
      <path d="M4 9 L20 9 L19 13 H5 Z" />
      <path d="M6 9 V20 H18 V9" />
      <circle cx="12" cy="15" r="2" />
    </>
  ),

  // Event: open scroll
  event: (
    <>
      <path d="M5 5 H17 a2 2 0 0 1 2 2 V17 a2 2 0 0 1 -2 2 H7 a2 2 0 0 1 -2 -2 Z" />
      <path d="M9 9 H15" />
      <path d="M9 13 H15" />
    </>
  ),

  // Treasure: chest with band
  treasure: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="1" />
      <path d="M4 13 H20" />
      <path d="M11 11 H13 V15 H11 Z" />
      <path d="M8 9 a4 3 0 0 1 8 0" />
    </>
  ),

  // Visited: pennant flag
  visited: (
    <>
      <path d="M6 4 V20" />
      <path d="M6 5 L16 5 L13 9 L16 13 L6 13" />
    </>
  ),

  // Quest: exclamation banner (not literal '!')
  quest: (
    <>
      <path d="M12 4 V14" />
      <circle cx="12" cy="18" r="1.4" fill={STROKE} />
    </>
  ),

  // Narrator: stylized sigil — diamond + inner ring (replaces ✦)
  narrator: (
    <>
      <path d="M12 3 L20 12 L12 21 L4 12 Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),

  'chevron-right': (
    <path d="M9 5 L16 12 L9 19" />
  ),

  'chevron-down': (
    <path d="M5 9 L12 16 L19 9" />
  ),

  'arrow-right': (
    <>
      <path d="M5 12 H19" />
      <path d="M14 6 L20 12 L14 18" />
    </>
  ),

  // Pause: two vertical bars (no '⋮')
  pause: (
    <>
      <path d="M9 5 V19" />
      <path d="M15 5 V19" />
    </>
  ),

  // Skull: minimal — for KO indicator
  skull: (
    <>
      <path d="M6 11 a6 6 0 0 1 12 0 V15 H6 Z" />
      <circle cx="9.5" cy="12" r="1.2" fill={STROKE} />
      <circle cx="14.5" cy="12" r="1.2" fill={STROKE} />
      <path d="M10 17 V20" />
      <path d="M14 17 V20" />
      <path d="M12 17 V20" />
    </>
  ),

  check: (
    <path d="M5 12 L10 17 L19 7" />
  ),

  cross: (
    <>
      <path d="M6 6 L18 18" />
      <path d="M18 6 L6 18" />
    </>
  ),
}
