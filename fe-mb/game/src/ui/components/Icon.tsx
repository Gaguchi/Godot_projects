/**
 * ui/components/Icon.tsx — the ONE inline-SVG hand (BRIEF §5: "one inline-SVG set (24 viewBox, stroke 1.8,
 * currentColor); no emoji/pictograph unicode in player-visible JSX"). Every glyph is drawn in the same weight as
 * the cartographer's sigils in `ui/overworld/NodeMark.tsx`, inherits its colour from the text around it, and
 * carries no colour of its own — so a room type or an item kind is read by SHAPE first and tint second, and the
 * browser can never swap one in for a colour-emoji.
 *
 * Add a name here rather than reaching for a character: a pictograph renders differently on every platform, and
 * on Chrome several of them (☠ ♨ 🍞 🔒) come back as full-colour emoji, which is the loudest asset-flip signal a
 * build can wear.
 */
import React from 'react'

export type IconName =
  // item kinds
  | 'food' | 'potion' | 'weapon' | 'shield' | 'quiver' | 'tome' | 'staff'
  // dungeon room types
  | 'combat' | 'elite' | 'event' | 'treasure' | 'rest' | 'boss'
  // marks
  | 'lock' | 'check' | 'cross' | 'shackles' | 'bullet'

/** Paths are drawn inside a 24×24 box, stroked with `currentColor`; `fill` is opt-in per sub-path. */
const PATHS: Readonly<Record<IconName, React.JSX.Element>> = {
  food: (
    <>
      <path d="M3.5 14.5c0-4 3.8-6.5 8.5-6.5s8.5 2.5 8.5 6.5v1.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M8.6 10.4 7.2 15M13 9.9l-1.4 4.6M17 10.6l-1.2 4" />
    </>
  ),
  potion: (
    <>
      <path d="M9.5 3h5M10.8 3v5.4l-4.3 7.4a2.8 2.8 0 0 0 2.4 4.2h6.2a2.8 2.8 0 0 0 2.4-4.2l-4.3-7.4V3" />
      <path d="M7.6 15.4h8.8" />
    </>
  ),
  weapon: (
    <>
      <path d="M12 2.5 14.4 7v7.2H9.6V7z" />
      <path d="M7 14.6h10M12 14.6v4.6M10 19.2h4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.8 19.2 5.6v6.1c0 4.4-3.2 7.4-7.2 9.5-4-2.1-7.2-5.1-7.2-9.5V5.6z" />
      <path d="M12 7.4v8" />
    </>
  ),
  quiver: (
    <>
      <path d="M4.2 19.8 19.4 4.6" />
      <path d="M14.6 4.6h4.8v4.8M4.2 15.2v4.6h4.6" />
    </>
  ),
  tome: (
    <>
      <path d="M3.8 5.2c2.8-1.3 5.4-1.3 8.2 0 2.8-1.3 5.4-1.3 8.2 0v13.2c-2.8-1.3-5.4-1.3-8.2 0-2.8-1.3-5.4-1.3-8.2 0z" />
      <path d="M12 5.2v13.2" />
    </>
  ),
  staff: (
    <>
      <circle cx="15.6" cy="5.6" r="3" />
      <path d="M13.6 7.9 8.2 20.6" />
      <path d="M6.4 18.6h3.6" />
    </>
  ),
  combat: (
    <>
      <path d="M4.4 19.6 15.6 4.8M19.6 19.6 8.4 4.8" />
      <path d="M3 16.6l3.4 3.4M21 16.6l-3.4 3.4" />
    </>
  ),
  elite: (
    <>
      <path d="M12 3a7.2 7.2 0 0 0-7.2 7.2v2.4l1.6 2v2.6h11.2v-2.6l1.6-2v-2.4A7.2 7.2 0 0 0 12 3z" />
      <circle cx="9.3" cy="10.6" r="1.6" />
      <circle cx="14.7" cy="10.6" r="1.6" />
      <path d="M10 17.2v3.4M14 17.2v3.4" />
    </>
  ),
  event: (
    <>
      <path d="M8.8 8.6a3.3 3.3 0 1 1 4.1 3.2c-.7.2-.9.9-.9 1.7v.9" />
      <path d="M12 18.4h.01" />
    </>
  ),
  treasure: (
    <>
      <path d="M12 3 20 10l-8 11L4 10z" />
      <path d="M4 10h16M12 3 8.6 10 12 21M12 3l3.4 7" />
    </>
  ),
  rest: (
    <>
      <path d="M3.6 18.2v-6.4h9.2a5.4 5.4 0 0 1 5.4 5.4v1" />
      <path d="M3.6 18.2h16.8v2.6" />
      <circle cx="7.4" cy="8.6" r="2.4" />
    </>
  ),
  boss: (
    <>
      <path d="M3.8 18 6 6.6l4 4 2-6.2 2 6.2 4-4L20.2 18z" />
      <path d="M3.8 20.6h16.4" />
    </>
  ),
  lock: (
    <>
      <path d="M5.6 11h12.8v9.4H5.6z" />
      <path d="M8.8 11V7.8a3.2 3.2 0 0 1 6.4 0V11" />
    </>
  ),
  check: <path d="M4.8 12.6 9.8 17.6 19.2 6.4" />,
  /** The check's other half. A stat badge that passes and one that falls short must be drawn in the same hand. */
  cross: <path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6" />,
  shackles: (
    <>
      <circle cx="6.8" cy="12" r="3.4" />
      <circle cx="17.2" cy="12" r="3.4" />
      <path d="M10.2 12h3.6" />
    </>
  ),
  bullet: <path d="M12 5.2 18.8 12 12 18.8 5.2 12z" />,
}

export function Icon({ name, size = 16, filled = false, className, title }: {
  readonly name: IconName
  readonly size?: number
  /** Solid rather than drawn — used where the glyph is a bullet or a badge, not a diagram. */
  readonly filled?: boolean
  readonly className?: string
  /** Present ⇒ the icon is content and gets a name; absent ⇒ decorative and hidden from assistive tech. */
  readonly title?: string
}): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title === undefined ? 'presentation' : 'img'}
      aria-hidden={title === undefined ? true : undefined}
      aria-label={title}
      style={{ flex: 'none', verticalAlign: '-0.14em' }}
    >
      {PATHS[name]}
    </svg>
  )
}
