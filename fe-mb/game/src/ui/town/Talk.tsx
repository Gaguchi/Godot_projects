/**
 * ui/town/Talk.tsx — a conversation in the tavern, as its own screen (boards UxTalk and UxTalkChoice; owner
 * 2026-10-25: "someone to talk to, and then the dialogue choices, all separate screens ... the standard VN screens").
 *
 * The standard visual-novel say screen: the room a step down behind, whoever is in the conversation standing either
 * side as their own art, the line in one wide box at the foot with the speaker's name on a plate on the SPEAKER'S
 * side (the plate and the lighting must agree, RE-GATE B 2.4), and the answers as a numbered list between the two.
 * Nothing else is on the glass: no place label, no purse, no way back out of a conversation but through it.
 *
 * WHO STANDS WHERE is this screen's own staging, read off the engine's two slots (`PendingDialogue.busts`). The
 * engine seats "our side" on the left, which puts a hireling like Kael where the company's lead should be and leaves
 * nobody for him to talk to. Here, someone talking to the company stands on the RIGHT, and the lead stands on the
 * left as the one listening (Fire Emblem's supports: the two face each other). Two outsiders share the stage as the
 * engine has them, except that whoever has a left-facing pose takes the right.
 *
 * The art is never mirrored or redrawn (the brief's "never edit"): a stand faces the way it was drawn, so the right
 * side uses a character's own left-facing pose (`<sprite>_left.png`) where ComfyUI has made one.
 */
import React, { useRef } from 'react'
import { FBtn, FChoice, Key, Win } from '../filigree/kit'
import { dispatch, useEnv } from '../store'

export interface TalkView {
  readonly speakerId: string | null
  readonly speaker: string | null
  readonly text: string
  readonly busts: readonly [string | null, string | null]
  readonly choices: readonly { readonly id: string; readonly text: string; readonly enabled: boolean; readonly tag: string | null; readonly tagOk: boolean | null }[]
}

const LEAD = 'mc'
/** The sprites ComfyUI has drawn facing the viewer's left, for the right side of the stage. */
const LEFT_POSES: ReadonlySet<string> = new Set(['kael'])
const BOX_Y = 540
const STAND_H = 700
const STAND_W = Math.round((832 * STAND_H) / 1216)

function Stand({ characterId, side, lit }: { readonly characterId: string | null; readonly side: 'left' | 'right'; readonly lit: boolean }): React.JSX.Element | null {
  const env = useEnv()
  const sprite = characterId === null ? null : env.content.characters[characterId]?.spriteId ?? null
  if (sprite === null) return null
  const pose = side === 'right' && LEFT_POSES.has(sprite) ? `${sprite}_left` : sprite
  return (
    <img
      className={`ftalk__stand${lit ? '' : ' ftalk__stand--listening'}`}
      src={`/sprites/units/${pose}.png`}
      width={STAND_W}
      height={STAND_H}
      alt=""
      draggable={false}
      style={side === 'left' ? { left: 24, top: 150 } : { left: 1280 - 24 - STAND_W - 130, top: 150 }}
      data-testid={`bust-${side}`}
      data-who={characterId ?? ''}
      data-lit={lit ? 'yes' : 'no'}
    />
  )
}

export function Talk({ view }: { readonly view: TalkView }): React.JSX.Element {
  const env = useEnv()
  const hasLeftPose = (id: string | null): boolean => id !== null && LEFT_POSES.has(env.content.characters[id]?.spriteId ?? '')
  // the last outsider to speak stays on stage while the lead answers: the engine's left slot holds one of "ours" at
  // a time, so a hireling would vanish the moment the lead spoke
  const guest = useRef<string | null>(null)
  const others = view.busts.filter((id): id is string => id !== null && id !== LEAD)
  if (others.length === 1) guest.current = others[0]!
  let stage: readonly [string | null, string | null]
  if (others.length === 2) stage = hasLeftPose(view.busts[0]) && !hasLeftPose(view.busts[1]) ? [view.busts[1], view.busts[0]] : view.busts
  else stage = [LEAD, others[0] ?? guest.current]
  const [left, right] = stage
  const side = view.speakerId !== null && view.speakerId === right ? 'right' : 'left'
  // one plain answer is not a choice: it is how the talk goes on, so it is the box's own button (and Enter's)
  const only = view.choices.length === 1 && view.choices[0]!.tag === null && view.choices[0]!.enabled ? view.choices[0]! : null
  const longest = view.choices.reduce((n, c) => Math.max(n, c.text.length + (c.tag === null ? 0 : c.tag.length + 3)), 0)
  const cw = Math.round(Math.max(380, Math.min(820, longest * 9.4 + 96)))
  const ch = 28 + view.choices.length * 44
  return (
    <div className="f64 fplace ftalk" data-testid="dialogue">
      <img className="fplace__world ftalk__room" src="/art/town/tavern_room.png" width={1280} height={720} alt="" draggable={false} />
      {/* the stands are cut at the box: nobody's boots show in the strip under it. Narration lights everyone. */}
      <div className="ftalk__stage" style={{ height: BOX_Y + 8 }}>
        <Stand characterId={left} side="left" lit={view.speakerId === null || view.speakerId === left} />
        <Stand characterId={right} side="right" lit={view.speakerId === null || view.speakerId === right} />
      </div>
      {view.choices.length > 0 && only === null && (
        <Win x={Math.round((1280 - cw) / 2)} y={BOX_Y - 34 - ch} w={cw} h={ch} label="What do we say?">
          {view.choices.map((c, i) => (
            <FChoice key={c.id} x={24} y={14 + i * 44} w={cw - 48} h={40} n={i + 1} label={c.text} disabledReason={c.enabled ? null : 'not now'} onPress={() => dispatch({ type: 'dialogue/choose', choiceId: c.id, attemptingUnitId: null })} testId={`choice-${c.id}`} {...(c.tag !== null ? { tag: c.tag, tagOk: c.tagOk } : {})} />
          ))}
        </Win>
      )}
      <Win x={14} y={BOX_Y} w={1252} h={166}>
        <p className="s20 lt bone" style={{ left: 266, top: 28, width: 740, lineHeight: '30px', whiteSpace: 'normal' }} data-testid="dialogue-text">{view.text}</p>
        {view.choices.length === 0 && (
          <div className="nowrap" style={{ right: 28, top: 116 }}>
            <span style={{ marginRight: 12 }}><Key>Enter</Key></span>
            <FBtn variant="primary" onPress={() => dispatch({ type: 'dialogue/continue' })} testId="dialogue-continue" autoFocus>Continue</FBtn>
          </div>
        )}
        {only !== null && (
          <div className="nowrap" style={{ right: 28, top: 116 }}>
            <span style={{ marginRight: 12 }}><Key>Enter</Key></span>
            <FBtn variant="primary" onPress={() => dispatch({ type: 'dialogue/choose', choiceId: only.id, attemptingUnitId: null })} testId={`choice-${only.id}`} autoFocus>{only.text}</FBtn>
          </div>
        )}
      </Win>
      {view.speaker !== null && (
        <div className="ftalk__name" style={side === 'right' ? { right: 262 } : { left: 262 }} data-testid="dialogue-speaker" data-side={side}>
          <span className="plate lit">{view.speaker}</span>
        </div>
      )}
    </div>
  )
}
