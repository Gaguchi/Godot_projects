/**
 * combat/damage.ts — one formula, one split, one cover step (brief §2.2, §2.16).
 * Forecast == applied: `dealDamage` calls `damageReduction` + `splitDamage`; the HUD calls `forecast`, which
 * calls `rawDamage` (the same reduction) + `splitDamage`; the enemy AI's expected-damage scorer calls `forecast` too.
 *
 * Two hit shapes exist and both are here so the forecast can mirror them exactly:
 *  - an ATTACK hit (`dealDamage`): base + STAT + empower, cover redirect, DR of the final target, then the split;
 *  - a FLAT hit (`dealFlatDamage`): DOT ticks and quiver riders — no cover, no stat, no DR, only the split
 *    (brief §2.4 "X dmg", §2.7 "+3 armor-ignoring"; the shipped `tickUnitStatuses` never subtracted DEF/RES).
 */
import type { SliceResult } from '../actions'
import type { CardEffect, CombatGrid, CombatState, CombatUnit, DamageStat, DamageType, EffectTarget, EngineEnv, Forecast, Hp, UnitId } from '../types'
import type { Effect, UnitHitCause } from '../effects'
import type { PlaySpec } from './cards'
import { recordCover, resolveCoverTarget } from './cover'
import { quiverEffects } from './deck'
import { isLiving, manhattan } from './grid'
import { withUnit } from './state'
import { empowerBonus, riposteStacks } from './statuses'

/** DR = floor(DEF|RES / drDivisor) + terrain bonus (only when the knob is on). `dr` is the total; `terrainDr` the terrain part. */
export function damageReduction(target: CombatUnit, type: DamageType, grid: CombatGrid, env: EngineEnv): { readonly dr: number; readonly terrainDr: number } {
  const stat = type === 'magic' ? target.stats.res : target.stats.def
  const base = Math.floor(stat / env.rules.combat.drDivisor)
  let terrainDr = 0
  if (env.rules.knobs.terrain === 'on' && grid.terrain !== null && target.position !== null) {
    const kind = grid.terrain[target.position]
    if (kind !== undefined) {
      const rule = env.rules.combat.terrain[kind]
      terrainDr = type === 'magic' ? rule.resBonus : rule.defBonus
    }
  }
  return { dr: base + terrainDr, terrainDr }
}

/** The DR-independent half of an attack hit: base + STAT + empower. `applyEffect` sends `total` to `dealDamage`
 *  (which subtracts the FINAL target's DR) and `rawDamage` subtracts it here — one sum, two callers, no drift. */
export function attackPower(base: number, stat: DamageStat | null, source: CombatUnit): { readonly statTerm: number; readonly empowerTerm: number; readonly total: number } {
  const statTerm = stat === null ? 0 : source.stats[stat]
  const empowerTerm = empowerBonus(source)
  return { statTerm, empowerTerm, total: base + statTerm + empowerTerm }
}

/** base + STAT + empower − DR, min `rules.combat.minDamage`, with the breakdown terms the HUD renders. */
export function rawDamage(
  base: number,
  stat: DamageStat | null,
  source: CombatUnit,
  target: CombatUnit,
  type: DamageType,
  grid: CombatGrid,
  env: EngineEnv,
): Pick<Forecast, 'damageType' | 'baseTerm' | 'statName' | 'statTerm' | 'empowerTerm' | 'drTerm' | 'terrainDr' | 'afterDr'> {
  const power = attackPower(base, stat, source)
  const { dr, terrainDr } = damageReduction(target, type, grid, env)
  return {
    damageType: type,
    baseTerm: base,
    statName: stat,
    statTerm: power.statTerm,
    empowerTerm: power.empowerTerm,
    drTerm: dr - terrainDr,
    terrainDr,
    afterDr: Math.max(env.rules.combat.minDamage, power.total - dr),
  }
}

/** Physical: armor absorbs first, overflow to HP. Magic: floor(amount/2) hits armor (leak to HP), ceil(amount/2) pierces.
 *  `armorPiercing` (poison, thunder quiver, ghost_shot) skips armor entirely. hpLost clamped to current HP; amount ≤ 0 is a no-op. */
