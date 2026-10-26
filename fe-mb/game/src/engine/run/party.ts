/**
 * run/party.ts — characters, recruitment, permadeath, party HP (brief §2.14, §2.16, §7.7).
 * Identity keys on the character id (id = UnitId = portrait id); display names are presentation only and the
 * MC's chosen name lives in `run.mcName`, never inside a `Unit` (a unit serialises whole into party, combat and
 * deathLog — a name inside it would be copied everywhere, §2.16 "Naming").
 */
import type { SliceResult } from '../actions'
import type { Effect } from '../effects'
import type { ClassDef, DeathEntry, EngineEnv, RunState, Team, Unit, UnitCharacter, UnitId, UnitStats } from '../types'
import { isGear, itemDef } from './bag'
import { grantLoot } from './loot'

/** The foundling's character id (bible lock, §2.16): `displayName` reads `run.mcName` for it and `isMcAlive` keys on it. */
export const MC_ID: UnitId = 'mc'

function classDef(classId: string, env: EngineEnv): ClassDef {
  const cls = env.content.classes[classId]
  if (cls === undefined) throw new Error(`run/party: unknown class '${classId}'`)
  return cls
}

/** `UnitStats` is a strict 7-key object, so its own keys are the stat list — no second copy of the key names. */
function mapStats(base: UnitStats, fn: (value: number, key: keyof UnitStats) => number): UnitStats {
  const out = { ...base }
  for (const key of Object.keys(base) as (keyof UnitStats)[]) out[key] = fn(base[key], key)
  return out
}

/** +statPerLevel on every POSITIVE stat per level above 1 (a 0 MAG lord stays 0 — brief §2.13 party `buildUnit(L)`). */
function liftedStats(base: UnitStats, level: number, env: EngineEnv): UnitStats {
  const lift = env.rules.party.levelLift.statPerLevel * Math.max(0, level - 1)
  return mapStats(base, (v) => (v > 0 ? v + lift : v))
}

/**
 * The party chassis pool: `round(startingHp × rules.party.hpMultiplier) + hpPerLevel·(L−1)`. The multiplier is the
 * party half of the fight-length lever and the mirror of `rules.difficulty.enemyScaling.enemyHpMultiplier` — class
 * `startingHp` is shared with the enemy chassis, so neither side is scaled by editing classes.json (0048).
 */
function maxHpFor(cls: ClassDef, level: number, env: EngineEnv): number {
  return Math.round(cls.startingHp * env.rules.party.hpMultiplier) + env.rules.party.levelLift.hpPerLevel * Math.max(0, level - 1)
}

/** Seed-time content assertions (§7.20 fail loudly): hands hold gear only and a 2H sits in the left hand alone. */
function assertHands(left: string | null, right: string | null, who: string, env: EngineEnv): void {
  for (const id of [left, right]) {
    if (id !== null && !isGear(itemDef(id, env))) throw new Error(`run/party: '${who}' holds non-gear '${id}'`)
  }
  if (right !== null && itemDef(right, env).twoHanded === true) throw new Error(`run/party: '${who}' has two-handed '${right}' in the right hand`)
  if (left !== null && right !== null && itemDef(left, env).twoHanded === true) throw new Error(`run/party: '${who}' pairs two-handed '${left}' with '${right}'`)
}

/**
 * id = def.id; stats = class base lifted by level (`rules.party.levelLift`) UNLESS `statOverrides` — then the
 * authored numbers ARE the sheet, laid over the class baseline (unlisted stats stay at base: the override
 * replaces the lift, it does not stack on it — OQ-9, §2.16); hp = startingHp + hpPerLevel·(L−1) always;
 * team, hands, passives, signature cards from the def. Pure: same def ⇒ same unit, no Date.now().
 */
export function buildUnitFromCharacter(def: UnitCharacter, env: EngineEnv): Unit {
  const cls = classDef(def.classId, env)
  const overrides = def.statOverrides
  const stats = overrides === undefined ? liftedStats(cls.baseStats, def.level, env) : mapStats(cls.baseStats, (v, k) => overrides[k] ?? v)
  const max = maxHpFor(cls, def.level, env)
  assertHands(def.startingGear.left, def.startingGear.right, def.id, env)
  return {
    id: def.id,
    name: def.displayName,
    classId: def.classId,
    team: def.team,
    level: def.level,
    hp: { current: max, max },
    stats,
    mov: cls.startingMov,
    handLeft: def.startingGear.left,
    handRight: def.startingGear.right,
    passives: [...def.passiveIds],
    signatureCardIds: [...def.signatureCardIds],
  }
}

