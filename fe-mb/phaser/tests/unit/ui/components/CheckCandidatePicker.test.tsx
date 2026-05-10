import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CheckCandidatePicker } from '../../../../src/ui/components/CheckCandidatePicker'
import { asUnitId, asClassId } from '../../../../src/domain/ids'
import type { CheckCandidate } from '../../../../src/domain/check'

const mk = (id: string, stat: number, meets: boolean): CheckCandidate => ({
  unitId: asUnitId(id),
  unitName: id.toUpperCase(),
  classId: asClassId('lord'),
  statValue: stat,
  meetsThreshold: meets,
})

describe('<CheckCandidatePicker>', () => {
  it('renders nothing when not open', () => {
    render(
      <CheckCandidatePicker open={false} statLabel="STR" threshold={7} candidates={[mk('a', 8, true)]}
        onPick={() => {}} onCancel={() => {}} />,
    )
    expect(screen.queryAllByTestId('candidate-row')).toHaveLength(0)
  })

  it('renders one row per candidate when open', () => {
    render(
      <CheckCandidatePicker open={true} statLabel="STR" threshold={7}
        candidates={[mk('a', 8, true), mk('b', 5, false)]}
        onPick={() => {}} onCancel={() => {}} />,
    )
    expect(screen.getAllByTestId('candidate-row')).toHaveLength(2)
  })

  it('passing rows show ✓; failing rows show ✗', () => {
    render(
      <CheckCandidatePicker open={true} statLabel="STR" threshold={7}
        candidates={[mk('a', 8, true), mk('b', 5, false)]}
        onPick={() => {}} onCancel={() => {}} />,
    )
    const rows = screen.getAllByTestId('candidate-row')
    expect(rows[0]!.textContent).toContain('✓')
    expect(rows[1]!.textContent).toContain('✗')
  })

  it('clicking a row fires onPick with that candidate', () => {
    let pickedId: string | null = null
    render(
      <CheckCandidatePicker open={true} statLabel="STR" threshold={7}
        candidates={[mk('a', 8, true)]}
        onPick={(c) => { pickedId = c.unitId as unknown as string }}
        onCancel={() => {}} />,
    )
    fireEvent.click(screen.getAllByTestId('candidate-row')[0]!)
    expect(pickedId).toBe('a')
  })

  it('cancel button fires onCancel', () => {
    let cancelled = false
    render(
      <CheckCandidatePicker open={true} statLabel="STR" threshold={7}
        candidates={[mk('a', 8, true)]} onPick={() => {}}
        onCancel={() => { cancelled = true }} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(cancelled).toBe(true)
  })

  it('shows empty-party message when no candidates', () => {
    render(
      <CheckCandidatePicker open={true} statLabel="STR" threshold={7}
        candidates={[]} onPick={() => {}} onCancel={() => {}} />,
    )
    expect(screen.getByText(/no living party/i)).toBeInTheDocument()
  })
})
