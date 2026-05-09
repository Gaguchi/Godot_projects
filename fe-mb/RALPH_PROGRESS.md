# Ship Progress — Polish & Interactivity Pass

> Vertical slice tagged at `phaser-vertical-slice`. This pass: fix the interactivity bugs (movement, button clicks), polish each scene's UI to game-feel quality using design skills (frontend-design / refactoring-ui / bolder / colorize / polish / godot-battle-ui), and fill remaining functional gaps.
>
> **Spec:** `docs/superpowers/specs/2026-05-09-ralph-ship-plan-design.md` (foundational)
> **Loop prompt:** `docs/superpowers/plans/2026-05-09-ralph-loop-prompt.md` (updated for design-skill workflow)
> **Completion promise:** `<promise>GAME-POLISHED</promise>` when:
>   - All bug-fix items are checked + verified working in browser
>   - All UI items have invoked the relevant design skill before commit
>   - Visual playthrough records each scene rendering at game-feel quality
>   - All five gates pass

Each iteration is **one feature**. Use TWO Skill invocations on UI items: a design skill (e.g. `frontend-design`) FIRST, then implementation. Skills surface concrete design choices; without them you ship bare-bones React.

---

## A. Critical bugs

- [x] **B-01** Player unit movement in combat. ✅ Fixed at d3f5067+next commit. Click party unit → enters `SELECTING_MOVE` subPhase → reachable tiles within `class.startingMov` highlight cyan (BFS, blocked by obstacles + occupied tiles) → click valid tile dispatches `moveUnit`. Free move per turn via new `Unit.hasMovedThisTurn` flag, reset on `endTurn`. ESC + right-click + Cancel Move button all cancel. New "Move" button next to End Turn. New E2E test `combat-movement.spec.ts` exercises the full UI path with simulated MouseEvents (Phaser doesn't respond to PointerEvent dispatch but does to MouseEvent). Dev-only `?view=combat` URL fast-path added for E2E testing. Dev-only `window.__debug` exposes stores.
- [ ] **B-02** Verify Phaser button interactivity. Audit every clickable Phaser GameObject (cards, end turn button, tile rectangles); confirm `setInteractive()` calls + hit-area geometry are correct. Add explicit `useHandCursor` styling so hover state is obvious. Add E2E test that programmatically clicks a card and verifies subPhase transitions to `SELECTING_TARGET`.

## B. Scene-by-scene UI polish (each requires Skill invocation)

- [ ] **UI-01** Title screen polish. Skills: `frontend-design`, `bolder`, `colorize`. Atmospheric background (CSS gradient or particle canvas overlay), animated logo with subtle breathing/pulse, distinctive button hover states (border glow, slight skew, audio-cue placeholder). Match dark fantasy theme — stone-900 base, ember accents, parchment text.
- [ ] **UI-02** Overworld polish. Skills: `frontend-design`, `refactoring-ui`. Replace the bare radial gradient with a proper map background (placeholder topographic SVG). Each location node gets a frame/banner styling per type (stone arch for town, tent silhouette for camp, cave mouth for dungeon, gate for exit). Path lines styled as faded roads. Add a top HUD: party portraits + HP, gold + food, current quest summary. Include a clickable "Open Quest Log" button instead of relying on Q key.
- [ ] **UI-03** Combat scene polish. Skills: `godot-battle-ui`, `polish`. Better card design (frame/border per rarity, type icon, gradient bg). Unit nameplates with class icon. Status effect icons over units. Active-turn glow more dramatic. End Turn button with engraved styling. AP indicator with pip dots not text. Initiative tracker bar at top showing turn order.
- [ ] **UI-04** Town menu polish. Skills: `frontend-design`, `bolder`, `colorize`. Tavern panel with wood-grain bg, inn with hearth/fire flicker (CSS animation), shop with item-card visual. Sidebar buttons get banner styling. Top-left town name as a sign. Item cards (in shop) get rarity color borders (Common gray / Uncommon green / Rare blue / Epic purple / Legendary gold).
- [ ] **UI-05** Dungeon scene polish. Skills: `frontend-design`, `creating-dashboards`. Cave/dungeon background. Room icons more distinctive — combat=crossed swords, elite=skull, rest=campfire, treasure=chest, boss=throne. Path lines drawn as cave passages. Current room glow/pulse. "Retreat" button styled as a back arrow.
- [ ] **UI-06** Modal polish (BattleEnd, LoadGame, Quit). Skills: `polish`, `frontend-design`. Victory modal celebratory (gold particles or shimmer), Defeat modal grim (cracked-glass overlay), Load Game modal with save slot mockups for empty state, Quit modal with farewell message centered.

## C. Functional gaps

- [ ] **F-DRAG** Grid inventory drag-drop (was F-17). Install `@dnd-kit/core`. 8×4 cell grid in shop panel. Items occupy `gridSize.width × gridSize.height` cells. Drag to move/equip. Drag onto unit portrait → equipHand. "Bag full" overlay when no fit. "Organize" auto-pack button.
- [ ] **F-CAPTURE-UI** Capture button on adjacent low-HP enemies in combat. When player's turn and enemy adjacent with HP < 50%, show "Capture" button near unit. Click → dispatch `capture` event. Capture chance % shown in tooltip.
- [ ] **F-DIALOGUE** Dialogue UI React modal (was F-20). Predicate-gated choices. Fires QuestEffect[] on selection. Used by Blood Ties + travel events.
- [ ] **F-BLOODTIES** Blood Ties full content port (was F-19). Read Godot `data/quests/quest_definitions.json` + `data/dialogue/sq_blood_ties_*.json`. Translate to TS. Wire Pine Crossing tavern accept → spawn Daren encounter → resolve via dialogue → reward.
- [ ] **F-RECRUIT** Tavern recruitment UI (was F-27). Pay 100g, choose from 3 random class options, unit joins party at level 1.

## D. Final gate

- [ ] **FINAL** Visual playthrough recording: title → overworld → town (visit each panel) → travel encounter → combat (move + play card + end turn + win) → dungeon (clear at least 3 rooms + boss) → exit. Each scene shows polished UI matching the design-skill outputs. README updated. CONTEXT.md drift check passes. Tag `phaser-polished`. Emit `<promise>GAME-POLISHED</promise>`.

---

## Notes for the loop

- **Each UI item REQUIRES invoking a design Skill first.** The skill's output (concrete design choices, palette, layout) drives the implementation. Don't skip the skill — that's how we got bare-bones UI last time.
- **Bug fixes do NOT require design skills** — go straight to implementation with TDD.
- **All five gates pass before check-off.** typecheck + test + test:e2e + check-context-doc + build.
- **Manual visual verify** after each UI item using Playwright MCP screenshots.
- Skip items prefixed `🚧 BLOCKED:`.
