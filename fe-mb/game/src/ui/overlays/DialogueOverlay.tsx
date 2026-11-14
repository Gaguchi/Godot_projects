/**
 * ui/overlays/DialogueOverlay.tsx — someone speaks (BRIEF §2.12). Two stagings of one reading of the engine:
 *
 *   · a talk in town is a screen of its own (`ui/town/Talk`): the room, two people standing in it;
 *   · every other talk (the road, the prologue, after a fight) is the box at the foot of the stage, over the dimmed
 *     world (board F64Dialogue): the SPEAKER's face behind a brass lip, their name, the line in the reading voice,
 *     then the answers as a numbered list. An answer that tests the company carries its tag and verdict
 *     (`checkReading.ts`), and one line under the list says the same thing in words for the answer pointed at.
 *     An answer the story has shut stays on the glass, dim, with its reason. No answers: Continue.
 *     Enter / Space continue; 1-9 answer; Enter takes a lone plain answer.
 *
 * The box shows ONE face and it is always the speaker's, so the face and the name cannot disagree about who is
 * talking (RE-GATE B 2.4, when a plaque named the person on the other side of the frame). Narration has no face.
 *
 * A face is never shown half-painted. The first build put the art in the tree and let the browser stream it, so a
 * fresh beat drew the box and then a face arrived over it in strips (GATE2-20). Every face a conversation can turn
 * to is warmed the moment the talk opens, and the niche stays empty until its image has decoded, then the face
 * rises in: the reveal is the load's second channel.
 *
 * A speaker the game has no likeness of gets their `components/Sigil` in the niche: the identity record
 * `characters.json` has carried for every speaker all along, drawn. It used to be `displayName.slice(0, 2)`, so
 * Guildmistress Anya, who gives the first contract and runs the naming beat, was a brown disc reading "Gu"
 * (FINAL GATE C 3.10).
 */
import React, { useCallback, useEffect, useState } from 'react'
import { portraitFor } from '../../engine/content'
import { overlayOf } from '../../engine/flow/pump'
import { currentNode, renderText, speakerName, visibleChoices } from '../../engine/run/dialogue'
import type { GameState } from '../../engine/types'
import { Sigil } from '../components/Sigil'
import { FBtn, FChoice, Key, Niche, Win, faceArt } from '../filigree/kit'
import { dispatch, useEnv, useGame } from '../store'
import { Talk } from '../town/Talk'
import { UNTESTED, readCheck } from './checkReading'

interface View {
  readonly dialogueId: string | null
  /** Where the talk was opened from: a tavern talk is its own screen (`ui/town/Talk`), the rest speak over the world. */
  readonly source: string | null
  /** The prologue is a STAGED frame — the scrim seats the box there instead of putting the scene out. */
  readonly staged: boolean
  readonly speakerId: string | null
  readonly speaker: string | null
  readonly text: string
  readonly busts: readonly [string | null, string | null]
  readonly choices: readonly { readonly id: string; readonly text: string; readonly enabled: boolean; readonly tag: string | null; readonly tagOk: boolean | null; readonly why: string }[]
}

/** The speaker's face as the niche shows it: the board's face crop where the game has one, else the art seated on the head. */
const FACE = 104
const faceOf = (spriteId: string): ReturnType<typeof faceArt> => faceArt(spriteId, FACE)

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

function Face({ characterId }: { readonly characterId: string }): React.JSX.Element {
  const env = useEnv()
  const c = env.content.characters[characterId]
  const art = c?.spriteId === undefined || c.spriteId === null ? null : faceOf(c.spriteId)
  const src = art?.src ?? null
  const [ready, setReady] = useState(src === null || warmed.has(src))
  useEffect(() => {
    if (src === null) { setReady(true); return }
    if (warmed.has(src)) { setReady(true); return }
    setReady(false)
    let live = true
    void warm(src).then(() => { if (live) setReady(true) })
    return () => { live = false }
  }, [src])
  return (
    <div className={`froad__face${ready ? ' froad__face--shown' : ''}`} data-testid="talk-face" data-who={characterId} data-ready={ready ? 'yes' : 'no'} aria-hidden>
      <Niche x={0} y={0} size={FACE} src={null} dx={0} dy={0} imgW={0}>
        {art !== null && src !== null
          ? <div className="froad__art" style={{ backgroundImage: `url('${src}')`, backgroundSize: `${art.imgW}px auto`, backgroundPosition: `${-art.dx}px ${-art.dy}px` }} />
          : <Sigil variant="mark" className="froad__sigil" portrait={portraitFor(env.content, characterId, c?.kind === 'unit' ? c.classId : '', c?.kind === 'unit' ? c.team : 'enemy')} />}
      </Niche>
    </div>
  )
}

/** The box: 760 wide, seated on the stage's foot, as tall as what is said in it. */
const BW = 760
const PAD = 20
const COL = PAD + FACE + 18

