# Variant C, march anywhere: what it costs in the game as built

Read-only research. Nothing in `E:/Work/GameDev/Godot/fe-mb/game/` was edited. Paths below are relative to
`E:/Work/GameDev/Godot/fe-mb/game/src/` unless they say otherwise. `SP` is the scratchpad
`C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad`.

## The short answer

C is an engine change. The game today is built on the road graph, and almost every travel system reads that
graph directly:

- the walk (`engine/run/travel.ts`);
- the path and its preview (`engine/run/overworld.ts`);
- the encounter roll (`engine/run/encounters.ts`);
- Scout (`engine/run/scout.ts`);
- the content gate (`engine/content.ts`);
- the save format (`engine/save/schema.ts`);
- the map screen (`ui/overworld/OverworldScreen.tsx`).

The smallest design that does C has four parts:

1. Coarse terrain polygons go into `world.json`.
2. The engine rasterises them, with the roads, into a 16 px cost grid once at load.
3. A new `engine/run/march.ts` runs Dijkstra over that grid.
4. Travel steps one **day** at a time instead of one **hop**.

The rest stays as it is:

- Places are still the only stops.
- `travel/goTo` still names a place.
- A road fight still belongs to a place: the place nearest the night's camp.

Because of that, `run/battle.ts`, the battle origin in the save, loot, enemy levels and battlefields do not change
at all.

Cost: about **two working weeks for one person**, or 3 to 4 calendar days with agents working in parallel. Variant
B, for comparison, is a content edit. Being able to halt on bare ground, not just at a place, adds about 2 more
days (section 2.9).

The C builder's rules sketch (`SP/dirs/px-open-c/NOTES.md`) did not exist while this was written. I checked twice,
the last time at 01:02. The builder's code, `SP/dirs/px-open-c/march.py`, did exist, and every number here uses its
constants:

| constant | value |
|---|---|
| `ROAD_PX` | 210 |
| `OPEN_PX` | 140 |
| `FOREST_PX` | 70 |
| `FOOD_PER_DAY` | 1 |
| `TIER_DAYS` | ((2, 1), (5, 2), (inf, 3)) |
| `BOSS_MIN_DAYS` | 7 |

The builder's `whole()` rule also applies: a day begun is a day eaten. Its output is copied to
`SP/dirs/px-open-cost/t/march_c_table.txt`.

---

## 1. What the game does today (the parts C touches)

