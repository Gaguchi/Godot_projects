import React from 'react'
import type { ItemKind } from '../../../domain/item'
import { Heading } from '../../components'

/**
 * Town-local UI vocabulary for the LEDGER PAGE spread: item-kind glyphs,
 * empty-state silhouettes, and the ruled page furniture (headings, section
 * labels, accounts-column headers) the Inn/Shop/Tavern entries are written on.
 *
 * "Field Ledger" fiction: the town is a page in the company quartermaster's
 * ledger, read in daylight. Everything here is INK ON LINEN — flat rules, no
 * wells, no bevels, no glow. The only material that ever appears on these
 * pages is the leather of a <Button>, because leather = act and canvas = read.
 *
 * Glyphs follow the project Icon.tsx grammar (24 viewBox, 1.8 stroke,
 * currentColor) — they live here because Icon.tsx is shared chrome owned
 * elsewhere and these shapes are town-specific.
 */

/** The page's ink rules. Derived from --color-ink so they follow the ground. */
export const INK_RULE = 'color-mix(in oklab, var(--color-ink) 24%, transparent)'
export const INK_RULE_STRONG = 'color-mix(in oklab, var(--color-ink) 52%, transparent)'
/** Struck brass — fills only. Brass never carries small text on canvas. */
export const BRASS_PIN =
  'radial-gradient(circle at 36% 32%, #f0d79a 0%, var(--iron-edge) 52%, #6d5218 100%)'

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

/** Item-kind glyph — sits inside a stamped socket on shop/bag ledger rows. */
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

/** Made cot silhouette — nobody needs a bed tonight. */
export function BedGlyph({ size = 44, className }: GlyphProps): React.JSX.Element {
  return (
    <Svg size={size} className={className}>
      <path d="M3 17 H21 V13 a2 2 0 0 0 -2 -2 H5 a2 2 0 0 0 -2 2 Z" />
      <path d="M3 13.5 V7" />
      <path d="M4.5 20 V17" />
      <path d="M19.5 20 V17" />
      <path d="M5.5 11 V9 a1 1 0 0 1 1 -1 H10 a1 1 0 0 1 1 1 V11" />
    </Svg>
  )
}

/** Quill laid down — nothing written on the board today. */
export function QuillGlyph({ size = 44, className }: GlyphProps): React.JSX.Element {
  return (
    <Svg size={size} className={className}>
      <path d="M4 20 C7 13 12 7 20 4 C19 12 15 17 8 18 Z" />
      <path d="M4 20 L10 14" />
    </Svg>
  )
}

/**
 * The entry's heading: display small-caps name stamped between two flat ink
 * rules, with the one-line gloss underneath in the body voice. Same grammar as
 * the title sheet — heavy rule above, hairline below.
 */
export function EntryHeading({ title, blurb }: { title: string; blurb: string }): React.JSX.Element {
  return (
    <header>
      <div aria-hidden className="h-px w-full" style={{ background: INK_RULE_STRONG }} />
      <Heading
        level={1}
        className="!m-0 !py-2 !text-[1.55rem] !uppercase !tracking-[0.14em] !text-[color:var(--color-ink)]"
      >
        {title}
      </Heading>
      <div aria-hidden className="h-px w-full" style={{ background: INK_RULE }} />
      <p data-probe="prose" className="mt-2.5 m-0 font-body leading-relaxed text-[color:var(--color-parchment-dim)]">
        {blurb}
      </p>
    </header>
  )
}

/** Small-caps section label with a hairline rule running out to the margin. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }): React.JSX.Element {
  return (
    <h3
      data-probe="section-label"
      className={`voice-display flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.26em] text-[color:var(--color-parchment-dim)] ${className ?? 'mt-8'}`}
    >
      <span className="shrink-0">{children}</span>
      <span aria-hidden className="h-px flex-1" style={{ background: INK_RULE }} />
    </h3>
  )
}

/**
 * The header of an accounts column — small caps over a hard ink rule. This is
 * what makes a list of rows read as a ledger rather than a CRUD table: the
 * columns are declared once, and every row below hangs off the same stops.
 */
export interface ColumnSpec {
  label: string
  align?: 'left' | 'right'
}

export function ColumnHeader(
  { cols, style, className }: { cols: readonly ColumnSpec[]; style: React.CSSProperties; className?: string },
): React.JSX.Element {
  // First written column carries the audit hook (leading spacer cells are blank).
  const probeIdx = cols.findIndex((c) => c.label !== '')
  return (
    <div
      aria-hidden
      className={`mt-3 grid items-end gap-3 pb-1 text-[0.58rem] uppercase tracking-[0.2em] text-[color:var(--color-text-muted)] ${className ?? ''}`}
      style={{ ...style, borderBottom: `1px solid ${INK_RULE_STRONG}` }}
    >
      {cols.map((c, i) => (
        <span
          key={i}
          data-probe={i === probeIdx ? 'col-header' : undefined}
          className={c.align === 'right' ? 'text-right' : ''}
        >
          {c.label}
        </span>
      ))}
    </div>
  )
}

/**
 * Designed empty state: dimmed ink silhouette + in-voice copy (never italics),
 * with an optional pointer to the action that fills it.
 */
export function EmptyState({ glyph, line, hint }: { glyph: React.ReactNode; line: string; hint?: string }): React.JSX.Element {
  return (
    <div className="mt-2 flex items-center gap-4 py-1.5">
      <span aria-hidden className="shrink-0 text-[color:var(--color-ink)] opacity-30">{glyph}</span>
      <div>
        <div data-probe="empty-line" className="font-body text-[color:var(--color-parchment-dim)]">{line}</div>
        {hint ? (
          <div data-probe="empty-hint" className="mt-1 text-sm text-[color:var(--color-text-muted)]">{hint}</div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Shaped icon stamp: diamond = gear you wield, circle = consumable. On the
 * page the socket is an INK OUTLINE, not a recessed well — a ledger clerk's
 * stamp beside the entry. Container shape stays semantic.
 */
export function KindSocket({ kind }: { kind: ItemKind }): React.JSX.Element {
  const gear = kind !== 'food' && kind !== 'potion'
  return (
    <span
      aria-hidden
      className={`flex h-7 w-7 shrink-0 items-center justify-center text-[color:var(--color-parchment-dim)] ${
        gear ? 'rotate-45 rounded-[var(--radius-sm)]' : 'rounded-full'
      }`}
      style={{
        background: 'color-mix(in oklab, var(--color-ink) 4%, transparent)',
        boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--color-ink) 32%, transparent)',
      }}
    >
      <span className={gear ? '-rotate-45' : ''}>
        <ItemKindGlyph kind={kind} size={15} />
      </span>
    </span>
  )
}
