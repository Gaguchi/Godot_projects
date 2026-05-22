import { describe, it, expect } from 'vitest'
import { reduce, initialCombatState } from '../../../src/systems/combatReducer'
import { computeForecast } from '../../../src/systems/damage'
import { createRng } from '../../../src/systems/rng'
import { asUnitId, asClassId, asTileId } from '../../../src/domain/ids'
import type { Unit } from '../../../src/domain/unit'

/**
 * Anti-drift guarantee (CHF-1 spec): whatever the forecast panel shows for a
 * given card × source × target MUST equal the post-state after the reducer
 * actually applies the damage. Both call computeForecast/applyDamage
 * internally — this test locks that contract.
 */

const mk = (id: string, classId: string, hp: number, armor: number, def = 4, res = 4, str = 5, mag = 5): Unit => ({
  id: asUnitId(id),
  name: id,
  classId: asClassId(classId),
  level: 1,
  hp: { current: hp, max: hp },
  stats: { str, mag, skl: 4, spd: 5, def, res, lck: 0 },
  position: id === 'src' ? ('1,4' as never) : ('2,4' as never),
  ap: 3,
  armor,
  statuses: [],
})

import type { ForecastCard } from '../../../src/systems/damage'

const physicalCard: ForecastCard = {
  id: 'iron_thrust',
  apCost: 1,
  damageStat: 'str',
  effects: [{ kind: 'Damage', params: { base: 8 } }],
}

const magicCard: ForecastCard = {
  id: 'arcane_bolt',
  apCost: 1,
  damageStat: 'mag',
  effects: [{ kind: 'Damage', params: { base: 6, damageType: 'magic' } }],
}

interface Scenario { src: Unit; tgt: Unit; card: ForecastCard }

const cases: Array<[string, Scenario]> = [
  ['physical no armor', { src: mk('src', 'lord', 20, 0), tgt: mk('tgt', 'bandit', 20, 0), card: physicalCard }],
  ['physical absorbed', { src: mk('src', 'lord', 20, 0), tgt: mk('tgt', 'bandit', 20, 20), card: physicalCard }],
  ['physical overflow', { src: mk('src', 'lord', 20, 0), tgt: mk('tgt', 'bandit', 20, 3), card: physicalCard }],
  ['physical lethal',   { src: mk('src', 'lord', 20, 0), tgt: mk('tgt', 'bandit', 5, 0), card: physicalCard }],
  ['magic no armor',    { src: mk('src', 'lord', 20, 0), tgt: mk('tgt', 'bandit', 20, 0), card: magicCard }],
  ['magic half-pierce', { src: mk('src', 'lord', 20, 0), tgt: mk('tgt', 'bandit', 20, 10), card: magicCard }],
  ['magic low armor',   { src: mk('src', 'lord', 20, 0), tgt: mk('tgt', 'bandit', 20, 2), card: magicCard }],
]

describe('forecast === applied (anti-drift)', () => {
  cases.forEach(([label, { src, tgt, card }]) => {
    it(label, () => {
      const forecast = computeForecast(card, src, tgt, 0)!
      expect(forecast).not.toBeNull()

      const rng = createRng({ seed: 0, counter: 0 })
      const startState = reduce(initialCombatState(), {
        type: 'startBattle',
        payload: {
          units: [src, tgt],
          grid: { width: 14, height: 10, obstacles: new Set() },
          rngSeed: { seed: 0, counter: 0 },
          decks: {
            src: { draw: [], hand: [card.id as never], discard: [] },
            tgt: { draw: [], hand: [], discard: [] },
          },
        },
      }, rng).state

      const after = reduce(startState, {
        type: 'playCard',
        payload: {
          cardId: card.id as never,
          srcId: src.id,
          targets: [asTileId('2,4')],
          card: {
            apCost: card.apCost,
            ...(card.damageStat ? { damageStat: card.damageStat } : {}),
            effects: card.effects.map((e) => ({ kind: e.kind, params: e.params as Record<string, unknown> })),
          },
        },
      }, rng).state

      const appliedTarget = after.units['tgt']!
      expect(appliedTarget.hp.current).toBe(forecast.predictedHp)
      expect(appliedTarget.armor).toBe(forecast.predictedArmor)
    })
  })
})
