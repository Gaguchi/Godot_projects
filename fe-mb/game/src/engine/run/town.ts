/**
 * run/town.ts — Inn / Shop / Tavern (brief §2.6 bounty board, §2.10).
 * Pure over `RunState`; a refused action returns the SAME reference plus one `refused` effect.
 */
import type { ActionType, SliceResult } from '../actions'
import type { Effect } from '../effects'
import type { EngineEnv, ItemId, Prisoner, RunState, TavernQuestEntry, TownDef, UnitId } from '../types'
import { entryAt, isFood, placeInBag, removeAt } from './bag'
import { openDialogue } from './dialogue'
import { addGold, bountyFor, buyPrice, canInnHeal, entrySellPrice, innCost, shopStock } from './economy'
import { nodeOf, townOf } from './overworld'
import { healParty } from './party'
import { evaluate, predicateState } from './predicates'

function refused(run: RunState, action: ActionType, reason: string): SliceResult<RunState> {
  return { state: run, effects: [{ kind: 'refused', action, reason }] }
}

function currentTown(run: RunState, env: EngineEnv): TownDef | null {
  if (run.town === null) return null
  return env.content.towns[run.town.townId] ?? null
}

/** Refused unless the current node is a TOWN with a def; sets `run.town = { townId }` (the slot `resumeScreen` reads). */
export function enterTown(run: RunState, env: EngineEnv): SliceResult<RunState> {
  const town = townOf(run, env)
  if (town === null) return refused(run, 'town/enter', `${nodeOf(run.nodeId, env).name} is not a town`)
  if (run.town !== null && run.town.townId === town.id) return { state: run, effects: [] }
  return { state: { ...run, town: { townId: town.id } }, effects: [] }
}

/** `run.town = null` (mirror of `camp.ts#leaveCamp`). */
export function leaveTown(run: RunState): RunState {
  return run.town === null ? run : { ...run, town: null }
}

/** Refused by `canInnHeal` — nobody wounded, or gold < `innCost(...).total`; then heals every wounded unit to full
 *  via `healParty('full', true, 'inn')`. The rule lives with `innCost` in `run/economy.ts` and the flow gate reads
 *  the same predicate, so the disabled bed and this refusal are one sentence (CONTRACT-CHANGES 0089). */
export function innHeal(run: RunState, env: EngineEnv): SliceResult<RunState> {
  const town = currentTown(run, env)
  if (town === null) return refused(run, 'town/innHeal', 'not in a town')
  const gate = canInnHeal(town, run, env)
  if (!gate.ok) return refused(run, 'town/innHeal', gate.reason)
  const cost = innCost(town, run, env)
  const healed = healParty(addGold(run, -cost.total), 'full', true, 'inn', env)
  const effects: Effect[] = [{ kind: 'goldChanged', delta: -cost.total, reason: 'inn' }, ...healed.effects]
  return { state: healed.state, effects }
}

/** In `shopStock`, `buyPrice` non-null, gold ≥ price, fits the bag. */
export function buy(run: RunState, itemId: ItemId, env: EngineEnv): SliceResult<RunState> {
  const town = currentTown(run, env)
  if (town === null) return refused(run, 'town/buy', 'not in a town')
  const item = shopStock(town, run, env).find((i) => i.id === itemId)
  if (item === undefined) return refused(run, 'town/buy', 'not for sale here')
  const price = buyPrice(item)
  if (price === null) return refused(run, 'town/buy', `${item.name} is not for sale`)
  if (run.gold < price) return refused(run, 'town/buy', `${item.name} costs ${price} gold`)
  const bag = placeInBag(run.bag, [itemId], env)
  if (bag === null) return refused(run, 'town/buy', 'no room in the bag')
  const effects: Effect[] = [
    { kind: 'goldChanged', delta: -price, reason: 'shop' },
    { kind: 'itemAcquired', itemId, rarity: item.rarity, source: 'shop' },
  ]
  const placed = bag[bag.length - 1]
  if (placed !== undefined && isFood(placed, env)) effects.push({ kind: 'foodChanged', delta: placed.charges, reason: 'shop' })
  return { state: { ...addGold(run, -price), bag }, effects }
}

