/**
 * ui/town/Tavern.tsx — the tavern: who do we talk to? (board UxTavern.) The people in the room are the choices:
 * whoever has work for a company, the barkeep (the talk of the room is what he says), and the bounty desk. Each is
 * a figure you can point at and the same thing numbered in the list. Choosing one opens its card beside it; the
 * card carries the one verb. A talk opens the conversation as its own screen (`ui/overlays`).
 *
 * The room is drawn without its guest; whoever has work stands at the guest's table as their own sprite. Someone
 * with work and no sprite yet is still in the list and still has a card: the list is the truth, the figure is art.
 */
import React, { useCallback, useState } from 'react'
import { bountyFor } from '../../engine/run/economy'
import { tavernBoard } from '../../engine/run/town'
import type { GameState } from '../../engine/types'
import { className } from '../names'
import { Brackets, FBtn, FChoice, Key, Plate, SectionHead, Stand, Win } from '../filigree/kit'
import { dispatch, useEnv, useGame, useLegal } from '../store'
import { townArt, usePlaceKeys, type TownView } from './shared'

const EDGE = 14
const PAD = 20
const LW = 328
const LX = 1280 - EDGE - LW

interface Guest { readonly key: string; readonly name: string; readonly blurb: string; readonly questId: string; readonly dialogueId: string; readonly sprite: string | null }
interface Room {
  readonly guests: readonly Guest[]
  readonly rumours: readonly string[]
  readonly prisoners: readonly { readonly id: string; readonly name: string; readonly role: string; readonly bounty: number }[]
}

function TalkVerb({ g }: { readonly g: Guest }): React.JSX.Element {
  const legal = useLegal({ type: 'town/talk', questId: g.questId, dialogueId: g.dialogueId })
  return <FBtn variant="primary" disabledReason={legal.ok ? null : legal.reason} onPress={() => dispatch({ type: 'town/talk', questId: g.questId, dialogueId: g.dialogueId })} testId={`talk-${g.questId}`}>Talk</FBtn>
}

function TurnIn({ id, bounty }: { readonly id: string; readonly bounty: number }): React.JSX.Element {
  const legal = useLegal({ type: 'town/turnInPrisoner', unitId: id })
  return <FBtn disabledReason={legal.ok ? null : legal.reason} onPress={() => dispatch({ type: 'town/turnInPrisoner', unitId: id })} testId={`turnin-${id}`}>Turn in · {bounty}</FBtn>
}

