#!/usr/bin/env tsx
/**
 * scripts/cli.ts — the headless game (CONTRACT §10; ARCHITECTURE §6). Imports `src/engine/**` and `src/content/*`
 * only; drives `createRuntime` with no scheduler and `drain()` after every command, so enemy turns and hops run
 * to the next decision point on their own.
 *
 *   npm run cli -- play [--seed N] [--screen <kind>] [--cmds "new 7; auto; ..."] [--save file.json] [--fresh] [--json] [--trace]
 *   npm run cli -- combat --scenario stub|boss|tutorial|group:<id>:<L>|dungeon:<id>:<room> [--seed N] [--cmds "..."] [--trace]
 *   npm run cli -- simulate [--scenario …] [--runs 50] [--policy greedy|random] [--rules "knob=value;…"] [--json]
 *   npm run cli -- balance [--rules "knob=value;…"]
 *   npm run cli -- travel --to <node> [--seed N] [--auto]
 *   npm run cli -- replay <snapshot.json> <actions.json> [--initial <state.json>]
 *   npm run cli -- dialogue <id> [--seed N] [--cmds "1;2"]
 *   npm run cli -- lint
 *   npm run cli -- dump-state --screen <kind> [--seed N]
 *
 * Every command validates its own flags: an unknown flag, a non-numeric `--seed`/`--runs`, an unknown `--screen`,
 * `--policy` or `--scenario` prints one line and exits 1 (CLI-01, CLI-06, CLI-10) — a silent no-op is never
 * success. `--cmds` scripts exit 1 when a VERB was unknown; refusals and mistyped arguments stay non-fatal and
 * are summarised.
 *
 * Every line the REPL prints is the PLAYER's: the frames are prose and the effect stream is narrated through
 * `engine/narration.ts`. `--trace` puts the raw effects on stderr for whoever is debugging instead of playing.
 *
 * Type `help` in the REPL for the command list.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { content } from '../src/content/index'
import { lintContent, lintContentWarnings } from '../src/content/lint'
import type { Action } from '../src/engine/actions'
import type { Effect } from '../src/engine/effects'
import { CONSUMED_PARAMS } from '../src/engine/combat/cards'
import { canEnterCapture, captureChance, captureContext } from '../src/engine/combat/capture'
import { forecast } from '../src/engine/combat/damage'
import { reachable, unitAt } from '../src/engine/combat/grid'
import { resolveBattle } from '../src/engine/combat/resolve'
import { RoundCapError, carefulPolicy, greedyPolicy, randomPolicy, sweep, type Policy } from '../src/engine/combat/sim'
import { legalTargets, recipients } from '../src/engine/combat/targeting'
import { canEnterMove, initiativeStrip } from '../src/engine/combat/turn'
import { STATUS_WORD, cardFace, cardIntentLines, outcomeWords, reachWord, reckoningWords, riderWords } from '../src/engine/combat/words'
import { SCREEN_NAME, narrate, type NameBook } from '../src/engine/narration'
import { createEnv, withRules } from '../src/engine/content'
import { fixtureFor } from '../src/engine/flow/fixtures'
import { isLegal } from '../src/engine/flow/legality'
import { initialState } from '../src/engine/flow/lifecycle'
import { isQuiescent, overlayOf } from '../src/engine/flow/pump'
import { createRuntime, type Runtime } from '../src/engine/flow/runtime'
import { rules as shippedRules, type Rules } from '../src/engine/rules'
import { battleSpecFor } from '../src/engine/run/battle'
import { entryAt, foodCount, itemDef } from '../src/engine/run/bag'
import type { CheckVerdict } from '../src/engine/run/checks'
import { checkCandidates, verdictOf } from '../src/engine/run/checks'
import { currentNode, renderText, speakerName, visibleChoices } from '../src/engine/run/dialogue'
import { DESCENT_IS_ONE_WAY, ROOM_LABEL, canEnterDungeon, leaveDungeon, reachableRooms } from '../src/engine/run/dungeon'
import { canHold } from '../src/engine/run/equipment'
import { bountyFor, buyPrice, entrySellPrice, innCost, shopStock } from '../src/engine/run/economy'
import { seedNewRun } from '../src/engine/run/newRun'
import { adjacency, nodeOf, previewPath, typeLabel } from '../src/engine/run/overworld'
import { scoutedRoads, sightingFor } from '../src/engine/run/scout'
import { throneWarning } from '../src/engine/run/travel'
import { displayName, livingUnits } from '../src/engine/run/party'
import { bootstrapQuests, questStatus, stageLabel } from '../src/engine/run/quests'
import { tavernBoard } from '../src/engine/run/town'
import { parseSave, serialize, toSaveFile } from '../src/engine/save/codec'
import { verifyReplay } from '../src/engine/save/replay'
import type { ActiveDungeon, BattleSpec, CombatState, EngineEnv, GameState, HandSlot, RoomId, RunState, ScreenKind, TileKey } from '../src/engine/types'

// ─────────────────────────────────────────────────────────────── args ──

/** A bad invocation: one line on stdout, exit 1. Never a stack trace, never a silent no-op. */
class ArgError extends Error {}

interface CommandSpec {
  /** `--name value` flags. */
  readonly flags: readonly string[]
  /** `--name` switches. */
  readonly booleans: readonly string[]
  /** How many bare arguments the command accepts. */
  readonly positionals: number
}

const COMMANDS: Readonly<Record<string, CommandSpec>> = {
  play: { flags: ['seed', 'screen', 'cmds', 'save'], booleans: ['json', 'fresh', 'trace'], positionals: 0 },
  combat: { flags: ['seed', 'scenario', 'cmds', 'save'], booleans: ['json', 'trace'], positionals: 0 },
  simulate: { flags: ['scenario', 'runs', 'policy', 'rules'], booleans: ['json', 'trace'], positionals: 0 },
  balance: { flags: ['rules'], booleans: [], positionals: 0 },
  travel: { flags: ['seed', 'to'], booleans: ['auto'], positionals: 0 },
  replay: { flags: ['initial'], booleans: [], positionals: 2 },
  dialogue: { flags: ['seed', 'cmds'], booleans: [], positionals: 1 },
  lint: { flags: [], booleans: [], positionals: 0 },
  'dump-state': { flags: ['screen', 'seed'], booleans: [], positionals: 0 },
  help: { flags: [], booleans: [], positionals: 0 },
}

const argv = process.argv.slice(2)
const command = argv[0] ?? 'help'

interface Args {
  readonly values: ReadonlyMap<string, string>
  readonly bools: ReadonlySet<string>
  readonly positionals: readonly string[]
}

/** Total over the token stream: a `--x` the command does not declare is an error, not a shrug. Because the spec
 *  says which flags take a value, a positional that follows a boolean switch survives (the old scanner ate it). */
function parseArgs(spec: CommandSpec, tokens: readonly string[]): Args {
  const values = new Map<string, string>()
  const bools = new Set<string>()
  const positionals: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    if (token.startsWith('--')) {
      const name = token.slice(2)
      if (spec.booleans.includes(name)) { bools.add(name); continue }
      if (spec.flags.includes(name)) {
        const value = tokens[i + 1]
        if (value === undefined) throw new ArgError(`--${name} needs a value`)
        values.set(name, value)
        i++
        continue
      }
      const known = [...spec.flags.map((f) => `--${f} <value>`), ...spec.booleans.map((b) => `--${b}`)]
      throw new ArgError(`unknown flag --${name} — ${command} takes ${known.length === 0 ? 'no flags' : known.join(', ')}`)
    }
    positionals.push(token)
  }
  if (positionals.length > spec.positionals) {
    throw new ArgError(`${command} takes ${spec.positionals} positional argument(s), got ${positionals.length}: ${positionals.join(' ')}`)
  }
  return { values, bools, positionals }
}

let args: Args = { values: new Map(), bools: new Set(), positionals: [] }
const flag = (name: string): string | undefined => args.values.get(name)
const has = (name: string): boolean => args.bools.has(name)
const positional = (n: number): string | undefined => args.positionals[n]

/** A seed is an integer or nothing: `Number('abc')` is NaN, and a run minted with `runSeed: NaN` serialises to
 *  `null` and can never be loaded again (CLI-01). Same for `1e999` (Infinity). */
function parseSeed(raw: string | undefined, fallback = 1): number {
  if (raw === undefined) return fallback
  const n = Number(raw)
  if (!Number.isSafeInteger(n)) throw new ArgError(`seed must be an integer, got '${raw}'`)
  return n
}

function parseCount(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback
  const n = Number(raw)
  if (!Number.isSafeInteger(n) || n < 1) throw new ArgError(`--${name} must be a positive integer, got '${raw}'`)
  return n
}

/** `--rules "combat.roundCap=40;balance.turns=1,20"` → a `Partial<Rules>` patch for `withRules` (CONTRACT §10). */
function parseRulesPatch(spec: string | undefined): Partial<Rules> {
  if (spec === undefined) return {}
  const patch: Record<string, unknown> = {}
  const table = shippedRules as unknown as Record<string, unknown>
  for (const pair of spec.split(';')) {
    const trimmed = pair.trim()
    if (trimmed === '') continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) throw new ArgError(`--rules takes knob=value pairs separated by ';', got '${trimmed}'`)
    const path = trimmed.slice(0, eq).trim().split('.')
    const raw = trimmed.slice(eq + 1).trim()
    const top = path[0]!
    if (!Object.hasOwn(table, top)) throw new ArgError(`--rules: unknown knob '${trimmed.slice(0, eq).trim()}' (no rules.${top})`)
    if (path.length === 1) { patch[top] = ruleValue(raw); continue }
    const group = (patch[top] ?? structuredClone(table[top])) as Record<string, unknown>
    let cursor = group
    for (let i = 1; i < path.length - 1; i++) {
      const next = cursor[path[i]!]
      if (next === null || typeof next !== 'object') throw new ArgError(`--rules: unknown knob '${trimmed.slice(0, eq).trim()}'`)
      cursor = next as Record<string, unknown>
    }
    const leaf = path[path.length - 1]!
    if (!Object.hasOwn(cursor, leaf)) throw new ArgError(`--rules: unknown knob '${trimmed.slice(0, eq).trim()}'`)
    cursor[leaf] = ruleValue(raw)
    patch[top] = group
  }
  return patch as Partial<Rules>
}

function ruleValue(raw: string): unknown {
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw.includes(',')) return raw.split(',').map(ruleScalar)
  return ruleScalar(raw)
}

function ruleScalar(raw: string): number | string {
  const n = Number(raw)
  return raw.trim() !== '' && Number.isFinite(n) ? n : raw
}

let env: EngineEnv = createEnv()
const SCREENS: readonly ScreenKind[] = ['title', 'prologue', 'overworld', 'town', 'camp', 'dungeon', 'combat', 'battleEnd', 'win', 'gameOver']

function parseScreen(raw: string | undefined, fallback: ScreenKind): ScreenKind {
  if (raw === undefined) return fallback
  if (!SCREENS.includes(raw as ScreenKind)) throw new ArgError(`unknown screen '${raw}' — one of ${SCREENS.join(', ')}`)
  return raw as ScreenKind
}

const POLICIES: Readonly<Record<string, Policy>> = { careful: carefulPolicy, greedy: greedyPolicy, random: randomPolicy }

// ─────────────────────────────────────────────────────────── render ──

/** An attrition path drives dozens of real battles through `drive()`, which narrates every one of them. The two
 *  drivers run inside `quietly`, so a sweep prints its TABLE and nothing else (and the unit suite prints nothing);
 *  the gate's own lines, and `--trace`, sit outside it. */
let muted = false
const out = (s: string): void => { if (!muted) process.stdout.write(s + '\n') }
function quietly<T>(fn: () => T): T {
  muted = true
  try { return fn() } finally { muted = false }
}

function hp(u: { readonly hp: { readonly current: number; readonly max: number } }): string {
  return `${u.hp.current}/${u.hp.max}`
}

/** A count and its noun agree: `1 round`, never `1 rounds` (GATE3-18). */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * One offer in a printed menu: the verb the REPL takes, the action it dispatches, and — for the verbs whose rule
 * the flow gate deliberately does NOT hold (CONTRACT §4 keeps rule-level refusals with the module that owns them)
 * — the sentence that module already answers with. `ui/screens/Dungeon.tsx` composes the two exactly this way
 * (`disabledReason={legal.ok ? view.leaveReason : legal.reason}`), so the terminal and the glass withhold the same
 * verb for the same reason (CONTRACT-CHANGES 0093).
 */
interface MenuEntry {
  readonly verb: string
  readonly action: Action
  /** A rule-level refusal from the owning module, consulted only when `isLegal` says ok. null = nothing to add. */
  readonly reason?: string | null
  /** What the OFFER reads as when it is open, if the verb alone undersells it — the browser's button label, which
   *  carries the bill a press will pay ("Rest the wounded · 36 gold", FINAL GATE A 1.1). The refusal line always
   *  names the bare verb: a withheld verb has no bill. */
  readonly label?: string
}

/** `open` is the bracketed list of verbs that will work; `shut` is one indented line per REASON. */
interface Menu {
  readonly open: string
  readonly shut: readonly string[]
}

/**
 * The CLI's disabled-with-reason. `flow/legality.ts#isLegal` is the SINGLE truth behind both the printed menu and
 * the reducer's refusal (ARCHITECTURE §5), so a verb the engine would refuse is never offered as a choice - it is
 * listed under the menu with the exact sentence the reducer would have answered with. Before this the menu was a
 * hardcoded string and advertised `continue-travel` at the end of the road and `rest`/`scout` after the day's one
 * camp action (GATE3-18). Verbs that share a reason share a line, so a camp does not print the same sentence twice.
 *
 * `MenuEntry.reason` covers the verbs §4 leaves to their own module (the dungeon's one-way door, an empty shelf):
 * the gate answers first, and its sentence wins when it refuses.
 */
export function menu(state: GameState, entries: readonly MenuEntry[]): Menu {
  const open: string[] = []
  const blocked: { readonly reason: string; readonly verbs: string[] }[] = []
  for (const entry of entries) {
    const legal = isLegal(state, entry.action, env)
    const reason = legal.ok ? entry.reason ?? null : legal.reason
    if (reason === null) { open.push(entry.label ?? entry.verb); continue }
    const row = blocked.find((b) => b.reason === reason)
    if (row === undefined) blocked.push({ reason, verbs: [entry.verb] })
    else row.verbs.push(entry.verb)
  }
  return {
    open: open.length === 0 ? '' : `[${open.join('] [')}]`,
    shut: blocked.map((b) => `  ✗ ${b.verbs.join(', ')}: ${b.reason}`),
  }
}

