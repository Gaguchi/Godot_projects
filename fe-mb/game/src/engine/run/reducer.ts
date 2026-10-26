/**
 * run/reducer.ts — the run-side switch. Each case is a one-line delegate to the module that owns
 * the rule; sets `screen` on explicit transitions (town/enter → `enterTown` + town, town/leave → `leaveTown` +
 * overworld, camp/leave → overworld, dungeon/enter → dungeon, battleEnd/dismiss → by origin; tutorial → prologue
 * dialogue + `tutorialSeen`; finalBoss victory → `endRun('won')` — done by `reducer.ts`, the flow layer) so that
 * `screen === resumeScreen(state)` holds after every case. `travel/goTo` also resets `ui.mapPan`. Takes `GameState`
 * because a few cases read `combat` or write `screen`/`meta`; it never mutates `combat` (that is `flow/settle.ts`).
 * Emits `locationArrived`, `flagSet`, `quest*` from here — never a screen (§7.8).
 */
import type {
  ActionType,
  BattleEndAction,
  CampAction,
  CheckAction,
  DialogueAction,
  DungeonAction,
  NameAction,
  QuestAction,
  ReduceResult,
  RunAction,
  SliceResult,
  TownAction,
  TravelAction,
} from '../actions'
import type { Effect } from '../effects'
import type { EngineEnv, GameState, RunState, ScreenKind } from '../types'
import { resumeScreen } from '../flow/pump'
import { entryAt, moveEntry, placeInBag, removeAt } from './bag'
import { campRest, enterCamp, leaveCamp } from './camp'
import { chooseCheck, dismissCheck } from './checks'
import { choose, continueDialogue, openDialogue } from './dialogue'
import { enterDungeon, leaveDungeon, moveToRoom } from './dungeon'
import { planEquip, planUnequip } from './equipment'
import { setFlag } from './flags'
import { canTakeName } from './naming'
import { advanceQuest, completeQuest, startQuest } from './quests'
import { applyQuestEffects } from './questEffects'
import { scout } from './scout'
import { buy, enterTown, innHeal, leaveTown, sell, talk, turnIn } from './town'
import { challengeBoss, continueTravel, startTravel, stayHere, travelStep } from './travel'

export type RunSideAction =
  | RunAction
  | TravelAction
  | TownAction
  | CampAction
  | DungeonAction
  | DialogueAction
  | CheckAction
  | NameAction
  | QuestAction
  | BattleEndAction

/** The prologue tree (content id). Opened after the tutorial's Field Report, or straight away on later runs. */
export const PROLOGUE_DIALOGUE_ID = 'prologue'

function refused(state: GameState, action: ActionType, reason: string): ReduceResult {
  return { state, effects: [{ kind: 'refused', action, reason }] }
}

