# Mechanics Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-unit inventory with a shared grid bag (8x4), add weapon sharpness system, integrate weapon might into card damage, redesign camps with choices, add town blacksmith, and rebalance the entire economy.

**Architecture:** Six phases that each leave the game in a working state. Phase 1 updates data schemas (ItemData, UnitData, CardData). Phase 2 builds the PartyBag system and food model. Phase 3 integrates weapon might + sharpness into combat. Phase 4 rewrites camp/town/shop UIs. Phase 5 builds the grid inventory UI. Phase 6 handles save migration and integration testing.

**Tech Stack:** Godot 4.6, GDScript, JSON data files, hand-rolled test scenes (`test_deck_manager.gd` pattern)

**Spec:** `docs/superpowers/specs/2026-03-22-mechanics-redesign.md`

---

## Phase 1: Data Layer Changes

### Task 1: Add sharpness system to ItemData

**Files:**
- Modify: `scripts/resources/item_data.gd`

- [ ] **Step 1: Add Sharpness enum and fields to ItemData**

Add after the `WeaponType` enum (~line 19):

```gdscript
enum Sharpness { SHARP, NORMAL, DULL }
```

Add new exports after the Value group (~line 48):

```gdscript
@export_group("Sharpness")
@export var sharpness: Sharpness = Sharpness.SHARP
@export var is_honed: bool = false

@export_group("Grid Size")
@export var grid_width: int = 1
@export var grid_height: int = 1
```

- [ ] **Step 2: Add sharpness methods to ItemData**

Add after the `is_ranged()` method:

```gdscript
## Get sharpness damage bonus (+2 Sharp, 0 Normal, -2 Dull)
func get_sharpness_bonus() -> int:
	match sharpness:
		Sharpness.SHARP: return 2
		Sharpness.NORMAL: return 0
		Sharpness.DULL: return -2
	return 0


## Degrade sharpness by one tier. Honed weapons consume hone instead.
func degrade_sharpness() -> void:
	if is_honed:
		is_honed = false
		return
	match sharpness:
		Sharpness.SHARP: sharpness = Sharpness.NORMAL
		Sharpness.NORMAL: sharpness = Sharpness.DULL
		# DULL stays DULL


## Restore sharpness to Sharp tier
func sharpen() -> void:
	sharpness = Sharpness.SHARP


## Blacksmith sharpening: Sharp + honed (first drop is skipped)
func apply_honing() -> void:
	sharpness = Sharpness.SHARP
	is_honed = true
```

- [ ] **Step 3: Add CROSSBOW to WeaponType enum**

In the `WeaponType` enum, add after `STAFF`:

```gdscript
enum WeaponType {
	NONE,
	SWORD,
	LANCE,
	AXE,
	BOW,
	TOME,
	STAFF,
	CROSSBOW
}
```

- [ ] **Step 4: Update serialization (to_dict / from_dict / create_from_dict)**

In `to_dict()`, add the new fields:

```gdscript
"sharpness": sharpness,
"is_honed": is_honed,
"grid_width": grid_width,
"grid_height": grid_height,
```

In `from_dict()`, load them:

```gdscript
grid_width = data.get("grid_width", 1)
grid_height = data.get("grid_height", 1)
is_honed = data.get("is_honed", false)
var sharp = data.get("sharpness", 0)
if sharp is String:
	match sharp:
		"SHARP": sharpness = Sharpness.SHARP
		"NORMAL": sharpness = Sharpness.NORMAL
		"DULL": sharpness = Sharpness.DULL
		_: sharpness = Sharpness.SHARP
else:
	sharpness = sharp
```

In `create_from_dict()`, the static factory already calls `from_dict()` internally, so no change needed there.

Also update `get_weapon_type_name()` to handle CROSSBOW:

```gdscript
WeaponType.CROSSBOW: return "Crossbow"
```

And add CROSSBOW to the `create_from_dict` weapon_type match:

```gdscript
"CROSSBOW": item.weapon_type = WeaponType.CROSSBOW
```

- [ ] **Step 5: Update CardData.from_dict() to handle CROSSBOW**

In `scripts/resources/card_data.gd`, in the `from_dict()` method's weapon_type match block (~line 185), add:

```gdscript
"CROSSBOW": weapon_type = ItemData.WeaponType.CROSSBOW
```

- [ ] **Step 6: Update Bounty Hunter cards in card_catalog.json**

In `data/cards/card_catalog.json`, find all Bounty Hunter weapon cards (e.g., `crossbow_bolt`, `headshot`, `net_throw`) that currently have `"weapon_type": "BOW"` and change them to `"weapon_type": "CROSSBOW"`. Cards like `capture` and `track_prey` that have `"weapon_type": "NONE"` stay unchanged.

- [ ] **Step 7: Commit**

```
git add scripts/resources/item_data.gd scripts/resources/card_data.gd data/cards/card_catalog.json
git commit -m "feat: add sharpness system, grid size, and crossbow to ItemData and CardData"
```

---

### Task 2: Add quick_slots to UnitData, remove old inventory

**Files:**
- Modify: `scripts/resources/unit_data.gd`

- [ ] **Step 1: Replace inventory with quick_slots**

Replace the Equipment group (~line 53-55):

```gdscript
@export_group("Equipment")
@export var equipped_weapon: Resource  # ItemData
@export var quick_slots: Array[Resource] = [null, null]  # 2 quick slots for consumables or spare weapons
```

- [ ] **Step 2: Replace inventory methods with quick_slot methods**

Replace `add_item()`, `remove_item()`, `equip_item()`, `unequip_weapon()` with:

```gdscript
## Set an item in a quick slot (0 or 1). Returns the previous item (or null).
func set_quick_slot(slot_index: int, item: Resource) -> Resource:
	if slot_index < 0 or slot_index > 1:
		return null
	# Ensure array is properly sized
	while quick_slots.size() < 2:
		quick_slots.append(null)
	var prev = quick_slots[slot_index]
	quick_slots[slot_index] = item
	return prev


## Get item from a quick slot
func get_quick_slot(slot_index: int) -> Resource:
	if slot_index < 0 or slot_index > 1 or slot_index >= quick_slots.size():
		return null
	return quick_slots[slot_index]


## Clear a quick slot and return the item
func clear_quick_slot(slot_index: int) -> Resource:
	return set_quick_slot(slot_index, null)


## Equip a weapon directly (from bag or quick slot). Returns old weapon or null.
func equip_weapon(weapon: Resource) -> Resource:
	var old = equipped_weapon
	equipped_weapon = weapon
	return old
```

