/**
 * FINAL GATE A 1.5 — what the headless game SAYS happened.
 *
 * `scripts/cli.ts#describe` carried seven hand-written cases against the fifty-nine `Effect` kinds and printed the
 * rest as `${kind} ${JSON.stringify(rest)}`, so the CLI's only narration of a battle or a journey was the raw
 * effect stream: forty-two distinct raw-JSON lines, forty-three camelCase kind names, seventy snake_case ids and
 * three room grid codes over fifteen swept sessions — on a surface CONTRACT §10 calls a first-class way to play.
 * Even the four hand-written combat cases printed unit ids (`oak takes 5`, `ashfall_raiders_0_1 uses swing`).
 *
 * The table is `engine/narration.ts`, shared with the browser's battle plate so one blow cannot be narrated two
 * ways (`ui/combat/chronicle.ts`, the CONTRACT-CHANGES 0094 shape). These cases hold it to three rules:
 *   1. every declared kind is DECIDED — a sentence or an explicit silence, never a fallthrough;
 *   2. a narrated line never carries an id, a machine kind, or JSON — measured over a REAL effect stream, driven
 *      through the shipped reducer, which is the sweep the gate had to do by hand;
 *   3. the browser's plate is this table filtered, not a second copy of it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { chronicleParts } from '../../../src/ui/combat/chronicle'
import { createEnv } from '../../../src/engine/content'
import { fixtureFor } from '../../../src/engine/flow/fixtures'
import { initialState } from '../../../src/engine/flow/lifecycle'
import { createRuntime } from '../../../src/engine/flow/runtime'
import { carefulPolicy } from '../../../src/engine/combat/sim'
import { CHRONICLE_KINDS, SCREEN_NAME, narrate, type NameBook } from '../../../src/engine/narration'
import { displayName } from '../../../src/engine/run/party'
import { ROOM_LABEL } from '../../../src/engine/run/dungeon'
import { stageLabel } from '../../../src/engine/run/quests'
import type { Effect, EffectKind } from '../../../src/engine/effects'
import type { GameState } from '../../../src/engine/types'

const env = createEnv()

/** The declared union, read out of the source — so a kind added tomorrow joins this sweep the day it is declared. */
function declaredKinds(): readonly EffectKind[] {
  const src = readFileSync(join(process.cwd(), 'src', 'engine', 'effects.ts'), 'utf8')
  const kinds = [...src.matchAll(/readonly kind: '([a-zA-Z]+)'/g)].map((m) => m[1] as EffectKind)
  expect(kinds.length, 'the Effect union parsed').toBeGreaterThan(40)
  return [...new Set(kinds)]
}

const names: NameBook = {
  unit: () => 'Oak',
  card: () => 'Blaze',
  item: () => 'Healing Potion',
  place: () => 'Riverside Market',
  quest: () => 'The Missing Caravan',
  questStage: () => 'Return the reward',
  dungeon: () => 'Ancient Ruins',
  room: (type) => ROOM_LABEL[type],
}

const say = (e: Effect): string | null => {
  const line = narrate(e, names)
  return line === null ? null : line.parts.join('')
}

