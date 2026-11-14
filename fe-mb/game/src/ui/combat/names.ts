/**
 * ui/combat/names.ts — what everyone on the field is called, on every surface of the battle.
 *
 * One of ours is called what the player called them (`run/party.ts#displayName`). Foes come in groups, and a group
 * is three of the same name: "Obsidian Fighter strikes Lilina" and a forecast "at Obsidian Fighter" do not say
 * WHICH. So where two foes on a field share a name each takes a number, in the order the engine made them (their
 * ids), and wears it everywhere at once: the turn list, the forecast, the blow-by-blow, and a small plaque on the
 * figure itself. A lone foe keeps its bare name. Pure: the same field always numbers the same way.
 */
import { displayName } from '../../engine/run/party'
import type { CombatState, RunState } from '../../engine/types'

export interface FieldName {
  /** The name to print. */
  readonly name: string
  /** The number a same-named foe wears, or null. */
  readonly ordinal: number | null
}

export function fieldNames(combat: CombatState, run: RunState | null): Readonly<Record<string, FieldName>> {
  const out: Record<string, FieldName> = {}
  const groups = new Map<string, string[]>()
  for (const u of Object.values(combat.units)) {
    if (u.team === 'party') out[u.id] = { name: run === null ? u.name : displayName(u, run), ordinal: null }
    else groups.set(u.name, [...(groups.get(u.name) ?? []), u.id])
  }
  for (const [name, ids] of groups) {
    const sorted = [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    sorted.forEach((id, i) => { out[id] = sorted.length === 1 ? { name, ordinal: null } : { name: `${name} ${i + 1}`, ordinal: i + 1 } })
  }
  return out
}