| concern | where | what it does now |
|---|---|---|
| Travel rules | `engine/rules.ts:489-504` (types `:171-206`) | The rules are set per hop: `foodPerHop: 1`, `daysPerHop: 1`, `starvationDamage: 3`, `cooldownDays: 3`, `cooldownFloor: 0.25` and `noRollInto: ['TOWN','BOSS']`. Danger and the end are set in hops: `tierByDistance` is `maxHops` 2 for tier 1, 5 for tier 2 and infinity for tier 3, and `bossNodeMinHops: 7`. |
| Scout depth | `engine/rules.ts:213-214`, `:510` | `scoutDepth: 3`, documented as "BFS EDGE depth". |
| Starting food | `engine/rules.ts:461` | `food_rations ×2`, commented "2 × 4 charges = 8 hops". |
| The graph | `engine/run/overworld.ts:37-39, 73-83` | `edgeOf` and `adjacency` are undirected, over visible nodes. |
| The path | `engine/run/overworld.ts:86-108` | `findPath` is a BFS from `run.nodeId` that returns node ids. |
| The preview | `engine/run/overworld.ts:111-118` | `previewPath` returns `{hops, food = hops × foodPerHop, starvationHp}`. |
| Pauses | `engine/run/overworld.ts:121-125` | `isDecisionNode` pauses the walk at the node types in `decisionNodeTypes`, at any unvisited node and at the destination. |
| Keys | `engine/run/overworld.ts:49-52, 57-59` | `edgeKey` is `a\|b` and `edgeDirPassKey` is `from->to#pass`. |
| Starting a trip | `engine/run/travel.ts:39-48` | `startTravel` refuses with "no road leads to …" (`:41`). A path of length 0 opens the quick menu (`:44-46`). |
| A hop begins | `engine/run/travel.ts:68-112` | `beginHop` charges food or starvation (`:78-85`), adds `daysPerHop` (`:86`), emits `hopStarted{westward}` (`:90`), and either consumes a Scout roll keyed by direction or calls `rollHop` (`:93-105`). An encounter suspends the hop (`:108-111`). |
| A hop lands | `engine/run/travel.ts:114-145` | `landHop` bumps `edgeTraversals[edgeKey]` (`:130`), marks the node visited, opens a DISCOVERY event on the first arrival (`:136-142`), and pauses at decision nodes (`:125`). |
| A road fight | `engine/run/travel.ts:156-169` | Its origin is `{kind:'travel', from, to}` and its enemy level is `enemyLevelFor(areaTier(at), at)` where `at = hop.to` (`:163-166`). |
| The roll | `engine/run/encounters.ts:50-70` | There is no roll into a TOWN or the BOSS (`:57-58`). The table comes from the edge (`:61`) and the region from the table (`:64`). The chance is `rollChanceFor` (`:19-26`): the edge override, else `region.encounterChancePerHop`, times a per-road cooldown. The labels are `hop:` and `encounter:<sheet>:<from>-><to>#<pass>` (`engine/rules.ts:621-623`). |
| Tier | `engine/run/difficulty.ts:10-14` | `areaTier` reads the node's authored `areaTier`. |
| A fight's tier, salt, field and label | `engine/run/battle.ts:28, 54, 66, 89-95` | All four read `origin.to`, a node id. |
| Distances and the gate | `engine/content.ts:37-57`, `:121-136` | `nodeDistances` is a BFS in hops. `createEnv` throws when the BOSS is under `bossNodeMinHops` away, or when a node's `areaTier` does not match the tier its hop distance gives. |
| Content version | `engine/content.ts:28-30` | The content version is a hash of the whole registry, so any edit to `world.json` changes it. |
| The schema | `content/schemas/overworld.ts:20-86` | A node has `position` (non-negative integers, `:30`) and `areaTier` (`:28`). An edge has `from`, `to`, `encounterTableId` and an optional `rollChance` (`:56-66`). A sheet has `width`, `height`, `nodes` and `edges`, and nothing describes the ground. |
| The region | `content/schemas/region.ts:12` | `encounterChancePerHop`. |
| Scout | `engine/run/scout.ts:26-49, 73-76` | `scoutableEdges` takes the edges within BFS depth 3 and pre-rolls each one under `from->to#pass`. |
| Run state | `engine/types.ts:593-607`, `:712-716`, `:573`, `:157-158` | `PendingTravel` is `{path: NodeId[], hopsTotal, status, hop{from,to,pass,encounter,resolved}}`. The run also holds `edgeTraversals`, `scoutedEdges` and `stats.hops`. `Content.nodeDistance` is the hop BFS. |
| Save | `engine/save/schema.ts:267-283, 436-437, 252, 159` | The save mirrors those shapes strictly. `SAVE_VERSION = '1.1.0'` (`engine/rules.ts:391`). A version mismatch is refused (`engine/save/codec.ts:100-101`) and pre-alpha policy wipes the save (`engine/rules.ts:317-318`). |
| Actions | `engine/actions.ts:91-106` | `travel/goTo{nodeId}`, `travel/step` (the pump), `travel/continue`, `travel/stay` and `travel/challengeBoss`. |
| Legality | `engine/flow/legality.ts:124-138` | — |
| Reducer | `engine/run/reducer.ts:131-143` | — |
| The map screen | `ui/overworld/OverworldScreen.tsx` | Hovering a node draws the BFS path and quotes "N hops · N food" (`:364-373`, `:524-528`). A click on a node dispatches `goTo` and shows "no road leads there" when there is no path (`:441-452`). The pawn transitions from node to node (`:520`, `HOP_DELAY_MS` 700 at `ui/timings.ts:11`). The camera follows a node (`:131-134`). Roads carry the planned and hover state and the scout marks (`ui/overworld/Roads.tsx:1-11`). |
| Headless CLI | `scripts/cli.ts` | Lists the roads out with `adjacency` and `previewPath` (`:710-719`) and goes by road number (`:866-868`). Walks the two gate routes node to node (`:1616-1634`, `:1755`). |
| Content lint | `content/lint.ts:291-315` | Checks that every visible place can be reached from the start over the edges. |
| Balance gates | `engine/rules.ts:346-363` | The `attrition.roadClearRate` and `maxStarvingSteps` bands are measured over a multi-hop road leg. |

---

## 2. The smallest design

### 2.1 The rule

All of this is taken from `march.py`.

- **A day's march carries:**
  - 210 stage px on a road;
  - 140 px in open country;
  - 70 px in forest.
