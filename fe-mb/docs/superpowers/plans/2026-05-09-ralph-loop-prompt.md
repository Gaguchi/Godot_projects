# Ralph Loop Prompt — FE_MB Ship Plan

> Same prompt fed every iteration. Your work persists in files + git history. Read this carefully each time — it is your only briefing.

You are working on the FE_MB phaser game ship plan, driving the project from foundation v2 (tagged `phaser-foundations-v2`) to vertical-slice parity with the Godot version.

## Required reading (every iteration, in this exact order)

1. `phaser/CONTEXT.md` — architecture invariants, store ownership, contracts. CRITICAL: every iteration. Without this you will drift.
2. `RALPH_PROGRESS.md` (repo root) — find the **active phase** marker, then the **next unchecked item** (`- [ ] **Pn-XX** ...`).
3. `docs/superpowers/specs/2026-05-09-ralph-ship-plan-design.md` — read the §3 section for the active phase. This is the spec for what you are building.
4. `docs/superpowers/specs/2026-03-29-ship-plan-design.md` — read the section relevant to the current item (game design source-of-truth).
5. `git log --oneline -10` — see what the previous iterations did. Sanity-check that recent commits aren't broken.

## Per-iteration steps

1. Read all five mandatory contexts above.
2. Pick the **next unchecked item** under the active phase header in `RALPH_PROGRESS.md`. Skip items prefixed `🚧 BLOCKED:` or `⏸ NEEDS-CONTEXT:`. Items go top-to-bottom in dependency order — pick the first eligible one.
3. **If the item looks large** (>1 hour or >5 files): split into sub-items in `RALPH_PROGRESS.md` (indented two spaces under the parent, e.g. `  - [ ] **P1-12a** ...`), commit the checklist update, then start work on the first sub-item.
4. **Implement** following project conventions:
   - **TDD on pure systems** in `src/systems/`, `src/procgen/`, `src/persistence/`, `src/contracts/` — write failing test first, run it to confirm fail, implement minimal code to pass, run again, commit.
   - **Visual snapshot test (Playwright)** for UI tasks. New component? Add a snapshot before commit.
   - Use `useRunStore.dispatch` / `useCombatStore.dispatch` / `useMetaStore.dispatch` for state mutations. Never mutate stores directly.
   - Cross-system writes go through `src/contracts/` types (`BattleResult`, `RecruitmentResult`, `PendingTravelPath`, `CombatBootRequest`, `DomainEvent`).
   - No `Math.random()` anywhere — use `createRng` / `deriveRng` with a seeded `RNG`. Lint blocks it.
   - **One git commit per checklist item.** Atomic, traceable, revertable.
5. **Verify before committing**:
   ```
   cd phaser && npm run typecheck    # must pass
   cd phaser && npm test              # must pass
   cd phaser && npm run check-context-doc  # must pass (update phaser/CONTEXT.md if drift)
   cd phaser && npm run test:e2e      # must pass for UI tasks
   ```
   If any gate fails and you cannot fix it this iteration: mark the item `🚧 BLOCKED: <one-line reason>` in `RALPH_PROGRESS.md` and pick the next non-blocked item. Do not commit broken code.
6. **Commit**:
   ```
   git add <relevant files> RALPH_PROGRESS.md
   git commit -m "feat(phaser): [Pn-XX] <description>"
   ```
   The bracketed item ID makes the commit traceable to the checklist. Replace `n` with the active phase number.
7. **Update `RALPH_PROGRESS.md`**: change the item from `- [ ]` to `- [x]`, append ` — <short-commit-sha> <YYYY-MM-DD>` after the description. Commit the checklist update in the same commit where practical.
8. **Check phase completion**:
   - All items under the active phase header are `[x]` (no `[ ]` left under it)
   - All five gates pass: typecheck, test, test:e2e, check-context-doc, build
   - If both: emit `<promise>PHASE-N-XYZ-COMPLETE</promise>` using the exact promise tag for the active phase per spec §3 (Phase 1 = `PHASE-1-TITLE-COMBAT-COMPLETE`, etc.).
   - If not: exit normally; the loop refeeds this prompt next iteration.

## Drift safeguards — emit `<promise>NEEDS_HUMAN_REVIEW</promise>` if any of these trigger

- **3+ consecutive `🚧 BLOCKED:` markers** added under the active phase header.
- **3 consecutive iterations** with `npm test` failing.
- **`check-context-doc` fails for 2 iterations in a row.**
- **You cannot identify the next item to work on** after reading all required context (most items unclear, contradictions in spec, etc.).
- **A commit you made in a previous iteration appears broken** when you run tests at the start of this iteration.

## Architecture rules (from `phaser/CONTEXT.md` — repeated here for emphasis)

- Combat = Phaser canvas only. Everything else (overworld, town, shop, inventory, deck preview, dialogue, modals) = React DOM with Tailwind.
- Three Zustand stores: `metaStore`, `runStore`, `combatStore`. Single `dispatch(action)` mutation each.
- Pure systems in `src/systems/` and `src/procgen/` — no Phaser, no React, no I/O.
- Combat is a reducer over discriminated `CombatEvent` union. Effects are intents to render, not state.
- `CombatScene` owns mutable `CombatRuntime` POJO (sprite refs, tween handles). NEVER reads store state per frame; subscribes to `lastEffectId` event channel.
- Predicates are declarative AST (`Predicate` type) — round-trips through save. Single evaluator: `evaluatePredicate(pred, state)`.
- Domain events flow through `eventBus`. Subscribers dispatch back to stores; bus is NOT a mutation channel.

## Reference codebase rule

The legacy Godot codebase at the repo root is **behavior reference, not source of truth**.

- ✅ Read Godot files to understand intent ("what does the dialogue choice gate look like?")
- ✅ Reference Godot data files (`data/dialogue/*.json`) as content templates to translate into TS
- ❌ Never copy-paste GDScript patterns into TypeScript
- ❌ Never assume Godot's solution is correct in the foundation's TS architecture
- ❌ Never edit any file outside `phaser/`, `docs/`, `RALPH_PROGRESS.md`, or research deliverables in `docs/research/`

## When you don't understand the next item

If after reading all five required contexts the next checklist item is genuinely unclear:
1. Mark it `⏸ NEEDS-CONTEXT: <what's missing>` in `RALPH_PROGRESS.md`
2. Pick the next non-blocked item
3. If 3+ items in a row hit `NEEDS-CONTEXT`: emit `<promise>NEEDS_HUMAN_REVIEW</promise>`

## Final reminders

- Same prompt every iteration. Your only "memory" is files + git.
- The checklist is the source of truth for "what's next."
- The spec (`2026-05-09-ralph-ship-plan-design.md`) is the source of truth for "what's in scope."
- Code wins on disagreement with docs. Update the doc.
- One commit per checklist item. Tests must pass before commit.
- Never edit Godot files outside the read-only reference zone.
- The completion promise tag is your only way out. Don't fake it.
