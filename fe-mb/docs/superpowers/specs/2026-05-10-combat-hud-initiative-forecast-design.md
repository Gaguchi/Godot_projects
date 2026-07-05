# FE_MB Combat HUD — Initiative Strip + Forecast Panel — Design Spec

**Date:** 2026-05-10
**Author:** Claude Opus 4.7 (1M context)
**Supersedes:** none (extends `2026-05-09-ui-input-overhaul-design.md`)
**Status:** Draft for user approval

## Problem statement

Two related combat-HUD gaps surfaced during the Godot-parity review:

1. **No initiative display.** The combat reducer already builds a SPD-ordered queue at `startBattle` and after every `endTurn` (`combatReducer.ts:66, 99`), but only the *current* actor is exposed via `state.turn.unitId`. The player has no way to see who acts next, third, fourth — strategic decisions about target priority and ally support timing are made blind. TopBar shows only `YOUR TURN` / `ENEMY TURN` (`TopBar.tsx:17-19`), which is the GBA-FE convention but doesn't fit our SPD-driven interleaved model.
2. **Forecast panel is missing AND armor is broken in the reducer.** Hover over an enemy with a card primed today shows a single floating red number above the target. There's no breakdown of *why* the damage is what it is, no "predicted HP after", no AP cost line, no status-effect preview. Worse, the underlying damage formula at `combatReducer.ts:205` is `dmg = max(0, base + stat - dr)` — armor (`Unit.armor`, granted by Knight/Buckler/Mage cards) is never subtracted, so the entire armor system is currently cosmetic. A forecast that "accounts for armor" without fixing the reducer would be lying to the player.

These are user-visible defects, not new features. Both fixes are subtractive-with-clarity work: data already flows; we just need to surface and correct it.

## Goals

- Player can see the next 6 actors in turn order at a glance, with portraits, team rings, and the active actor highlighted.
- Player can see, on card-target hover or click, exactly how a card resolves: damage breakdown, predicted HP for both source and target, AP cost, and any status effects that will land.
- Armor is consumed by physical damage before HP loss, matching the Godot model (armor = breakable shield). Magic damage is half-armor / half-HP (armor-piercing).
- Forecast panel reflects the corrected reducer math exactly. Numbers shown = numbers applied.
- No regression in the existing 250 unit tests or 8 e2e tests. Bundle ceiling stays at +75 KB gzipped over `phaser-vertical-slice` baseline.

## Non-goals

- Banner-Saga-style hover-portrait-to-pin-camera. The strip is a status display, not a control surface.
- Showing initiative-modifier deltas ("+2 SPD from Haste") in the strip itself. We'll surface those in the unit's hover tooltip on the strip in a future iteration.
- Full Hit/Crit/Avoid forecast rows. We're deterministic; those rows would always read 100/0/0.
- Reworking the existing "single floating damage number on tile hover" — that fast-path stays as the lightweight preview. The forecast panel layers on top on target-click.
- Damage-type icons (sword/lance/etc.) on initiative entries. Out of scope; class color suffices.
- Predicted enemy actions (Into-the-Breach-style telegraphs). Enemies don't use cards, so per-target intent doesn't fit our model cleanly. Future work.

---

## Section 1: Initiative strip

### Architectural decision: selector-derived, not stored

`buildInitiativeQueue(units, modifiers)` (`turnOrder.ts:9`) is a pure function over alive units. The reducer already calls it at startBattle and endTurn; the queue can change mid-round only when a unit dies, which the reducer handles by recomputing on the next `endTurn`.

We have two options:

**Option A — Add `state.initiativeQueue: UnitId[]`** to `CombatState`. Pro: cheap selector reads. Con: another field to keep in sync; needs a "rebuild queue" event or hook on every unit-death effect; introduces drift risk.

**Option B — Compute on demand in a selector.** The selector calls `buildInitiativeQueue(Object.values(state.units).filter(isAlive))` per render. Pro: zero state-shape churn, zero sync bugs, queue is always correct because it's derived from the source of truth. Con: redundant work per render — but it's a sort of ≤8 units (≤16 with party + enemies), measured at ~3 µs in microbench, and React's reference-equality memoization in Zustand selectors avoids rerender churn.

