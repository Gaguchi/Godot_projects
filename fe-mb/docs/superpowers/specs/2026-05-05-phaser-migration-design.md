# Phaser Migration — Design Spec

> Migration of FE_MB tactical roguelite from Godot 4.6 (GDScript) to TypeScript + Phaser 4 + React + Vite stack. First milestone is a combat sandbox that validates the stack and the AI iteration loop.

**Status:** Approved 2026-05-05
**Author:** Project owner + Claude Code (council-of-five + 4-track deep research)
**Supersedes:** N/A (first migration spec)

---

## 1. Context

FE_MB is ~6 months into Godot 4.6 development. Substantial systems exist: card-based combat (12-card decks, 3 AP, AOE/heal/capture), 9 unit classes, 5 town menus, save migration to v0.4.0, quest system, overworld with travel encounters, and ~10K lines of JSON content (cards, items, towns, quests, dialogue, maps).

The bottleneck driving this migration is the AI-assisted dev loop. In Godot, AI agents cannot directly observe rendered UI — every iteration requires the human to F5, screenshot, and paste back. Mouse_filter quirks, .tscn opacity, and Theme/StyleBox editor coupling compound the friction.

A council-of-five debate plus four parallel deep-research tracks (Phaser, PixiJS+React, Bevy/native, AI-tooling SOTA) converged on:

- **Web stack with Playwright MCP** offers ~10x edit-to-see latency improvement over Godot.
- **Phaser 4** (released April 2026) plus the **Phaser Editor v5 + MCP** (also April 2026) is the most agent-instrumented web game framework available.
- **OpenAI demoed a turn-based tactical RPG** on Phaser + GPT-5.4 + Codex + Playwright in March 2026 — direct precedent for the genre.
- **Tauri's Steam Overlay is broken** (WebView2 issue #6196 closed *not planned*); **Electron + steamworks.js** is the proven path.
- **Bevy ruled out** — UI weakness (`bevy_ui` pre-1.0), breaking releases each version, smaller AI corpus.

## 2. Migration Philosophy: Reference Rebuild

Read existing GDScript to extract design intent and edge-case knowledge. Write fresh TypeScript. Do not mechanically port.

**Why:** Six months of GDScript holds tribal knowledge the design docs miss (e.g., the array-mutation bug in MEMORY.md is design, not just a fix). A clean rebuild ignoring GDScript will silently re-introduce solved problems. A pure port carries Godot-shaped abstractions into a stack that wants different shapes.

**Boundary:** GDScript is reference, not source. Combat math formulas, capture chance, AP economy — preserved by intent. UI structure, scene wiring, signal flow — rewritten.

## 3. Stack Decision

| Layer | Choice | Pinned version |
|---|---|---|
| Language | TypeScript | ^5.7.0 (strict + noUncheckedIndexedAccess) |
| Game framework | Phaser | ^4.0.0 |
| UI shell (modals only) | React + ReactDOM | ^19.2.0 |
| Build / HMR | Vite | ^6.0.0 |
| State | Zustand | ^5.0.0 |
| Schema validation | Zod | ^3.23.0 |
| Styling (modals) | Tailwind CSS | ^4.0.0 (Oxide engine) |
| Unit testing | Vitest | ^2.0.0 |
| E2E + visual regression | Playwright | ^1.50.0 |
| Steam packaging (deferred) | Electron + steamworks.js | latest at packaging time |

**Explicitly rejected:**
- **Tauri** — Steam Overlay does not hook WebView2; closed *not planned* upstream.
- **PixiJS + custom scenes** — more DIY; Phaser's batteries (scene system, asset loader, tweens, input) outweigh bundle size for a UI-heavy tactical RPG.
- **Bevy / Rust** — UI corpus and iteration speed lose for this project shape.
- **Phaser Editor v5 desktop app** — useful for static scene design; less useful for procedural combat. Code-first is cleaner for the agent loop.
- **Phaser 3** — final stable, migration path is forward to v4.

## 4. First Milestone — Combat Sandbox (~2 weeks)

**Goal:** Prove the stack and AI iteration loop solve the migration motivation, before committing to wider port.

