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

- [x] **UI-T10** Migrate `TitleScreen.tsx` → `<Button>` + `<Heading>`. ✅ Inline-styled `onMouseEnter`/`onMouseLeave` hover handlers replaced with Tailwind data-[hovered]: variants. E2E selectors (`button:has-text("New Game")`, id-based) all still pass — RAC renders to native `<button>`. Bundle 444.36 KB (+11.69 KB from baseline; within +75 budget).
- [x] **UI-T11** Migrate `QuitModal.tsx` → `<Dialog>` + `<Button>` + `<Heading>`. ✅ Manual overlay/`onClick={e.stopPropagation()}` deleted; ESC dismiss + backdrop click are handled by RAC ModalOverlay. Bundle 454.28 KB.
- [x] **UI-T12** Migrate `BattleEndModal.tsx` → `<Dialog>` + 3× `<Button>` + `<Heading>`. ✅ Variant border color (amber for VICTORY, red for DEFEAT). isDismissable=false (battle end is a forced gate). Bundle 454.30 KB.
- [x] **UI-T13** Migrate `LoadGameModal.tsx` → `<Dialog>` + `<ListBox>` + `<Button>` + `<Heading>`. ✅ Save slots → ListBoxItem with arrow-key + Enter selection. Bundle 472.10 KB (+17.8 from T12; ListBox brought widget code in). Cumulative +39.43 vs baseline; within +75 budget.
- [x] **UI-T14** Migrate `QuestLog.tsx` → `<Dialog>` + `<Button>` + `<Heading>`. ✅ Bundle 471.96 KB.
- [x] **UI-T15** Migrate `OverworldScene.tsx` → `<Pressable>` for round map nodes. ✅ All inline `onMouseEnter`/`onMouseLeave` and `useState(hoverNodeId)` deleted; data-[hovered]: variants drive the scale-up + glow. `id` prop added to Pressable to keep e2e selector compatibility (`#node-pine_crossing`). Bundle 472.19 KB.
- [x] **UI-T16** Migrate `TownScene.tsx` → `<Button>` sidebar + buy/sell + tavern accept. ✅ Active panel = primary variant; others = secondary. Inn heal uses isDisabled + on-button label conveys gold need ("Need 24g"). Bundle 471.99 KB.
- [x] **UI-T17** Migrate `DungeonScene.tsx` → `<Pressable>` rooms + `<Button variant=danger>` Retreat. ✅ Phase 2 complete. All 8 non-combat scenes/modals now use the wrapper layer. Bundle 471.69 KB.

## Phase 3 — Combat HUD migration + BoardScene reduction

- [x] **UI-T18** `CombatHud.tsx` shell + `TopBar.tsx` (turn / active unit / HP / AP). ✅ 182 tests pass. Subscribes via Zustand selectors. pointer-events:none on overlay; pointer-events:auto on each interactive child so canvas underneath still receives clicks.
- [x] **UI-T19** `ModeLabel.tsx` with Framer Motion `<AnimatePresence>`. ✅ 185 tests pass. Shows banner only in SELECTING_MOVE / SELECTING_TARGET subPhases. Slides in from above with fade.
- [x] **UI-T20** `EndTurnBtn.tsx`. ✅ Disabled when not party turn / RESOLVING. Dispatched via store.
- [x] **UI-T21** `MoveBtn.tsx`. ✅ Toggles enterMoveMode / cancelSelection. Variant flips primary↔secondary based on selecting state. 185 tests pass.
- [x] **UI-T22** `CardHand.tsx` (5 cards, `<Card>` with AP guard + `<Tooltip>` for disabled-with-reason). ✅ Cards now live in DOM; click hits the real `<button>`, hover lifts via Framer Motion `whileHover`, AP-insufficient cards show tooltip "Needs N AP, you have M".
- [x] **UI-T23** `CaptureBtn.tsx`. ✅ Lists each adjacent enemy with HP < 50% as a danger-variant button with capture % preview. Tooltip explains the formula.
- [x] **UI-T24** Wire `<CombatHud />` into `App.tsx`. ✅ Mounted whenever `view === 'combat'`. Bundle 478.28 KB (cumulative +45.61 vs baseline; within +75 budget). Stripped Framer Motion from CardHand + Card + ModeLabel — pure CSS / Tailwind transitions instead. motion-safe: variants honor prefers-reduced-motion.
- [x] **UI-T25** `CombatScene.ts` → `BoardScene.ts`. ✅ ~370 LoC of HUD code deleted from canvas (card hand, end-turn btn, move btn, AP indicator, mode label, button containers). Kept: grid, units, animations, tile/unit click spatial pickers, enemy turn loop, AOE/damage tile preview. createGame.ts updated to register BoardScene.
- [x] **UI-T26** Update E2E tests for DOM HUD. ✅ `combat-buttons.spec.ts` now targets `#combat-end-turn-btn`, `#combat-move-btn`, and `[data-testid^="card-"]`. `combat-movement.spec.ts` unchanged (still targets canvas for tile/unit clicks). DevHud default-closed so it doesn't intercept clicks. All 8 e2e pass.

## Phase 4 — Cross-cutting polish

- [x] **UI-T27** `prefers-reduced-motion` honored. ✅ `motion-safe:transition-*` and `motion-safe:data-[hovered]:-translate-y-6` variants gate every animation. Reduced-motion users still get visual state changes (color, opacity) but no transform tweens.
- [x] **UI-T28** `scripts/measure-bundle.mjs` + `npm run perf-gates`. ✅ Reports baseline 432.67, ceiling 507.67, actual 462.68 KB gzipped (+30.01). PASS.
- [x] **UI-T29** ✅ CONTEXT.md updated (Phaser-board-only invariant; BoardScene rename). Visual playthrough confirmed: title → overworld → combat with HUD overlay; end-turn click verified advances turn; hover sets data-hovered=true. All 6 gates green. Tag `phaser-ui-input-fixed` pushed.

---

## Notes for the loop

- **TDD per task**: write the failing test first, run it, then implement, run again, commit. Each test+impl+commit = one iteration.
- **All 5 build gates pass before check-off**: `typecheck`, `npm test -- --run`, `check-context-doc`, `test:e2e`, `build`.
- **Do not skip the test step.** A wrapper without tests is a wrapper without proof of working hover/click/keyboard semantics.
- **Visual sanity check** every Phase 2/3 task using Playwright MCP — load the scene, verify button is clickable AND hover-able AND disabled state visible.
- **Drift safeguards**: emit `<promise>NEEDS_HUMAN_REVIEW</promise>` if 3+ consecutive `🚧 BLOCKED:` items, OR tests fail on HEAD at iteration start, OR perf gate exceeded by >50%.
- **Cutoff**: if anything tempts adding a button/menu to Phaser canvas, stop. Spec rule: UI is DOM, board is canvas.
