/**
 * ui/modals/QuestLog.tsx — Contracts (board F64Contracts): what the company has taken on, read over the dimmed world.
 * Each open contract says what it asks NOW (its stage), who gave it and where, and how long it has been open; the
 * settled ones are kept below, quiet. It is a reading, so its one button closes it: contracts move on the road and
 * in the tavern, never from this page.
 *
 * It has ONE name on every surface that opens it (the map's commands, the Pause window, this title): Contracts.
 */
import React, { useCallback } from 'react'
import { questStatus } from '../../engine/run/quests'
import type { GameState } from '../../engine/types'
import { FBtn, Key, Modal, SectionHead } from '../filigree/kit'
import { questName, stageLabel } from '../names'
import { dispatch, useEnv, useGame } from '../store'

interface Row {
  readonly id: string
  readonly name: string
  readonly stage: string
  readonly giver: string | null
  readonly day: number
  readonly openFor: number
  readonly done: boolean
}

interface View {
  readonly rows: readonly Row[]
  readonly today: number
}

const MW = 660
const PAD = 20
const IW = MW - 2 * PAD

export function QuestLogModal(): React.JSX.Element | null {
  const env = useEnv()
  const view = useGame(useCallback((s: GameState): View | null => {
    const run = s.run
    if (run === null) return null
    const giverOf = (questId: string): string | null => {
      for (const town of Object.values(env.content.towns)) {
        const row = town.tavernQuests.find((q) => q.questId === questId)
        if (row !== undefined) return `${row.npcName}, at the ${town.name} tavern`
      }
      return null
    }
    return {
      today: run.daysElapsed,
      rows: Object.entries(run.questStates).map(([id, st]) => ({
        id,
        name: questName(id, env),
        stage: stageLabel(id, st.stage, env),
        giver: giverOf(id),
        day: st.startedDay,
        openFor: Math.max(0, run.daysElapsed - st.startedDay),
        done: questStatus(run, id) === 'complete',
      })),
    }
  }, [env]), (a, b) => JSON.stringify(a) === JSON.stringify(b))
  if (view === null) return null
  const open = view.rows.filter((r) => !r.done)
  const done = view.rows.filter((r) => r.done)
  const close = (): void => { dispatch({ type: 'ui/closeModal' }) }
  // laid out top to bottom, so the window is as tall as what it holds
  let y = 96
  const body: React.ReactNode[] = []
  if (open.length === 0 && done.length === 0) {
    body.push(
      <div key="empty" data-testid="quest-empty">
        <div className="abs s16 lt it bone nowrap" style={{ left: PAD, top: y + 8 }}>Nothing written on this page yet.</div>
        <div className="abs s13 dim nowrap" style={{ left: PAD, top: y + 34 }}>Work is offered in taverns: reach a town and ask who is in the room.</div>
      </div>,
    )
    y += 70
  }
  if (open.length > 0) {
    body.push(<SectionHead key="open" x={PAD} y={y} w={IW} heading="Open" note="contracts move on the road, never from here" />)
    y += 34
    for (const r of open) {
      body.push(
        <React.Fragment key={r.id}>
          <img className="abs ficon" src="/art/ui/kicon_contract.png" width={24} height={24} alt="" draggable={false} style={{ left: PAD, top: y - 1 }} />
          <div className="abs s16 bone nowrap" style={{ left: PAD + 34, top: y }}>{r.name}</div>
          <div className="abs s13 dim nowrap" style={{ right: PAD, top: y + 3 }}>{r.openFor === 0 ? 'taken today' : `day ${r.day} · ${r.openFor} ${r.openFor === 1 ? 'day' : 'days'} open`}</div>
          <div className="abs s15 lt bone nowrap" style={{ left: PAD + 34, top: y + 23 }}>{r.stage}</div>
          {r.giver !== null && <div className="abs s13 dim nowrap" style={{ left: PAD + 34, top: y + 45 }}>{r.giver}</div>}
          <div className="abs fgroove" style={{ left: PAD, top: y + (r.giver !== null ? 70 : 52), width: IW }} />
        </React.Fragment>,
      )
      y += r.giver !== null ? 80 : 62
    }
  }
  if (done.length > 0) {
    body.push(<SectionHead key="done" x={PAD} y={y + 4} w={IW} heading="Settled" />)
    y += 38
    for (const r of done) {
      body.push(
        <React.Fragment key={r.id}>
          <div className="abs s15 dim nowrap" style={{ left: PAD + 34, top: y }}>{r.name}</div>
          <div className="abs s13 faint nowrap" style={{ right: PAD, top: y + 2 }}>taken on day {r.day}</div>
        </React.Fragment>,
      )
      y += 26
    }
  }
  const footY = y + 10
  return (
    <Modal w={MW} h={footY + 34 + 22} eyebrow="the company ledger" heading="Contracts" testId="quest-log" pageTestId="quest-log-page" onScrim={close}>
      <div className="s15 bone nowrap" style={{ right: PAD, top: 46 }} data-testid="quest-tally">
        <span className="straw">{open.length}</span> open · <span className="straw">{done.length}</span> settled · the {view.today}{ordinal(view.today)} day
      </div>
      <div className="frule" style={{ left: PAD, top: 78, width: IW }} />
      {body}
      <div className="s13 dim nowrap" style={{ left: PAD, top: footY + 9 }}><Key>Esc</Key><span style={{ marginLeft: 6 }}>closes</span></div>
      <FBtn variant="primary" w={120} onPress={close} testId="quest-log-close" autoFocus style={{ position: 'absolute', right: PAD, top: footY }}>Close</FBtn>
    </Modal>
  )
}

function ordinal(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return 'th'
  switch (n % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}
