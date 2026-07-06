import React, { useEffect, useRef, useState, useMemo } from 'react'
import borderlandsMap from '../../data/content/overworld/borderlands.json'
import thornwoodMap from '../../data/content/overworld/thornwood.json'
import ashfallMap from '../../data/content/overworld/ashfall.json'
import borderlandsRoad from '../../data/content/encounters/borderlands_road.json'
import thornwoodPath from '../../data/content/encounters/thornwood_path.json'
import ashfallTrack from '../../data/content/encounters/ashfall_track.json'
import regionsJson from '../../data/content/regions.json'
import { useRunStore, predicateStateFromRun } from '../../state/runStore'
import { asNodeId, asMapId, asDialogueId } from '../../domain/ids'
import type { NodeId } from '../../domain/ids'
import { createRng, deriveRng } from '../../systems/rng'
import { rollEncounter } from '../../systems/encounterRoller'
import { buildGraph, findPath } from '../../systems/overworldPath'
import type { EncounterTable } from '../../domain/encounter'
import { diag } from '../../state/diagLog'
import { GameHud, Icon, NodeQuickActionMenu, type NodeQuickAction } from '../components'
import { STAGE_W, STAGE_H } from '../stage'
import { NodeBeacon, type NodeVisualState, type NodeProgress } from './overworld/NodeBeacon'
import { OverworldRoads } from './overworld/OverworldRoads'
import { Caravan } from './overworld/Caravan'
import { PaperMap } from './overworld/PaperMap'
import { TravelBand } from './overworld/TravelBand'
import { regionPalette } from './overworld/palette'
import { CheckEventModal, type CheckEvent } from '../modals/CheckEventModal'
import type { QuestEffect } from '../../domain/quest'

interface RegionEdge {
  fromMapId: string
  fromNodeId: string
  toMapId: string
  toNodeId: string
  rollChance: number
}

interface MapData {
  id: string
  name?: string
  regionId?: string
  width: number
  height: number
  nodes: { id: string; name?: string; type: string; position: { x: number; y: number }; encounterTableId?: string; sigil?: string }[]
  edges: { from: string; to: string; rollChance: number; encounterTableId?: string }[]
  regionEdges?: RegionEdge[]
}

const MAPS: Record<string, MapData> = {
  borderlands: borderlandsMap as MapData,
  thornwood: thornwoodMap as MapData,
  ashfall: ashfallMap as MapData,
}

const ENCOUNTER_TABLES: Record<string, EncounterTable> = {
  borderlands: borderlandsRoad as unknown as EncounterTable,
  thornwood: thornwoodPath as unknown as EncounterTable,
  ashfall: ashfallTrack as unknown as EncounterTable,
}

const REGIONS = Object.fromEntries(
  (regionsJson as { id: string; name: string; color: string; tier: number }[]).map((r) => [r.id, r]),
)

export type TownPanel = 'inn' | 'shop' | 'tavern'

export interface OverworldSceneProps {
  onTravelToCombat: (nodeId: NodeId, enemyGroupId?: string) => void
  onEnterTown: (nodeId: NodeId, panel?: TownPanel) => void
  onEnterCamp: (nodeId: NodeId) => void
  onEnterDungeon: (nodeId: NodeId) => void
  onWin: () => void
}

const HOP_DELAY_MS = 700
const MARKER_WALK_MS = 600

/**
 * Oregon-Trail split view (spec 2026-06-12): two stacked surfaces, both always
 * visible.
 *   - TRAVEL BAND (top, h=BAND_H): side-view landscape; the caravan silhouette
 *     walks while scenery parallax-scrolls past. Pure feedback — no input.
 *   - PAPER MAP (bottom, h=MAP zone): the interactive parchment chart — ink
 *     roads, sigils, route planning, the travel token. Pans horizontally only.
 * A carved seam divides them like the edge of a war desk under a window.
 */
const BAND_H = 264
const SEAM_H = 12
const MAP_TOP = BAND_H + SEAM_H
const MAP_H = STAGE_H - MAP_TOP

/** Order-insensitive edge key for matching a hover/active leg to a map edge. */
function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/** Stable empty set — there's no longer a "planned route" road state (click =
 *  go), but OverworldRoads still accepts the prop. Shared ref avoids re-renders. */
const NO_EDGE_KEYS: Set<string> = new Set()

