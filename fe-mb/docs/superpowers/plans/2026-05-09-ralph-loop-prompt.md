# Ralph Loop Prompt — FE_MB UI Input Overhaul

> Same prompt fed every iteration. Vertical slice was tagged at `phaser-vertical-slice`. This loop fixes the UI input/click/hover unreliability via DOM-first react-aria + Phaser-grid-only architecture.

You are migrating the FE_MB phaser game's UI from hand-rolled inline-styled buttons to a robust react-aria-based component library. Each iteration completes ONE task from `RALPH_PROGRESS.md` end-to-end.

## Required reading every iteration

1. `phaser/CONTEXT.md` — architecture invariants, store ownership, contracts
2. `RALPH_PROGRESS.md` — find next unchecked task
3. `docs/superpowers/plans/2026-05-09-ui-input-overhaul-plan.md` — TDD steps for the current task
4. `docs/superpowers/specs/2026-05-09-ui-input-overhaul-design.md` — design constraints
5. `git log --oneline -15` — sanity-check recent commits

## Per-iteration job

### TDD discipline (required for every UI-TX task)

1. Read the task in the plan. Note the exact files to create/modify.
2. **Write the failing test first.** Run it. Confirm it fails for the expected reason.
3. **Write the minimal implementation.** Run the test. Confirm it passes.
4. Run all five gates: `typecheck`, `npm test -- --run`, `check-context-doc`, `test:e2e`, `build`. ALL must pass.
5. For Phase 2/3 tasks: verify visually via Playwright MCP — click the button, hover it, observe 4-state styling (idle/hover/pressed/disabled).
6. Commit with the message format from the plan (`feat(phaser): [UI-TX] <description>`).
7. Update `RALPH_PROGRESS.md` with `[x]` and the commit SHA.

## Verify before check-off

```
cd phaser && npm run typecheck    # must pass
cd phaser && npm test -- --run    # must pass
cd phaser && npm run check-context-doc  # must pass
cd phaser && npm run test:e2e     # must pass
cd phaser && npm run build        # must pass
```

If any gate fails: investigate root cause; do NOT bypass with `--no-verify`. If genuinely stuck, mark `🚧 BLOCKED: <reason>` and pick the next non-blocked item.

## Drift safeguards — emit `<promise>NEEDS_HUMAN_REVIEW</promise>` if any

- **3+ consecutive `🚧 BLOCKED:` markers**
- **Tests fail on HEAD at iteration start** (previous iteration committed broken code)
- **Performance gate exceeded by >50%** (spec ceiling +75 KB gzipped; if you breach by >37 KB, stop)
- **You're tempted to add a button or menu to Phaser canvas** — that violates the spec's architectural fence

## Architecture rules (from CONTEXT.md + new spec)

- **All UI is React DOM** with react-aria-components, Tailwind data-[*]: variants, Framer Motion. No buttons in canvas.
- **Phaser is `BoardScene` only** — tiles, units, animations, camera, terrain, in-world floating numbers. Spatial pickers (tile click, unit click) stay on canvas; UI buttons do not.
- **Three Zustand stores** with single dispatch each
- **Pure systems** in `src/systems/` and `src/procgen/` — no Phaser, no React, no I/O
- **Combat is a reducer** over `CombatEvent` discriminated union
- **`Math.random()` lint-banned** — use `RNG` parameters
- **Cross-system writes** via `src/contracts/` types
- **Forbidden imports**: raw `react-aria-components` and `react-aria` outside `src/ui/components/` (lint-enforced after T9)

## Final reminders

- Same prompt every iteration. Memory = files + git
- Iteration = one task; multiple commits OK if a task has multiple steps
- TDD: failing test first, then implementation
- All five gates pass before check-off
- Promise = `<promise>UI-INPUT-FIXED</promise>` when:
  - All UI-T1 through UI-T29 are checked off
  - All 4 user-visible criteria from the spec pass (4-state UI, keyboard nav, no click lost mid-tween, touch parity)
  - All performance gates green
  - Tag `phaser-ui-input-fixed` pushed
  - Visual playthrough recorded
