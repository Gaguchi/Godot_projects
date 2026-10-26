/**
 * Typed, validated, read-only content for the engine (ARCHITECTURE §3).
 *
 * The content module (`src/content/index.ts`) parses every JSON through its
 * strict Zod schema at module load and deep-freezes the registry. This file
 * adds the two fields the engine derives from it (`version`, `nodeDistance`)
 * and builds the `EngineEnv` every reducer receives. It is IMPLEMENTED (not a
 * stub): it carries no game rules.
 */

import { content as registry, type ContentRegistry } from '../content/index'
import type { Battlefield, Portrait, PortraitAccentSchema, PortraitShapeSchema } from '../content/schemas'
import type { z } from 'zod'
import type { Content, EngineEnv, NodeId, OverworldSheet, RegionTier, Team } from './types'
import { rules as defaultRules, type Rules } from './rules'

/** FNV-1a 32-bit over a string; also the salt hash for `run/difficulty.ts` (deterministic, no Math.random). */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** Stable hash of the parsed content; stored in saves and compared on resume (pre-alpha: mismatch nukes). */
export function contentVersion(reg: ContentRegistry): string {
  return fnv1a(JSON.stringify(reg)).toString(16).padStart(8, '0')
}

/**
 * BFS hop distance from `startNodeId` over undirected edges, skipping hidden
 * nodes (they join the graph only when `spawnNode` reveals them — content note (a)).
 * Unreachable / hidden nodes are absent from the record.
 */
export function nodeDistances(sheet: OverworldSheet): Readonly<Record<NodeId, number>> {
  const hidden = new Set(sheet.nodes.filter((n) => n.hidden === true).map((n) => n.id))
  const adjacency = new Map<NodeId, NodeId[]>()
  for (const e of sheet.edges) {
    if (hidden.has(e.from) || hidden.has(e.to)) continue
    adjacency.set(e.from, [...(adjacency.get(e.from) ?? []), e.to])
    adjacency.set(e.to, [...(adjacency.get(e.to) ?? []), e.from])
  }
  const dist: Record<NodeId, number> = { [sheet.startNodeId]: 0 }
  const queue: NodeId[] = [sheet.startNodeId]
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]!
    const d = dist[cur]!
    for (const next of adjacency.get(cur) ?? []) {
      if (next in dist) continue
      dist[next] = d + 1
      queue.push(next)
    }
  }
  return dist
}

export function buildContent(reg: ContentRegistry = registry): Content {
  return Object.freeze({
    ...reg,
    version: contentVersion(reg),
    nodeDistance: Object.freeze(nodeDistances(reg.overworld)),
  })
}

/** The tier `rules.travel.tierByDistance` implies for a node that many hops from the start hub. */
export function tierForDistance(hops: number, r: Rules = defaultRules): RegionTier {
  for (const band of r.travel.tierByDistance) if (hops <= band.maxHops) return band.tier
  const last = r.travel.tierByDistance[r.travel.tierByDistance.length - 1]
  if (last === undefined) throw new Error('rules.travel.tierByDistance is empty')
  return last.tier
}

/**
 * Everything an authored BATTLEFIELD (0112) must obey, checked against the board `rules.combat.grid` describes —
 * `[]` when the board is sound. A field that fails any of these is not a hard fight, it is a broken one:
 *  · every obstacle in bounds;
 *  · no obstacle on a deployment slot (`placeUnits` throws on one, i.e. the battle would not start);
 *  · the walkable tiles form ONE connected region, so no unit can be sealed off from the fight and no pack can
 *    stand where the party can never reach it — the round cap, not the board, would report that.
 * Exported so `content/lint.ts` and the shipped-board test read the same rule the boot gate does.
 */
export function battlefieldFaults(field: Battlefield, r: Rules = defaultRules): readonly string[] {
  const { width, height } = r.combat.grid
  const out: string[] = []
  const blocked = new Set<string>()
  for (const [x, y] of field.obstacles) {
    if (x < 0 || x >= width || y < 0 || y >= height) { out.push(`obstacle ${x},${y} is off the ${width}×${height} board`); continue }
    blocked.add(`${x},${y}`)
  }
  for (const [x, y] of r.combat.partySlots) {
    if (blocked.has(`${x},${y}`)) out.push(`obstacle ${x},${y} sits on a deployment slot`)
  }
  const walkable = width * height - blocked.size
  if (walkable === 0) { out.push('every tile is an obstacle'); return out }
  let start: string | null = null
  for (let y = 0; y < height && start === null; y++) for (let x = 0; x < width; x++) if (!blocked.has(`${x},${y}`)) { start = `${x},${y}`; break }
  const seen = new Set<string>([start!])
  const queue = [start!]
  for (let i = 0; i < queue.length; i++) {
    const [cx, cy] = queue[i]!.split(',').map(Number) as [number, number]
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
      const key = `${nx},${ny}`
      if (nx < 0 || nx >= width || ny < 0 || ny >= height || blocked.has(key) || seen.has(key)) continue
      seen.add(key)
      queue.push(key)
    }
  }
  if (seen.size !== walkable) out.push(`the floor is in ${walkable - seen.size + 1} pieces — ${walkable - seen.size} tile(s) are walled off from ${start!}`)
  return out
}

