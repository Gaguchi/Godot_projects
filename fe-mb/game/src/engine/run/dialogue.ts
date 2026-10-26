/**
 * run/dialogue.ts — trees, choices, text (brief §2.12). Speaker = character id resolved through
 * characters.json + `run.mcName`; body text supports `{mc}` / `{company}`.
 * Busts: `PendingDialogue.busts` is `[left, right]` character ids — left holds the last speaker of OUR side
 * (`mc`, companions, the narrator), right everyone else; a slot keeps its last occupant until another speaker of
 * that side talks (`bustsAfter(busts, speaker)` is the one rule).
 *
 * The runner is a pure step over `run.pendingDialogue`: the slot IS the machine (CONTRACT §1 pillar 5); the band
 * renders `currentNode` + `visibleChoices` and dispatches `dialogue/choose` / `dialogue/continue`.
 */
import { DIALOGUE_END } from '../../content/schemas'
import type { SliceResult } from '../actions'
import type { Effect } from '../effects'
import type { CheckCandidate, DialogueChoice, DialogueNode, DialogueSource, DialogueTree, EngineEnv, RunState, Unit, UnitId } from '../types'
import { autoPick, checkCandidates, evaluateCheck } from './checks'
import { displayName } from './party'
import { evaluate, predicateState } from './predicates'
import { applyQuestEffects } from './questEffects'

/** In-sentence placeholders before the naming beats (§2.16); the speaker plaque uses the character's `displayName`
 *  (`run/party.ts#displayName` resolves `mc` to the chosen name). */
const MC_PLACEHOLDER = 'the foundling'
const COMPANY_PLACEHOLDER = 'the company'

function treeOf(dialogueId: string, env: EngineEnv): DialogueTree {
  const tree = env.content.dialogues[dialogueId]
  if (tree === undefined) throw new Error(`dialogue: unknown tree '${dialogueId}'`)
  return tree
}

function refuse(run: RunState, action: 'dialogue/choose' | 'dialogue/continue', reason: string): SliceResult<RunState> {
  return { state: run, effects: [{ kind: 'refused', action, reason }] }
}

/** Throws (programmer error) if a check event is open. Sets the slot at `startNodeId` with `busts` from its speaker,
 *  applies the node's onEnter; emits `dialogueOpened`. An already-open dialogue is replaced (a tree may hand off). */
export function openDialogue(run: RunState, dialogueId: string, source: DialogueSource, env: EngineEnv): SliceResult<RunState> {
  if (run.pendingCheckEvent !== null) throw new Error(`openDialogue('${dialogueId}'): check event '${run.pendingCheckEvent.checkEventId}' is open — one suspender at a time (CONTRACT §3)`)
  const tree = treeOf(dialogueId, env)
  const node = tree.nodes[tree.startNodeId]
  if (node === undefined) throw new Error(`dialogue '${dialogueId}': startNodeId '${tree.startNodeId}' is not a node`)
  const opened: RunState = {
    ...run,
    pendingDialogue: { dialogueId, nodeId: node.id, source, busts: bustsAfter([null, null], node.speaker, env) },
  }
  const head: Effect = { kind: 'dialogueOpened', dialogueId, nodeId: node.id }
  const entered = applyQuestEffects(opened, node.onEnter ?? [], env)
  return { state: entered.state, effects: [head, ...entered.effects] }
}

export function currentNode(run: RunState, env: EngineEnv): DialogueNode | null {
  const pd = run.pendingDialogue
  if (pd === null) return null
  return env.content.dialogues[pd.dialogueId]?.nodes[pd.nodeId] ?? null
}

/** Hidden (`visibleIf`) filtered out; disabled (`enabledIf`) stay visible greyed with the threshold and best-in-party
 *  (`bestCandidate` is the top stat-check candidate, so the band can print `[STR 7] (Oak 6)`). */
export function visibleChoices(run: RunState, env: EngineEnv): readonly (DialogueChoice & { readonly enabled: boolean; readonly bestCandidate: CheckCandidate | null })[] {
  const node = currentNode(run, env)
  if (node === null) return []
  const pred = predicateState(run)
  return node.choices
    .filter((c) => c.visibleIf === undefined || evaluate(c.visibleIf, pred))
    .map((c) => ({
      ...c,
      enabled: c.enabledIf === undefined || evaluate(c.enabledIf, pred),
      bestCandidate: c.check?.kind === 'stat' ? (checkCandidates(c.check, run)[0] ?? null) : null,
    }))
}

function closeSlot(run: RunState): RunState {
  return { ...run, pendingDialogue: null }
}

/** Refused on hidden/disabled/unknown; check → onPass/onFail (auto-pick when `attemptingUnitId` is null);
 *  choice effects applied; next node's onEnter applied and `busts` updated; `'end'` → slot cleared + `dialogueClosed`.
 *
 *  Order — slot first, effects second: a choice effect that opens another suspender (`startDialogue` on a choice
 *  whose `next` is `end`, `startCombat` on the last beat) must find the slot already where the choice put it. */
