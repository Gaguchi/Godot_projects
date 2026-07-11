import React, { useEffect, useState } from 'react'
import { Dialog, Button, Heading, CheckButton, CheckCandidatePicker, Icon } from '../components'
import { CharacterPortrait } from '../components/CharacterPortrait'
import { getCharacter } from '../data/characters'
import { useTypewriter } from '../hooks/useTypewriter'
import { useRunStore, predicateStateFromRun } from '../../state/runStore'
import { getDialogue } from '../../state/dialogueRegistry'
import { diag } from '../../state/diagLog'
import { step, visibleChoices, isChoiceEnabled } from '../../systems/dialogueRunner'
import { evaluateCheck, getCheckCandidates } from '../../systems/checkResolver'
import type { DialogueNodeId, DialogueId, UnitId } from '../../domain/ids'
import type { QuestEffect } from '../../domain/quest'
import type { DialogueChoice } from '../../domain/dialogue'

/**
 * Local motion vocabulary for the dialogue band (kept out of index.css on
 * purpose — these are dialogue-only affordances). Both loops collapse under
 * prefers-reduced-motion via the media guard.
 *   - dlg-advance-caret: genre-standard pulsing "more text" chevron.
 *   - dlg-type-caret: hard steps(2) terminal-style blink on the typewriter bar.
 */
const DIALOGUE_MOTION_CSS = `
@keyframes dlgAdvanceNudge { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(3px); } }
@keyframes dlgCaretBlink { from { opacity: 1; } to { opacity: 0; } }
@media (prefers-reduced-motion: no-preference) {
  .dlg-advance-caret { animation: dlgAdvanceNudge 1.1s var(--ease-out-quart) infinite; }
  .dlg-type-caret { animation: dlgCaretBlink 1s steps(2, jump-none) infinite; }
}
`

/**
 * Dialogue UX overhaul: bottom-anchored panel with floating character portrait,
 * typewriter text reveal, and stacked choices.
 *
 * Layout (research-backed; see brief in design notes):
 *   - Panel pinned to bottom edge, full width, world dimmed 55% black + slight blur
 *   - Portrait floats over the top-left edge (96px), name plate beneath
 *   - Body text area is clickable: skip reveal mid-typewriter, OR advance the
 *     dialogue if there's a single Continue choice
 *   - Choices appear ONLY after the reveal completes (avoids spoilers / mis-clicks)
 *   - Narrator (empty speaker) gets a centered ✦ NARRATOR ✦ banner instead of portrait
 *
 * Speaker styling (color, shape, initials) lives in `ui/data/characters.ts`
 * and is applied via `<CharacterPortrait>`. Unknown speakers get a deterministic
 * fallback palette so the UI never breaks.
 */
