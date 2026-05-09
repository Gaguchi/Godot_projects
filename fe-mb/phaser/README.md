# FE_MB Phaser Foundation (v2)

TypeScript + Phaser 4 + React 19 + Vite + Zustand + Zod migration target for the FE_MB tactical roguelite.

The foundation milestone (this directory) ships the full GDLC contract surface — schemas, stores, systems, persistence, RNG, predicates, dev tooling — without yet wiring a playable session. Feature milestones build on top of these primitives.

## Agent on-ramp

Before modifying anything under `src/`:

1. **Read `CONTEXT.md`** — current architectural truth, ≤300 lines, the canonical source for module names, store actions, contract types, and save fields.
2. **Read the working spec** — `../docs/superpowers/specs/2026-05-08-phaser-foundations-v2-design.md` (foundation v2 design) and `../docs/superpowers/specs/2026-03-29-ship-plan-design.md` (game design).
3. **Update `CONTEXT.md` in the same commit** if your change adds/renames/removes a domain type, store action, contract, save field, or system file. CI fails otherwise (`npm run check-context-doc`).

For research-bearing work, see `../docs/research/` (procgen, RNG, growth math, scaling curves, quest audit).

## Architecture invariants

1. Combat = Phaser canvas. Everything else = React DOM + Tailwind.
2. Three Zustand stores (`metaStore`, `runStore`, `combatStore`) with single `dispatch(action)` chokepoints.
3. Pure systems in `src/systems/` and `src/procgen/` — no Phaser, no React, no I/O.
4. Combat is a reducer over a discriminated `CombatEvent` union. An effects queue separates state changes from rendering.
5. `CombatScene` owns a mutable `CombatRuntime` POJO and never reads store state per frame.
6. `Math.random()` is forbidden — lint rule banned. Use injected `RNG` parameters; derive sub-RNGs via `deriveRng(parent, label)`.
7. Cross-system writes flow through `src/contracts/` types.
8. Predicates are declarative AST nodes that round-trip through save.
9. Domain events flow through `eventBus`; subscribers dispatch back to stores. The bus is not a mutation channel.
10. Specs in `docs/superpowers/specs/` are append-only post-merge.

## Quickstart

```bash
npm install
npm run dev               # Vite dev server at http://localhost:5173
```

The dev build mounts `BootScene` → `CombatScene` and overlays React (`App.tsx`) including the dev HUD which surfaces actions, events, and errors live.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (port 5173) with HMR |
| `npm test` | Vitest unit tests (run-once) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright E2E (boot smoke + canvas + DevHud) |
| `npm run test:e2e:update` | Refresh Playwright snapshots after intentional UI changes |
| `npm run typecheck` | `tsc --noEmit` (strict + `noUncheckedIndexedAccess`) |
| `npm run check-context-doc` | CI drift check: every exported `domain/`, `contracts/`, `state/`, `persistence/` name must appear in `CONTEXT.md` |
| `npm run build` | Production bundle (`dist/`) — runs typecheck then `vite build` |
| `npm run preview` | Serve `dist/` for verification |

## Layout

```
phaser/
├── CONTEXT.md                       # living architectural reference (read first)
├── src/
│   ├── domain/                      # pure domain types (units, cards, items, statuses, ...)
│   ├── contracts/                   # cross-system action/event types
│   ├── data/
│   │   ├── schemas/                 # Zod schemas for content
│   │   ├── content/                 # representative JSON (3 classes, 10 items, ~50 cards)
│   │   └── load.ts                  # validateContent(rawBundle): aggregated Zod errors
│   ├── state/                       # Zustand stores: metaStore, runStore, combatStore + eventBus, errorBus
│   ├── systems/                     # pure reducers: combatReducer, statusEffects, predicates, deckBuilder, ...
│   ├── procgen/                     # dungeonGenerator, RNG-driven content
│   ├── persistence/                 # save/load + replay harness
│   ├── game/                        # Phaser runtime: scenes, CombatRuntime, mount glue
│   └── ui/                          # React (App, DevHud, modals)
├── tests/
│   ├── unit/                        # Vitest (~130 tests across data, state, systems, procgen, persistence)
│   └── e2e/                         # Playwright boot smoke
└── scripts/check-context-doc.ts     # CI drift checker
```

## Foundation v2 milestone

The current state ships the full GDLC contract surface: 3 stores with action chokepoints, 9 Zod schemas (card/unit/item/class/statusEffect/predicate/map/quest/dialogue), pure combat reducer with effect pipeline, deterministic seeded RNG, declarative predicate AST, dungeon generator, save/load with replay-equivalence test, dev HUD, React+Phaser mount glue, CONTEXT.md drift CI, and a Playwright boot smoke. Representative content (3 classes, 10 items, ~50 cards) validates the schemas end-to-end.

See `../docs/superpowers/specs/2026-05-08-phaser-foundations-v2-design.md` §29 for the full success-criteria list.

## Known scope limits

- No playable session yet — `CombatScene` is shell-only. First feature milestone wires the combat slice.
- No overworld/town/dungeon UI yet — schemas and procgen exist; UI lands in feature milestones.
- Audio is hook-only; drop sources into `public/audio/` when needed.