/**
 * The letter a unit wears ON THE BOARD, party A-Z and foes a-z in id order. It is the CLI's whole addressing
 * scheme for a unit - and until now the only verb that takes a unit as an argument, `capture`, took a raw UNIT ID
 * instead, which is printed nowhere: `capture c` came back "no foe there to take" and the only way to take a
 * prisoner headless was to dump `state` and read `mage_circle_2_1` out of the JSON (FINAL GATE C 3.7).
 */
export function boardLetters(c: CombatState): ReadonlyMap<string, string> {
  const letters = new Map<string, string>()
  const party = Object.values(c.units).filter((u) => u.team === 'party').sort((a, b) => (a.id < b.id ? -1 : 1))
  const enemies = Object.values(c.units).filter((u) => u.team === 'enemy').sort((a, b) => (a.id < b.id ? -1 : 1))
  party.forEach((u, i) => letters.set(u.id, String.fromCharCode(65 + i)))
  enemies.forEach((u, i) => letters.set(u.id, String.fromCharCode(97 + i)))
  return letters
}

/** The unit wearing `letter` on the board, or null. Case-sensitive: `A` is the lord, `a` is the first foe. */
function unitByLetter(c: CombatState, letter: string): string | null {
  for (const [id, l] of boardLetters(c)) if (l === letter) return id
  return null
}

/** Every foe the active unit could take, with the odds the roll would actually run at (`combat/capture.ts`). */
function captureRows(c: CombatState): readonly { readonly letter: string; readonly name: string; readonly chance: number }[] {
  const active = c.units[c.turn.unitId]
  if (active === undefined || active.team !== 'party' || active.position === null) return []
  const letters = boardLetters(c)
  return Object.values(c.units).flatMap((u) => {
    if (u.team === active.team || u.position === null || u.hp.current <= 0 || u.captured) return []
    const ctx = captureContext(c, active.id, u.id, env)
    if (!ctx.adjacent) return []
    return [{ letter: letters.get(u.id) ?? '?', name: u.name, chance: captureChance(u, ctx.supportingAllies, ctx.bountyHunter, env) }]
  })
}

function renderBoard(c: CombatState, run: RunState | null): string[] {
  const lines: string[] = []
  const letters = boardLetters(c)
  const party = Object.values(c.units).filter((u) => u.team === 'party').sort((a, b) => (a.id < b.id ? -1 : 1))
  const enemies = Object.values(c.units).filter((u) => u.team === 'enemy').sort((a, b) => (a.id < b.id ? -1 : 1))
  const obstacles = new Set(c.grid.obstacles)
  const floor = new Set(c.grid.floor ?? [])
  const at = new Map<string, string>()
  for (const u of Object.values(c.units)) if (u.position !== null && u.hp.current > 0 && !u.captured) at.set(u.position, u.id)
  // THE REACH, DRAWN. The browser washes every tile the active unit can walk to; the terminal drew nothing, so a
  // headless player had to re-derive a path-based, obstacle-aware BFS by eye - and lost whole activations to blind
  // refusals after mis-reading one row (FINAL GATE C 3.8). Same selector the board's wash reads.
  const active = c.units[c.turn.unitId]
  const step = active === undefined || active.team !== 'party' || c.phase !== 'combat' ? null : canEnterMove(active)
  const reach = step !== null && step.ok && active !== undefined ? reachable(c, active.id) : {}
  const reachCount = Object.keys(reach).length
  lines.push('    ' + Array.from({ length: c.grid.width }, (_, x) => String(x % 10)).join(' '))
  for (let y = 0; y < c.grid.height; y++) {
    let row = `${String(y).padStart(2)}  `
    for (let x = 0; x < c.grid.width; x++) {
      const t = `${x},${y}`
      const id = at.get(t)
      let ch = obstacles.has(t) ? '#' : t in reach ? '+' : floor.has(t) ? ':' : '.'
      if (id !== undefined) ch = (id === c.turn.unitId ? '*' : '') + letters.get(id)!
      row += ch.padEnd(2)
    }
    lines.push(row)
  }
  const legend = (u: (typeof party)[number]): string => {
    const name = run === null ? u.name : displayName(u, run)
    // A status by its NAME, the word the card face and the browser's rail both use — `immobilize1` is a schema id
    // (`engine/combat/words.ts#STATUS_WORD`, FINAL GATE A 1.3).
    const st = u.statuses.map((s) => `${STATUS_WORD[s.id]} ${s.stacks}`).join(', ')
    return `${letters.get(u.id)} ${name.padEnd(12)} hp ${hp(u).padEnd(7)} ar ${String(u.armor).padEnd(2)} ap ${u.ap}${st ? ' [' + st + ']' : ''}${u.id === c.turn.unitId ? '  ← active' : ''}`
  }
  lines.push('party:  ' + party.map(legend).join('\n        '))
  lines.push('enemy:  ' + enemies.filter((u) => u.hp.current > 0 && !u.captured).map(legend).join('\n        '))
  if (c.phase !== 'combat') {
    lines.push(`the battle is over — ${c.phase} in ${plural(c.turn.round, 'round')}`)
    return lines
  }
  const strip = initiativeStrip(c, 8)
  lines.push(`round ${c.turn.round}  order: ${strip.ids.map((id) => letters.get(id)).join(' ')}${strip.more > 0 ? ` +${strip.more}` : ''}`)
  const deck = c.decks[c.turn.unitId]
  if (active !== undefined && active.team === 'party' && deck !== undefined) {
    lines.push(`hand (${active.ap} AP):`)
    deck.hand.forEach((uid, i) => {
      const inst = deck.cards[uid]!
      const card = env.content.cards[inst.cardId]!
      // The face the BROWSER shows: the number this card puts out in THIS unit's hands and the outcome in words
      // (`engine/combat/words.ts#cardFace`). The terminal printed `enemy  r1-2 aoe2` - the authored codes 5.1 bans.
      const face = cardFace(card, active, inst.mod)
      const short = card.apCost > active.ap ? `  (needs ${card.apCost} AP)` : ''
      lines.push(`  ${i + 1}: ${card.name.padEnd(20)} ${card.apCost} AP  ${face.number === '' ? '' : `${face.number} `}${face.foot} · ${reachWord(card)}${short}`)
    })
    // The satchel by ROW: `item <id>` made the player type `healing_potion` back off a line that printed the bare
    // id, and 0087's argument-of-a-verb exception does not survive a row number (FINAL GATE C 3.7).
    if (c.consumables.length > 0) lines.push(`  bag: ${c.consumables.map((id, i) => `${i + 1}: ${env.content.items[id]?.name ?? 'something'}`).join(' | ')}  [item <n>]`)
    const takeable = captureRows(c)
    if (takeable.length > 0 && canEnterCapture(c, active, env).ok) {
      lines.push(`  capture: ${takeable.map((r) => `${r.letter} ${r.name} ${Math.round(r.chance * 100)}%`).join(' | ')}  [capture <letter>]`)
    }
    lines.push(`  draw ${deck.draw.length} / discard ${deck.discard.length}`)
    // What the board just DREW, in words, and the verb it belongs to.
    lines.push(step !== null && step.ok
      ? `  steps: ${plural(reachCount, 'tile')} marked + within one move  [move <x,y>]`
      : `  steps: ${step === null ? 'not your move' : step.reason}`)
    lines.push('  [aim <n>] weighs a card before you spend it, [aim <n> <x,y>] forecasts the play, [play <n> <x,y|->] commits')
  }
  return lines
}

/**
 * THE PLAY, WEIGHED — the terminal's half of the browser's pin-and-forecast (FINAL GATE C 3.8). `aim <n>` names
 * what the card does, how far it reaches and every tile it may legally be aimed at with who is standing there;
 * `aim <n> <x,y>` runs the SAME `combat/damage.ts#forecast` the play panel and the reducer run and leads with the
 * outcome in the same words (`engine/combat/words.ts`). Read-only: nothing here dispatches.
 */
export function renderAim(state: GameState, handRow: number, tile: TileKey | null): string[] {
  const c = state.combat
  if (c === null || c.phase !== 'combat') return ['no battle to aim in']
  const active = c.units[c.turn.unitId]
  const deck = c.decks[c.turn.unitId]
  if (active === undefined || deck === undefined || active.team !== 'party') return ['it is not your move']
  const uid = deck.hand[handRow - 1]
  const inst = uid === undefined ? undefined : deck.cards[uid]
  const card = inst === undefined ? undefined : env.content.cards[inst.cardId]
  if (inst === undefined || card === undefined) throw new ArgError('aim <n> [x,y] — the row on the hand')
  const names = nameBook(state)
  const face = cardFace(card, active, inst.mod)
  const lines = [`aim: ${card.name} · ${card.apCost} AP · ${face.number === '' ? '' : `${face.number} `}${face.foot} · ${reachWord(card)}`]
  if (card.apCost > active.ap) lines.push(`  ✗ play: needs ${card.apCost} AP`)
  const targets = legalTargets(c, active.id, card, env)
  if (tile === null) {
    lines.push(`  targets: ${targets.map((t) => {
      const on = unitAt(c, t)
      return on === null ? t : `${t} ${names.unit(on.id)} ${hp(on)}`
    }).join(' | ') || 'nowhere from here'}`)
    for (const line of cardIntentLines(card, active, inst.mod)) lines.push(`  ${line}`)
    return lines
  }
  if (!targets.includes(tile)) {
    lines.push(`  ✗ play: ${tile} is not one of them`)
    return lines
  }
  const on = unitAt(c, tile)
  const f = on === null ? null : forecast(c, active.id, { card, mod: inst.mod }, on.id, env)
  if (on !== null && f !== null) {
    const covered = f.redirectedTo === null ? '' : ` (${names.unit(f.redirectedTo)} covers)`
    lines.push(`  ${names.unit(active.id)} → ${names.unit(on.id)}${covered}: ${outcomeWords(f, on.armor)}${f.lethal ? ' — SLAIN' : ''}`)
    lines.push(`  hp ${on.hp.current} → ${f.predictedHp}/${on.hp.max}${on.armor > 0 || f.predictedArmor > 0 ? `, armor ${on.armor} → ${f.predictedArmor}` : ''}`)
    if (f.riders.length > 0) lines.push(`  and: ${riderWords(f.riders)}`)
    if (f.afterDr + f.quiverTerm > 0) lines.push(`  reckoning: ${reckoningWords(f)}`)
  } else {
    for (const line of cardIntentLines(card, active, inst.mod)) lines.push(`  ${line}`)
  }
  // Everyone ELSE the play lands on: a blast described through one victim understates it, which is why the
  // browser's panel carries an "also caught" list of its own.
  const also = [...recipients(c, active.id, tile, card, 'area'), ...recipients(c, active.id, tile, card, 'ring')]
  const caught = [...new Map(also.filter((u) => u.id !== on?.id).map((u) => [u.id, u])).values()]
  if (caught.length > 0) {
    lines.push(`  also caught: ${caught.map((u) => {
      const g = forecast(c, active.id, { card, mod: inst.mod }, u.id, env)
      return `${names.unit(u.id)} ${u.hp.current} → ${g === null ? u.hp.current : g.predictedHp}/${u.hp.max}${g !== null && g.lethal ? ' SLAIN' : ''}`
    }).join(' | ')}`)
  } else if (on === null) {
    lines.push('  nobody is standing in it')
  }
  return lines
}

function renderRun(run: RunState): string[] {
  const node = nodeOf(run.nodeId, env)
  const party = livingUnits(run).map((u) => `${displayName(u, run)} ${hp(u)}`).join(' · ')
  // The company name is the second thing the player names (`run/questEffects.ts#promptName`), and the roster is
  // the one line it belongs on; unnamed, the label is still `party`.
  // The place is NAMED on this line; the parenthetical used to add its id, its schema enum and its internal
  // area tier as well - `at Frontier Camp (frontier_camp, CAMP, tier 1)` - none of which is the argument of any
  // verb on the frame, which is what 0087's exception is for (FINAL GATE A 1.2). What is left is the word the
  // map's own sigil is captioned with (`run/overworld.ts#typeLabel`).
  return [`day ${run.daysElapsed}  at ${node.name} (a ${typeLabel(node.type)})  gold ${run.gold}  food ${foodCount(run.bag, env)}`, `${run.companyName ?? 'party'}: ${party}`]
}

/** The three stamps a resolved event can wear, in the card's own words (`ui/overlays/CheckOverlay.tsx#SEAL`). */
const SEAL_WORD: Readonly<Record<CheckVerdict, string>> = { passed: 'PASSED', failed: 'FAILED', untested: 'CHOSEN' }

export function renderOverlay(state: GameState): string[] {
  const overlay = overlayOf(state)
  if (overlay === null) return []
  // The step is the OVERLAY's line - `renderBoard` printed it too, so every tutorial frame carried the same
  // sentence twice (GATE3-18). It answers before the run guard because a run-less `combat --scenario tutorial`
  // still has a step to read, and `overlayOf` already derives it from the combat slice alone.
  if (overlay.kind === 'tutorial') return [`tutorial: ${overlay.step}`]
  const run = state.run
  if (run === null) return []
  switch (overlay.kind) {
    case 'dialogue': {
      const node = currentNode(run, env)
      if (node === null) return ['(dialogue: no node)']
      const who = speakerName(node.speaker, run, env)
      const lines = [`— ${who ?? 'narrator'}: ${renderText(node.text, run, env)}`]
      const choices = visibleChoices(run, env)
      if (choices.length === 0) lines.push('  [next]')
      choices.forEach((ch, i) => {
        const gate = ch.check === undefined ? '' : ` [${ch.check.kind}${'stat' in ch.check ? ` ${ch.check.stat} ${ch.check.threshold}` : ''}${ch.bestCandidate ? ` — best ${ch.bestCandidate.name} ${ch.bestCandidate.statValue}` : ''}]`
        lines.push(`  ${i + 1}: ${ch.text}${gate}${ch.enabled ? '' : ' (disabled)'}`)
      })
      return lines
    }
    case 'checkEvent': {
      const ev = env.content.checkEvents[overlay.event.checkEventId]!
      const lines = [`— ${ev.title}: ${ev.description}`]
      if (overlay.event.result === null) {
        ev.choices.forEach((ch, i) => {
          const cands = ch.check === undefined ? '' : ` [${ch.check.kind}${'stat' in ch.check ? ` ${ch.check.stat} ${ch.check.threshold}` : ''}: ${checkCandidates(ch.check, run).map((c) => `${c.name} ${c.statValue}${c.meetsThreshold ? '✓' : ''}`).join(', ')}]`
          lines.push(`  ${i + 1}: ${ch.text}${cands}`)
        })
      } else {
        // The seal the card stamps, in the same three words (`run/checks.ts#verdictOf`): an option with no check
        // was CHOSEN, never passed — passing claims a test that was never taken (RE-GATE C 3.11).
        lines.push(`  ${SEAL_WORD[verdictOf(overlay.event, env) ?? 'untested']} — ${overlay.event.result.narration}`, '  [dismiss]')
      }
      return lines
    }
    case 'namePrompt':
      return [`— name the ${overlay.prompt.target === 'mc' ? 'foundling' : 'company'}: [name <text>]`]
    case 'quickMenu': {
      const node = nodeOf(run.nodeId, env)
      const here: MenuEntry[] = []
      if (node.type === 'TOWN') here.push({ verb: 'town', action: { type: 'town/enter' } })
      if (node.type === 'CAMP') here.push({ verb: 'camp', action: { type: 'camp/enter' } })
      if (node.type === 'DUNGEON') here.push({ verb: 'dungeon', action: { type: 'dungeon/enter' } })
      if (node.type === 'BOSS') here.push({ verb: 'boss', action: { type: 'travel/challengeBoss' } })
      const m = menu(state, [
        ...here,
        { verb: 'continue-travel', action: { type: 'travel/continue' } },
        { verb: 'stay', action: { type: 'travel/stay' } },
      ])
      const at = [`— at ${node.name}: ${m.open}  (${plural(run.pendingTravel?.path.length ?? 0, 'hop')} left)`, ...m.shut]
      // The one-way door, said before it and not after (`run/dungeon.ts#DESCENT_IS_ONE_WAY`, RE-GATE C 3.12).
      if (node.type === 'DUNGEON' && canEnterDungeon(run, env).ok) at.push(`  ${DESCENT_IS_ONE_WAY}`)
      // ...and the LAST door, which had nothing at all (`run/travel.ts#throneWarning`, RE-GATE C 3.14).
      const throne = throneWarning(run, env)
      if (throne !== null) at.push(`  ${throne}`)
      return at
    }
  }
}

