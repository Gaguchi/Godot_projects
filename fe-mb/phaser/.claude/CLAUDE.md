# phaser/ — FE_MB Foundation (TypeScript Migration)

> **Migration of FE_MB tactical roguelite from Godot 4.6 to TS + Phaser 4 + React 19 + Vite + Zustand + Zod.** Currently in foundation milestone (5–6 weeks, full GDLC).

## REQUIRED READING (in order)

Before modifying anything under `phaser/src/`:
1. **Read `phaser/CONTEXT.md`** — current architectural truth, ≤300 lines, agent-orientation source.
2. **Read the latest unsuperseded spec in `../docs/superpowers/specs/`** matching the system you're touching. Working foundation spec: `2026-05-08-phaser-foundations-v2-design.md`.
3. **If your change adds/renames/removes a domain type, store action, contract type, save field, or system file — update `phaser/CONTEXT.md` in the same commit.** CI fails otherwise.
4. **CONTEXT.md vs code disagreement: code wins. Fix the doc and call out the drift in the PR body.**

For research-bearing tasks (procgen rules, RNG strategies, growth math, scaling curves), check `../docs/research/` first; if the deliverable is missing, that research must complete before the dependent system can land.

**UI work (any player-facing screen/HUD/menu/modal/card): use the `crafting-game-ui` skill (`../.claude/skills/crafting-game-ui/`) BEFORE writing UI code and again before calling it done.** Its Iron Rule applies: no player-facing change is done until you've screenshotted it rendered and swept the amateur-signals checklist.

## Active Specs

- **Foundation working spec:** `../docs/superpowers/specs/2026-05-08-phaser-foundations-v2-design.md`
- **Stack decisions:** `../docs/superpowers/specs/2026-05-05-phaser-migration-design.md`
- **Game design (authoritative):** `../docs/superpowers/specs/2026-03-29-ship-plan-design.md`

## Run

- `npm run dev` — Vite at :5183 (pinned via `strictPort`; **:5173 belongs to a different app on this machine**)
- `npm test` — Vitest unit tests
- `npm run test:e2e` — Playwright E2E
- `npm run typecheck` — tsc --noEmit
- `npm run lint` — ESLint (5 invariants; note: pre-existing react-hooks debt)
- `npm run lint:content` — static content checks (broken card/dialogue refs; offense-less classes)
- `npm run check-context-doc` — CONTEXT.md drift check (CI)
- `npm run verify` — composite green gate: typecheck + typecheck:cli + lint:content + check-context-doc + unit tests
- `npm run test:e2e` — Playwright incl. `tests/e2e/visual.spec.ts` (boot/console-error, no-overflow, dialogue-clipping, full-frame snapshots). The config starts its own dev server on :5183 and reuses one if already running — so if something ELSE is on :5183 you will silently test the wrong app. Override with `PW_BASE_URL`; regenerate baselines with `--update-snapshots`. Snapshots are unmasked and tolerance is tight (0.0005) on purpose: they were previously masked into solid-magenta blanks that could never fail.

## Headless CLI (dev tool — `scripts/cli/`, see its README)

Play/simulate game LOGIC in the terminal with no browser (drives the real stores + pure systems via tsx). Use for combat/dialogue/balance; use Playwright for visual/input/layout.

- `npx tsx scripts/cli/play.ts combat` — interactive combat REPL
- `npx tsx scripts/cli/play.ts combat --seed 7 --cmds "auto; auto" --json` — scripted, deterministic, machine-readable
- `npm run sim -- --runs 50` — both-AI balance simulation (win-rate / avg turns / stalemate)
- `npx tsx scripts/cli/play.ts dialogue <id> --cmds "1"` — walk a dialogue tree
- `npm run typecheck:cli` — typecheck the CLI (`tsconfig.scripts.json`)

## Architecture Invariants (do not violate)

1. Combat = Phaser canvas. Everything else = React DOM + Tailwind.
2. Three Zustand stores (`metaStore`, `runStore`, `combatStore`), single `dispatch(action)` chokepoint each.
3. Pure systems in `src/systems/` and `src/procgen/` — no Phaser, no React, no I/O.
4. Combat is a reducer over a discriminated `CombatEvent` union. Effects queue separates state changes from rendering.
5. `CombatScene` owns a mutable `CombatRuntime` POJO. NEVER reads store state per frame.
6. `Math.random()` is forbidden — lint rule banned. Use `RNG` parameters; derive sub-RNGs via `deriveRng(parent, label)`.
7. Cross-system writes go through `src/contracts/` types.
8. Predicates are declarative AST, not function references. Round-trip through save.
9. Domain events flow through `eventBus`. Subscribers dispatch back to stores; bus is not a mutation channel.
10. Specs in `docs/superpowers/specs/` are append-only post-merge. New decisions = new spec + supersedes link.

## Conventions

- **Detached arrays:** never mutate shared array references; always `.slice()` or `[...arr]` at boundaries.
- **Pure systems** import only `domain/`, `contracts/`, other `systems/`. No framework.
- **React components** import only `state/`, `contracts/`, `domain/`. Never Phaser.
- **Phaser scenes** import `domain/`, `state/`, `game/runtime/`. Never React.
- **TS strict + `noUncheckedIndexedAccess` always on.**
