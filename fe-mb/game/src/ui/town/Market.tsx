/**
 * ui/town/Market.tsx — the market: what do we buy or sell? (board UxMarket.) A trade screen and nothing else.
 *
 * Three windows, read left to right. THE COUNTER: every good, cheapest first, what the purse reaches above the line
 * and what it does not below it, each short by its own number. THE GOOD pointed at: what it is, the cards it brings
 * into a deck, who in the company can carry it, what the purse holds after, and the one brass button. OUR SATCHEL:
 * the same grid the company carries, what the trader pays for each thing in it, and the larder, because a town is
 * where the road is provisioned (GATE3-17: a run walked dry with 70 gold unspent).
 *
 * A refused Buy stays on the glass and says why. The flow gate (`useLegal`) answers first; gold and satchel room
 * belong to `run/economy` and `run/bag`, the modules that own those rules, so the reasons come from them.
 */
import React, { useCallback, useState } from 'react'
import { cardFace } from '../../engine/combat/words'
import { foodCount, itemDef, placeInBag } from '../../engine/run/bag'
import { buyPrice, entrySellPrice, shopStock } from '../../engine/run/economy'
import { canHold } from '../../engine/run/equipment'
import { displayName, livingUnits } from '../../engine/run/party'
import { spriteIdFor } from '../../content/index'
import type { BagEntry, EngineEnv, GameState } from '../../engine/types'
import { KIcon, iconOf, kindWords } from '../filigree/items'
import { FBtn, FChoice, Key, Niche, Numeral, SectionHead, Win, faceArt, useKitState } from '../filigree/kit'
import { className } from '../names'
import { dispatch, useEnv, useGame, useLegal } from '../store'
import { usePlaceKeys, type TownView } from './shared'

const EDGE = 14
const PAD = 20
const ROWS = 19            // one shelf of the counter: whole rows only, never one cut by the window's foot

interface Good {
  readonly id: string
  readonly name: string
  readonly icon: string
  readonly price: number | null
  readonly short: number
  readonly words: string
  readonly rarity: string
  readonly fits: boolean
  readonly reason: string | null
  readonly cards: readonly { readonly id: string; readonly ap: number; readonly name: string; readonly does: string }[]
  readonly gear: boolean
  readonly carriers: readonly { readonly id: string; readonly name: string; readonly role: string; readonly sprite: string | null; readonly ok: boolean; readonly line: string }[]
}
interface Ours { readonly key: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly name: string; readonly icon: string; readonly charges: number | null; readonly price: number }
interface Trade { readonly gold: number; readonly goods: readonly Good[]; readonly ours: readonly Ours[]; readonly free: number; readonly food: number; readonly low: boolean; readonly bagW: number; readonly bagH: number }

function selectTrade(s: GameState, env: EngineEnv): Trade | null {
  const run = s.run
  if (run === null || run.town === null) return null
  const town = env.content.towns[run.town.townId]
  if (town === undefined) return null
  const party = livingUnits(run)
  const goods = shopStock(town, run, env).map((i): Good => {
    const price = buyPrice(i)
    const fits = placeInBag(run.bag, [i.id], env) !== null
    return {
      id: i.id, name: i.name, icon: iconOf(i), price, short: price === null ? 0 : Math.max(0, price - run.gold), words: kindWords(i), rarity: i.rarity, fits,
      reason: price === null ? `${i.name} is not for sale here`
        : run.gold < price ? `${i.name} costs ${price} gold and the purse holds ${run.gold}`
          : !fits ? `no room in the satchel: ${i.name} needs a space ${i.gridSize.width} wide and ${i.gridSize.height} tall`
            : null,
      cards: (i.gearCardIds ?? []).flatMap((id) => {
        const c = env.content.cards[id]
        if (c === undefined) return []
        const f = cardFace(c)
        return [{ id, ap: c.apCost, name: c.name, does: `${f.number} ${f.foot}`.trim() }]
      }),
      gear: i.gearCardIds !== undefined || i.kind === 'quiver',
      carriers: party.map((u) => {
        const hold = canHold(u.classId, i, env)
        const left = u.handLeft === null ? null : itemDef(u.handLeft, env)
        const free = u.handLeft === null || (u.handRight === null && left?.twoHanded !== true)
        return { id: u.id, name: displayName(u, run), role: className(u.classId, env), sprite: spriteIdFor(u.id, u.classId), ok: hold.ok, line: hold.ok ? (free ? 'a hand free for it' : 'both hands full: it would swap') : hold.reason }
      }),
    }
  }).sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9) || a.name.localeCompare(b.name))
  const cells = new Set<string>()
  const ours = run.bag.map((e: BagEntry): Ours => {
    const i = itemDef(e.itemId, env)
    for (let dx = 0; dx < i.gridSize.width; dx++) for (let dy = 0; dy < i.gridSize.height; dy++) cells.add(`${e.x + dx},${e.y + dy}`)
    return { key: `${e.x},${e.y}`, x: e.x, y: e.y, w: i.gridSize.width, h: i.gridSize.height, name: i.name, icon: iconOf(i), charges: i.kind === 'food' ? e.charges : null, price: entrySellPrice(e, env) }
  })
  const food = foodCount(run.bag, env)
  return { gold: run.gold, goods, ours, free: env.rules.bag.width * env.rules.bag.height - cells.size, food, low: food <= env.rules.travel.lowFoodWarnAt, bagW: env.rules.bag.width, bagH: env.rules.bag.height }
}

