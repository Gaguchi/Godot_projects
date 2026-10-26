/**
 * ui/screens/Town.tsx — Inn / Shop / Tavern (BRIEF §2.10, §2.6): the region vista over the top, a leather
 * counter below. Three forged tabs (`ui.townTab`); the satchel sits on the right of every tab because the
 * shop sells FROM it and the inn bill is paid from the purse beside it. Inn: one bill for every wounded name.
 * Shop: the stock as forged cards with prices, refused-with-reason when the purse or the bag says no (the flow
 * gate never checks gold or bag room — those reasons come from `run/economy` and `run/bag`, the modules that own
 * the rule); click a satchel item to sell it for its quoted price. Tavern: today's rumours, the quest board (Talk opens the
 * dialogue), and the bounty desk for prisoners.
 */
import React, { useCallback, useState } from 'react'
import '../../styles/places.css'
import type { Action } from '../../engine/actions'
import { foodCount, itemDef, placeInBag } from '../../engine/run/bag'
import { bountyFor, buyPrice, entrySellPrice, innCost, shopStock } from '../../engine/run/economy'
import { displayName, livingUnits } from '../../engine/run/party'
import { spriteIdFor } from '../../content/index'
import { tavernBoard } from '../../engine/run/town'
import type { GameState, Item, TownTab } from '../../engine/types'
import { BagGrid, ITEM_ICON, RARITY_TINT } from '../components/BagGrid'
import { Button } from '../components/Button'
import { Icon, type IconName } from '../components/Icon'
import { className, initialsOf } from '../names'
import { dispatch, useEnv, useGame, useLegal } from '../store'

function Verb({ action, label, variant = 'secondary', testId, style }: { readonly action: Action; readonly label: string; readonly variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; readonly testId?: string; readonly style?: React.CSSProperties }): React.JSX.Element {
  const legal = useLegal(action)
  return <Button variant={variant} disabledReason={legal.ok ? null : legal.reason} onPress={() => dispatch(action)} {...(testId !== undefined ? { testId } : {})} {...(style !== undefined ? { style } : {})}>{label}</Button>
}

const TABS: readonly { readonly id: TownTab; readonly label: string }[] = [{ id: 'inn', label: 'Inn' }, { id: 'shop', label: 'Shop' }, { id: 'tavern', label: 'Tavern' }]

/** What a shelved item IS, in the shopkeeper's words — never the raw `kind` / `weaponClass` id. */
function shelfWords(i: Item): string {
  if (i.kind === 'food') return `${i.charges ?? 1} rations`
  if (i.kind === 'potion') return i.effect?.kind === 'Heal' ? `heals ${i.effect.amount}` : `+${i.effect?.amount ?? 0} AP`
  if (i.kind === 'quiver') return 'quiver'
  if (i.kind === 'shield') return 'off-hand shield'
  return `${i.twoHanded === true ? 'two-handed' : 'one-handed'} ${i.weaponClass ?? i.kind}`
}

/**
 * The satchel footprint, drawn to scale: a 1×2 sword is one pip wide and two tall.
 * The grid inventory is a packing puzzle, so the shape — not a "1×2" code — is the
 * thing the buyer needs to judge against the squares they have left.
 */
function Footprint({ w, h }: { readonly w: number; readonly h: number }): React.JSX.Element {
  return (
    <span
      className="shop__foot"
      role="img"
      aria-label={`takes ${w} by ${h} squares of the satchel`}
      style={{ gridTemplateColumns: `repeat(${w}, 3px)`, gridTemplateRows: `repeat(${h}, 3px)` }}
    >
      {Array.from({ length: w * h }, (_, k) => <i key={k} />)}
    </span>
  )
}

/** Buy: the flow gate (`useLegal`) first, then the reason the owning module gives — one sentence, never a dead button. */
function BuyVerb({ itemId, label, reason }: { readonly itemId: string; readonly label: string; readonly reason: string | null }): React.JSX.Element {
  const legal = useLegal({ type: 'town/buy', itemId })
  return (
    <Button
      variant="secondary"
      disabledReason={legal.ok ? reason : legal.reason}
      onPress={() => dispatch({ type: 'town/buy', itemId })}
      testId={`buy-${itemId}`}
      style={{ padding: '0.35rem 0.8rem', fontSize: '0.7rem', marginTop: 'auto' }}
    >
      {label}
    </Button>
  )
}