export function choose(run: RunState, choiceId: string, attemptingUnitId: UnitId | null, env: EngineEnv): SliceResult<RunState> {
  const pd = run.pendingDialogue
  if (pd === null) return refuse(run, 'dialogue/choose', 'no dialogue is open')
  const tree = treeOf(pd.dialogueId, env)
  const node = tree.nodes[pd.nodeId]
  if (node === undefined) throw new Error(`dialogue '${pd.dialogueId}': node '${pd.nodeId}' is not in the tree`)
  const choice = node.choices.find((c) => c.id === choiceId)
  if (choice === undefined) return refuse(run, 'dialogue/choose', `unknown choice '${choiceId}'`)
  const pred = predicateState(run)
  if (choice.visibleIf !== undefined && !evaluate(choice.visibleIf, pred)) return refuse(run, 'dialogue/choose', `choice '${choiceId}' is hidden`)
  if (choice.enabledIf !== undefined && !evaluate(choice.enabledIf, pred)) return refuse(run, 'dialogue/choose', `choice '${choiceId}' is disabled`)

  let target: string
  if (choice.check !== undefined) {
    let attempting: Unit | null
    if (attemptingUnitId !== null) {
      attempting = run.party[attemptingUnitId] ?? null
      if (attempting === null) return refuse(run, 'dialogue/choose', `unknown unit '${attemptingUnitId}'`)
    } else {
      attempting = autoPick(choice.check, run, env)
    }
    const passed = evaluateCheck(choice.check, attempting, run, env)
    // The schema's XOR guarantees both targets exist when `check` does.
    target = (passed ? choice.onPass : choice.onFail) ?? DIALOGUE_END
  } else {
    target = choice.next ?? DIALOGUE_END
  }

  const ending = target === DIALOGUE_END
  const next = ending ? undefined : tree.nodes[target]
  if (!ending && next === undefined) throw new Error(`dialogue '${pd.dialogueId}': choice '${choiceId}' -> unknown node '${target}'`)

  const moved: RunState = ending
    ? closeSlot(run)
    : { ...run, pendingDialogue: { ...pd, nodeId: target, busts: bustsAfter(pd.busts, next?.speaker, env) } }
  const chosen = applyQuestEffects(moved, choice.effects, env)
  const effects: Effect[] = [...chosen.effects]
  let state = chosen.state
  // Only enter the next node if the choice's effects did not replace the dialogue (a `startDialogue` hand-off).
  const stillHere = state.pendingDialogue !== null && state.pendingDialogue.dialogueId === pd.dialogueId && state.pendingDialogue.nodeId === target
  if (next !== undefined && stillHere) {
    const entered = applyQuestEffects(state, next.onEnter ?? [], env)
    state = entered.state
    effects.push(...entered.effects)
  }
  if (ending) effects.push({ kind: 'dialogueClosed', dialogueId: pd.dialogueId })
  return { state, effects }
}

/** Nothing PLAYABLE → close. Refused only while a visible, enabled choice is on the band.
 *  A node whose choices are all hidden (`visibleIf`) or all disabled (`enabledIf`) has nothing to click and used to
 *  wedge the run — Continue illegal, every choice refused, the overlay refusing everything else (CONTRACT-CHANGES
 *  0031). `content/lint.ts` forbids authoring one; this is the engine's floor so bad content degrades, not locks. */
export function continueDialogue(run: RunState, env: EngineEnv): SliceResult<RunState> {
  const pd = run.pendingDialogue
  if (pd === null) return refuse(run, 'dialogue/continue', 'no dialogue is open')
  const node = currentNode(run, env)
  if (node === null) throw new Error(`dialogue '${pd.dialogueId}': node '${pd.nodeId}' is not in the tree`)
  if (visibleChoices(run, env).some((c) => c.enabled)) return refuse(run, 'dialogue/continue', `node '${node.id}' has choices`)
  return { state: closeSlot(run), effects: [{ kind: 'dialogueClosed', dialogueId: pd.dialogueId }] }
}

/** Our side = a unit character on the party TEAM (identity keys on `team`, never on classId or portrait colour —
 *  §7.7; Lilina's `mystic` portrait faction is an accent, not an allegiance) or a narrator/party-faction npc. */
function isLeftSide(characterId: string, env: EngineEnv): boolean {
  const c = env.content.characters[characterId]
  if (c === undefined) return false
  if (c.kind === 'unit' && c.team === 'party') return true
  return c.portrait.faction === 'party' || c.portrait.faction === 'narrator'
}

/** The bust rule: the speaker replaces the slot of its side (party/narrator → left, else right); undefined speaker (narrator) leaves both. */
export function bustsAfter(busts: readonly [string | null, string | null], speaker: string | undefined, env: EngineEnv): readonly [string | null, string | null] {
  if (speaker === undefined) return busts
  const [left, right] = busts
  if (isLeftSide(speaker, env)) return left === speaker ? busts : [speaker, right]
  return right === speaker ? busts : [left, speaker]
}

/** `{mc}` / `{company}` substitution; placeholders "the foundling" / "the company" before naming. */
export function renderText(text: string, run: RunState, _env: EngineEnv): string {
  const mc = run.mcName ?? MC_PLACEHOLDER
  const company = run.companyName ?? COMPANY_PLACEHOLDER
  return text.replaceAll('{mc}', mc).replaceAll('{company}', company)
}

/** 'mc' → mcName ?? displayName; undefined speaker → null (narrator). An unknown id renders as itself so a content
 *  slip never blanks the plaque (the lint reports it). */
export function speakerName(characterId: string | undefined, run: RunState, env: EngineEnv): string | null {
  if (characterId === undefined) return null
  const c = env.content.characters[characterId]
  if (c === undefined) return characterId
  // `run/party.ts#displayName` owns the mc-name rule (`mc` → run.mcName ?? name); feeding it the content display
  // name keeps ONE rule for the plaque, the roster and the HUD, whether or not the speaker is in the party yet.
  return displayName({ id: characterId, name: c.displayName }, run)
}
