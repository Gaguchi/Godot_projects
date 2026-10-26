# Rewrite decisions (2026-09-05)

Binding for everything under `game/`. Each entry: the decision, why, and where it lives so it can be changed as data rather than re-litigated in code. Owner answers pending on four items (marked **[ASK]**) are shipped as defaults behind a single `rules` constant object so flipping them is a one-line change.

## Stack and shape (decided by Claude, owner delegated)
- **DOM-only.** TypeScript + Vite + React 19; no Phaser, no canvas, no Zustand, no Tailwind, no react-aria, no framer-motion, no Storybook. The board is a CSS grid; sprites are `<img class="pixel">`. Why: the migration spec's #1 driver was an agent-verifiable render loop (Playwright screenshots); a canvas engine buys nothing for a turn-based grid game and re-creates the two-layer split that produced most of the debt (brief §8.1). Electron stays as the optional desktop window; the browser is also a target — DOM-only makes both free.
- **One state, one dispatch.** `GameState` (meta + run + combat + screen/modal + pending slots) reduced by `(state, action) → { state, effects }`. Effects are semantic (`unitHit`, `unitMoved`, `banner`, `sound`), never timings. The reducer owns the RNG inside state and writes it back in every rolling case (brief §2.1, §2.14 leaks 19).
- **Plain string ids** validated by Zod at the content boundary; no branded-id casts (brief §8.6).
- **Content = JSON + strict Zod**, parsed once at boot into a typed registry; a cross-reference lint over every id kind and flag key is in `npm run verify` (brief §7.23).
- **Save = one autosave per run** (`embermarch:run`) + `embermarch:meta`; Title shows Continue/New Run; combat state is a first-class schema'd field; defeat overwrites the save before the game-over screen (brief §2.14).

## Rules resolved from the brief (spec wins)
- Capture: **2 AP**, adjacent, formula `clamp01((1 − hp/max)·0.6 + 0.25·adjacentAllies + 0.15·bountyHunter)`, roll from `state.rng`, no HP gate (the % is shown). Prisoners ledger + tavern bounty board with `bountyFor` 20/40/60 (brief §2.6).
- Consumables: 1-AP self-drink from the shared bag; Healing Potion 10 HP (30/15g); Power Elixir +3 AP (80/40g). Vulnerary/Elixir dropped (brief §2.3).
- Loot by SOURCE table (brief §2.13); legendaries enter at tier-3 dungeon bosses; final boss drops a trophy legendary named on the win screen.
- Starting kit: 80g, 2 rations × 3 charges (6 hops), 1 Healing Potion; Lord Iron Sword; Knight Iron Lance + Iron Buckler; Mage Fire Tome.
- Overworld economy on the open sheet: 1 food per hop; **area tier = BFS distance from the start hub** (0–2 hops tier 1, 3–5 tier 2, 6+ tier 3, boss node 7+), authored per node as data with the distance rule as the default; region knobs `encounterChancePerHop` 0.25/0.40/0.55 as data. Why: the brief's own redesign pillars already say this; it is data, so a later map spec can override per node.
- Quests: `startQuest` primitive, no listeners, status derived from `questStates`, flags typed-scoped. Stat checks single-unit deterministic (brief §2.12).
- Statuses: explicit expiry `expiresAt: 'ownerTurnStart' | 'ownerTurnEnd' | 'turns'` in data — no `fresh` flag (brief §2.4).
- Effects union with explicit target selector; the 27 approximated cards are shipped with the mechanics the engine supports and a `TODO(mechanic)` lint list — no silent approximations are *added*; Teleport/Mark/Lifesteal/LinePierce/Untargetable are implemented only if an implementer finishes them with tests, else the card text is rewritten to match the numbers (brief §2.3).
- Cover/redirect (`resolveCoverTarget`) is first-class — Genatsvale needs it (brief §2.2, §2.16).
- One `seedBattle(spec)`; every unit asserted on-board; enemies spawn within one move + attack of the party; dungeon enemies scaled by region tier (brief §2.8).
- Dungeon: 7 wide × 15 rows + boss? **No — the compact variant**: 6 rows × 4 cols, 4 paths, forced row-0 Combat / last-row Rest, weights Combat 45 / Event 20 / Treasure 15 / Rest 5 / Elite 5, **no Shop room**; deterministic per `(runSeed, dungeonId)`. Why: the compact graph fits a 1280×720 page without scrolling; the StS-canonical 15-row graph is a tuning option in data.
- Camp: Rest (20% for 1 food via `consumeFood`), Scout (1 food, depth 3, pre-rolled and stored `scoutedEdges`), Leave.
- Cast (creative, NOT generated here): characters.json ships `mc` (the foundling, player-named at the guild beat; lord chassis; Roy's art), `oak` (Bagrat "Oak", shield_knight chassis, Genatsvale passive; Marcus's art), `lilina` (scholar placeholder), and the enemy/NPC ids. Dialogue TEXT is ported as-is with speakers re-keyed; the bible-register rewrite is the owner's turn-by-turn pass (memory: creative collaboration).
- Title "Embermarch" stays as a placeholder.