function Inn(): React.JSX.Element {
  const env = useEnv()
  const view = useGame(useCallback((s: GameState) => {
    const run = s.run
    if (run === null || run.town === null) return null
    const town = env.content.towns[run.town.townId]
    if (town === undefined) return null
    const cost = innCost(town, run, env)
    return { perUnit: town.innHealCostPerUnit, total: cost.total, gold: run.gold, wounded: cost.wounded.length, roster: livingUnits(run).map((u) => ({ id: u.id, name: displayName(u, run), classId: u.classId, hp: u.hp.current, max: u.hp.max, wounded: cost.wounded.includes(u.id) })) }
  }, [env]), (a, b) => JSON.stringify(a) === JSON.stringify(b))
  if (view === null) return <></>
  return (
    <div className="place__pane" data-testid="inn">
      <p className="place__lead">A bed, a fire, and a bowl of something hot. The innkeeper charges <b className="numeral">{view.perUnit}</b> gold a head for the wounded.</p>
      <div className="place__label voice-display">The company</div>
      {/* The roster IS the inn's content — this is the screen where the player decides who needs a bed — so the
          company is drawn at the size of a decision: a face, a name, a bar and the bill. Three name-height rows
          left 180px of empty counter under them and parked REST alone on the bottom edge (GATE2-16). */}
      <ul className="place__list place__list--beds">
        {view.roster.map((u) => {
          const ratio = u.max <= 0 ? 0 : u.hp / u.max
          const sprite = spriteIdFor(u.id, u.classId)
          return (
            <li key={u.id} className={`place__bed${u.wounded ? ' place__bed--wounded' : ''}`}>
              <span className="place__face">{sprite !== null ? <img src={`/sprites/units/${sprite}.png`} alt="" draggable={false} /> : <span className="voice-display">{initialsOf(u.name)}</span>}</span>
              <span className="place__stack">
                <span className="place__name">{u.name}</span>
                <span className="place__sub">{className(u.classId, env)}</span>
              </span>
              <span className="place__hpbar"><i style={{ width: `${Math.round(ratio * 100)}%`, background: ratio <= 0.25 ? 'var(--hp-crit)' : ratio <= 0.5 ? 'var(--hp-warn)' : 'var(--hp-ok)' }} /></span>
              <span className="numeral place__num">{u.hp}/{u.max}</span>
              <span className="place__bill numeral">{u.wounded ? `${view.perUnit} g` : '—'}</span>
            </li>
          )
        })}
      </ul>
      {view.wounded === 0 && <Empty icon="rest" line="Nobody is hurt." hint="A bed is only worth its gold with a wound in it — come back bleeding." />}
      {/* The bed's two refusals used to be written out a THIRD time here, beside the reducer's and the CLI's.
          They have one home now (`run/economy.ts#canInnHeal`) and this reads it through the flow gate. */}
      <div className="place__verbs">
        <Verb action={{ type: 'town/innHeal' }} label={view.wounded === 0 ? 'Rest' : `Rest the wounded · ${view.total} gold`} variant="primary" testId="inn-heal" />
      </div>
    </div>
  )
}

/**
 * A designed empty state: a dimmed glyph, the fact in the house's voice, and the thing that would fill it
 * (crafting-game-ui signal C — "empty states as plain italics" is the amateur read). Every counter register that
 * can be empty uses this one, so the three tabs speak with one voice.
 */
function Empty({ icon, line, hint }: { readonly icon: IconName; readonly line: string; readonly hint: string }): React.JSX.Element {
  return (
    <div className="place__empty" data-testid="place-empty">
      <span className="place__empty-mark" aria-hidden><Icon name={icon} size={26} /></span>
      <span className="place__empty-stack">
        <span className="place__empty-line">{line}</span>
        <span className="place__empty-hint">{hint}</span>
      </span>
    </div>
  )
}

/** One shelf of the shop. Eight is what fits the counter at full card size with nothing clipped. */
const SHELF = 8

