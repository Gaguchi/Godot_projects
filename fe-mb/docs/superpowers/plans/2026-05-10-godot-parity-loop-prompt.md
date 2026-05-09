# Ralph Loop Prompt — FE_MB Godot Parity Pass

> Same prompt fed every iteration. Equipment removal + quest engine + dialogue UI + travel encounters + multi-region overworld + 5 town JSONs + dungeon parity. ~32 tasks, ~7 phases.

You are bringing the FE_MB phaser game to Godot-version content parity, plus deleting the unused equipment scaffolding. Each iteration completes ONE task from `RALPH_PROGRESS.md` end-to-end.

## Required reading every iteration

1. `phaser/CONTEXT.md` — architecture invariants, store ownership, contracts.
2. `RALPH_PROGRESS.md` — find next unchecked GP-* task.
3. `docs/superpowers/plans/2026-05-10-godot-parity-plan.md` — TDD steps for the current task.
4. `docs/superpowers/specs/2026-05-10-godot-parity-design.md` — design constraints.
5. `git log --oneline -15` — sanity-check.

## Per-iteration job

### TDD discipline

1. Read the task. Note files to create/modify/delete.
2. **Write the failing test first** (or run existing tests to confirm they break in expected places after a refactor). Confirm.
3. Implement the minimal change.
4. Re-run the test. Confirm it passes.
5. Run all five build gates: `typecheck`, `npm test -- --run`, `check-context-doc`, `test:e2e`, `build`.
6. Run `npm run perf-gates` (added during UI-input-overhaul). Should pass.
7. Commit with `feat(phaser): [GP-XX] <description>` or `fix(phaser):` / `refactor(phaser):` / `chore(phaser):` as appropriate.
8. Update `RALPH_PROGRESS.md` with `[x]` and the commit SHA.

## Verify before check-off

```
cd phaser && npm run typecheck
cd phaser && npm test -- --run
cd phaser && npm run check-context-doc
cd phaser && npm run test:e2e
cd phaser && npm run build
cd phaser && npm run perf-gates
```

If any gate fails: investigate root cause; do NOT bypass with `--no-verify`. If genuinely stuck, mark `🚧 BLOCKED: <reason>` and pick the next non-blocked item.

## Drift safeguards — emit `<promise>NEEDS_HUMAN_REVIEW</promise>` if any

- 3+ consecutive `🚧 BLOCKED:` markers.
- Tests fail on HEAD at iteration start (previous iteration committed broken code).
- Bundle gate exceeded by >50 KB beyond ceiling (i.e. > 557 KB gzipped).
- Dialogue/quest content fails to parse against schema and you can't reconcile after one fix attempt.

## Architecture rules (MUST hold)

- **All UI is React DOM** via `src/ui/components/` wrappers. No raw `react-aria-components` in feature code (lint-enforced).
- **Phaser is BoardScene only** (tiles, units, animations, spatial pickers). No buttons in canvas.
- **Three Zustand stores** with single dispatch chokepoint each. NO `useRunStore.setState` in feature code (the existing DungeonScene violation is fixed in F-3).
- **Pure systems** in `src/systems/` and `src/procgen/` — no Phaser, no React.
- **`Math.random()` is forbidden** — use RNG parameters via `deriveRng(parent, label)`.
- **Cross-system writes** via `src/contracts/` types.
- **CONTEXT.md drift check must pass** every iteration (CI gate).

## Phase guidance

- **Phase A (equipment removal)** — purely subtractive. Don't accidentally drop the consumables (food/potion items, moveItemInBag for them).
- **Phase B (quest engine + dialogue)** — port content via `convert-dialogue.mjs` script, hand-review each. DialogueModal must be tested with vitest+jsdom (use the patterns from CombatHud test in `tests/unit/ui/scenes/combat/CombatHud.test.tsx`).
- **Phase C (encounters + food)** — encounterRoller is pure; test with deterministic RNG. Per-hop food integrates with multi-hop travel from Phase D.
- **Phase D (multi-region)** — port Godot's overworld.json verbatim, split by region. Dynamic quest nodes use `runStore.dynamicNodes` (not mutating the static map).
- **Phase E (towns)** — extract panels into separate files; do NOT inline in TownScene.tsx.
- **Phase F (dungeon)** — `restParty` reducer is the chokepoint fix; row-band weights must produce all 7 room types in 100 sample runs.
- **Phase G (integration)** — visual playthrough is required before promise.

## Promise

`<promise>GODOT-PARITY</promise>` only when:
- All ~32 GP-* tasks checked.
- All five build gates green + perf-gates green.
- Visual playthrough recorded with screenshots: title → prologue → overworld with food preview → travel encounter dialogue → travel encounter battle → town panels (Inn+Shop+Tavern with NPC dialogue) → camp rest → dungeon with all 7 room types → boss → region transition → exit.
- Tag `phaser-godot-parity` pushed.
- 5 distinct town JSONs render distinct content (verified by switching `townId`).
- 3 region maps render with map-to-map travel (verified visually).
- Blood Ties quest playable end-to-end (accept → encounter → resolve → reward).
- SAVE_VERSION = `0.6.0-cards-only`; no HandSlots remaining in the codebase.

If any of those is not yet true, do not emit the promise.
