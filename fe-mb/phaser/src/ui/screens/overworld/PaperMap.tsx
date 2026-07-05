import { useMemo, type ReactElement } from 'react'
import { biomeGrid, seedFromId } from './terrain'
import { regionPalette, type RegionPalette } from './palette'

/**
 * Antique parchment overworld: a hand-inked cartographer's map instead of photo
 * tiles. Reuses the deterministic biome grid to decide WHERE seas / forests /
 * mountains / plains sit, but draws them as ink symbols on aged paper. All ink
 * + parchment tones come from the region palette so region identity is a single
 * palette swap. Pure SVG + CSS — easy to author, deterministic from mapId.
 */

// small deterministic hash in [0,1)
function h(x: number, y: number, s: number): number {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2246822519)) >>> 0
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

// ── ink symbol builders (centred on cx,cy; ink colors passed by the sheet) ──
function tree(cx: number, cy: number, k: number, ink: string): ReactElement {
  const s = 7 + k * 4
  return (
    <g key={`t${cx}-${cy}`} stroke={ink} strokeWidth={1.1} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.85}>
      <path d={`M${cx} ${cy + s} L${cx} ${cy - s * 1.3}`} />
      <path d={`M${cx} ${cy - s * 1.3} L${cx - s * 0.8} ${cy} M${cx} ${cy - s * 1.3} L${cx + s * 0.8} ${cy}`} />
      <path d={`M${cx} ${cy - s * 0.4} L${cx - s} ${cy + s * 0.5} M${cx} ${cy - s * 0.4} L${cx + s} ${cy + s * 0.5}`} />
    </g>
  )
}
function mountain(cx: number, cy: number, k: number, ink: string, inkSoft: string): ReactElement {
  const w = 16 + k * 12, ht = 12 + k * 9
  return (
    <g key={`m${cx}-${cy}`} stroke={ink} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.9}>
      <path d={`M${cx - w} ${cy + ht * 0.4} L${cx - w * 0.2} ${cy - ht} L${cx + w * 0.5} ${cy + ht * 0.4}`} />
      <path d={`M${cx - w * 0.3} ${cy - ht * 0.55} l ${-3} ${5} m ${3} ${-5} l ${3} ${5}`} stroke={inkSoft} strokeWidth={0.8} />
      <path d={`M${cx + w * 0.1} ${cy + ht * 0.4} L${cx + w * 0.7} ${cy - ht * 0.7} L${cx + w * 1.2} ${cy + ht * 0.4}`} />
    </g>
  )
}
function wave(cx: number, cy: number, sea: string): ReactElement {
  return (
    <path key={`w${cx}-${cy}`} d={`M${cx - 11} ${cy} q5 -4 10 0 q5 4 10 0`} stroke={sea} strokeWidth={1} fill="none" strokeLinecap="round" opacity={0.55} />
  )
}
function tuft(cx: number, cy: number, inkSoft: string): ReactElement {
  return (
    <path key={`g${cx}-${cy}`} d={`M${cx - 3} ${cy} q1 -4 0 -6 M${cx} ${cy} q0 -5 0 -7 M${cx + 3} ${cy} q-1 -4 0 -6`} stroke={inkSoft} strokeWidth={0.9} fill="none" strokeLinecap="round" opacity={0.5} />
  )
}

/**
 * Hand-inked location symbol for a node type, drawn centred on (0,0) in a ~38px
 * box. Rendered inside the node Pressable so it reads as a cartographer's mark.
 */
