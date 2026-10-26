/**
 * Brief §7.9: Zod silently stripped `daysElapsed` / `runStats` / `oneShotsFired` because the load schema never
 * named them, `combat` was `z.unknown()` and `obstacles: Set` serialised as `{}`. The mirror is `.strict()` at every
 * level and declares every field — proven here exhaustively over the populated fixtures: adding a key to ANY object
 * fails, deleting ANY declared field fails (both naming the path), and the specific §7.9 shapes fail by name.
 */
import { describe, expect, expectTypeOf, it } from 'vitest'
import { parseMeta, parseSaveWith, serialize, toSaveFile } from '../../../../src/engine/save/codec'
import type { CombatMirrorCheck, MetaMirrorCheck, RunMirrorCheck, SaveFileMirrorCheck } from '../../../../src/engine/save/schema'
import { formatPath } from '../../../../src/engine/save/schema'
import type { GameState, SaveFile } from '../../../../src/engine/types'
import { META, populatedMidCombat, populatedRun, populatedVariants, tamper, testEnv } from '../../../helpers/saves'

const env = testEnv()
const noInvariants = (): readonly string[] => []
const parse = (json: string) => parseSaveWith(json, env, noInvariants)
const fileJson = (state: GameState): string => serialize(toSaveFile(state, env))

type Path = readonly (string | number)[]

/** Record (open-keyed) objects: deleting one of their ENTRIES is shape-valid; deleting the record itself is not. */
const RECORD_PATHS = [
  /^run\.(party|visitedNodes|clearedEncounters|oneShotsFired|edgeTraversals|scoutedEdges|spawnedNodes|unlockedNodes|clearedDungeons|flags|questStates)$/,
  /^run\.activeDungeon\.graph\.(rooms|edges)$/,
  /^run\.activeDungeon\.cleared$/,
  /^combat\.(units|decks)$/,
  /^combat\.decks\.[^.]+\.cards$/,
  /^(combat|run\.lastBattle\.field)\.grid\.terrain$/,
]
const isRecordPath = (path: Path): boolean => RECORD_PATHS.some((re) => re.test(formatPath(path)))

/** Every plain-object path in a document (arrays are traversed, not listed). */
function objectPaths(doc: unknown, path: Path = [], out: Path[] = []): Path[] {
  if (doc === null || typeof doc !== 'object') return out
  if (Array.isArray(doc)) {
    doc.forEach((v, i) => objectPaths(v, [...path, i], out))
    return out
  }
  out.push(path)
  for (const [k, v] of Object.entries(doc)) objectPaths(v, [...path, k], out)
  return out
}

/** Shape key: array indices and record entry keys collapse, so each declared field is exercised once. */
function shapeKey(path: Path): string {
  const parts: string[] = []
  for (let i = 0; i < path.length; i++) {
    const seg = path[i]!
    if (typeof seg === 'number') parts.push('[]')
    else if (i > 0 && isRecordPath(path.slice(0, i))) parts.push('*')
    else parts.push(seg)
  }
  return parts.join('/')
}

function at(doc: Record<string, unknown>, path: Path): Record<string, unknown> {
  let cur: unknown = doc
  for (const seg of path) cur = (cur as Record<string | number, unknown>)[seg]
  return cur as Record<string, unknown>
}

/** Fixtures whose union covers every persisted field. */
const CORPUS = populatedVariants().filter((v) => !v.name.startsWith('parked') && !v.name.startsWith('finished') && !v.name.startsWith('camp'))

describe('save/strict — exhaustive over the populated fixtures', () => {
  it('an extra key on ANY object fails, naming that object', () => {
    const seen = new Set<string>()
    let checked = 0
    for (const { name, state } of CORPUS) {
      const json = fileJson(state)
      for (const path of objectPaths(JSON.parse(json))) {
        const key = shapeKey(path)
        if (seen.has(key)) continue
        seen.add(key)
        const result = parse(tamper(json, (doc) => { at(doc, path).__extra = 1 }))
        const label = `${name} @ ${formatPath(path) || '<root>'}`
        expect(result.ok, label).toBe(false)
        if (result.ok) continue
        expect(result.reason, label).toBe('schema')
        expect(result.detail, label).toContain(formatPath(path) || '<root>')
        checked++
      }
    }
    expect(checked).toBeGreaterThan(60)
  })

  it('a missing declared field fails, naming the field; a missing record ENTRY is shape-valid', () => {
    const seen = new Set<string>()
    let declared = 0
    for (const { name, state } of CORPUS) {
      const json = fileJson(state)
      for (const path of objectPaths(JSON.parse(json))) {
        const parentIsRecord = isRecordPath(path)
        for (const key of Object.keys(at(JSON.parse(json) as Record<string, unknown>, path))) {
          const fieldPath = [...path, key]
          const shape = shapeKey(fieldPath)
          if (seen.has(shape)) continue
          seen.add(shape)
          const result = parse(tamper(json, (doc) => { delete at(doc, key === '' ? path : path)[key] }))
          const label = `${name} @ ${formatPath(fieldPath)}`
          // The two optional shapes in a persisted document: content's `EncounterOutcome.battle.captureTargets?` and
          // the keys of an `AuthoredEnemy.stats: Partial<UnitStats>` override.
          const contentOptional = key === 'captureTargets' && formatPath(path).endsWith('.outcome')
          const partialStat = /pendingCombat\.enemies\.units\[\d+\]\.stats$/.test(formatPath(path))
          if (parentIsRecord) continue // entries may come and go; refinements may still object, either is fine
          if (contentOptional || partialStat) {
            expect(result.ok, label).toBe(true)
            continue
          }
          expect(result.ok, label).toBe(false)
          if (result.ok) continue
          expect(result.reason, label).toBe('schema')
          expect(result.detail, label).toContain(formatPath(fieldPath))
          declared++
        }
      }
    }
    expect(declared).toBeGreaterThan(200)
  })
})

