import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModeLabel } from '../../../../../src/ui/scenes/combat/ModeLabel'
import { useCombatStore } from '../../../../../src/state/combatStore'
import { initialCombatState } from '../../../../../src/systems/combatReducer'

describe('<ModeLabel>', () => {
  beforeEach(() => {
    useCombatStore.setState({ state: initialCombatState(), lastEffectId: 0 })
  })

  it('renders hidden banner in IDLE subPhase (always-mounted, opacity 0)', () => {
    render(<ModeLabel />)
    const banner = document.querySelector('[aria-hidden="true"]')
    expect(banner).not.toBeNull()
    expect(banner?.className).toMatch(/opacity-0/)
  })

  it('shows move-mode banner when subPhase = SELECTING_MOVE', () => {
    useCombatStore.setState((prev) => ({
      ...prev,
      state: { ...prev.state, subPhase: 'SELECTING_MOVE' },
    }))
    render(<ModeLabel />)
    expect(screen.getByText(/Choose a highlighted tile/)).toBeInTheDocument()
  })

  it('shows target-mode banner when subPhase = SELECTING_TARGET', () => {
    useCombatStore.setState((prev) => ({
      ...prev,
      state: { ...prev.state, subPhase: 'SELECTING_TARGET' },
    }))
    render(<ModeLabel />)
    expect(screen.getByText(/Choose a target/)).toBeInTheDocument()
  })

  it('hides while a forecast target is pinned (ForecastPanel owns that moment)', () => {
    useCombatStore.setState((prev) => ({
      ...prev,
      state: {
        ...prev.state,
        subPhase: 'SELECTING_TARGET',
        pinnedTargetTile: '1,0' as never,
      },
    }))
    render(<ModeLabel />)
    const banner = document.querySelector('[aria-hidden="true"]')
    expect(banner).not.toBeNull()
    expect(banner?.className).toMatch(/opacity-0/)
  })
})
