# Ralph Ship Plan — Design Spec

> Phased Ralph Loop runs to drive the FE_MB phaser game from foundation v2 (tagged `phaser-foundations-v2`) to vertical-slice parity with the Godot version. Six phases, each its own Ralph Loop run with a precise completion promise, ~50–120 iterations per phase.

**Status:** Approved 2026-05-09
**Author:** Project owner + Claude Code (brainstorming)
**Builds on:** `2026-05-08-phaser-foundations-v2-design.md` (foundation), `2026-03-29-ship-plan-design.md` (game design)
**Reference codebase:** the legacy Godot codebase at the repo root is behavior ground-truth (read for understanding; never port mechanically — the foundation's TS architecture is authoritative).

---

## 1. Scope envelope: Godot parity vertical slice

The deliverable is a complete playable run from title screen to ending, matching the feature surface that ships in the Godot version (per `MEMORY.md` and the live Godot code at the repo root). This is NOT the full ship plan with 39 gear items + 9 classes + 3 quests — that's the next milestone after this one. Vertical slice content depth:

**In scope (parity with Godot):**
- Title screen with New Game / Load Game / Quit
- Overworld scene rendering (tile-based, location nodes, pawn movement)
- Travel-hop encounter system (per-hop probability rolls, dialogue or combat)
- Combat scene rendering (14×10 grid, real card animations, HP bars, damage numbers, hit-flash, camera shake, AOE preview, target reticle, card hand UI, capture flow)
- Town menus (Inn, Shop, Tavern with bounty board, recruitment stub)
- Grid inventory (8×4 drag-drop using dnd-kit)
- Quest engine end-to-end with Blood Ties as the working flagship
- Dialogue UI (text box, predicate-gated choices, effect dispatch)
- Slay the Spire-style dungeon (per research deliverable #1: 15 rows + boss, 6 paths, full reveal, room types)
- Permadeath flow + capture mechanic + recruit-from-tavern
- Save/load (foundation provides the format; Phase 6 polishes UX)
- E2E coverage of every flow + visual snapshot suite for major scenes
- Content: 5 towns, 3+ travel events, Blood Ties full quest, ~9 classes (full Godot starter set), enough gear for combat to feel real (~15–20 items), 5+ enemy groups, 1 dungeon

**Out of scope (deferred to later milestones):**
- Full 39-gear catalog — vertical slice ships with ~15–20 items
- 2 additional quests beyond Blood Ties
- Audio routing and SFX
- Save migration ladder (pre-alpha policy stays: nuke saves with warning on schema change)
- Steam packaging
- Mobile / Steam Deck targeting
- Localization
- Tutorial polish
- Achievement system
- Procgen overworld (overworld stays hand-authored JSON)

## 2. Three artifacts

The Ralph Loop produces and maintains three repo files:

### 2a. This spec (`docs/superpowers/specs/2026-05-09-ralph-ship-plan-design.md`)
Written once at the start of phase 1, never edited after. Authoritative scope envelope, phase definitions, completion criteria, references.

### 2b. `RALPH_PROGRESS.md` at repo root
The living checklist Ralph drains. Phased markdown structure:

```markdown
# Ship Progress

> Read this file each iteration. Pick the next unchecked item under the active phase. Update with completion SHA + timestamp on check-off.

**Active phase:** Phase 1 — Title + Combat Scene Rendering

## Phase 1 — Title + Combat Scene Rendering

- [x] **P1-01** Title screen scaffolding (Vite route, React shell mount) — `abc1234` 2026-05-09
- [ ] **P1-02** New Game button → metaStore.dispatch(startNewRun) → boot CombatScene with stub battle
- [ ] **P1-03** Combat scene: render units as Phaser sprites at grid positions
- ...

## Phase 2 — Overworld Scene
[locked until Phase 1 promise fires]

...
```

Each item has an ID (`P1-01`, `P3-12`), a description, and once checked, the commit SHA + ISO date. `BLOCKED:` and `NEEDS-CONTEXT:` prefixes are reserved for items Ralph couldn't complete.

### 2c. `docs/superpowers/plans/2026-05-09-ralph-loop-prompt.md`
The prompt Geoffrey's pattern feeds repeatedly. ~30 lines. Contains: required-reading order, per-iteration steps, validation rules, completion-promise format. Same content every iteration; the loop's "memory" lives in `RALPH_PROGRESS.md` + git history + CONTEXT.md.

## 3. The six phases

Each phase = one Ralph Loop run with `--max-iterations 100` (cap; typical phase lands in 50–80) and a phase-specific completion promise. Human review + tag between phases.

### Phase 1 — Title + Combat Scene Rendering (~80–100 iterations)

**Goal:** Player can launch the game, click New Game, and see/play one full battle to completion with real visuals.

**In scope:**
- Title screen with New Game / Load Game (placeholder stub) / Quit buttons
- Combat scene renders 14×10 grid with terrain colors per `TerrainTile.kind`
- Units rendered as Kenney sprites at their `position` tile
- HP bars above each unit
- Card hand UI at bottom of screen — fan layout, hover lift, click to select
- Target selection: highlight valid tiles per `targeting.validTargets`, AOE preview ring on hover, ESC to cancel
- Card resolution: real animations (sprite tween toward target, hit-flash on impact, floating damage number, camera shake on big hits)
- AP indicator + end-turn button
- Death: sprite fade-out, removal from grid
- Victory/defeat React modals via existing phase-machine
- Stub battle bootstrapped from data/content (3 units vs 3 enemies)

**Completion promise:** `<promise>PHASE-1-TITLE-COMBAT-COMPLETE</promise>` fires when:
- All P1 checklist items are checked
- `npm run typecheck && npm test && npm run test:e2e && npm run check-context-doc && npm run build` all pass
- Visual snapshot suite covers title screen + 3 combat states (idle, card-selected-with-targets, post-resolution)

### Phase 2 — Overworld Scene (~50–70 iterations)

**Goal:** Player can travel between location nodes; travel rolls trigger combat or dialogue.

**In scope:**
- Tile-based overworld rendering (Kenney terrain tiles per existing `WorldMap` schema)
- Location nodes drawn at `WorldNode.position` with type-coded icons (TOWN/CAMP/DUNGEON/EXIT)
- Click-to-travel: pawn animates along path between adjacent connected nodes
- Per-hop encounter rolls using `deriveRng(runRng, 'hop:' + hopIndex)` against `WorldEdge.encounterTableId`
- Encounter resolution: combat scene boot via `CombatBootRequest` with `returnTo` set; dialogue scene for non-combat events
- Return-to-overworld on victory restores `pendingTravelPath` and continues
- Visited nodes marked with checkmark; current position highlighted
- One stub overworld map with ~5 locations + 1 stub dungeon node

**Completion promise:** `<promise>PHASE-2-OVERWORLD-COMPLETE</promise>` fires when checklist drained + tests/e2e cover travel-to-combat-and-back loop with deterministic seed.

### Phase 3 — Town Menus + Grid Inventory Drag-Drop (~60–80 iterations)

**Goal:** Player can visit a town, heal at the inn, buy/sell at the shop, accept a quest at the tavern.

**In scope:**
- Town scene React layout (Mount-and-Blade-style sidebar + content panel)
- Inn panel: heal all party (8g per unit), gold deduction, button disabled if insufficient gold
- Shop panel: buy/sell with item detail view, regional inventory filter (per `Item.region`), grid inventory integration
- Tavern panel: rumors (flavor text), quest accept (Blood Ties available at Pine Crossing), bounty board (turn in captured enemies for gold), recruitment stub (locked, "coming soon")
- Grid inventory UI: 8×4 cell grid, items occupy `gridSize.width × gridSize.height` cells, drag-drop via dnd-kit, "Bag full" overlay if no fit, "Organize" auto-pack button
- Hand-slot equip flow: drag item from bag onto unit portrait, fires `equipHand` action
- Town JSON schema + 1 working town (Pine Crossing)

**Completion promise:** `<promise>PHASE-3-TOWNS-COMPLETE</promise>` fires when checklist drained + e2e covers buy → equip → sell → leave-town round trip + drag-drop snapshots locked.

### Phase 4 — Quest Engine + Dialogue UI (~50–70 iterations)

**Goal:** Blood Ties end-to-end. Quest accepted at tavern, indicator shows on map, encounter triggers dialogue, choices advance stage, completion grants reward.

**In scope:**
- Dialogue UI React component: text box, speaker portrait, choice buttons gated by `visibleIf` / `enabledIf` predicates
- Quest log overlay (open with Q key or button), shows active quest list with stage descriptions
- Map node `!` indicators driven by `QuestDef.location_indicators` filtering on current stage
- Quest node spawning: `QuestEffect.spawnNode` adds a `WorldNode` to active map at runtime
- Wire DomainEvent flow: `LocationArrived` → questRunner → predicate match → emit QuestEffect → dispatch back to runStore
- Blood Ties content port: `data/content/quests/blood_ties.json` + `data/content/dialogue/sq_blood_ties_*.json` translated from Godot JSON to TS schemas (apply research deliverable #3 audit findings)
- Capture-target plumbing: combat-end `BattleVictory` event with capturedIds → quest listener fires capture/kill dialogue branch

**Completion promise:** `<promise>PHASE-4-QUEST-DIALOGUE-COMPLETE</promise>` fires when Blood Ties is playable from accept to completion via either capture or kill branch + e2e covers both branches.

### Phase 5 — Dungeon Scene (StS map) (~50–70 iterations)

**Goal:** Player can enter a dungeon node from overworld, navigate the StS-style branching map, fight rooms, defeat the boss, return to overworld.

**In scope:**
- Real `dungeonGenerator.ts` per research deliverable #1: 15 rows + boss, 6 paths, validator pass, full reveal model, room weighting (Combat 60% / Event 25% / Rest 10% / Elite 5%)
- Dungeon scene React layout: map graph rendering with rooms as icons, edges drawn between, current position highlighted, valid-next rooms clickable
- Room types: Combat (boots CombatScene), Event (dialogue), Rest (heal 30%), Treasure (item drop), Elite (harder combat with epic loot), Boss (final encounter, win → exit dungeon)
- Quest-locked dungeon: Smuggler's Cave unlocks after Blood Ties completion (predicate gate)
- Dungeon-specific encounter pool (separate from overworld travel encounters)
- Return-to-overworld on dungeon clear (boss room cleared) or retreat (HP critical, optional retreat button)

**Completion promise:** `<promise>PHASE-5-DUNGEON-COMPLETE</promise>` fires when one full dungeon run (entry → 5+ rooms → boss → exit) plays end-to-end + procgen test asserts ≥6 paths and validator constraints.

### Phase 6 — Closeout (~80–120 iterations)

**Goal:** Permadeath, capture, recruitment, content fill to Godot parity, comprehensive E2E suite, visual snapshot lock.

**In scope:**
- Permadeath: fallen units removed from `runStore.party`, persisted in `deathLog`, run continues if at least 1 unit alive
- Capture mechanic UI: capture button on adjacent enemy, chance percentage shown, success → enemy added to `runStore.party.captured` for tavern turn-in
- Tavern bounty board: list captured enemies, "turn in" button → gold reward + emit `EnemyCaptured` event
- Recruitment system: tavern recruitment stub from Phase 3 becomes real — pay gold, choose from 2-3 random class options, unit joins party at level 1 with class innates + Common gear
- Content fill (Godot parity):
  - All 9 classes from Godot (LORD, KNIGHT, MAGE, FIGHTER, ARCHER, CAVALIER, CLERIC, THIEF, BOUNTY_HUNTER) with Godot-baseline stats + growth rates
  - 15–20 gear items (foundation has 10; add 5–10 more covering remaining weapon types and rarities)
  - 5 towns from Godot test_overworld.json
  - 5+ enemy groups
  - 3+ travel events
  - All Blood Ties dialogues
  - Slow + immobilize status effects (with their gear)
- Comprehensive E2E suite: Playwright tests for new game, town visit, accept quest, fight encounter, save/load mid-battle, dungeon clear, victory screen, death/restart
- Visual snapshot suite locked for: title, overworld, town (each panel), shop, inventory open, dialogue, quest log, dungeon map, combat (idle / card-selected / resolution), victory/defeat
- README updated with full vertical-slice scope; tag `phaser-ship-vertical-slice`

**Completion promise:** `<promise>SHIP-PARITY-COMPLETE</promise>` fires when checklist drained + ALL above content present + ALL gates pass.

## 4. Per-iteration loop pattern

The Ralph prompt (in `docs/superpowers/plans/2026-05-09-ralph-loop-prompt.md`) instructs Claude to do this every iteration:

1. **Read mandatory context** in this order:
   - `phaser/CONTEXT.md` (architecture invariants, store ownership, contracts)
   - `RALPH_PROGRESS.md` (active phase + next unchecked item)
   - This spec, the section for the active phase
   - `docs/superpowers/specs/2026-03-29-ship-plan-design.md`, the section relevant to the current item
   - `git log --oneline -10` to see what previous iterations did

2. **Pick the next unchecked item** under the active phase header in `RALPH_PROGRESS.md`. Skip items prefixed `BLOCKED:` or `NEEDS-CONTEXT:`.

3. **If the item is large** (estimated >1 hour or >5 files): split into sub-items, add them to `RALPH_PROGRESS.md` immediately under the parent (indented `  - [ ] **P1-03a** ...`), commit the checklist update, then start work on the first sub-item.

4. **Implement** following project conventions:
   - TDD on pure systems (test first → fail → implement → pass)
   - Visual snapshot for UI tasks (Playwright snapshot test for the new component)
   - Use `useRunStore.dispatch` / `useCombatStore.dispatch` for state mutations
   - Cross-system writes via `src/contracts/` types
   - No `Math.random()` (lint blocks it)
   - One commit per checklist item

5. **Verify before commit**:
   - `cd phaser && npm run typecheck` — must pass
   - `cd phaser && npm test` — must pass
   - `cd phaser && npm run check-context-doc` — must pass (update `phaser/CONTEXT.md` if drift)
   - For UI tasks: `cd phaser && npm run test:e2e` — must pass
   - If any fail: fix in this iteration, OR mark item `BLOCKED: <reason>` in checklist and pick the next non-blocked item

6. **Commit** with conventional message: `feat(phaser): [P3-12] shop panel with regional filter`. The bracketed item ID makes the commit traceable to the checklist.

7. **Update `RALPH_PROGRESS.md`**: replace `- [ ]` with `- [x]`, append `— <commit-sha> <iso-date>`. Commit the progress update too (or include in the same commit if practical).

8. **Check phase completion**: if all items under the active phase header are checked AND all five npm gates pass, emit `<promise>PHASE-N-...-COMPLETE</promise>`. Otherwise just exit; the loop refeeds the prompt for the next iteration.

## 5. Drift safeguards

Five mechanisms keep iterations on-track:

1. **Mandatory CONTEXT.md read every iteration** — Claude can't drift from the architecture invariants because they're loaded fresh each time.
2. **Test gate before commit** — broken tests block check-off. No fake progress.
3. **Recent-commit review at iteration start** — Claude reads `git log -10` and sanity-checks the previous iteration's work before piling on.
4. **Auto-pause on triggers** — emit `<promise>NEEDS_HUMAN_REVIEW</promise>` if any of:
   - 3+ consecutive `BLOCKED:` markers added under the active phase
   - 3 consecutive iterations with `npm test` failing
   - `check-context-doc` fails for 2 iterations in a row
   - Active phase iteration count exceeds `--max-iterations` cap
5. **Godot reference is read-only** — the prompt explicitly: "the Godot codebase is BEHAVIOR REFERENCE not source of truth. Read it to understand intent. Rewrite fresh in the foundation's TS architecture (three stores, predicate AST, contracts module, etc). Never copy-paste. Never assume Godot's solution is correct in TS."

## 6. Branch strategy

**One branch, linear history, tag at phase boundaries.**

The Ralph Loop runs on `feature/phase1-equipment-cards` (the existing foundation branch). Each phase commits accumulate. At each phase completion promise:
- Human reviews the work, runs the actual game in browser, plays through the new flow
- If approved: `git tag -a phaser-ship-phase-N -m "Phase N: <name> complete"`
- Next phase Ralph Loop launched

Tags after vertical slice ships: `phaser-ship-phase-1` through `phaser-ship-phase-6`, plus `phaser-ship-vertical-slice` on the final commit.

## 7. Running a phase loop

User invokes:

```
/ralph-loop "$(cat docs/superpowers/plans/2026-05-09-ralph-loop-prompt.md)" --max-iterations 100 --completion-promise "PHASE-1-TITLE-COMBAT-COMPLETE"
```

(or the equivalent for the active phase). Between phases:
1. Inspect work: `git log phaser-ship-phase-(N-1)..HEAD --oneline`, run game in browser, run all tests
2. If anything broken: fix manually OR re-launch the same phase loop with a more pointed prompt
3. If all good: tag, then launch next phase loop

## 8. Risks

- **Compounding drift across iterations** — addressed by safeguards in §5; further mitigated by phase boundaries (each phase is a fresh start).
- **Checklist file editing race** — Ralph might edit `RALPH_PROGRESS.md` mid-edit if interrupted. Mitigation: each iteration commits checklist changes atomically with the implementation.
- **Test flakes** — flaky E2E tests could falsely block check-off. Mitigation: test stability is itself a checklist item in Phase 6 (E2E suite).
- **Phase 1 too big** — 80–100 iterations is the largest. If it overruns, we split into 1a (title + combat boot) and 1b (combat rendering + animations + UI) and re-spec.
- **Content authoring fatigue** — Phase 6 has substantial content authoring. If it bogs down, can be split into 6a (systems closeout) and 6b (content fill).
- **Godot reference temptation** — risk Claude copies Godot patterns wholesale. Mitigation: §5 safeguard #5 + per-iteration code review (the implementer self-reviews; humans spot-check at phase boundaries).

## 9. Success criteria for the vertical slice

The full ship is "done" when all of:

1. All 6 phase completion promises have fired in order
2. `phaser-ship-vertical-slice` tag exists
3. A human has played from title screen to ending credits at least once with no fatal crashes
4. `npm run typecheck && npm test && npm run test:e2e && npm run check-context-doc && npm run build` all pass on the tagged commit
5. Visual snapshot suite covers all major scenes
6. Save/load works mid-battle, mid-overworld, and mid-dungeon
7. Permadeath actually removes units from subsequent runs
8. Blood Ties is completable via both capture and kill branches

If any gate fails after Phase 6, file the gap as a follow-up issue and re-launch Phase 6 with a focused prompt; don't paper over.

## 10. After vertical slice

Post-slice, the next milestone is **Full Ship** (per ship plan §17 phases 4–6): expand to all 39 gear items, 2 additional quests beyond Blood Ties, audio routing, balance pass, external playtest. That's a separate spec + Ralph Loop campaign. Out of scope here.
