# Engine contract — judgement of proposals A and B (2026-09-05)

Inputs: `docs/rewrite/proposals/A/*` (types 656 lines, actions 349, rules 439, modules 588, tests 70), `docs/rewrite/proposals/B/*` (types 763, actions 349, rules 307, modules 522, tests 105), the brief (§2 and §10 in full, §3, §6–§9), DECISIONS.md, and the CONTENT PORT as shipped in `game/src/content` (schemas + registry + lint). Every rule in brief §2 was walked against both proposals; every content shape assumption in both proposals was checked against the real `schemas/*.ts`.

The synthesis is in `game/src/engine/{types,actions,effects,rules}.ts` and documented in `CONTRACT.md`. Both proposals defaulted the `armorCap` knob to `halfMaxHp`; DECISIONS (owner-answered 2026-09-05) says `none`. The synthesis ships `none`.

## Scorecard

| criterion | A | B | notes |
|---|---|---|---|
| (a) covers every rule in brief §2 | **4** | **3** | see gaps below |
| (b) determinism + save/resume of mid-battle state | **4** | **5** | B proves the pumps; A only replays them |
| (c) testability headless (CLI can play a whole run) | **5** | **5** | A has the better driver, B the better sim module |
| (d) minimal ceremony (files, indirection) | **4** | **3** | B carries two contexts, four action classes, two effect unions, six flow files |
| (e) fit for DOM screens + a tiny store | **4** | **5** | B's ephemeral `ui` slice is the right cut; A persists UI bits |
| **total** | **21** | **21** | tie on points; **A's skeleton, B's best ideas grafted** |

## (a) Coverage of brief §2

Both proposals cover every SYSTEM in §2.1–§2.16: per-unit initiative and the five-step endTurn, reducer-owned legality and RNG, semantic effects, the damage formula and armor split, forecast == applied, riposte, cover/redirect as a first-class step, the effect union with explicit target selectors, 1-AP potions from the shared bag, explicit status expiry, authored role AI with status riders and distance-field stepping, 2-AP capture with the continuous formula, the prisoners ledger and `bountyFor`, gear-as-deck with quiver baking and 2H locking, the spatial 8×4 bag with atomic equip plans, one `seedBattle` with engagement asserted, `BattleResult` → one atomic payout with HP write-back, the open sheet with BFS travel and the per-edge hop roll with cooldown and pass-salted labels, Scout as stored pre-rolls, Inn/Shop/Tavern/bounty board, camp Rest via `consumeFood`, the compact StS dungeon with loot by source, quest activation with derived status and a bounded settle, 15 predicate kinds, single-unit deterministic checks with auto-pick, autosave-only persistence with strict Zod and a first-class combat field, defeat-writes-null-before-render, the tutorial, the final boss trophy, characters.json as the one identity table, naming as run fields, and Genatsvale as a per-protectee-per-activation ledger on the protector.

Where each falls short:

**A**
- §2.10 "Camp: ONE action per visit" has no state — `camp/rest` after `camp/scout` is not refusable. (B has `Venue.camp.actionTaken`.)
- §2.5 assumes `EnemyAiProfile.actions[].effects: CardEffect[]`; the content shipped `kind: attack|heal|buff` + `applyStatus`. Signature-level only (`enemyAct(actionId)` still works) but the resolver needs an adapter — `actionAsPlay` in the synthesis.
- Content-shape drift, all trivial renames: `spawnNode{nodeId}` / `visited{nodeId}` (content: `MapNodeRef`), `locked` nodes (content has `hidden` only), `discoveryEventId` (content has none), `DungeonDef.roomEventIds` (content: `roomEvents`), `Region` (content: `RegionDef`), `enemyAi` (content: `enemyAI`), `sheet` (content: `overworld`).
- Good: `dialogue/continue` for zero-choice narration beats; `pendingLoot` + `run/takeLoot` / `forfeitLoot` / `discardItem` so a guaranteed drop on a full bag can always be resolved.

