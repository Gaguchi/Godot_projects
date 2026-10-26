/**
 * combat/seed.ts — ONE seeder for every battle kind (brief §2.8, §2.15, §7.5, §7.20, §7.26).
 * Throws `SeedError` on any bad input (never a stub battle). Every unit gets a position (`lastTile: null`); party
 * units enter at RUN HP with ap 3, armor 0, statuses []; decks built per unit; opening hand dealt from
 * `spec.rng`; `turn = { round: 1, unitId: initiativeQueue(units)[0], acted: [that id] }` — the first unit is already holding
 * the round's cursor (`combat/turn.ts`).
 */
import type { AuthoredEnemy, BattleSpec, CombatGrid, CombatState, CombatUnit, DeckState, EnemyGroupMember, EnemySpec, EngineEnv, TileKey, Unit, UnitId, UnitStats } from '../types'
import { generateDirtRegion } from '../boardFloor'
import { createRng } from '../rng'
import { deriveState } from '../rngState'
import { rngLabels } from '../rules'
import { buildDeck, drawCards, shuffleDraw } from './deck'
import { inBounds, isObstacle, manhattan, parseTile, tileKey } from './grid'
import { initiativeQueue } from './turn'

export class SeedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SeedError'
  }
}

const STAT_KEYS = ['str', 'mag', 'skl', 'spd', 'def', 'res', 'lck'] as const satisfies readonly (keyof UnitStats)[]

/**
 * `rules.difficulty.enemyScaling` — the same seven-line formula `run/difficulty.ts#scaleEnemy` spells
 * (hp = round(startingHp × enemyHpMultiplier) + hpPerLevel·(L−1); str/def (+mag if > 0) += ⌊(L−1)/strDefMagEvery⌋; skl/spd/res += ⌊(L−1)/sklSpdResEvery⌋;
 * lck flat). The combat import fence (CONTRACT §6) keeps `run/*` out of `combat/*`, so the seeder carries its own copy.
 */
function scaleEnemyStats(base: UnitStats, baseHp: number, level: number, env: EngineEnv): { readonly stats: UnitStats; readonly hp: number } {
  const s = env.rules.difficulty.enemyScaling
  const l = Math.max(0, level - 1)
  const a = Math.floor(l / s.strDefMagEvery)
  const b = Math.floor(l / s.sklSpdResEvery)
  return {
    hp: Math.round(baseHp * s.enemyHpMultiplier) + s.hpPerLevel * l,
    stats: {
      str: base.str + a,
      mag: base.mag > 0 ? base.mag + a : base.mag,
      skl: base.skl + b,
      spd: base.spd + b,
      def: base.def + a,
      res: base.res + b,
      lck: base.lck,
    },
  }
}

/** Zod's `.partial()` infers `key?: number | undefined`, which `exactOptionalPropertyTypes` keeps distinct from `Partial<UnitStats>`. */
type StatOverrides = { readonly [K in keyof UnitStats]?: number | undefined }

function overrideStats(stats: UnitStats, overrides: StatOverrides | null | undefined): UnitStats {
  if (overrides === null || overrides === undefined) return stats
  const out: Record<keyof UnitStats, number> = { ...stats }
  for (const k of STAT_KEYS) {
    const v = overrides[k]
    if (v !== undefined) out[k] = v
  }
  return out
}

type BlankCombatFields = Pick<CombatUnit, 'position' | 'lastTile' | 'ap' | 'statuses' | 'hasMovedThisTurn' | 'actionsTaken' | 'coverUsed' | 'captured'>
const blankCombatFields = (): BlankCombatFields => ({
  position: null, lastTile: null, ap: 0, statuses: [], hasMovedThisTurn: false, actionsTaken: 0, coverUsed: [], captured: false,
})

/** A run unit as it steps onto the board (position assigned by `placeUnits`). `ap` is set by `seedBattle`
 *  (`rules.combat.apPerTurn` — this signature carries no env); armor resets per battle (§2.8). */
export function partyCombatUnit(unit: Unit): CombatUnit {
  return { ...unit, ...blankCombatFields(), armor: 0, bountyValue: null }
}

function classOrThrow(env: EngineEnv, classId: string, who: string) {
  const cls = env.content.classes[classId]
  if (cls === undefined) throw new SeedError(`${who}: unknown class '${classId}'`)
  return cls
}

