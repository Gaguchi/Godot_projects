/**
 * ui/overworld/OverworldScreen.tsx — the map (ARCHITECTURE §4, BRIEF §2.9): the ledger band across the top (day,
 * company, faces with HP, gold, food, the open quest), the one open sheet below it under a camera that follows
 * the company unless the player has dragged it (`ui.mapPan`; `travel/goTo` resets it). Hovering a node draws the
 * path in wet ink and quotes the cost — hops · food · starvation — before the click; clicking dispatches
 * `travel/goTo` (a refused click shows its reason as a toast). Clicking the node the company is ALREADY on
 * re-enters it — no hop, no food, no day (BRIEF §2.9) — which is the only way back into a town the player said
 * "Stay" at. A camera pan that begins and ends over a node is a pan, never a click. The pawn walks hop by hop as
 * `run.nodeId` lands; the quick menu is a parchment card seated over the sheet at the node the company stands on.
 *
 * THE FRAME SAYS IT IS A FRAME. The sheet is 3060×850 behind a 1280×600 window, and the window used to end in a
 * hard vertical cut: "Cursed Clearing" printed as a bare "CUR", and nothing anywhere said the map could be moved
 * (RE-GATE C 3.20). Two things answer it, both properties of the FRAME rather than of one camera position — the
 * paper falls into shadow on every side that has more country behind it (`ow-edge`), and a name the window would
 * cut is not lettered at all, because §5.1's rule is that a name fits or it is a bug. A three-letter stump of a
 * place-name is neither a name nor a hint that there is more map; the shadow is the hint, and `ow-hint` says the
 * gesture in words for as long as the player has not yet used it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../../styles/overworld.css'
import { spriteIdFor } from '../../content/index'
import type { Action } from '../../engine/actions'
import { overlayOf } from '../../engine/flow/pump'
import { foodCount } from '../../engine/run/bag'
import { DESCENT_IS_ONE_WAY } from '../../engine/run/dungeon'
import { throneWarning } from '../../engine/run/travel'
import { adjacency, edgeKey, findPath, isNodeLocked, previewPath, refKey, visibleNodes } from '../../engine/run/overworld'
import { displayName, livingUnits } from '../../engine/run/party'
import { scoutedRoads, sightingFor, type Sighting } from '../../engine/run/scout'
import { questStatus } from '../../engine/run/quests'
import type { EngineEnv, GameState, OverworldNode } from '../../engine/types'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { companyName, initialsOf, mcName } from '../names'
import { useTip } from '../components/Tooltip'
import { BAND_TOP, STAGE_H, STAGE_W } from '../stage'
import { canDispatch, dispatch, shallow, useEnv, useGame, useLegal } from '../store'
import { HOP_DELAY_MS, motionEnabled } from '../timings'
import { planLabels, planRects, type LabelMark, type Rect } from './labels'
import { NodeMark, typeLabel, type NodeVisual } from './NodeMark'
import { regionPalette } from './palette'
import { Roads } from './Roads'
import { hashEdge } from './roadInk'
import { Sheet, regionWashes } from './Sheet'

const VIEW_W = STAGE_W
const VIEW_H = STAGE_H - BAND_TOP

/**
 * The seat of the first-time pan hint (`.ow-hint`), in VIEWPORT pixels — kept here because the cartographer's
 * plan is a property of the sheet and cannot know about a line of chrome pinned to the frame. Any name the hint
 * would sit on is not lettered while it is up, by the same rule that hides a name the frame's edge would slice.
 */
const HINT_SEAT = { x: VIEW_W - 366, y: VIEW_H - 100, w: 348, h: 44 } as const

/**
 * How wide a place-name will actually be lettered, in sheet pixels. The cartographer (`./labels.ts`) is pure and
 * takes this as an argument; here it is a real text metric from the same face and size the sheet prints, so the
 * plan is made against the name the player will read, not an estimate of it. The measurement is cached, and
 * discarded once the webfont has landed (before that Cinzel's metrics are Georgia's).
 */
const DISPLAY_FACE = '"Cinzel", "Trajan Pro", "Georgia", serif'
const widths = new Map<string, number>()
let pen: CanvasRenderingContext2D | null | undefined