export function reduceRun(state: GameState, action: RunSideAction, env: EngineEnv): ReduceResult {
  const run = state.run
  if (run === null) return refused(state, action.type, 'no run')

  /** Lift a run-slice result into the game state; `screen` only when the case is an explicit transition. */
  const lift = (r: SliceResult<RunState>, screen?: ScreenKind): ReduceResult => {
    if (r.state === run && screen === undefined) return { state, effects: r.effects }
    const next: GameState = { ...state, run: r.state, ...(screen === undefined ? {} : { screen: { kind: screen } }) }
    return { state: next, effects: r.effects }
  }
  const pure = (next: RunState, screen?: ScreenKind): ReduceResult => lift({ state: next, effects: [] }, screen)
  const refuse = (reason: string): ReduceResult => refused(state, action.type, reason)

  switch (action.type) {
    // ── bag, gear, party, naming ──
    case 'run/equip': {
      const unit = run.party[action.unitId]
      if (unit === undefined) return refuse('no such unit')
      const plan = planEquip(unit, action.slot, action.itemId, run.bag, env)
      if (!plan.ok) return refuse(plan.reason)
      return pure({ ...run, party: { ...run.party, [unit.id]: plan.unit }, bag: plan.bag })
    }
    case 'run/unequip': {
      const unit = run.party[action.unitId]
      if (unit === undefined) return refuse('no such unit')
      const plan = planUnequip(unit, action.slot, run.bag, env)
      if (!plan.ok) return refuse(plan.reason)
      return pure({ ...run, party: { ...run.party, [unit.id]: plan.unit }, bag: plan.bag })
    }
    case 'run/moveBagItem': {
      const bag = moveEntry(run.bag, action.fromX, action.fromY, action.x, action.y, env)
      return bag === null ? refuse('it does not fit there') : pure({ ...run, bag })
    }
    case 'run/discardItem': {
      const entry = entryAt(run.bag, action.x, action.y)
      if (entry === null) return refuse('nothing there')
      return lift({ state: { ...run, bag: removeAt(run.bag, action.x, action.y) }, effects: [{ kind: 'itemRemoved', itemId: entry.itemId, reason: 'discarded' }] })
    }
    case 'run/takeLoot': {
      const bag = placeInBag(run.bag, [action.itemId], env)
      if (bag === null) return refuse('no room in the bag — discard something first')
      const item = env.content.items[action.itemId]
      if (item === undefined) return refuse('unknown item')
      const pendingLoot = run.pendingLoot.filter((id, i) => i !== run.pendingLoot.indexOf(action.itemId) || id !== action.itemId)
      return lift({ state: { ...run, bag, pendingLoot }, effects: [{ kind: 'itemAcquired', itemId: action.itemId, rarity: item.rarity, source: 'loot' }] })
    }
    case 'run/forfeitLoot': {
      const i = run.pendingLoot.indexOf(action.itemId)
      if (i < 0) return refuse('that item is not waiting')
      const pendingLoot = [...run.pendingLoot.slice(0, i), ...run.pendingLoot.slice(i + 1)]
      return lift({ state: { ...run, pendingLoot }, effects: [{ kind: 'itemRemoved', itemId: action.itemId, reason: 'forfeited' }] })
    }
    case 'run/reorderParty': {
      const same = action.order.length === run.partyOrder.length && run.partyOrder.every((id) => action.order.includes(id))
      return same ? pure({ ...run, partyOrder: [...action.order] }) : refuse('the new order must name every unit once')
    }
    case 'run/setMcName': {
      const gate = canTakeName(run, 'mc', action.name, env)
      if (!gate.ok) return refuse(gate.reason)
      const name = action.name.trim()
      return lift({ state: { ...run, mcName: name }, effects: [{ kind: 'nameSet', target: 'mc', name }] })
    }
    case 'run/setCompanyName': {
      const gate = canTakeName(run, 'company', action.name, env)
      if (!gate.ok) return refuse(gate.reason)
      const name = action.name.trim()
      return lift({ state: { ...run, companyName: name }, effects: [{ kind: 'nameSet', target: 'company', name }] })
    }

    // ── travel ──
    case 'travel/goTo': {
      const r = startTravel(run, action.nodeId, env)
      if (r.state === run) return { state, effects: r.effects }
      return { state: { ...state, run: r.state, ui: { ...state.ui, mapPan: null } }, effects: r.effects }
    }
    case 'travel/step':
      return lift(travelStep(run, env))
    case 'travel/continue':
      return pure(continueTravel(run))
    case 'travel/stay':
      return pure(stayHere(run))
    case 'travel/challengeBoss':
      return lift(challengeBoss(run, env))

    // ── town ──
    case 'town/enter': {
      const r = enterTown(run, env)
      return r.state === run && r.effects.some((e) => e.kind === 'refused') ? { state, effects: r.effects } : lift(r, 'town')
    }
    case 'town/leave':
      return pure(leaveTown(run), 'overworld')
    case 'town/innHeal':
      return lift(innHeal(run, env))
    case 'town/buy':
      return lift(buy(run, action.itemId, env))
    case 'town/sell':
      return lift(sell(run, action.x, action.y, env))
    case 'town/talk':
      return lift(talk(run, action.questId, action.dialogueId, env))
    case 'town/turnInPrisoner':
      return lift(turnIn(run, [action.unitId], env))
    case 'town/turnInAllPrisoners':
      return lift(turnIn(run, run.prisoners.map((p) => p.unitId), env))

    // ── camp ──
    case 'camp/enter': {
      const r = enterCamp(run, env)
      return r.effects.some((e) => e.kind === 'refused') ? { state, effects: r.effects } : lift(r, 'camp')
    }
    case 'camp/rest':
      return lift(campRest(run, env))
    case 'camp/scout':
      return lift(scout(run, env))
    case 'camp/leave':
      return pure(leaveCamp(run), 'overworld')

    // ── dungeon ──
    case 'dungeon/enter': {
      const r = enterDungeon(run, env)
      return r.effects.some((e) => e.kind === 'refused') ? { state, effects: r.effects } : lift(r, 'dungeon')
    }
    case 'dungeon/moveTo':
      return lift(moveToRoom(run, action.roomId, env))
    case 'dungeon/leave': {
      const r = leaveDungeon(run)
      return r.ok ? pure(r.run, 'overworld') : refuse(r.reason)
    }

    // ── suspenders ──
    case 'dialogue/choose':
      return lift(choose(run, action.choiceId, action.attemptingUnitId, env))
    case 'dialogue/continue':
      return lift(continueDialogue(run, env))
    case 'check/choose':
      return lift(chooseCheck(run, action.choiceId, action.attemptingUnitId, env))
    case 'check/dismiss':
      return lift(dismissCheck(run, env))
    case 'name/submit': {
      const prompt = run.pendingNamePrompt
      if (prompt === null) return refuse('nothing to name')
      // `run/naming.ts#canTakeName` is the single truth the flow gate reads too, so the slip's Set button is
      // already unlit with this sentence on it by the time a press could be refused (3.15).
      const gate = canTakeName(run, prompt.target, action.name, env)
      if (!gate.ok) return refuse(gate.reason)
      const name = action.name.trim()
      const named: RunState = prompt.target === 'mc' ? { ...run, mcName: name, pendingNamePrompt: null } : { ...run, companyName: name, pendingNamePrompt: null }
      return lift({ state: named, effects: [{ kind: 'nameSet', target: prompt.target, name }] })
    }

    // ── quest seams ──
    case 'quest/start':
      return lift(startQuest(run, action.questId, env))
    case 'quest/advance':
      return lift(advanceQuest(run, action.questId, action.toStage, env))
    case 'quest/complete':
      return lift(completeQuest(run, action.questId, env))
    case 'quest/setFlag':
      return lift(setFlag(run, action.key, action.value, action.scope))
    case 'quest/applyEffects':
      return lift(applyQuestEffects(run, action.effects, env))

    // ── the Field Report closes ──
    case 'battleEnd/dismiss': {
      const report = run.lastBattle
      if (report === null) return refuse('no field report is open')
      const effects: Effect[] = []
      let next: RunState = { ...run, lastBattle: null }
      let meta = state.meta
      if (report.tag === 'tutorial') {
        // Either outcome: the lesson is over, the story begins.
        meta = { ...meta, tutorialSeen: true }
        if (env.content.dialogues[PROLOGUE_DIALOGUE_ID] !== undefined) {
          const opened = openDialogue(next, PROLOGUE_DIALOGUE_ID, 'prologue', env)
          next = opened.state
          effects.push(...opened.effects)
        }
      }
      const routed: GameState = { ...state, meta, run: next }
      return { state: { ...routed, screen: { kind: resumeScreen(routed) } }, effects }
    }
  }
}
