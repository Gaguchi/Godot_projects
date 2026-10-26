/**
 * GATE3-18 — what the headless game PRINTS. `scripts/cli.ts` IS the game for anyone without a browser
 * (ARCHITECTURE §6, CONTRACT §10), but nothing ever read a whole frame of it: `tests/unit/cli/play.test.ts`
 * spawns the binary and greps for a substring, so a line printed twice, a count that disagreed with its noun,
 * a menu offering a verb the reducer refuses, and an item id in the run's last sentence all stayed green.
 *
 * These read FRAMES through `renderLines` and hold the CLI to the same two rules the screens are held to:
 * a menu is `flow/legality.ts#isLegal` spoken out loud (so every verb it offers dispatches without a refusal,
 * and the ones it withholds carry the reducer's own sentence), and no id and no authored name reaches the player
 * where the record carries the one they chose.
 */
import { describe, expect, it } from 'vitest'
import { boardLetters, menu, plural, refusalLine, renderAim, renderContracts, renderGear, renderLines, renderOverlay, replPolicy, toActions } from '../../../scripts/cli'
import { createEnv } from '../../../src/engine/content'
import { fixtureFor } from '../../../src/engine/flow/fixtures'
import { isLegal } from '../../../src/engine/flow/legality'
import { initialState } from '../../../src/engine/flow/lifecycle'
import { reduce } from '../../../src/engine/reducer'
import { battleSpecFor } from '../../../src/engine/run/battle'
import { chooseCheck, openCheckEvent } from '../../../src/engine/run/checks'
import { NOBODY_WOUNDED, innCost, shopStock } from '../../../src/engine/run/economy'
import { DESCENT_IS_ONE_WAY, ROOM_LABEL, leaveDungeon } from '../../../src/engine/run/dungeon'
import { NO_PRISONERS } from '../../../src/engine/run/town'
import { throneWarning } from '../../../src/engine/run/travel'
import { adjacency, nodeOf } from '../../../src/engine/run/overworld'
import { scoutedRoads, sightingFor } from '../../../src/engine/run/scout'
import type { Action } from '../../../src/engine/actions'
import type { CombatState, GameState, Prisoner, RunState, ScreenKind, TileKey } from '../../../src/engine/types'
import { createRuntime } from '../../../src/engine/flow/runtime'
import { carefulPolicy, greedyPolicy, randomPolicy } from '../../../src/engine/combat/sim'
import { forecast } from '../../../src/engine/combat/damage'
import { reachable } from '../../../src/engine/combat/grid'
import { legalTargets } from '../../../src/engine/combat/targeting'
import { cardFace, outcomeWords, reachWord } from '../../../src/engine/combat/words'
import { SCREEN_NAME } from '../../../src/engine/narration'

const env = createEnv()

function apply(state: GameState, actions: readonly Action[]): GameState {
  let s = state
  for (const a of actions) s = reduce(s, a, env).state
  return s
}

/**
 * Every parameterless verb the CLI's menus can offer, and the action `toActions` maps it to — SCREEN-AWARE,
 * exactly like `toActions` itself, because `leave` means three different actions in three places. GATE1-02: the
 * table used to be flat and to have no `inn` at all, so the town frame's hardcoded `[inn]` chip was dropped before
 * the assertion below ever saw it, and the one panel that lied was the one panel nothing checked.
 */
function actionFor(verb: string, state: GameState): Action | undefined {
  if (verb === 'leave') {
    if (state.screen.kind === 'town') return { type: 'town/leave' }
    if (state.screen.kind === 'dungeon') return { type: 'dungeon/leave' }
    return { type: 'camp/leave' }
  }
  const flat: Readonly<Record<string, Action>> = {
    'continue-travel': { type: 'travel/continue' },
    stay: { type: 'travel/stay' },
    town: { type: 'town/enter' },
    camp: { type: 'camp/enter' },
    dungeon: { type: 'dungeon/enter' },
    boss: { type: 'travel/challengeBoss' },
    inn: { type: 'town/innHeal' },
    rest: { type: 'camp/rest' },
    scout: { type: 'camp/scout' },
    dismiss: { type: 'battleEnd/dismiss' },
  }
  return flat[verb]
}

/** The verbs a frame offers in brackets — `[go <n>]` and friends carry an argument and are not menu offers. An
 *  offer may carry the BILL a press will pay (`[inn · 36 gold]`, CONTRACT-CHANGES 0138); the verb is the head of
 *  it, and the offer must still work. */
function advertised(frame: readonly string[], state: GameState): string[] {
  return frame.flatMap((line) => [...line.matchAll(/\[([a-z-]+)(?: · [^\]]+)?\]/g)].map((m) => m[1]!)).filter((v) => actionFor(v, state) !== undefined)
}

/** The menu is honest: dispatching anything it offers is never refused. This is the assertion GATE3-18 needed. */
function expectEveryOfferWorks(state: GameState): string[] {
  const offers = advertised(renderLines(state), state)
  for (const verb of offers) {
    const result = reduce(state, actionFor(verb, state)!, env)
    const refused = result.effects.filter((e) => e.kind === 'refused')
    expect(refused, `the menu offered [${verb}] and the reducer refused it`).toEqual([])
  }
  return offers
}

