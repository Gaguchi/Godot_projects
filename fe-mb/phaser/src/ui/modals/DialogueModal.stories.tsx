import type { Meta, StoryObj } from '@storybook/react-vite'
import { DialogueModal } from './DialogueModal'
import { useRunStore } from '../../state/runStore'
import { registerDialogue, clearDialogues } from '../../state/dialogueRegistry'
import { mockParty } from '../../storybook/fixtures'
import { withSeededRun } from '../../storybook/decorators'
import { asDialogueId, asDialogueNodeId } from '../../domain/ids'
import { useEffect } from 'react'

function bootstrapStory(dialogueId: string): void {
  clearDialogues()
  // Simple bandit-threat-style tree with a stat-check choice.
  registerDialogue({
    id: asDialogueId(dialogueId),
    startNodeId: asDialogueNodeId('start'),
    nodes: {
      start: {
        id: asDialogueNodeId('start'),
        speaker: 'Bandit Leader',
        text: 'Hold it right there! This road has a toll now. Pay up or draw steel.',
        choices: [
          { id: 'pay', text: 'Pay the toll (15 gold).', effects: [], next: 'pay' as never },
          {
            id: 'force',
            text: 'Intimidate them.',
            effects: [],
            check: { kind: 'stat', stat: 'str', threshold: 7 },
            onPass: 'intimidate_success' as never,
            onFail: 'intimidate_fail' as never,
          },
          { id: 'fight', text: 'Fight them!', effects: [], next: 'fight' as never },
        ],
      },
      pay: { id: asDialogueNodeId('pay'), text: 'Smart choice. Move along.', choices: [{ id: 'c', text: 'Continue', effects: [], next: 'end' as never }] },
      intimidate_success: { id: asDialogueNodeId('intimidate_success'), text: 'Whoa, easy! Just kidding about the toll.', choices: [{ id: 'c', text: 'Continue', effects: [], next: 'end' as never }] },
      intimidate_fail: { id: asDialogueNodeId('intimidate_fail'), text: 'Get him, boys!', choices: [{ id: 'c', text: 'Continue', effects: [], next: 'end' as never }] },
      fight: { id: asDialogueNodeId('fight'), text: 'Steel rings!', choices: [{ id: 'c', text: 'Continue', effects: [], next: 'end' as never }] },
    } as never,
  })
}

const StorySetup = ({ dialogueId }: { dialogueId: string }): null => {
  useEffect(() => {
    bootstrapStory(dialogueId)
    useRunStore.getState().dispatch({
      type: 'startDialogue',
      payload: { dialogueId: asDialogueId(dialogueId), nodeId: asDialogueNodeId('start') as unknown as string },
    })
    return () => {
      useRunStore.setState({ pendingDialogue: null } as never)
      clearDialogues()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

const meta = {
  title: 'Scenes/DialogueModal',
  component: DialogueModal,
  decorators: [withSeededRun(mockParty(), 80, 5)],
  render: (_args, { name }) => (
    <>
      <StorySetup dialogueId={`story_${name.replace(/\W/g, '_')}`} />
      <DialogueModal />
    </>
  ),
} satisfies Meta<typeof DialogueModal>

export default meta
type Story = StoryObj<typeof meta>

export const BanditThreat: Story = {}
export const StatCheckPassable: Story = {}
