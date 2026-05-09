import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Card } from '../../../../src/ui/components/Card'

describe('<Card>', () => {
  it('fires onPress when AP is sufficient', () => {
    const onPress = vi.fn()
    render(
      <Card onPress={onPress} cardName="Slash" apCost={1} availableAp={3}>
        Slash
      </Card>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onPress).toHaveBeenCalled()
  })

  it('does not fire onPress when AP is insufficient', () => {
    const onPress = vi.fn()
    render(
      <Card onPress={onPress} cardName="Heavy Strike" apCost={3} availableAp={1}>
        Heavy
      </Card>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('exposes disabled state and data-disabled-reason with the AP shortfall', () => {
    render(
      <Card onPress={() => {}} cardName="Heavy Strike" apCost={3} availableAp={1}>
        Heavy
      </Card>,
    )
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('data-disabled', 'true')
    const reason = btn.getAttribute('data-disabled-reason') ?? ''
    expect(reason).toMatch(/needs 3 AP/i)
    expect(reason).toMatch(/have 1/i)
    // Note: a Tooltip wrapper (UI-T8) renders this reason visually on hover/focus.
  })

  it('marks selected state with data attribute', () => {
    render(
      <Card onPress={() => {}} cardName="Slash" apCost={1} availableAp={3} isSelected>
        Slash
      </Card>,
    )
    expect(screen.getByRole('button')).toHaveAttribute('data-selected', 'true')
  })
})
