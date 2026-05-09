import React from 'react'
import { Button } from '../../components'
import { useCombatStore } from '../../../state/combatStore'
import { createRng } from '../../../systems/rng'

export function MoveBtn(): React.JSX.Element {
  const dispatch = useCombatStore((s) => s.dispatch)
  const subPhase = useCombatStore((s) => s.state.subPhase)
  const team = useCombatStore((s) => s.state.turn.team)
  const activeId = useCombatStore((s) => s.state.turn.unitId)
  const unit = useCombatStore((s) =>
    activeId ? s.state.units[activeId as unknown as string] : undefined,
  )
  const rngState = useCombatStore((s) => s.state.rng)

  const selecting = subPhase === 'SELECTING_MOVE'
  const enabled =
    team === 'party'
    && unit !== undefined
    && unit.hp.current > 0
    && !unit.hasMovedThisTurn
    && subPhase !== 'RESOLVING'

  const onPress = (): void => {
    const rng = createRng(rngState)
    if (selecting) {
      dispatch({ type: 'cancelSelection' }, rng)
    } else if (activeId) {
      dispatch({ type: 'enterMoveMode', payload: { unitId: activeId } }, rng)
    }
  }

  return (
    <Button
      id="combat-move-btn"
      variant={selecting ? 'primary' : 'secondary'}
      isDisabled={!enabled && !selecting}
      onPress={onPress}
      className="!min-w-[140px]"
    >
      {selecting ? 'Cancel Move' : 'Move'}
    </Button>
  )
}
