import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PartyLoadoutModal } from '../../../../src/ui/modals/PartyLoadoutModal'
import { useRunStore } from '../../../../src/state/runStore'
import { asUnitId } from '../../../../src/domain/ids'
import type { Unit } from '../../../../src/domain/unit'

const roy = (): Unit => ({
  id: asUnitId('roy'), name: 'Roy', classId: 'lord' as never, level: 1,
  hp: { current: 22, max: 22 },
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1, lck: 4 },
  position: null, ap: 3, armor: 0, statuses: [],
})

function seed(bagIds: string[]): void {
  useRunStore.getState().__resetForTest()
  useRunStore.getState().dispatch({
    type: 'hydrateFromSave',
    payload: {
      gold: 100,
      worldPosition: { mapId: 'borderlands', nodeId: 'start' },
      partyUnits: [roy() as unknown as { id: string }],
      partyOrder: ['roy'],
      inventoryItems: bagIds.map((id, i) => ({ itemId: id, gridX: i, gridY: 0 })),
    },
  })
}

const noop = (): void => {}

describe('<PartyLoadoutModal>', () => {
  beforeEach(() => seed(['iron_sword', 'iron_buckler', 'iron_greatsword', 'food_rations']))

  it('renders nothing when closed', () => {
    const { container } = render(<PartyLoadoutModal open={false} onClose={noop} />)
    expect(container.querySelector('#party-loadout-panel')).toBeNull()
  })

  it('lists gear (not consumables) in the bag column with equip buttons', () => {
    render(<PartyLoadoutModal open onClose={noop} />)
    expect(screen.getByText('Iron Sword')).toBeInTheDocument()
    expect(screen.getByText('Iron Greatsword')).toBeInTheDocument()
    expect(screen.queryByText('Food Rations')).toBeNull()
    expect(screen.getByText(/\+1 consumable/)).toBeInTheDocument()
  })

  it('Equip L moves gear from bag to the left hand slot', () => {
    render(<PartyLoadoutModal open onClose={noop} />)
    const swordRow = screen.getByText('Iron Sword').closest('div')!.parentElement!
    const equipL = swordRow.querySelectorAll('button')[0]!
    fireEvent.click(equipL)
    expect(useRunStore.getState().party.units['roy']?.handLeft).toBe('iron_sword')
    // slot renders the item
    const slot = document.querySelector('#hand-slot-left')!
    expect(slot.textContent).toContain('Iron Sword')
  })

  it('2H weapon locks the right slot and Equip R is disabled for it', () => {
    render(<PartyLoadoutModal open onClose={noop} />)
    const gsRow = screen.getByText('Iron Greatsword').closest('div')!.parentElement!
    const [equipL, equipR] = Array.from(gsRow.querySelectorAll('button')) as HTMLButtonElement[]
    expect(equipR!.disabled).toBe(true)
    fireEvent.click(equipL!)
    const slotR = document.querySelector('#hand-slot-right')!
    expect(slotR.textContent).toMatch(/Locked/)
  })

  it('Unequip returns the item to the bag', () => {
    useRunStore.getState().dispatch({
      type: 'equipItem',
      payload: { unitId: asUnitId('roy'), itemId: 'iron_sword' as never, slot: 'left' },
    })
    render(<PartyLoadoutModal open onClose={noop} />)
    fireEvent.click(screen.getByRole('button', { name: /unequip/i }))
    expect(useRunStore.getState().party.units['roy']?.handLeft ?? null).toBeNull()
  })

  it('deck preview groups cards by source', () => {
    useRunStore.getState().dispatch({
      type: 'equipItem',
      payload: { unitId: asUnitId('roy'), itemId: 'iron_sword' as never, slot: 'left' },
    })
    render(<PartyLoadoutModal open onClose={noop} />)
    expect(screen.getByText(/Class:/)).toBeInTheDocument()
    expect(screen.getByText(/Left hand:/)).toBeInTheDocument()
    expect(screen.getByText(/Deck next battle · 8 cards/)).toBeInTheDocument()
  })
})