/** Generic chassis (tests, authored enemies without a character entry): lifted stats, empty hands, no passives. */
export function buildUnitFromClass(classId: string, level: number, id: UnitId, name: string, team: Team, env: EngineEnv): Unit {
  const cls = classDef(classId, env)
  const max = maxHpFor(cls, level, env)
  return {
    id,
    name,
    classId,
    team,
    level,
    hp: { current: max, max },
    stats: liftedStats(cls.baseStats, level, env),
    mov: cls.startingMov,
    handLeft: null,
    handRight: null,
    passives: [],
    signatureCardIds: [],
  }
}

/** 'mc' → run.mcName ?? unit.name (placeholder "the foundling"); everyone else → unit.name. */
export function displayName(unit: Pick<Unit, 'id' | 'name'>, run: Pick<RunState, 'mcName'>): string {
  return unit.id === MC_ID ? (run.mcName ?? unit.name) : unit.name
}

/** In `partyOrder` (deployment order). The party holds living units by construction (`removeFallen` prunes), the HP filter is belt-and-braces. */
export function livingUnits(run: RunState): readonly Unit[] {
  return run.partyOrder.flatMap((id) => {
    const u = run.party[id]
    return u !== undefined && u.hp.current > 0 ? [u] : []
  })
}

export function isMcAlive(run: RunState): boolean {
  const mc = run.party[MC_ID]
  return mc !== undefined && mc.hp.current > 0
}

/**
 * No-op (same reference + a `toast`) if the id is already in the party OR in `deathLog` (permadeath — a dead
 * companion never re-joins) or the character is not `recruitable`; refused (toast) past `rules.party.cap`.
 * The character's `bag` items enter the party bag (overflow → `pendingLoot`); sets flag
 * `${recruitFlagPrefix}${id}` (`recruited_<id>`, IdSchema-valid — CONTRACT-CHANGES 0005) at permanent scope
 * (written directly in the same shape `run/flags.ts#setFlag` writes); emits `unitRecruited`. An unknown or
 * non-unit id is a content error and throws (the lint guards every `recruitCharacter.characterId`).
 */
export function recruitCharacter(run: RunState, characterId: string, env: EngineEnv): SliceResult<RunState> {
  const def = env.content.characters[characterId]
  if (def === undefined || def.kind !== 'unit') throw new Error(`run/party: '${characterId}' is not a unit character`)
  const decline = (text: string): SliceResult<RunState> => ({ state: run, effects: [{ kind: 'toast', text }] })
  if (run.party[characterId] !== undefined) return decline(`${def.displayName} already rides with the company.`)
  if (run.deathLog.some((d) => d.unitId === characterId)) return decline(`${def.displayName} fell on the road. The dead do not re-join.`)
  if (!def.recruitable) return decline(`${def.displayName} will not join the company.`)
  if (run.partyOrder.length >= env.rules.party.cap) return decline('The company is full — no room in the wagon.')

  const unit = buildUnitFromCharacter(def, env)
  const key = `${env.rules.party.recruitFlagPrefix}${characterId}`
  const scope = env.rules.party.recruitFlagScope
  const joined: RunState = {
    ...run,
    party: { ...run.party, [unit.id]: unit },
    partyOrder: [...run.partyOrder, unit.id],
    flags: { ...run.flags, [key]: { value: true, scope } },
  }
  const effects: Effect[] = [
    { kind: 'unitRecruited', characterId },
    { kind: 'flagSet', key, value: true, scope },
  ]
  const granted = grantLoot(joined, def.bag ?? [], 'quest', env)
  return { state: granted.state, effects: [...effects, ...granted.effects] }
}

