#!/usr/bin/env tsx
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const CTX_PATH = join(ROOT, 'CONTEXT.md')
const SCAN_DIRS = ['src/domain', 'src/contracts', 'src/state', 'src/persistence']

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const s = statSync(p)
    if (s.isDirectory()) out.push(...walk(p))
    else if (entry.endsWith('.ts')) out.push(p)
  }
  return out
}

function extractExportedNames(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const names: string[] = []
  const patterns = [
    /export\s+(?:async\s+)?function\s+(\w+)/g,
    /export\s+(?:type|interface)\s+(\w+)/g,
    /export\s+const\s+(\w+)/g,
  ]
  for (const re of patterns) {
    let m
    while ((m = re.exec(src)) !== null) {
      const name = m[1]
      if (name && !name.startsWith('_')) names.push(name)
    }
  }
  return names
}

function main(): void {
  const ctx = readFileSync(CTX_PATH, 'utf8')
  const allNames = new Set<string>()
  for (const dir of SCAN_DIRS) {
    const files = walk(join(ROOT, dir))
    for (const f of files) for (const n of extractExportedNames(f)) allNames.add(n)
  }

  const allowSkip = new Set([
    // Test helpers / internal hooks
    '__brand', '__reset', '__resetForTest', '__busRefs',
    // 17 branded ID types — covered by §8 mention "17 branded ID types + as*() casts"
    'UnitId', 'ItemId', 'CardId', 'ClassId', 'StatusEffectId',
    'QuestId', 'StageId', 'DialogueId', 'DialogueNodeId',
    'DungeonId', 'EncounterId', 'EncounterTableId', 'EnemyGroupId', 'TileId',
    // Matching as*() cast helpers — same family
    'asUnitId', 'asItemId', 'asCardId', 'asClassId', 'asStatusEffectId',
    'asFlagKey', 'asQuestId', 'asStageId', 'asDialogueId', 'asDialogueNodeId',
    'asMapId', 'asNodeId', 'asDungeonId', 'asEncounterId', 'asEncounterTableId',
    'asEnemyGroupId', 'asTileId',
    // Combat-state internal sub-types — surfaced as fields of CombatState (§3, §11)
    'CombatPhase', 'CombatSubPhase', 'DeckState', 'CombatGrid', 'CombatTurn',
    'SpriteRef', 'CombatEffect', 'CardSource', 'CardTargetKind',
    'CardEffectTemplate', 'DamageKind', 'UnitHp', 'ActiveStatus', 'HandSlots',
    // Dialogue internals — DialogueTree is the agent-facing root
    'DialogueChoice', 'DialogueNode',
    // Domain leaf enums/types — covered by parent type references
    'Rarity', 'Region', 'ItemKind', 'QuiverEffectKind', 'QuiverModifier',
    'MapKind', 'TerrainTile', 'WorldNode', 'WorldEdge', 'EnemyGroupRef',
    // Flag/quest internal hook types — listener API surface, not agent-facing
    'FlagScope', 'QuestListenerEvent', 'HookCtx', 'SerializedFlag',
    // Bus/log entry shapes — factory functions are documented; entry types are detail
    'StoreName', 'ActionLogEntry', 'ErrorEntry',
  ])

  const missing: string[] = []
  for (const n of allNames) {
    if (allowSkip.has(n)) continue
    if (!ctx.includes(n)) missing.push(n)
  }

  if (missing.length > 0) {
    console.error('\n✖ CONTEXT.md drift detected. Missing references:')
    for (const m of missing.slice(0, 30)) console.error('  - ' + m)
    if (missing.length > 30) console.error(`  ... and ${missing.length - 30} more`)
    console.error('\nUpdate phaser/CONTEXT.md or add the name to allowSkip in scripts/check-context-doc.ts.')
    process.exit(1)
  }
  console.log('✓ CONTEXT.md is in sync with', allNames.size, 'exported names.')
}

main()
