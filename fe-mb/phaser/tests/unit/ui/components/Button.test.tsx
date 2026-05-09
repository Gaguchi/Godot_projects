import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../../../../src/ui/components/Button'

describe('<Button>', () => {
  it('renders children and fires onPress on click', () => {
    const onPress = vi.fn()
    render(<Button onPress={onPress}>Click me</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Click me' }))
    expect(onPress).toHaveBeenCalledOnce()
  })

  it('does not fire onPress when disabled', () => {
    const onPress = vi.fn()
    render(<Button onPress={onPress} isDisabled>Click me</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('fires onPress on Space/Enter key', () => {
    const onPress = vi.fn()
    render(<Button onPress={onPress}>Click me</Button>)
    const btn = screen.getByRole('button')
    btn.focus()
    fireEvent.keyDown(btn, { key: 'Enter' })
    fireEvent.keyUp(btn, { key: 'Enter' })
    expect(onPress).toHaveBeenCalled()
  })

  it('exposes data-disabled attribute when disabled', () => {
    render(<Button isDisabled>X</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('data-disabled', 'true')
  })
})
