# Phaser Foundations — Design Spec

> Foundations-first redesign of the FE_MB phaser migration. Replaces the feature-first sandbox plan (`2026-05-05-phaser-sandbox.md`) which built generic 12-card class decks divorced from the game's actual equipment-card design. This spec scopes a foundation milestone whose load-bearing center is the equipment-card systems from `2026-03-29-ship-plan-design.md` — built fresh in TypeScript with discipline informed by a council-of-five review.

**Status:** Draft 2026-05-08
**Author:** Project owner + Claude Code (brainstorming + council-of-five)
**Supersedes:** `2026-05-05-phaser-sandbox.md` (sandbox plan abandoned). Migration spec `2026-05-05-phaser-migration-design.md` remains in force for stack-level decisions.

---

## 1. Context

The previous phaser sandbox built a "complete combat sandbox" in 27 commits and 5 phases. It produced working cards, units, animations, capture, modals, and visual snapshots — but the game it built was not FE_MB. It used hand-curated 12-card class decks; FE_MB is *equipment-card* (gear contributes cards to the deck). It had no hand slots, no rarity, no regional themes, no status effects, no innate-vs-gear card split. Polish on the wrong premise.

The fix is foundations-first. Build the systems that make FE_MB *FE_MB* before any scene art, before any animation polish, before any visual snapshot suite. The 03-29 ship plan's Phase 1 ("Equipment-Card Foundation") is the actual milestone target.

A council-of-five review of the initial proposal (4 sliced Zustand stores + pure-function systems) surfaced load-bearing flaws: implicit actions destroy replayability, cross-store transactions tear, `resolveCard()` is the wrong abstraction shape, Phaser scenes can't be "pure render reading store," save needs more than `JSON.stringify`. This spec incorporates those critiques.

## 2. Migration Philosophy (refresher)

Reference rebuild — read GDScript and the ship plan to extract design intent, write fresh TypeScript. Don't mechanically port. The 03-29 ship plan is the authoritative game design; the Godot codebase is reference for tribal knowledge and edge cases.

## 3. Foundation Milestone — Scope

**Goal:** the systems necessary to assemble a deck from gear, resolve cards, and tick a turn — fully unit-tested — built on an architecture that absorbs design churn and shipping operational reality (saves, debugging, observability) rather than fighting them.

**In scope:**
- Equipment-card data model (hand slots, gear cards, innate cards, rarity, regions)
- Pure combat reducer over a discriminated event union, with an effects queue for animation/sfx hand-off
- Effect pipeline for card resolution (cards emit `Effect[]` through registerable middleware)
- Status effects as lifecycle subscribers (poison + burn for foundation; `slow` and `immobilize` deferred to gear-content milestone)
- Two-store state architecture (`gameStore`, `combatStore`) with single `dispatch` chokepoints
- Seeded RNG interface threaded throughout combat
- Save format with `saveVersion`, content-id alias table, atomic hydration, dual-slot autosave, persisted action log (last 200 actions)
- Top-level React `ErrorBoundary`, global `errorBus`, dev-mode error HUD
- Phaser CombatScene shell with `CombatRuntime` POJO firewall (sprite refs, tween handles, hover state)
- Vitest unit tests on every pure system (TDD discipline)
- Playwright + visual-snapshot smoke test for the boot path
- Representative content: 3 classes (LORD, KNIGHT, MAGE), ~10 gear items spanning every weapon type and rarity tier across all 3 regions, 2 status effects (poison + burn)
- Replay harness (`reproduce(state, action) → { before, after, effects, diff }`) implemented and tested

**Out of scope (deferred to later milestones):**
- Combat scene polish (animations, hit-stop, camera shake, damage numbers, AOE preview rendering)
- Card hand UI, target selection UI, victory/defeat modals
- Overworld scene, town scene, dungeon, dialogue, quests
- Grid inventory drag-drop UI (the systems exist; the UI does not)
- Recruitment, capture flow UI, scout
- Asset polish beyond Kenney sprites
- Audio
- Formal save migration chain (versioning yes, migration ladder no — pre-alpha policy is "nuke saves with a loud warning")
- Steam packaging
- Multi-class enemies; foundation enemies are stat-bag stubs
- Slow/immobilize status effects (added when their gear lands in next milestone)