/** The first authored skirmish at the current node, won on the spot — the shape `flow/fixtures.ts#decide` uses,
 *  so the report, the payout and the screen all come out of the real settle rather than a hand-built object. */
function wonField(state: GameState): GameState {
  const run = state.run
  if (run === null) throw new Error('no run')
  const enemyGroupId = Object.keys(env.content.enemyGroups)[0]!
  const spec = battleSpecFor(run, { origin: { kind: 'quest', nodeId: run.nodeId }, enemies: { kind: 'group', enemyGroupId, level: 1 }, captureTargets: [] }, env)
  const started = apply(state, [{ type: 'dev/startBattle', spec }])
  const combat = started.combat
  if (combat === null) throw new Error('no battle')
  const units = { ...combat.units }
  for (const u of Object.values(units)) {
    if (u.team === 'enemy' && u.position !== null) units[u.id] = { ...u, hp: { ...u.hp, current: 0 }, position: null, lastTile: u.position }
  }
  const ended: CombatState = { ...combat, units, phase: 'victory' }
  return apply(started, [{ type: 'dev/seedState', state: { ...started, combat: ended } }])
}

describe('the headless frame', () => {
  // ── the tutorial step has ONE owner ──

  it('prints the tutorial step once, not once per surface', () => {
    const state = apply(initialState(), [{ type: 'meta/newRun', seed: 7 }])
    expect(state.screen.kind).toBe('combat')
    const frame = renderLines(state)
    // `renderBoard` printed it and `renderOverlay` printed it again, so the whole tutorial read double.
    expect(frame.filter((l) => l.startsWith('tutorial:'))).toEqual(['tutorial: move'])
  })

  it('a run-less tutorial battle still reads its step', () => {
    const state = apply(initialState(), [{ type: 'meta/newRun', seed: 7 }])
    // `combat --scenario tutorial` has no run at all; the step must survive the move off the board line.
    const runless: GameState = { ...state, run: null }
    expect(renderOverlay(runless)).toEqual(['tutorial: move'])
    expect(renderLines(runless).filter((l) => l.startsWith('tutorial:'))).toEqual(['tutorial: move'])
  })

  /**
   * RE-GATE C 3.11 — the headless frame stamped `PASSED` on an option that carried no check at all, because the
   * engine resolves one as `passed: true`. Passing claims a test was taken.
   */
  it('seals a choice that carried no check as CHOSEN, and a real roll as PASSED / FAILED', () => {
    const map = fixtureFor('overworld', 7, env)
    const open = (): GameState => ({ ...map, run: openCheckEvent(map.run!, 'bridge_crossing', 'travel', env).state })
    const sealOf = (state: GameState): string => renderOverlay(state).find((l) => / — /.test(l) && !l.startsWith('—'))!.trim().split(' — ')[0]!

    const declined = open()
    const long = { ...declined, run: chooseCheck(declined.run!, 'take_long_way', null, env).state }
    expect(sealOf(long)).toBe('CHOSEN')
    expect(renderOverlay(long)).not.toContainEqual(expect.stringContaining('PASSED'))

    // nobody in the shipped company makes SPD 8: a real roll, really lost. It lives on the ambush rather than the
    // bridge because 0120 brought the bridge inside the company's reach — the bridge card was ALL dead rows.
    const ambush = { ...map, run: openCheckEvent(map.run!, 'ambush_toll', 'travel', env).state }
    const rolled = { ...ambush, run: chooseCheck(ambush.run!, 'slip_away', null, env).state }
    expect(sealOf(rolled)).toBe('FAILED')
  })

  // ── a menu is legality spoken out loud ──

  it('the node menu withholds continue-travel at the end of the road, and says why', () => {
    const start = fixtureFor('overworld', 2, env)
    const parked = apply(start, [{ type: 'travel/goTo', nodeId: start.run!.nodeId }])
    const frame = renderLines(parked)
    const line = frame.find((l) => l.startsWith('— at '))!

    const refusal = isLegal(parked, { type: 'travel/continue' }, env)
    expect(refusal.ok, 'this fixture is meant to be parked at the end of a road').toBe(false)
    expect(line).not.toContain('[continue-travel]')
    // the reducer's own sentence, not a paraphrase
    expect(frame).toContain(`  ✗ continue-travel: ${refusal.ok ? '' : refusal.reason}`)
    expect(line).toContain('[stay]')
    expectEveryOfferWorks(parked)
  })

  it('camp offers only what the day has left; verbs that share a reason share a line', () => {
    const camp = fixtureFor('camp', 2, env)
    const before = renderLines(camp)
    const menuLine = before.find((l) => l.startsWith('camp — '))!
    // CONTRACT-CHANGES 0052: a whole company at full HP makes Rest illegal, not merely pointless.
    expect(menuLine).not.toContain('[rest]')
    expect(menuLine).toContain('[scout]')
    expect(before.some((l) => l.startsWith('  ✗ rest: '))).toBe(true)
    expect(expectEveryOfferWorks(camp)).toContain('scout')

    const after = apply(camp, [{ type: 'camp/scout' }])
    const spent = renderLines(after)
    const reason = isLegal(after, { type: 'camp/rest' }, env)
    expect(spent.find((l) => l.startsWith('camp — '))).toBe('camp — [leave]')
    expect(spent).toContain(`  ✗ rest, scout: ${reason.ok ? '' : reason.reason}`)
    expectEveryOfferWorks(after)
  })

  /**
   * RE-GATE C 3.9. Headless, the ration bought `· scouted` and nothing else: `camp/scout` pre-rolled thirteen
   * roads and no frame in the CLI could print one of them. The report is the camp's, and the sighting for the road
   * the player is about to pick rides the `roads:` line the map's `go <node>` is chosen from.
   */
  it('the ration buys a REPORT headless too — at the camp, and on the road line the hop is chosen from', () => {
    const camp = fixtureFor('camp', 2, env)
    expect(renderLines(camp).some((l) => l.includes('what the scouts saw'))).toBe(false)

    const scouted = apply(camp, [{ type: 'camp/scout' }])
    const report = renderLines(scouted)
    const header = report.find((l) => l.includes('what the scouts saw'))!
    expect(header).toBeDefined()
    const roads = scoutedRoads(scouted.run!, env)
    expect(roads.length).toBeGreaterThan(0)
    expect(header).toContain(plural(roads.length, 'road'))
    for (const r of roads) {
      const row = report.find((l) => l.includes(`${nodeOf(r.from, env).name} → ${nodeOf(r.to, env).name}`))
      expect(row, `${r.from}->${r.to} is in the report`).toBeDefined()
      expect(row).toContain(r.sighting.report)
      expect(row).not.toContain(r.to)   // the PLACE, never the node id (ARCHITECTURE §5.1)
    }

    // …and on the map frame, against the road it belongs to
    const onMap = apply(scouted, [{ type: 'camp/leave' }, { type: 'travel/stay' }])
    const line = renderLines(onMap).find((l) => l.startsWith('roads: '))!
    const here = onMap.run!.nodeId
    for (const to of adjacency(onMap.run!, env)[here] ?? []) {
      const sighting = sightingFor(onMap.run!, here, to)
      if (sighting === null) continue
      expect(line).toContain(`scouted: ${sighting.report.toLowerCase()}`)
    }
    expect(line).toMatch(/scouted: /)
  })

  it('the town withholds the bed nobody needs and the desk with an empty wagon, and says why', () => {
    // GATE1-01/02: `[inn]` was a hardcoded chip on a hardcoded line. The company arrives at full HP with an empty
    // wagon, so both verbs are illegal — and the frame must say so rather than offer them.
    const town = fixtureFor('town', 2, env)
    const frame = renderLines(town)
    expect(frame.some((l) => l.includes('[inn]'))).toBe(false)
    expect(frame.some((l) => l.includes('[turnin'))).toBe(false)
    expect(frame).toContain(`  ✗ inn: ${NOBODY_WOUNDED}`)
    expect(frame).toContain(`  ✗ turnin <n|all>: ${NO_PRISONERS}`)
    expect(frame).toContain('  town — [buy <n>] [sell <x,y>] [talk <n>] [leave]')
    // ARCHITECTURE §5.1: the empty state is prose, the refusal is a fragment — and they are not the same string
    expect(frame.some((l) => l.startsWith('  bounty: No prisoners in the wagon.'))).toBe(true)
    expect(expectEveryOfferWorks(town)).toContain('leave')

    // wound the company and the bed is offered — and works
    const run = town.run!
    const party = Object.fromEntries(Object.entries(run.party).map(([id, u]) => [id, { ...u, hp: { ...u.hp, current: 1 } }]))
    const hurt: GameState = { ...town, run: { ...run, party, gold: 999 } }
    // …and the offer carries the BILL, the way the browser's button does ("Rest the wounded · 36 gold"): the lead
    // line quotes the price a head and nothing anywhere multiplies them out (FINAL GATE A 1.1).
    const bed = renderLines(hurt).find((l) => l.includes('[inn'))!
    expect(bed).toContain(`[inn · ${innCost(env.content.towns[run.town!.townId]!, hurt.run!, env).total} gold]`)
    expect(expectEveryOfferWorks(hurt)).toContain('inn')
  })

  it('the field report withholds dismiss while gear is still waiting to be claimed', () => {
    const end = fixtureFor('battleEnd', 3, env)
    const itemId = Object.keys(env.content.items)[0]!
    const waiting: GameState = { ...end, run: { ...end.run!, pendingLoot: [itemId] } }
    expect(menu(waiting, [{ verb: 'dismiss', action: { type: 'battleEnd/dismiss' } }])).toEqual({
      open: '',
      shut: ['  ✗ dismiss: take or forfeit the found gear first'],
    })
    // and with nothing waiting it is offered, and works
    expect(renderLines(end)).toContain('  [dismiss]')
    expectEveryOfferWorks(end)
  })

  // ── a count agrees with its noun ──

  it('counts read as English', () => {
    expect(plural(1, 'round')).toBe('1 round')
    expect(plural(0, 'round')).toBe('0 rounds')
    expect(plural(2, 'round')).toBe('2 rounds')

    const end = fixtureFor('battleEnd', 3, env)
    const rounds = end.run!.lastBattle!.rounds
    const report = renderLines(end).find((l) => l.startsWith('FIELD REPORT'))!
    expect(report).toContain(` in ${plural(rounds, 'round')};`)
    expect(report).not.toMatch(/\b1 rounds\b/)
  })

  it('the run’s last line counts in English and NAMES the trophy', () => {
    const win = fixtureFor('win', 2, env)
    const line = renderLines(win).find((l) => l.startsWith('WON'))!
    expect(line).not.toMatch(/\b1 (days|hops|battles)\b/)
    const trophyId = win.ledger!.trophyItemId
    if (trophyId !== null) {
      // ARCHITECTURE §5.1: no id ever reaches the player, and the CLI is a player-facing surface.
      expect(line).toContain(env.content.items[trophyId]!.name)
      expect(line).not.toContain(`trophy ${trophyId}`)
    }
  })

  // ── the names the player chose ──

  it('the roster is labelled with the company the player named, and the report carries the MC’s name', () => {
    const named = apply(fixtureFor('overworld', 4, env), [
      { type: 'run/setMcName', name: 'Roswyn' },
      { type: 'run/setCompanyName', name: 'The Grey Company' },
    ])
    const roster = renderLines(named).find((l) => l.includes('Roswyn'))!
    expect(roster.startsWith('The Grey Company: Roswyn ')).toBe(true)
    expect(roster).not.toContain('The Foundling')

    // CONTRACT-CHANGES 0051: the engine resolves the name at WRITE time, so the report the CLI prints verbatim
    // can no longer disagree with the roster two lines above it.
    const won = wonField(named)
    expect(won.screen.kind).toBe('battleEnd')
    const survivors = renderLines(won).find((l) => l.startsWith('  survivors: '))!
    expect(survivors).toContain('Roswyn')
    expect(survivors).not.toContain('The Foundling')
  })

  it('an unnamed company still has a roster label', () => {
    const plain = fixtureFor('overworld', 2, env)
    expect(plain.run!.companyName).toBeNull()
    expect(renderLines(plain).some((l) => l.startsWith('party: '))).toBe(true)
  })
})

