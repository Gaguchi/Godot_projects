import React, { useState } from 'react'
import { useRunStore } from '../../state/runStore'
import itemsJson from '../../data/content/items.json'
import { asItemId } from '../../domain/ids'
import type { Unit } from '../../domain/unit'

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
    // Heal each wounded unit by recreating them with full HP
    // Note: the runStore doesn't expose a direct healUnit action yet — use a workaround
    // by re-recruiting healed unit. Future cleanup: add `healUnit` runStore action.
    for (const u of wounded) {
      const healed: Unit = { ...u, hp: { ...u.hp, current: u.hp.max } }
      dispatchRun({ type: 'recruitUnit', payload: { unit: healed } })
    }
  }

  // Borderlands shop stocks: filter to borderlands region + common+uncommon
  const shopStock = itemsJson.filter((i) =>
    (i.region === 'borderlands' || i.region === 'none') && (i.rarity === 'common' || i.rarity === 'uncommon'),
  )

  const onBuy = (itemId: string, price: number): void => {
    if (gold < price) return
    dispatchRun({ type: 'addGold', payload: { amount: -price } })
    // Add to inventory at first empty grid slot
    const occupiedKeys = new Set(inventoryItems.map((i) => `${i.gridX},${i.gridY}`))
    let placed = false
    for (let y = 0; y < 4 && !placed; y++) {
      for (let x = 0; x < 8 && !placed; x++) {
        if (!occupiedKeys.has(`${x},${y}`)) {
          // Use moveItemInBag as a way to add to inventory (workaround)
          // This is suboptimal — proper "addItemToBag" runStore action lands in F-17
          dispatchRun({
            type: 'moveItemInBag',
            payload: { itemId: asItemId(itemId), x, y },
          })
          // The action only updates existing items; for new items we need to push directly
          // Workaround: dispatch a custom add-item via run store reset (not ideal but works)
          // For foundation: manually mutate via Zustand setState
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

  const containerStyle: React.CSSProperties = {
    height: '100vh',
    width: '100vw',
    background: '#0a0a0f',
    color: '#e0d0a0',
    fontFamily: 'monospace',
    display: 'flex',
  }

  const sidebarStyle: React.CSSProperties = {
    width: 240,
    borderRight: '1px solid #2a2010',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  }

  const sidebarBtnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? '#1a1410' : 'transparent',
    color: active ? '#facc15' : '#e0d0a0',
    border: `1px solid ${active ? '#a07a40' : '#2a2010'}`,
    padding: '12px 16px',
    fontFamily: 'monospace',
    fontSize: 13,
    letterSpacing: 1,
    cursor: 'pointer',
    textAlign: 'left',
  })

  const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: 32,
    overflow: 'auto',
  }

  const goldChipStyle: React.CSSProperties = {
    position: 'absolute',
    top: 16, right: 16,
    padding: '8px 16px',
    background: '#1a1410',
    border: '1px solid #a07a40',
    color: '#facc15',
    fontFamily: 'monospace',
    fontSize: 14,
  }

  return (
    <div id="town-scene" style={containerStyle}>
      <div style={goldChipStyle}>Gold: {gold}g</div>

      <aside style={sidebarStyle}>
        <h2 style={{ margin: 0, marginBottom: 16, fontSize: 18, letterSpacing: 2 }}>Pine Crossing</h2>
        <div style={{ fontSize: 11, color: '#8a7860', marginBottom: 8 }}>BORDERLANDS</div>
        {(['inn', 'shop', 'tavern'] as Panel[]).map((p) => (
          <button
            key={p}
            id={`town-${p}-btn`}
            type="button"
            onClick={() => setActivePanel(p)}
            style={sidebarBtnStyle(activePanel === p)}
          >
            {PANEL_LABELS[p]}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          id="town-leave-btn"
          type="button"
          onClick={onLeave}
          style={sidebarBtnStyle(false)}
        >
          {PANEL_LABELS.leave}
        </button>
      </aside>

      <main style={contentStyle}>
        {activePanel === 'inn' && (
          <div id="inn-panel">
            <h1 style={{ margin: 0, fontSize: 24, letterSpacing: 2 }}>The Inn</h1>
            <p style={{ color: '#8a7860', maxWidth: 480, marginTop: 8 }}>
              Rest your party. Heals all wounded units to full HP. Costs {HEAL_COST_PER_UNIT}g per wounded unit.
            </p>
            <div style={{ marginTop: 24 }}>
              <strong>Wounded units:</strong> {wounded.length === 0 ? 'none' : wounded.map((u) => `${u.name} (${u.hp.current}/${u.hp.max})`).join(', ')}
            </div>
            <div style={{ marginTop: 16 }}>
              Cost: {totalHealCost}g
            </div>
            <button
              id="inn-heal-btn"
              type="button"
              onClick={onHeal}
              disabled={!canAffordHeal}
              style={{
                marginTop: 24,
                padding: '12px 24px',
                background: canAffordHeal ? '#1a1410' : 'transparent',
                border: `1px solid ${canAffordHeal ? '#a07a40' : '#2a2010'}`,
                color: canAffordHeal ? '#e0d0a0' : '#666',
                fontFamily: 'monospace',
                cursor: canAffordHeal ? 'pointer' : 'not-allowed',
                fontSize: 14,
              }}
            >
              {wounded.length === 0 ? 'Everyone is healthy' : canAffordHeal ? `Rest (${totalHealCost}g)` : `Need ${totalHealCost}g`}
            </button>
          </div>
        )}

        {activePanel === 'shop' && (
          <div id="shop-panel">
            <h1 style={{ margin: 0, fontSize: 24, letterSpacing: 2 }}>The Shop</h1>
            <p style={{ color: '#8a7860', marginTop: 8 }}>Borderlands gear and supplies.</p>

            <h3 style={{ marginTop: 24, fontSize: 14 }}>Stock</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              {shopStock.map((item) => (
                <div key={item.id} style={{ padding: 12, border: '1px solid #2a2010', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: item.rarity === 'uncommon' ? '#44ff66' : '#e0d0a0' }}>{item.name}</div>
                    <div style={{ fontSize: 10, color: '#8a7860' }}>{item.kind} · {item.rarity}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onBuy(item.id, item.buyPrice)}
                    disabled={gold < item.buyPrice}
                    style={{
                      padding: '6px 12px',
                      background: 'transparent',
                      border: '1px solid #4a3a20',
                      color: gold >= item.buyPrice ? '#facc15' : '#666',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      cursor: gold >= item.buyPrice ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Buy {item.buyPrice}g
                  </button>
                </div>
              ))}
            </div>

            <h3 style={{ marginTop: 32, fontSize: 14 }}>Your Bag ({inventoryItems.length} items)</h3>
            {inventoryItems.length === 0 && (
              <div style={{ color: '#8a7860', fontStyle: 'italic', marginTop: 8 }}>Empty.</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              {inventoryItems.map((bagItem, idx) => {
                const item = itemsJson.find((i) => i.id === (bagItem.itemId as unknown as string))
                if (!item) return null
                return (
                  <div key={`${item.id}-${idx}`} style={{ padding: 12, border: '1px solid #2a2010', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div>{item.name}</div>
                      <div style={{ fontSize: 10, color: '#8a7860' }}>{item.kind}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSell(item.id, item.sellPrice)}
                      style={{
                        padding: '6px 12px',
                        background: 'transparent',
                        border: '1px solid #4a3a20',
                        color: '#e0d0a0',
                        fontFamily: 'monospace',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Sell {item.sellPrice}g
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activePanel === 'tavern' && (
          <div id="tavern-panel">
            <h1 style={{ margin: 0, fontSize: 24, letterSpacing: 2 }}>The Drunken Boar</h1>
            <p style={{ color: '#8a7860', marginTop: 8 }}>Rumors, quests, and bounties.</p>

            <h3 style={{ marginTop: 24, fontSize: 14 }}>Rumors</h3>
            <ul style={{ color: '#8a7860', lineHeight: 1.7 }}>
              <li>"Bandit raids on the Frontier road. Iron weapons fetch a good price these days."</li>
              <li>"Smuggler's Cave to the east — old tunnels, said to hide a fortune."</li>
              <li>"The Iron Throne stands at the borderlands' edge. Few return from beyond."</li>
            </ul>

            <h3 style={{ marginTop: 24, fontSize: 14 }}>Quest Board</h3>
            {Object.keys(questStates).length === 0 ? (
              <div style={{ padding: 16, border: '1px solid #2a2010', marginTop: 12 }}>
                <strong>Blood Ties</strong>
                <p style={{ fontSize: 12, color: '#8a7860', marginTop: 4 }}>
                  A frontier farmer's son joined a bandit gang. Find Daren and resolve the matter — capture or kill.
                </p>
                <button
                  id="tavern-accept-blood-ties"
                  type="button"
                  onClick={() => {
                    dispatchRun({
                      type: 'advanceQuestStage',
                      payload: { questId: 'blood_ties' as never, toStage: 'find_daren' as never },
                    })
                  }}
                  style={{
                    marginTop: 12,
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid #a07a40',
                    color: '#facc15',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Accept Quest
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 12, color: '#8a7860' }}>
                Active quest: Blood Ties (in progress)
              </div>
            )}

            <h3 style={{ marginTop: 24, fontSize: 14 }}>Bounty Board</h3>
            <div style={{ color: '#8a7860', fontStyle: 'italic' }}>No bounties available. (Captures land in F-22.)</div>

            <h3 style={{ marginTop: 24, fontSize: 14 }}>Recruitment</h3>
            <div style={{ color: '#8a7860', fontStyle: 'italic' }}>Locked. (F-27.)</div>
          </div>
        )}
      </main>
    </div>
  )
}
