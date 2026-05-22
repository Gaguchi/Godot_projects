# Recruitment Cost Formula — OQ-3

**Status:** Decided 2026-05-22
**Spec:** `docs/superpowers/specs/2026-03-29-ship-plan-design.md` (recruitment scope)
**Implementation:** `phaser/src/systems/recruitmentCost.ts`
**Open question closed:** CONTEXT.md §12 OQ-3

## Decision

```
cost = round( BASE_CLASS_COST[classId] × (1 + (level - 1) × 0.5) )
```

Per-class L1 baseline:

| Class  | Base | Rationale                                            |
|--------|------|------------------------------------------------------|
| bandit | 80   | Cheapest; low-stat melee filler                      |
| knight | 140  | Mid-tier tank, useful early but specializes          |
| mage   | 180  | Premium; one strong AoE/single-target carry          |
| lord   | 220  | Rare; story-tied class, slow-grow but high ceiling   |
| (default) | 120 | Future classes default until tuned                |

`costOverride` per recruit entry bypasses the formula entirely — used for
narrative-driven slots (e.g. quest reward "recruit at 0 gold").

## Why deterministic + per-class + linear-level (not roll-based)

**Considered alternatives:**

1. **Pure class-based flat cost.** Rejected: a L1 Knight feels priced
   identically to a L5 Knight, so taverns at Borderkeep Castle (the
   thornwood capital) couldn't naturally sell stronger recruits.
2. **Per-stat valuation** (`cost = Σ stats × multiplier`). Rejected:
   couples cost to growth-table drift; every stat tweak forces a price
   recompute across all towns.
3. **Multiplicative growth** (`base × 1.5^lvl`). Rejected: L5 knight
   would be 1063g, breaking 80g-starting-budget pacing.
4. **RNG-rolled prices per visit.** Rejected: the player should know
   what a recruit costs at decision time; rolling hides info and
   encourages save-scumming.

**Chosen approach (linear per-level multiplier on flat class base):**
predictable, easy to author, scales sensibly. A L1 knight is 140g; a L3
knight is 210g (×1.5); a L5 knight is 420g (×3). Matches the Godot
recruitment "feel" from the parity review while staying simple enough
to keep in your head.

## Level multiplier picks

The +50% per level lift maps to FE-style level-up arithmetic: a L3 unit
is roughly +2 in every positive stat (per the linear buildUnit), making
it ~33% stronger than L1 in combat math. Charging +50% per level
prices the convenience of "skip the grind" at a small premium over raw
power gain.

## Test coverage

`phaser/tests/unit/systems/recruitmentCost.test.ts` covers:

- L1 = base for each known class
- Unknown class → 120 baseline
- L2 = base × 1.5; L5 = base × 3
- L0 / negative → clamped to L1

## Cross-references

- `phaser/src/systems/buildUnit.ts` — constructs a Unit from `(classId, level)` for the recruitment dispatch
- `phaser/src/ui/screens/town/TavernPanel.tsx` — consumes `recruitmentCost()` for the "Hire {cost}g" label
- `phaser/src/data/content/towns/{pine_crossing,borderkeep_castle}.json` — first authored recruit pools

## Future refinements

- **Growth-rate rolls** on level-up so a L3 recruit's stats vary (currently linear +1 per level for positive stats)
- **Per-town discount/markup** so frontier towns offer lower prices than capitals
- **Tier-2 recruits** (promoted classes) at a separate higher base
- **Bounty board pricing** — captures sold to taverns at a fraction of recruit cost
