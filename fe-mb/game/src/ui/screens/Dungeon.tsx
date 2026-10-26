/**
 * ui/screens/Dungeon.tsx — the descent (BRIEF §2.11): the room graph drawn as a chart on dark stone, one row per
 * depth, the boss at the bottom; reachable rooms glow hearth, cleared rooms are struck through, the company's
 * lantern marks the room it stands in. Clicking a reachable room dispatches `dungeon/moveTo`; the entrance
 * button leaves (refused with its reason while a room is unresolved).
 *
 * The flow gate (`isLegal`) only asks screen/overlay: the "the only way out is through the boss" rule lives with
 * `run/dungeon.ts#leaveDungeon`, so the button asks THAT for its reason, and every unreachable room carries its
 * own — nothing on this screen is a live control that does nothing.
 *
 * The chart is 720px wide on a 1280px stage, which left the left and right thirds of the screen empty brown
 * (GATE2-16). They now carry the two readings a descent is actually decided on, and neither exists anywhere else
 * on this screen: THE COMPANY (who is still standing and how hurt they are — the dungeon is an attrition run with
 * one heal in the bag, GATE3-15) and THE DESCENT (how deep, how much is cleared, and what is still down there).
 */
import React, { useCallback } from 'react'
import '../../styles/places.css'
import { spriteIdFor } from '../../content/index'
import { DESCENT_IS_ONE_WAY, ROOM_LABEL, leaveDungeon, reachableRooms } from '../../engine/run/dungeon'
import { displayName, livingUnits } from '../../engine/run/party'
import type { GameState, RoomType } from '../../engine/types'
import { Button } from '../components/Button'
import { Icon, type IconName } from '../components/Icon'
import { useTip } from '../components/Tooltip'
import { dispatch, useEnv, useGame, useLegal } from '../store'
import { initialsOf } from '../names'

const ROOM_ICON: Readonly<Record<RoomType, IconName>> = { combat: 'combat', elite: 'elite', event: 'event', treasure: 'treasure', rest: 'rest', boss: 'boss' }
// One name per room type, shared with the headless descent (`engine/run/dungeon.ts#ROOM_LABEL`, 0093).

interface View {
  readonly name: string
  readonly rows: readonly (readonly { readonly id: string; readonly type: RoomType; readonly col: number; readonly cleared: boolean; readonly here: boolean; readonly reachable: boolean; readonly reason: string | null }[])[]
  readonly edges: readonly { readonly from: string; readonly to: string }[]
  readonly atEntrance: boolean
  readonly bossCleared: boolean
  /** From `leaveDungeon(run)` — the module that owns the rule, not the flow gate. */
  readonly leaveReason: string | null
  /** The two side readings: who is left, and how far down the company is. */
  readonly company: readonly { readonly id: string; readonly name: string; readonly classId: string; readonly hp: number; readonly max: number }[]
  readonly depth: number
  readonly rowCount: number
  readonly cleared: number
  readonly total: number
  readonly ahead: readonly { readonly type: RoomType; readonly count: number }[]
}