export function splitDamage(hp: Hp, armor: number, amount: number, type: DamageType, armorPiercing: boolean): { readonly hpLost: number; readonly armorLost: number; readonly newHp: number; readonly newArmor: number } {
  if (amount <= 0) return { hpLost: 0, armorLost: 0, newHp: hp.current, newArmor: armor }
  let armorLost = 0
  let toHp = amount
  if (armorPiercing) {
    toHp = amount
  } else if (type === 'magic') {
    const armored = Math.floor(amount / 2)
    const piercing = Math.ceil(amount / 2)
    armorLost = Math.min(armor, armored)
    toHp = piercing + (armored - armorLost)
  } else {
    armorLost = Math.min(armor, amount)
    toHp = amount - armorLost
  }
  const hpLost = Math.min(toHp, hp.current)
  return { hpLost, armorLost, newHp: hp.current - hpLost, newArmor: armor - armorLost }
}

type DamageEffect = Extract<CardEffect, { kind: 'Damage' }>
type HealEffect = Extract<CardEffect, { kind: 'Heal' }>
type StatusEffect = Extract<CardEffect, { kind: 'ApplyStatus' }>

/**
 * What `resolvePlay` will do to `targetId` (CONTRACT-CHANGES 0011): takes the play's `card` AND `mod` so the quiver
 * terms are in the number — `quiverTerm` (thunder, armor-piercing) and `riders` (the card's ApplyStatus effects
 * aimed at this target + quiver poison/slow). Calls `resolveCoverTarget` FIRST; DR uses the protector's DEF/RES when
 * redirected. null for plays with no Damage/Heal on this target. Party cards pass the hand instance's `mod`;
 * enemies and potions pass `mod: null`.
 *
 * The forecast is asked about the unit ON the chosen tile, so a selector "lands" on it exactly when `recipients`
 * would include it with that tile as centre: `target` always, `area` when it is a foe, `ally` when a friend,
 * `self` when it is the attacker, `ring` never (the centre is excluded by definition).
 */
export function forecast(state: CombatState, attackerId: UnitId, play: Pick<PlaySpec, 'card' | 'mod'>, targetId: UnitId, env: EngineEnv): Forecast | null {
  const attacker = state.units[attackerId]
  const target = state.units[targetId]
  if (attacker === undefined || target === undefined || !isLiving(target)) return null
  const { card, mod } = play
  const foe = attacker.team !== target.team
  const lands = (selector: EffectTarget): boolean => {
    switch (selector) {
      case 'self': return targetId === attackerId
      case 'target': return true
      case 'area': return foe
      case 'ally': return !foe
      case 'ring': return false
    }
  }
  const damages = card.effects.filter((e): e is DamageEffect => e.kind === 'Damage' && lands(e.target))
  const heals = card.effects.filter((e): e is HealEffect => e.kind === 'Heal' && lands(e.target))
  const riders = card.effects
    .filter((e): e is StatusEffect => e.kind === 'ApplyStatus' && lands(e.target))
    .map((e) => ({ status: e.effectId, stacks: e.value, turns: e.turns }))
  let quiverTerm = 0
  if (mod !== null && damages.length > 0 && foe) {
    for (const q of quiverEffects(mod)) {
      if (q.target !== 'target') continue
      if (q.kind === 'ApplyStatus') riders.push({ status: q.effectId, stacks: q.value, turns: q.turns })
      else if (q.kind === 'Damage') quiverTerm += q.base
    }
  }
  const grants = card.effects.filter((e): e is Extract<CardEffect, { kind: 'GrantArmor' }> => e.kind === 'GrantArmor' && lands(e.target))
  if (damages.length === 0 && heals.length === 0 && grants.length === 0) return null

  let finalId = targetId
  let redirectedTo: UnitId | null = null
  if (damages.length > 0) {
    const cover = resolveCoverTarget(state, attackerId, targetId, env)
    if (cover.protectorId !== null) {
      finalId = cover.targetId
      redirectedTo = cover.protectorId
    }
  }
  const final = state.units[finalId] ?? target
  let hp = final.hp.current
  let armor = final.armor
  let hpLost = 0
  let armorLost = 0
  let afterDr = 0
  let first: ReturnType<typeof rawDamage> | null = null
  for (const d of damages) {
    const raw = rawDamage(d.base, card.damageStat ?? null, attacker, final, d.damageType, state.grid, env)
    first ??= raw
    const split = splitDamage({ current: hp, max: final.hp.max }, armor, raw.afterDr, d.damageType, d.armorPiercing === true)
    hp = split.newHp
    armor = split.newArmor
    hpLost += split.hpLost
    armorLost += split.armorLost
    afterDr += raw.afterDr
  }
  if (quiverTerm > 0) {
    const flat = splitDamage({ current: hp, max: final.hp.max }, armor, quiverTerm, 'physical', true)
    hp = flat.newHp
    hpLost += flat.hpLost
  }
  let heal = 0
  for (const h of heals) {
    const gained = Math.min(final.hp.max - hp, h.amount)
    hp += gained
    heal += gained
  }
  // Armor riders land after damage and heals (resolvePlay order); the knob's cap applies exactly as in `grantArmor`.
  for (const g of grants) armor = grantArmor({ ...final, armor }, g.amount, env).unit.armor
  return {
    damageType: first?.damageType ?? 'physical',
    baseTerm: first?.baseTerm ?? 0,
    statName: first?.statName ?? null,
    statTerm: first?.statTerm ?? 0,
    empowerTerm: first?.empowerTerm ?? 0,
    quiverTerm,
    drTerm: first?.drTerm ?? 0,
    terrainDr: first?.terrainDr ?? 0,
    afterDr,
    hpLost,
    armorLost,
    predictedHp: hp,
    predictedArmor: armor,
    lethal: hp === 0,
    heal,
    redirectedTo,
    riders,
  }
}

