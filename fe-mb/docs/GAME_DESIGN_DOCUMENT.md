# FE_MB - Game Design Document
> **Fire Emblem × Roguelite: A Tactical Survival Journey**

Last Updated: January 10, 2026

---

## 1. Overview

### 1.1 Concept
**FE_MB** (working title) is a tactical roguelite that combines Fire Emblem-style turn-based combat with procedural dungeon exploration and FTL-style overworld navigation. Players lead a party of units through a war-torn land, making strategic choices about where to travel, which battles to fight, and how to manage limited resources—all while facing permanent death for fallen units.

### 1.2 Core Pillars
1. **Tactical Combat** - Fire Emblem-inspired grid-based battles with weapon triangles, stat-based calculations, and positioning importance
2. **Permadeath Stakes** - Units that fall in battle are gone forever, making every decision meaningful
3. **Resource Tension** - Limited supplies, threatening pursuit, and morale create constant pressure
4. **Procedural Variety** - Each run features different dungeon layouts and encounters
5. **Unique Characters** - Every recruited unit is a distinct individual with personal quests and non-generic growth

### 1.3 Target Experience
The player should feel like a commander leading a desperate band of warriors through hostile territory. Every battle risks permanent loss, every choice matters, and survival requires both tactical excellence and strategic resource management.

---

## 2. Game Structure

### 2.1 World Structure: Region-Based Progression
The game is divided into **Regions**, each with unique locations and escalating difficulty.
- **Regions**: Self-contained areas with 6-10 interconnected locations
- **Linear Progression**: Complete a region by reaching the EXIT location
- **Backtracking**: Within a region, you can revisit previous locations (if connected)
- **Threat System**: An advancing threat forces forward momentum

### 2.2 Navigation (FTL-Style Node Map)
Each region is a **Node-Based Map** with connected locations.
- **Movement**: Click connected locations to travel. Each step costs 1 Supply.
- **Location Types**:
    - **Town** 🏘️: Shop, recruit units, rest
    - **Battle** ⚔️: Combat encounter
    - **Event** ❓: Random narrative event with choices
    - **Camp** ⛺: Rest and heal the party
    - **Dungeon** 🏰: Enter a multi-floor dungeon (Slay the Spire-style)
    - **Exit** 🚪: Advance to the next region
- **Connections**: Locations are connected by paths; you can only travel along paths
- **Threat Timer**: An enemy force pursues you. After X turns, threatened locations become dangerous or lost

### 2.3 Resources
- **Supplies**: Consumed when traveling (1 per step). Running out forces risky encounters.
- **Gold**: Earned from battles/events, spent at shops and towns.

---

## 3. Dungeon System (Slay the Spire-Style)

### 3.1 Structure
Dungeons consist of **procedurally generated floors** with branching paths from entrance to boss.

```
        [BOSS] ← Row 16
       ╱  │  ╲
      ●   ●   ● ← Row 15
      │╲ ╱│╲ ╱│
      ●  ●  ●  ● ← Middle rows (combat, events, shops, etc.)
      │╲ ╱│╲ ╱│
      ●  ●  ●  ●
       ╲ │ ╱
      [ENTRANCE] ← Row 0
```

### 3.2 Room Types
| Room Type | Icon | Description |
|-----------|------|-------------|
| **Combat** | ⚔️ | Standard enemy encounter (2-3 enemies) |
| **Elite** | 💀 | Tough fight with better rewards |
| **Treasure** | 💰 | Chest with gold/items |
| **Event** | ❓ | Choice-based random event |
| **Rest** | 🔥 | Choice: Heal party OR Apply temporary combat buff (e.g., "Survive fatal blow once") |
| **Shop** | 🛒 | Spend gold on items/healing |
| **Boss** | 👿 | Floor boss (must defeat to complete dungeon) |
| **Entrance** | 🚪 | Starting room |

### 3.3 Generation Rules
- 3-4 branching paths through each floor
- 15 rows of rooms plus entrance and boss
- Early rows favor combat (70% combat, 15% event, 15% treasure)
- Middle rows have mixed distribution
- Pre-boss rows favor rest sites and elites
- Difficulty scales with floor number and region difficulty

### 3.4 Completion Rewards
- Defeating the boss completes the dungeon
- Morale boost (+10) for completion
- Gold and item rewards
- Optional: Flee to exit early (morale penalty: -5)

---

## 4. Combat System (Fire Emblem-Style)

### 4.1 Core Mechanics

