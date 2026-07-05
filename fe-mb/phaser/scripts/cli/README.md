# FE_MB headless CLI (`scripts/cli/`)

A terminal harness for **playing and simulating the game logic with no browser**. It drives the *real* stores (`combatStore`, `runStore`) through their `dispatch` chokepoint and the *real* pure systems (`combatReducer`, `enemyAI`, `targeting`, `dialogueRunner`) via `tsx`. Output is ASCII + exact numbers.

> **Why this exists.** The architecture deliberately keeps all game logic in pure, framework-free systems (state in → state out, deterministic RNG). That means combat, dialogue, encounters, and balance can be exercised in Node in **<1 second**, **deterministically**, with **exact HP/AP/position numbers** — instead of booting Chromium, navigating, screenshotting, and eyeballing downscaled images through Playwright.
>
> **Division of labour:**
> - **This CLI → game LOGIC, flow, and balance.** "Does this card do the right damage?", "can the player reach that enemy?", "does this dialogue branch correctly?", "is the starter party winnable?".
> - **Playwright → VISUAL, input, and layout.** The two bugs that motivated the recent fixes (overlay clipping, click hit-testing under the CSS stage transform) are layout/input issues the CLI *cannot* catch — those still need the browser.

## Run

```bash
# Interactive combat REPL (type commands; 'help' lists them, 'quit' exits)
npx tsx scripts/cli/play.ts combat

# Scripted combat — deterministic; '--json' prints machine-readable final state
npx tsx scripts/cli/play.ts combat --seed 7 --cmds "auto; auto" --json

# Pipe a script via stdin
echo "targets 1; move 5,4; end" | npx tsx scripts/cli/play.ts combat --seed 3

# Balance simulation: both sides on AI, batch over seeds
npx tsx scripts/cli/play.ts combat --autobattle --runs 50 --seed 1
npm run sim -- --runs 50            # same, via npm script

# Dungeon battle instead of the stub skirmish
npx tsx scripts/cli/play.ts combat --scenario dungeon:smugglers_cave:combat --autobattle

# Walk a dialogue tree (scripted choice indices, or interactive)
npx tsx scripts/cli/play.ts dialogue bandit_threat --cmds "2"
npx tsx scripts/cli/play.ts dialogue            # lists available dialogue ids
```

`npm run cli -- combat ...` and `npm run sim` are convenience aliases.

## Combat commands

| Command | Effect |
|---|---|
| `play <handIdx> <x,y>` | Active unit plays hand card N at tile x,y (validates AP + range + target kind) |
| `move <x,y>` | Move the active unit (validates reachability) |
| `select <handIdx>` | Select a card and print its valid target tiles |
| `targets <handIdx>` | Print valid target tiles for a card without selecting |
| `auto` | Greedy turn for the active party unit (attack in-range foe, else close distance, else end) |
| `end` | End turn — then auto-runs all consecutive enemy AI turns |
| `show` / `state` | Re-render the board / dump JSON state |
| `quit` | Exit |

Every action prints a combat log derived by **diffing unit state** (`Bandit: HP 18→10`, `Lilina: ☠ FALLEN`, `Roy: moved 2,4→7,4`).

## Determinism & assertions

`--seed N` fully determines a run (RNG is Mulberry32, threaded through `dispatch`). `--json` emits the final `{phase, turn, units[]}` so a scenario can be asserted in a shell/test:

```bash
npx tsx scripts/cli/play.ts combat --seed 7 --cmds "auto; auto" --json | jq '.units[] | select(.name=="Lilina") | .hp'
```

## Files

- `play.ts` — entry: arg parsing, battle seeding, combat (REPL/scripted/autobattle) + dialogue modes.
- `combat.ts` — the headless combat engine: command application, enemy-AI driver, greedy party AI, autobattle + stalemate detection, combat-log diffing.
- `render.ts` — pure ASCII renderer (board + roster + hand + status) for a `CombatState`.

Typecheck the CLI with `npm run typecheck:cli` (uses `tsconfig.scripts.json`).

## Companion dev tools (built)

The CLI is one of a set; these were built alongside it:

- **Golden scenario tests** — `tests/unit/scenarios/combat.scenario.test.ts` imports this engine (`applyCommand`/`autoBattle`/`battleOutcome`/`cstate`) for deterministic, headless combat-logic regression tests (in `npm test`).
- **Balance sweep** — `play.ts combat --report [--seeds N]` runs autobattle across scenarios → win/loss/stalemate/avg-turns table. **Caveat:** the greedy party AI is currently too passive (≈100% stalemate), so win-rates aren't yet a trustworthy oracle — strengthening it (focus-fire, finish low-HP, stop over-shielding) is the next step.
- **Content lint** — `npm run lint:content` (`scripts/lint-content.ts`): broken card/dialogue refs = errors, offense-less classes = warnings. In `npm run verify`.
- **Visual/structural e2e** — `tests/e2e/visual.spec.ts`: per-scene boot/console-error + no-horizontal-overflow + dialogue-choices-in-stage + masked pixel snapshots. Uses the dev fast-path (which now seeds a real party).
- **Dev fast-path run-seeding** — `?view=overworld|combat|town|...` now seeds party/gold/food (no prologue), so manual + Playwright testing starts from a representative state.

## Remaining backlog (not yet built)

1. **Stronger autobattle AI** — needed before the balance sweep's win-rates are meaningful (see caveat above).
2. **Snapshot/replay** — `--dump-state`/`--load-state <json>` (action log + RNG already make combat replayable) to reproduce a specific bug deterministically in CLI or browser.
3. **Lint-debt cleanup** — clear the ~10 pre-existing `react-hooks`/`only-export-components` errors so `npm run lint` can join `npm run verify` as an all-green gate.
4. **Dungeon duplicate-key fix** — so the visual e2e console-error check can include the dungeon view.
5. **More content-lint rules** — unreachable quest stages, card range > board reach, color-only encodings.
