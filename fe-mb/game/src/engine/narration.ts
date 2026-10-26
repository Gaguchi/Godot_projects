/**
 * engine/narration.ts — the game's account of what it just did, in words.
 *
 * An `Effect` is the reducer's DESCRIPTION of a change (ARCHITECTURE §2). The browser animates it; the headless
 * game (CONTRACT §10, ARCHITECTURE §6) has nothing to animate, so its only account of a battle or a journey is
 * whatever this table says. Before this module `scripts/cli.ts#describe` carried seven hand-written cases against
 * fifty-nine kinds and printed the rest as `${kind} ${JSON.stringify(rest)}` — forty-two distinct raw-JSON lines,
 * forty-three camelCase kind names, seventy snake_case ids and three room grid codes over fifteen sessions
 * (FINAL GATE A 1.5), on a surface CONTRACT §10 calls a first-class way to play.
 *
 * Pure, and NAMELESS: every id is resolved through the injected `NameBook`, so this file imports types only and
 * sits outside every import fence (CONTRACT §6). A resolver the caller does not supply means that line is not
 * narrated at all — an id is never the fallback (ARCHITECTURE §5.1, "no id ever reaches the player").
 *
 * A line is PARTS, not a sentence, because every changing number in the browser wears `.numeral` and a number
 * baked into a string cannot (§5.1); the terminal joins them. Voice: a narrated line is body prose — sentence
 * case, no terminal stop. It is a fragment of a running account, not a sentence of its own.
 *
 * The switch is EXHAUSTIVE by construction: a new `Effect` kind fails to compile until somebody decides whether
 * it owes the player a sentence or an explicit silence. That is the whole defect 1.5 named — the `default:` arm
 * meant forty-six kinds were decided by accident.
 */
import type { Effect, EffectKind } from './effects'
import type { RoomType, ScreenKind, StatusId } from './types'

/**
 * What each screen is CALLED. `ScreenKind` is a routing field — `battleEnd`, `gameOver` — and the headless frame
 * printed it as its own title, so a player read `== battleEnd ==` where the browser's page is headed Field Report
 * and `== gameOver ==` where it reads Final Entry (FINAL GATE A 1.4). A screen is a Named thing: Title Case, no
 * terminal stop (§5.1), and one name per thing across both surfaces — `ui/screens/FieldReport.tsx` and the lost
 * half of `ui/screens/Ledger.tsx` render their headings from this table.
 *
 * The four the browser does not head with a name of its own take the word it uses for that place in its own copy:
 * the map is the road, the battlefield is the field ("the field is still"), the descent is the descent, and the
 * won ledger is its last page ("the company ledger · last page").
 */
export const SCREEN_NAME: Readonly<Record<ScreenKind, string>> = {
  title: 'Embermarch',
  prologue: 'Prologue',
  overworld: 'The Road',
  town: 'Town',
  camp: 'Camp',
  dungeon: 'The Descent',
  combat: 'The Field',
  battleEnd: 'Field Report',
  win: 'Last Page',
  gameOver: 'Final Entry',
}

/** A rendered line: strings are prose, numbers are struck in the numeric face. */
export type LinePart = string | number

export interface NarratedLine {
  readonly parts: readonly LinePart[]
  /** Which way the line runs — a log is read at a glance and a loss must not look like a gain. */
  readonly tone: 'harm' | 'mend' | 'plain'
}

/**
 * The display-name layer, injected. `unit` / `card` / `item` are required because every surface that narrates has
 * them; the rest are optional, and a line that needs one it was not given is simply not narrated.
 */
export interface NameBook {
  /** A unit by the name the PLAYER knows (`run/party.ts#displayName`), never an id. */
  readonly unit: (unitId: string) => string
  readonly card: (cardId: string) => string
  readonly item: (itemId: string) => string
  /** A place on the sheet (`ui/names.ts#placeName`'s engine-side twin). */
  readonly place?: (nodeId: string) => string
  readonly quest?: (questId: string) => string
  /** A quest stage's authored label (`run/quests.ts#stageLabel`). */
  readonly questStage?: (questId: string, stage: string) => string
  readonly dungeon?: (dungeonId: string) => string
  /** A room in the chart's own word (`run/dungeon.ts#ROOM_LABEL`). */
  readonly room?: (roomType: RoomType) => string
}

