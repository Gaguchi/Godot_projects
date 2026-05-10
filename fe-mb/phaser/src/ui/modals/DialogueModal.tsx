import React, { useEffect } from 'react'
import { Dialog, Button, Heading } from '../components'
import { CharacterPortrait } from '../components/CharacterPortrait'
import { getCharacter } from '../data/characters'
import { useTypewriter } from '../hooks/useTypewriter'
import { useRunStore, predicateStateFromRun } from '../../state/runStore'
import { getDialogue } from '../../state/dialogueRegistry'
import { step, visibleChoices, isChoiceEnabled } from '../../systems/dialogueRunner'
import type { DialogueNodeId, DialogueId } from '../../domain/ids'
import type { QuestEffect } from '../../domain/quest'

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

  // onEnter side-effects: fire QuestEffects when dialogueId+nodeId changes.
  // Top-level useEffect to satisfy rules-of-hooks (must run unconditionally).
  useEffect(() => {
    if (!pending) return
    const tree = getDialogue(pending.dialogueId as unknown as string)
    const node = tree?.nodes[pending.nodeId]
    if (node?.onEnter && node.onEnter.length > 0) {
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

  const onChoice = (choiceId: string): void => {
    const result = step(tree, pending.nodeId as unknown as DialogueNodeId, choiceId, predicateState)
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
      if (isChoiceEnabled(only, predicateState)) onChoice(only.id)
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
      <div id="dialogue-modal" className="relative">
        {/* Floating portrait — overlaps the panel's top edge */}
        {!isNarrator && (
          <div className="absolute -top-12 left-6 z-10 flex flex-col items-center gap-1">
            <CharacterPortrait speaker={node.speaker} active size={96} />
            <div
              className={
                `text-xs font-mono tracking-widest px-2 py-0.5 ` +
                `bg-stone-950/95 border ${character.ringColor.split(' ').filter(c => c.startsWith('border-')).join(' ')} ` +
                `${character.textColor}`
              }
            >
              {speakerLabel.toUpperCase()}
            </div>
          </div>
        )}

        {/* Main panel: padding accounts for the portrait overhang */}
        <div className={`px-8 ${isNarrator ? 'pt-8' : 'pt-12'} pb-6 max-w-5xl mx-auto`}>
          {isNarrator && (
            <div className="text-center text-xs tracking-widest text-stone-500 mb-2">
              ✦ NARRATOR ✦
            </div>
          )}

          {/* Body text area — click anywhere to skip / advance */}
          <button
            type="button"
            onClick={onTextAreaClick}
            className={
              'w-full text-left p-4 rounded transition-colors min-h-[120px] ' +
              'bg-stone-900/60 border border-stone-800 cursor-pointer ' +
              'hover:bg-stone-900/80 outline-none focus-visible:ring-2 focus-visible:ring-amber-400'
            }
            aria-label="Dialogue text. Click to skip reveal."
          >
            <p
              className={
                `leading-relaxed whitespace-pre-line text-lg ` +
                (isNarrator ? 'text-stone-300 italic' : 'text-stone-100')
              }
            >
              {visibleText}
              {!isDone && (
                <span className="inline-block w-2 h-5 align-middle ml-1 bg-amber-300 animate-pulse" />
              )}
            </p>
            {!isDone && (
              <div className="text-xs text-stone-500 mt-3">▸ click to skip</div>
            )}
            {isDone && choices.length === 1 && (
              <div className="text-xs text-stone-500 mt-3">▸ click to continue</div>
            )}
          </button>

          {/* Choices — only render once the reveal is done so they don't pre-spoil */}
          {isDone && choices.length > 1 && (
            <div className="flex flex-col gap-2 mt-4">
              {choices.map((c) => {
                const enabled = isChoiceEnabled(c, predicateState)
                return (
                  <Button
                    key={c.id}
                    variant={enabled ? 'primary' : 'ghost'}
                    isDisabled={!enabled}
                    onPress={() => onChoice(c.id)}
                    className="!justify-start text-left"
                  >
                    <span className="text-amber-300 mr-3">▸</span>
                    <span>{c.text}</span>
                  </Button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
