/**
 * ui/dungeon/Dungeon.tsx — the descent (BRIEF §2.11; board F64Dungeon): the cave seen from above, drawn at 1:1.
 * Rooms are chambers cut in the rock, the ways between them are passages, the company's standard marks the room it
 * stands in, and the ways on from there are beaded (brass on the one pointed at). Every descent is made from the
 * run's seed, so the cave is LAID from pieces: the bare rock, then the chambers and passages this descent has
 * (`tools/pxworld/src/px-scenes2/export_game.py` cuts each one in place with the painter that paints the board).
 *
 * Three windows, each with one job, none of them over the cave's rooms:
 *
 *   · THE PLACE (left, top): where this is, how deep the company stands, how much is cleared, what is still below
 *     by kind, and the way back to daylight. At the mouth it carries the warning that the descent is one-way; past
 *     the first room that sentence is the refusal printed under the button (RE-GATE C 3.12).
 *   · THE COMPANY (left, under it): who is still standing and how hurt. A dungeon is an attrition run.
 *   · THE WAY ON (right): the rooms open from here as a numbered list, what the one pointed at holds and what lies
 *     beyond it, the one brass verb that enters it, and who waits at the bottom.
 *
 * The flow gate (`isLegal`) only asks screen/overlay: "the only way out is through the boss" lives with
 * `run/dungeon.ts#leaveDungeon`, so the button asks THAT for its reason, and every room that cannot be entered
 * says why when pointed at. Nothing on this screen is a live control that does nothing.
 *
 * What a room holds is told as far as the engine has decided it: a fight names the pack that keeps this cave, a
 * rest and a treasure quote the rules, and an event says only that something waits (its text is the event's own).
 */
import React, { useCallback, useState } from 'react'
import { spriteIdFor } from '../../content/index'
import { DESCENT_IS_ONE_WAY, ROOM_LABEL, leaveDungeon, reachableRooms } from '../../engine/run/dungeon'
import { displayName, livingUnits } from '../../engine/run/party'
import type { GameState, RoomType } from '../../engine/types'
import { useTip } from '../components/Tooltip'
import { KIcon } from '../filigree/items'
import { Brackets, FBtn, FChoice, Gauge, Key, Niche, Plate, SectionHead, Win, faceArt } from '../filigree/kit'
import { className } from '../names'
import { dispatch, useEnv, useGame, useLegal } from '../store'
import { listNames, usePlaceKeys, word } from '../town/shared'
import raw from './caveArt.json'

interface Piece { readonly file: string; readonly box: readonly [number, number, number, number] }
interface CaveArt {
  readonly mouth: readonly [number, number]
  readonly rooms: Readonly<Record<string, (Piece & { readonly x: number; readonly y: number }) | undefined>>
  readonly ways: Readonly<Record<string, Piece | undefined>>
  readonly keeps: Readonly<Record<string, readonly (readonly [string, number, number])[] | undefined>>
  readonly props: Readonly<Record<string, { readonly w: number; readonly h: number; readonly ax: number; readonly ay: number } | undefined>>
}
const art = raw as unknown as CaveArt

const ROOM_ICON: Readonly<Record<RoomType, string | null>> = { combat: 'fight', elite: 'elite', event: null, treasure: 'treasure', rest: 'rest', boss: 'boss' }
const EDGE = 14
const PAD = 20
const LW = 320
/** Which chamber of its row a room is, in words: two ways on of the same kind must not read as one. */
const WHERE = ['the west end', 'west of the middle', 'east of the middle', 'the east end'] as const
const RX = 1280 - EDGE - LW
/** The passage between two rooms as the painter bends it (`cave_graph.py#edge_pts`): down, across, down. */
function wayPoints(a: readonly [number, number], b: readonly [number, number], n: number): readonly (readonly [number, number])[] {
  const bend = 86 * 0.55
  const out: [number, number][] = []
  for (let k = 0; k <= n; k++) {
    const t = k / n
    const u = 1 - t
    out.push([
      u ** 3 * a[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t ** 3 * b[0],
      u ** 3 * a[1] + 3 * u * u * t * (a[1] + bend) + 3 * u * t * t * (b[1] - bend) + t ** 3 * b[1],
    ])
  }
  return out
}

/** Beads along a way, clear of the chamber at each end. */
function beads(a: readonly [number, number], b: readonly [number, number]): readonly (readonly [number, number])[] {
  const pts = wayPoints(a, b, 120)
  const out: (readonly [number, number])[] = []
  let acc = 0
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[i - 1]!
    acc += Math.hypot(p[0] - q[0], p[1] - q[1])
    const clear = (c: readonly [number, number]): boolean => Math.hypot(p[0] - c[0], (p[1] - c[1]) * 1.5) > 44
    if (acc >= 12 && clear(a) && clear(b)) { acc = 0; out.push([Math.round(p[0]), Math.round(p[1] + 4)]) }
  }
  return out
}

