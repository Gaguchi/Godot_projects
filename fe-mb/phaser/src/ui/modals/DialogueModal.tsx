import React from 'react'
import { Dialog, Button, Heading } from '../components'
import { useRunStore, predicateStateFromRun } from '../../state/runStore'
import { getDialogue } from '../../state/dialogueRegistry'
import { step, visibleChoices, isChoiceEnabled } from '../../systems/dialogueRunner'
import type { DialogueNodeId, DialogueId } from '../../domain/ids'
import type { QuestEffect } from '../../domain/quest'

/**
 * GP-B3: Dialogue UI driven by `runStore.pendingDialogue`. Shows speaker,
 * narrative text, and predicate-filtered choices. On choice select:
 *  1. dispatches applyQuestEffects with the choice's effect array
 *  2. advances pendingDialogue.nodeId to step.nextNodeId, OR
 *  3. dispatches endDialogue if step.nextNodeId === 'end'
 *
 * Reads dialogue trees from the in-memory registry populated by GP-B5.
 * If the tree is not registered, the modal renders a stub error message.
 */
export function DialogueModal(): React.JSX.Element {
  const pending = useRunStore((s) => s.pendingDialogue)
  const dispatch = useRunStore((s) => s.dispatch)

  if (!pending) {
    return <Dialog isOpen={false} onOpenChange={() => undefined} aria-label="Dialogue (closed)">{null}</Dialog>
  }

  const tree = getDialogue(pending.dialogueId as unknown as string)
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
            (GP-B5 will load the JSON files.)
          </p>
          <Button variant="primary" onPress={() => dispatch({ type: 'endDialogue' })}>Close</Button>
        </div>
      </Dialog>
    )
  }

  const node = tree.nodes[pending.nodeId]
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

  return (
    <Dialog
      isOpen
      onOpenChange={() => undefined}
      isDismissable={false}
      aria-label={node.speaker ?? 'Dialogue'}
    >
      <div id="dialogue-modal" className="flex flex-col gap-4 min-w-[480px] max-w-[640px]">
        {node.speaker && (
          <Heading level={2} className="text-base text-amber-300 tracking-widest m-0">
            {node.speaker}
          </Heading>
        )}
        <p className="text-stone-200 leading-relaxed whitespace-pre-line">{node.text}</p>
        <div className="flex flex-col gap-2 mt-2">
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
                {c.text}
              </Button>
            )
          })}
        </div>
      </div>
    </Dialog>
  )
}
