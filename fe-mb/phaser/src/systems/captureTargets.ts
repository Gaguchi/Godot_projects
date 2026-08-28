import type { CaptureTarget } from '../domain/encounter'
import type { QuestEffect } from '../domain/quest'
import type { FlagKey, DialogueId } from '../domain/ids'

/**
 * Resolve an encounter's capture targets against how the battle actually went.
 *
 * A named enemy an encounter cares about — Daren in Blood Ties — can leave the
 * field two ways, and the story wants to know which: taken alive (`capturedIds`
 * from the battle result) or killed. Until now `captureTargets` was declared in
 * both the domain type and the Zod schema and read by absolutely nothing, so
 * the Blood Ties capture chain could never fire and the quest advanced only via
 * a dialogue the player might not see.
 *
 * Pure: takes the targets and the battle outcome, returns quest effects. No
 * store, no I/O — the caller dispatches what comes back.
 *
 * Identity is by unit ID, never display name (the user's explicit call when the
 * identity layer landed: renames must stay data-only).
 */
export function resolveCaptureTargets(
  targets: readonly CaptureTarget[],
  outcome: {
    /** Unit ids taken alive. */
    capturedIds: readonly string[]
    /** Unit ids still standing when the battle ended — neither captured nor dead. */
    survivingEnemyIds?: readonly string[]
  },
): QuestEffect[] {
  const effects: QuestEffect[] = []
  const captured = new Set(outcome.capturedIds)
  const survived = new Set(outcome.survivingEnemyIds ?? [])

  for (const t of targets) {
    if (captured.has(t.unitId)) {
      effects.push({ kind: 'setFlag', key: t.capturedFlag as unknown as FlagKey, value: true })
      effects.push({ kind: 'startDialogue', treeId: t.capturedDialogueId as unknown as DialogueId })
      continue
    }
    // Not captured and not still standing ⇒ they died. A target who is
    // somehow still alive (fled, battle ended early) resolves to nothing, so
    // the quest stays where it is rather than lying about the outcome.
    if (!survived.has(t.unitId)) {
      effects.push({ kind: 'setFlag', key: t.killedFlag as unknown as FlagKey, value: true })
      effects.push({ kind: 'startDialogue', treeId: t.killedDialogueId as unknown as DialogueId })
    }
  }

  // Only ONE dialogue can be pending at a time (runStore.pendingDialogue is a
  // single slot), so if several targets resolved, keep every flag but drop all
  // but the first dialogue rather than silently clobbering.
  let seenDialogue = false
  return effects.filter(e => {
    if (e.kind !== 'startDialogue') return true
    if (seenDialogue) return false
    seenDialogue = true
    return true
  })
}
