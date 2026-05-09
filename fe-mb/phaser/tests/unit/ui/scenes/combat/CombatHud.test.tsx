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
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1 },
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
    expect(screen.getByText(/Turn 0/)).toBeInTheDocument()
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
    expect(screen.getByText('Turn 3')).toBeInTheDocument()
    expect(screen.getByText('YOUR TURN')).toBeInTheDocument()
  })
})
