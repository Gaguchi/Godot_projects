# 🎬 Scene-Centric Master Roadmap

**Philosophy**: Design the *Screens* first, then build the *Systems* to support them.
**Status**: Pre-Production Design
**Goal**: Define the exact Logic, Visuals, and UI for every scene the player sees.

---

## 🌍 SCENE 1: The Overworld (`WorldMap.tscn`)
*Context: The strategic layer. The player navigates nodes to choose their path.*

### 1.1 Visuals & Atmosphere
- [ ] **Background Layer**:
    - [ ] Parallax scrolling: 3 layers (Cloud foreground, Mountain midground, Star/Sky background).
    - [ ] Dynamic Tinting: Changes slightly based on Biome (Green for Forest, Orange for Desert).
- [ ] **The "Board" (Map Graph)**:
    - [ ] **Nodes**: NOT simple circles. 
        - [ ] Unvisited: Silhouette/Icon (e.g., Tower shape, Skull shape).
        - [ ] Available: Pulsing outline + "floating" motion.
        - [ ] Visited: Greyed out, slightly sunken.
    - [ ] **Paths**: Dotted lines or paved roads that "draw" themselves as you unlock regions.
- [ ] **Player Avatar**:
    - [ ] A mini-sprite of the Party Leader.
    - [ ] "Walking" animation plays while traveling along the bezier curve.
    - [ ] Dust particle emission at feet.

### 1.2 UX & UI Layout
- [ ] **Golden Rule**: UI should frame the map, not obscure it.
- [ ] **Top HUD (Global Info)**: `Height: 10% of screen`
    - [ ] Left: Gold Counter (animated ticker), "Day" Counter.
    - [ ] Right: Options Cog, Help Button.
    - [ ] Center: Current Biome Name (e.g., "The Whispering Woods").
- [ ] **Bottom HUD (Party Snapshots)**: `Height: 15% of screen`
    - [ ] Horizontal list of Mini-portraits.
    - [ ] Health Bars (Micro-sized) under portraits.
    - [ ] Status warnings (e.g., "Critical!" flashing icon).
- [ ] **Interaction Windows**:
    - [ ] **Node Tooltip**: Floating panel next to cursor. Shows Reward Icons (Gold, Item) and Threat Level (Skulls 1-5).

### 1.3 Underlying Logic
- [ ] `RegionLoader`: Deserializes the graph.
- [ ] `TravelManager`: Calculates travel duration (e.g., 2 seconds per node) and consumes Time/Food resources.
- [ ] `EncounterEngine`: When arriving at a node, rolls the specific scene to load next.

---

## ⚔️ SCENE 2: The Battlefield (`Battlefield.tscn`)
*Context: Tactical grid movement and decision making.*

### 2.1 Visuals & Camera
- [ ] **Camera Strategy**:
    - [ ] **Isometric-ish**: Tilted perspective (not flat top-down).
    - [ ] **Dynamic Zoom**: Scroll wheel zooms from "Whole Map" to "Unit Detail".
- [ ] **The Grid**:
    - [ ] **Visual Style**: Do NOT draw grid lines everywhere. Use *Tiles*.
        - [ ] Grass Tile, Sand Tile, Stone Tile.
    - [ ] **Overlays**: Only show grid boxes when selecting a unit.
        - [ ] Blue Tint: Move Range.
        - [ ] Red Tint: Attack Range.

### 2.2 UX & UI Layout
- [ ] **Screen Real Estate**:
    - [ ] **The Field**: Takes up 100% of the screen background. UI floats *over* it.
- [ ] **Unit "Billboards"**:
    - [ ] HP Bar floats *above* the unit sprite in world space.
    - [ ] Damage numbers pop off the unit in world space.
- [ ] **Unit Detail Panel (Selection)**: `Position: Bottom-Left` `Size: 20% width`
    - [ ] Large Portrait.
    - [ ] HP / MP Values.
    - [ ] Equipped Weapon Name.
- [ ] **Action Menu**: `Position: Next to Unit` (Radial or List)
    - [ ] Options: Move, Attack, Item, Wait.
- [ ] **Terrain Info**: `Position: Bottom-Right`
    - [ ] "Forest: Def +20%, Avoid +10%".

### 2.3 Underlying Logic
- [ ] `GridManager`: AStar pathfinding.
- [ ] `TurnSequencer`: Handles Phase changes.
- [ ] `UnitController`: Interprets clicks into grid coordinates.