function Shop({ selected, onSelect }: { readonly selected: { readonly x: number; readonly y: number } | null; readonly onSelect: (p: { readonly x: number; readonly y: number } | null) => void }): React.JSX.Element {
  const env = useEnv()
  const [shelf, setShelf] = useState(0)
  const view = useGame(useCallback((s: GameState) => {
    const run = s.run
    if (run === null || run.town === null) return null
    const town = env.content.towns[run.town.townId]
    if (town === undefined) return null
    return {
      gold: run.gold,
      stock: shopStock(town, run, env).map((i) => {
        const price = buyPrice(i)
        return {
          id: i.id, name: i.name, kind: i.kind, rarity: i.rarity, price,
          // The satchel footprint is DRAWN (`<Footprint>`), never printed as the authored grid code — "sword · 1×2"
          // was a dev string on a shop shelf (crafting-game-ui signal C).
          foot: { w: i.gridSize.width, h: i.gridSize.height },
          blurb: shelfWords(i),
          // `isLegal` gates the FLOW only; gold and bag room belong to `run/economy` and `run/bag`, so the shop
          // asks them itself (the Inn does the same with `innCost` above) — otherwise every Buy is a live button
          // that does nothing.
          reason: price === null ? `${i.name} is not for sale here`
            : run.gold < price ? `${i.name} costs ${price} gold — the purse holds ${run.gold}`
              : placeInBag(run.bag, [i.id], env) === null ? `no room in the satchel — ${i.name} needs a space ${i.gridSize.width} wide and ${i.gridSize.height} tall`
                : null,
        }
      }),
      // the quote is `entrySellPrice` — the same number `run/town.ts#sell` pays, so a part-used ration is never
      // offered at the price of a full one
      selectedItem: selected === null ? null : (() => { const e = run.bag.find((b) => b.x === selected.x && b.y === selected.y); if (e === undefined) return null; return { name: itemDef(e.itemId, env).name, price: entrySellPrice(e, env) } })(),
    }
  }, [env, selected]), (a, b) => JSON.stringify(a) === JSON.stringify(b))
  if (view === null) return <></>
  // The counter holds one shelf at a time. It used to hold all 26 in a 323px box with a zero-width overlay
  // scrollbar and a 22px fade nobody could see, so two thirds of the stock was invisible and the third row was
  // sliced through the middle of the cards (GATE2-2 / GATE3-4). A shelf is a whole number of whole cards.
  const shelves = Math.max(1, Math.ceil(view.stock.length / SHELF))
  const page = Math.min(shelf, shelves - 1)
  const shown = view.stock.slice(page * SHELF, page * SHELF + SHELF)
  return (
    <div className="place__pane" data-testid="shop">
      <div className="shop__stock" data-testid="shop-shelf">
        {shown.map((i) => (
          <div key={i.id} className="forged-card shop__card" style={{ '--rarity': RARITY_TINT[i.rarity] } as React.CSSProperties} data-testid={`stock-${i.id}`}>
            <div className="shop__glyph"><Icon name={ITEM_ICON[i.kind]} size={26} /></div>
            <div className="shop__name">{i.name}</div>
            <div className="shop__blurb">{i.blurb}<Footprint w={i.foot.w} h={i.foot.h} /></div>
            <BuyVerb itemId={i.id} label={i.price === null ? 'Not for sale' : `Buy · ${i.price}`} reason={i.reason} />
          </div>
        ))}
      </div>
      {shelves > 1 && (
        <div className="shop__pager" data-testid="shop-pager">
          <Button variant="ghost" disabledReason={page === 0 ? 'this is the front of the counter' : null} onPress={() => setShelf(page - 1)} testId="shelf-prev" style={{ padding: '0.3rem 0.7rem', fontSize: '0.68rem' }}>Back</Button>
          <span className="shop__pager-read">Shelf <b className="numeral">{page + 1}</b> of <b className="numeral">{shelves}</b> · <b className="numeral">{view.stock.length}</b> on the counter</span>
          <Button variant="ghost" disabledReason={page >= shelves - 1 ? 'nothing further back' : null} onPress={() => setShelf(page + 1)} testId="shelf-next" style={{ padding: '0.3rem 0.7rem', fontSize: '0.68rem' }}>More</Button>
        </div>
      )}
      <div className="shop__sell">
        {view.selectedItem === null ? (
          <span className="place__hint">Pick something from the satchel to sell it.</span>
        ) : (
          <>
            <span className="place__name">{view.selectedItem.name}</span>
            <Button variant="danger" onPress={() => { if (selected !== null) { dispatch({ type: 'town/sell', x: selected.x, y: selected.y }); onSelect(null) } }} testId="sell" style={{ padding: '0.4rem 0.9rem', fontSize: '0.72rem' }}>Sell · {view.selectedItem.price} gold</Button>
            <Button variant="ghost" onPress={() => onSelect(null)} style={{ padding: '0.4rem 0.7rem', fontSize: '0.72rem' }}>Keep</Button>
          </>
        )}
      </div>
    </div>
  )
}

