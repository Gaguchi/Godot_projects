/**
 * tests/unit/ui/combat-face.test.ts — the two surfaces that quote a damage number to the player before he commits:
 * the CARD FACE (what he chooses from) and the PLAY PANEL (what he confirms from). Both are pinned to the engine's
 * own arithmetic here, because the gate found the face quoting the authored base — "Fire · 4" on a mage who deals
 * 10 with it — and the panel leading with `8 + mag 7 − DR 1 = 14`, a formula in raw stat keys above the only line
 * anybody reads.
 *
 * The face cannot know the TARGET's defense (that belongs to whoever is standing there), so the contract is:
 *   face  === forecast.baseTerm + statTerm + empowerTerm + quiverTerm     (the blow this unit throws)
 *   panel === that, less the target's own reduction                       (the blow that lands)
 * If those two ever drift, one of these cases fails.
 */
import { describe, expect, it } from 'vitest'
import { forecast } from '../../../src/engine/combat/damage'
import type { ActiveStatus, CombatState } from '../../../src/engine/types'
import { cardFace, cardIntentLines, cardPower } from '../../../src/ui/combat/CardHand'
import { outcomeWords, reckoningWords } from '../../../src/ui/combat/Hud'
import { duel, env, patchUnit, unit, withHand } from '../../helpers/battles'

const e = env()
const BLAZE = e.content.cards['fire_tome_blaze']!
const AUTHORED_BASE = 8

const empower = (stacks: number): ActiveStatus =>
  ({ id: 'empower', stacks, turns: 1, expiresAt: e.rules.combat.statuses.empower.expiresAt, sourceId: null })

/** The foundling with a mage's MAG and Blaze in hand, one tile from a bandit with no armor. */
function board(opts: { readonly mag?: number; readonly empowered?: number; readonly enemyRes?: number } = {}): CombatState {
  const st = duel({ banditAt: [3, 4], bandit: { stats: { res: opts.enemyRes ?? 0 } } })
  const withMag = patchUnit(st, 'mc', {
    stats: { ...unit(st, 'mc').stats, mag: opts.mag ?? 7 },
    ...(opts.empowered === undefined ? {} : { statuses: [empower(opts.empowered)] }),
  })
  return withHand(withMag, 'mc', ['fire_tome_blaze'])
}

describe('the card face is what the card DOES, not what it was authored with', () => {
  it('folds the damage stat into the number the player picks from', () => {
    const st = board({ mag: 7 })
    expect(cardFace(BLAZE, unit(st, 'mc'), null).number).toBe('15')
    expect(Number(cardFace(BLAZE, unit(st, 'mc'), null).number)).toBeGreaterThan(AUTHORED_BASE)
  })

  it('is exactly the forecast’s own power — the face and the panel cannot drift', () => {
    const st = board({ mag: 7 })
    const f = forecast(st, 'mc', { card: BLAZE, mod: null }, 'bandit', e)!
    const face = Number(cardFace(BLAZE, unit(st, 'mc'), null).number)
    expect(face).toBe(f.baseTerm + f.statTerm + f.empowerTerm + f.quiverTerm)
    // and what LANDS is that face less the target's own reduction — nothing else enters the sum
    expect(f.afterDr + f.quiverTerm).toBe(face - f.drTerm)
  })

  it('carries empower and the instance’s quiver, because the blow carries them', () => {
    const st = board({ mag: 7, empowered: 3 })
    expect(cardFace(BLAZE, unit(st, 'mc'), null).number).toBe('18')
    expect(cardPower(AUTHORED_BASE, BLAZE, unit(st, 'mc'), { kind: 'thunder', value: 2, turns: 0 })).toBe(20)
    // a status quiver adds a rider, never a number
    expect(cardPower(AUTHORED_BASE, BLAZE, unit(st, 'mc'), { kind: 'poison', value: 2, turns: 3 })).toBe(18)
  })

  it('falls back to the authored base only when there is no unit to hold the card', () => {
    expect(cardFace(BLAZE).number).toBe(String(AUTHORED_BASE))
    expect(cardPower(AUTHORED_BASE, BLAZE, null, null)).toBe(AUTHORED_BASE)
  })

  it('says the same number in words when the panel has no maths to run', () => {
    const st = board({ mag: 7 })
    expect(cardIntentLines(BLAZE, unit(st, 'mc'), null)[0]).toMatch(/^15 magic damage/)
    expect(cardIntentLines(BLAZE)[0]).toMatch(/^8 magic damage/)
  })
})

describe('the play panel leads with the outcome and keeps the maths under it', () => {
  it('the outcome line is what CHANGES, in the player’s terms', () => {
    const st = board({ mag: 7 })
    const f = forecast(st, 'mc', { card: BLAZE, mod: null }, 'bandit', e)!
    expect(outcomeWords(f)).toBe(`−${f.hpLost} HP`)
    expect(outcomeWords({ ...f, hpLost: 10, armorLost: 4, predictedArmor: 0 })).toBe('−10 HP · −4 armor')
    expect(outcomeWords({ ...f, hpLost: 0, armorLost: 0, heal: 6, predictedArmor: 0 })).toBe('+6 HP')
    expect(outcomeWords({ ...f, hpLost: 0, armorLost: 0, heal: 0, predictedArmor: 0 })).toBe('Nothing changes')
  })

  it('a ward that only grants armor still announces what it did', () => {
    const st = board({ mag: 7 })
    const f = forecast(st, 'mc', { card: BLAZE, mod: null }, 'bandit', e)!
    // `predictedArmor` is the only place a granted ward lands — an outcome line blind to it reads "Nothing changes"
    expect(outcomeWords({ ...f, hpLost: 0, armorLost: 0, heal: 0, predictedArmor: 6 }, 0)).toBe('+6 armor')
    expect(outcomeWords({ ...f, hpLost: 0, armorLost: 0, heal: 0, predictedArmor: 6 }, 6)).toBe('Nothing changes')
  })

  it('the reckoning names every term in a word — no stat key, no equals sign, no "DR"', () => {
    const st = board({ mag: 7, empowered: 2, enemyRes: 4 })
    const f = forecast(st, 'mc', { card: BLAZE, mod: null }, 'bandit', e)!
    const line = reckoningWords(f)
    expect(line).toContain('8 base')
    expect(line).toContain('+7 magic')
    expect(line).toContain('+2 empower')
    expect(line).toContain('−2 resistance')
    expect(line).not.toMatch(/\bmag\b|\bstr\b|\bskl\b|\bDR\b|=/)
  })

  it('names a physical reduction as defense and a magical one as resistance', () => {
    const st = board({ mag: 7, enemyRes: 4 })
    const f = forecast(st, 'mc', { card: BLAZE, mod: null }, 'bandit', e)!
    expect(reckoningWords(f)).toContain('resistance')
    expect(reckoningWords({ ...f, damageType: 'physical', statName: 'str' })).toContain('defense')
    expect(reckoningWords({ ...f, damageType: 'physical', statName: 'str' })).toContain('strength')
  })
})
