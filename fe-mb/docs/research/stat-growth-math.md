# Research #4: Stat Growth Math

**Status:** `[STUB — to be filled in Week 6 of foundation milestone]`
**Deliverable target:** 1 page documenting growth-rate logic + pure-function spec for TS port.
**Blocks:** Leveling system (post-foundation milestone).

---

## Required Outputs

When this stub is filled, it must answer:

1. **Current Godot growth math.** Read `scripts/resources/unit_data.gd` `growth_rates` field and the `level_up()` implementation (or equivalent). Document:
   - Are growth rates per-stat percentages (FE-classic 0–100% per stat)?
   - Roll model: per-stat random vs guaranteed-points-at-thresholds?
   - Caps per stat per class?
   - Variance: pure roll vs banking under-rolls (FE: each level fills a "growth bank" toward guaranteed point)?
2. **XP curve.** Where do units gain XP? (Battle victory? Per-kill?) What's the curve to the next level (linear, exponential, table-driven)?
3. **Class stat differences.** Each of the 9 classes has different baseline stats and growth rates. Document the Godot data.
4. **Proposed TS pure-function spec.** Functions like `levelUpUnit(unit: Unit, classDef: ClassDef, rng: RNG): Unit`. Pure, deterministic given the seed.
5. **Capture-then-recruit growth.** Captured enemies join with their level (per 03-29 ship plan). What growth rates do they use — class baseline, or carry their enemy stats? (Decision affects recruitment milestone.)

## Files to Read

- `scripts/resources/unit_data.gd`
- `scripts/resources/class_data.gd` (if exists)
- `data/classes/*.json` or wherever class growth rates live
- `scripts/combat/battlefield.gd` for XP-grant logic

## How To Fill This

Read Godot code, summarize math, propose TS function signature. 1 page. Spawn a subagent (`Explore` then synthesis).