---

## 🎬 SCENE 3: Combat Exchange (`CombatAction.tscn`)
*Context: The "Fire Emblem" zoom-in. A short, cinematic resolution of an attack.*

### 3.1 Visuals & Juiciness
- [ ] **The Stage**:
    - [ ] A "glimpse" of the biome. High-detail background art (blurred).
    - [ ] No Grid. Just two units facing each other on a "Floor" plane.
- [ ] **The Action**:
    - [ ] **Attacker**: Dash forward -> Swing Animation -> Impact Frame (Freeze frame for 0.1s) -> Follow through.
    - [ ] **Defender**:
        - [ ] Hit: Recoil animation + Flash White + Blood particles.
        - [ ] Dodge: Backstep or Side-step blur.
        - [ ] Block: Shield raise + Metal "Clang" spark.

### 3.2 UX & UI Layout
- [ ] **Cinematic Aspect Ratio**:
    - [ ] Black bars on Top/Bottom (Letterboxing) to sell the "Movie" feel?
- [ ] **VS HUD**: `Position: Bottom-Center` `Style: Versus Mode`
    - [ ] Left: One Player Name, HP Bar (Big), Hit %, Crit %.
    - [ ] Right: Enemy Name, HP Bar (Big), Hit %, Crit %.
    - [ ] **HP Drain**: The HP bar must drain *during* the hit, with a "catch up" yellow bar effect.

### 3.3 Underlying Logic
- [ ] `combat_resolver.gd`:
    - [ ] Receives `CombatResult` struct (Did it hit? Was it crit? Damage amount?).
    - [ ] Plays animations in sequence based on the result.
    - [ ] Auto-closes scene after 2 seconds.

---

## ⛺ SCENE 4: Party Management (`InventoryScreen.tscn`)
*Context: Gear management, leveling up, and preparation.*

### 4.1 Visuals & Metaphor
- [ ] ** Setting**: A "Camp" or "Barracks" background.
- [ ] **Paper Doll**: Shows the selected character standing there, changing weapon sprite when equipped.

### 4.2 UX & UI Layout
- [ ] **Layout Strategy**: Two-Panel Design.
    - [ ] **Left Panel (Roster)**: List of all units. Click to select.
    - [ ] **Center Panel (Paper Doll)**: The character visual + Stats (Str, Dex, Spd).
    - [ ] **Right Panel (Inventory)**: Grid of items.
- [ ] **Drag & Drop**:
    - [ ] Drag Sword from Bag -> Character Hand slot.
    - [ ] Visual Item Icons (Sword, Potion, Bow). No text lists!
- [ ] **Sorting**: "Sort by Type", "Sort by New".

### 4.3 Underlying Logic
- [ ] `InventoryManager`: Swaps data between "Party Inventory" and "Unit Equipment".

---

## � SCENE 5: Narrative / Event (`EventScene.tscn`)
*Context: Dialogue, story beats, and choices.*

### 5.1 Visuals
- [ ] **Character Portraits**:
    - [ ] Large, high-res art.
    - [ ] **Expressions**: `Neutral`, `Angry`, `Happy`, `Sad` variants.
    - [ ] **Movement**: Bump up when speaking. Dim/Darken when listening.
- [ ] **Background**: Full screen art (Village, Ruins, Tavern).

### 5.2 UX & UI Layout
- [ ] **Dialogue Box**: `Position: Bottom` `Height: 25%`
    - [ ] Background: Dark translucent glass.
    - [ ] Text: Typewriter effect (letters appear one by one).
- [ ] **Speaker Nameplate**: Attached to the top-left of the dialogue box.
- [ ] **Choice Selection**:
    - [ ] When a choice is needed, Dialogue Box fades, 2-3 Buttons appear in Center Screen.

### 5.3 Underlying Logic
- [ ] `DialogueParser`: Reads JSON/Yarn/Text files.
- [ ] `FlagManager`: Sets `met_merchant = true` based on choices.

---

## 🔮 Future Scenes (To Be Designed)
- [ ] **Trading Screen**: Similar to Party Screen but with detailed "Merchant" entity.
- [ ] **Skill Tree**: A constellation star-map of upgrades?
- [ ] **GameOver**: A summary of stats (Enemies killed, Turns taken) + "Try Again".
