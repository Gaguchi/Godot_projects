import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CheckButton } from '../../../../src/ui/components/CheckButton'
import { asUnitId, asClassId } from '../../../../src/domain/ids'
import type { CheckCandidate } from '../../../../src/domain/check'

const mkCandidate = (id: string, statValue: number, meets: boolean): CheckCandidate => ({
  unitId: asUnitId(id),
  unitName: id.toUpperCase(),
  classId: asClassId('lord'),
  statValue,
  meetsThreshold: meets,
})

describe('<CheckButton>', () => {
  it('renders without prefix when no requirement', () => {
    render(<CheckButton text="Greet" candidates={[]} requirement={null} canPass={true} onPress={() => {}} />)
    expect(screen.getByText('Greet')).toBeInTheDocument()
    expect(screen.queryByTestId('check-prefix')).toBeNull()
  })

  it('renders green prefix when stat check is passable', () => {
    render(<CheckButton
      text="Force door"
      requirement={{ kind: 'stat', stat: 'str', threshold: 7 }}
      candidates={[mkCandidate('a', 8, true)]}
      canPass={true}
      onPress={() => {}}
    />)
    const prefix = screen.getByTestId('check-prefix')
    expect(prefix.textContent).toContain('STR 7')
    expect(prefix.className).toContain('text-emerald')
  })

  it('renders red prefix when nobody meets threshold', () => {
    render(<CheckButton
      text="Force door"
      requirement={{ kind: 'stat', stat: 'str', threshold: 10 }}
      candidates={[mkCandidate('a', 5, false)]}
      canPass={false}
      onPress={() => {}}
    />)
    const prefix = screen.getByTestId('check-prefix')
    expect(prefix.className).toContain('text-red')
  })

  it('disables button when canPass is false', () => {
    render(<CheckButton
      text="x"
      requirement={{ kind: 'gold', amount: 100 }}
      candidates={[]}
      canPass={false}
      onPress={() => {}}
    />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
  })

  it('renders gold prefix as [100g]', () => {
    render(<CheckButton
      text="x"
      requirement={{ kind: 'gold', amount: 100 }}
      candidates={[]}
      canPass={true}
      onPress={() => {}}
    />)
    expect(screen.getByTestId('check-prefix').textContent).toContain('100g')
  })

  it('renders food prefix as [3 food]', () => {
    render(<CheckButton
      text="x"
      requirement={{ kind: 'food', amount: 3 }}
      candidates={[]}
      canPass={true}
      onPress={() => {}}
    />)
    expect(screen.getByTestId('check-prefix').textContent).toContain('3 food')
  })

  it('renders class prefix as [CLERIC]', () => {
    render(<CheckButton
      text="x"
      requirement={{ kind: 'class', classId: asClassId('cleric') }}
      candidates={[]}
      canPass={true}
      onPress={() => {}}
    />)
    expect(screen.getByTestId('check-prefix').textContent?.toLowerCase()).toContain('cleric')
  })

  it('fires onPress when clicked', () => {
    let pressed = false
    render(<CheckButton text="x" requirement={null} candidates={[]} canPass={true} onPress={() => { pressed = true }} />)
    fireEvent.click(screen.getByRole('button'))
    expect(pressed).toBe(true)
  })
})
