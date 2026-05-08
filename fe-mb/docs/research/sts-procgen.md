# Research #1: Slay the Spire Map Procgen Rules

**Status:** `[STUB — to be filled before real `dungeonGenerator.ts` lands]`
**Deliverable target:** 1–2 pages of concrete rules that the TS dungeon generator must enforce.
**Blocks:** real (non-stub) `procgen/dungeonGenerator.ts`. Foundation milestone ships a 3-row linear corridor stub; this research unblocks the actual StS-style generator.

---

## Required Outputs

When this stub is filled, it must answer:

1. **Row count** — how many rows does an act have? (StS Act 1: 15 rows + boss.)
2. **Path-count invariant** — minimum number of distinct paths from row 0 to boss row? (StS guarantees ~6.)
3. **Row-skipping rule** — does every edge advance exactly one row? (StS: yes.)
4. **Forced placements** — which room types MUST appear at which rows?
   - Treasure: which row? (StS: row 8 of 15.)
   - Rest: which rows allowed?
   - Shop: how many per act?
   - Elite: earliest row?
5. **Room-type weight tables** by row (e.g., row 0–3: 100% combat; row 4–7: 70% combat / 20% event / 10% elite).
6. **Convergence rule** — do all paths converge to a single boss room? (StS: yes.)
7. **Reveal model** — does the player see the entire map upfront, lookahead-1 row, or reveal-on-enter? (Decision affects `DungeonGraph.fogOfWar` field. **OQ-1 in `phaser/CONTEXT.md`.**)
8. **Seed determinism** — confirms `(runSeed, dungeonId)` always produces identical map. Affects `DungeonGraph.genSeed` field.
9. **Edge case handling** — orphan rooms, dead-ends, single-path runs (StS: prevented by validator pass).

## Sources to Consult

- Slay the Spire wiki: <https://slay-the-spire.fandom.com/wiki/Map>
- Mega Crit's Reddit posts on map generation (search "slay the spire map generation reddit")
- Open-source StS clones with documented procgen (e.g., Inkbound, Across the Obelisk)
- The `MapGenerator.java` source if available via decompile/educational reading
- Marvin's Marvelous Mapping Modder mod (modifies StS map gen — useful constraints view)

## How To Fill This

Spawn a subagent with `general-purpose` agent, brief: "Read the listed sources, summarize the rules into this template. 1–2 pages. Concrete, not hand-wavy. Output as committed file replacing this stub."
