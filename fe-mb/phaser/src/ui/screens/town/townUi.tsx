import React from 'react'
import type { ItemKind } from '../../../domain/item'

/**
 * Town-local UI vocabulary: item-kind glyphs, empty-state silhouettes, and the
 * shared section-label / empty-state patterns used by the Inn/Shop/Tavern
 * panels. Glyphs follow the project Icon.tsx grammar (24 viewBox, 1.8 stroke,
 * currentColor) — they live here because Icon.tsx is shared chrome owned
 * elsewhere and these shapes are town-specific.
 */

interface GlyphProps {
  size?: number | undefined
  className?: string | undefined
}

function Svg({ size = 18, className, children }: GlyphProps & { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  )
}

const KIND_PATHS: Record<ItemKind, React.JSX.Element> = {
  // Sword: blade, crossguard, grip, pommel
  weapon: (
    <>
      <path d="M19 5 L10 14" />
      <path d="M7.5 11.5 L12.5 16.5" />
      <path d="M9.5 14.5 L6 18" />
      <circle cx="5" cy="19" r="1" />
    </>
  ),
  shield: <path d="M12 3 L19 6 V11 c0 5 -3 8 -7 10 c-4 -2 -7 -5 -7 -10 V6 Z" />,
  // Quiver with two arrows
  quiver: (
    <>
      <path d="M8 20 V9 H16 V20 Z" />
      <path d="M10 9 V4 L9 5.5" />
      <path d="M14 9 V5 L15 6.5" />
    </>
  ),
  // Open tome
  tome: (
    <>
      <path d="M5 5 H15 a3 3 0 0 1 3 3 V19 H8 a3 3 0 0 1 -3 -3 Z" />
      <path d="M8 9 H14" />
      <path d="M8 12.5 H14" />
    </>
  ),
  // Staff with orb
  staff: (
    <>
      <path d="M12 21 V8" />
      <circle cx="12" cy="5.5" r="2.4" />
      <path d="M9 21 H15" />
    </>
  ),
  // Round-bottom flask
  potion: (
    <>
      <path d="M10 3 H14" />
      <path d="M11 3 V8 L7 15 a5 5 0 0 0 4.3 6 h1.4 A5 5 0 0 0 17 15 L13 8 V3" />
      <path d="M8.5 15.5 H15.5" />
    </>
  ),
  // Bread loaf
  food: (
    <>
      <path d="M4 15 a8 6 0 0 1 16 0 V18 H4 Z" />
      <path d="M9 10.5 L8 13" />
      <path d="M13 10 L12 12.5" />
      <path d="M16.5 11.5 L15.5 14" />
    </>
  ),
}

/** Item-kind glyph — sits inside a shaped socket on shop/bag rows. */
export function ItemKindGlyph({ kind, size, className }: GlyphProps & { kind: ItemKind }): React.JSX.Element {
  return <Svg size={size} className={className}>{KIND_PATHS[kind]}</Svg>
}

/** Small stack-of-cards glyph for "this gear grants N cards" chips. */
export function CardsGlyph({ size = 14, className }: GlyphProps): React.JSX.Element {
  return (
    <Svg size={size} className={className}>
      <rect x="8.5" y="3.5" width="10" height="14" rx="1.2" transform="rotate(8 13.5 10.5)" />
      <rect x="4.5" y="6" width="10" height="14" rx="1.2" />
    </Svg>
  )
}

/** Open satchel silhouette — empty-bag state. */
export function SatchelGlyph({ size = 44, className }: GlyphProps): React.JSX.Element {
  return (
    <Svg size={size} className={className}>
      <path d="M5 10 H19 L18 20 H6 Z" />
      <path d="M8 10 V7.5 a4 4 0 0 1 8 0 V10" />
      <path d="M11 13.5 H13" />
    </Svg>
  )
}

/** Nailed-up parchment silhouette — empty bounty board. */
export function BoardGlyph({ size = 44, className }: GlyphProps): React.JSX.Element {
  return (
    <Svg size={size} className={className}>
      <path d="M6 5 H18 V16 L15 19 H6 Z" />
      <circle cx="12" cy="5" r="1.1" />
      <path d="M9 9.5 H15" />
      <path d="M9 13 H13" />
    </Svg>
  )
}

/** Tankard silhouette — no recruits in the taproom. */
export function TankardGlyph({ size = 44, className }: GlyphProps): React.JSX.Element {
  return (
    <Svg size={size} className={className}>
      <path d="M7 6 H15 V20 H7 Z" />
      <path d="M15 9 H17 a2 2 0 0 1 2 2 V13 a2 2 0 0 1 -2 2 H15" />
      <path d="M7 8.5 H15" />
    </Svg>
  )
}

/** Small-caps engraved section label (Stock, Rumors, Quest Board…). */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }): React.JSX.Element {
  return (
    <h3 className={`text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-parchment-dim ${className ?? 'mt-8'}`}>
      {children}
    </h3>
  )
}

/**
 * Designed empty state: dimmed silhouette + in-voice copy (never italics),
 * with an optional pointer to the action that fills it.
 */
export function EmptyState({ glyph, line, hint }: { glyph: React.ReactNode; line: string; hint?: string }): React.JSX.Element {
  return (
    <div className="mt-3 flex items-center gap-4 py-3">
      <span aria-hidden className="shrink-0 text-parchment-dim opacity-25">{glyph}</span>
      <div>
        <div className="font-body text-[color:var(--color-text-muted)]">{line}</div>
        {hint ? (
          <div className="mt-1 text-sm text-[color:var(--color-text-muted)] opacity-75">{hint}</div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Shaped icon socket: diamond = gear you wield, circle = consumable.
 * Recessed-well inset per the material recipes; container shape is semantic.
 */
export function KindSocket({ kind }: { kind: ItemKind }): React.JSX.Element {
  const gear = kind !== 'food' && kind !== 'potion'
  return (
    <span
      aria-hidden
      className={`mx-1 flex h-8 w-8 shrink-0 items-center justify-center text-parchment-dim ${
        gear ? 'rotate-45 rounded-[var(--radius-sm)]' : 'rounded-full'
      }`}
      style={{
        background: 'rgba(0, 0, 0, 0.35)',
        boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.6), inset 0 -1px 0 rgba(232, 200, 140, 0.08)',
      }}
    >
      <span className={gear ? '-rotate-45' : ''}>
        <ItemKindGlyph kind={kind} size={17} />
      </span>
    </span>
  )
}