function deathCause(cause: UnitHitCause): 'damage' | 'dot' | 'riposte' {
  if (cause === 'poison' || cause === 'burn') return 'dot'
  if (cause === 'riposte') return 'riposte'
  return 'damage'
}

/** The post-DR half shared by attack and flat hits: split → riposte → death. */
function applyHit(
  state: CombatState,
  attackerId: UnitId | null,
  targetId: UnitId,
  afterDr: number,
  type: DamageType,
  armorPiercing: boolean,
  cause: UnitHitCause,
  redirectedFrom: UnitId | null,
): SliceResult<CombatState> {
  const target = state.units[targetId]
  if (target === undefined || target.position === null || !isLiving(target)) return { state, effects: [] }
  const tile = target.position
  const split = splitDamage(target.hp, target.armor, afterDr, type, armorPiercing)
  const lethal = split.newHp === 0
  const hitUnit: CombatUnit = {
    ...target,
    hp: { ...target.hp, current: split.newHp },
    armor: split.newArmor,
    ...(lethal ? { position: null, lastTile: tile } : {}),
  }
  let st = withUnit(state, hitUnit)
  const effects: Effect[] = [
    { kind: 'unitHit', unitId: targetId, tile, sourceId: attackerId, hpLost: split.hpLost, armorLost: split.armorLost, damageType: type, lethal, redirectedFrom, cause },
  ]
  if (split.hpLost + split.armorLost > 0) effects.push({ kind: 'sound', cue: type === 'magic' ? 'hitMagic' : 'hitPhysical' })
  if (lethal) effects.push({ kind: 'unitDied', unitId: targetId, tile, team: target.team, cause: deathCause(cause) }, { kind: 'sound', cue: 'death' })

  // Riposte (§2.2): a foe with riposte that takes physical damage > 0 from an orthogonally adjacent attacker deals
  // its stacks straight back to HP — armor ignored, never consumed. The stance answers even a killing blow.
  if (attackerId !== null && type === 'physical' && afterDr > 0 && cause !== 'riposte') {
    const stacks = riposteStacks(target)
    const attacker = st.units[attackerId]
    if (
      stacks > 0 &&
      attacker !== undefined &&
      attacker.team !== target.team &&
      attacker.position !== null &&
      isLiving(attacker) &&
      manhattan(attacker.position, tile) === 1
    ) {
      const attackerTile = attacker.position
      const back = splitDamage(attacker.hp, attacker.armor, stacks, 'physical', true)
      const attackerLethal = back.newHp === 0
      st = withUnit(st, {
        ...attacker,
        hp: { ...attacker.hp, current: back.newHp },
        ...(attackerLethal ? { position: null, lastTile: attackerTile } : {}),
      })
      effects.push(
        { kind: 'riposte', fromId: targetId, toId: attackerId, amount: back.hpLost },
        { kind: 'unitHit', unitId: attackerId, tile: attackerTile, sourceId: targetId, hpLost: back.hpLost, armorLost: 0, damageType: 'physical', lethal: attackerLethal, redirectedFrom: null, cause: 'riposte' },
      )
      if (attackerLethal) effects.push({ kind: 'unitDied', unitId: attackerId, tile: attackerTile, team: attacker.team, cause: 'riposte' }, { kind: 'sound', cue: 'death' })
    }
  }
  return { state: st, effects }
}