#### Stats
| Stat | Abbreviation | Effect |
|------|--------------|--------|
| HP | HP | Health points |
| Strength | STR | Physical damage |
| Magic | MAG | Magic damage |
| Skill | SKL | Hit rate, crit rate |
| Speed | SPD | Avoid, double attacks |
| Luck | LCK | Crit avoid, various checks |
| Defense | DEF | Physical damage reduction |
| Resistance | RES | Magic damage reduction |
| Movement | MOV | Tiles per turn |

#### Combat Formulas
```
Attack Power = STR + Weapon Might (or MAG for tomes)
Hit Rate = (SKL × 2) + LCK + Weapon Hit - Enemy Avoid
Avoid = (SPD × 2) + LCK
Crit Rate = (SKL / 2) + Weapon Crit
Crit Avoid = LCK
Attack Speed = SPD - (Weapon Weight - STR, min 0)
```

#### Double Attacks
A unit can perform a follow-up attack if their Attack Speed exceeds the enemy's by **5 or more**.

#### Critical Hits
Critical hits deal **3× normal damage**.

### 4.2 Weapon Triangle
```
    SWORD
   ↗     ↘
LANCE ← AXE

Sword beats Axe → +15 Hit, +1 Damage
Axe beats Lance → +15 Hit, +1 Damage  
Lance beats Sword → +15 Hit, +1 Damage
```

> **Note:** Bows, Tomes, and Staves are outside the triangle.

### 4.3 Weapon Types
| Type | Range | Notes |
|------|-------|-------|
| Sword | 1 | Triangle vs Axe/Lance |
| Lance | 1 | Triangle vs Sword/Axe |
| Axe | 1 | Triangle vs Lance/Sword |
| Bow | 2+ | Can only attack from range |
| Tome | 1-2 | Magic damage (targets RES) |
| Staff | 1-2 | Healing (no combat) |

### 4.4 Combat Flow
```
1. Attacker initiates
2. Calculate forecast (damage, hit, crit for both sides)
3. Attacker attacks
4. Defender counters (if in range and alive)
5. Attacker follow-up (if faster)
6. Defender follow-up counter (if faster and alive)
```

### 4.5 Terrain
- Terrain provides defense and avoid bonuses
- Some terrain blocks movement (walls, water)
- Forests, mountains, etc. provide tactical advantages

### 4.6 Morale System
Party morale affects combat performance:
| Morale | Effect |
|--------|--------|
| 80+ | +5 Hit/Avoid |
| 50-79 | No modifier |
| 25-49 | -5 Hit/Avoid |
| 0-24 | -10 Hit/Avoid |

Morale changes:
- Unit death: -10
- Starvation: -15
- Dungeon completed: +10
- Dungeon fled: -5

---

## 5. Unit System

### 5.1 Unit Classes
| Class | Specialty | Stat Focus |
|-------|-----------|------------|
| **Fighter** | Balanced melee | STR, HP |
| **Knight** | Tanky defender | DEF, HP (low SPD) |
| **Cavalier** | Mobile striker | MOV, STR |
| **Archer** | Ranged physical | SKL, SPD |
| **Mage** | Magical damage | MAG, RES |
| **Cleric** | Healer | MAG, LCK |
| **Thief** | Fast utility | SPD, SKL, LCK |
| **Lord** | Player's main character | Balanced (Branching Promotions) |
| **Others** | Unique characters | Linear progression via Personal Quests |

### 5.2 Growth Rates
Each unit has growth rates (0-100%) for each stat. On level-up, each stat has its growth% chance to increase by 1.

**Example Fighter Growth Rates:**
- HP: 50% | STR: 40% | MAG: 0% | SKL: 35%
- SPD: 35% | LCK: 30% | DEF: 25% | RES: 20%

### 5.3 Experience
- Units gain EXP from combat actions
- 100 EXP = Level up
- EXP scales based on level difference with enemies

### 5.4 Equipment
- Each unit can equip one weapon
- Each unit can equip one weapon
- Weapons have **Infinite Durability** (they never break)
- Weapons are balanced by weight, accuracy, and special effects/drawbacks

### 5.5 Party Management
- Maximum party size: 6 units
- Starting party size: 3 units
- Additional units can be recruited in towns
- Dead units are permanently removed

---

## 6. Item System

### 6.1 Item Types
| Type | Description |
|------|-------------|
| **Weapon** | Swords, lances, axes, bows, tomes, staves |
| **Consumable** | Healing items, stat boosters |
| **Key Item** | Story items, special unlocks |