function groupMemberUnit(member: EnemyGroupMember, id: UnitId, specLevel: number, env: EngineEnv): CombatUnit {
  const cls = classOrThrow(env, member.classId, `enemy '${id}'`)
  const character = member.id === undefined ? undefined : env.content.characters[member.id]
  const unitChar = character !== undefined && character.kind === 'unit' ? character : null
  if (unitChar !== null && unitChar.classId !== member.classId) {
    throw new SeedError(`enemy '${id}': character class '${unitChar.classId}' differs from member class '${member.classId}'`)
  }
  const level = Math.max(member.level, specLevel, unitChar?.level ?? member.level)
  const scaled = scaleEnemyStats(cls.baseStats, cls.startingHp, level, env)
  return {
    id,
    name: member.name,
    classId: member.classId,
    team: 'enemy',
    level,
    hp: { current: scaled.hp, max: scaled.hp },
    stats: overrideStats(scaled.stats, unitChar?.statOverrides),
    mov: cls.startingMov,
    handLeft: null,
    handRight: null,
    passives: [],
    signatureCardIds: [],
    ...blankCombatFields(),
    armor: member.armor ?? 0,
    bountyValue: member.bountyValue ?? null,
  }
}

function authoredUnit(a: AuthoredEnemy, env: EngineEnv): CombatUnit {
  const cls = classOrThrow(env, a.classId, `authored enemy '${a.id}'`)
  const scaled = scaleEnemyStats(cls.baseStats, cls.startingHp, a.level, env)
  const hp = a.hp ?? scaled.hp
  return {
    id: a.id,
    name: a.name,
    classId: a.classId,
    team: 'enemy',
    level: a.level,
    hp: { current: hp, max: hp },
    stats: overrideStats(scaled.stats, a.stats),
    mov: cls.startingMov,
    handLeft: null,
    handRight: null,
    passives: [],
    signatureCardIds: [],
    ...blankCombatFields(),
    position: a.position,
    armor: a.armor ?? 0,
    bountyValue: a.bountyValue,
  }
}

/**
 * Group members × count with stable ids (`daren`, `wolf_2`), level = max(authored, spec level) → scaled,
 * `bountyValue` copied, `armor` = `member.armor ?? 0`. When `content.characters[member.id]` is a unit character
 * (lint: same classId) its `statOverrides` replace the scaled stats field-by-field and its `level` joins the max
 * — that is how `mercer_kaine` gets his authored sheet. Authored units verbatim (`hp`/`armor`/`stats` overrides).
 * Positions null for group members (see `placeUnits`). A member without an id spawns as `<groupId>_<memberIndex>`.
 */
export function buildEnemyUnits(enemies: EnemySpec, env: EngineEnv): readonly CombatUnit[] {
  if (enemies.kind === 'authored') return enemies.units.map((a) => authoredUnit(a, env))
  const group = env.content.enemyGroups[enemies.enemyGroupId]
  if (group === undefined) throw new SeedError(`unknown enemy group '${enemies.enemyGroupId}'`)
  const out: CombatUnit[] = []
  group.members.forEach((m, index) => {
    const base = m.id ?? `${group.id}_${index}`
    for (let n = 1; n <= m.count; n++) out.push(groupMemberUnit(m, m.count === 1 ? base : `${base}_${n}`, enemies.level, env))
  })
  return out
}

/** The longest reach of the enemy's authored actions; an enemy class without an AI profile could never act (§7.20). */
function maxActionRange(u: CombatUnit, env: EngineEnv): number {
  const profile = env.content.enemyAI[u.classId]
  if (profile === undefined) throw new SeedError(`enemy '${u.id}' (class '${u.classId}') has no AI profile`)
  return Math.max(0, ...profile.actions.map((a) => a.range.max))
}

function assertTile(grid: CombatGrid, t: TileKey, who: string): void {
  if (!inBounds(grid, t)) throw new SeedError(`${who}: tile ${t} is off the ${grid.width}×${grid.height} board`)
  if (isObstacle(grid, t)) throw new SeedError(`${who}: tile ${t} is an obstacle`)
}

/** §2.5 / §7.26: on turn 1 at least one enemy can reach attack range of a party unit. */
function assertEngagement(party: readonly CombatUnit[], enemies: readonly CombatUnit[], env: EngineEnv): void {
  let closest = Number.POSITIVE_INFINITY
  for (const e of enemies) {
    if (e.position === null) continue
    const reach = e.mov + maxActionRange(e, env)
    for (const p of party) {
      if (p.position === null) continue
      const d = manhattan(e.position, p.position)
      closest = Math.min(closest, d)
      if (d <= reach) return
    }
  }
  throw new SeedError(`no enemy can engage on turn 1 (closest gap ${closest} tiles) — spawn within one move + attack (§7.26)`)
}

/**
 * Pack spawn (§2.5, §7.26; `rules.combat.enemySpawn`). The front column is the DEEPEST column from which the
 * pack's shortest-reaching member, standing on `firstRow`, still engages a party unit on turn 1 — so the gap is as
 * wide as engagement allows and never wider (an 11-tile gap "read as broken", §7.26). Slots then fill `columnsDeep`
 * columns from that front, rows `firstRow, +rowStride, …` first and the in-between rows next; deeper columns take the
 * overflow, shallower ones only when the board runs out (never behind the party). Deterministic, obstacle- and
 * occupancy-aware.
 */