**In scope:**
- Single fixed battle: 14×10 grid
- 3 player units (Roy/Marcus/Lilina) with full 12-card class decks
- 3 enemy types (Bandit, Mage Bandit, Bandit Captain) with simple AI
- Card hand UI (5 cards drawn, 3 AP per turn, hover preview, AOE preview, targeting cancel)
- Combat math: deterministic damage = `card_base + stat - DR`
- MOVE phase (free movement) → ACTION phase (play cards)
- Capture/subdue mechanic (HP%-based, surround bonus)
- Win/lose conditions (party defeats all enemies / Roy dies / all units down)
- Victory/Defeat React modals
- Vitest unit tests for pure logic
- Playwright E2E + visual snapshot baselines

**Out of scope (deferred):**
- Sharpness, quick slots, weapon-card compatibility
- Status effects (poison, burn, slow, immobilize)
- Save system (sandbox is one-shot)
- Towns, overworld, dungeon, dialogue, quests
- Asset polish beyond Kenney sprites + Phaser Graphics primitives
- Steam packaging
- Audio polish (5 placeholder SFX only)

## 5. Project Layout

`phaser/` is a self-contained sibling of the existing Godot project root.

```
fe-mb/
├── docs/                                # SHARED design source-of-truth
├── godot/                               # (existing project — rename later, not now)
└── phaser/                              # NEW project
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json                    # strict + noUncheckedIndexedAccess
    ├── playwright.config.ts
    ├── vitest.config.ts
    ├── index.html
    ├── public/assets/
    │   ├── sprites/                     # Kenney units/enemies
    │   └── tiles/                       # Kenney terrain
    ├── src/
    │   ├── main.ts                      # mount Phaser + React shell
    │   ├── game/
    │   │   ├── scenes/                  # BootScene, CombatScene
    │   │   ├── entities/                # Unit, Enemy, Card runtime classes
    │   │   ├── systems/                 # combatResolver, deckManager, turnManager, enemyAI, targeting
    │   │   ├── input/                   # input handling, hover preview
    │   │   └── render/                  # gridRenderer, cardHandRenderer, hpBars
    │   ├── ui/
    │   │   ├── App.tsx                  # React shell — modals only
    │   │   ├── shell/                   # PauseModal, VictoryModal, DefeatModal
    │   │   └── theme/                   # Tailwind tokens (Stone & Steel)
    │   ├── data/                        # flat for sandbox; nested folders later
    │   │   ├── schemas/                 # Zod: card.ts, unit.ts, enemy.ts
    │   │   ├── cards.json
    │   │   ├── units.json
    │   │   ├── enemies.json
    │   │   └── load.ts                  # parse + validate at boot
    │   ├── state/
    │   │   ├── combatStore.ts           # Zustand: phase, units, decks, selectedCard
    │   │   └── eventBus.ts              # cross-system events
    │   └── utils/
    ├── tests/
    │   ├── unit/                        # Vitest
    │   └── e2e/                         # Playwright
    └── .claude/                         # CLAUDE.md + MCP config local to phaser/
```

## 6. Architecture

**Runtime model — one canvas, one DOM overlay:**

```
index.html
  └─ <div id="root">
       ├─ <canvas id="phaser">       ← Phaser game (combat, grid, units, cards, HUD)
       └─ <div id="react-shell">     ← React DOM (modals only, transparent until shown)
              └─ <App /> reads from Zustand → renders modal when phase = VICTORY/DEFEAT/PAUSED
```

Both share the Zustand `combatStore` as the bridge. Phaser writes phase changes; React reacts.

**Phaser scenes:**
- `BootScene` — load Kenney sprites, parse + Zod-validate JSON data files, hand off to CombatScene with validated game state.
- `CombatScene` — owns the grid, units, card hand, HUD, all input. Single scene for the sandbox; future milestones add `OverworldScene`, `TownScene`.

**Pure-logic systems (no Phaser dependency):**
- `combatResolver.ts` — `resolveCard(card, source, target, state) → DamageResult`. Pure function, fully unit-testable.
- `deckManager.ts` — per-unit draw/discard/reshuffle. Detached arrays only (lesson from Godot MEMORY.md: never mutate shared array references).
- `turnManager.ts` — phase transitions, turn order calculation.
- `enemyAI.ts` — closest-target-or-flee for sandbox; richer in later milestones.
- `targeting.ts` — given a card + source tile, return valid target tiles + AOE coverage.

**Why pure systems matter:** AI iterates combat math via Vitest in milliseconds without spinning up Phaser. Vitest can run `combatResolver` 1000× in seconds for balance testing.