- **Water** cannot be crossed except where a road crosses it: the mill bridge and the two fords. Broken Bridge's
  span is gone, so its two roads end at the stumps.
- **Food:** 1 food per day. A day begun is a day eaten.
- **Starvation:** a day at 0 food costs 3 HP per unit, as today.
- **Places are where you stop:**
  - A day ends after one full day of march.
  - It also ends early at the first place on the route that would pause today (`isDecisionNode`), or at the
    destination.
  - A cleared TRAIL that the route passes through chains silently, as today (`engine/rules.ts:198`).
- **Tier is set by whole days of march from Frontier Camp, by the quickest way.** The bands do not change, but they
  are read in days: 2 days or fewer is tier 1, 5 or fewer is tier 2, and beyond that is tier 3. The BOSS must be at
  least 7 days out.
- **Encounters:** one roll per day of march. It uses the region's chance, unchanged (Borderlands 0.40, Thornwood
  0.55, Ashfall 0.70), and is read off the country the company camps in that night. A day that ends at a TOWN or at
  the BOSS does not roll (`noRollInto`, unchanged).

### 2.2 Where the terrain comes from

Add one optional block to the sheet. The polygons are coarse, so the game does not depend on the art's 4 px mask.

```jsonc
// content/data/overworld/world.json (new top-level key; positions are B's stage frame shifted to be ≥ 0)
"terrain": {
  "cell": 16,                                  // engine grid, sheet px
  "base": "open",                              // ground where no area says otherwise
  "areas": [                                   // painted in order; later areas win
    { "ground": "forest", "points": [[x, y], ...] }          // Thornwood's pines, the copses
  ],
  "rivers": [ { "points": [[x, y], ...], "halfWidth": 11 } ],
  "crossings": [                               // the only places water can be crossed, each on a named road
    { "road": ["old_mill_crossing", "riverside_market"], "at": [x, y], "kind": "bridge" },
    { "road": ["south_junction", "smugglers_cave"],     "at": [x, y], "kind": "ford" }
  ]
}
```

Each edge gains an optional `via: [[x, y], ...]`. It is the road's own polyline, so the road in the engine and the
road in the art are the same line. B's `road_paths()` already produces them.

- **Schema.** In `content/schemas/overworld.ts`:
  - add a `GroundSchema = z.enum(['open', 'forest'])`;
  - add a `TerrainSchema`;
  - add `terrain: TerrainSchema.optional()` to `OverworldSheetSchema` (`:68-78`);
  - add `via` to `OverworldEdgeSchema` (`:56-64`).

  When `terrain` is absent, the whole `width × height` is open ground. The fixture worlds the tests build
  (`tests/helpers/overworld.ts`, `tests/unit/engine/run/difficulty.test.ts`) then still parse, and they march
  across open ground.
- **Region.** In `content/schemas/region.ts:12`, `encounterChancePerHop` becomes `encounterChancePerDay`, with the
  same values.
- **Which encounter table.** A day's table is the region's single table. Each table already names its region, for
  example `content/data/encounters/borderlands_road.json:3`. The lint adds a check that each region has exactly one
  table. `edge.encounterTableId` is still parsed but is no longer read for travel, and `edge.rollChance` is unused:
  no edge sets it today, as measured over `world.json`.
- **What the content needs that B does not supply.**
  - B draws ground only inside the 1280×720 view (`world_b.terrain_at` returns `'off'` beyond it). `march.py` fills
    the rest with the region of the nearest wild place. The game needs real polygons for the whole country, roughly
    2,800 × 2,000 px.
  - B's positions have to move into `world.json`, shifted so that none is negative.
  - The `areaTier` of 7 places has to be re-authored (section 3).

### 2.3 The grid and the pathing: new `engine/run/march.ts`

