import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Pressable } from '../../../../src/ui/components/Pressable'

describe('<Pressable>', () => {
  it('renders div with role="button" and fires onPress on click', () => {
    const onPress = vi.fn()
    render(<Pressable onPress={onPress} aria-label="map node">N</Pressable>)
    const el = screen.getByRole('button', { name: 'map node' })
    expect(el.tagName).toBe('DIV')
    fireEvent.click(el)
    expect(onPress).toHaveBeenCalled()
  })

  it('respects isDisabled', () => {
    const onPress = vi.fn()
    render(<Pressable onPress={onPress} isDisabled aria-label="x">X</Pressable>)
    fireEvent.click(screen.getByRole('button'))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('exposes tabIndex 0 when enabled, -1 when disabled', () => {
    const { rerender } = render(<Pressable onPress={() => {}} aria-label="x">X</Pressable>)
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '0')
    rerender(<Pressable onPress={() => {}} isDisabled aria-label="x">X</Pressable>)
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '-1')
  })
})
