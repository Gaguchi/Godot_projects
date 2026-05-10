import type { Meta, StoryObj } from '@storybook/react-vite'
import { CheckEventModal, type CheckEvent } from './CheckEventModal'
import { mockParty } from '../../storybook/fixtures'

const baseEvent: CheckEvent = {
  id: 'stuck_caravan',
  title: 'A caravan blocks the road.',
  description: 'The driver shouts at his oxen. The road is narrow, and you would have to push or talk your way past.',
  choices: [
    {
      id: 'push',
      text: 'Help push the wagon free.',
      check: { kind: 'stat', stat: 'str', threshold: 6 },
      onPass: { narration: 'You shoulder the wheel free; the merchant tips you in gratitude.', effects: [] },
      onFail: { narration: 'You strain but the wheel will not move.', effects: [] },
    },
    {
      id: 'negotiate',
      text: 'Talk him into letting you detour.',
      check: { kind: 'stat', stat: 'skl', threshold: 7 },
      onPass: { narration: 'He agrees, gladly.', effects: [] },
      onFail: { narration: 'He waves you off.', effects: [] },
    },
    {
      id: 'wait',
      text: 'Wait it out.',
      onPass: { narration: 'The road clears two hours later.', effects: [] },
    },
  ],
}

const meta = {
  title: 'Scenes/CheckEventModal',
  component: CheckEventModal,
  args: {
    event: baseEvent,
    party: mockParty(),
    gold: 80,
    foodCount: 5,
    onResolve: () => {},
    onClose: () => {},
  },
} satisfies Meta<typeof CheckEventModal>

export default meta
type Story = StoryObj<typeof meta>

export const PassableChecks: Story = {}

export const NoneCanPass: Story = {
  args: {
    event: {
      ...baseEvent,
      choices: baseEvent.choices.map((c) =>
        c.check?.kind === 'stat' ? { ...c, check: { ...c.check, threshold: 99 } } : c,
      ),
    },
  },
}

export const ClassCheckPresent: Story = {
  args: {
    event: {
      ...baseEvent,
      choices: [
        {
          id: 'cleric',
          text: 'Bless the wagon.',
          check: { kind: 'class', classId: 'cleric' as never },
          onPass: { narration: 'A blessing rolls forward; the wheel frees itself.', effects: [] },
          onFail: { narration: 'No cleric in your party can call upon the divine.', effects: [] },
        },
        ...baseEvent.choices,
      ],
    },
  },
}

export const ResourceCheck: Story = {
  args: {
    event: {
      ...baseEvent,
      choices: [
        {
          id: 'bribe',
          text: 'Pay him to clear the road.',
          check: { kind: 'gold', amount: 50 },
          onPass: { narration: 'He pockets the coin and clears the road.', effects: [] },
          onFail: { narration: 'You do not have enough gold.', effects: [] },
        },
        ...baseEvent.choices,
      ],
    },
    gold: 100,
  },
}
