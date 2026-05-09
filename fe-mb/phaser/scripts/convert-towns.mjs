#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PHASER_ROOT = dirname(__dirname)
const REPO_ROOT = dirname(PHASER_ROOT)
const SRC_DIR = join(REPO_ROOT, 'data', 'towns')
const DST_DIR = join(PHASER_ROOT, 'src', 'data', 'content', 'towns')

// Town id → region id (from overworld.json)
const REGION_OF = {
  pine_crossing: 'borderlands',
  riverside_market: 'borderlands',
  south_junction: 'borderlands',
  borderkeep_castle: 'thornwood',
  northern_bridge: 'thornwood',
}

// Whitelist of consumable item ids that survive equipment removal.
const CONSUMABLES = new Set(['food_rations', 'healing_potion', 'power_elixir', 'vulnerary'])
function filterStock(stock) {
  return stock.filter((id) => {
    if (CONSUMABLES.has(id)) return id === 'vulnerary' ? 'healing_potion' : id
    return false
  }).map((id) => id === 'vulnerary' ? 'healing_potion' : id)
}

function convertCondition(c) {
  if (!c) return undefined
  if (c.type === 'has_flag') return { kind: 'flag', key: c.flag, equals: true }
  if (c.type === 'not_flag') return { kind: 'notFlag', key: c.flag }
  if (c.type === 'has_gold') return { kind: 'goldAtLeast', amount: c.amount }
  return undefined
}

function townIdFromName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

mkdirSync(DST_DIR, { recursive: true })
const files = readdirSync(SRC_DIR).filter((f) => f.endsWith('.json'))

for (const f of files) {
  const godot = JSON.parse(readFileSync(join(SRC_DIR, f), 'utf8'))
  const id = basename(f, '.json')
  const buildings = godot.buildings ?? {}

  const tavernQuests = (buildings.tavern?.quests ?? []).map((q) => {
    const conds = (q.show_conditions ?? []).map(convertCondition).filter(Boolean)
    const visibleIf = conds.length === 1 ? conds[0]
      : conds.length > 1 ? { kind: 'allOf', preds: conds }
      : undefined
    const out = {
      questId: q.quest_id,
      npcName: q.npc_name,
      npcDescription: q.npc_desc,
      dialogueId: q.dialogue_id,
    }
    if (visibleIf) out.visibleIf = visibleIf
    return out
  })

  const phaser = {
    id,
    name: godot.name,
    description: godot.description ?? '',
    regionId: REGION_OF[id],
    innHealCostPerUnit: buildings.inn?.heal_cost_per_unit ?? 10,
    shopStockIds: filterStock(buildings.shop?.stock ?? []),
    rumors: buildings.tavern?.rumors ?? [],
    tavernQuests,
    blacksmithEnabled: !!buildings.blacksmith,
    arenaLocked: !!(buildings.arena?.locked),
    arenaLockedText: buildings.arena?.locked_text,
  }
  // Drop undefined fields
  for (const k of Object.keys(phaser)) {
    if (phaser[k] === undefined) delete phaser[k]
  }

  writeFileSync(join(DST_DIR, f), JSON.stringify(phaser, null, 2) + '\n')
  console.log(`✓ ${f}: ${phaser.shopStockIds.length} stock, ${phaser.rumors.length} rumors, ${phaser.tavernQuests.length} quests`)
}
