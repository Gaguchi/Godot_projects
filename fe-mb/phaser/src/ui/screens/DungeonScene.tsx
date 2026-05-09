import React, { useEffect, useMemo, useState } from 'react'
import { useRunStore } from '../../state/runStore'
import { generateDungeon } from '../../procgen/dungeonGenerator'
import { createRng, deriveRng } from '../../systems/rng'
import { asDungeonId, asNodeId } from '../../domain/ids'
import type { DungeonGraph, DungeonRoom } from '../../domain/map'

const ROOM_TYPE_ICON: Record<DungeonRoom['type'], string> = {
  combat: '⚔',
  elite: '☠',
  rest: '✦',
  shop: '$',
  event: '?',
  treasure: '◆',
  boss: '⚜',
}

const ROOM_TYPE_COLOR: Record<DungeonRoom['type'], string> = {
  combat: '#cc4444',
  elite: '#dc2626',
  rest: '#44dd66',
  shop: '#facc15',
  event: '#9966cc',
  treasure: '#facc15',
  boss: '#ff4444',
}

const ROOM_TYPE_LABEL: Record<DungeonRoom['type'], string> = {
  combat: 'Combat',
  elite: 'Elite',
  rest: 'Rest Site',
  shop: 'Shop',
  event: 'Unknown',
  treasure: 'Treasure',
  boss: 'Boss',
}

export interface DungeonSceneProps {
  onClearAndExit: () => void
  onCombatRoom: () => void
  onLeave: () => void
}

const ROW_HEIGHT = 96
const COL_WIDTH = 140