## Owner-answered knobs (2026-09-05) — all in `src/engine/rules.ts`, still data
| knob | OWNER'S ANSWER | alternatives kept as values |
|---|---|---|
| `armorCap` | **`none`** — armor persists within a battle and stacks uncapped (as shipped); tank-stall is a legitimate build | `halfMaxHp`, `resetOnOwnerTurn` |
| `mcDeathIsDefeat` | **`true`** — the foundling carries the egg; the story ends with them | `false` (party wipe only) |
| `terrain` | **`off`** — flat boards, authored obstacles, cosmetic floor | `on` (def/res bonuses + movement cost, later, as data) |
| `enemyActionBudget` | **`1`** — one action + free move per turn; threat is tuned UP via HP/pack size/burst | `'ap'` |

## Explicitly not in the oneshot
- New companion cast text, company/MC naming *scenes' prose*, the three-act Kaine ladder prose — creative, owner-led.
- ComfyUI regeneration of portraits for a new cast.
- Steam packaging.

## Owner-answered, 2026-09-07

| question | OWNER'S ANSWER | context |
|---|---|---|
| Does the company grow? | **XP and level-ups.** Units gain stats through play, not only through gear. | Raised by the final gate: there is no XP, no level-up and no stat-granting item anywhere in the engine, so the starting three were frozen at STR 6 / MAG 7 / SKL 5 / SPD 5 for a whole run and gear was the entire power curve. 12 of 37 shipped stat checks were unpassable as a result (fixed for now by retuning + `content/lint.ts#liveDoor`). Implementing this means growth rates, a level curve, and re-measuring every balance band; permadeath gets harsher, which is intended. NOT yet built. |

## Owner-answered, 2026-10-18 (UI proposal, Design canvas)

The UI proposal ("Saddle, Sheet and Seal" for the element system, "The Surveyed Sheet" for the overworld) lives on a private Design canvas, with a 20-step build order. Nothing in `game/` was built from it yet. Four questions it raised were answered:

