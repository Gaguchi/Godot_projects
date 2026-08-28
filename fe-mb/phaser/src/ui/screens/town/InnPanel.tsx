import React from 'react'
import { useRunStore } from '../../../state/runStore'
import type { Unit } from '../../../domain/unit'
import { Button } from '../../components'
import {
  BedGlyph, ColumnHeader, EmptyState, EntryHeading, INK_RULE, INK_RULE_STRONG, SectionLabel,
  type ColumnSpec,
} from './townUi'

export const HEAL_COST_PER_UNIT = 8

/** The inn's accounts column: who, how they're faring, what the bed costs. */
const COLS: React.CSSProperties = { gridTemplateColumns: 'minmax(0,1fr) 5.5rem 4.5rem' }
const INN_COLS: readonly ColumnSpec[] = [
  { label: 'Name' },
  { label: 'Condition', align: 'right' },
  { label: 'Board', align: 'right' },
]

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
    <div id="inn-panel" className="max-w-[44rem]">
      <EntryHeading
        title="The Inn"
        blurb={`Warm beds and a hot meal — ${HEAL_COST_PER_UNIT}g a head, and the wounded wake whole.`}
      />

      <SectionLabel className="mt-7">Wounded</SectionLabel>
      {wounded.length === 0 ? (
        <EmptyState
          glyph={<BedGlyph />}
          line="Every bed is made and nobody needs one."
          hint="The innkeeper writes the company down as whole."
        />
      ) : (
        <div className="max-w-[32rem]">
          <ColumnHeader cols={INN_COLS} style={COLS} />
          {wounded.map((u) => (
            <div
              key={u.id as unknown as string}
              className="grid items-baseline gap-3 py-2"
              style={{ ...COLS, borderBottom: `1px solid ${INK_RULE}` }}
            >
              <span data-probe="wounded-name" className="voice-display truncate text-[0.98rem] text-[color:var(--color-ink)]">
                {u.name}
              </span>
              <span data-probe="wounded-hp" className="numeral text-right text-[0.95rem] text-[color:var(--color-damage-text)]">
                {u.hp.current}
                <span className="text-[color:var(--color-text-muted)]">/{u.hp.max}</span>
              </span>
              <span className="numeral text-right text-[0.95rem] text-[color:var(--color-hearth-soft)]">
                {HEAL_COST_PER_UNIT}
                <span className="text-[0.7rem]">g</span>
              </span>
            </div>
          ))}
          {/* the ruled-off total every accounts column ends on */}
          <div
            className="mt-1 grid items-baseline gap-3 pt-2"
            style={{ ...COLS, borderTop: `1px solid ${INK_RULE_STRONG}` }}
          >
            <span className="text-[0.62rem] uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
              Board and care
            </span>
            <span className="numeral text-right text-[0.8rem] text-[color:var(--color-text-muted)]">
              {wounded.length} bed{wounded.length === 1 ? '' : 's'}
            </span>
            <span data-probe="inn-total" className="numeral text-right text-[1.15rem] text-[color:var(--color-hearth-soft)]">
              {totalHealCost}
              <span className="text-[0.72rem]">g</span>
            </span>
          </div>
        </div>
      )}

      {/* The one piece of LEATHER on this page — the page's single act. */}
      <Button
        id="inn-heal-btn"
        variant="primary"
        isDisabled={!canAffordHeal}
        onPress={onHeal}
        className="mt-7 !px-6 !py-2.5"
      >
        {wounded.length === 0
          ? 'Everyone is healthy'
          : canAffordHeal
            ? `Rest (${totalHealCost}g)`
            : `Short ${totalHealCost - gold}g`}
      </Button>
    </div>
  )
}
