/**
 * tests/helpers/battles.ts — fixtures for the combat package (CONTRACT §7 harness: "each package writes the
 * helper it needs first"). Builds units straight from content classes (no `run/party.ts` dependency), authored
 * battle specs, and performs the small state surgeries a rules test needs (place a unit, hand it a card, make it
 * the active unit). Every builder returns new objects; nothing here mutates.
 */
import { createEnv, withRules } from '../../src/engine/content'
import { tileKey } from '../../src/engine/combat/grid'
import { reduceCombat } from '../../src/engine/combat/reducer'
import { seedBattle } from '../../src/engine/combat/seed'
import { initiativeQueue } from '../../src/engine/combat/turn'
import { withDeck, withUnit } from '../../src/engine/combat/state'
import type { CombatAction, SliceResult } from '../../src/engine/actions'
import type { Rules } from '../../src/engine/rules'
import type {
  AuthoredEnemy, BattleOrigin, BattleSpec, BattleTag, CardId, CardUid, CombatState, CombatUnit, EngineEnv, PassiveId, Team,
  TileKey, Unit, UnitId, UnitStats,
} from '../../src/engine/types'

let cached: EngineEnv | null = null
/** The shipped content + shipped rules, built once per test file — with the enemy HP multiplier pinned to 1 so the
 *  engine tests read class `startingHp` literally; the shipped multiplier is the balance gate's business. */
export function env(): EngineEnv {
  if (cached === null) {
    const e = createEnv()
    cached = withRules(e, { difficulty: { ...e.rules.difficulty, enemyScaling: { ...e.rules.difficulty.enemyScaling, enemyHpMultiplier: 1 } } })
  }
  return cached
}

export function withKnobs(e: EngineEnv, knobs: Partial<Rules['knobs']>): EngineEnv {
  return withRules(e, { knobs: { ...e.rules.knobs, ...knobs } })
}

export interface UnitOpts {
  readonly level?: number
  readonly hp?: number
  readonly stats?: Partial<UnitStats>
  readonly handLeft?: string | null
  readonly handRight?: string | null
  readonly passives?: readonly PassiveId[]
  readonly signatureCardIds?: readonly CardId[]
  readonly name?: string
}

/** A run-level unit built from a class (the chassis the run's `buildUnitFromClass` would give it). */
export function unitFromClass(id: UnitId, classId: string, team: Team, opts: UnitOpts = {}, e: EngineEnv = env()): Unit {
  const cls = e.content.classes[classId]
  if (cls === undefined) throw new Error(`fixture: unknown class '${classId}'`)
  const hp = opts.hp ?? cls.startingHp
  return {
    id,
    name: opts.name ?? cls.name,
    classId,
    team,
    level: opts.level ?? 1,
    hp: { current: hp, max: hp },
    stats: { ...cls.baseStats, ...opts.stats },
    mov: cls.startingMov,
    handLeft: opts.handLeft ?? null,
    handRight: opts.handRight ?? null,
    passives: opts.passives ?? [],
    signatureCardIds: opts.signatureCardIds ?? [],
  }
}

/** The foundling as the run would field it: lord chassis, iron sword. */
export function mc(opts: UnitOpts = {}): Unit {
  return unitFromClass('mc', 'lord', 'party', { handLeft: 'iron_sword', ...opts })
}

/** Oak: shield_knight chassis, iron lance + iron buckler, Genatsvale. */
export function oak(opts: UnitOpts = {}): Unit {
  return unitFromClass('oak', 'shield_knight', 'party', { handLeft: 'iron_lance', handRight: 'iron_buckler', passives: ['genatsvale'], ...opts })
}

export interface AuthoredOpts {
  readonly level?: number
  readonly hp?: number | null
  readonly armor?: number | null
  readonly stats?: Partial<UnitStats> | null
  readonly name?: string
  readonly bountyValue?: number | null
}

export function authored(id: UnitId, classId: string, x: number, y: number, opts: AuthoredOpts = {}): AuthoredEnemy {
  return {
    id,
    name: opts.name ?? id,
    classId,
    level: opts.level ?? 1,
    position: tileKey(x, y),
    hp: opts.hp ?? null,
    armor: opts.armor ?? null,
    stats: opts.stats ?? null,
    bountyValue: opts.bountyValue ?? null,
  }
}

export interface SpecOpts {
  readonly party: readonly Unit[]
  readonly enemies: BattleSpec['enemies']
  readonly grid?: { readonly width?: number; readonly height?: number; readonly obstacles?: readonly TileKey[]; readonly terrain?: BattleSpec['grid']['terrain'] }
  readonly seed?: number
  readonly battleId?: string
  readonly tag?: BattleTag
  readonly origin?: BattleOrigin
  readonly enemyGroupId?: string | null
  readonly regionTier?: 1 | 2 | 3
  readonly consumables?: readonly string[]
  readonly captureTargets?: BattleSpec['captureTargets']
}