## 4. Stack (locked from migration spec, no change)

TypeScript ^5.7 (strict + `noUncheckedIndexedAccess`), Phaser ^4.0, React ^19, Vite ^6, Zustand ^5, Zod ^3, Tailwind ^4, Vitest ^2, Playwright ^1.50.

## 5. Render Boundary

- **Phaser canvas:** combat scene only (grid, units, animations, AOE preview, projectiles, damage numbers).
- **React DOM:** overworld, town, shop, grid inventory (8x4 drag-drop), deck preview, dialogue, modals.

Combat is the only genuinely canvas-shaped scene; everything else is list/detail panels and spatial-puzzle UI that React + Tailwind handles in a fraction of the code.

## 6. Project Layout

```
phaser/
├── package.json, vite.config.ts, tsconfig.json (locked, kept)
├── playwright.config.ts, eslint.config.js (locked, kept)
├── public/assets/                # Kenney sprites
├── .claude/CLAUDE.md, .mcp.json  # AI loop config (kept)
└── src/
    ├── main.tsx                  # mount Phaser canvas + React shell
    ├── data/
    │   ├── schemas/              # Zod: card, unit, item, class, statusEffect
    │   ├── content/              # JSON: cards.json, items.json, classes.json, units.json
    │   └── load.ts               # parse + validate + alias-resolve at boot
    ├── domain/                   # pure types, no I/O, no framework
    │   ├── ids.ts                # branded IDs (UnitId, ItemId, CardId)
    │   ├── card.ts               # Card, Effect, EffectKind interfaces
    │   ├── unit.ts               # Unit, HandSlots
    │   ├── item.ts               # Item, ItemKind, Rarity, Region
    │   ├── statusEffect.ts       # StatusEffect with lifecycle hook signatures
    │   ├── combatState.ts        # CombatState, CombatEvent (discriminated union), CombatEffect
    │   └── rng.ts                # RNG interface
    ├── systems/                  # pure functions only — no Phaser, no React, no I/O
    │   ├── deckBuilder.ts        # buildDeck(unit, classDef, leftHand, rightHand): Card[]
    │   ├── combatReducer.ts      # reduce(state, event, rng): { state, effects }
    │   ├── effectPipeline.ts     # runEffects(effects, ctx): { state, emitted }
    │   ├── statusEffects.ts      # registry of lifecycle hooks (poison, burn)
    │   ├── targeting.ts          # validTargets(card, src, state): TileId[]
    │   ├── turnOrder.ts          # InitiativeQueue: order(units, modifiers): UnitId[]
    │   ├── capture.ts            # captureChance(target, attackers, state): number
    │   └── enemyAI.ts            # planTurn(state, rng): CombatEvent[]
    ├── state/
    │   ├── gameStore.ts          # Zustand: party + inventory + world (single dispatch)
    │   ├── combatStore.ts        # Zustand: reducer-driven, dispatch + effects queue
    │   ├── actionLog.ts          # ring buffer (last 200), persisted with save
    │   └── errorBus.ts           # global event emitter for runtime errors
    ├── persistence/
    │   ├── saveFormat.ts         # SaveFile shape + saveVersion constant
    │   ├── save.ts               # serialize all stores
    │   ├── load.ts               # atomic hydration: parse → Zod → alias-resolve → swap
    │   └── contentAliases.ts     # table of renamed IDs
    ├── game/                     # Phaser
    │   ├── createGame.ts
    │   ├── scenes/BootScene.ts
    │   ├── scenes/CombatScene.ts # owns CombatRuntime; subscribes to combat.lastEffect
    │   └── runtime/CombatRuntime.ts  # plain mutable POJO: sprite refs, tween handles, hover
    ├── ui/                       # React
    │   ├── App.tsx
    │   ├── ErrorBoundary.tsx
    │   ├── DevHud.tsx            # last error + last 10 actions, dev-only
    │   └── shell/                # placeholder modals (real ones in later milestone)
    └── tests/
        ├── unit/                 # Vitest, mirrors systems/
        └── e2e/                  # Playwright smoke
```

