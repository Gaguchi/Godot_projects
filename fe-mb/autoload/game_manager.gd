extends Node
## GameManager - Central game state singleton
## Manages party, resources, run state, and floor progression

signal party_changed
signal resources_changed
signal run_started
signal run_ended(victory: bool)
signal dungeon_entered(difficulty: int)
signal dungeon_exited(completed: bool)
signal state_changed(new_state: GameState, old_state: GameState)

enum GameState {
	MAIN_MENU,
	OVERWORLD,
	DUNGEON,
	COMBAT,
	EVENT
}

# Current run state
var is_run_active: bool = false
var current_save_slot: int = 1
var current_state: GameState = GameState.MAIN_MENU
var current_floor: int = 1
var current_node_id: int = -1

# Overworld state persistence
var current_location_id: int = 0

# Dungeon state
var current_dungeon_floor: int = 1
var dungeon_completed: bool = false

# Combat context (set before transitioning to battlefield)
var pending_battle: Dictionary = {}
# Format: { "enemies": Array[UnitData], "difficulty": int, "source": "overworld"|"dungeon" }
var last_battle_victory: bool = false
var pending_travel_path: Array[int] = []  # Remaining hops to resume after mid-travel encounter
var pending_post_battle_dialogue: String = ""  # Dialogue to trigger after returning to overworld

# Capture/bounty system
var captured_enemies: Array[Resource] = []  # Array of UnitData for bounty turn-in

# --- Shared Party Bag (Grid Inventory) ---
const BAG_WIDTH: int = 8
const BAG_HEIGHT: int = 4
const BAG_CELLS: int = BAG_WIDTH * BAG_HEIGHT  # 32
var bag_grid: Array = []  # Array[32] of int (-1 = empty, else index into bag_items)
var bag_items: Array[Dictionary] = []  # [{item: ItemData, grid_x: int, grid_y: int}]

# Scouted encounters
var scouted_hops: Array[int] = []

# Party management
var party: Array[Resource] = []  # Array of UnitData
const MAX_PARTY_SIZE: int = 6
const STARTING_PARTY_SIZE: int = 3

# Resources
var gold: int = 0

## Food is derived from Food Rations in the bag (each ration tracks current_uses as hops remaining)
var food: int:
	get:
		var count := 0
		for entry in bag_items:
			if entry["item"] is ItemData and entry["item"].item_name == "Food Rations":
				count += entry["item"].current_uses
		return count
	set(value):
		var current := food
		if value > current:
			add_food(value - current)
		elif value < current:
			consume_food(current - value)

# Run statistics
var battles_won: int = 0
var units_lost: int = 0
var nodes_visited: int = 0


func _ready() -> void:
	_init_bag()
	print("[GameManager] Initialized")


func _init_bag() -> void:
	bag_grid.clear()
	bag_grid.resize(BAG_CELLS)
	bag_grid.fill(-1)
	bag_items.clear()


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


## Serialize bag for save system
func get_bag_save_data() -> Array:
	var data: Array = []
	for entry in bag_items:
		data.append({
			"item": entry["item"].to_dict(),
			"grid_x": entry["grid_x"],
			"grid_y": entry["grid_y"]
		})
	return data


## Restore bag from save data
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
			var placed := bag_auto_place(item)
			if placed == -1:
				push_warning("[GameManager] Bag overflow during load — dropped: %s" % item.item_name)


## Change game state
func change_state(new_state: GameState) -> void:
	if current_state == new_state:
		return
		
	var old_state = current_state
	current_state = new_state
	print("[GameManager] State changed: %s -> %s" % [GameState.keys()[old_state], GameState.keys()[new_state]])
	state_changed.emit(new_state, old_state)


