import React, { useMemo } from 'react'
import { regionPalette } from './palette'
import {
  BAND_DESIGN_H,
  SILHOUETTE_TILE_W,
  emberMotes,
  fogTextureUri,
  groundPropsTile,
  silhouetteTile,
  type SilhouetteTile,
} from './bandArt'
import './overworld-band.css'

/**
 * The Oregon-Trail travel band (split-view spec 2026-06-12): a fixed,
 * purely decorative side-view landscape strip across the top of the
 * overworld. The party caravan stands on a road at x≈400 while parallax
 * scenery (baked vista → silhouette treeline → ground props) scrolls past
 * it whenever `traveling` is true; idle freezes everything except the
 * lantern flicker and a breathing bob. `direction` flips the scroll AND
 * mirrors the caravan so westward legs read correctly.
 *
 * Nothing in here is interactive — the whole tree is aria-hidden and the
 * content layer is pointer-events-none (the root itself stays a plain
 * positioned box so the integrator can stack HUD chrome around it).
 * All motion is CSS keyframes in overworld-band.css, toggled by the
 * `.is-traveling` / `.is-westward` classes — no rAF.
 */

/** Baked painterly vistas (1536x512 plates) — the band's far layer. */
const BACKDROPS: Record<string, string> = {
  borderlands: '/art/backdrops/borderlands.png',
  thornwood: '/art/backdrops/thornwood.png',
  ashfall: '/art/backdrops/ashfall.png',
}

/** Wheels read as weathered timber (not copper): the silhouette ink warmed a
 *  shade toward dark wood so the spoke rotation reads without going metallic. */
const wheelTone = (silhouette: string): string =>
  `color-mix(in srgb, ${silhouette} 82%, #4a3826 18%)`

/** The caravan rig is authored in a 200x110 box with its ground line at
 *  y=100, then rendered at 0.85 scale → ~170x94 on screen (spec: ~150x80). */
const RIG_W = 200
const RIG_H = 110
const RIG_GROUND_Y = 100
const RIG_SCALE = 0.85
/** Feet-on-road anchor: x≈400, baseline lifted onto the upper wheel-rut
 *  (~band y≈233) so the rig sits ON the track instead of in the dark soil. */
const CARAVAN_X = 400
const ROAD_BASELINE_FROM_BOTTOM = 31

/**
 * One spoked wagon wheel: rim + 6 spokes + hub, rotating about its own
 * center while traveling. Durations approximate rolling contact with the
 * 80px/s ground layer (2πr at rig scale): rear ≈0.85s, front ≈0.72s —
 * passed in as an inline animation-duration override.
 */
function Wheel({ cx, cy, r, dur, tone }: { cx: number; cy: number; r: number; dur: string; tone: string }): React.JSX.Element {
  const spokes: React.JSX.Element[] = []
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3
    spokes.push(
      <line
        key={k}
        x1={cx}
        y1={cy}
        x2={cx + Math.cos(a) * (r - 1)}
        y2={cy + Math.sin(a) * (r - 1)}
        stroke={tone}
        strokeWidth={1.6}
      />,
    )
  }
  return (
    <g className="band-wheel" style={{ transformOrigin: `${cx}px ${cy}px`, animationDuration: dur }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={tone} strokeWidth={2.6} />
      {spokes}
      <circle cx={cx} cy={cy} r={2.2} fill={tone} />
    </g>
  )
}

/**
 * The hero: a near-black silhouette of a draft horse pulling a covered
 * wagon, two cloaked figures walking behind, a flickering lantern on the
 * front bow. Leg groups pivot from the hip (transform-origin in viewBox
 * px), wheels spin, walkers bob — all keyed off `.is-traveling` upstream.
 */