export function OverworldScene({
  onTravelToCombat: _onTravelToCombat,
  onEnterTown,
  onEnterCamp,
  onEnterDungeon,
  onWin,
}: OverworldSceneProps): React.JSX.Element {
  const dispatchRun = useRunStore((s) => s.dispatch)
  const worldPosition = useRunStore((s) => s.worldPosition)
  const visitedNodes = useRunStore((s) => s.visitedNodes)
  const questStates = useRunStore((s) => s.questStates)
  const pendingDialogue = useRunStore((s) => s.pendingDialogue)
  const pendingCombat = useRunStore((s) => s.pendingCombat)
  const inventoryItems = useRunStore((s) => s.inventory.items)
  const [activeCheckEvent, setActiveCheckEvent] = useState<CheckEvent | null>(null)
  // M&B-style quick-action menu shown when arriving at / clicking a town,
  // camp, dungeon, or exit node. Replaces the prior auto-enter behavior.
  const [quickMenuNode, setQuickMenuNode] = useState<{ id: string; type: string } | null>(null)
  // Transient "you have arrived" flash, surfaced on the travel band when a leg
  // ends. Cleared on a timer so the band reverts to its idle vista.
  const [arrivalFlash, setArrivalFlash] = useState<string | null>(null)

  const mapId = (worldPosition.mapId as unknown as string) || 'borderlands'
  const map = MAPS[mapId] ?? MAPS['borderlands']!
  const region = map.regionId ? REGIONS[map.regionId] : undefined

  // Per-map UI state must not leak across region transitions: a quick menu
  // left open for a node of the OLD map would render nothing (id not found)
  // yet still gate the hop driver, silently freezing travel.
  useEffect(() => {
    setQuickMenuNode(null)
  }, [mapId])

  const currentNodeId = worldPosition.nodeId as unknown as string
  const foodCount = inventoryItems.filter((i) => (i.itemId as unknown as string) === 'food_rations').length

  // Build a graph for BFS pathfinding within the current map.
  const graph = useMemo(() => buildGraph({ edges: map.edges }), [map])

  // Adjacent neighbors (1 hop) — used for highlight + adjacency state.
  const neighbors = useMemo(() => {
    const s = new Set<string>()
    for (const e of map.edges) {
      if (e.from === currentNodeId) s.add(e.to)
      if (e.to === currentNodeId) s.add(e.from)
    }
    return s
  }, [map, currentNodeId])

  // Region edges from the current map — these reach into other region maps.
  const regionEdgesFromHere = useMemo(() => {
    return (map.regionEdges ?? []).filter((e) =>
      (e.fromMapId === mapId && e.fromNodeId === currentNodeId)
      || (e.toMapId === mapId && e.toNodeId === currentNodeId),
    )
  }, [map, mapId, currentNodeId])

  // ── Camera (pan via drag, X only — the map zone is exactly one sheet tall) ──
  const [cameraX, setCameraX] = useState(0)
  const clampCamX = (x: number): number => Math.min(0, Math.max(STAGE_W - map.width, x))
  const dragState = useRef<{
    active: boolean
    startX: number
    baseX: number
    moved: boolean
  }>({ active: false, startX: 0, baseX: 0, moved: false })

  // Center camera on current node when map or node changes (and not actively
  // dragging). The roster docks bottom-left now, but the playfield's "neutral"
  // center is biased right of stage-center (~775 vs 640) so the current node
  // lands in the open chart area, not under any docked chrome.
  useEffect(() => {
    const cur = map.nodes.find((n) => n.id === currentNodeId)
    if (!cur) return
    setCameraX(clampCamX(775 - cur.position.x))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, currentNodeId, map])

  const onPanStart = (e: React.MouseEvent): void => {
    if ((e.target as HTMLElement).closest('[id^="node-"]')) return
    dragState.current = {
      active: true,
      startX: e.clientX,
      baseX: cameraX,
      moved: false,
    }
  }
  const onPanMove = (e: React.MouseEvent): void => {
    if (!dragState.current.active) return
    const dx = e.clientX - dragState.current.startX
    // Bumped 3 → 8: tiny mouse jitter during a click was being misclassified as
    // a drag and silently swallowing the click on overworld nodes.
    if (Math.abs(dx) > 8) dragState.current.moved = true
    setCameraX(clampCamX(dragState.current.baseX + dx))
  }
  const onPanEnd = (): void => {
    dragState.current.active = false
  }

  // ── Pending combat from a dialogue's `startCombat` effect ───────
  useEffect(() => {
    if (!pendingCombat) return
    if (pendingDialogue) return
    const groupId = pendingCombat.enemyGroupId
    dispatchRun({ type: 'clearPendingCombat' })
    _onTravelToCombat(asNodeId(currentNodeId), groupId)
  }, [pendingCombat, pendingDialogue, currentNodeId, _onTravelToCombat, dispatchRun])

  // ── Multi-hop travel via pendingTravelPath ──────────────────────
  const pendingTravelPath = useRunStore((s) => s.pendingTravelPath)
  const advancingRef = useRef(false)
  // True while a journey has hops queued — read by the arrival-flash effect to
  // distinguish "arrived from a journey" from a fresh map/node load.
  const travelInProgressRef = useRef(false)
  useEffect(() => {
    if ((pendingTravelPath?.remainingNodeIds.length ?? 0) > 0) {
      travelInProgressRef.current = true
    }
  }, [pendingTravelPath])

  // ── Arrival flash ───────────────────────────────────────────────
  // When the current node changes AND a journey was in progress, surface the
  // arrived node's name on the travel band for ~1200ms, then clear it.
  useEffect(() => {
    if (!travelInProgressRef.current) return
    travelInProgressRef.current = false
    const arrived = map.nodes.find((n) => n.id === currentNodeId)
    const name = arrived?.name ?? currentNodeId.replace(/_/g, ' ')
    setArrivalFlash(name)
    const timer = setTimeout(() => setArrivalFlash(null), 1200)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNodeId])

  // Drive the next hop whenever there's a pending path AND no dialogue blocking.
  useEffect(() => {
    if (!pendingTravelPath || pendingTravelPath.remainingNodeIds.length === 0) return
    if (pendingDialogue) return
    if (quickMenuNode) return       // quick-action menu pauses travel
    if (advancingRef.current) return
    advancingRef.current = true
    const timer = setTimeout(() => {
      advancingRef.current = false
      const next = pendingTravelPath.remainingNodeIds[0] as unknown as string
      executeHop(next)
    }, HOP_DELAY_MS)
    return () => {
      clearTimeout(timer)
      advancingRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTravelPath, pendingDialogue, quickMenuNode])

  /**
   * Execute a single hop: consume food, possibly roll encounter, and either
   * (a) open a dialogue (suspends path), (b) route to combat (suspends path),
   * or (c) arrive at the node and pop the path head.
   */
  const executeHop = (nextNodeId: string): void => {
    // Find target: either in current map or behind a regionEdge.
    const inMap = map.nodes.find((n) => n.id === nextNodeId)
    const regionEdge = (map.regionEdges ?? []).find(
      (re) => (re.fromMapId === mapId && re.toNodeId === nextNodeId)
        || (re.toMapId === mapId && re.fromNodeId === nextNodeId),
    )

    const rngState = useRunStore.getState().rngState
    const parent = createRng(rngState)
    const hopRng = deriveRng(parent, `hop:${mapId}:${currentNodeId}->${nextNodeId}`)

    // GP-C6: every hop costs food (or HP if starving).
    dispatchRun({ type: 'consumeFoodPerHop' })

    // Region transition is a "cleared" hop — no encounter roll.
    if (regionEdge && !inMap) {
      const targetMapId = regionEdge.fromMapId === mapId ? regionEdge.toMapId : regionEdge.fromMapId
      dispatchRun({
        type: 'enterMap',
        payload: { mapId: asMapId(targetMapId), nodeId: asNodeId(nextNodeId) },
      })
      // Advance the path
      consumeHopHead()
      return
    }

    if (!inMap) {
      // Unknown destination — abort path
      dispatchRun({ type: 'startTravelPath', payload: { path: { remainingNodeIds: [], totalHopsThisLeg: 0, rngBranch: rngState } } })
      return
    }

    const type = inMap.type
    const edge = map.edges.find(
      (e) => (e.from === currentNodeId && e.to === nextNodeId)
        || (e.to === currentNodeId && e.from === nextNodeId),
    )
    const rollChance = edge?.rollChance ?? 0.3

    // Towns / dungeons / exits never roll travel encounters.
    const shouldRoll = hopRng.next() < rollChance
      && type !== 'town' && type !== 'dungeon' && type !== 'exit'

    if (shouldRoll) {
      const encounterRng = deriveRng(parent, `encounter:${mapId}:${currentNodeId}->${nextNodeId}`)
      const oneShots = useRunStore.getState().oneShotsFired
      const tableForRegion = ENCOUNTER_TABLES[map.regionId ?? 'borderlands'] ?? ENCOUNTER_TABLES['borderlands']!
      const result = rollEncounter(
        tableForRegion,
        predicateStateFromRun(useRunStore.getState()),
        oneShots,
        encounterRng,
      )
      diag('encounter', 'roll', {
        from: currentNodeId,
        to: nextNodeId,
        table: tableForRegion.id,
        result: result ? { entryId: result.entryId, outcomeKind: result.outcome.kind, oneShot: result.oneShot } : null,
      })
      if (result) {
        if (result.oneShot) {
          dispatchRun({ type: 'markEncounterFired', payload: { encounterId: result.entryId } })
        }
        if (result.outcome.kind === 'dialogue') {
          // Dialogue suspends the path — useEffect resumes after pendingDialogue clears.
          dispatchRun({
            type: 'startDialogue',
            payload: { dialogueId: asDialogueId(result.outcome.dialogueId), nodeId: 'start' },
          })
          return
        }
        if (result.outcome.kind === 'battle') {
          // Combat suspends; player resumes from overworld after victory.
          _onTravelToCombat(asNodeId(nextNodeId), result.outcome.enemyGroupId)
          return
        }
        if (result.outcome.kind === 'checkEvent') {
          // Suspend travel via local modal — useEffect resumes after activeCheckEvent clears.
          setActiveCheckEvent(result.outcome.event as CheckEvent)
          return
        }
      }
    }

    // No encounter (or roll missed) → arrive normally
    dispatchRun({ type: 'arriveAtNode', payload: { nodeId: asNodeId(nextNodeId) } })
    consumeHopHead()

    // Routing on arrival: only OPEN the quick-action menu when this is the
    // DESTINATION of the travel path — i.e. no remaining hops queued.
    // Intermediate towns/camps/dungeons just pass through. The player asked
    // for this M&B-style "ride past unless you click on it" behavior. If
    // they want to interact with an intermediate node, they click it
    // explicitly (handleNodeClick on same-node also opens the menu).
    const hopsLeft = useRunStore.getState().pendingTravelPath?.remainingNodeIds.length ?? 0
    const isFinalDestination = hopsLeft === 0
    if (
      isFinalDestination
      && (type === 'town' || type === 'camp' || type === 'dungeon' || type === 'exit')
    ) {
      setQuickMenuNode({ id: nextNodeId, type })
    }
  }

  const consumeHopHead = (): void => {
    const path = useRunStore.getState().pendingTravelPath
    if (!path || path.remainingNodeIds.length === 0) return
    const remaining = path.remainingNodeIds.slice(1)
    dispatchRun({
      type: 'startTravelPath',
      payload: {
        path: {
          remainingNodeIds: remaining,
          totalHopsThisLeg: path.totalHopsThisLeg,
          rngBranch: path.rngBranch,
        },
      },
    })
  }

  // Set out along a node sequence: hand the full path to the travel store and
  // let the hop-walker (above) ride it stop by stop.
  const commitTravel = (route: string[]): void => {
    if (route.length === 0) return
    diag('path', 'committed', { from: currentNodeId, to: route[route.length - 1], hops: route.length, route })
    setHoverNodeId(null)
    // Close any open quick-action menu — an open menu pauses the hop driver, so
    // starting a journey while one lingers would silently strand the party.
    setQuickMenuNode(null)
    dispatchRun({
      type: 'startTravelPath',
      payload: {
        path: {
          remainingNodeIds: route.map((id) => asNodeId(id)),
          totalHopsThisLeg: route.length,
          rngBranch: useRunStore.getState().rngState,
        },
      },
    })
  }

  // ── Click on a node: travel there immediately (FTL-style "click → go") ─────
  // A single click sets the party out toward the clicked node, auto-pathing
  // through any intermediate stops. No plot-then-confirm step — the map is the
  // command, not a planning surface. Towns/camps/etc. open their action menu on
  // ARRIVAL (see executeHop's final-destination branch).
  const handleNodeClick = (nodeId: string): void => {
    if (dragState.current.moved) return       // dragging — ignore click
    if (pendingDialogue) return               // dialogue blocks travel
    if (pendingTravelPath && pendingTravelPath.remainingNodeIds.length > 0) return // already traveling

    // Click the CURRENT node = open its quick-action menu (you're already here).
    if (nodeId === currentNodeId) {
      const here = map.nodes.find((n) => n.id === nodeId)
      if (!here) return
      if (here.type === 'town' || here.type === 'camp' || here.type === 'dungeon' || here.type === 'exit') {
        setQuickMenuNode({ id: nodeId, type: here.type })
      }
      return
    }

    // Region-edge transition is a single special hop into the next map.
    const regionEdge = (map.regionEdges ?? []).find(
      (re) => (re.fromMapId === mapId && re.fromNodeId === currentNodeId && re.toNodeId === nodeId)
        || (re.toMapId === mapId && re.toNodeId === currentNodeId && re.fromNodeId === nodeId),
    )
    if (regionEdge) {
      commitTravel([nodeId])
      return
    }

    // Any other node: path from here and set out at once.
    const leg = findPath(graph, currentNodeId, nodeId)
    if (!leg || leg.length === 0) {
      diag('path', 'unreachable', { from: currentNodeId, to: nodeId, mapId }, 'warn')
      return
    }
    commitTravel(leg)
  }

  // ── Hover preview: the road + cost from here to the hovered node ─────
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null)
  const hoverPath = useMemo(() => {
    if (!hoverNodeId || hoverNodeId === currentNodeId) return null
    return findPath(graph, currentNodeId, hoverNodeId)
  }, [hoverNodeId, currentNodeId, graph])

  // ── Render ───────────────────────────────────────────────────────
  const regionId = region?.id ?? 'borderlands'
  const pal = regionPalette(regionId)
  const isTraveling = !!(pendingTravelPath && pendingTravelPath.remainingNodeIds.length > 0)

  // Which way is the journey headed? Drives band scroll + caravan facing.
  const nextNodeOnPath = pendingTravelPath?.remainingNodeIds?.[0] as unknown as string | undefined
  const direction: 1 | -1 = useMemo(() => {
    if (!nextNodeOnPath) return 1
    const cur = map.nodes.find((n) => n.id === currentNodeId)
    const next = map.nodes.find((n) => n.id === nextNodeOnPath)
    if (!cur || !next) return 1
    return next.position.x >= cur.position.x ? 1 : -1
  }, [nextNodeOnPath, currentNodeId, map])

  // Journey readout for the travel band: the next stop's display name + how many
  // hops remain. Null when not traveling so the band shows its idle vista.
  const journey: { nextName: string; hopsLeft: number } | null =
    isTraveling && nextNodeOnPath
      ? {
          nextName: map.nodes.find((n) => n.id === nextNodeOnPath)?.name ?? nextNodeOnPath.replace(/_/g, ' '),
          hopsLeft: pendingTravelPath!.remainingNodeIds.length,
        }
      : null

  // Cross-region-reachable node ids — the OTHER endpoint of each regionEdge from here.
  const crossRegionTargets = new Set(
    regionEdgesFromHere.map((re) =>
      re.fromMapId === mapId && re.fromNodeId === currentNodeId ? re.toNodeId
      : re.toMapId === mapId && re.toNodeId === currentNodeId ? re.fromNodeId
      : '',
    ).filter(Boolean),
  )

  // Active travel hop (current → next remaining node) gets the marching comet.
  const activeEdgeKey = nextNodeOnPath ? edgeKey(currentNodeId, nextNodeOnPath) : null
  // Edges on the hover-preview leg get the lit "hover" treatment.
  const hoverEdgeKeys = useMemo(() => {
    const s = new Set<string>()
    if (!hoverPath || hoverPath.length === 0) return s
    const seq = [currentNodeId, ...hoverPath]
    for (let i = 0; i < seq.length - 1; i++) s.add(edgeKey(seq[i]!, seq[i + 1]!))
    return s
  }, [hoverPath, currentNodeId])

  return (
    <div
      id="overworld-scene"
      className="h-full w-full text-amber-100 font-body overflow-hidden relative"
      style={{ background: '#100b07' }}
    >
      {/* ── TRAVEL BAND — side-view journey window (no interaction) ───── */}
      <div className="absolute left-0 top-0" style={{ width: STAGE_W, height: BAND_H }}>
        <TravelBand
          regionId={regionId}
          traveling={isTraveling}
          direction={direction}
          width={STAGE_W}
          height={BAND_H}
          journey={journey}
          arrivalName={arrivalFlash}
        />
      </div>

      {/* ── SEAM — carved desk edge between window and chart ──────────── */}
      <div
        aria-hidden
        className="absolute left-0 z-30"
        style={{
          top: BAND_H,
          width: STAGE_W,
          height: SEAM_H,
          background: 'linear-gradient(to bottom, #41301c 0%, #241809 40%, #0d0804 100%)',
          borderTop: '1px solid rgba(201,152,92,0.45)',
          boxShadow: '0 4px 10px rgba(10,6,2,0.6)',
        }}
      />

      {/* ── PAPER MAP — the interactive parchment chart ───────────────── */}
      <div
        className="absolute left-0 overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ top: MAP_TOP, width: STAGE_W, height: MAP_H }}
        onMouseDown={onPanStart}
        onMouseMove={onPanMove}
        onMouseUp={onPanEnd}
        onMouseLeave={onPanEnd}
      >
        {/* Pan layer — everything inside transforms together (X only). */}
        <div
          className="absolute top-0 left-0"
          style={{
            width: map.width,
            height: map.height,
            transform: `translate3d(${cameraX}px, 0, 0)`,
            transition: dragState.current.active ? 'none' : 'transform 200ms ease-out',
          }}
        >
          <PaperMap width={map.width} height={map.height} mapId={mapId} palette={pal} nodes={map.nodes} />

          {/* Hand-inked roads: dashed ink base + wet-ink overdraw for the
              planned itinerary + ember comet on the active hop. */}
          <OverworldRoads
            edges={map.edges}
            nodes={map.nodes}
            currentNodeId={currentNodeId}
            plannedEdgeKeys={NO_EDGE_KEYS}
            hoverEdgeKeys={hoverEdgeKeys}
            activeEdgeKey={activeEdgeKey}
            width={map.width}
            height={map.height}
            palette={pal}
          />

          {/* Party token — walks the actual road spline between nodes. */}
          <Caravan nodes={map.nodes} currentNodeId={currentNodeId} walkMs={MARKER_WALK_MS} palette={pal} />

          {/* Region-edge stubs — ink notes pointing to off-map destinations */}
          {regionEdgesFromHere.map((re, i) => {
            const cur = map.nodes.find((n) => n.id === currentNodeId)
            if (!cur) return null
            const otherMapId = re.fromMapId === mapId ? re.toMapId : re.fromMapId
            const dir = otherMapId === 'thornwood' ? 1 : otherMapId === 'borderlands' ? -1 : 1
            return (
              <div
                key={`re-${i}`}
                className="absolute flex items-center gap-1 voice-display text-xs italic tracking-[0.06em]"
                style={{
                  left: cur.position.x + dir * 80 - 30,
                  top: cur.position.y - 44,
                  color: pal.accent,
                  textShadow: '0 1px 0 rgba(240,231,206,0.9), 0 0 2px rgba(240,231,206,0.6)',
                }}
              >
                <Icon name="arrow-right" size={12} />
                {REGIONS[otherMapId]?.name ?? otherMapId}
              </div>
            )
          })}

          {/* Nodes */}
          {map.nodes.map((node) => {
            const isCurrent = node.id === currentNodeId
            const isAdjacent = neighbors.has(node.id)
            const isOnHoverPath = hoverPath?.includes(node.id) ?? false
            const visitKey = `overworld:${mapId}:${node.id}`
            const isVisited = visitedNodes[visitKey] === true
            const hasQuest =
              mapId === 'borderlands'
              && node.id === 'pine_crossing'
              && Object.keys(questStates).length === 0

            const isHovered = hoverNodeId === node.id
            const state: NodeVisualState =
              isCurrent ? 'current'
                : isHovered ? 'hover'
                  : (isAdjacent || isOnHoverPath) ? 'reachable'
                    : 'distant'
            const progress: NodeProgress = isVisited && !isCurrent ? 'visited' : 'unvisited'
            return (
              <React.Fragment key={node.id}>
                <NodeBeacon
                  node={node}
                  state={state}
                  progress={progress}
                  palette={pal}
                  onPress={() => handleNodeClick(node.id)}
                  onHover={(h) => {
                    if (h) setHoverNodeId(node.id)
                    else setHoverNodeId((id) => (id === node.id ? null : id))
                  }}
                />
                {hasQuest && (
                  <div
                    id={`node-${node.id}-quest`}
                    className="absolute rounded-full bg-amber-400 text-stone-950 flex items-center justify-center border border-amber-700 pointer-events-none"
                    style={{
                      left: node.position.x + 14,
                      top: node.position.y - 30,
                      width: 18,
                      height: 18,
                      animation: 'overworldPulse 1.5s ease-in-out infinite',
                    }}
                    aria-label="quest available"
                  >
                    <Icon name="quest" size={14} />
                  </div>
                )}
                {crossRegionTargets.has(node.id) && (
                  <div
                    className="absolute text-xs italic pointer-events-none flex items-center gap-1"
                    style={{
                      left: node.position.x - 30,
                      top: node.position.y + 30,
                      width: 100,
                      justifyContent: 'center',
                      color: pal.accent,
                      opacity: 0.9,
                    }}
                  >
                    <Icon name="arrow-right" size={12} /> region edge
                  </div>
                )}
                {/* Node label — cartographer's ink, crisp parchment halo (never
                    white-on-black). Hidden while this node's quick-menu is open
                    so the name doesn't triple up with the menu title at arrival.
                    Screen-space clamped: the label lives in the pan layer (moved
                    by cameraX), so clamp its on-screen X into the viewport, then
                    convert back to pan-layer left. */}
                {quickMenuNode?.id !== node.id && (() => {
                  // CENTER the 160px label box on the disc (the old left-edge
                  // anchoring floated every name ~80px right of its node), and
                  // alternate above/below placement by a stable id hash so
                  // clustered nodes don't stack their labels (QA sweep).
                  const idStr2 = node.id as unknown as string
                  let h = 0
                  for (let ci = 0; ci < idStr2.length; ci++) h = (h * 31 + idStr2.charCodeAt(ci)) >>> 0
                  const below = h % 2 === 0
                  const screenX = node.position.x + cameraX
                  // Off-screen discs get NO label — the old edge-clamping
                  // squeezed every off-view name into one overlapping column.
                  if (screenX < 40 || screenX > STAGE_W - 40) return null
                  const clampedScreenX = Math.min(STAGE_W - 86, Math.max(86, screenX))
                  const labelLeft = clampedScreenX - cameraX - 80
                  return (
                    <div
                      className={
                        'absolute text-center voice-display tracking-[0.06em] pointer-events-none whitespace-nowrap '
                        + (isCurrent ? 'font-bold' : '')
                      }
                      style={{
                        left: labelLeft,
                        top: below ? node.position.y + 28 : node.position.y - 44,
                        width: 160,
                        fontSize: 12,
                        fontWeight: isCurrent ? 700 : 600,
                        color: isCurrent ? pal.accent : pal.ink,
                        opacity: 1,
                        textShadow: '0 1px 0 rgba(240,231,206,0.9), 0 0 2px rgba(240,231,206,0.6)',
                      }}
                    >
                      {node.name ?? node.id.replace(/_/g, ' ')}
                    </div>
                  )
                })()}
              </React.Fragment>
            )
          })}

          {/* Hover-cost readout — pinned to the hovered node (not the screen
              bottom), so the hops/food/starvation math sits where the eye is.
              Same dark panel styling as before. */}
          {hoverNodeId && hoverPath && hoverPath.length > 0 && !isTraveling && (() => {
            const hn = map.nodes.find((n) => n.id === hoverNodeId)
            if (!hn) return null
            const TIP_W = 184
            const left = Math.min(Math.max(8, hn.position.x + 28), map.width - TIP_W - 8)
            const top = Math.max(8, hn.position.y - 44)
            return (
              <div
                className="absolute px-3 py-1.5 bg-stone-950/95 border border-amber-900/60 rounded text-xs tracking-wider pointer-events-none z-20"
                style={{ left, top, width: TIP_W }}
              >
                <span className="text-[color:var(--color-text-muted)]"><span className="numeral">{hoverPath.length}</span> hop{hoverPath.length === 1 ? '' : 's'}</span>
                {' · '}
                <span className={foodCount >= hoverPath.length ? 'text-amber-200' : foodCount > 0 ? 'text-amber-500' : 'text-red-400'}>
                  cost <span className="numeral">{hoverPath.length}</span> food
                </span>
                {foodCount < hoverPath.length && (
                  <div className="text-red-400 mt-0.5 inline-flex items-center gap-1">
                    <Icon name="skull" size={11} /> starvation: <span className="numeral">{(hoverPath.length - foodCount) * 3}</span> HP/unit
                  </div>
                )}
              </div>
            )
          })()}

          {/* Quick-action menu (M&B-style) anchored to the current node when set */}
          {quickMenuNode && (() => {
            const node = map.nodes.find((n) => n.id === quickMenuNode.id)
            if (!node) return null
            const hasMoreHops = (pendingTravelPath?.remainingNodeIds.length ?? 0) > 0
            const id = asNodeId(node.id)
            const actions: NodeQuickAction[] = []
            // Type-specific entry options
            if (node.type === 'town') {
              actions.push(
                { id: 'enter', label: 'Enter Town', icon: 'town', onChoose: () => onEnterTown(id) },
                { id: 'inn',    label: 'Visit Inn',    icon: 'rest',  onChoose: () => onEnterTown(id, 'inn') },
                { id: 'shop',   label: 'Visit Shop',   icon: 'shop',  onChoose: () => onEnterTown(id, 'shop') },
                { id: 'tavern', label: 'Visit Tavern', icon: 'event', onChoose: () => onEnterTown(id, 'tavern') },
              )
            } else if (node.type === 'camp') {
              actions.push({ id: 'enter', label: 'Make Camp', icon: 'camp', onChoose: () => onEnterCamp(id) })
            } else if (node.type === 'dungeon') {
              actions.push({ id: 'enter', label: 'Enter Dungeon', icon: 'dungeon', onChoose: () => onEnterDungeon(id) })
            } else if (node.type === 'exit') {
              actions.push({ id: 'exit', label: 'Challenge the Iron Throne', icon: 'combat', onChoose: () => onWin() })
            }
            // Travel continuation
            if (hasMoreHops) {
              actions.push({
                id: 'continue',
                label: 'Continue Travel',
                icon: 'arrow-right',
                onChoose: () => { /* menu dismisses; useEffect resumes hop */ },
              })
            }
            actions.push({
              id: 'stay',
              label: hasMoreHops ? 'Stay Here' : 'Close',
              icon: 'cross',
              onChoose: () => {
                if (hasMoreHops) {
                  // Cancel rest of journey
                  dispatchRun({
                    type: 'startTravelPath',
                    payload: {
                      path: { remainingNodeIds: [], totalHopsThisLeg: 0, rngBranch: useRunStore.getState().rngState },
                    },
                  })
                }
              },
            })
            // Flip the menu to the LEFT of the node when its right edge would
            // clip past the stage (far-right exit node would otherwise bury the
            // win button). 36px gap + 220px menu width = 256px reach.
            const side: 'left' | 'right' =
              node.position.x + cameraX + 36 + 220 > STAGE_W - 8 ? 'left' : 'right'
            return (
              <NodeQuickActionMenu
                title={node.name ?? node.id.replace(/_/g, ' ')}
                subtitle={node.type.toUpperCase()}
                anchor={{ x: node.position.x, y: node.position.y }}
                actions={actions}
                onDismiss={() => setQuickMenuNode(null)}
                side={side}
              />
            )
          })()}
        </div>

        {/* Candle-light vignette over the chart — fixed to the viewport, so the
            desk reads lit from above while corners fall into shadow. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(120% 135% at 50% 28%, transparent 52%, rgba(40,24,10,0.38) 100%)',
          }}
        />
      </div>

      {/* Persistent game HUD — party roster docks BOTTOM-LEFT (empty parchment
          in every region) so it never buries the current wax-seal node or clips
          edge labels. `surface="parchment"` themes it for the chart, not the
          dark band. */}
      <GameHud
        regionName={region?.name}
        location={map.nodes.find((n) => n.id === currentNodeId)?.name ?? currentNodeId.replace(/_/g, ' ')}
        partyClassName="left-4 bottom-6"
        surface="parchment"
      />

      {/* Bottom status line — ink on the chart margin. Click a node to travel
          straight there; drag to pan. */}
      <div
        className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none z-10"
        style={{ bottom: 4, color: pal.ink, fontSize: 11, letterSpacing: '0.08em' }}
      >
        {isTraveling
          ? `traveling… ${pendingTravelPath.remainingNodeIds.length} hop${pendingTravelPath.remainingNodeIds.length === 1 ? '' : 's'} left`
          : 'click a node to travel · drag to pan'}
      </div>

      <style>{`
        @keyframes overworldPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.85; }
        }
      `}</style>

      {activeCheckEvent && (
        <CheckEventModal
          event={activeCheckEvent}
          party={Object.values(useRunStore.getState().party.units)}
          gold={useRunStore.getState().gold}
          foodCount={
            useRunStore
              .getState()
              .inventory.items.filter((i) => (i.itemId as unknown as string) === 'food_rations').length
          }
          onResolve={({ outcome }) => {
            if (outcome.effects.length > 0) {
              dispatchRun({
                type: 'applyQuestEffects',
                payload: { effects: outcome.effects as QuestEffect[] },
              })
            }
            setActiveCheckEvent(null)
          }}
          onClose={() => setActiveCheckEvent(null)}
        />
      )}
    </div>
  )
}