/**
 * Applies an ATTACK hit from `attackerId` to `targetId`: cover redirect (when `opts.cover`) → DR of the FINAL target
 * → split → riposte back at an orthogonally adjacent physical attacker (stacks straight to HP, not consumed) → death
 * (position null, `lastTile` set, `unitDied { tile }`). Emits `unitHit` with the FINAL target's `tile` and `redirectedFrom`.
 * `amount` is the pre-DR power (`attackPower().total`). DOT ticks and quiver riders use `dealFlatDamage` instead.
 */
export function dealDamage(
  state: CombatState,
  attackerId: UnitId | null,
  targetId: UnitId,
  amount: number,
  type: DamageType,
  opts: { readonly armorPiercing: boolean; readonly cause: UnitHitCause; readonly cover: boolean },
  env: EngineEnv,
): SliceResult<CombatState> {
  const target = state.units[targetId]
  if (target === undefined || !isLiving(target)) return { state, effects: [] }
  let st = state
  const effects: Effect[] = []
  let finalId = targetId
  let redirectedFrom: UnitId | null = null
  if (opts.cover && attackerId !== null) {
    const cover = resolveCoverTarget(st, attackerId, targetId, env)
    if (cover.protectorId !== null) {
      finalId = cover.targetId
      redirectedFrom = targetId
      st = recordCover(st, cover.protectorId, targetId)
      effects.push({ kind: 'covered', protectorId: cover.protectorId, protecteeId: targetId })
    }
  }
  const final = st.units[finalId] ?? target
  const { dr } = damageReduction(final, type, st.grid, env)
  const afterDr = Math.max(env.rules.combat.minDamage, amount - dr)
  const hit = applyHit(st, attackerId, finalId, afterDr, type, opts.armorPiercing, opts.cause, redirectedFrom)
  return { state: hit.state, effects: [...effects, ...hit.effects] }
}

/** A FLAT hit (DOT tick, quiver rider): no cover, no stat, no DR — just the split, then riposte and death like any hit. */
export function dealFlatDamage(
  state: CombatState,
  attackerId: UnitId | null,
  targetId: UnitId,
  amount: number,
  type: DamageType,
  opts: { readonly armorPiercing: boolean; readonly cause: UnitHitCause },
  env: EngineEnv,
): SliceResult<CombatState> {
  void env
  return applyHit(state, attackerId, targetId, Math.max(0, amount), type, opts.armorPiercing, opts.cause, null)
}

/** Adds armor per `knobs.armorCap` (`none` and `resetOnOwnerTurn` = uncapped; `halfMaxHp` = ⌊max/2⌋ cap, never lowering armor already above it). */
export function grantArmor(u: CombatUnit, amount: number, env: EngineEnv): { readonly unit: CombatUnit; readonly capped: boolean } {
  if (amount <= 0) return { unit: u, capped: false }
  const cap = env.rules.knobs.armorCap === 'halfMaxHp' ? Math.floor(u.hp.max / 2) : Number.POSITIVE_INFINITY
  const next = Math.max(u.armor, Math.min(cap, u.armor + amount))
  return { unit: next === u.armor ? u : { ...u, armor: next }, capped: next < u.armor + amount }
}