function spawnSlots(party: readonly CombatUnit[], pack: readonly CombatUnit[], grid: CombatGrid, taken: Set<TileKey>, env: EngineEnv): readonly TileKey[] {
  const { columnsDeep, firstRow, rowStride } = env.rules.combat.enemySpawn
  const partyTiles = party.flatMap((p) => (p.position === null ? [] : [p.position]))
  const minReach = Math.min(...pack.map((e) => e.mov + maxActionRange(e, env)))
  const frontX = Math.max(...partyTiles.map((t) => parseTile(t).x))
  const probeRow = Math.min(firstRow, grid.height - 1)
  let front = -1
  for (let x = grid.width - 1; x > frontX; x--) {
    const probe = tileKey(x, probeRow)
    if (partyTiles.some((t) => manhattan(probe, t) <= minReach)) {
      front = x
      break
    }
  }
  if (front < 0) throw new SeedError(`board too narrow to spawn a pack beyond column ${frontX} within reach ${minReach}`)
  const columns: number[] = []
  for (let x = front; x < Math.min(grid.width, front + columnsDeep); x++) columns.push(x) // the pack's own columns
  for (let x = front - 1; x > frontX; x--) columns.push(x) // overflow steps TOWARD the party (stays engaged), never behind it
  for (let x = front + columnsDeep; x < grid.width; x++) columns.push(x) // last resort: deeper, out of reach
  const rowRank = (y: number): number => (y >= firstRow && (y - firstRow) % rowStride === 0 ? 0 : 1)
  const rows = Array.from({ length: grid.height }, (_, y) => y).sort((a, b) => rowRank(a) - rowRank(b) || a - b)
  const out: TileKey[] = []
  for (const x of columns) {
    for (const y of rows) {
      const t = tileKey(x, y)
      if (taken.has(t) || isObstacle(grid, t)) continue
      taken.add(t)
      out.push(t)
      if (out.length === pack.length) return out
    }
  }
  return out
}

/** Party on `rules.combat.partySlots` in order; enemies within one move + attack of the party
 *  (`rules.combat.enemySpawn`), asserted; every unit ends with a unique in-bounds non-obstacle tile. */
export function placeUnits(party: readonly Unit[], enemies: readonly CombatUnit[], grid: CombatGrid, env: EngineEnv): { readonly party: readonly CombatUnit[]; readonly enemies: readonly CombatUnit[] } {
  const slots = env.rules.combat.partySlots
  if (party.length === 0) throw new SeedError('a battle needs at least one party unit')
  if (party.length > slots.length) throw new SeedError(`party of ${party.length} exceeds the ${slots.length} deployment slots`)
  const taken = new Set<TileKey>()
  const placedParty = party.map((u, i) => {
    const [x, y] = slots[i]!
    const t = tileKey(x, y)
    assertTile(grid, t, `party slot for '${u.id}'`)
    taken.add(t)
    return { ...partyCombatUnit(u), position: t }
  })
  const placedEnemies: CombatUnit[] = []
  const pack: CombatUnit[] = []
  for (const e of enemies) {
    if (e.position === null) {
      pack.push(e)
      continue
    }
    assertTile(grid, e.position, `authored enemy '${e.id}'`)
    if (taken.has(e.position)) throw new SeedError(`authored enemy '${e.id}': tile ${e.position} is already occupied`)
    taken.add(e.position)
    placedEnemies.push(e)
  }
  if (pack.length > 0) {
    const tiles = spawnSlots(placedParty, pack, grid, taken, env)
    pack.forEach((e, i) => {
      const t = tiles[i]
      if (t === undefined) throw new SeedError(`no free tile to spawn enemy '${e.id}'`)
      placedEnemies.push({ ...e, position: t })
    })
  }
  assertEngagement(placedParty, placedEnemies, env)
  return { party: placedParty, enemies: placedEnemies }
}

const TAG_KIND: Readonly<Record<BattleSpec['tag'], BattleSpec['origin']['kind']>> = {
  'tutorial': 'tutorial',
  'travel': 'travel',
  'quest': 'quest',
  'dungeon:combat': 'dungeon',
  'dungeon:elite': 'dungeon',
  'dungeon:boss': 'dungeon',
  'finalBoss': 'finalBoss',
  'sim': 'sim',
}

