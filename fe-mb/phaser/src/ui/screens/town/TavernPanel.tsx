import React from 'react'
import { useRunStore } from '../../../state/runStore'
import { evaluatePredicate } from '../../../systems/predicates'
import { predicateStateFromRun } from '../../../state/runStore'
import { asDialogueId } from '../../../domain/ids'
import type { TownDef, TavernRecruitEntry } from '../../../domain/town'
import { Button, Heading } from '../../components'
import { recruitmentCost } from '../../../systems/recruitmentCost'
import { buildUnit } from '../../../systems/buildUnit'

export interface TavernPanelProps {
  town: TownDef
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
    const unit = buildUnit(r.classId, r.level, r.name, `recruit_${r.id}`)
    if (!unit) return
    dispatchRun({ type: 'addGold', payload: { amount: -cost } })
    dispatchRun({ type: 'recruitUnit', payload: { unit } })
    dispatchRun({ type: 'setFlag', payload: { key: `tavern.recruited.${r.id}` as never, value: true, scope: 'run' } })
  }

  return (
    <div id="tavern-panel">
      <Heading level={1} className="text-2xl tracking-widest m-0">The Drunken Boar</Heading>
      <p className="text-stone-500 mt-2">Rumors, quests, and bounties.</p>

      <h3 className="mt-6 text-sm tracking-widest text-amber-200">RUMORS</h3>
      <ul className="text-stone-500 leading-relaxed list-disc pl-5">
        {town.rumors.map((r, i) => (
          <li key={i}>"{r}"</li>
        ))}
      </ul>

      <h3 className="mt-6 text-sm tracking-widest text-amber-200">QUEST BOARD</h3>
      {visibleQuests.length === 0 ? (
        <div className="mt-3 text-stone-500">No quests on the board today.</div>
      ) : (
        visibleQuests.map((q) => (
          <div key={q.questId} className="p-4 border border-stone-800 mt-3">
            <strong>{q.npcName}</strong>
            <p className="text-xs text-stone-500 mt-1">{q.npcDescription}</p>
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
        <div className="mt-3 text-stone-500">
          Active quest: Blood Ties (in progress)
        </div>
      )}
      <h3 className="mt-6 text-sm tracking-widest text-amber-200">BOUNTY BOARD</h3>
      <div className="text-stone-500 italic">The board is empty today.</div>

      <h3 className="mt-6 text-sm tracking-widest text-amber-200">RECRUITMENT</h3>
      {visibleRecruits.length === 0 ? (
        <div className="text-stone-500 italic">No recruits today.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 mt-2">
          {visibleRecruits.map((r) => {
            const cost = costFor(r)
            const canAfford = gold >= cost
            return (
              <div
                key={r.id}
                id={`tavern-recruit-${r.id}`}
                className="p-3 border border-stone-800 flex justify-between items-center"
              >
                <div>
                  <strong>{r.name}</strong>
                  <span className="ml-2 text-[10px] text-stone-500">{r.classId} · L{r.level}</span>
                  {r.description && (
                    <p className="text-xs text-stone-500 mt-1">{r.description}</p>
                  )}
                </div>
                <Button
                  id={`tavern-recruit-btn-${r.id}`}
                  variant="primary"
                  isDisabled={!canAfford}
                  onPress={() => onRecruit(r)}
                  className="!text-xs"
                >
                  {canAfford ? `Hire ${cost}g` : `Need ${cost}g`}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