function GoodRow({ g, y, picked, onPick }: { readonly g: Good; readonly y: number; readonly picked: boolean; readonly onPick: () => void }): React.JSX.Element {
  const k = useKitState()
  const beyond = g.short > 0
  return (
    <button type="button" className={`row fchoice${picked ? ' sel' : k.hovered ? ' hov' : ''}`} style={{ left: PAD, top: y, width: 340, height: 24, cursor: 'pointer' }} onClick={onPick} data-testid={`stock-${g.id}`} aria-pressed={picked} {...k.handlers}>
      <KIcon name={g.icon} style={{ position: 'absolute', left: 6, top: 0, opacity: beyond ? 0.5 : 1 }} />
      <span className={`abs s16 nowrap ${beyond ? 'faint' : picked ? 'straw' : 'bone'}`} style={{ left: 38, top: 2 }}>{g.name}</span>
      <span className={`abs s16 nowrap ${beyond ? 'faint' : 'straw'}`} style={{ left: 218, top: 2 }}><KIcon name="gold" style={{ margin: '-4px 6px 0 0', opacity: beyond ? 0.5 : 1 }} />{g.price ?? 'not for sale'}</span>
      {beyond && <span className="abs s13 rust nowrap" style={{ left: 282, top: 4 }}>{g.short} short</span>}
    </button>
  )
}

function BuyVerb({ g }: { readonly g: Good }): React.JSX.Element {
  const legal = useLegal({ type: 'town/buy', itemId: g.id })
  return <FBtn variant="primary" disabledReason={legal.ok ? g.reason : legal.reason} onPress={() => dispatch({ type: 'town/buy', itemId: g.id })} testId={`buy-${g.id}`}>{g.price === null ? 'Not for sale' : `Buy · ${g.price} gold`}</FBtn>
}

