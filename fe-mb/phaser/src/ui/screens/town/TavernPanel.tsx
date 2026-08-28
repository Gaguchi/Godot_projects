import React from 'react'
import { useRunStore } from '../../../state/runStore'
import { evaluatePredicate } from '../../../systems/predicates'
import { predicateStateFromRun } from '../../../state/runStore'
import { asDialogueId } from '../../../domain/ids'
import type { TownDef, TavernRecruitEntry } from '../../../domain/town'
import { Button } from '../../components'
import { recruitmentCost } from '../../../systems/recruitmentCost'
import { buildUnit } from '../../../systems/buildUnit'
import {
  BoardGlyph, ColumnHeader, EmptyState, EntryHeading, INK_RULE, QuillGlyph, SectionLabel, TankardGlyph,
  type ColumnSpec,
} from './townUi'

export interface TavernPanelProps {
  town: TownDef
}

/** The hire column: who, what they are, what they cost. */
const COLS: React.CSSProperties = { gridTemplateColumns: 'minmax(0,1fr) 5rem 5.75rem' }
const HIRE_COLS: readonly ColumnSpec[] = [
  { label: 'Sellsword' },
  { label: 'Fee', align: 'right' },
  { label: '' },
]

/** Display layer over class ids — the player never reads snake_case. */
function classDisplayName(classId: unknown): string {
  return String(classId)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function TavernPanel({ town }: TavernPanelProps): React.JSX.Element {
  const dispatchRun = useRunStore((s) => s.dispatch)
  const questStates = useRunStore((s) => s.questStates)
  const gold = useRunStore((s) => s.gold)
  const flagSnapshot = useRunStore((s) => s.flags)
  const predicateState = predicateStateFromRun(useRunStore.getState())
  const visibleQuests = town.tavernQuests.filter(
    (q) => !q.visibleIf || evaluatePredicate(q.visibleIf, predicateState),
  )
  const allRecruits = town.recruits ?? []
  const visibleRecruits = allRecruits.filter((r) => {
    if (r.visibleIf && !evaluatePredicate(r.visibleIf, predicateState)) return false
    // Recruited-already flag: tavern.recruited.<id>
    const k = `tavern.recruited.${r.id}` as never
    return !flagSnapshot[k]
  })

  const costFor = (r: TavernRecruitEntry): number =>
    r.costOverride ?? recruitmentCost(r.classId, r.level)

  const onRecruit = (r: TavernRecruitEntry): void => {
    const cost = costFor(r)
    if (gold < cost) return
    // The town entry id IS the unit id ('garrik', 'lyra') — stable, save-safe,
    // and the key sprite/portrait lookup uses (unitSprites.ts).
    const unit = buildUnit(r.classId, r.level, r.name, r.id)
    if (!unit) return
    dispatchRun({ type: 'addGold', payload: { amount: -cost } })
    dispatchRun({ type: 'recruitUnit', payload: { unit } })
    dispatchRun({ type: 'setFlag', payload: { key: `tavern.recruited.${r.id}` as never, value: true, scope: 'run' } })
  }

  return (
    <div id="tavern-panel" className="max-w-[44rem]">
      <EntryHeading title="The Drunken Boar" blurb="What the room is saying, what needs doing, and who will do it for coin." />

      {/* Rumors are quoted testimony, so they hang off a marginal rule the way
          a clerk's side-note does — prose, not a data list. */}
      <SectionLabel className="mt-5">Rumors</SectionLabel>
      <div className="mt-2 max-w-[38rem] space-y-1 pl-4" style={{ borderLeft: `1px solid ${INK_RULE}` }}>
        {town.rumors.map((r, i) => (
          <p key={i} data-probe={i === 0 ? 'rumor' : undefined} className="m-0 font-body leading-snug text-[color:var(--color-parchment-dim)]">
            <span aria-hidden className="text-[color:var(--color-text-muted)]">&ldquo;</span>
            {r}
            <span aria-hidden className="text-[color:var(--color-text-muted)]">&rdquo;</span>
          </p>
        ))}
      </div>

      <SectionLabel className="mt-5">Quest Board</SectionLabel>
      {visibleQuests.length === 0 ? (
        <EmptyState
          glyph={<QuillGlyph />}
          line="No one is asking for help today."
          hint="Work gets written up as trouble finds the town."
        />
      ) : (
        visibleQuests.map((q, i) => (
          <div
            key={q.questId}
            className="mt-2.5 pb-3"
            style={{ borderBottom: `1px solid ${INK_RULE}` }}
          >
            <div data-probe="quest-npc" className="voice-display text-[1.05rem] text-[color:var(--color-ink)]">
              {q.npcName}
            </div>
            <p data-probe="quest-desc" className="mt-1 max-w-[34rem] font-body text-[0.92rem] leading-snug text-[color:var(--color-parchment-dim)]">
              {q.npcDescription}
            </p>
            {/* One leather tab per entry; only the first is the page primary. */}
            <Button
              id={`tavern-talk-${q.questId}`}
              variant={i === 0 ? 'primary' : 'secondary'}
              onPress={() => {
                dispatchRun({
                  type: 'startDialogue',
                  payload: { dialogueId: asDialogueId(q.dialogueId), nodeId: 'start' },
                })
              }}
              className="mt-2.5 !px-4 !py-1.5 !text-[0.66rem]"
            >
              Talk to {q.npcName}
            </Button>
          </div>
        ))
      )}
      {Object.keys(questStates).length > 0 && (
        <div className="mt-2.5 text-[0.8rem] text-[color:var(--color-text-muted)]">
          Active quest: Blood Ties (in progress)
        </div>
      )}

      <SectionLabel className="mt-5">Bounty Board</SectionLabel>
      <EmptyState
        glyph={<BoardGlyph />}
        line="Nothing nailed up today — the roads must be quiet."
        hint="Bounties post as word of trouble reaches town."
      />

      <SectionLabel className="mt-5">Recruitment</SectionLabel>
      {visibleRecruits.length === 0 ? (
        <EmptyState
          glyph={<TankardGlyph />}
          line="No swords for hire tonight."
          hint="Sellswords drift in as your company's name travels."
        />
      ) : (
        <div className="max-w-[36rem]">
          <ColumnHeader cols={HIRE_COLS} style={COLS} />
          {visibleRecruits.map((r) => {
            const cost = costFor(r)
            const canAfford = gold >= cost
            return (
              <div
                key={r.id}
                id={`tavern-recruit-${r.id}`}
                className="grid items-center gap-3 py-2.5"
                style={{ ...COLS, borderBottom: `1px solid ${INK_RULE}` }}
              >
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span data-probe="recruit-name" className="voice-display text-[1rem] text-[color:var(--color-ink)]">
                      {r.name}
                    </span>
                    <span
                      data-probe="recruit-class"
                      className="text-[0.58rem] uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]"
                    >
                      {classDisplayName(r.classId)} · Lv <span className="numeral">{r.level}</span>
                    </span>
                  </div>
                  {r.description && (
                    <p data-probe="recruit-desc" className="mt-1 font-body text-[0.85rem] leading-snug text-[color:var(--color-parchment-dim)]">
                      {r.description}
                    </p>
                  )}
                </div>
                <span
                  data-probe="recruit-cost"
                  className={`numeral text-right text-[1.05rem] leading-none ${
                    canAfford ? 'text-[color:var(--color-hearth-soft)]' : 'text-[color:var(--color-damage-text)]'
                  }`}
                >
                  {cost}
                  <span className="text-[0.68rem]">g</span>
                </span>
                {/* Leather only where the hire can actually be made; an
                    unaffordable row keeps the control and the reason but
                    drops the material. */}
                <Button
                  id={`tavern-recruit-btn-${r.id}`}
                  variant={canAfford ? 'secondary' : 'ghost'}
                  isDisabled={!canAfford}
                  onPress={() => onRecruit(r)}
                  aria-label={
                    canAfford
                      ? `Hire ${r.name} for ${cost} gold`
                      : `Cannot hire ${r.name} — ${cost - gold} gold short of ${cost}`
                  }
                  className={
                    '!w-full !px-2 !py-1 !text-[0.6rem] !tracking-[0.12em] '
                    + (canAfford ? '' : '!justify-end !opacity-100 !text-[color:var(--color-text-muted)]')
                  }
                >
                  {canAfford ? 'Hire' : `Short ${cost - gold}g`}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
