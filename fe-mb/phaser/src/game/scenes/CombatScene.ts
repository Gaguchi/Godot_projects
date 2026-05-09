import Phaser from 'phaser'
import { useCombatStore } from '../../state/combatStore'
import { useRunStore } from '../../state/runStore'
import { CombatRuntime } from '../runtime/CombatRuntime'
import { createRng } from '../../systems/rng'
import { seedStubBattle } from './seedStubBattle'
import type { CombatEffect } from '../../domain/combatState'

export class CombatScene extends Phaser.Scene {
  private runtime!: CombatRuntime
  private unsub: (() => void) | null = null

  constructor() { super('combat') }

  create(): void {
    this.runtime = new CombatRuntime()

    // F-02: seed stub battle if combatStore hasn't started one yet.
    const cs = useCombatStore.getState()
    if (cs.state.phase === 'BOOT') {
      const runRng = useRunStore.getState().rngState
      const event = seedStubBattle(runRng)
      cs.dispatch(event, createRng(runRng))
    }

    this.add.text(20, 20, 'CombatScene — units seeded', {
      fontFamily: 'monospace', fontSize: '14px', color: '#a0a0c0',
    })

    // Draw 14x10 grid outline
    const g = this.add.graphics()
    g.lineStyle(1, 0x333344, 0.6)
    const tile = 48
    const offX = 240, offY = 120
    for (let x = 0; x <= 14; x++) g.lineBetween(offX + x * tile, offY, offX + x * tile, offY + 10 * tile)
    for (let y = 0; y <= 10; y++) g.lineBetween(offX, offY + y * tile, offX + 14 * tile, offY + y * tile)

    // Subscribe to lastEffectId changes to drain effects from the queue.
    this.unsub = useCombatStore.subscribe(
      (s) => s.lastEffectId,
      () => {
        const drained = useCombatStore.getState().drainEffects()
        for (const e of drained) this.handleEffect(e)
      }
    )
  }

  private handleEffect(e: CombatEffect): void {
    // Foundation: log only. Real animation handling lands in next milestone.
    // eslint-disable-next-line no-console
    console.debug('[CombatScene] effect:', e.kind)
  }

  shutdown(): void {
    this.runtime.reset()
    if (this.unsub) { this.unsub(); this.unsub = null }
  }
}