export function Tavern({ v }: { readonly v: TownView }): React.JSX.Element | null {
  const env = useEnv()
  const room = useGame(useCallback((s: GameState): Room | null => {
    const run = s.run
    if (run === null || run.town === null) return null
    const town = env.content.towns[run.town.townId]
    if (town === undefined) return null
    const n = town.rumors.length
    // one row a person: someone with two things to say is one person in the room, and says the first of them
    const seen = new Set<string>()
    const guests: Guest[] = []
    for (const r of tavernBoard(run, town, env)) {
      if (seen.has(r.npcName)) continue
      seen.add(r.npcName)
      const who = Object.values(env.content.characters).find((c) => c.displayName === r.npcName || c.id === r.npcName.toLowerCase())
      guests.push({ key: `guest:${r.questId}`, name: r.npcName, blurb: r.npcDescription, questId: r.questId, dialogueId: r.dialogueId, sprite: who?.spriteId ?? null })
    }
    return {
      guests,
      rumours: n === 0 ? [] : [town.rumors[run.daysElapsed % n]!, ...(n > 1 ? [town.rumors[(run.daysElapsed + 1) % n]!] : [])],
      prisoners: run.prisoners.map((p) => ({ id: p.unitId, name: p.name, role: className(p.classId, env), bounty: bountyFor(p, env) })),
    }
  }, [env]), (a, b) => JSON.stringify(a) === JSON.stringify(b))
  const [picked, setPicked] = useState<string | null>(null)
  const back = (): void => { dispatch({ type: 'ui/setTownTab', tab: 'square' }) }
  const all = useLegal({ type: 'town/turnInAllPrisoners' })

  const guests = room?.guests ?? []
  const entries: readonly string[] = [...guests.map((g) => g.key), 'barkeep', 'desk']
  const sel = picked !== null && entries.includes(picked) ? picked : entries[0] ?? 'barkeep'
  const selGuest = guests.find((g) => g.key === sel) ?? null
  const act = (): void => { if (selGuest !== null) dispatch({ type: 'town/talk', questId: selGuest.questId, dialogueId: selGuest.dialogueId }) }
  usePlaceKeys({
    ...Object.fromEntries(entries.map((k, i) => [String(i + 1), () => setPicked(k)])),
    [String(entries.length + 1)]: back,
    Enter: act,
    Escape: back,
  })
  if (room === null) return null

  const art = townArt.tavern
  const seated = guests.find((g) => g.sprite !== null) ?? null          // the room has one guest's table
  const total = room.prisoners.reduce((sum, p) => sum + p.bounty, 0)
  const noPrisoners = room.prisoners.length === 0
  const listH = 14 + 34 + entries.length * 50 + 18 + 32 + 14
  const box = sel === 'barkeep' ? art.barkeep.box : sel === 'desk' ? art.desk.box : seated !== null && seated.key === sel ? art.guest.box : null
  const hover = (k: string) => ({ onMouseEnter: () => setPicked(k) })

  return (
    <div className="f64 fplace" data-testid="town-screen" data-tab="tavern">
      <img className="fplace__world" src="/art/town/tavern_room.png" width={1280} height={720} alt="" draggable={false} />
      {seated !== null && seated.sprite !== null && <Stand sprite={seated.sprite} x={art.guest.foot[0]} y={art.guest.foot[1]} foot={art.guest.spriteFoot} />}
      {seated !== null && <button type="button" className="fplace__hit" style={{ left: art.guest.box[0] - 6, top: art.guest.box[1] - 6, width: art.guest.box[2] + 12, height: art.guest.box[3] + 12 }} aria-label={seated.name} onClick={() => setPicked(seated.key)} {...hover(seated.key)} />}
      <button type="button" className="fplace__hit" style={{ left: art.barkeep.box[0] - 8, top: art.barkeep.box[1] - 8, width: art.barkeep.box[2] + 16, height: art.barkeep.box[3] + 40 }} aria-label="The barkeep" onClick={() => setPicked('barkeep')} {...hover('barkeep')} />
      <button type="button" className="fplace__hit" style={{ left: art.desk.box[0], top: art.desk.box[1], width: art.desk.box[2], height: art.desk.box[3] }} aria-label="The bounty desk" onClick={() => setPicked('desk')} {...hover('desk')} />
      <Plate cx={art.barkeep.plate[0]} y={art.barkeep.plate[1]} lit={sel === 'barkeep'}>The barkeep</Plate>
      <Plate cx={art.desk.plate[0]} y={art.desk.box[1] + art.desk.box[3] + 10} lit={sel === 'desk'}>The bounty desk</Plate>
      {box !== null && <Brackets x={box[0] - 8} y={box[1] - 8} w={box[2] + 16} h={box[3] + 16} />}

      <Win x={EDGE} y={EDGE} w={286} h={92}>
        <div className="s13 dim nowrap" style={{ left: PAD, top: 14 }}>{v.name} · day {v.day}</div>
        <div className="tt" style={{ left: PAD, top: 32 }}>The tavern</div>
      </Win>

      {/* the card of whoever is chosen, beside them: what they are, and the one verb */}
      {selGuest !== null && (
        <Win kind="lit" x={96} y={458} w={390} testId="tavern-card">
          <div className="s20 straw nowrap">{selGuest.name}</div>
          <p className="s15 bone" style={{ marginTop: 6, whiteSpace: 'normal' }}>{selGuest.blurb}</p>
          <div style={{ marginTop: 12, textAlign: 'right' }}><span style={{ marginRight: 12 }}><Key>Enter</Key></span><TalkVerb g={selGuest} /></div>
        </Win>
      )}
      {sel === 'barkeep' && (
        <Win kind="lit" x={560} y={300} w={400} testId="tavern-card">
          <div className="s20 straw nowrap">The barkeep</div>
          <div className="s13 dim nowrap" style={{ marginTop: 2 }}>what the room is saying</div>
          {(room.rumours.length === 0 ? ['Quiet week. Nobody’s saying much worth hearing.'] : room.rumours).map((r, i) => (
            <p key={i} className="s15 lt it bone" style={{ marginTop: 8, whiteSpace: 'normal' }} data-testid="rumour">“{r}”</p>
          ))}
        </Win>
      )}
      {sel === 'desk' && (
        <Win kind="lit" x={380} y={356} w={430} testId="tavern-card">
          <div className="s20 straw nowrap">The bounty desk</div>
          {noPrisoners ? (
            <p className="s15 bone" style={{ marginTop: 6, whiteSpace: 'normal' }}>No prisoners in the wagon. Wound a foe, then capture him on the field: the magistrate pays by the head.</p>
          ) : (
            <>
              {/* `unitId` is NOT unique in the wagon: the same named bandit can be taken twice, so the key carries the row */}
              {room.prisoners.map((p, i) => (
                <div key={`${p.id}:${i}`} style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="s16 bone nowrap" style={{ flex: 1 }}>{p.name} <span className="s13 dim">{p.role}</span></span>
                  <TurnIn id={p.id} bounty={p.bounty} />
                </div>
              ))}
              {room.prisoners.length > 1 && <div style={{ marginTop: 14, textAlign: 'right' }}><FBtn variant="primary" disabledReason={all.ok ? null : all.reason} onPress={() => dispatch({ type: 'town/turnInAllPrisoners' })} testId="turnin-all">Turn in all · {total} gold</FBtn></div>}
            </>
          )}
        </Win>
      )}

      <Win x={LX} y={720 - EDGE + 4 - listH} w={LW} h={listH} testId="tavern">
        <SectionHead x={PAD} y={13} w={LW - 2 * PAD} heading="In the room" />
        {guests.map((g, i) => (
          <FChoice key={g.key} x={PAD + 4} y={44 + i * 50} w={LW - 2 * PAD - 4} h={46} n={i + 1} label={g.name} sub="work on offer" lit={sel === g.key} onPress={() => setPicked(g.key)} onHover={(on) => { if (on) setPicked(g.key) }} testId={`room-${g.questId}`} />
        ))}
        <FChoice x={PAD + 4} y={44 + guests.length * 50} w={LW - 2 * PAD - 4} h={46} n={guests.length + 1} label="The barkeep" sub="the talk of the room" lit={sel === 'barkeep'} onPress={() => setPicked('barkeep')} onHover={(on) => { if (on) setPicked('barkeep') }} testId="room-barkeep" />
        <FChoice x={PAD + 4} y={44 + (guests.length + 1) * 50} w={LW - 2 * PAD - 4} h={46} n={guests.length + 2} label="The bounty desk" sub={noPrisoners ? 'no prisoners in the wagon' : `${room.prisoners.length} to turn in · ${total} gold`} lit={sel === 'desk'} onPress={() => setPicked('desk')} onHover={(on) => { if (on) setPicked('desk') }} testId="room-desk" />
        <div className="fgroove" style={{ left: PAD, top: 44 + entries.length * 50 + 4, width: LW - 2 * PAD }} />
        <FChoice x={PAD + 4} y={44 + entries.length * 50 + 14} w={LW - 2 * PAD - 4} n={entries.length + 1} label="Back to the square" keyHint="Esc" onPress={back} testId="tavern-back" />
      </Win>
    </div>
  )
}
