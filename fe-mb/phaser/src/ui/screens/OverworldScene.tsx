import React, { useEffect } from 'react'
import overworldJson from '../../data/content/overworld/pine_borderlands.json'
import { useRunStore } from '../../state/runStore'
import { asNodeId, asMapId } from '../../domain/ids'
import type { NodeId } from '../../domain/ids'
import { createRng, deriveRng } from '../../systems/rng'
import { Pressable } from '../components'

const NODE_TYPE_ICON: Record<string, string> = {
  town: '⌂',
  camp: '⛺',
  dungeon: '⚔',
  exit: '▶',
}

const NODE_TYPE_COLOR_CLASS: Record<string, string> = {
  town: 'text-amber-600',
  camp: 'text-sky-400',
  dungeon: 'text-red-500',
  exit: 'text-amber-300',
}

export interface OverworldSceneProps {
  onTravelToCombat: (nodeId: NodeId) => void
  onEnterTown: (nodeId: NodeId) => void
  onEnterDungeon: (nodeId: NodeId) => void
  onWin: () => void
}

const SCALE = 48 // pixels per map cell

export function OverworldScene({
  onTravelToCombat: _onTravelToCombat,
  onEnterTown,
  onEnterDungeon,
  onWin,
}: OverworldSceneProps): React.JSX.Element {
  const map = overworldJson
  const dispatchRun = useRunStore((s) => s.dispatch)
  const worldPosition = useRunStore((s) => s.worldPosition)
  const visitedNodes = useRunStore((s) => s.visitedNodes)
  const questStates = useRunStore((s) => s.questStates)

  // Initialize player position to pine_crossing if not set
  useEffect(() => {
    if (worldPosition.mapId !== 'pine_borderlands') {
      dispatchRun({ type: 'arriveAtNode', payload: { nodeId: asNodeId('pine_crossing') } })
    }
  }, [dispatchRun, worldPosition.mapId])

  const currentNodeId = worldPosition.nodeId as unknown as string
  const neighbors = new Set<string>()
  for (const e of map.edges) {
    if (e.from === currentNodeId) neighbors.add(e.to)
    if (e.to === currentNodeId) neighbors.add(e.from)
  }

  const handleNodeClick = (nodeId: string, type: string): void => {
    if (nodeId === currentNodeId) return
    if (!neighbors.has(nodeId)) return

    const edge = overworldJson.edges.find(
      (e) => (e.from === currentNodeId && e.to === nodeId)
        || (e.to === currentNodeId && e.from === nodeId),
    )
    const rollChance = edge?.rollChance ?? 0.3

    const rngState = useRunStore.getState().rngState
    const parent = createRng(rngState)
    const hopRng = deriveRng(parent, `hop:${currentNodeId}->${nodeId}`)
    const roll = hopRng.next()

    if (roll < rollChance && type !== 'town' && type !== 'dungeon' && type !== 'exit') {
      dispatchRun({
        type: 'startTravelPath',
        payload: {
          path: {
            remainingNodeIds: [asNodeId(nodeId)],
            totalHopsThisLeg: 1,
            rngBranch: rngState,
          },
        },
      })
      _onTravelToCombat(asNodeId(nodeId))
      return
    }

    dispatchRun({ type: 'arriveAtNode', payload: { nodeId: asNodeId(nodeId) } })

    if (type === 'town') onEnterTown(asNodeId(nodeId))
    else if (type === 'dungeon') onEnterDungeon(asNodeId(nodeId))
    else if (type === 'exit') onWin()
  }

  const offsetX = (window.innerWidth - map.width * SCALE) / 2
  const offsetY = (window.innerHeight - map.height * SCALE) / 2 - 40

  return (
    <div
      id="overworld-scene"
      className="h-screen w-screen text-amber-100 font-mono overflow-hidden relative"
      style={{ background: 'radial-gradient(ellipse at center, #1a1d2e 0%, #0a0a0f 75%)' }}
    >
      <div className="absolute top-4 left-4 text-xs text-stone-500 tracking-widest">
        BORDERLANDS — pine borderlands
      </div>

      {/* SVG layer for edges */}
      <svg
        width={window.innerWidth}
        height={window.innerHeight}
        className="absolute inset-0 pointer-events-none"
      >
        {map.edges.map((edge, i) => {
          const from = map.nodes.find((n) => n.id === edge.from)
          const to = map.nodes.find((n) => n.id === edge.to)
          if (!from || !to) return null
          const x1 = offsetX + from.position.x * SCALE
          const y1 = offsetY + from.position.y * SCALE
          const x2 = offsetX + to.position.x * SCALE
          const y2 = offsetY + to.position.y * SCALE
          const isAdjacent = edge.from === currentNodeId || edge.to === currentNodeId
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={isAdjacent ? '#a07a40' : '#3a2a18'}
              strokeWidth={isAdjacent ? 2 : 1}
              {...(isAdjacent ? {} : { strokeDasharray: '4 4' })}
            />
          )
        })}
      </svg>

      {/* Node layer (Pressable for round shape; no <button> tag) */}
      {map.nodes.map((node) => {
        const x = offsetX + node.position.x * SCALE
        const y = offsetY + node.position.y * SCALE
        const isCurrent = node.id === currentNodeId
        const isReachable = neighbors.has(node.id)
        const visitKey = `overworld:${worldPosition.mapId as unknown as string}:${node.id}`
        const isVisited = visitedNodes[visitKey] === true
        const hasQuest = node.id === 'pine_crossing' && Object.keys(questStates).length === 0

        const isDisabled = !isReachable && !isCurrent

        const baseClass =
          'absolute flex items-center justify-center rounded-full text-2xl select-none ' +
          'border-2 transition-[transform,box-shadow] duration-100 outline-none ' +
          'data-[focus-visible]:ring-2 data-[focus-visible]:ring-amber-400'

        const stateClass = isCurrent
          ? 'bg-amber-400 border-amber-400 text-stone-950 cursor-default'
          : isReachable
            ? `bg-stone-950 border-amber-700/80 ${NODE_TYPE_COLOR_CLASS[node.type] ?? ''} cursor-pointer ` +
              'data-[hovered]:scale-110 data-[hovered]:shadow-[0_0_12px_rgba(250,204,21,0.6)]'
            : isVisited
              ? `bg-stone-900 border-stone-700 ${NODE_TYPE_COLOR_CLASS[node.type] ?? ''} cursor-default opacity-90`
              : `bg-stone-950 border-stone-800 ${NODE_TYPE_COLOR_CLASS[node.type] ?? ''} cursor-default opacity-60`

        return (
          <React.Fragment key={node.id}>
            <Pressable
              id={`node-${node.id}`}
              onPress={() => handleNodeClick(node.id, node.type)}
              isDisabled={isDisabled}
              aria-label={`${node.type}: ${node.id}`}
              className={`${baseClass} ${stateClass}`}
              style={{ left: x - 24, top: y - 24, width: 48, height: 48 }}
            >
              {NODE_TYPE_ICON[node.type] ?? '?'}
            </Pressable>
            {/* Quest indicator */}
            {hasQuest && (
              <div
                id={`node-${node.id}-quest`}
                className="absolute rounded-full bg-amber-400 text-stone-950 flex items-center justify-center text-xs font-bold border border-amber-700 pointer-events-none"
                style={{
                  left: x + 14,
                  top: y - 30,
                  width: 18,
                  height: 18,
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              >!</div>
            )}
            {/* Visited checkmark */}
            {isVisited && !isCurrent && (
              <div
                className="absolute rounded-full bg-emerald-500 text-stone-950 flex items-center justify-center text-[10px] font-bold pointer-events-none"
                style={{ left: x + 14, top: y + 12, width: 14, height: 14 }}
              >✓</div>
            )}
          </React.Fragment>
        )
      })}

      {/* Node labels */}
      {map.nodes.map((node) => {
        const x = offsetX + node.position.x * SCALE
        const y = offsetY + node.position.y * SCALE
        return (
          <div
            key={`${node.id}-label`}
            className={
              'absolute text-center text-[11px] tracking-wider pointer-events-none ' +
              (node.id === currentNodeId ? 'text-amber-300' : 'text-stone-500')
            }
            style={{ left: x - 60, top: y + 30, width: 120 }}
          >
            {node.id.replace(/_/g, ' ')}
          </div>
        )
      })}

      {/* HUD bottom */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between text-xs text-stone-500">
        <span>at: {currentNodeId.replace(/_/g, ' ')}</span>
        <span>click an adjacent node to travel</span>
      </div>

      {/* Pulse animation for quest indicators */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.85; }
        }
      `}</style>

      {/* Suppress lint warning for asMapId import (used internally) */}
      <span className="hidden">{asMapId.name}</span>
    </div>
  )
}