/**
 * GATE3-03 / GATE3-04 / GATE3-14 / GATE3-18 — the four places the headless game still spoke in machine.
 */
describe('the headless game speaks the player’s language', () => {
  const prisoner = (unitId: string, name: string): Prisoner =>
    ({ unitId, name, classId: 'bandit', level: 1, bountyValue: 20, capturedAtBattleId: 'battle:test' })

  const withPrisoners = (state: GameState, ...rows: readonly Prisoner[]): GameState =>
    ({ ...state, run: { ...state.run!, prisoners: rows } })

  // ── the bounty desk names people ──

  it('the bounty board reads the wagon by NAME and is turned in by row, never by unit id', () => {
    // It printed `bounty: brigands_0_3 20g` and made the player type `brigands_0_3` back (ARCHITECTURE §5.1).
    const town = withPrisoners(fixtureFor('town', 2, env), prisoner('brigands_0_3', 'Brigand'), prisoner('brigand_chief', 'Brigand Chief'))
    const line = renderLines(town).find((l) => l.startsWith('  bounty: '))!
    expect(line).toContain('1: Brigand ')
    expect(line).toContain('2: Brigand Chief ')
    expect(line).not.toContain('brigands_0_3')
    expect(line).not.toContain('brigand_chief')
    // and with a full wagon the desk is offered, by row
    expect(renderLines(town).some((l) => l.includes('[turnin <n|all>]'))).toBe(true)
    expect(renderLines(town).some((l) => l.includes('✗ turnin'))).toBe(false)
  })

  it('no line of a frame carries an id — including the three lines 0087 kept one on', () => {
    // 0087 kept an id on `roads:`, `shop:` and the town's `bag:` because each was "the ARGUMENT of the verb
    // printed beside it", and this case SKIPPED those three lines for that reason. 0139 gave all three a row
    // number instead, so the exemption is gone and every line of the frame is swept.
    const town = withPrisoners(fixtureFor('town', 2, env), prisoner('brigands_0_3', 'Brigand'))
    for (const line of renderLines(town)) {
      expect(line, `an id reached the player: ${line}`).not.toMatch(/brigands_0_3/)
      expect(line, `an id reached the player: ${line}`).not.toMatch(/food_rations/)
    }
  })

  // ── the descent is rooms, not grid codes ──

  it('the dungeon numbers its rooms and names them, and never prints a RoomId', () => {
    const dungeon = fixtureFor('dungeon', 21, env)
    const frame = renderLines(dungeon)
    const next = frame.find((l) => l.startsWith('  next: '))!
    expect(next).toMatch(/1: /)
    // `r0c0` is a grid code, and §5.1 bans one in copy
    expect(frame.join('\n')).not.toMatch(/\br\d+c\d+\b/)
    expect(next).toContain(ROOM_LABEL[dungeon.run!.activeDungeon!.graph.rooms[dungeon.run!.activeDungeon!.graph.rows[0]![0]!]!.type])
    expect(frame.some((l) => l.includes('[room <n>]'))).toBe(true)
  })

  /** RE-GATE C 3.12: the descent commits the company from the first room on, and the headless game said so only
   *  AFTER the door shut, as a refusal on `[leave]`. The warning belongs beside the lit verb. */
  it('warns about the one-way door while the door is still open, on the node menu and at the mouth', () => {
    const dungeon = fixtureFor('dungeon', 21, env)
    const run: RunState = dungeon.run!
    const d = run.activeDungeon!
    expect(renderLines(dungeon)).toContain(`  ${DESCENT_IS_ONE_WAY}`)
    // and the node menu that offers `dungeon` says it before the door, not after
    const outside: GameState = apply({ ...dungeon, run: { ...run, activeDungeon: null } }, [{ type: 'dungeon/leave' }])
    const at = renderLines(outside.run === null ? dungeon : { ...outside, screen: { kind: 'overworld' } })
    expect(at.join(String.fromCharCode(10))).toContain(DESCENT_IS_ONE_WAY)
    // once the company is past the first room the warning is spent: what stands there is the refusal
    const inside: GameState = { ...dungeon, run: { ...run, activeDungeon: { ...d, position: d.graph.rows[0]![0]! } } }
    expect(renderLines(inside)).not.toContain(`  ${DESCENT_IS_ONE_WAY}`)
  })

  /** RE-GATE C 3.14: the node menu offered `[boss]` over an empty frame. */
  it('names who holds the throne on the menu that offers the challenge', () => {
    const map = fixtureFor('overworld', 7, env)
    const boss = env.content.overworld.nodes.find((n) => n.type === 'BOSS')!
    const atThrone = apply(map, [{ type: 'dev/teleport', nodeId: boss.id }, { type: 'travel/goTo', nodeId: boss.id }])
    const frame = renderLines(atThrone)
    expect(frame.some((l) => l.includes('[boss]'))).toBe(true)
    const warning = throneWarning(atThrone.run!, env)!
    expect(frame).toContain(`  ${warning}`)
    // the same frame at a node that is not the last door says nothing of the kind
    expect(renderLines(map).join(String.fromCharCode(10))).not.toContain('no retreat')
  })

  it('the descent stops offering the way out the moment there is not one', () => {
    // GATE3-18: `[leave]` was a hardcoded chip, so it was offered five rooms into Smuggler's Cave, where
    // `run/dungeon.ts#leaveDungeon` answers "the only way out is through the boss".
    const dungeon = fixtureFor('dungeon', 21, env)
    const run: RunState = dungeon.run!
    const d = run.activeDungeon!
    const entrance = renderLines(dungeon)
    expect(leaveDungeon(run).ok, 'the mouth of a dungeon is a way out').toBe(true)
    expect(entrance.some((l) => l.includes('[leave]'))).toBe(true)

    const inside: GameState = { ...dungeon, run: { ...run, activeDungeon: { ...d, position: d.graph.rows[0]![0]! } } }
    const out = leaveDungeon(inside.run!)
    expect(out.ok).toBe(false)
    const frame = renderLines(inside)
    expect(frame.some((l) => l.includes('[leave]'))).toBe(false)
    expect(frame).toContain(`  ✗ leave: ${out.ok ? '' : out.reason}`)
    // and it is the module's own sentence, not a paraphrase the CLI invented
    expect(out.ok ? '' : out.reason).toBe('the only way out is through the boss')
  })

  // ── the town stops advertising what it cannot sell ──

  it('the town withholds buy, sell and talk when there is nothing to buy, sell or hear', () => {
    const town = fixtureFor('town', 2, env)
    const run = town.run!
    const broke: GameState = { ...town, run: { ...run, gold: 0, bag: [] } }
    const frame = renderLines(broke)
    expect(frame.some((l) => l.includes('[buy <n>]'))).toBe(false)
    expect(frame.some((l) => l.includes('[sell <x,y>]'))).toBe(false)
    expect(frame).toContain('  ✗ buy <n>: the purse holds 0 gold')
    expect(frame).toContain('  ✗ sell <x,y>: the bag is empty')
    expect(frame.some((l) => l.startsWith('  bag: empty'))).toBe(true)
  })

  // ── a refusal is a sentence against the verb that was typed ──

  it('a refusal names the verb the player typed and never an action type or a code', () => {
    expect(refusalLine('play', 'combat/playCard', 'no way through to strike from')).toBe('  ✗ play: no way through to strike from')
    // only a pump — which the player did not type — falls back to the action's own name
    expect(refusalLine(null, 'travel/step', 'not walking')).toBe('  ✗ travel/step: not walking')
  })

  // ── the two systems the headless game could create and never reach ──

  it('Contracts are readable without a browser, by name and stage', () => {
    // GATE3-14: two quests taken over a blind run and no verb anywhere that could read their stage.
    const overworld = fixtureFor('overworld', 4, env)
    const questId = Object.keys(env.content.quests)[0]!
    const taken = apply(overworld, [{ type: 'quest/start', questId }])
    const page = renderContracts(taken.run!)
    expect(page[0]).toContain('CONTRACTS')
    const row = page.find((l) => l.includes(env.content.quests[questId]!.name))
    expect(row, 'the contract is named').toBeDefined()
    expect(row).not.toContain(questId)
    // the stage is the AUTHORED label, never the stage id spelled out. FINAL GATE C 3.4: it was
    // `stage.replace(/_/g, ' ')`, so the headless Contracts page read "Blood Ties — Find daren" — a character's
    // name lower-cased on the page whose whole job is naming things.
    const stage = env.content.quests[questId]!.initialStage
    expect(row).not.toContain(stage)
    expect(row).not.toContain(stage.replace(/_/g, ' '))
    expect(row).toContain(env.content.quests[questId]!.stages[stage]!.label)
    // every stage in the shipped content carries one, and none of them is its own id in words
    for (const q of Object.values(env.content.quests)) {
      for (const st of Object.values(q.stages)) {
        expect(st.label, `${q.id}/${st.id}`).toBeTruthy()
        expect(st.label, `${q.id}/${st.id}`).not.toContain('_')
        expect(st.label.toLowerCase(), `${q.id}/${st.id}`).not.toBe(st.id.replace(/_/g, ' '))
      }
    }
    expect(renderContracts({ ...taken.run!, questStates: {} })).toEqual(['CONTRACTS — none taken yet.'])
  })

  it('gear can be read and moved between a hand and the bag without a browser', () => {
    // GATE3-14: a run could loot a Composite Bow and never put it in a hand headlessly.
    const town = fixtureFor('town', 2, env)
    const run = town.run!
    const page = renderGear(run)
    expect(page[0]).toContain('[equip <n> <left|right> <x,y>]')
    // units are ROWS and items are their authored names — no unit id, no item id
    expect(page[1]).toMatch(/^ {2}1: /)
    for (const line of page) for (const id of run.partyOrder) expect(line).not.toContain(id)

    const mcUnit = run.party[run.partyOrder[0]!]!
    expect(mcUnit.handLeft).not.toBeNull()
    const stripped = apply(town, [{ type: 'run/unequip', unitId: mcUnit.id, slot: 'left' }])
    expect(stripped.run!.party[mcUnit.id]!.handLeft).toBeNull()
    const cell = stripped.run!.bag.find((b) => b.itemId === mcUnit.handLeft)!
    const back = apply(stripped, [{ type: 'run/equip', unitId: mcUnit.id, itemId: cell.itemId, slot: 'left' }])
    expect(back.run!.party[mcUnit.id]!.handLeft).toBe(mcUnit.handLeft)
    expect(renderGear(back.run!)[1]).toContain(env.content.items[mcUnit.handLeft!]!.name)
  })
})