interface RoomView {
  readonly id: string
  readonly type: RoomType
  readonly row: number
  readonly col: number
  readonly cleared: boolean
  readonly here: boolean
  readonly reachable: boolean
  /** Above the company's row and never walked: passed by, out of reach for good. */
  readonly passed: boolean
  readonly reason: string | null
  readonly onward: readonly RoomType[]
}
interface View {
  readonly name: string
  readonly rooms: readonly RoomView[]
  readonly ways: readonly string[]
  readonly at: string | null
  readonly bossCleared: boolean
  /** From `leaveDungeon(run)` — the module that owns the rule, not the flow gate. */
  readonly leaveReason: string | null
  readonly company: readonly { readonly id: string; readonly name: string; readonly role: string; readonly sprite: string | null; readonly hp: number; readonly max: number }[]
  readonly depth: number
  readonly rowCount: number
  readonly cleared: number
  readonly total: number
  readonly ahead: readonly { readonly type: RoomType; readonly count: number }[]
  readonly packs: Readonly<Record<'combat' | 'elite' | 'boss', { readonly name: string; readonly members: readonly { readonly name: string; readonly sprite: string | null; readonly count: number }[] } | null>>
  readonly restPct: number
  readonly restFood: number
  readonly treasureGold: number
}

/** One chamber's mark in the cave: what it is, and whether it can be entered. Sealed, it says why when pointed at. */
function RoomMark({ room, x, y, onPoint }: { readonly room: RoomView; readonly x: number; readonly y: number; readonly onPoint: (id: string | null) => void }): React.JSX.Element {
  const { tipRef, tipProps, tip } = useTip(room.reason, true)
  const icon = ROOM_ICON[room.type]
  const cls = ['froom', `froom--${room.type}`]
  if (room.cleared) cls.push('froom--cleared')
  if (room.here) cls.push('froom--here')
  if (room.reachable) cls.push('froom--reach')
  if (room.passed) cls.push('froom--passed')
  return (
    <>
      <button
        ref={tipRef}
        type="button"
        className={cls.join(' ')}
        style={{ left: x - 30, top: y - 22, cursor: room.reachable ? 'pointer' : 'default' }}
        aria-label={`${ROOM_LABEL[room.type]}${room.cleared ? ', cleared' : ''}`}
        aria-disabled={!room.reachable || undefined}
        data-testid={`room-${room.id}`}
        onClick={() => { if (room.reachable) dispatch({ type: 'dungeon/moveTo', roomId: room.id }) }}
        {...tipProps}
        onPointerEnter={() => { tipProps.onPointerEnter(); if (room.reachable) onPoint(room.id) }}
        onPointerLeave={() => { tipProps.onPointerLeave(); onPoint(null) }}
        onFocus={() => { tipProps.onFocus(); if (room.reachable) onPoint(room.id) }}
        onBlur={() => { tipProps.onBlur(); onPoint(null) }}
      >
        {!room.here && (icon !== null
          ? <KIcon name={icon} style={{ position: 'absolute', left: 18, top: 8 }} />
          : <span className="abs s20 bone froom__unknown" style={{ left: 18, top: 6, width: 24 }}>?</span>)}
        {room.cleared && !room.here && <img className="abs" src="/art/ui/mark_ok.png" alt="" draggable={false} style={{ left: 40, top: 22 }} />}
        {room.passed && <img className="abs" src="/art/ui/mark_no.png" alt="" draggable={false} style={{ left: 40, top: 22 }} />}
      </button>
      {tip}
    </>
  )
}

