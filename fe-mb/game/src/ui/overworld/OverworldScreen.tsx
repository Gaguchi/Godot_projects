/**
 * ui/overworld/OverworldScreen.tsx — the map (ARCHITECTURE §4, BRIEF §2.9), in Filigree over the 1x pixel country
 * (owner 2026-10-24 and 2026-10-25: the big country, camp at the hub, roads out in every direction).
 *
 * THE WORLD IS THE SCREEN. The drawn heartland fills the stage and the camera follows the company; three windows
 * sit on it and nothing else does: the region (the day, the road's odds, the whole country in small, the purse and
 * the food), the commands, and the company. The only actionable things on the map at rest are the roads out of the
 * place the company stands on: bone beads along each, the names of where they lead on plates. Pointing at a place
 * turns its road to brass, brackets it and pins its forecast beside it (days, food, the road's odds) BEFORE the
 * click that spends them; clicking dispatches `travel/goTo`. Clicking the place the company is on re-enters it —
 * no hop, no food, no day (BRIEF §2.9).
 *
 * WHAT IS DRAWN AND WHAT IS NOT. `sheetArt` says where the art sits. The heartland (the Borderlands) is pixel art;
 * the country beyond it is in the engine and not yet drawn, so the map letters those places on the unsurveyed dark
 * and joins them with dotted lines. It is a real part of the run, shown plainly as not surveyed.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { spriteIdFor } from '../../content/index'
import type { Action } from '../../engine/actions'
import { overlayOf } from '../../engine/flow/pump'
import { foodCount, itemDef } from '../../engine/run/bag'
import { DESCENT_IS_ONE_WAY } from '../../engine/run/dungeon'
import { rollChanceFor } from '../../engine/run/encounters'
import { throneWarning } from '../../engine/run/travel'
import { adjacency, edgeKey, edgeOf, findPath, isNodeLocked, previewPath, regionOf, typeLabel, visibleNodes } from '../../engine/run/overworld'
import { displayName, livingUnits } from '../../engine/run/party'
import { questStatus } from '../../engine/run/quests'
import { scoutedRoads, sightingFor, type Sighting } from '../../engine/run/scout'
import type { EngineEnv, GameState, OverworldNode, RunState } from '../../engine/types'
import { FBtn, FCmd, FIcon, Key, Niche, Win, faceArt } from '../filigree/kit'
import { className, companyName } from '../names'
import { STAGE_H, STAGE_W } from '../stage'
import { canDispatch, dispatch, shallow, useEnv, useGame, useLegal } from '../store'
import { HOP_DELAY_MS, motionEnabled } from '../timings'
import { art, beadSeats, companyBox, overlaps, roadGaps, roadLine, standPoint, toOverview, type Box, type Pt } from './sheetArt'

const VIEW_W = STAGE_W
const VIEW_H = STAGE_H
const COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'] as const
const EASE = 'cubic-bezier(0.25, 1, 0.5, 1)'
const days = (n: number): string => `${n} ${n === 1 ? 'day' : 'days'}`

interface MapView {
  readonly nodeId: string
  readonly status: 'idle' | 'walking' | 'suspended' | 'atNode'
  readonly hop: { readonly from: string; readonly to: string } | null
  readonly pathLeft: readonly string[]
  readonly spawned: Readonly<Record<string, true>>
  readonly unlocked: Readonly<Record<string, true>>
  readonly pan: { readonly x: number; readonly y: number } | null
  readonly menuOpen: boolean
}

const selectMap = (s: GameState): MapView | null => {
  const run = s.run
  if (run === null) return null
  const t = run.pendingTravel
  return {
    nodeId: run.nodeId,
    status: t?.status ?? 'idle',
    hop: t?.hop === null || t?.hop === undefined ? null : { from: t.hop.from, to: t.hop.to },
    pathLeft: t?.path ?? [],
    spawned: run.spawnedNodes,
    unlocked: run.unlockedNodes,
    pan: s.ui.mapPan,
    menuOpen: overlayOf(s)?.kind === 'quickMenu',
  }
}

function clampCamera(x: number, y: number, sheetW: number, sheetH: number): Pt {
  return { x: Math.round(Math.max(0, Math.min(sheetW - VIEW_W, x))), y: Math.round(Math.max(0, Math.min(sheetH - VIEW_H, y))) }
}

/** The odds the road from `from` to `to` rolls an encounter today: the engine's own number, never a copy of it. */
function hopChance(run: RunState, from: string, to: string, env: EngineEnv): number {
  const dest = env.content.overworld.nodes.find((n) => n.id === to)
  const noRoll: readonly string[] = env.rules.travel.noRollInto
  if (dest === undefined || noRoll.includes(dest.type)) return 0
  const edge = edgeOf(from, to, env)
  if (edge === null) return 0
  const region = env.content.regions[env.content.encounterTables[edge.encounterTableId]?.regionId ?? ''] ?? regionOf(from, env)
  return rollChanceFor(edge, region, run.edgeTraversals[edgeKey(from, to)] ?? null, run.daysElapsed, env)
}
const odds = (chance: number): string => (Number.isInteger(Math.round(chance * 100) / 10) ? `${Math.round(chance * 10)} in 10` : `${Math.round(chance * 100)} in 100`)

function Verb({ action, label, variant = 'secondary', testId, lockedSigil = false, then }: { readonly action: Action; readonly label: string; readonly variant?: 'primary' | 'secondary'; readonly testId?: string; readonly lockedSigil?: boolean; readonly then?: Action }): React.JSX.Element {
  const legal = useLegal(action)
  return (
    <FBtn variant={variant} disabledReason={legal.ok ? null : legal.reason} onPress={() => { dispatch(action); if (then !== undefined) dispatch(then) }} {...(testId !== undefined ? { testId } : {})}>
      {/* a sealed door is never carried by the label or the colour alone: the padlock is the second channel (UIS-03) */}
      {lockedSigil && !legal.ok && <FIcon name="padlock" w={16} h={16} style={{ margin: '-3px 6px 0 0' }} />}{label}
    </FBtn>
  )
}