function Tavern(): React.JSX.Element {
  const env = useEnv()
  const view = useGame(useCallback((s: GameState) => {
    const run = s.run
    if (run === null || run.town === null) return null
    const town = env.content.towns[run.town.townId]
    if (town === undefined) return null
    const n = town.rumors.length
    const rumors = n === 0 ? [] : [town.rumors[run.daysElapsed % n]!, ...(n > 1 ? [town.rumors[(run.daysElapsed + 1) % n]!] : [])]
    return {
      rumors,
      board: tavernBoard(run, town, env).map((r) => ({ questId: r.questId, dialogueId: r.dialogueId, npc: r.npcName, blurb: r.npcDescription })),
      prisoners: run.prisoners.map((p) => ({ id: p.unitId, name: p.name, classId: p.classId, bounty: bountyFor(p, env) })),
    }
  }, [env]), (a, b) => JSON.stringify(a) === JSON.stringify(b))
  if (view === null) return <></>
  const total = view.prisoners.reduce((sum, p) => sum + p.bounty, 0)
  // The tavern is THREE REGISTERS of a counter, each taking its share of the pane: what the room is saying, what
  // work is on the board, what the magistrate owes. Stacked at the top they filled the upper half and left the
  // lower 45% ruled and empty (GATE2-16); as registers the pane is composed whatever the town is holding.
  return (
    <div className="place__pane place__pane--registers" data-testid="tavern">
      <section className="place__reg place__reg--talk">
        <div className="place__label voice-display">What the room is saying</div>
        <div className="tavern__rumours">
          {view.rumors.length === 0
            ? <p className="tavern__rumour">“Quiet week. Nobody’s saying much worth hearing.”</p>
            : view.rumors.map((r, i) => <p key={i} className="tavern__rumour">“{r}”</p>)}
        </div>
      </section>
      <section className="place__reg">
        <div className="place__label voice-display">The board</div>
        {view.board.length === 0
          ? <Empty icon="event" line="No work on the board today." hint="Word travels with the company — walk on and ask in the next town." />
          : (
            <ul className="place__list">
              {view.board.map((r) => (
                <li key={r.questId} className="place__row place__row--tall">
                  <div className="place__stack"><span className="place__name">{r.npc}</span><span className="place__sub">{r.blurb}</span></div>
                  <Verb action={{ type: 'town/talk', questId: r.questId, dialogueId: r.dialogueId }} label="Talk" variant="primary" testId={`talk-${r.questId}`} style={{ padding: '0.4rem 1rem', fontSize: '0.72rem' }} />
                </li>
              ))}
            </ul>
          )}
      </section>
      <section className="place__reg">
        <div className="place__label voice-display">The bounty desk</div>
        {view.prisoners.length === 0
          ? <Empty icon="shackles" line="No prisoners in the wagon." hint="Wound a foe, then Capture him on the field — the magistrate pays by the head." />
          : (
            <>
              <ul className="place__list">
                {/* `unitId` is NOT unique in the wagon — the same named bandit can be captured twice — so the row key
                    carries its index, and `turnIn` consumes one row per requested id. */}
                {view.prisoners.map((p, i) => (
                  <li key={`${p.id}:${i}`} className="place__row">
                    <span className="place__name"><Icon name="shackles" size={15} title="prisoner" /> {p.name}</span>
                    <span className="place__sub">{className(p.classId, env)}</span>
                    <Verb action={{ type: 'town/turnInPrisoner', unitId: p.id }} label={`Turn in · ${p.bounty}`} testId={`turnin-${p.id}`} style={{ padding: '0.35rem 0.8rem', fontSize: '0.68rem' }} />
                  </li>
                ))}
              </ul>
              {view.prisoners.length > 1 && <div className="place__verbs"><Verb action={{ type: 'town/turnInAllPrisoners' }} label={`Turn in all · ${total} gold`} variant="primary" testId="turnin-all" /></div>}
            </>
          )}
      </section>
    </div>
  )
}

