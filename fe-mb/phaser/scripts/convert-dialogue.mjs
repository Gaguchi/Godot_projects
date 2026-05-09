#!/usr/bin/env node
/**
 * Convert Godot dialogue JSON (data/dialogue/*.json) to phaser DialogueTree.
 *
 * Godot shape: { id, lines: [ { id, speaker?, text, portrait?, next?, choices?, effects? } ] }
 * Phaser shape: { id, startNodeId, nodes: { [id]: DialogueNode } }
 *
 * Run: node scripts/convert-dialogue.mjs ../data/dialogue/<file>.json src/data/content/dialogue/<file>.json
 *
 * Or to convert all 8 user-facing dialogues:
 *   node scripts/convert-dialogue.mjs --all
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PHASER_ROOT = dirname(__dirname)
const REPO_ROOT = dirname(PHASER_ROOT)
const GODOT_DIR = join(REPO_ROOT, 'data', 'dialogue')
const PHASER_DIR = join(PHASER_ROOT, 'src', 'data', 'content', 'dialogue')

// Quest stage index → stage id mapping. Per-quest because Godot uses numeric
// stage indices but phaser uses named stage ids.
const QUEST_STAGE_MAP = {
  sq_blood_ties: { 0: 'find_daren', 1: 'find_daren', 2: 'daren_resolved' },
}

// "strength" → "str" etc.
const STAT_MAP = {
  strength: 'str', str: 'str',
  magic: 'mag', mag: 'mag',
  skill: 'skl', skl: 'skl',
  speed: 'spd', spd: 'spd',
  defense: 'def', def: 'def',
  resistance: 'res', res: 'res',
  luck: 'lck', lck: 'lck',
}

function convertEffect(godotEffect) {
  switch (godotEffect.type) {
    case 'set_flag':
      return { kind: 'setFlag', key: godotEffect.flag, value: true, scope: 'permanent' }
    case 'add_gold':
      return { kind: 'addGold', amount: godotEffect.amount }
    case 'add_food':
      return { kind: 'addFood', amount: godotEffect.amount }
    case 'damage_party':
      return { kind: 'damageParty', amount: godotEffect.amount }
    case 'heal_party':
      return { kind: 'healParty', percent: godotEffect.percent ?? godotEffect.amount ?? 0.3 }
    case 'start_quest': {
      const qid = godotEffect.quest_id
      const initialStage = (QUEST_STAGE_MAP[qid] && QUEST_STAGE_MAP[qid][0]) || 'start'
      return { kind: 'advanceQuestStage', questId: qid, toStage: initialStage }
    }
    case 'advance_quest': {
      const qid = godotEffect.quest_id
      const stageIdx = godotEffect.stage
      const stageId = (QUEST_STAGE_MAP[qid] && QUEST_STAGE_MAP[qid][stageIdx]) || `stage_${stageIdx}`
      return { kind: 'advanceQuestStage', questId: qid, toStage: stageId }
    }
    case 'complete_quest':
      return { kind: 'completeQuest', questId: godotEffect.quest_id }
    case 'start_combat':
      return { kind: 'startCombat', enemyGroupId: godotEffect.enemy_group }
    case 'recruit_unit': {
      const cls = (godotEffect.unit_class ?? '').toLowerCase()
      return { kind: 'recruitUnit', classId: cls || 'lord', level: godotEffect.level ?? 1 }
    }
    case 'give_item':
      // Godot give_item carried weapon items; phaser items are consumables only.
      // Map to addFood as a sane default for the only remaining gift kind.
      return { kind: 'addFood', amount: godotEffect.amount ?? 1 }
    default:
      // Unknown — drop with a warning (don't poison the JSON output).
      console.warn(`  ! dropped unknown effect: ${godotEffect.type}`)
      return null
  }
}

function convertCondition(godotCondition) {
  if (!godotCondition) return undefined
  switch (godotCondition.type) {
    case 'has_gold':
      return { kind: 'goldAtLeast', amount: godotCondition.amount }
    case 'has_flag':
      return { kind: 'flag', key: godotCondition.flag, equals: true }
    case 'not_flag':
      return { kind: 'notFlag', key: godotCondition.flag }
    default:
      return { kind: 'always' }
  }
}

/**
 * Find the stat_check effect in a Godot choice's effects array, return the
 * branch info, and return remaining effects (with stat_check stripped).
 */