/** The window that opens when the company stands at a place with choices (overlay `quickMenu`), seated at the place. */
function NodeCard({ node, hopsLeft, at }: { readonly node: OverworldNode; readonly hopsLeft: number; readonly at: Box }): React.JSX.Element {
  const env = useEnv()
  const region = env.content.regions[node.regionId]
  const throne = useGame(useCallback((s: GameState) => (s.run === null ? null : throneWarning(s.run, env)), [env]))
  const w = Math.max(380, Math.min(560, node.name.length * 21 + 60))
  // seated at the place it names (RE-GATE C 3.11): under its buildings in the upper half of the stage, over them in the lower
  const below = (at[1] + at[3]) / 2 < VIEW_H * 0.5
  const x = Math.round(Math.max(14, Math.min(VIEW_W - w - 16, (at[0] + at[2]) / 2 - w / 2)))
  const seat: React.CSSProperties = below ? { top: Math.round(Math.min(VIEW_H - 230, at[3] + 10)) } : { bottom: Math.round(Math.max(16, VIEW_H - (at[1] - 10))) }
  return (
    <Win x={x} y={0} w={w} className="fmap-menu" style={{ top: 'auto', ...seat }} testId="node-card" role="dialog" label={node.name}>
      <div className="s13 dim nowrap">{region?.name ?? node.regionId} · {typeLabel(node.type)}</div>
      <div className="tt" style={node.name.length > 18 ? { fontSize: 34, lineHeight: '38px' } : undefined}>{node.name}</div>
      {node.type === 'DUNGEON' && <p className="s14 rust fmap-menu__warn" data-testid="dungeon-warning">{DESCENT_IS_ONE_WAY}</p>}
      {/* the last door says who waits behind it BEFORE the verb (RE-GATE C 3.14): the sentence is the node's own */}
      {throne !== null && <p className="s14 rust fmap-menu__warn" data-testid="throne-warning">{throne}</p>}
      <div className="fmap-menu__verbs">
        {/* every visit opens on the square: `town/enter` leaves `ui` alone, so the menu sets the tab (types.ts UiState) */}
        {node.type === 'TOWN' && <Verb action={{ type: 'town/enter' }} then={{ type: 'ui/setTownTab', tab: 'square' }} label="Enter town" variant="primary" testId="menu-town" />}
        {node.type === 'CAMP' && <Verb action={{ type: 'camp/enter' }} label="Make camp" variant="primary" testId="menu-camp" />}
        {node.type === 'DUNGEON' && <Verb action={{ type: 'dungeon/enter' }} label="Enter" variant="primary" testId="menu-dungeon" lockedSigil />}
        {node.type === 'BOSS' && <Verb action={{ type: 'travel/challengeBoss' }} label="Challenge the throne" variant="primary" testId="menu-boss" />}
        {hopsLeft > 0 && <Verb action={{ type: 'travel/continue' }} label={`Press on · ${hopsLeft} ${hopsLeft === 1 ? 'hop' : 'hops'} left`} variant={node.type === 'TRAIL' || node.type === 'DISCOVERY' ? 'primary' : 'secondary'} testId="menu-continue" />}
        <Verb action={{ type: 'travel/stay' }} label={hopsLeft > 0 ? 'Halt here' : 'Stay'} testId="menu-stay" />
      </div>
    </Win>
  )
}

/** The three windows' boxes on the stage (the company's grows with the roster): a plate never opens under one. */
const companyH = (n: number): number => 58 + n * 52
const hudRects = (party: number): readonly Box[] => [[14, 14, 488, 192], [982, 14, 1268, 138], [14, VIEW_H - 10 - companyH(party), 408, VIEW_H - 8]]

/**
 * Where a place's plate sits. The name boxes are laid out once for the whole heartland, so a box can fall under a
 * window, off the frame, or on the company at this camera; then the plate moves beside its own sprite instead, on
 * the first side that is clear. A name the frame would cut is a bug (BRIEF §5.1), and a plate is the one name that
 * must be read. `taken` is in stage px: the windows, the company, and the plates already seated.
 */
function seatPlate(x: number, y: number, w: number, h: number, foot: Box | undefined, camera: Pt, taken: readonly Box[]): readonly [number, number] | null {
  const fits = (px: number, py: number): boolean => {
    const v: Box = [px - camera.x, py - camera.y, px - camera.x + w, py - camera.y + h]
    return v[0] >= 4 && v[2] <= VIEW_W - 4 && v[1] >= 4 && v[3] <= VIEW_H - 4 && !taken.some((r) => overlaps(v, r))
  }
  if (fits(x, y)) return [x, y]
  if (foot === undefined) return null
  const cx = (foot[0] + foot[2]) / 2
  const cy = (foot[1] + foot[3]) / 2
  const seats: readonly (readonly [number, number])[] = [
    [cx - w / 2, foot[3] + 4], [cx - w / 2, foot[1] - 4 - h], [foot[0] - 6 - w, cy - h / 2], [foot[2] + 6, cy - h / 2],
    [foot[2] - 10, foot[3] + 2], [foot[0] + 10 - w, foot[3] + 2], [foot[2] - 10, foot[1] - 2 - h], [foot[0] + 10 - w, foot[1] - 2 - h],
  ]
  for (const [px, py] of seats) if (fits(px, py)) return [Math.round(px), Math.round(py)]
  return null // no seat on the stage at this camera: the place is not lettered rather than lettered in half
}

// ------------------------------------------------------------------ the three windows
interface HudView {
  readonly day: number
  readonly gold: number
  readonly food: number
  readonly potion: string | null
  readonly quests: number
  readonly company: string
  readonly road: number | null
  readonly faces: readonly { readonly id: string; readonly name: string; readonly sprite: string | null; readonly hp: number; readonly max: number; readonly role: string }[]
}

