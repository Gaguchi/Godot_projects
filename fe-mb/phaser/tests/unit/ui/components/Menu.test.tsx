import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Menu, MenuItem } from '../../../../src/ui/components/Menu'

describe('<Menu>', () => {
  it('renders items and fires onAction with the item id', () => {
    const onAction = vi.fn()
    render(
      <Menu aria-label="actions" onAction={onAction}>
        <MenuItem id="one">One</MenuItem>
        <MenuItem id="two">Two</MenuItem>
      </Menu>,
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'One' }))
    expect(onAction).toHaveBeenCalledWith('one')
  })

  it('arrow-down moves focus to the next item', () => {
    render(
      <Menu aria-label="actions" onAction={() => {}}>
        <MenuItem id="one">One</MenuItem>
        <MenuItem id="two">Two</MenuItem>
      </Menu>,
    )
    const first = screen.getByRole('menuitem', { name: 'One' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    const second = screen.getByRole('menuitem', { name: 'Two' })
    expect(document.activeElement).toBe(second)
  })

  it('Enter on focused item fires onAction', () => {
    const onAction = vi.fn()
    render(
      <Menu aria-label="actions" onAction={onAction}>
        <MenuItem id="one">One</MenuItem>
      </Menu>,
    )
    const first = screen.getByRole('menuitem', { name: 'One' })
    first.focus()
    fireEvent.keyDown(first, { key: 'Enter' })
    expect(onAction).toHaveBeenCalledWith('one')
  })
})
