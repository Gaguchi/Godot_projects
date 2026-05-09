# UI Input Overhaul Progress

> **Spec:** `docs/superpowers/specs/2026-05-09-ui-input-overhaul-design.md`
> **Plan:** `docs/superpowers/plans/2026-05-09-ui-input-overhaul-plan.md`
> **Loop prompt:** `docs/superpowers/plans/2026-05-09-ralph-loop-prompt.md`
> **Completion promise:** `<promise>UI-INPUT-FIXED</promise>` — emit ONLY when:
>   - All 4 user-visible criteria pass (4-state UI, keyboard nav, no click lost mid-tween, touch parity verified)
>   - All performance gates green (bundle ≤ +75 KB gzipped, hover p95 < 8ms, mount < 50ms)
>   - All five build gates green (typecheck, unit, e2e, check-context-doc, build)
>   - `CombatScene.ts` renamed to `BoardScene.ts`; HUD code deleted
>   - Tag `phaser-ui-input-fixed` pushed
>   - Visual playthrough recorded (title → overworld → combat → win)

Each iteration completes ONE task end-to-end (test → impl → run → gates → commit). All 5 gates pass before check-off. Skip items prefixed `🚧 BLOCKED:`.

---

## Phase 1 — Component library

- [x] **UI-T1** Install `react-aria-components` + `framer-motion`. Record bundle baseline. No code consumers yet. ✅ Bundle baseline: 432.67 KB gzipped (ceiling 507.67 KB). Versions: react-aria-components ^1.17.0, framer-motion ^12.38.0, react-aria ^3.48.0.
- [x] **UI-T2** `Button` wrapper + 4 unit tests. ✅ 158 tests pass. Variants: primary/secondary/ghost/danger with full data-[hovered/pressed/focus-visible/disabled]: Tailwind classes. Testing infrastructure also added: jsdom env, @testing-library/react, tests/setup.ts with auto-cleanup.
- [x] **UI-T3** `Pressable` wrapper for non-button clickables. ✅ Renders `<div role="button">` with full `usePress`/`useHover`/`useFocusRing` semantics. tabIndex toggles 0/-1 on disabled. Same data-[pressed/hovered/focus-visible/disabled] attribute surface as `<Button>`. 161 tests pass.
- [x] **UI-T4** `Card` wrapper with AP-cost guard + Framer Motion lift. ✅ 165 tests pass. Click hits the RAC `<Button>`; lift via Framer Motion `whileHover` / `whileTap` (skipped under `prefers-reduced-motion`). Disabled when `apCost > availableAp`; reason exposed via `data-disabled-reason` attribute (Tooltip in T8 will render it visually). RAC strips arbitrary HTML attributes (title) so we use a data-attribute instead.
- [x] **UI-T5** `Dialog` wrapper (ModalOverlay + Modal + RACDialog). ✅ Focus trap, ESC dismiss (verified in test), backdrop click dismisses when isDismissable (default true). Stone-950 panel with amber border. 169 tests pass.
- [x] **UI-T6** `Menu` + `MenuItem` wrappers. ✅ 172 tests pass. Click + arrow-key + Enter all fire onAction. RAC handles type-to-search and roving tabindex internally.
- [x] **UI-T7** `ListBox` + `ListBoxItem` wrappers. ✅ 175 tests pass. Click + arrow-key + selection state via data-[selected]. Used by shop and save-slot UIs.
- [x] **UI-T8** `Tooltip` wrapper. ✅ 177 tests pass. TooltipTrigger + RACTooltip + OverlayArrow with stone/amber styling. 500ms hover delay default; isOpen prop for forced display (used in tests + always-on cases).
- [x] **UI-T9** `Heading` wrapper + barrel `index.ts` + ESLint guard. ✅ 180 tests pass. Heading wraps RACHeading with project font-mono/amber styling. Barrel exports all 8 components + types. `eslint.config.js` adds `no-restricted-imports` rule blocking raw `react-aria-components` and `react-aria` imports outside `src/ui/components/`. Phase 1 complete.

## Phase 2 — Migrate non-combat scenes

