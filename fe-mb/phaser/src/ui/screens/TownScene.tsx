import React, { useState } from 'react'
import { useRunStore } from '../../state/runStore'
import pineCrossingTown from '../../data/content/towns/pine_crossing.json'
import riversideMarketTown from '../../data/content/towns/riverside_market.json'
import southJunctionTown from '../../data/content/towns/south_junction.json'
import borderkeepCastleTown from '../../data/content/towns/borderkeep_castle.json'
import northernBridgeTown from '../../data/content/towns/northern_bridge.json'
import type { TownDef } from '../../domain/town'
import { Button, GameHud, Heading } from '../components'
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
  /** Quick-action menu deep-link: open the town with a specific panel active. */
  initialPanel?: Panel
}

export function TownScene({ onLeave, initialPanel }: TownSceneProps): React.JSX.Element {
  const [activePanel, setActivePanel] = useState<Panel>(initialPanel ?? 'inn')
  const worldPosition = useRunStore((s) => s.worldPosition)
  const townId = worldPosition.nodeId as unknown as string
  const town = TOWN_REGISTRY[townId] ?? (pineCrossingTown as TownDef)
  const regionLabel =
    REGION_DISPLAY[town.regionId as unknown as string]
    ?? (town.regionId as unknown as string).toUpperCase()

  return (
    <div
      id="town-scene"
      className="relative flex h-full w-full overflow-hidden font-body text-amber-100"
      style={{ background: 'linear-gradient(to bottom, #221a10 0%, #15100a 58%, #0b0806 100%)' }}
    >
      {/* warm hearth + faint grain — a tavern at dusk, not a flat panel */}
      <div aria-hidden className="hearth-glow absolute inset-0" />
      <div aria-hidden className="iron-grain absolute inset-0 opacity-[0.05]" />

      <GameHud regionName={regionLabel} location={town.name} partySide="right" />

      {/* sidebar = carved iron signboard */}
      <aside
        className="relative z-10 flex w-64 flex-col gap-2 border-r border-[rgba(120,98,60,0.3)] p-6"
        style={{ background: 'linear-gradient(to right, rgba(20,16,11,0.9), rgba(20,16,11,0.35))' }}
      >
        <Heading level={2} className="text-xl">{town.name}</Heading>
        <div className="mb-4 text-[0.65rem] tracking-[0.3em] text-parchment-dim">{regionLabel}</div>
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
          className="!justify-start text-left text-parchment-dim data-[hovered]:text-amber-100"
        >
          {PANEL_LABELS.leave}
        </Button>
      </aside>

      <main className="relative z-10 flex-1 overflow-auto p-8">
        {activePanel === 'inn' && <InnPanel />}
        {activePanel === 'shop' && <ShopPanel town={town} />}
        {activePanel === 'tavern' && <TavernPanel town={town} />}
      </main>
    </div>
  )
}