export function spec(o: SpecOpts, e: EngineEnv = env()): BattleSpec {
  return {
    battleId: o.battleId ?? 'battle:test',
    tag: o.tag ?? 'sim',
    origin: o.origin ?? { kind: 'sim' },
    regionTier: o.regionTier ?? 1,
    enemyGroupId: o.enemyGroupId !== undefined ? o.enemyGroupId : o.enemies.kind === 'group' ? o.enemies.enemyGroupId : null,
    grid: {
      width: o.grid?.width ?? e.rules.combat.grid.width,
      height: o.grid?.height ?? e.rules.combat.grid.height,
      obstacles: o.grid?.obstacles ?? [],
      terrain: o.grid?.terrain ?? null,
    },
    party: o.party,
    enemies: o.enemies,
    consumables: o.consumables ?? [],
    captureTargets: o.captureTargets ?? [],
    rng: { seed: o.seed ?? 1, counter: 0 },
  }
}

export function seed(o: SpecOpts, e: EngineEnv = env()): CombatState {
  return seedBattle(spec(o, e), e)
}

/** The smallest real battle: the foundling (party slot 2,4) against one authored bandit two tiles east. */
export function duel(opts: { readonly banditAt?: readonly [number, number]; readonly bandit?: AuthoredOpts; readonly mcOpts?: UnitOpts; readonly seed?: number } = {}, e: EngineEnv = env()): CombatState {
  const [x, y] = opts.banditAt ?? [4, 4]
  return seed({ party: [mc(opts.mcOpts ?? {})], enemies: { kind: 'authored', units: [authored('bandit', 'bandit', x, y, opts.bandit ?? {})] }, seed: opts.seed ?? 1 }, e)
}

// ── state surgery ─────────────────────────────────────────────────────────

export function unit(state: CombatState, id: UnitId): CombatUnit {
  const u = state.units[id]
  if (u === undefined) throw new Error(`fixture: no unit '${id}' in state`)
  return u
}

export function patchUnit(state: CombatState, id: UnitId, patch: Partial<CombatUnit>): CombatState {
  return withUnit(state, { ...unit(state, id), ...patch })
}

export function placeAt(state: CombatState, id: UnitId, x: number, y: number): CombatState {
  return patchUnit(state, id, { position: tileKey(x, y), lastTile: null })
}

/** Make `id` the acting unit with a fresh action budget (no turn-start tick — surgery, not `startTurn`).
 *  `turn.acted` is rebuilt as the round that would have REACHED this unit: everyone at or before it in the
 *  current order has had its turn, so `successor` hands over exactly where the real loop would (0115). */
export function activate(state: CombatState, id: UnitId, e: EngineEnv = env()): CombatState {
  const st = patchUnit(state, id, { ap: e.rules.combat.apPerTurn, hasMovedThisTurn: false, actionsTaken: 0 })
  const queue = initiativeQueue(st.units)
  const i = queue.indexOf(id)
  return { ...st, turn: { ...st.turn, unitId: id, acted: i < 0 ? [id] : queue.slice(0, i + 1) }, selection: { kind: 'idle' } }
}

/** Replace `id`'s hand with fresh instances of `cardIds` (uids `<cardId>#t<n>`); the old hand goes to the discard
 *  so draw + hand + discard stays a partition of `cards`. `mods` bakes a quiver modifier on the matching index. */
export function withHand(state: CombatState, id: UnitId, cardIds: readonly CardId[], mods: readonly (CombatState['decks'][string]['cards'][string]['mod'])[] = []): CombatState {
  const deck = state.decks[id]
  if (deck === undefined) throw new Error(`fixture: no deck for '${id}'`)
  const cards = { ...deck.cards }
  const hand: CardUid[] = []
  cardIds.forEach((cardId, i) => {
    let n = 1
    while (`${cardId}#t${n}` in cards) n++
    const uid: CardUid = `${cardId}#t${n}`
    cards[uid] = { uid, cardId, source: 'innate', mod: mods[i] ?? null }
    hand.push(uid)
  })
  return withDeck(state, id, { cards, draw: deck.draw, hand, discard: [...deck.discard, ...deck.hand] })
}

/** The first uid in `id`'s hand whose card id is `cardId`. */
export function handUid(state: CombatState, id: UnitId, cardId: CardId): CardUid {
  const deck = state.decks[id]
  const uid = deck?.hand.find((u) => deck.cards[u]?.cardId === cardId)
  if (uid === undefined) throw new Error(`fixture: '${cardId}' is not in ${id}'s hand`)
  return uid
}

export function dispatch(state: CombatState, action: CombatAction, e: EngineEnv = env()): SliceResult<CombatState> {
  return reduceCombat(state, action, e)
}

/** Fold a list of actions, concatenating effects. */
export function dispatchAll(state: CombatState, actions: readonly CombatAction[], e: EngineEnv = env()): SliceResult<CombatState> {
  let st = state
  const effects: SliceResult<CombatState>['effects'][number][] = []
  for (const a of actions) {
    const r = reduceCombat(st, a, e)
    st = r.state
    effects.push(...r.effects)
  }
  return { state: st, effects }
}

export const at = tileKey