```ts
export type CellId = number                       // row * cols + col
export interface MarchGrid {
  readonly cols: number; readonly rows: number; readonly cell: number
  readonly cost: readonly number[]                // per cell, integer units to cross it; 0 = impassable
  readonly placeCell: Readonly<Record<NodeId, CellId>>   // a place on the water snaps to its nearest bank cell
  readonly cellPlace: Readonly<Record<CellId, NodeId>>
  readonly near: readonly number[]                // per cell: index into placeIds of the nearest non-hidden place
  readonly placeIds: readonly NodeId[]
}
export const DAY = 840                            // units per day; 840·16/210 = 64 road, /140 = 96 open, /70 = 192 forest
export function buildGrid(sheet: OverworldSheet, r: Rules): MarchGrid                 // called from buildContent
export function marchField(env: EngineEnv, from: CellId): { readonly cost: Int32Array; readonly parent: Int32Array }
export function routeTo(env: EngineEnv, from: CellId, to: CellId): readonly CellId[] | null   // excludes `from`
export function planDays(run: RunState, route: readonly CellId[], env: EngineEnv): readonly DayPlan[]
export interface DayPlan { readonly steps: number; readonly endCell: CellId; readonly stop: NodeId | null; readonly near: NodeId
                           readonly ground: { readonly road: number; readonly open: number; readonly forest: number } }
export function forecast(run: RunState, dest: NodeId, env: EngineEnv):
  { readonly days: number; readonly food: number; readonly starvationHp: number; readonly ground: DayPlan['ground']; readonly route: readonly CellId[] } | null
export function nearOf(cell: CellId, env: EngineEnv): NodeId
export function cellAt(x: number, y: number, env: EngineEnv): CellId | null
export function pointOf(cell: CellId, env: EngineEnv): { readonly x: number; readonly y: number }
```

- **Rasterising.** `buildGrid` paints `base`, then the `areas`, then the `rivers` (water costs 0), then every
  road's `via` (or a straight line) as road cells. A road cell over water stays water unless one of the declared
  `crossings` lies on it. That is the whole "bridges and fords only" rule.
  - It runs once from `buildContent` (`engine/content.ts:59-65`).
  - Its result sits beside `nodeDistance` on `Content` (`engine/types.ts:157-158`).
  - It uses plain arrays, not frozen typed arrays.
  - A `WeakMap` keyed on the registry object stops the many `createEnv` calls in the tests from rasterising again.
- **Dijkstra.**
  - It is 8-connected with integer costs. Each step costs the average of the two cells; a diagonal step costs
    ×1.414 and is rounded.
  - A diagonal may not pass between two water cells, so a river cannot leak through.
  - The heap is ordered by (cost, cellId) and the neighbours are visited in a fixed order. The same route and the
    same day breaks then come out on every machine, which replay and the determinism tests require.
- **Memoising.** `marchField` is memoised per (env, from-cell), so hovering only walks back along the parents.
  - The grid is 21,700 cells at 16 px over B's country: 175 × 124, measured.
  - A Python Dijkstra over 10,292 cells took 0.19 s here. In TypeScript with a typed-array heap I expect a few
    milliseconds. That is an estimate, not a measurement.
- **Hidden places.** A hidden place, such as Daren's Camp, is ordinary ground until `spawnedNodes` reveals it. Then
  it becomes a stop. The `near` index skips hidden places, so the label of a road fight never gives a secret name
  away.

### 2.4 Travel by the day: `engine/run/travel.ts`

`PendingTravel` (`engine/types.ts:593-607`) becomes:

```ts
export interface PendingTravel {
  readonly dest: NodeId
  readonly atCell: CellId                 // where the company slept last (a place's cell when standing at one)
  readonly route: readonly CellId[]       // cells still to walk, next first
  readonly daysTotal: number              // the forecast at departure (the walking pill: "N days to go")
  readonly status: 'walking' | 'suspended' | 'atNode'
  readonly day: {
    readonly fromCell: CellId; readonly toCell: CellId; readonly steps: number
    readonly near: NodeId; readonly stop: NodeId | null
    readonly pass: number; readonly encounter: EncounterRoll | null; readonly resolved: boolean
  } | null
}
```

`run.nodeId` keeps its meaning: the last place the company stood at. It only changes at a stop, and the quick menu
only opens at a stop, so every node-keyed action stays correct without edits:

- town, camp, dungeon and boss (`engine/flow/legality.ts:99`);
- `townOf` and `dungeonOf` (`engine/run/overworld.ts:134-144`).

- **`startTravel`** (`:39-48`):
  - It finds the route with `routeTo(atCell ?? placeCell[nodeId], placeCell[dest])` instead of `findPath`.
  - When there is no route, it refuses with "there is no way across to …".
  - When the route is empty, it opens the quick menu as today.