describe('every effect is DECIDED', () => {
  it('the narration table answers every declared kind — a sentence or an explicit silence', () => {
    const table = readFileSync(join(process.cwd(), 'src', 'engine', 'narration.ts'), 'utf8')
    const missing = declaredKinds().filter((k) => !table.includes(`case '${k}':`))
    // The switch is exhaustive at COMPILE time too (no `default:` arm), which is the defect this closes: the old
    // `default:` meant forty-six kinds were decided by accident.
    expect(missing, 'every Effect kind is answered by name in engine/narration.ts').toEqual([])
    expect(table).not.toMatch(/^\s*default:/m)
  })

  it('a pump is silent and a blow is not', () => {
    expect(say({ kind: 'sound', cue: 'gold' })).toBeNull()
    expect(say({ kind: 'turnStarted', unitId: 'oak', team: 'party', round: 2 })).toBeNull()
    expect(say({ kind: 'refused', action: 'combat/playCard', reason: 'out of reach' })).toBeNull()
    expect(say({ kind: 'unitHit', unitId: 'foe', tile: '1,1', sourceId: 'oak', hpLost: 7, armorLost: 0, damageType: 'physical', lethal: false, redirectedFrom: null, cause: 'card' }))
      .toBe('Oak strikes Oak for 7')
  })

  it('the run and the road speak too — the vocabulary the CLI had none of', () => {
    expect(say({ kind: 'goldChanged', delta: 78, reason: 'battle' })).toBe('the purse takes 78 gold')
    expect(say({ kind: 'goldChanged', delta: -30, reason: 'shop' })).toBe('the purse gives up 30 gold')
    expect(say({ kind: 'foodChanged', delta: -1, reason: 'hop' })).toBe('the larder gives up 1 ration')
    expect(say({ kind: 'hopStarted', from: 'a', to: 'b', westward: false, hopsLeft: 3 })).toBe('the company takes the road to Riverside Market')
    // the exact line the gate quoted as raw JSON: `roomEntered {"dungeonId":"ancient_ruins","roomId":"r0c0",…}`
    expect(say({ kind: 'roomEntered', dungeonId: 'ancient_ruins', roomId: 'r0c0', roomType: 'combat' })).toBe('the door opens on a fight')
    expect(say({ kind: 'statusApplied', unitId: 'oak', status: 'burn', stacks: 2, turns: 2 })).toBe('Oak is set alight for 2 turns')
    expect(say({ kind: 'questStarted', questId: 'q', stage: 's' })).toBe('a contract is taken — The Missing Caravan')
  })

  it('a line that needs a name the caller did not bring is not narrated — an id is never the fallback', () => {
    const bare: NameBook = { unit: () => 'Oak', card: () => 'Blaze', item: () => 'Healing Potion' }
    expect(narrate({ kind: 'hopLanded', nodeId: 'riverside_market' }, bare)).toBeNull()
    expect(narrate({ kind: 'dungeonCleared', dungeonId: 'ancient_ruins' }, bare)).toBeNull()
    expect(narrate({ kind: 'roomEntered', dungeonId: 'd', roomId: 'r0c0', roomType: 'boss' }, bare)).toBeNull()
  })
})

/**
 * The rule that matters, measured the way the gate measured it: over a REAL stream. A tutorial battle, a road leg
 * and a descent between them emit most of the union; every line any of them produces is held to §5.1.
 */
