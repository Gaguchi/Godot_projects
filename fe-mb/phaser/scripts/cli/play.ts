/**
 * FE_MB headless CLI — play/simulate the game in the terminal with no browser.
 * Drives the real stores + pure systems via tsx. Complements Playwright:
 * use THIS for game LOGIC / balance / flow (fast, deterministic, numeric);
 * use Playwright for visual / input / layout.
 *
 *   tsx scripts/cli/play.ts combat                      # interactive REPL
 *   tsx scripts/cli/play.ts combat --seed 7 --cmds "auto"          # scripted
 *   tsx scripts/cli/play.ts combat --autobattle --runs 50          # balance sim
 *   tsx scripts/cli/play.ts dialogue bandit_threat --cmds "1"      # walk a tree
 *   echo "play 1 8,4; end" | tsx scripts/cli/play.ts combat        # piped script
 *
 * Combat commands: play <handIdx> <x,y> | move <x,y> | select <i> | targets <i>
 *                  | auto (greedy turn) | end | show | state | help | quit
 */
import { createInterface } from 'node:readline'
import { useCombatStore } from '../../src/state/combatStore'
import { useRunStore } from '../../src/state/runStore'
import { seedStubBattle } from '../../src/game/scenes/seedStubBattle'
import { seedDungeonBattle } from '../../src/game/scenes/seedDungeonBattle'
import { createRng } from '../../src/systems/rng'
import { buildUnit } from '../../src/systems/buildUnit'
import { getItemDef } from '../../src/data/itemRegistry'
import { bootstrapDialogues } from '../../src/state/dialogueBootstrap'
import { getDialogue, listDialogueIds } from '../../src/state/dialogueRegistry'
import { predicateStateFromRun } from '../../src/state/runStore'
import { step, visibleChoices, isChoiceEnabled } from '../../src/systems/dialogueRunner'
import type { DialogueNodeId } from '../../src/domain/ids'
import type { Unit } from '../../src/domain/unit'
import { renderCombat, isEnemyUnit } from './render'
import { applyCommand, autoBattle, battleOutcome, cstate } from './combat'

// Silence the diag→console.debug mirror (runStore dispatches log via it) so the
// CLI output stays clean. Warnings/errors still surface.
console.debug = (): void => {}

// ── arg parsing (no deps) ───────────────────────────────────────────
function parseArgs(argv: string[]): { positional: string[]; flags: Record<string, string | true> } {
  const positional: string[] = []
  const flags: Record<string, string | true> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq >= 0) { flags[a.slice(2, eq)] = a.slice(eq + 1) }
      else if (argv[i + 1] && !argv[i + 1]!.startsWith('--')) { flags[a.slice(2)] = argv[++i]! }
      else { flags[a.slice(2)] = true }
    } else { positional.push(a) }
  }
  return { positional, flags }
}

const STARTERS: Array<[string, string, string]> = [
  ['lord', 'Roy', 'roy'],
  ['knight', 'Marcus', 'marcus'],
  ['mage', 'Lilina', 'lilina'],
]
function starterParty(): Unit[] {
  return STARTERS.map(([cls, name, id]) => buildUnit(cls, 1, name, id)).filter((u): u is Unit => u !== null)
}

/**
 * Gear loadout spec → hand slots on the starter party (story 452).
 * Format: "roy=iron_sword+iron_buckler;marcus=iron_greatsword" (right slot
 * optional). "default" = ship-plan starter loadouts. Bypasses the bag —
 * simulation-only convenience; the real game equips through runStore.
 */
const DEFAULT_LOADOUT = 'roy=iron_sword+iron_buckler;marcus=iron_lance+iron_buckler;lilina=fire_tome'
function applyLoadout(units: Unit[], spec: string | true | undefined): Unit[] {
  if (spec === undefined) return units
  const raw = spec === true || spec === 'default' ? DEFAULT_LOADOUT : spec
  const slots = new Map<string, { left: string | null; right: string | null }>()
  for (const part of raw.split(';')) {
    const [unitId, gear] = part.split('=')
    if (!unitId || !gear) continue
    const [left, right] = gear.split('+')
    for (const g of [left, right]) {
      if (g && !getItemDef(g)) console.error(`[loadout] unknown item '${g}' — skipping`)
    }
    slots.set(unitId.trim(), {
      left: left && getItemDef(left) ? left.trim() : null,
      right: right && getItemDef(right) ? right.trim() : null,
    })
  }
  return units.map((u) => {
    const s = slots.get(u.id as unknown as string)
    if (!s) return u
    return {
      ...u,
      handLeft: s.left as unknown as import('../../src/domain/ids').ItemId | null,
      handRight: s.right as unknown as import('../../src/domain/ids').ItemId | null,
    }
  })
}

