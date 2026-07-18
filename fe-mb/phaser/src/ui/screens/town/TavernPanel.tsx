import React from 'react'
import { useRunStore } from '../../../state/runStore'
import { evaluatePredicate } from '../../../systems/predicates'
import { predicateStateFromRun } from '../../../state/runStore'
import { asDialogueId } from '../../../domain/ids'
import type { TownDef, TavernRecruitEntry } from '../../../domain/town'
import { Button, Heading } from '../../components'
import { recruitmentCost } from '../../../systems/recruitmentCost'
import { buildUnit } from '../../../systems/buildUnit'
import { BoardGlyph, EmptyState, SectionLabel, TankardGlyph } from './townUi'

export interface TavernPanelProps {
  town: TownDef
}

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
    <div id="tavern-panel">
      <Heading level={1} className="text-2xl tracking-widest m-0">The Drunken Boar</Heading>
      <p className="mt-2 text-[color:var(--color-text-muted)]">Rumors, quests, and bounties.</p>

      <SectionLabel className="mt-6">Rumors</SectionLabel>
      <div className="mt-3 max-w-xl space-y-2.5">
        {town.rumors.map((r, i) => (
          <p key={i} className="m-0 font-body leading-relaxed text-[color:var(--color-parchment-dim)]">
            <span className="opacity-60">&ldquo;</span>
            {r}
            <span className="opacity-60">&rdquo;</span>
          </p>
        ))}
      </div>

      <SectionLabel>Quest Board</SectionLabel>
      {visibleQuests.length === 0 ? (
        <div className="mt-3 text-[color:var(--color-text-muted)]">No one is asking for help today.</div>
      ) : (
        visibleQuests.map((q) => (
          <div key={q.questId} className="surface-iron mt-3 max-w-xl rounded-[var(--radius-md)] p-4">
            <div className="font-body text-[1.05rem] text-parchment">{q.npcName}</div>
            <p className="mt-1 text-sm leading-snug text-[color:var(--color-text-muted)]">{q.npcDescription}</p>
            <Button
              id={`tavern-talk-${q.questId}`}
              variant="primary"
              onPress={() => {
                dispatchRun({
                  type: 'startDialogue',
                  payload: { dialogueId: asDialogueId(q.dialogueId), nodeId: 'start' },
                })
              }}
              className="mt-3 !text-xs"
            >
              Talk to {q.npcName}
            </Button>
          </div>
        ))
      )}
      {Object.keys(questStates).length > 0 && (
        <div className="mt-3 text-sm text-[color:var(--color-text-muted)]">
          Active quest: Blood Ties (in progress)
        </div>
      )}

      <SectionLabel>Bounty Board</SectionLabel>
      <EmptyState
        glyph={<BoardGlyph />}
        line="Nothing nailed up today — the roads must be quiet."
        hint="Bounties post as word of trouble reaches town."
      />

      <SectionLabel>Recruitment</SectionLabel>
      {visibleRecruits.length === 0 ? (
        <EmptyState
          glyph={<TankardGlyph />}
          line="No swords for hire tonight."
          hint="Sellswords drift in as your company's name travels."
        />
      ) : (
        <div className="mt-3 grid max-w-xl grid-cols-1 gap-3">
          {visibleRecruits.map((r) => {
            const cost = costFor(r)
            const canAfford = gold >= cost
            return (
              <div
                key={r.id}
                id={`tavern-recruit-${r.id}`}
                className="surface-iron flex items-center justify-between gap-3 rounded-[var(--radius-md)] p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-body text-[0.95rem] text-parchment">{r.name}</span>
                    <span className="text-[0.62rem] uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
                      {classDisplayName(r.classId)} · Lv <span className="numeral">{r.level}</span>
                    </span>
                  </div>
                  {r.description && (
                    <p className="mt-1 text-xs leading-snug text-[color:var(--color-text-muted)]">{r.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span
                    className={`numeral text-lg leading-none ${
                      canAfford ? 'text-[color:var(--color-hearth-soft)]' : 'text-[color:var(--color-damage-text)]'
                    }`}
                  >
                    {cost}
                    <span className="text-[0.7rem] opacity-80">g</span>
                  </span>
                  <Button
                    id={`tavern-recruit-btn-${r.id}`}
                    variant="primary"
                    isDisabled={!canAfford}
                    onPress={() => onRecruit(r)}
                    className="!px-3 !py-1 !text-[0.65rem]"
                  >
                    {canAfford ? 'Hire' : `Need ${cost}g`}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
