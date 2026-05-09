# Ship Progress

> **Active phase:** Phase 1 — Title + Combat Scene Rendering
> **Spec:** `docs/superpowers/specs/2026-05-09-ralph-ship-plan-design.md`
> **Loop prompt:** `docs/superpowers/plans/2026-05-09-ralph-loop-prompt.md`

Read this file each iteration. Pick the next unchecked item under the active phase header. Update the item with `— <commit-sha> <YYYY-MM-DD>` on completion. Mark blockers `🚧 BLOCKED: <reason>` and skip. Mark unclear items `⏸ NEEDS-CONTEXT: <missing>` and skip.

---

## Phase 1 — Title + Combat Scene Rendering

**Goal:** Player can launch the game, click New Game, see a working title screen, transition into a combat scene, see the 14×10 grid with units placed, see a card hand, select a card, see valid targets highlighted, click a target, see the card resolve with real animations (sprite tween, hit-flash, damage number, camera shake), see HP update, end the turn, eventually win or lose, see the victory/defeat modal.

**Completion promise:** `<promise>PHASE-1-TITLE-COMBAT-COMPLETE</promise>` when all items checked AND `npm run typecheck && npm test && npm run test:e2e && npm run check-context-doc && npm run build` all pass.

### Title screen + scene routing

- [x] **P1-01** Add a `view` state slice to App.tsx ('title' | 'combat' | 'overworld' | 'town' | 'dungeon') so React can switch top-level scene — `00eee7e` 2026-05-09
- [x] **P1-02** Create `phaser/src/ui/screens/TitleScreen.tsx` — full-viewport React component with game title text and three buttons — pending-sha 2026-05-09
- [ ] **P1-03** New Game button: dispatches `metaStore.startNewRun`, sets view to 'combat', triggers a stub battle boot
- [ ] **P1-04** Load Game button: opens a placeholder modal listing localStorage saves (empty list shown for now)
- [ ] **P1-05** Quit button: closes the window via `window.close()` (or shows a "thanks for playing" modal in dev)
- [ ] **P1-06** Title screen styling — Tailwind dark fantasy theme (stone-900 bg, amber accents, monospace logo). Match foundation v2 spec §5 visual language
- [ ] **P1-07** Visual snapshot baseline for title screen via Playwright
- [ ] **P1-08** E2E test: page loads → title visible → New Game click → canvas appears with combat scene running

### Combat scene boot + state seeding

- [ ] **P1-09** Stub battle bootstrapper `src/game/scenes/seedStubBattle.ts` — constructs 3 party units (LORD/KNIGHT/MAGE from content), 3 enemy units (Bandit class with stub stats), 14×10 grid, dispatches `combatStore.startBattle`
- [ ] **P1-10** CombatScene `create()` calls seedStubBattle and reads initial state from `useCombatStore.getState().state`
- [ ] **P1-11** Initial unit positions seeded via stub spawn zones (party left side, enemies right side)

### Grid + units rendering

- [ ] **P1-12** CombatScene renders terrain tiles per `TerrainTile.kind` (color-coded rectangles for foundation; Kenney sprites later)
- [ ] **P1-13** Render party units as Phaser sprites (Kenney character pack) at their `position` tile
- [ ] **P1-14** Render enemy units as Phaser sprites with red tint to distinguish from party
- [ ] **P1-15** Tile coordinate → screen position helper (`tileToWorld(tileId): {x,y}`)
- [ ] **P1-16** HP bars rendered above each unit (Phaser Graphics rect, fill width = current/max)
- [ ] **P1-17** Active-turn highlight: a glowing ring around the current `state.turn.unitId`
- [ ] **P1-18** Subscribe to `combatStore.state.units` updates to reflect HP/position changes; throttle to once per `lastEffectId` change per the firewall pattern
- [ ] **P1-19** Visual snapshot for combat scene with units placed

### Card hand UI

- [ ] **P1-20** CardHandUI Phaser container at bottom of screen (y = canvas height - 200)
- [ ] **P1-21** Render 5 cards in fan layout (slight rotation per card, center cards higher)
- [ ] **P1-22** Card sprite shows: name (top), AP cost (bottom-left), damage preview (bottom-right) using Phaser Text
- [ ] **P1-23** Card hover: card lifts up 30px, others dim to 60% alpha
- [ ] **P1-24** Card click: fires `combatStore.dispatch({ type: 'selectCard', payload: { cardId } })`
- [ ] **P1-25** Selected card visual: amber glow border via Phaser Graphics
- [ ] **P1-26** Unaffordable card (AP < cost) state: greyscale tint + tooltip "Not enough AP"
- [ ] **P1-27** Cards refresh on draw/discard (subscribe to `state.decks[unitId].hand` per-unit)
- [ ] **P1-28** Visual snapshot for card hand idle + hovered + selected states

### Targeting UX

- [ ] **P1-29** When `state.subPhase === 'SELECTING_TARGET'`: highlight valid tiles per `targeting.validTargets(card, sourceTile, gridState)` with amber overlay
- [ ] **P1-30** AOE preview ring on tile hover (purple) for cards with `aoeRadius` defined
- [ ] **P1-31** Damage preview number on enemy hover (red text floating above) — calls `effectPipeline.runEffects` against the card to compute predicted damage
- [ ] **P1-32** Click target tile: dispatches `combatStore.dispatch({ type: 'playCard', payload: { cardId, srcId, targets: [tileId] } })`
- [ ] **P1-33** ESC keypress and right-click both dispatch `cancelSelection` event
- [ ] **P1-34** Visual snapshot for targeting state (card selected, valid tiles glowing, hover preview shown)