function Pips({ on }: { readonly on: number }): React.JSX.Element {
  const total = Math.max(8, Math.ceil(on / 4) * 4)
  return (
    <>
      {Array.from({ length: total }, (_, i) => <i key={i} className={`fpip${i < on ? '' : ' fpip--off'}${i % 4 === 3 && i !== total - 1 ? ' fpip--gap' : ''}`} />)}
    </>
  )
}

function Hud({ regionName, chance, camera, company }: { readonly regionName: string; readonly chance: number; readonly camera: Pt; readonly company: Pt }): React.JSX.Element | null {
  const env = useEnv()
  const select = useCallback((s: GameState): HudView | null => {
    const run = s.run
    if (run === null) return null
    const t = run.pendingTravel
    const potions = new Map<string, number>()
    for (const e of run.bag) {
      const def = itemDef(e.itemId, env)
      if (def.kind === 'potion') potions.set(def.name, (potions.get(def.name) ?? 0) + 1)
    }
    const first = [...potions.entries()][0]
    return {
      day: run.daysElapsed,
      company: companyName(run.companyName),
      gold: run.gold,
      food: foodCount(run.bag, env),
      potion: first === undefined ? null : `${first[0]} ×${first[1]}`,
      quests: Object.keys(run.questStates).filter((id) => env.content.quests[id] !== undefined && questStatus(run, id) === 'active').length,
      // `path` still holds the leg in flight (travelStep only shifts on LAND), so it IS the count of hops to go.
      road: t !== null && (t.status === 'walking' || t.status === 'suspended') ? t.path.length : null,
      faces: livingUnits(run).map((u) => ({
        id: u.id, name: displayName(u, run), sprite: spriteIdFor(u.id, u.classId), hp: u.hp.current, max: u.hp.max,
        role: [className(u.classId, env), [u.handLeft, u.handRight].filter((i): i is NonNullable<typeof i> => i !== null).map((i) => itemDef(i, env).name).join(', ')].filter((p) => p !== '').join(' · '),
      })),
    }
  }, [env])
  const v = useGame(select, (a, b) => JSON.stringify(a) === JSON.stringify(b))
  if (v === null) return null
  const lowFood = v.food <= env.rules.travel.lowFoodWarnAt
  const foodNote = v.food === 0 ? `no rations: the next hop costs every unit ${env.rules.travel.starvationDamage} HP` : `${v.food} ${v.food === 1 ? 'ration' : 'rations'} left, ${env.rules.travel.foodPerHop} a hop`
  const o = art.overview
  const vp0 = toOverview(camera)
  const vp1 = toOverview({ x: camera.x + VIEW_W, y: camera.y + VIEW_H })
  const pin = toOverview(company)
  const ch = companyH(v.faces.length)
  return (
    <div className="fmap-hud">
      <Win x={14} y={14} w={472} h={176} testId="ledger-band">
        <div className="tt" style={{ left: 20, top: 12 }}>{regionName}</div>
        <div className="s20 bone nowrap" style={{ left: 20, top: 64 }}><FIcon name="sun" style={{ margin: '-5px 6px 0 0' }} />Day {v.day}</div>
        {/* where the company IS belongs in this window, never parked over the map (RE-GATE B 2.6) */}
        {v.road !== null ? (
          <>
            <div className="s15 dim nowrap" style={{ left: 20, top: 94 }}>On the road:</div>
            <div className="s15 bone nowrap" style={{ left: 20, top: 113 }} data-testid="walking">{v.road} {v.road === 1 ? 'hop' : 'hops'} to go</div>
          </>
        ) : (
          <>
            <div className="s15 dim nowrap" style={{ left: 20, top: 94 }}>Roads here:</div>
            <div className="s15 dim nowrap" style={{ left: 20, top: 113 }}>an encounter on <span className="rust">{odds(chance).replace(' in ', ' hops in ')}</span></div>
          </>
        )}
        {/* the whole country in small: the frame is what the screen shows, the pin is the company */}
        <div className="fniche" style={{ left: 288, top: 12, width: o.w + 8, height: o.h + 8, background: 'none' }} aria-hidden>
          <img src="/art/world/overview.png" width={o.w} height={o.h} alt="" draggable={false} style={{ left: 4, top: 4 }} />
          <div className="fmap-ov__frame" style={{ left: 4 + Math.round(vp0.x), top: 4 + Math.round(vp0.y), width: Math.max(3, Math.round(vp1.x - vp0.x)), height: Math.max(3, Math.round(vp1.y - vp0.y)) }} />
          <img src="/art/ui/pin.png" width={7} height={10} alt="" draggable={false} style={{ left: 4 + Math.round(pin.x) - 3, top: 4 + Math.round(pin.y) - 9 }} />
          {Object.entries(o.labels).filter(([name]) => name !== 'Iron Throne').map(([name, p]) => (
            <div key={name} className="abs s13 bone ol1d nowrap" style={{ left: Math.max(2, Math.min(o.w - 94, 4 + p[0] - 50)), top: 4 + p[1] - 9, width: 100, textAlign: 'center' }}>{name}</div>
          ))}
          <div className="abs s13 bone ol1d nowrap" style={o.throne[0] > o.w - 80 ? { left: 4 + o.throne[0] - 107, top: 4 + o.throne[1] - 14, width: 100, textAlign: 'right' } : { left: 4 + o.throne[0] + 7, top: 4 + o.throne[1] - 14 }}>Iron Throne</div>
        </div>
        <div className="frule" style={{ left: 20, top: 133, width: 432 }} />
        <div className="s15 bone nowrap" style={{ left: 20, top: 144 }}><FIcon name="coin" style={{ margin: '-4px 6px 0 0' }} /><span className="straw">{v.gold}</span> gold</div>
        <div className={`s15 nowrap ${lowFood ? 'rust' : 'bone'}`} style={{ left: 116, top: 144 }}><FIcon name="ration" style={{ margin: '-4px 6px 0 0' }} /><span className={lowFood ? '' : 'straw'} aria-label={foodNote} data-testid="band-food">{v.food}</span> food</div>
        {/* colour is never the sole channel (BRIEF §5 rule 4): low supplies also take the kit's refusal mark and a word */}
        {lowFood
          ? <div className="why" style={{ left: 206, top: 146 }} data-testid="band-food-low">{v.food === 0 ? 'none left' : 'running low'}</div>
          : <div className="nowrap" style={{ left: 206, top: 148, height: 11 }} aria-hidden><Pips on={v.food} /></div>}
        {v.potion !== null && <div className="s15 bone nowrap" style={{ right: 20, top: 144 }}><FIcon name="potion" style={{ margin: '-4px 6px 0 0' }} />{v.potion}</div>}
      </Win>
      <Win x={982} y={14} w={284} h={122} testId="commands">
        <FCmd x={20} y={10} w={244} h={32} label="The Company" note="roster and gear" onPress={() => dispatch({ type: 'ui/openModal', modal: { kind: 'loadout', unitId: null } })} testId="band-company" />
        <div className="fgroove" style={{ left: 20, top: 43, width: 244 }} />
        <FCmd x={20} y={45} w={244} h={32} label="Contracts" note={v.quests === 0 ? 'none yet' : `${v.quests} open`} onPress={() => dispatch({ type: 'ui/openModal', modal: { kind: 'questLog' } })} testId="band-quests" />
        <div className="fgroove" style={{ left: 20, top: 77, width: 244 }} />
        <FCmd x={20} y={79} w={244} h={32} label="Menu" note={<Key>Esc</Key>} noteX={150} onPress={() => dispatch({ type: 'ui/openModal', modal: { kind: 'pause' } })} testId="band-menu" />
      </Win>
      <Win x={14} y={VIEW_H - 10 - ch} w={392} h={ch} label="The company" testId="company-window">
        {/* the banner is the player's own words: it is lettered whole, never cut (GATE2-12) */}
        <div className="s16 ochre nowrap" style={{ left: 20, top: 13 }} data-testid="company-name">{v.company}</div>
        <div className="s13 dim nowrap" style={{ right: 20, top: 16 }}>{v.faces.length === 1 ? 'one of us' : `${(COUNT[v.faces.length] ?? String(v.faces.length)).toLowerCase()} of us`}</div>
        <div className="fgroove" style={{ left: 20, top: 36, width: 352 }} />
        {v.faces.map((f, i) => {
          const y = 42 + i * 52
          const ratio = f.max <= 0 ? 0 : f.hp / f.max
          return (
            <React.Fragment key={f.id}>
              <Niche x={18} y={y} {...faceArt(f.sprite)} />
              <div className="s16 bone nowrap" style={{ left: 82, top: y + 4 }}>{f.name}</div>
              <div className="s13 dim nowrap" style={{ left: 82, top: y + 27 }}>{f.role}</div>
              <div className={`fbar${ratio <= 0.25 ? ' fbar--crit' : ratio <= 0.5 ? ' fbar--warn' : ''}`} style={{ left: 250, top: y + 10, width: 64 }} aria-hidden><i style={{ width: Math.round(62 * ratio) }} /></div>
              <div className="s14 bone nowrap" style={{ right: 20, top: y + 4 }}>{f.hp}/{f.max}</div>
            </React.Fragment>
          )
        })}
      </Win>
    </div>
  )
}

