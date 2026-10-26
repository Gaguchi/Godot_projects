/**
 * run/party.ts acceptance (brief §2.16, §10 "recruitCharacter adds a unit whose id equals the characterId with
 * the authored gear, team, passives and (if given) statOverrides; it no-ops for an id already in the party or in
 * deathLog; it refuses past cap 6; buildUnitFromCharacter is deterministic"; CONTRACT-CHANGES 0005).
 */
import { describe, expect, it } from 'vitest'
import { IdSchema } from '../../../../src/content/schemas'
import {
  MC_ID, buildUnitFromCharacter, buildUnitFromClass, damageParty, healParty, isMcAlive, livingUnits, recruitCharacter, removeFallen,
} from '../../../../src/engine/run/party'
import type { Character, UnitCharacter, UnitStats } from '../../../../src/engine/types'
import { env, envWithCharacters, fillBag, newRun, smallestItem, withBag, withUnit } from '../../../helpers/runs'

const unitCharacters = Object.values(env.content.characters).filter((c): c is UnitCharacter => c.kind === 'unit')
const overridden = unitCharacters.find((c) => c.statOverrides !== undefined && c.recruitable && !c.starter)!
const potion = smallestItem()

/** The chassis pool both builders mint: `round(startingHp × rules.party.hpMultiplier) + hpPerLevel·(L−1)` (0048).
 *  Read from rules so the fight-length lever can move without a literal in this file (CONTRACT §8). */
function chassisHp(classId: string, level: number): number {
  const { hpMultiplier, levelLift } = env.rules.party
  return Math.round(env.content.classes[classId]!.startingHp * hpMultiplier) + levelLift.hpPerLevel * Math.max(0, level - 1)
}

/** N recruitable clones of the overridden companion (the shipped cast has one non-starter recruit, the cap needs more). */
function clones(n: number, patch: Partial<UnitCharacter> = {}): Readonly<Record<string, Character>> {
  const out: Record<string, Character> = {}
  for (let i = 0; i < n; i++) {
    const id = `clone_${i}`
    out[id] = { ...overridden, ...patch, id, displayName: id }
  }
  return out
}

describe('buildUnitFromCharacter', () => {
  it('is deterministic: the same def builds deep-equal units whose id is the character id (no Date.now())', () => {
    for (const def of unitCharacters) {
      const a = buildUnitFromCharacter(def, env)
      const b = buildUnitFromCharacter(def, env)
      expect(a).toEqual(b)
      expect(a.id).toBe(def.id)
      expect(a.name).toBe(def.displayName)
      expect(a.team).toBe(def.team)
      expect(a.handLeft).toBe(def.startingGear.left)
      expect(a.handRight).toBe(def.startingGear.right)
      expect(a.passives).toEqual(def.passiveIds)
      expect(a.signatureCardIds).toEqual(def.signatureCardIds)
      expect(a.hp.current).toBe(a.hp.max)
      expect(a.mov).toBe(env.content.classes[def.classId]!.startingMov)
    }
  })

  it('lifts every POSITIVE stat by statPerLevel per level above 1 and hp by hpPerLevel (buildUnitFromClass)', () => {
    const cls = Object.values(env.content.classes).find((c) => c.baseStats.mag === 0)!
    const level = 3
    const { statPerLevel, hpPerLevel } = env.rules.party.levelLift
    const u = buildUnitFromClass(cls.id, level, 'x', 'X', 'party', env)
    for (const k of Object.keys(cls.baseStats) as (keyof UnitStats)[]) {
      const base = cls.baseStats[k]
      expect(u.stats[k]).toBe(base > 0 ? base + statPerLevel * (level - 1) : base)
    }
    expect(u.stats.mag).toBe(0)
    expect(u.hp.max).toBe(chassisHp(cls.id, level))
    expect(u.hp.max).toBe(Math.round(cls.startingHp * env.rules.party.hpMultiplier) + hpPerLevel * (level - 1))
    expect(buildUnitFromClass(cls.id, 1, 'y', 'Y', 'enemy', env)).toMatchObject({ stats: cls.baseStats, hp: { max: chassisHp(cls.id, 1) }, team: 'enemy', handLeft: null, handRight: null, passives: [] })
  })

  it('statOverrides replace the lift: the authored sheet lands verbatim, unlisted stats stay at the class baseline', () => {
    const u = buildUnitFromCharacter(overridden, env)
    const base = env.content.classes[overridden.classId]!.baseStats
    for (const k of Object.keys(base) as (keyof UnitStats)[]) {
      expect(u.stats[k]).toBe(overridden.statOverrides![k] ?? base[k])
    }
    expect(u.hp.max).toBe(chassisHp(overridden.classId, overridden.level))
  })

  it('throws on content that cannot seed: unknown class, non-gear in a hand, a two-handed item on the right', () => {
    const potionInHand: UnitCharacter = { ...overridden, startingGear: { left: potion.id, right: null } }
    expect(() => buildUnitFromCharacter(potionInHand, env)).toThrow(/non-gear/)
    const twoH = Object.values(env.content.items).find((i) => i.twoHanded === true)!
    expect(() => buildUnitFromCharacter({ ...overridden, startingGear: { left: null, right: twoH.id } }, env)).toThrow(/two-handed/)
    expect(() => buildUnitFromCharacter({ ...overridden, startingGear: { left: twoH.id, right: potion.id } }, env)).toThrow()
    expect(() => buildUnitFromClass('no_such_class', 1, 'z', 'Z', 'party', env)).toThrow(/unknown class/)
  })
})

