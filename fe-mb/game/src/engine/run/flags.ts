/**
 * run/flags.ts — typed-scoped flags (brief §2.12). Scopes run|quest|battle|permanent; `battle` is cleared
 * by `applyBattleResult`, `quest` by `completeQuest`; `permanent` is never cleared within the run.
 * Flags do NOT cross runs (cross-run memory is `MetaState`).
 *
 * A flag is a plain `{ value, scope }` entry keyed by its content id. Setting an existing key REPLACES the
 * entry (value and scope) — the last writer wins, which is what a content author expects from `setFlag`.
 */
import type { SliceResult } from '../actions'
import type { FlagEntry, Flags, FlagScope, FlagValue, RunState } from '../types'

/** Emits `flagSet` (the §2.12 domain event, from a reducer path — never a screen). */
export function setFlag(run: RunState, key: string, value: FlagValue, scope: FlagScope): SliceResult<RunState> {
  const entry: FlagEntry = { value, scope }
  return {
    state: { ...run, flags: { ...run.flags, [key]: entry } },
    effects: [{ kind: 'flagSet', key, value, scope }],
  }
}

/** Drops every flag of `scope`. Returns the SAME run reference when nothing was cleared, so `flow/settle.ts`
 *  can detect "nothing changed" by identity. `permanent` is excluded at the type level (brief §2.12). */
export function clearFlagScope(run: RunState, scope: Exclude<FlagScope, 'permanent'>): RunState {
  const kept: Record<string, FlagEntry> = {}
  let removed = 0
  for (const [key, entry] of Object.entries(run.flags)) {
    if (entry.scope === scope) removed++
    else kept[key] = entry
  }
  return removed === 0 ? run : { ...run, flags: kept }
}

export function getFlag(flags: Flags, key: string): FlagEntry | null {
  return flags[key] ?? null
}