## 7. Data Flow

**Combat state machine (in `combatStore`):**

```
BOOT → DEPLOY → COMBAT → VICTORY | DEFEAT

Within COMBAT, sub-phases per unit's turn:
  TURN_START → MOVE_PHASE → ACTION_PHASE → END_TURN → next unit

Within ACTION_PHASE, card play sub-state:
  IDLE → SELECTING_CARD → SELECTING_TARGET → RESOLVING → IDLE
```

**Data flow for "play a card":**

1. User clicks a card → `CombatScene` dispatches → `combatStore.selectCard(cardId)`.
2. Store sets `selectedCard`, sub-phase → `SELECTING_TARGET`.
3. `CombatScene` reactively redraws: highlights valid tiles, shows AOE preview on tile hover, shows damage prediction on enemy hover.
4. User clicks target tile → `combatStore.confirmTarget(tile)`.
5. Store calls `combatResolver.resolveCard(...)` → returns `DamageResult` (HP changes, status effects, KOs).
6. Store applies result, triggers `combatAnimator.play(result)` (Phaser tween chain).
7. Animator finishes → store advances sub-phase → `IDLE`, AP decremented.
8. If unit died: store checks victory/defeat conditions → if met, phase → `VICTORY`/`DEFEAT` → React shell mounts the modal.

**Data load flow (boot):**

1. `BootScene.preload()` loads Kenney sprite atlases.
2. `BootScene.create()` reads `data/*.json` → passes through Zod schemas → on validation error, mounts a fatal error overlay with line/path info.
3. On success, hands typed data to `CombatScene`.

## 8. Error Handling

Three layers, fail-fast where possible:

1. **Boot-time data validation (Zod, fatal):** All JSON parsed through Zod schemas. Malformed data → boot fails with line/path info → red error overlay (no game). Catches typos, missing fields, wrong types. Cheap to build, catches the dominant class of "AI generated bad data" issues.

2. **Combat-time invariants (fail-fast in dev, soft in prod):** Pure systems throw on impossible state (e.g., `selectedCard` is null when entering `RESOLVING`). Dev build crashes immediately with stack. Prod build logs, returns to `IDLE`, surfaces a non-fatal toast.

3. **User-facing errors (modals):** Save corruption (future), asset load failure → React error modal with restart option. No silent failures.

**Anti-pattern:** No defensive try/catch sprinkled in internal code. Internal code trusts itself. Validation only at system boundaries (JSON load, save load, user input).

## 9. Testing Strategy

- **Vitest (unit, fast):** Pure systems only. Goal: 100% coverage of `combatResolver`, `deckManager`, `turnManager`, `targeting`. No Phaser, no DOM. These are the math/correctness tests. Sub-second test runs.
- **Playwright (E2E, AI-readable):** Boot the game, screenshot, click cards, screenshot, assert state. Each test is a 5-10s scenario. AI uses Playwright MCP to *write* and run these.
- **Visual snapshots (regression baselines):** Card hand layout, grid with units placed, modal layouts. AI screenshots every UI change; baselines block silent visual breakage.
- **No early integration tests between Phaser + React** — they communicate only through Zustand, so testing the store directly is enough.

**MCP / AI loop concretely:**

```
1. AI edits src/game/render/cardHandRenderer.ts
2. Vite HMR fires (~100ms)
3. AI calls Playwright MCP: navigate /sandbox, screenshot card hand
4. AI compares to baseline: visual diff
5. If regression → AI re-edits or commits new baseline
6. Loop until AI is satisfied, then surfaces to human
```

**Target end-to-end edit-to-see latency: under 5 seconds.** This is the migration's success metric.

## 10. Build Order — 2 weeks, risk-driven