- [ ] **Step 3: Update serialization**

In `to_dict()`, replace `inventory` with `quick_slots`:

```gdscript
var quick_slot_list = []
for slot in quick_slots:
	if slot and slot.has_method("to_dict"):
		quick_slot_list.append(slot.to_dict())
	else:
		quick_slot_list.append(null)
```

And replace `"inventory": inventory_list` with `"quick_slots": quick_slot_list` in the return dict.

In `from_dict()`, replace inventory deserialization:

```gdscript
# Deserialize Quick Slots
quick_slots = [null, null]
var qs_data = data.get("quick_slots", [])
for i in range(min(qs_data.size(), 2)):
	if qs_data[i] != null and qs_data[i] is Dictionary:
		var qs_item = ItemData.new()
		qs_item.from_dict(qs_data[i])
		quick_slots[i] = qs_item

# Legacy: migrate old inventory to quick_slots if present
var legacy_inv = data.get("inventory", [])
if qs_data.is_empty() and not legacy_inv.is_empty():
	for i in range(min(legacy_inv.size(), 2)):
		var item = ItemData.new()
		item.from_dict(legacy_inv[i])
		quick_slots[i] = item
```

- [ ] **Step 4: Commit**

```
git add scripts/resources/unit_data.gd
git commit -m "feat: replace per-unit inventory with 2 quick slots on UnitData"
```

---

### Task 3: Update item_catalog.json with new prices, sizes, and whetstone

**Files:**
- Modify: `data/items/item_catalog.json`

- [ ] **Step 1: Rewrite item_catalog.json**

Replace the entire file with the revised prices, grid sizes, and new items:

```json
{
	"iron_sword": {
		"item_name": "Iron Sword",
		"description": "A reliable iron blade. Standard sidearm for soldiers.",
		"item_type": "WEAPON",
		"weapon_type": "SWORD",
		"might": 5,
		"range_min": 1,
		"range_max": 1,
		"grid_width": 1,
		"grid_height": 3,
		"buy_price": 120,
		"sell_price": 60
	},
	"steel_sword": {
		"item_name": "Steel Sword",
		"description": "A heavier blade forged from tempered steel.",
		"item_type": "WEAPON",
		"weapon_type": "SWORD",
		"might": 8,
		"range_min": 1,
		"range_max": 1,
		"grid_width": 1,
		"grid_height": 3,
		"buy_price": 280,
		"sell_price": 140
	},
	"iron_lance": {
		"item_name": "Iron Lance",
		"description": "A sturdy spear favored by mounted knights.",
		"item_type": "WEAPON",
		"weapon_type": "LANCE",
		"might": 7,
		"range_min": 1,
		"range_max": 2,
		"grid_width": 1,
		"grid_height": 4,
		"buy_price": 150,
		"sell_price": 75
	},
	"steel_lance": {
		"item_name": "Steel Lance",
		"description": "A heavy lance that strikes with great force.",
		"item_type": "WEAPON",
		"weapon_type": "LANCE",
		"might": 10,
		"range_min": 1,
		"range_max": 2,
		"grid_width": 1,
		"grid_height": 4,
		"buy_price": 320,
		"sell_price": 160
	},
	"iron_axe": {
		"item_name": "Iron Axe",
		"description": "A heavy chopping weapon. Powerful but unwieldy.",
		"item_type": "WEAPON",
		"weapon_type": "AXE",
		"might": 8,
		"range_min": 1,
		"range_max": 1,
		"grid_width": 2,
		"grid_height": 2,
		"buy_price": 100,
		"sell_price": 50
	},
	"iron_bow": {
		"item_name": "Iron Bow",
		"description": "A simple longbow. Can only attack at range.",
		"item_type": "WEAPON",
		"weapon_type": "BOW",
		"might": 6,
		"range_min": 2,
		"range_max": 3,
		"grid_width": 1,
		"grid_height": 3,
		"buy_price": 140,
		"sell_price": 70
	},
	"iron_crossbow": {
		"item_name": "Iron Crossbow",
		"description": "A compact crossbow. Accurate at close and mid range.",
		"item_type": "WEAPON",
		"weapon_type": "CROSSBOW",
		"might": 6,
		"range_min": 1,
		"range_max": 2,
		"grid_width": 1,
		"grid_height": 3,
		"buy_price": 150,
		"sell_price": 75
	},
	"fire": {
		"item_name": "Fire",
		"description": "A basic fire tome. Strikes from a distance.",
		"item_type": "WEAPON",
		"weapon_type": "TOME",
		"might": 5,
		"range_min": 1,
		"range_max": 2,
		"grid_width": 1,
		"grid_height": 2,
		"buy_price": 130,
		"sell_price": 65
	},
	"thunder": {
		"item_name": "Thunder",
		"description": "A crackling tome of lightning magic.",
		"item_type": "WEAPON",
		"weapon_type": "TOME",
		"might": 8,
		"range_min": 1,
		"range_max": 2,
		"grid_width": 1,
		"grid_height": 2,
		"buy_price": 300,
		"sell_price": 150
	},
	"heal_staff": {
		"item_name": "Heal",
		"description": "A staff imbued with restorative magic.",
		"item_type": "WEAPON",
		"weapon_type": "STAFF",
		"might": 0,
		"heal_amount": 10,
		"range_min": 1,
		"range_max": 2,
		"grid_width": 1,
		"grid_height": 3,
		"buy_price": 160,
		"sell_price": 80
	},
	"vulnerary": {
		"item_name": "Vulnerary",
		"description": "A small potion that restores 10 HP. Three uses.",
		"item_type": "CONSUMABLE",
		"weapon_type": "NONE",
		"might": 0,
		"heal_amount": 10,
		"max_uses": 3,
		"grid_width": 1,
		"grid_height": 1,
		"buy_price": 80,
		"sell_price": 40
	},
	"elixir": {
		"item_name": "Elixir",
		"description": "A potent draught that fully restores HP. Three uses.",
		"item_type": "CONSUMABLE",
		"weapon_type": "NONE",
		"might": 0,
		"heal_amount": 999,
		"max_uses": 3,
		"grid_width": 1,
		"grid_height": 1,
		"buy_price": 500,
		"sell_price": 250
	},
	"food_rations": {
		"item_name": "Food Rations",
		"description": "Dried provisions for the road. Provides 3 travel hops.",
		"item_type": "CONSUMABLE",
		"weapon_type": "NONE",
		"might": 0,
		"max_uses": 3,
		"grid_width": 1,
		"grid_height": 2,
		"buy_price": 50,
		"sell_price": 25
	},
	"whetstone": {
		"item_name": "Whetstone",
		"description": "A sharpening stone. Restores 1 tier of weapon sharpness.",
		"item_type": "CONSUMABLE",
		"weapon_type": "NONE",
		"might": 0,
		"max_uses": 1,
		"grid_width": 1,
		"grid_height": 1,
		"buy_price": 40,
		"sell_price": 20
	}
}
```