function seedCombat(seed: number, scenario: string, loadout?: string | true): void {
  const store = useCombatStore.getState()
  store.reset()
  const seedState = { seed, counter: 0 }
  const party = applyLoadout(starterParty(), loadout)
  let event
  if (scenario.startsWith('dungeon:')) {
    const [, dungeonId, roomType] = scenario.split(':')
    event = seedDungeonBattle(dungeonId ?? 'smugglers_cave', (roomType as 'combat' | 'elite' | 'boss') ?? 'combat', seedState, party)
  } else {
    event = seedStubBattle(seedState, party)
  }
  store.dispatch(event, createRng(seedState))
}

function stateSummary(): unknown {
  const s = cstate()
  return {
    phase: s.phase,
    subPhase: s.subPhase,
    turn: s.turn,
    units: Object.values(s.units).map((u) => ({
      id: u.id as unknown as string,
      name: u.name,
      team: isEnemyUnit(u) ? 'enemy' : 'party',
      hp: `${u.hp.current}/${u.hp.max}`,
      ap: u.ap,
      armor: u.armor,
      pos: (u.position as unknown as string) ?? null,
      statuses: u.statuses.map((st) => `${st.effectId as unknown as string}:${st.turnsRemaining}`),
    })),
  }
}

// ── combat mode ─────────────────────────────────────────────────────
function splitCmds(raw: string): string[] {
  return raw.split(/[;\n]/).map((c) => c.trim()).filter((c) => c.length > 0)
}

/**
 * Balance sweep: run autobattle over many seeds per scenario, print a table.
 * --loadout accepts a |-separated MATRIX ("none|default|roy=iron_greatsword")
 * so gear configurations can be compared side by side (story 452).
 */
function reportMode(flags: Record<string, string | true>): void {
  const seeds = Number(flags.seeds ?? 30)
  const scenarios = typeof flags.scenario === 'string'
    ? [flags.scenario]
    : ['stub', 'dungeon:smugglers_cave:combat', 'dungeon:smugglers_cave:elite', 'dungeon:smugglers_cave:boss']
  const loadouts: Array<string | true | undefined> =
    typeof flags.loadout === 'string' && flags.loadout.includes('|')
      ? flags.loadout.split('|').map(l => (l === 'none' ? undefined : l))
      : [flags.loadout]
  console.log(`balance report — ${seeds} seeds/scenario, greedy party AI vs enemy AI\n`)
  console.log('scenario'.padEnd(36) + 'win%   loss%  stale%  avg-turns')
  for (const lo of loadouts) {
    if (loadouts.length > 1) {
      console.log(`── loadout: ${lo === undefined ? 'none' : lo === true ? 'default' : lo}`)
    }
    for (const sc of scenarios) {
      let v = 0, d = 0, s = 0, turns = 0, ok = 0
      let err = ''
      for (let i = 0; i < seeds; i++) {
        try {
          seedCombat(i + 1, sc, lo)
          autoBattle()
          const o = battleOutcome()
          if (o === 'VICTORY') v++
          else if (o === 'DEFEAT') d++
          else s++
          turns += cstate().turn.number
          ok++
        } catch (e) { err = (e as Error).message; break }
      }
      if (err) { console.log(sc.padEnd(36) + 'error: ' + err.slice(0, 50)); continue }
      const pct = (n: number): string => `${Math.round((100 * n) / Math.max(1, ok))}%`.padStart(5)
      console.log(sc.padEnd(36) + `${pct(v)}  ${pct(d)}  ${pct(s)}   ${(turns / Math.max(1, ok)).toFixed(1)}`)
    }
  }
}

async function combatMode(flags: Record<string, string | true>): Promise<void> {
  if (flags.report) { reportMode(flags); return }
  const seed = Number(flags.seed ?? 1)
  const scenario = typeof flags.scenario === 'string' ? flags.scenario : 'stub'
  const loadout = flags.loadout
  seedCombat(seed, scenario, loadout)

  // Balance sim: both sides AI, optionally many runs.
  if (flags.autobattle) {
    const runs = Number(flags.runs ?? 1)
    const results: Record<string, number> = {}
    let totalTurns = 0
    for (let r = 0; r < runs; r++) {
      seedCombat(seed + r, scenario, loadout)
      const log = autoBattle()
      const res = battleOutcome()
      results[res] = (results[res] ?? 0) + 1
      totalTurns += cstate().turn.number
      if (runs === 1 || flags.log) {
        console.log(log.join('\n'))
        console.log(renderCombat(cstate()))
      }
    }
    console.log(`\n=== AUTOBATTLE (${runs} run${runs === 1 ? '' : 's'}, seed ${seed}, ${scenario}) ===`)
    console.log(`results: ${JSON.stringify(results)}   avg turns: ${(totalTurns / runs).toFixed(1)}`)
    return
  }

  const scripted = typeof flags.cmds === 'string' ? splitCmds(flags.cmds) : null
  const piped = !process.stdin.isTTY && !scripted

  if (scripted) {
    for (const cmd of scripted) {
      const log = applyCommand(cmd)
      if (log.length) console.log(`> ${cmd}\n${log.join('\n')}`)
    }
    if (flags.json) console.log(JSON.stringify(stateSummary(), null, 2))
    else console.log(renderCombat(cstate()))
    return
  }

  // Interactive (TTY) or piped-stdin REPL.
  console.log(renderCombat(cstate()))
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: piped ? '' : '> ' })
  if (!piped) rl.prompt()
  for await (const lineRaw of rl) {
    const line = lineRaw.trim()
    if (line === 'quit' || line === 'q' || line === 'exit') break
    if (line === 'help' || line === '?') {
      console.log('commands: play <i> <x,y> | move <x,y> | select <i> | targets <i> | auto | end | show | state | quit')
    } else if (line === 'show' || line === 'board' || line === '') {
      console.log(renderCombat(cstate()))
    } else if (line === 'state' || line === 'json') {
      console.log(JSON.stringify(stateSummary(), null, 2))
    } else {
      const log = applyCommand(line)
      if (log.length) console.log(log.join('\n'))
      console.log(renderCombat(cstate()))
    }
    if (!piped) rl.prompt()
  }
  rl.close()
}

