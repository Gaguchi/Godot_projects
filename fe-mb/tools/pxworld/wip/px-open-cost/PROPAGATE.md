# Propagating the open map: what changes for A, B and C

`SP` is the scratchpad. `REPO` is `E:/Work/GameDev/Godot/fe-mb`. `PX` is `REPO/tools/pxworld`. I worked this out by reading the code, read-only. When I looked, `px-open-c/` held only an empty `t/`, so the C list below is built from OPENMAP.md and B's code. Check it against C's NOTES.md once that file exists.

## 1. Which house-style boards show the overworld (checked in code)

There is only one road into the map world. `kit.world_map()` calls `_px('kit_px_map')`, which calls `kit_px_map.map_uri()`, which runs `pxworld.borderlands.render(1)`. `pxworld.borderlands` takes its layout from `hyb-64/world_map.py`. The pop-ups also read **layout data** straight from `kit64/kit_world_map.py`: `P`, `NAMES`, `ROADS` and the quadratic `road_geo`. That module is the painted copy of the old layout. They also keep their own label tables.

| Board | Generator (rebuild.py) | What it uses now | Touched? |
|---|---|---|---|
| PxMap1x | `pxworld/gen_map.py grain=1` | the board itself, replaced by the chosen variant | **replaced** |
| F64Pause | `px-popups/gen_pause.py` uses `common.map_screen()` | world_map, `common.LBL`, `beads()` over `WM.road_geo`, the strip in `region_window()`, "Thornwood" and "the land runs on east" in `labels()`; hint "Three roads out of camp…" | **yes** |
| F64Company | `px-popups/gen_company.py` uses `common.map_screen()` | the same as Pause, with the same hint | **yes** |
| F64Contracts | `px-popups/gen_contracts.py` uses `common.map_screen('pine_crossing', 4, …)` | the same, plus `KPM.stand('pine_crossing')=(1036,414)`; hint "Four roads out of Pine Crossing"; a route Frontier Camp, then Riverside Market, then Old Mill Crossing, then Pine Crossing; it quotes "the south road toward the Thornwood eaves" | **yes** |
| F64Dialogue | `px-popups/gen_dialogue.py` uses `f64i.map_screen(at=road_point('frontier_camp','traders_rest',.55))` | world_map(company=False), `f64i.LBL`, `f64i._region_strip`, "Thornwood" and "the land runs on east" in `map_screen()`, `road_point` over `WM.road_geo`, the label list `hide=` | **yes** |
| F64Check | `px-popups/gen_check.py` | the same as Dialogue (road point .55, `hide=('watchtower_ridge',)`) | **yes** |
| F64Name | `px-popups/gen_name.py` uses `f64i.map_screen(here='riverside_market', hide=(4 labels))` | the same, plus `KPM.stand('riverside_market')=(652,405)` | **yes** |
| KitPanels | `kit64/gen_panels.py` | 3× `world_inset(…, 'map', at=(330,150) / (560,330))`, crops of `world_map()` with the company in; the plates "Trader's Rest", "Riverside Market", "South Junction", "a road out" | **art follows automatically**. Check the crops. C changes the copy. |
| Hyb64Key | `px-popups/gen_key.py` | pxworld meadow and one straight road only, no map; copy "boxed: a road out", "an encounter on the road: 4 in 10", "Sixteen ramps" | A and B: none. C: copy. |
| KitControls | `kit64/gen_controls.py` | no map; copy "An encounter on the road: 4 in 10" | A and B: none. C: copy. |
| F64Title | `px-scenes1/gen_title.py` | its own deep scene, no map; **board title** "the company on the road east" | copy, all variants |
| F64Prologue | `px-scenes1/gen_prologue.py` uses `prologue_scene.py` | its own camp scene; **`camp_props.fingerpost()` draws three arms, all pointing east** ("the three roads out of camp") | **art**, all variants |
| F64Report | `f64-pages/gen_report.py` | combat field only; board title "the brigands on the road south"; derived from `probe_road_report.mts` (first hop to South Road Ambush) | A: copy. C: re-derive. |
| F64Lost / F64Win | `px-scenes2/gen_lost.py`, `gen_win.py` | own scenes; stat "hops walked" with `assert DAYS == 1 + hops`; the Lost docstring says "road east" (docstring only) | B: plausibility check. C: copy and stats. |
| PxCamp | `px-camp/gen_pxcamp.py` | own scene; "one hop from Frontier Camp"; `ROADS, DEPTH = 6, 3` (Scout: "6 roads within 3 hops" from Trader's Rest) | B: number. C: copy. |
| PxTownInn/Shop/Tavern | `px-town/gen_px_town.py` | own scene (the river east of the market with a bridge square); "N hops of rations", "each hop eats one", "→ N hops" | C: copy |
| Hyb64Combat, F64CombatEnemy, F64Dungeon | combat field and cave | no overworld, no directional copy (the fixture "Ashfall Raiders at Frontier Camp" is game data) | none |

Nothing else imports `pxworld/borderlands.py` or `hyb-64/world_map.py` for the map. One thing does reach `hyb-64/world_map.py` for another purpose: `pxworld.places.farm()` imports it for `FARMS` plan anchors. Both A and B call `PL.farm`, so `hyb-64/world_map.py` must stay.

### Game content that the layouts contradict (read-only, the owner's call)

- `checkEvents/south_road_ambush.json` "Wreckage on the south road", the place name **South Road Ambush**, `towns/south_junction.json` "southern trade routes", and `road_merchant.json` "southern crossroads".
  - In **A**, South Road Ambush is **west** of the camp (470,360 against 660,330), and South Junction is west-north-west (255,300).
  - In **B** both lie south (588,552 and 650,640).
- `sq_caravan_accept.json` "The drivers favoured the south road toward the Thornwood eaves", which F64Contracts quotes.
  - **A**: Thornwood lies south-east, through Southern Trail, south of the view. This is fine.
  - **B and C**: Thornwood lies **north and east**, and the south road leads to Ashfall. This contradicts the line.
- `towns/south_junction.json` "If you're headed east, … the land grows harsh". This is fine in B, where Thornwood is to the east. In A it is weak, because east is only the Thornwood Gate exit.

## 2. Steps shared by every variant, in order

1. **Make the variant's layout importable without rendering.**
   - A's labels live in `gen_open_a.LBL` and `EDGE_LBL`, and B's in `gen_open_b.place_labels()`. Both are inside board scripts that render when imported.
   - Move each table into a module: `layout_a.LBL` / `EDGE_LBL`, or a new `px-open-b/labels_b.py` with `place_labels()` and the exit-board captions.
   - Move the region-window overview builder into a module too. For A, `overview_a.render(w, h)` already is one. For B, `overview.overview(w, h)` is one, but its composition (pin, labels, frame, and `OX, OY = 292, 16`) sits in `gen_open_b.py` and needs moving.
2. **Point the kit at the new world** in `kit64/kit_px_map.py`. This file is the one the OPENMAP rule froze during the build; after the pick it has to change.
   - `_pxworld()`: import the variant renderer instead of `pxworld.borderlands`, and add its folder to `sys.path`.
   - `_map_png` and `_patch`: change `BL.render(1, company=…)` to the variant call. A: `openworld.render(company=…)`. B and C: `world_b.render(company=…)`. Both accept True, False or (x, y).
   - `road_paths()`: change `BL.road_paths(1)` to A: `openworld.road_geo()`, or B: `world_b.road_paths()` with **the roads to hidden places dropped** (`NODE[k]['hidden']`, which means Daren's two roads).
   - `SOURCES`, the cache key: add every `.py` in the variant folder(s). If you skip this, a fix to the layout serves the old PNG from `px-popups/cache/`. Bump `VERSION` as well.
   - `CAMP_FOOT`: A: `plans_a.COMPANY_AT = (668, 374)`. B: `(602, 418)` (P + (2, 8)).
   - `STAND`: choose `riverside_market` and `pine_crossing` again on 3–5× crops of the new art. `stand()` falls back to `kit_world_map.P`, so point the fallback at the variant's `P`.
   - Update the docstring, which talks about the east gate and the "accepted 1x Borderlands".
3. **Give the pop-ups the variant's layout**, not `kit_world_map`. Do this in both `px-popups/common.py` and `px-popups/f64i.py`.
   - `NAMES`, `PT`, and `NEIGH`, which is built from `WM.ROADS` today: take them from the variant. Count only the roads between drawn, visible places.
   - `LBL`: take it from the variant's table. In `labels()` and `_label()`, set each label's tier from `NEIGH[here]`, so the roads out of the current stop become plates. Today's two tables (common and f64i) differ by a few px; keep one.
   - `labels()` and `f64i.map_screen()`: delete "Thornwood" at (1176,600) and "the land runs on east" at (right 16, 646). In their place draw the variant's edge labels: A `EDGE_LBL`, B `EXITS` names on the `board_box` signs.
   - `beads()`: iterate the variant's road polylines (`kit_px_map.road_paths()`) directly. Drop the `WM.road_geo` quadratic and its "drawn ends differ" test.
   - `f64i.road_point(a, b, t)`: take the point at arc-length fraction t along the variant polyline. Choose t again so the company stands outside the stake ring on open road; today it is .55.
   - `region_window()` and `f64i.map_hud()`/`_region_strip()`: replace the four-segment strip and its pin with the variant's overview window. Use the same size and layout as the variant board, so map and pop-ups match: A 492×194, B 472×176.
   - Retire the `F64_PAINTED=1` path. `kit_world_map`'s painted art is the old strip and cannot follow a new layout. Either remove it or let it fail loudly.
4. **Redo each pop-up's own data.** See each variant's list for the numbers.
   - The hints.
   - The `hide=` label lists in Dialogue, Check and Name. They depend on where the labels now sit under the windows.
   - The Contracts hint and the stand point.
   - Check that every place a window must cover is still under it. Daren's Camp, which Blood Ties spawns, must stay under the Contracts window.
5. **F64Title**: in `px-scenes1/gen_title.py:64`, change the board title "the company on the road east" to "the company on the road". Change "view east" in the docstrings of `gen_title.py` and `title_scene.py`. The art needs no change.
6. **F64Prologue**: give `px-scenes1/camp_props.fingerpost()` one arm per real road out, pointing different ways. Left-pointing arms are drawn mirrored. It needs an `arms=[(y, rise, 'l'|'r'), …]` parameter.
   - In `prologue_scene.py`, pass the arms. Optionally add the branch of the road that runs off left along the outside of the wall at the fork (`ROAD`, `POST_AT`).
   - Fix both docstrings ("points the three roads east").
7. **KitPanels**: re-render, then crop `world_inset` at (330,150) 760×470 and at (560,330) 200×120. The second should hold the camp and the company. Nudge `at=` if it does not.
8. **Rebuild and QA in SP.** Run every touched generator. Run `node preview.mjs` for each board, crop the busy parts at 3–5×, and set each beside the chosen map board.
9. **The canvas.** In `SP/canvas_index.py`, put the chosen board in PX_ROWS row 1 in place of `PxMap1x`, add `PxMap1x` to `SUPERSEDED`, and drop or archive `OPEN_ROWS`. Then run `canvas_index.py` and republish the canvas.
   - Alternative: have the chosen generator `write('PxMap1x', …)` so the board keeps its key. This is the default I'd use: the repo's row stays 22 boards and nothing downstream renames.
10. **Sync the repo.** See section 6.

## 3. Variant A: the same roads, laid round the camp (graph unchanged)

Data source: `px-open-a/layout_a.py` (`P`, `ROADS` as waypoint polylines, `EXITS`, `HIDDEN`, `OFF`), `plans_a.py` (`COMPANY_AT`), `openworld.render/road_geo`, `overview_a.render`, `country_a` (all 47 positions, reads world.json).

1. Steps 1–3 above, using `layout_a` and `openworld`. Move `LBL` and `EDGE_LBL` out of `gen_open_a.py` into `layout_a.py`.
   - The edge labels are North Ridge Path, Borderland Shrine, Thornwood Gate ("into Thornwood"), Southern Trail ("into Thornwood") and Broken Bridge.
   - Port `gen_open_a`'s 492×194 region window, with the overview at 172×160 placed at (300,13), into `common.region_window()` and `f64i.map_hud()`.
2. `kit_px_map`:
   - `CAMP_FOOT = (668, 374)`.
   - Choose STAND again for Riverside Market (745,470) and Pine Crossing (820,600).
   - Roads come from `openworld.road_geo()`. Its keys are `layout_a.ROADS`, which already leave out Daren's hidden roads.
3. Hints:
   - Pause and Company: "Three roads out of camp…" becomes the A board's line, "Roads out of camp run north, west and south. Point at one, click to march." Place it the same way as the board: `right:16px`, top 694. Today's pop-ups use left 424 at 692.
   - Contracts: "Four roads out of Pine Crossing" stays true (old mill, bandit hideout, border fortress, Roderick's Camp). The route Frontier Camp, Riverside Market, Old Mill Crossing, Pine Crossing still exists. Choose its stand point again.
4. Dialogue and Check:
   - The road to Trader's Rest now runs **north** (camp 660,330, Trader's Rest 700,160). Choose t again on `layout_a.ROADS[2]`.
   - Recompute `hide=`. The camp gate's stake ring is A's `camp_gates`, so check that the company stands clear of it.
5. Name: Riverside Market is at (745,470), partly under the 572×232 modal (354–926 × 244–476). Recompute `hide=` from the new label boxes.
6. F64Report: change the board title "the brigands on the road south" to "the brigands on the road west" (`gen_report.py:126`), and update its docstring and Lost's ("first hop south").
   - Better, raise it with the owner. A puts a place called **South Road Ambush** west of the camp, and South Junction west-north-west. Under A that is a content conflict: either rename the places in game content or accept the mismatch.
7. F64Title (step 5), F64Prologue (step 6). The fingerpost gets three arms, for A's three roads: north to Trader's Rest, west to South Road Ambush, south-east to Riverside Market. Only one gate shows in the prologue's back wall, so have the arms point left, ahead and right.
8. KitPanels: crop check only. Hyb64Key, KitControls, PxCamp, the towns, Win and Lost: **no change**. The graph and the hop counts are identical, so the Scout count stays 6, the Win and Lost stats stand, and the probes stand.
9. Game (outside the canvas): only world.json positions change. `country_a.world_json()` writes the shifted positions and the sheet size. Nothing in the engine changes.

## 4. Variant B: the camp at the hub, the wilds all round (world.json edges change, no engine change)

Data source: `px-open-b/world_b.py`.
- `P`: all 47 places.
- `b_roads()`: removes riverside_market–bandit_hideout, bandit_hideout–pine_crossing, border_fortress–borderland_shrine, wolf_den–morganas_grove and bandit_hideout–south_junction. Adds frontier_camp–north_ridge_path, traders_rest–bandit_hideout, bandit_hideout–borderland_shrine, borderland_shrine–mountain_pass and broken_bridge–ashfall_trail.
- `road_paths()`, `EXITS` (edge signs drawn in the art, with the names in HTML over `board_box`), `hops()`.
- `overview.overview(w, h)`, `bits`, `ashland`, `geo`.

Numbers I computed here by BFS over `b_roads()`, hidden places skipped:
- The camp has 4 roads out (N north_ridge_path, E riverside_market, W traders_rest, S south_road_ambush).
- Pine Crossing has **3** roads out (old mill, border fortress, Roderick's Camp).
- The Iron Throne is **9** hops away (today 14).
- 32 places change hop distance.
- Scout from Trader's Rest at depth 3 sees **11** roads (today 6).

1. Steps 1–3 above, using `world_b`.
   - Factor `place_labels()`, `FOOT`, `PREFER`, `AT` and `FIXED` out of `gen_open_b.py` into an importable module.
   - Factor the exit-board captions out the same way: "{region} · {days} days" uses `HOPS` measured from the camp. At any other stop (Contracts at Pine Crossing), compute the days with `world_b.hops(start=here)` or leave the days off.
   - Port the 472×176 region window with the overview at 156×104 placed at (292,16), the pin and the Thornwood, Ashfall and Iron Throne labels.
2. `kit_px_map`:
   - `CAMP_FOOT = (602, 418)`.
   - Choose STAND again for Riverside Market (805,395) and Pine Crossing (1100,375).
   - In `road_paths()`, drop `('frontier_camp','darens_camp')` and `('darens_camp','south_road_ambush')`.
   - Add `px-open-b/*.py` to `SOURCES`.
3. Hints:
   - Pause and Company: "Four roads out of camp. Point at one, click to march." This is the B board's own line.
   - Contracts: change "Four roads out of Pine Crossing" to "**Three** roads out of Pine Crossing". The route camp, market, mill, Pine Crossing is still in B's roads. Choose the stand point again.
4. Dialogue and Check: the road to Trader's Rest now runs **west** (camp 600,410, Trader's Rest 420,360). Choose t again and recompute `hide=`. Name: recompute `hide=`.
5. F64Contracts: the quoted line "the south road toward the Thornwood eaves" contradicts B, where Thornwood lies north and east. Flag it to the owner. Either the content line changes in `sq_caravan_accept.json` (and on the board), or the board keeps the quote as a known conflict.
6. PxCamp: in `gen_pxcamp.py:28`, change `ROADS` from 6 to **11**. Confirm it with `dirs/f64-places/probe_camp.mts` against B's world.json. The wolves roll on the hop label `hop:frontier_camp->traders_rest#1` and the `borderlands_road` table, both unchanged, so the rest should stand. Update the docstring.
7. F64Win and F64Lost: the stats are one consistent run, not a shortest path, and 21 or 12 hops are still possible. Check that the narrated fights can still be walked: the Ancient Ruins (Thornwood, now north-west), Daren's gang, the Ashfall raiders, and the Throne at 9 hops. Re-derive only if a fight's road is gone.
8. F64Report: South Road Ambush is still south, so the title stands. Re-run `probe_road_report.mts south_road_ambush 190` against B's world.json. The hop label is unchanged, so I expect the same result.
9. F64Title (step 5), F64Prologue (step 6): four arms, for N, E, S and W. KitPanels: crop check. Hyb64Key and KitControls: no change. B's Ashfall ground uses only the Wheat, Dirt and Stone ramps, so "Sixteen ramps" stays true.
10. Game: world.json gets the positions and the five removed and five added edges. Every changed place's `areaTier` must match its new BFS distance, because `content.ts#createEnv` enforces it. The 32 places are listed in B's NOTES. The boss is at 9, which clears `bossNodeMinHops = 7`. Nothing in the engine changes.

## 5. Variant C: march anywhere on B's country (engine change)

C imports B's world unchanged, so **do all of section 4 first.** Then do these, all of which come from the travel rule. Replace every wording below with the exact words of C's NOTES.md once it exists. The board names here are what the rule touches.

1. Repo and kit: sync both `px-open-b/` and `px-open-c/`. The map board's generator is `px-open-c/gen_open_c.py`, which imports `world_b`. `kit_px_map` uses `world_b.render` as in B, with `SOURCES` covering both folders.
2. The pop-ups at rest:
   - Roads out are no longer the only actions. Change the hints "Four roads out of camp / Three roads out of Pine Crossing. Point at one, click to march." to C's at-rest line (something like "Point anywhere, click to march").
   - Decide whether `beads()` stays. Roads are still the quick way, so it can, but the plates on the roads out mean less now.
   - If a pop-up shows a march in progress (Dialogue, Check), draw the route the way C's board does: across country, using `world_b.terrain_along`.
3. The region window, in the pop-ups and in C's own board: change "Roads here: an encounter on 4 hops in 10" to C's per-day wording (encounters by day, tier by days from the camp).
4. F64Dialogue and F64Check:
   - Change the docstring state "the hop is begun (food eaten, day counted)" to the march day begun.
   - Seeds 35 and 77 come from `probe_roadtalk.mts` over hop labels. They are void until the engine rolls per day, so re-derive them after the engine change, or mark them illustrative.
5. F64Report: change "first hop" in the copy and docstring to the first day's march. Re-derive `probe_road_report.mts` seed 190.
6. PxCamp:
   - Change "one hop from Frontier Camp" to C's distance wording (a day's march).
   - Scout's "{ROADS} roads within {DEPTH} hops" follows C's scout rule. The engine's `run/scout.ts#scoutableEdges` is BFS over edges, so it changes with the engine.
7. PxTown (Inn and Shop):
   - "{food} hops of rations" becomes days (C keeps 1 food per day).
   - "each hop eats one" becomes "each day eats one".
   - "{FOOD} → {N} hops" becomes days (`gen_px_town.py:171, 229, 234`).
8. F64Win and F64Lost:
   - The Ledger stat "hops walked", with `assert DAYS == 1 + hops`, becomes C's Ledger field (for example, days on the march). `Ledger.tsx` and `rules.daysPerHop` change in the engine.
   - The narrated runs need re-deriving under the new rule.
9. KitControls (`gen_controls.py:187`), KitPanels (`gen_panels.py:130`, "an encounter on the road: 4 in 10", and the caption "plates: a road out"), and Hyb64Key (`gen_key.py`, "boxed: a road out" and the type-card line "an encounter on the road: 4 in 10"): change to C's encounter and plate wording.
10. F64Title and F64Prologue: as in B, with four arms.
11. Game: B's world.json, plus engine work in `run/travel.ts`, `run/overworld.ts` (march targets that are not nodes, terrain cost, rivers crossed only at bridges and fords), `run/scout.ts`, `run/encounters.ts` (per-day rolls and labels), the content schema (terrain, crossings) and the Ledger. This is the only variant that changes the engine.

## 6. The repo sync (`PX`)

The rule I took from README.md, rebuild.py and the diffs:
- The repo files are the SP files with every absolute `SP` path rewritten. Add `ROOT = __import__('os').path.abspath(__file__ + '/../../..')`. Change `SP + '/dirs/X'` to `ROOT + '/src/X'`, `canvas/project` to `out/boards`, `mock/blobs.json` to `assets/blobs.json`, `mock/up` to `assets/up`, `SP/preview` to `out/preview`, and `E:/Work/...` to `REPO + '/...'`.
- Only the files the build uses are copied. Each generator runs in its own process.
- `requirements.txt` already has numpy, pillow and scipy. A's `overview_a` and B's `ashland`/`overview` need scipy, which is already there.

### For every variant

1. Copy the edited `kit64/kit_px_map.py`, `px-popups/common.py`, `f64i.py`, `gen_pause.py`, `gen_company.py`, `gen_contracts.py`, `gen_dialogue.py`, `gen_check.py`, `gen_name.py`, `px-scenes1/camp_props.py`, `prologue_scene.py`, `gen_prologue.py` and `gen_title.py`. Then copy whatever else that variant touched, rewriting the paths each time.
2. `rebuild.py STEPS`: replace `('src/pxworld/gen_map.py', ['grain=1'], ['PxMap1x'])` with the chosen generator. Keep the pop-ups first, because the first map user fills the cache.
3. `rebuild.py WORLD['map']`: change `'src/pxworld/t/world1x.png'` to the variant's world PNG. `map_no_company` keeps its glob `src/px-popups/cache/*_map_c0.png`.
4. `canvas_index.py`: if the board keeps the key `PxMap1x`, nothing changes. If it is written as `PxOpenX`, rename it in PX_ROWS. The repo copy has no `OPEN_ROWS`, so add none.
5. Retire `src/pxworld/gen_map.py` and `src/pxworld/borderlands.py`. Nothing in the build imports them once `kit_px_map` switches. Keep `src/hyb-64/world_map.py`, because `pxworld.places.farm()` reads `FARMS` from it.
6. Docs:
   - README "Rebuild" and "Layout" tables: add the new `src/px-open-*` row(s), describe `out/world/map.png` as the open map, keep "22 canvas boards", and update the pxworld row ("the overworld" now lives in the variant folder).
   - `KIT.md` line 178, `world_map()`: "the Borderlands at 1280 × 720". Describe the open map.
   - `kit.world_map()` docstring.
   - Copy `dirs/OPENMAP.md` and the chosen variant's NOTES.md into `PX/docs/`.
7. Run `python rebuild.py --preview` from `PX`. Compare `out/boards/` against the SP boards. Apart from the path rewrites, the bytes should match.

### A adds

- `src/px-open-a/` containing `gen_open_a.py`, `openworld.py`, `layout_a.py`, `plans_a.py`, `overview_a.py`, `country_a.py`, and `t/.gitkeep`. The `t/` folder must exist, because `gen_open_a` saves `t/world_a.png` without `makedirs`.
- Leave out the planning scratch: `lay_*.py`, `opt*.py`, `plan.py` and the `t/*.txt` files. Keep `plans_a.py`: the build uses it.
- `country_a.py:23` hard-codes `WORLD_JSON = 'E:/Work/.../world.json'`. Change it to `REPO + '/game/src/content/data/overworld/world.json'`. The README line "The build reads three files from the game" becomes four.
- `gen_open_a` imports `hyb-64` (`px64`, `icons64`, `paint`, `world_map`, `common`), all already in `src/hyb-64/`.
- STEPS: `('src/px-open-a/gen_open_a.py', [], ['PxMap1x'])`. WORLD: `'src/px-open-a/t/world_a.png'`.

### B adds

- `src/px-open-b/` containing `gen_open_b.py`, `world_b.py`, `overview.py`, `geo.py`, `bits.py`, `ashland.py`, and the new labels module.
- Optionally `country.py`, `plan_graph.py` and `qa_*.py` as tools. They are not part of the build. `plan_graph.py` reads world.json from an absolute path, so rewrite that if you bring it.
- Leave out `_nodes_snapshot.txt` and `qa/`.
- B reads no game file at build time: `NODE` is hard-coded from world.json as read 2026-10-24. Note in the README that it must be refreshed if world.json changes.
- STEPS: `('src/px-open-b/gen_open_b.py', [], ['PxMap1x'])`. WORLD: `'src/px-open-b/t/world_b.png'`.

### C adds

- Everything B adds (C imports `world_b`), plus `src/px-open-c/` with `gen_open_c.py` and its route and forecast modules, as C's folder ends up.
- STEPS: the C generator writes the map board. `gen_open_b.py` is **not** a step, because its board would be a second map. The B folder is a library only.
- WORLD: C's world PNG.
- The README says plainly that the boards assume the engine change described in C's NOTES.md.
- The copy edits for hops, days and the Ledger stat land in `src/px-town/`, `src/px-camp/`, `src/px-scenes2/`, `src/f64-pages/` and `src/kit64/gen_controls.py`/`gen_panels.py`, and `src/px-popups/gen_key.py`. Sync each of those.

## 7. Cost at a glance

- **A**:
  - 6 pop-ups get the new layout plumbing (`kit_px_map`, `common.py`, `f64i.py`) with the same graph and the same numbers.
  - Copy changes on 2 boards: Report "road south" becomes "road west", and the Title.
  - One art change: the prologue fingerpost.
  - Every probe and stat stands. The repo gets 6 files plus one absolute path fix.
  - The real catch is content: South Road Ambush and South Junction would lie west.
- **B**: A's plumbing, plus:
  - new numbers on 2 boards: Pine Crossing's three roads, and Scout's 11 roads at Trader's Rest;
  - exit captions measured per stop;
  - a quote in Contracts that now contradicts the map;
  - a plausibility check on Win and Lost;
  - re-run of 2 probes.
  - The repo gets about 7 files. world.json changes edges and the tier of 32 places.
- **C**: all of B, plus:
  - hop wording rewritten to days on about 10 boards (Town ×2, Camp, Report, Win, Lost, KitControls, KitPanels, Key and the pop-ups' region window);
  - 4 probes re-derived after the engine exists;
  - B and C folders both synced;
  - the engine itself.