### 6.2 Weapon Properties
| Property | Description |
|----------|-------------|
| Might | Damage bonus added to STR/MAG |
| Hit | Accuracy bonus |
| Crit | Critical hit bonus |
| Weight | Reduces Attack Speed if > STR |
| Range | Attack distance (tiles) |
| Special | Unique effects (e.g. "Effective vs Armor") |

---

## 7. Progression Systems

### 7.1 Within a Run
- Level up units through combat
- Acquire gold from battles and events
- Find/buy better equipment
- Unlock new party members through recruitment

### 7.2 Meta Progression (Future)
> *Planned for later development*
- Permanent unlocks between runs
- New unit types
- Starting bonuses
- Expanded story elements

---

## 8. UI/UX Design

## 8. UI/UX Design

### 8.1 Design Philosophy: "Clean & Dense"
- **Function over Form**: Use standard, opaque panels. No "Diegetic" hidden menus.
- **Information Density**: Show HP/MP/XP numbers directly on bars. Don't hide them.
- **HUD Layout**:
    - **Top Bar**: Resources (Gold, Food, Time). Always visible.
    - **Bottom Bar**: Party Status (HP/MP) + Current Location Name.
    - **Log**: Scrollable text log in bottom-left for combat details.

### 8.2 Scene-Specific UX

#### 8.2.1 The World Map
- **HUD**: Semi-transparent black overlays (`Color(0,0,0,0.5)`) at Top/Bottom to frame the view.
- **Minimap**: Bottom-Right circular minimap.
- **Nodes**: Icons (Town, Dungeon) drawn *on top* of the TileMap.

#### 8.2.2 Tactical Combat Grid
- **The "Field" View**:
    - **Unit Markers**: 3D Stylized Pawns or High-Res Sprites on the grid.
    - **HP Bars**: Floating curved bars above heads (World Space).
    - **Damage Text**: Physics-based numbers that bounce off units.
    - **Grid Overlay**: Only visible during movement selection.

#### 8.2.3 Combat Exchange (The "Mini-Scene")
When an attack connects, the camera changes context:
1.  **Transition**: Screen cross-dissolves or zooms into a `SubViewport`.
2.  **The Scene**: High-detail side view (Fighting Game style).
3.  **The Action**:
    - Attacker lunges -> Defender blocks (Sparks fly).
    - HP Bar drains with a "shatter" effect.
    - "CRITICAL" text slams onto the screen.
4.  **Return**: Snap back to Tactical View.

#### 8.2.4 Inventory & Party
- **Visuals**: A campsite scene.
- **Management**: Drag items from a "Loot Sack" (bottom right) onto the Unit's "Paper Doll" (center).
- **Consumables**: Potions hanging on the unit's belt.

### 8.3 Color Palette (Diegetic)
- **Paper/Parchment**: `#f5edd6` (Backgrounds)
- **Ink Black**: `#2c2c2c` (Text, Outlines)
- **Dried Blood**: `#8a0303` (Enemy Health, Threat)
- **Royal Gold**: `#d4af37` (Rare Items, Elite borders)

---

## 9. Technical Architecture

### 9.1 Autoload Singletons
| Singleton | Responsibility |
|-----------|---------------|
| `GameManager` | Run state, party, resources, floor tracking |
| `EventBus` | Global signal broadcasting |
| `SaveManager` | Save/load functionality |

### 9.2 Resource Types
| Resource | Purpose |
|----------|---------|
| `UnitData` | Unit stats, class, growth rates, equipment |
| `ItemData` | Weapons, consumables, key items |
| `LocationData` | World map location info |
| `RegionData` | Region configuration and locations |
| `DungeonRoomData` | Dungeon room info |

### 9.3 Key Scripts
| Script | Purpose |
|--------|---------|
| `CombatManager` | Combat calculations and resolution |
| `DungeonGenerator` | Procedural dungeon floor generation |
| `WorldMap` | Overworld navigation controller |
| `DungeonMap` | Dungeon navigation controller |

### 9.4 Scene Structure
```
/scenes
├── combat/
│   ├── battlefield.tscn      # Main combat scene
│   └── test_battle.tscn      # Test scene
├── dungeon/
│   ├── dungeon_map.tscn      # Dungeon navigation
│   └── dungeon_room_node.tscn # Visual room node
├── overworld/
│   ├── world_map.tscn        # Main overworld scene
│   ├── location_node.tscn    # Visual location node
│   └── test_world_map.tscn   # Test scene
├── units/
│   └── unit.tscn             # Visual unit representation
└── ui/
    └── damage_number.tscn    # Floating damage text
```