/** Every line one screen prints, in order. Exported so the suite can read a whole frame the way a player does -
 *  the tutorial step printing twice (GATE3-18) was invisible to a suite that only ever asserted single lines. */
/**
 * Contracts — the headless half of the quest log (`ui/modals/QuestLog.tsx`). The run could TAKE contracts and
 * then never read one without a browser, which CONTRACT §10 does not allow (GATE3-14). Same three readings as
 * the modal: the quest's authored name, its stage in words, and how long it has been open.
 */
export function renderContracts(run: RunState): string[] {
  const rows = Object.entries(run.questStates)
  if (rows.length === 0) return ['CONTRACTS — none taken yet.']
  const open = rows.filter(([id]) => questStatus(run, id) !== 'complete')
  const done = rows.filter(([id]) => questStatus(run, id) === 'complete')
  const line = ([id, st]: (typeof rows)[number], settled: boolean): string => {
    const name = env.content.quests[id]?.name ?? id
    const age = Math.max(0, run.daysElapsed - st.startedDay)
    return settled
      ? `  ${name} — settled`
      : `  ${name} — ${stageLabel(id, st.stage, env)} · taken on day ${st.startedDay}${age > 0 ? `, open ${plural(age, 'day')}` : ''}`
  }
  return [
    `CONTRACTS — ${plural(open.length, 'open contract')}${done.length > 0 ? `, ${plural(done.length, 'settled')}` : ''}`,
    ...open.map((r) => line(r, false)),
    ...done.map((r) => line(r, true)),
  ]
}

/**
 * The loadout, headless. `run/equipment.ts` and the browser's Loadout modal could both put a looted bow in a
 * hand; the terminal had no verb at all, so a run could find gear it could never hold (GATE3-14). Units are
 * numbered so `equip <n>` needs no unit id, and bag cells are addressed the way `sell <x,y>` already addresses
 * one — the one coordinate the CLI has always spoken.
 */
export function renderGear(run: RunState): string[] {
  const hand = (itemId: string | null): string => (itemId === null ? '—' : itemDef(itemId, env).name)
  const lines = [`GEAR — [equip <n> <left|right> <x,y>] [unequip <n> <left|right>]`]
  run.partyOrder.forEach((id, i) => {
    const u = run.party[id]
    if (u === undefined) return
    lines.push(`  ${i + 1}: ${displayName(u, run)} — left ${hand(u.handLeft)} · right ${hand(u.handRight)}`)
  })
  lines.push(`  bag: ${run.bag.map((b) => `${b.x},${b.y} ${itemDef(b.itemId, env).name}${b.charges > 1 ? ` ×${b.charges}` : ''}`).join(' | ') || 'empty'}`)
  return lines
}

/**
 * The descent, drawn. Row by row, every room in its column: cleared rooms wear a tick, the company's own room is
 * marked, and the rooms that are open from here carry the row number `room <n>` takes. Under it the same "still
 * below" tally the browser's right rail prints — glyph, name and how many are left (`ui/screens/Dungeon.tsx`).
 */
export function renderChart(d: ActiveDungeon, next: readonly RoomId[]): string[] {
  const openAt = new Map(next.map((id, i) => [id, i + 1]))
  const lines = [`  the descent — ${plural(d.graph.rows.length, 'row')}, ${Object.values(d.cleared).length} of ${Object.keys(d.graph.rooms).length} rooms cleared`]
  d.graph.rows.forEach((row, i) => {
    const cells = row.map((id) => {
      const room = d.graph.rooms[id]!
      const open = openAt.get(id)
      const label = ROOM_LABEL[room.type]
      if (id === d.position) return `[${label} — here]`
      if (d.cleared[id] === true) return `${label} (cleared)`
      return open === undefined ? label : `${open}: ${label}`
    })
    lines.push(`    row ${i + 1}:  ${cells.join('  |  ')}`)
  })
  const belowRow = d.position === null ? -1 : d.graph.rooms[d.position]!.row
  const ahead = new Map<string, number>()
  for (const room of Object.values(d.graph.rooms)) {
    if (room.row <= belowRow || d.cleared[room.id] === true) continue
    ahead.set(ROOM_LABEL[room.type], (ahead.get(ROOM_LABEL[room.type]) ?? 0) + 1)
  }
  lines.push(`  still below: ${[...ahead].map(([label, n]) => `${label} ×${n}`).join(', ') || 'nothing but the way you came'}`)
  return lines
}

export function renderLines(state: GameState): string[] {
  const lines: string[] = []
  const { run, combat, screen } = state
  // A screen is a Named thing (5.1), and this printed the ROUTING FIELD: `== battleEnd ==` where the browser's
  // page is headed Field Report, `== gameOver ==` where it reads Final Entry (FINAL GATE A 1.4).
  lines.push(`\n== ${SCREEN_NAME[screen.kind]} ==`)
  if (screen.kind === 'title') {
    lines.push(run === null ? '[new <seed>] [quit]' : '[continue] [new <seed>] [quit]')
    return lines
  }
  if (run !== null && screen.kind !== 'combat') for (const l of renderRun(run)) lines.push(l)
  if (combat !== null && screen.kind === 'combat') for (const l of renderBoard(combat, run)) lines.push(l)
  if (screen.kind === 'battleEnd' && run?.lastBattle) {
    const r = run.lastBattle
    lines.push(`FIELD REPORT — ${r.outcome} in ${plural(r.rounds, 'round')}; ${r.enemiesDefeated} defeated, +${r.goldEarned} gold`)
    // `s.name` is already the name the PLAYER chose: `run/battle.ts` resolves it through `displayName` at write
    // time (CONTRACT-CHANGES 0051), so the report and the roster two lines above can no longer disagree.
    lines.push(`  survivors: ${r.survivors.map((s) => `${s.name} ${s.hp.current}/${s.hp.max}`).join(', ') || '—'}`)
    if (r.fallen.length > 0) lines.push(`  fallen: ${r.fallen.map((f) => f.name).join(', ')}`)
    if (r.loot.length > 0) lines.push(`  found: ${r.loot.map((l) => `${env.content.items[l.itemId]?.name ?? l.itemId} (${l.rarity}${l.placed ? '' : ', waiting: take/forfeit'})`).join(', ')}`)
    if (r.prisoners.length > 0) lines.push(`  prisoners: ${r.prisoners.map((p) => p.name).join(', ')}`)
    // Not a bare `[dismiss]`: with gear still waiting, `battleEnd/dismiss` is refused, and the loot line above
    // already names the two verbs that settle it.
    const m = menu(state, [{ verb: 'dismiss', action: { type: 'battleEnd/dismiss' } }])
    if (m.open !== '') lines.push(`  ${m.open}`)
    for (const l of m.shut) lines.push(l)
  }
  if (screen.kind === 'town' && run?.town) {
    const town = env.content.towns[run.town.townId]!
    const inn = innCost(town, run, env)
    const stock = shopStock(town, run, env)
    const board = tavernBoard(run, town, env)
    // The town's verbs ALL go through `menu()` now (0086 took the three parameterless ones; 0093 the rest). A
    // parameterised verb has no `isLegal` answer, so it carries the sentence its own module would refuse with:
    // an empty shelf, a purse that cannot reach the cheapest thing on it, an empty bag, an empty tavern. The
    // frame used to print `[buy <item>]` at 50 gold beside a 160g sword and `[talk <n>]` beside "quiet".
    const cheapest = stock.map(buyPrice).filter((p): p is number => p !== null).sort((a, b) => a - b)[0]
    const m = menu(state, [
      // The bill rides the VERB, exactly as the browser's button carries it ("Rest the wounded · 36 gold"); the
      // lead line quotes the price a head. The frame used to print `inn: 0 wounded × 12g = 0g` — a × b = c, the one
      // literal formula anywhere in the build, on a surface the brief forbids one on (FINAL GATE A 1.1).
      { verb: 'inn', label: inn.total > 0 ? `inn · ${inn.total} gold` : 'inn', action: { type: 'town/innHeal' } },
      { verb: 'buy <n>', action: { type: 'town/buy', itemId: '' }, reason: stock.length === 0 ? 'the shelves are bare' : cheapest !== undefined && run.gold < cheapest ? `the purse holds ${run.gold} gold` : null },
      { verb: 'sell <x,y>', action: { type: 'town/sell', x: -1, y: -1 }, reason: run.bag.length === 0 ? 'the bag is empty' : null },
      { verb: 'talk <n>', action: { type: 'town/talk', questId: '', dialogueId: '' }, reason: board.length === 0 ? 'the tavern is quiet tonight' : null },
      { verb: 'turnin <n|all>', action: { type: 'town/turnInAllPrisoners' } },
      { verb: 'leave', action: { type: 'town/leave' } },
    ])
    lines.push(`${town.name} — ${town.description}`)
    lines.push(`  inn: the innkeeper charges ${town.innHealCostPerUnit} gold a head for the wounded`)
    // The shelf by ROW. An item id was the argument of `buy <item>` (0087's exception) and a row number retires
    // that exception: nothing on the counter is addressed by anything but its place in the list (FINAL GATE C 3.7).
    // Three to a line, because a twenty-seven item shelf on one line is a wall the player has to parse by eye.
    const shelf = stock.map((i, n) => `${n + 1}: ${i.name} ${buyPrice(i)} gold`)
    lines.push(`  shop: ${shelf.length === 0 ? 'nothing on the counter' : ''}`.trimEnd())
    for (let i = 0; i < shelf.length; i += 3) lines.push('    ' + shelf.slice(i, i + 3).map((c) => c.padEnd(32)).join('').trimEnd())
    // `entrySellPrice`, not `sellPrice`: the line quotes what the shop would PAY for that stack, so a 1-of-3
    // ration and a full one no longer print the same number.
    // …and the bag by CELL, which IS `sell <x,y>`'s argument — so the cell stays and the item is NAMED, the way
    // the `gear` page two verbs away has always printed it (`renderGear`).
    lines.push(`  bag: ${run.bag.map((b) => `${b.x},${b.y} ${itemDef(b.itemId, env).name}${b.charges > 1 ? ` ×${b.charges}` : ''} (${entrySellPrice(b, env)} gold)`).join(' | ') || 'empty'}`)
    lines.push(`  tavern: ${board.map((r, i) => `${i + 1}: ${r.npcName} — ${r.npcDescription}`).join(' | ') || 'Nobody is drinking here tonight.'}`)
    // The wagon holds PEOPLE, and a prisoner row carries the name the capture wrote (GATE3-03): the desk is read
    // by name and turned in by row number, the way `talk <n>` and `choose <n>` are. It printed `brigands_0_3` and
    // made the player type it back (ARCHITECTURE §5.1, "no id ever reaches the player").
    lines.push(`  bounty: ${run.prisoners.map((p, i) => `${i + 1}: ${p.name} ${bountyFor(p, env)}g`).join(' | ') || 'No prisoners in the wagon.'}`)
    if (m.open !== '') lines.push(`  town — ${m.open}`)
    for (const l of m.shut) lines.push(l)
  }
  if (screen.kind === 'camp' && run?.camp) {
    const m = menu(state, [
      { verb: 'rest', action: { type: 'camp/rest' } },
      { verb: 'scout', action: { type: 'camp/scout' } },
      { verb: 'leave', action: { type: 'camp/leave' } },
    ])
    lines.push(`camp — ${m.open}`)
    for (const l of m.shut) lines.push(l)
    // The ration buys a REPORT, and headless it bought a bare `· scouted` and nothing else (RE-GATE C 3.9). Same
    // rows the camp card prints, in the same words (`run/scout.ts#sightingOf`).
    const seen = scoutedRoads(run, env)
    if (seen.length > 0) {
      lines.push(`  what the scouts saw — ${plural(seen.length, 'road')}`)
      for (const r of seen) lines.push(`    ${nodeOf(r.from, env).name} → ${nodeOf(r.to, env).name}: ${r.sighting.report}`)
    }
  }
  if (screen.kind === 'dungeon' && run?.activeDungeon) {
    const d = run.activeDungeon
    const here = d.position === null ? null : d.graph.rooms[d.position]
    const next = reachableRooms(run)
    // Rooms are numbered and NAMED. A `RoomId` is a grid code (`r0c1`) and §5.1 bans one in copy — and made the
    // player type it back. `ROOM_LABEL` is the chart's own word for a room (`run/dungeon.ts`, 0093).
    // `leave` carries the one-way door's sentence: the flow gate keeps that rule with `leaveDungeon`, exactly as
    // the Dungeon screen's button does, so `[leave]` is no longer offered five rooms deep (GATE3-18).
    const out = leaveDungeon(run)
    const m = menu(state, [
      { verb: 'room <n>', action: { type: 'dungeon/moveTo', roomId: '' }, reason: next.length === 0 ? 'nothing is open from here yet' : null },
      { verb: 'leave', action: { type: 'dungeon/leave' }, reason: out.ok ? null : out.reason },
    ])
    lines.push(`${env.content.dungeons[d.dungeonId]?.name ?? d.dungeonId} — ${here === undefined || here === null ? 'at the mouth' : ROOM_LABEL[here.type]}; boss ${d.bossCleared ? 'cleared' : 'ahead'}`)
    if (here === null && !d.bossCleared) lines.push(`  ${DESCENT_IS_ONE_WAY}`)
    // THE WHOLE FLOOR. The browser draws a twenty-room chart with a legend and a "still below" tally, and the
    // terminal printed one `next:` line — so the Slay-the-Spire routing decision, which is the descent's entire
    // game, was invisible headless (FINAL GATE C 3.8).
    for (const l of renderChart(d, next)) lines.push(l)
    lines.push(`  next: ${next.map((id, i) => `${i + 1}: ${ROOM_LABEL[d.graph.rooms[id]!.type]}`).join(' | ') || '—'}`)
    if (m.open !== '') lines.push(`  descent — ${m.open}`)
    for (const l of m.shut) lines.push(l)
  }
  if (screen.kind === 'overworld' && run !== null && overlayOf(state) === null) {
    // The roads are read by PLACE and walked by ROW. `roads: riverside_market (town, 1 hop)` printed the node id
    // as the whole name of the place — 0087 kept it because it was `go`'s argument, and a row number retires that
    // (FINAL GATE C 3.7). A raw node id still dispatches, for a script that logged one.
    const roads = (adjacency(run, env)[run.nodeId] ?? []).map((id, n) => {
      const p = previewPath(run, id, env)
      const hops = p === null || p === undefined ? '? hops' : plural(p.hops, 'hop')
      // …and what a ration already bought about that crossing, on the line the player chooses from (3.9).
      const sighting = sightingFor(run, run.nodeId, id)
      const seen = sighting === null ? '' : `, scouted: ${sighting.report.toLowerCase()}`
      return `${n + 1}: ${nodeOf(id, env).name} (a ${typeLabel(nodeOf(id, env).type)}, ${hops}${p?.starvationHp ? `, starve ${p.starvationHp}` : ''}${seen})`
    })
    lines.push(`roads: ${roads.join(' | ')}  [go <n>] [menu]`)
  }
  if (screen.kind === 'win' || screen.kind === 'gameOver') {
    const l = state.ledger!
    // The company name is the player's, so the run's last line carries it (`RunLedger.companyName`).
    lines.push(`${l.outcome.toUpperCase()}${l.companyName === null ? '' : ` — ${l.companyName}`} — ${plural(l.daysElapsed, 'day')}, ${plural(l.stats.hops, 'hop')}, ${plural(l.stats.battlesWon, 'battle')} won, ${l.stats.enemiesDefeated} defeated, ${l.stats.enemiesCaptured} captured, ${l.stats.unitsLost} lost, ${l.stats.goldEarned} gold, ${l.stats.gearFound} gear${l.trophyItemId === null ? '' : `, trophy ${env.content.items[l.trophyItemId]?.name ?? l.trophyItemId}`}`)
    lines.push(`  survivors: ${l.survivors.map((s) => s.name).join(', ') || '—'}  fallen: ${l.fallen.map((f) => f.name).join(', ') || '—'}  [title] [new <seed>]`)
  }
  for (const l of renderOverlay(state)) lines.push(l)
  return lines
}