function CaravanRig({ silhouette }: { silhouette: string }): React.JSX.Element {
  const tone = wheelTone(silhouette)
  return (
    <svg
      width={RIG_W * RIG_SCALE}
      height={RIG_H * RIG_SCALE}
      viewBox={`0 0 ${RIG_W} ${RIG_H}`}
      style={{ overflow: 'visible', display: 'block' }}
    >
      {/* ground-contact shadows pooled ON the road track (cy≈99.5), kept faint
          so the rig sits on the carriageway rather than casting a hard hole */}
      <ellipse cx={74} cy={99.5} rx={46} ry={4} fill="#000" opacity={0.2} style={{ filter: 'blur(2.5px)' }} />
      <ellipse cx={156} cy={99.5} rx={28} ry={3.6} fill="#000" opacity={0.2} style={{ filter: 'blur(2px)' }} />
      <ellipse cx={16} cy={99.5} rx={14} ry={2.4} fill="#000" opacity={0.2} style={{ filter: 'blur(1.5px)' }} />
      {/* crisper, darker contact directly under the horse's hooves (rear ~x132,
          front ~x163) so the horse lands on the road as firmly as the wheels do
          — the soft blurred pool above alone read as floaty against dark bands */}
      <ellipse cx={133} cy={99.3} rx={11} ry={2} fill="#000" opacity={0.34} style={{ filter: 'blur(0.6px)' }} />
      <ellipse cx={163} cy={99.3} rx={11} ry={2} fill="#000" opacity={0.34} style={{ filter: 'blur(0.6px)' }} />

      {/* draft horse — legs first so the hips tuck under the barrel */}
      <g fill={silhouette}>
        <g className="band-leg-front" style={{ transformOrigin: '162px 72px' }}>
          <path d="M158 70 L156 84 L154 98.5 L158 99.5 L161 86 L164 72 Z" />
          <path d="M166 71 L165 85 L164 98.5 L168 99.5 L170 86 L171 73 Z" opacity={0.78} />
        </g>
        <g className="band-leg-rear" style={{ transformOrigin: '134px 73px' }}>
          <path d="M130 71 L127 84 L124 98 L128 99 L132 86 L136 73 Z" />
          <path d="M138 72 L137 85 L135 98 L139 99 L142 86 L144 74 Z" opacity={0.78} />
        </g>
        {/* barrel */}
        <path d="M127 57 C122 61 120 68 124 73 C128 78 136 80 146 80 C156 80 164 78 169 73 C174 68 174 60 169 56 C162 50 136 50 127 57 Z" />
        {/* arched neck, head dipped a touch, ear notch */}
        <path d="M156 62 C161 53 166 46 172 41 C176 37 182 35 185 38 C187 40 187 43 185 45 L188 44 L186 48 C190 50 194 54 194 58 C194 62 190 63 186 61 C182 60 178 58 175 60 C171 63 168 66 163 69 Z" />
        {/* tail */}
        <path d="M122 58 C117 60 114 68 113 78 C115 76 118 72 120 68 C119 74 119 79 121 83 C123 77 125 70 126 64 Z" />
      </g>

      {/* covered wagon: canvas bonnet over a tapered wooden body. Body right
          edge pushed out to x≈119 so it closes the gap to the harness. */}
      <g>
        <path d="M33 61 C33 38 48 28 74 28 C100 28 115 38 115 61 Z" fill={silhouette} />
        <path d="M34 60 L118 60 L115 79 L37 79 Z" fill={silhouette} />
        <Wheel cx={58} cy={87} r={13} dur="0.85s" tone={tone} />
        <Wheel cx={97} cy={89} r={11} dur="0.72s" tone={tone} />
      </g>

      {/* lantern hung off the FRONT BOW (clear of the wagon↔horse gap): an
          L-bracket reaching up-forward, a real lantern body, a tight
          screen-blend glow (flickers in both states) and a warm hearth dot */}
      <g>
        <path d="M113 32 L120 36 L120 42" stroke={silhouette} strokeWidth={1.4} fill="none" />
        <circle
          className="band-lantern band-loop"
          cx={115}
          cy={54}
          r={7}
          fill="var(--color-hearth, #e8a93a)"
          opacity={0.55}
          style={{ filter: 'blur(3px)', mixBlendMode: 'screen' }}
        />
        {/* lantern body: a ~4x6 rounded-rect cage in silhouette ink */}
        <rect x={113} y={50} width={4} height={6} rx={1.4} fill={silhouette} />
        <circle cx={115} cy={53} r={1.6} fill="var(--color-hearth, #e8a93a)" />
      </g>

      {/* hitch — make the wagon↔horse connection visible: two harness shafts
          + a withers strap. Drawn AFTER the glow so it reads as foreground. */}
      <g fill={silhouette}>
        <path d="M104 62 L150 63 L150 66 L104 65.4 Z" />
        <path d="M104 69.5 L148 70.5 L148 73 L104 72.5 Z" />
      </g>
      <line x1={150} y1={62} x2={156} y2={59} stroke={silhouette} strokeWidth={1.6} />

      {/* two walking figures behind the wagon (head + cloaked body) */}
      <g fill={silhouette}>
        <g className="band-walker">
          <circle cx={22} cy={70} r={3.6} />
          <path d="M22 73 C18 75 16 82 15 90 L14 99 L19 99 L21 91 L23 99 L28 99 L27 89 C26 81 25 75 22 73 Z" />
        </g>
        <g className="band-walker band-walker-late" opacity={0.9}>
          <circle cx={9} cy={74} r={3.2} />
          <path d="M9 77 C6 79 4 85 4 92 L3 99 L8 99 L9 92 L11 99 L15 99 L14 90 C13 83 12 79 9 77 Z" />
        </g>
      </g>
    </svg>
  )
}