---

## 10. Current Implementation Status

### ✅ Completed
- [x] Core unit data system with stats and growth rates
- [x] Fire Emblem combat formulas (damage, hit, crit, doubles)
- [x] Weapon triangle system
- [x] Item/weapon system with durability
- [x] FTL-style world map with fixed regions
- [x] Threat and resource systems
- [x] Slay the Spire-style dungeon generator
- [x] Dungeon room types and connections
- [x] Game manager with party/resource tracking
- [x] Event bus for global signals
- [x] Region data loading system

### 🚧 In Progress
- [ ] Combat gameplay (grid movement, AI)
- [ ] Visual feedback and animations
- [ ] Room event implementations
- [ ] Shop/recruitment UI

### 📋 Planned
- [ ] Full battle scenes with grid
- [ ] Enemy AI
- [ ] Save/load functionality
- [ ] Events with choices and consequences
- [ ] Boss encounters
- [ ] Class promotions
- [ ] Meta-progression systems
- [ ] Story/narrative elements
- [ ] Audio (music, SFX)
- [ ] Visual polish and art

---

## 11. Design Philosophy

### 11.1 Risk vs Reward
Every decision should involve meaningful trade-offs:
- Fight more battles for EXP/gold, but risk unit death
- Explore more of the map, but advance the threat
- Use powerful weapons, but they break faster

### 11.2 Emergent Stories
The combination of permadeath, random events, and player choices should create memorable narratives:
- "My archer sacrificed herself to save the mage"
- "We barely escaped the dungeon with two units left"
- "Against all odds, a level 1 recruit landed the killing blow on the boss"

### 11.3 Accessibility with Depth
- Core mechanics should be easy to understand
- Depth comes from interactions between systems
- Clear feedback on all calculations (show your work)

---

## 12. Future Considerations

### 12.1 Potential Features
- **Character Supports:** Build relationships between units for bonuses
- **Skills/Abilities:** Unique character abilities beyond stats
- **Class Promotions:** Advanced classes at high levels
- **Challenge Modes:** Harder difficulty modifiers
- **Daily Runs:** Seeded runs for community competition

### 12.2 Art Direction (Confirmed)
- **Resolution**: 32x32 pixels per tile.
- **Perspective**: Top-Down (Zelda/Stardew style), NOT Isometric.
- **Assets**: 
    - **World**: Kenney RPG Urban/Wild packs.
    - **UI**: Kenney Pixel UI Pack (Clean, 9-slice panels).
    - **Font**: Pixel-art monospace font (Silver or m5x7).
- **Visual Effects**:
    - **Fog of War**: "Paper Map" texture overlaid on unexplored areas. Burns away when explored.
    - **Lighting**: Day/Night tint `CanvasModulate`.

### 12.3 Audio Design
- Orchestral/chiptune hybrid soundtrack
- Satisfying combat sound effects
- Ambient world map atmosphere
- Victory/defeat themes

---

## 13. Appendix

### A. Formula Reference

#### Damage Calculation
```gdscript
var attack_power = attacker.strength + weapon.might
var defense = defender.defense + terrain_bonus
if weapon.weapon_type == TOME:
    attack_power = attacker.magic + weapon.might
    defense = defender.resistance
var damage = max(0, attack_power - defense + triangle_bonus)
```

#### Hit Rate Calculation
```gdscript
var hit = attacker.skill * 2 + attacker.luck + weapon.hit
var avoid = defender.speed * 2 + defender.luck + terrain_bonus
var final_hit = clamp(hit - avoid + (triangle * 15) + morale_mod, 0, 100)
```

#### Double Attack Check
```gdscript
var attacker_as = attacker.speed - max(0, weapon.weight - attacker.strength)
var defender_as = defender.speed - max(0, def_weapon.weight - defender.strength)
var can_double = attacker_as >= defender_as + 5
```

### B. Balance Targets
| Metric | Target |
|--------|--------|
| Average run length | 45-60 minutes |
| Battles per region | 3-5 |
| Dungeons per region | 1-2 |
| Unit death rate | 1-2 per run |
| Gold income vs expenses | Slight scarcity |

### C. Difficulty Modifiers
| Element | Easy → Hard Scaling |
|---------|---------------------|
| Enemy stats | Base × (0.8 - 1.3) |
| Elite spawn rate | 5% - 15% |
| Threat turns | 15 - 10 |
| Starting supplies | 15 - 8 |
| Starting gold | 100 - 30 |

---

*This document is a living reference and will be updated as development progresses.*
