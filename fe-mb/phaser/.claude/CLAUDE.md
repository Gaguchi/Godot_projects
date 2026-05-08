# phaser/ — FE_MB Foundation (TypeScript Migration)

> **Migration of FE_MB tactical roguelite from Godot 4.6 to TS + Phaser 4 + React 19 + Vite + Zustand + Zod.** Currently in foundation milestone (5–6 weeks, full GDLC).

## REQUIRED READING (in order)

Before modifying anything under `phaser/src/`:
1. **Read `phaser/CONTEXT.md`** — current architectural truth, ≤300 lines, agent-orientation source.
2. **Read the latest unsuperseded spec in `../docs/superpowers/specs/`** matching the system you're touching. Working foundation spec: `2026-05-08-phaser-foundations-v2-design.md`.
3. **If your change adds/renames/removes a domain type, store action, contract type, save field, or system file — update `phaser/CONTEXT.md` in the same commit.** CI fails otherwise.
4. **CONTEXT.md vs code disagreement: code wins. Fix the doc and call out the drift in the PR body.**

For research-bearing tasks (procgen rules, RNG strategies, growth math, scaling curves), check `../docs/research/` first; if the deliverable is missing, that research must complete before the dependent system can land.

## Active Specs

- **Foundation working spec:** `../docs/superpowers/specs/2026-05-08-phaser-foundations-v2-design.md`
- **Stack decisions:** `../docs/superpowers/specs/2026-05-05-phaser-migration-design.md`
- **Game design (authoritative):** `../docs/superpowers/specs/2026-03-29-ship-plan-design.md`

## Run

- `npm run dev` — Vite at :5173
- `npm test` — Vitest unit tests
- `npm run test:e2e` — Playwright E2E
- `npm run typecheck` — tsc --noEmit
- `npm run check-context-doc` — CONTEXT.md drift check (CI)

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