/** `size` px of the display face, plus CSS `letter-spacing` (which rides after every letter, the last one too). */
function textWidth(text: string, size: number, trackingEm: number, perCharFallback: number): number {
  const key = `${size}|${trackingEm}|${text}`
  const hit = widths.get(key)
  if (hit !== undefined) return hit
  if (pen === undefined) pen = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  let w = text.length * perCharFallback
  if (pen !== null && pen !== undefined) {
    pen.font = `${size}px ${DISPLAY_FACE}`
    w = pen.measureText(text).width
  }
  w += text.length * size * trackingEm
  widths.set(key, w)
  return w
}
const measureLabel = (name: string): number => textWidth(name, 11, 0.05, 6.3)
/** The sheet also letters its region names at 30px; a place-name must not be printed across one. */
const measureRegion = (name: string): number => textWidth(name.toUpperCase(), 30, 0.3, 21)

/** Discard the measurements taken before the webfont landed — until then Cinzel measures as Georgia. */
function onFontsReady(cb: () => void): void {
  const fonts = (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts
  if (fonts === undefined) return
  void fonts.ready.then(() => { widths.clear(); cb() })
}

interface MapView {
  readonly nodeId: string
  readonly status: 'idle' | 'walking' | 'suspended' | 'atNode'
  readonly hop: { readonly from: string; readonly to: string } | null
  readonly pathLeft: readonly string[]
  readonly visited: Readonly<Record<string, true>>
  readonly spawned: Readonly<Record<string, true>>
  readonly unlocked: Readonly<Record<string, true>>
  readonly pan: { readonly x: number; readonly y: number } | null
  readonly menuOpen: boolean
  readonly mcSprite: string | null
  readonly mcName: string
}

const selectMap = (env: EngineEnv) => (s: GameState): MapView | null => {
  const run = s.run
  if (run === null) return null
  const t = run.pendingTravel
  const mc = run.party['mc']
  return {
    nodeId: run.nodeId,
    status: t?.status ?? 'idle',
    hop: t?.hop === null || t?.hop === undefined ? null : { from: t.hop.from, to: t.hop.to },
    pathLeft: t?.path ?? [],
    visited: run.visitedNodes,
    spawned: run.spawnedNodes,
    unlocked: run.unlockedNodes,
    pan: s.ui.mapPan,
    menuOpen: overlayOf(s)?.kind === 'quickMenu',
    mcSprite: mc === undefined ? null : spriteIdFor(mc.id, mc.classId),
    mcName: mc === undefined ? mcName(run.mcName, env) : displayName(mc, run),
  }
}

function clampCamera(x: number, y: number, sheetW: number, sheetH: number): { readonly x: number; readonly y: number } {
  return { x: Math.max(0, Math.min(sheetW - VIEW_W, x)), y: Math.max(0, Math.min(sheetH - VIEW_H, y)) }
}

/** Camera origin (sheet px at the viewport's top-left): follow the company, or the player's drag. */
function cameraFor(node: OverworldNode, pan: MapView['pan'], sheetW: number, sheetH: number): { readonly x: number; readonly y: number } {
  if (pan !== null) return clampCamera(pan.x, pan.y, sheetW, sheetH)
  return clampCamera(node.position.x - VIEW_W / 2, node.position.y - VIEW_H * 0.48, sheetW, sheetH)
}

function Verb({ action, label, variant = 'secondary', testId, lockedSigil = false }: { readonly action: Action; readonly label: string; readonly variant?: 'primary' | 'secondary' | 'ghost'; readonly testId?: string; readonly lockedSigil?: boolean }): React.JSX.Element {
  const legal = useLegal(action)
  return (
    <Button variant={variant} disabledReason={legal.ok ? null : legal.reason} onPress={() => dispatch(action)} {...(testId !== undefined ? { testId } : {})} style={{ fontSize: '0.78rem', padding: '0.45rem 1rem' }}>
      {lockedSigil && !legal.ok && <><Icon name="lock" size={13} /> </>}{label}
    </Button>
  )
}

/**
 * Where the node card is SEATED: at the place it names.
 *
 * It used to open pinned to the bottom centre of the stage whatever the player had clicked — measured at 562px
 * from the mark it was about, with three quarters of the map between the place and the panel naming it (RE-GATE C
 * 3.11). Now it hangs off the mark like a cartographer's note, with a notch pointing back at it: under the mark
 * when the mark is in the upper half of the viewport, over it (clear of the company token, which stands 80px
 * above the disc) when it is in the lower half. It is clamped so the whole card stays on the stage — the notch
 * carries the offset, so the card still points at the mark when the clamp has moved it.
 */
const CARD_HALF = 280
const CARD_ROOM = 210

export interface CardSeat {
  readonly style: React.CSSProperties
  readonly side: 'below' | 'above'
}

export function seatCard(node: { readonly x: number; readonly y: number }, camera: { readonly x: number; readonly y: number }, view = { w: VIEW_W, h: VIEW_H }): CardSeat {
  const cx = node.x - camera.x
  const cy = node.y - camera.y
  const left = Math.max(CARD_HALF + 10, Math.min(view.w - CARD_HALF - 10, cx))
  // the notch never leaves the card: 150 is a little inside half the 340px minimum width
  const tail = { ['--tail-dx' as string]: `${Math.max(-150, Math.min(150, Math.round(cx - left)))}px` }
  return cy < view.h * 0.5
    ? { side: 'below', style: { left, top: Math.max(10, Math.min(view.h - CARD_ROOM, cy + 48)), ...tail } }
    : { side: 'above', style: { left, bottom: Math.max(10, Math.min(view.h - CARD_ROOM, view.h - (cy - 88))), ...tail } }
}

/** The parchment card that opens when the company stands at a node with choices (overlay `quickMenu`). */
function NodeCard({ node, hopsLeft, seat }: { readonly node: OverworldNode; readonly hopsLeft: number; readonly seat: CardSeat }): React.JSX.Element {
  const env = useEnv()
  const region = env.content.regions[node.regionId]
  const throne = useGame(useCallback((s: GameState) => (s.run === null ? null : throneWarning(s.run, env)), [env]))
  return (
    <div className={`ow-card ow-card--${seat.side}`} style={seat.style} data-testid="node-card" role="dialog" aria-label={node.name}>
      <div className="ow-card__eyebrow">{region?.name ?? node.regionId} · {typeLabel(node.type)}</div>
      <div className="ow-card__title voice-display">{node.name}</div>
      {node.type === 'DUNGEON' && <p className="ow-card__warning" data-testid="dungeon-warning">{DESCENT_IS_ONE_WAY}</p>}
      {/* The last door gets the same treatment as the descent's mouth: who waits, and what is behind it — read
          BEFORE the verb, not after it (RE-GATE C 3.14). The sentence is derived from the node's own content. */}
      {throne !== null && <p className="ow-card__warning" data-testid="throne-warning">{throne}</p>}
      <div className="ow-card__verbs">
        {node.type === 'TOWN' && <Verb action={{ type: 'town/enter' }} label="Enter town" variant="primary" testId="menu-town" />}
        {node.type === 'CAMP' && <Verb action={{ type: 'camp/enter' }} label="Make camp" variant="primary" testId="menu-camp" />}
        {/* Sealed / cleared is NOT carried by the label: `isLegal` runs `canEnterDungeon` (0036), so the verb stays
            "Enter" and the refusal's own sentence ("... is sealed", "... is cleared") is the tooltip, under a lock. */}
        {node.type === 'DUNGEON' && <Verb action={{ type: 'dungeon/enter' }} label="Enter" variant="primary" testId="menu-dungeon" lockedSigil />}
        {node.type === 'BOSS' && <Verb action={{ type: 'travel/challengeBoss' }} label="Challenge the throne" variant="primary" testId="menu-boss" />}
        {hopsLeft > 0 && <Verb action={{ type: 'travel/continue' }} label={`Press on · ${hopsLeft} ${hopsLeft === 1 ? 'hop' : 'hops'} left`} variant={node.type === 'TRAIL' || node.type === 'DISCOVERY' ? 'primary' : 'secondary'} testId="menu-continue" />}
        <Verb action={{ type: 'travel/stay' }} label={hopsLeft > 0 ? 'Halt here' : 'Stay'} variant="ghost" testId="menu-stay" />
      </div>
    </div>
  )
}

interface BandView {
  readonly day: number
  readonly company: string
  readonly gold: number
  readonly food: number
  readonly faces: readonly { readonly id: string; readonly name: string; readonly sprite: string | null; readonly hp: number; readonly max: number }[]
  readonly quest: string | null
  /** Hops still to walk, while the company is on the road; null when it is standing somewhere. */
  readonly road: number | null
}

/** One portrait in the band. The name is under it in full; the tip carries the HP the bar can only approximate. */
function Face({ face }: { readonly face: BandView['faces'][number] }): React.JSX.Element {
  const ratio = face.max <= 0 ? 0 : face.hp / face.max
  const tier = ratio <= 0.25 ? 'var(--hp-crit)' : ratio <= 0.5 ? 'var(--hp-warn)' : 'var(--hp-ok)'
  const { tipRef, tipProps, tip } = useTip(`${face.name} · ${face.hp}/${face.max}`, false)
  return (
    <>
      <div ref={tipRef} className="ow-face" {...tipProps}>
        <div className="ow-face__frame">{face.sprite !== null ? <img src={`/sprites/units/${face.sprite}.png`} alt="" draggable={false} /> : initialsOf(face.name)}</div>
        <div className="ow-face__hp"><i style={{ width: `${Math.round(ratio * 100)}%`, background: tier }} /></div>
        <div className="ow-face__name">{face.name}</div>
      </div>
      {tip}
    </>
  )
}

/** The active contract, one line. It is a title, not player prose, so it may clip — with the full name on the glass. */
function Quest({ name }: { readonly name: string }): React.JSX.Element {
  const { tipRef, tipProps, tip } = useTip(name, false)
  return (
    <>
      <div ref={tipRef} className="ow-band__quest" {...tipProps}><Icon name="bullet" size={10} filled /> {name}</div>
      {tip}
    </>
  )
}

/** Supplies. The number is the reading; the cost of the next hop is the tip. */
function FoodStat({ food, low, note }: { readonly food: number; readonly low: boolean; readonly note: string }): React.JSX.Element {
  const { tipRef, tipProps, tip } = useTip(note, false)
  return (
    <>
      <div ref={tipRef} className="ow-band__stat" {...tipProps}>
        <span className="ow-band__eyebrow">Food</span>
        <span className={`numeral ow-band__num${low ? ' ow-band__num--low' : ''}`} aria-label={note} data-testid="band-food">
          {low && <Icon name="food" size={13} />}{food}
        </span>
      </div>
      {tip}
    </>
  )
}

function Band(): React.JSX.Element {
  const env = useEnv()
  const select = useCallback((s: GameState): BandView | null => {
    const run = s.run
    if (run === null) return null
    const quest = Object.keys(run.questStates).map((id) => ({ id, def: env.content.quests[id] })).find((q) => q.def !== undefined && questStatus(run, q.id) === 'active')
    const t = run.pendingTravel
    return {
      day: run.daysElapsed,
      company: companyName(run.companyName),
      gold: run.gold,
      food: foodCount(run.bag, env),
      faces: livingUnits(run).map((u) => ({ id: u.id, name: displayName(u, run), sprite: spriteIdFor(u.id, u.classId), hp: u.hp.current, max: u.hp.max })),
      quest: quest?.def?.name ?? null,
      // `path` still holds the leg in flight (travelStep only shifts on LAND), so it IS the count of hops to go.
      road: t !== null && (t.status === 'walking' || t.status === 'suspended') ? t.path.length : null,
    }
  }, [env])
  const view = useGame(select, (a, b) => JSON.stringify(a) === JSON.stringify(b))
  if (view === null) return <div className="ow-band" />
  // Colour is never the sole channel (BRIEF §5 rule 4): low supplies also get a sigil and say the cost out loud.
  const lowFood = view.food <= env.rules.travel.lowFoodWarnAt
  const foodNote = view.food === 0
    ? `no rations — the next hop costs every unit ${env.rules.travel.starvationDamage} HP`
    : lowFood ? `${view.food} ${view.food === 1 ? 'ration' : 'rations'} left — ${env.rules.travel.foodPerHop} a hop` : `${view.food} rations`
  return (
    <div className="ow-band" data-testid="ledger-band">
      <div className="ow-band__block">
        <div className="ow-band__eyebrow">Day</div>
        <div className="ow-band__big numeral">{view.day}</div>
      </div>
      <div className="ow-band__block ow-band__block--company">
        <div className="ow-band__eyebrow">Company</div>
        {/* the banner and the names under the portraits are AUTHORED BY THE PLAYER — they wrap rather than
            ellipsise, because "The Found…" is the game losing a name the player chose (GATE2-12) */}
        <div className="ow-band__company voice-display">{view.company}</div>
        {/* Where the company IS belongs in the ledger, not parked over the sheet: the walking line used to be a
            pill pinned to the top centre of the map, covering a node mark for the whole journey and butting into
            that node's name (RE-GATE B 2.6 — crafting-game-ui signal E, chrome over the world). */}
        {view.road !== null && <div className="ow-band__road" data-testid="walking">On the road · <b className="numeral">{view.road}</b> {view.road === 1 ? 'hop' : 'hops'} to go</div>}
        {view.quest !== null && <Quest name={view.quest} />}
      </div>
      <div className="ow-band__faces" aria-label="Party">
        {view.faces.map((f) => <Face key={f.id} face={f} />)}
      </div>
      <div className="ow-band__block ow-band__block--right">
        <div className="ow-band__stat"><span className="ow-band__eyebrow">Gold</span><span className="numeral ow-band__num">{view.gold}</span></div>
        <FoodStat food={view.food} low={lowFood} note={foodNote} />
      </div>
      <div className="ow-band__block ow-band__block--verbs">
        <Button variant="secondary" onPress={() => dispatch({ type: 'ui/openModal', modal: { kind: 'loadout', unitId: null } })} testId="band-company" style={{ fontSize: '0.72rem', padding: '0.4rem 0.8rem' }}>Company</Button>
        <Button variant="secondary" onPress={() => dispatch({ type: 'ui/openModal', modal: { kind: 'questLog' } })} testId="band-quests" style={{ fontSize: '0.72rem', padding: '0.4rem 0.8rem' }}>Contracts</Button>
        <Button variant="ghost" onPress={() => dispatch({ type: 'ui/openModal', modal: { kind: 'pause' } })} testId="band-menu" style={{ fontSize: '0.72rem', padding: '0.4rem 0.8rem' }}><span className="keycap">Esc</span> Menu</Button>
      </div>
    </div>
  )
}

export function OverworldScreen(): React.JSX.Element | null {
  const env = useEnv()
  const view = useGame(useMemo(() => selectMap(env), [env]), shallow)
  const world = env.content.overworld
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ readonly x: number; readonly y: number; readonly camX: number; readonly camY: number; readonly moved: boolean } | null>(null)
  const [liveCam, setLiveCam] = useState<{ readonly x: number; readonly y: number } | null>(null)
  /** Has the player moved the sheet yet? Component-local and ephemeral by design: the hint that teaches the one
   *  gesture this map has is a FIRST-TIME teach, and `ui.mapPan` returns to null on every hop, so reading it would
   *  put the lesson back on the glass after every leg of the journey. */
  const [hasPanned, setHasPanned] = useState(false)
  const toastTimer = useRef<number | null>(null)
  // `pointerup` clears `drag` BEFORE the synthetic click runs, so the click handler cannot read it: the verdict is
  // parked here for exactly one click (BRIEF §10: "a drag < 8px is a click; one drag never latches later clicks").
  const suppressClick = useRef(false)

  useEffect(() => () => { if (toastTimer.current !== null) window.clearTimeout(toastTimer.current) }, [])

  const run = useGame((s) => s.run)
  const spawned = run?.spawnedNodes
  const nodes = useMemo(() => (run === null ? [] : visibleNodes(run, env)), [run, spawned, env])
  const washes = useMemo(() => regionWashes(world.nodes, Object.values(env.content.regions)), [world.nodes, env.content.regions])
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n] as const)), [nodes])

  // Where every place-name is lettered. Worked out once over the WHOLE sheet (marks, roads and the region titles
  // are all obstacles, a mark's own road included), so no name is struck through or painted over at ANY camera
  // position — the old per-camera nudge only kept names out of the viewport's gutter (GATE2-4, GATE3-10).
  const [fontEpoch, setFontEpoch] = useState(0)
  useEffect(() => { onFontsReady(() => setFontEpoch((e) => e + 1)) }, [])
  const labelMarks = useMemo<readonly LabelMark[]>(() => nodes.map((n) => ({ id: n.id, name: n.name, position: n.position })), [nodes])
  const labelPlan = useMemo(() => {
    const pos = new Map(nodes.map((n) => [n.id, n.position] as const))
    const roads = world.edges.flatMap((e) => {
      const a = pos.get(e.from)
      const b = pos.get(e.to)
      return a === undefined || b === undefined ? [] : [{ from: a, to: b, hash: hashEdge(e.from, e.to) }]
    })
    const reserved: readonly Rect[] = washes.map((w) => {
      const width = measureRegion(w.region.name)
      return { x: w.labelX - width / 2, y: w.labelY - 26, w: width, h: 34 }
    })
    return planLabels({ marks: labelMarks, roads, reserved, sheet: { width: world.width, height: world.height }, measure: measureLabel })
    // fontEpoch re-runs the plan once the display face has actually loaded and the metrics are true.
  }, [nodes, labelMarks, washes, world, fontEpoch])
  const labelBoxes = useMemo(() => planRects(labelMarks, labelPlan, measureLabel), [labelMarks, labelPlan, fontEpoch])

  const currentNode = view === null ? null : byId.get(view.nodeId) ?? null
  const reachable = useMemo(() => new Set(run === null || view === null || view.status !== 'idle' ? [] : adjacency(run, env)[view.nodeId] ?? []), [run, view, env])

  // hover: the path in wet ink + its cost
  const hoverPath = useMemo(() => (run === null || hoverId === null || hoverId === run.nodeId ? null : findPath(run, hoverId, env)), [run, hoverId, env])
  const hoverPreview = useMemo(() => (run === null || hoverId === null || hoverId === run.nodeId ? null : previewPath(run, hoverId, env)), [run, hoverId, env])
  const hoverKeys = useMemo(() => {
    const keys = new Set<string>()
    if (run === null || hoverPath === null) return keys
    let prev = run.nodeId
    for (const id of hoverPath) { keys.add(edgeKey(prev, id)); prev = id }
    return keys
  }, [run, hoverPath])
  /**
   * WHAT THE RATION BOUGHT, on the map. A camp Scout pre-rolls every road within three hops, and every one of those
   * sightings used to be readable ONLY on the camp screen the company had already broken (RE-GATE C 3.9). The marks
   * are annotated onto the roads themselves; the hover preview quotes the sentence for the legs of the path the
   * player is actually considering, so the intel is in front of the click that spends it.
   */
  const sighted = useMemo(() => {
    const out = new Map<string, Sighting>()
    if (run === null) return out
    for (const r of scoutedRoads(run, env)) out.set(edgeKey(r.from, r.to), r.sighting)
    return out
  }, [run, env])
  const hoverSightings = useMemo(() => {
    if (run === null || hoverPath === null) return []
    const out: { readonly to: string; readonly sighting: Sighting }[] = []
    let prev = run.nodeId
    for (const id of hoverPath) {
      const sighting = sightingFor(run, prev, id)
      if (sighting !== null) out.push({ to: byId.get(id)?.name ?? id, sighting })
      prev = id
    }
    return out
  }, [run, hoverPath, byId])

  // the committed journey (remaining legs) in accent ink; the hop in flight gets the comet
  const plannedKeys = useMemo(() => {
    const keys = new Set<string>()
    if (view === null) return keys
    let prev = view.hop?.to ?? view.nodeId
    for (const id of view.pathLeft) { keys.add(edgeKey(prev, id)); prev = id }
    return keys
  }, [view])
  const activeKey = view?.hop !== null && view?.hop !== undefined && view.status === 'walking' ? edgeKey(view.hop.from, view.hop.to) : null

  const camera = useMemo(() => {
    if (currentNode === null || view === null) return { x: 0, y: 0 }
    return liveCam ?? cameraFor(currentNode, view.pan, world.width, world.height)
  }, [currentNode, view, liveCam, world.width, world.height])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    setDrag({ x: e.clientX, y: e.clientY, camX: camera.x, camY: camera.y, moved: false })
  }, [camera])
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (drag === null) return
    const scale = e.currentTarget.getBoundingClientRect().width / VIEW_W
    const dx = (e.clientX - drag.x) / scale
    const dy = (e.clientY - drag.y) / scale
    if (!drag.moved && Math.hypot(dx, dy) < 6) return
    if (!drag.moved) setDrag({ ...drag, moved: true })
    setLiveCam(clampCamera(drag.camX - dx, drag.camY - dy, world.width, world.height))
  }, [drag, world.width, world.height])
  const onPointerUp = useCallback(() => {
    if (drag === null) return
    suppressClick.current = drag.moved
    if (drag.moved) setHasPanned(true)
    if (drag.moved && liveCam !== null) dispatch({ type: 'ui/setMapPan', pan: liveCam })
    setDrag(null)
    setLiveCam(null)
  }, [drag, liveCam])

  const showToast = useCallback((text: string) => {
    setToast(text)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 1800)
  }, [])

  const onNodePress = useCallback((id: string) => {
    // A pan that ended over a node is a pan. The flag is consumed here so the NEXT plain click still travels.
    if (suppressClick.current) { suppressClick.current = false; return }
    if (drag?.moved === true) return
    // The node underfoot is a legal destination: `startTravel` answers a zero-length path with `atNode` — the
    // quick menu, no hop, no food, no day. It is the only way back into a town the player has said "Stay" at.
    const legal = canDispatch({ type: 'travel/goTo', nodeId: id })
    if (!legal.ok) { showToast(legal.reason); return }
    if (run !== null && findPath(run, id, env) === null) { showToast('no road leads there'); return }
    setHoverId(null)
    dispatch({ type: 'travel/goTo', nodeId: id })
  }, [drag, run, env, showToast])

  if (view === null || run === null || currentNode === null) return null
  // Which sides of the window have more country behind them. Read off the camera, so it is true while dragging and
  // true again the moment the clamp stops at the paper's edge.
  const more = {
    left: camera.x > 0.5,
    right: camera.x + VIEW_W < world.width - 0.5,
    up: camera.y > 0.5,
    down: camera.y + VIEW_H < world.height - 0.5,
  }
  const canPan = more.left || more.right || more.up || more.down
  const hint = view.pan === null && canPan && !hasPanned
  // A name the window would CUT — or that the hint would sit on — is not lettered. The plan is in sheet space and
  // so is the window, so this is one comparison per name and it needs no measurement of the DOM.
  const cutNames = new Set<string>()
  labelMarks.forEach((m, i) => {
    const b = labelBoxes[i]
    if (b === undefined) return
    const onScreen = b.x + b.w > camera.x && b.x < camera.x + VIEW_W && b.y + b.h > camera.y && b.y < camera.y + VIEW_H
    const whole = b.x >= camera.x && b.x + b.w <= camera.x + VIEW_W && b.y >= camera.y && b.y + b.h <= camera.y + VIEW_H
    if (onScreen && !whole) { cutNames.add(m.id); return }
    if (!hint || !onScreen) return
    const vx = b.x - camera.x
    const vy = b.y - camera.y
    if (vx + b.w > HINT_SEAT.x && vx < HINT_SEAT.x + HINT_SEAT.w && vy + b.h > HINT_SEAT.y && vy < HINT_SEAT.y + HINT_SEAT.h) cutNames.add(m.id)
  })
  const walking = view.status === 'walking' || view.status === 'suspended'
  const goToReason = walking ? 'already on the road' : null
  const palette = regionPalette(currentNode.regionId)
  const pawnNode = view.hop !== null && view.status === 'walking' ? byId.get(view.hop.to) ?? currentNode : currentNode
  const westward = view.hop !== null && (byId.get(view.hop.to)?.position.x ?? 0) < (byId.get(view.hop.from)?.position.x ?? 0)
  const hoverNode = hoverId === null ? null : byId.get(hoverId) ?? null
  const hopsLeft = view.pathLeft.length

  return (
    <div className="ow-screen" data-testid="overworld-screen">
      <Band />
      <div
        className={`ow-viewport${drag?.moved === true ? ' ow-viewport--dragging' : ''}`}
        style={{ top: BAND_TOP, width: VIEW_W, height: VIEW_H }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        data-testid="map-viewport"
      >
        <div className="ow-world" style={{ width: world.width, height: world.height, transform: `translate(${-Math.round(camera.x)}px, ${-Math.round(camera.y)}px)`, transition: drag !== null || !motionEnabled() ? 'none' : `transform ${HOP_DELAY_MS}ms var(--ease-out-quart)` }}>
          <Sheet width={world.width} height={world.height} mapId={world.id} nodes={world.nodes} washes={washes} labelBoxes={labelBoxes} />
          <Roads edges={world.edges} nodes={nodes} currentNodeId={view.nodeId} plannedKeys={plannedKeys} hoverKeys={hoverKeys} activeKey={activeKey} sighted={sighted} width={world.width} height={world.height} palette={palette} />
          {nodes.map((n) => {
            const visual: NodeVisual = n.id === view.nodeId ? 'current' : n.id === hoverId ? 'hover' : (hoverPath?.includes(n.id) ?? false) || view.pathLeft.includes(n.id) ? 'planned' : reachable.has(n.id) ? 'reachable' : 'distant'
            return (
              <NodeMark
                key={n.id}
                node={n}
                visual={visual}
                visited={run.visitedNodes[refKey('overworld', world.id, n.id)] === true}
                locked={isNodeLocked(run, n)}
                palette={regionPalette(n.regionId)}
                disabledReason={n.id === view.nodeId ? null : goToReason}
                label={labelPlan.get(n.id) ?? { dx: 0, dy: 32 }}
                labelCut={cutNames.has(n.id)}
                onPress={() => onNodePress(n.id)}
                onHover={(h) => setHoverId(h ? n.id : (prev) => (prev === n.id ? null : prev))}
              />
            )
          })}
          <div className={`ow-pawn${westward ? ' ow-pawn--west' : ''}`} style={{ left: pawnNode.position.x, top: pawnNode.position.y, transition: motionEnabled() ? `left ${HOP_DELAY_MS}ms var(--ease-out-quart), top ${HOP_DELAY_MS}ms var(--ease-out-quart)` : 'none' }} data-testid="pawn" aria-label={`${view.mcName} at ${pawnNode.name}`}>
            <span className="ow-pawn__shadow" />
            {view.mcSprite !== null ? <img className="ow-pawn__sprite" src={`/sprites/units/board/${view.mcSprite}.png`} alt="" draggable={false} /> : <span className="ow-pawn__disc" />}
          </div>
          {hoverNode !== null && hoverPreview !== null && !walking && (
            <div className="ow-tip" style={{ left: hoverNode.position.x, top: hoverNode.position.y - 44 }} data-testid="path-preview">
              <span className="numeral">{hoverPreview.hops} {hoverPreview.hops === 1 ? 'hop' : 'hops'} · {hoverPreview.food} food</span>
              {hoverPreview.starvationHp > 0 && <span className="ow-tip__warn">short of food · −{hoverPreview.starvationHp} HP each</span>}
              {/* the scouts' own words, on the legs of THIS path — the mark on the road says a shape, this says it */}
              {hoverSightings.map((s) => (
                <span key={s.to} className={`ow-tip__sight${s.sighting.quiet ? ' ow-tip__sight--quiet' : ''}`} data-testid="path-sighting">{s.to} · {s.sighting.report}</span>
              ))}
            </div>
          )}
          {hoverNode !== null && hoverNode.id === view.nodeId && !walking && !view.menuOpen && (
            <div className="ow-tip" style={{ left: hoverNode.position.x, top: hoverNode.position.y - 44 }} data-testid="here-preview">
              <span>Look around · no hop, no food</span>
            </div>
          )}
          {hoverNode !== null && hoverPreview === null && hoverNode.id !== view.nodeId && !walking && (
            <div className="ow-tip" style={{ left: hoverNode.position.x, top: hoverNode.position.y - 44 }}><span>no road leads there</span></div>
          )}
        </div>
        {/* The paper falls into shadow on every side that has more country behind it: the frame reads as a window
            onto a bigger sheet instead of ending in a cut, and a name approaching the edge dims before it is lost. */}
        <div className="ow-edge" aria-hidden>
          {more.left && <span className="ow-edge__side ow-edge__side--l" />}
          {more.right && <span className="ow-edge__side ow-edge__side--r" />}
          {more.up && <span className="ow-edge__side ow-edge__side--t" />}
          {more.down && <span className="ow-edge__side ow-edge__side--b" />}
        </div>
        {view.menuOpen && <NodeCard node={currentNode} hopsLeft={hopsLeft} seat={seatCard(currentNode.position, camera)} />}
        {toast !== null && <div className="ow-toast" role="status">{toast}</div>}
        {/* One corner, one thing: the gesture in words until it has been used, the way back once it has. */}
        {hint && <p className="ow-hint" data-testid="map-hint">Drag the sheet — the country runs on past the frame.</p>}
        {view.pan !== null && <button type="button" className="btn-forged btn-forged--ghost ow-recentre" onClick={() => dispatch({ type: 'ui/setMapPan', pan: null })}>Find the company</button>}
      </div>
    </div>
  )
}