**B**
- §2.7 correctness hole: `DeckState.draw/hand/discard` are `CardId[]` and `sources`/`cardMods` are `Record<CardId, …>` — a deck that holds the same card id twice (two identical items, an innate that repeats as a signature) collides. A's `CardInstance{uid, cardId, source, mod}` is right.
- §2.13 soft-lock: a guaranteed drop on a full bag blocks `battle/continue` "until `run/sell` frees a slot", but selling needs a town and B has no discard/forfeit action — after a dungeon boss with a full bag the Field Report cannot be dismissed.
- §2.13 / §2.12: `BattleTag` has no `quest` member, so a `startCombat` battle has no loot row and no label; `RULES.finalBoss.enemyGroupId: 'final_boss'` contradicts the content (the BOSS node carries `ashford_company`).
- §2.12: a dialogue node with zero choices "ends after onEnter" — there is no action for the player to read and close a narration beat.
- §1 / §2.14: the derived-screen invariant has a hole — with a run hydrated at boot, `deriveScreen` yields `overworld`, never `title`, so "Title → Continue: no state change beyond routing" cannot hold without an extra flag the proposal does not have.
- Good: `combat.resolved` (payout-once guard on a Field-Report save), `revealedEvents`, `clearedDungeons`, `Venue`, `RunLedger.survivors`.

**Rules neither proposal covers** (and the synthesis settles):
1. §2.13 loot for `startCombat` quest battles — neither has a row. Synthesis: tag `quest` uses the travel row of the node's tier (`rules.loot.rows.quest`).
2. §2.9 Discovery-node one-time events — both assumed a `discoveryEventId` the content does not have (the discovery deck is unbuilt). Synthesis keeps the `'discovery'` check-event source so the slot is ready and lists the content field as an open item.
3. §2.16 `UnitCharacter.bag` (items that enter the party bag when a character joins) — neither `recruitCharacter` mentions it. Synthesis: placed on recruit, overflow → `pendingLoot`.
4. DECISIONS `armorCap: none` — both shipped `halfMaxHp`.

## (b) Determinism and mid-battle save/resume

Both keep the RNG in state (`run.rng`, `combat.rng`) and write it back in every rolling case, derive child streams by label from the parent SEED only, persist `combat` as a first-class schema'd field with selection reset, and resume a hydrated enemy turn from the pump with no input. Both order the defeat null-save before the game-over frame (A: `autosaveHint{urgent}` handled synchronously inside `dispatch`; B: `persist` effects in the same `ReduceResult` + `PERSIST_SYNC`).

A = 4: `replay(initial, actions)` exists but the proposal never states that runtime-dispatched pumps are logged, and nothing proves a logged pump was the one due — a log without pumps diverges silently.
B = 5: the intent log is a first-class artifact (`IntentLog`, `foldLog`, `verifyLog`, `verifyPump` proves every logged auto action equals `pendingAutoAction` at that point), `combat.resolved` guards a double payout, `logLength` cross-checks snapshot and log. Cost: a third storage key (`embermarch:log`) that DECISIONS' save model does not list.

Synthesis: A's snapshot-only persistence (DECISIONS-exact: run + meta), B's proof as an in-memory log on the runtime (`log: true` → `runtime.actions`) with `save/replay.ts#verifyReplay`; pumps are ordinary actions and are logged. No `resolved` flag is needed because `settle` nulls `combat` in the same reduce that pays out.

## (c) Headless testability

A = 5: `createRuntime` is host-agnostic (no scheduler → `pump()`/`drain()`), `dev/*` seams, `planEnemyTurn`, a CLI with `play/simulate/balance/travel/replay/lint/render`, and a tests.md that names a vitest case for every §10 bullet with `playRounds(3)` / `autoBattle` harness helpers making ≥3-cycle coverage the default (§7.1).
B = 5: `combat/sim.ts` (autoBattle, greedyPolicy, sweep, `RoundCapError` with a per-round dump) lives in the ENGINE so the CLI and vitest share it; `CombatContext` lets sims run on fixture content; a `Session` harness asserts invariants after every dispatch; golden scenarios end with `verifyLog`; `dump-state` produces `?screen=` fixtures.

Synthesis: A's runtime + B's sim module + B's invariants; fixtures come from `flow/fixtures.ts#fixtureFor`, which runs the real reducer so `?screen=` seeds can never drift.

## (d) Ceremony

