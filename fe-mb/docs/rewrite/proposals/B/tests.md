# Proposal B — acceptance tests → vitest files

Brief §10 phrased as tests, mapped onto `game/tests/unit/**` (vitest, `environment: node`) and `game/tests/e2e/**` (Playwright). Every engine test drives the REAL reducer through `reduce(state, action, ctx)` — no store, no DOM. The three ported files (`rng.test.ts`, `autotile.test.ts`, `boardFloor.test.ts`) stay.

## Harness (`tests/helpers/`)

| helper | purpose |
|---|---|
| `ctx.ts` | `realCtx()` = registry from the shipped content + `RULES`; `fixtureCtx(overrides)` = tiny hand-written cards/classes/items/groups for combat unit tests; `withRules(ctx, patch)` for knob tests |
| `engine.ts` | `Session` wrapper: `dispatch(a)`, `drain()` (runs `pendingAutoAction` to quiescence with zero delay), `effects()` (collected), `log` (the intent log), `snapshot()`; asserts `assertInvariants` after every dispatch |
| `battles.ts` | `seedFixtureBattle(spec overrides)` → `CombatState` via `seedBattle`; `unitAt`, `playFirstDamageCard(session)`, `runRounds(session, n)` (player greedy + `drain()`) |
| `runs.ts` | `newRunAt(seed, nodeId?)`, `walkTo(session, nodeId)` (dispatch `travel/go` + `drain()` + close overlays with the auto-pick), `enterTown`, `winCurrentBattle(session)` (greedy until VICTORY) |
| `saves.ts` | `roundTrip(state)` = `fromSaveFile(parseSaveFile(serialize(toSaveFile(state))))`; `populatedRun()` fills EVERY run field non-trivially |

## Determinism / RNG → `tests/unit/engine/determinism/`

| §10 statement | file · test |
|---|---|
| `createRng({seed, counter:n})` continues; `deriveRng` depends on parent seed, distinct per label | `rng.test.ts` (ported, exists) |
| Same seed ⇒ same battle outcome AND turn count; `autoBattle` terminates; HP drops during engagement | `sim.determinism.test.ts` · "two autoBattles from one BattleSpec are deep-equal"; "firstBloodRound ≤ 2 for every seed 1..20"; round cap never hit |
| Re-crossing a road later gives a different roll; a suspended hop never re-rolls | `travel.rng.test.ts` · "pass 0 and pass 1 over the same edge produce different `encounterRolled` results for seed 3"; "a hop suspended by a dialogue lands after `dialogue/choose` without emitting a second `encounterRolled`" (counts effects) |
| `reproduce(state, action)` from the log equals direct reduce; no `Math.random` in src | `replay.test.ts` · "foldLog(session.log) deep-equals session.snapshot() after a 40-hop scripted run with two battles"; "verifyPump reports ok"; `lint` gate (`npm run lint`) — a test `noMathRandom.test.ts` greps `src/` as a belt-and-braces |
| Two `combat/capture` dispatches from one pre-state give different `rng.counter`; AI planning twice yields the same plan and post-state RNG | `capture.rng.test.ts` · "capture writes rng back (counter+1)"; "second capture from the post-state rolls a different value"; `ai.determinism.test.ts` · "planStep(state) called twice returns identical step and rng" |
| Mid-run: log + seed reproduces a state with pending slots open | `replay.test.ts` · "fold to a state with pendingDialogue open, then continue both sessions identically" |

## Combat → `tests/unit/engine/combat/`

