/**
 * combat/tutorial.ts — first-run tutorial (brief §2.15): 5×5, the MC (from characters.json, iron_sword)
 * at rules.tutorial.mcPosition vs the authored bandit; overlay steps DERIVED from state.
 */
import type { BattleSpec, CombatState, EngineEnv, RngState, TutorialStep, Unit } from '../types'
import { rngLabels } from '../rules'
import { tileKey } from './grid'

/** In-battle steps only (enemyTurn / move / pickCard / target / endTurn); null unless `state.tag === 'tutorial'`.
 *  The `victory` step is produced by `flow/pump.ts#overlayOf` from `run.lastBattle.tag === 'tutorial'` on the
 *  battleEnd screen — `combat` is null by then.
 *  The step is a pure function of state (no env, no numbers): the player is nudged to move, then to pick and aim a
 *  card while AP and cards remain, and to end the turn once either runs out. */
export function tutorialStep(state: CombatState): TutorialStep | null {
  if (state.tag !== 'tutorial' || state.phase !== 'combat') return null
  const active = state.units[state.turn.unitId]
  if (active === undefined) return null
  if (active.team !== 'party') return 'enemyTurn'
  if (!active.hasMovedThisTurn) return 'move'
  if (state.selection.kind === 'card') return 'target'
  const hand = state.decks[active.id]?.hand ?? []
  return active.ap === 0 || hand.length === 0 ? 'endTurn' : 'pickCard'
}

/** `enemies: { kind: 'authored', units: [the rules.tutorial.bandit] }`, tutorial grid, `grid.terrain: null`. */
export function tutorialSpec(mc: Unit, rng: RngState, env: EngineEnv): BattleSpec {
  const bandit = env.rules.tutorial.bandit
  return {
    battleId: rngLabels.battleTutorial,
    tag: 'tutorial',
    origin: { kind: 'tutorial' },
    regionTier: 1, // the starting area's tier; the tutorial loot row is empty at every tier anyway
    enemyGroupId: null,
    grid: { width: env.rules.combat.tutorialGrid.width, height: env.rules.combat.tutorialGrid.height, obstacles: [], terrain: null },
    party: [mc],
    enemies: {
      kind: 'authored',
      units: [{
        id: bandit.id,
        name: bandit.name,
        classId: bandit.classId,
        level: mc.level, // the bandit is the foundling's peer; its sheet is fully authored below, level only labels it
        position: tileKey(bandit.position[0], bandit.position[1]),
        hp: bandit.hp,
        armor: null,
        stats: { str: bandit.str, spd: bandit.spd },
        bountyValue: null,
      }],
    },
    consumables: [],
    captureTargets: [],
    rng,
  }
}
