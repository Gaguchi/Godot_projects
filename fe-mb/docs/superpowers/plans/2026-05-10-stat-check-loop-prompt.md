# FE_MB Stat Check System — Ralph Loop Prompt

Execute the **Stat Check System** plan at `docs/superpowers/plans/2026-05-10-stat-check-system-plan.md`. Read it every iteration and follow it exactly. Spec at `docs/superpowers/specs/2026-05-10-stat-check-system-design.md`.

## Execution rules

- **One SC-* task per iteration**, end-to-end via TDD: failing test first → implementation → all six gates → commit with `[SC-N]` message → mark task done.
- **Six gates**: typecheck + unit tests + e2e + check-context-doc + build + perf-gates. ALL must be green before commit.
- **Architectural invariants** (from `phaser/.claude/CLAUDE.md`):
  - All UI in React DOM via `src/ui/components/` wrappers (no raw react-aria-components in feature code)
  - Phaser is BoardScene only
  - Three Zustand stores with single dispatch each (no `setState` in feature code)
  - Pure systems in `src/systems/` and `src/procgen/`
  - `Math.random` forbidden — use injected RNG
  - Cross-system writes go through `src/contracts/`
  - CONTEXT.md updates land in same commit as exported-name changes
- **Drift safeguards**: emit `NEEDS_HUMAN_REVIEW` (not the promise) if 3+ consecutive iterations are BLOCKED, OR tests fail at HEAD start, OR bundle exceeds ceiling by >50 KB.
- **Discovery work**: if a task references an effect (`forceBattle`, `setFlag`) that doesn't exist, add a sub-task to implement it within the same SC-N task. Do not skip silently.

## Completion criteria

Output `<promise>STAT-CHECK-COMPLETE</promise>` ONLY when ALL of the following are TRUE:

1. SC-1 through SC-10 all committed with `[SC-N]` tags in commit messages
2. All six gates green at HEAD
3. `domain/check.ts` exports CheckRequirement, CheckAttempt, CheckCandidate, StatKey
4. `systems/checkResolver.ts` exports evaluateCheck + getCheckCandidates, both pure
5. `lck` field present on UnitStats; classes.json has lck base + growth for all 4 classes
6. DialogueChoice schema migrated; old `DialogueBranch` type removed; `bandit_threat.json` re-authored with new shape; partyStatTotal no longer called from dialogueRunner
7. CheckButton, CheckCandidatePicker, CheckEventModal all exist + tested
8. Travel encounter `checkEvent` outcome supported + 2 authored encounters in `borderlands_road.json`
9. Dungeon room event support + 1 authored event each in `smugglers_cave.json` and `ancient_ruins.json`
10. Post-victory `victoryEvent` supported + `interrogate_survivor.json` authored + at least 1 enemy group references it
11. ≥5 authored check-event content files total
12. Visual playthrough captured covering all 4 surfaces (dialogue, travel, dungeon, post-victory) — screenshots saved
13. `phaser-stat-checks` git tag created at the final commit
14. NO `partyStatTotal` references remain in `src/`
15. NO `DialogueBranch` references remain in `src/`

## Anti-cheat

The promise is a literal commitment. Do NOT emit it if:
- Any test is failing
- Any gate is yellow/red
- Any SC-N task has a checkbox unchecked in the plan
- The visual playthrough has not actually been performed (i.e. no screenshots in the repo)
- The user has not seen the final tag

If you think you're stuck, output `NEEDS_HUMAN_REVIEW` and stop the loop. The user can unstick.

## Iteration cadence

Each iteration:
1. Read the plan; identify the lowest unchecked SC-N task
2. Read all files the task touches
3. Write failing tests
4. Implement
5. Run gates
6. Commit
7. Update plan checkbox
8. Either move to next task in same iteration (if cheap) or stop and let the loop reschedule

Be aggressive about parallel reads (use multiple Read/Grep in one tool block). Be conservative about commits (one task = one commit minimum).
