/**
 * flow/legality.ts — the ONE legality gate (table in docs/rewrite/CONTRACT.md §4; CONTRACT-CHANGES 0002).
 * `reducer.ts#reduce` applies it first; the UI reads it through `ui/store.ts#canDispatch / useLegal` for every
 * disabled-with-reason (ARCHITECTURE §5) — this module is on the ui import allow-list, `reducer.ts` is not.
 *
 * Legality is a function of the PERSISTED slices only (`meta`, `run`, `combat`, `ledger`, `screen`): it never
 * reads `state.ui`, so a replay may drop `ui/*` actions losslessly and the host pauses pumps with
 * `runtime.setPaused`, never through a modal flag. Pure, allocation-light, safe to call per render.
 *
 * Only the FLOW is gated here (which screen, which overlay, which slot). Rule-level refusals — range, bag room,
 * a card's cost — stay with the module that owns the rule, which returns the same reference plus one `refused`
 * effect; the UI asks those selectors for its finer disabled reasons.
 *
 * The rules the table DOES pull in are the ones whose verb cannot change the game at all when they fail, so
 * offering it is a lie (§4; each is a pure predicate exported by the module that owns it, read here AND by the
 * reducer, so the disabled control, the CLI menu and the refusal are one sentence with one home):
 *   `canEnterDungeon`      a sealed or cleared door                       (CONTRACT-CHANGES 0036)
 *   `canCampRest`          a Rest that mends nobody, or an empty larder  (0052, 0116)
 *   `canScout`             scouts walk on a ration the satchel may not have (0116)
 *   `canInnHeal`           a bed nobody needs, or one the purse can't buy (0089)
 *   `hasPrisoners`         a bounty desk with an empty wagon              (0089)
 *   `canEnterMove` / `canEnterCapture`   the two combat verbs that only ARM a selection (0089)
 *   `canTakeName`          a name the cast already answers to                (FINAL GATE C 3.15)
 */
import type { Action, Legality } from '../actions'
import type { EngineEnv, GameState, NodeType } from '../types'
import { canEnterCapture } from '../combat/capture'
import { canEnterMove } from '../combat/turn'
import { canCampRest } from '../run/camp'
import { currentNode, visibleChoices } from '../run/dialogue'
import { canEnterDungeon } from '../run/dungeon'
import { canInnHeal } from '../run/economy'
import { canTakeName } from '../run/naming'
import { canScout } from '../run/scout'
import { nodeOf } from '../run/overworld'
import { NO_PRISONERS, hasPrisoners } from '../run/town'
import { overlayOf } from './pump'

const OK: Legality = { ok: true }
const no = (reason: string): Legality => ({ ok: false, reason })

/** The one sentence for "a suspender is up" — the map and the dungeon both refuse a move with it. */
const NEEDS_ATTENTION = 'something needs your attention first'

/** Screens on which the party can manage its bag and gear (the loadout modal opens on all of them). */
const RUN_SCREENS: ReadonlySet<string> = new Set(['town', 'camp', 'overworld', 'dungeon', 'battleEnd'])

