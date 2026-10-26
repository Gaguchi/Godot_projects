/**
 * combat/sim.ts — headless battles for balance and determinism tests (brief §2.13 targets, §7.1, §7.2).
 * A round-cap hit throws `RoundCapError` with a per-round state dump — never a "stalemate" statistic: `sweep`
 * re-throws it unless the caller opts in with `tolerateRoundCap`, and even then the first error rides on the row.
 */
import type { CombatAction } from '../actions'
import type { BattleSpec, CombatPhase, CombatState, CombatUnit, EngineEnv, ItemId, RngState, TileKey } from '../types'
import type { Effect } from '../effects'
import { createRng } from '../rng'
import { rngState } from '../rngState'
import { forecast } from './damage'
import { isLiving, manhattan, reachable, unitAt } from './grid'
import { reduceCombat } from './reducer'
import { seedBattle } from './seed'
import { isImmobilized, isTaunting } from './statuses'
import { legalTargets } from './targeting'

/** A policy that ROLLS returns the advanced stream beside its action; `autoBattle` writes it back before reducing
 *  (§2.5 / §7.19: no throwaway `createRng(state.rng)` whose draws are dropped on the floor). */
export interface PolicyDecision {
  readonly action: CombatAction
  readonly rng: RngState
}

/** Player policy for the active PARTY unit; enemies always use `combat/ai.ts`. */
export type Policy = (state: CombatState, env: EngineEnv) => CombatAction | PolicyDecision

export class RoundCapError extends Error {
  constructor(message: string, readonly dump: readonly CombatState[]) {
    super(message)
    this.name = 'RoundCapError'
  }
}

export interface SimResult {
  readonly outcome: CombatPhase
  readonly rounds: number
  readonly firstBloodRound: number | null
  readonly finalState: CombatState
  readonly effects: readonly Effect[]
  /** One snapshot per round boundary, oldest first — the same walk `RoundCapError` carries (§7.1 goldens read it). */
  readonly dump: readonly CombatState[]
}

/**
 * Every round/first-blood figure is measured over the COMPLETED battles of the label — a stalemate is carried by
 * `stalemates` alone and never padded into a mean (0048: charging a cap hit at `roundCap` put +3.0 rounds on a
 * 20-seed mean and reported a second, spurious `rounds` miss on top of the real one). `null` ⇔ nothing to measure.
 *
 * The `mean*` figures are what the brief's gate reads ("average 4-10 turns", §10); the `min`/`max`/`worst` figures
 * are the per-battle shape behind them, so a bimodal field — half the battles at 2 rounds, half at 10 — cannot
 * hide inside a healthy average (0048).
 */
export interface SweepRow {
  readonly label: string
  readonly runs: number
  readonly winRate: number
  readonly meanRounds: number | null
  readonly minRounds: number | null
  readonly maxRounds: number | null
  readonly stalemates: number
  readonly meanFirstBloodRound: number | null
  /** The LATEST round any completed battle drew blood in; null when none did. */
  readonly worstFirstBloodRound: number | null
  /** Completed battles in which nobody ever lost HP — a first-blood miss `meanFirstBloodRound` cannot express. */
  readonly bloodlessRuns: number
  /** The first TOLERATED round-cap hit of this label, dump attached; null when the label never stalled (§7.2). */
  readonly firstStalemate: RoundCapError | null
}

export interface SweepOptions {
  /** Count a round-cap hit as a stalemate instead of re-throwing it. Off by default: a stuck field is an engine
   *  smoke alarm, so the caller that swallows one has to say so, and the dump still travels on the row. */
  readonly tolerateRoundCap?: boolean
}

interface Option {
  readonly action: CombatAction
  readonly score: number
}

function active(state: CombatState): CombatUnit | null {
  const u = state.units[state.turn.unitId]
  return u === undefined || !isLiving(u) ? null : u
}

function nearestFoeTile(state: CombatState, self: CombatUnit): TileKey | null {
  if (self.position === null) return null
  const here = self.position
  let best: TileKey | null = null
  let bestD = Number.POSITIVE_INFINITY
  for (const u of Object.values(state.units)) {
    if (u.team === self.team || u.position === null || !isLiving(u)) continue
    const d = manhattan(here, u.position)
    if (d < bestD || (d === bestD && best !== null && u.position < best)) {
      best = u.position
      bestD = d
    }
  }
  return best
}