- [ ] **Step 2: Commit**

```
git add data/items/item_catalog.json
git commit -m "feat: rebalance item prices, add grid sizes, whetstone, and crossbow"
```

---

### Task 4: Update town JSON files — replace guild with blacksmith, add whetstone to shops

**Files:**
- Modify: `data/towns/pine_crossing.json`
- Modify: `data/towns/riverside_market.json`
- Modify: `data/towns/south_junction.json`
- Modify: `data/towns/borderkeep_castle.json`
- Modify: `data/towns/northern_bridge.json`

- [ ] **Step 1: In each town JSON, replace `"guild"` block with `"blacksmith"`**

Replace:
```json
"guild": { "locked": true, "locked_text": "The guild hall is boarded shut." }
```
With:
```json
"blacksmith": { "sharpen_cost_per_weapon": 15 }
```

- [ ] **Step 2: Add `"whetstone"` to shop stock arrays where appropriate**

Add `"whetstone"` to stock in at least Pine Crossing, Riverside Market, and South Junction. Add `"iron_crossbow"` to shops that sell bows.

- [ ] **Step 3: Commit**

```
git add data/towns/
git commit -m "feat: replace guild with blacksmith in town configs, add whetstone to shops"
```

---

## Phase 2: Party Bag & Food Model

### Task 5: Create PartyBag data structure in GameManager

**Files:**
- Modify: `autoload/game_manager.gd`

- [ ] **Step 1: Add PartyBag data structure**

Add after the captured_enemies variable (~line 43):

```gdscript
# --- Shared Party Bag (Grid Inventory) ---
const BAG_WIDTH: int = 8
const BAG_HEIGHT: int = 4
const BAG_CELLS: int = BAG_WIDTH * BAG_HEIGHT  # 32
var bag_grid: Array = []  # Array[32] of int (-1 = empty, else index into bag_items)
var bag_items: Array[Dictionary] = []  # [{item: ItemData, grid_x: int, grid_y: int}]

# Scouted encounters
var scouted_hops: Array[int] = []
```

- [ ] **Step 2: Add bag initialization**

Add a `_init_bag()` helper called from `_ready()` and `start_new_run()`. Update `_ready()` to call `_init_bag()`:

```gdscript
func _ready() -> void:
	_init_bag()
	print("[GameManager] Initialized")
```

Define `_init_bag()`:

```gdscript
func _init_bag() -> void:
	bag_grid.clear()
	bag_grid.resize(BAG_CELLS)
	bag_grid.fill(-1)
	bag_items.clear()
```

- [ ] **Step 3: Add bag manipulation methods**

```gdscript
## Check if an item of given size fits at position (grid_x, grid_y)
func bag_can_place(grid_x: int, grid_y: int, width: int, height: int, ignore_index: int = -1) -> bool:
	if grid_x < 0 or grid_y < 0 or grid_x + width > BAG_WIDTH or grid_y + height > BAG_HEIGHT:
		return false
	for dy in height:
		for dx in width:
			var cell_idx: int = (grid_y + dy) * BAG_WIDTH + (grid_x + dx)
			if bag_grid[cell_idx] != -1 and bag_grid[cell_idx] != ignore_index:
				return false
	return true


## Place an item in the bag at the given position. Returns the bag_items index.
func bag_place_item(item: ItemData, grid_x: int, grid_y: int) -> int:
	var w: int = item.grid_width
	var h: int = item.grid_height
	if not bag_can_place(grid_x, grid_y, w, h):
		return -1
	var idx: int = bag_items.size()
	bag_items.append({"item": item, "grid_x": grid_x, "grid_y": grid_y})
	for dy in h:
		for dx in w:
			bag_grid[(grid_y + dy) * BAG_WIDTH + (grid_x + dx)] = idx
	return idx


## Remove an item from the bag by its bag_items index. Returns the ItemData.
func bag_remove_item(item_index: int) -> ItemData:
	if item_index < 0 or item_index >= bag_items.size():
		return null
	var entry: Dictionary = bag_items[item_index]
	var item: ItemData = entry["item"]
	var gx: int = entry["grid_x"]
	var gy: int = entry["grid_y"]
	# Clear grid cells
	for dy in item.grid_height:
		for dx in item.grid_width:
			var cell_idx: int = (gy + dy) * BAG_WIDTH + (gx + dx)
			if cell_idx < bag_grid.size() and bag_grid[cell_idx] == item_index:
				bag_grid[cell_idx] = -1
	# Remove from items list and reindex grid
	bag_items.remove_at(item_index)
	_reindex_bag_grid()
	return item


## Find first empty position for an item. Returns Vector2i or (-1,-1) if no fit.
func bag_find_slot(width: int, height: int) -> Vector2i:
	for y in BAG_HEIGHT:
		for x in BAG_WIDTH:
			if bag_can_place(x, y, width, height):
				return Vector2i(x, y)
	return Vector2i(-1, -1)


## Auto-place an item in the first available slot. Returns bag_items index or -1.
func bag_auto_place(item: ItemData) -> int:
	var pos := bag_find_slot(item.grid_width, item.grid_height)
	if pos.x == -1:
		return -1
	return bag_place_item(item, pos.x, pos.y)


## Rebuild grid indices after removing an item (indices shift down by 1)
func _reindex_bag_grid() -> void:
	bag_grid.fill(-1)
	for i in bag_items.size():
		var entry: Dictionary = bag_items[i]
		var item: ItemData = entry["item"]
		var gx: int = entry["grid_x"]
		var gy: int = entry["grid_y"]
		for dy in item.grid_height:
			for dx in item.grid_width:
				bag_grid[(gy + dy) * BAG_WIDTH + (gx + dx)] = i


## Auto-sort: repack all items largest-first from top-left
func bag_auto_sort() -> void:
	var items_copy: Array[ItemData] = []
	for entry in bag_items:
		items_copy.append(entry["item"])
	# Sort by cell count descending
	items_copy.sort_custom(func(a, b): return (a.grid_width * a.grid_height) > (b.grid_width * b.grid_height))
	# Clear and repack
	_init_bag()
	for item in items_copy:
		bag_auto_place(item)
```

