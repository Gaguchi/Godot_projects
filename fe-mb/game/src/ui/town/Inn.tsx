/**
 * ui/town/Inn.tsx — the inn: do we pay to heal the wounded? (board UxInn.) One question, the innkeeper's offer and
 * nothing more: who is hurt and what a bed mends for each, the bill, what the purse holds after it, and the one
 * brass button. The company stands in the common room as itself. No satchel, no shop, no rumours: those are other
 * doors (owner 2026-10-25: one job per screen).
 */
import React from 'react'
import { FBtn, FChoice, Gauge, Key, Niche, Numeral, Plate, SectionHead, Stand, Win, faceArt } from '../filigree/kit'
import { dispatch, useLegal } from '../store'
import { BOARD_FOOT, townArt, usePlaceKeys, word, type TownView } from './shared'

const EDGE = 14
const PAD = 20
const OW = 420
const OX = 1280 - EDGE - OW

export function Inn({ v }: { readonly v: TownView }): React.JSX.Element {
  const heal = useLegal({ type: 'town/innHeal' })
  const back = (): void => { dispatch({ type: 'ui/setTownTab', tab: 'square' }) }
  const rest = (): void => { if (heal.ok) dispatch({ type: 'town/innHeal' }) }
  usePlaceKeys({ Enter: rest, Escape: back })

  const hurt = v.party.filter((u) => u.wounded)
  const whole = v.party.filter((u) => !u.wounded)
  const art = townArt.inn
  const inner = OW - 2 * PAD
  // the offer is laid out top to bottom: each wounded name with its bar, the whole ones quiet, then the bill
  let y = 78
  const rows: React.ReactNode[] = []
  for (const u of hurt) {
    rows.push(
      <React.Fragment key={u.id}>
        <Niche x={PAD} y={y + 2} size={48} {...faceArt(u.sprite, 48)} />
        <div className="s16 bone nowrap" style={{ left: PAD + 60, top: y + 2 }}>{u.name}</div>
        <div className="s13 dim nowrap" style={{ left: PAD + 60, top: y + 23 }}>{u.role}</div>
        <div className="s16 bone nowrap" style={{ right: PAD, top: y + 2 }}><span className={u.hp * 2 < u.max ? 'rust' : ''}>{u.hp}</span>/{u.max}</div>
        <div className="s13 meadow nowrap" style={{ right: PAD, top: y + 23 }}>a bed mends {u.max - u.hp}</div>
        <Gauge x={PAD + 60} y={y + 43} w={inner - 60} h={9} value={u.hp} max={u.max} gain={u.max - u.hp} />
        <div className="fgroove" style={{ left: PAD, top: y + 55, width: inner }} />
      </React.Fragment>,
    )
    y += 62
  }
  for (const u of whole) {
    rows.push(
      <React.Fragment key={u.id}>
        <Niche x={PAD + 8} y={y} size={32} {...faceArt(u.sprite, 32)} />
        <div className="s15 bone nowrap" style={{ left: PAD + 60, top: y + 7 }}>{u.name}</div>
        <div className="s13 dim nowrap" style={{ right: PAD, top: y + 8 }}>{u.hp}/{u.max} · whole, no bed needed</div>
      </React.Fragment>,
    )
    y += 40
  }
  const ruleY = y + 2
  y += 14
  const billY = y
  y += 30
  const purseY = y
  y += 42
  const verbY = y
  y += 48
  const backY = y + 8
  const oh = backY + 32 + 12

  return (
    <div className="f64 fplace" data-testid="town-screen" data-tab="inn">
      <img className="fplace__world" src="/art/town/inn_room.png" width={1280} height={720} alt="" draggable={false} />
      {/* the company in the common room, each on a spot the room has, as their own sprites at 1:1 */}
      {v.party.slice(0, art.spots.length).map((u, i) => (u.sprite === null ? null : <Stand key={u.id} sprite={u.sprite} x={art.spots[i]![0]} y={art.spots[i]![1]} foot={art.feet[u.sprite] ?? BOARD_FOOT} />))}
      <Plate cx={art.counter[0] + Math.round(art.counter[2] / 2)} y={art.counter[1] + 40}>The innkeeper</Plate>
      <Win x={EDGE} y={EDGE} w={286} h={92}>
        <div className="s13 dim nowrap" style={{ left: PAD, top: 14 }}>{v.name} · day {v.day}</div>
        <div className="tt" style={{ left: PAD, top: 32 }}>The inn</div>
      </Win>
      <Win x={OX} y={EDGE} w={OW} h={oh} testId="inn">
        <SectionHead x={PAD} y={13} w={inner} heading="The innkeeper's offer" note={`${hurt.length} of ${v.party.length} hurt`} />
        <div className="s15 lt it bone nowrap" style={{ left: PAD, top: 46 }}>“A bed, a fire, and a bowl of something hot.”</div>
        {rows}
        <div className="frule" style={{ left: PAD, top: ruleY, width: inner }} />
        <div className="s16 bone nowrap" style={{ left: PAD, top: billY }}>
          {hurt.length === 0 ? 'Nobody is hurt. A bed wants a wound in it.' : `${word(hurt.length)} ${hurt.length === 1 ? 'bed' : 'beds'}, ${v.perHead} gold a head`}
        </div>
        <div className="s13 dim nowrap" style={{ left: PAD, top: purseY + 4 }}>Purse</div>
        <div className="nowrap" style={{ left: PAD + 58, top: purseY }} data-testid="inn-purse">
          <Numeral text={hurt.length === 0 || v.gold < v.bill ? String(v.gold) : `${v.gold} → ${v.gold - v.bill}`} label={hurt.length === 0 ? `${v.gold} gold` : `${v.gold} gold, ${v.gold - v.bill} after the bill`} />
          <span className="s13 dim" style={{ marginLeft: 8 }}>{hurt.length === 0 ? 'gold' : v.gold < v.bill ? `gold, the bill is ${v.bill}` : 'gold left'}</span>
        </div>
        <div className="nowrap" style={{ right: PAD, top: verbY }}>
          <span style={{ marginRight: 12 }}><Key>Enter</Key></span>
          <FBtn variant="primary" disabledReason={heal.ok ? null : heal.reason} onPress={rest} testId="inn-heal">{hurt.length === 0 ? 'Rest' : `Rest the wounded · ${v.bill} gold`}</FBtn>
        </div>
        <div className="fgroove" style={{ left: PAD, top: backY - 8, width: inner }} />
        <FChoice x={PAD - 8} y={backY} w={inner + 8} label="Back to the square" keyHint="Esc" onPress={back} testId="inn-back" />
      </Win>
    </div>
  )
}
