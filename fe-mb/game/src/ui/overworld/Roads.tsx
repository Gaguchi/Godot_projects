/**
 * ui/overworld/Roads.tsx — the inked road layer, three SVG groups: the printed base (every edge dashed, wobbled
 * once by a light noise filter so the quill hand shows), the state over-strokes (hover / planned / the active hop
 * with its marching comet), unfiltered so motion stays cheap, and the SCOUT MARKS.
 *
 * A scout mark is what the ration bought, drawn where the road is: a camp Scout pre-rolls every crossing within
 * three hops and the report used to live only on the camp screen, so the player read thirteen name-pairs, walked
 * out, and then chose a road with none of it in front of them (RE-GATE C 3.9). Now the sighting is annotated onto
 * the road itself in the cartographer's own hand — one shape per kind, never colour alone — and the sentence it
 * stands for is quoted in the hover preview before the click.
 */
import React from 'react'
import type { OverworldEdge, OverworldNode } from '../../engine/types'
import { edgeKey } from '../../engine/run/overworld'
import type { Sighting } from '../../engine/run/scout'
import type { RegionPalette } from './palette'
import { edgePath, edgePolyline, hashEdge, roadStyles, type Point, type RoadInk, type RoadState } from './roadInk'

interface Drawn {
  readonly key: string
  readonly d: string
  readonly base: RoadInk
  readonly over: RoadInk | null
  readonly mark: { readonly at: Point; readonly sighting: Sighting } | null
}

/** The annotation itself: a paper roundel with the sighting drawn on it. Shape carries the meaning (a quiet ring,
 *  crossed blades, a waiting figure, an unknown), the tint is the second channel, and the words are on hover. */
function ScoutMark({ at, sighting, palette }: { readonly at: Point; readonly sighting: Sighting; readonly palette: RegionPalette }): React.JSX.Element {
  const tint = sighting.quiet ? palette.inkSoft : palette.accent
  const stroke = { stroke: tint, strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  let inner: React.JSX.Element
  switch (sighting.kind) {
    case 'quiet':
      inner = <circle r={2.3} {...stroke} />
      break
    case 'battle':
      inner = <g {...stroke}><path d="M-4 -4 L4 4 M4 -4 L-4 4" /></g>
      break
    case 'dialogue':
      inner = <g {...stroke}><circle cy={-2.6} r={1.7} /><path d="M-3.4 4.4 C-3.4 0.6 3.4 0.6 3.4 4.4" /></g>
      break
    case 'checkEvent':
      inner = <g {...stroke}><path d="M0 -4.6 L4.6 0 L0 4.6 L-4.6 0 Z" /></g>
      break
  }
  // A quiet road is the reading the player expects, so it is annotated more lightly than a road with something on
  // it: the hierarchy of the marks IS the shape of the report, read at a glance across the whole sheet.
  return (
    <g transform={`translate(${at.x} ${at.y})`} opacity={sighting.quiet ? 0.8 : 1}>
      <circle r={sighting.quiet ? 5.6 : 7.6} fill={palette.parchment.disc} stroke={sighting.quiet ? palette.inkSoft : palette.ink} strokeWidth={1.1} opacity={0.96} />
      {inner}
    </g>
  )
}

export function Roads({ edges, nodes, currentNodeId, plannedKeys, hoverKeys, activeKey, sighted, width, height, palette }: {
  readonly edges: readonly OverworldEdge[]
  readonly nodes: readonly OverworldNode[]
  readonly currentNodeId: string
  readonly plannedKeys: ReadonlySet<string>
  readonly hoverKeys: ReadonlySet<string>
  readonly activeKey: string | null
  /** What the scouts saw, by undirected edge key — the roads a ration has already paid to look down. */
  readonly sighted: ReadonlyMap<string, Sighting>
  readonly width: number
  readonly height: number
  readonly palette: RegionPalette
}): React.JSX.Element {
  const styles = roadStyles(palette)
  const pos = new Map(nodes.map((n) => [n.id, n.position] as const))
  const paths: Drawn[] = []
  for (const e of edges) {
    const a = pos.get(e.from)
    const b = pos.get(e.to)
    if (a === undefined || b === undefined) continue
    const key = edgeKey(e.from, e.to)
    const adjacent = e.from === currentNodeId || e.to === currentNodeId
    const state: RoadState = activeKey === key ? 'active' : plannedKeys.has(key) ? 'planned' : hoverKeys.has(key) ? 'hover' : adjacent ? 'adjacent' : 'distant'
    const hash = hashEdge(e.from, e.to)
    const sighting = sighted.get(key)
    // the mid-point of the drawn curve, not of the straight line: the mark has to sit ON the ink (roadInk.ts)
    const mid = edgePolyline(a, b, hash, 2)[1] ?? a
    paths.push({
      key,
      d: edgePath(a, b, hash),
      base: styles[adjacent ? 'adjacent' : 'distant'],
      over: state === 'active' || state === 'planned' || state === 'hover' ? styles[state] : null,
      mark: sighting === undefined ? null : { at: mid, sighting },
    })
  }
  return (
    <svg width={width} height={height} className="ow-roads" style={{ overflow: 'visible' }} aria-hidden>
      <g filter="url(#owInkWobble)">
        {paths.map(({ key, d, base }) => <path key={`b-${key}`} d={d} fill="none" stroke={base.body} strokeOpacity={base.opacity} strokeWidth={base.width} strokeLinecap="round" strokeDasharray={base.dash} />)}
      </g>
      <g>
        {paths.map(({ key, d, over }) => over === null ? null : (
          <g key={`s-${key}`}>
            {over.underlay !== undefined && <path d={d} fill="none" stroke={over.underlay} strokeOpacity={0.4} strokeWidth={over.width + 1.6} strokeLinecap="round" />}
            <path d={d} fill="none" stroke={over.body} strokeOpacity={over.opacity} strokeWidth={over.width} strokeLinecap="round" />
            {over.comet !== undefined && <path d={d} fill="none" stroke={over.comet} strokeWidth={Math.max(1.6, over.width - 1)} strokeLinecap="round" strokeDasharray="14 9999" className="ow-road-comet" />}
          </g>
        ))}
      </g>
      <g data-testid="scout-marks">
        {paths.map(({ key, mark }) => mark === null ? null : <ScoutMark key={`m-${key}`} at={mark.at} sighting={mark.sighting} palette={palette} />)}
      </g>
    </svg>
  )
}
