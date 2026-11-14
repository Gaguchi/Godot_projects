/**
 * ui/town/Square.tsx — the town itself: where in town do we go? (owner 2026-10-25: "when entering town, the UI
 * should not show everything all at once"; board UxTown.)
 *
 * THE SQUARE IS THE MENU. Three doors and the road out, each a thing you can point at in the world and the same
 * thing numbered in the list for the keyboard (Mount & Blade's town menu). Pointing at a door brackets it, lights
 * its plate and pins what it offers and why it matters NOW over it: the inn says who is hurt, the market what the
 * purse holds, the tavern who has work. Nothing is bought, healed or said here; each door is its own screen.
 */
import React, { useState } from 'react'
import type { TownTab } from '../../engine/types'
import { Brackets, FChoice, FIcon, Key, Leader, Plate, Win } from '../filigree/kit'
import { dispatch, useLegal } from '../store'
import { listNames, townArt, usePlaceKeys, word, type TownView } from './shared'

type Door = 'inn' | 'shop' | 'tavern' | 'road'
const DOORS: readonly { readonly id: Exclude<Door, 'road'>; readonly verb: string; readonly plate: string }[] = [
  { id: 'inn', verb: 'Visit the inn', plate: 'The inn' },
  { id: 'shop', verb: 'Go to the market', plate: 'The market' },
  { id: 'tavern', verb: 'Visit the tavern', plate: 'The tavern' },
]
const EDGE = 14
const PAD = 20
const LIST_W = 312
const LIST_X = 1280 - EDGE - LIST_W

/** What a door offers, and the one reason it matters now. */
function offer(door: Door, v: TownView): { readonly title: string; readonly line: React.ReactNode; readonly now: React.ReactNode } {
  const hurt = v.party.filter((u) => u.wounded)
  switch (door) {
    case 'inn': return {
      title: 'The inn',
      line: <>Beds for the wounded, <img className="ficon" src="/art/ui/kicon_gold.png" width={24} height={24} alt="" draggable={false} style={{ margin: '-4px 2px 0 0' }} /><span className="straw">{v.perHead}</span> a head</>,
      now: hurt.length === 0 ? 'Nobody is hurt.' : <><span className="rust">{word(hurt.length)} of us {hurt.length === 1 ? 'is' : 'are'} hurt:</span> {listNames(hurt.map((u) => u.name))}.</>,
    }
    case 'shop': return {
      title: 'The market',
      line: `${v.stock} goods on the counter, and a buyer for ours`,
      now: v.food <= 3 ? <span className="rust">{v.food === 0 ? 'No rations left for the road.' : `Only ${v.food} ${v.food === 1 ? 'hop' : 'hops'} of rations left.`}</span> : `${v.gold} gold in the purse.`,
    }
    case 'tavern': return {
      title: 'The tavern',
      line: v.work === 0 ? 'The talk of the room, and the bounty desk' : `${word(v.work)} in the room with work for a company`,
      now: v.prisoners === 0 ? 'No prisoners in the wagon.' : <span className="straw">{word(v.prisoners)} {v.prisoners === 1 ? 'prisoner' : 'prisoners'} to turn in.</span>,
    }
    case 'road': return { title: 'The road', line: 'Back to the map, as we left it.', now: `Day ${v.day}, ${v.food} food.` }
  }
}