/** Every legal (card, tile) play of the active unit, scored: damage first (lethal bonus), then heals to the wounded,
 *  then cheap self plays (so hands empty and reshuffles happen), never a heal on a full unit. */
function cardOptions(state: CombatState, self: CombatUnit, env: EngineEnv): readonly Option[] {
  const deck = state.decks[self.id]
  if (deck === undefined) return []
  const out: Option[] = []
  for (const uid of deck.hand) {
    const inst = deck.cards[uid]
    if (inst === undefined) continue
    const card = env.content.cards[inst.cardId]
    if (card === undefined || card.apCost > self.ap) continue
    const play = { card, mod: inst.mod }
    if (card.targetKind === 'self' || card.targetKind === 'all_enemies' || card.targetKind === 'all_allies') {
      const foes = Object.values(state.units).filter((u) => u.team !== self.team && isLiving(u))
      let score = 1 // a self play keeps the hand moving
      if (card.targetKind === 'all_enemies') score = foes.reduce((sum, f) => sum + (forecast(state, self.id, play, f.id, env)?.hpLost ?? 0), 0) * 10
      else if (card.effects.some((e) => e.kind === 'Heal') && self.hp.current < self.hp.max) score = (self.hp.max - self.hp.current) * 5
      out.push({ action: { type: 'combat/playCard', cardUid: uid, tile: null }, score })
      continue
    }
    for (const tile of legalTargets(state, self.id, card, env)) {
      const target = unitAt(state, tile)
      if (target === null) {
        out.push({ action: { type: 'combat/playCard', cardUid: uid, tile }, score: 0.5 })
        continue
      }
      const f = forecast(state, self.id, play, target.id, env)
      let score: number
      if (target.team !== self.team) score = f === null ? 0 : (f.hpLost + f.armorLost * 0.5) * 10 + (f.lethal ? 500 : 0)
      else if (f !== null && f.heal > 0) score = f.heal * 5
      else score = target.hp.current < target.hp.max ? 2 : 0.5
      out.push({ action: { type: 'combat/playCard', cardUid: uid, tile }, score })
    }
  }
  return out
}

/** Highest `forecast` damage on a legal target (passing the hand instance's `mod`), else move toward the nearest foe, else end turn. */
export const greedyPolicy: (state: CombatState, env: EngineEnv) => CombatAction = (state, env) => {
  const self = active(state)
  if (self === null) return { type: 'combat/endTurn' }
  const options = cardOptions(state, self, env)
  const best = options.reduce<Option | null>((a, b) => (a === null || b.score > a.score ? b : a), null)
  if (best !== null && best.score >= 10) return best.action
  if (!self.hasMovedThisTurn && !isImmobilized(self) && self.position !== null) {
    const goal = nearestFoeTile(state, self)
    if (goal !== null) {
      let to: TileKey | null = null
      let bestD = manhattan(self.position, goal)
      for (const tile of Object.keys(reachable(state, self.id))) {
        const d = manhattan(tile, goal)
        if (d < bestD || (d === bestD && to !== null && tile < to)) {
          to = tile
          bestD = d
        }
      }
      if (to !== null) return { type: 'combat/moveUnit', tile: to }
    }
  }
  if (best !== null && best.score > 0) return best.action
  return { type: 'combat/endTurn' }
}

/** A self-target play that puts `taunt` on the caster — the tank's one defensive verb (Cover, Bulwark, Taunt). */
function tauntCardUid(state: CombatState, self: CombatUnit, env: EngineEnv): string | null {
  const deck = state.decks[self.id]
  if (deck === undefined) return null
  for (const uid of deck.hand) {
    const inst = deck.cards[uid]
    const card = inst === undefined ? undefined : env.content.cards[inst.cardId]
    if (card === undefined || card.apCost > self.ap || card.targetKind !== 'self') continue
    if (card.effects.some((e) => e.kind === 'ApplyStatus' && e.effectId === 'taunt')) return uid
  }
  return null
}

const hpFraction = (u: CombatUnit): number => (u.hp.max === 0 ? 0 : u.hp.current / u.hp.max)