## 7. Architecture: Two Stores, Single Dispatch

Two Zustand stores. Each exposes `state` and `dispatch(action)`. No store has setter methods other than `dispatch`. Every mutation is a typed action — auditable, loggable, testable.

```ts
// gameStore: persistent non-combat state
type GameAction =
  | { type: 'addUnitToParty'; payload: { unit: Unit } }
  | { type: 'equipHand'; payload: { unitId: UnitId; slot: 'left'|'right'; itemId: ItemId } }
  | { type: 'moveItemInBag'; payload: { itemId: ItemId; x: number; y: number } }
  | { type: 'addGold'; payload: { amount: number } }
  | { type: 'setFlag'; payload: { key: string; value: unknown } }
  | { type: 'applyBattleResult'; payload: { result: BattleResult } } // atomic battle-end

// combatStore: reducer-driven, exists only during combat
type CombatEvent =
  | { type: 'startBattle'; payload: { ... } }
  | { type: 'startTurn'; payload: { unitId: UnitId } }
  | { type: 'playCard'; payload: { cardId: CardId; srcId: UnitId; targets: TileId[] } }
  | { type: 'endTurn' }
  | { type: 'tickStatus' }
  | { type: 'capture'; payload: { targetId: UnitId; attackerIds: UnitId[] } }
```

`gameStore.dispatch` runs a single switch over `GameAction` and computes new state. `combatStore.dispatch` runs `combatReducer.reduce(state, event, rng) → { state, effects }`, then appends effects to its queue. Phaser drains the effects queue. The action log records every action across both stores.

Why two stores not one: combat state is ephemeral and frequently re-initialized (per battle); game state is persistent. Splitting their lifecycles keeps the persistence story clean.

Why two stores not four: cross-cutting transactions (recruitment writes party + inventory + world; battle-end writes party XP + inventory loot + world gold) need atomic dispatch in one store, not torn writes across slices.

## 8. Architecture: Combat Reducer + Effects Queue

`combatReducer.reduce(state, event, rng) → { state, effects }` is the only function that mutates combat state. Effects are typed:

```ts
type CombatEffect =
  | { kind: 'PlayTween'; sprite: SpriteRef; props: TweenProps; durationMs: number }
  | { kind: 'FloatDamage'; tile: TileId; amount: number; kind: 'physical'|'magic'|'heal' }
  | { kind: 'ShakeCamera'; intensity: number; durationMs: number }
  | { kind: 'PlaySfx'; key: string }
  | { kind: 'HitFlash'; sprite: SpriteRef; durationMs: number }
  | { kind: 'WaitForAnimations' }  // synchronization barrier
```

Effects are *intents to render*, not state. The reducer never touches Phaser. The Phaser CombatScene subscribes to `combatStore.effects` (an event-shaped channel, not a state slice), drains the queue, executes via its `CombatRuntime` (sprite refs, tween coordinator), then emits a `WaitForAnimations` complete signal back to the store, which advances to the next sub-phase.

This is the firewall. State changes are atomic and synchronous. Animations are async and live on the Phaser side. They communicate through a typed effect channel, never through shared mutable state.

## 9. Architecture: Effect Pipeline for Card Resolution

A card playing isn't "compute new HP and write it." A card emits an array of `Effect` objects that flow through middleware:

```ts
type Effect =
  | { kind: 'Damage'; targetId: UnitId; amount: number; damageType: 'physical'|'magic'; source: CardId }
  | { kind: 'Heal'; targetId: UnitId; amount: number; source: CardId }
  | { kind: 'ApplyStatus'; targetId: UnitId; effect: StatusEffectId; stacks: number; turns: number }
  | { kind: 'RemoveStatus'; targetId: UnitId; effect: StatusEffectId }
  | { kind: 'Move'; unitId: UnitId; tileId: TileId }
  | { kind: 'GrantArmor'; targetId: UnitId; amount: number }
  | { kind: 'DrawCards'; unitId: UnitId; count: number }
  | { kind: 'GainAp'; unitId: UnitId; amount: number }

type Middleware = (effect: Effect, ctx: PipelineCtx) => Effect[]
// returns 0+ effects (can absorb, transform, or amplify)
```

