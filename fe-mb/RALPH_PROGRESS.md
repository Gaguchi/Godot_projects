# Ship Progress — Vertical Slice (Godot Parity)

> **Single Ralph Loop** runs against this checklist. Each unchecked item is **one feature**, not one commit — Ralph completes the whole feature end-to-end (multiple files, multiple commits internally) before checking off.
>
> **Spec:** `docs/superpowers/specs/2026-05-09-ralph-ship-plan-design.md`
> **Loop prompt:** `docs/superpowers/plans/2026-05-09-ralph-loop-prompt.md`
> **Completion promise:** `<promise>GAME-PLAYABLE</promise>` when all items checked + all gates pass + a human can play title → run → win/lose.

Read this file each iteration. Pick the next unchecked item. Build the entire feature. All gates must pass before check-off. Mark blockers `🚧 BLOCKED: <reason>` and skip. Mark unclear items `⏸ NEEDS-CONTEXT: <missing>` and skip.

---

## A. Combat Layer (Phaser canvas)

- [x] **F-01** Title screen + run lifecycle: title view, New Game / Load Game placeholder / Quit, view-state slice + ViewContext, transition to combat on New Game — `9a65fe3` 2026-05-09 (already complete)
- [x] **F-02** Stub battle bootstrapper + initial unit placement. `seedStubBattle.ts` constructs 3 party (Roy/Marcus/Lilina from data/content/classes.json) + 3 enemies (Bandit class), 14×10 grid with terrain, dispatches `combatStore.startBattle` with `runStore.rngState`. CombatScene `create()` invokes seedStubBattle. Spawn zones: party left columns 0-2, enemy right columns 11-13. — `e1e4433` 2026-05-09
- [x] **F-03** Grid + units rendering: terrain tiles colored per `TerrainTile.kind`; party + enemy sprites (Kenney pack or coloured rects) at their `position` tile; `tileToWorld` helper; HP bars above each unit; active-turn glow ring on `state.turn.unitId`; subscriber pattern via `subscribeWithSelector(s => s.lastEffectId)`. — `6487457` 2026-05-09
- [x] **F-04** Card hand UI in CombatScene: 5 cards at bottom in fan layout per active party unit, each card shows name + AP cost + damage preview, hover lift + dim siblings, click → `selectCard`, selected glow, AP-unaffordable greyed out, refresh on draw/discard. — `1dcd7e7` 2026-05-09
- [x] **F-05** Targeting UX: when `subPhase === 'SELECTING_TARGET'`, highlight valid tiles (amber) per `targeting.validTargets`; AOE preview (purple ring) on tile hover for cards with `aoeRadius`; damage preview number on enemy hover via `effectPipeline.runEffects` predict; click target → `playCard`; ESC and right-click → `cancelSelection`. — `acf7d85` 2026-05-09
- [x] **F-06** Card resolution animations: handlers for `PlayTween` (sprite tween toward target+back), `HitFlash` (white tint 80ms), `FloatDamage` (floating text up+fade 600ms, color by kind), `ShakeCamera`, sprite fade-out on death, `WaitForAnimations` blocks input until `runtime.activeTweens` settles then dispatches `animationsCompleted`. — `32d77d5` 2026-05-09
- [x] **F-07** AP indicator + End Turn button + turn banner: text "AP: cur/max" top-right, End Turn button bottom-right dispatches `endTurn`, brief "<UnitName>'s Turn" overlay 800ms on turn change. — `32d77d5` 2026-05-09
- [x] **F-08** Real combat reducer card play: extend `combatReducer.ts` so `playCard` actually runs `effectPipeline.runEffects` and produces `CombatEffect[]` for the scene to drain (not just `WaitForAnimations`). Apply `CardEffect.kind` results to `state.units` (HP, statuses, AP). — `32d77d5` 2026-05-09
- [x] **F-09** Real `enemyAI.planTurn`: replace stub `[endTurn]` with closest-target movement + attack with available AP; handles distance, line-of-sight, picks lowest-HP target on tie. — `4bc15ce` 2026-05-09
- [x] **F-10** Victory / Defeat React modals: `VictoryModal.tsx` + `DefeatModal.tsx` shown when `combatStore.state.phase` is VICTORY/DEFEAT; outcome text, gold earned, captured list, Restart (re-seeds stub battle) and Return-to-Title buttons. Mounted in App.tsx outside `view === 'combat'` guard so they always render when phase fires. — `bc23b6b` 2026-05-09

