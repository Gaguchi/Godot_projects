# Research: Procedural Map Generation (SRPG)

## Executive Summary
Generating tactical grids (SRPG) is harder than dungeon crawlers because **fairness** and **readability** are paramount. A map cannot just be "random noise"; it needs clear **biomes**, **chokepoints**, and **arenas**.
**Recommendation**: Shift from pure Noise to **Template Stamping** as the primary driver. Use Noise only for the "filler" between tactical set-pieces. This ensures cool forts and bridges always exist.

## Mechanics Breakdown

### 1. The Layers of Generation
1.  **Terrain Layer (The Canvas)**:
    *   Use **Perlin Noise** or **Simplex Noise**.
    *   Thresholds define tiles:
        *   < 0.3: Water
        *   0.3 - 0.6: Plains
        *   0.6 - 0.8: Forest
        *   > 0.8: Mountain
    *   *Result*: A natural looking world, but unstructured.

2.  **Tactical Layer (The Gameplay)**:
    *   **Cellular Automata (Clumping)**: To solve "readability", run a pass that removes single-tile noise.
        *   *Rule*: `if forest_neighbors < 2: become plain`.
        *   *Result*: Clear "Thickets" of 3-4 trees, providing cover without visual clutter. Single trees are distractions.
    *   **River Generation**: Use pathfinding (A*) from one edge to another with high cost on Mountains to carve rivers.

3.  **Object Layer (The Points of Interest)**:
    *   **Template Stamping**: Do NOT randomly place a Castle or a Shop. Create a 5x5 hand-made "Village Chunk".
    *   Algorithm attempts to fit this 5x5 chunk into a valid "Plains" area.
    *   **Fallback**: If no space exists for a mandatory template (e.g., Boss Castle), **force-overwrite** the terrain or clearing. Better to have a castle on a weird mountain edge than no castle at all. This avoids infinite regeneration loops.

4.  **Spawn Layer**:
    *   Flood Fill algorithm to find reachable tiles from Player Start.
    *   Enemy placement: Place enemies in groups (Squads) rather than purely random.

### 2. The Math/Logic
*   **Noise**: `noise.get_noise_2d(x, y)` needs a seed.
*   **Fairness Check**: After generation, run A* from Player Spawn to Boss. If no path exists, **do not regenerate**. Instead, run a "Bulldozer" crawler that turns walls into floors along the shortest path until a connection is made.

## Implementation Strategy (Godot)

### Data Structures
*   **MapData**: A 2D Array or Dictionary `{ Vector2i: TileData }`.
*   **TileData**: Enum for type (`Grass`, `Forest`, `Wall`) and metadata (`defense_bonus`, `move_cost`).

### Architecture: `MapGenerator` (Threaded)
Since generation can take 100-500ms, run it on a background thread or use `await get_tree().process_frame` between steps to prevent freeze.

### Algorithms to Use
1.  **FastNoiseLite**: Built-in Godot class. Excellent for the base layer.
2.  **Wave Function Collapse (WFC)**: Overkill for natural terrain, but **excellent** for generating interior buildings or caves where connections must be strict (Door matches Door). For outdoors, stick to Noise + Automata.

### Pros/Cons
*   **Pros**: Infinite replayability.
*   **Cons**: Risk of "Unbeatable Maps". Requires a validation step (The Fairness Check).

## References
*   [Red Blob Games: Map Generation](https://www.redblobgames.com/maps/terrain-from-noise/)
*   [Islands from Perlin Noise](https://medium.com/@jason.long/generating-a-procedural-world-with-perlin-noise-d56ee15d7876)
