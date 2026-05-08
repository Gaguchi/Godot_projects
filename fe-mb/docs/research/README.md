# Research Deliverables

> Short, focused research artifacts that block specific implementation tasks. Each is 1–2 pages, concrete, with a clear deliverable.

## Foundation Milestone Deliverables

| # | Topic | File | Status | Blocks |
|---|---|---|---|---|
| 1 | Slay the Spire procgen rules | `sts-procgen.md` | `[STUB]` | Real `dungeonGenerator.ts` (foundation ships a stub linear corridor; real procgen requires this research) |
| 2 | Roguelite RNG strategies | `roguelite-rng.md` | `[STUB]` | RNG hierarchy validation (informs CONTEXT.md §5) |
| 3 | Existing Godot quest system audit | `godot-quest-audit.md` | `[STUB]` | `QuestDef` schema finalization in TS |
| 4 | Stat growth math | `stat-growth-math.md` | `[STUB]` | Leveling system (post-foundation milestone) |
| 5 | Enemy scaling curves | `enemy-scaling-curves.md` | `[STUB]` | Difficulty tuning (post-foundation milestone) |

## Process

1. A research deliverable is commissioned (council subagent, web research, code audit, or human research).
2. The output lands as a markdown file in this directory.
3. The dependent implementation task references the file in its plan.
4. CONTEXT.md is updated if the research informs an architectural section.

## Working Spec

See `../superpowers/specs/2026-05-08-phaser-foundations-v2-design.md` §25 for the full research mandate.
