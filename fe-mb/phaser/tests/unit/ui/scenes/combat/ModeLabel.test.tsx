import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModeLabel } from '../../../../../src/ui/scenes/combat/ModeLabel'
import { useCombatStore } from '../../../../../src/state/combatStore'
import { initialCombatState } from '../../../../../src/systems/combatReducer'

describe('<ModeLabel>', () => {
  beforeEach(() => {
    useCombatStore.setState({ state: initialCombatState(), lastEffectId: 0 })
  })

  it('renders nothing in IDLE subPhase', () => {
    const { container } = render(<ModeLabel />)
    expect(container.textContent).toBe('')
  })

  it('shows move-mode banner when subPhase = SELECTING_MOVE', () => {
    useCombatStore.setState((prev) => ({
      ...prev,
      state: { ...prev.state, subPhase: 'SELECTING_MOVE' },
    }))
    render(<ModeLabel />)
    expect(screen.getByText(/Click a highlighted tile/)).toBeInTheDocument()
  })

  it('shows target-mode banner when subPhase = SELECTING_TARGET', () => {
    useCombatStore.setState((prev) => ({
      ...prev,
      state: { ...prev.state, subPhase: 'SELECTING_TARGET' },
    }))
    render(<ModeLabel />)
    expect(screen.getByText(/Click a target/)).toBeInTheDocument()
  })
})
