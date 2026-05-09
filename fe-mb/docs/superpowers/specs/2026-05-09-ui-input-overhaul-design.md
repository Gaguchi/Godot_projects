# FE_MB UI Input Overhaul — Design Spec

**Date:** 2026-05-09
**Author:** Claude Opus 4.7 (1M context) + 5-reviewer council
**Supersedes:** none (extends 2026-05-08-phaser-foundations-v2-design.md)
**Status:** Draft for user approval

## Problem statement

The FE_MB tactical roguelite has unreliable UI interactivity. The user's exact complaint: *"buttons litterally are hard to click as well as the map and cards… im hovering over the button and the button is not clickable and doesnt react and what can and cant be clicked is bad."*

Diagnosis (council-verified):

1. **Hand-rolled hit testing everywhere.** Phaser combat uses raw `setInteractive(rectangle)` with manual `pointerover`/`pointerout`/`pointerdown`. React scenes use inline-styled `<button>` with `onClick`/`onMouseEnter`.
2. **Concrete logic bugs ship.** `CombatScene.ts:691` has `v.cardId === cardIdStr || true ? 1 : 1` — a tautology that breaks card-sibling-dim restore. Cards stay dimmed after one hovers.
3. **Hit-area mismatches.** Card containers tween Y by 24px on hover; the `Phaser.Geom.Rectangle` hit area doesn't track. Clicks miss after the lift.
4. **No depth re-sort on hover-lift.** Overlapping fan cards still intercept pointer events from the lifted card.
5. **No state machine.** Each widget reimplements idle/hover/pressed/disabled ad-hoc and gets it wrong differently.
6. **Missing affordances.** No cursor changes on cards, no focus rings, no "disabled because X AP" tooltip explaining unaffordability.
7. **No keyboard / no touch.** Tab + Enter/Space don't navigate. Touch produces ghost-hovers.

## Goals

- Every interactive surface has 4 distinct visual states: idle / hover / pressed / disabled-with-reason.
- Tab + Enter/Space navigates every menu.
- No click is lost mid-tween (cards stay clickable during lift; map nodes during travel animation).
- Touch parity verified on a real device.
- Bundle growth ≤ +75 KB gzipped.
- Hover-to-style p95 < 8 ms.
- Scene mount-to-interactive p95 < 50 ms.

## Non-goals

- Visual redesign or theme overhaul. Stone & Steel palette stays. Pixel-art assets stay.
- Replacing Zustand, Vite, Zod, or the existing combat reducer.
- Replacing Phaser as the engine for the tactical grid.

## Architectural decision: DOM-first, Phaser-grid-only

The council's future-proofing reviewer flagged that hand-rolling a Phaser-canvas UI helper is a slippery slope (200 lines becomes 3,000 over twelve months as we add tooltips, scroll panels, modal stacks). Slay the Web (oskarrough/slaytheweb) is shipping evidence that DOM is sufficient for card-tactical UX.

**Decision:** *all UI lives in React DOM; Phaser owns the tactical board layer only.*

| Layer | Owner | Surface |
|---|---|---|
| Tactical grid, units, terrain, movement range, AOE, camera, in-world animations (PlayTween, HitFlash, FloatDamage, ShakeCamera) | Phaser scene (renamed `BoardScene`) | Canvas |
| Card hand, End Turn, Move button, AP indicator, mode label, capture button, status icons | React `<CombatHud>` overlay | DOM |
| Title, overworld, town, dungeon, modals, quest log, dialogue | React scenes | DOM |

Single store ownership unchanged: `combatStore`/`runStore`/`metaStore` remain authoritative. React HUD subscribes; `BoardScene` subscribes; both dispatch into the same store. The store is the contract, not the bus.

## Component library

A thin internal wrapper layer over `react-aria-components`. Feature code imports only from the wrappers; raw `react-aria-components` imports are forbidden by lint rule.

```
src/ui/components/
├── Button.tsx            // wraps RAC Button; data-[pressed], data-[hovered], data-[focus-visible]
├── Card.tsx              // wraps RAC Button as Pressable; adds AP-cost guard + tween-safe lift
├── Dialog.tsx            // wraps RAC Modal + Dialog; focus trap, dismissable, ESC handling
├── Menu.tsx              // wraps RAC Menu, MenuItem; keyboard nav, type-to-search
├── ListBox.tsx           // wraps RAC ListBox; arrow-key selection (shop list, save slots)
├── Tooltip.tsx           // wraps RAC Tooltip; "needs 2 AP, you have 1"
├── Heading.tsx           // wraps RAC Heading; semantic h1-h6 in modals
├── Pressable.tsx         // wraps usePress; for non-button clickables (overworld map nodes, tiles when needed)
└── index.ts              // barrel
```

