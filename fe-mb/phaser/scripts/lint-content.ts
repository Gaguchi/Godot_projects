/**
 * Content lint — static checks over the JSON game content that catch design /
 * data bugs BEFORE they show up in play. Run: `npm run lint:content`.
 *
 * ERRORS (exit 1): broken references that would crash or dead-end at runtime —
 *   class innate card not in cards.json; dialogue choice pointing at a missing
 *   node; bad startNodeId.
 * WARNINGS: design smells worth knowing — a class with no offensive card (a
 *   unit of it alone can't win), surfaced by the headless autobattle stalemate.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const contentDir = join(here, '..', 'src', 'data', 'content')
function readJson<T>(p: string): T {
  return JSON.parse(readFileSync(p, 'utf8')) as T
}

interface CardJ { id: string; name: string; effects: { kind: string }[] }
interface ClassJ { id: string; name: string; innateCardIds: string[] }
interface ChoiceJ { id: string; next?: string; onPass?: string; onFail?: string }
interface NodeJ { id: string; choices?: ChoiceJ[] }
interface TreeJ { id: string; startNodeId?: string; nodes: Record<string, NodeJ> }

const cards = readJson<CardJ[]>(join(contentDir, 'cards.json'))
const classes = readJson<ClassJ[]>(join(contentDir, 'classes.json'))
const dialogueDir = join(contentDir, 'dialogue')
const dialogues = readdirSync(dialogueDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ file: f, tree: readJson<TreeJ>(join(dialogueDir, f)) }))

const cardById = new Map(cards.map((c) => [c.id, c]))
const errors: string[] = []
const warnings: string[] = []

// ── classes: unknown innate card refs (error) + offense-less (warning) ──
for (const cls of classes) {
  let hasDamage = false
  for (const cid of cls.innateCardIds ?? []) {
    const card = cardById.get(cid)
    if (!card) { errors.push(`class '${cls.id}': innate card '${cid}' not found in cards.json`); continue }
    if (card.effects.some((e) => e.kind === 'Damage')) hasDamage = true
  }
  if (!hasDamage) {
    warnings.push(`class '${cls.id}' (${cls.name}): no innate card deals Damage — a unit of this class alone cannot win a battle`)
  }
}

// ── dialogue: dangling node references (error) ──
for (const { file, tree } of dialogues) {
  const nodeIds = new Set(Object.keys(tree.nodes ?? {}))
  if (tree.startNodeId && !nodeIds.has(tree.startNodeId)) {
    errors.push(`dialogue '${tree.id}' (${file}): startNodeId '${tree.startNodeId}' is not a node`)
  }
  for (const [nid, node] of Object.entries(tree.nodes ?? {})) {
    for (const ch of node.choices ?? []) {
      for (const ref of [ch.next, ch.onPass, ch.onFail]) {
        if (ref && ref !== 'end' && !nodeIds.has(ref)) {
          errors.push(`dialogue '${tree.id}' (${file}) node '${nid}' choice '${ch.id}': → '${ref}' is not a node`)
        }
      }
    }
  }
}

// ── report ──
console.log(`content-lint: ${classes.length} classes, ${cards.length} cards, ${dialogues.length} dialogues`)
for (const w of warnings) console.log(`  ⚠ ${w}`)
for (const e of errors) console.log(`  ✗ ${e}`)
if (errors.length === 0) {
  console.log(`  ✓ no content errors${warnings.length ? ` (${warnings.length} warning${warnings.length === 1 ? '' : 's'})` : ''}`)
} else {
  console.log(`\n${errors.length} content error(s)`)
  process.exitCode = 1
}