A = 4. Load-bearing: one `EngineEnv`, one root reducer, one `settle`, one runtime, one legality table, functional `rngLabels`. Ceremony: a `DomainEvent` union with a `domain: true` marker beside a `PresentationEffect` union (two unions for one stream); `Screen` variants carrying `BattleReport` / `RunLedger` payloads; decorative literal-string fields in `Rules` (`tieBreak: 'spdDesc,partyFirst,idAsc'`, `riposte: 'stacksDirectToHp,adjacentPhysicalOnly'`, `spawnEngagement: 'oneMovePlusAttack'`) that document but do nothing; `run/dialogue.ts` owning dialogue + checks + check events.

B = 3. Load-bearing: the `ui` slice, `ledger`, `lastBattle`, invariants, the sim module. Ceremony: two contexts (`EngineContext`, `CombatContext`); four action classes plus two membership sets (`INTERRUPT_SAFE`, `PERSIST_SYNC`); `AnyEffect = Effect | BattleResolvedEffect` (a second union for one member); driver effects (`persist`, `quitApp`) inside the presentation stream; `screen` derived from a route table AND cached AND asserted AND suspendable by a dev flag; `flow/` split into six files; a `selectors.ts` barrel as a fence; `rngLabels` as template strings the code must re-implement; `Rules = typeof import('./rules').RULES` (a type-level circular import through a `typeof import`).

Synthesis: A's spine; B's `ui`/`ledger`/`lastBattle`/invariants/sim grafted; one flat `Effect` union; `Screen = { kind }` with no payloads; `Rules` as an explicit interface with the decorative strings removed; four flow files (`settle`, `pump`, `lifecycle`, `invariants`) + `fixtures` + `runtime`.

## (e) DOM screens and a tiny store

A = 4: `overlayOf` is the one derivation the UI, `isLegal` and the pumps share; `useGame(selector, isEqual)`, `useEffects`, `shallow`, pluggable scheduler — exactly the store surface asked for. Gap: `modal` lives in `GameState` and `tab` / `showDanger` inside `Screen`, so UI chrome is persisted in the save and gated by `isLegal` (you cannot toggle danger zones with a modal open; the town tab survives a reload).

B = 5: a dedicated ephemeral `UiState` (modal, townTab, showDangerZones, devHud) that is never logged, never persisted and always accepted (even mid enemy turn); `useOverlay()`; StrictMode-idempotent `boot()`; `setPumpDelay` for reduced motion / Playwright. Cost: `boot()` with `StorageLike` injection, the delay function and the selectors barrel push the store past "tiny".

Synthesis: B's `ui` slice on A's store; `initStore(opts)` is idempotent; delays and storage are host options on the runtime, not store API.

## Verdict

Skeleton: **A** — flat `GameState`, explicit `screen`, one root reducer, one post-reduce `settle`, one host-agnostic runtime, a legality table, functional RNG labels, `CardInstance` decks, `pendingLoot` with take/forfeit/discard, `dialogue/continue`.

Grafted from **B**: the ephemeral `ui` slice; `ledger` in `GameState` and `lastBattle` in `RunState` (screens carry no payloads); camp `actionTaken`; `clearedDungeons`; `RunLedger.survivors`; `flow/invariants.ts`; `combat/sim.ts` in the engine; `AiStep`; `PlayableCard` so cards, potions and enemy actions share one resolver; `flagKeysRead` for the lint; `CONSUMED_PARAMS` as the lint's truth table; the two-point status expiry (`ownerTurnStart | ownerTurnEnd`, no global `turns` point); `harmfulStatuses` as a per-status `harmful` flag; `autoEndTurnAtZeroAp`, `enemySpawn` geometry, the terrain table and the canonical dungeon variant as data; the `battleResolved` effect for the CLI's Field Report.

Reconciled with the content as shipped: `ContentRegistry` is imported, not re-declared (`Content = ContentRegistry & { version, nodeDistance }`); vocabulary enums are re-exported from `content/schemas`; `EnemyAction` (attack|heal|buff + applyStatus) is adapted by `combat/ai.ts#actionAsPlay`; `MapNodeRef` for `spawnNode`/`unlockNode`/`visited`; `node.areaTier` is authored and read as-is (the BFS rule is the authoring default and a lint input); the BOSS node carries the final group; `Item.effect` (`ConsumableEffect`, no target) is adapted by `combat/items.ts#itemAsPlay`; `QUEST_COMPLETE_STAGE` and `DIALOGUE_END` are the content module's sentinels.