export function Market({ v }: { readonly v: TownView }): React.JSX.Element | null {
  const env = useEnv()
  const t = useGame(useCallback((s: GameState) => selectTrade(s, env), [env]), (a, b) => JSON.stringify(a) === JSON.stringify(b))
  const [pick, setPick] = useState<string | null>(null)
  const [shelf, setShelf] = useState(0)
  const [ours, setOurs] = useState<string | null>(null)
  const back = (): void => { dispatch({ type: 'ui/setTownTab', tab: 'square' }) }
  const good = t === null ? null : t.goods.find((g) => g.id === pick) ?? t.goods.find((g) => g.short === 0) ?? t.goods[0] ?? null
  const buyLegal = useLegal({ type: 'town/buy', itemId: good?.id ?? '' })
  usePlaceKeys({ Escape: back, Enter: () => { if (good !== null && good.reason === null && buyLegal.ok) dispatch({ type: 'town/buy', itemId: good.id }) } })
  if (t === null) return null

  const shelves = Math.max(1, Math.ceil(t.goods.length / ROWS))
  const page = Math.min(shelf, shelves - 1)
  const shown = t.goods.slice(page * ROWS, page * ROWS + ROWS)
  const firstBeyond = shown.findIndex((g) => g.short > 0)
  const sel = t.ours.find((o) => o.key === ours) ?? null
  const CELL = 44
  const SX = 876
  const SW = 1280 - EDGE - SX
  const rowY = (i: number): number => 44 + i * 24 + (firstBeyond >= 0 && i >= firstBeyond ? 22 : 0)
  const sellRows = t.ours.slice(0, 5)

  return (
    <div className="f64 fplace" data-testid="town-screen" data-tab="shop">
      <img className="fplace__world" src="/art/town/market.png" width={1280} height={720} alt="" draggable={false} />
      <Win x={EDGE} y={EDGE} w={400} h={92}>
        <div className="s13 dim nowrap" style={{ left: PAD, top: 14 }}>{v.name} · day {v.day}</div>
        <div className="tt" style={{ left: PAD, top: 32 }}>The market</div>
        <FChoice x={170} y={8} w={216} label="Back to the square" keyHint="Esc" onPress={back} testId="market-back" />
      </Win>

      <Win x={EDGE} y={118} w={400} h={588} testId="shop">
        <SectionHead x={PAD} y={13} w={360} heading="On the counter" note={`${t.goods.length} goods, cheapest first`} />
        <div data-testid="shop-shelf">
          {shown.map((g, i) => <GoodRow key={g.id} g={g} y={rowY(i)} picked={good?.id === g.id} onPick={() => setPick(g.id)} />)}
        </div>
        {firstBeyond >= 0 && <div className="s13 rust nowrap" style={{ left: PAD + 6, top: 44 + firstBeyond * 24 + 3 }}>beyond the purse · it holds {t.gold} gold</div>}
        {shelves > 1 && (
          <div className="nowrap" style={{ left: PAD, right: PAD, top: 542 }} data-testid="shop-pager">
            <FBtn disabledReason={page === 0 ? 'this is the front of the counter' : null} onPress={() => setShelf(page - 1)} testId="shelf-prev">Back</FBtn>
            <span className="s13 dim" style={{ margin: '0 12px' }}>shelf {page + 1} of {shelves}{page < shelves - 1 ? ` · ${t.goods.length - (page + 1) * ROWS} more further back` : ''}</span>
            <FBtn disabledReason={page >= shelves - 1 ? 'nothing further back' : null} onPress={() => setShelf(page + 1)} testId="shelf-next">More</FBtn>
          </div>
        )}
      </Win>

      {good !== null && (
        <Win x={430} y={228} w={424} h={478} testId="market-good">
          <div className="s20 bone nowrap" style={{ left: PAD, top: 14 }}><KIcon name={good.icon} style={{ margin: '-4px 8px 0 0' }} />{good.name}</div>
          <div className="s18 straw nowrap" style={{ right: PAD, top: 16 }}><KIcon name="gold" style={{ margin: '-4px 6px 0 0' }} />{good.price ?? ''}</div>
          <div className="s13 dim nowrap" style={{ left: PAD, top: 46 }}>{good.words} · {good.rarity}</div>
          {good.fits
            ? <div className="s13 meadow nowrap" style={{ right: PAD, top: 46 }}>fits the satchel</div>
            : <div className="why" style={{ right: PAD, top: 46 }}>no room in the satchel</div>}
          {good.cards.length > 0 && (
            <>
              <SectionHead x={PAD} y={72} w={384} heading="The cards it brings" note={`${good.cards.length} ${good.cards.length === 1 ? 'card' : 'cards'}`} />
              {good.cards.slice(0, 4).map((c, i) => (
                <React.Fragment key={c.id}>
                  <div className="s13 dim nowrap" style={{ left: PAD, top: 104 + i * 21 }}>{c.ap} AP</div>
                  <div className="s15 bone nowrap" style={{ left: PAD + 44, top: 102 + i * 21, fontWeight: 700 }}>{c.name}</div>
                  <div className="s14 bone nowrap" style={{ right: PAD, top: 103 + i * 21 }}>{c.does}</div>
                </React.Fragment>
              ))}
            </>
          )}
          {good.gear && (
            <>
              <SectionHead x={PAD} y={good.cards.length > 0 ? 198 : 72} w={384} heading="Who can carry it" />
              {good.carriers.slice(0, 3).map((u, i) => {
                const y = (good.cards.length > 0 ? 230 : 104) + i * 52
                return (
                  <React.Fragment key={u.id}>
                    <Niche x={PAD + 4} y={y} size={48} {...faceArt(u.sprite, 48)} />
                    <div className={`s16 nowrap ${u.ok ? 'bone' : 'faint'}`} style={{ left: PAD + 64, top: y + 3 }}>{u.name}</div>
                    {u.ok
                      ? <div className="s13 nowrap" style={{ left: PAD + 64, top: y + 25 }}><span className="dim">{u.role} · </span><span className="meadow">{u.line}</span></div>
                      : <div className="why" style={{ left: PAD + 64, top: y + 25 }}>{u.line}</div>}
                  </React.Fragment>
                )
              })}
            </>
          )}
          <div className="fgroove" style={{ left: PAD, top: 394, width: 384 }} />
          <div className="s13 dim nowrap" style={{ left: PAD, top: 410 }}>Purse</div>
          <div className="nowrap" style={{ left: PAD + 58, top: 406 }}>
            <Numeral text={good.price === null || good.short > 0 ? String(t.gold) : `${t.gold} → ${t.gold - good.price}`} label={`${t.gold} gold in the purse`} />
            <span className="s13 dim" style={{ marginLeft: 8 }}>{good.short > 0 ? `gold, ${good.short} short` : good.price === null ? 'gold' : 'gold left'}</span>
          </div>
          <div className="nowrap" style={{ right: PAD, top: 432 }}><span style={{ marginRight: 12 }}><Key>Enter</Key></span><BuyVerb g={good} /></div>
        </Win>
      )}

      <Win x={SX} y={228} w={SW} h={478}>
        <SectionHead x={PAD} y={13} w={SW - 2 * PAD} heading="Our satchel" note={`${t.free} squares free`} />
        <div className="fbag" style={{ left: Math.round((SW - t.bagW * CELL) / 2), top: 44, width: t.bagW * CELL, height: t.bagH * CELL }} data-testid="bag">
          {Array.from({ length: t.bagW * t.bagH }, (_, i) => <i key={i} className="fbag__cell" style={{ left: (i % t.bagW) * CELL, top: Math.floor(i / t.bagW) * CELL }} />)}
          {t.ours.map((o) => (
            <button key={o.key} type="button" className={`fbag__item${ours === o.key ? ' sel' : ''}`} style={{ left: o.x * CELL + 2, top: o.y * CELL + 2, width: o.w * CELL - 4, height: o.h * CELL - 4 }} aria-label={o.name} aria-pressed={ours === o.key} onClick={() => setOurs(ours === o.key ? null : o.key)} data-testid={`bag-${o.key.replace(',', '-')}`}>
              <KIcon name={o.icon} />
              {o.charges !== null && <span className="fbag__n s13 bone">×{o.charges}</span>}
            </button>
          ))}
        </div>
        <SectionHead x={PAD} y={232} w={SW - 2 * PAD} heading="What he pays for ours" />
        {sellRows.map((o, i) => (
          <button key={o.key} type="button" className={`row fchoice${ours === o.key ? ' sel' : ''}`} style={{ left: PAD - 4, top: 262 + i * 24, width: SW - 2 * PAD + 8, height: 24, cursor: 'pointer' }} onClick={() => setOurs(ours === o.key ? null : o.key)} aria-pressed={ours === o.key}>
            <KIcon name={o.icon} style={{ position: 'absolute', left: 4, top: 0 }} />
            <span className="abs s15 bone nowrap" style={{ left: 36, top: 3 }}>{o.name}{o.charges !== null ? ` ×${o.charges}` : ''}</span>
            <span className="abs s15 straw nowrap" style={{ right: 6, top: 3 }}><KIcon name="gold" style={{ margin: '-4px 6px 0 0' }} />{o.price}</span>
          </button>
        ))}
        {t.ours.length > sellRows.length && <div className="s13 dim nowrap" style={{ left: PAD, top: 262 + sellRows.length * 24 + 3 }}>and {t.ours.length - sellRows.length} more in the satchel</div>}
        <div className="nowrap" style={{ left: PAD, right: PAD, top: 392 }}>
          {sel === null
            ? <span className="s14 dim">Point at one of ours, here or in the satchel, to sell it.</span>
            : <FBtn variant="danger" onPress={() => { dispatch({ type: 'town/sell', x: sel.x, y: sel.y }); setOurs(null) }} testId="sell">Sell {sel.name} · {sel.price} gold</FBtn>}
        </div>
        <div className="fgroove" style={{ left: PAD, top: 428, width: SW - 2 * PAD }} />
        <div className={`s16 nowrap ${t.low ? 'rust' : 'bone'}`} style={{ left: PAD, top: 438 }} data-testid="larder"><KIcon name="food" style={{ margin: '-4px 8px 0 0' }} />{t.food} {t.food === 1 ? 'hop' : 'hops'} of rations</div>
        <div className={t.low ? 'why' : 's13 dim it nowrap'} style={{ right: PAD, top: 441 }}>{t.food === 0 ? 'the next hop costs blood' : t.low ? 'buy before the road' : 'enough for the road ahead'}</div>
      </Win>
    </div>
  )
}