function render(state: GameState): void {
  for (const l of renderLines(state)) out(l)
}

/**
 * The verb the player last typed, so a refusal can be reported the way the menu withholds one — `✗ play: no way
 * through to strike from` — instead of `REFUSED combat/playCard: noPath`, which named an ACTION TYPE the player
 * never types and a reason that was a camelCase enum member (GATE1-04, GATE3-04). Null while a pump is running,
 * which is the only time the action type is the honest label.
 */
let typedVerb: string | null = null

/** One refusal, in the CLI's one refusal voice — the same `✗ <verb>: <sentence>` shape `menu()` prints. */
export function refusalLine(verb: string | null, action: string, reason: string): string {
  return `  ✗ ${verb ?? action}: ${reason}`
}

/**
 * The display-name layer for the terminal - the one place `engine/narration.ts` gets its words from. Every
 * resolver falls back to a NEUTRAL word rather than the id, because an id that reaches a narrated line is the
 * defect this whole file was rebuilt around (ARCHITECTURE 5.1); content is validated at boot, so a miss here is
 * only reachable by a save that outlived its content.
 *
 * A unit is looked for in the battle first, then the roster, then the wagon, then the cast: `unitLost` fires as
 * the party is pruned and `prisonerTurnedIn` names somebody who is neither on a board nor in the company.
 */
function nameBook(state: GameState): NameBook {
  const run = state.run
  const combat = state.combat
  return {
    unit: (id) => {
      const fighting = combat?.units[id]
      if (fighting !== undefined) return run === null ? fighting.name : displayName(fighting, run)
      const member = run?.party[id]
      if (member !== undefined && run !== null) return displayName(member, run)
      const prisoner = run?.prisoners.find((pr) => pr.unitId === id)
      if (prisoner !== undefined) return prisoner.name
      const lost = run?.deathLog.find((d) => d.unitId === id)
      if (lost !== undefined) return lost.name
      return env.content.characters[id]?.displayName ?? 'someone'
    },
    card: (id) => env.content.cards[id]?.name ?? 'a card',
    item: (id) => env.content.items[id]?.name ?? 'something',
    place: (id) => env.content.overworld.nodes.find((n) => n.id === id)?.name ?? 'somewhere',
    quest: (id) => env.content.quests[id]?.name ?? 'a contract',
    questStage: (questId, stage) => stageLabel(questId, stage, env),
    dungeon: (id) => env.content.dungeons[id]?.name ?? 'the dark',
    room: (type) => ROOM_LABEL[type],
  }
}

/**
 * One effect, in the player's words - or nothing. The table is `engine/narration.ts`, shared with the browser's
 * battle log so the two accounts of one blow cannot drift (CONTRACT-CHANGES 0094's shape). Before it, seven
 * hand-written cases covered fifty-nine kinds and the rest printed as `${kind} ${JSON.stringify(rest)}`: forty-two
 * raw-JSON lines, seventy snake_case ids and three room grid codes over fifteen sessions (FINAL GATE A 1.5). The
 * raw stream is still one flag away, for whoever is debugging rather than playing: `--trace`.
 */
function describe(e: Effect, names: NameBook): string | null {
  const line = narrate(e, names)
  return line === null ? null : line.parts.join('')
}

// ──────────────────────────────────────────────────────────── play ──

const TILE = /^(\d+),(\d+)$/

/** Total over its argument: `-` / absent = "no tile", `x,y` = that tile, anything else = a typo the caller must
 *  report. The old parser only looked for a comma, so `1,x` reached `combat/grid` and THREW out of the REPL. */
function tileArg(s: string | undefined, allowNone: boolean): { readonly ok: true; readonly tile: TileKey | null } | { readonly ok: false } {
  if (s === undefined || s === '-') return allowNone ? { ok: true, tile: null } : { ok: false }
  const m = TILE.exec(s)
  return m === null ? { ok: false } : { ok: true, tile: `${m[1]},${m[2]}` as TileKey }
}

/** A unit by its ROW on the gear page (1-based, `run.partyOrder`) — the CLI never asks for a unit id. */
function partyRow(run: RunState | null, raw: string | undefined): string {
  const id = run === null ? undefined : run.partyOrder[Number(raw) - 1]
  if (id === undefined) throw new ArgError('which one? — the row number on the [gear] page')
  return id
}

function handSlot(raw: string | undefined): HandSlot {
  if (raw === 'left' || raw === 'right') return raw
  throw new ArgError("which hand? — 'left' or 'right'")
}

/**
 * WHO TAKES THE WHEEL. `auto` and `fight` hand the turn to a policy, and the default is the CAREFUL player —
 * the one `balance` reads every band off and the one both attrition paths are measured with (0110). Greedy is
 * still one word away (`auto greedy`), and either way the frame SAYS which player is playing before it plays.
 */
const POLICY_WORD: Readonly<Record<string, string>> = {
  careful: 'the careful hand',
  greedy: 'the greedy hand',
  random: 'a coin',
}

function policyName(raw: string | undefined): string {
  if (raw === undefined || raw === '') return 'careful'
  if (POLICIES[raw] === undefined) throw new ArgError(`auto/fight <${Object.keys(POLICIES).join('|')}> — '${raw}' is not one of them`)
  return raw
}

export const replPolicy = (raw: string | undefined): Policy => POLICIES[policyName(raw)]!

/** Every verb `toActions` understands. A line whose verb is NOT here is a typo, and a scripted run that contains
 *  one exits 1 (CLI-06) — a refusal is the game saying no, an unknown verb is the script being broken. */
const VERBS = new Set([
  'new', 'continue', 'title', 'go', 'menu', 'continue-travel', 'stay', 'town', 'inn', 'buy', 'sell', 'talk',
  'turnin', 'camp', 'rest', 'scout', 'leave', 'dungeon', 'room', 'boss', 'choose', 'next', 'dismiss', 'name',
  'take', 'forfeit', 'equip', 'unequip', 'play', 'move', 'item', 'capture', 'end', 'skip', 'auto', 'fight',
  'restart',
])

/** Verbs whose whole job is to dispatch internally; they legitimately return no action. */
const SELF_DRIVING = new Set(['auto', 'fight', 'restart'])

/** Turn a REPL line into actions. Returns [] for meta commands handled here (show/state/...). Exported so the
 *  suite can hold the ROW-and-LETTER parsers to the frame that prints them (CONTRACT-CHANGES 0139). */
export function toActions(line: string, rt: Runtime): readonly Action[] {
  const state = rt.getState()
  const run = state.run
  const [verb, ...args_] = line.trim().split(/\s+/)
  const arg = args_.join(' ')
  const overlay = overlayOf(state)
  switch (verb) {
    case 'new': return [{ type: 'meta/newRun', seed: parseSeed(args_[0], parseSeed(flag('seed'))) }]
    case 'continue': return [{ type: 'meta/continueRun' }]
    case 'title': return [{ type: 'meta/toTitle' }]
    case 'go': {
      // By ROW on the `roads:` line, the way `room <n>` and `turnin <n>` are taken; a raw node id still dispatches,
      // for a script (and for `travel --to`, which speaks in ids because it is not a player surface).
      const raw = args_[0] ?? ''
      const n = Number(raw)
      if (Number.isSafeInteger(n) && n >= 1 && run !== null) {
        const road = (adjacency(run, env)[run.nodeId] ?? [])[n - 1]
        if (road === undefined) throw new ArgError('go <n> — the row on the `roads:` line')
        return [{ type: 'travel/goTo', nodeId: road }]
      }
      return [{ type: 'travel/goTo', nodeId: raw }]
    }
    case 'menu': return run === null ? [] : [{ type: 'travel/goTo', nodeId: run.nodeId }]
    case 'continue-travel': return [{ type: 'travel/continue' }]
    case 'stay': return [{ type: 'travel/stay' }]
    case 'town': return [{ type: 'town/enter' }]
    case 'inn': return [{ type: 'town/innHeal' }]
    case 'buy': {
      // By ROW on the `shop:` line (FINAL GATE C 3.7); a raw item id still dispatches.
      const raw = args_[0] ?? ''
      const n = Number(raw)
      const town = run === null || run.town === null ? undefined : env.content.towns[run.town.townId]
      if (Number.isSafeInteger(n) && n >= 1 && run !== null && town !== undefined) {
        const item = shopStock(town, run, env)[n - 1]
        if (item === undefined) throw new ArgError('buy <n> — the row on the `shop:` line')
        return [{ type: 'town/buy', itemId: item.id }]
      }
      return [{ type: 'town/buy', itemId: raw }]
    }
    case 'sell': {
      const t = tileArg(args_[0], false)
      if (!t.ok || t.tile === null) throw new ArgError('sell <x,y> — the bag cell to sell from')
      const [x, y] = t.tile.split(',').map(Number)
      return [{ type: 'town/sell', x: x!, y: y! }]
    }
    case 'talk': {
      if (run === null || run.town === null) return []
      const row = tavernBoard(run, env.content.towns[run.town.townId]!, env)[Number(args_[0]) - 1]
      return row === undefined ? [] : [{ type: 'town/talk', questId: row.questId, dialogueId: row.dialogueId }]
    }
    case 'turnin': {
      if (args_[0] === 'all') return [{ type: 'town/turnInAllPrisoners' }]
      // By ROW, like `talk <n>` and `choose <n>`. The board prints names now, so there is no id to type back
      // (GATE3-03) — and prisoner rows are not unique by unitId anyway (`run/town.ts#turnIn`), so a row is the
      // only unambiguous way to name one.
      const row = run === null ? undefined : run.prisoners[Number(args_[0]) - 1]
      if (row === undefined) throw new ArgError('turnin <n|all> — the row on the bounty board, or all of them')
      return [{ type: 'town/turnInPrisoner', unitId: row.unitId }]
    }
    case 'camp': return [{ type: 'camp/enter' }]
    case 'rest': return [{ type: 'camp/rest' }]
    case 'scout': return [{ type: 'camp/scout' }]
    case 'leave':
      if (state.screen.kind === 'town') return [{ type: 'town/leave' }]
      if (state.screen.kind === 'camp') return [{ type: 'camp/leave' }]
      if (state.screen.kind === 'dungeon') return [{ type: 'dungeon/leave' }]
      return []
    case 'dungeon': return [{ type: 'dungeon/enter' }]
    case 'room': {
      // By ROW on the `next:` line. A RoomId is a grid code and §5.1 keeps one off the glass, so the player never
      // sees `r2c1` to type it back; a raw id is still accepted for a script that logged one.
      const raw = args_[0] ?? ''
      const n = Number(raw)
      if (Number.isSafeInteger(n) && n >= 1) {
        const roomId = run === null ? undefined : reachableRooms(run)[n - 1]
        if (roomId === undefined) throw new ArgError('room <n> — the row on the `next:` line')
        return [{ type: 'dungeon/moveTo', roomId }]
      }
      return [{ type: 'dungeon/moveTo', roomId: raw }]
    }
    case 'boss': return [{ type: 'travel/challengeBoss' }]
    case 'choose': {
      const n = Number(args_[0]) - 1
      const attempting = args_[1] ?? null
      if (overlay?.kind === 'dialogue' && run !== null) {
        const ch = visibleChoices(run, env)[n]
        return ch === undefined ? [] : [{ type: 'dialogue/choose', choiceId: ch.id, attemptingUnitId: attempting }]
      }
      if (overlay?.kind === 'checkEvent') {
        const ch = env.content.checkEvents[overlay.event.checkEventId]?.choices[n]
        return ch === undefined ? [] : [{ type: 'check/choose', choiceId: ch.id, attemptingUnitId: attempting }]
      }
      return []
    }
    case 'next': return [{ type: 'dialogue/continue' }]
    case 'dismiss':
      if (overlay?.kind === 'checkEvent') return [{ type: 'check/dismiss' }]
      if (state.screen.kind === 'battleEnd') return [{ type: 'battleEnd/dismiss' }]
      if (state.screen.kind === 'win' || state.screen.kind === 'gameOver') return [{ type: 'meta/dismissLedger' }]
      return []
    case 'name': return [{ type: 'name/submit', name: arg }]
    // The loadout, headless (GATE3-14). A unit is its ROW on the gear page and an item is its BAG CELL, so
    // neither a unit id nor an item id has to reach the player to put a looted bow in a hand.
    case 'equip': {
      const unitId = partyRow(run, args_[0])
      const slot = handSlot(args_[1])
      const t = tileArg(args_[2], false)
      if (!t.ok || t.tile === null) throw new ArgError('equip <n> <left|right> <x,y> — the bag cell to take the gear from')
      const [x, y] = t.tile.split(',').map(Number)
      const entry = run === null ? null : entryAt(run.bag, x!, y!)
      if (entry === null) throw new ArgError(`equip: nothing in the bag at ${x},${y} — [gear] lists the cells`)
      return [{ type: 'run/equip', unitId, itemId: entry.itemId, slot }]
    }
    case 'unequip': return [{ type: 'run/unequip', unitId: partyRow(run, args_[0]), slot: handSlot(args_[1]) }]
    case 'take': return [{ type: 'run/takeLoot', itemId: args_[0] ?? '' }]
    case 'forfeit': return [{ type: 'run/forfeitLoot', itemId: args_[0] ?? '' }]
    case 'play': {
      // A card is a ROW like everything else the CLI addresses (CONTRACT §10): the hand prints 1..5 and `play 1`
      // takes the first card. It was the only 0-based list in the game, beside a satchel that is now 1-based too.
      const c = state.combat
      const deck = c === null ? undefined : c.decks[c.turn.unitId]
      const n = Number(args_[0])
      if (!Number.isSafeInteger(n) || n < 1) throw new ArgError('play <n> <x,y|-> — the row on the hand, then the target tile or - for none')
      const uid = deck?.hand[n - 1]
      const t = tileArg(args_[1], true)
      if (!t.ok) throw new ArgError('play <n> <x,y|-> — the target tile, or - for none')
      return uid === undefined ? [] : [{ type: 'combat/playCard', cardUid: uid, tile: t.tile }]
    }
    case 'move': {
      const t = tileArg(args_[0], false)
      if (!t.ok || t.tile === null) throw new ArgError('move <x,y> — the tile to step to')
      return [{ type: 'combat/moveUnit', tile: t.tile }]
    }
    case 'item': {
      // By ROW on the combat frame's `bag:` line (FINAL GATE C 3.7); a raw item id still dispatches.
      const raw = args_[0] ?? ''
      const n = Number(raw)
      if (Number.isSafeInteger(n) && n >= 1 && state.combat !== null) {
        const itemId = state.combat.consumables[n - 1]
        if (itemId === undefined) throw new ArgError('item <n> — the row on the satchel line')
        return [{ type: 'combat/useItem', itemId }]
      }
      return [{ type: 'combat/useItem', itemId: raw }]
    }
    case 'capture': {
      // BY THE LETTER THE BOARD DRAWS. It took a raw unit id that is printed nowhere, so the only way to take a
      // prisoner headless was to dump `state` and read `mage_circle_2_1` out of the JSON — a whole mechanic behind
      // an id (FINAL GATE C 3.7). A raw unit id still dispatches, for a script.
      const raw = args_[0] ?? ''
      const c = state.combat
      if (c === null) return [{ type: 'combat/capture', targetId: raw }]
      const byLetter = raw.length === 1 ? unitByLetter(c, raw) : null
      if (byLetter === null && c.units[raw] === undefined) {
        throw new ArgError(`capture <letter> — the letter beside the foe on the board (${captureRows(c).map((r) => r.letter).join(', ') || 'nobody is in reach'})`)
      }
      return [{ type: 'combat/capture', targetId: byLetter ?? raw }]
    }
    case 'end': return [{ type: 'combat/endTurn' }]
    case 'skip':
      // `flow/lifecycle#skipTutorial` is a deliberate no-op without a run, so say so instead of doing nothing.
      if (run === null) throw new ArgError('skip closes the tutorial inside a RUN — a `combat --scenario tutorial` session has none')
      return [{ type: 'tutorial/skip' }]
    case 'auto': {
      // ONE party activation, played by the reference player. It ran `greedyPolicy` — a player that never drinks
      // and never holds the line — while every band in the game is measured on `carefulPolicy` (0110), so the only
      // assist the headless player was offered was the one the game is not balanced around, and it walked a lord
      // with four potions in the bag into a burn two hops from the throne (FINAL GATE C 3.9).
      const policy = replPolicy(args_[0])
      out(`  · ${POLICY_WORD[policyName(args_[0])]} takes this turn`)
      let st = state
      const active = st.combat?.turn.unitId
      for (let i = 0; i < 40 && st.combat !== null && st.combat.phase === 'combat' && st.combat.turn.unitId === active && st.combat.units[active]?.team === 'party'; i++) {
        const decision = policy(st.combat, env)
        const effects = rt.dispatch('rng' in decision ? decision.action : decision)
        if (effects.some((e) => e.kind === 'refused')) { rt.dispatch({ type: 'combat/endTurn' }); break }
        rt.drain()
        st = rt.getState()
      }
      return []
    }
    case 'fight': {
      out(`  · ${POLICY_WORD[policyName(args_[0])]} fights it out`)
      fightToTheEnd(rt, replPolicy(args_[0]))
      return []
    }
    default: return []
  }
}