export function DungeonScreen(): React.JSX.Element | null {
  const env = useEnv()
  const view = useGame(useCallback((s: GameState): View | null => {
    const run = s.run
    const d = run?.activeDungeon ?? null
    if (run === null || d === null) return null
    const reach = new Set(reachableRooms(run))
    return {
      name: env.content.dungeons[d.dungeonId]?.name ?? d.dungeonId,
      rows: d.graph.rows.map((row) => row.map((id) => {
        const r = d.graph.rooms[id]!
        const cleared = d.cleared[id] === true
        const here = d.position === id
        const reachable = reach.has(id)
        return {
          id, type: r.type, col: r.col, cleared, here, reachable,
          reason: reachable ? null : here ? 'the company is standing here' : cleared ? 'already cleared — nothing left in there' : 'no way through to there from this room',
        }
      })),
      edges: Object.entries(d.graph.edges).flatMap(([from, tos]) => tos.map((to) => ({ from, to }))),
      atEntrance: d.position === null,
      bossCleared: d.bossCleared,
      leaveReason: (() => { const out = leaveDungeon(run); return out.ok ? null : out.reason })(),
      company: livingUnits(run).map((u) => ({ id: u.id, name: displayName(u, run), classId: u.classId, hp: u.hp.current, max: u.hp.max })),
      depth: d.position === null ? 0 : d.graph.rows.findIndex((row) => row.includes(d.position as string)) + 1,
      rowCount: d.graph.rows.length,
      cleared: Object.values(d.cleared).filter(Boolean).length,
      total: Object.keys(d.graph.rooms).length,
      ahead: (() => {
        const here = d.position === null ? -1 : d.graph.rows.findIndex((row) => row.includes(d.position as string))
        const counts = new Map<RoomType, number>()
        d.graph.rows.forEach((row, ri) => {
          if (ri <= here) return
          for (const id of row) {
            const r = d.graph.rooms[id]
            if (r === undefined || d.cleared[id] === true) continue
            counts.set(r.type, (counts.get(r.type) ?? 0) + 1)
          }
        })
        return [...counts].map(([type, count]) => ({ type, count }))
      })(),
    }
  }, [env]), (a, b) => JSON.stringify(a) === JSON.stringify(b))
  const leave = useLegal({ type: 'dungeon/leave' })
  if (view === null) return null
  const W = 720
  // the whole descent fits the stage: rows share the paper between the title and the foot of the frame. It was
  // 520px while a legend strip sat along the bottom saying what the "Still below" tally already says (B.7); with
  // the strip gone the chart takes the band back rather than leaving a hole where it stood.
  const ROW_H = Math.min(92, Math.floor(560 / Math.max(1, view.rows.length)))
  const H = view.rows.length * ROW_H + 40
  const pos = new Map<string, { x: number; y: number }>()
  view.rows.forEach((row, ri) => row.forEach((r) => pos.set(r.id, { x: 60 + ((r.col + 0.5) * (W - 120)) / Math.max(1, Math.max(...view.rows.map((rr) => Math.max(...rr.map((q) => q.col)) + 1))), y: 40 + ri * ROW_H })))
  return (
    <div className="place place--stone" data-testid="dungeon-screen">
      <header className="place__head place__head--stone">
        <div>
          <div className="place__eyebrow voice-display">{view.bossCleared ? 'cleared' : view.atEntrance ? 'at the mouth' : 'below'}</div>
          <h1 className="place__title voice-display">{view.name}</h1>
        </div>
        <Button variant="ghost" disabledReason={leave.ok ? view.leaveReason : leave.reason} onPress={() => dispatch({ type: 'dungeon/leave' })} testId="dungeon-leave">{view.bossCleared ? 'Climb out' : 'Back to daylight'}</Button>
      </header>
      {/* The warning belongs at the MOUTH, over the chart it is about, beside a door that is still open — after the
          first room it is no longer a warning, it is the refusal on the button (RE-GATE C 3.12). It sits in the
          band between the header and the chart, so neither aside can be pushed into. */}
      {view.atEntrance && !view.bossCleared && <p className="dungeon__warning" data-testid="dungeon-warning">{DESCENT_IS_ONE_WAY}</p>}
      <div className="dungeon__chart" style={{ width: W, height: H }}>
        <svg width={W} height={H} className="dungeon__edges" aria-hidden>
          {view.edges.map((e) => {
            const a = pos.get(e.from)
            const b = pos.get(e.to)
            if (a === undefined || b === undefined) return null
            const bend = ROW_H * 0.55
            return <path key={`${e.from}-${e.to}`} d={`M ${a.x} ${a.y + 22} C ${a.x} ${a.y + bend}, ${b.x} ${b.y - bend}, ${b.x} ${b.y - 22}`} />
          })}
        </svg>
        {view.rows.flat().map((r) => {
          const p = pos.get(r.id)!
          return <RoomMark key={r.id} room={r} x={p.x - 24} y={p.y - 24} />
        })}
      </div>
      <aside className="dungeon__aside dungeon__aside--left" data-testid="dungeon-company">
        <div className="place__label voice-display">The company</div>
        <ul className="dungeon__party">
          {view.company.map((u) => {
            const sprite = spriteIdFor(u.id, u.classId)
            const ratio = u.max <= 0 ? 0 : u.hp / u.max
            return (
              <li key={u.id} className="dungeon__member">
                <span className="place__face">{sprite !== null ? <img src={`/sprites/units/${sprite}.png`} alt="" draggable={false} /> : <span className="voice-display">{initialsOf(u.name)}</span>}</span>
                <span className="dungeon__member-stack">
                  <span className="place__name">{u.name}</span>
                  <span className="place__hpbar"><i style={{ width: `${Math.round(ratio * 100)}%`, background: ratio <= 0.25 ? 'var(--hp-crit)' : ratio <= 0.5 ? 'var(--hp-warn)' : 'var(--hp-ok)' }} /></span>
                  <span className="numeral dungeon__member-hp">{u.hp}/{u.max}</span>
                </span>
              </li>
            )
          })}
        </ul>
        <p className="dungeon__note">There is no innkeeper down here. What the company spends, it spends for good.</p>
      </aside>
      <aside className="dungeon__aside dungeon__aside--right" data-testid="dungeon-descent">
        <div className="place__label voice-display">The descent</div>
        <div className="dungeon__gauge">
          <span className="numeral dungeon__gauge-value">{view.atEntrance ? '—' : `${view.depth}/${view.rowCount}`}</span>
          <span className="dungeon__gauge-label voice-display">{view.atEntrance ? 'still at the mouth' : 'rows down'}</span>
        </div>
        <div className="dungeon__gauge">
          <span className="numeral dungeon__gauge-value">{view.cleared}/{view.total}</span>
          <span className="dungeon__gauge-label voice-display">rooms cleared</span>
        </div>
        {/* The one legend on this screen: glyph, name and how many are left. A second strip along the foot of the
            stage used to repeat the first two of those for all six types (FINAL GATE B B.7). */}
        <div className="place__label voice-display">Still below</div>
        {view.ahead.length === 0
          ? <p className="dungeon__note">Nothing left but the way you came.</p>
          : (
            <ul className="dungeon__ahead">
              {view.ahead.map((a) => (
                <li key={a.type}>
                  <b className={`room__glyph room__glyph--${a.type}`}><Icon name={ROOM_ICON[a.type]} size={15} /></b>
                  <span>{ROOM_LABEL[a.type]}</span>
                  <span className="numeral dungeon__ahead-count">×{a.count}</span>
                </li>
              ))}
            </ul>
          )}
      </aside>
    </div>
  )
}