describe('recruitCharacter', () => {
  it('adds a unit whose id equals the characterId with the authored gear, team, passives and statOverrides', () => {
    const run = newRun()
    const r = recruitCharacter(run, overridden.id, env)
    const unit = r.state.party[overridden.id]!
    expect(unit).toEqual(buildUnitFromCharacter(overridden, env))
    expect(r.state.partyOrder).toEqual([...run.partyOrder, overridden.id])
    expect(unit.stats.str).toBe(overridden.statOverrides!.str)
    expect(r.effects).toContainEqual({ kind: 'unitRecruited', characterId: overridden.id })
  })

  it('sets the permanent recruited_<id> flag and emits flagSet', () => {
    const r = recruitCharacter(newRun(), overridden.id, env)
    const key = `${env.rules.party.recruitFlagPrefix}${overridden.id}`
    expect(r.state.flags[key]).toEqual({ value: true, scope: env.rules.party.recruitFlagScope })
    expect(r.effects).toContainEqual({ kind: 'flagSet', key, value: true, scope: env.rules.party.recruitFlagScope })
  })

  it('every engine-minted recruit flag key validates under IdSchema (CONTRACT-CHANGES 0005)', () => {
    for (const id of Object.keys(env.content.characters)) {
      expect(IdSchema.safeParse(`${env.rules.party.recruitFlagPrefix}${id}`).success).toBe(true)
    }
  })

  it('no-ops (same reference, one toast) for an id already in the party', () => {
    const run = newRun()
    const r = recruitCharacter(run, MC_ID, env)
    expect(r.state).toBe(run)
    expect(r.effects).toEqual([{ kind: 'toast', text: expect.any(String) }])
  })

  it('no-ops for an id in deathLog — the dead do not re-join', () => {
    const run = newRun()
    const joined = recruitCharacter(run, overridden.id, env).state
    const dead = removeFallen(joined, [{ unitId: overridden.id, cause: 'battle', battleId: 'battle:x' }], env).state
    expect(dead.party[overridden.id]).toBeUndefined()
    const again = recruitCharacter(dead, overridden.id, env)
    expect(again.state).toBe(dead)
    expect(again.effects).toEqual([{ kind: 'toast', text: expect.stringContaining('fell') }])
  })

  it('refuses past rules.party.cap', () => {
    const cap = env.rules.party.cap
    const e = envWithCharacters(clones(cap))
    let run = newRun(1, e)
    let i = 0
    while (run.partyOrder.length < cap) {
      const r = recruitCharacter(run, `clone_${i}`, e)
      expect(r.state).not.toBe(run)
      run = r.state
      i++
    }
    expect(run.partyOrder).toHaveLength(cap)
    const over = recruitCharacter(run, `clone_${i}`, e)
    expect(over.state).toBe(run)
    expect(over.effects).toEqual([{ kind: 'toast', text: expect.stringContaining('full') }])
  })

  it('declines a non-recruitable character and throws on an unknown or npc id', () => {
    const run = newRun()
    const enemy = unitCharacters.find((c) => !c.recruitable)!
    const r = recruitCharacter(run, enemy.id, env)
    expect(r.state).toBe(run)
    expect(r.effects[0]!.kind).toBe('toast')
    expect(() => recruitCharacter(run, 'no_such_character', env)).toThrow(/not a unit character/)
    const npc = Object.values(env.content.characters).find((c) => c.kind === 'npc')!
    expect(() => recruitCharacter(run, npc.id, env)).toThrow(/not a unit character/)
  })

  it("puts the character's bag items into the party bag; overflow waits in pendingLoot", () => {
    const e = envWithCharacters(clones(1, { bag: [potion.id, potion.id] }))
    const roomy = recruitCharacter(newRun(1, e), 'clone_0', e)
    expect(roomy.state.bag.filter((b) => b.itemId === potion.id).length).toBe(newRun(1, e).bag.filter((b) => b.itemId === potion.id).length + 2)
    expect(roomy.state.pendingLoot).toEqual([])
    expect(roomy.effects.filter((x) => x.kind === 'itemAcquired')).toHaveLength(2)
    const crowded = recruitCharacter(fillBag(newRun(1, e), 1, e), 'clone_0', e)
    expect(crowded.state.pendingLoot).toEqual([potion.id])
    expect(crowded.effects).toContainEqual({ kind: 'lootOverflow', itemIds: [potion.id] })
  })
})

