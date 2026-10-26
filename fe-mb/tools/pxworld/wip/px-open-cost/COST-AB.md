# What A and B really cost in the game as built

Scope: `E:/Work/GameDev/Godot/fe-mb/game/` read only. Paths below without a drive are under `game/`. `SP` = `C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad`.

## How this was measured (not only read)

I built both variants as real `world.json` files and ran the game's whole test and balance kit against each. The game folder was not edited: every run used a copy.

- `SP/costab_scripts/make_worlds.py` writes `world_A.json` (A's positions from `dirs/px-open-a/country_a.py#positions`, graph unchanged) and `world_B.json` (B's `P`, `REMOVED`, `ADDED` from `dirs/px-open-b/world_b.py`, with `areaTier` rewritten to the BFS band). `world_B_tiers_unfixed.json` is B with the roads changed and the tiers left as shipped.
  - Positions are shifted to non-negative ints, and the sheet is sized so the game camera can centre the camp. A's sheet is 2095×1735 with the camp at (769, 434). B's is 2540×1744 with the camp at (1334, 824).
- `SP/costab_copy/{O,A,B,B0}` are copies of `game/` (node_modules joined by a junction): O is the shipped baseline, A, B, and B0 is B with its tiers not fixed.

| run | O (shipped) | A | B (tiers fixed) | B0 (tiers not fixed) |
|---|---|---|---|---|
| `vitest run`, 83 files / 1301 tests | all pass | all pass | all pass | 49 fail: `createEnv` throws at load |
| `lint:content` | OK | OK | OK | not run |
| `tsc --noEmit` | | | clean | |
| Playwright e2e, 108 tests | all pass | all pass | **1 fails** (deterministic, 3 of 3 runs) | not run |
| `cli.ts balance` gate | all bands ok | **byte-identical to O** | **MISS**: road leg cleared 13% (band 55–70%), exit 1 | not run |

Screenshots of the in-game map, written by `SP/costab_copy/*/shot*.mjs`, are in `SP/dirs/px-open-cost/`:
- `ow_O_default.png`, `ow_A_default.png`, `ow_B_default.png`: the default camera.
- `ow_O_sheet.png`, `ow_A_sheet.png`, `ow_B_sheet.png`: the whole sheet scaled into the window.

One side effect to know about: the sandboxes share the game's `node_modules` through the junction, so Vite rebuilt its dependency cache in `game/node_modules/.vite/deps`. It also left an empty `deps_temp_b5c66467` folder from the concurrent starts. That is a regenerated build cache, not source. Vite rebuilds it on the next `npm run dev`.

## 1. The overworld screen as built

**The game does not draw the pixel world.** The shipped map is the SVG and CSS parchment sheet ("Field Ledger"). It has no region strip, no minimap, no region window and no edge fingerposts.
- `src/ui/overworld/Sheet.tsx:1-5` says so ("one map, no region strips").
- A grep of `src/ui` and `src/styles` finds no minimap, overview or strip outside combat's initiative strip.
- The region window, the strip, the fingerposts and the 1× pixel art all exist only in the board mock-ups (`dirs/pxworld/gen_map.py`). Building them into the game is a separate job of the same size whichever variant wins. It is not part of A's or B's cost.

**Camera, scrolling and bounds are already two-dimensional and centre the company.**
- The window is 1280×600 (`src/ui/stage.ts:5-8`, `src/ui/overworld/OverworldScreen.tsx:46-47`).
- `cameraFor` centres the current node at `x - 640`, `y - 0.48·600`, and `clampCamera` clamps that to `[0, sheet - view]` on both axes (`OverworldScreen.tsx:126-134`).
- Dragging pans both axes (`:417-425`), and "Find the company" recentres (`:555`).
- The edge shadow is worked out per side, on all four sides (`:457-462`, `:545-550`).
- The sheet size is read only from `world.width` and `world.height` (`:410`, `:424`, `:499-501`). Nothing hard-codes 3060×850; that figure appears only in comments (`OverworldScreen.tsx:11`, `src/styles/overworld.css:465`, `tests/e2e/overworld.spec.ts:224`).
- **So to put the camp in the middle, the sheet must leave at least 640 px of sheet left and right of the camp, 288 px above it and 312 px below it.** Then the existing camera does it. Both test worlds were sized this way, and both default screenshots show Frontier Camp centred (`ow_A_default.png`, `ow_B_default.png`).

**Code that assumes x grows with progress, or that regions sit left to right:**
1. `Sheet.tsx:98-106`, `paletteAt(x)`. The wilderness ink (forest, mountain or cinder marks) picks its region by **horizontal distance only**, `|wash.cx - x| / wash.rx`. Measured over the 72 px symbol grid, it disagrees with the region of the nearest place:

   | world | cells wrong |
   |---|---|
   | shipped | 18% |
   | A | 54% |
   | B | 37% |

   In B, the northern forest prints as Borderlands tufts and mountains (`ow_B_sheet.png`). **This must change for B, and should for A.** The fix is to pick by 2-D nearest place or by a 2-D wash test, about 10 lines.
