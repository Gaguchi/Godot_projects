/**
 * `npm run lint:content` — loads the content registry (which Zod-validates
 * every file), runs the cross-reference lint, and additionally checks that
 * every character `spriteId` has its portrait and board bake on disk.
 * Exit 1 on any problem.
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { content } from '../src/content/index'
import { lintContent, lintContentWarnings } from '../src/content/lint'

const problems = lintContent(content)
const warnings = lintContentWarnings(content)

const spritesDir = resolve(import.meta.dirname, '../public/sprites/units')
for (const ch of Object.values(content.characters)) {
  if (ch.spriteId === undefined) continue
  for (const file of [`${ch.spriteId}.png`, `board/${ch.spriteId}.png`]) {
    if (!existsSync(resolve(spritesDir, file))) problems.push(`character ${ch.id}: sprite file public/sprites/units/${file} is missing`)
  }
}

const counts = {
  cards: Object.keys(content.cards).length,
  items: Object.keys(content.items).length,
  classes: Object.keys(content.classes).length,
  characters: Object.keys(content.characters).length,
  enemyGroups: Object.keys(content.enemyGroups).length,
  enemyAI: Object.keys(content.enemyAI).length,
  encounterTables: Object.keys(content.encounterTables).length,
  checkEvents: Object.keys(content.checkEvents).length,
  dungeons: Object.keys(content.dungeons).length,
  towns: Object.keys(content.towns).length,
  nodes: content.overworld.nodes.length,
  edges: content.overworld.edges.length,
  quests: Object.keys(content.quests).length,
  dialogues: Object.keys(content.dialogues).length,
  regions: Object.keys(content.regions).length,
  battlefields: Object.keys(content.battlefields).length,
}

if (warnings.length > 0) {
  console.warn(`lint:content — ${warnings.length} warning(s) (never fail the gate):`)
  for (const w of warnings) console.warn(`  ~ ${w}`)
}
if (problems.length > 0) {
  console.error(`lint:content FAILED — ${problems.length} problem(s):`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log('lint:content OK', JSON.stringify(counts))