function extractStatCheck(godotChoice) {
  const effects = godotChoice.effects ?? []
  const sc = effects.find((e) => e.type === 'stat_check')
  if (!sc) return { branch: null, remaining: effects }
  const stat = STAT_MAP[sc.stat] ?? 'str'
  const branch = {
    kind: 'statCheck',
    stat,
    threshold: sc.difficulty ?? 10,
    successNext: sc.success_next ?? 'end',
    failNext: sc.fail_next ?? 'end',
  }
  const remaining = effects.filter((e) => e.type !== 'stat_check')
  return { branch, remaining }
}

function convertChoice(godotChoice, idx) {
  const id = godotChoice.id ?? `c${idx}`
  const { branch, remaining } = extractStatCheck(godotChoice)
  const effects = remaining.map(convertEffect).filter((e) => e !== null)
  const visibleIf = convertCondition(godotChoice.condition)

  let next
  if (branch) next = branch
  else if (godotChoice.next == null) next = 'end'
  else next = godotChoice.next

  const out = { id, text: godotChoice.text, effects, next }
  if (visibleIf) out.visibleIf = visibleIf
  return out
}

function convertLine(godotLine) {
  const node = {
    id: godotLine.id,
    text: godotLine.text,
    choices: [],
  }
  if (godotLine.speaker) node.speaker = godotLine.speaker

  // onEnter effects (line-level effects in Godot fire on entry)
  if (godotLine.effects && godotLine.effects.length > 0) {
    const converted = godotLine.effects.map(convertEffect).filter((e) => e !== null)
    if (converted.length > 0) node.onEnter = converted
  }

  if (godotLine.choices && godotLine.choices.length > 0) {
    node.choices = godotLine.choices.map((c, i) => convertChoice(c, i))
  } else if (godotLine.next == null) {
    // Terminal node: synthesize a Continue choice that ends the dialogue.
    node.choices = [{ id: 'continue', text: 'Continue', effects: [], next: 'end' }]
  } else {
    // Non-branching node: synthesize a Continue choice that advances.
    node.choices = [{ id: 'continue', text: 'Continue', effects: [], next: godotLine.next }]
  }

  return node
}

export function convertGodotDialogue(godot) {
  const lines = godot.lines ?? []
  const startId = lines[0]?.id ?? 'start'
  const dialogueId = godot.id ?? godot.title?.toLowerCase().replace(/[^a-z0-9_]+/g, '_') ?? 'unknown'

  const nodes = {}
  for (const line of lines) {
    nodes[line.id] = convertLine(line)
  }

  return {
    id: dialogueId,
    startNodeId: startId,
    nodes,
  }
}

function convertFile(srcPath, destPath) {
  const raw = readFileSync(srcPath, 'utf8')
  const godot = JSON.parse(raw)
  const phaser = convertGodotDialogue(godot)
  mkdirSync(dirname(destPath), { recursive: true })
  writeFileSync(destPath, JSON.stringify(phaser, null, 2) + '\n')
  console.log(`✓ ${basename(srcPath)} → ${basename(destPath)}  (${Object.keys(phaser.nodes).length} nodes)`)
  return phaser
}

function main() {
  const args = process.argv.slice(2)
  if (args[0] === '--all') {
    const files = [
      'prologue.json',
      'road_merchant.json',
      'wounded_traveler.json',
      'bandit_threat.json',
      'sq_blood_ties_accept.json',
      'sq_blood_ties_daren_captured.json',
      'sq_blood_ties_daren_killed.json',
      'test_event_crossroads.json',
    ]
    if (!existsSync(GODOT_DIR)) {
      console.error(`Godot dir not found: ${GODOT_DIR}`)
      process.exit(1)
    }
    for (const f of files) {
      const src = join(GODOT_DIR, f)
      const dst = join(PHASER_DIR, f)
      if (!existsSync(src)) {
        console.warn(`! missing: ${src}`)
        continue
      }
      convertFile(src, dst)
    }
    return
  }
  if (args.length !== 2) {
    console.error('Usage: convert-dialogue.mjs <src.json> <dst.json>')
    console.error('   or: convert-dialogue.mjs --all')
    process.exit(1)
  }
  convertFile(args[0], args[1])
}

// Always run main when executed directly. ESM check gets dicey on Windows
// path conversion; just check for a known argv signature instead.
if (process.argv[1] && process.argv[1].endsWith('convert-dialogue.mjs')) {
  main()
}
