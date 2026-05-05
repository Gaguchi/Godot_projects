# FE_MB - AI Context File

> This file helps AI assistants understand the project structure and game mechanics.

## Project Overview

**FE_MB** is a tactical roguelite built in **Godot 4.x (GDScript)** combining:

- **Fire Emblem-style** turn-based grid combat
- **FTL-style** overworld navigation on a node map
- **Slay the Spire-style** procedural dungeon exploration
- **Permadeath** - fallen units are lost forever

## Core Game Loop

```
Main Menu → Overworld Map → [Travel to Location] → Combat/Event/Town/Dungeon → Repeat
```

## Project Structure

```
fe-mb/
├── autoload/           # Global singletons (GameManager, EventBus, SaveManager, etc.)
├── data/
│   ├── maps/           # JSON map definitions (overworld)
│   │   ├── asset_catalog.json   # Tile name → PNG path mappings
│   │   └── test_overworld.json  # Current test map
│   └── regions/        # .tres region data files (legacy FTL-style)
├── docs/
│   ├── GAME_DESIGN_DOCUMENT.md  # Full GDD
│   └── research/       # Research notes on mechanics
├── resources/          # Godot .tres resources (tilesets, etc.)
├── scenes/
│   ├── combat/         # Battlefield, test battles
│   ├── dungeon/        # Dungeon map, room nodes
│   ├── overworld/      # World map, location nodes, player pawn
│   ├── ui/             # Menus, screens, HUD components
│   └── units/          # Unit scene
├── scripts/
│   ├── combat/         # Combat system, battlefield logic
│   ├── dungeon/        # Dungeon generation
│   ├── overworld/      # World map, map loader, input handling
│   ├── resources/      # Resource classes (LocationData, RegionData, etc.)
│   └── units/          # Unit stats, classes
├── themes/             # UI themes
└── phaser/             # Combat sandbox (TypeScript + Phaser 4 + React + Vite). Ships v0.1, validated AI iteration loop. See phaser/README.md.
```

## Key Systems

### 1. Overworld Map (`scripts/overworld/`)

- **world_map.gd** - Main controller, handles travel, location events
- **overworld_map_loader.gd** - Loads JSON maps, builds terrain sprites, tracks terrain types
- **location_node.gd** - Visual representation of clickable locations
- **world_input_manager.gd** - Handles click/hover on map nodes

**Map Data Format** (`data/maps/*.json`):

```json
{
  "name": "Map Name",
  "width": 24, "height": 18, "tile_size": 64,
  "layers": [
    {"name": "terrain", "type": "grid", "data": [["tile_name", ...], ...]},
    {"name": "environment_objects", "type": "objects", "data": [{"x": 0, "y": 0, "asset": "tree_pine"}]}
  ],
  "locations": [
    {"name": "Town", "x": 5, "y": 8, "type": "TOWN"}
  ]
}
```

**Terrain Movement Speeds**:
| Terrain | Speed Multiplier |
|---------|------------------|
| Road/Bridge | 1.0 (fastest) |
| Dirt | 0.7 |
| Grass | 0.6 |
| Stone | 0.5 |
| Snow/Sand | 0.4-0.5 |
| Forest | 0.3 (slowest) |
| Water | Impassable |

**Location Types**: `TOWN`, `BATTLE`, `EVENT`, `CAMP`, `DUNGEON`, `EXIT`

### 2. Combat System (`scripts/combat/`)

Fire Emblem-inspired grid-based tactical combat.

**Key Stats**: HP, STR, MAG, SKL, SPD, LCK, DEF, RES, MOV

**Combat Formula**:

```
Damage = ATK - DEF (or RES for magic)
Hit Rate = (SKL × 2) + LCK + Weapon Hit - Enemy Avoid
Avoid = (SPD × 2) + LCK
Double Attack if: Attacker SPD >= Defender SPD + 5
Critical = 3× damage
```

**Weapon Triangle**:

```
Sword > Axe > Lance > Sword (+15 Hit, +1 Damage)
```

### 3. Dungeon System (`scripts/dungeon/`)

Slay the Spire-style branching paths.

**Room Types**: Combat, Elite, Treasure, Event, Rest, Shop, Boss

### 4. Resources

- **Supplies** - Consumed when traveling (1 per location hop)
- **Gold** - Currency for shops, earned from battles/events

## Autoload Singletons

- **GameManager** - Game state, party data, current run info
- **EventBus** - Global signals (combat_started, etc.)
- **SaveManager** - Save/load functionality
- **SceneLoader** - Scene transitions
- **AudioManager** - Sound/music
- **SettingsManager** - User preferences

## Asset Organization

**Tile Assets** (`assets/terrain/overworld/`):

- Kenney Medieval RTS pack
- Individual PNGs in `PNG/Default size/` (Tile, Environment, Structure folders)
- Tilesheet in `Tilesheet/`

**Asset Catalog** (`data/maps/asset_catalog.json`):
Maps friendly names to file paths:

```json
{
  "terrain": {"grass_plain_1": "Tile/medievalTile_57.png", ...},
  "environment": {"tree_pine": "Environment/medievalEnvironment_03.png", ...},
  "structures": {"castle_base": "Structure/medievalStructure_06.png", ...}
}
```

## Important Notes

1. **No Threat System** - The FTL-style "pursuing enemy" mechanic is NOT implemented
2. **Permadeath** - Units that die in combat are permanently lost
3. **Grid-based movement** - Combat uses grid tiles, overworld uses tile-based terrain
4. **JSON Maps** - Overworld maps are defined in JSON, not Godot TileMapLayer nodes directly
5. **Sprite-based rendering** - Map loader creates Sprite2D nodes from tile textures

## Common Tasks

### Adding a new map

1. Create JSON in `data/maps/`
2. Reference tile names from `asset_catalog.json`
3. Define locations with grid coordinates

### Adding new tile types

1. Add entry to `asset_catalog.json` under appropriate category
2. If new terrain type, update `get_terrain_type()` in `overworld_map_loader.gd`

### Adding location types

1. Update `LocationType` enum in `scripts/resources/location_data.gd`
2. Update `_trigger_location_event()` in `world_map.gd`
3. Update `get_color()` and `get_icon_text()` in `location_data.gd`
