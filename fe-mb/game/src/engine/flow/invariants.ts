/**
 * flow/invariants.ts — structural rules as runtime checks (brief §7). Two callers: the dev/test harness after
 * every dispatch (`assertInvariants`; production skips it) and `save/codec.ts#parseSave`, which rejects a
 * shape-valid but slot-inconsistent file by name instead of letting the first selector throw (§2.14 rule 4).
 *
 * Checks (each a one-line string when violated):
 *  - screen:        `screen.kind === 'title' || screen.kind === resumeScreen(state)`; title ⇒ ledger null;
 *                   ledger ≠ null ⇔ screen ∈ {win, gameOver}; run null ⇒ screen ∈ {title, win, gameOver}.
 *  - defeat:        run ≠ null ∧ combat null ∧ screen ≠ battleEnd ⇒ livingUnits(run).length ≥ 1 ∧
 *                   (knobs.mcDeathIsDefeat ⇒ isMcAlive(run)). Under its own field report a company may be wiped:
 *                   turning that page ends the run (0082).
 *  - slots:         combat ≠ null ⇒ run.pendingCombat null; run.lastBattle ≠ null ⇒ pendingCombat null;
 *                   pendingCheckEvent and pendingDialogue never both non-null (a namePrompt MAY coexist with a dialogue);
 *                   pendingTravel suspended ⇒ a suspender is open or a travel-origin combat / pendingCombat exists;
 *                   town ≠ null ⇒ the current node is a TOWN; camp ≠ null ⇒ CAMP.
 *  - combat:        `combat.phase === 'combat'` (a finished battle is resolved by settle, never stored);
 *                   living units have unique in-bounds non-obstacle positions; `position === null ⇔ lastTile !== null`;
 *                   `turn.unitId` is living and uncaptured; deck partition (draw + hand + discard = cards);
 *                   `selection.cardUid` (if any) is in the active unit's hand.
 *  - run:           every bag rectangle inside `rules.bag` and non-overlapping; gold ≥ 0; charges ≥ 1;
 *                   partyOrder ⇔ party keys; no dead unit in party; every `unlockedNodes` / `spawnedNodes` id is a node.
 */
import type { EngineEnv, GameState } from '../types'
import { inBounds, isLiving, isObstacle } from '../combat/grid'
import { footprint, itemDef } from '../run/bag'
import { isMcAlive, livingUnits } from '../run/party'
import { resumeScreen } from './pump'

