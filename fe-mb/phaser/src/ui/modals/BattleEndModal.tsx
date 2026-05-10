import React, { useEffect, useState } from 'react'
import { useCombatStore } from '../../state/combatStore'
import { useRunStore } from '../../state/runStore'
import { Dialog, Button, Heading } from '../components'
import { CheckEventModal, type CheckEvent } from './CheckEventModal'
import type { QuestEffect } from '../../domain/quest'
import interrogateSurvivor from '../../data/content/checkEvents/interrogate_survivor.json'

const CHECK_EVENTS: Record<string, CheckEvent> = {
  interrogate_survivor: interrogateSurvivor as CheckEvent,
}

/**
 * Victory / Defeat overlay shown when combatStore.state.phase becomes
 * VICTORY or DEFEAT. Subscribes to the store directly; mounted at App
 * root so it renders regardless of the active view.
 */
export interface BattleEndModalProps {
  onRestart: () => void
  onReturnToTitle: () => void
  onContinueToOverworld?: () => void
}

export function BattleEndModal({
  onRestart, onReturnToTitle, onContinueToOverworld,
}: BattleEndModalProps): React.JSX.Element {
  const phase = useCombatStore((s) => s.state.phase)
  const units = useCombatStore((s) => s.state.units)
  const dispatchRun = useRunStore((s) => s.dispatch)
  const [victoryEventResolved, setVictoryEventResolved] = useState(false)
  const [activeVictoryEvent, setActiveVictoryEvent] = useState<CheckEvent | null>(null)

  const open = phase === 'VICTORY' || phase === 'DEFEAT'
  const isVictory = phase === 'VICTORY'

  // Trigger victory check-event on first VICTORY frame. Uses the active
  // battle's source enemy group (when set on the runtime store) to look up
  // its `victoryEvent` reference.
  useEffect(() => {
    if (!isVictory || victoryEventResolved) return
    const pendingBattle = useRunStore.getState().pendingTravelPath
    void pendingBattle
    // Inspect units to find the bandit group; pull victoryEvent ref from
    // the first known group with a non-zero count of defeated members.
    // For SC-10's smoke implementation, hard-bind the bandits_small group
    // (the only authored victoryEvent). Future tasks can plumb the actual
    // active enemyGroupId through combat state.
    const anyBanditDefeated = Object.values(units).some(
      (u) => u.hp.current === 0 && (u.classId as unknown as string).includes('bandit'),
    )
    if (anyBanditDefeated) {
      const ref = 'interrogate_survivor'
      const evt = CHECK_EVENTS[ref]
      if (evt) setActiveVictoryEvent(evt)
    } else {
      setVictoryEventResolved(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Reset on phase leaving VICTORY/DEFEAT (e.g. after Continue/Restart).
  useEffect(() => {
    if (phase !== 'VICTORY' && phase !== 'DEFEAT') {
      setVictoryEventResolved(false)
      setActiveVictoryEvent(null)
    }
  }, [phase])

  const partyAlive = Object.values(units).filter(
    (u) => u.hp.current > 0 && !(u.classId as unknown as string).includes('bandit'),
  )
  const enemiesDefeated = Object.values(units).filter(
    (u) => u.hp.current <= 0 && (u.classId as unknown as string).includes('bandit'),
  ).length

  // While a victory event is active and unresolved, render only the
  // CheckEventModal. The standard BattleEnd dialog is suppressed until the
  // event resolves.
  if (isVictory && activeVictoryEvent) {
    return (
      <CheckEventModal
        event={activeVictoryEvent}
        party={Object.values(useRunStore.getState().party.units)}
        gold={useRunStore.getState().gold}
        foodCount={
          useRunStore
            .getState()
            .inventory.items.filter((i) => (i.itemId as unknown as string) === 'food_rations').length
        }
        onResolve={({ outcome }) => {
          if (outcome.effects.length > 0) {
            dispatchRun({
              type: 'applyQuestEffects',
              payload: { effects: outcome.effects as QuestEffect[] },
            })
          }
          setActiveVictoryEvent(null)
          setVictoryEventResolved(true)
        }}
        onClose={() => {
          setActiveVictoryEvent(null)
          setVictoryEventResolved(true)
        }}
      />
    )
  }

  return (
    <Dialog
      isOpen={open}
      onOpenChange={() => undefined}
      isDismissable={false}
      aria-label={isVictory ? 'Victory' : 'Defeat'}
      className={isVictory ? 'border-amber-700' : 'border-red-900'}
    >
      <div
        id={isVictory ? 'victory-modal' : 'defeat-modal'}
        className="flex flex-col gap-5 text-center min-w-[420px]"
      >
        <Heading
          level={1}
          className={
            'text-4xl tracking-[0.4em] m-0 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] ' +
            (isVictory ? 'text-amber-400' : 'text-red-600')
          }
        >
          {phase}
        </Heading>
        <div className="text-stone-500 text-sm">
          {isVictory ? `Enemies defeated: ${enemiesDefeated}` : 'Your party has fallen.'}
        </div>
        <div className="text-stone-500 text-xs mt-2">
          Survivors: {partyAlive.map((u) => u.name).join(', ') || 'None'}
        </div>
        <div className="flex gap-3 mt-4 justify-center flex-wrap">
          {isVictory && onContinueToOverworld && (
            <Button
              id="battle-end-continue"
              variant="primary"
              onPress={onContinueToOverworld}
              className="tracking-widest"
            >
              Continue
            </Button>
          )}
          <Button id="battle-end-restart" variant="secondary" onPress={onRestart} className="tracking-widest">
            Restart
          </Button>
          <Button id="battle-end-title-btn" variant="ghost" onPress={onReturnToTitle} className="tracking-widest">
            Return to Title
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