- **`beginDay`** (replaces `beginHop`, `:68-112`):
  1. Take `planDays(...)[0]`.
  2. Charge food per day, or starvation (the code at `:78-85` is unchanged, with `foodPerDay`).
  3. Add 1 to `daysElapsed`, and 1 to `stats.daysMarched`.
  4. Emit `dayStarted{from, to, westward, daysLeft}`.
  5. Roll:
     - If `stop` is a TOWN or the BOSS, there is no roll.
     - Otherwise, if `${near}#${pass}` is in `scoutedCountry`, take that roll, delete it and check it is still valid
       (`stillValid`, `:60-66`, unchanged).
     - Otherwise call `rollDay(run, near, pass)`.
  6. An encounter suspends the day exactly as a hop suspends now.
- **`landDay`** (replaces `landHop`, `:114-145`):
  1. Set `atCell = toCell` and drop `steps` cells from the route.
  2. Bump `countryTraversals[near]` (this replaces `edgeTraversals[edgeKey]`, `:130`).
  3. If `stop !== null`, run today's node logic on it as it stands: set `nodeId = stop`, mark it visited, open the
     DISCOVERY event on the first arrival, and pause by `isDecisionNode`.
  4. When the route is empty, emit `journeyEnded`.
- **Unchanged:** `openEncounter`, `resumeTravel`, `continueTravel`, `stayHere`, `throneWarning` and `challengeBoss`
  (`:149-230`). The `battle` case changes only in that `hop` becomes `day` and `hop.to` becomes `day.near`
  (`:157-166`).
- **No stops in the open.** The company can never be parked on bare ground: a day that ends in the open goes
  straight to the next day. It can still be suspended there by an encounter or a save. `atCell` and `route` carry
  that across a reload.

### 2.5 Encounters without hops: `engine/run/encounters.ts`

The country the company camps in each night "belongs to" its nearest place (`near`). That one decision lets the
whole existing machinery stay, keyed by a place instead of a road:

- **`rollDay(run, near, pass)`** replaces `rollHop` and `rollHopWith` (`:50-70`):
  - the table is the table of `near`'s region;
  - the chance is `region.encounterChancePerDay × cooldown(countryTraversals[near])`, with the cooldown formula at
    `:19-26` unchanged;
  - the labels are `day:<sheet>:<near>#<pass>` and `dayEncounter:<sheet>:<near>#<pass>`, added beside `hop` and
    `encounter` in `engine/rules.ts:621-623`.
- **`rollEncounter`** (`:29-45`) is unchanged.
- **Cooldown** still means "this stretch of country was swept recently".
- **Re-rolls.** A different route that camps near the same place on the same pass meets the same roll, so changing
  the route does not re-roll the dice.

### 2.6 Tier without hops: `engine/content.ts`

- **Distances.** `nodeDistances` (`:37-57`) becomes `dayDistances`: a single `marchField` from the start cell,
  giving `whole(cost / DAY)` for each place.
  - Hidden places now have a distance too, because the ground is open to everyone, so the gate can check them as
    well.
  - `Content.nodeDistance` becomes `Content.dayDistance`.
- **`tierForDistance`** (`:68-73`) becomes `tierForDays`, using the same bands under the key `maxDays`.
- **`createEnv`** (`:121-136`) keeps both gates, now read in days:
  - the BOSS must be at least `bossNodeMinDays` (7) days out;
  - each place's `areaTier` must match `tierForDays`.
- **`run/difficulty.ts`** is unchanged. It still reads the authored `areaTier`, and the gate keeps that honest.

### 2.7 Fights on the march: no change

The origin of a fight on the march is still `{ kind: 'travel', from: run.nodeId, to: day.near, encounterId }`. These
read `origin.to` and so work unchanged:

- the day-salted label (`engine/run/battle.ts:28`, unique because the day only rises);
- the tier (`:54`);
- the enemy-level salt (`:66`);
- the battlefield, from the place's own board or its region's list (`:89-95`);
- `clearedEncounters` on a win (`:234-235`).

The origin's save schema (`engine/save/schema.ts:159`) is also unchanged. `engine/run/questEffects.ts:42-45` swaps
`hop.from`/`hop.to` for `nodeId` and `day.near`.

### 2.8 Scout: `engine/run/scout.ts`

- `scoutableEdges` (`:26-49`) becomes `scoutableCountry`: each place within `scoutDepthDays` (3) days of `atCell`
  by the memoised field. They are taken in order of days, then content order, with one pre-roll each under
  `${place}#${pass}`.
- The threading of one-shots (`:8-11`) is unchanged.
- The sightings (`:57-71`) keep their words. On the map they move from the middle of a road to the place.
- `engine/rules.ts:213-214` `scoutDepth` (edges) becomes `scoutDepthDays`.

