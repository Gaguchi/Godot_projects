/**
 * ui/overworld/Sheet.tsx — the one open sheet (DECISIONS: one map, no region strips): aged paper the full size of
 * the world, three territories washed in their own parchment tint, a cartographer's ink for the wilderness
 * (mountains where no road goes, forests in Thornwood, cinder crosses in Ashfall), region names in the display
 * voice, a double border and a compass rose. Pure SVG + CSS, deterministic from the map id, memoised once.
 */
import React, { useMemo } from 'react'
import type { OverworldNode, RegionDef } from '../../engine/types'
import type { Rect } from './labels'
import { regionPalette, type RegionPalette } from './palette'

function hash(x: number, y: number, s: number): number {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2246822519)) >>> 0
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

function seedOf(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

function tree(cx: number, cy: number, k: number, ink: string): React.JSX.Element {
  const s = 6 + k * 4
  return (
    <g key={`t${cx}-${cy}`} stroke={ink} strokeWidth={1.1} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.8}>
      <path d={`M${cx} ${cy + s} L${cx} ${cy - s * 1.3}`} />
      <path d={`M${cx} ${cy - s * 1.3} L${cx - s * 0.8} ${cy} M${cx} ${cy - s * 1.3} L${cx + s * 0.8} ${cy}`} />
      <path d={`M${cx} ${cy - s * 0.4} L${cx - s} ${cy + s * 0.5} M${cx} ${cy - s * 0.4} L${cx + s} ${cy + s * 0.5}`} />
    </g>
  )
}
function mountain(cx: number, cy: number, k: number, ink: string, soft: string): React.JSX.Element {
  const w = 16 + k * 12
  const ht = 12 + k * 9
  return (
    <g key={`m${cx}-${cy}`} stroke={ink} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.85}>
      <path d={`M${cx - w} ${cy + ht * 0.4} L${cx - w * 0.2} ${cy - ht} L${cx + w * 0.5} ${cy + ht * 0.4}`} />
      <path d={`M${cx - w * 0.3} ${cy - ht * 0.55} l -3 5 m 3 -5 l 3 5`} stroke={soft} strokeWidth={0.8} />
      <path d={`M${cx + w * 0.1} ${cy + ht * 0.4} L${cx + w * 0.7} ${cy - ht * 0.7} L${cx + w * 1.2} ${cy + ht * 0.4}`} />
    </g>
  )
}
function tuft(cx: number, cy: number, soft: string): React.JSX.Element {
  return <path key={`g${cx}-${cy}`} d={`M${cx - 3} ${cy} q1 -4 0 -6 M${cx} ${cy} q0 -5 0 -7 M${cx + 3} ${cy} q-1 -4 0 -6`} stroke={soft} strokeWidth={0.9} fill="none" strokeLinecap="round" opacity={0.5} />
}
function cinder(cx: number, cy: number, ink: string): React.JSX.Element {
  return <path key={`c${cx}-${cy}`} d={`M${cx - 3} ${cy - 3} l6 6 m0 -6 l-6 6`} stroke={ink} strokeWidth={0.9} fill="none" strokeLinecap="round" opacity={0.45} />
}

const GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.45 0 0 0 0 0.33 0 0 0 0 0.18 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"
const STAINS = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='600'><filter id='b'><feTurbulence type='fractalNoise' baseFrequency='0.006 0.008' numOctaves='3' seed='11'/><feColorMatrix values='0 0 0 0 0.4 0 0 0 0 0.28 0 0 0 0 0.14 0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23b)'/></svg>\")"

export interface RegionWash {
  readonly region: RegionDef
  readonly palette: RegionPalette
  readonly cx: number
  readonly cy: number
  readonly rx: number
  readonly ry: number
  /** Where the region's name is lettered (under its nodes). */
  readonly labelX: number
  readonly labelY: number
}

