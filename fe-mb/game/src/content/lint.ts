/**
 * Cross-reference lint over the content registry (brief §7.23, §10 "Content
 * lint"). Pure: takes a registry, returns problem strings. Empty = clean.
 * Run by `npm run lint:content` (scripts/lint-content.ts) and the content
 * unit test; a dangling id fails the gate.
 */
import { rules as defaultRules, type Rules } from '../engine/rules'
import { battlefieldFaults } from '../engine/content'
import { canHold } from '../engine/run/equipment'
import { content as defaultContent, type ContentRegistry } from './index'
import {
  CARD_BEARING_KINDS, GEAR_KINDS, QUEST_COMPLETE_STAGE, QUEST_EFFECT_KINDS, DIALOGUE_END, walkPredicate,
  type CaptureTarget, type CheckRequirement, type MapNodeRef, type Predicate, type QuestEffect, type QuestEffectKind,
  type Rarity, type StatKey, type UnitCharacter,
} from './schemas'

interface Site<T> {
  readonly at: string
  readonly value: T
}

/** The hand slots loot can fill (`rules.loot.handSlotOnly`) — the pool `run/loot.ts#lootPool` builds. */
const HAND_SLOT_KINDS = GEAR_KINDS

/**
 * QuestEffect kinds no CONTENT file emits, each with the reason (brief §7.8 "declared, never called"). Every other
 * kind must be fired by some quest stage, dialogue choice or check outcome. The rule fails BOTH ways — an unlisted
 * kind with no emitter, and a listed kind that has since gained one — so this table can never outlive its reason.
 */
const EFFECT_KIND_NO_CONTENT_EMITTER: Readonly<Partial<Record<QuestEffectKind, string>>> = {
  startDialogue: 'the ENGINE emits it: run/battle.ts#resolveCaptureTargets turns a CaptureTarget fate into one',
  advanceQuestStage: 'stages advance through their declared transitions (§2.12); hand-dispatching one is the pattern the brief removed',
}

/**
 * The words the player READS, everywhere content writes prose: every string a screen, an overlay or the CLI can
 * print verbatim. Ids, class ids and sprite ids are deliberately absent — this is the copy, not the wiring.
 */
function playerProse(c: ContentRegistry): readonly Site<string>[] {
  const out: Site<string>[] = []
  const say = (at: string, value: string | undefined) => { if (value !== undefined) out.push({ at, value }) }
  for (const d of Object.values(c.dialogues)) {
    for (const n of Object.values(d.nodes)) {
      say(`dialogue ${d.id}/${n.id}`, n.text)
      for (const ch of n.choices) say(`dialogue ${d.id}/${n.id}/${ch.id}`, ch.text)
    }
  }
  for (const ev of Object.values(c.checkEvents)) {
    say(`check event ${ev.id}`, ev.title)
    say(`check event ${ev.id}`, ev.description)
    for (const ch of ev.choices) {
      say(`check event ${ev.id}/${ch.id}`, ch.text)
      say(`check event ${ev.id}/${ch.id}`, ch.onPass.narration)
      say(`check event ${ev.id}/${ch.id}`, ch.onFail?.narration)
    }
  }
  for (const t of Object.values(c.towns)) {
    say(`town ${t.id}`, t.name)
    say(`town ${t.id}`, t.description)
    for (const rumor of t.rumors) say(`town ${t.id} rumour`, rumor)
    for (const q of t.tavernQuests) { say(`town ${t.id} tavern`, q.npcName); say(`town ${t.id} tavern`, q.npcDescription) }
  }
  for (const q of Object.values(c.quests)) {
    say(`quest ${q.id}`, q.name)
    // the stage line Contracts prints — authored since FINAL GATE C 3.4, so it is copy like any other
    for (const s of Object.values(q.stages)) say(`quest ${q.id}/${s.id} label`, s.label)
  }
  for (const it of Object.values(c.items)) say(`item ${it.id}`, it.name)
  for (const card of Object.values(c.cards)) say(`card ${card.id}`, card.name)
  for (const cls of Object.values(c.classes)) say(`class ${cls.id}`, cls.name)
  for (const ch of Object.values(c.characters)) say(`character ${ch.id}`, ch.displayName)
  for (const n of c.overworld.nodes) say(`node ${n.id}`, n.name)
  for (const rg of Object.values(c.regions)) say(`region ${rg.id}`, rg.name)
  for (const d of Object.values(c.dungeons)) say(`dungeon ${d.id}`, d.name)
  return out
}

/** One row per word the prose must not teach: a synonym for a verb the UI names differently, or a system that
 *  does not exist in this build. `say` completes "…— <say>" and names what the player would read instead. */
const MECHANIC_VOCABULARY: readonly { readonly alias: RegExp; readonly say: string }[] = [
  { alias: /\bsubdu(?:e|es|ed|ing)\b|\bsubjugate\b/i, say: 'the combat command, the CLI verb and the bounty desk all call it Capture' },
  { alias: /\bquest ?log\b|\bmission log\b/i, say: 'the band, the pause card and the modal title all call it Contracts' },
  { alias: /\bhit points?\b/i, say: 'every bar, forecast and report says HP' },
  { alias: /\bmana\b|\bstamina\b/i, say: 'a card is paid for in AP; there is no second pool' },
  { alias: /\bexperience points?\b|\bXP\b|\blevels? up\b|\blevelling up\b|\bleveling up\b/i, say: 'nothing in a run levels up (run/difficulty.ts) — do not promise it' },
  { alias: /\bweapon triangle\b/i, say: 'the weapon triangle was cut (DECISIONS) — no card reads one' },
]