/**
 * One scrolling row of mid-layer silhouette tiles. Rendered fully OPAQUE: the
 * baked vista must not bleed through, so atmospheric perspective lives in the
 * pre-mixed `fill` colour (a fog-tinted silhouette) rather than in alpha. The
 * front row renders the region embers (ashfall crag vents) as screen-blend
 * glow dots riding the rock; the back row is the half-tile-offset depth copy.
 * `fillAlt` paints the ashfall alternate-lightness crags (`tile.dAlt`).
 */
function SilhouetteStrip({
  tile,
  copies,
  fill,
  fillAlt,
  ember,
  leftOffset,
}: {
  tile: SilhouetteTile
  copies: number
  fill: string
  fillAlt: string
  ember: string
  leftOffset: number
}): React.JSX.Element {
  return (
    <div
      className="band-mid-strip band-scroll band-anim-travel absolute bottom-0 flex"
      style={{ left: leftOffset, width: copies * SILHOUETTE_TILE_W, height: BAND_DESIGN_H }}
    >
      {Array.from({ length: copies }, (_, i) => (
        <svg
          key={i}
          width={SILHOUETTE_TILE_W}
          height={BAND_DESIGN_H}
          viewBox={`0 0 ${SILHOUETTE_TILE_W} ${BAND_DESIGN_H}`}
          style={{ display: 'block', flex: 'none' }}
        >
          <path d={tile.d} fill={fill} />
          {tile.dAlt !== '' && <path d={tile.dAlt} fill={fillAlt} />}
          {ember !== '' && tile.embers.length > 0 && (
            <g style={{ mixBlendMode: 'screen' }}>
              {tile.embers.map((e, j) => (
                <g key={j}>
                  <circle cx={e.x} cy={e.y} r={e.r * 3.2} fill={ember} opacity={0.32} style={{ filter: 'blur(2.5px)' }} />
                  <circle cx={e.x} cy={e.y} r={e.r} fill={ember} opacity={0.95} />
                </g>
              ))}
            </g>
          )}
        </svg>
      ))}
    </div>
  )
}