export function DialogueModal(): React.JSX.Element {
  const pending = useRunStore((s) => s.pendingDialogue)
  const dispatch = useRunStore((s) => s.dispatch)
  const [pickerChoice, setPickerChoice] = useState<DialogueChoice | null>(null)

  // JRPG bust slots: speakers claim a side on first line and KEEP it for the
  // whole conversation (VN/FE convention). A third speaker replaces whichever
  // slot is not currently talking. Narrator lines dim both busts.
  const [slots, setSlots] = useState<{ left: string | null; right: string | null }>({ left: null, right: null })
  useEffect(() => {
    // fresh conversation → empty stage
    setSlots({ left: null, right: null })
  }, [pending?.dialogueId])
  const speakerForSlots = (() => {
    if (!pending) return null
    const t = getDialogue(pending.dialogueId as unknown as string)
    const n = t?.nodes[pending.nodeId]
    const sp = n?.speaker ?? ''
    return sp && getCharacter(sp).faction !== 'narrator' ? sp : null
  })()
  useEffect(() => {
    if (!speakerForSlots) return
    setSlots((prev) => {
      if (prev.left === speakerForSlots || prev.right === speakerForSlots) return prev
      if (prev.left === null) return { ...prev, left: speakerForSlots }
      if (prev.right === null) return { ...prev, right: speakerForSlots }
      // both occupied: replace the side that is NOT speaking now (keep the
      // other participant on stage)
      return prev.left === speakerForSlots ? prev : { ...prev, right: speakerForSlots }
    })
  }, [speakerForSlots])

  // onEnter side-effects: fire QuestEffects when dialogueId+nodeId changes.
  // Top-level useEffect to satisfy rules-of-hooks (must run unconditionally).
  useEffect(() => {
    if (!pending) return
    const tree = getDialogue(pending.dialogueId as unknown as string)
    if (!tree) {
      diag('dialog', 'missing tree', { dialogueId: pending.dialogueId }, 'warn')
      return
    }
    const node = tree.nodes[pending.nodeId]
    if (!node) {
      diag('dialog', 'missing node', { dialogueId: pending.dialogueId, nodeId: pending.nodeId }, 'warn')
      return
    }
    diag('dialog', 'enter node', {
      dialogueId: pending.dialogueId,
      nodeId: pending.nodeId,
      speaker: node.speaker ?? null,
      onEnterCount: node.onEnter?.length ?? 0,
    })
    if (node.onEnter && node.onEnter.length > 0) {
      dispatch({ type: 'applyQuestEffects', payload: { effects: node.onEnter as QuestEffect[] } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.dialogueId, pending?.nodeId])

  const tree = pending ? getDialogue(pending.dialogueId as unknown as string) : null
  const node = tree && pending ? tree.nodes[pending.nodeId] : null

  // Typewriter hook MUST be called every render (hook rules). Pass empty
  // text when no node so the hook still runs but reveals nothing visible.
  const { visibleText, isDone, complete } = useTypewriter(node?.text ?? '', 36)

  if (!pending) {
    return <Dialog isOpen={false} onOpenChange={() => undefined} aria-label="Dialogue (closed)">{null}</Dialog>
  }

  if (!tree) {
    return (
      <Dialog
        isOpen
        onOpenChange={(o) => { if (!o) dispatch({ type: 'endDialogue' }) }}
        aria-label="Dialogue (missing)"
      >
        <div className="flex flex-col gap-4">
          <Heading level={2} className="text-base">Dialogue Not Found</Heading>
          <p className="text-text-muted text-sm">
            No dialogue tree registered for id <code className="text-hearth">{String(pending.dialogueId)}</code>.
          </p>
          <Button variant="primary" onPress={() => dispatch({ type: 'endDialogue' })}>Close</Button>
        </div>
      </Dialog>
    )
  }

  if (!node) {
    return (
      <Dialog
        isOpen
        onOpenChange={(o) => { if (!o) dispatch({ type: 'endDialogue' }) }}
        aria-label="Dialogue (bad node)"
      >
        <div className="flex flex-col gap-4">
          <Heading level={2} className="text-base">Dialogue Step Error</Heading>
          <p className="text-text-muted text-sm">
            Node <code>{pending.nodeId}</code> not in tree {String(pending.dialogueId)}.
          </p>
          <Button variant="primary" onPress={() => dispatch({ type: 'endDialogue' })}>Close</Button>
        </div>
      </Dialog>
    )
  }

  const predicateState = predicateStateFromRun(useRunStore.getState())
  const choices = visibleChoices(tree, pending.nodeId as unknown as DialogueNodeId, predicateState)
  const character = getCharacter(node.speaker)

  // Source partyState for check resolution from runStore.
  const runState = useRunStore.getState()
  const partyArr = Object.values(runState.party.units)
  const foodCount = runState.inventory.items.filter(
    (i) => (i.itemId as unknown as string) === 'food_rations',
  ).length
  const partyState = { gold: runState.gold, foodCount, party: partyArr }

  const advance = (choiceId: string, attemptingUnitId?: UnitId): void => {
    const result = step(tree, pending.nodeId as unknown as DialogueNodeId, choiceId, predicateState, {
      partyState,
      ...(attemptingUnitId ? { attemptingUnitId } : {}),
    })
    if (result.effects.length > 0) {
      dispatch({ type: 'applyQuestEffects', payload: { effects: result.effects as QuestEffect[] } })
    }
    if (result.nextNodeId === 'end') {
      dispatch({ type: 'endDialogue' })
    } else {
      dispatch({
        type: 'startDialogue',
        payload: {
          dialogueId: pending.dialogueId as unknown as DialogueId,
          nodeId: result.nextNodeId as unknown as string,
        },
      })
    }
  }

  const onChoice = (choice: DialogueChoice): void => {
    if (!choice.check) {
      advance(choice.id)
      return
    }
    if (choice.check.kind === 'stat') {
      setPickerChoice(choice)
      return
    }
    // class / gold / food: auto-resolve, no attempting unit
    advance(choice.id)
  }

  const computeCanPass = (choice: DialogueChoice): boolean => {
    if (!choice.check) return true
    if (choice.check.kind === 'stat') {
      return getCheckCandidates(choice.check, partyArr).some((c) => c.meetsThreshold)
    }
    return evaluateCheck(choice.check, null, partyState)
  }

  // Click-on-text behavior:
  //  - typewriter still running → skip reveal
  //  - reveal done + only one Continue choice → advance the choice
  //  - reveal done + branching choices → no-op (force user to pick)
  const onTextAreaClick = (): void => {
    if (!isDone) {
      complete()
      return
    }
    if (choices.length === 1) {
      const only = choices[0]!
      // Don't auto-advance check-bearing choices — those need explicit picker flow.
      if (only.check) return
      if (isChoiceEnabled(only, predicateState)) advance(only.id)
    }
  }

  const isNarrator = character.faction === 'narrator'
  const speakerLabel = isNarrator ? '' : character.displayName

  /**
   * One JRPG bust slot (VN / FE-talk convention): the full-body sprite stands
   * ON the text band, feet at its top edge. The active speaker is lit and
   * leans in; the listener dims and drops back. Characters without an
   * authored sprite fall back to a large portrait token.
   */
  const renderBust = (side: 'left' | 'right'): React.JSX.Element | null => {
    const name = slots[side]
    if (!name) return null
    const c = getCharacter(name)
    const speaking = !isNarrator && name === node.speaker
    const flip = side === 'right' // busts face inward
    return (
      <div
        aria-hidden
        className={
          'absolute bottom-full pointer-events-none select-none flex items-end ' +
          (side === 'left' ? 'left-6' : 'right-6') + ' ' +
          'motion-safe:transition-[filter,transform,opacity] motion-safe:duration-300'
        }
        style={{
          height: 0,
          filter: speaking ? 'none' : 'brightness(0.68) saturate(0.7)',
          transform: speaking ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.95)',
          zIndex: speaking ? 2 : 1,
        }}
      >
        {c.sprite ? (
          <img
            src={c.sprite}
            alt=""
            draggable={false}
            className="object-contain"
            style={{
              height: 300,
              marginBottom: -8,
              transform: flip ? 'scaleX(-1)' : undefined,
              filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.7))',
            }}
          />
        ) : (
          <div style={{ marginBottom: 8 }}>
            <CharacterPortrait speaker={name} active={speaking} size={120} />
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog
      isOpen
      onOpenChange={() => undefined}
      isDismissable={false}
      position="bottom"
      aria-label={node.speaker || 'Dialogue'}
    >
      <div
        id="dialogue-modal"
        className="relative mx-auto max-w-5xl px-8 pt-9 pb-6"
      >
        <style>{DIALOGUE_MOTION_CSS}</style>
        {/* The talk stage: persistent busts standing on the band */}
        {renderBust('left')}
        {renderBust('right')}

        {/* Name plate rides the band's top edge, anchored INBOARD of the bust
            column (the sprite is ~190px wide at left-6/right-6) so the plate
            never slices across the character art. */}
        {!isNarrator && (
          <div
            className={
              'absolute -top-4 z-10 ' +
              (slots.right === node.speaker ? 'right-52' : 'left-52')
            }
          >
            <div
              className="voice-display surface-iron text-sm tracking-[0.18em] px-4 py-1 text-parchment shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
            >
              {speakerLabel.toUpperCase()}
            </div>
            {/* character identity = 2px edge accent (--id-* ramp), never a full colored outline */}
            <div aria-hidden className="border-b-2" style={{ borderColor: character.accent }} />
          </div>
        )}

        {isNarrator && (
          <div className="flex items-center justify-center gap-2 text-xs tracking-widest text-parchment-dim mb-2">
            <Icon name="narrator" size={14} />
            <span>NARRATOR</span>
            <Icon name="narrator" size={14} />
          </div>
        )}

        {/* Body text. It is click-to-skip/continue ONLY while revealing or when
            there's a single Continue choice. With branching choices it is a
            plain read-area (disabled) so a "skip" click can't land on an option. */}
        {(() => {
          const textInteractive = !isDone || choices.length <= 1
          return (
            <button
              type="button"
              onClick={onTextAreaClick}
              disabled={!textInteractive}
              className={
                'relative w-full text-left p-4 min-h-[84px] ' +
                'bg-transparent border-0 outline-none ' +
                (textInteractive
                  ? 'cursor-pointer focus-visible:[box-shadow:var(--focus-ring)]'
                  : 'cursor-default')
              }
              aria-label="Dialogue text"
            >
              <p
                className={
                  `leading-relaxed whitespace-pre-line text-lg ` +
                  (isNarrator ? 'text-parchment-dim italic' : 'text-parchment')
                }
              >
                {visibleText}
                {!isDone && (
                  <span
                    aria-hidden
                    className="dlg-type-caret inline-block align-baseline ml-1 w-[2px] h-[1em] bg-hearth"
                  />
                )}
              </p>
              {/* Genre-standard advance affordance: pulsing chevron, no copy.
                  While the typewriter runs, clicking already skips — silent. */}
              {isDone && choices.length === 1 && (
                <span
                  aria-hidden
                  className="dlg-advance-caret absolute bottom-2 right-3 text-hearth"
                >
                  <Icon name="chevron-down" size={14} />
                </span>
              )}
            </button>
          )
        })()}

        {/* Choices — render after reveal, clearly separated from the read-area
            so they never blend with the text or catch a stray skip-click. */}
        {isDone && choices.length > 1 && (
          <div className="mt-5 border-t border-[rgba(120,98,60,0.3)] pt-4">
            <div className="mb-2 text-[0.6rem] uppercase tracking-[0.22em] text-parchment-dim">
              Choose a response
            </div>
            <div className="flex flex-col gap-2">
              {choices.map((c) => {
                const enabled = isChoiceEnabled(c, predicateState)
                if (c.check) {
                  const canPass = enabled && computeCanPass(c)
                  const candidates = c.check.kind === 'stat'
                    ? getCheckCandidates(c.check, partyArr)
                    : []
                  return (
                    <CheckButton
                      key={c.id}
                      text={c.text}
                      requirement={c.check}
                      candidates={candidates}
                      canPass={canPass}
                      onPress={() => onChoice(c)}
                    />
                  )
                }
                return (
                  <Button
                    key={c.id}
                    variant="secondary"
                    prose
                    isDisabled={!enabled}
                    onPress={() => onChoice(c)}
                    className="!justify-start text-left"
                  >
                    <span className="text-hearth mr-3 flex items-center"><Icon name="chevron-right" size={14} /></span>
                    <span>{c.text}</span>
                  </Button>
                )
              })}
              </div>
            </div>
          )}
        </div>

      <CheckCandidatePicker
        open={pickerChoice !== null}
        statLabel={pickerChoice?.check?.kind === 'stat' ? pickerChoice.check.stat.toUpperCase() : ''}
        threshold={pickerChoice?.check?.kind === 'stat' ? pickerChoice.check.threshold : 0}
        candidates={
          pickerChoice?.check && pickerChoice.check.kind === 'stat'
            ? getCheckCandidates(pickerChoice.check, partyArr)
            : []
        }
        onPick={(c) => {
          const choiceCopy = pickerChoice
          setPickerChoice(null)
          if (choiceCopy) advance(choiceCopy.id, c.unitId)
        }}
        onCancel={() => setPickerChoice(null)}
      />
    </Dialog>
  )
}