export function Square({ v }: { readonly v: TownView }): React.JSX.Element {
  const [point, setPoint] = useState<Door | null>(null)
  const leave = useLegal({ type: 'town/leave' })
  const go = (tab: TownTab): void => { dispatch({ type: 'ui/setTownTab', tab }) }
  const out = (): void => { if (leave.ok) dispatch({ type: 'town/leave' }) }
  const company = (): void => { dispatch({ type: 'ui/openModal', modal: { kind: 'loadout', unitId: null } }) }
  usePlaceKeys({ '1': () => go('inn'), '2': () => go('shop'), '3': () => go('tavern'), '4': out, Escape: out, c: company })

  const sq = townArt.square
  const hover = (d: Door) => ({ onMouseEnter: () => setPoint(d), onMouseLeave: () => setPoint((p) => (p === d ? null : p)) })
  const b = point === null ? null : sq.box[point]
  const o = point === null ? null : offer(point, v)
  // the forecast sits on the windows' top line, between the header and the list, as near over its door as that allows
  const FW = 340
  const fx = b === null ? 0 : Math.round(Math.max(482, Math.min(LIST_X - 12 - FW, b[0] + b[2] / 2 - FW / 2)))
  const lead = b === null ? 0 : Math.round(Math.max(fx + 24, Math.min(fx + FW - 24, b[0] + b[2] / 2)))
  // the company stands in the square: each of the three the art has a town figure for, nearest last
  const figs = v.party.flatMap((u) => (u.sprite !== null && sq.figures[u.sprite] !== undefined ? [{ id: u.id, sprite: u.sprite, f: sq.figures[u.sprite]! }] : [])).sort((p, q) => p.f.dy - q.f.dy)

  return (
    <div className="f64 fplace" data-testid="town-screen" data-tab="square">
      <img className="fplace__world" src="/art/town/square.png" width={1280} height={720} alt="" draggable={false} />
      {figs.map(({ id, sprite, f }) => (
        <React.Fragment key={id}>
          <i className="fstand__shadow" style={{ left: sq.company[0] + f.dx - 11, top: sq.company[1] + f.dy - 3, width: 22, height: 6, clipPath: 'polygon(3px 0, 19px 0, 22px 3px, 19px 6px, 3px 6px, 0 3px)' }} aria-hidden />
          <img className="fplace__fig" src={`/art/town/fig_${sprite}.png`} width={f.w} height={f.h} alt="" draggable={false} style={{ left: sq.company[0] + f.dx - f.ax, top: sq.company[1] + f.dy - f.ay }} />
        </React.Fragment>
      ))}
      {/* the doors: each building is a control, and so is its plate */}
      {DOORS.map((d) => {
        const box = sq.box[d.id]
        const plate = sq.plates[d.id]
        return (
          <React.Fragment key={d.id}>
            <button type="button" className="fplace__hit" style={{ left: box[0] - 7, top: box[1] - 6, width: box[2] + 14, height: Math.max(box[3] + 12, plate[1] + 30 - box[1]) }} aria-label={d.verb} data-testid={`door-${d.id}`} onClick={() => go(d.id)} {...hover(d.id)} />
            <Plate cx={plate[0]} y={plate[1]} lit={point === d.id}>{d.plate}</Plate>
          </React.Fragment>
        )
      })}
      <button type="button" className="fplace__hit" style={{ left: sq.box.road[0], top: sq.box.road[1], width: sq.box.road[2], height: sq.box.road[3] + 44 }} aria-label="Back to the road" data-testid="door-road" onClick={out} {...hover('road')} />
      {sq.roads.map(([cx, y]) => <Plate key={cx} cx={cx} y={y} lit={point === 'road'}>Back to the road</Plate>)}
      {b !== null && <Brackets x={b[0] - 7} y={b[1] - 6} w={b[2] + 14} h={b[3] + 12} />}
      {b !== null && o !== null && (
        <>
          <Win kind="lit" x={fx} y={EDGE} w={FW} h={112} testId="door-offer" style={{ pointerEvents: 'none' }}>
            <div className="tt" style={{ left: PAD, top: 9 }}>{o.title}</div>
            <div className="s14 straw nowrap" style={{ right: PAD, top: 22 }}>click to go {point === 'road' ? 'out' : 'in'}</div>
            <div className="s15 bone nowrap" style={{ left: PAD, top: 57 }}>{o.line}</div>
            <div className="s15 bone nowrap" style={{ left: PAD, top: 81 }}>{o.now}</div>
          </Win>
          <Leader x={lead} y0={EDGE + 114} y1={b[1] - 4} />
        </>
      )}
      {/* where we are: the town, the day, its line, the purse (gold appears where it is spent) */}
      <Win x={EDGE} y={EDGE} w={440} h={124}>
        <div className="tt" style={{ left: PAD, top: 9, ...(v.name.length > 17 ? { fontSize: 34 } : {}) }}>{v.name}</div>
        <div className="s20 bone nowrap" style={{ right: PAD, top: 13 }}><FIcon name="sun" style={{ margin: '-4px 8px 0 0' }} />Day {v.day}</div>
        <div className="s15 lt bone nowrap" style={{ left: PAD, top: 58 }}>{v.description}</div>
        <div className="fgroove" style={{ left: PAD, top: 84, width: 400 }} />
        <div className="s16 bone nowrap" style={{ left: PAD, top: 93 }}><img className="ficon" src="/art/ui/kicon_gold.png" width={24} height={24} alt="" draggable={false} style={{ margin: '-4px 8px 0 0' }} /><span data-testid="town-gold">{v.gold}</span> gold in the purse</div>
        <div className="s13 dim nowrap" style={{ right: PAD, top: 96 }}>{v.region} · town</div>
      </Win>
      {/* the same choices as the square, numbered for the keyboard; the way back last */}
      <Win x={LIST_X} y={EDGE} w={LIST_W} h={226} label="Where in town">
        {DOORS.map((d, i) => (
          <FChoice key={d.id} x={PAD + 4} y={14 + i * 34} w={LIST_W - 2 * PAD - 4} n={i + 1} label={d.verb} lit={point === d.id} onPress={() => go(d.id)} onHover={(on) => setPoint((p) => (on ? d.id : p === d.id ? null : p))} testId={`tab-${d.id}`} />
        ))}
        <div className="fgroove" style={{ left: PAD, top: 120, width: LIST_W - 2 * PAD }} />
        <FChoice x={PAD + 4} y={130} w={LIST_W - 2 * PAD - 4} n={4} label="Back to the road" keyHint="Esc" lit={point === 'road'} disabledReason={leave.ok ? null : leave.reason} onPress={out} onHover={(on) => setPoint((p) => (on ? 'road' : p === 'road' ? null : p))} testId="town-leave" />
        <div className="fgroove" style={{ left: PAD, top: 170, width: LIST_W - 2 * PAD }} />
        {/* outside the numbered places, so 1-4 still run the square: the way into the company */}
        <button type="button" className="fplace__hit" style={{ left: PAD + 4, top: 178, width: LIST_W - 2 * PAD - 4, height: 32, cursor: 'pointer' }} onClick={company} data-testid="town-company">
          <span className="abs s16 bone nowrap" style={{ left: 8, top: 5 }}>The Company</span>
          <span className="abs s13 dim nowrap" style={{ left: 118, top: 8 }}>roster and gear</span>
          <span className="abs nowrap" style={{ right: 6, top: 6 }}><Key>C</Key></span>
        </button>
      </Win>
      <div className="fplace__foot s14 bone ol1d" style={{ left: EDGE + 6, top: 692 }}>Three doors and the road out. Point at one, click to go.</div>
    </div>
  )
}
