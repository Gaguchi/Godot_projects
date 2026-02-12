# FE_MB - Master Development Plan

> **Full MVP Demo: 2-3 Regions, 30-45 Minute Run, Solo Developer**
> Generated: February 12, 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Assessment](#2-current-state-assessment)
3. [Architecture & Signal Flow](#3-architecture--signal-flow)
4. [Critical Path: Minimum Playable Loop](#4-critical-path-minimum-playable-loop)
5. [Phase 1: Foundation Fixes](#5-phase-1-foundation-fixes-days-1-3)
6. [Phase 2: Overworld Completion](#6-phase-2-overworld-completion-days-4-7)
7. [Phase 3: Dungeon Completion](#7-phase-3-dungeon-completion-days-8-11)
8. [Phase 4: UI/Menus](#8-phase-4-uimenus-days-12-16)
9. [Phase 5: Content Population](#9-phase-5-content-population-days-17-20)
10. [Phase 6: Audio, Polish & Testing](#10-phase-6-audio-polish--testing-days-21-25)
11. [Content Plan Reference](#11-content-plan-reference)
12. [Data Architecture](#12-data-architecture)
13. [Risk Register](#13-risk-register)
14. [Scope Control: Cut List](#14-scope-control-cut-list)
15. [File Modification Index](#15-file-modification-index)
16. [Success Criteria](#16-success-criteria)

---

## 1. Executive Summary

### What Exists (Working)
- **Combat system**: 100% functional - Fire Emblem grid combat, AI, pathfinding, animations, turn order, combat log, level-ups
- **Overworld map loading**: JSON maps render correctly with terrain, objects, locations
- **Dungeon generation**: Slay the Spire branching paths, room types, floor tracking
- **Autoloads**: GameManager, EventBus, SaveManager, SceneLoader, SettingsManager all functional
- **UI menus**: Main Menu, Pause Menu, Save/Load, Settings, Party Screen, Inventory all exist and work
- **Unit system**: Stats, growth rates, equipment, serialization all complete

### What's Broken (Critical Bugs)
1. **AudioManager not in project.godot autoloads** - audio system exists but never initializes
2. **No enemy data passed to combat** - battlefield always spawns hardcoded test units
3. **Party units not loaded from GameManager** - combat doesn't use your actual party
4. **Unit death/XP not synced back** - permadeath and leveling are broken
5. **Dungeon floors don't advance** - stuck on floor 1 forever after boss

### What's Missing (Major Gaps)
1. Overworld location events (all stubs - just print statements)
2. Dungeon room events (combat/shop/event/rest rooms don't do anything)
3. Scene transition context (no data flows between overworld/dungeon/combat)
4. Shop Screen, Event/Dialog Screen, Dungeon HUD, Game Over Screen
5. Multi-region progression (only 1 test map exists)
6. Audio assets (zero music/SFX files)
7. Content (enemies, weapons, events, bosses defined but not in code)

### Estimated Timeline
**25 working days** (5 weeks at solo pace), broken into 6 phases. The game loop becomes playable end-to-end after Phase 3 (Day 11).

---

## 2. Current State Assessment

### System Completeness Matrix

| System | Status | % | Blocking Issues |
|--------|--------|---|-----------------|
| Combat Engine | **DONE** | 100% | None |
| Battle Grid / Pathfinding | **DONE** | 100% | None |
| Enemy AI | **DONE** | 100% | None |
| Combat Animations | **DONE** | 100% | None |
| Turn System (speed-based) | **DONE** | 100% | None |
| Unit Stats / Growth | **DONE** | 100% | None |
| Item / Weapon System | **DONE** | 100% | None |
| Combat UI (forecast, log, etc) | **DONE** | 95% | Minor polish |
| Overworld Map Loading | **DONE** | 100% | None |
| Overworld A* Pathfinding | **DONE** | 100% | None |
| Overworld Travel & Events | PARTIAL | 50% | Events are stubs |
| Dungeon Generation | **DONE** | 100% | None |
| Dungeon Room Navigation | PARTIAL | 60% | Room events stubbed |
| Dungeon State Persistence | PARTIAL | 40% | Not saved/restored properly |
| Main Menu | **DONE** | 100% | None |
| Pause Menu | **DONE** | 100% | None |
| Save/Load System | PARTIAL | 80% | Missing dungeon/overworld state |
| Settings Menu | **DONE** | 100% | None |
| Party Screen | PARTIAL | 70% | Needs equipment swap UI |
| Inventory Screen | PARTIAL | 70% | Needs item detail tooltips |
| Shop Screen | MISSING | 0% | Doesn't exist |
| Event/Dialog Screen | MISSING | 0% | Doesn't exist |
| Dungeon HUD | MISSING | 0% | Doesn't exist |
| Game Over Screen | MISSING | 0% | Doesn't exist |
| Audio Integration | MISSING | 5% | Manager exists, no assets |
| Content (enemies/weapons) | MISSING | 10% | Only 3 starter units exist |

### Autoload Health Check

| Autoload | In project.godot? | Status |
|----------|--------------------|--------|
| GameManager | YES | 95% - needs pending_battle fields |
| EventBus | YES | 80% - 50+ signals, most orphaned |
| SaveManager | YES | 80% - missing dungeon/overworld state |
| SceneLoader | YES | 100% |
| SettingsManager | YES | 100% |
| AudioManager | **NO** | BUG - script exists but not registered |

---

## 3. Architecture & Signal Flow

### Scene Transition Graph (Target State)

```
MAIN MENU ──→ New Game ──→ GameManager.start_new_run()
    │                            │
    └── Load Game ──→ SaveManager.load_game(slot)
                            │
                    ┌───────┴───────┐
                    ↓               ↓
              OVERWORLD         DUNGEON (if saved mid-dungeon)
                    │               │
         ┌─────────┼─────────┐     │
         ↓         ↓         ↓     │
       TOWN     BATTLE    DUNGEON  │
     (dialog)  (combat)     │      │
         │         │        ↓      │
         │         ↓     DUNGEON ROOM
         │    BATTLEFIELD    │
         │         │    ┌────┼────────┐
         │         │    ↓    ↓        ↓
         │         │  COMBAT SHOP   REST/EVENT
         │         │    │    │        │
         │         ↓    ↓    ↓        ↓
         └─────→ OVERWORLD ←─────────┘
                    │
                  EXIT → NEXT REGION or VICTORY
```

### Data Flow: Combat Context (THE CRITICAL FIX)

```
Location clicked / Room entered
    │
    ├─ Generate enemies (from EnemyDatabase + difficulty)
    ├─ Store in GameManager.pending_battle = { enemies: [], difficulty: N, source: "overworld"|"dungeon" }
    ├─ GameManager.change_state(COMBAT)
    └─ SceneLoader → battlefield.tscn
         │
         └─ Battlefield._ready():
              ├─ Read GameManager.party → spawn player units
              ├─ Read GameManager.pending_battle.enemies → spawn enemies
              └─ Clear GameManager.pending_battle
```

### Data Flow: Combat Results Return

```
Battle ends (victory or defeat)
    │
    ├─ Sync unit HP/XP back to GameManager.party
    ├─ Remove dead units (permadeath)
    ├─ Store rewards in GameManager.last_battle_results
    ├─ GameManager.last_battle_victory = true/false
    │
    ├─ If source == "dungeon":
    │    └─ SceneLoader → dungeon_map.tscn (restore state)
    │
    └─ If source == "overworld":
         └─ SceneLoader → world_map.tscn (restore state)
```

### EventBus Signal Priority (What to Connect for MVP)

| Signal | Emitter | Must Connect To | Priority |
|--------|---------|----------------|----------|
| `combat_started` | world_map, dungeon_map | (informational only) | LOW |
| `battle_ended(victory)` | battlefield | dungeon_map, world_map | **CRITICAL** |
| `unit_died(unit)` | battlefield | GameManager.remove_unit() | **CRITICAL** |
| `unit_leveled_up(unit, gains)` | battlefield | CombatLog display | MEDIUM |
| `party_changed` | GameManager | UI refresh | MEDIUM |
| `resources_changed` | GameManager | HUD refresh | MEDIUM |
| `state_changed(new, old)` | GameManager | Scene managers | LOW |

---

## 4. Critical Path: Minimum Playable Loop

The absolute minimum to get one playable end-to-end run:

```
1. Fix AudioManager registration                          [5 min]
2. Add GameManager.pending_battle + return context         [2 hours]
3. Battlefield reads party from GameManager                [2 hours]
4. Battlefield reads enemies from GameManager              [1 hour]
5. Battlefield syncs results back to GameManager           [2 hours]
6. Overworld BATTLE location triggers combat properly      [1 hour]
7. Combat return → overworld with restored state           [2 hours]
8. Overworld EXIT location advances to next region         [1 hour]
9. Create 1 enemy type in code                             [30 min]
──────────────────────────────────────────────────────────────────
TOTAL: ~12 hours for bare-minimum playable overworld → combat loop
```

After this, the dungeon loop requires:
```
10. Dungeon COMBAT room triggers combat with enemies       [1 hour]
11. Combat return → dungeon with floor state restored      [2 hours]
12. Floor advancement after boss room                      [1 hour]
13. Dungeon completion → return to overworld               [1 hour]
──────────────────────────────────────────────────────────────────
TOTAL: +5 hours for dungeon combat loop
```

---

## 5. Phase 1: Foundation Fixes (Days 1-3)

> **Goal**: Fix all critical bugs. Make combat ↔ overworld ↔ dungeon transitions work with real data.

### Task 1.1: Fix AudioManager Registration
**File**: `project.godot`
**Action**: Add AudioManager to autoload list after SettingsManager
**Time**: 5 minutes

### Task 1.2: Add Combat Context to GameManager
**File**: `autoload/game_manager.gd`
**Action**: Add these fields:
```gdscript
# Combat context (set before transitioning to battlefield)
var pending_battle: Dictionary = {}  # { "enemies": Array[UnitData], "difficulty": int, "source": String }
var last_battle_results: Dictionary = {}  # { "victory": bool, "gold": int, "xp": int }

# Overworld persistence
var current_map_name: String = "test_overworld"
var map_pawn_position: Vector2 = Vector2.ZERO

# Return context
var return_scene: String = ""  # Scene to return to after combat
```
**Time**: 1 hour

### Task 1.3: Battlefield Reads Party from GameManager
**File**: `scripts/combat/battlefield.gd`
**Action**: Replace hardcoded test units with GameManager.party initialization
```gdscript
func _initialize_player_units() -> void:
    for i in range(GameManager.party.size()):
        var unit_data = GameManager.party[i]
        var unit_scene = preload("res://scenes/units/unit.tscn")
        var unit = unit_scene.instantiate()
        unit.setup(unit_data)
        # Place on spawn points
        var spawn_pos = player_spawn_points[i % player_spawn_points.size()]
        unit.position = battle_grid.grid_to_world(spawn_pos)
        units_node.add_child(unit)
        player_units.append(unit)
```
**Time**: 2 hours

### Task 1.4: Battlefield Reads Enemies from GameManager
**File**: `scripts/combat/battlefield.gd`
**Action**: Read `GameManager.pending_battle.enemies` instead of generating test enemies
```gdscript
func _initialize_enemy_units() -> void:
    var enemy_data_list = GameManager.pending_battle.get("enemies", [])
    if enemy_data_list.is_empty():
        enemy_data_list = _generate_fallback_enemies()  # Keep test path

    for i in range(enemy_data_list.size()):
        var unit_data = enemy_data_list[i]
        var unit = unit_scene.instantiate()
        unit.setup(unit_data)
        # Random enemy spawn positions
        var spawn_pos = _get_random_enemy_spawn()
        unit.position = battle_grid.grid_to_world(spawn_pos)
        units_node.add_child(unit)
        enemy_units.append(unit)

    GameManager.pending_battle = {}  # Clear after reading
```
**Time**: 1 hour

### Task 1.5: Sync Combat Results Back to GameManager
**File**: `scripts/combat/battlefield.gd`
**Action**: On battle end, update GameManager with new HP/XP/deaths
```gdscript
func _sync_results_to_game_manager(victory: bool) -> void:
    # Update party unit HP from combat state
    for unit in player_units:
        var gm_unit = _find_gm_unit(unit.get_unit_data().unit_name)
        if gm_unit:
            gm_unit.current_hp = unit.get_unit_data().current_hp
            gm_unit.experience = unit.get_unit_data().experience
            gm_unit.level = unit.get_unit_data().level
            # Sync any stat changes from level-ups

    # Remove dead units (permadeath)
    for unit in dead_player_units:
        GameManager.remove_unit(unit.get_unit_data())

    # Store results
    GameManager.last_battle_victory = victory
    GameManager.last_battle_results = {
        "victory": victory,
        "gold": total_gold_earned,
        "xp": total_xp_earned
    }
```
**Time**: 2 hours

### Task 1.6: Fix Combat Return Routing
**File**: `scripts/combat/battlefield.gd`
**Action**: Return to correct scene based on source
```gdscript
func _end_battle(victory: bool) -> void:
    _sync_results_to_game_manager(victory)

    if not victory:
        if GameManager.party.is_empty():
            GameManager.end_run(false)
            # TODO: Game over screen
        GameManager.change_state(GameManager.GameState.OVERWORLD)
        await get_tree().create_timer(2.0).timeout
        SceneLoader.change_scene_to_file("res://scenes/overworld/world_map.tscn")
        return

    # Victory - return to source
    var source = GameManager.pending_battle.get("source", "overworld")
    await get_tree().create_timer(2.0).timeout

    if source == "dungeon":
        GameManager.change_state(GameManager.GameState.DUNGEON)
        SceneLoader.change_scene_to_file("res://scenes/dungeon/dungeon_map.tscn")
    else:
        GameManager.change_state(GameManager.GameState.OVERWORLD)
        SceneLoader.change_scene_to_file("res://scenes/overworld/world_map.tscn")
```
**Time**: 1 hour

### Task 1.7: Fix Dungeon Floor Advancement
**File**: `scripts/dungeon/dungeon_map.gd`
**Action**: Complete `_on_floor_completed()` to advance floors or complete dungeon
```gdscript
func _on_floor_completed() -> void:
    floor_completed.emit(current_floor)

    if current_floor >= max_floors:
        dungeon_completed.emit()
        GameManager.exit_dungeon(true)  # true = completed
        await get_tree().create_timer(2.0).timeout
        SceneLoader.change_scene_to_file("res://scenes/overworld/world_map.tscn")
    else:
        current_floor += 1
        GameManager.set_dungeon_floor(current_floor)
        generate_floor()
        _update_floor_display()
```
**Time**: 1 hour

### Task 1.8: Save/Load Enhancement
**File**: `autoload/save_manager.gd`
**Action**: Add overworld position, map name, and dungeon room state to serialization
**Time**: 2 hours

### Phase 1 Deliverable
After Phase 1: Combat works with real party data and real enemies. Overworld → Combat → return works. Dungeon → Combat → return works. Floor advancement works. This is the **skeleton** of the game loop.

---

## 6. Phase 2: Overworld Completion (Days 4-7)

> **Goal**: Complete overworld travel loop with all location types functional.

### Task 2.1: Overworld Location Event Handlers
**File**: `scripts/overworld/world_map.gd` (lines 362-393)
**Action**: Replace all print stubs with real event handling

**BATTLE locations**:
```gdscript
LocationData.LocationType.BATTLE:
    _save_overworld_state()
    var enemies = EnemyFactory.create_encounter(loc.enemy_level, loc.enemy_party_size)
    GameManager.pending_battle = {
        "enemies": enemies,
        "difficulty": loc.enemy_level,
        "source": "overworld"
    }
    GameManager.change_state(GameManager.GameState.COMBAT)
    SceneLoader.change_scene_to_file("res://scenes/combat/battlefield.tscn")
```

**TOWN locations**: Show shop/heal dialog (Phase 4 for full UI, placeholder dialog for now)

**EVENT locations**: Roll random event, apply gold/morale/healing consequence

**CAMP locations**: Heal party 30%, restore 3 supplies

**DUNGEON locations**: Save state, enter dungeon with difficulty scaling

**EXIT locations**: Load next region map or trigger victory

**Time**: 4 hours

### Task 2.2: Overworld State Persistence
**File**: `scripts/overworld/world_map.gd`
**Action**: Save/restore current_location_id, supplies, gold, visited locations when transitioning to/from combat
```gdscript
func _save_overworld_state() -> void:
    GameManager.current_map_name = current_map_name
    GameManager.current_location_id = current_location_id
    GameManager.map_pawn_position = player_pawn.position

func _restore_overworld_state() -> void:
    # Called in _ready() when returning from combat
    if not GameManager.current_map_name.is_empty():
        load_map(GameManager.current_map_name)
        current_location_id = GameManager.current_location_id
        player_pawn.position = GameManager.map_pawn_position
        _update_reachable_locations()
```
**Time**: 2 hours

### Task 2.3: Supply Cost Calculation
**File**: `scripts/overworld/world_map.gd`
**Action**: Replace fixed 1-supply cost with terrain-distance-based calculation
- Cost = ceil(tiles_traveled * 0.1), minimum 1
- Show cost in UI before confirming travel
**Time**: 1 hour

### Task 2.4: Path Preview on Hover
**File**: `scripts/overworld/world_map.gd`
**Action**: Draw yellow Line2D preview path when hovering a reachable location, show supply cost
**Time**: 1 hour

### Task 2.5: Camera Follow on Travel
**File**: `scripts/overworld/world_map.gd`
**Action**: Smooth camera tween to follow pawn during/after travel
**Time**: 30 min

### Task 2.6: Multi-Region Progression
**File**: `scripts/overworld/world_map.gd`
**Action**:
- Define region sequence: `["test_overworld", "thornwood_wilds", "ashfall_peaks"]`
- EXIT location loads next region map
- Final EXIT triggers victory
**Time**: 1 hour

### Task 2.7: Create Region 2 Map
**File**: `data/maps/thornwood_wilds.json`
**Action**: Design 24x18 dark forest map with ~12 locations (mix of all types)
**Time**: 3 hours (includes tile placement and testing)

### Task 2.8: Create Region 3 Map
**File**: `data/maps/ashfall_peaks.json`
**Action**: Design 24x18 volcanic/mountain map with ~10 locations
**Time**: 3 hours

### Phase 2 Deliverable
After Phase 2: Full overworld loop works. Player can travel between locations, fight battles, enter dungeons, rest at camps, and progress through 3 regions.

---

## 7. Phase 3: Dungeon Completion (Days 8-11)

> **Goal**: All dungeon room types functional. Complete dungeon → combat → dungeon loop.

### Task 3.1: Combat Room Resolution
**File**: `scripts/dungeon/dungeon_map.gd`
**Action**: When entering COMBAT/ELITE room, generate enemies and transition to battlefield
```gdscript
DungeonRoomData.RoomType.COMBAT, DungeonRoomData.RoomType.ELITE:
    var enemies = EnemyFactory.create_dungeon_encounter(room, dungeon_difficulty)
    GameManager.pending_battle = {
        "enemies": enemies,
        "difficulty": dungeon_difficulty,
        "source": "dungeon"
    }
    GameManager.save_dungeon_state(rooms, current_room_id, dungeon_difficulty, max_floors)
    GameManager.change_state(GameManager.GameState.COMBAT)
    SceneLoader.change_scene_to_file("res://scenes/combat/battlefield.tscn")
```
**Time**: 2 hours

### Task 3.2: Treasure Room Resolution
**File**: `scripts/dungeon/dungeon_map.gd`
**Action**: Award gold (already works), add chance for item drop, show notification
**Time**: 1 hour

### Task 3.3: Rest Room Resolution
**File**: `scripts/dungeon/dungeon_map.gd`
**Action**: Show simple choice: "Heal (30% HP)" vs "Prepare (+2 DEF for next battle)"
- For MVP: Can be a simple 2-button popup rather than full scene
**Time**: 1.5 hours

### Task 3.4: Shop Room Resolution
**File**: `scripts/dungeon/dungeon_map.gd`
**Action**: Open Shop Screen (Task 4.3) with dungeon-specific inventory
- For MVP: Can be a simple buy list if Shop Screen isn't ready yet
**Time**: 1 hour (depends on Shop Screen)

### Task 3.5: Event Room Resolution
**File**: `scripts/dungeon/dungeon_map.gd`
**Action**: Roll random event from event pool, show text + 2-3 choices, apply consequences
- For MVP: Inline popup with buttons rather than full Event Screen
**Time**: 2 hours

### Task 3.6: Boss Room - Special Combat
**File**: `scripts/dungeon/dungeon_map.gd`
**Action**: Same as combat room but uses boss enemy data (higher stats), triggers floor completion on victory
**Time**: 1 hour

### Task 3.7: Dungeon State Restoration
**File**: `scripts/dungeon/dungeon_map.gd`
**Action**: When returning from combat, restore full dungeon state:
- Reload room layout from GameManager
- Mark current room as completed
- Check if boss was defeated → floor advancement
- Show battle results notification
**Time**: 2 hours

### Task 3.8: Dungeon → Overworld Return
**File**: `scripts/dungeon/dungeon_map.gd`
**Action**: Exit button and dungeon completion both return to overworld with proper state
```gdscript
func _exit_to_overworld(completed: bool) -> void:
    GameManager.exit_dungeon(completed)
    GameManager.clear_dungeon_state()
    GameManager.change_state(GameManager.GameState.OVERWORLD)
    SceneLoader.change_scene_to_file("res://scenes/overworld/world_map.tscn")
```
**Time**: 1 hour

### Task 3.9: Visual Polish
**Action**:
- Connection lines between rooms (colored: blue=available, gray=visited, white=future)
- Room icons (text-based: crossed swords for combat, skull for elite, coin for treasure, etc.)
- Pulsing animation on current room
- Checkmark on completed rooms
**Time**: 2 hours

### Phase 3 Deliverable
After Phase 3: **THE GAME IS PLAYABLE END-TO-END.** Player can: Start game → Travel overworld → Enter dungeon → Clear rooms → Fight boss → Return to overworld → Progress through regions. This is the most important milestone.

---

## 8. Phase 4: UI/Menus (Days 12-16)

> **Goal**: Build remaining screens. Polish existing screens.

### Task 4.1: Shop Screen (NEW)
**File**: `scenes/ui/screens/shop_screen.tscn` + `shop_screen.gd`
**Architecture**:
```
ShopScreen (Control)
├── Header: Shop name + Gold display
├── ItemList: Scrollable buy/sell list
├── DetailPanel: Selected item stats
├── BuyButton: Purchase with gold check
└── CloseButton
```
**Features**: Buy mode, sell mode, gold validation, item stat display
**Time**: 4 hours

### Task 4.2: Event/Dialog Screen (NEW)
**File**: `scenes/ui/screens/event_screen.tscn` + `event_screen.gd`
**Architecture**:
```
EventScreen (Control)
├── TitleLabel: Event name
├── DescriptionLabel: Narrative text (wrapped)
├── ChoiceButtons: 2-4 dynamic buttons
└── ResultLabel: Outcome feedback
```
**Features**: Load event data, show choices, emit choice_selected signal, apply consequences
**Time**: 3 hours

### Task 4.3: Dungeon HUD (NEW)
**File**: `scenes/ui/screens/dungeon_hud.tscn` + `dungeon_hud.gd`
**Architecture**:
```
DungeonHUD (CanvasLayer)
├── TopBar: Floor label + Gold + Supplies
├── BottomBar: Compact party health cards
└── RoomInfo: Selected room type/difficulty
```
**Time**: 2 hours

### Task 4.4: Game Over Screen (NEW)
**File**: `scenes/ui/screens/game_over_screen.tscn` + `game_over_screen.gd`
**Features**: Show run stats (battles won, units lost, time played), "Return to Menu" button
**Time**: 1.5 hours

### Task 4.5: Victory Screen (NEW)
**File**: `scenes/ui/screens/victory_screen.tscn` + `victory_screen.gd`
**Features**: "Campaign Complete!", final stats, "Return to Menu" button
**Time**: 1 hour

### Task 4.6: Party Screen Enhancement
**File**: `scenes/ui/party_screen.gd`
**Action**: Add equipment swap UI - button to cycle through inventory weapons
**Time**: 2 hours

### Task 4.7: Inventory Screen Enhancement
**File**: `scenes/ui/inventory_screen.gd`
**Action**: Add item detail tooltip showing weapon stats comparison vs equipped
**Time**: 2 hours

### Task 4.8: Overworld HUD Enhancement
**File**: `scenes/ui/screens/world_map_ui.gd`
**Action**: Add compact party health strip to bottom bar
**Time**: 1.5 hours

### Task 4.9: Shared UI Components
**Files**: `scenes/ui/components/`
**Create**:
- `confirm_dialog.tscn` - Reusable yes/no modal (for save overwrite, quit confirm)
- `notification_toast.tscn` - Floating notification that auto-fades ("Found 20 gold!", "Healed party")
**Time**: 2 hours

### Phase 4 Deliverable
After Phase 4: All menu screens exist and function. Player has full UI for shopping, events, party management, and game flow.

---

## 9. Phase 5: Content Population (Days 17-20)

> **Goal**: Fill the game with enemies, weapons, events, and bosses. Make each run feel like a real game.

### Task 5.1: Enemy Factory
**File**: `scripts/data/enemy_factory.gd` (NEW)
**Action**: Implement the EnemyFactory class from MVP_CONTENT_PLAN.md with all 10 enemy types:
- Region 1: Bandit, Soldier, Brigand, Scout
- Region 2: + Mercenary, Armor Knight, Dark Mage, Rider
- Region 3: + Sniper, Shaman
- Scaling formulas per region difficulty
**Time**: 3 hours

### Task 5.2: Weapon Database
**File**: `data/items.json` (NEW) + `scripts/data/item_database.gd` (NEW)
**Action**: Define all 30 weapons from MVP_CONTENT_PLAN.md:
- 5 Swords, 4 Lances, 5 Axes, 3 Bows, 5 Tomes, 2 Staves, 6 Consumables
- Each with might, hit, crit, weight, range, price, special effects
**Time**: 3 hours

### Task 5.3: Recruitable Units
**File**: `scripts/data/recruit_factory.gd` (NEW)
**Action**: Implement 5 recruitable characters:
- Wren (Thief, Region 1), Aldric (Fighter, Region 1)
- Sera (Cleric, Region 2), Garrett (Cavalier, Region 2)
- Isolde (Archer, Region 3)
- Full stat blocks, growth rates, starting weapons, recruitment conditions
**Time**: 2 hours

### Task 5.4: Event Content
**File**: `data/events.json` (NEW)
**Action**: Define 12 random events with 2-3 choices each:
- Merchant events, ambush events, blessing events, recruitment events
- Numerical consequences (gold, food, morale, HP, stats)
**Time**: 3 hours

### Task 5.5: Boss Implementation
**File**: `scripts/data/enemy_factory.gd`
**Action**: Implement 3 region bosses:
1. **Roderick** (R1): Spawns 1 reinforcement Bandit per turn (max 2)
2. **Lady Morgana** (R2): Thorn Shield (damage reduction until broken), Nosferatu healing
3. **Baron Cragmaw** (R3): Aura (+2 Hit/+1 DMG to allies), Fury mode below 50% HP
**Time**: 3 hours (includes boss mechanic code)

### Task 5.6: Shop Inventories
**File**: `data/shops.json` (NEW)
**Action**: Define shop stock per region:
- Region 1: Iron weapons, Vulnerary, basic consumables
- Region 2: Steel weapons, better consumables
- Region 3: Silver/Killer weapons, Elixirs
**Time**: 1 hour

### Task 5.7: Location Data Population
**Files**: `data/maps/test_overworld.json`, `thornwood_wilds.json`, `ashfall_peaks.json`
**Action**: Set enemy_level, enemy_party_size, and event_id for each location in all 3 maps
**Time**: 2 hours

### Task 5.8: Starter Unit Stat Corrections
**File**: `autoload/game_manager.gd`
**Action**: Update `start_new_run()` with corrected stat blocks from MVP_CONTENT_PLAN.md (some stats were defaulting to 0)
**Time**: 30 minutes

### Phase 5 Deliverable
After Phase 5: Game has real content variety. Different enemies, weapons, events, and bosses make each region feel distinct. Recruitment works. Economy is balanced.

---

## 10. Phase 6: Audio, Polish & Testing (Days 21-25)

> **Goal**: Add audio, fix bugs, balance, and verify the complete game experience.

### Task 6.1: Source Audio Assets
**Action**: Download from OpenGameArt.org / Kenney.nl / itch.io (CC0/free):
- 5-7 music tracks (.ogg): main menu, overworld, combat, dungeon, boss, game over, victory
- 15-20 SFX (.ogg): UI clicks, sword hits (x3 variants), magic hits, crit, heal, level up, death, travel step, notification
**Time**: 3 hours (sourcing + converting to .ogg)

### Task 6.2: Audio Integration
**Files**: Multiple scenes
**Action**:
- Add `AudioManager.play_music()` calls to scene _ready() functions
- Add SFX to combat hit/miss/crit/death events
- Add UI click sounds to buttons
- Test crossfade between scenes
**Time**: 3 hours

### Task 6.3: Balance Testing
**Action**: Play through complete runs, adjusting:
- Enemy stat scaling (too easy? too hard?)
- Gold economy (can afford necessary items?)
- Supply pressure (running out too fast? not threatening?)
- Level curve (party at expected level for each region?)
- Boss difficulty (challenging but beatable?)
**Time**: 4 hours (multiple test runs)

### Task 6.4: Bug Fixing Pass
**Action**: Systematic testing of:
- All scene transitions (no softlocks)
- Save/load at every point (overworld, dungeon, before combat)
- Permadeath (unit dies → gone from party → save reflects this)
- Edge cases: party wipe, 0 gold, 0 supplies, full inventory
**Time**: 4 hours

### Task 6.5: Visual Polish
**Action**:
- Ensure all UI uses consistent theme colors
- Add screen fade transitions between scenes
- Ensure loading screen displays during heavy transitions
- Fix any z-ordering issues on maps
**Time**: 2 hours

### Task 6.6: Debug Tools (Optional but Recommended)
**File**: `scenes/debug/debug_console.gd` (NEW)
**Action**: In-game console (backtick key) with commands:
- `add_gold N`, `heal_party`, `level_up`, `skip_to_combat`, `godmode`
- Only active in debug builds
**Time**: 2 hours

### Phase 6 Deliverable
After Phase 6: **MVP COMPLETE.** A polished, balanced, 30-45 minute tactical roguelite demo with audio, 3 regions, varied content, and no game-breaking bugs.

---

## 11. Content Plan Reference

Full content details are in `docs/MVP_CONTENT_PLAN.md`. Key numbers:

### Recruitable Units Summary
| Name | Class | Region | Where Found | Starting Level |
|------|-------|--------|-------------|----------------|
| Wren | Thief | R1 | Riverside Market (TOWN) | 1 |
| Aldric | Fighter | R1 | South Junction (post-battle) | 2 |
| Sera | Cleric | R2 | Thornwood Chapel (TOWN) | 2 |
| Garrett | Cavalier | R2 | "The Deserter" event | 3 |
| Isolde | Archer | R3 | Ashfall Outpost (30 gold) | 4 |

### Enemy Scaling Per Region
| Region | Enemy HP | Enemy STR | Enemy DEF | Enemy Level |
|--------|----------|-----------|-----------|-------------|
| R1 (Borderlands) | 12-18 | 4-6 | 2-4 | 1-3 |
| R2 (Thornwood) | 16-24 | 6-8 | 4-7 | 3-5 |
| R3 (Ashfall) | 20-30 | 8-11 | 5-9 | 5-7 |

### Boss Summary
| Boss | Region | HP | Key Mechanic |
|------|--------|-----|-------------|
| Roderick the Brigand King | R1 | 32 | Spawns reinforcement bandits |
| Lady Morgana the Thornwitch | R2 | 28 | Thorn Shield + Nosferatu healing |
| Baron Cragmaw the Iron Tyrant | R3 | 40 | Aura buff + Fury mode at 50% HP |

### Gold Economy
| Source | Amount |
|--------|--------|
| Starting gold | 50 |
| Battle reward (average) | 25-40 per fight |
| Treasure room | 30-60 |
| Event (good outcome) | 10-30 |
| Total expected income per run | ~400-500 |
| Total shop spending (if buying all) | ~600+ |
| **Result**: Player must choose what to buy (intentional scarcity) |

---

## 12. Data Architecture

### Where Data Lives

| Data Type | Storage | Rationale |
|-----------|---------|-----------|
| Unit classes, enums | GDScript constants | Small, frequently accessed |
| Enemy templates | GDScript factory class | Fast, type-safe, easy to iterate |
| Weapon/item stats | JSON → loaded at startup | Easy to tweak without code changes |
| Map layouts | JSON (data/maps/) | Already established pattern |
| Events | JSON (data/events.json) | Content-heavy, designer-friendly |
| Shop inventories | JSON (data/shops.json) | Per-region configuration |
| Game state | GameManager singleton | Runtime only, serialized to JSON on save |
| Save files | JSON (user://save_slot_N.json) | Human-readable, debuggable |

### New Autoloads (Optional)

For MVP, **avoid adding more autoloads**. Use static factory classes instead:
- `EnemyFactory` - static class, no autoload needed
- `RecruitFactory` - static class, no autoload needed
- `ItemDatabase` - could be autoload for global access, or static load

If adding autoload databases, register after existing ones:
```ini
[autoload]
# Existing...
AudioManager="*res://autoload/audio_manager.gd"
# Optional new:
ItemDatabase="*res://scripts/data/item_database.gd"
```

### Save File Schema (Target)

```json
{
    "version": "0.2.0",
    "timestamp": 1707000000,
    "game_manager": {
        "is_run_active": true,
        "current_state": 1,
        "current_map_name": "test_overworld",
        "current_location_id": 5,
        "current_floor": 1,
        "gold": 150,
        "food": 7,
        "morale": 85,
        "battles_won": 3,
        "units_lost": 0,
        "party": [ /* UnitData.to_dict() for each */ ],
        "dungeon_state": {
            "active": false,
            "rooms": [],
            "current_room_id": 0,
            "difficulty": 1,
            "max_floors": 3,
            "current_floor": 1
        },
        "run_seed": 42
    }
}
```

---

## 13. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Scene transition softlocks** | HIGH | CRITICAL | Test every transition path. Add fallback "return to menu" on any error. |
| **Save corruption** | MEDIUM | HIGH | Version field in saves. Validate JSON on load. Never overwrite without backup. |
| **Balance issues** (too easy/hard) | HIGH | MEDIUM | Playtest early with Phase 3 build. Adjust enemy stats with multipliers. |
| **Scope creep** | HIGH | HIGH | Follow Cut List (Section 14). Each phase has a clear deliverable. |
| **Combat context bugs** | MEDIUM | HIGH | The pending_battle pattern is the riskiest new code. Test thoroughly with different sources (overworld vs dungeon). |
| **Memory/performance** | LOW | MEDIUM | GL Compatibility renderer + 1280x720 = very manageable. ~500 nodes max. |
| **Art asset gaps** | MEDIUM | LOW | Procedural sprites already work for units. Kenney packs cover terrain. |
| **Audio sourcing** | LOW | LOW | Many free CC0 packs available. Can ship with minimal audio. |
| **Godot 4.6 bugs** | LOW | MEDIUM | Stick to well-tested APIs. Avoid bleeding-edge features. |

### Highest Risk Item
**Scene transition context passing** (Phase 1, Tasks 1.2-1.6). This is the most interconnected change - touching GameManager, Battlefield, WorldMap, and DungeonMap simultaneously. If the pending_battle pattern has bugs, combat won't work from either source. **Mitigation**: Build and test this first. Keep the fallback test enemy generation path.

---

## 14. Scope Control: Cut List

Things from the GDD that are **explicitly deferred** for post-MVP:

### Cut from MVP
- **Threat/pursuit system** - The FTL-style advancing enemy is complex and not essential for demo
- **Support bonds** - Unit relationship system (C/B/A bonds) adds no critical gameplay
- **Class promotions** - Level 20 promotion trees are endgame content
- **Personal quests** - Per-unit quest chains are narrative content, not core loop
- **Meta-progression** - Between-run unlocks are post-launch
- **Fog of war** - "Paper map" burn effect is polish, not gameplay
- **Day/night cycle** - CanvasModulate tinting is cosmetic
- **Combat exchange mini-scene** - The fighting-game-style attack zoom is expensive to build
- **Drag-and-drop inventory** - Button-based equip/give works fine for MVP
- **Keybind remapping** - Default keys only
- **Difficulty settings** - Single difficulty for MVP, tune it to feel right
- **Daily runs / seeded runs** - Community feature, post-launch

### Simplified for MVP
- **Events**: 12 events with text + buttons (no character portraits or animations)
- **Shop**: Simple buy list (no sell mode, no haggling)
- **Rest rooms**: 2 static choices (no dynamic buffs)
- **Bosses**: Unique stats + 1 special mechanic each (no multi-phase fights)
- **Audio**: Sourced assets, not custom compositions
- **Procedural unit sprites**: Already implemented, good enough for MVP

---

## 15. File Modification Index

### Files to CREATE (New)

| File | Phase | Purpose |
|------|-------|---------|
| `scripts/data/enemy_factory.gd` | 5 | Enemy generation with scaling |
| `scripts/data/recruit_factory.gd` | 5 | Recruitable unit creation |
| `scripts/data/item_database.gd` | 5 | Weapon/item loading from JSON |
| `data/items.json` | 5 | Weapon/item definitions |
| `data/events.json` | 5 | Event content definitions |
| `data/shops.json` | 5 | Shop inventories per region |
| `data/maps/thornwood_wilds.json` | 2 | Region 2 map |
| `data/maps/ashfall_peaks.json` | 2 | Region 3 map |
| `scenes/ui/screens/shop_screen.tscn` | 4 | Shop UI |
| `scenes/ui/screens/shop_screen.gd` | 4 | Shop logic |
| `scenes/ui/screens/event_screen.tscn` | 4 | Event UI |
| `scenes/ui/screens/event_screen.gd` | 4 | Event logic |
| `scenes/ui/screens/dungeon_hud.tscn` | 4 | Dungeon HUD |
| `scenes/ui/screens/dungeon_hud.gd` | 4 | Dungeon HUD logic |
| `scenes/ui/screens/game_over_screen.tscn` | 4 | Game Over |
| `scenes/ui/screens/victory_screen.tscn` | 4 | Victory |
| `scenes/ui/components/confirm_dialog.tscn` | 4 | Reusable dialog |
| `scenes/ui/components/notification_toast.tscn` | 4 | Toast notifications |

### Files to MODIFY (Existing)

| File | Phase | Changes |
|------|-------|---------|
| `project.godot` | 1 | Add AudioManager autoload |
| `autoload/game_manager.gd` | 1, 5 | Add pending_battle, return_scene, combat context fields; fix starter stats |
| `autoload/save_manager.gd` | 1 | Add dungeon/overworld state serialization |
| `scripts/combat/battlefield.gd` | 1 | Init from GameManager, sync results back, fix return routing |
| `scripts/overworld/world_map.gd` | 2 | Complete location events, state persistence, multi-region, path preview |
| `scripts/dungeon/dungeon_map.gd` | 3 | Room event resolution, state restoration, floor advancement |
| `scripts/dungeon/dungeon_generator.gd` | 3 | Populate room enemy data |
| `scripts/resources/dungeon_room_data.gd` | 1 | Add serialize/deserialize methods |
| `scripts/resources/location_data.gd` | 2 | Add enemy_level, enemy_party_size fields if missing |
| `scenes/ui/party_screen.gd` | 4 | Equipment swap UI |
| `scenes/ui/inventory_screen.gd` | 4 | Item detail tooltips |
| `scenes/ui/screens/world_map_ui.gd` | 4 | Party health strip |

---

## 16. Success Criteria

### Minimum Viable Demo Checklist

**Core Loop**:
- [ ] Start new game from main menu
- [ ] Travel between locations on overworld
- [ ] Supplies consumed per hop
- [ ] Enter combat at BATTLE location with correct enemies
- [ ] Win combat → return to overworld with updated party
- [ ] Lose combat → game over (if party wiped)
- [ ] Enter dungeon at DUNGEON location
- [ ] Navigate dungeon rooms (combat, treasure, rest, shop, event)
- [ ] Defeat dungeon boss → floor advancement
- [ ] Complete dungeon → return to overworld
- [ ] Progress through 3 regions
- [ ] Reach final EXIT → victory screen

**Persistence**:
- [ ] Save game from pause menu
- [ ] Load game from main menu
- [ ] Save preserves: party, gold, supplies, location, dungeon state
- [ ] Permadeath: dead units stay dead across saves

**Content**:
- [ ] 3 starter units with distinct stats
- [ ] 3+ recruitable units across regions
- [ ] 10+ enemy types with region scaling
- [ ] 15+ weapons available
- [ ] 3 unique bosses
- [ ] 12+ random events
- [ ] Shops in towns

**UI**:
- [ ] All screens navigable (menu → game → pause → resume)
- [ ] Shop screen functional
- [ ] Event dialog functional
- [ ] Party/inventory screens show correct data

**Quality**:
- [ ] No softlocks (every state has a way out)
- [ ] No crashes during normal play
- [ ] Audio plays (music + at least basic SFX)
- [ ] 60 FPS on modern hardware

### Definition of Done
A player who has never seen the game can: launch it, start a new run, play through 2-3 regions making tactical decisions, experience permadeath stakes, and reach either victory or defeat in 30-45 minutes. They should want to play again.

---

*This plan is a living document. Update section status as tasks are completed.*
*See also: `docs/MVP_CONTENT_PLAN.md` for detailed content specifications.*
*See also: `docs/GAME_DESIGN_DOCUMENT.md` for full game vision.*