### Card resolution animations

- [ ] **P1-35** Effect handler stub: CombatScene's `handleEffect(e)` switches on `e.kind` and dispatches to per-effect functions
- [ ] **P1-36** `PlayTween` handler: tween source sprite toward target tile, then back to origin (200ms each direction)
- [ ] **P1-37** `HitFlash` handler: white tint flash on target sprite for 80ms
- [ ] **P1-38** `FloatDamage` handler: spawn floating text above target tile, tween up + fade over 600ms, color by `kind` (red physical / blue magic / green heal)
- [ ] **P1-39** `ShakeCamera` handler: Phaser camera shake with intensity + duration from effect payload
- [ ] **P1-40** Sprite fade-out + removal when unit hp.current reaches 0 (subscribe to unit HP and trigger fade)
- [ ] **P1-41** `WaitForAnimations` handler: blocks input until all `runtime.activeTweens` complete, then dispatches `animationsCompleted` event back to combatStore
- [ ] **P1-42** Visual snapshot for mid-resolution state (sprite mid-tween, damage number floating)

### AP indicator + end turn

- [ ] **P1-43** AP indicator UI: Phaser text in top-right, format "AP: 2/3" — bound to active unit's `ap`
- [ ] **P1-44** End Turn button (Phaser Container + Graphics + Text) at bottom-right of screen, dispatches `endTurn` event
- [ ] **P1-45** End Turn button hover/click visual feedback
- [ ] **P1-46** Turn-start banner: brief "Roy's Turn" / "Bandit's Turn" overlay for 800ms when turn changes

### Victory / Defeat modals

- [ ] **P1-47** `phaser/src/ui/modals/VictoryModal.tsx` — React modal overlay shown when `combatStore.state.phase === 'VICTORY'`
- [ ] **P1-48** `phaser/src/ui/modals/DefeatModal.tsx` — same pattern for `phase === 'DEFEAT'`
- [ ] **P1-49** Modals subscribe to `useCombatStore` and conditionally mount; ErrorBoundary wraps them
- [ ] **P1-50** Modal content: outcome text, gold earned, captured enemies list (empty for foundation), Restart and Return-to-Title buttons
- [ ] **P1-51** Restart button: resets combatStore, re-seeds the stub battle
- [ ] **P1-52** Return-to-Title button: resets combatStore + sets view back to 'title'
- [ ] **P1-53** Visual snapshot for victory and defeat modals

### Phase 1 closeout

- [ ] **P1-54** E2E test: full battle flow (boot → click card → click target → see resolution → end turn → enemy turn → eventually win → modal shown → restart → battle re-seeded)
- [ ] **P1-55** E2E test: defeat path (kill all party units via debug action or scripted enemy attacks → defeat modal → return to title)
- [ ] **P1-56** Update `phaser/CONTEXT.md` with any new types added (e.g., `View` enum, modal component refs). Confirm `check-context-doc` passes
- [ ] **P1-57** Update `phaser/README.md` to mention "Phase 1 ships title + combat scene rendering"
- [ ] **P1-58** Phase gate verification: run all 5 gates (typecheck, test, test:e2e, check-context-doc, build) — all must pass before emitting promise
- [ ] **P1-59** Emit `<promise>PHASE-1-TITLE-COMBAT-COMPLETE</promise>` after the gate verification commit lands

---

## Phase 2 — Overworld Scene

**Goal:** Player can travel between location nodes; per-hop encounter rolls trigger combat or dialogue; return-to-overworld preserves run state.

**Completion promise:** `<promise>PHASE-2-OVERWORLD-COMPLETE</promise>`

🔒 Locked until Phase 1 promise fires. Items will be drafted at the start of Phase 2 loop run.

---

## Phase 3 — Town Menus + Grid Inventory Drag-Drop

**Goal:** Player can visit a town, heal at the inn, buy/sell at the shop, accept a quest at the tavern. 8×4 drag-drop bag working.

**Completion promise:** `<promise>PHASE-3-TOWNS-COMPLETE</promise>`

🔒 Locked until Phase 2 promise fires.

---

## Phase 4 — Quest Engine + Dialogue UI

**Goal:** Blood Ties end-to-end. Quest log overlay. Dialogue UI. Quest indicators on map.

**Completion promise:** `<promise>PHASE-4-QUEST-DIALOGUE-COMPLETE</promise>`

🔒 Locked until Phase 3 promise fires.

---

## Phase 5 — Dungeon Scene (StS map)

**Goal:** Real dungeon procgen per research deliverable #1; navigation; room types; quest-locked access.

**Completion promise:** `<promise>PHASE-5-DUNGEON-COMPLETE</promise>`

🔒 Locked until Phase 4 promise fires.

---

## Phase 6 — Closeout (permadeath, capture, recruitment, content fill, E2E suite, snapshots)

**Goal:** Vertical-slice complete. Godot parity content. Comprehensive E2E + visual snapshot coverage.

**Completion promise:** `<promise>SHIP-PARITY-COMPLETE</promise>`

🔒 Locked until Phase 5 promise fires.

---

## Notes

- **One commit per checklist item.** Atomic, traceable, revertable.
- **Test gate before check-off.** typecheck + unit + e2e (for UI items) + check-context-doc must pass.
- **`🚧 BLOCKED:` and `⏸ NEEDS-CONTEXT:`** items are skipped, not deleted. Human reviews them at phase boundaries.
- **`📝 SPLIT:`** marker for items broken into sub-items — sub-items appear indented two spaces under the parent.