// ------------------------------------------------------------------ the screen
export function OverworldScreen(): React.JSX.Element | null {
  const env = useEnv()
  const view = useGame(selectMap, shallow)
  const world = env.content.overworld
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  /** Has the player moved the map yet? Local and ephemeral by design: the one gesture is taught once (`ui.mapPan`
   *  returns to null on every hop, so reading it would put the lesson back after every leg). */
  const [hasPanned, setHasPanned] = useState(false)
  const [drag, setDrag] = useState<{ readonly x: number; readonly y: number; readonly camX: number; readonly camY: number; readonly moved: boolean } | null>(null)
  const [liveCam, setLiveCam] = useState<Pt | null>(null)
  const toastTimer = useRef<number | null>(null)
  // `pointerup` clears `drag` BEFORE the synthetic click runs, so the click handler cannot read it: the verdict is
  // parked here for exactly one click (BRIEF §10: "a drag < 8px is a click; one drag never latches later clicks").
  const suppressClick = useRef(false)
  /** The road each place was last reached by: the company stands at the end of it. */
  const cameFrom = useRef<Record<string, string>>({})

  useEffect(() => () => { if (toastTimer.current !== null) window.clearTimeout(toastTimer.current) }, [])

  const run = useGame((s) => s.run)
  const party = useGame((s) => (s.run === null ? 0 : livingUnits(s.run).length))
  const spawned = run?.spawnedNodes
  const nodes = useMemo(() => (run === null ? [] : visibleNodes(run, env)), [run, spawned, env])
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n] as const)), [nodes])
  const at = useCallback((id: string): Pt | undefined => byId.get(id)?.position, [byId])
  const adj = useMemo(() => (run === null ? {} : adjacency(run, env)), [run, spawned, env])

  const currentNode = view === null ? null : byId.get(view.nodeId) ?? null
  const idle = view !== null && view.status === 'idle'
  const reachable = useMemo(() => new Set(view === null || !idle ? [] : adj[view.nodeId] ?? []), [view, idle, adj])

  // pointing at a place: the way there and what it costs
  const hoverPath = useMemo(() => (run === null || hoverId === null || hoverId === run.nodeId ? null : findPath(run, hoverId, env)), [run, hoverId, env])
  const hoverPreview = useMemo(() => (run === null || hoverId === null || hoverId === run.nodeId ? null : previewPath(run, hoverId, env)), [run, hoverId, env])
  const legsOf = useCallback((from: string, path: readonly string[]): readonly (readonly [string, string])[] => {
    const out: [string, string][] = []
    let prev = from
    for (const id of path) { out.push([prev, id]); prev = id }
    return out
  }, [])
  const hoverLegs = useMemo(() => (run === null || hoverPath === null ? [] : legsOf(run.nodeId, hoverPath)), [run, hoverPath, legsOf])
  // the way already chosen: the leg in flight, then the legs still to walk (`path` keeps the leg in flight until it lands)
  const plannedLegs = useMemo(() => (view === null ? [] : view.hop === null ? legsOf(view.nodeId, view.pathLeft) : [[view.hop.from, view.hop.to] as const, ...legsOf(view.hop.to, view.pathLeft.slice(1))]), [view, legsOf])
  /** What the ration bought, ON the map (RE-GATE C 3.9): every road the scouts walked carries its mark. */
  const sighted = useMemo(() => (run === null ? [] : scoutedRoads(run, env)), [run, env])
  const hoverSightings = useMemo(() => {
    const out: { readonly to: string; readonly sighting: Sighting }[] = []
    if (run === null) return out
    for (const [a, b] of hoverLegs) {
      const sighting = sightingFor(run, a, b)
      if (sighting !== null) out.push({ to: byId.get(b)?.name ?? b, sighting })
    }
    return out
  }, [run, hoverLegs, byId])

  if (view?.hop !== null && view?.hop !== undefined) cameFrom.current[view.hop.to] = view.hop.from
  const walking = view !== null && (view.status === 'walking' || view.status === 'suspended')
  const pawnId = view === null ? null : view.hop !== null && view.status === 'walking' ? view.hop.to : view.nodeId
  const stand = useMemo<Pt>(() => {
    if (pawnId === null) return { x: 0, y: 0 }
    return standPoint(pawnId, cameFrom.current[pawnId] ?? null, adj[pawnId] ?? [], at, world.startNodeId)
    // `view` is a dependency on purpose: the hop in flight changes which road the company stands at the end of
  }, [pawnId, adj, at, world.startNodeId, view])

  const camera = useMemo<Pt>(() => {
    if (liveCam !== null) return liveCam
    if (view !== null && view.pan !== null) return clampCamera(view.pan.x, view.pan.y, world.width, world.height)
    return clampCamera(stand.x - VIEW_W / 2, stand.y - VIEW_H / 2 - 8, world.width, world.height)
  }, [liveCam, view, stand, world.width, world.height])

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
    // A pan that ended over a place is a pan. The flag is consumed here so the NEXT plain click still travels.
    if (suppressClick.current) { suppressClick.current = false; return }
    if (drag?.moved === true) return
    // The place underfoot is a legal destination: `startTravel` answers a zero-length path with `atNode` — the
    // quick menu, no hop, no food, no day. It is the only way back into a town the player has said "Stay" at.
    const legal = canDispatch({ type: 'travel/goTo', nodeId: id })
    if (!legal.ok) { showToast(legal.reason); return }
    if (run !== null && findPath(run, id, env) === null) { showToast('no road leads there'); return }
    setHoverId(null)
    dispatch({ type: 'travel/goTo', nodeId: id })
  }, [drag, run, env, showToast])

  if (view === null || run === null || currentNode === null) return null

  const inView = (p: Pt, pad: number): boolean => p.x > camera.x - pad && p.x < camera.x + VIEW_W + pad && p.y > camera.y - pad && p.y < camera.y + VIEW_H + pad
  const shown = nodes.filter((n) => inView(n.position, 260))
  const hoverNode = hoverId === null ? null : byId.get(hoverId) ?? null
  const region = env.content.regions[currentNode.regionId]
  const outs = adj[view.nodeId] ?? []
  const here = companyBox(stand)
  const footOf = (id: string): Box | undefined => art.feet[id]
  const clearOf = (a: string, b: string): Box[] => [footOf(a), footOf(b), here].filter((x): x is Box => x !== undefined)

  // the roads that carry beads: bone on every road out while the company stands idle, brass on the way pointed at
  // and on the way already chosen
  const brassKeys = new Set<string>([...hoverLegs, ...plannedLegs].map(([a, b]) => edgeKey(a, b)))
  const beadRoads: { readonly a: string; readonly b: string; readonly brass: boolean }[] = []
  if (idle) for (const to of outs) if (!brassKeys.has(edgeKey(view.nodeId, to))) beadRoads.push({ a: view.nodeId, b: to, brass: false })
  for (const [a, b] of [...plannedLegs, ...hoverLegs]) beadRoads.push({ a, b, brass: true })

  // the arrow at the end of the pointed-at way
  const lastLeg = hoverLegs[hoverLegs.length - 1]
  const lastLine = lastLeg === undefined ? [] : roadLine(lastLeg[0], lastLeg[1], at)
  const arrowAt = lastLine.length > 16 ? lastLine[lastLine.length - 13] : undefined
  const arrowTo = lastLine.length > 16 ? lastLine[lastLine.length - 11] : undefined

  const plateOf = (n: OverworldNode): 'here' | 'hover' | 'out' | 'planned' | 'quiet' =>
    n.id === view.nodeId ? 'here' : n.id === hoverId ? 'hover' : reachable.has(n.id) ? 'out' : (hoverPath?.includes(n.id) ?? false) || view.pathLeft.includes(n.id) ? 'planned' : 'quiet'
  const subOf = (n: OverworldNode): { readonly text: string; readonly tone: string } | null =>
    n.id === view.nodeId ? { text: 'the company is here', tone: 'rill' } : isNodeLocked(run, n) ? { text: 'locked for now', tone: 'rust' } : n.type === 'DISCOVERY' ? { text: 'a landmark', tone: 'dim' } : null

  // the forecast, pinned beside the place pointed at
  const hoverFoot = hoverNode === null ? undefined : footOf(hoverNode.id)
  const hb: Box | null = hoverNode === null ? null : hoverFoot !== undefined ? [hoverFoot[0] - 8, hoverFoot[1] - 8, hoverFoot[2] + 8, hoverFoot[3] + 8] : [hoverNode.position.x - 14, hoverNode.position.y - 14, hoverNode.position.x + 14, hoverNode.position.y + 14]
  // every plate is seated in one pass, so no two share a seat: the place the company is on first, then the plates
  // whose own box is clear at this camera, then the ones that have to move beside their sprite
  const toStage = (b: Box): Box => [b[0] - camera.x, b[1] - camera.y, b[2] - camera.x, b[3] - camera.y]
  const taken: Box[] = [...hudRects(party), toStage(here)]
  const seats = new Map<string, readonly [number, number] | null>()
  const plated = shown.filter((n) => art.labels[n.id] !== undefined && plateOf(n) !== 'quiet' && plateOf(n) !== 'planned')
  const rank = (n: OverworldNode): number => (plateOf(n) === 'here' ? 0 : plateOf(n) === 'hover' ? 1 : 2)
  for (const pass of [0, 1] as const) {
    for (const n of [...plated].sort((p, q) => rank(p) - rank(q))) {
      if (seats.has(n.id)) continue
      const l = art.labels[n.id]!
      const h = plateOf(n) === 'here' ? 40 : 26 + (subOf(n) === null ? 0 : 18)
      const own: Box = toStage([l[0], l[1], l[0] + l[2], l[1] + h])
      const clear = own[0] >= 4 && own[2] <= VIEW_W - 4 && own[1] >= 4 && own[3] <= VIEW_H - 4 && !taken.some((r) => overlaps(own, r))
      if (pass === 0 && !clear) continue
      const seat = clear ? ([l[0], l[1]] as const) : seatPlate(l[0], l[1], l[2], h, footOf(n.id), camera, taken)
      seats.set(n.id, seat)
      if (seat !== null) taken.push(toStage([seat[0], seat[1], seat[0] + l[2], seat[1] + h]))
    }
  }
  const seatOf = (n: OverworldNode): { readonly lx: number; readonly ly: number; readonly lw: number } => {
    const label = art.labels[n.id]
    if (label === undefined) return { lx: n.position.x - 90, ly: n.position.y + 10, lw: 180 }
    const seat = seats.get(n.id)
    return { lx: seat?.[0] ?? label[0], ly: seat?.[1] ?? label[1], lw: label[2] }
  }
  const hereName = currentNode.id === world.startNodeId ? 'camp' : currentNode.name
  const footnote = !idle || view.menuOpen ? null : outs.length === 0 ? null : `${COUNT[outs.length] ?? outs.length} ${outs.length === 1 ? 'road' : 'roads'} out of ${hereName}. Point at one, click to march.`
  // a quiet name that a window, a plate, the footnote or the frame would cut is not lettered at all (BRIEF §5.1)
  const noteSeat: Box | null = footnote === null ? null : [414, 688, 424 + (footnote.length + (hasPanned || view.pan !== null ? 0 : 30)) * 7.2, 716]
  const cut = (n: OverworldNode): boolean => {
    const { lx, ly, lw } = seatOf(n)
    const v = toStage([lx + lw / 2 - n.name.length * 3.9, ly + 2, lx + lw / 2 + n.name.length * 3.9, ly + 24])
    if (v[2] <= 0 || v[0] >= VIEW_W || v[3] <= 0 || v[1] >= VIEW_H) return false
    return v[0] < 2 || v[2] > VIEW_W - 2 || v[1] < 2 || v[3] > VIEW_H - 2 || taken.some((r) => overlaps(v, r)) || (noteSeat !== null && overlaps(v, noteSeat))
  }
  const CARD_W = 330
  const cardH = 132 + (hoverPreview !== null && hoverPreview.starvationHp > 0 ? 20 : 0) + hoverSightings.length * 18
  // the card takes the seat round the brackets that covers least: the windows, the company and every plate count,
  // the pointed-at place's own plate most of all
  let cardX = 0
  let cardY = 0
  if (hb !== null && hoverNode !== null) {
    const hl = seatOf(hoverNode)
    const plate: Box = toStage([hl.lx - 4, hl.ly - 4, hl.lx + hl.lw + 4, hl.ly + 30])
    const v = toStage(hb)
    const mid = (v[1] + v[3]) / 2 - 62
    const cx = (v[0] + v[2]) / 2 - CARD_W / 2
    const options: (readonly [number, number])[] = [
      [v[2] + 34, mid], [v[0] - 34 - CARD_W, mid], [v[2] + 34, v[3] - 20], [v[0] - 34 - CARD_W, v[3] - 20],
      [v[2] + 34, v[1] + 20 - cardH], [v[0] - 34 - CARD_W, v[1] + 20 - cardH], [cx, v[3] + 22], [cx, v[1] - 22 - cardH],
    ]
    const area = (a: Box, b: Box): number => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))
    let best = Number.POSITIVE_INFINITY
    options.forEach(([ox, oy], rank) => {
      const x = Math.round(Math.max(14, Math.min(VIEW_W - CARD_W - 16, ox)))
      const y = Math.round(Math.max(14, Math.min(VIEW_H - cardH - 16, oy)))
      const box: Box = [x, y, x + CARD_W, y + cardH]
      const cost = taken.reduce((sum, r) => sum + area(box, r), 0) + area(box, plate) * 8 + area(box, v) * 8 + rank * 40
      if (cost < best) { best = cost; cardX = x + camera.x; cardY = y + camera.y }
    })
  }
  const cardRight = hb !== null && cardX > hb[0]
  // the brass leader runs from the brackets to the card only when the card sits level with them
  const leadY = hb === null ? null : Math.round((hb[1] + hb[3]) / 2) - 2
  const lead = hb !== null && leadY !== null && leadY > cardY + 12 && leadY < cardY + cardH - 16
  const oneHop = hoverLegs.length === 1 ? hoverLegs[0] : undefined
  const hopOdds = oneHop === undefined ? null : hopChance(run, oneHop[0], oneHop[1], env)

  return (
    <div className="f64 fmap" data-testid="overworld-screen">
      <div
        className={`fmap-view${drag?.moved === true ? ' fmap-view--dragging' : ''}`}
        style={{ width: VIEW_W, height: VIEW_H }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        data-testid="map-viewport"
      >
        <div className="fmap-world" style={{ width: world.width, height: world.height, transform: `translate(${-camera.x}px, ${-camera.y}px)`, transition: drag !== null || !motionEnabled() ? 'none' : `transform ${HOP_DELAY_MS}ms ${EASE}` }}>
          {/* the country beyond the survey: its roads as dotted lines, its regions lettered large */}
          <svg className="fmap-wild" width={world.width} height={world.height} aria-hidden>
            {world.edges.flatMap((e) => (byId.has(e.from) && byId.has(e.to) ? roadGaps(e.from, e.to, at).map(([p, q], i) => <line key={`${e.from}|${e.to}|${i}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />) : []))}
          </svg>
          {Object.entries(art.overview.labels).filter(([name]) => name !== 'Borderlands' && name !== 'Iron Throne').map(([name, p]) => (
            <div key={name} className="fmap-region" style={{ left: Math.round((p[0] - art.overview.w / 2) * art.overview.scale + art.overview.cx), top: Math.round((p[1] - art.overview.h / 2) * art.overview.scale + art.overview.cy) }}>{name}</div>
          ))}
          <img className="fmap-heart" src="/art/world/heart.png" width={art.heart.w} height={art.heart.h} alt="" draggable={false} style={{ left: art.heart.x, top: art.heart.y }} />
          {beadRoads.flatMap(({ a, b, brass }) => beadSeats(roadLine(a, b, at), clearOf(a, b), 13, brass && lastLeg !== undefined && lastLeg[0] === a && lastLeg[1] === b ? 15 : 9).map((p, i) => (
            <i key={`${a}|${b}|${i}`} className={`fmap-bead${brass ? ' fmap-bead--brass' : ''}`} style={{ left: p.x - 4, top: p.y - 4 }} />
          )))}
          {arrowAt !== undefined && arrowTo !== undefined && (
            <img className="fmap-arrow" src="/art/ui/icon_arrow_e.png" alt="" draggable={false} style={{ left: arrowAt.x - 3, top: arrowAt.y - 7, transform: `rotate(${Math.round((Math.atan2(arrowTo.y - arrowAt.y, arrowTo.x - arrowAt.x) * 180) / Math.PI)}deg)` }} />
          )}
          <div className="fmap-scout" data-testid="scout-marks" data-roads={world.edges.length}>
            {sighted.map((r) => {
              const line = roadLine(r.from, r.to, at)
              const mid = line[Math.floor(line.length / 2)]
              return mid === undefined ? null : <i key={`${r.from}|${r.to}`} className={`fmap-sight fmap-sight--${r.sighting.quiet ? 'quiet' : 'danger'}`} style={{ left: mid.x - 4, top: mid.y - 4 }} />
            })}
          </div>
          {art.signs.map((s) => {
            const tip = s.tip === '' ? 0 : 10
            const path = run.nodeId === s.to ? [] : findPath(run, s.to, env)
            const to = byId.get(s.to)
            if (to === undefined) return null
            const cap = path === null ? to.name : `${to.name} · ${days(path.length)}`
            return (
              <React.Fragment key={`${s.x}|${s.y}`}>
                <div className="fmap-sign s14 bone sh1" style={{ left: s.x + (s.tip === 'w' ? tip : 0), top: s.y + 2, width: s.w - tip, fontWeight: 700 }}>{s.region}</div>
                <div className="fmap-sign s13 bone ol1d" style={{ left: s.x + s.w / 2 - 120, top: s.y + s.h + 3, width: 240 }}>{cap}</div>
              </React.Fragment>
            )
          })}
          {shown.map((n) => {
            const foot = footOf(n.id)
            const label = art.labels[n.id]
            const plate = plateOf(n)
            const sub = subOf(n)
            const hit: React.CSSProperties = foot !== undefined ? { left: foot[0] - 6, top: foot[1] - 6, width: foot[2] - foot[0] + 12, height: foot[3] - foot[1] + 12 } : { left: n.position.x - 16, top: n.position.y - 16, width: 32, height: 32 }
            const plated = plate === 'out' || plate === 'hover'
            const { lx, ly, lw } = seatOf(n)
            const lettered = plated || plate === 'here' ? seats.get(n.id) !== null : !cut(n)
            const pointer = { onClick: () => onNodePress(n.id), onMouseEnter: () => setHoverId(n.id), onMouseLeave: () => setHoverId((prev) => (prev === n.id ? null : prev)) }
            return (
              <React.Fragment key={n.id}>
                <button
                  type="button"
                  className="fmap-node"
                  style={{ ...hit, cursor: walking && n.id !== view.nodeId ? 'default' : 'pointer' }}
                  data-testid={`node-${n.id}`}
                  data-state={plate}
                  aria-label={`${typeLabel(n.type)}: ${n.name}`}
                  {...pointer}
                />
                {foot === undefined && <i className={`fmap-mark${plate === 'quiet' ? '' : ' fmap-mark--lit'}`} style={{ left: n.position.x - 4, top: n.position.y - 4 }} />}
                {plated ? lettered && (
                  <Win kind={plate === 'hover' ? 'taglit' : 'tag'} x={lx} y={ly} w={lw} h={26} style={{ cursor: 'pointer' }}>
                    <div className={`s16 nowrap sh1 ${plate === 'hover' ? 'straw' : 'bone'}`} style={{ left: 0, top: 3, width: lw, textAlign: 'center' }} {...pointer}>{n.name}</div>
                  </Win>
                ) : lettered && (
                  <div className={`fmap-name${plate === 'here' ? ' fmap-name--here' : ''} ${plate === 'here' ? 's18 rill' : plate === 'planned' ? 's14 straw' : label !== undefined ? 's14 bone' : 's13 bone'} ol1d`} style={{ left: lx, top: plate === 'here' ? ly : ly + 4, width: lw }}>{n.name}</div>
                )}
                {sub !== null && lettered && <div className={`fmap-name s13 ${sub.tone} ol1d`} style={{ left: lx, top: ly + (plated ? 30 : plate === 'here' ? 22 : 22), width: lw }}>{sub.text}</div>}
              </React.Fragment>
            )
          })}
          {hb !== null && hoverNode !== null && hoverNode.id !== view.nodeId && <div className="fmap-brackets" style={{ left: hb[0], top: hb[1], width: hb[2] - hb[0], height: hb[3] - hb[1] }} />}
          <img
            className="fmap-company"
            src="/art/world/company.png"
            width={art.company.w}
            height={art.company.h}
            alt=""
            draggable={false}
            style={{ left: stand.x - art.company.ax, top: stand.y - art.company.ay, transition: motionEnabled() ? `left ${HOP_DELAY_MS}ms ${EASE}, top ${HOP_DELAY_MS}ms ${EASE}` : 'none' }}
            data-testid="pawn"
            aria-label={`the company at ${byId.get(pawnId ?? '')?.name ?? ''}`}
          />
          {hb !== null && hoverNode !== null && hoverPreview !== null && !walking && (
            <>
              {lead && leadY !== null && <div className="fmap-lead" style={cardRight ? { left: hb[2] + 2, top: leadY, width: cardX - hb[2] - 2 } : { left: cardX + CARD_W, top: leadY, width: hb[0] - 2 - cardX - CARD_W }} />}
              <Win kind="lit" x={cardX} y={cardY} w={CARD_W} h={cardH} className="fmap-card" testId="path-preview">
                <div className="tt" style={{ left: 20, top: 10, ...(hoverNode.name.length > 15 ? { fontSize: 30, lineHeight: '43px' } : {}) }}>{hoverNode.name}</div>
                <div className="s13 dim nowrap" style={{ left: 20, top: 54 }}>{typeLabel(hoverNode.type)} · {env.content.regions[hoverNode.regionId]?.name ?? hoverNode.regionId}</div>
                <div className="s18 bone nowrap" style={{ left: 20, top: 74 }}>
                  <FIcon name="sun" style={{ margin: '-4px 6px 0 0' }} />{days(hoverPreview.hops)}<span style={{ display: 'inline-block', width: 22 }} /><FIcon name="ration" style={{ margin: '-4px 6px 0 0' }} />{hoverPreview.food} food
                </div>
                <div className="s14 straw nowrap" style={{ right: 20, top: 78 }}>click to march</div>
                <div className="s15 bone nowrap" style={{ left: 20, top: 102 }}>
                  {hopOdds === null ? `${COUNT[hoverLegs.length] ?? hoverLegs.length} roads, each rolled as it is walked` : hopOdds === 0 ? `no ambush on the road into a ${typeLabel(hoverNode.type)}` : <>an encounter on the road: <span className="rust">{odds(hopOdds)}</span></>}
                </div>
                {hoverPreview.starvationHp > 0 && <div className="s14 rust nowrap" style={{ left: 20, top: 122 }}>short of food: −{hoverPreview.starvationHp} HP each on the way</div>}
                {/* the scouts' own words, on the legs of THIS way */}
                {hoverSightings.map((s, i) => (
                  <div key={s.to} className={`s13 nowrap ${s.sighting.quiet ? 'meadow' : 'rust'}`} style={{ left: 20, top: 122 + (hoverPreview.starvationHp > 0 ? 20 : 0) + i * 18 }} data-testid="path-sighting">{s.to} · {s.sighting.report}</div>
                ))}
              </Win>
            </>
          )}
          {hb !== null && hoverNode !== null && hoverNode.id === view.nodeId && !walking && !view.menuOpen && (
            <div className="tip" style={{ left: hoverNode.position.x - 100, top: hb[1] - 34, width: 200, textAlign: 'center' }} data-testid="here-preview">Look around · no hop, no food</div>
          )}
        </div>
      </div>
      {/* everything below sits ON the stage, outside the map's viewport: the viewport holds the world and nothing else */}
      <Hud regionName={region?.name ?? currentNode.regionId} chance={region?.encounterChancePerHop ?? 0} camera={camera} company={stand} />
      {footnote !== null && (
        <div className="fmap-foot s14 bone ol1d" style={{ left: 420, top: 694 }} data-testid="map-foot">
          {footnote}{!hasPanned && view.pan === null && <span data-testid="map-hint"> Drag the map to look further.</span>}
        </div>
      )}
      {view.menuOpen && <NodeCard node={currentNode} hopsLeft={view.pathLeft.length} at={toStage(footOf(currentNode.id) ?? [currentNode.position.x - 14, currentNode.position.y - 14, currentNode.position.x + 14, currentNode.position.y + 26])} />}
      {toast !== null && <div className="toast fmap-toast" role="status">{toast}</div>}
      {view.pan !== null && <FBtn onPress={() => dispatch({ type: 'ui/setMapPan', pan: null })} testId="map-recentre" style={{ position: 'absolute', right: 14, bottom: 14, zIndex: 6 }}>Find the company</FBtn>}
    </div>
  )
}
