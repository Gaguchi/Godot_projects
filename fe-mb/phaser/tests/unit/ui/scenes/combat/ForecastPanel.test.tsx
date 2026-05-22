import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ForecastPanel } from '../../../../../src/ui/scenes/combat/ForecastPanel'
import { useCombatStore } from '../../../../../src/state/combatStore'
import { initialCombatState } from '../../../../../src/systems/combatReducer'
import { asUnitId, asClassId, asCardId, asTileId } from '../../../../../src/domain/ids'
import type { Unit } from '../../../../../src/domain/unit'

const mk = (id: string, classId = 'lord', hpCur = 20, hpMax = 20, armor = 0): Unit => ({
  id: asUnitId(id),
  name: id.toUpperCase(),
  classId: asClassId(classId),
  level: 1,
  hp: { current: hpCur, max: hpMax },
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 0, res: 0, lck: 0 },
  position: id === 'roy' ? ('0,0' as never) : ('1,0' as never),
  ap: 3,
  armor,
  statuses: [],
})

const seed = (
  selectedCardId: string | null,
  pinnedTile: string | null,
  target: Unit = mk('bandit', 'bandit', 14, 14, 0),
): void => {
  const roy = mk('roy', 'lord')
  useCombatStore.setState({
    state: {
      ...initialCombatState(),
      phase: 'COMBAT',
      subPhase: 'SELECTING_TARGET',
      units: { roy, bandit: target },
      turn: { number: 1, unitId: asUnitId('roy'), team: 'party' },
      selectedCardId: selectedCardId === null ? null : asCardId(selectedCardId),
      pinnedTargetTile: pinnedTile === null ? null : asTileId(pinnedTile),
    },
    lastEffectId: 0,
  })
}

describe('<ForecastPanel>', () => {
  beforeEach(() => {
    useCombatStore.setState({ state: initialCombatState(), lastEffectId: 0 })
  })

  it('renders nothing when no preview', () => {
    seed(null, null)
    const { container } = render(<ForecastPanel />)
    expect(container.querySelector('#forecast-panel')).toBeNull()
  })

  it('renders card name and AP cost', () => {
    seed('lord_inspiring_strike', '1,0')
    render(<ForecastPanel />)
    expect(screen.getByText(/Inspiring Strike/i)).toBeInTheDocument()
    expect(screen.getByText(/2 AP/i)).toBeInTheDocument()
  })

  it('renders source and target portraits', () => {
    seed('lord_inspiring_strike', '1,0')
    render(<ForecastPanel />)
    expect(screen.getByLabelText(/source: ROY/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/target: BANDIT/i)).toBeInTheDocument()
  })

  it('shows LETHAL badge when predicted HP is 0', () => {
    const tinyBandit = mk('bandit', 'bandit', 5, 14, 0)
    seed('lord_inspiring_strike', '1,0', tinyBandit)
    render(<ForecastPanel />)
    expect(screen.getByText(/LETHAL/i)).toBeInTheDocument()
  })

  it('omits LETHAL badge when target survives', () => {
    seed('lord_inspiring_strike', '1,0')
    render(<ForecastPanel />)
    expect(screen.queryByText(/LETHAL/i)).toBeNull()
  })

  it('clicking confirm dispatches playCard and clears pin + selection', () => {
    seed('lord_inspiring_strike', '1,0')
    render(<ForecastPanel />)
    fireEvent.click(screen.getByTestId('forecast-confirm-btn'))
    const s = useCombatStore.getState().state
    expect(s.pinnedTargetTile).toBeNull()
    expect(s.selectedCardId).toBeNull()
  })

  it('clicking cancel dispatches unpinTarget but keeps card selected', () => {
    seed('lord_inspiring_strike', '1,0')
    render(<ForecastPanel />)
    fireEvent.click(screen.getByTestId('forecast-cancel-btn'))
    const s = useCombatStore.getState().state
    expect(s.pinnedTargetTile).toBeNull()
    expect(s.selectedCardId).toBe(asCardId('lord_inspiring_strike'))
  })

  it('renders armor bar when target has armor', () => {
    const armoredKnight = mk('bandit', 'bandit', 14, 14, 5)
    seed('lord_inspiring_strike', '1,0', armoredKnight)
    const { container } = render(<ForecastPanel />)
    // Two HP-bar rows when armor > 0: HP and Armor
    const labels = container.querySelectorAll('.w-12.text-stone-400')
    const texts = Array.from(labels).map((el) => el.textContent)
    expect(texts).toContain('Armor')
  })
})