### 2.9 Destinations: places now (C1), bare ground later (C2)

**C1 is the smallest design.**

- Every march order names a place, and the route between places runs across any ground. That matches C's own line,
  "places are where you stop", and the C board's moment: pointed at a destination reached partly off the road.
- `travel/goTo{nodeId}` is unchanged (`engine/actions.ts:96`), and so are its legality (`engine/flow/legality.ts:124-129`)
  and the reducer (`engine/run/reducer.ts:131-135`).

**C2, halting on bare ground, is a separate step of about 2 days.**

- It adds a new action, `travel/marchTo{x, y}`, and a persisted `run.at: CellId | null`. Non-null means the company
  stands in the open.
- When `run.at` is set:
  - a guard in `menuFor` (`engine/flow/legality.ts:99`) refuses every place action;
  - the quick menu offers only "March on";
  - the save, the invariants (`engine/flow/invariants.ts`) and the camera all learn the open position.
- It is only worth doing once there is something to do in the open, such as making camp. Today Rest and Scout
  belong to CAMP places.

### 2.10 The overworld screen: `ui/overworld/`

- **Input.**
  - A click on a place is unchanged (`OverworldScreen.tsx:441-452`). Only the refusal text changes, from "no road
    leads there" to "there is no way across".
  - Hovering bare ground is new. The pointer's sheet point (camera plus pointer ÷ scale, which the drag code at
    `:417-425` already works out) goes to `cellAt` and then to `routeTo`. It draws a faint route and its day count.
  - In C1 a click on bare ground does nothing. In C2 it is the march order.
  - Drag-to-pan is unchanged (`:413-433`).
- **Route layer.** A new `ui/overworld/Route.tsx` draws the cell route as a smoothed polyline, with a small mark at
  each night's camp. It replaces the road over-strokes for hover, planned and active
  (`OverworldScreen.tsx:364-373, 398-406`, `Roads.tsx` plannedKeys/hoverKeys/activeKey). The plain roads stay drawn,
  because they are still the quick way.
- **Forecast.** `forecast()` replaces `previewPath` in the tip (`:524-528`). The tip reads "3 days · 3 food", then
  the ground: "1 day on the road, 2 through Thornwood", built from `DayPlan.ground` and the region name. The starving
  line stays as it is, and so do the scouts' lines on the route.
- **Walking.**
  - Each day the pawn walks the polyline of that day's cells, one `HOP_DELAY_MS` per day, instead of a CSS move
    from node to node (`:520`).
  - The camera follows the pawn's point, not a node (`cameraFor`, `:131-134`).
  - The walking pill counts days.
- **Scout marks** move from the roads to the places (`Roads.tsx`, `ScoutMark`).

### 2.11 Headless CLI and lint

- **`scripts/cli.ts`.**
  - The "roads out" listing (`:710-719`) becomes the places within 3 days, by days, each with its forecast.
    "go `<n>`" (`:866-868`) indexes that list.
  - The two balance routes (`:1616-1634`, `:1755`) still visit places in turn, but now cross country between them.
- **`content/lint.ts:291-315`.** Reachability over the edges becomes reachability over the grid. Three checks are
  added:
  - every crossing lies on its named road and over water;
  - every road that meets water does so at a crossing, or ends at the bank (Broken Bridge);
  - no place is shut off from the start.
- **One source of truth.** The art script and the game must use one grid, so the CLI gains a `march-table`
  printout and the board numbers are read from it (risk 1).

### 2.12 Save format

- **Version.** `SAVE_VERSION` goes from 1.1.0 to 2.0.0 (`engine/rules.ts:391`). There is no migration: a mismatch is
  refused (`engine/save/codec.ts:100-101`) and wiped (`engine/rules.ts:318`). The new `world.json` changes
  `contentVersion` anyway (`engine/content.ts:28-30`).
- **`engine/save/schema.ts`.**
  - `pendingTravelObject` (`:267-283`) takes the new shape.
  - `edgeTraversals` becomes `countryTraversals` and `scoutedEdges` becomes `scoutedCountry` (`:436-437`). Both are
    still records.
  - `runStats.hops` becomes `daysMarched` (`:252`).
- **Defaults.** `engine/run/newRun.ts:58-59, 67` seeds the new empty records.
- **Size.** A route in flight is at most about 150 cell ids at 16 px. That is under 1 KB, against the 50 KB
  `maxBytes` (`engine/rules.ts:588`).

