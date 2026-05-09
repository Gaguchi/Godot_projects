import React from 'react'
import { Button } from '../../components'
import { useCombatStore } from '../../../state/combatStore'
import { createRng } from '../../../systems/rng'

export function EndTurnBtn(): React.JSX.Element {
  const dispatch = useCombatStore((s) => s.dispatch)
  const enabled = useCombatStore(
    (s) =>
      s.state.phase === 'COMBAT'
      && s.state.turn.team === 'party'
      && s.state.subPhase !== 'RESOLVING',
  )
  const rngState = useCombatStore((s) => s.state.rng)

  return (
    <Button
      id="combat-end-turn-btn"
      variant="primary"
      isDisabled={!enabled}
      onPress={() => dispatch({ type: 'endTurn' }, createRng(rngState))}
      className="!min-w-[140px]"
    >
      End Turn
    </Button>
  )
}