/** Autobattle to the end of the battle under `policy` — the CAREFUL player unless the caller says otherwise,
 *  because that is the player every band in the game is read off (0110) and the one a headless player should be
 *  handed by default (FINAL GATE C 3.9). Breaks on a second consecutive refusal rather than trusting the iteration cap, so a policy
 *  the reducer refuses can no longer spin 400 no-ops in silence. */
function fightToTheEnd(rt: Runtime, policy: Policy = carefulPolicy): void {
  let refusalsInARow = 0
  for (let i = 0; i < 400; i++) {
    const st = rt.getState()
    if (st.combat === null || st.combat.phase !== 'combat') return
    const active = st.combat.units[st.combat.turn.unitId]
    if (active?.team === 'party') {
      const decision = policy(st.combat, env)
      const effects = rt.dispatch('rng' in decision ? decision.action : decision)
      if (effects.some((e) => e.kind === 'refused')) {
        refusalsInARow++
        const ended = rt.dispatch({ type: 'combat/endTurn' })
        if (refusalsInARow > 1 && ended.some((e) => e.kind === 'refused')) { out('  · fight: the policy and the reducer disagree — stopping'); return }
      } else refusalsInARow = 0
    }
    rt.drain()
  }
  out('  · fight: 400 iterations without an outcome — stopping')
}

const META = new Set(['show', 'state', 'effects', 'save', 'help', 'quit', 'q', 'exit', 'report', 'log', 'contracts', 'gear', 'aim'])

/** A battle seeded by `combat --scenario` has no run, and `flow/settle.ts` rule 1 is guarded by `run !== null`,
 *  so nothing resolves it: `phase` flips to victory/defeat and the session sits there forever (CLI-07). The CLI
 *  closes it itself and prints the report settle would have produced. */
function runlessReport(state: GameState): string[] | null {
  const c = state.combat
  if (c === null || c.phase === 'combat' || state.run !== null) return null
  const r = resolveBattle(c, env)
  const units = Object.values(c.units)
  const survivors = units.filter((u) => u.team === 'party' && u.hp.current > 0).map((u) => `${u.name} ${hp(u)}`)
  const lines = [
    `FIELD REPORT — ${r.outcome} in ${plural(r.rounds, 'round')}; ${r.enemiesDefeated} defeated, +${r.goldEarned} gold`,
    `  survivors: ${survivors.join(', ') || '—'}`,
  ]
  if (r.fallen.length > 0) lines.push(`  fallen: ${r.fallen.map((f) => f.name).join(', ')}`)
  if (r.capturedEnemies.length > 0) lines.push(`  prisoners: ${r.capturedEnemies.map((p) => p.name).join(', ')}`)
  lines.push('  (no run: nothing is paid out — [restart] re-seeds the scenario, [quit] leaves)')
  return lines
}

