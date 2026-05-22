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
import { Icon, type IconName, PartyChip, Pressable } from '../components'
import { CheckEventModal, type CheckEvent } from '../modals/CheckEventModal'
import type { QuestEffect } from '../../domain/quest'

const NODE_TYPE_ICON: Record<string, IconName> = {
  town: 'town',
  camp: 'camp',
  dungeon: 'dungeon',
  exit: 'exit',
}

const NODE_TYPE_COLOR_CLASS: Record<string, string> = {
  town: 'text-amber-600',
  camp: 'text-sky-400',
  dungeon: 'text-red-500',
  exit: 'text-amber-300',
}

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
  nodes: { id: string; name?: string; type: string; position: { x: number; y: number }; encounterTableId?: string }[]
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

export interface OverworldSceneProps {
  onTravelToCombat: (nodeId: NodeId) => void
  onEnterTown: (nodeId: NodeId) => void
  onEnterCamp: (nodeId: NodeId) => void
  onEnterDungeon: (nodeId: NodeId) => void
  onWin: () => void
}

const HOP_DELAY_MS = 350

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

  const mapId = (worldPosition.mapId as unknown as string) || 'borderlands'
  const map = MAPS[mapId] ?? MAPS['borderlands']!
  const region = map.regionId ? REGIONS[map.regionId] : undefined

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

  // ── Camera (pan via drag) ────────────────────────────────────────
  const [camera, setCamera] = useState({ x: 0, y: 0 })
  const dragState = useRef<{
    active: boolean
    startX: number
    startY: number
    baseX: number
    baseY: number
    moved: boolean
  }>({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0, moved: false })

  // Center camera on current node when map or node changes (and not actively dragging).
  useEffect(() => {
    const cur = map.nodes.find((n) => n.id === currentNodeId)
    if (!cur) return
    setCamera({
      x: window.innerWidth / 2 - cur.position.x,
      y: window.innerHeight / 2 - cur.position.y - 40,
    })
  }, [mapId, currentNodeId, map])

  const onPanStart = (e: React.MouseEvent): void => {
    if ((e.target as HTMLElement).closest('[id^="node-"]')) return
    dragState.current = {
      active: true,
      startX: e.clientX, startY: e.clientY,
      baseX: camera.x, baseY: camera.y,
      moved: false,
    }
  }
  const onPanMove = (e: React.MouseEvent): void => {
    if (!dragState.current.active) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    // Bumped 3 → 8: tiny mouse jitter during a click was being misclassified as
    // a drag and silently swallowing the click on overworld nodes.
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) dragState.current.moved = true
    setCamera({ x: dragState.current.baseX + dx, y: dragState.current.baseY + dy })
  }
  const onPanEnd = (): void => {
    dragState.current.active = false
  }

  // ── Pending combat from a dialogue's `startCombat` effect ───────
  useEffect(() => {
    if (!pendingCombat) return
    if (pendingDialogue) return
    dispatchRun({ type: 'clearPendingCombat' })
    _onTravelToCombat(asNodeId(currentNodeId))
  }, [pendingCombat, pendingDialogue, currentNodeId, _onTravelToCombat, dispatchRun])

  // ── Multi-hop travel via pendingTravelPath ──────────────────────
  const pendingTravelPath = useRunStore((s) => s.pendingTravelPath)
  const advancingRef = useRef(false)

  // Drive the next hop whenever there's a pending path AND no dialogue blocking.
  useEffect(() => {
    if (!pendingTravelPath || pendingTravelPath.remainingNodeIds.length === 0) return
    if (pendingDialogue) return
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
  }, [pendingTravelPath, pendingDialogue])

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
          _onTravelToCombat(asNodeId(nextNodeId))
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

    // Routing on arrival
    if (type === 'town') onEnterTown(asNodeId(nextNodeId))
    else if (type === 'camp') onEnterCamp(asNodeId(nextNodeId))
    else if (type === 'dungeon') onEnterDungeon(asNodeId(nextNodeId))
    else if (type === 'exit') onWin()
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

  // ── Click on a node ──────────────────────────────────────────────
  const handleNodeClick = (nodeId: string): void => {
    if (dragState.current.moved) return       // dragging — ignore click
    if (pendingDialogue) return               // dialogue blocks travel
    if (pendingTravelPath && pendingTravelPath.remainingNodeIds.length > 0) return // already traveling

    // Click on the CURRENT node = re-enter its scene (town/camp/dungeon) or
    // be a no-op for camps with no scene. Without this, players who closed
    // a town menu had no way to reopen it; food costs nothing because the
    // hop didn't happen.
    if (nodeId === currentNodeId) {
      const here = map.nodes.find((n) => n.id === nodeId)
      if (!here) return
      if (here.type === 'town') onEnterTown(asNodeId(nodeId))
      else if (here.type === 'camp') onEnterCamp(asNodeId(nodeId))
      else if (here.type === 'dungeon') onEnterDungeon(asNodeId(nodeId))
      else if (here.type === 'exit') onWin()
      return
    }

    // Check region-edge first: if clicked node is in this map's regionEdges, it's a 1-hop transition.
    const regionEdge = (map.regionEdges ?? []).find(
      (re) => (re.fromMapId === mapId && re.fromNodeId === currentNodeId && re.toNodeId === nodeId)
        || (re.toMapId === mapId && re.toNodeId === currentNodeId && re.fromNodeId === nodeId),
    )
    if (regionEdge) {
      dispatchRun({
        type: 'startTravelPath',
        payload: {
          path: {
            remainingNodeIds: [asNodeId(nodeId)],
            totalHopsThisLeg: 1,
            rngBranch: useRunStore.getState().rngState,
          },
        },
      })
      return
    }

    // BFS path within the current map.
    const path = findPath(graph, currentNodeId, nodeId)
    if (!path) {
      diag('path', 'unreachable', { from: currentNodeId, to: nodeId, mapId }, 'warn')
      return
    }
    diag('path', 'committed', { from: currentNodeId, to: nodeId, hops: path.length, path })
    dispatchRun({
      type: 'startTravelPath',
      payload: {
        path: {
          remainingNodeIds: path.map((id) => asNodeId(id)),
          totalHopsThisLeg: path.length,
          rngBranch: useRunStore.getState().rngState,
        },
      },
    })
  }

  // ── Hover preview ────────────────────────────────────────────────
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null)
  const hoverPath = useMemo(() => {
    if (!hoverNodeId || hoverNodeId === currentNodeId) return null
    const path = findPath(graph, currentNodeId, hoverNodeId)
    return path
  }, [hoverNodeId, currentNodeId, graph])

  // ── Render ───────────────────────────────────────────────────────
  const regionTint = region?.color ?? '#0a0a0f'
  const isTraveling = !!(pendingTravelPath && pendingTravelPath.remainingNodeIds.length > 0)

  // Cross-region-reachable node ids — the OTHER endpoint of each regionEdge from here.
  const crossRegionTargets = new Set(
    regionEdgesFromHere.map((re) =>
      re.fromMapId === mapId && re.fromNodeId === currentNodeId ? re.toNodeId
      : re.toMapId === mapId && re.toNodeId === currentNodeId ? re.fromNodeId
      : '',
    ).filter(Boolean),
  )

  return (
    <div
      id="overworld-scene"
      className="h-screen w-screen text-amber-100 font-mono overflow-hidden relative cursor-grab active:cursor-grabbing"
      onMouseDown={onPanStart}
      onMouseMove={onPanMove}
      onMouseUp={onPanEnd}
      onMouseLeave={onPanEnd}
      style={{
        background: `radial-gradient(ellipse at center, ${regionTint}33 0%, #0a0a0f 75%)`,
      }}
    >
      {/* Pan layer — everything inside transforms together. */}
      <div
        className="absolute top-0 left-0"
        style={{
          width: map.width,
          height: map.height,
          transform: `translate(${camera.x}px, ${camera.y}px)`,
          transition: dragState.current.active ? 'none' : 'transform 200ms ease-out',
        }}
      >
        {/* Player marker — animated via CSS transition on top/left so multi-
            hop travel actually walks between nodes instead of teleporting
            (the underlying nodes still snap their highlight, but the marker
            interpolates over HOP_DELAY_MS). */}
        {(() => {
          const cur = map.nodes.find((n) => n.id === currentNodeId)
          if (!cur) return null
          return (
            <div
              id="player-marker"
              className="absolute pointer-events-none z-20"
              style={{
                left: cur.position.x - 14,
                top: cur.position.y - 14,
                width: 28,
                height: 28,
                transition: 'left 320ms ease-in-out, top 320ms ease-in-out',
              }}
            >
              <div
                className="w-full h-full rounded-full bg-amber-300 border-2 border-amber-100 shadow-[0_0_18px_rgba(250,204,21,0.9)]"
                style={{
                  animation: 'overworldPulse 1.6s ease-in-out infinite',
                }}
              />
            </div>
          )
        })()}

        {/* Edges */}
        <svg
          width={map.width}
          height={map.height}
          className="absolute inset-0 pointer-events-none"
        >
          {map.edges.map((edge, i) => {
            const from = map.nodes.find((n) => n.id === edge.from)
            const to = map.nodes.find((n) => n.id === edge.to)
            if (!from || !to) return null
            const isAdjacent = edge.from === currentNodeId || edge.to === currentNodeId
            const isOnHoverPath =
              hoverPath && (
                (hoverPath.includes(edge.from) || edge.from === currentNodeId)
                && (hoverPath.includes(edge.to) || edge.to === currentNodeId)
                && Math.abs(
                  (hoverPath.indexOf(edge.from) === -1 ? -1 : hoverPath.indexOf(edge.from))
                  - (hoverPath.indexOf(edge.to) === -1 ? -1 : hoverPath.indexOf(edge.to)),
                ) === 1
              )
            return (
              <line
                key={i}
                x1={from.position.x}
                y1={from.position.y}
                x2={to.position.x}
                y2={to.position.y}
                stroke={isOnHoverPath ? '#facc15' : isAdjacent ? '#a07a40' : '#3a2a18'}
                strokeWidth={isOnHoverPath ? 3 : isAdjacent ? 2 : 1}
                {...(isOnHoverPath || isAdjacent ? {} : { strokeDasharray: '4 4' })}
              />
            )
          })}
        </svg>

        {/* Region-edge stubs — ghost lines to off-map destinations */}
        {regionEdgesFromHere.map((re, i) => {
          // Position a small marker at the boundary direction
          const cur = map.nodes.find((n) => n.id === currentNodeId)
          if (!cur) return null
          const otherMapId = re.fromMapId === mapId ? re.toMapId : re.fromMapId
          const dir = otherMapId === 'thornwood' ? 1 : otherMapId === 'borderlands' ? -1 : 1
          return (
            <div
              key={`re-${i}`}
              className="absolute text-xs text-amber-400/70 italic"
              style={{
                left: cur.position.x + dir * 80 - 30,
                top: cur.position.y - 8,
              }}
            >
              ⤳ {REGIONS[otherMapId]?.name ?? otherMapId}
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

          const baseClass =
            'absolute flex items-center justify-center rounded-full text-2xl select-none ' +
            'border-2 motion-safe:transition-[transform,box-shadow,background-color] motion-safe:duration-150 outline-none ' +
            'data-[focus-visible]:ring-2 data-[focus-visible]:ring-amber-400'

          const stateClass = isCurrent
            ? 'bg-amber-400 border-amber-400 text-stone-950 shadow-[0_0_20px_rgba(250,204,21,0.5)]'
            : isOnHoverPath
              ? `bg-stone-900 border-amber-400 ${NODE_TYPE_COLOR_CLASS[node.type] ?? ''} cursor-pointer`
              : isAdjacent
                ? `bg-stone-950 border-amber-700/80 ${NODE_TYPE_COLOR_CLASS[node.type] ?? ''} cursor-pointer ` +
                  'data-[hovered]:scale-110 data-[hovered]:shadow-[0_0_12px_rgba(250,204,21,0.6)]'
                : isVisited
                  ? `bg-stone-900 border-stone-700 ${NODE_TYPE_COLOR_CLASS[node.type] ?? ''} cursor-pointer opacity-95 ` +
                    'data-[hovered]:scale-105 data-[hovered]:border-amber-700'
                  : `bg-stone-950 border-stone-800 ${NODE_TYPE_COLOR_CLASS[node.type] ?? ''} cursor-pointer opacity-70 ` +
                    'data-[hovered]:scale-105 data-[hovered]:border-amber-700/60'

          return (
            <React.Fragment key={node.id}>
              <Pressable
                id={`node-${node.id}`}
                onPress={() => handleNodeClick(node.id)}
                aria-label={`${node.type}: ${node.name ?? node.id}`}
                className={`${baseClass} ${stateClass}`}
                style={{
                  left: node.position.x - 24,
                  top: node.position.y - 24,
                  width: 48,
                  height: 48,
                }}
              >
                <div
                  onMouseEnter={() => setHoverNodeId(node.id)}
                  onMouseLeave={() => setHoverNodeId((id) => (id === node.id ? null : id))}
                  className="flex items-center justify-center w-full h-full"
                >
                  <Icon
                    name={NODE_TYPE_ICON[node.type] ?? 'event'}
                    size={28}
                    aria-label={node.type}
                  />
                </div>
              </Pressable>
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
              {isVisited && !isCurrent && (
                <div
                  className="absolute rounded-full bg-emerald-500 text-stone-950 flex items-center justify-center pointer-events-none"
                  style={{ left: node.position.x + 14, top: node.position.y + 12, width: 14, height: 14 }}
                  aria-label="visited"
                >
                  <Icon name="check" size={10} />
                </div>
              )}
              {crossRegionTargets.has(node.id) && (
                <div
                  className="absolute text-[10px] text-amber-300 italic pointer-events-none flex items-center gap-1"
                  style={{ left: node.position.x - 30, top: node.position.y + 30, width: 100, justifyContent: 'center' }}
                >
                  <Icon name="arrow-right" size={10} /> region edge
                </div>
              )}
              {/* Node label */}
              <div
                className={
                  'absolute text-center text-[11px] tracking-wider pointer-events-none whitespace-nowrap ' +
                  (isCurrent ? 'text-amber-300 font-bold' : isOnHoverPath ? 'text-amber-200' : 'text-stone-500')
                }
                style={{ left: node.position.x - 80, top: node.position.y + 30, width: 160 }}
              >
                {node.name ?? node.id.replace(/_/g, ' ')}
              </div>
            </React.Fragment>
          )
        })}
      </div>

      {/* HUD overlay (does not pan) */}
      <div className="absolute top-4 left-4 px-3 py-2 bg-stone-950/85 border border-amber-900/50 rounded text-xs tracking-widest pointer-events-none">
        <span className="text-stone-500">REGION:</span>{' '}
        <span className="text-amber-300">{(region?.name ?? mapId).toUpperCase()}</span>
        {' · '}
        <span className="text-stone-500">at:</span>{' '}
        <span className="text-amber-100">
          {map.nodes.find((n) => n.id === currentNodeId)?.name ?? currentNodeId.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="absolute top-4 right-4 flex gap-3 items-start pointer-events-none">
        <PartyChip />
        <div className="px-3 py-2 bg-stone-950/85 border border-amber-900/50 rounded text-xs tracking-wider flex gap-4">
          <span>
            <span className="text-stone-500">FOOD:</span>{' '}
            <span className={foodCount === 0 ? 'text-red-400' : 'text-amber-200'}>{foodCount}</span>
          </span>
          <span>
            <span className="text-stone-500">GOLD:</span>{' '}
            <span className="text-amber-300">{useRunStore.getState().gold}g</span>
          </span>
        </div>
      </div>

      {/* Hover-path tooltip */}
      {hoverPath && hoverPath.length > 0 && !isTraveling && (
        <div
          className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-stone-950/95 border border-amber-900/60 rounded text-xs tracking-wider pointer-events-none z-10"
        >
          <span className="text-stone-400">{hoverPath.length} hop{hoverPath.length === 1 ? '' : 's'}</span>
          {' · '}
          <span className={foodCount >= hoverPath.length ? 'text-amber-200' : foodCount > 0 ? 'text-amber-500' : 'text-red-400'}>
            cost {hoverPath.length} food
          </span>
          {foodCount < hoverPath.length && (
            <span className="text-red-400 ml-2">
              ⚠ starvation: {(hoverPath.length - foodCount) * 3} HP/unit
            </span>
          )}
        </div>
      )}

      {/* Bottom HUD */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between text-xs text-stone-500 pointer-events-none">
        <span>
          {isTraveling
            ? `traveling… ${pendingTravelPath.remainingNodeIds.length} hop${pendingTravelPath.remainingNodeIds.length === 1 ? '' : 's'} left`
            : 'click any node to travel · drag to pan the map'}
        </span>
        <span>{map.nodes.length} known sites · {region?.name ?? ''}</span>
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