Visual states are styled with Tailwind `data-[*]:` variants (`data-[hovered]:scale-105`, `data-[pressed]:translate-y-px`, `data-[disabled]:opacity-40`). No raw inline-style hover handlers.

## Combat HUD layer (the new piece)

`src/ui/scenes/combat/CombatHud.tsx` — subscribes to `combatStore`. Renders absolutely positioned over the Phaser canvas via the existing `#react-shell` div. Layout:

```
┌───────────────────────────────────────┐
│ TopBar: turn N, active unit name, AP  │  position: absolute, top: 0
├───────────────────────────────────────┤
│                                       │
│         [Phaser canvas, board]        │  z-index: 0
│                                       │
├───────────────────────────────────────┤
│ ModeLabel (when SELECTING_*)          │  position: absolute, top: 60
├───────────────────────────────────────┤
│ CardHand: 5 <Card> in fan layout      │  position: absolute, bottom: 16
├───────────────────────────────────────┤
│ MoveBtn  EndTurnBtn  CaptureBtn       │  position: absolute, bottom-right
└───────────────────────────────────────┘
```

Cards animate via CSS `transform: translateY()` + Framer Motion (already a likely future dep, otherwise `react-spring`). Hit area is the `<Card>` itself — moves with the visual automatically. Depth via `z-index`, no manual sorting needed.

