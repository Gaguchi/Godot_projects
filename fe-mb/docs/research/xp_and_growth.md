# Research: Experience & Stat Growth Algorithms

## Executive Summary
Progression in standard RPGs is often exponential (Level 99 needs 1,000,000 XP). *Fire Emblem* is distinct: **100 XP always equals 1 Level**. The complexity lies in the **variable XP gain** from combat (scaling down as you over-level) and the **probabilistic stat growth** (RNG) upon leveling up.

## Mechanics Breakdown

### 1. The Experience Formula (GBA Era)
Instead of requiring more XP per level, the game gives you *less* XP for killing weaker enemies.
*   **Formula**: `XP = (EnemyLevel - PlayerLevel) + BaseXP + Bonuses`
    *   *BaseXP*: Usually 10 for damage, 30 for a kill.
    *   *Level Diff*: If you are 5 levels higher, you might get 1-2 XP for a kill. If you are 5 levels lower, you might get 80-100 XP.
*   **Boss Bonus**: Flat +40 XP.
*   **Cap**: usually 100 XP max per action.

### 2. Stat Growth: RNG vs Fixed
When a unit levels up, they don't get "+2 Strength". They get a **chance** to gain stats based on their "Growth Rates".
*   **Example (Roy)**:
    *   HP Growth: 80% (Roll 0-99. If < 80, HP +1).
    *   Str Growth: 40% (Roll 0-99. If < 40, Str +1).
    *   Luck Growth: 60%.
*   **The "Ding" Dopamine**: This slot-machine effect upon leveling is a core part of the FE "fun".
*   **Fixed Mode (Alternative)**:
    *   Instead of rolling, add 40 to an internal "Str Accumulator".
    *   If Accumulator >= 100, gain +1 Str and subtract 100.
    *   *Pros*: No "Bad Levels" (getting 0 stats). Balanced.
    *   *Cons*: Less exciting.

## Implementation Strategy (Godot)

### Data Structures
Extend `UnitData` to include Growths.
```gdscript
class_name UnitData extends Resource
# Current Stats
@export var strength: int = 5
# Growth Rates (Percentage)
@export var growth_strength: int = 40 # 40% chance
```

### Logic: `ExperienceManager`
1.  **GainXP(unit, amount)**:
    *   `unit.exp += amount`
    *   `while unit.exp >= 100:`
        *   `unit.exp -= 100`
        *   `unit.level += 1`
        *   `_roll_stats(unit)`

2.  **Roll Stats**:
    *   Iterate through all stats (HP, Str, Mag, Spd, etc.).
    *   `if randi() % 100 < unit.growth_stat: unit.stat += 1`
    *   **Bad Luck Protection**: In a Roguelite, a "+0 Stat" level up is devastating.
        *   *Logic*: Track `stats_gained`. If `stats_gained == 0` after checking all stats, **force trigger** the highest growth stat (or HP) to ensure progress.
    *   *Roguelite Twist*: Since runs are short, boost growth rates (e.g., 200% = guaranteed +2) to feel powerful faster?

### Pros/Cons
*   **Pros**: Self-balancing. If you get over-leveled, you stop gaining XP, letting weaker units catch up.
*   **Cons**: RNG screwed. A bad level up feels terrible. **Recommendation**: Ensure at least 1 stat always increases (Re-roll if all fail).

## References
*   [Serenes Forest: EXP Calculations](https://serenesforest.net/general/experience-formulas/)
*   [Fire Emblem Wiki: Growth Rates](https://fireemblemwiki.org/wiki/Growth_rate)
