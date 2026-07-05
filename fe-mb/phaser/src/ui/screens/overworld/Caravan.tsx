import React, { useEffect, useRef, useState } from 'react'
import { samplePolyline, pointAtArcLength, type XY } from '../../../systems/overworldLayout'
import { edgePath, hashEdgeId } from './roadStyle'
import { regionPalette, type RegionPalette } from './palette'

interface Node {
  id: string
  position: { x: number; y: number }
}

/**
 * The party caravan / "you are here" token. Instead of a flat disc that
 * CSS-lerps the straight chord between nodes (cutting the corner of the bowed
 * road), this watches the current node id and, when it changes, walks the
 * ACTUAL road spline (same Bézier as OverworldRoads) at even arc-length speed
 * via rAF. It's a vertical banner with its own ground-contact ellipse + 2
 * trailing follower silhouettes, so it reads as "people standing/marching here".
 */
export function Caravan({
  nodes,
  currentNodeId,
  walkMs = 600,
  palette = regionPalette('borderlands'),
}: {
  nodes: Node[]
  currentNodeId: string
  walkMs?: number
  palette?: RegionPalette
}): React.JSX.Element | null {
  const prevRef = useRef<string>(currentNodeId)
  const polyRef = useRef<XY[]>([])
  const [f, setF] = useState(1) // 1 = settled at current node

  const here = nodes.find((n) => n.id === currentNodeId)?.position

  useEffect(() => {
    const prevId = prevRef.current
    prevRef.current = currentNodeId
    if (prevId === currentNodeId) return
    const a = nodes.find((n) => n.id === prevId)?.position
    const b = nodes.find((n) => n.id === currentNodeId)?.position
    if (!a || !b) {
      setF(1)
      return
    }
    polyRef.current = samplePolyline(edgePath(a, b, hashEdgeId(prevId, currentNodeId)), 28)
    let raf = 0
    let start = 0
    setF(0)
    const tick = (t: number): void => {
      if (!start) start = t
      const p = Math.min(1, (t - start) / walkMs)
      setF(p)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [currentNodeId, nodes, walkMs])

  if (!here) return null

  const walking = f < 1 && polyRef.current.length > 1
  const settled = f >= 1
  const main = walking ? pointAtArcLength(polyRef.current, f) : { p: here, angle: 0 }
  const bob = walking ? Math.sin(f * Math.PI * 8) * 1.5 : 0
  const followerAt = (off: number): XY =>
    walking ? pointAtArcLength(polyRef.current, Math.max(0, f - off)).p : here
  // While walking, ride the road spline. When SETTLED, step the banner BESIDE
  // the current disc (just outside its 46px ring) so the node's wax seal + sigil
  // stay visible instead of being covered by the "you are here" token.
  // -46 (was -38): seat the seal a touch further out so it TANGENTS the node's
  // 46px current-ring instead of clipping its upper-left arc, keeping the sigil
  // fully clear.
  const tokenLeft = settled ? here.x - 46 : main.p.x - 14
  const tokenTop = settled ? here.y - 26 : main.p.y - 20 + bob

  return (
    <>
      {/* trailing followers */}
      {[0.1, 0.19].map((off, i) => {
        const p = followerAt(off)
        return (
          <span
            key={i}
            aria-hidden
            className="absolute rounded-full pointer-events-none z-[19]"
            style={{
              left: p.x - 5,
              top: p.y - 7,
              width: 10,
              height: 12,
              background: 'rgba(45,30,18,0.6)',
              filter: 'blur(0.4px)',
            }}
          />
        )
      })}

      {/* the party banner token */}
      <div
        id="player-marker"
        className="absolute pointer-events-none z-20"
        style={{ left: tokenLeft, top: tokenTop, width: 28, height: 34 }}
      >
        {/* ground-contact ellipse */}
        <span
          aria-hidden
          className="absolute left-1/2 rounded-[50%]"
          style={{
            bottom: -4,
            width: 26,
            height: 9,
            transform: 'translateX(-50%)',
            background: 'radial-gradient(50% 50% at 50% 50%, rgba(60,38,18,0.45), transparent 75%)',
            filter: 'blur(1px)',
          }}
        />
        {/* pennant pole + disc head */}
        <span
          aria-hidden
          className="absolute"
          style={{ left: 13, top: 6, width: 2, height: 22, background: '#3a2613' }}
        />
        <span
          aria-hidden
          className="absolute"
          style={{
            left: 15,
            top: 6,
            width: 11,
            height: 8,
            background: palette.accent,
            clipPath: 'polygon(0 0, 100% 0, 70% 50%, 100% 100%, 0 100%)',
          }}
        />
        {/* the "you are here" seal — region wax-red, parchment rim, ember halo;
            a slow, shallow breathe (not a saturated GPS-pin pulse). */}
        <div
          className="absolute rounded-full"
          style={{
            left: 7,
            bottom: 0,
            width: 14,
            height: 14,
            background: palette.accent,
            border: '1.5px solid rgba(240,231,206,0.65)',
            boxShadow: '0 0 6px rgba(156,51,24,0.55)',
            animation: 'caravanSettlePulse 2.6s ease-in-out infinite',
          }}
        />
      </div>
      {/* Local keyframe: shallow scale (1→1.06), reduced-motion safe. Defined here
          so the seal's breathe stays self-contained to this component. */}
      <style>{`
        @keyframes caravanSettlePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="caravanSettlePulse"] { animation: none !important; }
        }
      `}</style>
    </>
  )
}
