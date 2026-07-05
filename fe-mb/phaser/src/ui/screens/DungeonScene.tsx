import React, { useEffect, useMemo, useState } from 'react'
import { useRunStore } from '../../state/runStore'
import { generateDungeon } from '../../procgen/dungeonGenerator'
import { createRng, deriveRng } from '../../systems/rng'
import { asDungeonId, asNodeId } from '../../domain/ids'
import type { DungeonGraph, DungeonRoom } from '../../domain/map'
import type { CheckEventDef } from '../../domain/encounter'
import type { QuestEffect } from '../../domain/quest'
import { Button, GameHud, Heading, Icon, type IconName, Pressable } from '../components'
import { CheckEventModal, type CheckEvent } from '../modals/CheckEventModal'
import smugglersCave from '../../data/content/dungeons/smugglers_cave.json'
import itemsJson from '../../data/content/items.json'
import { asItemId } from '../../domain/ids'

interface ShopOffer {
  itemId: string
  name: string
  rarity: string
  buyPrice: number
}

const DUNGEON_DEFS: Record<string, { roomEvents?: CheckEventDef[] }> = {
  smugglers_cave: smugglersCave as { roomEvents?: CheckEventDef[] },
}

const ROOM_TYPE_ICON: Record<DungeonRoom['type'], IconName> = {
  combat: 'combat',
  elite: 'elite',
  rest: 'rest',
  shop: 'shop',
  event: 'event',
  treasure: 'treasure',
  boss: 'boss',
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
  const [activeEvent, setActiveEvent] = useState<CheckEvent | null>(null)
  const [shopOffers, setShopOffers] = useState<ShopOffer[] | null>(null)
  const gold = useRunStore((s) => s.gold)

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
      // GP-F3: dispatch restParty instead of bypassing the chokepoint with setState
      dispatchRun({ type: 'restParty', payload: { percent: 0.3 } })
    } else if (room.type === 'shop') {
      // Roll 2 deterministic offers from the consumable pool at +0/+10% markup.
      const shopRng = deriveRng(createRng(useRunStore.getState().rngState), `dungeon-shop:${idStr}`)
      const pool = itemsJson
      const picks: ShopOffer[] = []
      const seen = new Set<string>()
      while (picks.length < 2 && picks.length < pool.length) {
        const i = shopRng.nextInt(0, pool.length - 1)
        const item = pool[i]!
        if (seen.has(item.id)) continue
        seen.add(item.id)
        picks.push({
          itemId: item.id,
          name: item.name,
          rarity: item.rarity,
          buyPrice: Math.round(item.buyPrice * (item.rarity === 'common' ? 1.0 : 1.1)),
        })
      }
      setShopOffers(picks)
    } else if (room.type === 'treasure') {
      dispatchRun({ type: 'addGold', payload: { amount: 50 } })
    } else if (room.type === 'event') {
      // Pull a check-event from the dungeon's roomEvents pool. If none defined,
      // fall back to the legacy gold reward.
      const dungeonId = (activeDungeon?.dungeonId as unknown as string) ?? 'smugglers_cave'
      const def = DUNGEON_DEFS[dungeonId]
      const pool = def?.roomEvents ?? []
      if (pool.length === 0) {
        dispatchRun({ type: 'addGold', payload: { amount: 30 } })
      } else {
        const eventRng = deriveRng(createRng(useRunStore.getState().rngState), `dungeon-event:${idStr}`)
        const idx = eventRng.nextInt(0, pool.length - 1)
        setActiveEvent(pool[idx] as CheckEvent)
      }
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
      className="h-full w-full text-amber-100 font-body overflow-auto relative flex flex-col items-center p-8"
      style={{
        background: [
          // Eerie central glow
          'radial-gradient(ellipse 60% 50% at 50% 45%, #6b1a1f33 0%, transparent 60%)',
          // Deep cave: red/charcoal sky-to-ground
          'linear-gradient(to bottom, #2a0d10 0%, #170609 55%, #080304 100%)',
        ].join(', '),
      }}
    >
      {/* Cave-grain noise overlay */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.22] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.0 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
          backgroundSize: '240px 240px',
        }}
      />

      {/* Cave-mist drift — slower than overworld fog, redder palette */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none atmosphere-fog-fast opacity-25 mix-blend-screen"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'><filter id='f'><feTurbulence type='fractalNoise' baseFrequency='0.01 0.022' numOctaves='2' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.55 0 0 0 0 0.18 0 0 0 0 0.15 0 0 0 0.4 0'/></filter><rect width='100%' height='100%' filter='url(%23f)'/></svg>")`,
          backgroundSize: '800px 500px',
        }}
      />
      {/* Vignette — squeezes attention to the dungeon graph */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 65% at 50% 50%, transparent 50%, rgba(0,0,0,0.7) 100%)',
        }}
      />
      <GameHud regionName="Dungeon" location="Smuggler's Cave" />
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
            // Organic curved passage between rooms — same deterministic
            // bow approach as the overworld so dungeons read as caves,
            // not graph edges.
            const seed = (fromStr.length * 31 + toStr.length * 17 + (fromStr.charCodeAt(0) ^ toStr.charCodeAt(0))) | 0
            const sign = (seed & 1) === 0 ? 1 : -1
            const dx = x2 - x1, dy = y2 - y1
            const len = Math.hypot(dx, dy) || 1
            const nx = -dy / len, ny = dx / len
            const mag = sign * Math.min(36, len * 0.18)
            const cx = (x1 + x2) / 2 + nx * mag
            const cy = (y1 + y2) / 2 + ny * mag
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                fill="none"
                stroke={isAdjacent ? '#a07a40' : '#3a2a18'}
                strokeWidth={isAdjacent ? 2 : 1}
                strokeLinecap="round"
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
              'border-2 motion-safe:transition-[transform,box-shadow] motion-safe:duration-100 outline-none ' +
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
                <Icon name={ROOM_TYPE_ICON[room.type]} size={28} />
              </Pressable>
            )
          }),
        )}
      </div>

      <div className="mt-6 text-[11px] text-stone-500 flex gap-4">
        <span className="text-red-500 flex items-center gap-1"><Icon name="combat" size={14} /> Combat</span>
        <span className="text-purple-400 flex items-center gap-1"><Icon name="event" size={14} /> Event</span>
        <span className="text-emerald-400 flex items-center gap-1"><Icon name="rest" size={14} /> Rest</span>
        <span className="text-red-600 flex items-center gap-1"><Icon name="elite" size={14} /> Elite</span>
        <span className="text-red-400 flex items-center gap-1"><Icon name="boss" size={14} /> Boss</span>
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

      {shopOffers && (
        <div
          role="dialog"
          aria-label="Dungeon Shop"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-stone-950/70 backdrop-blur-sm"
        >
          <div className="w-96 bg-stone-950 border border-amber-700 rounded p-5 font-body">
            <div className="flex items-baseline justify-between mb-4">
              <Heading level={2} className="text-lg text-amber-200 voice-display">Black-Market Stall</Heading>
              <span className="text-xs text-stone-400">Gold: <span className="numeral">{gold}</span>g</span>
            </div>
            <p className="text-stone-500 text-xs mb-4">
              A hooded smuggler nudges a few items toward you.
            </p>
            <div className="space-y-2">
              {shopOffers.map((o) => {
                const canAfford = gold >= o.buyPrice
                return (
                  <div
                    key={o.itemId}
                    className="p-2 border border-stone-800 flex justify-between items-center"
                  >
                    <div>
                      <div className={`voice-display ${o.rarity === 'uncommon' ? 'text-emerald-400' : 'text-amber-100'}`}>
                        {o.name}
                      </div>
                      <div className="text-[10px] text-stone-500">{o.rarity}</div>
                    </div>
                    <Button
                      variant="primary"
                      isDisabled={!canAfford}
                      onPress={() => {
                        dispatchRun({ type: 'buyItem', payload: { itemId: asItemId(o.itemId), price: o.buyPrice } })
                        setShopOffers((prev) => (prev ? prev.filter((x) => x.itemId !== o.itemId) : null))
                      }}
                      className="!text-xs"
                    >
                      {canAfford ? <>Buy <span className="numeral">{o.buyPrice}</span>g</> : <>Need <span className="numeral">{o.buyPrice}</span>g</>}
                    </Button>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onPress={() => setShopOffers(null)}>Leave</Button>
            </div>
          </div>
        </div>
      )}

      {activeEvent && (
        <CheckEventModal
          event={activeEvent}
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
            setActiveEvent(null)
          }}
          onClose={() => setActiveEvent(null)}
        />
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
