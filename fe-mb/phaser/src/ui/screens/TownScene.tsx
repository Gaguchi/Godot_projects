import React, { useState } from 'react'
import { useRunStore } from '../../state/runStore'
import itemsJson from '../../data/content/items.json'
import { asItemId } from '../../domain/ids'
import type { Unit } from '../../domain/unit'
import { Button, Heading } from '../components'

type Panel = 'inn' | 'shop' | 'tavern'

export interface TownSceneProps {
  onLeave: () => void
}

const PANEL_LABELS: Record<Panel | 'leave', string> = {
  inn: 'Inn — Heal',
  shop: 'Shop — Buy/Sell',
  tavern: 'Tavern — Quests & Bounties',
  leave: 'Leave Town',
}

const HEAL_COST_PER_UNIT = 8

export function TownScene({ onLeave }: TownSceneProps): React.JSX.Element {
  const [activePanel, setActivePanel] = useState<Panel>('inn')
  const dispatchRun = useRunStore((s) => s.dispatch)
  const gold = useRunStore((s) => s.gold)
  const partyUnits = useRunStore((s) => s.party.units)
  const inventoryItems = useRunStore((s) => s.inventory.items)
  const questStates = useRunStore((s) => s.questStates)

  const partyArr = Object.values(partyUnits)
  const wounded = partyArr.filter((u) => u.hp.current < u.hp.max)
  const totalHealCost = wounded.length * HEAL_COST_PER_UNIT
  const canAffordHeal = gold >= totalHealCost && wounded.length > 0

  const onHeal = (): void => {
    if (!canAffordHeal) return
    dispatchRun({ type: 'addGold', payload: { amount: -totalHealCost } })
    for (const u of wounded) {
      const healed: Unit = { ...u, hp: { ...u.hp, current: u.hp.max } }
      dispatchRun({ type: 'recruitUnit', payload: { unit: healed } })
    }
  }

  const shopStock = itemsJson.filter((i) =>
    (i.region === 'borderlands' || i.region === 'none') && (i.rarity === 'common' || i.rarity === 'uncommon'),
  )

  const onBuy = (itemId: string, price: number): void => {
    if (gold < price) return
    dispatchRun({ type: 'addGold', payload: { amount: -price } })
    const occupiedKeys = new Set(inventoryItems.map((i) => `${i.gridX},${i.gridY}`))
    let placed = false
    for (let y = 0; y < 4 && !placed; y++) {
      for (let x = 0; x < 8 && !placed; x++) {
        if (!occupiedKeys.has(`${x},${y}`)) {
          dispatchRun({
            type: 'moveItemInBag',
            payload: { itemId: asItemId(itemId), x, y },
          })
          useRunStore.setState((s) => ({
            inventory: { items: [...s.inventory.items, { itemId: asItemId(itemId), gridX: x, gridY: y }] },
          }))
          placed = true
        }
      }
    }
  }

  const onSell = (itemId: string, sellPrice: number): void => {
    dispatchRun({ type: 'addGold', payload: { amount: sellPrice } })
    useRunStore.setState((s) => ({
      inventory: { items: s.inventory.items.filter((i) => (i.itemId as unknown as string) !== itemId) },
    }))
  }

  return (
    <div id="town-scene" className="h-screen w-screen bg-stone-950 text-amber-100 font-mono flex relative">
      <div className="absolute top-4 right-4 px-4 py-2 bg-stone-900 border border-amber-700 text-amber-300 text-sm">
        Gold: {gold}g
      </div>

      <aside className="w-60 border-r border-stone-800 p-6 flex flex-col gap-2">
        <Heading level={2} className="text-lg tracking-widest mb-2">Pine Crossing</Heading>
        <div className="text-xs text-stone-500 mb-2 tracking-widest">BORDERLANDS</div>
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
        {activePanel === 'inn' && (
          <div id="inn-panel">
            <Heading level={1} className="text-2xl tracking-widest m-0">The Inn</Heading>
            <p className="text-stone-500 max-w-lg mt-2">
              Rest your party. Heals all wounded units to full HP. Costs {HEAL_COST_PER_UNIT}g per wounded unit.
            </p>
            <div className="mt-6">
              <strong>Wounded units:</strong>{' '}
              {wounded.length === 0 ? 'none' : wounded.map((u) => `${u.name} (${u.hp.current}/${u.hp.max})`).join(', ')}
            </div>
            <div className="mt-4">Cost: {totalHealCost}g</div>
            <Button
              id="inn-heal-btn"
              variant="primary"
              isDisabled={!canAffordHeal}
              onPress={onHeal}
              className="mt-6"
            >
              {wounded.length === 0 ? 'Everyone is healthy' : canAffordHeal ? `Rest (${totalHealCost}g)` : `Need ${totalHealCost}g`}
            </Button>
          </div>
        )}

        {activePanel === 'shop' && (
          <div id="shop-panel">
            <Heading level={1} className="text-2xl tracking-widest m-0">The Shop</Heading>
            <p className="text-stone-500 mt-2">Borderlands gear and supplies.</p>

            <h3 className="mt-6 text-sm tracking-widest text-amber-200">STOCK</h3>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {shopStock.map((item) => (
                <div
                  key={item.id}
                  className="p-3 border border-stone-800 flex justify-between items-center"
                >
                  <div>
                    <div className={item.rarity === 'uncommon' ? 'text-emerald-400' : 'text-amber-100'}>
                      {item.name}
                    </div>
                    <div className="text-[10px] text-stone-500">{item.kind} · {item.rarity}</div>
                  </div>
                  <Button
                    variant="secondary"
                    isDisabled={gold < item.buyPrice}
                    onPress={() => onBuy(item.id, item.buyPrice)}
                    className="!px-3 !py-1.5 !text-xs"
                  >
                    Buy {item.buyPrice}g
                  </Button>
                </div>
              ))}
            </div>

            <h3 className="mt-8 text-sm tracking-widest text-amber-200">YOUR BAG ({inventoryItems.length} items)</h3>
            {inventoryItems.length === 0 && (
              <div className="text-stone-500 italic mt-2">Empty.</div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-3">
              {inventoryItems.map((bagItem, idx) => {
                const item = itemsJson.find((i) => i.id === (bagItem.itemId as unknown as string))
                if (!item) return null
                return (
                  <div
                    key={`${item.id}-${idx}`}
                    className="p-3 border border-stone-800 flex justify-between items-center"
                  >
                    <div>
                      <div>{item.name}</div>
                      <div className="text-[10px] text-stone-500">{item.kind}</div>
                    </div>
                    <Button
                      variant="secondary"
                      onPress={() => onSell(item.id, item.sellPrice)}
                      className="!px-3 !py-1.5 !text-xs"
                    >
                      Sell {item.sellPrice}g
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activePanel === 'tavern' && (
          <div id="tavern-panel">
            <Heading level={1} className="text-2xl tracking-widest m-0">The Drunken Boar</Heading>
            <p className="text-stone-500 mt-2">Rumors, quests, and bounties.</p>

            <h3 className="mt-6 text-sm tracking-widest text-amber-200">RUMORS</h3>
            <ul className="text-stone-500 leading-relaxed list-disc pl-5">
              <li>"Bandit raids on the Frontier road. Iron weapons fetch a good price these days."</li>
              <li>"Smuggler's Cave to the east — old tunnels, said to hide a fortune."</li>
              <li>"The Iron Throne stands at the borderlands' edge. Few return from beyond."</li>
            </ul>

            <h3 className="mt-6 text-sm tracking-widest text-amber-200">QUEST BOARD</h3>
            {Object.keys(questStates).length === 0 ? (
              <div className="p-4 border border-stone-800 mt-3">
                <strong>Blood Ties</strong>
                <p className="text-xs text-stone-500 mt-1">
                  A frontier farmer's son joined a bandit gang. Find Daren and resolve the matter — capture or kill.
                </p>
                <Button
                  id="tavern-accept-blood-ties"
                  variant="primary"
                  onPress={() => {
                    dispatchRun({
                      type: 'advanceQuestStage',
                      payload: { questId: 'blood_ties' as never, toStage: 'find_daren' as never },
                    })
                  }}
                  className="mt-3 !text-xs"
                >
                  Accept Quest
                </Button>
              </div>
            ) : (
              <div className="mt-3 text-stone-500">
                Active quest: Blood Ties (in progress)
              </div>
            )}

            <h3 className="mt-6 text-sm tracking-widest text-amber-200">BOUNTY BOARD</h3>
            <div className="text-stone-500 italic">No bounties available. (Captures land in F-22.)</div>

            <h3 className="mt-6 text-sm tracking-widest text-amber-200">RECRUITMENT</h3>
            <div className="text-stone-500 italic">Locked. (F-27.)</div>
          </div>
        )}
      </main>
    </div>
  )
}