describe('living units and the MC', () => {
  it('livingUnits follows partyOrder and drops 0-HP units; isMcAlive keys on the MC id', () => {
    const run = newRun()
    expect(livingUnits(run).map((u) => u.id)).toEqual(run.partyOrder)
    expect(isMcAlive(run)).toBe(true)
    const mc = run.party[MC_ID]!
    const downed = withUnit(run, { ...mc, hp: { ...mc.hp, current: 0 } })
    expect(isMcAlive(downed)).toBe(false)
    expect(livingUnits(downed).map((u) => u.id)).toEqual(run.partyOrder.filter((id) => id !== MC_ID))
    expect(isMcAlive({ ...run, party: {}, partyOrder: [] })).toBe(false)
  })
})

describe('removeFallen', () => {
  it('logs once per unit, prunes party + partyOrder, bumps unitsLost and emits unitLost; unknown ids are ignored', () => {
    const run = newRun()
    const victim = run.partyOrder[1]!
    const r = removeFallen(run, [
      { unitId: victim, cause: 'battle', battleId: 'battle:bandits:node:d1' },
      { unitId: victim, cause: 'battle', battleId: 'battle:bandits:node:d1' },
      { unitId: 'nobody', cause: 'event', battleId: null },
    ], env)
    expect(r.state.party[victim]).toBeUndefined()
    expect(r.state.partyOrder).toEqual(run.partyOrder.filter((id) => id !== victim))
    expect(r.state.deathLog).toEqual([{ unitId: victim, name: run.party[victim]!.name, classId: run.party[victim]!.classId, cause: 'battle', day: run.daysElapsed, battleId: 'battle:bandits:node:d1' }])
    expect(r.state.stats.unitsLost).toBe(run.stats.unitsLost + 1)
    expect(r.effects).toEqual([{ kind: 'unitLost', unitId: victim, cause: 'battle' }])
    expect(removeFallen(r.state, [{ unitId: victim, cause: 'battle', battleId: null }], env).state).toBe(r.state)
  })
})