`runEffects(effects, ctx)` runs each through registered middleware in order:

1. **Source modifiers** (status effects on the source unit, e.g. `take_aim` adds +5 dmg to next attack)
2. **Target modifiers** (status effects on target, e.g. `marked` makes target take +3 dmg from all sources)
3. **Terrain modifiers** (forest gives +1 DEF to occupant)
4. **Card-specific modifiers** (e.g., `armorPiercing` skips the armor reducer)
5. **Armor reducer** (subtract DEF/2 for physical, RES/2 for magic, account for `armorPiercing`)
6. **Final clamping** (min 0, max effective HP)

The middleware list is the *single design lever* for "fire melts frost," "poison ignores armor on card X," "lord buff applies to adjacent allies." Adding a new interaction = registering a new middleware. No `if` ladders inside `resolveCard`.

This is what the Game Designer council member meant by "the load-bearing center is `resolveCard`, not deck-building." Every design iteration over weeks 3-8 will hit this pipeline, not gear data.

## 10. Architecture: Status Effects as Lifecycle Subscribers

Each status effect declares hooks:

```ts
interface StatusEffectDef {
  id: StatusEffectId
  name: string
  stackable: boolean   // burn=true, poison=false (poison refreshes at higher value)
  onApply?(ctx: HookCtx): Effect[]
  onTurnStart?(ctx: HookCtx): Effect[]
  onTurnEnd?(ctx: HookCtx): Effect[]
  onDamageTaken?(ctx: HookCtx, dmg: number, kind: DamageKind): { dmg: number; effects: Effect[] }
  onDamageDealt?(ctx: HookCtx, dmg: number): { dmg: number; effects: Effect[] }
  onTick?(ctx: HookCtx): Effect[]
  interactsWith?: Partial<Record<StatusEffectId, 'remove'|'consume'|'amplify'>>
}
```

Reducer dispatches lifecycle events at the appropriate phase transitions; subscribed effects respond by emitting their own `Effect[]`, which re-enter the pipeline. "Fire melts frost" = `frost.interactsWith.burn = 'remove'`. Foundation registers `poison` and `burn`; `slow` and `immobilize` arrive with their gear in the next milestone.

## 11. Architecture: Phaser Firewall

The `CombatScene` is the ONLY scene in the foundation milestone. It owns:

```ts
// CombatRuntime.ts — plain mutable POJO, scene-scoped
class CombatRuntime {
  spriteByUnitId: Map<UnitId, Phaser.GameObjects.Sprite>
  tilesContainer: Phaser.GameObjects.Container
  hoverTile: TileId | null
  activeTweens: Phaser.Tweens.TweenChain[]
  // ...
}
```

`CombatScene` subscribes to `combatStore.effects` queue using `subscribeWithSelector` middleware on `lastEffectId`. When a new effect lands, the scene drains the queue, executes effects via the `CombatRuntime`, and dispatches a `WaitForAnimations` complete event back when its tween chain settles.

**The scene NEVER does `combatStore.getState().units[i].hp` per frame.** State is read once on subscription change; every per-frame mutation is on `CombatRuntime`. This eliminates the GC pressure and selector-thrash class of bug.

The foundation only ships the *shell* of `CombatScene` plus a smoke test that boots, displays a placeholder grid, and proves the firewall works (effect dispatched → scene receives → runtime executes). Full combat rendering arrives in the next milestone.

## 12. Data Model

All data validated through Zod at boot. Domain interfaces are the source of truth for runtime; Zod schemas are derived.

### Unit

```ts
interface Unit {
  id: UnitId          // branded
  name: string
  classId: ClassId
  level: number
  hp: { current: number; max: number }
  stats: { str: number; mag: number; skl: number; spd: number; def: number; res: number }
  hand: { left: ItemId | null; right: ItemId | null }
  position: TileId | null
  ap: number
  armor: number
  statuses: ActiveStatus[]
}
```

### Item

