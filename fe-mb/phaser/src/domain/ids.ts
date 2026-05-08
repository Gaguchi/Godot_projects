declare const __brand: unique symbol
type Brand<T, B> = T & { readonly [__brand]: B }

export type UnitId       = Brand<string, 'UnitId'>
export type ItemId       = Brand<string, 'ItemId'>
export type CardId       = Brand<string, 'CardId'>
export type ClassId      = Brand<string, 'ClassId'>
export type StatusEffectId = Brand<string, 'StatusEffectId'>
export type FlagKey      = Brand<string, 'FlagKey'>
export type QuestId      = Brand<string, 'QuestId'>
export type StageId      = Brand<string, 'StageId'>
export type DialogueId   = Brand<string, 'DialogueId'>
export type DialogueNodeId = Brand<string, 'DialogueNodeId'>
export type MapId        = Brand<string, 'MapId'>
export type NodeId       = Brand<string, 'NodeId'>
export type DungeonId    = Brand<string, 'DungeonId'>
export type EncounterId  = Brand<string, 'EncounterId'>
export type EncounterTableId = Brand<string, 'EncounterTableId'>
export type EnemyGroupId = Brand<string, 'EnemyGroupId'>
export type TileId       = Brand<string, 'TileId'>

export const asUnitId       = (s: string): UnitId       => s as UnitId
export const asItemId       = (s: string): ItemId       => s as ItemId
export const asCardId       = (s: string): CardId       => s as CardId
export const asClassId      = (s: string): ClassId      => s as ClassId
export const asStatusEffectId = (s: string): StatusEffectId => s as StatusEffectId
export const asFlagKey      = (s: string): FlagKey      => s as FlagKey
export const asQuestId      = (s: string): QuestId      => s as QuestId
export const asStageId      = (s: string): StageId      => s as StageId
export const asDialogueId   = (s: string): DialogueId   => s as DialogueId
export const asDialogueNodeId = (s: string): DialogueNodeId => s as DialogueNodeId
export const asMapId        = (s: string): MapId        => s as MapId
export const asNodeId       = (s: string): NodeId       => s as NodeId
export const asDungeonId    = (s: string): DungeonId    => s as DungeonId
export const asEncounterId  = (s: string): EncounterId  => s as EncounterId
export const asEncounterTableId = (s: string): EncounterTableId => s as EncounterTableId
export const asEnemyGroupId = (s: string): EnemyGroupId => s as EnemyGroupId
export const asTileId       = (s: string): TileId       => s as TileId