/** One wash per region: the ellipse that covers its nodes plus a margin, the label seated below the cluster. */
export function regionWashes(nodes: readonly OverworldNode[], regions: readonly RegionDef[]): readonly RegionWash[] {
  return regions.flatMap((region) => {
    const own = nodes.filter((n) => n.regionId === region.id)
    if (own.length === 0) return []
    const xs = own.map((n) => n.position.x)
    const ys = own.map((n) => n.position.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    return [{
      region,
      palette: regionPalette(region.id),
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      rx: (maxX - minX) / 2 + 150,
      ry: (maxY - minY) / 2 + 120,
      labelX: (minX + maxX) / 2,
      labelY: maxY + 78,
    }]
  })
}

export function Sheet({ width, height, mapId, nodes, washes, labelBoxes = [] }: { readonly width: number; readonly height: number; readonly mapId: string; readonly nodes: readonly OverworldNode[]; readonly washes: readonly RegionWash[]; readonly labelBoxes?: readonly Rect[] }): React.JSX.Element {
  const base = regionPalette('borderlands')
  const symbols = useMemo(() => {
    const seed = seedOf(mapId)
    const CELL = 72
    const cols = Math.ceil(width / CELL) + 1
    const rows = Math.ceil(height / CELL) + 1
    const paletteAt = (x: number): RegionPalette => {
      let best = washes[0]
      let bestD = Infinity
      for (const w of washes) {
        const d = Math.abs(w.cx - x) / Math.max(1, w.rx)
        if (d < bestD) { bestD = d; best = w }
      }
      return best?.palette ?? base
    }
    // distance to the charted corridor: near a node → sparse plains marks; far → wilderness (mountains / forest)
    const nearest = (x: number, y: number): number => {
      let d = Infinity
      for (const n of nodes) d = Math.min(d, Math.hypot(n.position.x - x, n.position.y - y))
      return d
    }
    const blocked = (cx: number, cy: number): boolean => {
      if (cy < 30 || cx < 30 || cx > width - 30 || cy > height - 30) return true
      for (const n of nodes) {
        const dx = cx - n.position.x
        const dy = cy - n.position.y
        if (dx * dx + dy * dy < 44 * 44) return true
      }
      // The place-names are not all lettered under their marks any more (`./labels.ts`), so the wilderness is
      // cleared from where each one ACTUALLY lands.
      for (const b of labelBoxes) if (cx > b.x - 14 && cx < b.x + b.w + 14 && cy > b.y - 12 && cy < b.y + b.h + 12) return true
      for (const w of washes) if (Math.abs(cx - w.labelX) < 150 && Math.abs(cy - w.labelY) < 26) return true
      return false
    }
    const out: React.JSX.Element[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = Math.round(c * CELL + CELL * 0.5 + (hash(c, r, seed ^ 1) - 0.5) * CELL * 0.7)
        const cy = Math.round(r * CELL + CELL * 0.5 + (hash(c, r, seed ^ 2) - 0.5) * CELL * 0.7)
        if (blocked(cx, cy)) continue
        const roll = hash(c, r, seed ^ 0x9e3779b9)
        const k = hash(c, r, seed ^ 7)
        const p = paletteAt(cx)
        const d = nearest(cx, cy)
        const region = washes.find((w) => w.palette === p)?.region.id ?? 'borderlands'
        if (d > 210) {
          if (roll < 0.62) out.push(mountain(cx, cy, k, p.ink, p.inkSoft))
          else if (roll < 0.8 && region === 'thornwood') out.push(tree(cx, cy, k, p.ink))
        } else if (region === 'thornwood') {
          if (roll < 0.55) out.push(tree(cx, cy, k * 0.6, p.ink))
          else if (roll < 0.7) out.push(tuft(cx, cy, p.inkSoft))
        } else if (region === 'ashfall') {
          if (roll < 0.35) out.push(cinder(cx, cy, p.ink))
          else if (roll < 0.5) out.push(mountain(cx, cy, k * 0.4, p.ink, p.inkSoft))
        } else if (roll < 0.22) out.push(tuft(cx, cy, p.inkSoft))
        else if (roll < 0.34) out.push(tree(cx, cy, k * 0.5, p.ink))
      }
    }
    return out
  }, [width, height, mapId, nodes, washes, labelBoxes, base])

  return (
    <div className="ow-sheet" style={{ width, height }} aria-hidden>
      <div className="ow-sheet__paper" style={{ background: `radial-gradient(120% 120% at 30% 20%, ${base.parchment.base} 0%, ${base.parchment.mid} 45%, ${base.parchment.deep} 100%)` }} />
      <div className="ow-sheet__grain" style={{ backgroundImage: GRAIN }} />
      <div className="ow-sheet__stains" style={{ backgroundImage: STAINS }} />
      <svg width={width} height={height} className="ow-sheet__ink" style={{ overflow: 'visible' }}>
        <defs>
          <filter id="owInkWobble" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {washes.map((w) => (
            <radialGradient key={w.region.id} id={`owWash-${w.region.id}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={w.palette.parchment.deep} stopOpacity={0.55} />
              <stop offset="70%" stopColor={w.palette.parchment.mid} stopOpacity={0.28} />
              <stop offset="100%" stopColor={w.palette.parchment.mid} stopOpacity={0} />
            </radialGradient>
          ))}
        </defs>
        {washes.map((w) => <ellipse key={`wash-${w.region.id}`} cx={w.cx} cy={w.cy} rx={w.rx} ry={w.ry} fill={`url(#owWash-${w.region.id})`} />)}
        <g filter="url(#owInkWobble)">{symbols}</g>
        {washes.map((w) => (
          <text key={`label-${w.region.id}`} x={w.labelX} y={w.labelY} textAnchor="middle" className="ow-sheet__region" fill={w.palette.ink} opacity={0.62}>
            {w.region.name}
          </text>
        ))}
        <rect x={16} y={16} width={width - 32} height={height - 32} fill="none" stroke={base.ink} strokeWidth={2} opacity={0.5} />
        <rect x={22} y={22} width={width - 44} height={height - 44} fill="none" stroke={base.ink} strokeWidth={0.8} opacity={0.4} />
        <g transform={`translate(${width - 84} 84)`} stroke={base.ink} fill={base.ink} opacity={0.7}>
          <circle r={26} fill="none" strokeWidth={1} />
          <circle r={20} fill="none" strokeWidth={0.6} opacity={0.6} />
          <path d="M0 -30 L5 0 L0 30 L-5 0 Z" stroke="none" />
          <path d="M-30 0 L0 -5 L30 0 L0 5 Z" fill={base.inkSoft} stroke="none" opacity={0.8} />
          <text y={-32} textAnchor="middle" fontSize={11} stroke="none" fill={base.ink} className="voice-display">N</text>
        </g>
      </svg>
      <div className="ow-sheet__vignette" />
    </div>
  )
}