/** `tag` is the loot-row key, `origin` the routing — the two must agree (types.ts `BattleTag`: "seed asserts"). */
function assertTagOrigin(spec: BattleSpec): void {
  if (TAG_KIND[spec.tag] !== spec.origin.kind) throw new SeedError(`tag '${spec.tag}' does not match origin '${spec.origin.kind}'`)
  if (spec.origin.kind === 'dungeon' && spec.tag !== `dungeon:${spec.origin.roomType}`) {
    throw new SeedError(`tag '${spec.tag}' does not match dungeon room type '${spec.origin.roomType}'`)
  }
  const expectedGroup = spec.enemies.kind === 'group' ? spec.enemies.enemyGroupId : null
  if (spec.enemyGroupId !== expectedGroup) {
    throw new SeedError(`enemyGroupId '${String(spec.enemyGroupId)}' does not match the enemy spec (${expectedGroup === null ? 'authored' : `group '${expectedGroup}'`})`)
  }
}

/**
 * The board: obstacles sorted (the binary search in `grid.ts` relies on it) and bounds-checked, terrain copied
 * verbatim (read only when the knob is on), and the cosmetic floor from `boardFloor.ts` under
 * `rngLabels.floor(battleId)` — the same label `procgen/battleFloor.ts#battleGrid` documents, so a reload draws
 * the same field. The combat import fence admits `boardFloor` but not `procgen/*`, hence the seeder rolls it here.
 */
function buildGrid(spec: BattleSpec): CombatGrid {
  const { width, height } = spec.grid
  if (width < 1 || height < 1) throw new SeedError(`grid ${width}×${height} is empty`)
  const obstacles = [...new Set(spec.grid.obstacles)].sort()
  const bare: CombatGrid = { width, height, obstacles, floor: [], terrain: spec.grid.terrain }
  for (const o of obstacles) if (!inBounds(bare, o)) throw new SeedError(`obstacle ${o} is off the ${width}×${height} board`)
  const floor = [...generateDirtRegion(width, height, createRng(deriveState(spec.rng, rngLabels.floor(spec.battleId))))].sort()
  return { width, height, obstacles, floor, terrain: spec.grid.terrain }
}

export function seedBattle(spec: BattleSpec, env: EngineEnv): CombatState {
  assertTagOrigin(spec)
  const grid = buildGrid(spec)
  for (const u of spec.party) {
    if (u.hp.current <= 0) throw new SeedError(`party unit '${u.id}' enters dead (hp ${u.hp.current}) — the run removes the fallen first`)
  }
  const enemies = buildEnemyUnits(spec.enemies, env)
  if (enemies.length === 0) throw new SeedError('a battle needs at least one enemy')
  const placed = placeUnits(spec.party, enemies, grid, env)
  let party = placed.party
  if (spec.tag === 'tutorial') {
    // §2.15: the tutorial board is authored, not slotted — the MC stands at `rules.tutorial.mcPosition` facing the
    // authored bandit; re-checked against the board and the turn-1 engagement rule like any other placement.
    const [x, y] = env.rules.tutorial.mcPosition
    const t = tileKey(x, y)
    assertTile(grid, t, 'tutorial MC position')
    party = party.map((u, i) => (i === 0 ? { ...u, position: t } : u))
    assertEngagement(party, placed.enemies, env)
  }
  const ap = env.rules.combat.apPerTurn
  const all = [...party, ...placed.enemies].map((u) => ({ ...u, ap }))
  const units: Record<UnitId, CombatUnit> = {}
  const tiles = new Set<TileKey>()
  for (const u of all) {
    if (u.id in units) throw new SeedError(`duplicate unit id '${u.id}'`)
    if (u.position === null) throw new SeedError(`unit '${u.id}' has no position`)
    if (tiles.has(u.position)) throw new SeedError(`two units share tile ${u.position}`)
    tiles.add(u.position)
    units[u.id] = u
  }
  // Decks for every unit (enemies never draw — §2.5 — so only party decks are shuffled and dealt from the stream).
  let rng = spec.rng
  const decks: Record<UnitId, DeckState> = {}
  for (const u of all) {
    let deck = buildDeck(u, env)
    if (u.team === 'party') {
      const shuffled = shuffleDraw(deck, rng)
      const dealt = drawCards(shuffled.deck, env.rules.combat.handSize, shuffled.rng)
      deck = dealt.deck
      rng = dealt.rng
    }
    decks[u.id] = deck
  }
  const first = initiativeQueue(units)[0]
  if (first === undefined) throw new SeedError('no living unit can take the first turn')
  return {
    battleId: spec.battleId,
    tag: spec.tag,
    origin: spec.origin,
    regionTier: spec.regionTier,
    enemyGroupId: spec.enemyGroupId,
    phase: 'combat',
    grid,
    units,
    decks,
    turn: { round: 1, unitId: first, acted: [first] },
    selection: { kind: 'idle' },
    consumables: [...spec.consumables],
    consumedItems: [],
    captureTargets: [...spec.captureTargets],
    rng,
  }
}
