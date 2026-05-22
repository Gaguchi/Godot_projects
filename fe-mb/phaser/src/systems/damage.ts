import type { Unit } from '../domain/unit'

export type DamageType = 'physical' | 'magic'
export type DamageStat = 'str' | 'mag' | 'skl'

export interface ApplyDamageResult {
  newArmor: number
  newHp: number
  hpLost: number
  armorLost: number
}

/**
 * Pure armor + HP split for a POST-DR damage amount.
 *
 * Physical: armor absorbs first, overflow to HP.
 * Magic: armored half (floor amount/2) — armor absorbs, overflow to HP;
 *        piercing half (ceil amount/2) — always to HP.
 *
 * Callers (combatReducer, computeForecast) compute DR + raw damage upstream
 * and pass the already-reduced amount here.
 */
export function applyDamage(
  unit: Pick<Unit, 'hp' | 'armor'>,
  amount: number,
  damageType: DamageType,
): ApplyDamageResult {
  if (amount <= 0) {
    return { newArmor: unit.armor, newHp: unit.hp.current, hpLost: 0, armorLost: 0 }
  }
  let armorLost: number
  let hpLost: number
  if (damageType === 'magic') {
    const armoredPortion = Math.floor(amount / 2)
    const piercingPortion = Math.ceil(amount / 2)
    armorLost = Math.min(unit.armor, armoredPortion)
    const armorLeak = armoredPortion - armorLost
    hpLost = piercingPortion + armorLeak
  } else {
    armorLost = Math.min(unit.armor, amount)
    hpLost = amount - armorLost
  }
  return {
    newArmor: unit.armor - armorLost,
    newHp: Math.max(0, unit.hp.current - hpLost),
    hpLost: Math.min(hpLost, unit.hp.current),
    armorLost,
  }
}

// ---------- Forecast ----------

export interface ForecastCardEffectParam { base?: number; amount?: number; damageType?: 'physical' | 'magic' }
export interface ForecastCardEffect { kind: string; params: ForecastCardEffectParam }
export interface ForecastCard {
  id: string
  name?: string
  apCost: number
  damageStat?: DamageStat
  effects: ForecastCardEffect[]
}

export interface ForecastResult {
  damageType: DamageType
  damageBefore: number        // amount after DR, pre-armor (what applyDamage consumes)
  hpLost: number
  armorLost: number
  predictedHp: number
  predictedArmor: number
  lethal: boolean
  heal: number                // 0 if not a heal card
  baseTerm: number            // card base
  statName: DamageStat | null
  statTerm: number            // source.stats[statName] or 0
  drTerm: number              // floor(def or res / 2) + terrainDr
  terrainDr: number
}

const ZERO: Omit<ForecastResult, 'damageType'> = {
  damageBefore: 0, hpLost: 0, armorLost: 0,
  predictedHp: 0, predictedArmor: 0,
  lethal: false, heal: 0,
  baseTerm: 0, statName: null, statTerm: 0,
  drTerm: 0, terrainDr: 0,
}

/**
 * Single truth source: both the reducer Damage path AND the UI forecast hook
 * compute consequences via this function so previewed numbers === applied
 * numbers (anti-drift guarantee).
 *
 * Returns null when the card has no Damage or Heal effect (utility cards).
 */
export function computeForecast(
  card: ForecastCard,
  source: Pick<Unit, 'stats'>,
  target: Pick<Unit, 'hp' | 'armor' | 'stats'>,
  terrainDr: number,
): ForecastResult | null {
  // Pick first Damage effect; else first Heal effect; else null.
  const damageEff = card.effects.find((e) => e.kind === 'Damage')
  const healEff = card.effects.find((e) => e.kind === 'Heal')

  if (damageEff) {
    const base = damageEff.params.base ?? 0
    const damageType: DamageType = damageEff.params.damageType === 'magic' ? 'magic' : 'physical'
    const stat = card.damageStat ?? null
    let statBonus = 0
    if (stat === 'str') statBonus = source.stats.str
    else if (stat === 'mag') statBonus = source.stats.mag
    else if (stat === 'skl') statBonus = source.stats.skl
    const defDr = damageType === 'magic'
      ? Math.floor(target.stats.res / 2)
      : Math.floor(target.stats.def / 2)
    const drTerm = defDr + terrainDr
    const raw = base + statBonus
    const afterDr = Math.max(0, raw - drTerm)
    const split = applyDamage(target, afterDr, damageType)
    const predictedHp = split.newHp
    return {
      ...ZERO,
      damageType,
      damageBefore: afterDr,
      hpLost: split.hpLost,
      armorLost: split.armorLost,
      predictedHp,
      predictedArmor: split.newArmor,
      lethal: predictedHp === 0 && afterDr > 0,
      baseTerm: base,
      statName: stat,
      statTerm: statBonus,
      drTerm,
      terrainDr,
    }
  }

  if (healEff) {
    const amount = healEff.params.amount ?? 0
    const predictedHp = Math.min(target.hp.max, target.hp.current + amount)
    const heal = predictedHp - target.hp.current
    return {
      ...ZERO,
      damageType: 'physical',
      heal,
      predictedHp,
      predictedArmor: target.armor,
    }
  }

  return null
}
