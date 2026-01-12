# Research: Roguelite Architecture & Persistence

## Executive Summary
A robust Roguelite requires a centralized **Run State** that exists independently of the Scene Tree. This state must be serializable (saving) and deterministic (seeding). The architecture echoes *Slay the Spire*: a single data object tracks the Run (Map, Deck/Party, HP), which is loaded into transient Scenes (Battle, Event, Shop) and updated upon exit.

## Mechanics Breakdown

### 1. The "Run" Lifecycle
Unlike a standard RPG where "Save Data" is a snapshot of one moment, a Roguelite Run is a **Finite State Machine**.
1.  **Menu**: Player hits "New Run".
2.  **Generation**: A specific `int` Seed is generated (or input).
3.  **Initialization**: The `RunState` object is created.
    *   `RunState.seed`: 123456789
    *   `RunState.rng`: A dedicated `RandomNumberGenerator` initialized with the seed.
    *   `RunState.floor`: 1
    *   `RunState.party`: List of Units.
    *   `RunState.map_data`: The graph of nodes for the current act.
4.  **Loop**:
    *   Load Map Scene (Read `RunState.map_data`).
    *   Enter Node (Battle).
    *   **Battle Scene**: Transient. Reads `RunState.party` to spawn units.
    *   **Victory**: Updates `RunState.party` (XP, HP) and `RunState.inventory`.
    *   **Autosave**: Serialize `RunState` to disk.
5.  **Death**: Delete `RunState` file. Update `MetaProgression` file (Global unlocks).

### 2. The Math/Logic of Seeding
*   **Determinism**: Every random event must pull from `RunState.rng`.
    *   *Bad*: `randf()` (Uses Global Godot RNG).
    *   *Good*: `RunState.rng.randf()` (Uses Run Seed).
*   Even drop rates, critical hits (optionally), and map generation *must* use the seeded RNG so players can share "Seeds" and get the same run.

## Implementation Strategy (Godot)

### Data Structures
We need strictly defined Resources.

```gdscript
class_name RunState extends Resource
@export var seed_value: int
@export var version: String = "0.1.0" # For save migration
@export var current_floor: int
@export var gold: int
@export var party: Array[UnitData]
@export var inventory: Array[ItemData]
@export var region_map: RegionMapData # The generated graph

# The RNG instance is NOT saved directly, but re-initialized 
# from the seed + a "steps taken" counter if needed, 
# though simpler roguelites just re-roll or save "rng_state".
```

### Architecture: The `RunManager`
A Singleton (Autoload) that manages the `RunState`.

*   **RunManager.gd**:
    *   `current_run: RunState`
    *   `start_new_run(seed: int)`
    *   `continue_run()` -> Loads from `user://current_run.tres`
    *   `advance_floor()`
    *   `save_run()`
    *   `delete_run()` (On death)

### Persistence
*   **Method**: `ResourceSaver` and `ResourceLoader`.
*   **Path**: `user://savegame.tres`.
*   **Security**: Minimal. It's a single player game. If we need simple obfuscation, Godot supports checking MD5, but true anti-cheat is overkill.

### Versioning & Migration
*   **Challenge**: If we patch the game (e.g., rename variables) while a run is mid-progress, the save might break or load invalid data.
*   **Strategy**:
    *   **Strict Version Check**: If `save.version != current_version`, warn the user or attempt migration.
    *   **Invalidation**: For an MVP, it is acceptable to "Invalidate" runs from older versions (forcing a restart).
    *   **Migration**: For minor patches, use a `MigrationManager` that reads the old resource and manually maps it to the new format before `load()` completes.

### Pros/Cons
*   **Pros**: Separation of Logic (Run) and View (Scenes) prevents bugs. Seeding allows for "Daily Challenges".
*   **Cons**: Requires strict discipline. accessing `GameManager` for everything instead of local variables.

## References
*   [Godot Docs: Saving Games](https://docs.godotengine.org/en/stable/tutorials/io/saving_games.html)
*   [Slay the Spire Save Structure Analysis](https://github.com/ForgottenArbiter/ths-save-editor)