export function DungeonScreen(): React.JSX.Element | null {
  const env = useEnv()
  const [pointed, setPointed] = useState<string | null>(null)
  const view = useGame(useCallback((s: GameState): View | null => {
    const run = s.run
    const d = run?.activeDungeon ?? null
    if (run === null || d === null) return null
    const def = env.content.dungeons[d.dungeonId]
    const reach = new Set(reachableRooms(run))
    const rowOf = (id: string): number => d.graph.rows.findIndex((row) => row.includes(id))
    const hereRow = d.position === null ? -1 : rowOf(d.position)
    const walked = new Set(Object.keys(d.cleared).filter((id) => d.cleared[id] === true))
    const pack = (groupId: string | undefined): View['packs']['combat'] => {
      const g = groupId === undefined ? undefined : env.content.enemyGroups[groupId]
      if (g === undefined) return null
      return { name: g.name, members: g.members.map((m) => ({ name: m.name, sprite: spriteIdFor(m.name, m.classId), count: m.count })) }
    }
    return {
      name: def?.name ?? d.dungeonId,
      rooms: d.graph.rows.flatMap((row, ri) => row.map((id): RoomView => {
        const r = d.graph.rooms[id]!
        const cleared = d.cleared[id] === true
        const here = d.position === id
        const reachable = reach.has(id)
        return {
          id, type: r.type, row: ri, col: r.col, cleared, here, reachable,
          passed: !here && !cleared && ri <= hereRow && !walked.has(id),
          reason: reachable ? null : here ? 'the company is standing here' : cleared ? 'already cleared: nothing left in there' : 'no way through to there from this room',
          onward: (d.graph.edges[id] ?? []).flatMap((to) => { const t = d.graph.rooms[to]; return t === undefined ? [] : [t.type] }),
        }
      })),
      ways: [
        ...(d.graph.rows[0] ?? []).map((id) => `mouth>${id}`),
        ...Object.entries(d.graph.edges).flatMap(([from, tos]) => tos.map((to) => `${from}>${to}`)),
      ],
      at: d.position,
      bossCleared: d.bossCleared,
      leaveReason: (() => { const out = leaveDungeon(run); return out.ok ? null : out.reason })(),
      company: livingUnits(run).map((u) => ({ id: u.id, name: displayName(u, run), role: className(u.classId, env), sprite: spriteIdFor(u.id, u.classId), hp: u.hp.current, max: u.hp.max })),
      depth: hereRow + 1,
      rowCount: d.graph.rows.length,
      cleared: Object.values(d.cleared).filter(Boolean).length,
      total: Object.keys(d.graph.rooms).length,
      ahead: (() => {
        const counts = new Map<RoomType, number>()
        d.graph.rows.forEach((row, ri) => {
          if (ri <= hereRow) return
          for (const id of row) {
            const r = d.graph.rooms[id]
            if (r === undefined || d.cleared[id] === true) continue
            counts.set(r.type, (counts.get(r.type) ?? 0) + 1)
          }
        })
        return [...counts].map(([type, count]) => ({ type, count }))
      })(),
      packs: { combat: pack(def?.combatEnemyGroupId), elite: pack(def?.eliteEnemyGroupId), boss: pack(def?.bossEnemyGroupId) },
      restPct: Math.round(env.rules.dungeon.restHealFraction * 100),
      restFood: env.rules.dungeon.restFoodCost,
      treasureGold: env.rules.dungeon.treasureGold,
    }
  }, [env]), (a, b) => JSON.stringify(a) === JSON.stringify(b))
  const leave = useLegal({ type: 'dungeon/leave' })
  const open = view === null ? [] : view.rooms.filter((r) => r.reachable)
  const at = open.find((r) => r.id === pointed) ?? open[0] ?? null
  const enter = (id: string): void => { setPointed(null); dispatch({ type: 'dungeon/moveTo', roomId: id }) }
  usePlaceKeys({
    Enter: at === null ? undefined : () => enter(at.id),
    ...Object.fromEntries(open.slice(0, 9).map((r, i) => [String(i + 1), () => enter(r.id)])),
  })
  if (view === null) return null

  const posOf = (id: string): readonly [number, number] => {
    if (id === 'mouth') return art.mouth
    const r = art.rooms[id]
    return r === undefined ? art.mouth : [r.x, r.y]
  }
  const here = view.at === null ? 'mouth' : view.at
  const stand = posOf(here)
  const atMouth = view.at === null
  const leaveWhy = leave.ok ? view.leaveReason : leave.reason
  const below = view.ahead.reduce((n, a) => n + a.count, 0)

  // ---- the company's rows close up for a larger company
  const KY = 394
  const KH = 720 - EDGE - KY
  const rowH = Math.max(40, Math.min(70, Math.floor((KH - 44 - 46) / Math.max(1, view.company.length))))
  const tight = rowH < 62
  const face = tight ? 32 : 48
  const tx = PAD + face + 12

  // ---- what the pointed room holds
  const pack = at === null ? null : at.type === 'combat' || at.type === 'elite' || at.type === 'boss' ? view.packs[at.type] : null
  const holds = at === null ? '' : at.type === 'rest' ? `The wounded mend ${view.restPct}% of their strength${view.restFood > 0 ? `, for ${view.restFood} food` : ', free'}.`
    : at.type === 'treasure' ? `${view.treasureGold} gold, and whatever is in the chest.`
      : at.type === 'event' ? 'Something waits in there. What it is, the room will say.'
        : pack === null ? 'Whoever keeps this cave.' : ''
  const beyond = at === null ? '' : at.onward.length === 0 ? 'Nothing lies beyond it: this is the bottom.'
    : at.onward.length > 1 && new Set(at.onward).size === 1 ? `Beyond it, ${word(at.onward.length).toLowerCase()} passages on, each to ${ROOM_LABEL[at.onward[0]!]}.`
      : `Beyond it, ${word(at.onward.length).toLowerCase()} ${at.onward.length === 1 ? 'passage' : 'passages'} on: ${listNames([...new Set(at.onward)].map((t) => ROOM_LABEL[t]))}.`
  const listTop = 44
  const detailTop = listTop + Math.max(1, open.length) * 46 + 12
  const packRows = pack === null ? 0 : Math.min(3, pack.members.length)
  const bodyTop = detailTop + 56
  const afterBody = bodyTop + (pack !== null ? packRows * 52 + 4 : 44)
  const boss = view.packs.boss
  return (
    <div className="f64 fplace fcave" data-testid="dungeon-screen">
      <img className="fplace__world" src="/art/cave/cave.png" width={1280} height={720} alt="" draggable={false} />
      {/* the descent this run has: its chambers, then its passages over them (a passage carries the breach in each wall) */}
      <div className="fcave__rock" aria-hidden>
        {view.rooms.map((r) => {
          const p = art.rooms[r.id]
          return p === undefined ? null : <img key={r.id} src={`/art/cave/${p.file}.png`} width={p.box[2]} height={p.box[3]} alt="" draggable={false} style={{ left: p.box[0], top: p.box[1] }} />
        })}
        {view.ways.map((w) => {
          const p = art.ways[w]
          return p === undefined ? null : <img key={w} src={`/art/cave/${p.file}.png`} width={p.box[2]} height={p.box[3]} alt="" draggable={false} style={{ left: p.box[0], top: p.box[1] }} />
        })}
        {view.rooms.flatMap((r) => (art.keeps[r.type] ?? []).map(([kind, dx, dy], i) => {
          const sp = art.props[kind]
          const p = posOf(r.id)
          return sp === undefined ? null : <img key={`${r.id}-${i}`} className={r.passed ? 'fcave__dim' : undefined} src={`/art/cave/prop_${kind}.png`} width={sp.w} height={sp.h} alt="" draggable={false} style={{ left: p[0] + dx - sp.ax, top: p[1] + dy - sp.ay }} />
        }))}
      </div>
      {/* the ways on from where the company stands: beads, brass on the one pointed at */}
      <div aria-hidden>
        {open.flatMap((r) => beads(stand, posOf(r.id)).map(([x, y], i) => <i key={`${r.id}-${i}`} className={`fcave__bead${at?.id === r.id ? ' fcave__bead--brass' : ''}`} style={{ left: x - 4, top: y - 4 }} />))}
      </div>
      {view.rooms.map((r) => { const p = posOf(r.id); return <RoomMark key={r.id} room={r} x={p[0]} y={p[1]} onPoint={setPointed} /> })}
      <img className="fcave__company" src="/art/world/company.png" width={64} height={60} alt="" draggable={false} style={{ left: stand[0] - 32, top: stand[1] + 10 - 52 }} data-testid="dungeon-standard" />
      {open.map((r) => { const p = posOf(r.id); return <Plate key={r.id} cx={p[0]} y={p[1] + 24} lit={at?.id === r.id}>{ROOM_LABEL[r.type]}</Plate> })}
      {at !== null && (() => { const p = posOf(at.id); return <Brackets x={p[0] - 52} y={p[1] - 34} w={104} h={84} /> })()}

      <Win x={EDGE} y={EDGE} w={LW} h={368} testId="dungeon-descent">
        <div className="tt fcard__clip" style={{ left: PAD, top: 12, width: LW - 2 * PAD }} data-testid="dungeon-name">{view.name}</div>
        <div className="s15 bone nowrap" style={{ left: PAD, top: 62 }} data-testid="dungeon-depth">{view.bossCleared ? 'Cleared' : atMouth ? 'At the mouth' : `Below · row ${view.depth} of ${view.rowCount}`}</div>
        <div className="s15 dim nowrap" style={{ right: PAD, top: 62 }}>{view.cleared} of {view.total} cleared</div>
        <div className="fgroove" style={{ left: PAD, top: 90, width: LW - 2 * PAD }} />
        <SectionHead x={PAD} y={100} w={LW - 2 * PAD} heading="Still below" note={below === 0 ? '' : `${below} ${below === 1 ? 'room' : 'rooms'}`} />
        {view.ahead.length === 0
          ? <div className="s14 it dim nowrap" style={{ left: PAD, top: 136 }}>Nothing left but the way you came.</div>
          : (
            <ul className="fcave__ahead" style={{ left: PAD, top: 130, width: LW - 2 * PAD }} data-testid="still-below">
              {view.ahead.map((a) => {
                const icon = ROOM_ICON[a.type]
                return (
                  <li key={a.type} data-kind={a.type}>
                    {icon !== null ? <KIcon name={icon} /> : <span className="s18 bone froom__unknown" style={{ display: 'inline-block', width: 24 }}>?</span>}
                    <span className="s15 bone">{ROOM_LABEL[a.type]}</span>
                    <span className="s15 bone">×{a.count}</span>
                  </li>
                )
              })}
            </ul>
          )}
        <div className="fgroove" style={{ left: PAD, top: 292, width: LW - 2 * PAD }} />
        <FBtn variant={view.bossCleared ? 'primary' : 'secondary'} disabledReason={leaveWhy} onPress={() => dispatch({ type: 'dungeon/leave' })} testId="dungeon-leave" style={{ position: 'absolute', left: PAD, top: 302 }}>{view.bossCleared ? 'Climb out' : 'Back to daylight'}</FBtn>
        {leaveWhy !== null && <div className="why fcard__clip" style={{ left: PAD, top: 342, width: LW - 2 * PAD }} data-testid="dungeon-leave-why">{leaveWhy}</div>}
      </Win>

      <Win x={EDGE} y={KY} w={LW} h={KH} testId="dungeon-company">
        <SectionHead x={PAD} y={13} w={LW - 2 * PAD} heading="The Company" note={`${word(view.company.length).toLowerCase()} of us`} />
        {view.company.map((u, i) => {
          const y = 44 + i * rowH
          const low = u.hp * 2 < u.max
          return (
            <React.Fragment key={u.id}>
              <Niche x={PAD} y={y + (tight ? 3 : 4)} size={face} {...faceArt(u.sprite, face)} />
              <div className={`${tight ? 's15' : 's16'} bone nowrap fcard__clip`} style={{ left: tx, top: y + (tight ? 1 : 3), maxWidth: LW - tx - PAD - 62 }}>{u.name}</div>
              {!tight && <div className="s13 dim nowrap" style={{ left: tx, top: y + 24 }}>{u.role}</div>}
              <div className="s15 bone nowrap" style={{ right: PAD, top: y + (tight ? 1 : 3) }}><span className={low ? 'rust' : ''}>{u.hp}</span>/{u.max}</div>
              <Gauge x={tx} y={y + (tight ? 22 : 45)} w={LW - PAD - tx} h={9} value={u.hp} max={u.max} />
              {i < view.company.length - 1 && <div className="fgroove" style={{ left: PAD, top: y + rowH - 6, width: LW - 2 * PAD }} />}
            </React.Fragment>
          )
        })}
        <div className="s13 it dim fcave__note" style={{ left: PAD, top: KH - 46, width: LW - 2 * PAD }}>
          There is no innkeeper down here. What the company spends, it spends for good.
        </div>
      </Win>

      <Win x={RX} y={EDGE} w={LW} h={720 - 2 * EDGE} testId="dungeon-way">
        <SectionHead x={PAD} y={13} w={LW - 2 * PAD} heading="The way on" note={open.length === 0 ? 'nothing open' : `${open.length} ${open.length === 1 ? 'room' : 'rooms'} open`} />
        {open.length === 0 && <div className="s14 it dim fcave__note" style={{ left: PAD, top: listTop + 6, width: LW - 2 * PAD }}>{view.bossCleared ? 'The cave is cleared. Climb out when you are ready.' : 'No room is open from here.'}</div>}
        {open.map((r, i) => (
          <FChoice key={r.id} x={PAD - 8} y={listTop + i * 46} w={LW - 2 * PAD + 8} h={44} n={i + 1} label={ROOM_LABEL[r.type]} sub={r.type === 'boss' ? 'the bottom' : `row ${r.row + 1} · ${WHERE[r.col] ?? 'the middle'}`} lit={at?.id === r.id} onPress={() => enter(r.id)} onHover={(on) => setPointed((p) => (on ? r.id : p === r.id ? null : p))} testId={`way-${r.id}`} />
        ))}
        {at !== null && (
          <>
            <div className="fgroove" style={{ left: PAD, top: detailTop - 6, width: LW - 2 * PAD }} />
            <div className="s13 dim nowrap" style={{ left: PAD, top: detailTop + 2 }}>{ROOM_LABEL[at.type]} · row {at.row + 1} of {view.rowCount}</div>
            <div className={`s18 nowrap fcard__clip ${pack !== null ? 'rust' : 'bone'}`} style={{ left: PAD, top: detailTop + 22, width: LW - 2 * PAD }} data-testid="way-title">{pack !== null ? pack.name : ROOM_LABEL[at.type]}</div>
            {pack !== null
              ? pack.members.slice(0, 3).map((m, i) => (
                <React.Fragment key={m.name}>
                  <Niche x={PAD} y={bodyTop + i * 52} size={44} {...faceArt(m.sprite, 44)} />
                  <div className="s16 rust nowrap fcard__clip" style={{ left: PAD + 60, top: bodyTop + i * 52 + 10, maxWidth: LW - 2 * PAD - 100 }}>{m.name}</div>
                  <div className="s16 bone nowrap" style={{ right: PAD, top: bodyTop + i * 52 + 10 }}>×{m.count}</div>
                </React.Fragment>
              ))
              : <div className="s14 bone fcave__note" style={{ left: PAD, top: bodyTop, width: LW - 2 * PAD }}>{holds}</div>}
            <div className="s13 dim fcave__note" style={{ left: PAD, top: afterBody, width: LW - 2 * PAD }}>{beyond}</div>
            <FBtn variant="primary" w={LW - 2 * PAD} onPress={() => enter(at.id)} testId="dungeon-enter" style={{ position: 'absolute', left: PAD, top: afterBody + 42 }}>Enter: {ROOM_LABEL[at.type]}</FBtn>
            <div className="s13 dim nowrap" style={{ left: PAD, top: afterBody + 86 }}>or click the room · <Key>Enter</Key></div>
            {/* The warning belongs at the MOUTH, beside a door that is still open: under the verb that goes through
                it. After the first room it is no longer a warning, it is the refusal under Back to daylight
                (RE-GATE C 3.12). */}
            {atMouth && !view.bossCleared && <div className="s13 straw fcave__note" style={{ left: PAD, top: afterBody + 114, width: LW - 2 * PAD }} data-testid="dungeon-warning">{DESCENT_IS_ONE_WAY}</div>}
          </>
        )}
        {boss !== null && !view.bossCleared && (
          <>
            <SectionHead x={PAD} y={720 - 2 * EDGE - 150} w={LW - 2 * PAD} heading="At the bottom" note="the boss" />
            <KIcon name="boss" style={{ position: 'absolute', left: PAD + 4, top: 720 - 2 * EDGE - 112 }} />
            <div className="s16 bone nowrap fcard__clip" style={{ left: PAD + 42, top: 720 - 2 * EDGE - 116, width: LW - 2 * PAD - 42 }}>{boss.name}</div>
            <div className="s13 dim nowrap" style={{ left: PAD + 42, top: 720 - 2 * EDGE - 94 }}>{word(boss.members.reduce((n, m) => n + m.count, 0)).toLowerCase()} of them</div>
            <div className="s13 it dim fcave__note" style={{ left: PAD, top: 720 - 2 * EDGE - 66, width: LW - 2 * PAD }}>{boss.members.map((m) => (m.count === 1 ? m.name : `${m.name} ×${m.count}`)).join(', ')}. Every way down ends in their hold.</div>
          </>
        )}
      </Win>
    </div>
  )
}
