import React from 'react'
import { useCombatStore } from '../../state/combatStore'
import { Dialog, Button, Heading } from '../components'

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

  const open = phase === 'VICTORY' || phase === 'DEFEAT'
  const isVictory = phase === 'VICTORY'

  const partyAlive = Object.values(units).filter(
    (u) => u.hp.current > 0 && !(u.classId as unknown as string).includes('bandit'),
  )
  const enemiesDefeated = Object.values(units).filter(
    (u) => u.hp.current <= 0 && (u.classId as unknown as string).includes('bandit'),
  ).length

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
