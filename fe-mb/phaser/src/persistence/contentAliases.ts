export const CONTENT_ALIASES_VERSION = '2026-05-08' as const

export interface ContentAliases {
  cardId: Record<string, string>
  itemId: Record<string, string>
  flagKey: Record<string, string>
  questId: Record<string, string>
  stageId: Record<string, string>
  dungeonId: Record<string, string>
  mapId: Record<string, string>
}

export const ALIASES: ContentAliases = {
  cardId: {},
  itemId: {},
  flagKey: {},
  questId: {},
  stageId: {},
  dungeonId: {},
  mapId: {},
}

export function resolveAlias(category: keyof ContentAliases, id: string): string {
  return ALIASES[category][id] ?? id
}