/**
 * One env per process is the norm; tests build their own with fixture content or patched rules.
 * Two authoring gates, both over `nodeDistance` from the start hub: the sheet's BOSS node may not sit closer than
 * `rules.travel.bossNodeMinHops`, and every reachable node's authored `areaTier` must match the band
 * `rules.travel.tierByDistance` gives its distance (that is what the table is FOR — `run/difficulty.ts#areaTier`
 * reads the authored number, so nothing else would ever catch a mismatch). Fixture worlds pass a patched `rules`.
 */
export function createEnv(reg: ContentRegistry = registry, r: Rules = defaultRules): EngineEnv {
  const content = buildContent(reg)
  for (const node of reg.overworld.nodes) {
    if (node.type === 'BOSS') {
      const d = content.nodeDistance[node.id]
      if (d === undefined || d < r.travel.bossNodeMinHops) {
        throw new Error(`content: BOSS node '${node.id}' is ${d ?? 'unreachable'} hops from '${reg.overworld.startNodeId}' (rules.travel.bossNodeMinHops = ${r.travel.bossNodeMinHops})`)
      }
    }
    const hops = content.nodeDistance[node.id]
    if (hops === undefined) continue // hidden-until-spawned nodes have no distance over the visible graph
    const want = tierForDistance(hops, r)
    if (node.areaTier !== want) {
      throw new Error(`content: node '${node.id}' is ${hops} hops out but authored areaTier ${node.areaTier} (rules.travel.tierByDistance says ${want})`)
    }
  }
  // The third authoring gate: a board a battle could not be fought on (0112).
  for (const field of Object.values(reg.battlefields)) {
    for (const fault of battlefieldFaults(field, r)) throw new Error(`content: battlefield '${field.id}': ${fault}`)
  }
  return Object.freeze({ content, rules: r })
}

type PortraitAccent = z.infer<typeof PortraitAccentSchema>
type PortraitShape = z.infer<typeof PortraitShapeSchema>
const ACCENT_RAMP: readonly PortraitAccent[] = ['gold', 'steel', 'rose', 'moss', 'arcane', 'ember', 'slate', 'wine']
const SHAPE_BY_CLASS_WORD: readonly (readonly [string, PortraitShape])[] = [
  ['mage', 'diamond'], ['cleric', 'diamond'], ['wolf', 'triangle'], ['thief', 'triangle'],
  ['knight', 'square'], ['bandit', 'square'], ['warlord', 'hex'], ['lord', 'circle'],
]

/**
 * Identity ramp for ANY unit — the one lookup every HUD element (initiative rings, herald plaque, forecast
 * portraits, dialogue busts) renders identity through. Same order as `spriteIdFor`: exact character id, id minus
 * one `_N` pack suffix, the character whose id equals the class id; else a deterministic fallback
 * (`accent = ramp[fnv1a(id) % 8]`, `faction = team`, `shape` by class word, `circle` otherwise).
 */
export function portraitFor(reg: ContentRegistry, unitId: string | null | undefined, classId: string, team: Team): Portrait {
  if (unitId) {
    const direct = reg.characters[unitId]?.portrait
    if (direct) return direct
    const stripped = reg.characters[unitId.replace(/_\d+$/, '')]?.portrait
    if (stripped) return stripped
  }
  const byClassId = reg.characters[classId]
  if (byClassId?.kind === 'unit' && byClassId.classId === classId) return byClassId.portrait
  const seed = unitId ?? classId
  const accent = ACCENT_RAMP[fnv1a(seed) % ACCENT_RAMP.length]!
  const shape = SHAPE_BY_CLASS_WORD.find(([word]) => classId.includes(word))?.[1] ?? 'circle'
  return { accent, faction: team, shape }
}

/** Patch knobs/numbers for a test without module mocking: `withRules(env, { knobs: { ...env.rules.knobs, armorCap: 'halfMaxHp' } })`. */
export function withRules(env: EngineEnv, patch: Partial<Rules>): EngineEnv {
  return Object.freeze({ content: env.content, rules: Object.freeze({ ...env.rules, ...patch }) })
}

let cached: EngineEnv | null = null
/** The shipped content + shipped rules, built once. */
export function defaultEnv(): EngineEnv {
  if (cached === null) cached = createEnv()
  return cached
}