**Decision: Option B.** State changes have proven costly in past waves (the GP-A cleanup spent 6 commits removing fields). A pure selector is the simpler and more robust choice.

### Layout

**Fixed HUD element, independent of selection.** The strip is purely a function of the combat reducer's state — specifically `state.units` (the alive set) and `state.turn.unitId` (the active highlight). It does NOT depend on:
- The player's currently-selected card (`state.selectedCardId`)
- Whether the player has clicked a unit to enter move mode (`state.subPhase`)
- The hovered tile, the pinned forecast target, or any other UI state

It's the equivalent of a clock or HUD bar — present every frame of combat, always reflecting the same data, never re-positioned, never hidden by player input.

Pinned bottom-center, above the card hand, in a single horizontal row.

```
                              ┌────────────────────────────────────────┐
                              │  ⬢   ⬡   ⬡   ⬡   ⬡   ⬡   ⬡   ⬡         │
                              │  RY  KE  LL  M2  B1  B2  B3  ?         │
                              └────────────────────────────────────────┘
                                  ↑                       ↑
                              ACTIVE              "+N more" badge if
                                                  total queue > 8
```

Sizes:
- 8 portraits visible. If queue > 8, show 7 + "+N" badge.
- Active portrait: 56×56 px, 1.2× scale of the rest, 2 px ring in team color (party amber `#facc15`, enemy red `#dc2626`).
- Upcoming portraits: 44×44 px, 1.5 px ring.
- Captured units (per `capture.ts`): 1.5 px amber-700 ring (neutral, distinct from party amber).
- Inter-portrait gap: 8 px. Container has 12 px internal padding, `bg-stone-950/85` + `backdrop-blur-sm` + `border border-amber-900/50`.

### Portrait content

Each entry is a simple labeled disk, **no character art** (game ships placeholder portraits today; we already have `CharacterPortrait` from the dialog overhaul, which uses initials inside a colored shape — reuse it).

```tsx
<CharacterPortrait
  speaker={unit.name}
  size="md"               // 56 active / 44 upcoming
  active={isCurrent}
  ring={teamRingColor}
  shape={classToShape(unit.classId)}  // re-uses dialog mapping
/>
```

Below each portrait, a 10 px monospace HP indicator: `12/22` in amber-200 if > 30%, red-400 if ≤ 30%, dimmed if dead (dead units are filtered out, but defensive against transient frames during HitFlash).

### Interactions

- **Hover** (350 ms delay, matching tooltip standard) — show a `<Tooltip>` over the portrait with: full name, class, current HP/AP, current SPD, status effects active. Tooltip uses our existing `<Tooltip>` wrapper.
- **No click handler.** Strip is read-only this iteration. Click-to-pin-camera is a future enhancement.
- **Live update on every state change.** The Zustand selector subscribes to `state.units` (for HP and death) and `state.turn.unitId` (for active highlight). Framer Motion handles the active-portrait scale transition (`animate={{ scale: isActive ? 1.2 : 1.0 }}`, `transition={{ duration: 0.18 }}`).

### Position & z-index

