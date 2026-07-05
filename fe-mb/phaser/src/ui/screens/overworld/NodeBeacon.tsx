import React from 'react'
import { Pressable } from '../../components'
import { NodeMapSymbol } from './PaperMap'
import { regionPalette, type RegionPalette } from './palette'

export type NodeVisualState = 'current' | 'hover' | 'planned' | 'reachable' | 'distant'
export type NodeProgress = 'unvisited' | 'visited' | 'failed'

interface NodeLike {
  id: string
  name?: string
  type: string
  /** Render-only override for the drawn sigil (gameplay still keys off `type`). */
  sigil?: string
  position: { x: number; y: number }
}

interface RingStyle {
  ring: string
  ringWidth: number
  glow: string
  opacity: number
}

/**
 * Ink treatment per node state, derived from the region palette so the marks
 * always read as the same cartographer's hand as the roads:
 *   - current: the wax-red route accent + a soft warm glow (the seal "you are here")
 *   - hover: hearth gold — the one non-ink color, an interactive invitation
 *   - planned: route accent at full ink weight (accent color is the discriminator)
 *   - reachable: firm, HEAVY primary ink + a dashed accent invitation ring
 *   - distant: thin lighter ink, well faded — must read as "not yet" next to reachable
 */
function ringStyles(palette: RegionPalette): Record<NodeVisualState, RingStyle> {
  return {
    current: { ring: palette.accent, ringWidth: 1.8, glow: 'drop-shadow(0 0 7px rgba(232,169,58,0.55))', opacity: 1 },
    hover: { ring: 'var(--color-hearth)', ringWidth: 1.6, glow: 'drop-shadow(0 0 6px rgba(232,169,58,0.5))', opacity: 1 },
    planned: { ring: palette.accent, ringWidth: 2.4, glow: 'none', opacity: 1 },
    reachable: { ring: palette.ink, ringWidth: 2.4, glow: 'none', opacity: 1 },
    distant: { ring: palette.inkSoft, ringWidth: 1.3, glow: 'none', opacity: 0.72 },
  }
}

/**
 * One map node on the parchment sheet, a 3-element stack that seats the marker
 * ON the paper instead of floating it:
 *   1. ground-contact ellipse — soft SEPIA, OFFSET below center. (A black blob
 *      on parchment reads as a hole burnt through the paper, not a shadow.)
 *   2. the parchment disc + ink ring (tinted by state) over a faint inkSoft
 *      outline, so the disc never vanishes into the parchment around it.
 *   3. the type silhouette (NodeMapSymbol) + a progress badge (✓ cleared / ✕ failed).
 * Idle life is an expanding "ping" ring (current/hover only) — scale lives on a
 * throwaway ring, never on the disc, so the node never appears to float/pulse.
 */
export function NodeBeacon({
  node,
  state,
  progress,
  onPress,
  onHover,
  palette = regionPalette('borderlands'),
}: {
  node: NodeLike
  state: NodeVisualState
  progress: NodeProgress
  onPress: () => void
  onHover: (hovering: boolean) => void
  palette?: RegionPalette
}): React.JSX.Element {
  const r = ringStyles(palette)[state]
  const tint = r.ring
  // de-sync pings so 15 nodes don't pulse in lockstep
  const stagger = (node.id.charCodeAt(0) % 7) * 0.22
  // disc fill sits one half-step above each region's paper (so Thornwood/Ashfall
  // discs aren't sticker-bright); distant nodes take a duller, greyer fill so
  // they recede from the reachable ring beside them.
  const discFill =
    state === 'distant' ? '#e6ddc4' : `color-mix(in srgb, ${palette.parchment.base} 60%, #f7efd8 40%)`

  return (
    <Pressable
      id={`node-${node.id}`}
      onPress={onPress}
      aria-label={`${node.type}: ${node.name ?? node.id}`}
      className="group absolute flex items-center justify-center select-none outline-none cursor-pointer rounded-full data-[focus-visible]:ring-2 data-[focus-visible]:ring-amber-500"
      style={{ left: node.position.x - 26, top: node.position.y - 26, width: 52, height: 52, zIndex: 5, opacity: r.opacity }}
    >
      <div
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        className="relative flex items-center justify-center w-full h-full motion-safe:transition-transform group-data-[hovered]:scale-110"
      >
        {/* (1) ground-contact ellipse — sepia, offset below center, soft */}
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 rounded-[50%]"
          style={{
            width: 36,
            height: 13,
            transform: 'translate(-50%, 11px)',
            background: 'radial-gradient(50% 50% at 50% 50%, rgba(70,45,20,0.35), transparent 75%)',
            filter: 'blur(2px)',
          }}
        />

        {/* idle ping ring (current/hover only) — expands & fades; never scales the disc */}
        {(state === 'current' || state === 'hover') && (
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 rounded-full motion-safe:[animation:nodePing_2.4s_ease-out_infinite]"
            style={{ width: 38, height: 38, marginLeft: -19, marginTop: -19, border: `1.5px solid ${tint}`, animationDelay: `${stagger}s` }}
          />
        )}

        {/* (2) disc body — parchment over a faint inkSoft outline; carries the state glow */}
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 38,
            height: 38,
            background: discFill,
            border: `${r.ringWidth}px solid ${tint}`,
            filter: r.glow,
            boxShadow: `0 1px 2px rgba(70,45,20,0.35), 0 0 0 1px ${palette.inkSoft}40`,
          }}
        />
        {state === 'current' && (
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ width: 46, height: 46, border: `1.6px solid ${palette.accent}`, opacity: 0.5 }}
          />
        )}
        {/* dashed "invitation" ring — REACHABLE only: a clear, distinct cue that
            this node can be travelled to right now (vs the faded distant nodes) */}
        {state === 'reachable' && (
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 46,
              height: 46,
              border: `1px dashed ${palette.accent}`,
              opacity: 0.35,
              // approximate strokeDasharray '3 4' for a CSS dashed border
              borderStyle: 'dashed',
            }}
          />
        )}

        {/* (3) type silhouette — sigil overrides the drawn mark, gameplay keeps `type`.
            Distant nodes draw the GLYPH in firm ink (not the faded inkSoft ring
            colour) so the role still reads at reduced opacity; the lighter ring
            still carries the distant/reachable hierarchy. */}
        <NodeMapSymbol type={node.sigil ?? node.type} tint={state === 'distant' ? palette.ink : tint} />

        {/* progress badge — sepia wax seal with a parchment check / inkSoft for failed */}
        {progress === 'visited' && (
          <span
            className="absolute rounded-full flex items-center justify-center pointer-events-none"
            style={{
              left: 30,
              top: 32,
              width: 14,
              height: 14,
              fontSize: 9,
              lineHeight: '14px',
              background: palette.ink,
              color: '#f0e7ce',
              border: '1px solid rgba(240,231,206,0.5)',
            }}
            aria-label="cleared"
          >
            ✓
          </span>
        )}
        {progress === 'failed' && (
          <span
            className="absolute rounded-full flex items-center justify-center pointer-events-none"
            style={{ left: 30, top: 32, width: 14, height: 14, fontSize: 9, lineHeight: '14px', background: palette.inkSoft, color: '#f0e7ce' }}
            aria-label="failed"
          >
            ✕
          </span>
        )}
      </div>
    </Pressable>
  )
}
