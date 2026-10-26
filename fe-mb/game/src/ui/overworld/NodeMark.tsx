/**
 * ui/overworld/NodeMark.tsx — one location on the sheet: a ground-contact sepia shadow (a black blob on parchment
 * reads as a hole burnt through the paper), a parchment disc with an ink ring tinted by state, the type sigil
 * drawn in the same cartographer's hand, a wax-seal badge for visited / locked, the name lettered beneath.
 * State is the discriminator: current = wax accent seal, reachable = heavy ink + dashed invitation,
 * planned = accent, hover = hearth gold (the one non-ink colour), distant = thin faded ink. Nothing glows
 * (BRIEF §5): a mark that matters gets a heavier ring, a seal and a deeper contact shadow — light falls on the
 * sheet, the sheet never emits it.
 *
 * `label` is the placement the sheet's cartographer (`./labels.ts`) worked out for this name: the offset, in sheet
 * pixels, from the mark's centre to the name's centre. It is computed for the WHOLE sheet, so a name sits in the
 * same place at every camera position; the mark itself is the only thing that scales on hover, because a name that
 * moved under the pointer could walk into its neighbour.
 */
import React from 'react'
import { typeLabel } from '../../engine/run/overworld'
import type { OverworldNode } from '../../engine/types'
import { Icon } from '../components/Icon'
import { useTip } from '../components/Tooltip'
import type { LabelSpot } from './labels'
import type { RegionPalette } from './palette'

export type NodeVisual = 'current' | 'hover' | 'planned' | 'reachable' | 'distant'

/** A mark's caption lives in `engine/run/overworld.ts#typeLabel`: the headless frame names a place's kind too
 *  (FINAL GATE A 1.2) and `scripts/**` may not import `ui/**`. Re-exported so the map keeps asking the sheet. */
export { typeLabel }

