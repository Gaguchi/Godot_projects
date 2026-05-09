import type { DialogueTree } from '../domain/dialogue'

/**
 * In-memory registry of loaded dialogue trees, keyed by DialogueId.
 *
 * GP-B3: starts empty, populated by GP-B5's `data/content/dialogue/*.json`
 * port. Until then, callers can register trees ad-hoc for testing.
 */
const registry = new Map<string, DialogueTree>()

export function registerDialogue(tree: DialogueTree): void {
  registry.set(tree.id as unknown as string, tree)
}

export function getDialogue(id: string): DialogueTree | undefined {
  return registry.get(id)
}

export function clearDialogues(): void {
  registry.clear()
}

export function listDialogueIds(): string[] {
  return Array.from(registry.keys())
}
