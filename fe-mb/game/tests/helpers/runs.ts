/**
 * tests/helpers/runs.ts — run-side fixtures (CONTRACT §7 harness; written by WP-RUN-CORE).
 * Everything here goes through the REAL seeder so a fixture can never drift from `seedNewRun`.
 */
import { content } from '../../src/content/index'
import { createEnv } from '../../src/engine/content'
import { placeInBag } from '../../src/engine/run/bag'
import { seedNewRun } from '../../src/engine/run/newRun'
import type { BagEntry, Character, EngineEnv, Item, RunState, Unit } from '../../src/engine/types'

/** The shipped content + shipped rules, built once per test file (frozen, safe to share). */
export const env: EngineEnv = createEnv()

export function newRun(seed = 1, e: EngineEnv = env): RunState {
  return seedNewRun(seed, e)
}

/** The shipped content with extra / replaced characters (party cap tests, recruit-with-bag tests). */
export function envWithCharacters(extra: Readonly<Record<string, Character>>, e: EngineEnv = env): EngineEnv {
  return createEnv({ ...content, characters: { ...content.characters, ...extra } }, e.rules)
}

export function withBag(run: RunState, bag: readonly BagEntry[]): RunState {
  return { ...run, bag }
}

/** Insert or replace one party unit (keeps `partyOrder` in sync for a new id). */
export function withUnit(run: RunState, unit: Unit): RunState {
  const partyOrder = run.partyOrder.includes(unit.id) ? run.partyOrder : [...run.partyOrder, unit.id]
  return { ...run, party: { ...run.party, [unit.id]: unit }, partyOrder }
}

export function itemsWhere(pred: (i: Item) => boolean, e: EngineEnv = env): readonly Item[] {
  return Object.values(e.content.items).filter(pred)
}

export function itemWhere(pred: (i: Item) => boolean, e: EngineEnv = env): Item {
  const item = itemsWhere(pred, e)[0]
  if (item === undefined) throw new Error('fixture: no item matches')
  return item
}

/** A 1×1 potion — the smallest thing that can occupy a bag cell. */
export function smallestItem(e: EngineEnv = env): Item {
  return itemWhere((i) => i.kind === 'potion' && i.gridSize.width === 1 && i.gridSize.height === 1, e)
}

/** Fill every free cell of the run's bag with 1×1 potions (leaves `leave` cells free when asked). */
export function fillBag(run: RunState, leave = 0, e: EngineEnv = env): RunState {
  const potion = smallestItem(e)
  let bag = run.bag
  const free: BagEntry[] = []
  for (;;) {
    const next = placeInBag(bag, [potion.id], e)
    if (next === null) break
    bag = next
    free.push(next[next.length - 1]!)
  }
  // Give back the last `leave` placements so exactly that many 1×1 cells stay open.
  const keep = free.slice(0, free.length - leave)
  return { ...run, bag: [...run.bag, ...keep] }
}
