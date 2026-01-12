# Research: Fire Emblem Combat Systems

## Executive Summary
The *Fire Emblem* combat system, specifically the GBA era (*Binding Blade*, *Blazing Blade*, *Sacred Stones*), is defined by **deterministic math** and **high lethality**. Unlike many RPGs with complex damage variances, FE uses flat addition/subtraction, making the outcome predictable to the player—*if* they hit. The complexity comes from **positioning** (Terrain), **matchups** (Weapon Triangle), and **risk management** (Permadeath).

## Mechanics Breakdown

### 1. The Core Loop
1.  **Initiation**: Unit A attacks Unit B.
2.  **Attack Speed Check**: Calculate Attack Speed (AS) for both.
3.  **The Exchange**:
    *   Attacker strikes.
    *   Defender counters (if in range).
    *   Fastest unit strikes again (Doubling) if `AS Diff >= 4`.
4.  **Result**: HP is reduced. If 0, unit dies (Permadeath). XP is awarded.

### 2. The Math (GBA / Binding Blade Era)

*   **Attack Speed (AS)**: Determines doubling and evasion.
    *   `AS = Speed - max(0, Weapon Weight - Constitution)`
    *   *Note: Heavy weapons ruin speed if Constitution is low.*

*   **Hit Rate (Accuracy)**:
    *   `Physical Hit = Weapon Hit + (Skill * 2) + (Luck / 2) + Bonuses`
    *   `Avoid (Evasion) = (AS * 2) + Luck + Terrain Bonus`
    *   `Displayed Hit = Physical Hit - Enemy Avoid`
    *   **True Hit (2RN)**: The game rolls 2 random numbers (0-99) and averages them. This pushes high hit rates higher (90% displayed ≈ 98% real) and low rates lower.

*   **Damage Calculation**:
    *   `Attack Power = Strength + Weapon Might + Triangle Bonus`
    *   `Defense = Def (or Res) + Terrain Bonus`
    *   `Damage = Attack Power - Defense`
    *   *Result is a flat number. No variance.*

*   **Critical Hits**:
    *   `Crit Rate = Weapon Crit + (Skill / 2) + Bonuses - Enemy Luck`
    *   `Crit Damage = Damage * 3`

### 3. The Weapon Triangle
A Rock-Paper-Scissors system that influences both accuracy and damage.
*   **Sword** > **Axe**
*   **Axe** > **Lance**
*   **Lance** > **Sword**

**Bonuses (GBA Standard):**
*   **Advantage**: +1 Damage, +15% Hit
*   **Disadvantage**: -1 Damage, -15% Hit
*   *Note: Binding Blade used +10% Hit, later games increased it to 15%.*

## Implementation Strategy (Godot)

### Data Structures
We need strictly defined resources for units and items.

```gdscript
class_name UnitData extends Resource
var strength: int
var magic: int
var skill: int
var speed: int
var luck: int
var defense: int
var resistance: int
var constitution: int # For weapon weight
```

### Architecture
1.  **CombatCalculator (Static/Singleton)**: A pure logic class that takes two `UnitData` objects and returns a `CombatResult` struct.
    *   `CombatCalculator.calculate_forecast(attacker, defender)` -> Returns hit chance, dmg, crit.
2.  **BattleManager**: Handles the actual execution of the `CombatResult` (playing animations, reducing HP).
3.  **TrueHit Function**:
    ```gdscript
    func roll_2rn(hit_chance: int) -> bool:
        var r1 = randi() % 100
        var r2 = randi() % 100
        var average = (r1 + r2) / 2
        return average < hit_chance
    ```

### Pros/Cons for Roguelite
*   **Pros**: Deterministic math allows players to plan perfect runs. The "Doubling" mechanic adds huge depth to Speed stats.
*   **Cons**: Stat inflation can break the game quickly (0 damage). In a Roguelite, we must be careful with infinite scaling items.

## References
*   [Serenes Forest: Binding Blade Calculations](https://serenesforest.net/binding-blade/)
*   [True Hit (2RN) Explanation](https://serenesforest.net/general/true-hit/)