/** `[]` = ok; otherwise human-readable violations. */
export function checkInvariants(state: GameState, env: EngineEnv): readonly string[] {
  const out: string[] = []
  const { run, combat, ledger } = state
  const screen = state.screen.kind

  // screen
  if (screen !== 'title' && screen !== resumeScreen(state)) out.push(`screen '${screen}' but the slots imply '${resumeScreen(state)}'`)
  if (screen === 'title' && ledger !== null) out.push('title screen with a ledger')
  if ((ledger !== null) !== (screen === 'win' || screen === 'gameOver')) out.push('ledger must be set exactly on win/gameOver')
  if (run === null && screen !== 'title' && screen !== 'win' && screen !== 'gameOver') out.push(`no run on screen '${screen}'`)

  // Defeat is terminal — the ONE window in which a wiped company may still hold a run is the field report of the
  // fight that wiped it (settle rule 1 / CONTRACT-CHANGES 0082). `battleEnd/dismiss` is the only way off that
  // screen and it calls `endRun('lost')`, so the window closes on the next player action either way.
  if (run !== null && combat === null && screen !== 'title' && screen !== 'battleEnd') {
    if (livingUnits(run).length === 0) out.push('a run with no living unit')
    if (env.rules.knobs.mcDeathIsDefeat && !isMcAlive(run)) out.push('the MC is dead but the run goes on')
  }

  if (run !== null) {
    // slots
    if (combat !== null && run.pendingCombat !== null) out.push('pendingCombat while a battle is up')
    if (run.lastBattle !== null && run.pendingCombat !== null) out.push('pendingCombat under a field report')
    if (run.pendingCheckEvent !== null && run.pendingDialogue !== null) out.push('checkEvent and dialogue open at once')
    if (run.pendingTravel?.status === 'suspended') {
      const suspender = run.pendingDialogue !== null || run.pendingCheckEvent !== null || run.pendingNamePrompt !== null || run.pendingCombat !== null || combat !== null || run.lastBattle !== null
      if (!suspender) out.push('a suspended hop with nothing suspending it')
    }
    const node = env.content.overworld.nodes.find((n) => n.id === run.nodeId)
    if (node === undefined) out.push(`run.nodeId '${run.nodeId}' is not a node`)
    else {
      if (run.town !== null && node.type !== 'TOWN') out.push('run.town set off a TOWN node')
      if (run.camp !== null && node.type !== 'CAMP') out.push('run.camp set off a CAMP node')
    }

    // run
    const cells = new Set<string>()
    for (const e of run.bag) {
      const fp = footprint(itemDef(e.itemId, env))
      if (e.x < 0 || e.y < 0 || e.x + fp.w > env.rules.bag.width || e.y + fp.h > env.rules.bag.height) out.push(`bag entry ${e.itemId} at (${e.x},${e.y}) leaves the bag`)
      for (let dy = 0; dy < fp.h; dy++) for (let dx = 0; dx < fp.w; dx++) {
        const key = `${e.x + dx},${e.y + dy}`
        if (cells.has(key)) out.push(`bag overlap at ${key}`)
        cells.add(key)
      }
      if (e.charges < 1) out.push(`bag entry ${e.itemId} has ${e.charges} charges`)
    }
    if (run.gold < 0) out.push('negative gold')
    const keys = Object.keys(run.party).sort()
    if (keys.join() !== [...run.partyOrder].sort().join()) out.push('partyOrder and party disagree')
    for (const u of Object.values(run.party)) if (u.hp.current <= 0) out.push(`dead unit '${u.id}' still in the party`)
    const nodeIds = new Set(env.content.overworld.nodes.map((n) => n.id))
    for (const id of Object.keys(run.unlockedNodes)) if (!nodeIds.has(id)) out.push(`unlockedNodes names unknown node '${id}'`)
    for (const id of Object.keys(run.spawnedNodes)) if (!nodeIds.has(id)) out.push(`spawnedNodes names unknown node '${id}'`)
  }

  if (combat !== null) {
    // A finished battle is never a resting state: `flow/settle.ts` rule 1 resolves it in the same reduce, so a
    // PERSISTED `phase !== 'combat'` is a file that would pay itself out on the next action (`parseSave` rejects it).
    if (combat.phase !== 'combat') out.push(`a battle in phase '${combat.phase}' was stored instead of resolved`)
    const seen = new Set<string>()
    for (const u of Object.values(combat.units)) {
      if ((u.position === null) !== (u.lastTile !== null)) out.push(`unit '${u.id}': position/lastTile disagree`)
      if (u.position === null) continue
      if (!isLiving(u)) continue
      if (!inBounds(combat.grid, u.position) || isObstacle(combat.grid, u.position)) out.push(`unit '${u.id}' stands off the board or in a wall`)
      if (seen.has(u.position)) out.push(`two living units on ${u.position}`)
      seen.add(u.position)
    }
    if (combat.phase === 'combat') {
      const active = combat.units[combat.turn.unitId]
      if (active === undefined || !isLiving(active) || active.captured) out.push(`turn.unitId '${combat.turn.unitId}' cannot act`)
      // The round's ledger holds the unit that is holding the cursor, and nobody the battle has never heard of
      // (0115): a file that lost either would deal somebody a second turn.
      if (!combat.turn.acted.includes(combat.turn.unitId)) out.push(`turn.acted does not hold the acting unit '${combat.turn.unitId}'`)
      for (const id of combat.turn.acted) if (combat.units[id] === undefined) out.push(`turn.acted names '${id}', who is not in this battle`)
      if (combat.selection.kind === 'card') {
        const hand = active === undefined ? [] : combat.decks[active.id]?.hand ?? []
        if (!hand.includes(combat.selection.cardUid)) out.push('selected card is not in the active hand')
      }
    }
    for (const [id, deck] of Object.entries(combat.decks)) {
      const all = [...deck.draw, ...deck.hand, ...deck.discard].sort()
      if (all.join() !== Object.keys(deck.cards).sort().join()) out.push(`deck '${id}' is not a partition of its cards`)
    }
  }
  return out
}

/** Throws with every violation listed (test harness after every dispatch). */
export function assertInvariants(state: GameState, env: EngineEnv): void {
  const violations = checkInvariants(state, env)
  if (violations.length > 0) throw new Error(`invariants violated:\n - ${violations.join('\n - ')}`)
}