/** Sells the bag entry at (x, y) for `entrySellPrice` — the price the shop QUOTED, charges and all: a part-used
 *  ration is worth what is left in it, not what a full one fetches. */
export function sell(run: RunState, x: number, y: number, env: EngineEnv): SliceResult<RunState> {
  if (currentTown(run, env) === null) return refused(run, 'town/sell', 'not in a town')
  const entry = entryAt(run.bag, x, y)
  if (entry === null) return refused(run, 'town/sell', 'nothing there to sell')
  const price = entrySellPrice(entry, env)
  const effects: Effect[] = [{ kind: 'itemRemoved', itemId: entry.itemId, reason: 'sold' }, { kind: 'goldChanged', delta: price, reason: 'shop' }]
  if (isFood(entry, env)) effects.push({ kind: 'foodChanged', delta: -entry.charges, reason: 'shop' })
  return { state: { ...addGold(run, price), bag: removeAt(run.bag, x, y) }, effects }
}

/** `town.tavernQuests` filtered by `visibleIf` — also the ONLY quest turn-in surface. */
export function tavernBoard(run: RunState, town: TownDef, env: EngineEnv): readonly TavernQuestEntry[] {
  void env
  const pred = predicateState(run)
  return town.tavernQuests.filter((row) => row.visibleIf === undefined || evaluate(row.visibleIf, pred))
}

/** Opens `pendingDialogue{source 'tavern'}`; refused if the row is not on the visible board. */
export function talk(run: RunState, questId: string, dialogueId: string, env: EngineEnv): SliceResult<RunState> {
  const town = currentTown(run, env)
  if (town === null) return refused(run, 'town/talk', 'not in a town')
  const row = tavernBoard(run, town, env).find((r) => r.questId === questId && r.dialogueId === dialogueId)
  if (row === undefined) return refused(run, 'town/talk', 'nobody by that name is in the tavern')
  return openDialogue(run, dialogueId, 'tavern', env)
}

/** The bounty desk's refusal, in the desk's words — a lowercase fragment completing an implied "because …"
 *  (ARCHITECTURE §5.1). Read by the flow gate too, so the unlit verb and the refusal are one sentence. */
export const NO_PRISONERS = 'no prisoners in the wagon'

/** Whether the wagon has anyone in it at all — the whole of `turnInAllPrisoners`' rule, in the module that owns it. */
export function hasPrisoners(run: RunState): boolean {
  return run.prisoners.length > 0
}

/**
 * gold += Σ bountyFor; rows removed; `prisonerTurnedIn` per row. `addGold` is the one owner of
 * `stats.goldEarned` (CONTRACT-CHANGES 0091) — a bounty is counted there, like every other coin.
 *
 * Prisoner rows are NOT unique by `unitId`: a repeatable encounter seeds stable enemy ids, so capturing the same
 * named bandit twice puts two rows in the wagon. Each requested id therefore CONSUMES one row (the first still
 * standing), so the number of rows removed always equals the number of bounties paid — a set-filter removed both
 * rows for one payment, and a `find` per id paid the same row twice on "turn in all".
 */
export function turnIn(run: RunState, unitIds: readonly UnitId[], env: EngineEnv): SliceResult<RunState> {
  const action: ActionType = unitIds.length === 1 ? 'town/turnInPrisoner' : 'town/turnInAllPrisoners'
  if (currentTown(run, env) === null) return refused(run, action, 'not in a town')
  if (unitIds.length === 0) return refused(run, action, NO_PRISONERS)
  const remaining = [...run.prisoners]
  const rows: Prisoner[] = []
  for (const id of unitIds) {
    const i = remaining.findIndex((p) => p.unitId === id)
    if (i < 0) return refused(run, action, 'no such prisoner')
    rows.push(remaining[i]!)
    remaining.splice(i, 1)
  }
  const effects: Effect[] = []
  let total = 0
  for (const p of rows) {
    const gold = bountyFor(p, env)
    total += gold
    effects.push({ kind: 'prisonerTurnedIn', unitId: p.unitId, gold })
  }
  effects.push({ kind: 'goldChanged', delta: total, reason: 'bounty' })
  const state: RunState = { ...addGold(run, total), prisoners: remaining }
  return { state, effects }
}