## Start a new run with fresh state
func start_new_run() -> void:
	is_run_active = true
	current_floor = 1
	current_node_id = -1
	
	party.clear()
	gold = 80

	battles_won = 0
	units_lost = 0
	nodes_visited = 0
	current_location_id = 0
	pending_battle = {}
	last_battle_victory = false
	pending_travel_path.clear()
	pending_post_battle_dialogue = ""
	captured_enemies.clear()
	_init_bag()
	scouted_hops.clear()

	# Starting bag: 2x Food Rations (3 hops each = 6 food), 1x Vulnerary
	var catalog := _load_item_catalog()
	if not catalog.is_empty():
		var fr_data: Dictionary = catalog.get("food_rations", {})
		if not fr_data.is_empty():
			for _n in 2:
				var fr := ItemData.create_from_dict(fr_data)
				fr.current_uses = 3
				bag_auto_place(fr)
		var vuln_data: Dictionary = catalog.get("vulnerary", {})
		if not vuln_data.is_empty():
			var vuln := ItemData.create_from_dict(vuln_data)
			bag_auto_place(vuln)

	# Reset dungeon state
	current_dungeon_floor = 1
	dungeon_completed = false
	clear_dungeon_state()

	# Reset all subsystems
	EventBus.clear_all_flags()
	DialogueManager.clear_all_flags()
	QuestManager.reset()
	EventManager.reset()

	run_started.emit()
	
	# Add starter units — Roy (LORD), Marcus (KNIGHT), Lilina (MAGE)
	var gear_data := _load_gear_cards()

	var u1 = UnitData.new()
	u1.unit_name = "Roy"; u1.unit_class = UnitData.UnitClass.LORD; u1.is_player_unit = true
	u1.level = 1; u1.max_hp = 22; u1.current_hp = 22
	u1.strength = 6; u1.magic = 1; u1.skill = 6; u1.speed = 7; u1.luck = 7
	u1.defense = 5; u1.resistance = 2; u1.movement = 5; u1.current_armor = u1.defense
	u1.hp_growth = 80; u1.str_growth = 50; u1.mag_growth = 5; u1.skl_growth = 50
	u1.spd_growth = 45; u1.lck_growth = 60; u1.def_growth = 30; u1.res_growth = 25
	var i1 = ItemData.new(); i1.item_name = "Iron Sword"; i1.weapon_type = ItemData.WeaponType.SWORD; i1.might = 5; i1.hit = 90; i1.weight = 5
	i1.gear_cards = gear_data.get("iron_sword", [])
	u1.hand_left = i1
	add_unit(u1)

	var u2 = UnitData.new()
	u2.unit_name = "Marcus"; u2.unit_class = UnitData.UnitClass.KNIGHT; u2.is_player_unit = true
	u2.level = 1; u2.max_hp = 28; u2.current_hp = 28
	u2.strength = 8; u2.magic = 0; u2.skill = 7; u2.speed = 4; u2.luck = 4
	u2.defense = 10; u2.resistance = 1; u2.movement = 5; u2.current_armor = u2.defense
	u2.hp_growth = 70; u2.str_growth = 45; u2.mag_growth = 0; u2.skl_growth = 40
	u2.spd_growth = 25; u2.lck_growth = 20; u2.def_growth = 50; u2.res_growth = 15
	var i2 = ItemData.new(); i2.item_name = "Iron Lance"; i2.weapon_type = ItemData.WeaponType.LANCE; i2.might = 7; i2.hit = 80; i2.weight = 8
	i2.gear_cards = gear_data.get("iron_lance", [])
	u2.hand_left = i2
	var i2r = ItemData.new(); i2r.item_name = "Iron Buckler"; i2r.weapon_type = ItemData.WeaponType.NONE
	i2r.gear_cards = gear_data.get("iron_buckler", [])
	u2.hand_right = i2r
	add_unit(u2)

	var u3 = UnitData.new()
	u3.unit_name = "Lilina"; u3.unit_class = UnitData.UnitClass.MAGE; u3.is_player_unit = true
	u3.level = 1; u3.max_hp = 18; u3.current_hp = 18
	u3.strength = 1; u3.magic = 8; u3.skill = 5; u3.speed = 6; u3.luck = 6
	u3.defense = 3; u3.resistance = 7; u3.movement = 5; u3.current_armor = 0  # Mages have no armor
	u3.hp_growth = 55; u3.str_growth = 5; u3.mag_growth = 65; u3.skl_growth = 40
	u3.spd_growth = 40; u3.lck_growth = 45; u3.def_growth = 15; u3.res_growth = 50
	var i3 = ItemData.new(); i3.item_name = "Fire"; i3.weapon_type = ItemData.WeaponType.TOME; i3.might = 5; i3.hit = 90; i3.weight = 4; i3.range_max = 2
	i3.gear_cards = gear_data.get("fire", [])
	u3.hand_left = i3
	add_unit(u3)

	print("[GameManager] New run started with 3 units")


## Load the card catalog (id -> card definition). Cached after first load.
var _card_catalog: Dictionary = {}

func _load_card_catalog() -> Dictionary:
	if not _card_catalog.is_empty():
		return _card_catalog

	var data = JSONLoader.load_json("res://data/cards/card_catalog.json")
	if not data is Dictionary:
		printerr("[GameManager] Failed to load card_catalog.json")
		return {}

	_card_catalog = data
	print("[GameManager] Loaded card catalog: %d unique cards" % _card_catalog.size())
	return _card_catalog


## Load the item catalog (id -> item definition). Cached after first load.
var _item_catalog: Dictionary = {}