/**
 * A status in a SENTENCE. The card face says "burn 2 turns" because a face is a label; a log line is prose, and
 * "Oak is burn for 2 turns" is not English. Same rule as everywhere else: one name per thing, in the voice the
 * element class calls for (ARCHITECTURE §5.1).
 */
const BECOMES: Readonly<Record<StatusId, string>> = {
  poison: 'poisoned', burn: 'set alight', slow: 'slowed', immobilize: 'held fast',
  taunt: 'drawing every eye', riposte: 'ready to answer', empower: 'emboldened',
}
/** …and what it costs them, as a thing rather than a state. */
const COSTS: Readonly<Record<StatusId, string>> = {
  poison: 'the poison', burn: 'the flames', slow: 'the drag', immobilize: 'the ropes',
  taunt: 'the shouting', riposte: 'the guard', empower: 'the effort',
}

/**
 * The kinds the browser's battle plate keeps (`ui/combat/chronicle.ts`). Deliberately narrow: the log answers
 * "what changed" out of the corner of one eye, so the pumps and the whole run-level vocabulary stay off it. The
 * terminal reads the WHOLE table — it has no board animation and no field of floats to read instead.
 */
export const CHRONICLE_KINDS: ReadonlySet<EffectKind> = new Set<EffectKind>([
  'cardPlayed', 'itemUsed', 'unitHit', 'statusTicked', 'unitHealed', 'armorGranted',
  'armorShredded', 'statusApplied', 'covered', 'riposte', 'captureRolled', 'unitDied',
])

/** `[n, ' ration']` / `[n, ' rations']` — the count and its noun agree, and the number stays its own part. */
function qty(n: number, one: string, many = `${one}s`): readonly LinePart[] {
  return [n, ` ${n === 1 ? one : many}`]
}

const harm = (parts: readonly LinePart[]): NarratedLine => ({ parts, tone: 'harm' })
const mend = (parts: readonly LinePart[]): NarratedLine => ({ parts, tone: 'mend' })
const plain = (parts: readonly LinePart[]): NarratedLine => ({ parts, tone: 'plain' })

/**
 * One effect → one line, or an explicit silence.
 *
 * Silence is for the effects another surface already speaks for: a refusal (the CLI prints it against the verb the
 * player typed, `refusalLine`), a seal (the check overlay stamps it), a report (the Field Report frame), a pump
 * (`turnStarted`, `cardsDrawn`, `apChanged`, `sound`, `autosave`, `screenChanged`) and the bookkeeping twins of a
 * line that is already printed (`unitCaptured` beside `captureRolled`, `battleVictory` beside `battleEnded`).
 */
