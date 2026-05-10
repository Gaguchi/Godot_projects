import React, { useState } from 'react'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { CheckButton } from '../components/CheckButton'
import { CheckCandidatePicker } from '../components/CheckCandidatePicker'
import { evaluateCheck, getCheckCandidates } from '../../systems/checkResolver'
import type { CheckRequirement } from '../../domain/check'
import type { Unit } from '../../domain/unit'
import type { QuestEffect } from '../../domain/quest'

export interface CheckEventOutcome {
  narration: string
  effects: QuestEffect[]
}

export interface CheckEventChoice {
  id: string
  text: string
  check?: CheckRequirement
  onPass: CheckEventOutcome
  onFail?: CheckEventOutcome
}

export interface CheckEvent {
  id: string
  title: string
  description: string
  choices: CheckEventChoice[]
}

export interface CheckEventResolution {
  choiceId: string
  outcome: CheckEventOutcome
  attemptingUnitId: string | null
}

export interface CheckEventModalProps {
  event: CheckEvent
  party: Unit[]
  gold: number
  foodCount: number
  onResolve: (resolved: CheckEventResolution) => void
  onClose: () => void
}

/**
 * Shared event-panel modal used by Overworld (travel encounter checkEvent
 * outcome), Dungeon (event room), and BattleEnd (post-victory event).
 *
 * Two-phase UI:
 *   1. Choice list (CheckButton-prefixed); stat-check click opens picker.
 *   2. After resolution, narration replaces description; Continue dismisses
 *      via onResolve which the caller uses to apply the chosen outcome's
 *      effects.
 */
export function CheckEventModal({
  event, party, gold, foodCount, onResolve, onClose,
}: CheckEventModalProps): React.JSX.Element {
  const [pickerChoice, setPickerChoice] = useState<CheckEventChoice | null>(null)
  const [resolved, setResolved] = useState<CheckEventResolution | null>(null)

  const partyState = { gold, foodCount, party }

  const resolveChoice = (choice: CheckEventChoice, attemptingUnit: Unit | null): void => {
    if (!choice.check) {
      setResolved({ choiceId: choice.id, outcome: choice.onPass, attemptingUnitId: null })
      return
    }
    const passed = evaluateCheck(choice.check, attemptingUnit, partyState)
    const outcome = passed ? choice.onPass : (choice.onFail ?? choice.onPass)
    setResolved({
      choiceId: choice.id,
      outcome,
      attemptingUnitId: attemptingUnit ? (attemptingUnit.id as unknown as string) : null,
    })
  }

  const onChoiceClick = (choice: CheckEventChoice): void => {
    if (!choice.check) {
      resolveChoice(choice, null)
      return
    }
    if (choice.check.kind === 'stat') {
      setPickerChoice(choice)
      return
    }
    // class / gold / food: auto-resolve, no attempting unit
    resolveChoice(choice, null)
  }

  const computeCanPass = (choice: CheckEventChoice): boolean => {
    if (!choice.check) return true
    if (choice.check.kind === 'stat') {
      const candidates = getCheckCandidates(choice.check, party)
      return candidates.some((c) => c.meetsThreshold)
    }
    return evaluateCheck(choice.check, null, partyState)
  }

  return (
    <>
      <Dialog
        isOpen
        onOpenChange={(o) => { if (!o) onClose() }}
        aria-label={event.title}
      >
        <div className="max-w-lg flex flex-col gap-4">
          <h2 className="text-lg tracking-widest text-amber-200 m-0">{event.title}</h2>
          {!resolved ? (
            <>
              <p className="italic text-stone-300">{event.description}</p>
              <div className="flex flex-col gap-2">
                {event.choices.map((c) => {
                  const candidates = c.check ? getCheckCandidates(c.check, party) : []
                  return (
                    <CheckButton
                      key={c.id}
                      text={c.text}
                      requirement={c.check ?? null}
                      candidates={candidates}
                      canPass={computeCanPass(c)}
                      onPress={() => onChoiceClick(c)}
                    />
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <p className="text-amber-200">{resolved.outcome.narration}</p>
              <Button variant="primary" onPress={() => onResolve(resolved)}>Continue</Button>
            </>
          )}
        </div>
      </Dialog>

      <CheckCandidatePicker
        open={pickerChoice !== null}
        statLabel={pickerChoice?.check?.kind === 'stat' ? pickerChoice.check.stat.toUpperCase() : ''}
        threshold={pickerChoice?.check?.kind === 'stat' ? pickerChoice.check.threshold : 0}
        candidates={pickerChoice?.check ? getCheckCandidates(pickerChoice.check, party) : []}
        onPick={(c) => {
          const attempting = party.find(
            (u) => (u.id as unknown as string) === (c.unitId as unknown as string),
          ) ?? null
          if (pickerChoice) resolveChoice(pickerChoice, attempting)
          setPickerChoice(null)
        }}
        onCancel={() => setPickerChoice(null)}
      />
    </>
  )
}
