# Mechanics Redesign: Inventory, Economy, Sharpness & Combat Ranges

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Shared grid inventory, revised economy/prices, weapon sharpness system, weapon range overhaul, camp choices, town blacksmith, combat weapon switching

---

## Table of Contents

1. [Summary of Changes](#1-summary-of-changes)
2. [Grid Inventory System](#2-grid-inventory-system)
3. [Per-Unit Equipment Slots](#3-per-unit-equipment-slots)
4. [Weapon Might → Card Damage Integration](#4-weapon-might--card-damage-integration)
5. [Weapon Range Overhaul](#5-weapon-range-overhaul)
6. [Sharpness System](#6-sharpness-system)
7. [Revised Economy & Prices](#7-revised-economy--prices)
8. [Camp Redesign](#8-camp-redesign)
9. [Town Blacksmith](#9-town-blacksmith)
10. [Systems Removed](#10-systems-removed)
11. [Data Schema Changes](#11-data-schema-changes)
12. [Save System Impact](#12-save-system-impact)

---

## 1. Summary of Changes

### What's new
- **Shared party grid inventory** (8x4, 32 cells) — Diablo/RE4 style spatial puzzle
- **Weapon sharpness** (3 tiers: Sharp/Normal/Dull) — replaces durability
- **Weapon might feeds into card damage** — buying weapons now matters
- **Per-unit quick slots** (2 per unit) — carry consumables or spare weapons into combat
- **Combat weapon switching** — spend 1 AP to swap equipped weapon from quick slot
- **Camp choice** — Rest OR Sharpen OR Scout (pick one per visit)
- **Town Blacksmith** — replaces locked Guild, sharpens all weapons with bonus durability
- **Whetstone item** — new consumable, restores 1 tier of sharpness

### What's removed
- Weapon triangle (+1/-1 damage was noise in a card system dealing 4-14 damage)
- Weapon durability/uses (replaced by sharpness)
- Per-unit inventory arrays (replaced by shared bag + quick slots)
- `hit`, `crit`, `weight` fields on weapons (vestigial — card system is deterministic)

### What's changed
- All item prices reduced ~70-80% to match actual income
- Food rations are now inventory items (1x2 size) instead of a direct resource add
- Weapon ranges standardized: lances 1-2, bows 2-3, tomes 1-2
- Lance grid size increased to 1x4 (reflects length, costs more bag space)

---

## 2. Grid Inventory System

### Overview
A shared party bag replaces per-unit inventories. Items occupy cells on an 8-wide × 4-tall grid. Players drag items to place them manually, with an "Organize" button for auto-packing.

### Grid Dimensions
- **Width:** 8 cells
- **Height:** 4 cells
- **Total:** 32 cells

### Item Sizes

| Item | Grid Size | Cells | Category |
|------|-----------|------:|----------|
| Sword | 1x3 | 3 | Weapon |
| Lance | 1x4 | 4 | Weapon |
| Axe | 2x2 | 4 | Weapon |
| Bow | 1x3 | 3 | Weapon |
| Tome | 1x2 | 2 | Weapon |
| Staff | 1x3 | 3 | Weapon |
| Vulnerary | 1x1 | 1 | Consumable |
| Elixir | 1x1 | 1 | Consumable |
| Food Rations | 1x2 | 2 | Consumable |
| Whetstone | 1x1 | 1 | Consumable |
| Quest items | 1x1 | 1 | Key Item |

### Interaction Model
- **Drag and drop:** Click item → drag to empty cells that fit → release to place
- **Right-click:** Pick up item (returns to cursor for re-placement)
- **Auto-sort button:** "Organize" button packs items top-left using a simple bin-packing algorithm (largest items first)
- **Bag full:** When acquiring loot with no room, show a "Bag Full" overlay — player must drop something or leave the new item

### Starting Bag (New Run)
- 2× Food Rations (1x2 each = 4 cells total)
- 1× Vulnerary (1x1 = 1 cell)
- **Total used:** 5 of 32 cells (starter weapons are equipped on units, not in bag)

### Implementation Notes
- New `PartyInventory` autoload or `GameManager` sub-object
- Data structure: `bag_grid: Array` (32 entries, null or item_id reference) + `bag_items: Array[Dictionary]` (item data + grid position + size)
- The old `UnitData.inventory: Array[Resource]` is removed
- Shop buy/sell operates on the bag, not per-unit inventory

---

## 3. Per-Unit Equipment Slots

### Slot Layout
Each unit has:
- **1 Weapon slot** — the currently equipped weapon
- **2 Quick slots** — hold any small item (consumable or spare weapon)

### Quick Slot Rules
- Quick slots accept any item regardless of grid size (abstracted to "1 slot = 1 item")
- Items in quick slots are NOT in the bag (they've been moved out)
- Before combat: drag items from bag → quick slots on unit portraits
- Quick slots persist between battles (items stay on the unit until manually moved)

### In-Combat Actions (1 AP each)
- **Use consumable:** Spend 1 AP → consume item from quick slot (e.g., Vulnerary heals 10 HP, Whetstone restores 1 sharpness tier on equipped weapon)
- **Switch weapon:** Spend 1 AP → swap equipped weapon with a weapon in a quick slot. Old weapon goes to the quick slot. Sharpness state travels with the weapon.

### Equipping Weapons
- **From bag:** Drag weapon onto unit portrait. If unit already has a weapon, old weapon returns to bag (must have room).
- **Quick slot swap:** During combat, 1 AP to swap. Outside combat, free.

---

## 4. Weapon Might → Card Damage Integration

### Current Problem
`CardData.get_computed_damage()` calculates `damage_base + unit.strength/magic/skill`. Equipped weapon might is completely ignored. Buying a Steel Sword changes nothing in card combat.

### New Formula
```
Card damage = card.damage_base + stat_scaling + weapon_might + sharpness_bonus
```

Where:
- `card.damage_base` — flat damage from the card definition (unchanged)
- `stat_scaling` — `unit.strength`, `unit.magic`, or `unit.skill` based on `card.damage_stat` (unchanged)
- `weapon_might` — `unit.equipped_weapon.might` (NEW — 0 if no weapon equipped)
- `sharpness_bonus` — +2 (Sharp), +0 (Normal), -2 (Dull) (NEW)

### Code Change
In `CardData.get_computed_damage(unit: UnitData)`:
```gdscript
func get_computed_damage(unit: UnitData) -> int:
    var total: int = damage_base
    match damage_stat:
        "str": total += unit.strength
        "mag": total += unit.magic
        "skl": total += unit.skill
    # Add weapon might
    if unit.equipped_weapon and unit.equipped_weapon is ItemData:
        total += unit.equipped_weapon.might
        total += unit.equipped_weapon.get_sharpness_bonus()
    return max(0, total)
```

### Damage Examples (Roy, STR 6, Iron Sword might 5)

| Card | Base | STR | Weapon | Sharp | Total |
|------|-----:|----:|-------:|------:|------:|
| Slash (Sharp) | 3 | 6 | 5 | +2 | **16** |
| Slash (Normal) | 3 | 6 | 5 | 0 | **14** |
| Slash (Dull) | 3 | 6 | 5 | -2 | **12** |
| Slash (no weapon) | 3 | 6 | 0 | 0 | **9** |

This makes weapon upgrades and sharpness maintenance genuinely impactful.

### Healing Cards
Healing cards (Heal, Mend, etc.) do NOT use weapon might. They continue using `heal_base + mag` only. Healing cards have `weapon_type: NONE` and are always playable regardless of equipped weapon — they are weapon-independent by design.

### Unarmed Units
A unit with no equipped weapon:
- Gets 0 weapon might and 0 sharpness bonus in the damage formula
- Can only play cards with `weapon_type = NONE` (skills, spells). Attack cards with a specific weapon_type are greyed out.
- This makes being disarmed a serious tactical disadvantage. Players should always carry a spare weapon in a quick slot or the bag.

### Enemy Weapons & Sharpness
- Enemy weapons always have **Normal** sharpness (no bonus, no penalty). Sharpness only degrades for player-unit equipped weapons.
- Enemy direct attacks (non-card) continue using weapon might via `UnitData.get_attack_power()`. No change needed.
- Enemies are generated fresh per encounter — no sharpness state to track between battles.

### Multi-Hit Cards
For cards with `damage_multiplier > 1` (e.g., Double Strike = 2 hits), the weapon might and sharpness bonus are included in `damage_per_hit`, which is then applied per hit. Example:
- Double Strike (damage_base 2, STR 6, Iron Sword 5, Sharp +2) = (2+6+5+2) = 15 per hit × 2 = **30 total**

---

## 5. Weapon Range Overhaul

### Current State
Card ranges are defined per-card in `card_catalog.json`. Weapon ranges on ItemData exist but are mostly ignored by the card system.

### New Ranges by Weapon Type

| Weapon Type | Range | Notes |
|-------------|-------|-------|
| Sword | 1 | Melee only |
| Lance | 1-2 | Can poke from behind an ally |
| Axe | 1 | Melee only, high damage |
| Bow | 2-3 | No melee — vulnerable up close |
| Crossbow | 1-2 | Bounty Hunter weapon — flexible range |
| Tome | 1-2 | Flexible magic |
| Staff | 1-2 | Heal at range |

### How Range Interacts with Cards
Cards still define their own `range_min` and `range_max`. However, the equipped weapon constrains effective range:

- **Card range is capped by weapon range.** A "Slash" card with range 1 on a Lance-wielder can still only hit at range 1 — the card defines the move. But a "Lance Thrust" card designed for lances would have range 1-2.
- **Class decks already encode this:** LORD deck cards have range 1 (sword). KNIGHT deck cards have range 1-2 (lance). ARCHER deck cards have range 2-3 (bow).
- **Weapon switching changes available ranges:** If Roy switches from Iron Sword (range 1) to Iron Bow (range 2-3), his Slash card (range 1) can't be used, but any bow-compatible cards could be.

### Card-Weapon Compatibility
Cards have a `weapon_type` field. When a card is played:
- If `card.weapon_type == NONE` (skills, spells): always usable, **not constrained by weapon range**
- If `card.weapon_type` matches equipped weapon type: usable, card range applies as-is
- If mismatch (e.g., Slash on a bow-wielder): card is **greyed out** in hand (can't play it)
- If unit has **no weapon**: only cards with `weapon_type == NONE` are playable

Weapon range does NOT cap card range. Cards already define their own ranges appropriate to their weapon type. The weapon_type compatibility check is sufficient — if you can play the card, its range is correct.

This creates the weapon-switching tension: carrying a spare bow lets your Lord play archer cards, but you sacrifice a quick slot.

---

## 6. Sharpness System

### Overview
Replaces durability. Weapons never break but lose effectiveness over time. Maintaining sharpness is a resource management decision.

### Tiers

| Tier | Damage Modifier | UI Color | Visual |
|------|----------------:|----------|--------|
| Sharp | +2 | White/bright | Gleaming icon |
| Normal | +0 | Amber | Standard icon |
| Dull | -2 | Red | Rusty/dim icon |

### Degradation
- Weapons drop **1 sharpness tier per battle** the unit participates in
- Sharp → Normal → Dull → stays Dull (never breaks)
- Only the equipped weapon degrades (quick slot weapons are safe)

### Restoration
- **Camp (Sharpen action):** Restore 1 weapon to Sharp. Costs 1 food. Pick one action per camp visit.
- **Whetstone item:** Use from quick slot (1 AP in combat, free on overworld). Restores equipped weapon by 1 tier. Single use, consumed.
- **Town Blacksmith:** Pay 15g per weapon, all weapons restored to Sharp with **Honed** bonus — the first sharpness drop is skipped (effectively Sharp lasts 2 battles instead of 1).

### Honed Status
A boolean flag on the weapon: `is_honed: bool`. When a Honed weapon would drop a sharpness tier, it clears the Honed flag instead of dropping. This means:
- Blacksmith Sharp → (battle 1) → still Sharp (honed consumed) → (battle 2) → Normal → (battle 3) → Dull
- Camp Sharp → (battle 1) → Normal → (battle 2) → Dull

### Data on ItemData
New fields:
```gdscript
enum Sharpness { SHARP, NORMAL, DULL }
@export var sharpness: Sharpness = Sharpness.SHARP
@export var is_honed: bool = false

func get_sharpness_bonus() -> int:
    match sharpness:
        Sharpness.SHARP: return 2
        Sharpness.NORMAL: return 0
        Sharpness.DULL: return -2
    return 0

func degrade_sharpness() -> void:
    if is_honed:
        is_honed = false
        return
    match sharpness:
        Sharpness.SHARP: sharpness = Sharpness.NORMAL
        Sharpness.NORMAL: sharpness = Sharpness.DULL
        # DULL stays DULL

func sharpen() -> void:
    sharpness = Sharpness.SHARP

func apply_honing() -> void:
    sharpness = Sharpness.SHARP
    is_honed = true
```

---

## 7. Revised Economy & Prices

### Design Principle
A player should afford a meaningful purchase after 2-3 battles. Starting gold (80g) covers emergency food OR one potion, not both.

### Battle Rewards
Unchanged: **10 + (enemy_level × 5) gold per enemy defeated.**
- 3 level-1 enemies = 45g
- 3 level-2 enemies = 60g
- After 2 battles: ~90-120g earned + 80g starting = 170-200g total

### Revised Item Catalog

| Item | Type | Grid Size | Might | Range | Buy | Sell |
|------|------|-----------|------:|------:|----:|-----:|
| Iron Sword | Sword | 1x3 | 5 | 1 | 120g | 60g |
| Steel Sword | Sword | 1x3 | 8 | 1 | 280g | 140g |
| Iron Lance | Lance | 1x4 | 7 | 1-2 | 150g | 75g |
| Steel Lance | Lance | 1x4 | 10 | 1-2 | 320g | 160g |
| Iron Axe | Axe | 2x2 | 8 | 1 | 100g | 50g |
| Iron Bow | Bow | 1x3 | 6 | 2-3 | 140g | 70g |
| Fire Tome | Tome | 1x2 | 5 | 1-2 | 130g | 65g |
| Thunder Tome | Tome | 1x2 | 8 | 1-2 | 300g | 150g |
| Heal Staff | Staff | 1x3 | — | 1-2 | 160g | 80g |
| Vulnerary | Consumable | 1x1 | — | — | 80g | 40g |
| Elixir | Consumable | 1x1 | — | — | 500g | 250g |
| Food Rations | Consumable | 1x2 | — | — | 50g | 25g |
| Whetstone | Consumable | 1x1 | — | — | 40g | 20g |

### Price Rationale
- **Food Rations (50g for 3 food-hops):** ~1 battle earns enough for a resupply. Food is available but not free.
- **Vulnerary (80g):** Affordable after 2 battles. Heals 10 HP × 3 uses = 30 HP total.
- **Iron weapons (100-160g):** Reachable after 2-3 fights. A meaningful upgrade from starter gear.
- **Steel weapons (280-320g):** Aspirational mid-game goal. Requires 5-6 battles of saving.
- **Elixir (500g):** Late-game luxury. Full heal × 3 uses.
- **Whetstone (40g):** Cheap utility. Worth carrying 1-2 in bag.

### Sell Price
All items sell for **50% of buy price** (unchanged ratio, but actual values are now reasonable).

### Bounty Values (unchanged)
- Level 1-2 enemies: 20g
- Level 3-4 enemies: 40g
- Level 5+ enemies: 60g
- Special targets: custom value

### Starting Resources
- **Gold:** 80g (unchanged)
- **Bag:** 2× Food Rations + 1× Vulnerary
- **Equipped:** Roy=Iron Sword, Marcus=Iron Lance, Lilina=Fire Tome (all start Sharp)

---

## 8. Camp Redesign

### Current State
Camp popup: 1 button, "Rest (1 food → 20% heal)". One click, no decisions. 29 of 46 map nodes are camps.

### New Design: Pick One Action

| Action | Effect | Cost |
|--------|--------|------|
| **Rest** | Heal all party members 20% of max HP | 1 food from bag |
| **Sharpen** | Restore one weapon to Sharp tier (player picks which unit) | 1 food from bag |
| **Scout** | Reveal encounter types on next 3 travel hops | Free |
| **Leave** | Continue without resting | Free |

### Rules
- Only ONE action per camp visit (no stacking Rest + Sharpen)
- If no food in bag, Rest and Sharpen are disabled (greyed out with "No food" text)
- "No food" check scans the party bag for Food Rations items with `current_uses > 0`
- After choosing, camp popup closes and player returns to overworld

### Scout Persistence
- Scout reveals encounter data for all path segments connected to the 3 nearest unvisited nodes from the current location
- Revealed segments show icon overlays on the overworld map: sword for battle, speech bubble for dialogue, dash for safe
- Scouted data persists until the player travels past those nodes. Stored as `scouted_hops: Array[int]` (node IDs) in GameManager.
- Scouted encounters are pre-rolled at scout time — what you see is what you'll get

### Whetstone Usage
- **In combat:** Use from quick slot, costs 1 AP. Restores equipped weapon by 1 sharpness tier. Consumed after use.
- **At camp:** Can also be used as part of the Sharpen action (applied automatically if player has one — but the camp Sharpen action is food-based, not whetstone-based. Whetstones are separate.)
- **Overworld:** Not usable outside of combat or camp. No standalone overworld item-use UI.

### UI
Same popup style as current `CampPopup`, but with 3-4 buttons vertically stacked instead of 1. Each button shows the action name, description, and cost.

---

## 9. Town Blacksmith

### Overview
Replaces the currently locked "Guild" building in all town JSON configs. Accessible from the town menu sidebar.

### Service: Sharpen & Hone

| Service | Effect | Cost |
|---------|--------|------|
| **Sharpen All** | All equipped party weapons → Sharp + Honed | 15g per weapon |

### Honed Bonus
Weapons sharpened by the blacksmith gain the `is_honed` flag. When the weapon would normally drop a sharpness tier, the Honed flag is consumed instead. Net effect: Sharp lasts 2 battles instead of 1.

### UI
Simple panel in the town menu content area:
- Shows list of party units with their weapon and current sharpness tier
- "Sharpen All — Xg" button showing total cost (15g × number of weapons). Disabled if gold insufficient or all weapons already Sharp+Honed.
- After clicking: all weapons update to Sharp+Honed, gold deducted, notification shown

### Town JSON Change
Replace `"guild": { "locked": true, ... }` with:
```json
"blacksmith": {
    "sharpen_cost": 30
}
```

---

## 10. Systems Removed

### Weapon Triangle
- **Removed entirely.** The +1/-1 damage bonus was noise in a card system dealing 8-16 damage per hit.
- `ItemData.get_triangle_advantage()` remains in code for reference but is no longer called by `CardEffectResolver`.
- Class asymmetry is handled by deck composition and weapon ranges.

### Weapon Durability
- **Removed.** `max_uses`, `current_uses`, `is_unbreakable` fields on ItemData become unused.
- Replaced by the sharpness system (weapons never break).

### Hit/Crit/Weight on Weapons
- `hit`, `crit`, and `weight` fields on ItemData are vestigial — the card system is deterministic and never rolls hit/crit.
- These fields remain on ItemData for now (enemy AI direct attacks may still reference them) but are deprioritized from shop UI display.
- Shop detail panel shows: Might, Range, Sharpness. Not Hit/Crit/Weight.
- `CardEffectResolver._get_triangle_bonus()` and all triangle damage calculations in `card_play_controller.gd` are deleted. The `card.weapon_type` field is retained — repurposed for weapon-card compatibility gating (Section 5).

### Per-Unit Inventory
- `UnitData.inventory: Array[Resource]` is replaced by the shared party bag + per-unit quick slots.
- `UnitData.add_item()`, `remove_item()`, `equip_item()`, `unequip_weapon()` are refactored to work with quick slots.

### Crossbow Weapon Type
The Bounty Hunter's cards (Crossbow Bolt, etc.) reference a crossbow which has range 1-2, distinct from a bow (range 2-3). Add `CROSSBOW` to `ItemData.WeaponType` with range 1-2 and grid size 1x3. Bounty Hunter cards with `weapon_type: "CROSSBOW"` require a crossbow equipped.

---

## 11. Data Schema Changes

### ItemData (modified)
```
+ sharpness: Sharpness enum (SHARP, NORMAL, DULL) — default SHARP
+ is_honed: bool — default false
+ grid_width: int — grid cells wide (1 or 2)
+ grid_height: int — grid cells tall (1-4)
- max_uses: int — removed (replaced by sharpness)
- current_uses: int — removed
- is_unbreakable: bool — removed
```

### UnitData (modified)
```
+ quick_slots: Array[Resource] — 2 slots, each null or ItemData
- inventory: Array[Resource] — removed (replaced by party bag)
```

### GameManager (modified)
```
+ party_bag: Dictionary — { "grid": Array[32], "items": Array[Dictionary] }
  Each item entry: { "item": ItemData, "grid_x": int, "grid_y": int }
- (food counter remains as derived value — count food rations in bag)
```

### Food Consumption Model
Each Food Rations item in the bag provides **3 food-hops**, tracked via `current_uses` (repurposed from durability — starts at 3).

When `consume_food(1)` is called (per travel hop or camp action):
1. Search the **bag only** (NOT quick slots) for the first Food Rations item
2. Decrement its `current_uses` by 1
3. If `current_uses` reaches 0, remove the item from the bag grid
4. If no Food Rations found in bag, trigger starvation damage (unchanged: 3 HP to all units)

`GameManager.food` becomes a computed property that sums `current_uses` across all Food Rations in the bag:
```gdscript
var food: int:
    get:
        var count := 0
        for entry in party_bag.items:
            if entry.item is ItemData and entry.item.item_name == "Food Rations":
                count += entry.item.current_uses
        return count
```

**Quick slot food:** Food Rations in quick slots are NOT consumed by travel. This is intentional — players can "protect" food by putting it on a unit, but at the cost of a quick slot. This is a valid strategic choice, not an exploit.

### item_catalog.json (modified)
Add to each item:
```json
{
    "grid_width": 1,
    "grid_height": 3,
    "sharpness": "SHARP"
}
```

Remove `max_uses` from display (keep in data for backwards compat if needed).

### Town JSON (modified)
Replace `"guild"` key with `"blacksmith"`:
```json
"blacksmith": {
    "sharpen_cost_per_weapon": 15
}
```

---

## 12. Save System Impact

### New Save Fields
- `party_bag`: serialized grid state (item positions + item data)
- Per-unit `quick_slots`: array of 2 item dicts (or null)
- Per-weapon `sharpness` and `is_honed` fields (already part of ItemData.to_dict())

### Migration
- Save version bump (0.3.0 → 0.4.0)
- On loading old saves: convert per-unit `inventory` arrays into party bag items (auto-pack using largest-first bin packing), set all weapons to `sharpness: SHARP`
- If combined items from all units exceed 32 bag cells, excess items are dropped with a console warning and player notification: "Some items were lost during save migration."

### What Gets Saved
- Bag grid layout (item positions preserved between saves)
- Quick slot contents per unit
- Weapon sharpness and honed state
- Scout reveal state: `scouted_hops: Array[int]` (node IDs with revealed encounter data)