```
DAY 1-2 — SCAFFOLD + AI LOOP (HIGHEST RISK FIRST)
  □ npm create vite@latest phaser/ -- --template react-ts
  □ Install: phaser@4, zustand, zod, tailwindcss@4, vitest, @playwright/test
  □ tsconfig strict + noUncheckedIndexedAccess
  □ BootScene that loads 1 sprite, displays it
  □ React shell: empty <App /> mounted alongside canvas
  □ Playwright config + 1 smoke test (navigate, screenshot)
  □ MCP config in .claude/ for Playwright
  □ Verify: AI can edit a sprite position, screenshot, see change
  GOAL: AI iteration loop working end-to-end

DAY 3-5 — CARD HAND UI (HARDEST UX)
  □ 14×10 grid renderer (CombatScene with placeholder tiles)
  □ Card data Zod schema + 5 hand-curated cards in JSON
  □ Card hand at bottom: 5 cards rendered, fan layout
  □ Hover state: lift, dim others
  □ Click to select: glow, sub-phase → SELECTING_TARGET
  □ On hover-after-select: highlight valid tiles on grid
  □ AOE preview ring on tile hover (for AOE card)
  □ Cancel via right-click or ESC
  □ Visual baseline: card hand idle / selected / hovering target
  GOAL: full targeting UX works visually before any combat resolves

DAY 6-8 — COMBAT MATH + RESOLUTION
  □ Unit/Enemy entities with HP/STR/MAG/SKL/SPD/DEF/RES
  □ combatResolver: damage = card_base + stat - DR
  □ deckManager: 12-card deck, draw 5, discard, reshuffle
  □ turnManager: party turn → enemy turn alternation
  □ Apply damage, flash sprite, damage number popup
  □ Death: sprite fade, remove from grid
  □ Vitest: 20+ unit tests on resolver, deck, turn
  GOAL: a card actually does damage end-to-end

DAY 9-10 — CONTENT + AI
  □ Roy/Marcus/Lilina full kits (3 classes × 12-card decks)
  □ 3 enemy types (Bandit, Mage Bandit, Bandit Captain)
  □ Simple enemy AI: move toward closest unit, attack if adjacent
  □ Capture mechanic: surround logic, capture button on adjacent enemy
  □ Win condition: all enemies dead/captured
  □ Defeat condition: Roy dies (lord mechanic) or all units down
  GOAL: a complete battle is playable start-to-finish

DAY 11-14 — POLISH + SHIPPABILITY
  □ Victory/Defeat React modals with restart
  □ Sprite animations: walk, attack, hit, die (Phaser tweens)
  □ Hit-stop on damage (~80ms freeze)
  □ Camera shake on big hits
  □ Audio: 5 SFX (hit, miss, draw, victory, defeat)
  □ Visual snapshot suite covers: hand, grid, modals
  □ README in phaser/ with run/test/build commands
  □ Demo recording for review
  GOAL: shareable build that proves the stack works
```

## 11. Risks

- **Phaser 4 maturity** — released April 2026; library + plugin ecosystem still settling. *Mitigation:* sandbox uses only stable Phaser core APIs (Scene, Container, Tween, Input). Avoid bleeding-edge plugins.
- **No marquee tactical RPG on Phaser yet** — direct genre precedent is OpenAI's March 2026 demo only. *Mitigation:* sandbox milestone exists specifically to validate this assumption cheaply.
- **DOM-canvas event coordination** — pointer bleed-through and z-index stacking are known Phaser gotchas. *Mitigation:* React shell is modals only, not overlapping interactive UI; cards live in canvas.
- **Steam shipping path (deferred risk)** — Electron + steamworks.js works for ~5,700 NW.js/Electron games but adds ~120 MB binary. *Mitigation:* defer Steam concerns until vertical-slice content milestone, not sandbox.
- **Migration scope creep** — temptation to port the full game in one shot. *Mitigation:* sandbox is hard-capped at 2 weeks; further milestones planned only after sandbox ships.

## 12. Open Questions Deferred to Future Milestones

- Save format design (target Milestone 2 — first town/overworld build).
- Audio system architecture (target Milestone 3 — polish pass).
- Asset pipeline beyond Kenney (target Milestone 4 — vertical slice).
- Mobile / Steam Deck target (out of scope until v1.0).
- Mod support (out of scope; revisit post-launch).

## 13. Success Criteria for the Sandbox Milestone

The sandbox is "shipped" when all of:

1. A complete battle (3v3, full kits, capture) is playable start-to-finish in the browser.
2. Vitest suite has ≥20 passing tests covering combat math, deck, turn order.
3. Playwright suite has ≥5 E2E scenarios with visual snapshot baselines.
4. Edit-to-see latency for a card-render change is measured at under 5 seconds via Playwright MCP.
5. README documents run/test/build commands.
6. A demo recording (~2 min) of one full battle is captured.

If any of these fail, the migration premise itself is reconsidered before scaling to the next milestone.
