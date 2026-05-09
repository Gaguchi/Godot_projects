import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tooltip } from '../../../../src/ui/components/Tooltip'
import { Button } from '../../../../src/ui/components/Button'

describe('<Tooltip>', () => {
  it('renders the trigger element', () => {
    render(
      <Tooltip trigger={<Button>hover me</Button>} content="Tip text" />,
    )
    expect(screen.getByRole('button', { name: 'hover me' })).toBeInTheDocument()
  })

  it('renders tooltip content when opened (controlled isOpen)', () => {
    render(
      <Tooltip
        trigger={<Button>hover me</Button>}
        content="Tip text"
        isOpen
      />,
    )
    expect(screen.getByRole('tooltip')).toHaveTextContent('Tip text')
  })
})