async function play(scenarioSpec: BattleSpec | null): Promise<void> {
  const seed = parseSeed(flag('seed'))
  let initial = flag('screen') === undefined ? initialState() : fixtureFor(parseScreen(flag('screen'), 'title'), seed, env)
  const savePath = flag('save')
  if (savePath !== undefined && !has('fresh')) {
    try {
      const parsed = parseSave(readFileSync(savePath, 'utf8'), env)
      if (parsed.ok) { initial = { ...initialState(), meta: parsed.value.meta, run: parsed.value.run, combat: parsed.value.combat } }
      else out(`(save not loaded: ${parsed.reason} ${parsed.detail})`)
    } catch { /* no save yet */ }
  }
  const rt = createRuntime({ env, initial, log: true, onError: (e) => out(`ERROR ${String(e)}`) })
  let lastEffects: readonly Effect[] = []
  let refusals = 0
  /** Unknown verbs and malformed arguments — the SCRIPT is broken, so `--cmds` exits 1 (CLI-06). */
  let broken = 0
  // The dead are still named. A killing blow's batch carries `unitHit`, `unitDied`, `battleEnded` AND the settle
  // that nulls `state.combat`, so a name book built from the state the listener sees cannot find the unit any of
  // those three lines is about — the battle's last three sentences read "someone". Every unit that has stood on a
  // board this session is remembered by the name it wore there.
  const remembered = new Map<string, string>()
  const namesNow = (): NameBook => {
    const state = rt.getState()
    const base = nameBook(state)
    for (const u of Object.values(state.combat?.units ?? {})) remembered.set(u.id, base.unit(u.id))
    return { ...base, unit: (id) => remembered.get(id) ?? base.unit(id) }
  }
  rt.onEffects((effects) => {
    lastEffects = effects
    const names = namesNow()
    for (const e of effects) {
      // The raw stream, for whoever is debugging rather than playing — the `simulate --trace` shape, on stderr, so
      // a scripted transcript stays prose (FINAL GATE A 1.5: the effect echo was the developer's trace ALL the time).
      if (has('trace')) process.stderr.write(`    ${e.kind} ${JSON.stringify(e)}\n`)
      if (e.kind === 'refused') { refusals++; out(refusalLine(typedVerb, e.action, e.reason)); continue }
      const d = describe(e, names)
      if (d !== null) out(`  · ${d}`)
    }
  })
  if (scenarioSpec !== null) { rt.dispatch({ type: 'dev/startBattle', spec: scenarioSpec }); rt.drain() }
  render(rt.getState())

  /** True once a run-less battle has been closed by `runlessReport`; cleared by `restart`. */
  let battleClosed = false
  const closeRunlessBattle = (): boolean => {
    if (battleClosed) return false
    const lines = runlessReport(rt.getState())
    if (lines === null) return false
    battleClosed = true
    for (const l of lines) out(l)
    return true
  }
  closeRunlessBattle()

  const handle = (line: string): boolean => {
    const trimmed = line.trim()
    if (trimmed === '') return true
    const verb = trimmed.split(/\s+/)[0]!
    typedVerb = verb
    try {
      if (META.has(verb)) {
        switch (verb) {
          case 'show': render(rt.getState()); break
          // Two read-only pages the headless game had no way to open at all (GATE3-14).
          case 'contracts': { const r = rt.getState().run; if (r === null) out('no run — [new <seed>] starts one'); else for (const l of renderContracts(r)) out(l); break }
          case 'gear': { const r = rt.getState().run; if (r === null) out('no run — [new <seed>] starts one'); else for (const l of renderGear(r)) out(l); break }
          // The third read-only page: what a card would DO, before the AP is spent (FINAL GATE C 3.8).
          case 'aim': {
            const parts = trimmed.split(/\s+/)
            const t = tileArg(parts[2], true)
            if (!t.ok) throw new ArgError('aim <n> [x,y] — the tile to weigh the play against')
            for (const l of renderAim(rt.getState(), Number(parts[1]), t.tile)) out(l)
            break
          }
          case 'state': out(JSON.stringify(rt.getState(), null, 1)); break
          case 'effects': out(JSON.stringify(lastEffects, null, 1)); break
          // The envelope, not a bare array: `replay` needs the state the log started from (CLI-08).
          case 'log': out(JSON.stringify({ initial, actions: rt.actions })); break
          case 'report': out(JSON.stringify(rt.getState().run?.lastBattle ?? null, null, 1)); break
          case 'save': writeFileSync(trimmed.split(/\s+/)[1] ?? savePath ?? 'embermarch-save.json', serialize(toSaveFile(rt.getState(), env))); out('saved'); break
          case 'help': out('new <seed> · continue · title · go <n> · menu · continue-travel · stay · town · inn · buy <n> · sell <x,y> · talk <n> · turnin <n|all> · camp · rest · scout · leave · dungeon · room <n> · boss · choose <n> [unit] · next · dismiss · name <text> · take/forfeit <item> · gear · equip <n> <left|right> <x,y> · unequip <n> <left|right> · contracts · aim <n> [x,y] · play <n> <x,y|-> · move <x,y> · item <n> · capture <letter> · end · auto [careful|greedy] · fight [careful|greedy] · restart · skip · show · state · effects · log · report · save [file] · quit'); break
          default: return false
        }
        return true
      }
      if (!VERBS.has(verb)) {
        broken++
        out(`? unknown command '${verb}' — type help`)
        return true
      }
      if (verb === 'restart') {
        if (scenarioSpec === null) { out('? restart only applies to a `combat --scenario` session'); return true }
        battleClosed = false
        rt.dispatch({ type: 'dev/startBattle', spec: scenarioSpec })
        rt.drain()
        render(rt.getState())
        return true
      }
      if (battleClosed) {
        out('? the battle is over — [restart] re-seeds the scenario, [show] / [state] read it, [quit] leaves')
        return true
      }
      const actions = toActions(trimmed, rt)
      if (actions.length === 0 && !SELF_DRIVING.has(verb)) { refusals++; out(`? ${trimmed} — nothing to do here`) }
      for (const a of actions) rt.dispatch(a)
      rt.drain()
      if (!closeRunlessBattle()) render(rt.getState())
    } catch (e) {
      // No engine throw and no fs error may end an interactive session (CLI-03).
      // A mistyped ARGUMENT to a known verb is the same class as a refusal — the player is told and the session
      // lives on (CLI-03). Only an unknown VERB means the script itself is broken (CLI-06).
      if (e instanceof ArgError) { refusals++; out(`? ${e.message}`) }
      else out(`ERROR ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      typedVerb = null
    }
    return true
  }

  const scripted = flag('cmds')
  if (scripted !== undefined) {
    for (const line of scripted.split(';')) if (!handle(line)) break
    // The summaries go BEFORE `--json`, so the machine-readable payload stays the last line of the transcript.
    if (refusals > 0) out(`${refusals} command(s) refused`)
    if (broken > 0) { out(`${broken} broken command(s) — unknown verb or malformed argument`); process.exitCode = 1 }
    if (has('json')) out(JSON.stringify({ screen: rt.getState().screen.kind, run: rt.getState().run && { nodeId: rt.getState().run!.nodeId, day: rt.getState().run!.daysElapsed, gold: rt.getState().run!.gold }, combat: rt.getState().combat && { phase: rt.getState().combat!.phase, round: rt.getState().combat!.turn.round } }))
    return
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY === true })
  rl.setPrompt('> ')
  rl.prompt()
  for await (const line of rl) {
    if (!handle(line)) break
    rl.prompt()
  }
}

// ────────────────────────────────────────────────────────── driving ──

/** Where an automatic drive came to rest. */
type Rest = 'quiescent' | 'atNode' | 'battleEnd' | 'over' | 'stuck'

/** Answer whatever suspender is open with its first enabled option. Returns false for the quick menu (the caller
 *  owns the map decision) and when nothing is answerable. */
function autoAnswer(rt: Runtime): boolean {
  const state = rt.getState()
  const run = state.run
  const overlay = overlayOf(state)
  if (overlay === null || run === null) return false
  switch (overlay.kind) {
    case 'namePrompt':
      rt.dispatch({ type: 'name/submit', name: overlay.prompt.target === 'mc' ? 'Ash' : 'The Company' })
      return true
    case 'checkEvent': {
      if (overlay.event.result !== null) { rt.dispatch({ type: 'check/dismiss' }); return true }
      const choice = env.content.checkEvents[overlay.event.checkEventId]?.choices[0]
      if (choice === undefined) return false
      rt.dispatch({ type: 'check/choose', choiceId: choice.id, attemptingUnitId: null })
      return true
    }
    case 'dialogue': {
      const enabled = visibleChoices(run, env).filter((c) => c.enabled)
      if (enabled.length > 0) rt.dispatch({ type: 'dialogue/choose', choiceId: enabled[0]!.id, attemptingUnitId: null })
      else rt.dispatch({ type: 'dialogue/continue' })
      return true
    }
    case 'tutorial':
      if (state.screen.kind === 'combat') { rt.dispatch({ type: 'tutorial/skip' }); return true }
      return false
    case 'quickMenu':
      return false
  }
}

/** Drive the run to the next thing a player would decide: a node's quick menu, a field report (when the caller
 *  wants to stop there), a terminal screen, or quiescence. Battles are fought by `opts.policy`, and the default is
 *  the careful player the bands are measured on. */
function drive(rt: Runtime, opts: { readonly stopAfterBattle: boolean; readonly policy?: Policy }): Rest {
  for (let guard = 0; guard < 500; guard++) {
    rt.drain()
    const state = rt.getState()
    const screen = state.screen.kind
    if (screen === 'win' || screen === 'gameOver' || screen === 'title') return 'over'
    if (screen === 'combat' && state.combat !== null && state.combat.phase === 'combat') { fightToTheEnd(rt, opts.policy ?? carefulPolicy); continue }
    if (screen === 'battleEnd' && state.run !== null) {
      for (const l of renderOverlay(state)) out(l)
      const report = state.run.lastBattle
      if (report !== null) {
        out(`  encounter — ${report.outcome} in ${plural(report.rounds, 'round')}; ${report.enemiesDefeated} defeated, +${report.goldEarned} gold${report.fallen.length > 0 ? `; fallen ${report.fallen.map((f) => f.name).join(', ')}` : ''}`)
      }
      for (const itemId of state.run.pendingLoot) {
        const taken = rt.dispatch({ type: 'run/takeLoot', itemId })
        if (taken.some((e) => e.kind === 'refused')) rt.dispatch({ type: 'run/forfeitLoot', itemId })
      }
      rt.dispatch({ type: 'battleEnd/dismiss' })
      if (opts.stopAfterBattle) return 'battleEnd'
      continue
    }
    if (autoAnswer(rt)) continue
    if (overlayOf(state)?.kind === 'quickMenu') return 'atNode'
    if (isQuiescent(state)) return 'quiescent'
    return 'stuck'
  }
  return 'stuck'
}

/** `travel --to <node>` — its own driver, not a fixed `--cmds` script. The old script advanced the prologue with
 *  `next`, but every prologue node carries a Continue CHOICE, so all six were refused and the session died inside
 *  the prologue while exiting 0 (CLI-02). */
function travel(): void {
  const to = flag('to')
  if (to === undefined) throw new ArgError('travel needs --to <node>')
  if (!env.content.overworld.nodes.some((n) => n.id === to)) {
    throw new ArgError(`unknown node '${to}' — one of ${env.content.overworld.nodes.map((n) => n.id).join(', ')}`)
  }
  const seed = parseSeed(flag('seed'))
  const auto = has('auto')
  const rt = createRuntime({ env, initial: initialState(), log: true, onError: (e) => out(`ERROR ${String(e)}`) })
  let lastNode: string | null = null
  let lastDay = -1
  rt.subscribe((state) => {
    const run = state.run
    if (run === null) return
    if (run.nodeId === lastNode && run.daysElapsed === lastDay) return
    if (lastNode !== null) {
      const party = livingUnits(run).map((u) => `${displayName(u, run)} ${hp(u)}`).join(', ')
      out(`day ${run.daysElapsed} · at ${nodeOf(run.nodeId, env).name} · food ${foodCount(run.bag, env)} · ${party}`)
    }
    lastNode = run.nodeId
    lastDay = run.daysElapsed
  })

  rt.dispatch({ type: 'meta/newRun', seed })
  // The auto-driver plays the REFERENCE player, the one every band is read off (0110) — a journey narrated by a
  // policy that never once holds the line is not the journey the gate measures.
  drive(rt, { stopAfterBattle: false, policy: carefulPolicy })   // tutorial + prologue: always cleared automatically
  const start = rt.getState().run
  if (start === null) { out('the run ended before it began'); process.exitCode = 1; return }
  out(`departing ${nodeOf(start.nodeId, env).name} for ${nodeOf(to, env).name}${auto ? ' (auto: fighting through)' : ''}`)

  const goEffects = rt.dispatch({ type: 'travel/goTo', nodeId: to })
  const refused = goEffects.find((e) => e.kind === 'refused')
  if (refused !== undefined) { out(`travel refused: ${refused.reason}`); process.exitCode = 1; return }

  for (let guard = 0; guard < 200; guard++) {
    const rest = drive(rt, { stopAfterBattle: !auto, policy: carefulPolicy })
    const state = rt.getState()
    const run = state.run
    if (run === null || rest === 'over') { out('the run ended on the road'); render(rt.getState()); break }
    if (run.nodeId === to && (run.pendingTravel === null || run.pendingTravel.path.length === 0)) break
    if (rest === 'battleEnd') { out('stopped after an encounter — re-run with --auto to fight through'); break }
    if (rest === 'atNode') { rt.dispatch({ type: 'travel/continue' }); continue }
    if (rest === 'quiescent') break
    out('the journey stalled'); process.exitCode = 1; break
  }

  const end = rt.getState().run
  if (end === null) return
  out(end.nodeId === to
    ? `arrived at ${nodeOf(to, env).name} on day ${end.daysElapsed} with ${foodCount(end.bag, env)} food`
    : `stopped at ${nodeOf(end.nodeId, env).name} on day ${end.daysElapsed} (${nodeOf(to, env).name} not reached)`)
}

// ──────────────────────────────────────────────────────── attrition ──

/**
 * ATTRITION (GATE3-15, GATE3-17). `stub` and `boss` both seed a FRESH, FULL-HP party from `seedNewRun`, so the
 * balance gate measured single fights and never the thing that actually kills a run: a PATH. A dungeon is a
 * committed descent — `run/dungeon.ts#leaveDungeon` is legal only at the entrance or after the boss — and every
 * room after the first is entered on whatever HP the last one left; a road leg burns one ration per hop and rolls
 * an encounter on most of them. Neither is visible in a win rate taken over full-HP battles.
 *
 * So these two scenarios drive the SHIPPED reducer (`createRuntime` + `drive`, the driver `travel --auto` uses)
 * rather than `combat/sim.ts#sweep`, which is battle-shaped by construction and lives behind the `combat/*` import
 * fence (CONTRACT §6: it may not see a `RunState`). The policy is a CAREFUL player, stated here so the number can
 * be read: inside a dungeon, take the free rest whenever anyone is hurt and otherwise the least dangerous room;
 * on the road, camp when hurt, and at every town heal the wounded at the inn, keep `TRAVEL_LARDER` hops of
 * rations and spend what is left on the best like-for-like gear the shelf offers. A band on these rows is a band
 * on the shipped difficulty of a ROUTE.
 */
/** Every battle on a measured PATH is fought by the careful player the row's own header names, never by the
 *  greedy one the battle rows use. */
const CAREFUL = { stopAfterBattle: false, policy: carefulPolicy } as const

export interface AttritionResult {
  /** `cleared` = the dungeon boss fell / the destination was reached; `wiped` = the run ended on the way. */
  readonly outcome: 'cleared' | 'wiped' | 'stalled'
  /** Rooms entered / hops walked. */
  readonly steps: number
  readonly fights: number
  /** Party HP ÷ party max at the end, the dead counted at 0 — the pressure reading a full-HP sweep cannot take. */
  readonly endHpFraction: number
  /** The lowest that reading ever fell to, measured at every step boundary. */
  readonly lowWaterHpFraction: number
  readonly deaths: number
  /** Hops taken with an empty larder (each costs every living unit `rules.travel.starvationDamage`). */
  readonly starvingSteps: number
  /** Rations left at the end (a descent burns none of its own: `rules.dungeon.restFoodCost` is 0). */
  readonly foodLeft: number
  readonly goldLeft: number
}

const partyHpFraction = (run: RunState): number => {
  const units = Object.values(run.party)
  const max = units.reduce((n, u) => n + u.hp.max, 0)
  return max === 0 ? 0 : units.reduce((n, u) => n + Math.max(0, u.hp.current), 0) / max
}

/** `simulate --scenario attrition:… --trace` prints one of these per step: the whole point of a path measurement
 *  is being able to read WHERE it went wrong, and a table of means cannot say that. */
export type AttritionTrace = (line: string) => void

/** A run past the tutorial and the prologue, on the map — where every attrition scenario starts. */
function attritionRuntime(seed: number, env: EngineEnv, trace?: AttritionTrace): Runtime {
  const rt = createRuntime({ env, initial: initialState({ tutorialSeen: true, gameStarted: true }), log: false })
  rt.dispatch({ type: 'meta/newRun', seed })
  drive(rt, CAREFUL)
  if (trace !== undefined) {
    rt.onEffects((effects) => {
      for (const e of effects) {
        if (e.kind === 'battleStarted') trace(`    fight ${e.battleId}`)
        if (e.kind === 'battleVictory' || e.kind === 'battleDefeat') trace(`    → ${e.kind}`)
      }
    })
    let last = ''
    rt.subscribe((state) => {
      const r = state.run
      if (r === null) return
      const key = `${r.nodeId}:${r.activeDungeon?.position ?? '-'}:${r.daysElapsed}`
      if (key === last) return
      last = key
      const where = r.activeDungeon === null ? nodeOf(r.nodeId, env).name : `${r.activeDungeon.dungeonId} ${r.activeDungeon.position ?? 'entrance'} (${r.activeDungeon.graph.rooms[r.activeDungeon.position ?? '']?.type ?? 'start'})`
      trace(`  day ${r.daysElapsed} ${where}  gold ${r.gold} food ${foodCount(r.bag, env)}  ${livingUnits(r).map((u) => `${u.id} ${hp(u)} [${u.handLeft ?? '-'}|${u.handRight ?? '-'}]`).join('  ')}`)
    })
  }
  return rt
}

/** Least dangerous first, and always the free heal when anyone is hurt — a rest on a whole party mends nothing
 *  (`healParty` no-ops), so an unhurt party ranks it last and takes the loot instead. */
function pickRoom(run: RunState, ids: readonly RoomId[]): RoomId {
  const d = run.activeDungeon
  if (d === null) return ids[0]!
  const hurt = partyHpFraction(run) < 1
  const rank = (id: RoomId): number => {
    switch (d.graph.rooms[id]?.type) {
      case 'rest': return hurt ? 0 : 4
      case 'treasure': return 1
      case 'event': return 2
      case 'combat': return 3
      case 'elite': return 5
      default: return 6
    }
  }
  return [...ids].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1))[0]!
}

/** Counters only the EFFECT stream can supply: a wipe nulls the run, so `deathLog` is gone by the time the driver
 *  looks, and `starvation` is emitted by the hop executor rather than stored anywhere. */
interface Tally { fights: number; deaths: number; starving: number }
function tally(rt: Runtime): Tally {
  const t: Tally = { fights: 0, deaths: 0, starving: 0 }
  rt.onEffects((effects) => {
    for (const e of effects) {
      if (e.kind === 'battleStarted') t.fights++
      if (e.kind === 'unitLost') t.deaths++
      if (e.kind === 'starvation') t.starving++
    }
  })
  return t
}

const result = (outcome: AttritionResult['outcome'], run: RunState | null, steps: number, low: number, t: Tally, env: EngineEnv): AttritionResult => ({
  outcome,
  steps,
  fights: t.fights,
  endHpFraction: run === null ? 0 : partyHpFraction(run),
  lowWaterHpFraction: run === null ? 0 : low,
  deaths: t.deaths,
  starvingSteps: t.starving,
  foodLeft: run === null ? 0 : foodCount(run.bag, env),
  goldLeft: run?.gold ?? 0,
})

/** One descent of `dungeonId`, entered at full strength and fought room to room until the boss falls or the run does. */
export function attritionDungeon(dungeonId: string, seed: number, env: EngineEnv, trace?: AttritionTrace): AttritionResult {
  return quietly(() => descend(dungeonId, seed, env, trace))
}

function descend(dungeonId: string, seed: number, env: EngineEnv, trace?: AttritionTrace): AttritionResult {
  const rt = attritionRuntime(seed, env, trace)
  const t = tally(rt)
  rt.dispatch({ type: 'quest/applyEffects', effects: [{ kind: 'unlockNode', ref: { mapKind: 'overworld', mapId: 'world', nodeId: dungeonId } }] })
  rt.dispatch({ type: 'dev/teleport', nodeId: dungeonId })
  rt.dispatch({ type: 'travel/goTo', nodeId: dungeonId })   // the node's own menu: `dungeon/enter` is legal only there
  const entered = rt.dispatch({ type: 'dungeon/enter' })
  const no = entered.find((e) => e.kind === 'refused')
  if (no !== undefined && no.kind === 'refused') throw new ArgError(`attrition: cannot enter '${dungeonId}' — ${no.reason}`)
  rt.drain()

  let steps = 0
  let low = 1
  for (let guard = 0; guard < 64; guard++) {
    const run = rt.getState().run
    if (run === null) return result('wiped', null, steps, low, t, env)
    low = Math.min(low, partyHpFraction(run))
    const d = run.activeDungeon
    if (d === null || d.bossCleared) return result('cleared', run, steps, low, t, env)
    const next = reachableRooms(run)
    if (next.length === 0) break
    const roomId = pickRoom(run, next)
    rt.dispatch({ type: 'dungeon/moveTo', roomId })
    steps++
    drive(rt, CAREFUL)
    upgradeGear(rt)
  }
  const run = rt.getState().run
  return result(run === null ? 'wiped' : 'stalled', run, steps, low, t, env)
}

/** A careful player wears what the road gives him. Only a LIKE-FOR-LIKE upgrade is taken — same `weaponClass`,
 *  better rarity — because that is the one swap that cannot backfire: a card's damage is `base + STAT`, so handing
 *  the lord a tome would read as an upgrade and halve his output. Refusals (a two-handed lock, a full bag) are the
 *  engine's answer and are simply skipped.
 */
const RARITY_RANK: Readonly<Record<string, number>> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 }
/**
 * LIKE-FOR-LIKE is the same `weaponClass`, nothing wider. A "physical family" that let a sword be swapped for any
 * other STR weapon was measured doing the opposite of what it promised: rarity is a PRICE, not a power, so the
 * policy handed the lord an uncommon `bone_dagger` (3 cards, 5/3/7 base) over his common `iron_sword` (4 cards,
 * 4/8 base plus Guard Break and Riposte) and a `composite_bow` over a blade, then walked that party into a tier-3
 * pack — five of the eighteen road wipes of the last gate were fought with gear the policy had downgraded
 * (GATE3-15). Inside one class the shelf IS a ladder (iron → steel → serpent), so this comparison is sound.
 */
const sameFamily = (a: string | undefined, b: string | undefined): boolean => a !== undefined && a === b
function upgradeGear(rt: Runtime): void {
  const run = rt.getState().run
  if (run === null) return
  for (const unit of Object.values(run.party)) {
    for (const slot of ['left', 'right'] as const) {
      const held = slot === 'left' ? unit.handLeft : unit.handRight
      if (held === null) continue
      const current = env.content.items[held]
      if (current === undefined) continue
      let best = current
      for (const entry of rt.getState().run?.bag ?? []) {
        const item = env.content.items[entry.itemId]
        if (item === undefined || !sameFamily(item.weaponClass, current.weaponClass)) continue
        if ((RARITY_RANK[item.rarity] ?? 0) > (RARITY_RANK[best.rarity] ?? 0)) best = item
      }
      if (best !== current) rt.dispatch({ type: 'run/equip', unitId: unit.id, itemId: best.id, slot })
    }
  }
  rt.drain()
}

/** Hops of food a careful player refuses to leave a market without. Two full rations: the road between the last
 *  two towns of the shipped sheet is seven hops, and a larder of six walked the company off the end of it — the
 *  starving hops the gate counted were the POLICY's, not the economy's. */
const TRAVEL_LARDER = 8

/** What a town sells against attrition, in the order a careful player buys it: a bed for the wounded, then rations
 *  for the hops still ahead, then the best like-for-like weapon upgrade the purse can still afford. The third one
 *  is not a luxury — gear IS the party's level curve (there is no XP: `run/difficulty.ts`), so a party that never
 *  shops meets tier-3 packs with the iron it started the run in. */
function provision(rt: Runtime, hopsAhead: number): void {
  const enter = rt.dispatch({ type: 'town/enter' })
  if (enter.some((e) => e.kind === 'refused')) return
  rt.drain()
  rt.dispatch({ type: 'town/innHeal' })
  // A week of food, not a month: buying the WHOLE journey's rations at the first market spends the purse that
  // buys the first steel weapon, and there are more towns on the way. `TRAVEL_LARDER` is the reserve a careful
  // player keeps between towns, and the gold it will cost is held back from the armoury — gear is bought FIRST
  // out of what is left over, because a weapon bought two towns later is a weapon that missed both wars.
  const want = Math.min(hopsAhead, TRAVEL_LARDER)
  const ration = env.content.items['food_rations']
  const perHop = ration === undefined ? 0 : Math.ceil((ration.buyPrice ?? 0) / (ration.charges ?? 1))
  const held = foodCount(rt.getState().run?.bag ?? [], env)
  shopForGear(rt, Math.max(0, want - held) * perHop)
  for (let i = 0; i < 8; i++) {
    const run = rt.getState().run
    if (run === null || foodCount(run.bag, env) >= want) break
    if (rt.dispatch({ type: 'town/buy', itemId: 'food_rations' }).some((e) => e.kind === 'refused')) break
  }
  rt.dispatch({ type: 'town/leave' })
  rt.drain()
}

/** One pass over the party: for every filled hand, the best same-`weaponClass` item on the shelf that beats what
 *  is held and that the purse can cover. Bought, then equipped by `upgradeGear`. */
function shopForGear(rt: Runtime, foodReserve: number): void {
  const state = rt.getState()
  const run = state.run
  const town = run === null || run.town === null ? undefined : env.content.towns[run.town.townId]
  if (run === null || town === undefined || town === null) return
  const stock = shopStock(town, run, env)
  for (const unit of Object.values(run.party)) {
    for (const held of [unit.handLeft, unit.handRight]) {
      const current = held === null ? undefined : env.content.items[held]
      if (current === undefined) continue
      const now = rt.getState().run
      if (now === null) return
      const better = stock
        .filter((i) => sameFamily(i.weaponClass, current.weaponClass) && (RARITY_RANK[i.rarity] ?? 0) > (RARITY_RANK[current.rarity] ?? 0))
        .filter((i) => (buyPrice(i) ?? Infinity) <= now.gold - foodReserve)
        .sort((a, b) => (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0))[0]
      if (better !== undefined) rt.dispatch({ type: 'town/buy', itemId: better.id })
    }
  }
  upgradeGear(rt)
}

/** The road's own heal valve: a camp mends `rules.camp.restHealFraction` of every unit for one ration, once per
 *  visit. A careful player spends it whenever someone is hurt and the larder can still cover the next hop. */
function campRest(rt: Runtime): void {
  const run = rt.getState().run
  if (run === null || foodCount(run.bag, env) < 2) return
  if (rt.dispatch({ type: 'camp/enter' }).some((e) => e.kind === 'refused')) return
  rt.drain()
  rt.dispatch({ type: 'camp/rest' })   // refused (with its reason) when nobody is wounded — CONTRACT-CHANGES 0052
  rt.dispatch({ type: 'camp/leave' })
  rt.drain()
}

/** One journey from the start hub to `to`, fighting what the road rolls, camping when hurt and resupplying at towns. */
export function attritionRoad(to: string, seed: number, env: EngineEnv, trace?: AttritionTrace): AttritionResult {
  return quietly(() => march(to, seed, env, trace))
}

function march(to: string, seed: number, env: EngineEnv, trace?: AttritionTrace): AttritionResult {
  const rt = attritionRuntime(seed, env, trace)
  const t = tally(rt)
  const goEffects = rt.dispatch({ type: 'travel/goTo', nodeId: to })
  const no = goEffects.find((e) => e.kind === 'refused')
  if (no !== undefined && no.kind === 'refused') throw new ArgError(`attrition: cannot travel to '${to}' — ${no.reason}`)

  let steps = 0
  let low = 1
  for (let guard = 0; guard < 200; guard++) {
    const rest = drive(rt, CAREFUL)
    const run = rt.getState().run
    if (run === null || rest === 'over') return result('wiped', null, steps, low, t, env)
    low = Math.min(low, partyHpFraction(run))
    steps = run.daysElapsed - env.rules.economy.startDay
    if (run.nodeId === to && (run.pendingTravel === null || run.pendingTravel.path.length === 0)) return result('cleared', run, steps, low, t, env)
    if (rest === 'atNode') {
      // `town/leave` / `camp/leave` return to the map with `pendingTravel.status` still 'atNode', so the quick menu
      // — and with it `travel/continue` — comes back on its own. Re-issuing `travel/goTo` here would start a NEW
      // journey to the node the party is standing on and strand the leg at "this is the end of the road".
      const type = nodeOf(run.nodeId, env).type
      if (type === 'TOWN') provision(rt, run.pendingTravel?.path.length ?? 0)
      else if (type === 'CAMP') campRest(rt)
      upgradeGear(rt)
      rt.dispatch({ type: 'travel/continue' })
      continue
    }
    if (rest !== 'battleEnd') break
  }
  const run = rt.getState().run
  return result(run === null ? 'wiped' : 'stalled', run, steps, low, t, env)
}

/** One row per attrition label — the same shape `SweepRow` has for battles, taken over PATHS. */
export interface AttritionRow {
  readonly label: string
  readonly runs: number
  readonly clearRate: number
  readonly wipes: number
  readonly meanSteps: number
  readonly meanFights: number
  /** Over the CLEARED paths only: a wipe's 0 would drag the pressure reading down twice. */
  readonly meanEndHpFraction: number | null
  readonly worstEndHpFraction: number | null
  readonly meanLowWaterHpFraction: number
  readonly deaths: number
  readonly starvingSteps: number
  readonly meanFoodLeft: number | null
}

export function attritionSweep(label: string, seeds: readonly number[], run: (seed: number) => AttritionResult): AttritionRow {
  const results = seeds.map(run)
  const cleared = results.filter((r) => r.outcome === 'cleared')
  const avg = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length)
  const food = cleared.map((r) => r.foodLeft)
  return {
    label,
    runs: results.length,
    clearRate: results.length === 0 ? 0 : cleared.length / results.length,
    wipes: results.filter((r) => r.outcome === 'wiped').length,
    meanSteps: avg(results.map((r) => r.steps)),
    meanFights: avg(results.map((r) => r.fights)),
    meanEndHpFraction: cleared.length === 0 ? null : avg(cleared.map((r) => r.endHpFraction)),
    worstEndHpFraction: cleared.length === 0 ? null : Math.min(...cleared.map((r) => r.endHpFraction)),
    meanLowWaterHpFraction: avg(results.map((r) => r.lowWaterHpFraction)),
    deaths: results.reduce((n, r) => n + r.deaths, 0),
    starvingSteps: results.reduce((n, r) => n + r.starvingSteps, 0),
    meanFoodLeft: food.length === 0 ? null : avg(food),
  }
}