- [ ] **Step 4: Rewrite food as a computed property and consume_food**

Replace the `var food: int = 10` declaration with:

```gdscript
## Food is derived from Food Rations in the bag (each ration has current_uses hops)
var food: int:
	get:
		var count := 0
		for entry in bag_items:
			if entry["item"] is ItemData and entry["item"].item_name == "Food Rations":
				count += entry["item"].current_uses
		return count
	set(value):
		# Setter for backwards compatibility (save loading, dialogue effects).
		# If value > current food, create Food Rations to cover the difference.
		# If value < current, consume the difference.
		var current := food
		if value > current:
			add_food(value - current)
		elif value < current:
			consume_food(current - value)


## Add food hops by creating new Food Rations items in the bag
func add_food(hops: int) -> void:
	# Try to top up existing rations first (max 3 uses each)
	for entry in bag_items:
		if hops <= 0:
			break
		var item: ItemData = entry["item"]
		if item.item_name == "Food Rations" and item.current_uses < 3:
			var space: int = 3 - item.current_uses
			var add: int = min(space, hops)
			item.current_uses += add
			hops -= add
	# Create new rations for remaining hops
	while hops > 0:
		var catalog := _load_item_catalog()
		var fr := ItemData.create_from_dict(catalog.get("food_rations", {}))
		fr.current_uses = min(3, hops)
		if bag_auto_place(fr) == -1:
			push_warning("[GameManager] Bag full, cannot add food rations")
			break
		hops -= fr.current_uses
	resources_changed.emit()
```

**Callers that mutate `food` directly — must be updated:**
- `autoload/save_manager.gd` ~line 127: `GameManager.food = data.get("food", 0)` → remove (bag contents handle this now; migration creates rations from old food count)
- `autoload/dialogue_manager.gd` ~line 253: `GameManager.food += effect.get("amount", 0)` → replace with `GameManager.add_food(effect.get("amount", 0))`
- `scripts/ui/shop_panel.gd` ~line 483: `GameManager.food += 3` → replace with `GameManager.add_food(3)` (but this entire buy flow is rewritten in Task 11)
- `scripts/combat/combat_test_launcher.gd` ~line 136: `GameManager.food = 10` → replace with `GameManager.add_food(10)` or skip (test code)

Replace `consume_food()`:

```gdscript
## Consume food-hops from Food Rations in the bag. Handles spanning multiple items.
func consume_food(amount: int = 1) -> void:
	var remaining: int = amount
	# Iterate by searching fresh each loop (indices shift after removal)
	while remaining > 0:
		var found: bool = false
		for i in range(bag_items.size()):
			var item: ItemData = bag_items[i]["item"]
			if item.item_name == "Food Rations" and item.current_uses > 0:
				var take: int = min(remaining, item.current_uses)
				item.current_uses -= take
				remaining -= take
				if item.current_uses <= 0:
					bag_remove_item(i)
				found = true
				break  # Restart loop (indices may have shifted)
		if not found:
			break  # No more food in bag
	if remaining > 0:
		# Not enough food — starvation
		_apply_starvation(3)
	resources_changed.emit()
```

- [ ] **Step 5: Update start_new_run() to initialize bag with starting items**

Replace `food = 15` and add bag initialization in `start_new_run()`:

```gdscript
_init_bag()
scouted_hops.clear()

# Starting bag: 2x Food Rations (3 hops each), 1x Vulnerary
var catalog = _load_item_catalog()
for _n in 2:
	var fr := ItemData.create_from_dict(catalog.get("food_rations", {}))
	fr.current_uses = 3
	bag_auto_place(fr)
var vuln := ItemData.create_from_dict(catalog.get("vulnerary", {}))
bag_auto_place(vuln)
```

Add `_load_item_catalog()` helper (separate from the card catalog):

```gdscript
var _item_catalog: Dictionary = {}

func _load_item_catalog() -> Dictionary:
	if not _item_catalog.is_empty():
		return _item_catalog
	var data = JSONLoader.load_json("res://data/items/item_catalog.json")
	if data is Dictionary:
		_item_catalog = data
	return _item_catalog
```

- [ ] **Step 6: Commit**

```
git add autoload/game_manager.gd
git commit -m "feat: add shared party bag grid system and food-from-bag model"
```

---

## Phase 3: Combat Integration — Weapon Might, Sharpness, Compatibility

### Task 6: Integrate weapon might and sharpness into card damage formula

**Files:**
- Modify: `scripts/resources/card_data.gd`

- [ ] **Step 1: Update get_computed_damage to include weapon might + sharpness**

Replace the existing `get_computed_damage` method:

```gdscript
## Get computed damage for a specific unit (base + stat scaling + weapon might + sharpness)
func get_computed_damage(unit: UnitData) -> int:
	var total: int = damage_base
	match damage_stat:
		"str": total += unit.strength
		"mag": total += unit.magic
		"skl": total += unit.skill
	# Add weapon might and sharpness bonus
	if unit.equipped_weapon and unit.equipped_weapon is ItemData:
		total += unit.equipped_weapon.might
		total += unit.equipped_weapon.get_sharpness_bonus()
	return max(0, total)
```

- [ ] **Step 2: Commit**

```
git add scripts/resources/card_data.gd
git commit -m "feat: integrate weapon might and sharpness into card damage formula"
```

---

### Task 7: Remove weapon triangle from combat, add weapon-card compatibility

**Files:**
- Modify: `scripts/combat/card_effect_resolver.gd`
- Modify: `scripts/combat/card_play_controller.gd`

- [ ] **Step 1: Remove triangle bonus from CardEffectResolver**

In `card_effect_resolver.gd`, delete the `_get_triangle_bonus()` method entirely (lines 116-121). In `_apply_damage()`, remove the triangle lines:

Remove these lines from `_apply_damage`:
```gdscript
# Weapon triangle bonus
var triangle: int = _get_triangle_bonus(card, target)
var triangle_dmg: int = triangle * WEAPON_TRIANGLE_DMG_BONUS
```

And remove `+ triangle_dmg` from the `damage_per_hit` calculation. Also remove the `WEAPON_TRIANGLE_DMG_BONUS` constant at the top.

The simplified `_apply_damage` should calculate:
```gdscript
var damage_per_hit: int = max(0, raw_damage - dr)
```

- [ ] **Step 2: Add weapon-card compatibility check to CardPlayController**

In `card_play_controller.gd`, add a method to check if a card is playable with the current weapon:

```gdscript
## Check if a card is compatible with the unit's equipped weapon
func _is_card_weapon_compatible(card: CardData, unit: UnitData) -> bool:
	# Cards with weapon_type NONE (skills, spells) are always playable
	if card.weapon_type == ItemData.WeaponType.NONE:
		return true
	# No weapon equipped — only NONE-type cards work
	if not unit.equipped_weapon or not unit.equipped_weapon is ItemData:
		return false
	# Must match equipped weapon type
	return card.weapon_type == unit.equipped_weapon.weapon_type
```

- [ ] **Step 3: Integrate compatibility into card_hand_ui.gd**

**File:** `scripts/ui/card_hand_ui.gd`

The card playability check lives in `_refresh_card_playability()` (~line 345 of card_hand_ui.gd), which currently checks only AP cost. Update it to also check weapon compatibility:

```gdscript
# In _refresh_card_playability(), after the AP check:
var playable: bool = card.ap_cost <= _current_ap
# Check weapon-card compatibility
if _current_unit and card.weapon_type != ItemData.WeaponType.NONE:
	if not _current_unit.equipped_weapon or not _current_unit.equipped_weapon is ItemData:
		playable = false
	elif card.weapon_type != _current_unit.equipped_weapon.weapon_type:
		playable = false
panel.modulate = Color.WHITE if playable else Color(0.4, 0.4, 0.4, 0.7)
```

Also in `card_play_controller.gd`, add the `_is_card_weapon_compatible()` method (from Step 2) so it can block card plays server-side, not just visually. And remove the triangle damage lines at ~1069-1073 (`triangle_dmg` calculation for damage preview).

- [ ] **Step 4: Commit**

```
git add scripts/combat/card_effect_resolver.gd scripts/combat/card_play_controller.gd
git commit -m "feat: remove weapon triangle, add weapon-card compatibility gating"
```

---

### Task 8: Add post-battle sharpness degradation

**Files:**
- Modify: `scripts/combat/battlefield.gd`

- [ ] **Step 1: Add sharpness degradation at battle end**

Find the battle victory handler (search for `_on_battle_victory` or the code that processes victory). After battle rewards are given but before scene transition, add:

```gdscript
# Degrade weapon sharpness for all player units that participated
for unit in GameManager.party:
	if unit.is_alive() and unit.equipped_weapon and unit.equipped_weapon is ItemData:
		unit.equipped_weapon.degrade_sharpness()
```

- [ ] **Step 2: Commit**

```
git add scripts/combat/battlefield.gd
git commit -m "feat: degrade weapon sharpness after each battle"
```

---

## Phase 4: UI Rewrites — Camp, Blacksmith, Shop

### Task 9: Redesign camp popup with 3 choices

**Files:**
- Modify: `scripts/ui/camp_popup.gd`

- [ ] **Step 1: Rewrite CampPopup to offer Rest/Sharpen/Scout/Leave**

Replace the entire `_build_ui()`, `open()`, and button handler methods. The new structure:

- Title label (camp name)
- Separator
- 4 vertically stacked buttons:
  - "Rest — Heal 20% HP (1 food)" — green accent, disabled if no food
  - "Sharpen — Restore 1 weapon (1 food)" — ember accent, disabled if no food
  - "Scout — Reveal next 3 encounters" — blue accent, always enabled
  - "Leave" — grey accent

Each button calls its handler:

```gdscript
func _on_rest_pressed() -> void:
	GameManager.consume_food(1)
	GameManager.rest_party(0.2)
	EventBus.show_notification.emit("Rested at %s. Party healed 20%%." % _camp_name)
	_close()


func _on_sharpen_pressed() -> void:
	# Find the first unit with a non-Sharp weapon
	var candidates: Array = []
	for unit in GameManager.party:
		if unit.is_alive() and unit.equipped_weapon and unit.equipped_weapon is ItemData:
			if unit.equipped_weapon.sharpness != ItemData.Sharpness.SHARP:
				candidates.append(unit)
	if candidates.is_empty():
		EventBus.show_notification.emit("All weapons are already sharp!")
		return
	# For now, sharpen the first candidate's weapon
	# TODO: Let player choose which unit (dropdown or click)
	GameManager.consume_food(1)
	candidates[0].equipped_weapon.sharpen()
	EventBus.show_notification.emit("%s's weapon sharpened!" % candidates[0].unit_name)
	_close()


func _on_scout_pressed() -> void:
	# DEFERRED: Full scout implementation (pre-rolling encounters, map overlays)
	# requires world_map integration. For now, show notification and close.
	# Will be implemented in a future plan alongside encounter visibility.
	EventBus.show_notification.emit("Scouted the road ahead. (Coming soon)")
	_close()
```

