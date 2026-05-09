# Ralph Loop Prompt — FE_MB Ship to Playable

> Same prompt fed every iteration. Your work persists in files + git. Read this carefully each time — it is your only briefing.

You are driving the FE_MB phaser game from foundation v2 (tagged `phaser-foundations-v2`) to a fully playable vertical slice with Godot parity. The completion promise tag is `<promise>GAME-PLAYABLE</promise>` and you may ONLY emit it when the game can be played title → run → win/lose without a crash AND all five gates pass on HEAD.

## Required reading every iteration

1. `phaser/CONTEXT.md` — architecture invariants, store ownership, contracts. Critical.
2. `RALPH_PROGRESS.md` (repo root) — find the next unchecked `- [ ] **F-XX**` item.
3. `docs/superpowers/specs/2026-05-09-ralph-ship-plan-design.md` — phase containing the active feature.
4. `docs/superpowers/specs/2026-03-29-ship-plan-design.md` — game-design source-of-truth, section relevant to the active feature.
5. `git log --oneline -15` — see what previous iterations did. Sanity-check that recent commits aren't broken.

## Per-iteration job: complete ONE FEATURE end-to-end

**An iteration is a feature, not a commit.** You will likely produce 3-10 commits in a single iteration. That's expected. The iteration is "done" when the feature is complete, all gates pass, and the checkbox is updated.

For the active F-XX feature:

1. **Read the feature description** in `RALPH_PROGRESS.md` carefully. The description names what's needed.
2. **If the feature is huge (>2 hour estimate)**: split into sub-items (`F-XXa`, `F-XXb`, ...) indented under the parent in `RALPH_PROGRESS.md`. Commit the checklist update. Then start work on the first sub-item, treating each sub-item as its own atomic implementation. The parent F-XX checks off when all sub-items are done.
3. **Implement** following project conventions:
   - **TDD on pure systems** (`src/systems/`, `src/procgen/`, `src/persistence/`, `src/contracts/`): test first → fail → implement → pass.
   - **Visual snapshot test (Playwright)** for new UI components.
   - **Use `useRunStore.dispatch` / `useCombatStore.dispatch` / `useMetaStore.dispatch`** for state mutations. Never mutate stores directly.
   - **Cross-system writes via `src/contracts/` types.**
   - **No `Math.random()`** — use `createRng` / `deriveRng`. Lint blocks it.
   - **Multiple commits per iteration are fine and encouraged** when atomic. Each commit message: `feat(phaser): [F-XX] <subscope>` or `test(phaser): [F-XX] <test description>`.
4. **Verify before iteration check-off**:
   ```
   cd phaser && npm run typecheck    # must pass
   cd phaser && npm test              # must pass
   cd phaser && npm run check-context-doc  # must pass (update phaser/CONTEXT.md if drift)
   cd phaser && npm run test:e2e      # must pass
   cd phaser && npm run build         # must pass
   ```
   If a gate fails after honest effort: mark item `🚧 BLOCKED: <one-line reason>` in `RALPH_PROGRESS.md` and pick the next non-blocked item. Do not commit broken code as "done."
5. **Update `RALPH_PROGRESS.md`**: change the F-XX line from `- [ ]` to `- [x]`, append ` — <last-commit-sha> <YYYY-MM-DD>` at the end. Commit the checklist update with message `chore(ralph): [F-XX] complete`.
6. **Check overall completion**:
   - All F-XX items are `[x]`
   - All five gates pass on HEAD
   - Manual playthrough script (final E2E in F-28) passes: title → new run → at least one combat → at least one town visit → at least one quest interaction → at least one win/lose → no crashes
   - If yes: emit `<promise>GAME-PLAYABLE</promise>`
   - If no: exit normally; loop refeeds prompt.

## Drift safeguards — emit `<promise>NEEDS_HUMAN_REVIEW</promise>` if any of these trigger

- **3+ consecutive `🚧 BLOCKED:` markers** added across recent iterations.
- **Tests fail on HEAD at iteration start** (a previous iteration committed broken code).
- **`check-context-doc` fails for 2 iterations in a row.**
- **You cannot identify the next item** after reading all required context (most items unclear, contradictions in spec, etc.).
- **A single feature has produced >20 commits** without check-off (you're spinning).

## Architecture rules (from `phaser/CONTEXT.md`)

- **Combat = Phaser canvas only.** Everything else (overworld, town, shop, inventory, deck preview, dialogue, modals) = React DOM with Tailwind/inline-styles.
- **Three Zustand stores:** `metaStore`, `runStore`, `combatStore`. Single `dispatch(action)` mutation each.
- **Pure systems** in `src/systems/` and `src/procgen/` — no Phaser, no React, no I/O.
- **Combat is a reducer** over discriminated `CombatEvent` union. Effects are intents to render, not state.
- **`CombatScene`** owns mutable `CombatRuntime` POJO (sprite refs, tween handles). NEVER reads store state per frame; subscribes to `lastEffectId` event channel.
- **Predicates are declarative AST** (`Predicate` type) — round-trip through save. Single evaluator: `evaluatePredicate(pred, state)`.
- **Domain events** flow through `eventBus`. Subscribers dispatch back to stores; bus is NOT a mutation channel.

## Reference codebase rule

The Godot codebase at the repo root is **behavior reference, not source of truth**.

- ✅ Read Godot files to understand intent ("what does the dialogue choice gate look like?")
- ✅ Reference Godot data files (`data/dialogue/*.json`, `data/quests/quest_definitions.json`, `data/maps/test_overworld.json`) as content templates to translate into TS
- ❌ Never copy-paste GDScript patterns into TypeScript
- ❌ Never assume Godot's solution is correct in the foundation's TS architecture
- ❌ Never edit any file outside `phaser/`, `docs/`, `RALPH_PROGRESS.md`, or research deliverables in `docs/research/`

## Be ambitious per iteration

This is the major change from the earlier prompt: previously each item was a single commit. Now each item is a **feature**. Examples:

- **F-02 (stub battle bootstrapper)**: ~3-5 commits internally — the bootstrapper module, integration with CombatScene, snapshot test for "scene boots with units in place," any small store wiring.
- **F-06 (card resolution animations)**: ~6-10 commits — one per effect handler, then chained `WaitForAnimations` glue, then a snapshot test of mid-resolution.
- **F-19 (Blood Ties content port)**: ~5-8 commits — quest JSON, each dialogue tree, gameStore wiring to load on boot, predicates verified against the existing `evaluatePredicate`.
- **F-29 (content fill to Godot parity)**: ~10-15 commits — one per class, one per item batch, one per town map, one per enemy group.

Don't artificially stop early. **Don't pause to summarize.** Keep going within an iteration until the feature is complete and all gates pass. Then update the checklist and exit. The loop refeeds and you tackle the next feature.

If after honest work a feature genuinely cannot be done in one iteration (some integration concern, some missing decision, some test you can't make pass), use the `🚧 BLOCKED:` or `⏸ NEEDS-CONTEXT:` markers — that's what they're for. Don't fake completion.

## Final reminders

- Same prompt every iteration. Your only "memory" is files + git.
- Iteration = feature, not commit. Multiple commits per iteration is the norm.
- The completion promise is `<promise>GAME-PLAYABLE</promise>`. Do NOT emit it falsely.
- All five gates must pass at iteration end. No broken commits.
- The Godot codebase is read-only reference.