/**
 * FINAL GATE A 1.1-1.4 and FINAL GATE C 3.7-3.9 - the headless game stops speaking machine.
 *
 * The five surfaces the gate swept and found still printing ids, codes and one literal formula, plus the two
 * readings a headless player had no way to take at all. Each case here reads a WHOLE frame, the way 0086 taught
 * this suite to, because every one of these defects was invisible to a test that grepped for one line.
 */
const prisonerRow = (unitId: string, name: string): Prisoner =>
  ({ unitId, name, classId: 'bandit', level: 1, bountyValue: 20, capturedAtBattleId: 'battle:test' })

describe('the headless game shows no working', () => {
  const SCREENS: readonly ScreenKind[] = ['title', 'prologue', 'overworld', 'town', 'camp', 'dungeon', 'combat', 'battleEnd', 'win', 'gameOver']
  /** `brigands_0_3`, `food_rations`, `riverside_market` - a lowercase token with an underscore is an id. */
  const SNAKE = /\b[a-z][a-z0-9]*_[a-z0-9_]+\b/
  const everyFrame = (seed = 2): { readonly kind: ScreenKind; readonly frame: readonly string[] }[] =>
    SCREENS.map((kind) => ({ kind, frame: renderLines(fixtureFor(kind, seed, env)) }))

  // -- 1.4: a screen is a Named thing --

  it('every frame is headed by the screen NAME, never its routing kind', () => {
    for (const { kind, frame } of everyFrame()) {
      // `== battleEnd ==` where the browser's page is headed Field Report, `== gameOver ==` for Final Entry.
      expect(frame[0], kind).toBe(`\n== ${SCREEN_NAME[kind]} ==`)
      expect(frame[0], kind).not.toContain(kind)
    }
  })

  // -- 1.2 / 3.7: no id anywhere on a frame, and no schema enum --

  it('no line of any frame carries an id, a grid code or a schema enum', () => {
    const town = { ...fixtureFor('town', 2, env), run: { ...fixtureFor('town', 2, env).run!, prisoners: [prisonerRow('brigands_0_3', 'Brigand')] } }
    const frames = [...everyFrame(), ...everyFrame(21), { kind: 'town' as ScreenKind, frame: renderLines(town) }]
    for (const { kind, frame } of frames) {
      for (const line of frame) {
        expect(line, `an id reached the player on ${kind}: ${line}`).not.toMatch(SNAKE)
        expect(line, `a room grid code reached the player on ${kind}: ${line}`).not.toMatch(/\br\d+c\d+\b/)
        // `(frontier_camp, CAMP, tier 1)`: the machine node type and the internal difficulty knob rode the header
        // beside the id, on every run screen (FINAL GATE A 1.2).
        expect(line, `a schema enum reached the player on ${kind}: ${line}`).not.toMatch(/\b(TOWN|CAMP|DUNGEON|BOSS|TRAIL|DISCOVERY)\b/)
        expect(line, `an internal tier reached the player on ${kind}: ${line}`).not.toMatch(/tier \d/)
      }
    }
  })

  it('the header names the place and the KIND of place, in the word the map captions its sigil with', () => {
    const head = renderLines(fixtureFor('town', 2, env))[1]!
    expect(head).toContain('at Riverside Market (a town)')
    expect(head).toMatch(/^day \d+ {2}at /)
  })

  // -- 1.1: no formula --

  it('no frame does arithmetic on the glass; the inn quotes a price and the OFFER carries the bill', () => {
    for (const { kind, frame } of [...everyFrame(), ...everyFrame(21)]) {
      for (const line of frame) {
        expect(line, `a formula reached the player on ${kind}: ${line}`).not.toMatch(/\d\s*[x×]\s*\d/)
        expect(line, `a formula reached the player on ${kind}: ${line}`).not.toMatch(/=\s*\d/)
      }
    }
    const town = fixtureFor('town', 2, env)
    const inn = renderLines(town).find((l) => l.startsWith('  inn: '))!
    const per = env.content.towns[town.run!.town!.townId]!.innHealCostPerUnit
    expect(inn).toBe(`  inn: the innkeeper charges ${per} gold a head for the wounded`)
  })

  // -- 1.3: the hand reads like the browser's card face --

  it('the hand carries the face the browser shows, and names the reach instead of printing the band', () => {
    const battle = fixtureFor('combat', 2, env)
    const combat = battle.combat!
    const frame = renderLines(battle)
    const rows = frame.filter((l) => /^ {2}\d+: /.test(l))
    expect(rows.length).toBeGreaterThan(2)
    for (const line of rows) {
      // `1: Blaze  2 AP  enemy  r1-2` and `tile  r1-2 aoe2`: the authored codes 5.1 bans and 0065 removed from
      // the browser's card face.
      expect(line, line).not.toMatch(/\br\d+-\d+/)
      expect(line, line).not.toMatch(/\baoe\d/)
      expect(line, line).not.toMatch(/\b(all_enemies|all_allies)\b/)
    }
    const active = combat.units[combat.turn.unitId]!
    const deck = combat.decks[combat.turn.unitId]!
    deck.hand.forEach((uid, i) => {
      const inst = deck.cards[uid]!
      const card = env.content.cards[inst.cardId]!
      const face = cardFace(card, active, inst.mod)
      const row = rows[i]!
      expect(row, `card ${i + 1} carries the browser's own foot`).toContain(face.foot)
      expect(row).toContain(reachWord(card))
    })
  })

  // -- 3.8: the reach, the targets and the forecast --

  it('the board DRAWS the reach and the frame counts it, from the same selector the browser washes with', () => {
    const battle = fixtureFor('combat', 2, env)
    const combat = battle.combat!
    const frame = renderLines(battle)
    const walkable = Object.keys(reachable(combat, combat.turn.unitId))
    expect(walkable.length).toBeGreaterThan(4)
    const gridRows = frame.filter((l) => /^ *\d+ {2}[.:#+*A-Za-z ]+$/.test(l))
    expect(gridRows.length, 'the board drew its rows').toBe(combat.grid.height)
    const marks = gridRows.join('').split('+').length - 1
    expect(marks, 'one mark per reachable tile').toBe(walkable.length)
    expect(frame).toContain(`  steps: ${plural(walkable.length, 'tile')} marked + within one move  [move <x,y>]`)
    // …and it says WHY when there is no step to take, instead of drawing nothing and explaining nothing
    const moved: GameState = { ...battle, combat: { ...combat, units: { ...combat.units, [combat.turn.unitId]: { ...combat.units[combat.turn.unitId]!, hasMovedThisTurn: true } } } }
    expect(renderLines(moved).some((l) => l.startsWith('  steps: already moved'))).toBe(true)
    expect(renderLines(moved).filter((l) => /^ *\d+ {2}[.:#+*A-Za-z ]+$/.test(l)).join('')).not.toContain('+')
  })

  it('aim lists exactly the tiles the engine calls legal, and forecasts with the reducer’s own numbers', () => {
    // FINAL GATE C 3.8: the frame printed the board, the legend and the hand's range band - no target list and no
    // forecast anywhere - so a headless player spent activations on blind refusals. It cost a run at the boss.
    const battle = fixtureFor('combat', 2, env)
    const combat = battle.combat!
    const deck = combat.decks[combat.turn.unitId]!
    const active = combat.units[combat.turn.unitId]!
    const row = deck.hand.findIndex((uid) => legalTargets(combat, active.id, env.content.cards[deck.cards[uid]!.cardId]!, env).length > 0)
    expect(row, 'this fixture has at least one card with a target').toBeGreaterThanOrEqual(0)
    const inst = deck.cards[deck.hand[row]!]!
    const card = env.content.cards[inst.cardId]!
    const targets = legalTargets(combat, active.id, card, env)

    const page = renderAim(battle, row + 1, null)
    const list = page.find((l) => l.startsWith('  targets: '))!
    for (const t of targets) expect(list, `${t} is offered`).toContain(t)
    expect(list.match(/\d+,\d+/g)?.length ?? 0).toBe(targets.length)

    // a tile that is NOT legal is refused here, before the AP is spent, in the CLI's refusal voice
    const illegal = ['13,9', '0,0', '13,0'].find((t) => !targets.includes(t as TileKey))!
    expect(renderAim(battle, row + 1, illegal as TileKey).some((l) => l.startsWith('  ✗ play: '))).toBe(true)

    // and where a foe stands, the forecast is the SAME computation the reducer runs
    const occupied = targets.find((t) => Object.values(combat.units).some((u) => u.position === t && u.team !== active.team))
    if (occupied !== undefined) {
      const foe = Object.values(combat.units).find((u) => u.position === occupied)!
      const f = forecast(combat, active.id, { card, mod: inst.mod }, foe.id, env)!
      const lines = renderAim(battle, row + 1, occupied)
      expect(lines.some((l) => l.includes(outcomeWords(f, foe.armor)))).toBe(true)
      expect(lines.some((l) => l.includes(`hp ${foe.hp.current} → ${f.predictedHp}/${foe.hp.max}`))).toBe(true)
    }
  })

  it('the descent draws the whole floor and tallies what is left, the way the chart and the rail do', () => {
    const dungeon = fixtureFor('dungeon', 21, env)
    const d = dungeon.run!.activeDungeon!
    const frame = renderLines(dungeon)
    const chart = frame.filter((l) => l.startsWith('    row '))
    expect(chart.length, 'one line per row of the graph').toBe(d.graph.rows.length)
    d.graph.rows.forEach((row, i) => {
      for (const id of row) expect(chart[i]!, `${ROOM_LABEL[d.graph.rooms[id]!.type]} is on row ${i + 1}`).toContain(ROOM_LABEL[d.graph.rooms[id]!.type])
    })
    const tally = frame.find((l) => l.startsWith('  still below: '))!
    const fights = Object.values(d.graph.rooms).filter((r) => r.type === 'combat').length
    expect(tally).toContain(`${ROOM_LABEL.combat} ×${fights}`)
    expect(tally).toContain(`${ROOM_LABEL.boss} ×1`)
  })

  // -- 3.7: a verb takes a ROW or a LETTER, never an id --

  it('every list a verb reads from is addressed by its printed row, and capture by its printed letter', () => {
    const town = fixtureFor('town', 2, env)
    const rt = createRuntime({ env, initial: town, log: false })
    const stock = shopStock(env.content.towns[town.run!.town!.townId]!, town.run!, env)
    expect(toActions('buy 2', rt)).toEqual([{ type: 'town/buy', itemId: stock[1]!.id }])
    // a raw id still dispatches, for a script that logged one (the 0094 shape)
    expect(toActions(`buy ${stock[0]!.id}`, rt)).toEqual([{ type: 'town/buy', itemId: stock[0]!.id }])

    const map = fixtureFor('overworld', 2, env)
    const mapRt = createRuntime({ env, initial: map, log: false })
    const roads = adjacency(map.run!, env)[map.run!.nodeId] ?? []
    expect(toActions('go 2', mapRt)).toEqual([{ type: 'travel/goTo', nodeId: roads[1] }])

    const battle = fixtureFor('combat', 2, env)
    const battleRt = createRuntime({ env, initial: battle, log: false })
    const combat = battle.combat!
    // `capture <id>` took a unit id printed NOWHERE, so the only way to take a prisoner headless was to read
    // `mage_circle_2_1` out of a state dump. The board addresses a unit by its letter; so does the verb now.
    const letters = boardLetters(combat)
    const foe = Object.values(combat.units).find((u) => u.team === 'enemy')!
    expect(toActions(`capture ${letters.get(foe.id)}`, battleRt)).toEqual([{ type: 'combat/capture', targetId: foe.id }])
    expect(() => toActions('capture Z', battleRt)).toThrow(/letter/)
    // the satchel and the hand are rows too - one addressing rule for the whole frame
    expect(toActions('item 1', battleRt)).toEqual([{ type: 'combat/useItem', itemId: combat.consumables[0] }])
    expect(toActions('play 1 -', battleRt)).toEqual([{ type: 'combat/playCard', cardUid: combat.decks[combat.turn.unitId]!.hand[0], tile: null }])
  })

  // -- 3.9: the assist is the player the game is balanced around --

  it('auto and fight hand the turn to the CAREFUL player, the one every band is read off', () => {
    // They ran `greedyPolicy` while balance and both attrition paths are measured with `carefulPolicy` (0110), so
    // the only assist the headless player was offered was the player the game is not tuned for - it charged a lord
    // with four potions in the bag into a burn two hops from the throne (FINAL GATE C 3.9).
    expect(replPolicy(undefined)).toBe(carefulPolicy)
    expect(replPolicy('')).toBe(carefulPolicy)
    expect(replPolicy('careful')).toBe(carefulPolicy)
    expect(replPolicy('greedy')).toBe(greedyPolicy)
    expect(replPolicy('random')).toBe(randomPolicy)
    expect(() => replPolicy('reckless')).toThrow(/careful/)
  })
})