func _load_item_catalog() -> Dictionary:
	if not _item_catalog.is_empty():
		return _item_catalog
	var data = JSONLoader.load_json("res://data/items/item_catalog.json")
	if data is Dictionary:
		_item_catalog = data
	return _item_catalog


## Load innate deck definitions. Cached after first load.
var _innate_decks_cache: Dictionary = {}

func get_innate_deck(unit_class: int) -> Array:
	if _innate_decks_cache.is_empty():
		_innate_decks_cache = _load_innate_decks()
	var class_name_str: String = UnitData.UnitClass.keys()[unit_class]
	return _innate_decks_cache.get(class_name_str, {}).get("innate_cards", [])

func _load_innate_decks() -> Dictionary:
	var data = JSONLoader.load_json("res://data/cards/innate_decks.json")
	if not data is Dictionary:
		printerr("[GameManager] Failed to load innate_decks.json")
		return {}
	return data


## Load gear card definitions. Cached after first load.
var _gear_cards_cache: Dictionary = {}

func _load_gear_cards() -> Dictionary:
	if not _gear_cards_cache.is_empty():
		return _gear_cards_cache
	var data = JSONLoader.load_json("res://data/cards/gear_cards.json")
	if not data is Dictionary:
		printerr("[GameManager] Failed to load gear_cards.json")
		return {}
	_gear_cards_cache = data
	return _gear_cards_cache


## End the current run
func end_run(victory: bool) -> void:
	is_run_active = false
	run_ended.emit(victory)
	print("[GameManager] Run ended - Victory: ", victory)


## Add a unit to the party
func add_unit(unit: Resource) -> bool:
	if party.size() >= MAX_PARTY_SIZE:
		print("[GameManager] Party is full!")
		return false
	
	party.append(unit)
	party_changed.emit()
	return true


## Remove a unit from the party (permadeath)
func remove_unit(unit: Resource) -> void:
	var idx = party.find(unit)
	if idx >= 0:
		party.remove_at(idx)
		units_lost += 1
		party_changed.emit()
		resources_changed.emit()


## Consume food-hops from Food Rations in the bag. Handles spanning multiple items.
func consume_food(amount: int = 1) -> void:
	var remaining: int = amount
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
				break  # Restart loop (indices may have shifted after removal)
		if not found:
			break
	if remaining > 0:
		_apply_starvation(3)
	resources_changed.emit()


## Add food hops by topping up existing rations then creating new ones
func add_food(hops: int) -> void:
	# Try to top up existing rations first (max 3 uses each)
	for entry in bag_items:
		if hops <= 0:
			break
		var item: ItemData = entry["item"]
		if item.item_name == "Food Rations" and item.current_uses < 3:
			var space: int = 3 - item.current_uses
			var add_amt: int = min(space, hops)
			item.current_uses += add_amt
			hops -= add_amt
	# Create new rations for remaining hops
	while hops > 0:
		var catalog := _load_item_catalog()
		var fr_data: Dictionary = catalog.get("food_rations", {})
		if fr_data.is_empty():
			push_warning("[GameManager] food_rations not found in item catalog")
			break
		var fr := ItemData.create_from_dict(fr_data)
		fr.current_uses = min(3, hops)
		if bag_auto_place(fr) == -1:
			push_warning("[GameManager] Bag full, cannot add food rations")
			break
		hops -= fr.current_uses
	resources_changed.emit()


## Deal starvation damage to all living party members and notify the player
func _apply_starvation(damage: int) -> void:
	for unit in party:
		if unit.is_alive():
			unit.current_hp = max(1, unit.current_hp - damage)
	EventBus.show_notification.emit("No food! Party takes %d starvation damage." % damage)
	print("[GameManager] Starvation: -%d HP to all units" % damage)
	party_changed.emit()


## Modify gold
func add_gold(amount: int) -> void:
	gold += amount
	resources_changed.emit()


func spend_gold(amount: int) -> bool:
	if gold >= amount:
		gold -= amount
		resources_changed.emit()
		return true
	return false


## Rest party members, restoring health
func rest_party(heal_percentage: float = 0.3) -> void:
	print("[GameManager] Resting party...")
	for unit_data in party:
		if unit_data.is_alive():
			var heal_amount = int(unit_data.max_hp * heal_percentage)
			var old_hp = unit_data.current_hp
			unit_data.current_hp = min(unit_data.current_hp + heal_amount, unit_data.max_hp)
			print("[GameManager] Healed %s for %d HP (%d -> %d)" % [unit_data.unit_name, heal_amount, old_hp, unit_data.current_hp])
	print("[GameManager] Rest complete.")