export function isLegal(state: GameState, action: Action, env: EngineEnv): Legality {
  const t = action.type
  const screen = state.screen.kind
  const run = state.run
  const combat = state.combat

  if (t.startsWith('ui/') || t.startsWith('dev/')) return OK

  switch (t) {
    case 'meta/newRun':
      return screen === 'title' || screen === 'win' || screen === 'gameOver' ? OK : no('a run is in progress')
    case 'meta/continueRun':
      if (screen !== 'title') return no('not on the title screen')
      return run !== null ? OK : no('no run to continue')
    case 'meta/toTitle':
      return screen !== 'title' ? OK : no('already on the title screen')
    case 'meta/dismissLedger':
      return screen === 'win' || screen === 'gameOver' ? OK : no('no ledger to dismiss')
    case 'meta/setAudioMuted':
      return OK
    case 'save/resume':
      return screen === 'title' ? OK : no('a save can only be installed on the title screen')
    case 'tutorial/skip':
      return screen === 'combat' && combat?.tag === 'tutorial' ? OK : no('not in the tutorial')
    case 'battleEnd/dismiss':
      if (screen !== 'battleEnd' || run === null || run.lastBattle === null) return no('no field report is open')
      return run.pendingLoot.length === 0 ? OK : no('take or forfeit the found gear first')
    default:
      break
  }

  if (t.startsWith('combat/')) {
    if (screen !== 'combat' || combat === null) return no('not in a battle')
    if (combat.phase !== 'combat') return no('the battle is over')
    const active = combat.units[combat.turn.unitId]
    if (active === undefined) return no('no active unit')
    if (t === 'combat/enemyStep' || t === 'combat/enemyAct') return active.team === 'enemy' ? OK : no('not the enemy turn')
    if (active.team !== 'party') return no('the enemy is acting')
    // The two ARMING verbs are the only combat actions whose entire outcome is a selection mode. Pressing one with
    // nothing to aim at cannot change the board, so the table answers them with the rule itself and the command
    // column stops offering a button that does nothing. Every other `combat/*` verb stays coarse by §4: its rules
    // (range, path, AP, hand membership) are answered by the module that owns them, on a real attempt.
    if (t === 'combat/enterMove') return canEnterMove(active)
    if (t === 'combat/enterCapture') return canEnterCapture(combat, active, env)
    return OK
  }

  if (run === null) return no('no run')
  if (t.startsWith('quest/')) return OK

  const overlay = overlayOf(state)
  const menuFor = (type: NodeType, verb: string): Legality => {
    if (screen !== 'overworld' || overlay?.kind !== 'quickMenu') return no(`${verb} only from the node menu`)
    return nodeOf(run.nodeId, env).type === type ? OK : no(`this is not a ${type.toLowerCase()}`)
  }

  switch (t) {
    // ── run: bag, gear, naming
    case 'run/takeLoot':
    case 'run/forfeitLoot':
      if (combat !== null || !RUN_SCREENS.has(screen)) return no('not now')
      return run.pendingLoot.includes(action.itemId) ? OK : no('that item is not waiting to be taken')
    case 'run/equip':
    case 'run/unequip':
    case 'run/moveBagItem':
    case 'run/discardItem':
    case 'run/reorderParty':
      return combat === null && RUN_SCREENS.has(screen) ? OK : no('not now')
    case 'run/setMcName':
    case 'run/setCompanyName': {
      if (combat !== null || !RUN_SCREENS.has(screen)) return no('not now')
      // The same rule the slip is held to — a name is a name whichever door it comes through (3.15).
      return canTakeName(run, action.type === 'run/setMcName' ? 'mc' : 'company', action.name, env)
    }

    // ── travel
    case 'travel/goTo': {
      if (screen !== 'overworld') return no('not on the map')
      if (overlay !== null && overlay.kind !== 'quickMenu') return no(NEEDS_ATTENTION)
      const status = run.pendingTravel?.status
      return status === 'walking' || status === 'suspended' ? no('already on the road') : OK
    }
    case 'travel/step':
      return screen === 'overworld' && run.pendingTravel?.status === 'walking' && overlay === null ? OK : no('not walking')
    case 'travel/continue':
      if (screen !== 'overworld' || overlay?.kind !== 'quickMenu') return no('not at a node menu')
      return (run.pendingTravel?.path.length ?? 0) > 0 ? OK : no('this is the end of the road')
    case 'travel/stay':
      return screen === 'overworld' && overlay?.kind === 'quickMenu' ? OK : no('not at a node menu')
    case 'travel/challengeBoss':
      return menuFor('BOSS', 'challenge')
    case 'town/enter':
      return menuFor('TOWN', 'enter')
    case 'camp/enter':
      return menuFor('CAMP', 'make camp')
    case 'dungeon/enter': {
      // CONTRACT §4: the way IN also carries `canEnterDungeon(run).ok`, so a SEALED (or cleared) door renders
      // disabled-with-reason through `useLegal` instead of looking pressable and doing nothing.
      const menu = menuFor('DUNGEON', 'enter')
      if (!menu.ok) return menu
      const gate = canEnterDungeon(run, env)
      return gate.ok ? OK : no(gate.reason)
    }

    // ── town
    case 'town/leave':
    case 'town/buy':
    case 'town/sell':
    case 'town/talk':
      return screen === 'town' && run.town !== null ? OK : no('not in a town')
    case 'town/innHeal': {
      // The bed's own rule (`run/economy.ts#canInnHeal`): a night that mends nobody, or one the purse cannot buy,
      // is illegal — the inn used to advertise itself to a company at full HP and refuse on the press.
      if (screen !== 'town' || run.town === null) return no('not in a town')
      const town = env.content.towns[run.town.townId]
      return town === undefined ? no('not in a town') : canInnHeal(town, run, env)
    }
    case 'town/turnInPrisoner':
      if (screen !== 'town' || run.town === null) return no('not in a town')
      return run.prisoners.some((p) => p.unitId === action.unitId) ? OK : no('no such prisoner')
    case 'town/turnInAllPrisoners':
      if (screen !== 'town' || run.town === null) return no('not in a town')
      return hasPrisoners(run) ? OK : no(NO_PRISONERS)

    // ── camp
    case 'camp/rest':
    case 'camp/scout':
      if (screen !== 'camp' || run.camp === null) return no('not in camp')
      if (run.camp.actionTaken) return no('the camp has done its one thing for today')
      // Both verbs are bought with a ration, and Rest with a whole company at full HP spends it for nothing: each
      // rule stays in the module that owns the verb, and the card reads the same sentence the reducer would refuse
      // with (`run/camp.ts#canCampRest`, `run/scout.ts#canScout` — the `canEnterDungeon` shape).
      return t === 'camp/rest' ? canCampRest(run, env) : canScout(run, env)
    case 'camp/leave':
      return screen === 'camp' && run.camp !== null ? OK : no('not in camp')

    // ── dungeon
    case 'dungeon/moveTo':
    case 'dungeon/leave':
      // Two refusals, never one: a company standing in the dark with a room event open is manifestly IN a dungeon,
      // and being told it is not contradicts the line the frame prints directly above (RE-GATE C 3.12). The
      // suspender's own sentence is the map's, word for word — one reason for one situation, everywhere.
      if (screen !== 'dungeon' || run.activeDungeon === null) return no('not in a dungeon')
      return overlay === null ? OK : no(NEEDS_ATTENTION)

    // ── suspenders
    case 'dialogue/choose':
      return overlay?.kind === 'dialogue' ? OK : no('no dialogue is open')
    case 'dialogue/continue': {
      if (overlay?.kind !== 'dialogue') return no('no dialogue is open')
      // Only a PLAYABLE choice keeps Continue off the band: a node whose choices are all hidden or all disabled
      // must still close, or the run has no legal action left (CONTRACT-CHANGES 0031).
      if (currentNode(run, env) === null) return no('no dialogue is open')
      return visibleChoices(run, env).some((c) => c.enabled) ? no('this line has choices') : OK
    }
    case 'check/choose':
      if (overlay?.kind !== 'checkEvent') return no('no event is open')
      return overlay.event.result === null ? OK : no('already resolved')
    case 'check/dismiss':
      if (overlay?.kind !== 'checkEvent') return no('no event is open')
      return overlay.event.result !== null ? OK : no('choose first')
    case 'name/submit':
      if (overlay?.kind !== 'namePrompt') return no('nothing to name')
      // The slip's own rule (`run/naming.ts#canTakeName`): empty, or a name somebody in the cast already answers
      // to — the shipped collision put the player's lord and the warlord on the two sides of the final board
      // under one string (FINAL GATE C 3.15).
      return canTakeName(run, overlay.prompt.target, action.name, env)
    default:
      return no(`unknown action ${t}`)
  }
}