| question | OWNER'S ANSWER | context |
|---|---|---|
| Which balance numbers are true? | **The data as tuned.** This log is amended to match. | The map will print the live encounter rate, so the record follows the code. Live values: `encounterChancePerHop` **0.40 / 0.55 / 0.70** (regions.json, superseding 0.25/0.40/0.55 above); Food Rations carry **4 charges**, so the start kit is 2 × 4 = **8 hops** (superseding 3 charges / 6 hops); camp Rest heals **35%** (`rules.camp.restHealFraction`, superseding 20%); compact dungeon weights **combat 45 / event 20 / treasure 12 / rest 20 / elite 8** (superseding 45/20/15/5/5). Matches the standing finding that the game was too easy. |
| Where does sound come from? | **A CC0 set now** (about 20 cues, for example Kenney Interface Sounds and RPG Audio) plus `ui/audio.ts` with one cue table and the mute switch. | `public/audio` is empty and Pause's Sound switch toggles nothing. The cue table is the contract, so files can be swapped one by one later. |
| How does the town shop list its stock? | **A price-sorted tariff** in two columns with a "Beyond the purse" rule, a kind glyph per row, everything visible, no scroll. | The alternative was grouping by kind under sticky heads with a scroll rail. Revisit only if a playtest shows players hunting by weapon type. |
| How much new art ships in the first build pass? | **Core now, terrain later.** Bust crops at four portrait sizes, the per-kind icon set and the small camp pixel set now. The authored overworld terrain layer (ranges, river, forest, march lines, re-spacing in world.json) and the title march strip come next pass, with roads-only fallbacks. | Characters stay ComfyUI art; the hand or procedural pixel toolkit covers tiles and icons only. The terrain layer must be planned in ASCII under the drawing-maps skill and changes every overworld snapshot. |

## Owner-answered, 2026-10-24 to 2026-10-25 (UI proposal, later rounds)

The canvas is https://claude.ai/artifact/79397vba2Fwp6Wti5a6DLj (private). A separate canvas explaining the map choice is https://claude.ai/artifact/6vVM8vPs2S7mKSpqJgGkyq. The generator code is in `tools/pxworld/`, with the newest work in `tools/pxworld/wip/`. Nothing in `game/` has been built from any of it yet.

| question | OWNER'S ANSWER | context |
|---|---|---|
| The look | **Filigree over a 1× pixel world, on every screen.** The pixel UI uses walnut-and-brass windows, Jacquard 24 titles and Source Serif 4 for reading. The world is procedural pixel art at one art pixel per screen pixel. | The paper "Field Ledger" look was rejected ("not very happy with the paper ui direction"). The owner then said "go pixel everywhere". Characters stay ComfyUI art, placed at 1:1. |
| The map's shape | **Open, every direction: variant B, the camp at the hub.** The Borderlands surround the camp; Thornwood's forest rings the north and east, and Ashfall's burnt hills the west and south. | The owner's words: "you can travel in every direction, not you have to travel to the right". This matches the story bible's locked "omnidirectional open sandbox". A (today's roads moved) and C (march off-road, an engine change of about 2 weeks) were the alternatives. |
| The map's size | **Four times the area and four times the places, at today's density.** The Borderlands become 2 screens by 2, with about 60 places; the whole country has about 190 instead of 47. The screen shows a quarter of the Borderlands and scrolls. | The owner: "the scale is too small ... at least 4 times the size with the same density". About 143 new places need names, types and encounter tables. Twice the distances means about twice the hops, so tier bands and food or days per hop need rescaling. **Still open:** the numbers to rescale them to. B as first drawn put the Iron Throne at 9 hops and failed the balance gate. The owner's choice of B came with longer Ashfall roads, so runs stay at least as long as today. |
| How screens are split | **One job per screen, learned from shipped games** (Battle Brothers, Mount & Blade, Darkest Dungeon, Octopath, Fire Emblem, Ren'Py). The town is a square whose buildings are the choices, and each building is its own screen: the inn, the market as a trade screen, the tavern as a room whose people are the choices. Each person has their own screen with Kit and Deck tabs. The satchel is its own screen. Quest and story conversations are standard visual-novel screens. | The owner: "when entering town, the UI should not show everything all at once ... all separate screens ... make sure that the UX is also good, not just the UI". Calls made by the builders and not yet confirmed by the owner: road events stay pop-ups over the map; the shared satchel and two hands per person stay, with no personal packs. **Art gaps:** every ComfyUI stand faces right and must not be mirrored, so Kael needs a left-facing pose; Daren's art reads as a woman. |
