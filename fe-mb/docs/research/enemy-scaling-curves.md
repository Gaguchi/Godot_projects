# Research #5: Enemy Scaling Curves

**Status:** `[STUB — to be filled in Week 6 of foundation milestone]`
**Deliverable target:** 1 page comparing scaling approaches + recommended FE_MB curve.
**Blocks:** Difficulty tuning (post-foundation milestone).

---

## Required Outputs

When this stub is filled, it must answer:

1. **StS damage scaling.** How does Slay the Spire scale enemy HP/damage by floor? Per-act multipliers? Specific formulas?
2. **FE-style scaling.** How do Fire Emblem games scale enemies by chapter? Stat bumps per chapter? Class promotion timing?
3. **FTL scaling.** How does FTL scale by sector — flat tiers or continuous?
4. **Current Godot model.** Read enemy generation logic: `autoload/event_manager.gd` `generate_enemies()`, `data/events/enemy_groups.json`, and any scaling code in `battlefield.gd`. Document:
   - Are enemy stats hardcoded per group?
   - Or scaled by `level` parameter?
   - What's the level → stats formula? (MEMORY.md mentions "5 + floor(level/2)" was the revised weapon might.)
5. **FE_MB recommended curve.** Given the 03-29 ship plan's regional structure (Borderlands → Thornwood/Ashfall → Iron Throne):
   - Level ranges per region (e.g., Borderlands lvl 1–2, Thornwood lvl 3–4, Ashfall lvl 5–6, dungeon boss lvl 7+)
   - HP curve per level (linear / quadratic / table-driven)
   - Damage curve per level
   - Loot rarity curve (already in 03-29 ship plan §11; reconcile)
6. **JSON shape.** Recommend `data/curves/enemy_scaling.json` schema:
   ```json
   {
     "hpPerLevel": [...],
     "damagePerLevel": [...],
     "regionMultipliers": { "borderlands": 1.0, "thornwood": 1.2, ... }
   }
   ```

## Sources

- Slay the Spire wiki on enemy stats per act
- FE games: GameFAQs stat tables for Awakening / Three Houses
- Existing Godot: `autoload/event_manager.gd`, `data/events/enemy_groups.json`
- MEMORY.md notes on "Enemy weapon might scaling: `5 + floor(level/2)` (was `5 + level`, too aggressive)"

## How To Fill This

Compare 3 scaling models, propose FE_MB curve, output JSON mock. 1 page. Subagent.