| §10 statement | file · test |
|---|---|
| Armor-first physical; magic floor/ceil; forecast == applied for every card/target pair incl. cover | `damage.test.ts` (splitDamage table cases: 0, <armor, =armor, >armor, magic odd/even); `forecastVsApplied.test.ts` · iterates EVERY card in the real registry × a target with/without armor × with/without an adjacent Genatsvale protector; asserts `computeForecast` numbers equal the `unitHit` effect and the post-state HP/armor |
| Initiative: SPD desc, party wins ties, then id; slow re-sorts at next endTurn; dead drop out | `initiative.test.ts` · 4 cases + "slow applied mid-round changes order only after endTurn" + "queue excludes dead and captured" |
| ≥3 full rounds: AP 3, hasMoved false, coverUsed [], hand 5, reshuffle zero card loss | `turnCycle.test.ts` · `runRounds(s, 3)` then for every living unit at its turn start assert the five restorations; asserts `draw+hand+discard` multiset equals the built deck every turn (§7.1) |
| Living unit on a corpse is targetable; a dead unit never is | `corpse.test.ts` · kill A on tile T, move B onto T, `playCard` at T hits B; a Damage at a tile holding only a corpse is refused |
| Taunt/riposte/empower survive the following enemy phase and expire at the specified point; enemy poison still ticks | `statusExpiry.test.ts` · per status: applied on owner turn N → present through enemy turns → gone at owner turn N+1 start; poison from enemy ticks at owner turn end and decrements |
| Poison ignores armor; burn stacks + magic split; DOT death flips phase; immobilize refuses move; slow lowers initiative | `dot.test.ts`, `immobilize.test.ts` (refused + `refused` effect, state identity), `initiative.test.ts` |
| AOE hits every foe in radius, never allies (damage AND statuses); riders route to source; shred/cleanse; `all_enemies` | `aoe.test.ts` · radius-1 fixture with 2 foes + 1 ally in range; `riders.test.ts` · brace-family card on an enemy armors the SOURCE; `removeStatus.test.ts` · `frost_axe_shatter` removes all armor, cleanse strips only harmful; `allEnemies.test.ts` |
| Reducer rejects out-of-range, wrong targetKind, over-MOV, occupied/obstacle/OOB, insufficient AP — state unchanged | `legality.test.ts` · one `it` per rule, asserts `result.state === prev` (identity) and a `refused` effect with the reason |
| Every effect param in `cards.json` is consumed (lint); `frost_axe_shatter` removes all armor; `lord_charge` moves 2 | `content/effectParams.test.ts` · walks the registry against `CONSUMED_PARAMS`; `cards.named.test.ts` |
| `useItem`: exactly 1 AP; refused at 0 AP / non-active / not in consumables; heals only the drinker (clamped); elixir nets +2; leaves consumables → `consumedItems`; payout removes exactly one bag row; enemies never use | `useItem.test.ts` (7 cases) + `payout.test.ts` · "consumedItems removes first match only" + `ai.test.ts` · "aiStep never emits itemUsed" |
| Genatsvale: first blow per ally per Oak-turn redirected using Oak's DEF; second lands on ally; different ally redirected again; counter clears on Oak's turn; AI expected-damage and forecast reflect it | `genatsvale.test.ts` · 5 cases; `ai.cover.test.ts` · a rusher's target choice changes when Oak stands adjacent to the low-HP mage |
| Melee AI reaches a blocked approach; archer holds range; healer heals lowest fraction; taunt overrides; an enemy action applies poison/burn | `ai.test.ts` · corridor fixture (§7.4), archer 2-3 range, healer choice, taunt, `thornwood_ambush` poison lands as `statusApplied` |
| Capture chance == formula; success removes from board flagged captured, pays 0 gold, appears in capturedIds and BattleResult with name + bounty; roll advances RNG | `capture.test.ts` · formula table (hp 0.5, 1 adjacent → 0.55…) + forced-success seed + `resolve.test.ts` |
| Resolution pays 10+5L per dead uncaptured; writes survivor HP back; appends prisoners; emits victory/defeat/died/captured; loot table per source; owned excluded; guaranteed never discarded; final boss legendary | `resolve.test.ts` · gold; `payout.test.ts` · survivorHp on `run.party`, prisoners, effects list; `loot.test.ts` · per tag×tier over 2000 rolls: travel never epic, elite/treasure/boss chance 1.0 and weights within ±3%, tier-3 boss can drop legendary, owned ids never returned, fall-down when a tier is emptied; `lootOverflow.test.ts` · full bag + boss drop ⇒ `lootOverflow`, `battle/continue` refused until `run/sell` frees a slot |
| Every seeded battle places every unit; enemies within one move + attack; dungeon members scaled by region tier | `seed.test.ts` · for every enemy group × tier × origin: no null positions, unique tiles, `min manhattan(enemy, party) ≤ enemy.mov + maxRange`; dungeon seed of `iron_mine` produces L5-6 units |
| No timings in reducer output; semantic events only | `effects.semantic.test.ts` · type-level: `Effect` has no key matching `/ms|duration|px|intensity/`; runtime: a full battle's effects contain none |
| Enemy action budget knob | `ai.budget.test.ts` · knob 1 ⇒ exactly one `cardPlayed` per enemy turn; knob 'ap' ⇒ up to 3 |
| Armor cap knob | `armor.test.ts` · halfMaxHp caps `knight_fortify` stacking; `none` does not; `resetOnOwnerTurn` zeroes at turn start |
| MC death knob | `mcDeath.test.ts` · MC at 0 HP with allies alive ⇒ DEFEAT when true, COMBAT when false |

