import type { Meta, StoryObj } from '@storybook/react-vite'
import { CombatHud } from './CombatHud'
import { withSeededCombat } from '../../../storybook/decorators'
import { mockParty, mockEnemies, mockBandit, mockBanditArcher } from '../../../storybook/fixtures'

const meta = {
  title: 'Scenes/CombatHud',
  component: CombatHud,
} satisfies Meta<typeof CombatHud>

export default meta
type Story = StoryObj<typeof meta>

/** Standard 3v3 combat. Roy's turn. */
export const PartyTurn: Story = {
  decorators: [withSeededCombat([...mockParty(), ...mockEnemies()], 'roy')],
}

/** Enemy turn highlight — bandit_a (rusher) is active. */
export const EnemyRusherTurn: Story = {
  decorators: [withSeededCombat([...mockParty(), ...mockEnemies()], 'bandit_a')],
}

/** Enemy turn highlight — archer (kiter) is active. */
export const EnemyArcherTurn: Story = {
  decorators: [withSeededCombat([...mockParty(), ...mockEnemies()], 'bandit_archer')],
}

/** Mixed encounter with healer support. */
export const HealerInParty: Story = {
  decorators: [
    withSeededCombat(
      [
        ...mockParty(),
        mockBandit('bandit_a', '6,4'),
        mockBanditArcher('bandit_archer', '8,3'),
        {
          id: 'priest_a' as never,
          name: 'Bandit Priest',
          classId: 'bandit_priest' as never,
          level: 4,
          hp: { current: 14, max: 14 },
          stats: { str: 1, mag: 6, skl: 4, spd: 4, def: 2, res: 5, lck: 2 },
          position: '7,3' as never,
          ap: 3,
          armor: 0,
          statuses: [],
        },
      ],
      'roy',
    ),
  ],
}