export function lintContent(c: ContentRegistry = defaultContent, r: Rules = defaultRules): string[] {
  const problems: string[] = []
  const fail = (msg: string) => problems.push(msg)
  const has = (table: Readonly<Record<string, unknown>>, id: string) => id in table
  const ref = (at: string, what: string, table: Readonly<Record<string, unknown>>, id: string) => {
    if (!has(table, id)) fail(`${at}: unknown ${what} '${id}'`)
  }

  const predicates: Site<Predicate>[] = []
  const effects: Site<QuestEffect>[] = []
  const unlockRefs: Site<MapNodeRef>[] = []
  const flagWriters = new Set<string>()
  const referencedCards = new Set<string>()
  const referencedCheckEvents = new Set<string>()
  const allEncounterEntryIds = new Map<string, string>()

  /** A named enemy must BE in the group it is named for, its two scenes must exist, and its two flags count as
   *  written (a predicate may read them). Shared by encounter battles, `startCombat` effects and dungeon bosses. */
  const captureTargetsOk = (at: string, enemyGroupId: string, targets: readonly CaptureTarget[] | undefined) => {
    const group = c.enemyGroups[enemyGroupId]
    for (const ct of targets ?? []) {
      if (group && !group.members.some((m) => m.id === ct.unitId)) fail(`${at}: capture target '${ct.unitId}' is not a member id of group ${group.id}`)
      ref(at, 'dialogue', c.dialogues, ct.capturedDialogueId)
      ref(at, 'dialogue', c.dialogues, ct.killedDialogueId)
      flagWriters.add(ct.capturedFlag)
      flagWriters.add(ct.killedFlag)
    }
  }

  // ------------------------------------------------------------ classes
  for (const k of Object.values(c.classes)) {
    for (const id of k.innateCardIds) {
      ref(`class ${k.id}`, 'innate card', c.cards, id)
      referencedCards.add(id)
    }
  }

  // -------------------------------------------------------------- items
  for (const it of Object.values(c.items)) {
    const at = `item ${it.id}`
    if (it.buyPrice === 0) fail(`${at}: buyPrice 0 (unbuyable gear must omit buyPrice)`)
    if (it.buyPrice !== undefined && it.sellPrice !== Math.floor(it.buyPrice / 2)) fail(`${at}: sellPrice ${it.sellPrice} != 50% of buyPrice ${it.buyPrice}`)
    if (it.kind === 'potion' && it.effect === undefined) fail(`${at}: potion without an effect`)
    if (it.kind === 'quiver' && it.gearCardIds !== undefined) fail(`${at}: quiver must carry 0 cards`)
    // …and the mirror of that rule: a quiver with no modifier contributes nothing at all (`combat/deck.ts#modFor`
    // returns null), so it is a hand slot that costs gold and does not exist. `ItemSchema` refuses it too.
    if (it.kind === 'quiver' && it.quiverModifier === undefined) fail(`${at}: quiver carries 0 cards AND no quiverModifier — it would occupy a hand slot and do nothing`)
    if (CARD_BEARING_KINDS.has(it.kind)) {
      const n = it.gearCardIds?.length ?? 0
      const [lo, hi] = it.twoHanded ? [6, 6] : [3, 4]
      if (n < lo || n > hi) fail(`${at}: ${it.twoHanded ? '2H' : '1H'} ${it.kind} carries ${n} cards (want ${lo === hi ? lo : `${lo}-${hi}`})`)
      for (const id of it.gearCardIds ?? []) {
        referencedCards.add(id)
        const card = c.cards[id]
        if (!card) { fail(`${at}: unknown gear card '${id}'`); continue }
        if (card.weaponType !== it.weaponClass) fail(`${at}: card '${id}' weaponType ${card.weaponType} != item weaponClass ${it.weaponClass}`)
      }
    }
  }

  // -------------------------------------------------------- characters
  const isGear = (id: string) => { const it = c.items[id]; return it !== undefined && GEAR_KINDS.has(it.kind) }
  for (const ch of Object.values(c.characters)) {
    if (ch.kind !== 'unit') continue
    const at = `character ${ch.id}`
    ref(at, 'class', c.classes, ch.classId)
    for (const side of ['left', 'right'] as const) {
      const id = ch.startingGear[side]
      if (id === null) continue
      ref(at, 'item', c.items, id)
      if (has(c.items, id) && !isGear(id)) fail(`${at}: startingGear.${side} '${id}' is not gear`)
    }
    const left = ch.startingGear.left ? c.items[ch.startingGear.left] : undefined
    if (left?.twoHanded && ch.startingGear.right !== null) fail(`${at}: two-handed '${left.id}' locks the right hand`)
    for (const id of ch.bag ?? []) ref(at, 'item', c.items, id)
    for (const id of ch.signatureCardIds) { ref(at, 'signature card', c.cards, id); referencedCards.add(id) }
    if (ch.joinDialogueId !== undefined) ref(at, 'dialogue', c.dialogues, ch.joinDialogueId)
  }

  // ------------------------------------------------------ enemy groups
  for (const g of Object.values(c.enemyGroups)) {
    const at = `enemy group ${g.id}`
    for (const m of g.members) {
      ref(at, 'class', c.classes, m.classId)
      if (!has(c.enemyAI, m.classId)) fail(`${at}: member class '${m.classId}' has no enemy AI profile`)
      // A member id that names a unit character inherits its sheet at seed time — the chassis must agree.
      const ch = m.id !== undefined ? c.characters[m.id] : undefined
      if (ch?.kind === 'unit' && ch.classId !== m.classId) fail(`${at}: member '${m.id}' is class ${m.classId} but character ${ch.id} is ${ch.classId}`)
    }
    if (g.victoryEvent !== undefined) { ref(at, 'check event', c.checkEvents, g.victoryEvent); referencedCheckEvents.add(g.victoryEvent) }
  }
  for (const [classId, p] of Object.entries(c.enemyAI)) {
    if (p.classId !== classId) fail(`enemy AI ${classId}: keyed under a different classId '${p.classId}'`)
    ref(`enemy AI ${classId}`, 'class', c.classes, p.classId)
    // The move budget is stored twice: `combat/ai.ts` walks `profile.movement` while the player's danger overlay
    // (`combat/targeting.ts#dangerUnion` → `reachable`) reads `unit.mov` = the class `startingMov`. Drift makes the
    // overlay lie about where an enemy can reach, silently, so the two copies must agree.
    const cls = c.classes[p.classId]
    if (cls !== undefined && p.movement !== cls.startingMov) {
      fail(`enemy AI ${classId}: movement ${p.movement} != class ${p.classId} startingMov ${cls.startingMov} (the danger overlay reads the class, the AI reads this)`)
    }
  }

  // --------------------------------------------------------- encounters
  for (const t of Object.values(c.encounterTables)) {
    ref(`encounter table ${t.id}`, 'region', c.regions, t.regionId)
    for (const e of t.entries) {
      const at = `encounter ${t.id}/${e.id}`
      const prior = allEncounterEntryIds.get(e.id)
      if (prior !== undefined && prior !== t.id) fail(`${at}: entry id '${e.id}' also used in table ${prior} (must be globally unique)`)
      allEncounterEntryIds.set(e.id, t.id)
      for (const p of e.conditions) predicates.push({ at, value: p })
      const o = e.outcome
      if (o.kind === 'dialogue') ref(at, 'dialogue', c.dialogues, o.dialogueId)
      else if (o.kind === 'checkEvent') { ref(at, 'check event', c.checkEvents, o.checkEventId); referencedCheckEvents.add(o.checkEventId) }
      else {
        ref(at, 'enemy group', c.enemyGroups, o.enemyGroupId)
        captureTargetsOk(at, o.enemyGroupId, o.captureTargets)
      }
    }
  }
  for (const r of Object.values(c.regions)) {
    if (!Object.values(c.encounterTables).some((t) => t.regionId === r.id)) fail(`region ${r.id}: no encounter table`)
  }

  // ------------------------------------------------------- check events
  for (const ev of Object.values(c.checkEvents)) {
    for (const ch of ev.choices) {
      const at = `check event ${ev.id}/${ch.id}`
      if (ch.check?.kind === 'class') ref(at, 'class', c.classes, ch.check.classId)
      for (const e of ch.onPass.effects) effects.push({ at, value: e })
      for (const e of ch.onFail?.effects ?? []) effects.push({ at, value: e })
    }
  }

  // ------------------------------------------------------ battlefields
  // The authored board (0112). `engine/content.ts#battlefieldFaults` owns what makes a board SOUND — in bounds,
  // clear of the deployment slots, one connected floor — and is read here so `lint:content` fails on a board a
  // battle could not be fought on rather than leaving it to a `SeedError` in the middle of a run.
  for (const field of Object.values(c.battlefields)) {
    for (const fault of battlefieldFaults(field, r)) fail(`battlefield ${field.id}: ${fault}`)
  }
  const usedFields = new Set<string>()
  const fieldRefs = (at: string, ids: readonly string[]) => {
    for (const id of ids) { ref(at, 'battlefield', c.battlefields, id); usedFields.add(id) }
  }
  for (const rg of Object.values(c.regions)) fieldRefs(`region ${rg.id}`, rg.battlefieldIds)

  // ----------------------------------------------------------- dungeons
  for (const d of Object.values(c.dungeons)) {
    const at = `dungeon ${d.id}`
    ref(at, 'region', c.regions, d.regionId)
    fieldRefs(at, d.battlefieldIds)
    for (const gid of [d.combatEnemyGroupId, d.eliteEnemyGroupId, d.bossEnemyGroupId]) ref(at, 'enemy group', c.enemyGroups, gid)
    // A dungeon that fields ONE group in all three room types has no escalation: the boss fight is a byte-identical
    // roster to the first corridor (only the loot row differs), which is the §7.8 "declared, never read" shape
    // applied to difficulty. Elite and boss must each bring something the room before did not.
    if (d.combatEnemyGroupId === d.eliteEnemyGroupId) fail(`${at}: combat and elite rooms both field '${d.combatEnemyGroupId}' — the elite room is the corridor again`)
    if (d.eliteEnemyGroupId === d.bossEnemyGroupId) fail(`${at}: elite and boss rooms both field '${d.bossEnemyGroupId}' — the boss fight is the room before it`)
    captureTargetsOk(`${at} boss`, d.bossEnemyGroupId, d.bossCaptureTargets)
    // The deck is dealt WITHOUT replacement across the whole graph (`procgen/dungeonGraph.ts` phase 5), so a deck
    // shorter than the event rooms the generator deals leaves the rest on `EMPTY_ROOM_TEXT` + `eventGoldFallback`.
    // Smuggler's Cave shipped two events for a graph that dealt four, and the FIRST event room of the blind run
    // was one of the empty ones (RE-GATE C 3.8). `rules.dungeon.minRoomEvents` carries the measured floor.
    if (d.roomEvents.length < r.dungeon.minRoomEvents) {
      fail(`${at}: ${d.roomEvents.length} roomEvents against a graph that deals up to ${r.dungeon.minRoomEvents} event rooms — the rest fall through to the empty room`)
    }
    if (new Set(d.roomEvents).size !== d.roomEvents.length) fail(`${at}: the same event is in the deck twice — the deck is dealt without replacement`)
    for (const id of d.roomEvents) { ref(at, 'check event', c.checkEvents, id); referencedCheckEvents.add(id) }
  }

  // -------------------------------------------------------------- towns
  for (const t of Object.values(c.towns)) {
    const at = `town ${t.id}`
    ref(at, 'region', c.regions, t.regionId)
    for (const id of t.shopStockIds) ref(at, 'item', c.items, id)
    for (const q of t.tavernQuests) {
      ref(`${at} tavern`, 'quest', c.quests, q.questId)
      ref(`${at} tavern`, 'dialogue', c.dialogues, q.dialogueId)
      if (q.visibleIf) predicates.push({ at: `${at} tavern ${q.questId}`, value: q.visibleIf })
    }
  }

  // ---------------------------------------------------------- overworld
  const w = c.overworld
  const nodes = new Map(w.nodes.map((n) => [n.id, n]))
  const start = nodes.get(w.startNodeId)
  if (!start) fail(`overworld: startNodeId '${w.startNodeId}' is not a node`)
  else if (start.hidden) fail(`overworld: start node '${start.id}' is hidden`)
  for (const n of w.nodes) {
    const at = `node ${n.id}`
    ref(at, 'region', c.regions, n.regionId)
    if (n.type === 'TOWN' && !has(c.towns, n.id)) fail(`${at}: TOWN node without a town def`)
    if (n.type === 'DUNGEON' && !has(c.dungeons, n.id)) fail(`${at}: DUNGEON node without a dungeon def`)
    if (n.type === 'BOSS' && n.enemyGroupId !== undefined) ref(at, 'enemy group', c.enemyGroups, n.enemyGroupId)
    if (n.discoveryEventId !== undefined) { ref(at, 'check event', c.checkEvents, n.discoveryEventId); referencedCheckEvents.add(n.discoveryEventId) }
    if (n.battlefieldId !== undefined) fieldRefs(at, [n.battlefieldId])
  }
  // A board nothing names is a board nobody ever fights on — the §7.8 "declared, never read" shape, in content.
  for (const field of Object.values(c.battlefields)) if (!usedFields.has(field.id)) fail(`battlefield ${field.id}: no region, dungeon or node fights on it`)
  for (const t of Object.values(c.towns)) if (nodes.get(t.id)?.type !== 'TOWN') fail(`town ${t.id}: no TOWN node with that id`)
  for (const d of Object.values(c.dungeons)) if (nodes.get(d.id)?.type !== 'DUNGEON') fail(`dungeon ${d.id}: no DUNGEON node with that id`)
  const adjacency = new Map<string, string[]>()
  for (const e of w.edges) {
    const at = `edge ${e.from}-${e.to}`
    const from = nodes.get(e.from)
    const to = nodes.get(e.to)
    if (!from) fail(`${at}: unknown node '${e.from}'`)
    if (!to) fail(`${at}: unknown node '${e.to}'`)
    const table = c.encounterTables[e.encounterTableId]
    if (!table) fail(`${at}: unknown encounter table '${e.encounterTableId}'`)
    else if (from && to && table.regionId !== from.regionId && table.regionId !== to.regionId) fail(`${at}: table ${table.id} (${table.regionId}) matches neither endpoint region`)
    adjacency.set(e.from, [...(adjacency.get(e.from) ?? []), e.to])
    adjacency.set(e.to, [...(adjacency.get(e.to) ?? []), e.from])
  }
  if (start) {
    const seen = new Set<string>([start.id])
    const queue = [start.id]
    while (queue.length) {
      const cur = queue.shift()!
      for (const next of adjacency.get(cur) ?? []) {
        if (seen.has(next) || nodes.get(next)?.hidden) continue
        seen.add(next)
        queue.push(next)
      }
    }
    for (const n of w.nodes) if (!n.hidden && !seen.has(n.id)) fail(`node ${n.id}: unreachable from ${start.id} over visible nodes`)
  }
  const nodeRefOk = (at: string, r: MapNodeRef) => {
    if (r.mapKind === 'overworld') {
      if (r.mapId !== w.id) fail(`${at}: overworld ref mapId '${r.mapId}' != sheet id '${w.id}'`)
      if (!nodes.has(r.nodeId)) fail(`${at}: unknown overworld node '${r.nodeId}'`)
    } else ref(at, 'dungeon', c.dungeons, r.mapId)
  }

  // ------------------------------------------------------------- quests
  for (const q of Object.values(c.quests)) {
    if (QUEST_COMPLETE_STAGE in q.stages) fail(`quest ${q.id}: declares the engine-owned '${QUEST_COMPLETE_STAGE}' stage`)
    for (const s of Object.values(q.stages)) {
      const at = `quest ${q.id}/${s.id}`
      // FINAL GATE C 3.4: the stage line used to be `id.replace(/_/g, ' ')`, so Contracts read "Find daren" —
      // a character's name lower-cased on the page whose whole job is naming things. The label is authored now,
      // and a label that is merely the id spelled out is the derivation smuggled back in as data.
      if (s.label.includes('_')) fail(`${at}: label "${s.label}" carries an id`)
      if (s.label.trim().toLowerCase() === s.id.replace(/_/g, ' ')) fail(`${at}: label "${s.label}" is the stage id in words — write what the company is trying to do`)
      if (/[.!]$/.test(s.label.trim())) fail(`${at}: label "${s.label}" ends in a stop (§5.1: a stage line is a headline, not a sentence)`)
      if (!/^[A-Z]/.test(s.label)) fail(`${at}: label "${s.label}" does not start with a capital (§5.1 sentence case)`)
      for (const e of s.onEnter) effects.push({ at, value: e })
      for (const e of s.onExit) effects.push({ at, value: e })
      for (const t of s.transitions) {
        predicates.push({ at, value: t.when })
        if (!(t.to in q.stages)) fail(`${at}: transition to unknown stage '${t.to}'`)
      }
    }
  }

  // ---------------------------------------------------------- dialogues
  for (const d of Object.values(c.dialogues)) {
    if (DIALOGUE_END in d.nodes) fail(`dialogue ${d.id}: '${DIALOGUE_END}' is the terminal sentinel, not a node id`)
    const reachable = new Set<string>([d.startNodeId])
    const queue = [d.startNodeId]
    while (queue.length) {
      const node = d.nodes[queue.shift()!]
      if (!node) continue
      for (const ch of node.choices) {
        for (const target of [ch.next, ch.onPass, ch.onFail]) {
          if (target !== undefined && target !== DIALOGUE_END && !reachable.has(target)) { reachable.add(target); queue.push(target) }
        }
      }
    }
    for (const n of Object.values(d.nodes)) {
      const at = `dialogue ${d.id}/${n.id}`
      if (!reachable.has(n.id)) fail(`${at}: unreachable from '${d.startNodeId}'`)
      if (n.speaker !== undefined) ref(at, 'character (speaker)', c.characters, n.speaker)
      // Every node with choices keeps ONE unconditional way out: if all of them are gated, predicate state can hide
      // or disable the lot and the overlay has nothing to click (CONTRACT-CHANGES 0031 — the engine now closes such
      // a node rather than wedging, but authoring one is still a bug).
      if (n.choices.length > 0 && n.choices.every((ch) => ch.visibleIf !== undefined || ch.enabledIf !== undefined)) {
        fail(`${at}: every choice is gated (visibleIf/enabledIf) — the node needs one unconditional way out`)
      }
      // THE ANSWER NEVER ARRIVES BEFORE THE QUESTION. `promptName` suspends the run with a text field on top of
      // everything (`overlay priority namePrompt > … > dialogue`, types.ts), so raised in `onEnter` it opens over
      // the very line that asks — the player types a name into an empty prompt and reads the question afterwards
      // (RE-GATE C 3.6, hit in both blind runs). A naming beat rides the CHOICE that answers it.
      for (const e of n.onEnter ?? []) {
        if (e.kind === 'promptName') fail(`${at}: promptName in onEnter opens the prompt over the line that asks for the name — put it on the choice that answers`)
      }
      for (const e of n.onEnter ?? []) effects.push({ at, value: e })
      for (const ch of n.choices) {
        const cat = `${at}/${ch.id}`
        if (ch.visibleIf) predicates.push({ at: cat, value: ch.visibleIf })
        if (ch.enabledIf) predicates.push({ at: cat, value: ch.enabledIf })
        if (ch.check?.kind === 'class') ref(cat, 'class', c.classes, ch.check.classId)
        for (const e of ch.effects) effects.push({ at: cat, value: e })
      }
    }
  }

  // ------------------------------------------------------------ effects
  const partyCharacter = (id: string): UnitCharacter | undefined => {
    const ch = c.characters[id]
    return ch?.kind === 'unit' ? ch : undefined
  }
  for (const { at, value: e } of effects) {
    switch (e.kind) {
      case 'setFlag': flagWriters.add(e.key); break
      case 'recruitCharacter': {
        ref(at, 'character', c.characters, e.characterId)
        const ch = partyCharacter(e.characterId)
        if (has(c.characters, e.characterId) && !ch) fail(`${at}: recruitCharacter '${e.characterId}' is not a unit character`)
        if (ch && (ch.team !== 'party' || !ch.recruitable)) fail(`${at}: character '${e.characterId}' is not recruitable`)
        break
      }
      case 'startQuest': case 'completeQuest': ref(at, 'quest', c.quests, e.questId); break
      case 'advanceQuestStage': {
        ref(at, 'quest', c.quests, e.questId)
        const q = c.quests[e.questId]
        if (q && !(e.toStage in q.stages)) fail(`${at}: advanceQuestStage to undeclared stage '${e.toStage}' of ${e.questId}`)
        break
      }
      case 'addItem': ref(at, 'item', c.items, e.itemId); break
      case 'spawnNode': nodeRefOk(at, e.ref); break
      case 'unlockNode': nodeRefOk(at, e.ref); unlockRefs.push({ at, value: e.ref }); break
      case 'startDialogue': ref(at, 'dialogue', c.dialogues, e.dialogueId); break
      case 'startCombat': ref(at, 'enemy group', c.enemyGroups, e.enemyGroupId); captureTargetsOk(at, e.enemyGroupId, e.captureTargets); break
      case 'promptName': case 'addGold': case 'addFood': case 'damageParty': case 'healParty': break
    }
  }

  // ------------------------------------------------- effect kinds unused
  // A quest effect the engine implements and nothing ever fires is dead plumbing — the exact §7.8 pattern this
  // rebuild designs out. `EFFECT_KIND_NO_CONTENT_EMITTER` is the only escape, and it expires the moment an emitter appears.
  const emittedKinds = new Set<string>(effects.map((e) => e.value.kind))
  for (const kind of QUEST_EFFECT_KINDS) {
    if (emittedKinds.has(kind) || kind in EFFECT_KIND_NO_CONTENT_EMITTER) continue
    fail(`quest effect '${kind}': the engine implements it but no content emits it (brief §7.8)`)
  }
  for (const [kind, why] of Object.entries(EFFECT_KIND_NO_CONTENT_EMITTER)) {
    if (emittedKinds.has(kind)) fail(`quest effect '${kind}': content emits it now — delete its exemption (${why})`)
  }

  // --------------------------------------------------------- predicates
  for (const { at, value } of predicates) {
    for (const p of walkPredicate(value)) {
      switch (p.kind) {
        case 'flag': case 'notFlag':
          if (!flagWriters.has(p.key)) fail(`${at}: reads flag '${p.key}' which nothing writes`)
          break
        case 'questStarted': case 'questComplete': ref(at, 'quest', c.quests, p.questId); break
        case 'questStage': {
          ref(at, 'quest', c.quests, p.questId)
          const q = c.quests[p.questId]
          if (q && !(p.stage in q.stages)) fail(`${at}: questStage '${p.stage}' is not a stage of ${p.questId}`)
          break
        }
        case 'partyHas': ref(at, 'class', c.classes, p.classId); break
        case 'hasItem': ref(at, 'item', c.items, p.itemId); break
        case 'visited': nodeRefOk(at, p.ref); break
        case 'cleared': if (!allEncounterEntryIds.has(p.encounterId)) fail(`${at}: unknown encounter entry '${p.encounterId}'`); break
        case 'always': case 'never': case 'goldAtLeast': case 'allOf': case 'anyOf': case 'not': break
      }
    }
  }

  // ------------------------------------------------------ locked nodes
  // `unlockNode` has exactly one reader (`run/dungeon.ts#canEnterDungeon` on a `locked` node): every writer must
  // target a locked node and every locked node must have a writer, or one side is dead data (brief §7.8).
  const lockedIds = new Set(w.nodes.filter((n) => n.locked).map((n) => n.id))
  const unlockWriters = new Set<string>()
  for (const { at, value } of unlockRefs) {
    if (value.mapKind !== 'overworld') { fail(`${at}: unlockNode targets a dungeon ref; only overworld nodes can be locked`); continue }
    if (!lockedIds.has(value.nodeId)) fail(`${at}: unlockNode targets '${value.nodeId}' which is not a locked node`)
    unlockWriters.add(value.nodeId)
  }
  for (const id of lockedIds) if (!unlockWriters.has(id)) fail(`node ${id}: locked but no unlockNode effect ever opens it`)

  // ------------------------------------------------------------ orphans
  for (const id of Object.keys(c.cards)) if (!referencedCards.has(id)) fail(`card ${id}: orphan (no class innate, gear item or signature references it)`)
  for (const id of Object.keys(c.checkEvents)) if (!referencedCheckEvents.has(id)) fail(`check event ${id}: orphan (no encounter, dungeon, victoryEvent or discovery node references it)`)

  // ----------------------------------------------- a named enemy has ONE home
  // A `CaptureTarget.unitId` names a specific person. Two UNCONDITIONED sources mean he dies at one and walks out
  // of the other, and his quest flags fire twice (the shipped Daren was fightable at his camp, in the Smuggler's
  // Cave and on the road). A second source is fine when it is CONDITIONED — a gated encounter entry falls out of
  // the table the moment his fate flags land — so only the unconditioned homes are counted.
  const captureHomes = new Map<string, Set<string>>()
  const claimHome = (at: string, targets: readonly CaptureTarget[] | undefined) => {
    for (const ct of targets ?? []) captureHomes.set(ct.unitId, (captureHomes.get(ct.unitId) ?? new Set()).add(at))
  }
  for (const t of Object.values(c.encounterTables)) {
    for (const e of t.entries) if (e.outcome.kind === 'battle' && e.conditions.length === 0) claimHome(`encounter ${t.id}/${e.id}`, e.outcome.captureTargets)
  }
  for (const d of Object.values(c.dungeons)) claimHome(`dungeon ${d.id} boss`, d.bossCaptureTargets)
  for (const ev of Object.values(c.checkEvents)) {
    for (const ch of ev.choices) {
      for (const e of [...ch.onPass.effects, ...(ch.onFail?.effects ?? [])]) if (e.kind === 'startCombat') claimHome(`check event ${ev.id}`, e.captureTargets)
    }
  }
  for (const d of Object.values(c.dialogues)) {
    for (const n of Object.values(d.nodes)) {
      for (const e of [...(n.onEnter ?? []), ...n.choices.flatMap((ch) => ch.effects)]) if (e.kind === 'startCombat') claimHome(`dialogue ${d.id}`, e.captureTargets)
    }
  }
  for (const [unitId, homes] of captureHomes) {
    if (homes.size > 1) fail(`capture target '${unitId}' is fielded by ${homes.size} unconditioned battle sources (${[...homes].join(', ')}) — a named enemy needs exactly one home`)
  }

  // -------------------------------------- a flag gate needs a durable writer
  // A quest stage that only advances on a flag is stranded forever if every writer of that flag lives behind a
  // one-shot encounter the player can decline. Walk the openers: a scene is DURABLE when something that can happen
  // more than once opens it (a repeatable encounter entry, a tavern row, a dungeon room, a victory event, a quest
  // stage); one-shot encounter entries and one-time DISCOVERY events are not.
  type SceneKey = string
  const scene = (kind: 'dialogue' | 'check', id: string): SceneKey => `${kind}:${id}`
  const durable = new Map<SceneKey, boolean>()
  const openScene = (key: SceneKey, isDurable: boolean) => durable.set(key, (durable.get(key) ?? false) || isDurable)
  for (const t of Object.values(c.encounterTables)) {
    for (const e of t.entries) {
      if (e.outcome.kind === 'dialogue') openScene(scene('dialogue', e.outcome.dialogueId), !e.oneShot)
      else if (e.outcome.kind === 'checkEvent') openScene(scene('check', e.outcome.checkEventId), !e.oneShot)
      else for (const ct of e.outcome.captureTargets ?? []) {
        openScene(scene('dialogue', ct.capturedDialogueId), !e.oneShot)
        openScene(scene('dialogue', ct.killedDialogueId), !e.oneShot)
      }
    }
  }
  for (const t of Object.values(c.towns)) for (const q of t.tavernQuests) openScene(scene('dialogue', q.dialogueId), true)
  for (const d of Object.values(c.dungeons)) {
    for (const id of d.roomEvents) openScene(scene('check', id), true)
    for (const ct of d.bossCaptureTargets ?? []) {
      openScene(scene('dialogue', ct.capturedDialogueId), true)
      openScene(scene('dialogue', ct.killedDialogueId), true)
    }
  }
  for (const g of Object.values(c.enemyGroups)) if (g.victoryEvent !== undefined) openScene(scene('check', g.victoryEvent), true)
  for (const n of w.nodes) if (n.discoveryEventId !== undefined) openScene(scene('check', n.discoveryEventId), false)
  // `startCombat` inside a scene inherits that scene's reach, and so does `startDialogue`; a quest stage's own
  // effects always fire. Two passes settle the propagation (the shipped trees are one link deep).
  const sceneEffects: { readonly from: SceneKey | null; readonly effect: QuestEffect }[] = []
  const collect = (from: SceneKey | null, list: readonly QuestEffect[]) => { for (const e of list) sceneEffects.push({ from, effect: e }) }
  for (const ev of Object.values(c.checkEvents)) {
    for (const ch of ev.choices) {
      collect(scene('check', ev.id), ch.onPass.effects)
      collect(scene('check', ev.id), ch.onFail?.effects ?? [])
    }
  }
  for (const d of Object.values(c.dialogues)) {
    for (const n of Object.values(d.nodes)) {
      collect(scene('dialogue', d.id), n.onEnter ?? [])
      for (const ch of n.choices) collect(scene('dialogue', d.id), ch.effects)
    }
  }
  for (const q of Object.values(c.quests)) for (const s of Object.values(q.stages)) { collect(null, s.onEnter); collect(null, s.onExit) }
  for (let pass = 0; pass < 2; pass++) {
    for (const { from, effect } of sceneEffects) {
      const reach = from === null ? true : durable.get(from) ?? false
      if (effect.kind === 'startDialogue') openScene(scene('dialogue', effect.dialogueId), reach)
      if (effect.kind === 'startCombat') for (const ct of effect.captureTargets ?? []) {
        openScene(scene('dialogue', ct.capturedDialogueId), reach)
        openScene(scene('dialogue', ct.killedDialogueId), reach)
      }
    }
  }
  const durableFlagWriters = new Set<string>()
  for (const { from, effect } of sceneEffects) {
    if (effect.kind !== 'setFlag') continue
    if (from === null || durable.get(from) === true) durableFlagWriters.add(effect.key)
  }
  for (const t of Object.values(c.encounterTables)) {
    for (const e of t.entries) {
      if (e.outcome.kind !== 'battle' || e.oneShot) continue
      for (const ct of e.outcome.captureTargets ?? []) { durableFlagWriters.add(ct.capturedFlag); durableFlagWriters.add(ct.killedFlag) }
    }
  }
  for (const d of Object.values(c.dungeons)) for (const ct of d.bossCaptureTargets ?? []) { durableFlagWriters.add(ct.capturedFlag); durableFlagWriters.add(ct.killedFlag) }
  for (const { from, effect } of sceneEffects) {
    if (effect.kind !== 'startCombat') continue
    if (from !== null && durable.get(from) !== true) continue
    for (const ct of effect.captureTargets ?? []) { durableFlagWriters.add(ct.capturedFlag); durableFlagWriters.add(ct.killedFlag) }
  }
  for (const q of Object.values(c.quests)) {
    for (const s of Object.values(q.stages)) {
      for (const t of s.transitions) {
        for (const p of walkPredicate(t.when)) {
          if (p.kind !== 'flag' && p.kind !== 'notFlag') continue
          if (p.kind === 'notFlag' || durableFlagWriters.has(p.key)) continue
          fail(`quest ${q.id}/${s.id}: transition to '${t.to}' waits on flag '${p.key}', whose every writer sits behind a one-shot the player can decline — the stage can strand`)
        }
      }
    }
  }

  // --------------------------------- checks the party can never satisfy
  // A stat threshold no obtainable unit reaches, or a class nobody can recruit, is a choice authored to fail: its
  // pass narration and its reward are dead content. `run/party.ts#buildUnitFromCharacter` is the mirror below —
  // `statOverrides` REPLACE the class base (no level lift), otherwise the base lifts by `party.levelLift`.
  const partyPool = Object.values(c.characters).filter((ch): ch is UnitCharacter => ch.kind === 'unit' && ch.team === 'party' && (ch.starter || ch.recruitable))
  const statOf = (ch: UnitCharacter, key: StatKey): number => {
    const cls = c.classes[ch.classId]
    if (cls === undefined) return 0
    const base = cls.baseStats[key]
    if (ch.statOverrides !== undefined) return ch.statOverrides[key] ?? base
    return base > 0 ? base + r.party.levelLift.statPerLevel * Math.max(0, ch.level - 1) : base
  }
  const checkSites: Site<CheckRequirement>[] = []
  for (const ev of Object.values(c.checkEvents)) for (const ch of ev.choices) if (ch.check) checkSites.push({ at: `check event ${ev.id}/${ch.id}`, value: ch.check })
  for (const d of Object.values(c.dialogues)) {
    for (const n of Object.values(d.nodes)) for (const ch of n.choices) if (ch.check) checkSites.push({ at: `dialogue ${d.id}/${n.id}/${ch.id}`, value: ch.check })
  }
  for (const { at, value } of checkSites) {
    if (value.kind === 'stat') {
      const best = partyPool.reduce<{ id: string; v: number } | null>((acc, ch) => {
        const v = statOf(ch, value.stat)
        return acc === null || v > acc.v ? { id: ch.id, v } : acc
      }, null)
      if (best === null || best.v < value.threshold) {
        fail(`${at}: ${value.stat.toUpperCase()} ${value.threshold} is unreachable — the best obtainable unit is ${best?.id ?? 'nobody'} at ${best?.v ?? 0}`)
      }
    } else if (value.kind === 'class' && !partyPool.some((ch) => ch.classId === value.classId)) {
      fail(`${at}: needs class '${value.classId}', which no starter or recruitable character has`)
    }
  }

  // ------------------- a decision the GUARANTEED party cannot answer, in ANY region
  // The reach lint above asks whether ANY obtainable unit could ever pass, and Kael (STR 7 / SKL 9 / SPD 8 / LCK 6)
  // answers for almost everything — but he joins deep inside Blood Ties, which runs the OTHER way from the throne,
  // and there is no XP, no level-up and no stat-granting item anywhere in the engine (grep `levelUp|xp|experience`
  // under `src/engine/**`, and `stats` in items.json). So a company that walks the road it is pointed down keeps
  // the sheet `starter: true` ships, all the way to the throne: STR 6, MAG 7, SKL 5, SPD 5, DEF 9, RES 7, LCK 4.
  // Against that, twelve of the shipped stat checks plus one class check sat above the sheet and every one of the
  // four decisions below offered NOTHING else — a card of dead rows and one no-op, read live at a tier-2 ravine and
  // a tier-3 shrine (RE-GATE C 3.5). This rule is the region-blind version of the tier-1 one it replaces: a
  // threshold ABOVE the sheet is fine — that is what recruiting Kael is FOR — but the decision it sits in must also
  // carry a door the guaranteed company can open. Sources are walked (encounter table, dungeon room deck, node
  // `discoveryEventId`, a group's `victoryEvent`, a tavern's dialogue); a decision no source reaches is skipped.
  const starters = partyPool.filter((ch) => ch.starter)
  const bestStarter = (key: StatKey): number => starters.reduce((n, ch) => Math.max(n, statOf(ch, key)), 0)
  /** A purse or a larder check is answerable by PLAY — the company can save thirty gold or carry a ration — so it
   *  counts as a live door. Only a stat or a class is fixed by the sheet, and only that can be dead on arrival. */
  const starterCanMeet = (check: CheckRequirement): boolean => {
    if (check.kind === 'stat') return bestStarter(check.stat) >= check.threshold
    if (check.kind === 'class') return starters.some((ch) => ch.classId === check.classId)
    return true
  }
  const tierOfRegion = (regionId: string): number => c.regions[regionId]?.tier ?? 3
  const earliest = new Map<string, number>()
  const reach = (kind: 'check' | 'dialogue', id: string, tier: number) => {
    const key = `${kind}:${id}`
    earliest.set(key, Math.min(earliest.get(key) ?? tier, tier))
  }
  const groupTier = new Map<string, number>()
  for (const t of Object.values(c.encounterTables)) {
    const tier = tierOfRegion(t.regionId)
    for (const e of t.entries) {
      if (e.outcome.kind === 'checkEvent') reach('check', e.outcome.checkEventId, tier)
      else if (e.outcome.kind === 'dialogue') reach('dialogue', e.outcome.dialogueId, tier)
      else groupTier.set(e.outcome.enemyGroupId, Math.min(groupTier.get(e.outcome.enemyGroupId) ?? tier, tier))
    }
  }
  for (const d of Object.values(c.dungeons)) {
    const tier = tierOfRegion(d.regionId)
    for (const id of d.roomEvents) reach('check', id, tier)
    for (const gid of [d.combatEnemyGroupId, d.eliteEnemyGroupId, d.bossEnemyGroupId]) groupTier.set(gid, Math.min(groupTier.get(gid) ?? tier, tier))
  }
  for (const n of c.overworld.nodes) if (n.discoveryEventId !== undefined) reach('check', n.discoveryEventId, n.areaTier)
  for (const g of Object.values(c.enemyGroups)) if (g.victoryEvent !== undefined) reach('check', g.victoryEvent, groupTier.get(g.id) ?? 3)
  for (const t of Object.values(c.towns)) for (const q of t.tavernQuests) reach('dialogue', q.dialogueId, tierOfRegion(t.regionId))

  /** One decision point: a check event's choice list, or one dialogue node's. Fails when every check it offers is
   *  above the guaranteed company's sheet, so the card reads as a list of struck rows over a single no-op. */
  const liveDoor = (at: string, key: string, choices: readonly { readonly check?: CheckRequirement | undefined }[]) => {
    if (!earliest.has(key)) return
    const checks = choices.flatMap((ch) => (ch.check === undefined ? [] : [ch.check]))
    if (checks.length > 0 && !checks.some(starterCanMeet)) {
      fail(`${at}: a decision the company the game guarantees cannot answer — every option is above the sheet ${starters.map((ch) => ch.id).join('/')} ship with, and nothing in the engine raises it, so the only live choice is the no-op`)
    }
  }
  for (const ev of Object.values(c.checkEvents)) liveDoor(`check event ${ev.id}`, `check:${ev.id}`, ev.choices)
  for (const d of Object.values(c.dialogues)) {
    for (const [nodeId, n] of Object.entries(d.nodes)) liveDoor(`dialogue ${d.id}/${nodeId}`, `dialogue:${d.id}`, n.choices)
  }

  // ------------------------------ a check whose outcomes decide nothing
  // `onPass`/`onFail` are the whole point of rolling: both empty means the check is theatre, and a pass that only
  // COSTS while the fail is free inverts the reward (the shipped `bandit_parley` charged 30 gold to pass and let
  // the failure walk). A choice with no `check` is a plain exit and is exempt.
  const isCost = (e: QuestEffect) =>
    (e.kind === 'addGold' && e.amount < 0) || (e.kind === 'addFood' && e.amount < 0) || e.kind === 'damageParty'
  for (const ev of Object.values(c.checkEvents)) {
    for (const ch of ev.choices) {
      if (ch.check === undefined) continue
      const at = `check event ${ev.id}/${ch.id}`
      const pass = ch.onPass.effects
      const onFail = ch.onFail?.effects ?? []
      if (pass.length === 0 && onFail.length === 0) fail(`${at}: neither outcome carries an effect — the check decides nothing`)
      else if (pass.length > 0 && pass.every(isCost) && onFail.length === 0) fail(`${at}: passing only costs the party while failing is free — the reward is inverted`)
    }
  }

  // ------------------------- spending a resource you may not have
  // A dialogue choice that pays out of the purse or the bag has to be gated on having it, or the player buys
  // goodwill with rations they never owned (`addFood(-2)` on an empty bag takes 0 charges and still pays out).
  for (const d of Object.values(c.dialogues)) {
    for (const n of Object.values(d.nodes)) {
      for (const ch of n.choices) {
        if (!ch.effects.some((e) => (e.kind === 'addGold' || e.kind === 'addFood') && e.amount < 0)) continue
        if (ch.check !== undefined || ch.visibleIf !== undefined || ch.enabledIf !== undefined) continue
        fail(`dialogue ${d.id}/${n.id}/${ch.id}: spends gold or food with no check / visibleIf — the player can pay with nothing`)
      }
    }
  }

  // ------------------- every hand the game deals is a hand its holder is trained to
  // `classes.json#weaponClasses` + `run/equipment.ts#canHold` (0121). Three ways the rule can be authored wrong,
  // and all three are silent at runtime: a character shipped holding gear its own chassis refuses (the unit boots
  // with a hand the player cannot put back); a weaponClass with items in the shelf that NOBODY the player can
  // field is trained to (every one of those drops is dead loot in a bag with 32 cells); and a party chassis
  // trained to no card-bearing arm at all (it would draw its innates and nothing else, forever).
  const env = { content: c, rules: r }
  for (const ch of Object.values(c.characters)) {
    if (ch.kind !== 'unit') continue
    for (const slot of ['left', 'right'] as const) {
      const id = ch.startingGear[slot]
      if (id === null) continue
      const item = c.items[id]
      if (item === undefined) continue // the dangling-id rule above owns this
      const held = canHold(ch.classId, item, env)
      if (!held.ok) fail(`character ${ch.id}: starts with ${item.name} in the ${slot} hand, and ${held.reason}`)
    }
  }
  const trainedSomewhere = new Set<string>()
  for (const ch of partyPool) for (const w of c.classes[ch.classId]?.weaponClasses ?? []) trainedSomewhere.add(w)
  const shelved = new Set<string>()
  for (const item of Object.values(c.items)) {
    if (!HAND_SLOT_KINDS.has(item.kind)) continue
    if (item.kind === 'quiver') shelved.add(r.gear.quiverPairsWith)
    else if (item.weaponClass !== undefined) shelved.add(item.weaponClass)
  }
  for (const w of [...shelved].sort()) {
    if (!trainedSomewhere.has(w)) fail(`weaponClass '${w}': items ship in it and no class the player can field is trained to it — every one of those drops is dead loot`)
  }
  for (const ch of partyPool) {
    const cls = c.classes[ch.classId]
    if (cls === undefined) continue
    const arms = cls.weaponClasses.filter((w) => Object.values(c.items).some((i) => CARD_BEARING_KINDS.has(i.kind) && i.weaponClass === w))
    if (arms.length === 0) fail(`class ${cls.id}: ${ch.id} can field it and it is trained to no card-bearing arm in the shelf — that unit would draw its innates and nothing else`)
  }

  // -------------------------- every party class outdraws its own hand
  // A deck the size of the hand is drawn WHOLE every turn: no draw variance, a reshuffle every turn, a discard
  // pile that means nothing. Class innates + hand gear + signature cards must beat `rules.combat.handSize`.
  for (const ch of partyPool) {
    const cls = c.classes[ch.classId]
    if (cls === undefined) continue
    const gear = ([ch.startingGear.left, ch.startingGear.right] as const)
      .reduce((n, id) => n + (id === null ? 0 : c.items[id]?.gearCardIds?.length ?? 0), 0)
    const deck = cls.innateCardIds.length + ch.signatureCardIds.length + gear
    if (deck <= r.combat.handSize) {
      fail(`character ${ch.id}: deck is ${deck} cards against a hand of ${r.combat.handSize} — it draws whole every turn (add class innates or signatureCardIds)`)
    }
  }

  // -------------------- content teaches the mechanic by the UI's own name
  // ARCHITECTURE §5.1, "One name per thing, everywhere" — applied to the prose, which is where a mechanic is
  // TAUGHT. Kael's briefing is the game's only tutorialisation of capture and it called the verb "Subdue" twice,
  // a word that appears on no button, in no menu and in no CLI verb (RE-GATE C 3.7). The table is small on
  // purpose: each row is either a near-synonym for something the UI names differently, or a system this build
  // does not have at all, so a line promising it is a lie the player cannot act on.
  for (const { at, value: prose } of playerProse(c)) {
    for (const rule of MECHANIC_VOCABULARY) {
      const hit = rule.alias.exec(prose)
      if (hit !== null) fail(`${at}: says "${hit[0]}" — ${rule.say}`)
    }
  }

  // ---------------------------- every weighted loot cell can actually drop
  // `run/loot.ts#rollLoot` picks a rarity by weight, then walks `rules.loot.fallDown` when that rarity's pool is
  // empty. `common` falls to null, so a weighted `common` with no region-legal common item silently drops NOTHING.
  const regionTiers = new Map<string, Set<number>>()
  const addTier = (regionId: string, tier: number) => regionTiers.set(regionId, (regionTiers.get(regionId) ?? new Set()).add(tier))
  for (const n of w.nodes) addTier(n.regionId, n.areaTier)
  for (const d of Object.values(c.dungeons)) { const rg = c.regions[d.regionId]; if (rg) addTier(d.regionId, rg.tier) }
  const poolCount = (regionId: string, rarity: Rarity) =>
    Object.values(c.items).filter((it) => HAND_SLOT_KINDS.has(it.kind) && it.rarity === rarity && (it.region === regionId || it.region === 'none')).length
  for (const tag of r.loot.regionFilteredTags) {
    for (const [regionId, tiers] of regionTiers) {
      for (const tier of tiers) {
        const row = r.loot.rows[tag]?.[tier as 1 | 2 | 3]
        if (row === undefined || row.chance === 0) continue
        for (const [rarity, weight] of Object.entries(row.weights) as [Rarity, number][]) {
          if (weight <= 0) continue
          let cursor: Rarity | null = rarity
          while (cursor !== null && poolCount(regionId, cursor) === 0) cursor = r.loot.fallDown[cursor]
          if (cursor === null) fail(`loot row ${tag} tier ${tier} in ${regionId}: weights ${rarity} at ${weight} but no ${rarity} (or fall-down) hand-slot item exists there — that share of the roll drops nothing`)
        }
      }
    }
  }

  return problems
}

