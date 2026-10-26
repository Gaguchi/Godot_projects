/**
 * tests/helpers/overworld.ts — WP-OVERWORLD fixtures: content-derived node picks and envs with the encounter
 * chance pinned to 0 or 1, so a hop test never depends on the shipped roll odds.
 */
import { content } from '../../src/content/index'
import { createEnv } from '../../src/engine/content'
import type { EncounterOutcome, EngineEnv, NodeType, OverworldNode, RunState } from '../../src/engine/types'
import { adjacency, findPath } from '../../src/engine/run/overworld'
import { env } from './runs'

export function nodesOfType(type: NodeType, e: EngineEnv = env): readonly OverworldNode[] {
  return e.content.overworld.nodes.filter((n) => n.type === type && n.hidden !== true)
}

export function firstNodeOfType(type: NodeType, e: EngineEnv = env): OverworldNode {
  const node = nodesOfType(type, e)[0]
  if (node === undefined) throw new Error(`fixture: no ${type} node in content`)
  return node
}

/** A neighbour of the run's current node — by default one a hop can ROLL into (not a town/dungeon/boss),
 *  so encounter tests never land on a no-roll node by accident. */
export function neighbourOf(run: RunState, e: EngineEnv = env, rollable = true): string {
  const noRoll: readonly string[] = e.rules.travel.noRollInto
  // a DISCOVERY with an authored event suspends the landing (travel.ts LAND) — never the "plain road" a fixture asks for
  const next = (adjacency(run, e)[run.nodeId] ?? []).find((id) => {
    const node = e.content.overworld.nodes.find((n) => n.id === id)!
    if (node.type === 'DISCOVERY' && node.discoveryEventId !== undefined) return false
    return !rollable || !noRoll.includes(node.type)
  })
  if (next === undefined) throw new Error(`fixture: ${run.nodeId} has no ${rollable ? 'rollable ' : ''}road`)
  return next
}

/** A visible node whose BFS path from the run's node is between `min` and `max` hops. */
export function farNode(run: RunState, min: number, max: number, e: EngineEnv = env): OverworldNode {
  for (const node of e.content.overworld.nodes) {
    if (node.hidden === true) continue
    const path = findPath(run, node.id, e)
    if (path !== null && path.length >= min && path.length <= max) return node
  }
  throw new Error(`fixture: no node ${min}-${max} hops away`)
}

/** Teleport the party (fixture only — the real move is `travel/*`). */
export function at(run: RunState, nodeId: string): RunState {
  return { ...run, nodeId }
}

/** The shipped content with every region's per-hop chance set to `chance` (edges carry no overrides in shipped content). */
export function envWithChance(chance: number, e: EngineEnv = env): EngineEnv {
  const regions = Object.fromEntries(Object.entries(content.regions).map(([id, r]) => [id, { ...r, encounterChancePerHop: chance }]))
  const edges = content.overworld.edges.map((edge) => {
    const { rollChance: _drop, ...rest } = edge
    return rest
  })
  return createEnv({ ...content, regions, overworld: { ...content.overworld, edges } }, e.rules)
}

/** Chance 1 and ONE table whose every entry has the given outcome, wired to every road. */
export function envWithOnly(outcome: EncounterOutcome, opts: { readonly oneShot?: boolean; readonly weight?: number } = {}, e: EngineEnv = env): EngineEnv {
  const table = {
    id: 'fx_table',
    regionId: content.overworld.nodes[0]!.regionId,
    entries: [{ id: 'fx_entry', weight: opts.weight ?? 1, oneShot: opts.oneShot ?? false, conditions: [], outcome }],
  }
  const chance1 = envWithChance(1, e)
  const edges = chance1.content.overworld.edges.map((edge) => ({ ...edge, encounterTableId: 'fx_table' }))
  return createEnv({ ...chance1.content, encounterTables: { fx_table: table }, overworld: { ...chance1.content.overworld, edges } }, e.rules)
}

export function anyDialogueId(e: EngineEnv = env): string {
  const id = Object.keys(e.content.dialogues)[0]
  if (id === undefined) throw new Error('fixture: no dialogue in content')
  return id
}

export function anyCheckEventId(e: EngineEnv = env): string {
  const id = Object.keys(e.content.checkEvents)[0]
  if (id === undefined) throw new Error('fixture: no check event in content')
  return id
}
