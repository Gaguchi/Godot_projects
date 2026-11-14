/**
 * ui/modals/Pause.tsx — Esc on the map: a small window over the dimmed world (board F64Pause). Resume, the company
 * (loadout), Contracts (the quest log), sound on/off (`meta/setAudioMuted`), Save & quit to the title (the autosave
 * already holds the run).
 *
 * The five verbs are NOT of equal rank and do not look it. Resume is the one thing the window exists to undo, so it
 * is the brass button across the top; the two places to go are a pair beneath it; the sound setting is a switch, not
 * a button whose label happens to end in a value; and leaving the run sits below a rule, alone, because it is the
 * only one of the five that ends the session (crafting-game-ui signal C: one primary per view, never five slabs).
 */
import React, { useCallback } from 'react'
import type { GameState } from '../../engine/types'
import { FBtn, FSwitch, Key, Modal } from '../filigree/kit'
import { placeName } from '../names'
import { dispatch, useEnv, useGame, useLegal } from '../store'

const MW = 420
const PAD = 20
const IW = MW - 2 * PAD
const TOP = 90
const HALF = (IW - 12) / 2

export function PauseModal(): React.JSX.Element {
  const env = useEnv()
  const v = useGame(useCallback((s: GameState) => ({
    muted: s.meta.audioMuted,
    where: s.run === null ? null : `${placeName(s.run.nodeId, env) ?? ''} · day ${s.run.daysElapsed}`,
  }), [env]), (a, b) => a.muted === b.muted && a.where === b.where)
  const quit = useLegal({ type: 'meta/toTitle' })
  return (
    <Modal w={MW} h={334} eyebrow="Paused" heading="The road waits" {...(v.where !== null ? { note: v.where } : {})} testId="pause" onScrim={() => dispatch({ type: 'ui/closeModal' })}>
      <FBtn variant="primary" w={IW} onPress={() => dispatch({ type: 'ui/closeModal' })} testId="pause-resume" autoFocus style={{ position: 'absolute', left: PAD, top: TOP }}>Resume</FBtn>
      <FBtn w={HALF} onPress={() => dispatch({ type: 'ui/openModal', modal: { kind: 'loadout', unitId: null } })} testId="pause-company" style={{ position: 'absolute', left: PAD, top: TOP + 50 }}>The Company</FBtn>
      <FBtn w={HALF} onPress={() => dispatch({ type: 'ui/openModal', modal: { kind: 'questLog' } })} testId="pause-quests" style={{ position: 'absolute', left: PAD + HALF + 12, top: TOP + 50 }}>Contracts</FBtn>
      <FSwitch x={PAD} y={TOP + 104} w={IW} label="Sound" on={!v.muted} onToggle={() => dispatch({ type: 'meta/setAudioMuted', muted: !v.muted })} testId="pause-sound" />
      <div className="frule" style={{ left: PAD, top: TOP + 142, width: IW }} />
      <FBtn disabledReason={quit.ok ? null : quit.reason} onPress={() => dispatch({ type: 'meta/toTitle' })} testId="pause-quit" style={{ position: 'absolute', left: PAD, top: TOP + 166 }}>Save &amp; quit</FBtn>
      <div className="s13 dim nowrap" style={{ right: PAD, top: TOP + 173 }}><Key>Esc</Key><span style={{ marginLeft: 6 }}>resumes</span></div>
      <div className="s13 dim nowrap" style={{ left: PAD, top: TOP + 212 }}>Nothing is lost: the run saves as you go.</div>
    </Modal>
  )
}
