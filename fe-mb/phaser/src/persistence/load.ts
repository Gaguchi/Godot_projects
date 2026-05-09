import { z } from 'zod'
import type { SaveFile } from './saveFormat'
import { SAVE_VERSION } from './saveFormat'
import { resolveAlias } from './contentAliases'

const SerializedFlagSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  scope: z.enum(['run', 'quest', 'battle', 'permanent']),
})

const SerializedRunSchema = z.object({
  runId: z.string(),
  runSeed: z.number(),
  partyUnits: z.array(z.unknown()),
  partyOrder: z.array(z.string()),
  inventoryItems: z.array(z.object({ itemId: z.string(), gridX: z.number(), gridY: z.number() })),
  gold: z.number(),
  worldPosition: z.object({ mapId: z.string(), nodeId: z.string() }),
  visitedNodes: z.record(z.string(), z.boolean()),
  clearedEncounters: z.record(z.string(), z.boolean()),
  pendingTravelPath: z.unknown(),
  flags: z.array(SerializedFlagSchema),
  questStates: z.record(z.string(), z.object({ currentStage: z.string(), metadata: z.record(z.string(), z.unknown()) })),
  activeDungeon: z.unknown(),
  rngState: z.object({ seed: z.number(), counter: z.number() }),
  deathLog: z.array(z.object({ unitId: z.string(), cause: z.string(), turn: z.number() })),
})

const SaveFileSchema = z.object({
  saveVersion: z.string(),
  createdAt: z.number(),
  meta: z.object({ gameStarted: z.boolean(), totalRuns: z.number() }),
  run: SerializedRunSchema.nullable(),
  combat: z.unknown().nullable(),
  actionLog: z.array(z.unknown()),
  contentAliasesApplied: z.string(),
})

export type LoadResult =
  | { ok: true; save: SaveFile; warnings: string[] }
  | { ok: false; error: string }

export function loadFromString(raw: string): LoadResult {
  let parsed: unknown
  try { parsed = JSON.parse(raw) }
  catch (e) { return { ok: false, error: `JSON parse failed: ${(e as Error).message}` } }

  const r = SaveFileSchema.safeParse(parsed)
  if (!r.success) return { ok: false, error: `Schema validation failed: ${r.error.message}` }

  const save = r.data as unknown as SaveFile
  const warnings: string[] = []

  if (save.saveVersion !== SAVE_VERSION) {
    warnings.push(`Save version ${save.saveVersion} differs from current ${SAVE_VERSION} — pre-alpha policy: nuke or proceed with caution.`)
  }

  if (save.run) {
    save.run.inventoryItems = save.run.inventoryItems.map(i => {
      const resolved = resolveAlias('itemId', i.itemId)
      if (resolved !== i.itemId) warnings.push(`alias: itemId ${i.itemId} -> ${resolved}`)
      return { ...i, itemId: resolved }
    })
    save.run.flags = save.run.flags.map(f => {
      const resolved = resolveAlias('flagKey', f.key)
      if (resolved !== f.key) warnings.push(`alias: flagKey ${f.key} -> ${resolved}`)
      return { ...f, key: resolved }
    })
  }

  return { ok: true, save, warnings }
}