// ── dialogue mode ───────────────────────────────────────────────────
async function dialogueMode(id: string | undefined, flags: Record<string, string | true>): Promise<void> {
  bootstrapDialogues()
  if (!id) { console.log('dialogues: ' + listDialogueIds().join(', ')); return }
  const tree = getDialogue(id)
  if (!tree) { console.error(`no dialogue "${id}". available: ${listDialogueIds().join(', ')}`); process.exitCode = 1; return }

  // Seed a starter party so stat/class/gold checks can resolve realistically.
  const party = starterParty()
  const run = useRunStore.getState()
  for (const u of party) run.dispatch({ type: 'recruitUnit', payload: { unit: u } })
  run.dispatch({ type: 'addGold', payload: { amount: 200 } })
  const predicateState = (): ReturnType<typeof predicateStateFromRun> => predicateStateFromRun(useRunStore.getState())
  const partyState = { gold: 200, foodCount: 9, party }

  const scripted = typeof flags.cmds === 'string' ? splitCmds(flags.cmds).map(Number) : null
  let nodeId: DialogueNodeId | 'end' = tree.startNodeId
  let scriptIdx = 0
  const rl = !scripted ? createInterface({ input: process.stdin, output: process.stdout }) : null

  const renderNode = (): string[] => {
    if (nodeId === 'end') return ['[dialogue ended]']
    const node = tree.nodes[nodeId as unknown as string]
    if (!node) return [`[missing node ${nodeId}]`]
    const choices = visibleChoices(tree, nodeId as unknown as DialogueNodeId, predicateState())
    const lines = [`\n${node.speaker ? node.speaker.toUpperCase() : 'NARRATOR'}: ${node.text}`]
    choices.forEach((c, i) => {
      const enabled = isChoiceEnabled(c, predicateState())
      const tag = c.check ? `[check:${c.check.kind}]` : ''
      lines.push(`  [${i}] ${tag} ${c.text}${enabled ? '' : '  (blocked)'}`)
    })
    if (choices.length === 0) lines.push('  (no choices — dead end)')
    return lines
  }

  while (nodeId !== 'end') {
    console.log(renderNode().join('\n'))
    const node = tree.nodes[nodeId as unknown as string]
    if (!node) break
    const choices = visibleChoices(tree, nodeId as unknown as DialogueNodeId, predicateState())
    if (choices.length === 0) break
    let pick: number
    if (scripted) {
      if (scriptIdx >= scripted.length) { console.log('(script exhausted)'); break }
      pick = scripted[scriptIdx++]!
    } else {
      const ans = await new Promise<string>((res) => rl!.question('choose > ', res))
      if (ans.trim() === 'quit') break
      pick = Number(ans.trim())
    }
    const choice = choices[pick]
    if (!choice) { console.log(`(no choice ${pick})`); if (scripted) break; else continue }
    const result = step(tree, nodeId as unknown as DialogueNodeId, choice.id, predicateState(), { partyState })
    console.log(`  → chose "${choice.text}"${result.effects.length ? ` (effects: ${result.effects.map((e) => e.kind).join(', ')})` : ''}`)
    for (const eff of result.effects) run.dispatch({ type: 'applyQuestEffects', payload: { effects: [eff] } })
    nodeId = result.nextNodeId
  }
  console.log('[dialogue ended]')
  rl?.close()
}

// ── entry ───────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const { positional, flags } = parseArgs(process.argv.slice(2))
  const mode = positional[0] ?? 'combat'
  if (flags.help || mode === 'help') {
    console.log('usage: tsx scripts/cli/play.ts <combat|dialogue> [id] [--seed N] [--scenario stub|dungeon:<id>:<room>] [--loadout default|"roy=iron_sword+iron_buckler;..."] [--cmds "a; b"] [--autobattle --runs N] [--json]')
    return
  }
  if (mode === 'combat') await combatMode(flags)
  else if (mode === 'dialogue') await dialogueMode(positional[1], flags)
  else { console.error(`unknown mode "${mode}" (combat | dialogue)`); process.exitCode = 1 }
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
