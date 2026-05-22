import React, { useState } from 'react'
import { useRunStore } from '../../state/runStore'
import pineCrossingTown from '../../data/content/towns/pine_crossing.json'
import riversideMarketTown from '../../data/content/towns/riverside_market.json'
import southJunctionTown from '../../data/content/towns/south_junction.json'
import borderkeepCastleTown from '../../data/content/towns/borderkeep_castle.json'
import northernBridgeTown from '../../data/content/towns/northern_bridge.json'
import type { TownDef } from '../../domain/town'
import { Button, Heading, PartyChip } from '../components'
import { InnPanel } from './town/InnPanel'
import { ShopPanel } from './town/ShopPanel'
import { TavernPanel } from './town/TavernPanel'

const TOWN_REGISTRY: Record<string, TownDef> = {
  pine_crossing: pineCrossingTown as TownDef,
  riverside_market: riversideMarketTown as TownDef,
  south_junction: southJunctionTown as TownDef,
  borderkeep_castle: borderkeepCastleTown as TownDef,
  northern_bridge: northernBridgeTown as TownDef,
}

const REGION_DISPLAY: Record<string, string> = {
  borderlands: 'BORDERLANDS',
  thornwood: 'THORNWOOD',
  ashfall: 'ASHFALL REACH',
}

type Panel = 'inn' | 'shop' | 'tavern'

const PANEL_LABELS: Record<Panel | 'leave', string> = {
  inn: 'Inn — Heal',
  shop: 'Shop — Buy/Sell',
  tavern: 'Tavern — Quests & Bounties',
  leave: 'Leave Town',
}

export interface TownSceneProps {
  onLeave: () => void
}

export function TownScene({ onLeave }: TownSceneProps): React.JSX.Element {
  const [activePanel, setActivePanel] = useState<Panel>('inn')
  const gold = useRunStore((s) => s.gold)
  const worldPosition = useRunStore((s) => s.worldPosition)
  const townId = worldPosition.nodeId as unknown as string
  const town = TOWN_REGISTRY[townId] ?? (pineCrossingTown as TownDef)
  const regionLabel =
    REGION_DISPLAY[town.regionId as unknown as string]
    ?? (town.regionId as unknown as string).toUpperCase()

  return (
    <div id="town-scene" className="h-screen w-screen bg-stone-950 text-amber-100 font-mono flex relative">
      <div className="absolute top-4 right-4 flex gap-3 items-start">
        <PartyChip />
        <div className="px-4 py-2 bg-stone-900 border border-amber-700 text-amber-300 text-sm">
          Gold: {gold}g
        </div>
      </div>

      <aside className="w-60 border-r border-stone-800 p-6 flex flex-col gap-2">
        <Heading level={2} className="text-lg tracking-widest mb-2">{town.name}</Heading>
        <div className="text-xs text-stone-500 mb-2 tracking-widest">{regionLabel}</div>
        {(['inn', 'shop', 'tavern'] as Panel[]).map((p) => (
          <Button
            key={p}
            id={`town-${p}-btn`}
            variant={activePanel === p ? 'primary' : 'secondary'}
            onPress={() => setActivePanel(p)}
            className="!justify-start text-left"
          >
            {PANEL_LABELS[p]}
          </Button>
        ))}
        <div className="flex-1" />
        <Button
          id="town-leave-btn"
          variant="ghost"
          onPress={onLeave}
          className="!justify-start text-left"
        >
          {PANEL_LABELS.leave}
        </Button>
      </aside>

      <main className="flex-1 p-8 overflow-auto">
        {activePanel === 'inn' && <InnPanel />}
        {activePanel === 'shop' && <ShopPanel town={town} />}
        {activePanel === 'tavern' && <TavernPanel town={town} />}
      </main>
    </div>
  )
}