// ──────────────────────────────────────────────────────── scenarios ──

const SCENARIOS: readonly string[] = ['stub', 'boss', 'tutorial']

/**
 * The `boss` scenario's late-run company (`rules.balance.bossWithEpicWin` — "boss with EPIC"): the seeded party
 * at the level the run actually hands it, re-equipped from the epic/legendary pool. It used to be lifted to a
 * `rules.difficulty.bossPartyLevel` of 6 instead, which measured a party the game cannot produce — there is no XP
 * and no level-up anywhere in the engine (`run/difficulty.ts` header) — while leaving the COMMON iron kit on,
 * i.e. the band named "with epic" was carried entirely by five invented levels (BAL-03).
 *
 * The mage keeps her common `fire_tome`: no epic or legendary tome exists in `items.json`, so a third of the
 * party's damage sits at starting power in every "fully geared" measurement here (BAL-14 — author one and this
 * table gets its third row).
 */
const BOSS_LOADOUT: Readonly<Record<string, { readonly handLeft: string | null; readonly handRight: string | null }>> = {
  lord: { handLeft: 'excalibur', handRight: null },
  shield_knight: { handLeft: 'flame_blade', handRight: 'paladins_aegis' },
}

/** This table writes hands DIRECTLY (it is a measurement fixture, not a player action), so it is the one place in
 *  the build that can put gear in a hand `run/equipment.ts#canHold` would refuse — and a band read off a party the
 *  game cannot legally field is not a band. Checked once, at the moment the fixture is built (0121). */
function assertTrained(classId: string, itemId: string | null): void {
  if (itemId === null) return
  const item = env.content.items[itemId]
  if (item === undefined) throw new ArgError(`boss loadout names unknown item '${itemId}'`)
  const held = canHold(classId, item, env)
  if (!held.ok) throw new ArgError(`boss loadout puts ${item.name} in a ${classId}'s hand, and ${held.reason}`)
}

function scenarioSpec(name: string, seed: number): BattleSpec {
  if (!SCENARIOS.includes(name) && !name.startsWith('group:') && !name.startsWith('dungeon:')) {
    throw new ArgError(`unknown scenario '${name}' — one of ${SCENARIOS.join(', ')}, group:<id>:<level>, dungeon:<id>:<room>`)
  }
  const run = seedNewRun(seed, env)
  const boss = env.content.overworld.nodes.find((n) => n.type === 'BOSS')!
  if (name === 'tutorial') return battleSpecFor(run, { origin: { kind: 'tutorial' }, enemies: { kind: 'authored', units: [] }, captureTargets: [] }, env)
  if (name === 'boss') {
    for (const [classId, hands] of Object.entries(BOSS_LOADOUT)) { assertTrained(classId, hands.handLeft); assertTrained(classId, hands.handRight) }
    const geared = Object.fromEntries(Object.values(run.party).map((u) => [u.id, { ...u, ...(BOSS_LOADOUT[u.classId] ?? {}) }]))
    return battleSpecFor({ ...run, party: geared, nodeId: boss.id }, { origin: { kind: 'finalBoss', nodeId: boss.id }, enemies: { kind: 'group', enemyGroupId: boss.enemyGroupId!, level: env.rules.difficulty.bossLevel }, captureTargets: [] }, env)
  }
  let groupId = 'bandits_small'
  let level = 1
  if (name.startsWith('group:')) {
    const [, g, l] = name.split(':')
    groupId = g ?? groupId
    level = parseSeed(l, 1)
  } else if (name.startsWith('dungeon:')) {
    const [, d, room] = name.split(':')
    const def = env.content.dungeons[d ?? '']
    if (def === undefined) throw new ArgError(`unknown dungeon '${d}' — one of ${Object.keys(env.content.dungeons).join(', ')}`)
    return battleSpecFor({ ...run, nodeId: def.id }, { origin: { kind: 'dungeon', dungeonId: def.id, roomId: room ?? 'r0c0', roomType: 'combat' }, enemies: { kind: 'group', enemyGroupId: def.combatEnemyGroupId, level: 1 }, captureTargets: [] }, env)
  }
  return battleSpecFor(run, { origin: { kind: 'sim' }, enemies: { kind: 'group', enemyGroupId: groupId, level }, captureTargets: [] }, env)
}

/**
 * `attrition:dungeon[:<id>]` and `attrition:road[:<node>]` are PATHS, not battles: they carry HP (and food) from
 * one fight to the next, which is the whole reason they exist (GATE3-15/17). They therefore print an attrition
 * row rather than a `SweepRow`, and their seed base is the one the `balance` gate uses so a `simulate` reading and
 * a gate reading of the same label are the same measurement.
 */