- [ ] **Step 2: Add unit selection for sharpening**

When the Sharpen button is pressed and multiple units have dull weapons, show a sub-popup or dropdown listing units with their weapon's current sharpness. Player picks one, that weapon goes to Sharp.

Use an `OptionButton` that appears below the Sharpen button, populated with `unit.unit_name + " (" + sharpness_name + ")"` entries.

- [ ] **Step 3: Update the `open()` method to check food from bag**

Replace `if GameManager.food >= 1:` — this now works automatically since `food` is a computed property on GameManager that sums Food Rations `current_uses` from the bag.

- [ ] **Step 4: Commit**

```
git add scripts/ui/camp_popup.gd
git commit -m "feat: redesign camp popup with rest/sharpen/scout choices"
```

---

### Task 10: Add blacksmith panel to town menu

**Files:**
- Modify: `scripts/ui/town_menu.gd`
- Create: `scripts/ui/blacksmith_panel.gd`

- [ ] **Step 1: Create BlacksmithPanel**

Create `scripts/ui/blacksmith_panel.gd`:

```gdscript
class_name BlacksmithPanel
extends VBoxContainer
## BlacksmithPanel - Sharpen all weapons with Honed bonus for gold

signal gold_changed

const COLOR_PANEL_BG := UIColors.COLOR_PANEL_BG
const COLOR_IRON_BORDER := UIColors.COLOR_IRON_BORDER
const COLOR_EMBER := UIColors.COLOR_EMBER
const COLOR_PARCHMENT := UIColors.COLOR_PARCHMENT
const COLOR_WORN_STONE := UIColors.COLOR_WORN_STONE
const COLOR_MOSS := UIColors.COLOR_MOSS

var _cost_per_weapon: int = 15
var _weapon_list: VBoxContainer
var _sharpen_btn: Button
var _gold_label: Label


func setup(config: Dictionary) -> void:
	_cost_per_weapon = config.get("sharpen_cost_per_weapon", 15)
	_build_ui()
	_refresh()


func _build_ui() -> void:
	# Title
	var title := Label.new()
	title.text = "Blacksmith"
	title.add_theme_font_size_override("font_size", 18)
	title.add_theme_color_override("font_color", COLOR_EMBER)
	add_child(title)

	var desc := Label.new()
	desc.text = "Sharpen & hone all weapons.\nHoned weapons keep their edge an extra battle."
	desc.add_theme_font_size_override("font_size", 13)
	desc.add_theme_color_override("font_color", COLOR_WORN_STONE)
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD
	add_child(desc)

	# Weapon list
	_weapon_list = VBoxContainer.new()
	_weapon_list.add_theme_constant_override("separation", 4)
	add_child(_weapon_list)

	# Gold + button
	var action_row := HBoxContainer.new()
	action_row.add_theme_constant_override("separation", 8)
	add_child(action_row)

	_gold_label = Label.new()
	_gold_label.add_theme_font_size_override("font_size", 14)
	_gold_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
	action_row.add_child(_gold_label)

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	action_row.add_child(spacer)

	_sharpen_btn = Button.new()
	_sharpen_btn.add_theme_font_size_override("font_size", 14)
	_sharpen_btn.pressed.connect(_on_sharpen_all)
	action_row.add_child(_sharpen_btn)


func _refresh() -> void:
	# Build weapon list
	for child in _weapon_list.get_children():
		child.queue_free()

	var weapon_count: int = 0
	var all_honed: bool = true

	for unit in GameManager.party:
		if not unit.is_alive() or not unit.equipped_weapon:
			continue
		weapon_count += 1
		var w: ItemData = unit.equipped_weapon
		var sharp_name: String = ["Sharp", "Normal", "Dull"][w.sharpness]
		var honed_text: String = " [Honed]" if w.is_honed else ""
		if w.sharpness != ItemData.Sharpness.SHARP or not w.is_honed:
			all_honed = false

		var row := Label.new()
		row.text = "  %s — %s (%s%s)" % [unit.unit_name, w.item_name, sharp_name, honed_text]
		row.add_theme_font_size_override("font_size", 13)
		# Color by sharpness
		match w.sharpness:
			ItemData.Sharpness.SHARP:
				row.add_theme_color_override("font_color", COLOR_PARCHMENT)
			ItemData.Sharpness.NORMAL:
				row.add_theme_color_override("font_color", COLOR_EMBER)
			ItemData.Sharpness.DULL:
				row.add_theme_color_override("font_color", UIColors.COLOR_BLOOD)
		_weapon_list.add_child(row)

	var total_cost: int = weapon_count * _cost_per_weapon
	_gold_label.text = "Gold: %d" % GameManager.gold
	_sharpen_btn.text = "Sharpen All — %dg" % total_cost
	_sharpen_btn.disabled = GameManager.gold < total_cost or all_honed or weapon_count == 0


func _on_sharpen_all() -> void:
	var weapon_count: int = 0
	for unit in GameManager.party:
		if unit.is_alive() and unit.equipped_weapon and unit.equipped_weapon is ItemData:
			unit.equipped_weapon.apply_honing()
			weapon_count += 1

	var total_cost: int = weapon_count * _cost_per_weapon
	GameManager.spend_gold(total_cost)
	EventBus.show_notification.emit("All weapons sharpened and honed! (-%dg)" % total_cost)
	gold_changed.emit()
	_refresh()
```

- [ ] **Step 2: Integrate BlacksmithPanel into TownMenu**

In `town_menu.gd`:

1. Change `BUILDING_ORDER` from `["inn", "shop", "tavern", "guild", "arena"]` to `["inn", "shop", "tavern", "blacksmith", "arena"]`
2. Change the display names dict: replace `"guild": "Guild"` with `"blacksmith": "Blacksmith"`
3. In the content-building method, add a `"blacksmith"` branch that creates a `BlacksmithPanel` and calls `setup(building_data)`

- [ ] **Step 3: Commit**