### 2.13 Rules diff (`engine/rules.ts`)

| today | C |
|---|---|
| `foodPerHop: 1` | `foodPerDay: 1` |
| `daysPerHop: 1` | (gone; one step is one day) |
| — | `dayPx: { road: 210, open: 140, forest: 70 }` |
| — | `marchCell: 16` |
| `tierByDistance[].maxHops` | `tierByDays[].maxDays` (2 / 5 / infinity) |
| `bossNodeMinHops: 7` | `bossNodeMinDays: 7` |
| `camp.scoutDepth: 3` (edges) | `camp.scoutDepthDays: 3` |
| `region.encounterChancePerHop` | `region.encounterChancePerDay` (same values) |
| `rngLabels.hop/encounter` | adds `day/dayEncounter` |
| comment "8 hops" (`:461`) | "8 days" |

Unchanged: `starvationDamage`, `lowFoodWarnAt`, `cooldownDays`, `cooldownFloor`, `noRollInto` and
`decisionNodeTypes`.

---

## 3. Measured on B's country

These are the C builder's rules (4 px art grid, roads as exact polylines). The full table is in
`SP/dirs/px-open-cost/t/march_c_table.txt`.

- **The Iron Throne:**
  - 9 hops in B;
  - 10.72 days by road alone, which is **11 days eaten**;
  - 8.48 days by the quickest march, which is **9 days eaten**;
  - the BOSS gate of 7 days passes.
- **The biggest shortcuts:**

  | place | by road | marching |
  |---|---|---|
  | Scorched Village | 6.98 | 3.32 |
  | Warlord's Camp | 9.44 | 5.91 |
  | Sulfur Springs | 8.38 | 4.69 |
  | Ruined Chapel | 5.54 | 3.54 |

  In B's country, going off the road pays where the roads take long detours, mostly toward Ashfall. Near the camp
  it saves nothing.
- **Places whose tier changes from B** (whole days, tier B → C). These are the `areaTier` edits the gate would force
  in `world.json`:

  | place | days | tier |
  |---|---|---|
  | Sulfur Springs | 5 | 3 → 2 |
  | Foggy Marsh | 6 | 2 → 3 |
  | Lava Fields | 6 | 2 → 3 |
  | Ember Creek | 6 | 2 → 3 |
  | Ashfall Outpost | 6 | 2 → 3 |
  | Ancient Ruins | 6 | 2 → 3 |
  | Morgana's Grove | 7 | 2 → 3 |