describe('save/strict — the §7.9 shapes by name', () => {
  it('obstacles: {} fails naming the path (combat.grid.obstacles)', () => {
    const result = parse(tamper(fileJson(populatedMidCombat()), (doc) => { at(doc, ['combat', 'grid']).obstacles = {} }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('schema')
    expect(result.detail).toMatch(/combat\.grid\.obstacles/)
  })

  it('obstacles: {} on the Field Report field fails naming run.lastBattle.field.grid.obstacles', () => {
    const report = populatedVariants().find((v) => v.name.startsWith('Field Report'))!.state
    const result = parse(tamper(fileJson(report), (doc) => { at(doc, ['run', 'lastBattle', 'field', 'grid']).obstacles = {} }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.detail).toMatch(/run\.lastBattle\.field\.grid\.obstacles/)
  })

  it('a Set in obstacles serialises as {} and is rejected by name — the exact shipped bug', () => {
    const state = populatedMidCombat()
    const withSet = { ...state, combat: { ...state.combat!, grid: { ...state.combat!.grid, obstacles: new Set(['3,4']) as unknown as readonly string[] } } }
    const json = fileJson(withSet)
    expect(json).toContain('"obstacles":{}')
    const result = parse(json)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.detail).toMatch(/combat\.grid\.obstacles/)
  })

  it('unsorted or duplicated obstacles fail naming the path (isObstacle binary-searches them)', () => {
    for (const bad of [['5,2', '3,4'], ['3,4', '3,4']]) {
      const result = parse(tamper(fileJson(populatedMidCombat()), (doc) => { at(doc, ['combat', 'grid']).obstacles = bad }))
      expect(result.ok, bad.join()).toBe(false)
      if (!result.ok) expect(result.detail).toMatch(/combat\.grid\.obstacles.*sorted/)
    }
  })

  it('rng.label fails on run.rng and on combat.rng (CONTRACT-CHANGES 0004)', () => {
    const json = fileJson(populatedMidCombat())
    for (const owner of ['run', 'combat']) {
      const result = parse(tamper(json, (doc) => { at(doc, [owner, 'rng']).label = 'battle:tutorial' }))
      expect(result.ok, owner).toBe(false)
      if (result.ok) continue
      expect(result.detail).toContain(`${owner}.rng`)
      expect(result.detail).toContain('label')
    }
  })

  it('rng.counter must be a non-negative integer; seed an integer', () => {
    const json = fileJson(populatedRun())
    expect(parse(tamper(json, (doc) => { at(doc, ['run', 'rng']).counter = -1 })).ok).toBe(false)
    expect(parse(tamper(json, (doc) => { at(doc, ['run', 'rng']).counter = 1.5 })).ok).toBe(false)
    expect(parse(tamper(json, (doc) => { at(doc, ['run', 'rng']).seed = 0.25 })).ok).toBe(false)
  })

  it('a shape-valid save with turn.unitId not in units is rejected by name', () => {
    const result = parse(tamper(fileJson(populatedMidCombat()), (doc) => { at(doc, ['combat', 'turn']).unitId = 'ghost' }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('schema')
    expect(result.detail).toMatch(/combat\.turn\.unitId.*ghost/)
  })

  it('a card selection whose uid is not in the active hand is rejected by name', () => {
    const result = parse(tamper(fileJson(populatedMidCombat()), (doc) => { at(doc, ['combat', 'selection']).cardUid = 'lord_command#1' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.detail).toMatch(/combat\.selection\.cardUid/)
  })

  it('undefined never survives: a field set to undefined serialises as missing and is rejected', () => {
    const state = populatedRun()
    const broken = { ...state, run: { ...state.run!, gold: undefined as unknown as number } }
    const result = parse(fileJson(broken))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.detail).toMatch(/run\.gold/)
  })

  it('a wrong enum value or type inside a nested union is named', () => {
    const json = fileJson(populatedMidCombat())
    const status = parse(tamper(json, (doc) => { (at(doc, ['combat', 'units', 'daren']).statuses as Record<string, unknown>[])[0]!.id = 'bleed' }))
    expect(status.ok).toBe(false)
    if (!status.ok) expect(status.detail).toMatch(/combat\.units\.daren\.statuses\[0\]\.id/)
    const origin = parse(tamper(json, (doc) => { at(doc, ['combat', 'origin']).kind = 'arena' }))
    expect(origin.ok).toBe(false)
    if (!origin.ok) expect(origin.detail).toMatch(/combat\.origin/)
  })

  it('record keys are plain strings: refKeys with colons, edge#pass keys, card uids and engine-minted flags all pass', () => {
    const result = parse(fileJson(populatedMidCombat()))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.keys(result.value.run!.visitedNodes)).toContain('overworld:world:frontier_camp')
    expect(Object.keys(result.value.run!.scoutedEdges)).toContain('old_mill_crossing->pine_crossing#2')
    expect(Object.keys(result.value.combat!.decks.mc!.cards)).toContain('iron_sword_slash#2')
    expect(Object.keys(result.value.run!.flags)).toContain('recruited_kael')
  })

  it('parsed output is a fresh deep copy that deep-equals the file', () => {
    const file = toSaveFile(populatedMidCombat(), env)
    const result = parse(serialize(file))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual(file)
    expect(result.value).not.toBe(file)
    expect(result.value.combat).not.toBe(file.combat)
  })
})

describe('save/strict — versions and malformed input', () => {
  it('a different saveVersion fails with reason version (pre-alpha nuke, brief §2.14)', () => {
    const result = parse(tamper(fileJson(populatedRun()), (doc) => { doc.saveVersion = '0.7.0-gear' }))
    expect(result).toEqual({ ok: false, reason: 'version', detail: expect.stringContaining('0.7.0-gear') })
  })

  it('a different contentVersion fails with reason content', () => {
    const result = parse(tamper(fileJson(populatedRun()), (doc) => { doc.contentVersion = 'deadbeef' }))
    expect(result).toEqual({ ok: false, reason: 'content', detail: expect.stringContaining('deadbeef') })
  })

  it('an old file with a stale shape reports version, not a wall of shape errors', () => {
    const result = parse(tamper(fileJson(populatedRun()), (doc) => { doc.saveVersion = '0.9.0'; delete doc.combat; doc.actionLog = [] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('version')
  })

  it('not JSON fails with reason json', () => {
    const result = parse('{"saveVersion": ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('json')
  })

  it('JSON that is not an object (null, a string, an array) fails with reason schema', () => {
    for (const json of ['null', '"run"', '[]', '42']) {
      const result = parse(json)
      expect(result.ok, json).toBe(false)
      if (!result.ok) expect(result.reason, json).toBe('schema')
    }
  })

  it('missing version stamps fail with reason schema naming them', () => {
    const result = parse(tamper(fileJson(populatedRun()), (doc) => { delete doc.saveVersion; delete doc.contentVersion }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('schema')
      expect(result.detail).toMatch(/saveVersion/)
      expect(result.detail).toMatch(/contentVersion/)
    }
  })

  it('screen and ledger are not persisted: a file carrying them is rejected (CONTRACT-CHANGES 0008)', () => {
    const result = parse(tamper(fileJson(populatedRun()), (doc) => { doc.screen = { kind: 'town' }; doc.ledger = null }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.detail).toMatch(/screen.*ledger|ledger.*screen/)
  })

  it('parseMeta is strict too: extra key, missing key, wrong type, bad json', () => {
    expect(parseMeta(JSON.stringify(META)).ok).toBe(true)
    const extra = parseMeta(JSON.stringify({ ...META, highScore: 9 }))
    expect(extra.ok).toBe(false)
    if (!extra.ok) expect(extra.detail).toContain('highScore')
    const missing: Record<string, unknown> = { ...META }
    delete missing.audioMuted
    const miss = parseMeta(JSON.stringify(missing))
    expect(miss.ok).toBe(false)
    if (!miss.ok) expect(miss.detail).toContain('audioMuted')
    expect(parseMeta(JSON.stringify({ ...META, totalRuns: '3' })).ok).toBe(false)
    const bad = parseMeta('nope')
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.reason).toBe('json')
  })
})

describe('save/strict — type level', () => {
  it('every mirror is mutually assignable with its domain type (checked by tsc; a drift fails the build)', () => {
    expectTypeOf<MetaMirrorCheck>().toEqualTypeOf<true>()
    expectTypeOf<RunMirrorCheck>().toEqualTypeOf<true>()
    expectTypeOf<CombatMirrorCheck>().toEqualTypeOf<true>()
    expectTypeOf<SaveFileMirrorCheck>().toEqualTypeOf<true>()
    const keys: readonly (keyof SaveFile)[] = ['saveVersion', 'contentVersion', 'meta', 'run', 'combat']
    expect(keys).toHaveLength(5)
  })
})