```ts
interface Item {
  id: ItemId
  name: string
  kind: 'weapon_1h' | 'weapon_2h' | 'shield' | 'tome' | 'staff' | 'quiver' | 'consumable'
  weaponType?: 'sword'|'lance'|'axe'|'bow'|'crossbow'|'tome'|'staff'  // for compatibility checks
  rarity: 'common'|'uncommon'|'rare'|'epic'|'legendary'
  region: 'borderlands'|'thornwood'|'ashfall'|'none'
  gearCards: CardId[]    // cards this item contributes to the deck
  quiverModifier?: { kind: 'poison'|'burn'|'slow'|'thunder'|'explosive'; value: number; turns?: number }
  isTwoHanded: boolean
  gridSize: { width: number; height: number }
  range?: { min: number; max: number }
  buyPrice: number
  sellPrice: number
}
```

### Card

```ts
interface Card {
  id: CardId
  name: string
  apCost: number
  source: 'innate' | 'hand_left' | 'hand_right'  // populated at deck-build time
  effects: EffectTemplate[]   // resolved via effect pipeline at play time
  range: { min: number; max: number }
  targetKind: 'enemy' | 'ally' | 'self' | 'tile' | 'all_enemies' | 'all_allies'
  aoeRadius?: number
  weaponType?: WeaponType    // null for innate; required for gear cards
}
```

### Class

```ts
interface ClassDef {
  id: ClassId   // 'lord' | 'knight' | 'mage' (foundation); other 6 added later
  name: string
  baseStats: Stats
  growthRates: Stats   // % per level
  innateCardIds: CardId[]   // 4-5 cards
  startingMov: number
}
```

### StatusEffect (active instance)

```ts
interface ActiveStatus {
  effectId: StatusEffectId
  stacks: number
  turnsRemaining: number
  source: UnitId | null
}
```

### CombatState

```ts
interface CombatState {
  phase: 'BOOT' | 'DEPLOY' | 'COMBAT' | 'VICTORY' | 'DEFEAT'
  subPhase: 'IDLE' | 'SELECTING_CARD' | 'SELECTING_TARGET' | 'RESOLVING'
  turn: { number: number; unitId: UnitId | null; team: 'party' | 'enemy' }
  units: Record<UnitId, Unit>
  decks: Record<UnitId, { draw: CardId[]; hand: CardId[]; discard: CardId[] }>
  grid: { width: number; height: number; obstacles: Set<TileId> }
  rng: RngState   // seed + counter — persisted with combat
  log: CombatEvent[]   // last 200 (action log)
}
```

## 13. Save Format

```ts
interface SaveFile {
  saveVersion: '0.5.0'   // bumped on schema change
  createdAt: number
  game: GameStoreState
  combat: CombatStoreState | null   // null if not mid-combat
  actionLog: ActionLogEntry[]   // last 200, persisted
  contentAliasesApplied: string[]   // version of alias table at save time
}
```

**Save flow:**
1. Serialize all stores via `JSON.stringify`
2. Write to `localStorage` slot `save_current`
3. Copy previous `save_current` to `save_backup` before overwrite (dual-slot)
4. Autosave on phase change: location arrival, combat end, town menu open

**Load flow (atomic hydration):**
1. Read JSON from slot
2. Run content-id alias resolution: `cardId 'iron_strike_v1' → 'iron_strike'`. Unknown IDs land in a "lost & found" array surfaced to the user, never reject the whole save.
3. Validate via Zod schemas
4. If validation fails → stay on main menu, surface error overlay with backup-slot option
5. If validation passes → swap stores atomically (set both stores in one React batch)
6. Resume

**Pre-alpha policy:** Schema changes nuke saves with a loud warning. No formal migration ladder yet. `saveVersion` exists; `migrations: Record<v, fn>` does not. Add when player count > 1.

## 14. Seeded RNG

```ts
interface RNG {
  next(): number          // [0, 1)
  nextInt(min: number, max: number): number
  pick<T>(arr: T[]): T
  shuffle<T>(arr: T[]): T[]   // returns a NEW array
}

interface RngState { seed: number; counter: number }

function createRng(state: RngState): RNG  // deterministic, advances counter
```

