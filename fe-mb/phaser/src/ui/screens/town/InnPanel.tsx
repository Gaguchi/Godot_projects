import React from 'react'
import { useRunStore } from '../../../state/runStore'
import type { Unit } from '../../../domain/unit'
import { Button, Heading } from '../../components'

export const HEAL_COST_PER_UNIT = 8

export function InnPanel(): React.JSX.Element {
  const dispatchRun = useRunStore((s) => s.dispatch)
  const gold = useRunStore((s) => s.gold)
  const partyUnits = useRunStore((s) => s.party.units)
  const partyArr = Object.values(partyUnits)
  const wounded = partyArr.filter((u) => u.hp.current < u.hp.max)
  const totalHealCost = wounded.length * HEAL_COST_PER_UNIT
  const canAffordHeal = gold >= totalHealCost && wounded.length > 0

  const onHeal = (): void => {
    if (!canAffordHeal) return
    dispatchRun({ type: 'addGold', payload: { amount: -totalHealCost } })
    for (const u of wounded) {
      const healed: Unit = { ...u, hp: { ...u.hp, current: u.hp.max } }
      dispatchRun({ type: 'recruitUnit', payload: { unit: healed } })
    }
  }

  return (
    <div id="inn-panel">
      <Heading level={1} className="text-2xl tracking-widest m-0">The Inn</Heading>
      <p className="text-stone-500 max-w-lg mt-2">
        Rest your party. Heals all wounded units to full HP. Costs {HEAL_COST_PER_UNIT}g per wounded unit.
      </p>
      <div className="mt-6">
        <strong>Wounded units:</strong>{' '}
        {wounded.length === 0
          ? 'none'
          : wounded.map((u) => `${u.name} (${u.hp.current}/${u.hp.max})`).join(', ')}
      </div>
      <div className="mt-4">Cost: {totalHealCost}g</div>
      <Button
        id="inn-heal-btn"
        variant="primary"
        isDisabled={!canAffordHeal}
        onPress={onHeal}
        className="mt-6"
      >
        {wounded.length === 0
          ? 'Everyone is healthy'
          : canAffordHeal
            ? `Rest (${totalHealCost}g)`
            : `Need ${totalHealCost}g`}
      </Button>
    </div>
  )
}
