import React from 'react'
import { roadStyles, edgePath, hashEdgeId, edgeKey, type RoadState, type RoadInk } from './roadStyle'
import { regionPalette, type RegionPalette } from './palette'

interface Edge {
  from: string
  to: string
}
interface Node {
  id: string
  position: { x: number; y: number }
}

/** One road ready to draw: its base ink + an optional state over-stroke. */
interface DrawnEdge {
  key: string
  d: string
  base: RoadInk
  over: RoadInk | null
}

/**
 * The hand-inked road layer of the paper map. Two SVG groups so the printed
 * cartography (static) is separated from state-motion (cheap, animated):
 *   1. base `<g filter=inkWobble>` — EVERY edge as a dashed travel-route line
 *      (the classic dotted map trail), displaced once by a light fractal-noise
 *      filter so strokes wobble like a hand-held quill instead of ruling-pen
 *      straight. Distant edges are faint; edges off the current node are firm.
 *   2. state `<g>` — hover/planned/active legs over-drawn as solid "wet ink"
 *      on top of the dashed base; the active hop adds a marching ember comet.
 *      Never filtered (motion stays cheap).
 */
export function OverworldRoads({
  edges,
  nodes,
  currentNodeId,
  plannedEdgeKeys,
  hoverEdgeKeys,
  activeEdgeKey,
  width,
  height,
  palette = regionPalette('borderlands'),
}: {
  edges: Edge[]
  nodes: Node[]
  currentNodeId: string
  plannedEdgeKeys: Set<string>
  hoverEdgeKeys: Set<string>
  activeEdgeKey: string | null
  width: number
  height: number
  palette?: RegionPalette
}): React.JSX.Element {
  const styles = roadStyles(palette)
  const posOf = (id: string): { x: number; y: number } | undefined =>
    nodes.find((n) => n.id === id)?.position

  const paths = edges
    .map((e): DrawnEdge | null => {
      const a = posOf(e.from)
      const b = posOf(e.to)
      if (!a || !b) return null
      const key = edgeKey(e.from, e.to)
      const adjacent = e.from === currentNodeId || e.to === currentNodeId
      const state: RoadState =
        activeEdgeKey === key
          ? 'active'
          : plannedEdgeKeys.has(key)
            ? 'planned'
            : hoverEdgeKeys.has(key)
              ? 'hover'
              : adjacent
                ? 'adjacent'
                : 'distant'
      return {
        key,
        d: edgePath(a, b, hashEdgeId(e.from, e.to)),
        base: styles[adjacent ? 'adjacent' : 'distant'],
        over: state === 'active' || state === 'planned' || state === 'hover' ? styles[state] : null,
      }
    })
    .filter((p): p is DrawnEdge => p !== null)

  return (
    <svg
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
      style={{ overflow: 'visible' }}
      aria-hidden
    >
      <defs>
        <filter id="inkWobble" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      {/* DASHED-INK BASE — the printed map, hand-wobbled once */}
      <g filter="url(#inkWobble)">
        {paths.map(({ key, d, base }) => (
          <path
            key={`b-${key}`}
            d={d}
            fill="none"
            stroke={base.body}
            strokeOpacity={base.opacity}
            strokeWidth={base.width}
            strokeLinecap="round"
            strokeDasharray={base.dash}
          />
        ))}
      </g>

      {/* WET-INK STATE — hover/planned/active over-strokes, unfiltered */}
      <g>
        {paths.map(({ key, d, over }) =>
          over === null ? null : (
            <g key={`s-${key}`}>
              {/* pooled-ink underlay — slightly wider + darker so the over-stroke reads freshly drawn */}
              {over.underlay !== undefined && (
                <path
                  d={d}
                  fill="none"
                  stroke={over.underlay}
                  strokeOpacity={0.4}
                  strokeWidth={over.width + 1.6}
                  strokeLinecap="round"
                />
              )}
              <path
                d={d}
                fill="none"
                stroke={over.body}
                strokeOpacity={over.opacity}
                strokeWidth={over.width}
                strokeLinecap="round"
              />
              {/* marching ember comet along the active hop */}
              {over.comet !== undefined && (
                <path
                  d={d}
                  fill="none"
                  stroke={over.comet}
                  strokeWidth={Math.max(1.6, over.width - 1)}
                  strokeLinecap="round"
                  strokeDasharray="14 9999"
                  className="road-comet"
                />
              )}
            </g>
          ),
        )}
      </g>
    </svg>
  )
}