/**
 * The policy the PATH rows are measured with (`scripts/cli.ts` attrition), and the one the balance output has
 * always CALLED "careful-player" while quietly running `greedyPolicy` underneath — a greedy player is not a
 * careful one, and the difference is exactly the two verbs a company survives a permadeath road with:
 *
 *  1. a unit about to be lost drinks before it swings (`rules.combat.aiLowHpFraction` is the same "low" the enemy
 *     planner reads, so both sides call the same HP low);
 *  2. a unit holding a self-taunt with a FRAILER ally on the field and foes closing plays it — the tank holds the
 *     line instead of trading blows the mage cannot afford to trade. Frailer is read two ways, and either is
 *     enough: a smaller pool (the mage cannot afford the blow even at full health, which is why the taunt is
 *     worth its AP on round one) or a lower share of it left.
 *
 * Everything else is `greedyPolicy`. Measuring the road with a policy that never once played Cover is why the tank
 * read as decorative and why every road wipe was the pack deleting the mage (RE-GATE C 3.15/3.19).
 */
export const carefulPolicy: (state: CombatState, env: EngineEnv) => CombatAction = (state, env) => {
  const self = active(state)
  if (self === null) return { type: 'combat/endTurn' }
  const living = Object.values(state.units).filter(isLiving)
  if (hpFraction(self) < env.rules.combat.aiLowHpFraction && self.ap >= env.rules.combat.itemUseAp) {
    for (const itemId of state.consumables) {
      const item = env.content.items[itemId]
      if (item?.effect?.kind === 'Heal' && self.hp.current < self.hp.max) return { type: 'combat/useItem', itemId }
    }
  }
  // A dying tank is not a shield, it is the next name in the death log: below the same "low" the enemy planner
  // reads, the careful player fights or drinks instead of standing in front.
  if (self.position !== null && !isTaunting(self) && hpFraction(self) >= env.rules.combat.aiLowHpFraction) {
    const here = self.position
    const frailerAlly = living.some((u) => u.team === self.team && u.id !== self.id && u.position !== null
      && (u.hp.max < self.hp.max || hpFraction(u) < hpFraction(self)))
    const foeClosing = living.some((u) => u.team !== self.team && u.position !== null && manhattan(here, u.position) <= TAUNT_REACH)
    if (frailerAlly && foeClosing) {
      const uid = tauntCardUid(state, self, env)
      if (uid !== null) return { type: 'combat/playCard', cardUid: uid, tile: null }
    }
  }
  return greedyPolicy(state, env)
}

/** How close a foe has to be for a taunt to be worth its AP: one enemy move (4) plus a blow, rounded up to the
 *  widest bow band in content. Nearer than this and the pack is already committed; further and the taunt lapses
 *  before it bites (`taunt` expires at the owner's next turn start). */
const TAUNT_REACH = 7

/** Uniform over legal actions — cards, moves, potions, capture attempts and End Turn — drawn from `combat.rng` and
 *  RETURNED with the advanced stream, so each decision draws a fresh number instead of repeating one (§2.5, §7.19). */
export const randomPolicy: Policy = (state, env) => {
  const self = active(state)
  if (self === null) return { action: { type: 'combat/endTurn' }, rng: state.rng }
  const options: CombatAction[] = cardOptions(state, self, env).map((o) => o.action)
  if (!self.hasMovedThisTurn && !isImmobilized(self)) for (const tile of Object.keys(reachable(state, self.id))) options.push({ type: 'combat/moveUnit', tile })
  if (self.ap >= env.rules.combat.itemUseAp) {
    const drinkable: ItemId[] = []
    for (const itemId of state.consumables) if (!drinkable.includes(itemId)) drinkable.push(itemId)
    for (const itemId of drinkable) options.push({ type: 'combat/useItem', itemId })
  }
  if (self.position !== null && self.ap >= env.rules.combat.capture.apCost) {
    const here = self.position
    for (const u of Object.values(state.units)) {
      if (u.team === self.team || !isLiving(u) || u.position === null) continue
      if (manhattan(here, u.position) === 1) options.push({ type: 'combat/capture', targetId: u.id })
    }
  }
  options.push({ type: 'combat/endTurn' })
  const r = createRng(state.rng)
  const action: CombatAction = options[r.nextInt(0, options.length - 1)] ?? { type: 'combat/endTurn' }
  return { action, rng: rngState(r) }
}