`Math.random()` is forbidden — there's a lint rule (custom or `no-restricted-syntax`). Every random call threads through an `RNG` parameter. Combat persists `rng: RngState` so reload mid-battle replays identically. Test fixtures use a fixed seed.

## 15. Action Log + Replay

A ring buffer (last 200 actions across both stores) persists with the save. Each entry: `{ store: 'game'|'combat'; action: GameAction|CombatEvent; timestamp: number; rngStateBeforeAction: RngState }`.

**Replay harness (dev tool):**

```ts
function reproduce(initialState: SaveFile, action: GameAction|CombatEvent): {
  before: CombatState | GameStoreState
  after: CombatState | GameStoreState
  effects: CombatEffect[]
  diff: JsonPatch
}
```

This is the debug-at-3am tool. Given a saved game, an agent or a developer can fire a single action, see the before/after diff, and reproduce any reported bug surgically.

The replay harness is built on top of pure `combatReducer.reduce()` and the `gameStore` action switch — both of which are testable in isolation.

## 16. Error Infrastructure

- **`ErrorBoundary` at the React root.** Catches render errors, reports to `errorBus`, displays a "Something broke — copy diagnostic info" UI.
- **`errorBus`** — a tiny event emitter. Every store action wraps `try/catch → errorBus.emit({ source, error, action, timestamp })`. Pure system errors propagate; the wrapper at dispatch catches them.
- **Dev-mode HUD** (`<DevHud />`, gated by `import.meta.env.DEV`) — fixed bottom-right, shows last error + last 10 actions. Toggleable.
- **Production diagnostic export** — `errorBus` writes recent errors to `localStorage` so users can paste a bug report.

No silent failures. No try/catch sprinkled inside pure systems — pure systems are trusted internal code; throws indicate impossible state and bubble to the dispatch boundary.

## 17. Testing Strategy

**Vitest (unit, fast, target 100% on systems/):**
- `deckBuilder.test.ts` — innate + leftHand.gearCards + rightHand.gearCards. 1H+1H, 2H locks right slot, empty hand contributes nothing.
- `combatReducer.test.ts` — every event type. Reducer is pure; tests are `(state, event) → expected state, effects`. Fixed-seed RNG.
- `effectPipeline.test.ts` — middleware chain, target-modifier ordering, armor piercing, terrain bonuses.
- `statusEffects.test.ts` — poison non-stacking, burn stacking, lifecycle hooks fire at right phase.
- `targeting.test.ts` — range checks, AOE coverage, line-of-sight (deferred), valid target kinds.
- `turnOrder.test.ts` — initiative queue with SPD ties, status-modified speed.
- `saveLoad.test.ts` — round-trip, alias resolution, lost-and-found, atomic hydration on bad data.
- `rng.test.ts` — determinism, seed reproducibility.
- `replay.test.ts` — `reproduce(state, action)` produces correct before/after diff for representative actions.

**Playwright (E2E, AI-readable, target ≥1 smoke):**
- Boot: navigate, screenshot, assert canvas + React shell mount.
- DevHud snapshot.

Visual snapshot suite for combat scene polish lands in the next milestone — premature here when there's no scene to snapshot.

## 18. Build Order — Risk-driven

Roughly 2.5–3 weeks. Highest-uncertainty items first.

