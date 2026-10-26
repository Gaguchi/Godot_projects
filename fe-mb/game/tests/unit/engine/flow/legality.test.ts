/**
 * flow/legality.ts — one case per row of the CONTRACT §4 table (WP-FLOW acceptance tests), plus the two
 * properties the gate exists for: it never reads `state.ui`, and the UI's disabled-with-reason is the SAME
 * function the reducer refuses with (so nothing can look pressable and then do nothing).
 */
import { describe, expect, it } from 'vitest'
import type { Action } from '../../../../src/engine/actions'
import { fixtureFor } from '../../../../src/engine/flow/fixtures'
import { isLegal } from '../../../../src/engine/flow/legality'
import { initialState } from '../../../../src/engine/flow/lifecycle'
import { overlayOf } from '../../../../src/engine/flow/pump'
import { reduce } from '../../../../src/engine/reducer'
import { NOTHING_TO_MEND } from '../../../../src/engine/run/camp'
import { openCheckEvent } from '../../../../src/engine/run/checks'
import { canEnterDungeon } from '../../../../src/engine/run/dungeon'
import { NOBODY_WOUNDED, innCost } from '../../../../src/engine/run/economy'
import { NO_PRISONERS } from '../../../../src/engine/run/town'
import type { GameState, ScreenKind } from '../../../../src/engine/types'
import { env } from '../../../helpers/env'

const SEED = 7
const at = (kind: ScreenKind): GameState => fixtureFor(kind, SEED, env)
const legal = (s: GameState, a: Action): boolean => isLegal(s, a, env).ok
const why = (s: GameState, a: Action): string => {
  const r = isLegal(s, a, env)
  return r.ok ? '' : r.reason
}

/** Apply actions through the REAL reducer, refusing to build a state the engine would not. */
function apply(state: GameState, actions: readonly Action[]): GameState {
  let s = state
  for (const a of actions) {
    const r = reduce(s, a, env)
    const refused = r.effects.find((e) => e.kind === 'refused')
    if (refused !== undefined && refused.kind === 'refused') throw new Error(`${a.type} refused: ${refused.reason}`)
    s = r.state
  }
  return s
}

/** Every living unit one HP down — the state in which a camp Rest is worth its ration. */
function wounded(state: GameState): GameState {
  const run = state.run
  if (run === null) throw new Error('fixture: no run')
  const party = Object.fromEntries(Object.entries(run.party).map(([id, u]) => [id, { ...u, hp: { ...u.hp, current: Math.max(1, u.hp.current - 1) } }]))
  return { ...state, run: { ...run, party } }
}

/** The company standing on `nodeId` with its quick menu open (the §2.9 current-node click). */
const atMenu = (nodeId: string, from: GameState = at('overworld')): GameState =>
  apply(from, [{ type: 'dev/teleport', nodeId }, { type: 'travel/goTo', nodeId }])

const nodeOfType = (type: string, pred: (n: { readonly locked?: true | undefined }) => boolean = () => true): string => {
  const n = env.content.overworld.nodes.find((x) => x.type === type && x.hidden !== true && pred(x))
  if (n === undefined) throw new Error(`content has no ${type} node`)
  return n.id
}