/** `seedBattle` → loop (policy | `planEnemyStep`) through `reduceCombat` until a terminal phase or the round cap. */
export function autoBattle(spec: BattleSpec, env: EngineEnv, policy: Policy): SimResult {
  let st = seedBattle(spec, env)
  const effects: Effect[] = []
  const dump: CombatState[] = [st]
  let firstBloodRound: number | null = null
  let lastRound = st.turn.round
  let steps = 0
  const cap = env.rules.combat.roundCap
  while (st.phase === 'combat') {
    if (st.turn.round > cap) throw new RoundCapError(`round cap ${cap} hit in ${spec.battleId} — the field is stuck`, dump)
    if (++steps > cap * 200) throw new RoundCapError(`step cap hit in ${spec.battleId} — a turn never ends`, dump)
    const self = active(st)
    if (self === null) throw new Error(`combat/sim: active unit '${st.turn.unitId}' is not on the field`)
    const decision: CombatAction | PolicyDecision = self.team === 'enemy' ? { type: 'combat/enemyStep' } : policy(st, env)
    const action: CombatAction = 'rng' in decision ? decision.action : decision
    // a rolling policy hands its advanced stream back; the state carries it BEFORE the action applies (§7.19)
    if ('rng' in decision) st = { ...st, rng: decision.rng }
    let r = reduceCombat(st, action, env)
    if (r.effects.some((e) => e.kind === 'refused')) {
      if (self.team === 'enemy') throw new Error(`combat/sim: enemyStep refused for ${self.id} — planner and reducer disagree`)
      // a policy that misjudged legality ends the turn instead of looping
      r = reduceCombat(st, { type: 'combat/endTurn' }, env)
    }
    if (firstBloodRound === null && r.effects.some((e) => e.kind === 'unitHit' && e.hpLost > 0)) firstBloodRound = st.turn.round
    effects.push(...r.effects)
    st = r.state
    if (st.turn.round !== lastRound) {
      lastRound = st.turn.round
      dump.push(st)
    }
  }
  return { outcome: st.phase, rounds: st.turn.round, firstBloodRound, finalState: st, effects, dump }
}

const mean = (xs: readonly number[]): number | null => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length)
const least = (xs: readonly number[]): number | null => (xs.length === 0 ? null : Math.min(...xs))
const most = (xs: readonly number[]): number | null => (xs.length === 0 ? null : Math.max(...xs))

export function sweep(specs: readonly { readonly label: string; readonly spec: BattleSpec }[], env: EngineEnv, policy: Policy, opts: SweepOptions = {}): readonly SweepRow[] {
  const rows = new Map<string, { runs: number; wins: number; rounds: number[]; stalemates: number; blood: number[]; bloodless: number; stuck: RoundCapError | null }>()
  for (const { label, spec } of specs) {
    const row = rows.get(label) ?? { runs: 0, wins: 0, rounds: [], stalemates: 0, blood: [], bloodless: 0, stuck: null }
    row.runs++
    try {
      const result = autoBattle(spec, env, policy)
      if (result.outcome === 'victory') row.wins++
      row.rounds.push(result.rounds)
      if (result.firstBloodRound === null) row.bloodless++
      else row.blood.push(result.firstBloodRound)
    } catch (e) {
      // §7.2: a stuck field is an engine smoke alarm — the dump is never traded for a tidy counter, and the cap
      // is not charged to `rounds` either: a padded mean reports a second, phantom miss beside the real one
      if (!(e instanceof RoundCapError) || opts.tolerateRoundCap !== true) throw e
      row.stalemates++
      row.stuck ??= e
    }
    rows.set(label, row)
  }
  return [...rows.entries()].map(([label, r]) => ({
    label,
    runs: r.runs,
    winRate: r.runs === 0 ? 0 : r.wins / r.runs,
    meanRounds: mean(r.rounds),
    minRounds: least(r.rounds),
    maxRounds: most(r.rounds),
    stalemates: r.stalemates,
    meanFirstBloodRound: mean(r.blood),
    worstFirstBloodRound: most(r.blood),
    bloodlessRuns: r.bloodless,
    firstStalemate: r.stuck,
  }))
}