The Phaser scene retains tile click + unit click for spatial pickers (these are NOT buttons; they're geometric selection). Those handlers stay in `BoardScene` but use the existing `setInteractive` once at construction with no animation.

## Phaser `BoardScene` (reduced surface)

Renamed from `CombatScene`. Removes:
- Card hand rendering (`renderCardHand`, `cardViews`)
- End Turn button (`drawEndTurnButton`)
- Move button (`drawMoveButton`, `updateMoveButton`, `isMoveButtonEnabled`)
- AP indicator (`drawApIndicator`, `updateApIndicator`)
- Mode label (`drawModeLabel`, `updateModeLabel`)

Keeps:
- Grid (`drawGrid`, tile rectangles, range/AOE/move-range highlights)
- Unit views (`renderUnits`, sprites, HP bars, glow)
- Targeting / move-mode tile coloring (`renderTargeting`)
- Tile click (`onTileClick` for SELECTING_TARGET / SELECTING_MOVE)
- Unit click (`onUnitClick` for entering move mode)
- Animation handlers (`handleEffect` for PlayTween, HitFlash, FloatDamage, ShakeCamera)
- Enemy turn loop (`maybeRunEnemyTurn`, `dispatchNextEnemyEvent`)

Net effect: ~370 LoC removed from `CombatScene.ts`; replaced by ~250 LoC of React `CombatHud` components.

## Implementation phases

### Phase 0 — Pre-flight (no commits) — 15 min
- Verify `phaser/package.json` has React 19.2.5, Phaser 4.1.0, Vite, Zustand. (Already done.)
- Verify Tailwind is installed and `data-*` variants are enabled (Tailwind v3.2+ ships them by default).
- Animation library: **Framer Motion (`motion`)**. Declarative, exit animations, `layoutId` for fan-spread morphs, ~30 KB gzipped (within budget). Locked in.

### Phase 1 — Component library — 1 day
- Install `react-aria-components` only. Drop the planned `@dnd-kit/core` and `@use-gesture/react` (zero current consumers per migration critic).
- Create the 8 wrapper components above with Tailwind `data-[*]:` variants.
- Add lint rule forbidding raw `react-aria-components` imports outside `src/ui/components/`.
- Unit tests: each wrapper renders, click fires, keyboard fires, disabled blocks, data-attributes present.

### Phase 2 — Migrate non-combat DOM scenes — 2 days
Order: TitleScreen → modals (Quit, BattleEnd, LoadGame) → QuestLog → OverworldScene → TownScene → DungeonScene.

For each: replace `<button onClick onMouseEnter onMouseLeave>` with `<Button>` from wrapper lib. Replace inline `style={{ background, color, border }}` with Tailwind classes + `data-[*]:` variants. Existing E2E selectors (`button:has-text("New Game")`, id-based) survive — react-aria's `<Button>` renders to native `<button>`.

Net touched: ~755 LoC across 8 files.

### Phase 3 — Combat HUD migration — 2 days
- Build `src/ui/scenes/combat/CombatHud.tsx` + sub-components: `TopBar`, `ModeLabel`, `CardHand`, `Card`, `MoveBtn`, `EndTurnBtn`, `CaptureBtn`.
- Wire `CombatHud` to `combatStore` via Zustand selectors.
- Render `CombatHud` whenever `view === 'combat'` *over* the Phaser canvas.
- Strip card hand + buttons + AP + mode label from `CombatScene` → renamed `BoardScene`.
- E2E: existing `combat-buttons.spec.ts` continues to pass (clicks land on real `<button>` now, even simpler).

### Phase 4 — Cross-cutting polish — 1 day
- 4-state visual styles applied uniformly across all wrappers.
- Disabled-state tooltip: shown on hover/focus of any disabled `<Card>` with explanation (e.g., "needs 2 AP, you have 1"). Affordable cards do **not** get this tooltip — only the disabled-with-reason variant.
- Tab / Enter / Space / Arrow-key navigation tested across all menus + card hand.
- `prefers-reduced-motion` respected (Framer Motion transitions reduced to 0ms duration).
- Real-device touch test (iPad/phone). Verify no 300 ms tap delay, no ghost-hover.
- Performance gates measured: bundle delta, hover latency, mount latency.

**Total realistic time: ~6 days** (was "1 day" in original proposal — council corrected).

## Performance budget

| Metric | Threshold | Measurement |
|---|---|---|
| Bundle size delta | ≤ +75 KB gzipped | `vite-bundle-visualizer` in CI |
| Hover-to-style applied p95 | < 8 ms | `performance.measure` in dev HUD |
| Scene mount-to-interactive p95 | < 50 ms | `performance.measure` |
| Detached DOM nodes after 20 scene transitions | 0 | Chrome DevTools heap diff |
| 60 fps with 5 fan cards animating + hover | required | manual frame-rate counter |

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| react-aria + inline-styles awkward | Use Tailwind `data-[*]:` variants; lint rule forbids raw inline-style hover handlers in feature code |
| 6-day estimate slips | Phase 2 is gates-and-incremental — each scene migrated and shipped independently. Phase 3 is the only "all-at-once" step |
| Combat HUD re-render churn | Use Zustand selectors (`useCombatStore(s => s.state.turn.unitId)`) for sub-tree subscriptions; HUD renders only when its slice changes |
| Animation feel regression vs. Phaser tweens | Framer Motion's `layout` + `transition` give Slay-the-Spire-feel card juice; AC includes a side-by-side comparison before merge |
| Bundle blows past +75 KB | If exceeded, audit imports for tree-shaking failure; consider lazy-loading per-scene. Hard CI gate. |

## Testing strategy

- **Unit:** every wrapper component has rendering + click + keyboard + disabled + data-attribute tests in Vitest.
- **E2E:** existing `boot.spec.ts`, `combat-buttons.spec.ts`, `combat-movement.spec.ts` continue to pass without modification (selectors are id/role-based). New E2E: `keyboard-nav.spec.ts` exercises Tab/Enter/Arrow flow across overworld → town → combat.
- **Manual:** real-device touch. Reduced-motion preference. Screen reader smoke test (VoiceOver / NVDA) of one menu.

## Done criteria (`<promise>UI-INPUT-FIXED</promise>`)

- All 4 user-visible criteria pass (4-state UI, keyboard nav, no click lost mid-tween, touch parity).
- All performance gates green.
- All five build gates green (typecheck, unit, e2e, check-context-doc, build).
- `CombatScene.ts` renamed to `BoardScene.ts`; HUD-related code deleted, not commented out.
- `src/ui/components/` exists with Button/Card/Dialog/Menu/ListBox/Tooltip/Heading/Pressable + tests.
- Bundle delta verified ≤ +75 KB gzipped against `phaser-vertical-slice` tag.

## Notes on render targets

`react-aria-components` `<Button>` renders to a native `<button type="button">` — existing `button:has-text(...)` and id-based E2E selectors survive without change. `<Pressable>` (used for round overworld map nodes if `<Button>` styling is too constraining) wraps `usePress` and renders to a `<div role="button" tabindex="0">`; selectors targeting tag name `button` would miss it, so prefer `[data-testid]` or `[role="button"]` for those nodes if any tests reach them.

## Component cutoff (architectural fence)

If a feature ever needs Phaser canvas to render a button or menu (something the user clicks/hovers as UI rather than picks geographically), the answer is *no — render it in the React HUD instead*. The board layer renders **board things only**: tiles, units, animations, terrain, in-world floating numbers. UI is DOM. Violating this fence reopens the rex-ui-clone trap the council flagged.

---

*Council reviewers (5/5 returned): #1 Architecture (PROCEED-WITH-CHANGES), #2 Performance (PROCEED-WITH-CHANGES), #3 Migration (PROCEED-WITH-CHANGES), #4 UX (PROCEED-WITH-CHANGES), #5 Future-proofing (RECONSIDER → adopted as the chosen direction).*