export function NodeSigil({ type, tint }: { readonly type: OverworldNode['type']; readonly tint: string }): React.JSX.Element {
  const common = { stroke: tint, strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  let inner: React.JSX.Element
  switch (type) {
    case 'TOWN':
      inner = (
        <g {...common}>
          <path d="M-13 8 L-13 -2 L-7 -8 L-1 -2 L-1 8 Z" />
          <path d="M-1 8 L-1 1 L4 -4 L9 1 L9 8 Z" />
          <path d="M-7 -8 L-7 -13 L-4 -13 L-4 -10" fill={tint} />
        </g>
      )
      break
    case 'CAMP':
      inner = (
        <g {...common}>
          <path d="M-11 8 L0 -10 L11 8 Z" />
          <path d="M0 -10 L0 8 M-4 8 L0 0 L4 8" strokeWidth={1.1} />
          <path d="M0 -10 L5 -13 L5 -10" fill={tint} />
        </g>
      )
      break
    case 'DUNGEON':
      inner = (
        <g {...common}>
          <path d="M-13 8 L-5 -9 L2 -1 L8 -11 L13 8 Z" />
          <path d="M-3 8 a4 5 0 0 1 8 0 Z" fill={tint} />
        </g>
      )
      break
    case 'BOSS':
      inner = (
        <g {...common}>
          <path d="M-11 9 L-11 -4 L-7 -4 L-7 -8 L-3 -8 L-3 -4 L3 -4 L3 -8 L7 -8 L7 -4 L11 -4 L11 9 Z" />
          <path d="M-3 9 L-3 2 L3 2 L3 9" />
        </g>
      )
      break
    case 'DISCOVERY':
      inner = (
        <g {...common}>
          <path d="M-5 9 L-4 -8 L4 -8 L5 9 Z" />
          <path d="M-4 -8 L-2 -12 L2 -12 L4 -8" />
          <path d="M-7 9 L7 9" strokeWidth={1.1} />
        </g>
      )
      break
    case 'TRAIL':
      inner = (
        <g {...common}>
          <circle r={4} fill={tint} stroke="none" />
          <circle r={8} strokeWidth={1.1} />
        </g>
      )
      break
  }
  return <svg viewBox="-20 -20 40 40" width={32} height={32} className="ow-node__sigil">{inner}</svg>
}

const DEFAULT_SPOT: LabelSpot = { dx: 0, dy: 32 }

export function NodeMark({ node, visual, visited, locked, palette, disabledReason, label = DEFAULT_SPOT, labelCut = false, onPress, onHover }: {
  readonly node: OverworldNode
  readonly visual: NodeVisual
  readonly visited: boolean
  readonly locked: boolean
  readonly palette: RegionPalette
  readonly disabledReason: string | null
  readonly label?: LabelSpot
  /** True when the window's edge would slice this name. It is then not lettered at all: a place-name amputated to
   *  three letters is not a name, and §5.1's rule is that a name fits or it is a bug (RE-GATE C 3.20). */
  readonly labelCut?: boolean
  readonly onPress: () => void
  readonly onHover: (hovering: boolean) => void
}): React.JSX.Element {
  const tint = visual === 'current' ? palette.accent : visual === 'hover' ? 'var(--color-hearth)' : visual === 'planned' ? palette.accent : visual === 'reachable' ? palette.ink : palette.inkSoft
  const ringWidth = visual === 'planned' || visual === 'reachable' ? 2.4 : visual === 'distant' ? 1.3 : 1.8
  // Nothing emits: a lifted mark is READ through a deeper contact shadow under it, not a halo around it.
  const lift = visual === 'current' || visual === 'hover' ? '0 3px 5px rgba(70,45,20,0.42)' : '0 1px 2px rgba(70,45,20,0.35)'
  // The mark's paper comes from the REGION's own stock (`./palette.ts`), never from a literal here: this file is
  // not the palette, and a hex in it forks the sheet's identity one component at a time (RE-GATE B 2.1).
  const disc = visual === 'distant' ? palette.parchment.discFaded : `color-mix(in srgb, ${palette.parchment.base} 60%, ${palette.parchment.disc} 40%)`
  const { tipRef, tipProps, tip } = useTip(disabledReason)
  return (
    <>
    <button
      ref={tipRef}
      type="button"
      className={`ow-node ow-node--${visual}`}
      data-testid={`node-${node.id}`}
      aria-label={`${typeLabel(node.type)}: ${node.name}`}
      style={{ left: node.position.x - 26, top: node.position.y - 26, opacity: visual === 'distant' ? 0.78 : 1, cursor: disabledReason === null ? 'pointer' : 'default' }}
      onClick={onPress}
      onMouseEnter={() => { onHover(true); tipProps.onPointerEnter() }}
      onMouseLeave={() => { onHover(false); tipProps.onPointerLeave() }}
      onFocus={tipProps.onFocus}
      onBlur={tipProps.onBlur}
      aria-describedby={tipProps['aria-describedby']}
      data-reason={tipProps['data-reason']}
    >
      <span className="ow-node__mark">
        <span className="ow-node__shadow" />
        <span className="ow-node__disc" style={{ background: disc, border: `${ringWidth}px solid ${tint}`, boxShadow: `${lift}, 0 0 0 1px ${palette.inkSoft}40` }} />
        {visual === 'current' && <span className="ow-node__seal" style={{ borderColor: palette.accent }} />}
        {visual === 'reachable' && <span className="ow-node__invite" style={{ borderColor: palette.accent }} />}
        <NodeSigil type={node.type} tint={visual === 'distant' ? palette.ink : tint} />
        {locked && <span className="ow-node__badge ow-node__badge--lock" style={{ background: palette.ink }}><Icon name="lock" size={10} title="sealed" /></span>}
        {!locked && visited && visual !== 'current' && <span className="ow-node__badge" style={{ background: palette.ink }}><Icon name="check" size={10} title="visited" /></span>}
      </span>
      <span className={`ow-node__label${labelCut ? ' ow-node__label--cut' : ''}`} style={{ color: palette.ink, left: 26 + label.dx, top: 26 + label.dy }}>{node.name}</span>
    </button>
    {tip}
    </>
  )
}