## Gear, deck, bag, characters → `tests/unit/engine/gear/`

| §10 statement | file · test |
|---|---|
| Deck = innate + left + right + signature with tags; 2H locks right; quiver mods only bow damage cards in the other hand; quiver alone / bow alone / 2H bow do nothing; arrays detached | `deck.test.ts` (ported cases + signature source) |
| `planEquip` swaps to bag, refuses when full, rejects 1H into locked right, non-gear, not-in-bag; atomic; bag is 32 cells with real footprints | `equipment.test.ts` · + `bag.test.ts` · greatsword 2×3 refused when only scattered singles are free; `placeAll` all-or-nothing |
| `recruitCharacter` builds from the def (gear, team, passives, statOverrides); no-ops for party/deathLog ids; refuses past 6; deterministic ids | `characters.test.ts` · `buildUnitFromCharacter` twice deep-equal; recruit cases; cap |
| `setMcName`/`setCompanyName` round-trip; dialogue renders `{mc}`/`{company}`; placeholder before set | `naming.test.ts` · `run/submitName` from a `promptName` effect; `renderText`; save round-trip |
| Content lint (deck sizes, 46 gear with rarity totals, sell = 50%, no `buyPrice: 0`, potions carry `effect`, every classId has a class and an AI profile, every character/recruit/dialogue/quest/encounter/dungeon/town/node/item ref resolves, every encounterTableId matches, every town/dungeon node has a def, every flag read has a writer, every `advanceQuestStage.toStage` declared) | `content/lint.test.ts` · `lintContent(realCtx())` returns `[]`; one negative case per rule using `fixtureCtx` with a deliberate dangling id |

## Overworld, towns, camp, dungeon → `tests/unit/engine/run/`