## B. Overworld Layer (React DOM scene)

- [x] **F-11** Overworld scene React component: tile-based map render reading from MapRegistry's stub overworld + a real `pine_borderlands.json` map (5 locations: Pine Crossing TOWN, Frontier Camp CAMP, North Watch CAMP, Smuggler's Cave DUNGEON, Iron Throne EXIT, with edges and terrain). Pawn icon at `runStore.worldPosition.nodeId`. View transition `'combat' → 'overworld'` on victory; `'title' → 'overworld'` on New Game (skip the stub combat boot once overworld lands). — `4182f67` 2026-05-09
- [x] **F-12** Travel + per-hop encounter rolls: clicking a connected node animates pawn along the path, fires `runStore.consumeTravelHop` per step, rolls encounter via `deriveRng(runRng, 'hop:N')` against `WorldEdge.encounterTableId`. On combat encounter: build `CombatBootRequest` with `returnTo = { sceneId: 'overworld', resumeWith: pendingTravelPath }`, dispatch `combatStore.startBattle`, set view to 'combat'. Return-to-overworld on victory consumes path. — `076e3b0` 2026-05-09
- [x] **F-13** Visited / cleared node indicators on overworld map; current pawn position highlighted; node-type icons (TOWN ⌂, CAMP ⛺, DUNGEON ⚔, EXIT ▶); quest indicator `!` driven by active quest `location_indicators` (real wiring in F-19). — `076e3b0` 2026-05-09

## C. Town Layer (React DOM)

- [x] **F-14** Town scene React layout: enter when player arrives at TOWN node. Mount-and-Blade-style sidebar (Inn / Shop / Tavern / Leave) + content panel right. Town JSON schema + Pine Crossing town data. View `'overworld' → 'town'`. — `ef22f2a` 2026-05-09
- [x] **F-15** Inn panel: heal all party members, cost 8g/unit, button disabled if insufficient gold; dispatches `runStore.addGold(-cost)` and unit-by-unit HP restore via dispatch. — `ef22f2a` 2026-05-09
- [x] **F-16** Shop panel: buy/sell with regional inventory filter (per `Item.region` + town `region` config), item detail view, integrates with grid inventory (F-17). 8 items minimum stocked at Pine Crossing (foundation has 10 items; Pine stocks borderlands subset). — `ef22f2a` 2026-05-09
- [ ] **F-17** Grid inventory drag-drop UI (8×4 cells using @dnd-kit): items render at `gridSize.width × gridSize.height`, drag-drop to move/equip, drag onto unit portrait fires `equipHand`, "Bag full" overlay if no fit, "Organize" auto-pack button using bin-packing helper. Install @dnd-kit/core + @dnd-kit/sortable.
- [x] **F-18** Tavern panel: rumors list (flavor text from town JSON), accept-quest list (Blood Ties shows up at Pine Crossing per F-19), bounty board placeholder (real wiring in F-22), recruitment locked stub. — `ef22f2a` 2026-05-09

## D. Quest + Dialogue Layer

- [ ] **F-19** Blood Ties content port: read existing Godot `data/quests/quest_definitions.json` + `data/dialogue/sq_blood_ties_*.json` files; translate to TS schemas (`QuestDef`, `DialogueTree`); land in `phaser/src/data/content/quests/blood_ties.json` + `phaser/src/data/content/dialogue/blood_ties_*.json`. Wire `gameStore` to load quests from validated content at boot.
- [ ] **F-20** Dialogue UI React component: text box + speaker label + choice buttons (gated by `visibleIf` / `enabledIf` predicates via `evaluatePredicate`); fires `QuestEffect[]` on selection through `gameStore.dispatch`. Mounted as overlay above whichever scene is active.
- [ ] **F-21** Quest log overlay: open with Q key or button on overworld/town HUD, lists active quests from `runStore.questStates`, current stage description, predicate-based completion check; closeable.
- [x] **F-22** Capture-target plumbing: `combatStore` `capture` event resolves via `captureChance`, success appends to `runStore.party.captured` (new array on RunState), emits `EnemyCaptured` DomainEvent which questRunner sees and may advance Blood Ties. Tavern bounty board shows captured list with turn-in (gold reward, dispatch `runStore.addGold` + clear from captured). [foundation: capture event reduces hp to 0 on success; full bounty board lands with F-27] — pending-sha 2026-05-09

