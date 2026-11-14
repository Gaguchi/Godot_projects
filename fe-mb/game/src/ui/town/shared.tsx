/**
 * ui/town/shared.tsx — what the town's screens share: where the art's things stand (`townArt.json`, written by
 * tools/pxworld `src/ux-town/export_game.py`), the keys every place screen answers, and the one selector that reads
 * the town the company is in.
 */
import { useCallback, useEffect, useRef } from 'react'
import { spriteIdFor } from '../../content/index'
import { overlayOf } from '../../engine/flow/pump'
import { foodCount } from '../../engine/run/bag'
import { innCost, shopStock } from '../../engine/run/economy'
import { displayName, livingUnits } from '../../engine/run/party'
import { tavernBoard } from '../../engine/run/town'
import type { EngineEnv, GameState, TownTab } from '../../engine/types'
import { className } from '../names'
import { getState, useEnv, useGame } from '../store'
import raw from './townArt.json'

type B4 = readonly [x: number, y: number, w: number, h: number]
interface TownArt {
  readonly square: {
    readonly box: Readonly<Record<'inn' | 'shop' | 'tavern' | 'road', B4>>
    readonly company: readonly [number, number]
    readonly figures: Readonly<Record<string, { readonly w: number; readonly h: number; readonly ax: number; readonly ay: number; readonly dx: number; readonly dy: number }>>
    readonly plates: Readonly<Record<'inn' | 'shop' | 'tavern', readonly [number, number]>>
    readonly roads: readonly (readonly [number, number])[]
  }
  readonly inn: { readonly counter: B4; readonly keeper: B4; readonly spots: readonly (readonly [number, number])[]; readonly feet: Readonly<Record<string, readonly [number, number]>> }
  readonly tavern: {
    readonly guest: { readonly foot: readonly [number, number]; readonly box: B4; readonly spriteFoot: readonly [number, number] }
    readonly barkeep: { readonly box: B4; readonly plate: readonly [number, number] }
    readonly desk: { readonly box: B4; readonly plate: readonly [number, number] }
  }
  /** The kit's own tables: which icon stands for each kind of goods. */
  readonly kit: { readonly itemIcon: Readonly<Record<string, string>> }
}
export const townArt = raw as unknown as TownArt

/** Where a 104 x 152 board sprite's feet are when the art does not say (the middle of its foot line). */
export const BOARD_FOOT: readonly [number, number] = [52, 146]

export const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'] as const
export const word = (n: number): string => WORDS[n] ?? String(n)

/** `Oak`, `Oak and Lilina`, `Oak, Lilina and Kael`. */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]!}`
}

/**
 * The keys a place screen answers (1-4, Enter, Esc, C). They are taken in the CAPTURE phase and marked handled, so
 * Esc means "back" here and never also opens Pause (`ui/modals` listens for the same key and skips a handled one);
 * and they stand down while a modal or an overlay owns the glass, or while the player is typing.
 */
export function usePlaceKeys(keys: Readonly<Record<string, (() => void) | undefined>>): void {
  const ref = useRef(keys)
  ref.current = keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      const s = getState()
      if (s.ui.modal !== null || overlayOf(s) !== null) return
      const t = e.target as HTMLElement | null
      if (t !== null && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      const fn = ref.current[e.key] ?? ref.current[e.key.toLowerCase()]
      if (fn === undefined) return
      e.preventDefault()
      fn()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
}

export interface TownMember {
  readonly id: string
  readonly name: string
  readonly role: string
  readonly sprite: string | null
  readonly hp: number
  readonly max: number
  readonly wounded: boolean
}

export interface TownView {
  readonly townId: string
  readonly name: string
  readonly description: string
  readonly region: string
  readonly tab: TownTab
  readonly day: number
  readonly gold: number
  readonly food: number
  readonly perHead: number
  readonly bill: number
  readonly party: readonly TownMember[]
  readonly stock: number
  readonly work: number
  readonly prisoners: number
}

function selectTown(s: GameState, env: EngineEnv): TownView | null {
  const run = s.run
  if (run === null || run.town === null) return null
  const town = env.content.towns[run.town.townId]
  if (town === undefined) return null
  const cost = innCost(town, run, env)
  return {
    townId: town.id,
    name: town.name,
    description: town.description,
    region: env.content.regions[town.regionId]?.name ?? town.regionId,
    tab: s.ui.townTab,
    day: run.daysElapsed,
    gold: run.gold,
    food: foodCount(run.bag, env),
    perHead: town.innHealCostPerUnit,
    bill: cost.total,
    party: livingUnits(run).map((u) => ({
      id: u.id, name: displayName(u, run), role: className(u.classId, env), sprite: spriteIdFor(u.id, u.classId),
      hp: u.hp.current, max: u.hp.max, wounded: cost.wounded.includes(u.id),
    })),
    stock: shopStock(town, run, env).length,
    work: tavernBoard(run, town, env).length,
    prisoners: run.prisoners.length,
  }
}

/** The town the company is in, as every town screen reads it. */
export function useTown(): TownView | null {
  const env = useEnv()
  return useGame(useCallback((s: GameState) => selectTown(s, env), [env]), (a, b) => JSON.stringify(a) === JSON.stringify(b))
}