- [ ] **UI-T10** Migrate `TitleScreen.tsx` → `<Button>`. 3 buttons. E2E `boot.spec.ts` selectors must still pass.
- [ ] **UI-T11** Migrate `QuitModal.tsx` → `<Dialog>` + `<Button>`.
- [ ] **UI-T12** Migrate `BattleEndModal.tsx` → `<Dialog>` + `<Button>` (Continue / Restart / Return).
- [ ] **UI-T13** Migrate `LoadGameModal.tsx` → `<Dialog>` + `<ListBox>`.
- [ ] **UI-T14** Migrate `QuestLog.tsx` → `<Dialog>`.
- [ ] **UI-T15** Migrate `OverworldScene.tsx` → `<Pressable>` for round map nodes + `<Button>` for HUD buttons. Keep SVG edge layer with `pointer-events: none`.
- [ ] **UI-T16** Migrate `TownScene.tsx` → `<Button>` sidebar + `<ListBox>` shop items + `<Tooltip>` for disabled-with-reason on Inn heal.
- [ ] **UI-T17** Migrate `DungeonScene.tsx` → `<Pressable>` rooms + `<Button variant=danger>` Retreat.

## Phase 3 — Combat HUD migration + BoardScene reduction

- [ ] **UI-T18** Build `CombatHud.tsx` shell + `TopBar.tsx` (turn / active unit / HP / AP). Subscribes to combatStore via Zustand selectors.
- [ ] **UI-T19** Build `ModeLabel.tsx` with Framer Motion `<AnimatePresence>`. Shows banner during SELECTING_MOVE / SELECTING_TARGET.
- [ ] **UI-T20** Build `EndTurnBtn.tsx`. Uses `<Button variant="primary">`. Disabled when not party turn / RESOLVING.
- [ ] **UI-T21** Build `MoveBtn.tsx`. Toggles enterMoveMode / cancelSelection. Disabled when hasMovedThisTurn.
- [ ] **UI-T22** Build `CardHand.tsx` (fan layout, 5 cards, `<Card>` with AP guard + `<Tooltip>` on disabled).
- [ ] **UI-T23** Build `CaptureBtn.tsx` (shown when adjacent to low-HP enemy on player turn).
- [ ] **UI-T24** Wire `<CombatHud />` into `App.tsx` for `view === 'combat'`. Pointer-events overlay over canvas.
- [ ] **UI-T25** Strip HUD code from `CombatScene.ts`; rename to `BoardScene.ts`. Delete: card hand, end-turn, move, AP indicator, mode label, all button containers. Keep: grid, units, animations, tile/unit click (spatial pickers), enemy turn loop. Net ~370 LoC removed.
- [ ] **UI-T26** Update E2E tests: `combat-buttons.spec.ts` now targets DOM buttons; `combat-movement.spec.ts` keeps canvas tile click; new `keyboard-nav.spec.ts` exercises Tab/Enter flow.

## Phase 4 — Cross-cutting polish

- [ ] **UI-T27** Respect `prefers-reduced-motion` in Card lift + ModeLabel transitions (Framer Motion `useReducedMotion` hook).
- [ ] **UI-T28** Add `scripts/measure-bundle.mjs` + `npm run perf-gates` (asserts gzipped size ≤ baseline + 75 KB). Wire into CI gate.
- [ ] **UI-T29** Update `phaser/CONTEXT.md` (BoardScene rename, UI components section, new architecture invariant). Final visual playthrough via Playwright MCP. Tag `phaser-ui-input-fixed`. Emit `<promise>UI-INPUT-FIXED</promise>`.

---

## Notes for the loop

- **TDD per task**: write the failing test first, run it, then implement, run again, commit. Each test+impl+commit = one iteration.
- **All 5 build gates pass before check-off**: `typecheck`, `npm test -- --run`, `check-context-doc`, `test:e2e`, `build`.
- **Do not skip the test step.** A wrapper without tests is a wrapper without proof of working hover/click/keyboard semantics.
- **Visual sanity check** every Phase 2/3 task using Playwright MCP — load the scene, verify button is clickable AND hover-able AND disabled state visible.
- **Drift safeguards**: emit `<promise>NEEDS_HUMAN_REVIEW</promise>` if 3+ consecutive `🚧 BLOCKED:` items, OR tests fail on HEAD at iteration start, OR perf gate exceeded by >50%.
- **Cutoff**: if anything tempts adding a button/menu to Phaser canvas, stop. Spec rule: UI is DOM, board is canvas.