/**
 * Non-failing findings (`npm run lint:content` prints them): DISCOVERY nodes still waiting for their one-time
 * event (the discovery deck is owed by WP-CONTENT — until then the node is an ordinary decision-node pause),
 * every card that approximates a spec mechanic (`todoMechanic`, DECISIONS "no silent approximations"), and stat
 * thresholds outside `rules.checks.thresholdGuidance` — the guidance's only reader. (A thin event deck is no
 * longer one of them: it is a FAIL against `rules.dungeon.minRoomEvents`.) These are authoring smells, not broken data, so they never fail the gate.
 */
export function lintContentWarnings(c: ContentRegistry = defaultContent, r: Rules = defaultRules): string[] {
  const warnings: string[] = []
  for (const n of c.overworld.nodes) {
    if (n.type === 'DISCOVERY' && n.discoveryEventId === undefined) warnings.push(`node ${n.id}: DISCOVERY node without a discoveryEventId (inert pause until authored)`)
  }
  for (const card of Object.values(c.cards)) {
    if (card.todoMechanic !== undefined) warnings.push(`card ${card.id}: TODO(mechanic) ${card.todoMechanic}`)
  }
  const [lo, hi] = r.checks.thresholdGuidance
  const warnThreshold = (at: string, check: { readonly kind: string; readonly stat?: string; readonly threshold?: number }) => {
    if (check.kind !== 'stat' || check.threshold === undefined) return
    if (check.threshold < lo || check.threshold > hi) warnings.push(`${at}: ${check.stat?.toUpperCase()} ${check.threshold} is outside the authoring band ${lo}-${hi}`)
  }
  for (const ev of Object.values(c.checkEvents)) for (const ch of ev.choices) if (ch.check) warnThreshold(`check event ${ev.id}/${ch.id}`, ch.check)
  for (const d of Object.values(c.dialogues)) {
    for (const n of Object.values(d.nodes)) for (const ch of n.choices) if (ch.check) warnThreshold(`dialogue ${d.id}/${n.id}/${ch.id}`, ch.check)
  }
  return warnings
}
