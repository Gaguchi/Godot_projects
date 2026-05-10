import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PauseMenu } from '../../../../src/ui/modals/PauseMenu'

const noop = () => {}

const baseProps = {
  open: true,
  canSave: true,
  onClose: noop,
  onResume: noop,
  onSaveGame: noop,
  onLoadGame: noop,
  onReturnToTitle: noop,
  onQuit: noop,
}

describe('<PauseMenu>', () => {
  it('renders nothing when not open', () => {
    const { container } = render(<PauseMenu {...baseProps} open={false} />)
    expect(container.querySelector('#pause-menu')).toBeNull()
  })

  it('shows all 5 menu options when open', () => {
    render(<PauseMenu {...baseProps} />)
    expect(screen.getByRole('button', { name: /^resume$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^save game$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^load game$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^return to title$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^quit$/i })).toBeInTheDocument()
  })

  it('disables Save Game when canSave is false', () => {
    render(<PauseMenu {...baseProps} canSave={false} />)
    const saveBtn = screen.getByRole('button', { name: /^save game$/i }) as HTMLButtonElement
    expect(saveBtn.disabled).toBe(true)
  })

  it('Resume fires onResume', () => {
    let resumed = false
    render(<PauseMenu {...baseProps} onResume={() => { resumed = true }} />)
    fireEvent.click(screen.getByRole('button', { name: /^resume$/i }))
    expect(resumed).toBe(true)
  })

  it('Save Game fires onSaveGame', () => {
    let saved = false
    render(<PauseMenu {...baseProps} onSaveGame={() => { saved = true }} />)
    fireEvent.click(screen.getByRole('button', { name: /^save game$/i }))
    expect(saved).toBe(true)
  })

  it('Load Game fires onLoadGame', () => {
    let loaded = false
    render(<PauseMenu {...baseProps} onLoadGame={() => { loaded = true }} />)
    fireEvent.click(screen.getByRole('button', { name: /^load game$/i }))
    expect(loaded).toBe(true)
  })

  it('Return to Title shows confirm step before firing onReturnToTitle', () => {
    let returned = false
    render(<PauseMenu {...baseProps} onReturnToTitle={() => { returned = true }} />)
    fireEvent.click(screen.getByRole('button', { name: /^return to title$/i }))
    // Now we're in confirm state — should NOT have fired yet
    expect(returned).toBe(false)
    expect(screen.getByText(/return to title\?/i)).toBeInTheDocument()
    // Confirm
    fireEvent.click(screen.getByRole('button', { name: /^return to title$/i }))
    expect(returned).toBe(true)
  })

  it('Cancel inside confirm step returns to main menu', () => {
    render(<PauseMenu {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /^return to title$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    // Back to main menu
    expect(screen.getByRole('button', { name: /^resume$/i })).toBeInTheDocument()
  })

  it('Quit fires onQuit', () => {
    let quit = false
    render(<PauseMenu {...baseProps} onQuit={() => { quit = true }} />)
    fireEvent.click(screen.getByRole('button', { name: /^quit$/i }))
    expect(quit).toBe(true)
  })
})
