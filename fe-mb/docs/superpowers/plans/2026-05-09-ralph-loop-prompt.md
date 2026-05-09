# Ralph Loop Prompt — FE_MB Polish & Interactivity Pass

> Same prompt fed every iteration. Vertical slice was tagged at `phaser-vertical-slice`. This pass: fix interactivity bugs and polish UI to game-feel quality using design skills.

You are polishing the FE_MB phaser game to "actually playable" quality. Each iteration completes ONE item from `RALPH_PROGRESS.md` end-to-end.

## Required reading every iteration

1. `phaser/CONTEXT.md` — architecture invariants, store ownership, contracts
2. `RALPH_PROGRESS.md` — find next unchecked item
3. `phaser/README.md` — vertical slice scope reminder
4. `git log --oneline -15` — sanity-check recent commits

## Per-iteration job

### For UI-XX items (design + implementation)

1. **Invoke a design Skill FIRST.** Each UI item names which skill to use (e.g. `frontend-design`, `refactoring-ui`, `bolder`, `colorize`, `polish`, `godot-battle-ui`, `creating-dashboards`). Use `Skill` tool to invoke. Read the skill's guidance.
2. Apply the skill's recommendations to the relevant React component or Phaser scene.
3. Verify with Playwright MCP screenshot that the scene now looks game-feel quality (not bare DOM forms).
4. Run all gates.
5. Commit with message: `feat(phaser): [UI-XX] <component> polished via <skill>`.
6. Update RALPH_PROGRESS.md with `[x]` and SHA.

### For B-XX bugs (TDD)

1. Reproduce the bug (write a failing test or describe the broken interaction).
2. Implement the fix.
3. Verify the test passes / interaction works in browser via Playwright MCP.
4. Run all gates.
5. Commit `fix(phaser): [B-XX] <description>`.

### For F-XX functional gaps

1. Read the relevant spec section (often `docs/superpowers/specs/2026-03-29-ship-plan-design.md`).
2. TDD on pure systems; visual snapshot on UI.
3. Multi-commit allowed within an iteration.
4. Verify gates + visual.
5. Commit.

## Verify before check-off

```
cd phaser && npm run typecheck    # must pass
cd phaser && npm test              # must pass
cd phaser && npm run check-context-doc  # must pass
cd phaser && npm run test:e2e      # must pass
cd phaser && npm run build         # must pass
```

If any gate fails: mark `🚧 BLOCKED: <reason>` and pick next non-blocked item.

## Drift safeguards — emit `<promise>NEEDS_HUMAN_REVIEW</promise>` if any

- **3+ consecutive `🚧 BLOCKED:` markers**
- **Tests fail on HEAD at iteration start** (previous iteration committed broken code)
- **You skip the design skill on a UI-XX item** — that's the whole point. If a UI skill genuinely doesn't fit, mark `⏸ NEEDS-CONTEXT: <which skill alternative>`
- **Visual screenshot shows scene unchanged** after UI iteration — the skill output didn't land in code

## Architecture rules (from CONTEXT.md)

- **Combat = Phaser canvas only.** Everything else = React DOM with Tailwind/inline-styles
- **Three Zustand stores** with single dispatch each
- **Pure systems** in `src/systems/` and `src/procgen/` — no Phaser, no React, no I/O
- **Combat is a reducer** over `CombatEvent` discriminated union
- **`Math.random()` lint-banned** — use `RNG` parameters
- **Cross-system writes** via `src/contracts/` types

## On the canvas-vs-DOM debate

The user previously suggested moving everything to canvas. The architecture stays as-is (combat=canvas, rest=React) because canvas-only menus are 10× the implementation cost for marginal feel gains. The fix is to make React+Tailwind LOOK game-feel via design skills. If a specific scene genuinely needs canvas (e.g. animated background particles overlay), add a Phaser overlay scene without replacing React for the layout.

## Final reminders

- Same prompt every iteration. Memory = files + git
- Iteration = one item, multiple commits OK
- UI items REQUIRE a design skill invocation before code
- All five gates pass before check-off
- Promise = `<promise>GAME-POLISHED</promise>` when checklist drained + visual playthrough verified
