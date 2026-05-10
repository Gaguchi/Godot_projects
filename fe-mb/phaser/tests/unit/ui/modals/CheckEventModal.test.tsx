import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CheckEventModal, type CheckEvent } from '../../../../src/ui/modals/CheckEventModal'
import { asUnitId, asClassId } from '../../../../src/domain/ids'
import type { Unit } from '../../../../src/domain/unit'

const mkUnit = (id: string, str: number, hp = 20): Unit => ({
  id: asUnitId(id), name: id.toUpperCase(), classId: asClassId('lord'), level: 1,
  hp: { current: hp, max: 20 },
  stats: { str, mag: 0, skl: 4, spd: 5, def: 3, res: 1, lck: 0 },
  position: null, ap: 3, armor: 0, statuses: [],
})

const evt: CheckEvent = {
  id: 'e',
  title: 'A boulder',
  description: 'Heavy.',
  choices: [
    {
      id: 'force', text: 'Force.',
      check: { kind: 'stat', stat: 'str', threshold: 7 },
      onPass: { narration: 'You rolled it.', effects: [] },
      onFail: { narration: 'It did not move.', effects: [] },
    },
    {
      id: 'leave', text: 'Leave.',
      onPass: { narration: 'You moved on.', effects: [] },
    },
  ],
}

describe('<CheckEventModal>', () => {
  it('renders title and description', () => {
    render(<CheckEventModal event={evt} party={[mkUnit('a', 8)]} gold={0} foodCount={0}
      onResolve={() => {}} onClose={() => {}} />)
    expect(screen.getByText('A boulder')).toBeInTheDocument()
    expect(screen.getByText(/Heavy/)).toBeInTheDocument()
  })

  it('renders one button per choice', () => {
    render(<CheckEventModal event={evt} party={[mkUnit('a', 8)]} gold={0} foodCount={0}
      onResolve={() => {}} onClose={() => {}} />)
    expect(screen.getByText('Force.')).toBeInTheDocument()
    expect(screen.getByText('Leave.')).toBeInTheDocument()
  })

  it('clicking a stat-checked choice opens the picker', () => {
    render(<CheckEventModal event={evt} party={[mkUnit('a', 8)]} gold={0} foodCount={0}
      onResolve={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Force.'))
    expect(screen.getByText(/Who tries this/)).toBeInTheDocument()
  })

  it('after picker pick, narration replaces description', () => {
    render(<CheckEventModal event={evt} party={[mkUnit('a', 8)]} gold={0} foodCount={0}
      onResolve={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Force.'))
    fireEvent.click(screen.getAllByTestId('candidate-row')[0]!)
    expect(screen.getByText('You rolled it.')).toBeInTheDocument()
  })

  it('Continue button after narration fires onResolve', () => {
    let resolved = false
    render(<CheckEventModal event={evt} party={[mkUnit('a', 8)]} gold={0} foodCount={0}
      onResolve={() => { resolved = true }} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Force.'))
    fireEvent.click(screen.getAllByTestId('candidate-row')[0]!)
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(resolved).toBe(true)
  })

  it('non-checked choice resolves directly without picker', () => {
    render(<CheckEventModal event={evt} party={[mkUnit('a', 8)]} gold={0} foodCount={0}
      onResolve={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Leave.'))
    expect(screen.getByText('You moved on.')).toBeInTheDocument()
  })

  it('disables stat-check button when no candidate meets threshold', () => {
    render(<CheckEventModal event={evt} party={[mkUnit('weak', 3)]} gold={0} foodCount={0}
      onResolve={() => {}} onClose={() => {}} />)
    const force = screen.getByText('Force.').closest('button')
    expect(force).toBeDisabled()
  })

  it('player can deliberately pick a failing candidate when others would pass', () => {
    render(<CheckEventModal event={evt} party={[mkUnit('strong', 8), mkUnit('weak', 3)]}
      gold={0} foodCount={0} onResolve={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Force.'))
    // Pick the WEAK row (second one, since sorted desc)
    const rows = screen.getAllByTestId('candidate-row')
    fireEvent.click(rows[1]!)
    expect(screen.getByText('It did not move.')).toBeInTheDocument()
  })
})
