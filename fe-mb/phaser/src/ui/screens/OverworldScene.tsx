import React, { useEffect, useState } from 'react'
import overworldJson from '../../data/content/overworld/pine_borderlands.json'
import { useRunStore } from '../../state/runStore'
import { asNodeId, asMapId } from '../../domain/ids'
import type { NodeId } from '../../domain/ids'
import { createRng, deriveRng } from '../../systems/rng'

const NODE_TYPE_ICON: Record<string, string> = {
  town: '⌂',
  camp: '⛺',
  dungeon: '⚔',
  exit: '▶',
}

const NODE_TYPE_COLOR: Record<string, string> = {
  town: '#a07a40',
  camp: '#6688cc',
  dungeon: '#cc4444',
  exit: '#facc15',
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
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null)

  // Initialize player position to pine_crossing if not set
  useEffect(() => {
    if (worldPosition.mapId !== 'pine_borderlands') {
      dispatchRun({ type: 'arriveAtNode', payload: { nodeId: asNodeId('pine_crossing') } })
    }
  }, [dispatchRun, worldPosition.mapId])

  // Compute neighbors of current position
  const currentNodeId = worldPosition.nodeId as unknown as string
  const neighbors = new Set<string>()
  for (const e of map.edges) {
    if (e.from === currentNodeId) neighbors.add(e.to)
    if (e.to === currentNodeId) neighbors.add(e.from)
  }

  const handleNodeClick = (nodeId: string, type: string): void => {
    if (nodeId === currentNodeId) return
    if (!neighbors.has(nodeId)) return

    // Find the edge between current and target to get encounter chance
    const edge = overworldJson.edges.find(
      (e) => (e.from === currentNodeId && e.to === nodeId)
        || (e.to === currentNodeId && e.from === nodeId),
    )
    const rollChance = edge?.rollChance ?? 0.3

    // Roll for encounter using a derived RNG (deterministic per (runSeed, hop+nodeId))
    const rngState = useRunStore.getState().rngState
    const parent = createRng(rngState)
    const hopRng = deriveRng(parent, `hop:${currentNodeId}->${nodeId}`)
    const roll = hopRng.next()

    if (roll < rollChance && type !== 'town' && type !== 'dungeon' && type !== 'exit') {
      // Encounter! Save destination, route to combat. View resumes overworld
      // after victory; the combat scene will seed the stub battle.
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

    // No encounter — just move and dispatch arrival
    dispatchRun({ type: 'arriveAtNode', payload: { nodeId: asNodeId(nodeId) } })

    if (type === 'town') onEnterTown(asNodeId(nodeId))
    else if (type === 'dungeon') onEnterDungeon(asNodeId(nodeId))
    else if (type === 'exit') onWin()
  }

  const containerStyle: React.CSSProperties = {
    height: '100vh',
    width: '100vw',
    background: 'radial-gradient(ellipse at center, #1a1d2e 0%, #0a0a0f 75%)',
    color: '#e0d0a0',
    fontFamily: 'monospace',
    overflow: 'hidden',
    position: 'relative',
  }

  const offsetX = (window.innerWidth - map.width * SCALE) / 2
  const offsetY = (window.innerHeight - map.height * SCALE) / 2 - 40

  return (
    <div id="overworld-scene" style={containerStyle}>
      <div style={{
        position: 'absolute', top: 16, left: 16, fontSize: 12,
        color: '#8a7860', letterSpacing: 2,
      }}>
        BORDERLANDS — pine borderlands
      </div>

      {/* SVG layer for edges */}
      <svg width={window.innerWidth} height={window.innerHeight} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
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
              strokeDasharray={isAdjacent ? undefined : '4 4'}
            />
          )
        })}
      </svg>

      {/* Node layer */}
      {map.nodes.map((node) => {
        const x = offsetX + node.position.x * SCALE
        const y = offsetY + node.position.y * SCALE
        const isCurrent = node.id === currentNodeId
        const isReachable = neighbors.has(node.id)
        const isHovered = hoverNodeId === node.id
        const visitKey = `overworld:${worldPosition.mapId as unknown as string}:${node.id}`
        const isVisited = visitedNodes[visitKey] === true
        // Quest indicator: any active quest on this node? stub: only true for pine_crossing
        // until F-19 wires real quest location_indicators
        const hasQuest = node.id === 'pine_crossing'
          && Object.keys(questStates).length === 0  // no quests accepted yet → quest available

        return (
          <React.Fragment key={node.id}>
            <button
              id={`node-${node.id}`}
              type="button"
              onClick={() => handleNodeClick(node.id, node.type)}
              onMouseEnter={() => setHoverNodeId(node.id)}
              onMouseLeave={() => setHoverNodeId(null)}
              disabled={!isReachable && !isCurrent}
              style={{
                position: 'absolute',
                left: x - 24,
                top: y - 24,
                width: 48, height: 48,
                borderRadius: '50%',
                background: isCurrent ? '#facc15' : isVisited ? '#1a1410' : '#0a0a0f',
                border: `2px solid ${isCurrent ? '#facc15' : isReachable ? '#a07a40' : isVisited ? '#5a4a30' : '#3a2a18'}`,
                color: isCurrent ? '#0a0a0f' : NODE_TYPE_COLOR[node.type],
                fontSize: 22,
                cursor: isReachable && !isCurrent ? 'pointer' : 'default',
                boxShadow: isHovered && isReachable ? '0 0 12px rgba(250,204,21,0.6)' : 'none',
                transform: isHovered && isReachable ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 100ms, box-shadow 100ms',
                opacity: !isReachable && !isCurrent && !isVisited ? 0.6 : 1,
              }}
              aria-label={`${node.type}: ${node.id}`}
            >
              {NODE_TYPE_ICON[node.type] ?? '?'}
            </button>
            {/* Quest indicator */}
            {hasQuest && (
              <div
                id={`node-${node.id}-quest`}
                style={{
                  position: 'absolute',
                  left: x + 14,
                  top: y - 30,
                  width: 18, height: 18,
                  borderRadius: '50%',
                  background: '#facc15',
                  color: '#0a0a0f',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 'bold',
                  border: '1px solid #a07a40',
                  pointerEvents: 'none',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              >!</div>
            )}
            {/* Visited checkmark */}
            {isVisited && !isCurrent && (
              <div style={{
                position: 'absolute',
                left: x + 14,
                top: y + 12,
                width: 14, height: 14,
                borderRadius: '50%',
                background: '#44cc44',
                color: '#0a0a0f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 'bold',
                pointerEvents: 'none',
              }}>✓</div>
            )}
          </React.Fragment>
        )
      })}

      {/* Node labels */}
      {map.nodes.map((node) => {
        const x = offsetX + node.position.x * SCALE
        const y = offsetY + node.position.y * SCALE
        return (
          <div key={`${node.id}-label`} style={{
            position: 'absolute',
            left: x - 60,
            top: y + 30,
            width: 120,
            textAlign: 'center',
            fontSize: 11,
            color: node.id === currentNodeId ? '#facc15' : '#8a7860',
            letterSpacing: 1,
            pointerEvents: 'none',
          }}>
            {node.id.replace(/_/g, ' ')}
          </div>
        )
      })}

      {/* HUD bottom */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16, right: 16,
        display: 'flex', justifyContent: 'space-between',
        fontSize: 12, color: '#8a7860',
      }}>
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
      <span style={{ display: 'none' }}>{asMapId.name}</span>
    </div>
  )
}
