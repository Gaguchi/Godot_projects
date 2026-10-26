/**
 * ui/modals/Loadout.tsx — the company roster and the two hands (BRIEF §2.7 gear-as-deck): pick a face, see the
 * stats, what each hand holds and the deck those hands make (innate class cards + left + right + signature).
 * Click a piece of gear in the satchel, then a hand, to equip it (`run/equip` — refused with its reason when the
 * displaced item would not fit); a two-handed item takes the left and locks the right. Esc closes.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { spriteIdFor } from '../../content/index'
import { buildDeck } from '../../engine/combat/deck'
import { isGear, itemDef } from '../../engine/run/bag'
import { planEquip, planUnequip } from '../../engine/run/equipment'
import { displayName, livingUnits } from '../../engine/run/party'
import type { BagEntry, CardSource, GameState, HandSlot, UnitId } from '../../engine/types'
import { BagGrid, ITEM_ICON, RARITY_TINT } from '../components/BagGrid'
import { Icon } from '../components/Icon'
import { Button } from '../components/Button'
import { className, initialsOf } from '../names'
import { canDispatch, dispatch, useEnv, useGame } from '../store'

const STAT_LABEL: readonly { readonly key: 'str' | 'mag' | 'skl' | 'spd' | 'def' | 'res' | 'lck'; readonly label: string }[] = [
  { key: 'str', label: 'STR' }, { key: 'mag', label: 'MAG' }, { key: 'skl', label: 'SKL' }, { key: 'spd', label: 'SPD' }, { key: 'def', label: 'DEF' }, { key: 'res', label: 'RES' }, { key: 'lck', label: 'LCK' },
]
const SOURCE_LABEL: Readonly<Record<CardSource, string>> = { innate: 'From the class', hand_left: 'Left hand', hand_right: 'Right hand', signature: 'Signature' }

interface View {
  readonly faces: readonly { readonly id: UnitId; readonly name: string; readonly sprite: string | null; readonly hp: number; readonly max: number }[]
  readonly unit: {
    readonly id: UnitId
    readonly name: string
    readonly classId: string
    readonly level: number
    readonly hp: number
    readonly max: number
    readonly mov: number
    readonly stats: readonly { readonly label: string; readonly value: number }[]
    readonly hands: readonly { readonly slot: HandSlot; readonly item: { readonly name: string; readonly rarity: string; readonly kind: string; readonly twoHanded: boolean } | null; readonly locked: boolean; readonly unequipReason: string | null }[]
    readonly deck: readonly { readonly source: CardSource; readonly cards: readonly { readonly uid: string; readonly name: string; readonly cost: number }[] }[]
  } | null
  readonly selectedGear: { readonly name: string; readonly twoHanded: boolean; readonly plans: readonly { readonly slot: HandSlot; readonly reason: string | null }[] } | null
}

export function LoadoutModal({ initialUnitId }: { readonly initialUnitId: UnitId | null }): React.JSX.Element | null {
  const env = useEnv()
  const [unitId, setUnitId] = useState<UnitId | null>(initialUnitId)
  const [picked, setPicked] = useState<BagEntry | null>(null)
  const view = useGame(useCallback((s: GameState): View | null => {
    const run = s.run
    if (run === null) return null
    const living = livingUnits(run)
    const unit = living.find((u) => u.id === unitId) ?? living[0] ?? null
    const gear = picked === null ? null : run.bag.find((b) => b.x === picked.x && b.y === picked.y) ?? null
    const gearItem = gear === null ? null : itemDef(gear.itemId, env)
    return {
      // The roster reads the name the player CHOSE (the band, the HUD and the ledger all do) — `unit.name` is
      // still the placeholder 'The Foundling' for the MC (BRIEF 2.16).
      faces: living.map((u) => ({ id: u.id, name: displayName(u, run), sprite: spriteIdFor(u.id, u.classId), hp: u.hp.current, max: u.hp.max })),
      unit: unit === null ? null : {
        id: unit.id,
        name: displayName(unit, run),
        classId: unit.classId,
        level: unit.level,
        hp: unit.hp.current,
        max: unit.hp.max,
        mov: unit.mov,
        stats: STAT_LABEL.map((st) => ({ label: st.label, value: unit.stats[st.key] })),
        hands: (['left', 'right'] as const).map((slot) => {
          const id = slot === 'left' ? unit.handLeft : unit.handRight
          const item = id === null ? null : itemDef(id, env)
          const leftItem = unit.handLeft === null ? null : itemDef(unit.handLeft, env)
          const locked = slot === 'right' && leftItem?.twoHanded === true
          const un = id === null ? null : planUnequip(unit, slot, run.bag, env)
          return { slot, item: item === null ? null : { name: item.name, rarity: item.rarity, kind: item.kind, twoHanded: item.twoHanded === true }, locked, unequipReason: un === null ? 'empty' : un.ok ? null : un.reason }
        }),
        deck: (() => {
          const d = buildDeck(unit, env)
          const groups = new Map<CardSource, { uid: string; name: string; cost: number }[]>()
          for (const c of Object.values(d.cards)) {
            const def = env.content.cards[c.cardId]
            const list = groups.get(c.source) ?? []
            list.push({ uid: c.uid, name: def?.name ?? c.cardId, cost: def?.apCost ?? 0 })
            groups.set(c.source, list)
          }
          return (['innate', 'hand_left', 'hand_right', 'signature'] as const).flatMap((src) => { const cards = groups.get(src); return cards === undefined ? [] : [{ source: src, cards }] })
        })(),
      },
      selectedGear: gearItem === null || unit === null || !isGear(gearItem) ? null : {
        name: gearItem.name,
        twoHanded: gearItem.twoHanded === true,
        plans: (['left', 'right'] as const).map((slot) => { const p = planEquip(unit, slot, gearItem.id, run.bag, env); return { slot, reason: p.ok ? null : p.reason } }),
      },
    }
  }, [env, unitId, picked]), (a, b) => JSON.stringify(a) === JSON.stringify(b))
  const bag = useGame((s) => s.run?.bag ?? null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.preventDefault(); dispatch({ type: 'ui/closeModal' }) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (view === null || bag === null) return null
  const u = view.unit
  const equipTo = (slot: HandSlot): void => {
    if (u === null || picked === null) return
    const entry = bag.find((b) => b.x === picked.x && b.y === picked.y)
    if (entry === undefined) return
    const legal = canDispatch({ type: 'run/equip', unitId: u.id, itemId: entry.itemId, slot })
    if (!legal.ok) return
    dispatch({ type: 'run/equip', unitId: u.id, itemId: entry.itemId, slot })
    setPicked(null)
  }
  return (
    <div className="event" data-testid="loadout">
      <div className="event__scrim" onClick={() => dispatch({ type: 'ui/closeModal' })} />
      <div className="hud-panel loadout">
        <div className="loadout__head">
          <div className="place__eyebrow voice-display">The company</div>
          <Button variant="ghost" onPress={() => dispatch({ type: 'ui/closeModal' })} testId="loadout-close" style={{ padding: '0.35rem 0.8rem', fontSize: '0.72rem' }}><span className="keycap">Esc</span> Close</Button>
        </div>
        <div className="loadout__faces">
          {view.faces.map((f) => (
            <button key={f.id} type="button" className={`loadout__face${u?.id === f.id ? ' loadout__face--on' : ''}`} onClick={() => { setUnitId(f.id); setPicked(null) }} data-testid={`roster-${f.id}`} aria-pressed={u?.id === f.id}>
              <span className="ow-face__frame">{f.sprite !== null ? <img src={`/sprites/units/${f.sprite}.png`} alt="" draggable={false} /> : initialsOf(f.name)}</span>
              <span className="loadout__face-name">{f.name}</span>
            </button>
          ))}
        </div>
        {u !== null && (
          <div className="loadout__body">
            <div className="loadout__unit">
              <div className="loadout__title voice-display">{u.name}</div>
              <div className="loadout__sub">{className(u.classId, env)} · level {u.level} · <span className="numeral">{u.hp}/{u.max}</span> hp · mov {u.mov}</div>
              <div className="loadout__stats">
                {u.stats.map((s) => <div key={s.label} className="loadout__stat"><span className="numeral loadout__stat-value">{s.value}</span><span className="loadout__stat-label">{s.label}</span></div>)}
              </div>
              <div className="loadout__hands">
                {u.hands.map((h) => {
                  const plan = view.selectedGear?.plans.find((p) => p.slot === h.slot) ?? null
                  const canTake = view.selectedGear !== null && plan !== null && plan.reason === null && !(view.selectedGear.twoHanded && h.slot === 'right')
                  return (
                    <div key={h.slot} className={`loadout__hand${canTake ? ' loadout__hand--take' : ''}${h.locked ? ' loadout__hand--locked' : ''}`} data-testid={`hand-${h.slot}`}>
                      <div className="place__label voice-display" style={{ marginTop: 0 }}>{h.slot === 'left' ? 'Left hand' : 'Right hand'}</div>
                      {h.locked ? (
                        <div className="loadout__hand-item loadout__hand-item--empty">locked by the two-handed grip</div>
                      ) : h.item === null ? (
                        <div className="loadout__hand-item loadout__hand-item--empty">empty</div>
                      ) : (
                        <div className="loadout__hand-item" style={{ color: RARITY_TINT[h.item.rarity as keyof typeof RARITY_TINT] }}><Icon name={ITEM_ICON[h.item.kind as keyof typeof ITEM_ICON]} size={15} /> {h.item.name}{h.item.twoHanded ? ' · 2H' : ''}</div>
                      )}
                      <div className="loadout__hand-verbs">
                        {canTake && <Button variant="primary" onPress={() => equipTo(h.slot)} testId={`equip-${h.slot}`} style={{ padding: '0.35rem 0.8rem', fontSize: '0.7rem' }}>Take {view.selectedGear?.name}</Button>}
                        {view.selectedGear !== null && !canTake && plan !== null && plan.reason !== null && !h.locked && <span className="camp__choice-why">{plan.reason}</span>}
                        {/* the one verb here that takes something OFF a unit: a full slab, the same body as Take, so the destructive
                            half of the modal is not also its faintest element */}
                        {h.item !== null && !h.locked && <Button variant="secondary" disabledReason={h.unequipReason} onPress={() => dispatch({ type: 'run/unequip', unitId: u.id, slot: h.slot })} testId={`unequip-${h.slot}`} style={{ padding: '0.35rem 0.7rem', fontSize: '0.68rem' }}>Put away</Button>}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="place__label voice-display">The satchel {view.selectedGear !== null ? `· holding ${view.selectedGear.name} — pick a hand` : '· pick gear to equip'}</div>
              <BagGrid bag={bag} env={env} cell={40} selected={picked === null ? null : { x: picked.x, y: picked.y }} onSelect={(e) => setPicked(picked !== null && picked.x === e.x && picked.y === e.y ? null : e)} disabledReason={(e) => (isGear(itemDef(e.itemId, env)) ? null : 'not something a hand can hold')} />
            </div>
            <div className="loadout__deck" data-testid="deck">
              <div className="place__label voice-display" style={{ marginTop: 0 }}>The deck these hands make · {u.deck.reduce((n, g) => n + g.cards.length, 0)} cards</div>
              {u.deck.map((g) => (
                <div key={g.source} className="loadout__group">
                  <div className="loadout__group-label">{SOURCE_LABEL[g.source]}</div>
                  <div className="loadout__cards">
                    {g.cards.map((c) => <span key={c.uid} className="loadout__card"><b className="numeral">{c.cost}</b> {c.name}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
