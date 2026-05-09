# Research #1: Slay the Spire Map Procgen Rules

**Status:** Complete (2026-05-09)
**Sources:** slaythespire.wiki.gg/wiki/Map_Generation, Steam guide #2830078257 (Map Generation in Slay the Spire), kosgames.com map generation guide, github.com/silverua/slay-the-spire-map-in-unity, github.com/wouwei/slaythespirepath, arxiv:2504.03918 (StS map oracle reference). See full URLs at bottom.

---

## Summary (the 9 questions)

1. **Row count.** 15 floors per act of map content + 1 boss floor (floor 16) = **15 + boss**. (The wiki's "17 floors" figure adds the post-boss Treasure Chest, which is not on the map graph.)
2. **Path-count invariant.** Exactly **6 path traversals** are drawn from row 1 to row 15. The first two paths must originate from **distinct** floor-1 nodes; the remaining four are unrestricted. After path generation, unvisited cells are pruned. Net result: 2–6 distinct floor-1 entry nodes (typically 3–4 after pruning duplicates).
3. **Row-skipping rule.** **Every edge advances exactly one row.** No skip-row connections. Paths must not cross (edges from `(x1,r) → (x2,r+1)` and `(x3,r) → (x4,r+1)` cannot intersect in the plane when `x1 < x3` and `x2 > x4`, or vice versa).
4. **Forced placements.**
   - **Floor 1:** all nodes are Monsters (drawn from the easy pool).
   - **Floor 9:** all nodes are Treasure.
   - **Floor 14:** Rest Sites are **forbidden** (so the player isn't forced into pre-boss rest).
   - **Floor 15:** all nodes are Rest Sites (guaranteed pre-boss heal).
   - **Floor 16 (boss):** single boss node; all floor-15 nodes connect to it.
   - **Elite & Rest forbidden below floor 6.** First Elite cannot appear before floor 6.
5. **Room-type weight table** (used for any non-forced floor; floors 2–8 exclude Elite/Rest):

   | Type     | Base weight |
   |----------|------------:|
   | Monster  | 53%         |
   | Unknown (Event) | 22%  |
   | Rest Site | 12%        |
   | Elite    | 8%          |
   | Merchant | 5%          |

   At Ascension 1+, Elite weight roughly doubles (~16%), Monster reduced (~45%); FE_MB does not need this initially.
6. **Convergence rule.** Yes — **all floor-15 nodes connect to the single boss node on floor 16.** The boss is added post-path-generation as a synthetic convergence point.
7. **Reveal model (closes OQ-1).** **Full reveal at dungeon entry.** The entire act's map is visible from the start; only room *contents* of Unknown nodes resolve on entry. This is StS canonical and is the recommended model for FE_MB. (Lookahead-1 was considered and rejected — it removes routing strategy, which is the core decision.)
8. **Seed determinism.** Maps are deterministic from a seed. StS uses a global run seed; same seed → identical map across platforms (modulo platform RNG quirks). For FE_MB, `(runSeed, dungeonId)` produces identical output via `deriveRng(runRng, 'dungeon:' + dungeonId)`.
9. **Edge cases / validator.** After random assignment, the validator re-rolls any node that violates these constraints:
   - **No two consecutive nodes on the same path may be Elite/Merchant/Rest.** (No Elite→Elite, no Shop→Rest, etc., among the three "special" types.)
   - **A node with ≥2 outgoing edges must have all destination rooms be of distinct types.** Prevents "two combats" forks that look identical.
   - **Rest sites cannot be on floor 14.**
   - **Elite & Rest cannot be on floors 2–5.**
   - Re-roll until all constraints satisfied (StS bounds attempts; falls through to relaxed weights if necessary).

## The Algorithm (StS Act 1, implementable form)

```
input:  rng (seeded), grid_width = 7, num_rows = 15, num_paths = 6
output: directed acyclic graph, nodes typed, single boss sink

# Phase 1: path tracing
nodes = empty set
edges = empty set
for i in 0..num_paths-1:
    if i == 0:
        x = rng.int(0, grid_width-1)
    elif i == 1:
        # second path must start at a different column from path 0
        x = rng.int_excluding(0, grid_width-1, [path0.startX])
    else:
        x = rng.int(0, grid_width-1)

    add node (x, row=1) to nodes
    prev = (x, 1)
    for r in 2..num_rows:
        # next column ∈ {x-1, x, x+1}, clamped, excluding choices that would
        # cross an existing edge from a sibling node on row (r-1)
        candidates = [x-1, x, x+1] ∩ [0, grid_width-1]
        candidates = filter_no_crossings(candidates, prev, edges)
        x_next = rng.choice(candidates)
        add node (x_next, r) to nodes
        add edge prev → (x_next, r) to edges
        prev = (x_next, r)

# Phase 2: prune unreached cells (anything not visited stays out of nodes)

# Phase 3: forced typing
for n in nodes where row == 1:  n.type = MONSTER (easy pool)
for n in nodes where row == 9:  n.type = TREASURE
for n in nodes where row == 15: n.type = REST

# Phase 4: weighted random typing for rows 2–8, 10–14
for n in nodes where n.type == None:
    forbidden = []
    if n.row < 6: forbidden += [ELITE, REST]
    if n.row == 14: forbidden += [REST]
    n.type = weighted_pick(WEIGHTS, exclude=forbidden, rng)

# Phase 5: validator pass
repeat:
    fixed_any = false
    for n in nodes where n.type ∈ {ELITE, MERCHANT, REST}:
        for predecessor p in n.in_edges:
            if p.type == n.type ∨ (p.type ∈ {ELITE,MERCHANT,REST} ∧ n.type ∈ {ELITE,MERCHANT,REST} ∧ p.type==n.type):
                n.type = reroll(WEIGHTS, exclude=...); fixed_any = true
    for n in nodes where len(n.out_edges) >= 2:
        if duplicate_types_among_destinations(n):
            reroll one of the duplicates; fixed_any = true
until !fixed_any (or attempts > 100, then accept)

# Phase 6: boss attachment
add boss node at row 16
for n in nodes where row == 15:
    add edge n → boss
```

`filter_no_crossings`: when prev_node is at column `x` on row `r-1` and considers moving to `x_next` on row `r`, reject `x_next = x+1` if a sibling node at `(x+1, r-1)` already has an edge to `(x, r)` (that edge would cross). Same for `x-1` direction.

## Recommended for FE_MB

- **Row count:** **15 + boss = 16 graph rows**. Foundation TS generator currently ships 3-row stub; expand to 15 once this lands.
- **Path count:** **6 traversals**, first two starts must differ. After pruning, expect 12–25 nodes total per dungeon.
- **Forced placements:**
  - Row 1 → all Combat (use FE_MB's "easy" enemy group pool).
  - Row 9 → all Treasure (item drop / weapon).
  - Row 14 → Rest forbidden.
  - Row 15 → all Rest (camp choice: Rest / Sharpen / Scout).
  - Row 16 → single Boss.
  - Elite/Rest forbidden on rows 2–5.
- **Weights for rows 2–8, 10–14** (drop Merchant — FE_MB shops are towns, not dungeons):

  | Type | Weight |
  |---|---:|
  | Combat | 60% |
  | Event | 25% |
  | Rest | 10% |
  | Elite | 5% |

  (Bumped Combat from StS 53% → 60% to compensate for removed Merchant slice; Elite reduced because FE_MB combats are longer/heavier than StS turns.)
- **Reveal model:** **Full reveal at dungeon entry** (closes OQ-1). `DungeonGraph.fogOfWar = "none"`. Player sees the whole graph; Event nodes still hide their *contents* until entered.
- **Edge cases:** validator pass with same constraints (no consecutive ELITE/REST, no duplicate destinations from one fork, no Rest on row 14, Elite/Rest ≥ row 6). Cap attempts at 100; on failure log a warning and accept.
- **Seed:** `dungeonRng = deriveRng(runRng, 'dungeon:' + dungeonId)`. Determinism is testable via golden-file fixtures.

## What deviates from canonical StS

1. **No Merchant nodes in dungeons.** FE_MB's economy is town-centric — shops live in towns. Merchant slice (5%) folded into Combat (53→60%).
2. **Smaller act length acceptable.** StS Act 1 = 15 rows × heavy card combats. FE_MB has heavier per-combat cost (longer turn cycle, fewer cards per dungeon run via equipment-card decks). Foundation should ship 15-row dungeons but `DungeonGraph` should treat row count as a parameter so smaller (8–10 row) themed regional dungeons are possible later without algorithm changes.
3. **Regional themes.** FE_MB plans regional flavor (forest / castle / cave). Theme affects enemy group pool and Treasure rarity table; map *structure* unchanged.
4. **Equipment-card decks instead of card rewards.** StS Combat nodes always drop a card-pick screen. FE_MB Combat nodes drop gold + chance of an equipment item; this does not change procgen but is worth noting so reward-balance research doesn't assume StS reward density.
5. **No Ascension layer.** FE_MB difficulty scaling is per-region/per-act, not a global escalation knob; we ship the base weight table only.

## Sources

- **Slay the Spire Wiki — Map Generation** (`slaythespire.wiki.gg/wiki/Map_Generation`): forced floors (1/9/15), 53/22/12/8/5 weight table, 17-row figure including post-boss chest.
- **Steam Community guide #2830078257 — "Map Generation in Slay the Spire"**: 7×15 grid, 6 path iterations, "first 2 starts differ" rule, no-crossing edges, validator constraints (no consecutive Elite/Merchant/Rest, no Rest on floor 14, Elite/Rest forbidden below floor 6, multi-out destinations distinct).
- **kosgames.com — Map Generation Guide**: corroborates 7×15 grid, 6-path generation, forced floor assignments, validator rules.
- **silverua/slay-the-spire-map-in-unity (GitHub)**: open-source Unity reference implementation, confirms the for-loop path generation and starting-nodes / pre-boss-nodes invariants.
- **wouwei/slaythespirepath (GitHub)**: progressive JS tutorial confirming "roads crossing each other a certain number of times" as the core mechanic.
- **arxiv:2504.03918 ("Analysis of Uncertainty in Procedural Maps in Slay the Spire")**: confirms a perfect map-replication oracle exists from seeds, supporting the determinism claim. Did not contribute algorithm details directly.

## Gaps documented

- The canonical Mega Crit GDC talk slides could not be located via WebFetch; numbers above triangulate from three independent community sources that all agree, so this is low-risk.
- The exact edge-crossing test is described in plain language ("paths cannot cross") in all sources; the pseudocode here uses the standard interpretation (no swapping adjacent columns between consecutive rows). If FE_MB's renderer ends up being orthogonal-grid rather than triangle-grid, this test reduces to "no two edges from row r to row r+1 swap their column ordering."