describe('legality — CONTRACT §4, one case per row', () => {
  it('meta/newRun: title, win and gameOver only', () => {
    for (const kind of ['title', 'win', 'gameOver'] as const) expect(legal(at(kind), { type: 'meta/newRun', seed: 1 })).toBe(true)
    for (const kind of ['overworld', 'town', 'combat', 'battleEnd'] as const) {
      expect(legal(at(kind), { type: 'meta/newRun', seed: 1 })).toBe(false)
    }
    expect(why(at('overworld'), { type: 'meta/newRun', seed: 1 })).toBe('a run is in progress')
  })

  it('meta/continueRun: the title screen with a run parked', () => {
    expect(why(initialState(), { type: 'meta/continueRun' })).toBe('no run to continue')
    const parked = apply(at('overworld'), [{ type: 'meta/toTitle' }])
    expect(legal(parked, { type: 'meta/continueRun' })).toBe(true)
    expect(why(at('overworld'), { type: 'meta/continueRun' })).toBe('not on the title screen')
  })

  it('meta/toTitle: every screen but title (combat included — the battle persists exactly)', () => {
    expect(why(initialState(), { type: 'meta/toTitle' })).toBe('already on the title screen')
    for (const kind of ['overworld', 'town', 'camp', 'dungeon', 'combat', 'battleEnd', 'prologue', 'win', 'gameOver'] as const) {
      expect(legal(at(kind), { type: 'meta/toTitle' }), kind).toBe(true)
    }
  })

  it('meta/dismissLedger: only where a ledger is rendered', () => {
    expect(legal(at('win'), { type: 'meta/dismissLedger' })).toBe(true)
    expect(legal(at('gameOver'), { type: 'meta/dismissLedger' })).toBe(true)
    expect(why(at('overworld'), { type: 'meta/dismissLedger' })).toBe('no ledger to dismiss')
  })

  it('save/resume: boot only', () => {
    const file = { saveVersion: env.rules.save.version, contentVersion: env.content.version, meta: initialState().meta, run: null, combat: null }
    expect(legal(initialState(), { type: 'save/resume', file })).toBe(true)
    expect(why(at('overworld'), { type: 'save/resume', file })).toBe('a save can only be installed on the title screen')
  })

  it('run/*: a run, no battle, and one of the five run screens', () => {
    const gear: Action = { type: 'run/unequip', unitId: 'mc', slot: 'left' }
    for (const kind of ['town', 'camp', 'overworld', 'dungeon', 'battleEnd'] as const) expect(legal(at(kind), gear), kind).toBe(true)
    expect(why(at('combat'), gear)).toBe('not now')
    expect(why(at('title'), gear)).toBe('no run')
  })

  it('run/takeLoot and run/forfeitLoot need the item to be waiting', () => {
    const report = at('battleEnd')
    const run = report.run
    if (run === null) throw new Error('fixture: no run')
    const itemId = Object.keys(env.content.items)[0]!
    const waiting = apply(report, [{ type: 'dev/seedState', state: { ...report, run: { ...run, pendingLoot: [itemId] } } }])
    expect(legal(waiting, { type: 'run/takeLoot', itemId })).toBe(true)
    expect(why(waiting, { type: 'run/takeLoot', itemId: 'not_an_item' })).toBe('that item is not waiting to be taken')
    // …and Continue is refused while one waits (the same gate the button reads)
    expect(why(waiting, { type: 'battleEnd/dismiss' })).toBe('take or forfeit the found gear first')
  })

  it('travel/goTo: the map, nothing suspending it, and not already on the road', () => {
    const map = at('overworld')
    const to = env.content.overworld.nodes[1]!.id
    expect(legal(map, { type: 'travel/goTo', nodeId: to })).toBe(true)
    expect(why(at('town'), { type: 'travel/goTo', nodeId: to })).toBe('not on the map')
    // a node click FROM the quick menu is legal in ONE dispatch (CONTRACT-CHANGES 0020)
    const menu = atMenu(nodeOfType('TOWN'))
    expect(overlayOf(menu)?.kind).toBe('quickMenu')
    expect(legal(menu, { type: 'travel/goTo', nodeId: to })).toBe(true)
  })

  it('travel/step is a pump: walking, on the map, with no overlay', () => {
    expect(why(at('overworld'), { type: 'travel/step' })).toBe('not walking')
    expect(why(at('title'), { type: 'travel/step' })).toBe('no run')
  })

  it('the node-menu verbs need the quick menu AND the matching node type', () => {
    const town = atMenu(nodeOfType('TOWN'))
    expect(legal(town, { type: 'town/enter' })).toBe(true)
    expect(why(town, { type: 'camp/enter' })).toBe('this is not a camp')
    expect(why(town, { type: 'dungeon/enter' })).toBe('this is not a dungeon')
    expect(why(town, { type: 'travel/challengeBoss' })).toBe('this is not a boss')
    expect(legal(town, { type: 'travel/stay' })).toBe(true)
    expect(why(at('overworld'), { type: 'town/enter' })).toBe('enter only from the node menu')
  })

  it('a locked dungeon is ILLEGAL, not merely refused — the Sealed verb carries its reason', () => {
    const lockedId = nodeOfType('DUNGEON', (n) => n.locked === true)
    const sealed = atMenu(lockedId)
    const gate = canEnterDungeon(sealed.run!, env)
    expect(gate.ok).toBe(false)
    const verdict = isLegal(sealed, { type: 'dungeon/enter' }, env)
    expect(verdict.ok).toBe(false)
    // the ONE truth: what the button shows disabled is exactly what the reducer would have said
    expect(verdict.ok ? '' : verdict.reason).toBe(gate.ok ? '' : gate.reason)
    expect(verdict.ok ? '' : verdict.reason).toMatch(/sealed/)
    // an unlocked one is legal from the same menu
    expect(legal(atMenu(nodeOfType('DUNGEON', (n) => n.locked !== true)), { type: 'dungeon/enter' })).toBe(true)
  })

  it('town/* (others): inside a town with the slot set', () => {
    const town = at('town')
    expect(legal(town, { type: 'town/leave' })).toBe(true)
    // A bed is only legal with a wound in it (see the two cases below), so the row's own case wounds the company —
    // otherwise it silently stopped testing what it says it tests, which is how the breach shipped.
    expect(legal(wounded(town), { type: 'town/innHeal' })).toBe(true)
    expect(why(at('overworld'), { type: 'town/leave' })).toBe('not in a town')
  })

  it('town/innHeal is ILLEGAL with nobody wounded, and with a purse that cannot pay', () => {
    // GATE1-01: the gate said "ok" to a whole company at full HP while the reducer refused on the press, so the
    // inn chip in the CLI and the brass REST in the browser both advertised a night that could not happen.
    const town = at('town')
    expect(Object.values(town.run!.party).every((u) => u.hp.current === u.hp.max)).toBe(true)
    expect(why(town, { type: 'town/innHeal' })).toBe(NOBODY_WOUNDED)
    const refused = reduce(town, { type: 'town/innHeal' }, env)
    expect(refused.state).toBe(town)
    expect(refused.effects).toEqual([{ kind: 'refused', action: 'town/innHeal', reason: NOBODY_WOUNDED }])

    // and the second reason lives in the same predicate: a wounded company with an empty purse
    const hurt = wounded(town)
    const broke: GameState = { ...hurt, run: { ...hurt.run!, gold: 0 } }
    const bill = innCost(env.content.towns[broke.run!.town!.townId]!, broke.run!, env).total
    expect(why(broke, { type: 'town/innHeal' })).toBe(`the innkeeper wants ${bill} gold`)
    expect(reduce(broke, { type: 'town/innHeal' }, env).state).toBe(broke)
  })

  it('the bounty desk is ILLEGAL with an empty wagon, and legal with a prisoner in it', () => {
    const town = at('town')
    expect(town.run!.prisoners).toEqual([])
    expect(why(town, { type: 'town/turnInAllPrisoners' })).toBe(NO_PRISONERS)
    expect(why(town, { type: 'town/turnInPrisoner', unitId: 'nobody' })).toBe('no such prisoner')
    const prisoner = { unitId: 'brigand_1', name: 'Brigand', classId: 'fighter', level: 1, bountyValue: null, capturedAtBattleId: 'b1' } as const
    const withOne: GameState = { ...town, run: { ...town.run!, prisoners: [prisoner] } }
    expect(legal(withOne, { type: 'town/turnInAllPrisoners' })).toBe(true)
    expect(legal(withOne, { type: 'town/turnInPrisoner', unitId: 'brigand_1' })).toBe(true)
  })

  it('camp/rest and camp/scout spend the camp’s one action; camp/leave never does', () => {
    const camp = wounded(at('camp'))
    expect(legal(camp, { type: 'camp/rest' })).toBe(true)
    expect(legal(camp, { type: 'camp/leave' })).toBe(true)
    const rested = apply(camp, [{ type: 'camp/rest' }])
    expect(why(rested, { type: 'camp/scout' })).toBe('the camp has done its one thing for today')
    expect(legal(rested, { type: 'camp/leave' })).toBe(true)
    expect(why(at('overworld'), { type: 'camp/rest' })).toBe('not in camp')
  })

  it('camp/rest is ILLEGAL with nobody wounded — the ration and the night are not spent on nothing', () => {
    // The gate is the single truth: the Camp screen reads this reason for its disabled Rest, and the reducer
    // refuses with the same sentence. Scout is untouched — it buys information, not health.
    const camp = at('camp')
    expect(camp.run?.party && Object.values(camp.run.party).every((u) => u.hp.current === u.hp.max)).toBe(true)
    expect(why(camp, { type: 'camp/rest' })).toBe(NOTHING_TO_MEND)
    expect(legal(camp, { type: 'camp/scout' })).toBe(true)
    const refused = reduce(camp, { type: 'camp/rest' }, env)
    expect(refused.state).toBe(camp)
    expect(refused.effects).toEqual([{ kind: 'refused', action: 'camp/rest', reason: NOTHING_TO_MEND }])
    expect(legal(wounded(camp), { type: 'camp/rest' })).toBe(true)
  })

  it('dungeon/moveTo and dungeon/leave: inside, with no overlay', () => {
    const dungeon = at('dungeon')
    expect(legal(dungeon, { type: 'dungeon/leave' })).toBe(true)
    expect(why(at('overworld'), { type: 'dungeon/leave' })).toBe('not in a dungeon')
  })

  /**
   * RE-GATE C 3.12 — with a room event open the dungeon refused BOTH verbs with 'not in a dungeon', one line under
   * a frame reading "Ancient Ruins — something; boss ahead". Two situations, two reasons; and the one for an open
   * suspender is the map's own word for word.
   */
  it('an open room event refuses the dungeon verbs for the reason that is TRUE, the map\'s own', () => {
    const dungeon = at('dungeon')
    const run = dungeon.run
    if (run === null) throw new Error('the dungeon fixture has no run')
    const opened: GameState = { ...dungeon, run: openCheckEvent(run, 'ancient_inscription', 'dungeon', env).state }
    expect(overlayOf(opened)?.kind).toBe('checkEvent')
    for (const a of [{ type: 'dungeon/leave' }, { type: 'dungeon/moveTo', roomId: 'r0c0' }] as const) {
      expect(why(opened, a)).toBe('something needs your attention first')
      expect(why(opened, a)).not.toBe('not in a dungeon')
    }
    // the map says exactly that, and has always said it — one sentence for one situation
    const map = at('overworld')
    const suspended: GameState = { ...map, run: openCheckEvent(map.run!, 'ancient_inscription', 'travel', env).state }
    expect(why(suspended, { type: 'travel/goTo', nodeId: 'x' })).toBe(why(opened, { type: 'dungeon/leave' }))
  })

  it('dialogue/*: an open dialogue; dialogue/continue only when nothing is playable (0031)', () => {
    const prologue = at('prologue')
    expect(overlayOf(prologue)?.kind).toBe('dialogue')
    expect(legal(prologue, { type: 'dialogue/choose', choiceId: 'x', attemptingUnitId: null })).toBe(true)
    expect(why(at('overworld'), { type: 'dialogue/choose', choiceId: 'x', attemptingUnitId: null })).toBe('no dialogue is open')
    expect(why(at('overworld'), { type: 'dialogue/continue' })).toBe('no dialogue is open')
  })

  it('check/*: choose needs an unresolved event, dismiss a resolved one', () => {
    const map = at('overworld')
    const run = map.run
    if (run === null) throw new Error('fixture: no run')
    const eventId = Object.keys(env.content.checkEvents)[0]!
    const opened = openCheckEvent(run, eventId, 'travel', env)
    const s = apply(map, [{ type: 'dev/seedState', state: { ...map, run: opened.state } }])
    expect(overlayOf(s)?.kind).toBe('checkEvent')
    expect(legal(s, { type: 'check/choose', choiceId: 'x', attemptingUnitId: null })).toBe(true)
    expect(why(s, { type: 'check/dismiss' })).toBe('choose first')
    expect(why(map, { type: 'check/choose', choiceId: 'x', attemptingUnitId: null })).toBe('no event is open')
  })

  it('name/submit: a prompt is up and the name is not blank', () => {
    const map = at('overworld')
    const run = map.run
    if (run === null) throw new Error('fixture: no run')
    const s = apply(map, [{ type: 'dev/seedState', state: { ...map, run: { ...run, pendingNamePrompt: { target: 'mc' } } } }])
    expect(overlayOf(s)?.kind).toBe('namePrompt')
    expect(legal(s, { type: 'name/submit', name: 'Ash' })).toBe(true)
    expect(why(s, { type: 'name/submit', name: '   ' })).toBe('a name cannot be empty')
    expect(why(map, { type: 'name/submit', name: 'Ash' })).toBe('nothing to name')
  })

  it('combat/*: the combat screen, an unfinished battle, and the right team on the clock', () => {
    const battle = at('combat')
    const combat = battle.combat
    if (combat === null) throw new Error('fixture: no battle')
    const active = combat.units[combat.turn.unitId]!
    const party = active.team === 'party'
    expect(legal(battle, { type: 'combat/endTurn' })).toBe(party)
    expect(legal(battle, { type: 'combat/enemyStep' })).toBe(!party)
    expect(why(at('overworld'), { type: 'combat/endTurn' })).toBe('not in a battle')
    const over = apply(battle, [{ type: 'dev/seedState', state: { ...battle, combat: { ...combat, phase: 'victory' } } }])
    // settle resolved it in the same dispatch — the battle screen is gone, so combat actions are refused
    expect(legal(over, { type: 'combat/endTurn' })).toBe(false)
  })

  it('tutorial/skip: only inside the tutorial battle', () => {
    expect(why(at('combat'), { type: 'tutorial/skip' })).toBe('not in the tutorial')
    const tutorial = apply(initialState(), [{ type: 'meta/newRun', seed: SEED }])
    expect(tutorial.combat?.tag).toBe('tutorial')
    expect(legal(tutorial, { type: 'tutorial/skip' })).toBe(true)
  })

  it('battleEnd/dismiss: the report is open and nothing is waiting to be taken', () => {
    expect(legal(at('battleEnd'), { type: 'battleEnd/dismiss' })).toBe(true)
    expect(why(at('overworld'), { type: 'battleEnd/dismiss' })).toBe('no field report is open')
  })

  it('ui/* and dev/* are always legal; quest/* needs a run', () => {
    for (const kind of ['title', 'overworld', 'combat', 'win'] as const) {
      expect(legal(at(kind), { type: 'ui/openModal', modal: { kind: 'pause' } }), kind).toBe(true)
      expect(legal(at(kind), { type: 'ui/setMapPan', pan: null }), kind).toBe(true)
      expect(legal(at(kind), { type: 'dev/setScreen', screen: { kind: 'title' } }), kind).toBe(true)
    }
    expect(legal(at('overworld'), { type: 'quest/start', questId: 'q' })).toBe(true)
    expect(why(at('title'), { type: 'quest/start', questId: 'q' })).toBe('no run')
  })

  it('legality ignores state.ui — every modal, tab and toggle leaves every verdict identical', () => {
    const probes: readonly Action[] = [
      { type: 'meta/toTitle' },
      { type: 'travel/goTo', nodeId: env.content.overworld.nodes[1]!.id },
      { type: 'travel/step' },
      { type: 'run/unequip', unitId: 'mc', slot: 'left' },
      { type: 'battleEnd/dismiss' },
      { type: 'combat/endTurn' },
      { type: 'town/enter' },
    ]
    for (const kind of ['title', 'overworld', 'town', 'camp', 'dungeon', 'combat', 'battleEnd', 'win'] as const) {
      const base = at(kind)
      const noisy: GameState = {
        ...base,
        ui: { ...base.ui, modal: { kind: 'pause' }, townTab: 'tavern', showDanger: !base.ui.showDanger, devHud: !base.ui.devHud, mapPan: { x: 12, y: 34 } },
      }
      for (const a of probes) expect(isLegal(noisy, a, env), `${kind} ${a.type}`).toEqual(isLegal(base, a, env))
    }
  })

  it('an illegal action returns the SAME state reference and exactly one refused effect', () => {
    const map = at('overworld')
    const r = reduce(map, { type: 'town/innHeal' }, env)
    expect(r.state).toBe(map)
    expect(r.effects).toEqual([{ kind: 'refused', action: 'town/innHeal', reason: 'not in a town' }])
  })
})
