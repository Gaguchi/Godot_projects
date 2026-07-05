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
          <p className="text-stone-400 text-sm">
            No dialogue tree registered for id <code className="text-amber-300">{String(pending.dialogueId)}</code>.
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
          <p className="text-stone-400 text-sm">
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

  return (
    <Dialog
      isOpen
      onOpenChange={() => undefined}
      isDismissable={false}
      position="bottom"
      aria-label={node.speaker ?? 'Dialogue'}
    >
      <div
        id="dialogue-modal"
        className={`relative mx-auto max-w-5xl px-8 ${isNarrator ? 'pt-8' : 'pt-14'} pb-6`}
      >
        {/* Floating portrait — overhangs the panel's top edge, aligned to the
            text column (not the full-width panel edge). */}
        {!isNarrator && (
          <div className="absolute -top-12 left-8 z-10 flex flex-col items-center gap-1">
            <CharacterPortrait speaker={node.speaker} active size={88} />
            <div
              className={
                `voice-display text-xs tracking-[0.15em] px-2 py-0.5 rounded-sm ` +
                `bg-stone-950/95 border ${character.ringColor.split(' ').filter(c => c.startsWith('border-')).join(' ')} ` +
                `${character.textColor}`
              }
            >
              {speakerLabel.toUpperCase()}
            </div>
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
                'w-full text-left p-4 rounded transition-colors min-h-[84px] ' +
                'bg-stone-900/60 border border-stone-800 outline-none ' +
                (textInteractive
                  ? 'cursor-pointer hover:bg-stone-900/80 focus-visible:[box-shadow:var(--focus-ring)]'
                  : 'cursor-default')
              }
              aria-label="Dialogue text"
            >
              <p
                className={
                  `leading-relaxed whitespace-pre-line text-lg ` +
                  (isNarrator ? 'text-parchment-dim italic' : 'text-stone-100')
                }
              >
                {visibleText}
                {!isDone && (
                  <span className="inline-block w-2 h-5 align-middle ml-1 bg-amber-300 animate-pulse" />
                )}
              </p>
              {!isDone && (
                <div className="text-xs text-parchment-dim mt-3 flex items-center gap-1">
                  <Icon name="chevron-right" size={11} /> click to skip
                </div>
              )}
              {isDone && choices.length === 1 && (
                <div className="text-xs text-parchment-dim mt-3 flex items-center gap-1">
                  <Icon name="chevron-right" size={11} /> click to continue
                </div>
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
                    variant={enabled ? 'primary' : 'ghost'}
                    isDisabled={!enabled}
                    onPress={() => onChoice(c)}
                    className="!justify-start text-left"
                  >
                    <span className="text-amber-300 mr-3 flex items-center"><Icon name="chevron-right" size={14} /></span>
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