```
git add scripts/ui/blacksmith_panel.gd scripts/ui/town_menu.gd
git commit -m "feat: add blacksmith panel replacing guild in town menu"
```

---

### Task 11: Rewrite shop panel for bag-based buy/sell

**Files:**
- Modify: `scripts/ui/shop_panel.gd`

- [ ] **Step 1: Update buy flow to place items in party bag**

In `_execute_buy()`, replace per-unit inventory logic with bag placement:

```gdscript
func _execute_buy() -> void:
	if _selected_item_id.is_empty() or _selected_item_id not in _catalog:
		return
	var data: Dictionary = _catalog[_selected_item_id]
	var price: int = data.get("buy_price", 0)
	if not GameManager.spend_gold(price):
		EventBus.show_notification.emit("Not enough gold!")
		return

	var item := ItemData.create_from_dict(data)
	# Special: food_rations starts with 3 uses
	if _selected_item_id == "food_rations":
		item.current_uses = 3

	var idx := GameManager.bag_auto_place(item)
	if idx == -1:
		# Bag is full — refund
		GameManager.add_gold(price)
		EventBus.show_notification.emit("Bag is full!")
		return

	EventBus.show_notification.emit("Bought %s." % item.item_name)
	_update_gold_label()
	gold_changed.emit()
	_refresh_item_list()
	_on_buy_item_selected(_selected_item_id)
```

- [ ] **Step 2: Update sell flow to sell from bag**

Replace `_populate_sell_list()` to show items from `GameManager.bag_items` instead of per-unit inventory. Each row shows the item name, grid size, and sell price. Clicking an item selects it; the sell button removes it from the bag and adds gold.

Remove the unit selector from sell mode entirely — all items come from the shared bag.

```gdscript
func _populate_sell_list() -> void:
	for i in range(GameManager.bag_items.size()):
		var entry: Dictionary = GameManager.bag_items[i]
		var item: ItemData = entry["item"]
		var row := _create_item_row(
			item.item_name,
			_get_type_letter_from_item(item),
			"%dg" % item.sell_price,
			false
		)
		var captured_idx: int = i
		row.pressed.connect(func(): _on_sell_bag_item_selected(captured_idx))
		_item_list_container.add_child(row)
```

- [ ] **Step 3: Remove the unit selector from buy mode**

Since items go to the shared bag, the "select which unit receives the item" dropdown is no longer needed for buy. Remove `_unit_selector` from the buy flow. Keep it hidden.

- [ ] **Step 4: Commit**

```
git add scripts/ui/shop_panel.gd
git commit -m "feat: rewrite shop panel for bag-based buy/sell"
```

---

### Task 11b: Add combat quick slot actions (weapon switch + consumable use)

**Files:**
- Modify: `scripts/combat/card_play_controller.gd`
- Modify: `scripts/ui/card_hand_ui.gd`

- [ ] **Step 1: Add quick slot buttons to combat UI**

In `card_hand_ui.gd`, during the ACTION_PHASE, add 2 small buttons next to the card hand representing the unit's quick slots. Each button shows the item name (or "Empty"). Clicking a quick slot button:
- If it contains a consumable (Vulnerary, Whetstone, Food): triggers use-item action
- If it contains a weapon: triggers weapon-switch action
- Both cost 1 AP

- [ ] **Step 2: Implement use-item action in CardPlayController**

Add to `card_play_controller.gd`:

```gdscript
## Use a consumable from a quick slot. Costs 1 AP.
func use_quick_slot_item(unit: UnitData, slot_index: int) -> void:
	if _current_ap < 1:
		return
	var item: ItemData = unit.get_quick_slot(slot_index)
	if not item or not item is ItemData:
		return
	_current_ap -= 1

	match item.item_name:
		"Vulnerary", "Elixir":
			var heal: int = item.heal_amount
			if heal >= 999:
				heal = unit.max_hp
			unit.heal(heal)
			item.current_uses -= 1
			if item.current_uses <= 0:
				unit.clear_quick_slot(slot_index)
			_log("Used %s — healed %d HP" % [item.item_name, heal])
		"Whetstone":
			if unit.equipped_weapon and unit.equipped_weapon is ItemData:
				if unit.equipped_weapon.sharpness != ItemData.Sharpness.SHARP:
					unit.equipped_weapon.sharpness = unit.equipped_weapon.sharpness - 1  # Move up 1 tier
				unit.clear_quick_slot(slot_index)
				_log("Used Whetstone — weapon sharpened")

	_card_hand_ui.update_ap(_current_ap, unit.max_ap)
```

- [ ] **Step 3: Implement weapon-switch action**

```gdscript
## Switch equipped weapon with a weapon in a quick slot. Costs 1 AP.
func switch_weapon_from_slot(unit: UnitData, slot_index: int) -> void:
	if _current_ap < 1:
		return
	var slot_item: ItemData = unit.get_quick_slot(slot_index)
	if not slot_item or slot_item.item_type != ItemData.ItemType.WEAPON:
		return
	_current_ap -= 1
	var old_weapon = unit.equipped_weapon
	unit.equipped_weapon = slot_item
	unit.set_quick_slot(slot_index, old_weapon)
	_log("%s switched to %s" % [unit.unit_name, slot_item.item_name])
	# Refresh card hand (weapon change affects playable cards)
	_card_hand_ui.update_ap(_current_ap, unit.max_ap)
	_card_hand_ui.refresh_card_playability()
```

- [ ] **Step 4: Commit**

```
git add scripts/combat/card_play_controller.gd scripts/ui/card_hand_ui.gd
git commit -m "feat: add combat quick slot actions — weapon switch and consumable use"
```

---

## Phase 5: Grid Inventory UI

### Task 12: Create grid inventory UI scene and script

**Files:**
- Create: `scripts/ui/grid_inventory_ui.gd`

- [ ] **Step 1: Create the GridInventoryUI class**

This is a `CanvasLayer` popup showing the 8x4 grid. Each cell is a `Panel` in a `GridContainer`. Items are displayed as colored `TextureRect` or `ColorRect` blocks spanning their grid dimensions.