| §10 statement | file · test |
|---|---|
| BFS path cost = hops = food; hover shows hops/food/starvation; a hop costs 1 food or 3 HP each at 0 food; hops into town/dungeon/boss never roll | `overworld.test.ts` · `findPath` + `hopCost` + `starvationPreview`; `hop.test.ts` · food charge decrement (rations 3→2), `starvation` effect at 0 food with 3 HP off each living unit and dead units untouched; `noRoll.test.ts` · 200 seeds into a town emit no `encounterRolled` |
| `rollEncounter` honours predicates, one-shots, weights, last-entry fallback | `encounters.test.ts` (ported cases) |
| Clicking the current node re-enters with no hop/food; travel resumes after every suspender (dialogue, check, quick menu, battle, name prompt) | `travel.machine.test.ts` · `travel/go` to current ⇒ `nodeMenu` set, day/food unchanged; one `it` per suspender: force the encounter via a fixture table, close it, assert phase returns to `walking`/`idle` and the hop landed exactly once |
| Drag < 8px is a click; no latched drags; every gateway reachable by a real press | e2e (`overworld.spec.ts`) — not engine |
| Shop stock respects rarity gates, never E/L, lists potions everywhere; Inn charges per wounded unit and heals to full via its own action; camp Rest heals floor(max×0.2) for 1 food via `run/consumeFood` (day/hops unchanged) and is refused at 0 food; Scout costs 1 food, records depth-3 edges keyed `edge#pass`, the next hop reproduces the stored result and removes the entry, scouted results survive save/load | `shop.test.ts` (per town × tier), `inn.test.ts`, `camp.test.ts`, `scout.test.ts` · "hop over a scouted edge emits `encounterRolled{scouted:true}` equal to the stored roll and deletes the key"; `saves/roundTrip.test.ts` covers persistence |
| Tavern board filtered by `visibleIf` (Missing Caravan turn-in at `return_reward`); bounty board lists prisoners; Turn In pays `bountyFor` (20/40/60; override; Daren 50) and removes the row; Turn In All pays the sum | `tavern.test.ts`, `prisoners.test.ts` (with a captured Daren from `darens_gang`) |
| Dungeon generation deterministic per (runSeed, dungeonId); two ids differ; unique ids; row-0 combat; last-row rest; single boss reachable from every last-row node; validators pass; entering from node X loads X's groups/events; combat-room victory returns to the dungeon; rest heals 30% free; treasure gear + 50g; boss drops per table and exits; enemies level-scaled | `procgen/dungeonGraph.test.ts` (100 seeds × 5 dungeons); `dungeon.flow.test.ts` · enter each of the 5 dungeons, walk a full path with `winCurrentBattle`, assert screen returns to `dungeon` after combat rooms, `dungeonCleared` + `activeDungeon === null` after the boss, the boss drop rarity ∈ table row |

## Quests, dialogue, checks, save → `tests/unit/engine/narrative/`, `tests/unit/engine/save/`

| §10 statement | file · test |
|---|---|
| Predicates: all 15 kinds; round-trip through save | `predicates.test.ts` · one case per kind incl. `hasItem` (bag AND hands) and `questStarted`; a predicate embedded in a scouted encounter round-trips |
| `startQuest` seeds initialStage, runs onEnter, idempotent, rejects unknown; `advanceStage` runs onExit then onEnter, refuses not-started/complete; transitions settle ≤8 passes after any run dispatch; Blood Ties advances on the capture flag with no dialogue and completes once; every QuestEffect kind mutates state; no `statCheck` | `quests.test.ts` · + "a 2-stage cycle fixture stops at 8 passes with a warning effect"; `questEffects.test.ts` · one `it` per kind asserting the state delta (spawnNode makes the node visible in `visibleNodes`, unlockNode makes it pathable, addGold(−999) clamps to 0, addFood(−1) removes a charge); type-level: `QuestEffect` has no `'statCheck'` member |
| Every declared effect kind has an emit site; `flagSet`/`locationArrived`/`questStageAdvanced` come from the reducer | `effects.emitters.test.ts` · static: grep `src/engine` for `kind: '<k>'` per member of `Effect`; runtime: a scripted full run's collected effects cover the narrative kinds |
| Dialogue refuses hidden/disabled/unknown; check choices route onPass/onFail; stat checks pass iff a LIVING unit's stat ≥ threshold; class needs a living member; gold/food compare totals; candidates sorted with `meetsThreshold`; captured/killed targets set flags and start the right dialogue by unit id | `dialogue.test.ts`, `checks.test.ts`, `captureTargets.test.ts` (ported semantics; `resolveCaptureTargets` single-dialogue rule) |
| `serialize(hydrate(serialize(run)))` deep-equals for a run with `activeDungeon` (3 cleared rooms), `travel` suspended (2 remaining hops), `edgeTraversals`, `oneShotsFired`, capture targets in combat, `prisoners`, `scoutedEdges`, names, gold, position, units with hands and current HP, order, inventory with charges, flags, questStates, rng, days, stats, visited, cleared, deathLog, runId/seed; meta persists; invalid save leaves state untouched | `roundTrip.test.ts` · `populatedRun()` then `roundTrip` deep-equal; a second case with `combat !== null` and `pendingCheckEvent.stage === 'result'`; `strict.test.ts` · an extra key fails, a missing key fails, `grid.obstacles: {}` fails with a message naming `obstacles`; `hydrate.invalid.test.ts` · `save/hydrate` with a bad file ⇒ same state identity + `refused` |
| Mid-combat: seed, 3 dispatches, snapshot, reload into fresh state, replay the same 3 ⇒ deep-equal; obstacles lookup works; a hydrated enemy-turn state resumes the AI without input | `midCombat.test.ts` · snapshot after enemy turn starts ⇒ `pendingAutoAction(hydrated)` is `combat/aiStep` and `drain()` reaches the player's turn |
| Defeat: persisted `run` is null and `meta.runsLost` incremented BEFORE the game-over screen; Continue absent on Title; final-boss victory ⇒ `runsWon` | `endRun.test.ts` · the `persist:clearRun` + `persist:meta` effects are in the SAME `ReduceResult` whose state has `screen.kind === 'gameOver'`; `deriveScreen` with `run === null` ⇒ title has no continue (selector `canContinue(state) === false`) |

