import React from 'react'
import { useRunStore } from '../../../state/runStore'
import type { Unit } from '../../../domain/unit'
import { Button, Heading } from '../../components'
import { SectionLabel } from './townUi'

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
      <p className="mt-2 max-w-lg text-[color:var(--color-text-muted)]">
        Warm beds and a hot meal — {HEAL_COST_PER_UNIT}g a head, and the wounded wake whole.
      </p>

      <SectionLabel className="mt-6">Wounded</SectionLabel>
      {wounded.length === 0 ? (
        <div className="mt-2 text-[color:var(--color-text-muted)]">Everyone is rested and whole.</div>
      ) : (
        <div className="mt-2 max-w-sm space-y-1.5">
          {wounded.map((u) => (
            <div
              key={u.id as unknown as string}
              className="flex items-baseline justify-between border-b border-[rgba(120,98,60,0.18)] pb-1"
            >
              <span className="font-body text-parchment">{u.name}</span>
              <span className="numeral text-sm text-[color:var(--color-damage-text)]">
                {u.hp.current}
                <span className="opacity-60">/{u.hp.max}</span>
              </span>
            </div>
          ))}
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-sm text-[color:var(--color-text-muted)]">Board and care</span>
            <span className="numeral text-base text-[color:var(--color-hearth-soft)]">{totalHealCost}g</span>
          </div>
        </div>
      )}

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
