/**
 * tests/unit/ui/chronicle.test.ts — the battle log's vocabulary (`src/ui/combat/chronicle.ts`).
 *
 * RE-GATE B 2.9: the field had 256×144 of empty leather at its bottom-left, and — more to the point — no answer
 * anywhere to "what just hit me". A float lives 700ms and is gone; an enemy phase pumps four of them.
 *
 * These cases are the two ways a log goes wrong. It says the same thing twice (a burn tick and the `unitHit` that
 * carries it are ONE event, and both were printed), and it prints machine grammar ("Oak is burn for 2 turns", a
 * card-face label dropped into a sentence). The mapper is pure, so both are checkable without a board.
 */
import { describe, expect, it } from 'vitest'
import type { Effect } from '../../../src/engine/effects'
import { CHRONICLE_KEPT, chronicleParts, extend, type Names } from '../../../src/ui/combat/chronicle'

const names: Names = { unit: (id) => (id === 'mc' ? 'Verity Locke' : id === 'oak' ? 'Bagrat "Oak"' : 'Obsidian Fighter'), card: () => 'Guard Break', item: () => 'Healing Potion' }

const say = (e: Effect): string => (chronicleParts(e, names)?.parts ?? []).join('')

const hit = (over: Partial<Extract<Effect, { kind: 'unitHit' }>> = {}): Effect => ({
  kind: 'unitHit', unitId: 'oak', tile: '1,1', sourceId: 'foe', hpLost: 13, armorLost: 0,
  damageType: 'physical', lethal: false, redirectedFrom: null, cause: 'enemyAction', ...over,
})

describe('the battle log speaks English', () => {
  it('names the striker, the struck and the number — never an id', () => {
    expect(say(hit())).toBe('Obsidian Fighter strikes Bagrat "Oak" for 13')
    expect(say(hit({ sourceId: null }))).toBe('Bagrat "Oak" takes 13')
    expect(say(hit({ redirectedFrom: 'mc' }))).toBe(`Obsidian Fighter strikes Bagrat "Oak" for 13 in Verity Locke's place`)
    for (const line of [say(hit()), say({ kind: 'unitDied', unitId: 'mc', tile: '0,0', team: 'party', cause: 'damage' })]) {
      expect(line).not.toMatch(/\boak\b|\bmc\b|_/)
    }
  })

  it('a status is a state, not the card face label', () => {
    // shipped as "Bagrat \"Oak\" is burn for 2 turns"
    expect(say({ kind: 'statusApplied', unitId: 'oak', status: 'burn', stacks: 1, turns: 2 })).toBe('Bagrat "Oak" is set alight for 2 turns')
    expect(say({ kind: 'statusApplied', unitId: 'oak', status: 'immobilize', stacks: 1, turns: 1 })).toBe('Bagrat "Oak" is held fast for 1 turn')
    expect(say({ kind: 'statusTicked', unitId: 'oak', status: 'burn', damage: 2 })).toBe('Bagrat "Oak" takes 2 from the flames')
  })

  it('one event is one line: a tick and a riposte do not also print their own blow', () => {
    expect(chronicleParts(hit({ cause: 'burn', hpLost: 2 }), names)).toBeNull()
    expect(chronicleParts(hit({ cause: 'poison', hpLost: 2 }), names)).toBeNull()
    expect(chronicleParts(hit({ cause: 'riposte', hpLost: 4 }), names)).toBeNull()
    // …and the ordinary blow still prints
    expect(chronicleParts(hit({ cause: 'card' }), names)).not.toBeNull()
  })

  it('a number is its own part, so the plate can strike it in the numeric face', () => {
    const line = chronicleParts(hit(), names)
    expect(line?.parts.filter((p) => typeof p === 'number')).toEqual([13])
  })

  it('the pumps are silent — a log that prints every effect is a debug console', () => {
    const quiet: readonly Effect[] = [
      { kind: 'turnStarted', unitId: 'oak', team: 'party', round: 2 },
      { kind: 'cardsDrawn', unitId: 'oak', uids: [], reshuffled: false },
      { kind: 'apChanged', unitId: 'oak', ap: 1, delta: -1 },
      { kind: 'sound', cue: 'hitPhysical' },
      { kind: 'autosave', urgent: false },
    ]
    expect(extend([], quiet, names, 0).log).toEqual([])
  })

  it('keeps the tail: the newest lines, in the order they happened', () => {
    const many = Array.from({ length: 9 }, (_, i) => hit({ hpLost: i + 1 }))
    const { log } = extend([], many, names, 0)
    expect(log).toHaveLength(CHRONICLE_KEPT)
    expect(log.map((l) => l.parts[1])).toEqual([6, 7, 8, 9])
    expect(new Set(log.map((l) => l.id)).size).toBe(CHRONICLE_KEPT)
  })

  it('a loss never reads like a gain: the tone follows the side', () => {
    expect(chronicleParts(hit(), names)?.tone).toBe('harm')
    expect(chronicleParts({ kind: 'unitHealed', unitId: 'mc', amount: 10, cause: 'item' }, names)?.tone).toBe('mend')
    expect(chronicleParts({ kind: 'unitDied', unitId: 'mc', tile: '0,0', team: 'party', cause: 'damage' }, names)?.tone).toBe('harm')
    expect(chronicleParts({ kind: 'unitDied', unitId: 'foe', tile: '0,0', team: 'enemy', cause: 'damage' }, names)?.tone).toBe('mend')
  })
})
