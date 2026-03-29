# FE_MB — Project Overview

> A tactical roguelite combining Fire Emblem grid combat, FTL overworld navigation, and Slay the Spire card mechanics. Built in Godot 4.6 (GDScript).

---

## Table of Contents

1. [Core Game Loop](#1-core-game-loop)
2. [The World & Story](#2-the-world--story)
3. [Overworld & Travel](#3-overworld--travel)
4. [Combat System](#4-combat-system)
5. [Card System](#5-card-system)
6. [Units & Classes](#6-units--classes)
7. [Economy & Items](#7-economy--items)
8. [Towns & Services](#8-towns--services)
9. [Quests & Events](#9-quests--events)
10. [UI & Visual Design](#10-ui--visual-design)
11. [Technical Architecture](#11-technical-architecture)
12. [Current Content Inventory](#12-current-content-inventory)
13. [Known Issues & Future Work](#13-known-issues--future-work)

---

## 1. Core Game Loop

```
Main Menu → New Run → Prologue → Overworld Map
                                      ↓
                              Pick destination
                                      ↓
                          Travel (per-hop rolls)
                           ↙               ↘
                  Encounter (35%)     Arrive safely
                   ↙        ↘              ↓
              Dialogue    Battle      Location Event
              (choices)   (cards)     (Town/Camp/Dungeon)
                   ↘        ↓              ↓
                    Resume travel     Shop / Rest / Quest
                          ↓
                   Reach The Iron Throne → Victory
                   Party wiped → Game Over
```

**One sentence:** Travel across a dangerous overworld, survive random encounters with card-based tactics, manage resources in towns, and complete quests — with permadeath making every decision matter.

**Key tensions:**
- More hops = more encounter chances + more food burned → route choice matters
- Spending gold on weapons vs. healing vs. food
- Capturing enemies alive (for bounty gold) vs. killing them (safer)
- Permadeath means losing a unit is permanent for the entire run

---

## 2. The World & Story

### Setting
Dark fantasy borderlands — think Game of Thrones meets Fire Emblem. The visual style is "Stone & Steel" with ember accents, iron borders, and parchment text.

### Premise
A small warband (Roy, Marcus, Lilina) journeys through three increasingly dangerous regions toward The Iron Throne. Along the way they fight bandits, help travelers, take bounty contracts, and grow stronger through combat and equipment.

### Regions (3)

| Region | Theme | Nodes | Key Locations |
|--------|-------|-------|---------------|
| **The Borderlands** | Frontier grasslands | 16 | Pine Crossing, Riverside Market, Smuggler's Cave |
| **Thornwood Wilds** | Dark forest | 15 | Thornwood Chapel, Ancient Ruins, Witch's Hut |
| **Ashfall Peaks** | Volcanic mountains | 15 | Ashfall Outpost, Iron Mine, The Iron Throne |

### Map Layout
46 nodes total connected in an FTL-style graph. Multiple paths through each region with branching choices. The player starts at Frontier Camp (west) and must reach The Iron Throne (east).

| Node Type | Count | Purpose |
|-----------|-------|---------|
| TOWN | 5 | Shop, inn, tavern, quests |
| CAMP | 29 | Rest (1 food → 20% heal) |
| DUNGEON | 5 | Quest-locked combat areas |
| EXIT | 1 | Victory condition (The Iron Throne) |

### Current Story Content
- **Prologue:** 6-line intro on first run (Roy, Marcus, Lilina set out)
- **Blood Ties quest:** Bounty hunter Kael asks you to capture her brother Daren alive. Multi-stage quest with branching outcomes (capture vs. kill)
- **3 travel dialogues:** Road merchant, bandit shakedown, wounded traveler — each with meaningful choices and resource effects

---

## 3. Overworld & Travel

### How Travel Works
1. Player clicks a connected location node on the map
2. The pawn moves hop-by-hop along the path
3. **Each hop:**
   - Costs 1 food
   - 35% chance of random encounter (dialogue or battle)
   - If encounter triggers: resolve it, then resume remaining path
4. On arrival: trigger location event (town menu, camp popup, etc.)

### Food & Starvation
- Start with 15 food
- 1 food consumed per hop
- At 0 food: party takes 3 HP starvation damage per hop
- Buy food rations at shops (200g → 3 food) or rest at camps (1 food → 20% heal)

### Travel Encounters
Encounters are weighted random from a pool of 7 events:

| Event | Type | Weight | Notes |
|-------|------|--------|-------|
| Road Merchant | Dialogue | 10 | Buy/sell opportunity |
| Bandit Threat | Dialogue | 8 | Pay tribute or fight |
| Wounded Traveler | Dialogue | 6 | Help for reward or ignore |
| Bandit Ambush | Battle | 8 | 2 fighters + 1 archer |
| Wolf Pack | Battle | 6 | 3 wolves (fast, fragile) |
| Brigand Raiders | Battle | 4 | 2 fighters + 1 chief (tough) |
| Daren's Gang | Battle | 100 | Quest-locked, one-shot |

Higher weight = more common. Events can have conditions (flags, quest states) and one-shot events only trigger once per run.

### Post-Battle Resume
When a battle interrupts travel, the remaining path is saved to `GameManager.pending_travel_path`. After combat ends (win or lose), the overworld resumes travel automatically.

---

## 4. Combat System

### Overview
Fire Emblem-style grid tactics on a 14x10 tile battlefield (64px tiles, 896x640 pixels). Speed-based turn order where each unit acts individually. Player units use cards; enemies use traditional AI attacks.

### Turn Flow

```
Build Turn Queue (sorted by SPD)
        ↓
  Next Unit's Turn
   ↙            ↘
Player Unit    Enemy Unit
    ↓               ↓
MOVE PHASE      AI decides:
(move or skip)   → pick target
    ↓              → move toward
ACTION PHASE      → attack
(play cards,      → end turn
 capture, or        ↓
 end turn)     Next Unit
    ↓
Next Unit
```

### Player Turn Phases
1. **MOVE PHASE**: Free movement within unit's MOV range. Can skip. Movement highlights show reachable tiles.
2. **ACTION PHASE**: Draw 5 cards, get 3 AP. Play cards until AP runs out, hand is empty, or player presses End Turn. Can also attempt captures.

### Damage Formula (Deterministic)
No hit/miss/crit RNG. All damage is calculated:

```
Physical: DMG = (card_base + caster.STR) - floor(target.DEF/2) - terrain_bonus
Magic:    DMG = (card_base + caster.MAG) - floor(target.RES/2) - terrain_bonus
Minimum damage = 0
```

**Weapon triangle** applies +1/-1 damage: Sword > Axe > Lance > Sword

### Armor System
- Each unit has armor = DEF points (breakable shield)
- Physical damage hits armor first, overflow goes to HP
- **Magic is armor-piercing:** 50% damages armor, 50% bypasses directly to HP
- Mages and Clerics have 0 armor (glass cannons)
- Armor resets at the start of each battle

### Terrain

| Tile | Move Cost | DEF Bonus |
|------|-----------|-----------|
| Plain | 1 | 0 |
| Forest | 2 | +1 |
| Mountain | 3 | +2 |
| Fort | 1 | +3 |
| Water | Impassable | — |

### Capture Mechanic
Units can attempt to capture enemies instead of killing them. Captured enemies can be turned in at tavern bounty boards for gold.

**Requirements:**
- Target must be at ≤50% HP
- Costs 2 AP

**Chance calculation:**
```
Base:     0% if target 25-50% HP, 25% if target <25% HP
Surround: +20% per adjacent ally (4-directional)
Class:    +10% if attacker is BOUNTY_HUNTER
Cap:      100% maximum
```

Capture buttons appear above eligible enemies during the action phase, color-coded by chance (green ≥60%, amber 20-59%, red <20%).

### Enemy AI
Enemies use traditional attacks (not cards). AI scoring per target:
- Base = damage dealt to target
- +100 if can kill
- +20 if target is wounded (<50% HP)
- +15/-10 for weapon triangle advantage/disadvantage
- +(10 - distance) × 2 proximity bonus
- +15 focus fire bonus per other enemy targeting same unit

Fallback: if no target in range, move toward closest player unit.

### Battle End
- **Victory:** All enemies dead or captured (bound)
- **Defeat:** All player units dead
- **Rewards:** 10 + (enemy_level × 5) gold per enemy defeated

---

## 5. Card System

### Design Philosophy
Replaces Fire Emblem's hit/miss/crit RNG with Slay the Spire-inspired deterministic cards. Player has full information and full control. Enemies do NOT use cards (asymmetric design).

### Deck Basics
- Each unit has a **12-card deck** based on their class
- **Draw 5** cards at the start of each turn (capped at hand size)
- **3 AP** per turn to spend on cards (costs range 1-3 AP)
- **Discard** remaining hand at end of turn
- **Reshuffle** discard pile into draw pile when draw pile is empty

### Card Types

| Type | Color | Description |
|------|-------|-------------|
| **Attack** | Red | Physical damage, uses STR |
| **Spell** | Purple | Magic damage (armor-piercing), uses MAG |
| **Skill** | Blue | Utility (draw cards, gain AP, armor, heal, capture) |
| **Item** | Green | Consumable, removed from deck after use |

### Targeting Modes

| Target | Behavior |
|--------|----------|
| ENEMY | Click single enemy in range |
| ALLY | Click single ally in range |
| SELF | Auto-resolves on caster |
| ALL_ENEMIES | Hits all enemies (no targeting needed) |
| ALL_ALLIES | Heals all allies (no targeting needed) |
| GROUND | Click tile, AOE hits radius around it |

### Card Effects
Cards can have additional effects beyond damage/healing:
- **draw** — Draw extra cards (uncapped, like Slay the Spire)
- **ap** — Gain bonus AP this turn
- **temp_armor** — Add temporary armor points
- **self_damage** — Risk/reward (e.g., Reckless Blow)
- **subdue** — Trigger capture attempt
- **immobilize** — Target can't move next turn
- **steal_gold** — Loot gold from enemy

### Combat UX
- **Card hover:** Shows range preview on grid (ember highlight)
- **Target hover:** Shows damage preview number over enemy (red, with "KO!" indicator)
- **AOE preview:** Purple highlight for ground-targeted spells
- **Targeting label:** "Select target for [Card Name] (Right-click to cancel)"
- **Deck info:** Draw pile count + discard pile count shown in hand UI

### 9 Class Decks

Each class has a thematically distinct 12-card deck:

| Class | Signature Cards | Playstyle |
|-------|----------------|-----------|
| **LORD** | Slash, Rally, Rapier Thrust, Inspiring Strike, Double Strike | Balanced attacker with card draw and AP generation |
| **KNIGHT** | Lance Thrust, Shield Wall, Heavy Blow, Fortify, Bulwark | Tank — high armor gain, moderate damage |
| **CAVALIER** | Charge, Trample, Swift Strike, Gallop, Lance Fury | Mobile — AP generation, multi-hit |
| **FIGHTER** | Cleave, Wild Swing, Reckless Blow, Battle Cry, Axe Fury | Glass cannon — huge damage, self-damage risk |
| **ARCHER** | Quick Shot, Aimed Shot, Pin Down, Volley, Evasion | Ranged (2-3) — control via immobilize, AOE volley |
| **MAGE** | Fire, Thunder, Blaze, Focus, Arcane Burst, Barrier | Ranged magic — AOE specialist, armor-piercing |
| **CLERIC** | Heal, Mend, Smite, Prayer, Mass Heal, Barrier | Support — heals allies, light magic damage |
| **THIEF** | Quick Stab, Backstab, Flurry, Smoke Bomb, Dodge, Steal | High tempo — 0-cost cards, draw 3, steal gold |
| **BOUNTY_HUNTER** | Crossbow Bolt, Net Throw, Capture, Track Prey, Headshot | Control — immobilize, capture, SKL-scaling |

---

## 6. Units & Classes

### Starter Party

| Unit | Class | HP | STR | MAG | SKL | SPD | DEF | RES | Weapon |
|------|-------|---:|----:|----:|----:|----:|----:|----:|--------|
| **Roy** | LORD | 22 | 6 | 1 | 6 | 7 | 5 | 2 | Iron Sword |
| **Marcus** | KNIGHT | 28 | 8 | 0 | 7 | 4 | 10 | 1 | Iron Lance |
| **Lilina** | MAGE | 18 | 1 | 8 | 5 | 6 | 3 | 7 | Fire Tome |

### Class Archetypes (9 classes)

| Class | Role | Key Stats | Armor? |
|-------|------|-----------|--------|
| LORD | Balanced leader | STR, SKL, SPD | Yes |
| KNIGHT | Frontline tank | STR, DEF, HP | Yes (high) |
| CAVALIER | Mobile striker | STR, SPD | Yes |
| FIGHTER | Damage dealer | STR, HP | Yes |
| ARCHER | Ranged attacker | STR, SKL | Yes |
| MAGE | Magic damage | MAG, RES | **No** (glass cannon) |
| CLERIC | Healer/support | MAG, RES | **No** (glass cannon) |
| THIEF | Fast/utility | SKL, SPD, LCK | Yes (low) |
| BOUNTY_HUNTER | Capture specialist | SKL, STR | Yes |

### Stats
- **HP** — Health points
- **STR** — Physical damage scaling
- **MAG** — Magic damage and healing scaling
- **SKL** — Skill-based card damage, some card effects
- **SPD** — Turn order priority
- **LCK** — Minor combat bonuses
- **DEF** — Physical damage reduction (also determines armor)
- **RES** — Magic damage reduction
- **MOV** — Movement range on grid (tiles per turn)

### Growth Rates
Each stat has a growth rate (% chance to increase on level-up). Example: Roy has 80% HP growth, 50% STR growth, 5% MAG growth — so he grows strong physically but never becomes a mage.

### Permadeath
Units that die in combat are permanently removed from the party for the rest of the run. No resurrection.

---

## 7. Economy & Items

### Resources

| Resource | Start | Sources | Sinks |
|----------|------:|---------|-------|
| **Gold** | 80 | Battle rewards (10 + level×5 per kill), bounties, steal card, dialogue rewards | Shops, inn healing, tavern tips |
| **Food** | 15 | Buy food rations (200g → 3 food) | 1 per travel hop, 1 per camp rest |

### Item Catalog (12 items)

**Weapons:**

| Item | Type | Might | Hit | Weight | Range | Price |
|------|------|------:|----:|-------:|------:|------:|
| Iron Sword | Sword | 5 | 90 | 5 | 1 | 460g |
| Steel Sword | Sword | 8 | 75 | 10 | 1 | 700g |
| Iron Lance | Lance | 7 | 80 | 8 | 1 | 560g |
| Steel Lance | Lance | 11 | 70 | 13 | 1 | 840g |
| Iron Axe | Axe | 8 | 75 | 10 | 1 | 500g |
| Iron Bow | Bow | 6 | 85 | 5 | 2 | 520g |
| Fire | Tome | 5 | 90 | 4 | 1-2 | 600g |
| Thunder | Tome | 8 | 80 | 6 | 1-2 | 900g |
| Heal Staff | Staff | — | — | 3 | 1 | 800g |

**Consumables:**

| Item | Effect | Uses | Price |
|------|--------|-----:|------:|
| Vulnerary | Heal 10 HP | 3 | 300g |
| Elixir | Full heal | 3 | 3000g |
| Food Rations | +3 food | 1 | 200g |

Sell price = 50% of buy price.

### Bounty System
Captured enemies can be turned in at tavern bounty boards:
- Level 1-2: 20g
- Level 3-4: 40g
- Level 5+: 60g
- Special targets (e.g., Daren): custom bounty value (50g)

---

## 8. Towns & Services

### Town Menu (Mount & Blade style)
Full-screen menu with sidebar navigation and content panels.

| Service | Status | Description |
|---------|--------|-------------|
| **Inn** | Working | Heal all units for 8g per unit |
| **Shop** | Working | Buy/sell weapons and consumables |
| **Tavern** | Working | Rumors (gameplay tips), accept quests, bounty board, "Buy a Round" (3g for tips) |
| **Guild** | Locked | Future: mercenary contracts |
| **Arena** | Locked | Future: practice combat for rewards |

### Town Data (5 towns)
Each town has a JSON file defining available services and shop inventory:

| Town | Region | Notable Stock |
|------|--------|--------------|
| Pine Crossing | Borderlands | Iron Sword, Iron Lance, Vulnerary, Food — Blood Ties quest |
| Riverside Market | Borderlands | Wider selection, Iron Axe |
| South Junction | Borderlands | Steel weapons available |
| Thornwood Chapel | Thornwood | Tomes, Heal Staff |
| Ashfall Outpost | Ashfall | Steel weapons, Elixirs |

### Camp Rest
Simple popup: spend 1 food to heal party 20% of max HP. Disabled if food = 0.

---

## 9. Quests & Events

### Quest System
JSON-driven multi-stage quests with flag-based progression. Quest indicators ("!") appear on map nodes. Quest log overlay accessible from overworld HUD.

### Current Quest: Blood Ties

**Premise:** Bounty hunter Kael asks you to capture her brother Daren alive.

| Stage | Objective | Location |
|-------|-----------|----------|
| 0 | Accept quest from Kael | Pine Crossing Tavern |
| 1 | Find and defeat Daren's gang | Travel encounter (one-shot) |
| 2 | Return with Daren (alive or dead) | Pine Crossing |

**Branching outcomes:**
- **Captured alive:** Kael is grateful, potential recruitment reward
- **Killed:** Kael is disappointed, 80g consolation bounty

### Dialogue System
Visual novel-style dialogue box with speaker name, text, and choice buttons. Supports:
- **Branching choices** with conditions (e.g., "only show if has_flag X")
- **Stat checks** with animated roll display (e.g., "Roll STR vs difficulty 15")
- **Effects** on choice: add gold, add food, set flags, start quests, trigger combat, recruit units

### Dialogue Format (JSON)
```json
{
  "id": "dialogue_id",
  "nodes": {
    "start": {
      "speaker": "Kael",
      "text": "I need your help tracking someone...",
      "choices": [
        {"text": "I'm listening.", "next": "explain"},
        {"text": "Not interested.", "next": "decline"}
      ]
    },
    "explain": {
      "speaker": "Kael",
      "text": "My brother Daren...",
      "effects": [{"type": "start_quest", "quest_id": "sq_blood_ties"}],
      "next": "end"
    }
  }
}
```

---

## 10. UI & Visual Design

### Style: "Stone & Steel"
Dark fantasy aesthetic inspired by Game of Thrones. Muted earth tones with ember accents.

### Color Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Parchment | #D4CFC2 | 0.832, 0.812, 0.761 | Primary text |
| Iron Border | #3A3D48 | 0.227, 0.239, 0.282 | Panel borders |
| Ember | #B07040 | 0.69, 0.44, 0.25 | Accents, highlights, active |
| Worn Stone | #7A7670 | 0.478, 0.463, 0.439 | Secondary text |
| Blood Red | #C44444 | 0.769, 0.267, 0.267 | Damage, danger |
| Moss Green | #5A8A5A | 0.353, 0.541, 0.353 | Healing, buffs |
| Mage Purple | #804DA6 | 0.5, 0.3, 0.65 | Magic, spells |
| Skill Blue | #5A8AAB | 0.353, 0.541, 0.671 | Skill cards |
| Panel BG | #0D0E14 | 0.05, 0.055, 0.08 | Dark backgrounds (95% opaque) |

### UI Screens

| Screen | Description |
|--------|-------------|
| **Main Menu** | New Game, Load Game, Settings, Quit |
| **Overworld HUD** | Gold/food display, party sidebar, quest log button, location tooltip |
| **Combat — Card Hand** | 5-card hand at bottom, AP dots, deck/discard counts, End Turn |
| **Combat — Grid Overlay** | Movement range, card range (ember), AOE preview (purple) |
| **Combat — Info Panels** | Unit stats, terrain info, turn order bar, combat log |
| **Town Menu** | Full-screen sidebar + content panel |
| **Camp Popup** | Centered popup with rest button |
| **Dialogue Box** | Bottom-third speaker box with choice buttons |
| **Quest Log** | Overlay listing active/completed quests |
| **Pause Menu** | Resume, Save, Load, Settings, Quit |
| **Save/Load** | 3 slots with metadata (date, gold, food, party size) |

### Viewport
- **Resolution:** 1280x720
- **Renderer:** GL Compatibility
- **Combat grid:** 14x10 tiles at 64px = 896x640

---

## 11. Technical Architecture

### Engine & Language
- **Godot 4.6**, GDScript only
- **GL Compatibility** renderer (for broad hardware support)

### Autoload Singletons (10)

| Singleton | Role |
|-----------|------|
| `GameManager` | Party, resources, run state, game state machine |
| `EventBus` | Global signals, flag management, condition evaluation |
| `SaveManager` | JSON save/load (3 slots, version 0.3.0) |
| `SceneLoader` | Scene transitions |
| `SettingsManager` | User preferences |
| `AudioManager` | Sound/music |
| `NotificationManager` | Toast notifications |
| `DialogueManager` | Dialogue tree execution |
| `EventManager` | Travel encounter rolls |
| `QuestManager` | Quest state tracking |

**Rule:** Autoload scripts must NOT have `class_name` (causes identifier shadowing).

### Combat Component Architecture
Battlefield delegates to child components:

```
battlefield.gd (coordinator)
├── BattleGrid       — grid state, pathfinding, unit positions
├── BattleInput      — mouse/keyboard input, target selection
├── EnemyAI          — AI decision-making
├── CombatAnimator   — movement/attack animations
├── DeckManager      — per-unit card deck (RefCounted, one per player unit)
├── CardEffectResolver — damage/healing/effect calculation (RefCounted)
└── CardHandUI       — card display (CanvasLayer)
```

### Data-Driven Design
All content is defined in JSON files, not hardcoded:
- Map layout and connections → `data/maps/overworld.json`
- Card decks per class → `data/cards/class_decks.json`
- Items and prices → `data/items/item_catalog.json`
- Town services and stock → `data/towns/*.json`
- Quest definitions → `data/quests/quest_definitions.json`
- Travel encounters → `data/events/travel_events.json`
- Enemy templates → `data/events/enemy_groups.json`
- Dialogue trees → `data/dialogue/*.json`
- Tile art mappings → `data/maps/asset_catalog.json`

### Key Patterns
- **EventBus signals** for decoupled communication between systems
- **RefCounted delegates** for combat subsystems (no scene tree dependency)
- **Array safety:** UI copies arrays with `.duplicate()` to avoid mutating DeckManager state
- **`_unhandled_input()`** for game-world clicks (UI gets priority via `_input()`)
- **`mouse_filter = IGNORE`** on layout Controls to prevent invisible click-blocking

---

## 12. Current Content Inventory

### Scenes: 26 total
- 5 overworld, 4 combat (+ 2 test), 1 unit, 2 dungeon, 14 UI

### Scripts: 63 total
- 9 autoloads, 15 combat, 7 overworld, 3 dungeon, 11 UI, 6 resources, 12 scene scripts

### Data Files: 27 JSON
- 2 map files, 1 card deck file (9 classes), 1 item catalog (12 items), 5 town configs, 1 quest definition, 2 event/enemy files, 8 dialogue files

### Story Content
- 1 prologue, 1 multi-stage quest (Blood Ties), 3 travel dialogue events, 3 travel battle events

### Map Nodes: 46
- 5 towns, 29 camps, 5 dungeons (locked), 1 exit

---

## 13. Known Issues & Future Work

### Known Issues
- Combat UI party sidebar overlaps unit info panel (minor)
- Combat forecast HP prediction doesn't account for armor absorption
- Dungeon scenes exist but are not integrated into the overworld

### Implemented but Stub/Locked
- **Guild** — UI shows "locked" in town menu
- **Arena** — UI shows "locked" in town menu
- **Dungeons** — 5 dungeon nodes on map, room/generator code exists, but quest-gating not wired

### Wave 7 (Next): Arena + Recruitment + Polish
- Arena combat for practice and rewards
- Unit recruitment system (hire mercenaries at taverns/guilds)
- More quests and travel events
- Level-up system wired to battle victory
- Equipment management improvements
- Sound effects and music

### Longer-Term
- More class decks and card variety
- Dungeon integration (Slay the Spire-style branching paths)
- Elite enemies and boss encounters
- Card upgrades and deck building between battles
- More regions and map variety
- Gamepad/controller support
