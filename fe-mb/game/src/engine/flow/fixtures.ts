/**
 * flow/fixtures.ts — the `?screen=` dev fast-path and Playwright seeds (ARCHITECTURE §6).
 * A representative, deterministic state for every screen kind, built by running the REAL reducer from
 * `newRun(seed)` through a scripted action list — fixtures can never drift from the engine. The host
 * dispatches `dev/seedState { state: fixtureFor(kind, seed, env) }`.
 */
import type { Action } from '../actions'
import { reduce } from '../reducer'
import { resolveBattle } from '../combat/resolve'
import { seedBattle } from '../combat/seed'
import { battleSpecFor } from '../run/battle'
import { currentNode } from '../run/dialogue'
import type { CombatState, EngineEnv, GameState, NodeType, ScreenKind } from '../types'
import { initialState } from './lifecycle'
import { overlayOf } from './pump'

function apply(state: GameState, actions: readonly Action[], env: EngineEnv): GameState {
  let s = state
  for (const a of actions) {
    const r = reduce(s, a, env)
    const refused = r.effects.find((e) => e.kind === 'refused')
    if (refused !== undefined && refused.kind === 'refused') throw new Error(`fixture: ${a.type} refused — ${refused.reason}`)
    s = r.state
  }
  return s
}

/** Walk the open dialogue to its end, taking the first available choice at every fork. */
function closeDialogue(state: GameState, env: EngineEnv): GameState {
  let s = state
  for (let i = 0; i < 64 && overlayOf(s)?.kind === 'dialogue' && s.run !== null; i++) {
    const node = currentNode(s.run, env)
    if (node === null) break
    const choice = node.choices[0]
    s = apply(s, [choice === undefined ? { type: 'dialogue/continue' } : { type: 'dialogue/choose', choiceId: choice.id, attemptingUnitId: null }], env)
  }
  return s
}

function nodeOfType(type: NodeType, env: EngineEnv, pred: (n: { locked?: true | undefined }) => boolean = () => true): string {
  const node = env.content.overworld.nodes.find((n) => n.type === type && n.hidden !== true && pred(n))
  if (node === undefined) throw new Error(`fixture: content has no ${type} node`)
  return node.id
}

/** A run on the map, past the tutorial and the prologue. */
function onMap(seed: number, env: EngineEnv): GameState {
  const started = apply(initialState({ tutorialSeen: true, gameStarted: true }), [{ type: 'meta/newRun', seed }], env)
  return closeDialogue(started, env)
}

function atNodeMenu(state: GameState, nodeId: string, env: EngineEnv): GameState {
  return apply(state, [{ type: 'dev/teleport', nodeId }, { type: 'travel/goTo', nodeId }], env)
}

/** A representative 14×10 skirmish at the current node: the first authored enemy group at the area's level. */
function skirmish(state: GameState, env: EngineEnv): GameState {
  const run = state.run
  if (run === null) throw new Error('fixture: no run')
  const enemyGroupId = Object.keys(env.content.enemyGroups)[0]
  if (enemyGroupId === undefined) throw new Error('fixture: content has no enemy group')
  const spec = battleSpecFor(run, { origin: { kind: 'quest', nodeId: run.nodeId }, enemies: { kind: 'group', enemyGroupId, level: 1 }, captureTargets: [] }, env)
  return apply(state, [{ type: 'dev/startBattle', spec }], env)
}

/** The battle that is up, decided on the spot: one team cut down where it stood, the phase set; settle pays out.
 *  `dev/seedState` is the door because a fixture must go through the REAL settle — the report, the payout, the
 *  death log and the screen all come from the engine, never from a hand-built object. */
function decide(state: GameState, loser: 'enemy' | 'party', env: EngineEnv): GameState {
  const combat = state.combat
  if (combat === null) throw new Error('fixture: no battle')
  const units = { ...combat.units }
  for (const u of Object.values(units)) {
    if (u.team === loser && u.position !== null) units[u.id] = { ...u, hp: { ...u.hp, current: 0 }, position: null, lastTile: u.position }
  }
  const ended: CombatState = { ...combat, units, phase: loser === 'enemy' ? 'victory' : 'defeat' }
  return apply(state, [{ type: 'dev/seedState', state: { ...state, combat: ended } }], env)
}

/** The skirmish, won on the spot. */
function wonField(state: GameState, env: EngineEnv): GameState {
  return decide(skirmish(state, env), 'enemy', env)
}

/** Clear the report's claim queue so `battleEnd/dismiss` is legal (a guaranteed drop that did not fit waits). */
function claimLoot(state: GameState, env: EngineEnv): GameState {
  let s = state
  for (let i = 0; i < 8 && (s.run?.pendingLoot.length ?? 0) > 0; i++) {
    const itemId = s.run?.pendingLoot[0]
    if (itemId === undefined) break
    const took = reduce(s, { type: 'run/takeLoot', itemId }, env)
    s = took.effects.some((e) => e.kind === 'refused') ? apply(s, [{ type: 'run/forfeitLoot', itemId }], env) : took.state
  }
  return s
}

export function fixtureFor(kind: ScreenKind, seed: number, env: EngineEnv): GameState {
  switch (kind) {
    case 'title':
      return initialState()
    case 'prologue':
      return apply(initialState({ tutorialSeen: true, gameStarted: true }), [{ type: 'meta/newRun', seed }], env)
    case 'overworld':
      return onMap(seed, env)
    case 'town':
      return apply(atNodeMenu(onMap(seed, env), nodeOfType('TOWN', env), env), [{ type: 'town/enter' }], env)
    case 'camp':
      return apply(atNodeMenu(onMap(seed, env), nodeOfType('CAMP', env), env), [{ type: 'camp/enter' }], env)
    case 'dungeon':
      return apply(atNodeMenu(onMap(seed, env), nodeOfType('DUNGEON', env, (n) => n.locked !== true), env), [{ type: 'dungeon/enter' }], env)
    case 'combat':
      return skirmish(onMap(seed, env), env)
    case 'battleEnd':
      return wonField(onMap(seed, env), env)
    // Both endings are DRIVEN, never assembled: the run walks to a terminal battle, the battle is decided, settle
    // writes the report and `battleEnd/dismiss` closes the run. That is the only way the win fixture can carry the
    // trophy DECISIONS requires ("the final boss drops a legendary, named on the win screen") and the only way the
    // game-over fixture can carry a death log with names in it — a hand-built `runLedger(run, outcome, null)` had
    // neither, so both screens were shot and judged with every counter at zero.
    case 'win': {
      const throne = nodeOfType('BOSS', env)
      const challenged = apply(atNodeMenu(onMap(seed, env), throne, env), [{ type: 'travel/challengeBoss' }], env)
      return apply(claimLoot(decide(challenged, 'enemy', env), env), [{ type: 'battleEnd/dismiss' }], env)
    }
    case 'gameOver': {
      // One fight won and read, then one lost: the ledger a defeat actually prints has a battle, gold and gear on
      // it, not six zeroes — the gate judged this screen with every counter at 0 because the fixture never fought.
      const won = apply(claimLoot(wonField(onMap(seed, env), env), env), [{ type: 'battleEnd/dismiss' }], env)
      const lost = decide(skirmish(closeDialogue(won, env), env), 'party', env)
      return apply(lost, [{ type: 'battleEnd/dismiss' }], env)
    }
  }
}

// Re-exported so a host can build one-off battles for screenshots without importing combat internals.
export { seedBattle, resolveBattle }