Key features:
- 8×4 grid of cells (each 48×48 pixels = 384×192 grid area)
- Items rendered as styled panels overlaid on the grid
- Click to pick up, click to place (or right-click to pick up)
- "Organize" button for auto-sort
- Unit portraits along the side showing equipped weapon + 2 quick slots
- Drag from bag to quick slot, drag from quick slot to bag

This is the most complex UI task. Build it incrementally:

1. First: static grid display showing current bag contents (read-only)
2. Second: click-to-select and click-to-place interaction
3. Third: unit portraits with quick slot drop targets
4. Fourth: "Organize" button wired to `GameManager.bag_auto_sort()`

- [ ] **Step 2: Wire inventory UI to overworld HUD**

Add an "Inventory" button to `overworld_hud.gd` that opens the `GridInventoryUI` as a CanvasLayer popup. Pressing Escape or clicking outside closes it.

- [ ] **Step 3: Commit**

```
git add scripts/ui/grid_inventory_ui.gd
git commit -m "feat: add grid inventory UI with drag-and-drop and auto-sort"
```

---

## Phase 6: Save Migration & Integration

### Task 13: Update save/load for new data structures

**Files:**
- Modify: `autoload/save_manager.gd`
- Modify: `autoload/game_manager.gd`

- [ ] **Step 1: Add bag serialization to GameManager**

Add `get_bag_save_data()` and `load_bag_save_data()`:

```gdscript
func get_bag_save_data() -> Array:
	var data: Array = []
	for entry in bag_items:
		data.append({
			"item": entry["item"].to_dict(),
			"grid_x": entry["grid_x"],
			"grid_y": entry["grid_y"]
		})
	return data


func load_bag_save_data(data: Array) -> void:
	_init_bag()
	for entry in data:
		var item := ItemData.new()
		item.from_dict(entry.get("item", {}))
		var gx: int = entry.get("grid_x", 0)
		var gy: int = entry.get("grid_y", 0)
		if bag_can_place(gx, gy, item.grid_width, item.grid_height):
			bag_place_item(item, gx, gy)
		else:
			# Fallback: auto-place
			var placed := bag_auto_place(item)
			if placed == -1:
				push_warning("[GameManager] Bag overflow during load — dropped: %s" % item.item_name)
```

- [ ] **Step 2: Update SaveManager to include bag and quick_slots**

In the save function, add `"party_bag": GameManager.get_bag_save_data()` and `"scouted_hops": GameManager.scouted_hops` to the save dictionary.

In the load function, call `GameManager.load_bag_save_data(data.get("party_bag", []))` and `GameManager.scouted_hops = data.get("scouted_hops", [])`.

- [ ] **Step 3: Remove direct `food` assignment from save_manager**

In `autoload/save_manager.gd`, find the line `GameManager.food = data.get("food", 0)` in the deserialize/load function and **remove it**. Food is now derived from bag contents. The food value is preserved through the bag's Food Rations items.

Also update `autoload/dialogue_manager.gd`: replace `GameManager.food += effect.get("amount", 0)` with `GameManager.add_food(effect.get("amount", 0))`.

- [ ] **Step 4: Bump save version and add migration**

Change save version from `"0.3.0"` to `"0.4.0"`. When loading a `"0.3.0"` save:
- Convert the old `food` integer into Food Rations items: `GameManager.add_food(data.get("food", 0))`
- Convert per-unit `inventory` arrays into bag items via `bag_auto_place()`
- Set all weapon sharpness to `SHARP`
- Initialize empty `quick_slots` on units
- Log migration: `print("[SaveManager] Migrated save from 0.3.0 to 0.4.0")`

- [ ] **Step 4: Commit**

```
git add autoload/save_manager.gd autoload/game_manager.gd
git commit -m "feat: update save system for party bag, quick slots, and sharpness"
```

---

### Task 14: Integration testing — verify full gameplay loop

**Files:**
- Modify: `scripts/combat/combat_test_launcher.gd` (optional: add sharpness test scenario)

- [ ] **Step 1: Manual verification checklist**

Run the game from main menu → New Run and verify:

1. Starting bag shows 2x Food Rations + 1x Vulnerary in grid
2. Travel consumes food from bag (food counter decreases)
3. Starvation triggers when bag has no food
4. Camp offers Rest / Sharpen / Scout / Leave
5. Rest heals and consumes food
6. Town shop shows new prices, buy puts items in bag
7. Town blacksmith sharpens all weapons with Honed bonus
8. Combat: weapon might affects card damage numbers
9. Combat: incompatible weapon-type cards are greyed out
10. Post-battle: weapon sharpness degrades 1 tier
11. Save and load preserves bag contents and sharpness state

- [ ] **Step 2: Commit any fixes**

```
git add -A
git commit -m "fix: integration fixes from full loop testing"
```

---

## Dependency Graph

```
Task 1 (ItemData) ──┬── Task 3 (item_catalog.json)
                    ├── Task 6 (card damage formula)
                    ├── Task 7 (weapon compatibility)
                    ├── Task 8 (sharpness degradation)
                    ├── Task 9 (camp redesign)
                    └── Task 10 (blacksmith)

Task 2 (UnitData) ──┬── Task 5 (PartyBag)
                    └── Task 13 (save migration)

Task 5 (PartyBag) ──┬── Task 9 (camp food check)
                    ├── Task 11 (shop rewrite)
                    ├── Task 12 (grid UI)
                    └── Task 13 (save system)

Task 4 (town JSONs) ── Task 10 (blacksmith integration)

Tasks 1-13 ──── Task 14 (integration testing)
```

**Parallelizable groups:**
- Tasks 1, 2 can run in parallel (data layer)
- Tasks 3, 4 can run in parallel (JSON data)
- Tasks 6, 7, 8 can run in parallel (combat changes — all depend on Task 1)
- Tasks 9, 10, 11 can run in parallel (UI — all depend on Task 5)
- Task 11b depends on Tasks 2, 7 (quick slots + weapon compatibility)

**Deferred to future plan:**
- Scout action implementation (pre-rolling encounters, map overlay icons, `scouted_hops` persistence) — requires encounter visibility system on world_map
