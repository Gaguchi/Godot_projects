import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ListBox, ListBoxItem } from '../../../../src/ui/components/ListBox'

describe('<ListBox>', () => {
  it('renders items and fires onSelectionChange on click', () => {
    const onSelectionChange = vi.fn()
    render(
      <ListBox aria-label="items" selectionMode="single" onSelectionChange={onSelectionChange}>
        <ListBoxItem id="iron">Iron Sword</ListBoxItem>
        <ListBoxItem id="steel">Steel Sword</ListBoxItem>
      </ListBox>,
    )
    fireEvent.click(screen.getByRole('option', { name: 'Iron Sword' }))
    expect(onSelectionChange).toHaveBeenCalled()
  })

  it('arrow-down moves focus between options', () => {
    render(
      <ListBox aria-label="items" selectionMode="single">
        <ListBoxItem id="iron">Iron</ListBoxItem>
        <ListBoxItem id="steel">Steel</ListBoxItem>
      </ListBox>,
    )
    const first = screen.getByRole('option', { name: 'Iron' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('option', { name: 'Steel' }))
  })

  it('marks selected option with data-selected', () => {
    render(
      <ListBox aria-label="items" selectionMode="single" defaultSelectedKeys={['iron']}>
        <ListBoxItem id="iron">Iron</ListBoxItem>
      </ListBox>,
    )
    expect(screen.getByRole('option', { name: 'Iron' })).toHaveAttribute('data-selected', 'true')
  })
})