describe('healParty / damageParty', () => {
  it("healParty 'full' with onlyWounded heals exactly the wounded and lists them", () => {
    const run = newRun()
    const [a, b] = run.partyOrder as [string, string]
    const wounded = withUnit(run, { ...run.party[a]!, hp: { ...run.party[a]!.hp, current: 1 } })
    const r = healParty(wounded, 'full', true, 'inn', env)
    expect(r.healed).toEqual([a])
    expect(r.state.party[a]!.hp.current).toBe(r.state.party[a]!.hp.max)
    expect(r.state.party[b]).toBe(wounded.party[b])
    expect(r.effects).toEqual([{ kind: 'partyHealed', unitIds: [a], reason: 'inn' }])
    const nothing = healParty(r.state, 'full', true, 'inn', env)
    expect(nothing.state).toBe(r.state)
    expect(nothing.effects).toEqual([])
  })

  it('healParty by fraction floors and clamps at max; without onlyWounded every living unit is listed', () => {
    const run = newRun()
    const a = run.partyOrder[0]!
    const unit = run.party[a]!
    const wounded = withUnit(run, { ...unit, hp: { ...unit.hp, current: 1 } })
    const fraction = env.rules.camp.restHealFraction
    const r = healParty(wounded, fraction, false, 'campRest', env)
    expect(r.healed).toEqual(run.partyOrder)
    expect(r.state.party[a]!.hp.current).toBe(Math.min(unit.hp.max, 1 + Math.floor(unit.hp.max * fraction)))
    for (const id of run.partyOrder.slice(1)) expect(r.state.party[id]!.hp.current).toBe(run.party[id]!.hp.max)
  })

  it('damageParty deals flat damage to every living unit; starvation has its own wording', () => {
    const run = newRun()
    const amount = env.rules.travel.starvationDamage
    const r = damageParty(run, amount, 'starvation', env)
    for (const id of run.partyOrder) expect(r.state.party[id]!.hp.current).toBe(run.party[id]!.hp.max - amount)
    expect(r.died).toEqual([])
    expect(r.effects).toEqual([{ kind: 'starvation', unitIds: run.partyOrder, amount }])
    const ev = damageParty(run, 1, 'event', env)
    expect(ev.effects).toEqual([{ kind: 'partyDamaged', unitIds: run.partyOrder, amount: 1, reason: 'event' }])
    expect(damageParty(run, 0, 'event', env).state).toBe(run)
  })

  it('a lethal damageParty goes through removeFallen: deathLog with the cause and no battle id, died listed', () => {
    const run = newRun()
    const a = run.partyOrder[1]!
    const frail = withUnit(run, { ...run.party[a]!, hp: { ...run.party[a]!.hp, current: 2 } })
    const r = damageParty(frail, 2, 'starvation', env)
    expect(r.died).toEqual([a])
    expect(r.state.party[a]).toBeUndefined()
    expect(r.state.deathLog).toEqual([expect.objectContaining({ unitId: a, cause: 'starvation', battleId: null, day: run.daysElapsed })])
    expect(r.effects).toEqual([
      { kind: 'starvation', unitIds: run.partyOrder, amount: 2 },
      { kind: 'unitLost', unitId: a, cause: 'starvation' },
    ])
  })

  it('a wiped MC leaves isMcAlive false for settle step 1b to act on (this module never ends the run)', () => {
    const run = newRun()
    const mc = run.party[MC_ID]!
    const r = damageParty(withUnit(run, { ...mc, hp: { ...mc.hp, current: 1 } }), 1, 'event', env)
    expect(isMcAlive(r.state)).toBe(false)
    expect(r.state.partyOrder).not.toContain(MC_ID)
    expect(withBag(r.state, []).pendingLoot).toEqual([])
  })
})
