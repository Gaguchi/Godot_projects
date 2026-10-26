/**
 * ui/overlays/DialogueOverlay.tsx — the talk box (BRIEF §2.12): two persistent bust slots from
 * `run.pendingDialogue.busts` (left = party side, right = everyone else; the speaker lit, the other dimmed), the
 * speaker's name on a brass plaque, the line in the reading voice, choices as prose buttons — a stat check shows
 * its bar (`components/CheckTag`), a gated choice stays visible greyed with its reason. No choices ⇒ Continue.
 * Enter / Space continue; 1–9 pick a choice.
 *
 * A face is never shown half-painted. The busts are ~800KB sprites; the first build put them in the tree and let
 * the browser stream them, so a fresh beat drew the box and then an axe-head appeared over it (GATE2-20). Now the
 * whole conversation's faces are warmed the moment the talk opens, and a slot stays empty until its image has
 * decoded, then rises in — the reveal is the load's second channel.
 *
 * A slot with no likeness in it holds a `components/Sigil` — the identity record `characters.json` has carried
 * for every speaker all along, drawn. It used to hold `displayName.slice(0, 2)`, so Guildmistress Anya, who gives
 * the first contract and runs the naming beat, was delivered by a brown disc reading "Gu" (FINAL GATE C 3.10).
 */
import React, { useCallback, useEffect, useState } from 'react'
import { portraitFor } from '../../engine/content'
import { overlayOf } from '../../engine/flow/pump'
import { currentNode, renderText, speakerName, visibleChoices } from '../../engine/run/dialogue'
import type { GameState } from '../../engine/types'
import { Button } from '../components/Button'
import { CheckTag } from '../components/CheckTag'
import { Sigil } from '../components/Sigil'
import { className } from '../names'
import { dispatch, useEnv, useGame } from '../store'

interface View {
  readonly dialogueId: string | null
  /** The prologue is a STAGED frame — the scrim seats the box there instead of putting the scene out. */
  readonly staged: boolean
  readonly speakerId: string | null
  readonly speaker: string | null
  readonly text: string
  readonly busts: readonly [string | null, string | null]
  readonly choices: readonly { readonly id: string; readonly text: string; readonly enabled: boolean; readonly tag: string | null; readonly tagOk: boolean | null }[]
}

const STAT_LABEL: Readonly<Record<string, string>> = { str: 'STR', mag: 'MAG', skl: 'SKL', spd: 'SPD', lck: 'LCK', def: 'DEF', res: 'RES', mov: 'MOV' }

const bustSrc = (spriteId: string): string => `/sprites/units/${spriteId}.png`

/** Faces already fetched and decoded this session — a returning speaker never fades in twice. */
const warmed = new Set<string>()
function warm(src: string): Promise<void> {
  if (warmed.has(src)) return Promise.resolve()
  if (typeof Image === 'undefined') return Promise.resolve()
  const img = new Image()
  img.src = src
  const done = typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve()
  return done.then(() => { warmed.add(src) })
}

function Bust({ characterId, lit, side }: { readonly characterId: string | null; readonly lit: boolean; readonly side: 'left' | 'right' }): React.JSX.Element | null {
  const env = useEnv()
  const c = characterId === null ? undefined : env.content.characters[characterId]
  const sprite = c?.spriteId ?? null
  const src = sprite === null ? null : bustSrc(sprite)
  const [ready, setReady] = useState(src === null || warmed.has(src))
  useEffect(() => {
    if (src === null) { setReady(true); return }
    if (warmed.has(src)) { setReady(true); return }
    setReady(false)
    let live = true
    void warm(src).then(() => { if (live) setReady(true) })
    return () => { live = false }
  }, [src])
  if (characterId === null) return null
  return (
    <div className={`talk-bust talk-bust--${side}${lit ? ' talk-bust--lit' : ''}${ready ? ' talk-bust--shown' : ''}`} data-testid={`bust-${side}`} data-ready={ready ? 'yes' : 'no'} aria-hidden>
      {src !== null
        ? <img src={src} alt="" draggable={false} decoding="async" />
        : <Sigil className="talk-bust__stand-in" portrait={portraitFor(env.content, characterId, c?.kind === 'unit' ? c.classId : '', c?.kind === 'unit' ? c.team : 'enemy')} />}
      <span className="talk-bust__cast" />
    </div>
  )
}

