/**
 * ui/components/Sigil.tsx — who someone is when the game has no likeness of them.
 *
 * FINAL GATE C 3.10: five of the twenty-four characters ship no `spriteId`, and one of them is Guildmistress
 * Anya — the giver of the first contract and the host of the naming beat. Every slot fell back to
 * `displayName.slice(0, 2)`, so the first named face in the game was a plain brown disc reading "Gu": a two-letter
 * slice of a TITLE, under a brass plaque that spelled her name out in full.
 *
 * The answer is not better initials — a disc with letters on it is the same object with a tidier label. It is the
 * identity record `characters.json` has carried for every one of them since the first commit and nothing ever
 * drew: `portrait: { accent, faction, shape }`, the ramp `engine/content.ts#portraitFor` was written to serve.
 * This draws it as what it is — a SEAL on a strap: the person's device struck on a shaped field in their own ink,
 * charged by what they are to the company (a ledger's rules for the guild, a road chevron for a traveller,
 * crossed bars for someone on the other side). It hangs in the slot a painted bust would fill and sinks into the
 * same shadow, so a frame with one likeness and one seal still reads as two people in a room, and it says the
 * true thing: we have no picture of them, we have their mark.
 *
 * Two sizes of the same object: `bust` for the talk frame (the only place a portrait-less speaker is reachable
 * today) and `mark` for the 40px face slots, belt-and-braces for a unit whose class has no art at all. Colour is
 * CSS — `data-accent` picks `--sigil-ink` off the `--id-*` ramp — so this file names no ink.
 */
import React from 'react'
import type { Portrait } from '../../engine/types'

/** The field the charge is struck on — `portrait.shape`, on a unit box centred on (0,0) with radius 1. */
function FieldPath({ shape }: { readonly shape: Portrait['shape'] }): React.JSX.Element {
  switch (shape) {
    case 'square': return <rect x={-0.8} y={-0.8} width={1.6} height={1.6} rx={0.14} />
    case 'diamond': return <path d="M0 -1 L1 0 L0 1 L-1 0 Z" />
    case 'triangle': return <path d="M0 -0.96 L0.94 0.68 L-0.94 0.68 Z" />
    case 'hex': return <path d="M0 -1 L0.87 -0.5 L0.87 0.5 L0 1 L-0.87 0.5 L-0.87 -0.5 Z" />
    case 'circle':
    default: return <circle cx={0} cy={0} r={0.98} />
  }
}

/**
 * What the seal is charged with — what this person is to the company, in one geometric mark. Drawn on the same
 * unit box as the field so the two are struck together at any size.
 */
function ChargePath({ faction }: { readonly faction: Portrait['faction'] }): React.JSX.Element {
  switch (faction) {
    // the guild, the ledger, anyone who keeps books: three ruled lines
    case 'noble':
    case 'narrator':
      return <path d="M-0.34 -0.24 H0.34 M-0.34 0 H0.34 M-0.34 0.24 H0.2" />
    // the company's own: a keystone
    case 'party':
      return <path d="M-0.3 -0.28 H0.3 L0.16 0.3 H-0.16 Z" />
    // the other side of the field: crossed bars
    case 'enemy':
      return <path d="M-0.3 -0.3 L0.3 0.3 M0.3 -0.3 L-0.3 0.3" />
    // what walks its own road: a star
    case 'mystic':
      return <path d="M0 -0.36 L0.11 -0.11 L0.36 0 L0.11 0.11 L0 0.36 L-0.11 0.11 L-0.36 0 L-0.11 -0.11 Z" />
    // the road itself: a chevron, pointing the way they are going
    default:
      return <path d="M-0.32 0.12 L0 -0.22 L0.32 0.12" />
  }
}

export interface SigilProps {
  readonly portrait: Portrait
  /** `bust` hangs in a talk slot; `mark` fills a 40px face frame. */
  readonly variant?: 'bust' | 'mark'
  readonly className?: string
}

/** The seal. One ink (`--sigil-ink`, from `data-accent`), one struck rim, one charge — and nothing emits. */
export function Sigil({ portrait, variant = 'bust', className }: SigilProps): React.JSX.Element {
  const cls = `sigil sigil--${variant}${className === undefined ? '' : ` ${className}`}`
  const seal = (
    <>
      <g className="sigil__field"><FieldPath shape={portrait.shape} /></g>
      <g className="sigil__charge"><ChargePath faction={portrait.faction} /></g>
    </>
  )
  if (variant === 'mark') {
    return (
      <svg className={cls} data-accent={portrait.accent} data-shape={portrait.shape} data-testid="sigil" viewBox="-1.25 -1.25 2.5 2.5" aria-hidden preserveAspectRatio="xMidYMid meet">
        {seal}
      </svg>
    )
  }
  return (
    <svg className={cls} data-accent={portrait.accent} data-shape={portrait.shape} data-testid="sigil" viewBox="0 0 220 340" aria-hidden preserveAspectRatio="xMidYMax meet">
      {/* the strap it hangs on — it comes from somewhere, which is what stops a lone medallion floating */}
      <path className="sigil__strap" d="M96 0 L96 150 M124 0 L124 150" />
      <path className="sigil__ring" d="M110 132 m-15 0 a15 15 0 1 0 30 0 a15 15 0 1 0 -30 0" />
      <g transform="translate(110 236) scale(84)">{seal}</g>
    </svg>
  )
}