```
WEEK 1 — DOMAIN + REDUCER + RNG (the spine)
□ Reset src/ to bare scaffold (preserve tooling)
□ domain/ types: Card, Unit, Item, ClassDef, StatusEffect, CombatState, CombatEvent, Effect, RNG
□ Zod schemas in data/schemas/
□ Seeded RNG implementation + tests
□ combatReducer skeleton — startBattle, startTurn, endTurn events
□ Action log ring buffer
□ Vitest config + first 10 tests (rng, reducer skeleton, schema validation)
GOAL: state machine ticks deterministically, no rendering yet

WEEK 2 — EFFECT PIPELINE + DECK BUILDING + STATUS EFFECTS
□ effectPipeline with middleware ordering
□ deckBuilder: innate + handLeft.gearCards + handRight.gearCards
□ statusEffects registry: poison + burn with all lifecycle hooks
□ playCard event handling end-to-end (state transitions + effects emitted)
□ Representative content: 3 classes' innate cards, 10 gear items
□ Tests: deck building, effect pipeline, status interactions, full card-play flows
GOAL: a card resolves end-to-end with full pipeline coverage, fully unit-tested

WEEK 3 — STORES + PERSISTENCE + ERROR INFRA + PHASER FIREWALL SHELL
□ gameStore + combatStore with single dispatch each
□ Atomic hydration save/load with content alias resolution
□ ErrorBoundary, errorBus, DevHud
□ CombatRuntime POJO + CombatScene shell that drains effects queue
□ Boot scene loads validated content, transitions to placeholder combat
□ Playwright smoke: boot, screenshot, DevHud snapshot
□ README updated, commit suite tagged
GOAL: a player can boot the game, see a placeholder grid, click a button that
      dispatches a card-play event, watch the action log update, see no crashes
```

## 19. Risks

- **Reducer-pattern overhead vs developer velocity.** The Functional Purist council member was honest about this. We mitigate by limiting the reducer to combat — non-combat goes through a simpler typed-action switch.
- **Effect-pipeline middleware ordering bugs.** Subtle. Mitigation: explicit ordered middleware list (numbered stages 1–6 in §9), tests asserting ordering invariants.
- **Phaser-React handoff via effects queue.** New territory; could deadlock if `WaitForAnimations` never fires back. Mitigation: timeout fallback in dev mode, hard assertion in tests.
- **Save schema drift in pre-alpha.** Acknowledged: we nuke saves on schema change. Will bite when a player exists. Mitigation: track `saveVersion` even now so the migration ladder can be added without retrofit.
- **Scope creep into combat scene rendering.** The temptation is to ship "one battle" again. Mitigation: foundation explicitly excludes scene polish; the milestone is the systems, not the experience.
- **Action log size.** 200 entries × ~200 bytes = ~40KB per save. Fine for desktop/localStorage; revisit if mobile lands.

## 20. Success Criteria

The foundation is shipped when all of:

1. `npm run typecheck` passes with strict + `noUncheckedIndexedAccess`.
2. `npm test` (Vitest) passes with ≥40 tests covering deckBuilder, combatReducer, effectPipeline, statusEffects, targeting, turnOrder, save/load, rng.
3. `npm run test:e2e` (Playwright) passes the boot smoke test.
4. A representative content set (3 classes with 12-15 innate cards, 10 items contributing 30-40 gear cards, 2 status effects) loads and validates without errors.
5. The replay harness can take any saved combat state + action and produce a state diff.
6. The DevHud surfaces the last 10 actions and any errors during a manual smoke run.
7. README in `phaser/` documents `dev`, `test`, `test:e2e`, `build` commands and the foundation milestone scope.

If any of these fail, the foundation is reconsidered before the next milestone (combat scene + UI) begins.

## 21. Open Questions Deferred to Future Milestones

- Combat scene rendering: hit-stop timing, AOE preview rendering, damage-number animation curves
- Card hand UI: fan layout, hover-lift, drag vs click-then-click targeting
- Grid inventory drag-drop UI (React + dnd-kit)
- Overworld scene architecture: travel state, encounter rolls, location nodes
- Town menu structure (Inn / Shop / Tavern as React panels)
- Slow + immobilize status effects (added with their gear)
- Audio routing
- Steam packaging path
- Save migration ladder activation point
- Internationalization

## 22. Council Acknowledgements

This spec was sharpened by a council-of-five review (Legacy Code Archaeologist, Functional Purist, Game Designer Who Codes, Sleep-Deprived On-Call Engineer, Latency Hunter). Their critiques drove the changes from the original 4-store proposal: collapse to 2 stores with single-dispatch chokepoints (Archaeologist), combat as reducer over event union (Purist), effect pipeline as the load-bearing center instead of `resolveCard` (Designer), action log + seeded RNG + atomic hydration (On-Call), Phaser-Zustand firewall via `CombatRuntime` (Latency Hunter). Each addition is paid for by a specific failure mode they predicted.