/**
 * The larder, under the satchel on every tab. A town is where the road is provisioned, the satchel column had
 * 200px of nothing under it on all three tabs, and GATE3-17 walked a run dry with 70 gold unspent because the only
 * warning lived on the map band the player had already left. It reads the same `foodCount` the band does.
 */
function Larder({ bag }: { readonly bag: GameState['run'] extends null ? never : NonNullable<GameState['run']>['bag'] }): React.JSX.Element {
  const env = useEnv()
  const food = foodCount(bag, env)
  const low = food <= env.rules.travel.lowFoodWarnAt
  return (
    <div className={`larder${low ? ' larder--low' : ''}`} data-testid="larder">
      <span className="larder__mark" aria-hidden><Icon name="food" size={22} /></span>
      <span className="larder__stack">
        <span className="place__label voice-display larder__label">The larder</span>
        <span className="larder__read"><b className="numeral">{food}</b> {food === 1 ? 'hop' : 'hops'} of rations</span>
      </span>
      <span className="larder__note">{food === 0 ? 'the next hop costs blood' : low ? 'buy before the road' : 'enough for the road ahead'}</span>
    </div>
  )
}

const selectHeader = (s: GameState): { readonly townId: string; readonly tab: TownTab; readonly gold: number; readonly regionId: string } | null => {
  const run = s.run
  if (run === null || run.town === null) return null
  return { townId: run.town.townId, tab: s.ui.townTab, gold: run.gold, regionId: '' }
}

export function TownScreen(): React.JSX.Element | null {
  const env = useEnv()
  const header = useGame(selectHeader, (a, b) => JSON.stringify(a) === JSON.stringify(b))
  const bag = useGame((s) => s.run?.bag ?? null)
  const [selected, setSelected] = useState<{ readonly x: number; readonly y: number } | null>(null)
  if (header === null || bag === null) return null
  const town = env.content.towns[header.townId]
  if (town === undefined) return null
  return (
    <div className="place" data-testid="town-screen">
      <img className="place__vista" src={`/art/backdrops/${town.regionId}.png`} alt="" draggable={false} />
      <div className="place__dusk" />
      <header className="place__head">
        <div>
          <div className="place__eyebrow voice-display">{env.content.regions[town.regionId]?.name ?? town.regionId} · town</div>
          <h1 className="place__title voice-display">{town.name}</h1>
          <p className="place__desc">{town.description}</p>
        </div>
        <div className="place__purse">
          <span className="place__eyebrow voice-display">Purse</span>
          <span className="numeral place__gold" data-testid="town-gold">{header.gold}</span>
        </div>
      </header>
      <div className="place__counter">
        <nav className="place__tabs" aria-label="Town">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`place__tab${header.tab === t.id ? ' place__tab--on' : ''}`} aria-pressed={header.tab === t.id} onClick={() => dispatch({ type: 'ui/setTownTab', tab: t.id })} data-testid={`tab-${t.id}`}>{t.label}</button>
          ))}
          <span style={{ flex: 1 }} />
          <Button variant="secondary" onPress={() => dispatch({ type: 'ui/openModal', modal: { kind: 'loadout', unitId: null } })} testId="town-company" style={{ fontSize: '0.72rem', padding: '0.4rem 0.9rem', marginRight: 8 }}>Company</Button>
          <Verb action={{ type: 'town/leave' }} label="Back to the road" variant="ghost" testId="town-leave" />
        </nav>
        <div className="place__body">
          <div className="place__main">
            {header.tab === 'inn' && <Inn />}
            {header.tab === 'shop' && <Shop selected={selected} onSelect={setSelected} />}
            {header.tab === 'tavern' && <Tavern />}
          </div>
          <aside className="place__side">
            <div className="place__label voice-display">The satchel</div>
            <BagGrid
              bag={bag}
              env={env}
              cell={44}
              selected={header.tab === 'shop' ? selected : null}
              onSelect={(e) => { if (header.tab === 'shop') setSelected(selected !== null && selected.x === e.x && selected.y === e.y ? null : { x: e.x, y: e.y }) }}
              {...(header.tab === 'shop' ? {} : { disabledReason: () => 'the shop counter is where things change hands' })}
            />
            <Larder bag={bag} />
          </aside>
        </div>
      </div>
    </div>
  )
}