- `position: fixed; bottom: calc(8px + var(--card-hand-height))` — sits ABOVE the card hand, OR if hand is collapsed (enemy turn), at `bottom: 8px`.
- `z-index: 90` (HUD layer; below modals but above BoardScene's React shell).
- `pointer-events: auto` on the strip itself; the wrapping HUD div (`combat-hud`) keeps `pointer-events: none` so clicks fall through to the canvas everywhere else (`CombatHud.tsx:20`).

### Empty / edge states

- **Pre-startBattle (BOOT/DEPLOY phase):** strip not rendered.
- **Single unit alive (round-robin to themselves):** show 1 portrait. No "+N" badge.
- **Wrap-around within a round:** the queue is cyclic, but the strip shows ONLY the remaining actors in the current round (slice from `currentIdx` to end of the cycle, then wrap if visible space remains). When wrapping, prepend a tiny `↺` separator at the wrap point.
- **Captured / removed mid-battle:** filtered out by `isAlive` check. Capturing makes a unit not-alive for combat purposes — already handled.

### Component structure

```
src/ui/scenes/combat/
  InitiativeStrip.tsx        — top-level component
  InitiativeEntry.tsx        — one portrait + HP label
  useInitiativeQueue.ts      — selector hook returning UnitId[] in display order
```

Wired into `CombatHud.tsx` as a sibling to `<TopBar />`.

### Tests

1. **Selector unit test (`useInitiativeQueue.test.ts`):**
   - Empty units → `[]`
   - All alive, current = first → returns `[u1, u2, u3, ...]`
   - Current is third → returns `[u3, u4, u5, u6, u7, u8, u1↺, u2]` (wrap order)
   - One unit dead → filtered out, length = N-1
   - Modifiers applied → reorders correctly per SPD math
2. **Component test (`InitiativeStrip.test.tsx`):**
   - Active unit has `data-active="true"` and 1.2× transform scale
   - Hover triggers tooltip with full unit name + class
   - HP color reflects current/max ratio
   - No render when phase = BOOT
   - "+N" badge appears when queue > 8

---

## Section 2: Forecast panel

### Precondition: fix armor in the reducer

Before the forecast UI lands, `combatReducer.ts:200-220` must be patched to actually consume armor. This is a **separate, prior task** in the implementation plan; the forecast spec presumes it's done.

**Corrected formula** (mirrors Godot's `combat_manager.gd`):

```ts
function applyDamage(target: Unit, amount: number, damageType: 'physical' | 'magic'): {
  newHp: number
  newArmor: number
  hpLost: number
  armorLost: number
} {
  if (damageType === 'physical') {
    // Armor absorbs first.
    const armorLost = Math.min(target.armor, amount)
    const hpLost = amount - armorLost
    return {
      newArmor: target.armor - armorLost,
      newHp: Math.max(0, target.hp.current - hpLost),
      armorLost,
      hpLost,
    }
  } else {
    // Magic: half through armor, half direct.
    const halfArmored = Math.floor(amount / 2)
    const halfPiercing = amount - halfArmored
    const armorLost = Math.min(target.armor, halfArmored)
    const armoredHpLost = halfArmored - armorLost
    const totalHpLost = armoredHpLost + halfPiercing
    return {
      newArmor: target.armor - armorLost,
      newHp: Math.max(0, target.hp.current - totalHpLost),
      armorLost,
      hpLost: totalHpLost,
    }
  }
}
```

DR (terrain + DEF/RES) is applied to `amount` BEFORE this function. So the full pipeline is:

```
raw   = card.base + stat
afterDR = max(0, raw - dr)
{ newHp, newArmor, hpLost, armorLost } = applyDamage(target, afterDR, type)
```

This function moves to `src/systems/damage.ts` so both the reducer and the forecast can call it (single source of truth — forecast cannot drift).

### When the forecast appears

**Two states**, distinct from each other:

1. **Hover preview (existing, kept).** When the player hovers a tile that's a valid target for the currently selected card, a single floating red number renders above each affected unit. KO skull `☠` icon if `predicted_HP <= 0`. No panel. Instant, no delay. Already implemented in `BoardScene.ts` damage-preview path; needs the KO indicator added.
2. **Pin (new).** When the player clicks a target tile (entering the implicit "confirm play" stage before the action commits), the full forecast panel pins next to the target until either: (a) the player clicks again to confirm and play, (b) the player right-clicks / Esc to cancel, or (c) the player picks a different target tile, in which case the panel re-pins to the new target.

This matches the Slay-the-Spire / FE pattern: hover = cheap, click = expensive but committed.

> **NOTE on existing flow:** today, clicking a target tile fires `playCard` directly. The pin-then-confirm flow adds one click. This is intentional for Iron Sword / lethal cards where the player wants to be sure. We can revisit if playtest shows it's friction; a `Shift-click` to skip the panel and play immediately is a likely future shortcut.

### Layout — single targeted card on a single enemy

```
┌──────────────────────────────────────────────────┐
│  ⚔  STEEL THRUST                          [2 AP] │  ← title row
│  ─────────────────────────────────────────────── │
│  ┌──────────┐                  ┌──────────┐      │
│  │   ROY    │       →          │  BANDIT  │      │  ← combatant row
│  │   ⬡ 18   │                  │   ⬡ 14   │      │
│  └──────────┘                  └──────────┘      │
│  HP 18/22                       HP ▓▓▓░░  4/14   │  ← HP bars
│                                 Armor ▓▓░  2 → 0 │
│  ─────────────────────────────────────────────── │
│  Damage  11 base + 6 STR + 3 might − 4 DR  = 16  │  ← math row (collapsed by default)
│         (− 2 armor, − 14 HP)                     │
│  ─────────────────────────────────────────────── │
│  Status:  bleed (2 turns)        ☠ LETHAL        │  ← status + KO badge if applicable
└──────────────────────────────────────────────────┘
```

**Position: fixed top-right of viewport.** `position: fixed; top: 16px; right: 16px; width: 360px;` — never moves with cursor, never occludes the target, predictable across all targeting sessions. The target identity is communicated via the combatant row (target portrait + name), not via panel placement.

Rationale: floating-relative-to-target panels work in Slay the Spire because targets sit on a static row at known positions. On our 14×10 grid, targets can be near any edge — a "right-of-target" panel near the right wall has to flip left, which moves the player's eye across the screen mid-decision. A fixed corner avoids that and matches Banner Saga's combat-summary placement.

Sections, in order:
1. **Title row.** Card name + AP cost chip. AP cost in amber-300, bold.
2. **Combatant row.** Source portrait → arrow → target portrait. Reuses `CharacterPortrait`. For self-targeted cards (Rally, Fortify, etc.), only one portrait, no arrow.
3. **HP/Armor bars.** Two-segment bar per combatant: filled segment = current, dimmed-red segment = predicted loss, empty = max headroom. Numeric label `current/max` to the right; "→ N" delta in amber-300 next to it. Armor row only renders if target has armor > 0.
4. **Math row.** Collapsed by default to just the final damage number; a small `▾` toggle expands it to show the breakdown. The breakdown shows the literal terms in the formula in this order: `base + stat + might − DR = afterDR`, then `(− N armor, − M HP)` if physical with armor, or `(− N armor magic, − M HP)` if magic.
5. **Status preview row.** Each status effect this card applies, as a chip: `🩸 bleed (2t)`, `🔥 burn (3 dmg / turn, 2t)`, `❄ slow −1 SPD (1t)`, etc. Pulled from `card.effects` via `ApplyStatus` kind.
6. **KO badge.** When `predicted_HP === 0`, render `☠ LETHAL` chip in red-400 in the bottom-right, larger font.

### Layout — AOE / multi-target cards

For cards with `aoeRadius` or `targetKind === 'all_enemies'`:

- Title row stays the same.
- Combatant row collapses to source portrait alone, with `→ AOE × N` annotation showing affected target count.
- HP bars become a vertical stack of mini-rows, one per affected target: small portrait, name, HP delta. Cap at 4 visible; if > 4 affected, last row reads `+ (N − 4) more`.
- Math row shows base damage once; per-target HP losses are individual.
- Status row applies to all affected targets unless effect specifies `splash`.

### Layout — heal / armor / utility cards

For Heal: the "damage" math row shows `+ N healed`, no armor section. The target's HP bar grows green.
For GrantArmor: HP bar unchanged; armor row shows `+N armor` in amber-700.
For DrawCards / GainAp: no combatant row; show "Draws N cards", "Gain N AP" as a single-line center-aligned message in the panel body.

### Interactions

- **Right-click anywhere / Esc:** dismiss panel and return to SELECTING_TARGET subPhase.
- **Click target portrait → re-pin to that target.** No-op if same tile.
- **`Enter` / click confirm icon at top-right of panel:** dispatch `playCard`.
- **`▾` chevron in math row:** expand/collapse the breakdown. Toggles `showBreakdown` local state. Persists during a single card's targeting session; resets when card is deselected.

### Component structure

```
src/ui/scenes/combat/
  ForecastPanel.tsx                — top-level pinned panel
  ForecastCombatantRow.tsx         — portrait + arrow + portrait
  ForecastHpBar.tsx                — HP/armor bar with delta segment
  ForecastMathRow.tsx              — collapsible damage breakdown
  ForecastStatusRow.tsx            — status effect chips
  useForecastPreview.ts            — selector hook computing preview from selected card + pinned target
src/systems/
  damage.ts                        — applyDamage + computeForecast (pure)
```

`computeForecast(card, source, target, terrainDr): ForecastResult` is the single shared function. Reducer calls it inside `playCard`; UI calls it inside `useForecastPreview`. They cannot drift.

### Edge cases

- **Target dies mid-forecast** (e.g. an ally's status tick at start of turn KOs the pinned target before play): selector returns `null`, panel auto-dismisses, sub-phase falls back to SELECTING_TARGET.
- **Source dies mid-forecast** (rare; status backlash on play-out): same — auto-dismiss, drop selection.
- **AP changes mid-forecast** (unlikely but possible if a passive aura ticks): panel re-renders with new AP affordability. If now unaffordable, the title-row AP chip turns red and the confirm button disables.
- **Card has no `damageStat`** (e.g. pure heal or buff card): omit the `+ stat` term from the math row.
- **Negative damage from terrain DR exceeding raw** (`raw < dr`): math row shows `0` after a `min(0)` term; combatant row shows "no damage" message instead of HP bar.

### Tests

1. **`damage.test.ts` (pure function):**
   - Physical, no armor: full hpLost, armor unchanged
   - Physical, armor > damage: armor consumes all, hp unchanged
   - Physical, armor < damage: armor zeroed, residual to hp
   - Magic, no armor: full hp loss
   - Magic, half armor blocks: armor and hp both reduced per spec
   - DR exceeds raw: returns 0 hp lost, 0 armor lost
   - Heal: hp grows, capped at max
2. **`computeForecast.test.ts`:**
   - Steel Thrust on bandit with 2 armor 14 HP: returns `{ damageBefore: 16, armorLost: 2, hpLost: 14, predictedHp: 0, lethal: true }`
   - Heal staff on Roy at 10/22: `{ heal: 8, predictedHp: 18 }`
   - Fire tome (magic) on knight with 3 armor 20 HP: `{ damageBefore: 8, armorLost: 2, hpLost: 6, predictedHp: 14 }` (4 magic split: 2 to armor, 2 hp via halved-armor; 4 piercing → hp; total 6 hp lost)
3. **Reducer integration tests:**
   - Existing tests in `combatReducer.test.ts` updated to assert armor consumption matches the new formula. Two tests previously asserted "armor stays 0 after damage" — those become "armor goes from N to N − damage" assertions.
4. **Component tests (`ForecastPanel.test.tsx`):**
   - Renders title, AP cost, source/target portraits when both are set
   - HP delta segment width matches predicted loss
   - Lethal badge appears iff predictedHp === 0
   - Status row renders one chip per ApplyStatus effect
   - Math row collapsed by default; clicking chevron expands
   - Right-click dismisses
   - Auto-dismiss when target dies (state mutation in test)
5. **E2E (`tests/e2e/combat-forecast.spec.ts`):**
   - Click party unit → click card → click enemy: panel renders with correct numbers
   - Click confirm: card plays, target HP matches forecast
   - Right-click: panel dismisses, sub-phase = SELECTING_TARGET

---

## Cross-cutting decisions

### Color palette

Reuse Stone & Steel:
- Active ring: `#facc15` (amber-300, party) / `#dc2626` (red-600, enemy)
- HP fill: `#16a34a` (green-600) → `#facc15` (amber-300, ≤50%) → `#dc2626` (red-600, ≤25%)
- Armor fill: `#a16207` (amber-700, distinct from HP)
- Lethal badge: `#dc2626` background, white text
- Math row breakdown: `#a8a29e` (stone-400) text, `#fbbf24` (amber-400) terms

### Bundle impact

Estimated additions:
- InitiativeStrip + 2 sub-components: ~3 KB gzipped
- ForecastPanel + 4 sub-components + damage.ts: ~6 KB gzipped
- New tests: 0 (test code is bundled separately)

Total: ~9 KB. Current headroom from `phaser-vertical-slice` baseline: `+75 − 42.03 = 32.97 KB`. Safe margin.

### Performance

- Selector benchmark for `useInitiativeQueue` should stay < 50 µs (target P95 < 8 ms includes downstream rendering).
- Forecast panel render frequency: at most one per click (target pin), not per hover. No frame-rate concerns.
- `damage.ts` is pure synchronous arithmetic. Microbench < 1 µs per call.

### Accessibility

- Initiative strip portraits all have `role="img"` + `aria-label="<name>, <class>, <hp/max>, next at position N"`.
- Forecast panel is a `role="region" aria-label="Combat forecast for <card> on <target>"`.
- HP bars use color + numeric label, never color alone.
- Right-click dismiss is duplicated as Escape (keyboard).
- Confirm button is a real `<Button>` from our component library; Tab-reachable.

### Localization

Strings in this spec are placeholders; all user-facing strings use a `t('combat.forecast.*')` key. Concrete keys:
- `combat.initiativeStrip.tooltip` (template: `{name} • {className} • HP {hp}/{max} • SPD {spd}`)
- `combat.forecast.lethal` (literal: `LETHAL`)
- `combat.forecast.damageBreakdown` (template: `{base} base + {stat} {statName} + {might} might − {dr} DR = {total}`)
- `combat.forecast.armor` (literal: `Armor`)
- `combat.forecast.confirm` (literal: `Play`)

i18n infrastructure doesn't exist yet; for now strings are inline English. The keys are documented so the future i18n pass has a target list.

---

## Risks

1. **Reducer-armor change breaks existing balance.** Several enemy classes were tuned assuming armor is cosmetic. After fix, knights and obsidian-axe wielders become measurably tougher. **Mitigation:** run the existing balance tests (`fe-tactics-balance.skill`); be willing to retune base damage by ±1 if combat lengths shift > 20%.
2. **Forecast panel may overlap initiative-strip tooltip or DevHud.** Both anchor at `top-right` / are screen-fixed at top edge. **Mitigation:** forecast panel sits at `top: 16px; right: 16px; z-index: 95` (below modals, above DevHud's z-90). Initiative-strip tooltips are transient and dismiss on mouse-leave; collision window is ≤ 200ms.
3. **Initiative selector may render too often on `state.units` changes.** Each HitFlash mutates a unit object; if the selector subscribes too broadly, every flash triggers a strip rerender. **Mitigation:** subscribe only to `(unit.id, unit.hp.current, unit.armor)` projections via Zustand `selectorWithEqualityFn`.

## Out of scope (deferred to follow-up specs)

- Per-status-effect tooltip on chip hover ("bleed: 2 dmg/turn for 2 turns")
- Initiative-strip click-to-pin-camera-on-unit
- Forecast for Move-during-Action cards (Charge): predicting destination tile + post-move attack
- Mobile / touch sizing
- Right-click context menu on initiative entries (kick to console, zoom on map, etc.)

## Sources / prior art

- **Banner Saga UI Database** — portrait-queue initiative strip, blue/red rings, current-actor scale
- **Fire Emblem Three Houses combat forecast** — HP-bar-with-predicted-loss segment
- **Slay the Spire** — single-number hover preview vs. detailed click-to-confirm pattern
- **Into the Breach** — deterministic forecast precedent (no Hit/Crit rows)
- **`docs/superpowers/specs/2026-05-09-ui-input-overhaul-design.md`** — wrapper component policy (`<Button>`, `<Tooltip>`, `<Dialog>`)
- **Internal: `combat_manager.gd`** (Godot) — armor consumption rules ported back

## Implementation order

This spec produces ONE plan with FIVE sequential tasks (each is a self-contained commit):

1. **CHF-1 — `damage.ts` pure function + tests.** New module, no consumers. Tests pass in isolation.
2. **CHF-2 — Wire `damage.ts` into `combatReducer.ts:200-220`.** Update reducer tests for the new armor behavior. All existing combat e2e still pass.
3. **CHF-3 — `useInitiativeQueue` selector + `InitiativeStrip` component.** Pure UI; no reducer change. Wire into `CombatHud`.
4. **CHF-4 — `ForecastPanel` + sub-components.** Wire into `CombatHud` with target-click pin behavior. Updates `BoardScene.ts` to dispatch a `pinForecast` event instead of immediate `playCard` on tile-click during SELECTING_TARGET.
5. **CHF-5 — KO indicator on hover preview.** Adds the `☠` skull rendering in `BoardScene.ts` damage-preview path. Single small commit.

Each task ends with all six gates green: typecheck, unit, e2e, check-context-doc, build, perf-gates.

After this spec is approved, I'll write the implementation plan with the five tasks broken into TDD steps.
