import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CombatHud } from '../../../../../src/ui/scenes/combat/CombatHud'
import { useCombatStore } from '../../../../../src/state/combatStore'
import { initialCombatState } from '../../../../../src/systems/combatReducer'
import { asUnitId, asClassId } from '../../../../../src/domain/ids'
import type { Unit } from '../../../../../src/domain/unit'

const mkUnit = (id: string, name: string): Unit => ({
  id: asUnitId(id),
  name,
  classId: asClassId('lord'),
  level: 1,
  hp: { current: 18, max: 22 },
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1, lck: 0 },
  position: null,
  ap: 2,
  armor: 0,
  statuses: [],
})

describe('<CombatHud>', () => {
  beforeEach(() => {
    useCombatStore.setState({ state: initialCombatState(), lastEffectId: 0 })
  })

  it('renders empty TopBar when no active unit', () => {
    render(<CombatHud />)
    // Herald plaque: "Turn" label + turn-number numeral are now separate spans.
    expect(screen.getByText('Turn')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('shows the active unit name + AP when in combat', () => {
    const roy = mkUnit('roy', 'Roy')
    useCombatStore.setState((prev) => ({
      ...prev,
      state: {
        ...prev.state,
        phase: 'COMBAT',
        turn: { number: 3, unitId: roy.id, team: 'party' },
        units: { roy },
      },
    }))
    render(<CombatHud />)
    expect(screen.getByText('Roy')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument() // turn number numeral
    // phase label is "Your Turn" (CSS uppercases it; DOM text is title-case)
    expect(screen.getByText('Your Turn')).toBeInTheDocument()
    // AP is now pips with an accessible label rather than "AP 2/3" text
    expect(screen.getByLabelText('2 of 3 action points')).toBeInTheDocument()
  })

  it.each(['VICTORY', 'DEFEAT'] as const)(
    'goes neutral when the battle ends (%s): Battle Ended plate, no command zone',
    (phase) => {
      const roy = mkUnit('roy', 'Roy')
      useCombatStore.setState((prev) => ({
        ...prev,
        state: {
          ...prev.state,
          phase,
          turn: { number: 5, unitId: roy.id, team: 'party' },
          units: { roy },
        },
      }))
      render(<CombatHud />)
      // TopBar swaps to the neutral terminal plate: turn count + Battle Ended.
      expect(screen.getByText('Battle Ended')).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument()
      // No stale "act now" chrome behind the battle-end modal.
      expect(screen.queryByText('Roy')).not.toBeInTheDocument()
      expect(screen.queryByText('Your Turn')).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/action points/)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/health/)).not.toBeInTheDocument()
      // Command zone (Move / End Turn / danger-zone chip) is unmounted.
      expect(screen.queryByText('End Turn')).not.toBeInTheDocument()
      expect(screen.queryByText('Move')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Toggle danger zones')).not.toBeInTheDocument()
    },
  )
})
