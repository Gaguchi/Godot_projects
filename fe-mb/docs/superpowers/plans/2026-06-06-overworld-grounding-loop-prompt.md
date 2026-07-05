# FE_MB Overworld Grounding — Ralph Loop Prompt

Execute the **Overworld Grounding** plan at `docs/superpowers/plans/2026-06-06-overworld-grounding.md`. Read it every iteration and follow it exactly. Spec: `docs/superpowers/specs/2026-06-06-overworld-grounding-design.md`. Research: `docs/research/2026-06-06-overworld-grounding-research.md`.

## Execution rules

- **One task (T1…T13) per iteration**, end-to-end: failing test first where a pure function exists → implementation → gates → commit with `[grounding PN.M]` message → check the task's boxes.
- **Gates**: `npm run verify` (typecheck + typecheck:cli + lint:content + check-context-doc + unit) MUST be green before every commit. For visual tasks, ALSO capture a Playwright screenshot and confirm the intended change is visible (no console errors).
- **Architectural invariants** (`phaser/.claude/CLAUDE.md`):
  - Overworld = React DOM + SVG + Canvas. NO Phaser in the overworld. Combat stays Phaser.
  - Pure systems/helpers in `src/systems/` (no React/Phaser/I-O); `Math.random` forbidden.
  - Mutations through the store `dispatch` chokepoint; no `setState` in feature code.
  - **Terrain-only backdrop; SVG owns every road/socket/beacon.** NEVER bake roads, sockets, or nodes into a backdrop PNG.
  - CONTEXT.md updates land in the same commit as any exported-name change under `domain/state/systems/contracts`.
- **Value-staging rule:** value structure is composited in code (node-derived value mask), never trusted to the SDXL prompt. The greyscale legibility gate tests the *composited* result.
- **ComfyUI rules (Phase 2/3):** `--force-fp32 --lowvram`; one ControlNet only; `freeVram()` between every stage; never co-resident subsystems; light enforced by hand-selecting low-left bakes, not by prompt.

## The decision gate (Task 9) — do not skip

After the Borderlands proof bake, READ the generated PNGs and judge: painterly (not pixel/anime-flat) · key light low-left · clearings reserved · dark-fantasy. Then resolve the ladder:
- **Pass → Diorama** (continue Phase 3 with the backdrop).
- **Oblique fights checkpoint → ALT B Lit Tabletop** (flatter re-bake, continue Phase 3 flat).
- **Can't paint landscape / clearings don't reserve → ALT A Polished Parchment** (polish `PaperMap`, skip backdrop `<img>` tasks).
Record the verdict at the top of the spec status line. The gate is judged on the ACTUAL image, never assumed.

## Drift safeguards

Emit `NEEDS_HUMAN_REVIEW` (not the promise) and stop if: 3+ consecutive iterations BLOCKED · `npm run verify` is red at iteration start · the ComfyUI server is unreachable for a Phase-2/3 bake task · a backdrop bake fails its judge criteria 5+ times in a row (surfaces the checkpoint risk — fall to ALT B/A rather than burning the GPU).

## Completion criteria

Output `<promise>OVERWORLD-GROUNDED</promise>` ONLY when ALL are TRUE:

1. **Phase 1 complete:** T1–T6 committed; nodes have offset contact shadows; roads carved (casing + comet/dotted state); caravan walks the curved road with continuous camera; one coherent key-lit field (no parchment/void conflict); `--key-light-angle` drives UI shadows.
2. `npm run verify` green at HEAD; `npm run test:e2e -- --grep overworld-grounding` green.
3. Full-width respread applied; `borderlands.json` topology intact (every edge resolves); `npm run lint:content` clean.
4. **Phase 2 gate resolved:** the proof bake was actually generated and judged; the ladder verdict (Diorama / Tabletop / Parchment) is recorded in the spec.
5. **Phase 3 per the verdict:** if backdrop path — hero backdrop + ≤2 parallax bands render, decode-current-region-only verified; node-derived value mask composited + greyscale gate passes; fog-of-war reveals on frontier arrival; all 3 regions present and stylistically cohesive (adversarial re-review passed). If Parchment path — all 3 regions have bespoke ink sheets tuned around nodes + double-line roads.
6. Before/after screenshots saved in the repo proving the map no longer floats.
7. A fresh adversarial agent has re-scored the final map against the failure-mode rules (research §1 / failure-modes report) and found no Critical issues.

## Anti-cheat

The promise is a literal commitment. Do NOT emit it if: any gate is yellow/red · any task checkbox is unchecked for the chosen path · the proof bake was assumed rather than generated+judged · the adversarial re-review has not actually run · before/after screenshots are not in the repo.

If stuck, output `NEEDS_HUMAN_REVIEW` and stop. The user can unstick (e.g. install a landscape checkpoint, or approve the ALT-A fallback).

## Iteration cadence

1. Read the plan; identify the lowest unchecked task on the CURRENT phase.
2. Read every file the task touches (parallel Read/Grep).
3. TDD where a pure function exists; implement; run gates; screenshot if visual.
4. Commit (one task = one commit minimum); check the boxes.
5. Continue to the next cheap task in the same iteration, or stop and let the loop reschedule.

Be aggressive about parallel reads. Be conservative about commits. Never fake the visual/bake judgment — read the actual pixels.