2. `Sheet.tsx:68-89`, `regionWashes`. Each region gets one ellipse over its places' bounding box, with the name lettered under the lowest place (`labelY = maxY + 78`).
   - In B, Thornwood wraps north and east and Ashfall wraps south and west, so **all three washes cover the camp**.
   - **Thornwood's name is lettered at (1634, 1242), south of the camp, under "The Borderlands".** That is the opposite side from the forest (`ow_B_sheet.png`).
   - In A, the washes are separate and the names sit inside their regions (`ow_A_sheet.png`).
   - B needs a different wash model, such as a wash per cluster or an authored label anchor. That is a small UI change plus a label-planner check.
3. `src/engine/run/travel.ts:90` emits `hopStarted.westward` from `position.x`. `OverworldScreen.tsx:483` and `:520`, with `overworld.css:393`, mirror the pawn sprite when it walks west. This is left and right facing only and works in any layout. No change is needed.
4. The hint copy "Drag the sheet — the country runs on past the frame." (`OverworldScreen.tsx:554`) has no direction in it. It is fine.

Nothing else on the screen cares about direction:
- the label planner (`src/ui/overworld/labels.ts`) plans in 2-D over the whole sheet;
- `Roads.tsx:71-90` and `roadInk.ts:46-81` draw node to node;
- `NodeMark.tsx:120` and `seatCard` (`OverworldScreen.tsx:163-172`) clamp in both axes;
- the compass is pinned top-right of the sheet (`Sheet.tsx:181`).

**To show "camp in the middle, roads leaving every way" on the screen as built:**
- A needs new positions and a new sheet size in `world.json`, plus the `paletteAt` fix if the ink should match.
- B needs the same, plus the wash and label fix.
- Roads "running off the screen" happen by themselves, because the far places are on the same sheet. Only the pixel board's fingerposts and edge labels would be new UI.

## 2. The content gate and every other check world.json must pass

The gate is `src/engine/content.ts#createEnv`, at `:121-142`. It runs at module load through `defaultEnv` (`:180-183`), so a bad world breaks every test and the app.
- `:124-129`: the BOSS must be `≥ rules.travel.bossNodeMinHops` (7, `src/engine/rules.ts:503`) from the start over **visible** places.
- `:130-135`: every reachable place's authored `areaTier` must equal `tierForDistance(hops)` (`:68-73`). The bands are ≤2 for tier 1, ≤5 for tier 2 and 3 beyond (`rules.ts:498-502`).
- Hidden places are skipped (`:131`, and `nodeDistances` at `:37-57`).
- `:138-140`: the battlefields; not affected.

The schema (`src/content/schemas/overworld.ts`):
- positions must be **integers ≥ 0** (`:30`);
- edges must be unique and undirected (`:88-89`);
- there must be exactly one BOSS (`:86-87`);
- the BOSS needs an `enemyGroupId` (`:44-45`);
- `locked` is allowed only on a DUNGEON (`:48`).