export function DialogueOverlay(): React.JSX.Element | null {
  const env = useEnv()
  const select = useCallback((s: GameState): View | null => {
    const run = s.run
    if (run === null || overlayOf(s)?.kind !== 'dialogue') return null
    const node = currentNode(run, env)
    if (node === null) return null
    return {
      dialogueId: run.pendingDialogue?.dialogueId ?? null,
      staged: s.screen.kind === 'prologue',
      speakerId: node.speaker ?? null,
      speaker: speakerName(node.speaker, run, env),
      text: renderText(node.text, run, env),
      busts: run.pendingDialogue?.busts ?? [null, null],
      choices: visibleChoices(run, env).map((c) => {
        const check = c.check
        let tag: string | null = null
        let tagOk: boolean | null = null
        if (check !== undefined) {
          if (check.kind === 'stat') {
            const best = c.bestCandidate
            tag = `${STAT_LABEL[check.stat] ?? check.stat} ${check.threshold}${best !== null ? ` · ${best.name} ${best.statValue}` : ''}`
            tagOk = best?.meetsThreshold ?? false
          } else if (check.kind === 'class') tag = `needs a ${className(check.classId, env)}`
          else if (check.kind === 'gold') tag = `${check.amount} gold`
          else tag = `${check.amount} food`
        }
        return { id: c.id, text: renderText(c.text, run, env), enabled: c.enabled, tag, tagOk }
      }),
    }
  }, [env])
  const view = useGame(select, (a, b) => JSON.stringify(a) === JSON.stringify(b))

  // Every face this conversation can turn to, fetched the moment it opens — not when the slot appears. The second
  // speaker in a beat is the one that used to pop in over a drawn box.
  const sceneId = view?.dialogueId ?? null
  useEffect(() => {
    if (sceneId === null) return
    const tree = env.content.dialogues[sceneId]
    if (tree === undefined) return
    for (const node of Object.values(tree.nodes)) {
      const speaker = node.speaker
      if (speaker === undefined || speaker === null) continue
      const spriteId = env.content.characters[speaker]?.spriteId
      if (spriteId !== undefined && spriteId !== null) void warm(bustSrc(spriteId))
    }
  }, [sceneId, env])

  useEffect(() => {
    if (view === null) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement) return
      if (view.choices.length === 0 && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); dispatch({ type: 'dialogue/continue' }) }
      const n = Number(e.key)
      if (n >= 1 && n <= view.choices.length) {
        const c = view.choices[n - 1]
        if (c !== undefined && c.enabled) dispatch({ type: 'dialogue/choose', choiceId: c.id, attemptingUnitId: null })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view])

  if (view === null) return null
  const [left, right] = view.busts
  // The plaque hangs on the SPEAKER's side of the box. Pinned to the top-left it sat under the silent, unlit bust
  // and named the person on the other side of the frame, so the label and the lighting said different things
  // about who was talking (RE-GATE B 2.4). Lighting is the primary channel; the plaque is the second, and two
  // channels that disagree are worse than one.
  const speakerSide = view.speakerId !== null && right !== null && view.speakerId === right ? 'right' : 'left'
  return (
    <div className="talk" data-testid="dialogue">
      <div className={`talk__scrim${view.staged ? ' talk__scrim--staged' : ''}`} />
      <Bust characterId={left} lit={view.speakerId === left || view.speakerId === null} side="left" />
      <Bust characterId={right} lit={view.speakerId === right} side="right" />
      <div className="hud-panel talk__box">
        {view.speaker !== null && <div className={`talk__plaque talk__plaque--${speakerSide} voice-display`} data-testid="dialogue-speaker" data-side={speakerSide}>{view.speaker}</div>}
        <p className="talk__text" data-testid="dialogue-text">{view.text}</p>
        <div className="talk__choices">
          {view.choices.length === 0 && (
            <Button variant="primary" onPress={() => dispatch({ type: 'dialogue/continue' })} testId="dialogue-continue" autoFocus>Continue</Button>
          )}
          {view.choices.map((c, i) => (
            <Button key={c.id} variant={i === 0 ? 'primary' : 'secondary'} prose disabledReason={c.enabled ? null : 'not now'} onPress={() => dispatch({ type: 'dialogue/choose', choiceId: c.id, attemptingUnitId: null })} testId={`choice-${c.id}`}>
              <span className="talk__key">{i + 1}</span>
              {c.text}
              {c.tag !== null && <CheckTag text={c.tag} ok={c.tagOk} />}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
