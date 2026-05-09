import React, { useEffect, useMemo } from 'react'
import { useRunStore } from '../../state/runStore'
import { generateDungeon } from '../../procgen/dungeonGenerator'
import { createRng, deriveRng } from '../../systems/rng'
import { asDungeonId, asNodeId } from '../../domain/ids'
import type { DungeonGraph, DungeonRoom } from '../../domain/map'
import { Button, Pressable } from '../components'

const ROOM_TYPE_ICON: Record<DungeonRoom['type'], string> = {
  combat: '⚔',
  elite: '☠',
  rest: '✦',
  shop: '$',
  event: '?',
  treasure: '◆',
  boss: '⚜',
}

const ROOM_TYPE_COLOR_CLASS: Record<DungeonRoom['type'], string> = {
  combat: 'text-red-500 border-red-700/80',
  elite: 'text-red-600 border-red-800',
  rest: 'text-emerald-400 border-emerald-700/80',
  shop: 'text-amber-300 border-amber-700/80',
  event: 'text-purple-400 border-purple-700/80',
  treasure: 'text-amber-300 border-amber-700/80',
  boss: 'text-red-400 border-red-700',
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

    if (room.type === 'combat' || room.type === 'elite' || room.type === 'boss') {
      onCombatRoom()
    } else if (room.type === 'rest') {
      const party = useRunStore.getState().party.units
      for (const u of Object.values(party)) {
        const newHp = Math.min(u.hp.max, u.hp.current + Math.floor(u.hp.max * 0.3))
        useRunStore.setState((s) => ({
          party: { ...s.party, units: { ...s.party.units, [u.id as unknown as string]: { ...u, hp: { ...u.hp, current: newHp } } } },
        }))
      }
    } else if (room.type === 'treasure') {
      dispatchRun({ type: 'addGold', payload: { amount: 50 } })
    } else if (room.type === 'event') {
      dispatchRun({ type: 'addGold', payload: { amount: 30 } })
    }
  }

  const onClearDungeon = (): void => {
    dispatchRun({ type: 'exitDungeon' })
    onClearAndExit()
  }

  const totalRows = dungeon.rows.length
  const mapHeight = totalRows * ROW_HEIGHT
  const mapWidth = 4 * COL_WIDTH
  const isCleared =
    currentNodeId !== undefined
    && dungeon.rows[dungeon.bossRow]?.some((r) => (r.id as unknown as string) === currentNodeId && (activeDungeon?.clearedRooms.size ?? 0) >= dungeon.bossRow)

  return (
    <div
      id="dungeon-scene"
      className="h-screen w-screen text-amber-100 font-mono overflow-auto relative flex flex-col items-center p-8"
      style={{ background: 'radial-gradient(ellipse at center, #1a0510 0%, #0a0506 75%)' }}
    >
      <div className="absolute top-4 left-4 text-xs text-red-600 tracking-widest">
        DUNGEON — Smuggler's Cave
      </div>
      <Button
        id="dungeon-leave-btn"
        variant="danger"
        onPress={onLeave}
        className="!absolute !top-4 !right-4 !text-xs"
      >
        Retreat
      </Button>

      <div className="mt-8 text-stone-500 text-xs tracking-wider">
        {currentNodeId
          ? `at: ${currentNodeId}  ·  click an adjacent room to advance`
          : 'enter the dungeon by clicking the lowest row'}
      </div>

      <div className="relative mt-8" style={{ width: mapWidth, height: mapHeight + 64 }}>
        <svg
          width={mapWidth}
          height={mapHeight + 64}
          className="absolute inset-0 pointer-events-none"
        >
          {dungeon.edges.map(([from, to], i) => {
            const fromStr = from as unknown as string
            const toStr = to as unknown as string
            const fromRoom = findRoom(dungeon, fromStr)
            const toRoom = findRoom(dungeon, toStr)
            if (!fromRoom || !toRoom) return null
            const x1 = fromRoom.col * COL_WIDTH + COL_WIDTH / 2
            const y1 = mapHeight - fromRoom.row * ROW_HEIGHT - ROW_HEIGHT / 2
            const x2 = toRoom.col * COL_WIDTH + COL_WIDTH / 2
            const y2 = mapHeight - toRoom.row * ROW_HEIGHT - ROW_HEIGHT / 2
            const isAdjacent = currentNodeId === fromStr || currentNodeId === toStr
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

        {dungeon.rows.flatMap((row, rowIdx) =>
          row.map((room) => {
            const roomIdStr = room.id as unknown as string
            const colIdx = roomIdStr.includes('c') ? parseInt(roomIdStr.split('c')[1] ?? '0', 10) : 0
            const x = colIdx * COL_WIDTH + COL_WIDTH / 2
            const y = mapHeight - rowIdx * ROW_HEIGHT - ROW_HEIGHT / 2
            const isCurrent = currentNodeId === roomIdStr
            const isReachable = reachable.has(roomIdStr)
            const isClearedRoom = activeDungeon?.clearedRooms.has(asNodeId(roomIdStr)) ?? false
            const isBoss = room.type === 'boss'

            const baseClass =
              'absolute flex items-center justify-center text-2xl select-none ' +
              'border-2 transition-[transform,box-shadow] duration-100 outline-none ' +
              'data-[focus-visible]:ring-2 data-[focus-visible]:ring-amber-400'
            const shapeClass = isBoss ? 'rounded-lg' : 'rounded-full'
            const stateClass = isCurrent
              ? 'bg-amber-400 border-amber-400 text-stone-950 cursor-default'
              : isReachable
                ? `bg-stone-950 ${ROOM_TYPE_COLOR_CLASS[room.type]} cursor-pointer ` +
                  'data-[hovered]:scale-110 data-[hovered]:shadow-[0_0_12px_currentColor]'
                : isClearedRoom
                  ? `bg-stone-900 ${ROOM_TYPE_COLOR_CLASS[room.type]} opacity-90 cursor-default`
                  : `bg-stone-950 border-stone-800 ${ROOM_TYPE_COLOR_CLASS[room.type].split(' ')[0]} opacity-60 cursor-default`

            return (
              <Pressable
                key={roomIdStr}
                id={`room-${roomIdStr}`}
                onPress={() => handleRoomClick(room)}
                isDisabled={!isReachable && !isCurrent}
                aria-label={ROOM_TYPE_LABEL[room.type]}
                className={`${baseClass} ${shapeClass} ${stateClass}`}
                style={{ left: x - 28, top: y - 28, width: 56, height: 56 }}
              >
                {ROOM_TYPE_ICON[room.type]}
              </Pressable>
            )
          }),
        )}
      </div>

      <div className="mt-6 text-[11px] text-stone-500 flex gap-4">
        <span className="text-red-500">⚔ Combat</span>
        <span className="text-purple-400">? Event</span>
        <span className="text-emerald-400">✦ Rest</span>
        <span className="text-red-600">☠ Elite</span>
        <span className="text-red-400">⚜ Boss</span>
      </div>

      {isCleared && (
        <Button
          variant="primary"
          onPress={onClearDungeon}
          className="mt-6"
        >
          Exit Dungeon
        </Button>
      )}
    </div>
  )
}

function findRoom(graph: DungeonGraph, idStr: string): { row: number; col: number } | null {
  for (let r = 0; r < graph.rows.length; r++) {
    const row = graph.rows[r]!
    for (const room of row) {
      if ((room.id as unknown as string) === idStr) {
        const colStr = idStr.split('c')[1] ?? '0'
        return { row: r, col: parseInt(colStr, 10) }
      }
    }
  }
  return null
}
