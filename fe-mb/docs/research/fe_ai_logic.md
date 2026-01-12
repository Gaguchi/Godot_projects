# Research: Fire Emblem AI Logic

## Executive Summary
Fire Emblem AI is efficient and predictable, which allows the player to "solve" the map. It does not use complex Goal Oriented Action Planning (GOAP). It relies on a strictly prioritized **Utility Score System** executed on a per-unit basis. The AI generally does not "coordinate" a grand strategy; it just optimizes individual turns.

## Mechanics Breakdown

### 1. The AI Phases
1.  **Aggro Check**:
    *   Is a player inside my range? OR
    *   Am I part of a "Group" that was triggered? OR
    *   Is it Turn X (Reinforcements)?
    *   *If No*: Stand still (or patrol).
2.  **Target Selection (Scoring)**:
    *   Simulate attacks against ALL valid targets in valid move range.
    *   Assign a score to each target.
3.  **Action**: Move to optional tile and execute attack.

### 2. Targeting Priorities (The Scoreboard)
The AI wants to kill you. It evaluates targets in this order:
1.  **Lethal**: Can I kill this unit this turn? -> **Highest Priority**. (Score: 1000)
2.  **Free Damage**: Can I hit them without taking a counter-attack? (Archers vs Melee). -> **High Priority**. (Score: 500)
3.  **Maximum Damage**: Which target takes the most damage? (Score: Expected Dmg)
4.  **Hit Rate**: Prefer > 0% hit rate (obviously).
5.  **Tie-Breaker**: Class disadvantage (Triangle), Lower Def, or Reading Order (first unit found).

### 3. Movement Logic
*   **Attack Range**: Move to the tile that gives best terrain bonus (Forest) from which I can hit the target.
*   **blocked**: If no attack is possible, move **towards** the closest enemy (Pathfinding).
*   **Body Blocking**: AI will unknowingly form lines because they stop when they hit a unit.

## Implementation Strategy (Godot)

### Architecture: `AITurnManager`
Since pathfinding is expensive, do not run all AI at once.
1.  **Queue**: Get list of all Enemy Units.
2.  **Process One**:
    *   `unit.find_best_action(gamestate)`
    *   `await unit.execute_action()`
    *   `next()`

### Logic: `Best Action Finder`
```gdscript
var best_score = -1
var best_target = null

for target in player_units_in_range:
    var score = 0
    var dmg = calculate_damage(self, target)
    
    if dmg >= target.hp: score += 1000 # Lethal
    if not target.can_counter(self): score += 500 # Free hit
    score += dmg # Maximize pain
    
    if score > best_score:
        best_score = score
        best_target = target
```

### Pros/Cons
*   **Pros**: Deterministic. Players can "bait" the AI (put a high Def unit on the edge of range), which is a core tactic in FE.
*   **Cons**: Can be easily cheesed. In a Roguelite, we might want *slotted* AI (e.g., "Aggressive", "Defender", "Healer") to add variety.
*   **Designer Note**: The predictability is a feature, not a bug. It allows "Baiting" (placing a tanky unit at the edge of range to lure enemies), which is a fundamental *Fire Emblem* tactic. Keeping the utility score simple preserves this player agency.

## References
*   [FeUniverse: AI Documentation](https://feuniverse.us/)
*   [Gamasutra: The AI of Fire Emblem](https://www.gamedeveloper.com/)
