/**
 * ui/combat/chronicle.ts — the battle's own account of itself, in words.
 *
 * A blow is on the glass for 700ms as a float over a tile and is then gone forever. Look away while the enemy
 * phase pumps four actions and the board simply changes: two units are lower, a status is on somebody, and
 * nothing anywhere says what happened. Every tactics game worth the name keeps a log; this one had 256x144 of
 * empty leather at the bottom-left of the field instead (RE-GATE B 2.9) and no answer to "what just hit me".
 *
 * The VOCABULARY moved to `engine/narration.ts` (FINAL GATE A 1.5): the headless game narrates the same effect
 * stream and `scripts/**` may not import `ui/**` (CONTRACT §6), so a second copy of these sentences would have
 * been a §5.1 violation waiting to happen — the 0094 shape. What stays here is the PLATE: which kinds it keeps
 * (`CHRONICLE_KINDS` — the log answers "what changed" out of the corner of one eye, so the pumps and the whole
 * run-level vocabulary are the terminal's alone), how many lines it holds, and the ids the list renders by.
 */
import { battleLine, type LinePart, type NameBook } from '../../engine/narration'
import type { Effect } from '../../engine/effects'

export type { LinePart } from '../../engine/narration'
/** The names a line needs, injected — so a vitest case can drive the whole vocabulary without a board. */
export type Names = NameBook

export interface ChronicleLine {
  readonly id: number
  readonly parts: readonly LinePart[]
  /** Which side the line is about - the log is read at a glance and a loss must not look like a gain. */
  readonly tone: 'harm' | 'mend' | 'plain'
}

/** How many lines the plate holds. Older ones are dropped: this is the last of it, not a transcript. */
export const CHRONICLE_KEPT = 4

/**
 * One effect -> one line, or none. Deliberately narrow: the log answers "what changed", so the pumps
 * (`turnStarted`, `cardsDrawn`, `apChanged`, `enemyActed`, `sound`, `autosave`) are silent - a log that prints
 * every effect is a debug console, and the player is reading it out of the corner of one eye.
 */
export function chronicleParts(e: Effect, names: Names): { readonly parts: readonly LinePart[]; readonly tone: ChronicleLine['tone'] } | null {
  return battleLine(e, names)
}

/** Append a batch of effects to a log, keeping the tail. `seq` is the last id handed out. */
export function extend(log: readonly ChronicleLine[], effects: readonly Effect[], names: Names, seq: number): { readonly log: readonly ChronicleLine[]; readonly seq: number } {
  let next = seq
  const added: ChronicleLine[] = []
  for (const e of effects) {
    const line = chronicleParts(e, names)
    if (line !== null) added.push({ id: ++next, parts: line.parts, tone: line.tone })
  }
  if (added.length === 0) return { log, seq }
  const all = [...log, ...added]
  return { log: all.slice(Math.max(0, all.length - CHRONICLE_KEPT)), seq: next }
}