- **Engine grid against the art grid.**
  - I re-ran the builder's model at engine resolution, using its earlier cells-only version.
  - At 16 px cells it differs from 4 px by up to 0.43 days. The worst case is Thornwood Depths. Six places changed
    whole days, and two of those changed tier (Hermit's Tower, Foggy Marsh).
  - At 20 px the difference is up to 0.85 days.
  - Recommendation: 16 px cells, with the game's numbers as the only source (risk 1).
- **The cheaper shape (section 5).** I measured over B's country with every road hop kept at 1 day, open country
  taking 160 or 200 px a day and forest 100 or 130:
  - at the lower speeds, only 12 overland legs ever beat the roads, and the throne comes to 8 days;
  - at the higher speeds, 43 legs beat the roads and the throne comes to 7 days.

  The scripts are `SP/dirs/px-open-cost/measure_c*.py`.

## 4. Tests that change

**Unit tests to rewrite:**

- `tests/unit/engine/run/travel.test.ts` (186 lines). It needs cases for:
  - food and day each day;
  - starving each day;
  - stopping at an unvisited place mid-route;
  - suspending and resuming on day 2 of 3;
  - a discovery on the first arrival;
  - no roll on arriving at a town.
- `tests/unit/engine/run/overworld.test.ts` (81 lines): the BFS tests go to a new `march.test.ts`. It covers:
  - the raster;
  - that a crossing is the only way over water;
  - that no diagonal leaks through the river;
  - golden routes for determinism;
  - the day breaks.
- `tests/unit/engine/run/encounters.test.ts` (90 lines): `rollDay` and the cooldown per place.
- `tests/unit/engine/run/scout.test.ts` (144 lines).

**Fixtures and shapes to update:**

- `tests/helpers/saves.ts`
- `tests/helpers/overworld.ts`
- `tests/unit/engine/run/fixtures.dungeon.ts`
- `tests/unit/engine/run/narrativeFixture.ts`
- `tests/unit/engine/save/strict.test.ts`
- `tests/unit/engine/save/roundTrip.test.ts`
- `tests/unit/engine/run/questEffects.test.ts`
- `tests/unit/engine/run/economy.test.ts`
- `tests/unit/engine/flow/pump.test.ts`

**Expectations to update:**

- `tests/unit/content/content.test.ts`: the gate in days.
- `tests/unit/engine/run/difficulty.test.ts`: the fixture world.
- `tests/unit/cli/render.test.ts`, `narration.test.ts`, `play.test.ts`: "hops" becomes days, and the roads listing
  changes.
- `tests/unit/scenarios/journey.scenario.test.ts`
- `tests/unit/engine/flow/legality.test.ts`, `lifecycle.test.ts`, `runtime.test.ts`: `goTo` is unchanged, but the
  step counts move.

**Re-measured, not just edited:**

- `tests/unit/balance/attrition.test.ts`, `carefulPolicy.test.ts`, `sweep.test.ts`. These are the
  `roadClearRate`, `lowWaterHpFraction` and `maxStarvingSteps` bands (`engine/rules.ts:346-363`).

**End-to-end (e2e):**

- `tests/e2e/overworld.spec.ts` (489 lines):
  - "N hops to go" at `:88-100`;
  - the preview text;
  - the scout marks;
  - the pawn.
- `tests/e2e/journey.spec.ts`, `pause.spec.ts`, `save.spec.ts`.

## 5. A cheaper shape, and why it falls short

- **What it is.** Keep the graph, and add generated "overland legs" between places as edges with `days` and a `via`
  polyline. An offline script computes them from the terrain. The engine never sees a grid.
  - `findPath` and `nodeDistances` become Dijkstra by days.
  - A hop rolls once per day of its leg.
  - The save shape barely moves.
- **What it costs.** About half of C1, so roughly a week.
- **What it gives up:**
  - **It rounds at every stop.** Every leg is a whole number of days, so going off the road only pays when it saves a
    full day. The section 3 measurement shows only 12 to 43 of about 1,000 possible place pairs ever beat the roads.
  - **It cannot answer "any point".** C2 becomes impossible without rebuilding it as C1.
  - **It needs regenerating.** Every moved place means running the generator again and reviewing a diff of hundreds of
    edges.

  It makes a good stopgap if the owner wants the feel of C before paying for it. It is not variant C.

## 6. Risks and owner calls

1. **The board and the game can disagree.** The art's 4 px model and a 16 px engine grid drift by up to 0.43 days, and
   that flipped 2 tiers in the measurement. The fix is for the art to read the game's numbers through the CLI, never
   compute its own.
2. **Balance shifts.**
   - The road to the throne grows from 9 hops to 11 days at 210 px a day, while the quickest march is 9.
   - The company starts with 8 days of food (`engine/rules.ts:461`).
   - The attrition bands were tuned with the hop economy, and with town roads not rolling (`engine/rules.ts:188-196`
     says a re-tune is an owner call). They have to be re-run, and they may need new numbers.
3. **The whole country must be authored.** B only drew ground inside the view, so the content needs terrain for the
   whole country. That work is shared with B's world.json move, but the polygons are C's alone.
4. **Thornwood is all forest beyond the view** in the builder's fill. At 70 px a day that makes Thornwood a slog. That
   may be right, but the owner should see it.
5. **C2 is deliberately left out of the smallest design.** If the owner reads "march to any point" as "halt anywhere",
   add the 2 days in section 2.9.

## 7. Estimate, in plain words

The design is C1: march to any place across any ground, stopping only at places. It is roughly two working weeks for
one person:

| work | time |
|---|---|
| The grid, the pathing and the content gate | 2 days |
| The day-by-day walk, encounters, Scout and the fight origin | 2 days |
| The save format and the fixtures | half a day |
| The map screen: hover and route, the forecast tip, the pawn walking a line, the scout marks | 2 days |
| The CLI and the lint | 1 day |
| Rewriting and updating about 25 test files, including the e2e map spec | 2 days |
| Authoring the country's terrain and re-tiering 7 places in world.json | 1 day |
| Re-running the balance gates | 1 day, plus whatever retuning the owner decides on |

With agents working in parallel on the engine, the screen and the tests, it is 3 to 4 calendar days. Halting on bare
ground (C2) adds about 2 more days. Variant B by comparison is about a day of content and no engine work, and A is
less.
