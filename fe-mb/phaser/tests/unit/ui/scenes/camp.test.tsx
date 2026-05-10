import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CampScene } from '../../../../src/ui/screens/CampScene'
import { useRunStore } from '../../../../src/state/runStore'
import type { Unit } from '../../../../src/domain/unit'
import { asItemId } from '../../../../src/domain/ids'

const fakeUnit = (id: string, current: number, max: number): Unit =>
  ({
    id: id as never,
    name: id,
    classId: 'test_class' as never,
    level: 1,
    xp: 0,
    hp: { current, max },
    stats: {} as never,
    growth: {} as never,
    skills: [],
    movement: 5,
    deck: { drawPile: [], discardPile: [], playedThisTurn: [] },
    apMaxBase: 3,
  }) as unknown as Unit

describe('<CampScene>', () => {
  beforeEach(() => {
    useRunStore.getState().__resetForTest()
  })

  it('Rest button heals 20% to all wounded units and consumes 1 food ration', () => {
    useRunStore.setState({
      party: {
        units: { a: fakeUnit('a', 5, 20), b: fakeUnit('b', 10, 20) },
        partyOrder: ['a' as never, 'b' as never],
      } as never,
      inventory: {
        items: [{ uid: 1 as never, itemId: asItemId('food_rations') as never, gridX: 0, gridY: 0 }] as never,
      } as never,
    } as never)
    render(<CampScene onLeave={() => {}} />)
    const rest = screen.getByRole('button', { name: /Rest/i })
    fireEvent.click(rest)
    const next = useRunStore.getState()
    expect(next.party.units['a']!.hp.current).toBe(5 + Math.floor(20 * 0.2))
    expect(next.party.units['b']!.hp.current).toBe(10 + Math.floor(20 * 0.2))
    expect(next.inventory.items.length).toBe(0)
  })

  it('Rest button is disabled when there is no food', () => {
    useRunStore.setState({
      party: {
        units: { a: fakeUnit('a', 5, 20) },
        partyOrder: ['a' as never],
      } as never,
      inventory: { items: [] } as never,
    } as never)
    render(<CampScene onLeave={() => {}} />)
    const rest = screen.getByRole('button', { name: /Rest/i }) as HTMLButtonElement
    expect(rest.disabled).toBe(true)
  })

  it('Leave button fires onLeave', () => {
    let left = false
    render(<CampScene onLeave={() => { left = true }} />)
    fireEvent.click(screen.getByRole('button', { name: /Leave/i }))
    expect(left).toBe(true)
  })
})