The other lints (`src/content/lint.ts`):
- the start exists and is not hidden (`:275-277`);
- TOWN and DUNGEON places have defs (`:281-282`);
- every edge's encounter table matches **one of its two endpoint regions** (`:298-300`);
- every visible place is reachable from the start (`:304-316`);
- every locked place has an `unlockNode` writer (`:453-463`; Smuggler's Cave via a quest);
- every weighted loot cell for each (region, areaTier) pair that occurs can drop (`:767-786`);
- the discovery-event tier reach rule (`:653`).

**A passes everything unchanged.** The graph, tiers, hop counts and BOSS distance (14) are identical. Only `position`, `width` and `height` change. `lint:content` and createEnv are OK, and the balance gate output is byte-identical to the shipped game.

**B passes only after 14 `areaTier` edits.** Without them createEnv throws at the first node: "content: node 'watchtower_ridge' is 2 hops out but authored areaTier 2 (rules.travel.tierByDistance says 1)". The edits:

| place | shipped tier (hops) | B tier (hops) |
|---|---|---|
| watchtower_ridge | 2 (3) | 1 (2) |
| north_ridge_path | 2 (3) | 1 (1) |
| thornwood_chapel | 3 (6) | 2 (5) |
| dark_hollow | 3 (6) | 2 (5) |
| foggy_marsh | 3 (6) | 2 (5) |
| ancient_ruins | 3 (8) | 2 (5) |
| morganas_grove | 3 (8) | 2 (5) |
| mountain_pass | 3 (9) | 2 (4) |
| ashfall_trail | 3 (9) | 2 (4) |
| ashfall_outpost | 3 (10) | 2 (5) |
| lava_fields | 3 (10) | 2 (5) |
| scorched_village | 3 (10) | 2 (5) |
| ember_creek | 3 (10) | 2 (5) |
| ruined_chapel | 3 (10) | 2 (5) |

Other B results:
- **BOSS: 9 hops** (≥ 7, passes).
- **The five added roads pass the table rule.** `borderland_shrine–mountain_pass` and `broken_bridge–ashfall_trail` use `ashfall_road`, with an Ashfall endpoint. The three Borderlands roads use `borderlands_road`.
- All places stay reachable.
- **Hidden and locked places are untouched.** Daren's two roads (`frontier_camp–darens_camp`, `darens_camp–south_road_ambush`) are kept, and Smuggler's Cave keeps its `unlockNode` writer.
- The new (Ashfall, tier 2) loot pair passes `:767-786`.

**Region membership does not change in B, but tier and region now disagree.**
- **Road fights** take their level from the node's `areaTier` (`src/engine/run/battle.ts:54`, `travel.ts:166`, `difficulty.ts:10-13`).
- **Dungeons and shops** take theirs from the **region's** tier (`difficulty.ts:16-20`, `economy.ts:43-57`).
- So in B, Ashfall roads fight at tier 2 from hop 4. Iron Mine and Obsidian Cavern still run tier 3 at 6–7 hops. Ashfall Outpost sells the tier-3 shop row 5 hops from camp.
- Ashfall's 0.70 roll per hop (`src/content/data/regions.json:31`) starts at hop 4, where today it starts at hop 9.

**B's shortest road to the throne skips Thornwood entirely and passes one town, not three.**
- B: camp › South Road Ambush › South Junction › Broken Bridge › Ashfall Trail › … › Ashen Gate › throne (9 hops). There is also a western route through Trader's Rest, Bandit Hideout, the Shrine and Mountain Pass.
- Today: 14 hops through Riverside Market, Thornwood Chapel and Ashfall Outpost. Measured by BFS in `SP/costab_scripts/paths.py`.

**This breaks the balance gate.** In `scripts/cli.ts balance` the road leg (`ATTRITION.roadTo = 'the_iron_throne'`, `scripts/cli.ts:1756`) goes from 58% cleared over 11.8 steps to **13% cleared (21 wipes in 24), mean 5.8 steps, MISS against the 55–70% band**. The gate exits 1. `rules.ts:185-196` records that re-tuning those knobs is "an owner call".

B could stay content-only, using content levers that already exist:
- a per-edge `rollChance` (`schemas/overworld.ts:58-62`, read at `src/engine/run/encounters.ts:19-20`) on the new rim roads;
- `borderlands_road` tables on them, which `lint.ts:300` allows because one endpoint is in the Borderlands;
- or a longer road to the throne.

Each of these must be re-measured against the gate.

## 3. Saves, tests, fixtures, e2e, snapshots and docs

**Saves.** No save stores a position. The run keeps `nodeId`, `visitedNodes`, `edgeTraversals` and scouted edges (`src/engine/save/schema.ts:432-436`). But `contentVersion` hashes the whole registry (`content.ts:27-30`), and a mismatch nukes the save (`src/engine/save/codec.ts:103-104`, `rules.save.nukeOnMismatch`). **Any world.json edit, A included, invalidates every existing save.** This is pre-alpha policy, so the cost is only that players lose a parked run. In B, a parked `pendingTravel` over a removed road would be invalid too, but the nuke catches it first.

**Unit tests.** All 1301 pass for A and for B (with tiers fixed). The ones that read the map are generic:
- `tests/unit/content/content.test.ts:72-82` checks the start, the BOSS id and tier, and Daren hidden;
- `tests/unit/engine/run/difficulty.test.ts:17-27` re-checks the tier band;
- `tests/unit/ui/labels.test.ts:121-130` runs the label plan on the shipped positions;
- the helpers `tests/helpers/overworld.ts:23-43` pick nodes by type and hop range.

**Fixtures that name roads.**
- `tests/helpers/saves.ts:178` holds a battle origin `riverside_market → bandit_hideout`, which is **a road B removes**. Nothing validates it today, so no test fails, but it is now a fixture of a road that does not exist.
- `saves.ts:316-317` (`frontier_camp|riverside_market`, `old_mill_crossing|riverside_market`) survive in both variants.

**E2E.** A passes all 108. B fails one, deterministically: `tests/e2e/pause.spec.ts:44-69`.
- It sends seed 7 to `border_fortress` (`:50`) and expects the company to have left Frontier Camp after Resume (`:68`).
- Today the first hop goes into Riverside Market, a TOWN, and TOWN hops never roll (`rules.ts:496`).
- In B the first hop is camp → North Ridge Path, a TRAIL that rolls at 0.40. Seed 7 rolls a fight, so the node never changes. The CLI confirms it: `travel --seed 7 --to border_fortress` stops at Frontier Camp after an encounter.
- The fix is a one-line change of target or seed.

The pan and label sweeps (`overworld.spec.ts:147-205`, `:228-271`) pan to fixed sheet points, but they clamp, and they passed on both sheets.

**Snapshot tests.** There are none in `game/`: no `toHaveScreenshot` or `toMatchSnapshot`. The `page.screenshot` calls only write evidence to `../.playwright-mcp/`.

**Docs and comments with hard-coded strip, hop or direction facts.** These go stale but break nothing:
- `OverworldScreen.tsx:11` and `overworld.css:465` (3060×850);
- `overworld.spec.ts:224` (3060×850);
- `tests/unit/engine/run/scout.test.ts:121-122` ("the throne is seven hops from any camp");
- `src/content/lint.ts:613-616` (Blood Ties "runs the OTHER way from the throne");
- `scripts/cli.ts:1541-1543`: `TRAVEL_LARDER = 8`, sized because "the last stretch … is seven hops". B changes the town gaps: South Junction to the throne is 7 hops with no town.
- `docs/rewrite/CONTRACT-CHANGES.md:130`, `:426` (throne at 14 hops), `:751`, `:837` and `:846` (3060×850). These are append-only history, not live truth.

**Copy that names a direction.** It reads wrong once places move:
- `src/content/data/towns/south_junction.json:13` ("headed east");
- `towns/ashfall_outpost.json:4` and `:13` ("eastern frontier", "eastern gate");
- `checkEvents/interrogate_survivor.json:15` and `:39` ("camp lies east of the road");
- `dialogue/sq_caravan_accept.json:40` ("the south road toward the Thornwood eaves"). In B the south road leads to Ashfall.
- The place names themselves: in A, South Road Ambush and South Junction are drawn west of the camp (`ow_A_default.png`).

## 4. Everything else that reads a place's position

The full set, from a grep for `position` over `src`, `scripts` and `electron` with combat and dungeon `position` removed:
- `content/schemas/overworld.ts:30` (the schema);
- `engine/run/travel.ts:90` (the `westward` flag: presentation only, no RNG, no rule);
- `ui/overworld/OverworldScreen.tsx:133`, `:344-350`, `:483`, `:520`, `:525-540`, `:551`;
- `ui/overworld/Roads.tsx:71`;
- `ui/overworld/NodeMark.tsx:120`;
- `ui/overworld/labels.ts:111`, `:145`, `:149`, `:205`, `:231`;
- `ui/overworld/Sheet.tsx:72-73`, `:110`, `:116-117`.

No engine rule, the CLI and the balance sim do not read positions. That is why A's balance output is byte-identical to the shipped game's.

## Estimate

**A: small.**
- One data file changes: new `position` values for the 47 places, and `width` and `height` in `world.json:4-5`.
- The engine, gate, lints, 1301 unit tests, 108 e2e tests and the balance gate all pass unchanged.
- Optional polish: the `paletteAt` x-only fix (`Sheet.tsx:98-106`, about 10 lines) so the wilderness ink matches the regions, and re-reading the five lines of direction copy.
- The cost is low because A never touches the graph. The trade-off is that its deeper country still runs one way (south-east).

**B: medium.**
- The data edit itself is small: 5 roads removed, 5 added, 14 `areaTier` values rewritten, new positions. With those, the gate, lints and unit tests pass.
- But it is not "content only" in effect:
  1. The balance gate fails hard (road leg 13% against a 55–70% band). The throne is now 9 hops away through Ashfall's 0.70 roads with one town on the way, so B needs a tuning pass, owner-approved by `rules.ts`'s own note. That could be per-edge `rollChance` or tables, or a longer approach.
  2. The sheet's region washes and labels break on a ring layout. Thornwood is lettered south of the camp, so `regionWashes` and `paletteAt` need a 2-D rework (`Sheet.tsx:68-106`).
  3. One e2e test needs a new target (`pause.spec.ts:50`), and one fixture names a deleted road (`tests/helpers/saves.ts:178`).
  4. Thornwood drops off the critical path, and the tier/region split makes tier-3 shops and dungeons sit 5–7 hops from camp. That is a design decision for the owner, not a bug fix.
- Most of B's cost is the balance re-measure and tuning, plus the owner's sign-off.

**Both variants:** the pixel-world overworld (region window, overview, fingerposts) is not in the game at all. Building it is a separate job of equal size for either variant.
