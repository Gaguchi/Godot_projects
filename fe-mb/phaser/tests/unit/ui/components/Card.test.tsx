import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Card } from '../../../../src/ui/components/Card'

// Common props for the forged-card API (gem type + target label are required).
const base = { cardType: 'attack' as const, targetLabel: 'one foe' }

describe('<Card>', () => {
  it('fires onPress when AP is sufficient', () => {
    const onPress = vi.fn()
    render(<Card {...base} onPress={onPress} cardName="Slash" apCost={1} availableAp={3} magnitude={6} magnitudeKind="damage" />)
    fireEvent.click(screen.getByRole('button'))
    expect(onPress).toHaveBeenCalled()
  })

  it('does not fire onPress when AP is insufficient', () => {
    const onPress = vi.fn()
    render(<Card {...base} onPress={onPress} cardName="Heavy Strike" apCost={3} availableAp={1} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('exposes disabled state and data-disabled-reason with the AP shortfall', () => {
    render(<Card {...base} onPress={() => {}} cardName="Heavy Strike" apCost={3} availableAp={1} />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('data-disabled', 'true')
    const reason = btn.getAttribute('data-disabled-reason') ?? ''
    expect(reason).toMatch(/needs 3 AP/i)
    expect(reason).toMatch(/have 1/i)
    // Note: a Tooltip wrapper (UI-T8) renders this reason visually on hover/focus.
  })

  it('marks selected state with data attribute', () => {
    render(<Card {...base} onPress={() => {}} cardName="Slash" apCost={1} availableAp={3} isSelected />)
    expect(screen.getByRole('button')).toHaveAttribute('data-selected', 'true')
  })
})
