/**
 * save/codec.ts — GameState ⇄ SaveFile ⇄ JSON (brief §2.14). One autosave per run (`rules.save.runKey`)
 * + meta (`rules.save.metaKey`); pre-alpha: a version/content mismatch nukes with a loud reason
 * (`rules.save.nukeOnMismatch: true`, read by `parseSaveWith`; no migrations — brief §2.14 "schema bump nukes saves
 * with a loud warning"). With the knob `false` the stamps are not compared and the strict mirror is the only gate: a
 * stale file whose shape still matches loads, one whose shape drifted reports `schema` instead of `version`.
 *
 * The three persisted slices go in and out VERBATIM (CONTRACT-CHANGES 0016): `toSaveFile` copies references,
 * `fromSaveFile` installs them, so `fromSaveFile(toSaveFile(s))` deep-equals `s` on meta/run/combat — a
 * mid-selection battle resumes mid-selection. `screen`, `ledger` and `ui` are never written (CONTRACT-CHANGES
 * 0008): a reload lands on Title and Continue routes through `flow/pump.ts#resumeScreen`.
 */
import type { ZodIssue } from 'zod'
import { z } from 'zod'
import type { EngineEnv, GameState, MetaState, SaveFile, UiState } from '../types'
import { checkInvariants } from '../flow/invariants'
import { formatPath, metaStateSchema, saveFileSchema } from './schema'

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: 'version' | 'content' | 'schema' | 'json'; readonly detail: string }

/** `flow/invariants.ts#checkInvariants`' shape — injectable so the codec can be tested before / without the flow package. */
export type InvariantCheck = (state: GameState, env: EngineEnv) => readonly string[]

/** The ephemeral slice every hydrated state starts with (`ui` is never persisted; `flow/lifecycle.ts` may reuse it). */
export const DEFAULT_UI: UiState = Object.freeze({
  modal: null,
  townTab: 'inn',
  showDanger: false,
  devHud: false,
  mapPan: null,
})

export function defaultUiState(): UiState {
  return DEFAULT_UI
}

/** `{ saveVersion, contentVersion, meta, run, combat }` — the slices VERBATIM (selection included; nothing is rewritten),
 *  so `fromSaveFile(toSaveFile(s))` deep-equals `s` on those slices. `ui`, `ledger` and `screen` are not persisted. */
export function toSaveFile(state: GameState, env: EngineEnv): SaveFile {
  return {
    saveVersion: env.rules.save.version,
    contentVersion: env.content.version,
    meta: state.meta,
    run: state.run,
    combat: state.combat,
  }
}

/** meta/run/combat as-is; `ledger: null`, `screen: { kind: 'title' }`, ui defaults — the Title decides (Continue → `resumeScreen`). */
export function fromSaveFile(file: SaveFile): GameState {
  return {
    meta: file.meta,
    run: file.run,
    combat: file.combat,
    ledger: null,
    screen: { kind: 'title' },
    ui: DEFAULT_UI,
  }
}

export function serialize(file: SaveFile): string {
  return JSON.stringify(file)
}

/** The two version stamps, read loosely BEFORE the strict parse so an old file reports `version`, not a wall of
 *  shape errors (the pre-alpha nuke message names the version that changed). */
const headerSchema = z.object({ saveVersion: z.string(), contentVersion: z.string() }).passthrough()

function formatIssues(issues: readonly ZodIssue[]): string {
  return issues.map((i) => `${formatPath(i.path) || '<root>'}: ${i.message}`).join('; ')
}

function parseJson(json: string): { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly detail: string } {
  try {
    return { ok: true, value: JSON.parse(json) }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * JSON → version stamps → strict Zod → `invariants(fromSaveFile(file), env)`. Order rationale: a file written by
 * another save/content version is reported as `version` / `content` even though its shape is also stale (that is
 * the nuke message the player sees); a file from THIS version is then held to the strict mirror and, past that, to
 * the flow invariants — a shape-valid but slot-inconsistent file (`turn.unitId` not in `units`, a bag rectangle
 * outside 8×4, …) comes back as `{ ok: false, reason: 'schema', detail: violations.join('; ') }` instead of throwing
 * inside the first selector (§2.14 rule 4: failure → Title with a loud toast, stores untouched).
 *
 * The stamp comparison is `rules.save.nukeOnMismatch` (pre-alpha `true`). `false` skips it — no migrations exist,
 * so the strict mirror alone decides and a mismatched file loads only when its shape still matches.
 */
export function parseSaveWith(json: string, env: EngineEnv, invariants: InvariantCheck): ParseResult<SaveFile> {
  const raw = parseJson(json)
  if (!raw.ok) return { ok: false, reason: 'json', detail: raw.detail }

  const header = env.rules.save.nukeOnMismatch ? headerSchema.safeParse(raw.value) : null
  if (header?.success) {
    if (header.data.saveVersion !== env.rules.save.version) {
      return { ok: false, reason: 'version', detail: `saveVersion '${header.data.saveVersion}' ≠ '${env.rules.save.version}'` }
    }
    if (header.data.contentVersion !== env.content.version) {
      return { ok: false, reason: 'content', detail: `contentVersion '${header.data.contentVersion}' ≠ '${env.content.version}'` }
    }
  }

  const parsed = saveFileSchema().safeParse(raw.value)
  if (!parsed.success) return { ok: false, reason: 'schema', detail: formatIssues(parsed.error.issues) }

  const violations = invariants(fromSaveFile(parsed.data), env)
  if (violations.length > 0) return { ok: false, reason: 'schema', detail: violations.join('; ') }

  return { ok: true, value: parsed.data }
}

/** JSON → strict Zod → saveVersion / contentVersion check → `checkInvariants(fromSaveFile(file), env)`: a shape-valid
 *  but slot-inconsistent file (`turn.unitId` not in `units`, a bag rectangle outside 8×4, …) is rejected as
 *  `{ ok: false, reason: 'schema', detail: violations.join('; ') }` instead of throwing inside the first selector. */
export function parseSave(json: string, env: EngineEnv): ParseResult<SaveFile> {
  return parseSaveWith(json, env, checkInvariants)
}

/** `rules.save.metaKey` holds a bare `MetaState` (no version stamp: meta has survived every run since the first boot). */
export function parseMeta(json: string): ParseResult<MetaState> {
  const raw = parseJson(json)
  if (!raw.ok) return { ok: false, reason: 'json', detail: raw.detail }
  const parsed = metaStateSchema().safeParse(raw.value)
  if (!parsed.success) return { ok: false, reason: 'schema', detail: formatIssues(parsed.error.issues) }
  return { ok: true, value: parsed.data }
}