/** deathLog once per unit, party + partyOrder pruned, stats.unitsLost, `unitLost` per unit. Ids not in the party
 *  are ignored. This is the ONE door a name enters `deathLog` through, so it is also the one owner of
 *  `stats.unitsLost` — no caller may add to that counter as well. The entry keeps the name the PLAYER knows the
 *  unit by (`displayName`), so the Game Over ledger and the CLI never print the placeholder for a named MC. */
export function removeFallen(run: RunState, fallen: readonly { readonly unitId: UnitId; readonly cause: DeathEntry['cause']; readonly battleId: string | null }[], env: EngineEnv): SliceResult<RunState> {
  void env
  let party = run.party
  let partyOrder = run.partyOrder
  let deathLog = run.deathLog
  const effects: Effect[] = []
  let lost = 0
  for (const f of fallen) {
    const unit = party[f.unitId]
    if (unit === undefined) continue
    if (deathLog.some((d) => d.unitId === f.unitId)) continue
    deathLog = [...deathLog, { unitId: unit.id, name: displayName(unit, run), classId: unit.classId, cause: f.cause, day: run.daysElapsed, battleId: f.battleId }]
    party = Object.fromEntries(Object.entries(party).filter(([id]) => id !== f.unitId))
    partyOrder = partyOrder.filter((id) => id !== f.unitId)
    lost++
    effects.push({ kind: 'unitLost', unitId: f.unitId, cause: f.cause })
  }
  if (lost === 0) return { state: run, effects: [] }
  return { state: { ...run, party, partyOrder, deathLog, stats: { ...run.stats, unitsLost: run.stats.unitsLost + lost } }, effects }
}

/**
 * `fraction` of max (floored) or 'full'; `onlyWounded` skips full-HP units (the inn bills per wounded unit, so
 * `healed` is exactly the billed set; a camp Rest lists everyone it rested). Emits `partyHealed` when anyone was targeted.
 */
export function healParty(run: RunState, fraction: number | 'full', onlyWounded: boolean, reason: 'inn' | 'campRest' | 'dungeonRest' | 'quest', env: EngineEnv): SliceResult<RunState> & { readonly healed: readonly UnitId[] } {
  void env
  const healed: UnitId[] = []
  const party: Record<UnitId, Unit> = { ...run.party }
  for (const u of livingUnits(run)) {
    if (onlyWounded && u.hp.current >= u.hp.max) continue
    const amount = fraction === 'full' ? u.hp.max - u.hp.current : Math.floor(u.hp.max * fraction)
    party[u.id] = { ...u, hp: { ...u.hp, current: Math.min(u.hp.max, u.hp.current + amount) } }
    healed.push(u.id)
  }
  if (healed.length === 0) return { state: run, effects: [], healed }
  return { state: { ...run, party }, effects: [{ kind: 'partyHealed', unitIds: healed, reason }], healed }
}

/**
 * Flat damage to every living unit; deaths go through `removeFallen` (cause carried, no battle id). Starvation
 * emits `starvation` (the hop executor's wording), any other cause `partyDamaged`. A wipe / MC death is terminal:
 * `flow/settle.ts` step 1b ends the run in the same dispatch (this function never calls `endRun` — it is pure
 * over `RunState`).
 */
export function damageParty(run: RunState, amount: number, cause: DeathEntry['cause'], env: EngineEnv): SliceResult<RunState> & { readonly died: readonly UnitId[] } {
  if (amount <= 0) return { state: run, effects: [], died: [] }
  const hit: UnitId[] = []
  const died: UnitId[] = []
  const party: Record<UnitId, Unit> = { ...run.party }
  for (const u of livingUnits(run)) {
    const current = Math.max(0, u.hp.current - amount)
    party[u.id] = { ...u, hp: { ...u.hp, current } }
    hit.push(u.id)
    if (current === 0) died.push(u.id)
  }
  if (hit.length === 0) return { state: run, effects: [], died }
  const effect: Effect = cause === 'starvation' ? { kind: 'starvation', unitIds: hit, amount } : { kind: 'partyDamaged', unitIds: hit, amount, reason: 'event' }
  const removed = removeFallen({ ...run, party }, died.map((unitId) => ({ unitId, cause, battleId: null })), env)
  return { state: removed.state, effects: [effect, ...removed.effects], died }
}
