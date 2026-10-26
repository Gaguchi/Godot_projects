/**
 * ui/names.ts — the DISPLAY-NAME layer. Nothing player-facing may show an id
 * (ARCHITECTURE §5; crafting-game-ui signal C "Player-visible dev strings").
 *
 * Every id the UI holds already has an authored name somewhere in `content`:
 * `classes.json` ships `"name": "Lord"`, the overworld sheet ships
 * `"name": "Frontier Camp"`. Seven screens were instead printing
 * `id.replace(/_/g, ' ')`, so the roster read `shield knight` and the Title
 * screen read `darens camp`. These helpers are the ONE place that lookup
 * lives; `id.replace(/_/g, ' ')` is banned by `tests/unit/ui/materials.test.ts`.
 *
 * The unit's own name is not here — that is `engine/run/party.ts#displayName`,
 * because the player's chosen MC name is run state, not content.
 */
import { MC_ID } from '../engine/run/party'
import type { EngineEnv } from '../engine/types'

/**
 * A quest STAGE's line. The lookup lives in `engine/run/quests.ts` because the headless game prints Contracts too
 * (CONTRACT §10) and `scripts/**` may not import `ui/**`; it is re-exported here so screens keep asking the
 * display-name layer for it (CONTRACT-CHANGES 0093). It reads the stage's AUTHORED `label` — the derivation it
 * replaced printed a character's name lower-cased ("Find daren", FINAL GATE C 3.4).
 */
export { stageLabel } from '../engine/run/quests'

/**
 * A person's INITIALS, for the 40px face frames a unit with no art at all would fall through to.
 *
 * FINAL GATE C 3.10 found `displayName.slice(0, 2)` copy-pasted into eight slots, and a slice of a word is not an
 * initial: "Guildmistress Anya" came out as "Gu", a two-letter piece of a title. The only slot a portrait-less
 * character can actually reach today is the talk bust, and that one is drawn (`components/Sigil`); these are the
 * belt-and-braces ones, and they take the first letter of each of the first two words.
 */
export function initialsOf(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 0)
  return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('')
}

/**
 * Last-resort humanisation for an id no content row claims. Reachable only
 * when a save outlives the content that named it (pre-alpha nukes those, so
 * this is belt-and-braces) — never the normal path.
 */
function humanise(id: string): string {
  return id.replace(/_/g, ' ').replace(/(^|\s)\p{Ll}/gu, (m) => m.toUpperCase())
}

/** `classes.json`'s authored name — "Shield Knight", never `shield_knight`. */
export function className(classId: string, env: EngineEnv): string {
  return env.content.classes[classId]?.name ?? humanise(classId)
}

/** The overworld sheet's authored place name — "Frontier Camp", never `frontier_camp`. */
export function placeName(nodeId: string | null, env: EngineEnv): string | null {
  if (nodeId === null) return null
  return env.content.overworld.nodes.find((n) => n.id === nodeId)?.name ?? humanise(nodeId)
}

/** A quest's authored name, for the log and the band. */
export function questName(questId: string, env: EngineEnv): string {
  return env.content.quests[questId]?.name ?? humanise(questId)
}

/**
 * The two names the PLAYER writes, and what they are called before that.
 *
 * The MC's stand-in is `characters.json`'s own `displayName` ("The Foundling") — the SAME string
 * `run/party.ts#displayName` answers with, so a ledger sentence and the roll of the fallen one line under it can
 * never be two capitalisations of one name. Both surfaces used to hard-code a lowercase copy ("the foundling",
 * "the company") and the win page read "Under the foundling, the company took the throne" directly above a roll
 * that read "The Foundling" (RE-GATE B 2.2). A person and a company are Named things: Title Case (§5.1).
 */
const UNNAMED_COMPANY = 'The Company'

export function mcName(chosen: string | null, env: EngineEnv): string {
  return chosen ?? env.content.characters[MC_ID]?.displayName ?? 'The Foundling'
}

export function companyName(chosen: string | null): string {
  return chosen ?? UNNAMED_COMPANY
}