export function DungeonScene({ onClearAndExit, onCombatRoom, onLeave }: DungeonSceneProps): React.JSX.Element {
  const dispatchRun = useRunStore((s) => s.dispatch)
  const activeDungeon = useRunStore((s) => s.activeDungeon)
  const rngState = useRunStore((s) => s.rngState)
  const [hover, setHover] = useState<string | null>(null)

  // Generate dungeon if none active
  const dungeon: DungeonGraph = useMemo(() => {
    if (activeDungeon) return activeDungeon.graph
    const rng = deriveRng(createRng(rngState), 'dungeon:smugglers_cave')
    return generateDungeon(rng, { dungeonId: 'smugglers_cave' })
  }, [activeDungeon, rngState])

  useEffect(() => {
    if (!activeDungeon) {
      dispatchRun({ type: 'enterDungeon', payload: { dungeonId: asDungeonId('smugglers_cave'), graph: dungeon } })
    }
  }, [activeDungeon, dispatchRun, dungeon])

  const currentNodeId = activeDungeon?.position as unknown as string | undefined

  // Compute reachable rooms (rooms connected from current via edges)
  const reachable = new Set<string>()
  if (currentNodeId) {
    for (const [from, to] of dungeon.edges) {
      const fromStr = from as unknown as string
      const toStr = to as unknown as string
      if (fromStr === currentNodeId) reachable.add(toStr)
    }
  }

  const handleRoomClick = (room: DungeonRoom): void => {
    const idStr = room.id as unknown as string
    if (!reachable.has(idStr)) return

    dispatchRun({ type: 'advanceDungeonRoom', payload: { roomId: asNodeId(idStr) } })

    if (room.type === 'combat' || room.type === 'elite') {
      onCombatRoom()
    } else if (room.type === 'boss') {
      // Final fight — also routes to combat; victory there should clear dungeon
      onCombatRoom()
    } else if (room.type === 'rest') {
      // Heal 30% in-place
      const party = useRunStore.getState().party.units
      for (const u of Object.values(party)) {
        const newHp = Math.min(u.hp.max, u.hp.current + Math.floor(u.hp.max * 0.3))
        useRunStore.setState((s) => ({
          party: { ...s.party, units: { ...s.party.units, [u.id as unknown as string]: { ...u, hp: { ...u.hp, current: newHp } } } },
        }))
      }
    } else if (room.type === 'treasure') {
      // Grant 50g for now
      dispatchRun({ type: 'addGold', payload: { amount: 50 } })
    } else if (room.type === 'event') {
      // Stub event: 30g
      dispatchRun({ type: 'addGold', payload: { amount: 30 } })
    }
  }

  const onClearDungeon = (): void => {
    dispatchRun({ type: 'exitDungeon' })
    onClearAndExit()
  }

  const containerStyle: React.CSSProperties = {
    height: '100vh',
    width: '100vw',
    background: 'radial-gradient(ellipse at center, #1a0510 0%, #0a0506 75%)',
    color: '#e0d0a0',
    fontFamily: 'monospace',
    overflow: 'auto',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 32,
  }

  const totalRows = dungeon.rows.length
  const mapHeight = totalRows * ROW_HEIGHT
  const mapWidth = 4 * COL_WIDTH
  const isCleared = currentNodeId !== undefined && dungeon.rows[dungeon.bossRow]?.some((r) => (r.id as unknown as string) === currentNodeId && (activeDungeon?.clearedRooms.size ?? 0) >= dungeon.bossRow)

  return (
    <div id="dungeon-scene" style={containerStyle}>
      <div style={{ position: 'absolute', top: 16, left: 16, fontSize: 12, color: '#dc2626', letterSpacing: 2 }}>
        DUNGEON — Smuggler's Cave
      </div>
      <button
        id="dungeon-leave-btn"
        type="button"
        onClick={onLeave}
        style={{
          position: 'absolute', top: 16, right: 16,
          padding: '8px 16px', background: 'transparent',
          border: '1px solid #4a3a20', color: '#e0d0a0',
          fontFamily: 'monospace', fontSize: 12, cursor: 'pointer',
        }}
      >
        Retreat
      </button>

      <div style={{ marginTop: 32, color: '#8a7860', fontSize: 12, letterSpacing: 1 }}>
        {currentNodeId
          ? `at: ${currentNodeId}  ·  click an adjacent room to advance`
          : 'enter the dungeon by clicking the lowest row'}
      </div>

      {/* SVG edges layer */}
      <div style={{ position: 'relative', width: mapWidth, height: mapHeight + 64, marginTop: 32 }}>
        <svg width={mapWidth} height={mapHeight + 64} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {dungeon.edges.map(([from, to], i) => {
            const fromStr = from as unknown as string
            const toStr = to as unknown as string
            const fromRoom = findRoom(dungeon, fromStr)
            const toRoom = findRoom(dungeon, toStr)
            if (!fromRoom || !toRoom) return null
            const x1 = fromRoom.col * COL_WIDTH + COL_WIDTH / 2
            // Bottom-up: lowest row at bottom
            const y1 = mapHeight - fromRoom.row * ROW_HEIGHT - ROW_HEIGHT / 2
            const x2 = toRoom.col * COL_WIDTH + COL_WIDTH / 2
            const y2 = mapHeight - toRoom.row * ROW_HEIGHT - ROW_HEIGHT / 2
            const isAdjacent = currentNodeId === fromStr || currentNodeId === toStr
            return (
              <line key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={isAdjacent ? '#a07a40' : '#3a2a18'}
                strokeWidth={isAdjacent ? 2 : 1}
                strokeDasharray={isAdjacent ? undefined : '4 4'}
              />
            )
          })}
        </svg>

        {/* Room buttons */}
        {dungeon.rows.flatMap((row, rowIdx) =>
          row.map((room) => {
            const roomIdStr = room.id as unknown as string
            const colIdx = room.id.toString().includes('c') ? parseInt((room.id as unknown as string).split('c')[1] ?? '0', 10) : 0
            const x = colIdx * COL_WIDTH + COL_WIDTH / 2
            const y = mapHeight - rowIdx * ROW_HEIGHT - ROW_HEIGHT / 2
            const isCurrent = currentNodeId === roomIdStr
            const isReachable = reachable.has(roomIdStr)
            const isCleared = activeDungeon?.clearedRooms.has(asNodeId(roomIdStr)) ?? false
            const isHovered = hover === roomIdStr
            const isBoss = room.type === 'boss'

            return (
              <button
                key={roomIdStr}
                id={`room-${roomIdStr}`}
                type="button"
                onClick={() => handleRoomClick(room)}
                onMouseEnter={() => setHover(roomIdStr)}
                onMouseLeave={() => setHover(null)}
                disabled={!isReachable && !isCurrent}
                title={ROOM_TYPE_LABEL[room.type]}
                style={{
                  position: 'absolute',
                  left: x - 28,
                  top: y - 28,
                  width: 56, height: 56,
                  borderRadius: isBoss ? 8 : '50%',
                  background: isCurrent ? '#facc15' : isCleared ? '#1a1410' : '#0a0a0f',
                  border: `2px solid ${isCurrent ? '#facc15' : isReachable ? ROOM_TYPE_COLOR[room.type] : '#3a2a18'}`,
                  color: isCurrent ? '#0a0a0f' : ROOM_TYPE_COLOR[room.type],
                  fontSize: 22,
                  cursor: isReachable && !isCurrent ? 'pointer' : 'default',
                  boxShadow: isHovered && isReachable ? `0 0 12px ${ROOM_TYPE_COLOR[room.type]}` : 'none',
                  transform: isHovered && isReachable ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 100ms, box-shadow 100ms',
                  opacity: !isReachable && !isCurrent && !isCleared ? 0.7 : 1,
                }}
              >
                {ROOM_TYPE_ICON[room.type]}
              </button>
            )
          }),
        )}
      </div>

      <div style={{ marginTop: 24, fontSize: 11, color: '#8a7860', display: 'flex', gap: 16 }}>
        <span style={{ color: '#cc4444' }}>⚔ Combat</span>
        <span style={{ color: '#9966cc' }}>? Event</span>
        <span style={{ color: '#44dd66' }}>✦ Rest</span>
        <span style={{ color: '#dc2626' }}>☠ Elite</span>
        <span style={{ color: '#ff4444' }}>⚜ Boss</span>
      </div>

      {isCleared && (
        <button
          type="button"
          onClick={onClearDungeon}
          style={{ marginTop: 24, padding: '12px 24px', background: '#1a1410', border: '1px solid #facc15', color: '#facc15', fontFamily: 'monospace', cursor: 'pointer' }}
        >
          Exit Dungeon
        </button>
      )}
    </div>
  )
}

function findRoom(graph: DungeonGraph, idStr: string): { row: number; col: number } | null {
  for (let r = 0; r < graph.rows.length; r++) {
    const row = graph.rows[r]!
    for (const room of row) {
      if ((room.id as unknown as string) === idStr) {
        // parse col from id pattern rNcM
        const colStr = idStr.split('c')[1] ?? '0'
        return { row: r, col: parseInt(colStr, 10) }
      }
    }
  }
  return null
}