export function TravelBand({
  regionId,
  traveling,
  direction,
  journey = null,
  arrivalName = null,
  width = 1280,
  height = 264,
}: {
  regionId: string
  traveling: boolean
  direction: 1 | -1
  /** Bottom-right plaque: where the party is bound + hops remaining. */
  journey?: { nextName: string; hopsLeft: number } | null
  /** When it flips non-null, a destination flourish fades through the band. */
  arrivalName?: string | null
  width?: number
  height?: number
}): React.JSX.Element {
  const pal = regionPalette(regionId)
  const backdrop = BACKDROPS[regionId] ?? '/art/backdrops/borderlands.png'

  // Far vista geometry: the plates are 1536x512 (exactly 3:1). Sizing a tile
  // by HEIGHT alone (3*height = 792 @ default) lets two mirror copies fit on a
  // 1280 stage at once → the landmark and its twin both show (Ashfall's second
  // volcano, Thornwood's doubled drip). Clamp each tile to be at least the band
  // WIDTH so a single landmark sits near screen-centre with its mirror off
  // screen; cover-crop (objectFit:cover + center bottom) keeps the horizon.
  const imgW = Math.max(width, Math.round((height * 1536) / 512))
  const farShiftPx = imgW * 2
  const farDurSec = farShiftPx / 8
  const farCount = Math.max(4, Math.ceil(width / imgW) + 2)

  // Mid-layer fills are PRE-MIXED (opaque): atmospheric perspective comes from
  // blending the silhouette ink toward the region fog, not from alpha — so the
  // baked vista can't double-expose through the rows. Thornwood keeps the front
  // row near-ink (only ~20% fog) so the trees stay a dark wall (#5).
  const fogMix = regionId === 'thornwood' ? 20 : 30
  const frontFill = `color-mix(in srgb, ${pal.silhouette} ${100 - fogMix}%, rgb(${pal.fog}) ${fogMix}%)`
  const backFill = `color-mix(in srgb, ${pal.silhouette} 45%, rgb(${pal.fog}) 55%)`
  // ashfall alternates crags ±6% lightness so the ridge doesn't read flat
  const frontFillAlt = `color-mix(in srgb, ${frontFill} 88%, #ffffff 12%)`
  const backFillAlt = `color-mix(in srgb, ${backFill} 88%, #ffffff 12%)`

  // Mid/ground tile copies per spec: ceil((width+640)/640)+1 — enough to
  // stay covered through a full 640px shift even with the back row's
  // half-tile offset.
  const tileCount = Math.ceil((width + SILHOUETTE_TILE_W) / SILHOUETTE_TILE_W) + 1

  const art = useMemo(
    () => ({
      front: silhouetteTile(regionId, 'front'),
      back: silhouetteTile(regionId, 'back'),
      props: groundPropsTile(regionId),
      motes: emberMotes(regionId),
      fogUri: fogTextureUri(regionPalette(regionId).fog),
    }),
    [regionId],
  )

  const rootClass = [
    'overworld-band',
    traveling ? 'is-traveling' : '',
    direction === -1 ? 'is-westward' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div aria-hidden className={rootClass} style={{ width, height, background: '#0a0705' }}>
      {/* keyed by region: swapping regionId remounts the content with a
          600ms band-fade-in over the dark root → cheap crossfade */}
      <div key={regionId} className="band-region absolute inset-0 overflow-hidden pointer-events-none">
        {/* (1) far vista: mirror-tiled [img, flipped, img, flipped] strip —
            seamless by construction, no edge matching needed */}
        <div
          className="band-far-strip band-scroll band-anim-travel absolute top-0 left-0 flex"
          style={
            {
              width: farCount * imgW,
              height: '100%',
              '--band-shift': `-${farShiftPx}px`,
              animationDuration: `${farDurSec}s`,
            } as React.CSSProperties
          }
        >
          {Array.from({ length: farCount }, (_, i) => (
            <img
              key={i}
              src={backdrop}
              alt=""
              draggable={false}
              decoding="async"
              style={{
                width: imgW,
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center bottom',
                flex: 'none',
                ...(i % 2 === 1 ? { transform: 'scaleX(-1)' } : {}),
              }}
            />
          ))}
        </div>
        {/* sky multiply wash (regions that want a moodier vista) */}
        {pal.skyTint !== '' && (
          <div className="absolute inset-0" style={{ background: pal.skyTint, mixBlendMode: 'multiply' }} />
        )}
        {/* thornwood-only: the baked plate has a laser-straight amber horizon
            wire (doubled by mirroring). Re-baking is GPU-blocked, so multiply a
            broken band across it (~band y 98-116) to chop the continuous line
            into segments. */}
        {regionId === 'thornwood' && (
          <div
            className="absolute left-0 w-full"
            style={{
              top: 98,
              height: 18,
              mixBlendMode: 'multiply',
              background:
                'linear-gradient(90deg, rgba(20,30,25,0.5) 0%, transparent 25%, rgba(20,30,25,0.45) 55%, transparent 80%, rgba(20,30,25,0.5) 100%)',
            }}
          />
        )}
        {/* ashfall-only: a smouldering horizon rim-light. The mirror-fix + fog
            mix drained the region's volcanic menace into flat haze; this puts a
            restrained molten glow back across the skyline (NOT the v2 full-bright
            red) so the land reads as scorched/active at a glance. Screen-blended,
            full-width and atmospheric so it doesn't detach from the volcano when
            the far strip scrolls. */}
        {regionId === 'ashfall' && (
          <div
            className="absolute left-0 w-full"
            style={{
              top: 28,
              height: 104,
              mixBlendMode: 'screen',
              background:
                'linear-gradient(90deg, rgba(150,44,22,0.14) 0%, rgba(186,56,28,0.30) 35%, rgba(214,78,38,0.36) 50%, rgba(186,56,28,0.30) 65%, rgba(150,44,22,0.14) 100%)',
            }}
          />
        )}

        {/* (2) mid silhouettes: OPAQUE depth row (fog-mixed lighter) offset half
            a tile, then the OPAQUE front row (near-ink). Atmospheric perspective
            is in the fill colour, not alpha, so the vista can't bleed through. */}
        <SilhouetteStrip
          tile={art.back}
          copies={tileCount}
          fill={backFill}
          fillAlt={backFillAlt}
          ember=""
          leftOffset={-SILHOUETTE_TILE_W / 2}
        />
        <SilhouetteStrip
          tile={art.front}
          copies={tileCount}
          fill={frontFill}
          fillAlt={frontFillAlt}
          ember={pal.ember}
          leftOffset={0}
        />

        {/* (3) ground strip y 204→264: soil gradient over the silhouette
            feet, the worn road track, then the scrolling props/ruts */}
        <div
          className="absolute left-0 bottom-0 w-full"
          style={{ height: 60, background: `linear-gradient(${pal.ground.top}, ${pal.ground.bottom})` }}
        />
        <div
          className="absolute left-0 w-full"
          style={{
            bottom: 20,
            height: 16,
            background: pal.ground.track,
            boxShadow: 'inset 0 1px 0 rgba(255,240,210,0.10), inset 0 -1px 0 rgba(0,0,0,0.35)',
          }}
        />
        <div
          className="band-ground-strip band-scroll band-anim-travel absolute left-0 bottom-0 flex"
          style={{ width: tileCount * SILHOUETTE_TILE_W, height: BAND_DESIGN_H }}
        >
          {Array.from({ length: tileCount }, (_, i) => (
            <svg
              key={i}
              width={SILHOUETTE_TILE_W}
              height={BAND_DESIGN_H}
              viewBox={`0 0 ${SILHOUETTE_TILE_W} ${BAND_DESIGN_H}`}
              style={{ display: 'block', flex: 'none' }}
            >
              {/* wavy wheel ruts — q-curve paths with varied dash; periods
                  divide 640 so the repeat is seamless */}
              <path
                d={art.props.ruts[0]}
                stroke="rgba(0,0,0,0.4)"
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={art.props.rutDashes[0]}
              />
              <path
                d={art.props.ruts[1]}
                stroke="rgba(0,0,0,0.4)"
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={art.props.rutDashes[1]}
                strokeDashoffset={11}
              />
              {/* stones seated with a darker bottom arc, grass tufts on top */}
              <path d={art.props.stoneBottoms} stroke="rgba(0,0,0,0.45)" strokeWidth={1} fill="none" />
              <path d={art.props.stones} fill={pal.ground.track} opacity={0.55} />
              <path d={art.props.tufts} stroke={pal.ground.track} strokeWidth={1.1} fill="none" strokeLinecap="round" opacity={0.85} />
            </svg>
          ))}
        </div>

        {/* (4) the caravan: outer box anchors feet-on-road; the mirror
            wrapper flips for westward travel; the inner bob layer swaps
            between gait and breathing in CSS */}
        <div
          className="absolute"
          style={{
            left: CARAVAN_X - (RIG_W * RIG_SCALE) / 2,
            bottom: ROAD_BASELINE_FROM_BOTTOM - (RIG_H - RIG_GROUND_Y) * RIG_SCALE,
            width: RIG_W * RIG_SCALE,
            height: RIG_H * RIG_SCALE,
          }}
        >
          {/* lantern light pooling on the road — seats the hero in its own
              pocket of warmth so it never melts into the scenery rows */}
          <div
            aria-hidden
            className="absolute"
            style={{
              left: '50%',
              bottom: -10,
              width: 190,
              height: 64,
              transform: 'translateX(-50%)',
              background:
                'radial-gradient(50% 50% at 50% 50%, rgba(232,169,58,0.22) 0%, rgba(232,169,58,0.08) 55%, transparent 78%)',
              mixBlendMode: 'screen',
            }}
          />
          <div style={{ width: '100%', height: '100%', ...(direction === -1 ? { transform: 'scaleX(-1)' } : {}) }}>
            <div className="band-caravan-bob" style={{ width: '100%', height: '100%' }}>
              <CaravanRig silhouette={pal.silhouette} />
            </div>
          </div>
        </div>

        {/* (5) atmosphere: region-tinted turbulence fog drifting past… */}
        <div
          className="band-fog band-scroll band-anim-travel absolute top-0 left-0"
          style={{
            width: width + 600,
            height: '100%',
            backgroundImage: `url("${art.fogUri}")`,
            backgroundSize: '600px 400px',
            backgroundRepeat: 'repeat',
            opacity: 0.2,
            mixBlendMode: 'screen',
          }}
        />
        {/* …ember motes (ashfall only) rising up-left on staggered loops… */}
        {pal.ember !== '' &&
          art.motes.map((m, i) => (
            <span
              key={i}
              className="band-ember band-anim-travel absolute rounded-full"
              style={{
                left: `${m.leftPct}%`,
                top: `${m.topPct}%`,
                width: m.size,
                height: m.size,
                background: pal.ember,
                boxShadow: `0 0 6px 1.5px ${pal.ember}66`,
                mixBlendMode: 'screen',
                animationDuration: `${m.durSec}s`,
                animationDelay: `${m.delaySec}s`,
              }}
            />
          ))}
        {/* …edge vignette — pulled toward the caravan (x≈400 / 31%) so the
            brightest values pool around the hero, not the empty middle */}
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(115% 140% at 31% 45%, transparent 52%, rgba(6,4,2,0.62) 100%)' }}
        />

        {/* (6) band journey info — both purely decorative. The bottom-right
            plaque names the destination + hops; the centred arrival flourish
            swells and fades when arrivalName flips non-null. */}
        {journey && (
          <div
            className="band-journey-plaque absolute"
            style={{
              right: 16,
              bottom: 20,
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(16,10,5,0.78)',
              border: '1px solid rgba(201,152,92,0.35)',
              color: 'var(--color-hearth-soft, #c98f2c)',
              fontSize: 12,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            {`→ ${journey.nextName} · ${journey.hopsLeft} hops`}
          </div>
        )}
        {arrivalName !== null && arrivalName !== '' && (
          <div
            key={arrivalName}
            className="band-arrival voice-display absolute"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'var(--color-hearth, #e8a93a)',
              fontSize: 44,
              textShadow: '0 2px 10px rgba(0,0,0,0.6)',
              whiteSpace: 'nowrap',
            }}
          >
            {arrivalName}
          </div>
        )}

        {/* a 1px dark line so the band meets the seam cleanly */}
        <div className="absolute left-0 bottom-0 w-full" style={{ height: 1, background: 'rgba(0,0,0,0.7)' }} />
      </div>
    </div>
  )
}