## E. Dungeon Layer

- [x] **F-23** Real `procgen/dungeonGenerator.ts` per `docs/research/sts-procgen.md`: 15 rows + boss, 6 paths, validator pass, full reveal. Keep stub linear corridor as fallback for tests. Update existing tests; add procgen invariant tests (≥6 paths, no row-skipping, forced placements row 1/9/15/16, no Rest on row 14, no Elite on rows 2-5). — `029c68c` 2026-05-09
- [x] **F-24** Dungeon scene React component: branching DAG render with rooms as icons (combat/elite/rest/event/treasure/boss), edges, current position glow, valid-next rooms clickable. View `'overworld' → 'dungeon'` when player visits DUNGEON node. — `029c68c` 2026-05-09
- [x] **F-25** Room navigation + per-type behavior: combat room → boots CombatScene with dungeon enemy group, victory returns to dungeon scene; event room → dialogue (small placeholder); rest room → heal 30%; treasure room → grant 1 random item; elite → harder combat; boss → final encounter, win exits dungeon. Quest-locked dungeon access (Smuggler's Cave gated by Blood Ties completion via predicate). — `029c68c` 2026-05-09

## F. Permadeath, Recruitment, Polish

- [x] **F-26** Permadeath flow: fallen units removed from `runStore.party` on `applyBattleResult`, `deathLog` records (already in foundation); UI shows "FALLEN" overlay during sprite fade; Roy-dies = run-over check that fires DefeatModal even mid-overworld. — `a7537a8` 2026-05-09
- [ ] **F-27** Recruitment system: tavern recruit panel pays gold for 2-3 random class options (rolled via `deriveRng(runRng, 'recruit:N')`), unit joins party with class baseline stats + level 1 + Common gear. Resolves OQ-3 (cost formula = 100 + class-tier × 50).
- [ ] **F-28** E2E test suite + visual snapshot lock: Playwright tests covering full flows — title→new game→combat→victory→title; title→overworld→travel→encounter→combat→return; overworld→town→shop→buy→equip→leave; overworld→quest accept→encounter→capture→complete; overworld→dungeon→clear→return. Visual snapshots for: title, overworld, town (each panel), shop, dialogue, quest log, dungeon map, combat (idle/selected/post-resolve), victory/defeat modals.
- [ ] **F-29** Content fill to Godot parity: 9 classes from Godot starter set (LORD/KNIGHT/MAGE/FIGHTER/ARCHER/CAVALIER/CLERIC/THIEF/BOUNTY_HUNTER) with baseline stats + growth rates per `docs/research/stat-growth-math.md`; 5 enemy groups; 3+ travel events; 5 towns from Godot test_overworld layout (port `data/maps/test_overworld.json` shape). Foundation has 10 items; expand to 15-20 covering all weapon types and rarities. Update `phaser/src/data/content/{classes,items,cards,enemies,quests,dialogue}.json`.
- [ ] **F-30** Final polish + readme + tag: `phaser/README.md` documents vertical-slice scope; `phaser/CONTEXT.md` updated for any new types; Tailwind dark fantasy theme refactor (currently inline styles); animation timing pass; git tag `phaser-ship-vertical-slice`.

---

## Notes for the loop

- **One feature per iteration**, not one commit. Multiple commits inside an iteration are fine — encouraged when atomic.
- **Test gate before check-off.** `npm run typecheck && npm test && npm run check-context-doc && npm run test:e2e` must all pass.
- **`🚧 BLOCKED:` and `⏸ NEEDS-CONTEXT:`** items are skipped, not deleted. Auto-pause if 3+ stack up.
- **Content authoring** is part of features that need it (F-19 ports Blood Ties; F-29 ports remaining content).
- **Refer to** `docs/research/*.md` for procgen rules, RNG strategies, Godot quest audit, growth math, scaling curves.
- **Godot files** in repo root are read-only behavior reference, not source of truth. Translate; never copy-paste GDScript.
- **Completion promise** fires only when:
  1. All F-XX items are checked
  2. All five gates pass on the latest commit (`typecheck + test + test:e2e + check-context-doc + build`)
  3. A reasonable manual playthrough (scriptable as one final E2E) covers title→play→win/lose without crashing