function attritionScenario(name: string, seed: number, trace?: AttritionTrace): AttritionResult {
  const [, kind, target] = name.split(':')
  if (kind === 'dungeon') return attritionDungeon(target ?? ATTRITION.dungeonId, seed, env, trace)
  if (kind === 'road') return attritionRoad(target ?? ATTRITION.roadTo, seed, env, trace)
  throw new ArgError(`unknown attrition scenario '${name}' — attrition:dungeon[:<id>] or attrition:road[:<node>]`)
}

/** The two routes the gate bands (content ids live here, never in `rules.ts`, which carries only the bands). */
const ATTRITION = { dungeonId: 'smugglers_cave', roadTo: 'the_iron_throne' } as const

const attritionLine = (r: AttritionRow): string =>
  `${r.label.padEnd(24)} runs ${r.runs}  cleared ${(r.clearRate * 100).toFixed(0)}%  wipes ${r.wipes}  steps ${r.meanSteps.toFixed(1)}  fights ${r.meanFights.toFixed(1)}` +
  `  end HP ${pctOf(r.meanEndHpFraction)} (worst ${pctOf(r.worstEndHpFraction)})  low water ${pctOf(r.meanLowWaterHpFraction)}  deaths ${r.deaths}` +
  `  food left ${r.meanFoodLeft === null ? '—' : r.meanFoodLeft.toFixed(1)}  starving hops ${r.starvingSteps}`

const pctOf = (n: number | null): string => (n === null ? '—' : `${(n * 100).toFixed(0)}%`)

function simulate(): void {
  const runs = parseCount('runs', flag('runs'), 20)
  const scenario = flag('scenario') ?? 'stub'
  if (scenario.startsWith('attrition')) {
    const seeds = Array.from({ length: runs }, (_, i) => env.rules.balance.attrition.firstSeed + i)
    const trace: AttritionTrace | undefined = has('trace') ? (line) => process.stderr.write(`${line}
`) : undefined
    const row = attritionSweep(scenario, seeds, (s) => {
      trace?.(`— seed ${s}`)
      const r = attritionScenario(scenario, s, trace)
      trace?.(`  → ${r.outcome} after ${r.steps} step(s), ${r.fights} fight(s), ${r.deaths} dead`)
      return r
    })
    out(has('json') ? JSON.stringify([row]) : attritionLine(row))
    return
  }
  const policyName = flag('policy') ?? 'greedy'
  const policy = POLICIES[policyName]
  if (policy === undefined) throw new ArgError(`unknown policy '${policyName}' — one of ${Object.keys(POLICIES).join(', ')}`)
  const specs = Array.from({ length: runs }, (_, i) => ({ label: scenario, spec: scenarioSpec(scenario, 1000 + i) }))
  const rows = sweep(specs, env, policy)
  if (has('json')) out(JSON.stringify(rows))
  else for (const r of rows) out(`${r.label.padEnd(24)} runs ${r.runs}  win ${(r.winRate * 100).toFixed(0)}%  rounds ${num(r.meanRounds)} (${num(r.minRounds, 0)}-${num(r.maxRounds, 0)})  first blood ${num(r.meanFirstBloodRound)}  stalemates ${r.stalemates}`)
}

const num = (n: number | null, digits = 1): string => (n === null ? '—' : n.toFixed(digits))

/**
 * Wilson 95% score interval on `wins/runs` — printed beside every win rate so a MISS can be read as "really out
 * of band" rather than "the sample is too small to tell" (0048). At `simSeeds` 120 the half-width is ≈9pp against
 * a 20pp band; at the 20 seeds this gate used to run it was ≈±22pp, i.e. wider than the band it was policing.
 */
function wilson(rate: number, n: number): readonly [number, number] {
  if (n === 0) return [0, 1]
  const z = 1.96
  const denom = 1 + (z * z) / n
  const centre = (rate + (z * z) / (2 * n)) / denom
  const half = (z / denom) * Math.sqrt((rate * (1 - rate)) / n + (z * z) / (4 * n * n))
  return [Math.max(0, centre - half), Math.min(1, centre + half)]
}

/**
 * The CI gate (BRIEF §10): `rules.balance.simSeeds` seeds × {stub, boss}, exit 1 on a miss.
 *
 * The brief states the round target as an AVERAGE ("average 4-10 turns"), so that is what the `rounds` row asserts,
 * plus the per-battle CEILING — a battle that runs past the band is a design failure the way a stalemate is, and a
 * mean alone would hide it. The per-battle span is PRINTED either way, so a bimodal field (half the battles at 2
 * rounds, half at 10) is visible in the row that passes. The floor is deliberately not asserted: over 120 seeds the
 * shortest battle is an order statistic that moves with any content change, and ratcheting HP upward to keep it
 * above 4 would be tuning to the sample, not to the game. First blood IS asserted per battle — on the worst battle
 * and on `bloodlessRuns`, because a battle where nobody ever lost HP is invisible to a mean taken over the battles
 * that drew blood at all (0048).
 */
function balance(): number {
  const b = env.rules.balance
  const seeds = Array.from({ length: b.simSeeds }, (_, i) => 2000 + i)
  const rows = sweep([...seeds.map((s) => ({ label: 'stub', spec: scenarioSpec('stub', s) })), ...seeds.map((s) => ({ label: 'boss', spec: scenarioSpec('boss', s) }))], env, carefulPolicy)
  let failed = false
  const check = (label: string, ok: boolean, detail: string): void => { out(`${ok ? 'ok  ' : 'MISS'} ${label}: ${detail}`); if (!ok) failed = true }
  const pct = (n: number): string => `${(n * 100).toFixed(0)}%`
  out(`${b.simSeeds} seeds per scenario (${seeds[0]}-${seeds[seeds.length - 1]!}), careful-player policy`)
  for (const r of rows) {
    const band = r.label === 'stub' ? b.startersVsStubWin : b.bossWithEpicWin
    const [lo, hi] = wilson(r.winRate, r.runs)
    check(`${r.label} win rate`, r.winRate >= band[0] && r.winRate <= band[1], `${pct(r.winRate)} (band ${pct(band[0])}-${pct(band[1])}, 95% CI ${pct(lo)}-${pct(hi)})`)
    check(`${r.label} stalemates`, r.stalemates === b.stalemates, `${r.stalemates}`)
    const meanOk = r.meanRounds !== null && r.meanRounds >= b.turns[0] && r.meanRounds <= b.turns[1]
    const ceilingOk = r.maxRounds !== null && r.maxRounds <= b.roundsCeiling
    check(`${r.label} rounds`, meanOk && ceilingOk, `mean ${num(r.meanRounds)}, per battle ${num(r.minRounds, 0)}-${num(r.maxRounds, 0)} (mean band ${b.turns[0]}-${b.turns[1]}, no battle past ${b.roundsCeiling})`)
    check(`${r.label} first blood`, r.bloodlessRuns === 0 && r.worstFirstBloodRound !== null && r.worstFirstBloodRound <= b.firstBloodByRound, `mean ${num(r.meanFirstBloodRound)}, worst ${num(r.worstFirstBloodRound, 0)}, ${r.bloodlessRuns} bloodless (by round ${b.firstBloodByRound})`)
  }

  // ── the shipped difficulty of a PATH (GATE3-15/17) ─────────────────────────────────────────────────────────
  // Two battle scenarios seeded from a fresh, full-HP party can be green while the game kills by attrition, which
  // is exactly what shipped: the gate passed at stub 69% / boss 43% while a dungeon descent cleared 0 of 24 and a
  // road leg 3 of 24. These rows carry HP (and food) from one fight to the next.
  const a = b.attrition
  const seedsA = Array.from({ length: a.seeds }, (_, i) => a.firstSeed + i)
  out(`${a.seeds} paths per scenario (${seedsA[0]}-${seedsA[seedsA.length - 1]!}), careful-player policy`)
  const rows2 = [
    attritionSweep('dungeon path', seedsA, (s) => attritionDungeon(ATTRITION.dungeonId, s, env)),
    attritionSweep('road leg', seedsA, (s) => attritionRoad(ATTRITION.roadTo, s, env)),
  ]
  for (const r of rows2) {
    const band = r.label === 'road leg' ? a.roadClearRate : a.dungeonClearRate
    const [lo, hi] = wilson(r.clearRate, r.runs)
    out(`     ${r.label}: ${attritionLine(r).slice(r.label.length).trim()}`)
    check(`${r.label} cleared`, r.clearRate >= band[0] && r.clearRate <= band[1], `${pct(r.clearRate)} (band ${pct(band[0])}-${pct(band[1])}, 95% CI ${pct(lo)}-${pct(hi)})`)
    const low = r.meanLowWaterHpFraction
    check(`${r.label} pressure`, low >= a.lowWaterHpFraction[0] && low <= a.lowWaterHpFraction[1], `low water ${pct(low)} of the party pool (band ${pct(a.lowWaterHpFraction[0])}-${pct(a.lowWaterHpFraction[1])})`)
    if (r.label === 'road leg') check('road leg supply', r.starvingSteps <= a.maxStarvingSteps, `${r.starvingSteps} starving hop(s) over ${r.runs} journeys (at most ${a.maxStarvingSteps})`)
  }
  return failed ? 1 : 0
}

/**
 * CONTRACT §10's third lint pass: `CONSUMED_PARAMS` calls itself "the lint's truth table … a param not listed
 * here fails `lint:content`", and until CLI-09 it had no importer anywhere in the tree — an authored effect
 * carrying a parameter the resolver never reads would have shipped silently.
 */
export function lintEffectParams(reg: Pick<typeof content, 'cards'>): readonly string[] {
  const table: Readonly<Record<string, readonly string[] | undefined>> = CONSUMED_PARAMS
  const errors: string[] = []
  for (const card of Object.values(reg.cards)) {
    for (const effect of card.effects) {
      const allowed = table[effect.kind]
      if (allowed === undefined) { errors.push(`card ${card.id}: unknown effect kind '${effect.kind}'`); continue }
      for (const key of Object.keys(effect)) {
        if (!allowed.includes(key)) errors.push(`card ${card.id} ${effect.kind}: param '${key}' is never read by the resolver`)
      }
    }
  }
  return errors
}

function lint(): number {
  const errors = [...lintContent(content), ...bootstrapQuests(env), ...lintEffectParams(content)]
  const warnings = lintContentWarnings(content)
  for (const w of warnings) out(`warn  ${w}`)
  for (const e of errors) out(`ERROR ${e}`)
  out(errors.length === 0 ? `lint OK (${warnings.length} warnings)` : `lint FAILED: ${errors.length} error(s)`)
  return errors.length === 0 ? 0 : 1
}

const USAGE = 'usage: play | combat | simulate | balance | travel | replay | dialogue | lint | dump-state (see the header of scripts/cli.ts)'

async function main(): Promise<void> {
  const spec = COMMANDS[command]
  if (spec === undefined) {
    out(`unknown command '${command}'`)
    out(USAGE)
    process.exitCode = 1
    return
  }
  args = parseArgs(spec, argv.slice(1))
  const patch = parseRulesPatch(flag('rules'))
  if (Object.keys(patch).length > 0) env = withRules(env, patch)

  switch (command) {
    case 'play': await play(null); return
    case 'combat': await play(scenarioSpec(flag('scenario') ?? 'stub', parseSeed(flag('seed')))); return
    case 'simulate': simulate(); return
    case 'balance': process.exitCode = balance(); return
    case 'lint': process.exitCode = lint(); return
    case 'dump-state': out(JSON.stringify(fixtureFor(parseScreen(flag('screen'), 'overworld'), parseSeed(flag('seed')), env), null, 1)); return
    case 'travel': travel(); return
    case 'replay': {
      const snapshotPath = positional(0)
      const actionsPath = positional(1)
      if (snapshotPath === undefined || actionsPath === undefined) throw new ArgError('replay <snapshot.json> <actions.json> [--initial <state.json>]')
      const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as GameState
      const parsed = JSON.parse(readFileSync(actionsPath, 'utf8')) as Action[] | { initial: GameState; actions: Action[] }
      // `log` writes the envelope; a bare array is still accepted so an older capture keeps working.
      const envelope = Array.isArray(parsed) ? null : parsed
      const actions = envelope === null ? (parsed as Action[]) : envelope.actions
      const initialFlag = flag('initial')
      const origin = initialFlag !== undefined
        ? (JSON.parse(readFileSync(initialFlag, 'utf8')) as GameState)
        : envelope?.initial ?? initialState()
      if (initialFlag === undefined && envelope === null && actions[0]?.type !== 'meta/newRun') {
        // Without this the tool reports the FIXTURE's `meta` as a divergence pinned to the last action — it lies
        // about determinism instead of saying the log has the wrong origin (CLI-08).
        out('replay: this log does not start from a fresh title state — pass --initial <state.json> (or capture it with the REPL `log` command, which writes { initial, actions })')
        process.exitCode = 1
        return
      }
      const verdict = verifyReplay(origin, actions, snapshot, env)
      out(JSON.stringify(verdict))
      process.exitCode = verdict.ok ? 0 : 1
      return
    }
    case 'dialogue': {
      const id = positional(0)
      if (id === undefined) { out(Object.keys(env.content.dialogues).join('\n')); return }
      if (env.content.dialogues[id] === undefined) throw new ArgError(`unknown dialogue '${id}'`)
      const cmds = (flag('cmds') ?? '').split(';').filter((c) => c.trim() !== '').map((c) => (/^\d+$/.test(c.trim()) ? `choose ${c.trim()}` : c))
      const rt = createRuntime({ env, initial: fixtureFor('overworld', parseSeed(flag('seed')), env), log: true })
      rt.dispatch({ type: 'quest/applyEffects', effects: [{ kind: 'startDialogue', dialogueId: id }] })
      rt.drain()
      render(rt.getState())
      for (const c of cmds) { for (const a of toActions(c, rt)) rt.dispatch(a); rt.drain(); render(rt.getState()) }
      return
    }
    default:
      out(USAGE)
      return
  }
}

/** Guarded so a test can import `lintEffectParams` without the module trying to run a command. */
const entry = process.argv[1]
if (entry !== undefined && resolvePath(entry) === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    if (e instanceof ArgError) { out(e.message); process.exitCode = 1; return }
    // §7.2 / CONTRACT §10: a round cap is evidence, not a statistic — the per-round dump it carries is the whole
    // point of throwing, so the stuck field is printed here instead of being swallowed with the stack (0048).
    if (e instanceof RoundCapError) {
      out(`ERROR ${e.message}`)
      out(`round-cap dump: ${e.dump.length} state(s); the field as it stalled —`)
      const last = e.dump[e.dump.length - 1]
      if (last !== undefined) for (const l of renderBoard(last, null)) out(l)
      process.exitCode = 1
      return
    }
    out(`ERROR ${e instanceof Error ? e.stack ?? e.message : String(e)}`)
    process.exitCode = 1
  })
}
