import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Heading } from '../../../../src/ui/components/Heading'

describe('<Heading>', () => {
  it('renders a heading at level 2 by default', () => {
    render(<Heading>Title</Heading>)
    const h = screen.getByRole('heading', { name: 'Title' })
    expect(h.tagName).toBe('H2')
  })

  it('honors the level prop', () => {
    render(<Heading level={1}>Bigger</Heading>)
    expect(screen.getByRole('heading', { name: 'Bigger' }).tagName).toBe('H1')
  })

  it('applies the engraved display voice and amber colour via class', () => {
    render(<Heading>Styled</Heading>)
    const h = screen.getByRole('heading', { name: 'Styled' })
    expect(h.className).toMatch(/font-display/)
    expect(h.className).toMatch(/text-amber-100/)
  })
})