export function DialogueOverlay(): React.JSX.Element | null {
  const env = useEnv()
  const select = useCallback((s: GameState): View | null => {
    const run = s.run
    if (run === null || overlayOf(s)?.kind !== 'dialogue') return null
    const node = currentNode(run, env)
    if (node === null) return null
    return {
      dialogueId: run.pendingDialogue?.dialogueId ?? null,
      // a talk in town is its own screen: one started at a tavern table, or a quest's follow-up that opens while the
      // company is in town (the brothers' reunion happens back at the tavern, whichever door the player is at)
      source: run.pendingDialogue?.source === 'quest' && s.screen.kind === 'town' ? 'tavern' : run.pendingDialogue?.source ?? null,
      staged: s.screen.kind === 'prologue',
      speakerId: node.speaker ?? null,
      speaker: speakerName(node.speaker, run, env),
      text: renderText(node.text, run, env),
      busts: run.pendingDialogue?.busts ?? [null, null],
      choices: visibleChoices(run, env).map((c) => {
        const r = c.check === undefined ? null : readCheck(c.check, run, env)
        return { id: c.id, text: renderText(c.text, run, env), enabled: c.enabled, tag: r?.tag ?? null, tagOk: r?.ok ?? null, why: r?.why ?? UNTESTED }
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
      const src = spriteId === undefined || spriteId === null ? null : faceOf(spriteId).src
      if (src !== null) void warm(src)
    }
  }, [sceneId, env])

  const [pointed, setPointed] = useState<string | null>(null)
  useEffect(() => {
    if (view === null) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement) return
      if (view.choices.length === 0 && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); dispatch({ type: 'dialogue/continue' }) }
      // a talk with one plain answer goes on with Enter too: the answer is how it continues, not a choice
      const only = view.choices.length === 1 ? view.choices[0] : undefined
      if (only !== undefined && only.enabled && only.tag === null && e.key === 'Enter') { e.preventDefault(); dispatch({ type: 'dialogue/choose', choiceId: only.id, attemptingUnitId: null }); return }
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
  if (view.source === 'tavern') return <Talk view={view} />
  const choose = (id: string): void => { setPointed(null); dispatch({ type: 'dialogue/choose', choiceId: id, attemptingUnitId: null }) }
  // one plain answer is how the talk goes on, not a choice: it is the box's button, as Continue is
  const only = view.choices.length === 1 && view.choices[0]!.enabled && view.choices[0]!.tag === null ? view.choices[0]! : null
  const at = view.choices.find((c) => c.id === pointed) ?? null
  const faced = view.speakerId !== null
  const colW = BW - (faced ? COL : PAD) - PAD
  // an answer the story has shut takes a second line for its reason
  const rows = view.choices.map((c) => (c.enabled ? 32 : 46))
  const tops = rows.map((_, i) => rows.slice(0, i).reduce((a, h) => a + h + 2, 0))
  const listH = rows.reduce((a, h) => a + h + 2, 0)
  return (
    <div className={`f64 fmodal froad${view.staged ? ' froad--staged' : ''}`} data-testid="dialogue">
      <div className="fmodal__scrim" />
      <Win x={(1280 - BW) / 2} y={0} w={BW} className="froad__win" style={{ top: 'auto', bottom: 16 }} testId="dialogue-box">
        {view.speakerId !== null && <Face characterId={view.speakerId} />}
        <div style={{ marginLeft: faced ? COL - PAD : 0, minHeight: faced ? FACE + 6 : 0, paddingTop: 8 }}>
          {view.speaker !== null && <div className="s20 straw nowrap" data-testid="dialogue-speaker">{view.speaker}</div>}
          <p className="s18 lt bone" style={{ whiteSpace: 'normal', lineHeight: '25px', marginTop: view.speaker !== null ? 8 : 0 }} data-testid="dialogue-text">{view.text}</p>
          {view.choices.length > 0 && only === null && (
            <>
              <div style={{ position: 'relative', height: listH, marginTop: 12, marginLeft: -8 }}>
                {view.choices.map((c, i) => (
                  <FChoice key={c.id} x={0} y={tops[i]!} w={colW + 8} h={rows[i]!} n={i + 1} label={c.text} disabledReason={c.enabled ? null : 'not now'} onPress={() => choose(c.id)} onHover={(on) => setPointed((p) => (on ? c.id : p === c.id ? null : p))} testId={`choice-${c.id}`} {...(c.tag !== null ? { tag: c.tag, tagOk: c.tagOk } : {})} />
                ))}
              </div>
              <div className="fgroove" style={{ position: 'relative', marginTop: 9 }} />
              <div className="s14 dim nowrap" style={{ marginTop: 8, height: 18 }} data-testid="dialogue-why">
                {at !== null && at.enabled ? at.why : <><Key>1</Key> to <Key>{String(view.choices.length)}</Key><span style={{ marginLeft: 6 }}>answers</span></>}
              </div>
            </>
          )}
          {(view.choices.length === 0 || only !== null) && (
            <div style={{ marginTop: 14, textAlign: 'right' }}>
              <span style={{ marginRight: 12 }}><Key>Enter</Key></span>
              {only !== null
                ? <FBtn variant="primary" onPress={() => choose(only.id)} testId={`choice-${only.id}`} autoFocus>{only.text}</FBtn>
                : <FBtn variant="primary" onPress={() => dispatch({ type: 'dialogue/continue' })} testId="dialogue-continue" autoFocus>Continue</FBtn>}
            </div>
          )}
        </div>
      </Win>
    </div>
  )
}