/** One room on the chart. A sealed room says why on the glass — a stone door with a browser tooltip on it is not a door. */
function RoomMark({ room, x, y }: {
  readonly room: { readonly id: string; readonly type: RoomType; readonly cleared: boolean; readonly here: boolean; readonly reachable: boolean; readonly reason: string | null }
  readonly x: number
  readonly y: number
}): React.JSX.Element {
  const { tipRef, tipProps, tip } = useTip(room.reason ?? `Enter: ${ROOM_LABEL[room.type]}`, room.reason !== null)
  const cls = ['room', `room--${room.type}`]
  if (room.cleared) cls.push('room--cleared')
  if (room.here) cls.push('room--here')
  if (room.reachable) cls.push('room--reach')
  return (
    <>
      <button
        ref={tipRef}
        type="button"
        className={cls.join(' ')}
        style={{ left: x, top: y, cursor: room.reason === null ? 'pointer' : 'default' }}
        aria-label={`${ROOM_LABEL[room.type]}${room.cleared ? ', cleared' : ''}`}
        aria-disabled={room.reason !== null || undefined}
        data-testid={`room-${room.id}`}
        onClick={() => { if (room.reachable) dispatch({ type: 'dungeon/moveTo', roomId: room.id }) }}
        {...tipProps}
      >
        <span className="room__glyph"><Icon name={ROOM_ICON[room.type]} size={22} /></span>
        {room.here && <span className="room__lantern" />}
      </button>
      {tip}
    </>
  )
}