describe('a narrated stream carries no id, no machine kind and no JSON', () => {
  /** `brigands_0_3`, `food_rations`, `ancient_ruins` — a lowercase token with an underscore in it is an id. */
  const SNAKE = /\b[a-z][a-z0-9]*_[a-z0-9_]+\b/
  /** `r0c0` — a room's grid code. */
  const GRID = /\br\d+c\d+\b/

  function sweep(drive: (rt: ReturnType<typeof createRuntime>) => void, initial: GameState): { readonly lines: string[]; readonly kinds: Set<string> } {
    const lines: string[] = []
    const kinds = new Set<string>()
    const rt = createRuntime({ env, initial, log: false })
    const remembered = new Map<string, string>()
    rt.onEffects((effects) => {
      const state = rt.getState()
      const run = state.run
      const book: NameBook = {
        unit: (id) => {
          const fighting = state.combat?.units[id]
          if (fighting !== undefined) return run === null ? fighting.name : displayName(fighting, run)
          const member = run?.party[id]
          if (member !== undefined && run !== null) return displayName(member, run)
          return remembered.get(id) ?? env.content.characters[id]?.displayName ?? 'someone'
        },
        card: (id) => env.content.cards[id]?.name ?? 'a card',
        item: (id) => env.content.items[id]?.name ?? 'something',
        place: (id) => env.content.overworld.nodes.find((n) => n.id === id)?.name ?? 'somewhere',
        quest: (id) => env.content.quests[id]?.name ?? 'a contract',
        questStage: (questId, stage) => stageLabel(questId, stage, env),
        dungeon: (id) => env.content.dungeons[id]?.name ?? 'the dark',
        room: (type) => ROOM_LABEL[type],
      }
      for (const u of Object.values(state.combat?.units ?? {})) remembered.set(u.id, book.unit(u.id))
      for (const e of effects) {
        kinds.add(e.kind)
        const line = narrate(e, book)
        if (line !== null) lines.push(line.parts.join(''))
      }
    })
    drive(rt)
    return { lines, kinds }
  }

  it('a whole tutorial battle, fought and paid out', () => {
    const { lines, kinds } = sweep((rt) => {
      rt.dispatch({ type: 'meta/newRun', seed: 7 })
      rt.drain()
      for (let i = 0; i < 200; i++) {
        const c = rt.getState().combat
        if (c === null || c.phase !== 'combat') break
        if (c.units[c.turn.unitId]?.team === 'party') {
          rt.dispatch(carefulPolicy(c, env))
        }
        rt.drain()
      }
      rt.dispatch({ type: 'battleEnd/dismiss' })
      rt.drain()
    }, initialState())

    expect(kinds.size, 'the stream is broad enough to be worth sweeping').toBeGreaterThan(12)
    expect(lines.length).toBeGreaterThan(6)
    for (const line of lines) {
      expect(line, 'no JSON payload').not.toMatch(/[{}"]/)
      expect(line, 'no id').not.toMatch(SNAKE)
      expect(line, 'no grid code').not.toMatch(GRID)
      for (const kind of kinds) expect(line, `the machine kind '${kind}' reached the player`).not.toContain(kind)
    }
    // …and it actually said what happened, rather than saying nothing at all.
    expect(lines.some((l) => /strikes .+ for \d+/.test(l))).toBe(true)
    expect(lines.some((l) => l === 'the field is won' || l === 'the field is lost')).toBe(true)
  })

  it('a hop down the road, and a descent', () => {
    const map = fixtureFor('overworld', 21, env)
    const to = (env.content.overworld.edges.find((e) => e.from === map.run!.nodeId)?.to) ?? 'riverside_market'
    const { lines, kinds } = sweep((rt) => {
      rt.dispatch({ type: 'travel/goTo', nodeId: to })
      rt.drain()
      for (let i = 0; i < 40; i++) { rt.dispatch({ type: 'travel/continue' }); rt.drain() }
    }, map)
    expect(kinds.size).toBeGreaterThan(3)
    for (const line of lines) {
      expect(line, 'no JSON payload').not.toMatch(/[{}"]/)
      expect(line, 'no id').not.toMatch(SNAKE)
      for (const kind of kinds) expect(line, `the machine kind '${kind}' reached the player`).not.toContain(kind)
    }
    expect(lines.some((l) => l.startsWith('the company'))).toBe(true)
  })
})

describe('one account of a blow, two surfaces', () => {
  it("the browser's battle plate is the engine's table, filtered — never a second copy", () => {
    const blow: Effect = { kind: 'unitHit', unitId: 'foe', tile: '1,1', sourceId: 'oak', hpLost: 7, armorLost: 0, damageType: 'physical', lethal: false, redirectedFrom: null, cause: 'card' }
    expect(chronicleParts(blow, names)).toEqual(narrate(blow, names))
    // …and the plate stays narrow: the run-level vocabulary is the terminal's alone.
    expect(chronicleParts({ kind: 'goldChanged', delta: 78, reason: 'battle' }, names)).toBeNull()
    expect(narrate({ kind: 'goldChanged', delta: 78, reason: 'battle' }, names)).not.toBeNull()
    for (const kind of CHRONICLE_KINDS) expect(declaredKinds()).toContain(kind)
  })
})

describe('a screen is a Named thing', () => {
  it('every screen has a name, in Title Case, and none of them is its routing kind', () => {
    for (const [kind, name] of Object.entries(SCREEN_NAME)) {
      expect(name, kind).toMatch(/^[A-Z]/)
      expect(name, kind).not.toMatch(/[.]$/)
      expect(name, kind).not.toBe(kind)
      expect(name, kind).not.toMatch(/[a-z][A-Z]/)   // no camelCase routing field
    }
    // the two the browser heads its own pages with, bound to the same table (FINAL GATE A 1.4)
    const ui = (f: string): string => readFileSync(join(process.cwd(), 'src', 'ui', 'screens', f), 'utf8')
    expect(ui('FieldReport.tsx')).toContain('{SCREEN_NAME.battleEnd}')
    expect(ui('Ledger.tsx')).toContain('{SCREEN_NAME.gameOver}')
    expect(SCREEN_NAME.battleEnd).toBe('Field Report')
    expect(SCREEN_NAME.gameOver).toBe('Final Entry')
  })
})