export function narrate(e: Effect, names: NameBook): NarratedLine | null {
  switch (e.kind) {
    // ── spoken by another surface, or a pump ───────────────────────────────────────────────────────────────
    case 'refused':            // `scripts/cli.ts#refusalLine`, against the verb the player typed
    case 'sound':
    case 'autosave':
    case 'screenChanged':      // the frame's own title says where the company is
    case 'turnStarted':        // the board prints the order and marks the active unit
    case 'cardsDrawn':
    case 'apChanged':          // the hand's header carries the AP
    case 'statusRemoved':      // the roster carries what is still on a unit
    case 'unitCaptured':       // `captureRolled` already said it
    case 'prisonerTaken':      // …and the Field Report lists the wagon
    case 'enemyActed':         // an AI action has no authored name; its blows narrate themselves
    case 'battleResolved':     // the Field Report frame prints the report
    case 'battleVictory':
    case 'battleDefeat':       // `battleEnded` says which way it went
    case 'locationArrived':    // a `RefKey` is a machine reference; `hopLanded` says the place
    case 'flagSet':
    case 'dialogueOpened':
    case 'dialogueClosed':     // the talk itself is the overlay
    case 'checkResolved':      // the seal is stamped on the card
    case 'runStarted':
    case 'runEnded':           // the ledger's own last line
      return null

    // ── the battle ─────────────────────────────────────────────────────────────────────────────────────────
    case 'battleStarted':
      return plain([e.enemyIds.length === 0 ? 'a fight begins' : `a fight begins — ${e.enemyIds.map(names.unit).join(', ')}`])
    case 'unitMoved': {
      const dest = e.path[e.path.length - 1]
      return dest === undefined ? null : plain([`${names.unit(e.unitId)} steps to ${dest}`])
    }
    case 'cardPlayed':
      return plain([`${names.unit(e.unitId)} plays ${names.card(e.cardId)}`])
    case 'itemUsed':
      return plain([`${names.unit(e.unitId)} reaches for the ${names.item(e.itemId)}`])
    case 'unitHit': {
      // A tick and a riposte announce themselves (`statusTicked`, `riposte`); their `unitHit` is the same blow a
      // second time, and the log printed both — "the burn costs Oak 2" directly above "Oak takes 2".
      if (e.cause === 'poison' || e.cause === 'burn' || e.cause === 'riposte') return null
      const who = names.unit(e.unitId)
      const from = e.sourceId === null ? null : names.unit(e.sourceId)
      if (e.hpLost > 0) {
        const tail = e.redirectedFrom === null ? '' : ` in ${names.unit(e.redirectedFrom)}'s place`
        return from === null
          ? harm([`${who} takes `, e.hpLost, tail])
          : harm([`${from} strikes ${who} for `, e.hpLost, tail])
      }
      if (e.armorLost > 0) return harm([`${who} loses `, e.armorLost, ' ward'])
      return plain([`${who} is not touched`])
    }
    case 'statusTicked':
      return e.damage <= 0 ? null : harm([`${names.unit(e.unitId)} takes `, e.damage, ` from ${COSTS[e.status]}`])
    case 'unitHealed':
      return mend([`${names.unit(e.unitId)} mends `, e.amount])
    case 'armorGranted':
      return e.amount <= 0 ? null : mend([`${names.unit(e.unitId)} takes `, e.amount, ' ward'])
    case 'armorShredded':
      return harm([`${names.unit(e.unitId)} is stripped of `, e.amount, ' ward'])
    case 'statusApplied':
      return {
        parts: [`${names.unit(e.unitId)} is ${BECOMES[e.status]} for `, e.turns, e.turns === 1 ? ' turn' : ' turns'],
        tone: e.status === 'empower' || e.status === 'taunt' || e.status === 'riposte' ? 'plain' : 'harm',
      }
    case 'covered':
      return plain([`${names.unit(e.protectorId)} steps in front of ${names.unit(e.protecteeId)}`])
    case 'riposte':
      return harm([`${names.unit(e.fromId)} answers ${names.unit(e.toId)} for `, e.amount])
    case 'captureRolled':
      return e.success
        ? mend([`${names.unit(e.attackerId)} takes ${names.unit(e.targetId)} alive`])
        : harm([`${names.unit(e.targetId)} breaks the hold`])
    case 'unitDied':
      return { parts: [`${names.unit(e.unitId)} falls`], tone: e.team === 'party' ? 'harm' : 'mend' }
    case 'battleEnded':
      return e.outcome === 'victory' ? mend(['the field is won']) : harm(['the field is lost'])

    // ── the purse, the larder and the company ──────────────────────────────────────────────────────────────
    case 'goldChanged':
      if (e.delta === 0) return null
      return e.delta > 0 ? mend(['the purse takes ', e.delta, ' gold']) : harm(['the purse gives up ', -e.delta, ' gold'])
    case 'foodChanged':
      if (e.delta === 0) return null
      return e.delta > 0 ? mend(['the larder takes ', ...qty(e.delta, 'ration')]) : plain(['the larder gives up ', ...qty(-e.delta, 'ration')])
    case 'starvation':
      return harm(['the larder is empty — the company loses ', e.amount, ' apiece'])
    case 'itemAcquired':
      return mend([`${names.item(e.itemId)} goes into the bag`])
    case 'itemRemoved':
      switch (e.reason) {
        case 'sold': return plain([`${names.item(e.itemId)} is sold`])
        case 'consumed': return plain([`${names.item(e.itemId)} is used up`])
        case 'discarded': return plain([`${names.item(e.itemId)} is thrown out`])
        case 'forfeited': return plain([`${names.item(e.itemId)} is left where it lay`])
      }
      return null
    case 'lootOverflow':
      return plain([`there is no room in the bag for ${e.itemIds.map(names.item).join(', ')}`])
    case 'partyHealed':
      switch (e.reason) {
        case 'inn': return mend(['a night at the inn mends the wounded'])
        case 'campRest': return mend(['the fire mends the wounded'])
        case 'dungeonRest': return mend(['the company binds its wounds'])
        case 'quest': return mend(['the wounded mend'])
      }
      return null
    case 'partyDamaged':
      return harm(['the company takes ', e.amount, ' apiece'])
    case 'prisonerTurnedIn':
      return mend([`${names.unit(e.unitId)} is handed over for `, e.gold, ' gold'])
    case 'unitRecruited':
      return mend([`${names.unit(e.characterId)} joins the company`])
    case 'unitLost':
      return harm([`${names.unit(e.unitId)}${e.cause === 'starvation' ? ' is lost on the road' : ' will not march again'}`])
    case 'nameSet':
      return plain([`the ${e.target === 'mc' ? 'foundling' : 'company'} takes the name ${e.name}`])

    // ── the road and the descent ───────────────────────────────────────────────────────────────────────────
    case 'hopStarted': {
      const to = names.place?.(e.to)
      return to === undefined ? null : plain([`the company takes the road to ${to}`])
    }
    case 'hopLanded': {
      const where = names.place?.(e.nodeId)
      return where === undefined ? null : plain([`the company reaches ${where}`])
    }
    case 'encounterRolled':
      // Every other result announces itself the moment it opens — a battle, a talk, an event card.
      return e.result === 'quiet' ? plain(['the road is quiet']) : null
    case 'journeyEnded': {
      const where = names.place?.(e.nodeId)
      // 'arrived' is `hopLanded` a second time; only a halt is news.
      return e.reason === 'arrived' || where === undefined ? null : plain([`the company stays at ${where}`])
    }
    case 'scouted':
      return e.edgeKeys.length === 0 ? null : plain(['the scouts bring back word of ', ...qty(e.edgeKeys.length, 'road')])
    case 'dungeonEntered': {
      const name = names.dungeon?.(e.dungeonId)
      return name === undefined ? null : plain([`the company goes down into ${name}`])
    }
    case 'roomEntered': {
      const room = names.room?.(e.roomType)
      return room === undefined ? null : plain([`the door opens on ${room}`])
    }
    case 'dungeonCleared': {
      const name = names.dungeon?.(e.dungeonId)
      return name === undefined ? null : mend([`${name} is cleared`])
    }

    // ── the contracts ──────────────────────────────────────────────────────────────────────────────────────
    case 'questStarted': {
      const quest = names.quest?.(e.questId)
      return quest === undefined ? null : plain([`a contract is taken — ${quest}`])
    }
    case 'questStageAdvanced': {
      const quest = names.quest?.(e.questId)
      const stage = names.questStage?.(e.questId, e.to)
      return quest === undefined || stage === undefined ? null : plain([`${quest} — ${stage.toLowerCase()}`])
    }
    case 'questCompleted': {
      const quest = names.quest?.(e.questId)
      return quest === undefined ? null : mend([`${quest} is settled`])
    }

    case 'toast':
      return plain([e.text])
  }
}

/** The battle plate's subset, and the reason `ui/combat/chronicle.ts` cannot drift from the terminal. */
export function battleLine(e: Effect, names: NameBook): NarratedLine | null {
  return CHRONICLE_KINDS.has(e.kind) ? narrate(e, names) : null
}