## Content validation and balance → `tests/unit/content/`, `tests/unit/balance/`

| §10 statement | file · test |
|---|---|
| All content JSON parses under Zod; a dangling id fails | `schemas.test.ts` (the content agent's), `lint.test.ts` (above) |
| Headless sim, 20+ seeds each: starters vs stub 55-75 %, boss with epic+ 40-60 %, 0 % stalemates, avg 4-10 turns; any round cap fails with a state dump | `balance/sweep.test.ts` · `sweep(scenarios, realCtx(), greedyPolicy)` against `RULES.balance`; marked `@slow`, also run by `npm run cli -- balance` in CI; a round-cap hit throws `RoundCapError` whose message includes the per-round dump |

## Golden scenarios → `tests/unit/scenarios/`

`golden.tutorial.test.ts` (MC vs the tutorial bandit to VICTORY, then prologue), `golden.travel.test.ts` (seed 7: Title → New Run → skip tutorial → prologue → walk 6 hops → battle → Inn → tavern turn-in → naming beat via a fixture quest), `golden.dungeon.test.ts` (Smuggler's Cave entry → boss → epic named in `lastBattle.loot`), `golden.boss.test.ts` (boss node → win ledger with trophy), `golden.defeat.test.ts` (starve to 0 food, walk until a wipe ⇒ gameOver ledger). Each asserts ≥3 full initiative rounds happened in at least one battle (§7.1) and finishes by `verifyLog(session.log, session.snapshot())`.

## End-to-end (Playwright, 1280×720, reduced motion, port 5184) → `tests/e2e/`

| statement | spec |
|---|---|
| Boot each `?screen=` with zero console errors, no horizontal overflow, fonts ready | `boot.spec.ts` (loops `ScreenKind`; the dev fast-path dispatches `dev/seedState` with a fixture from `scripts/cli.ts dump-state`) |
| Two battles in one page session both draw a populated board (DOM: ≥ N `.unit` nodes) | `second-battle.spec.ts` |
| Full journey title → win, and a defeat path → game over → new run | `journey.spec.ts` (drives the real store through clicks; uses `window.__embermarch.dispatch` only for the seed) |
| Board clicks from the shared geometry; card by click-pin-confirm and by drag; potion by Use Item; move by click and by chess drag; Esc cancels targeting without opening pause | `combat-input.spec.ts` |
| Visual snapshots unmasked at 0.0005; a deliberate token change reds the suite | `visual.spec.ts` + `visual-canary.spec.ts` (temporarily overrides `--color-hearth` via `addStyleTag` and expects failure) |
| Save & Quit mid-battle → reload → Continue restores the same battle state; overworld autosave restores location/party/day/HP; Continue absent with no autosave | `save.spec.ts` (reads `localStorage['embermarch:run']` through `page.evaluate` and compares to the rendered HUD numbers) |
| Manual full-run playtest recorded before beta | process, not a test — `docs/playtests/` |