## Enter a dungeon
func enter_dungeon(difficulty: int = 1) -> void:
	change_state(GameState.DUNGEON)
	current_dungeon_floor = 1
	dungeon_completed = false
	dungeon_entered.emit(difficulty)
	print("[GameManager] Entered dungeon (difficulty: %d)" % difficulty)


## Exit dungeon (completed or abandoned)
func exit_dungeon(completed: bool = false) -> void:
	change_state(GameState.OVERWORLD)
	dungeon_completed = completed
	dungeon_exited.emit(completed)
	if completed:
		print("[GameManager] Dungeon completed!")
	else:
		print("[GameManager] Escaped from dungeon")



## Update dungeon floor
func set_dungeon_floor(floor_num: int) -> void:
	current_dungeon_floor = floor_num


# --- Dungeon Persistence ---

var active_dungeon_rooms: Array = [] # Array[DungeonRoomData]
var active_dungeon_current_room_id: int = 0
var active_dungeon_difficulty: int = 1
var active_dungeon_max_floors: int = 3

func save_dungeon_state(rooms: Array, current_room_id: int, difficulty: int, max_floors: int) -> void:
	active_dungeon_rooms = rooms
	active_dungeon_current_room_id = current_room_id
	active_dungeon_difficulty = difficulty
	active_dungeon_max_floors = max_floors
	print("[GameManager] Saved dungeon state: %d rooms, current %d" % [rooms.size(), current_room_id])

func has_active_dungeon_state() -> bool:
	return not active_dungeon_rooms.is_empty()

func load_dungeon_state() -> Dictionary:
	return {
		"rooms": active_dungeon_rooms,
		"current_room_id": active_dungeon_current_room_id,
		"difficulty": active_dungeon_difficulty,
		"max_floors": active_dungeon_max_floors,
		"floor": current_dungeon_floor
	}

func clear_dungeon_state() -> void:
	active_dungeon_rooms.clear()
	active_dungeon_current_room_id = 0
	print("[GameManager] Cleared dungeon state")

## Add a captured enemy for bounty turn-in
func add_captured_enemy(unit_data: Resource) -> void:
	captured_enemies.append(unit_data)
	print("[GameManager] Captured: %s (bounty: %dg)" % [unit_data.unit_name, get_bounty_value(unit_data)])


## Get bounty value for a captured unit (level-based tiers, or override if set)
func get_bounty_value(unit_data: UnitData) -> int:
	if unit_data.bounty_value > 0:
		return unit_data.bounty_value
	if unit_data.level <= 2:
		return 20
	elif unit_data.level <= 4:
		return 40
	else:
		return 60


## Helper for debugging: ensures party has units
func ensure_party() -> void:
	if not party.is_empty():
		return
		
	print("[GameManager] Party empty, adding debug units...")
	var gear_data2 := _load_gear_cards()
	var u1 = UnitData.new(); u1.unit_name = "Roy"; u1.unit_class = UnitData.UnitClass.LORD; u1.current_hp = 22; u1.max_hp = 22; u1.strength = 6; u1.speed = 7; u1.skill = 6; u1.luck = 7; u1.defense = 5; u1.resistance = 2; u1.current_armor = u1.defense
	var i1 = ItemData.new(); i1.weapon_type = ItemData.WeaponType.SWORD; i1.might = 5; i1.hit = 90; i1.weight = 5
	i1.gear_cards = gear_data2.get("iron_sword", []); u1.hand_left = i1
	add_unit(u1)

	var u2 = UnitData.new(); u2.unit_name = "Marcus"; u2.unit_class = UnitData.UnitClass.KNIGHT; u2.current_hp = 28; u2.max_hp = 28; u2.strength = 8; u2.speed = 4; u2.skill = 7; u2.luck = 4; u2.defense = 10; u2.resistance = 1; u2.current_armor = u2.defense
	var i2 = ItemData.new(); i2.weapon_type = ItemData.WeaponType.LANCE; i2.might = 7; i2.hit = 80; i2.weight = 8
	i2.gear_cards = gear_data2.get("iron_lance", []); u2.hand_left = i2
	add_unit(u2)

	var u3 = UnitData.new(); u3.unit_name = "Lilina"; u3.unit_class = UnitData.UnitClass.MAGE; u3.current_hp = 18; u3.max_hp = 18; u3.magic = 8; u3.speed = 6; u3.skill = 5; u3.luck = 6; u3.defense = 3; u3.resistance = 7; u3.current_armor = 0
	var i3 = ItemData.new(); i3.weapon_type = ItemData.WeaponType.TOME; i3.might = 5; i3.hit = 90; i3.weight = 4; i3.range_max = 2
	i3.gear_cards = gear_data2.get("fire", []); u3.hand_left = i3
	add_unit(u3)