export function NodeMapSymbol({ type, tint }: { type: string; tint: string }): ReactElement {
  const common = { stroke: tint, strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  let inner: ReactElement
  switch (type) {
    case 'town':
    case 'village':
      inner = (
        <g {...common}>
          <path d="M-13 8 L-13 -2 L-7 -8 L-1 -2 L-1 8 Z" />
          <path d="M-1 8 L-1 1 L4 -4 L9 1 L9 8 Z" />
          <path d="M-7 -8 L-7 -13 L-4 -13 L-4 -10" fill={tint} />
        </g>
      )
      break
    case 'camp':
    case 'rest':
      inner = (
        <g {...common}>
          <path d="M-11 8 L0 -10 L11 8 Z" />
          <path d="M0 -10 L0 8 M-4 8 L0 0 L4 8" strokeWidth={1.1} />
          <path d="M0 -10 L5 -13 L5 -10" fill={tint} />
        </g>
      )
      break
    case 'dungeon':
    case 'cave':
      inner = (
        <g {...common}>
          <path d="M-13 8 L-5 -9 L2 -1 L8 -11 L13 8 Z" />
          <path d="M-3 8 a4 5 0 0 1 8 0 Z" fill={tint} />
        </g>
      )
      break
    case 'boss':
    case 'fortress':
      inner = (
        <g {...common}>
          <path d="M-11 9 L-11 -4 L-7 -4 L-7 -8 L-3 -8 L-3 -4 L3 -4 L3 -8 L7 -8 L7 -4 L11 -4 L11 9 Z" />
          <path d="M-3 9 L-3 2 L3 2 L3 9" />
        </g>
      )
      break
    case 'battle':
    case 'combat':
      inner = (
        <g {...common}>
          <path d="M-9 -9 L7 8 M9 -9 L-7 8" />
          <path d="M-11 -7 L-7 -11 M11 -7 L7 -11" strokeWidth={2.2} />
        </g>
      )
      break
    case 'exit':
    case 'gate':
      inner = (
        <g {...common}>
          <path d="M-9 9 L-9 -5 a9 9 0 0 1 18 0 L9 9" />
          <path d="M-3 9 L-3 0 L3 0 L3 9" strokeWidth={1.1} />
        </g>
      )
      break
    case 'shrine': // a standing-stone / obelisk with a notched top
      inner = (
        <g {...common}>
          <path d="M-5 9 L-4 -8 L4 -8 L5 9 Z" />
          <path d="M-4 -8 L-2 -12 L2 -12 L4 -8" />
          <path d="M-2 -12 L0 -10 L2 -12" strokeWidth={1.1} />
          <path d="M-7 9 L7 9" strokeWidth={1.1} />
        </g>
      )
      break
    case 'bridge': // a low arch spanning two banks
      inner = (
        <g {...common}>
          <path d="M-13 4 a13 13 0 0 1 26 0" />
          <path d="M-13 4 L-13 9 M13 4 L13 9" strokeWidth={1.1} />
          <path d="M-9 1 L-9 5 M0 -2 L0 4 M9 1 L9 5" strokeWidth={0.9} />
        </g>
      )
      break
    case 'waypoint': // explicit generic mark: dot + ring (same as default)
      inner = (
        <g {...common}>
          <circle r={5} fill={tint} stroke="none" />
          <circle r={9} strokeWidth={1.1} />
        </g>
      )
      break
    default: // settlement dot + ring (generic map mark)
      inner = (
        <g {...common}>
          <circle r={5} fill={tint} stroke="none" />
          <circle r={9} strokeWidth={1.1} />
        </g>
      )
  }
  return <svg viewBox="-20 -20 40 40" width={34} height={34} style={{ overflow: 'visible', position: 'relative', zIndex: 1 }}>{inner}</svg>
}

export function PaperMap({
  width,
  height,
  mapId,
  palette = regionPalette('borderlands'),
  nodes,
}: {
  width: number
  height: number
  mapId: string
  palette?: RegionPalette
  /** Node centers, so terrain decoration never scatters over discs/labels. */
  nodes?: { position: { x: number; y: number } }[]
}): ReactElement {
  const symbols = useMemo(() => {
    const seed = seedFromId(mapId)
    const CELL = 76
    const cols = Math.ceil(width / CELL) + 1
    const rows = Math.ceil(height / CELL) + 1
    const grid = biomeGrid(cols, rows, seed)
    const pts = nodes ?? []
    // A decoration is rejected if it would collide with a node disc (≤42px) or
    // sit inside that node's label box (x ± 80, y+24…y+50), or clip the seam
    // (y < 28). Keeps the cartography legible behind the interactive marks.
    const blocked = (cx: number, cy: number): boolean => {
      if (cy < 28) return true
      for (const n of pts) {
        const nx = n.position.x
        const ny = n.position.y
        const dx = cx - nx
        const dy = cy - ny
        if (dx * dx + dy * dy < 42 * 42) return true
        if (cx > nx - 80 && cx < nx + 80 && cy > ny + 24 && cy < ny + 50) return true
      }
      return false
    }
    const out: ReactElement[] = []
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const b = grid[r]![c]!
      const roll = h(c, r, seed ^ 0x9e3779b9)
      const cx = c * CELL + CELL * 0.5 + (h(c, r, seed ^ 1) - 0.5) * CELL * 0.6
      const cy = r * CELL + CELL * 0.5 + (h(c, r, seed ^ 2) - 0.5) * CELL * 0.6
      if (blocked(cx, cy)) continue
      const k = h(c, r, seed ^ 7)
      if (b === 'water') { if (roll < 0.85) out.push(wave(cx, cy, palette.sea)) }
      else if (b === 'stone') { if (roll < 0.8) out.push(mountain(cx, cy, k, palette.ink, palette.inkSoft)) }
      else if (b === 'grass') { if (roll < 0.7) out.push(tree(cx, cy, k, palette.ink)) }
      else if (roll < 0.16) out.push(tuft(cx, cy, palette.inkSoft)) // dirt = plains, sparse tufts
    }
    return out
  }, [width, height, mapId, palette, nodes])

  return (
    <div className="absolute top-0 left-0 pointer-events-none" style={{ width, height }} aria-hidden>
      {/* aged parchment base — region-tinted */}
      <div
        className="absolute inset-0"
        style={{
          background:
            `radial-gradient(120% 120% at 30% 20%, ${palette.parchment.base} 0%, ${palette.parchment.mid} 45%, ${palette.parchment.deep} 100%),` +
            'radial-gradient(60% 50% at 78% 75%, rgba(150,110,60,0.18), transparent 70%)',
        }}
      />
      {/* paper grain + faint blotches via fractal noise */}
      <div
        className="absolute inset-0 mix-blend-multiply opacity-[0.18]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.45 0 0 0 0 0.33 0 0 0 0 0.18 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          backgroundSize: '300px 300px',
        }}
      />
      {/* large soft stains */}
      <div
        className="absolute inset-0 mix-blend-multiply opacity-40"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='600'><filter id='b'><feTurbulence type='fractalNoise' baseFrequency='0.006 0.008' numOctaves='3' seed='11'/><feColorMatrix values='0 0 0 0 0.4 0 0 0 0 0.28 0 0 0 0 0.14 0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23b)'/></svg>\")",
          backgroundSize: 'cover',
        }}
      />
      {/* ink terrain symbols + cartographic frame */}
      <svg width={width} height={height} className="absolute inset-0" style={{ overflow: 'visible' }}>
        {symbols}
        {/* decorative double border inset into the sheet */}
        <rect x={16} y={16} width={width - 32} height={height - 32} fill="none" stroke={palette.ink} strokeWidth={2} opacity={0.5} />
        <rect x={22} y={22} width={width - 44} height={height - 44} fill="none" stroke={palette.ink} strokeWidth={0.8} opacity={0.4} />
        {/* compass rose, top-right */}
        <g transform={`translate(${width - 84} 84)`} stroke={palette.ink} fill={palette.ink} opacity={0.7}>
          <circle r={26} fill="none" strokeWidth={1} />
          <circle r={20} fill="none" strokeWidth={0.6} opacity={0.6} />
          <path d="M0 -30 L5 0 L0 30 L-5 0 Z" fill={palette.ink} stroke="none" />
          <path d="M-30 0 L0 -5 L30 0 L0 5 Z" fill={palette.inkSoft} stroke="none" opacity={0.8} />
          <text y={-32} textAnchor="middle" fontSize={11} stroke="none" fill={palette.ink} className="voice-display">N</text>
        </g>
      </svg>
      {/* aged darkened edges — the viewport crops the sheet, so this burnt/worn
          vignette only reads at sheet ends (edge of charted territory) */}
      <div
        className="absolute inset-0"
        style={{ boxShadow: 'inset 0 0 120px 30px rgba(90,55,20,0.32), inset 0 0 30px 6px rgba(60,35,12,0.28)' }}
      />
    </div>
  )
}
