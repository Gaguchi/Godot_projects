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

# Party management
var party: Array[Resource] = []  # Array of UnitData
const MAX_PARTY_SIZE: int = 6
const STARTING_PARTY_SIZE: int = 3

# Resources
var gold: int = 0
var food: int = 10

# Run statistics
var battles_won: int = 0
var units_lost: int = 0
var nodes_visited: int = 0


func _ready() -> void:
	print("[GameManager] Initialized")

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
	food = 15
	
	battles_won = 0
	units_lost = 0
	nodes_visited = 0
	current_location_id = 0
	pending_battle = {}
	last_battle_victory = false
	pending_travel_path.clear()
	pending_post_battle_dialogue = ""
	captured_enemies.clear()

	# Reset dungeon state
	current_dungeon_floor = 1
	dungeon_completed = false
	clear_dungeon_state()

	# Reset all subsystems
	EventBus.clear_all_flags()
	QuestManager.reset()
	EventManager.reset()

	run_started.emit()
	
	# Add starter units — Roy (LORD), Marcus (KNIGHT), Lilina (MAGE)
	var u1 = UnitData.new()
	u1.unit_name = "Roy"; u1.unit_class = UnitData.UnitClass.LORD; u1.is_player_unit = true
	u1.level = 1; u1.max_hp = 22; u1.current_hp = 22
	u1.strength = 6; u1.magic = 1; u1.skill = 6; u1.speed = 7; u1.luck = 7
	u1.defense = 5; u1.resistance = 2; u1.movement = 5; u1.current_armor = u1.defense
	u1.hp_growth = 80; u1.str_growth = 50; u1.mag_growth = 5; u1.skl_growth = 50
	u1.spd_growth = 45; u1.lck_growth = 60; u1.def_growth = 30; u1.res_growth = 25
	var i1 = ItemData.new(); i1.item_name = "Iron Sword"; i1.weapon_type = ItemData.WeaponType.SWORD; i1.might = 5; i1.hit = 90; i1.weight = 5; u1.equipped_weapon = i1
	_assign_starting_deck(u1)
	add_unit(u1)

	var u2 = UnitData.new()
	u2.unit_name = "Marcus"; u2.unit_class = UnitData.UnitClass.KNIGHT; u2.is_player_unit = true
	u2.level = 1; u2.max_hp = 28; u2.current_hp = 28
	u2.strength = 8; u2.magic = 0; u2.skill = 7; u2.speed = 4; u2.luck = 4
	u2.defense = 10; u2.resistance = 1; u2.movement = 5; u2.current_armor = u2.defense
	u2.hp_growth = 70; u2.str_growth = 45; u2.mag_growth = 0; u2.skl_growth = 40
	u2.spd_growth = 25; u2.lck_growth = 20; u2.def_growth = 50; u2.res_growth = 15
	var i2 = ItemData.new(); i2.item_name = "Iron Lance"; i2.weapon_type = ItemData.WeaponType.LANCE; i2.might = 7; i2.hit = 80; i2.weight = 8; u2.equipped_weapon = i2
	_assign_starting_deck(u2)
	add_unit(u2)

	var u3 = UnitData.new()
	u3.unit_name = "Lilina"; u3.unit_class = UnitData.UnitClass.MAGE; u3.is_player_unit = true
	u3.level = 1; u3.max_hp = 18; u3.current_hp = 18
	u3.strength = 1; u3.magic = 8; u3.skill = 5; u3.speed = 6; u3.luck = 6
	u3.defense = 3; u3.resistance = 7; u3.movement = 5; u3.current_armor = 0  # Mages have no armor
	u3.hp_growth = 55; u3.str_growth = 5; u3.mag_growth = 65; u3.skl_growth = 40
	u3.spd_growth = 40; u3.lck_growth = 45; u3.def_growth = 15; u3.res_growth = 50
	var i3 = ItemData.new(); i3.item_name = "Fire"; i3.weapon_type = ItemData.WeaponType.TOME; i3.might = 5; i3.hit = 90; i3.weight = 4; i3.range_max = 2; u3.equipped_weapon = i3
	_assign_starting_deck(u3)
	add_unit(u3)

	print("[GameManager] New run started with 3 units")


## Assign a starting deck to a unit based on their class
func _assign_starting_deck(unit: UnitData) -> void:
	var class_key: String = UnitData.UnitClass.keys()[unit.unit_class]
	var file := FileAccess.open("res://data/cards/class_decks.json", FileAccess.READ)
	if not file:
		printerr("[GameManager] Failed to load class_decks.json")
		return

	var json := JSON.new()
	var err := json.parse(file.get_as_text())
	file.close()
	if err != OK:
		printerr("[GameManager] Failed to parse class_decks.json: %s" % json.get_error_message())
		return

	var all_decks: Dictionary = json.data
	if class_key not in all_decks:
		printerr("[GameManager] No deck found for class: %s" % class_key)
		return

	var deck_def: Dictionary = all_decks[class_key]
	var cards_data: Array = deck_def.get("cards", [])

	unit.deck.clear()
	for card_entry in cards_data:
		var copies: int = card_entry.get("copies", 1)
		for i in copies:
			var card := CardData.create_from_dict(card_entry)
			unit.deck.append(card)

	print("[GameManager] Assigned %d-card deck to %s (%s)" % [unit.deck.size(), unit.unit_name, class_key])


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


## Consume food when moving to a new node. If food runs out, party takes starvation damage.
func consume_food(amount: int = 1) -> void:
	food -= amount
	if food < 0:
		var starve_dmg := 3
		food = 0
		_apply_starvation(starve_dmg)
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
	var u1 = UnitData.new(); u1.unit_name = "Roy"; u1.unit_class = UnitData.UnitClass.LORD; u1.current_hp = 22; u1.max_hp = 22; u1.strength = 6; u1.speed = 7; u1.skill = 6; u1.luck = 7; u1.defense = 5; u1.resistance = 2; u1.current_armor = u1.defense
	var i1 = ItemData.new(); i1.weapon_type = ItemData.WeaponType.SWORD; i1.might = 5; i1.hit = 90; i1.weight = 5; u1.equipped_weapon = i1;
	_assign_starting_deck(u1)
	add_unit(u1)

	var u2 = UnitData.new(); u2.unit_name = "Marcus"; u2.unit_class = UnitData.UnitClass.KNIGHT; u2.current_hp = 28; u2.max_hp = 28; u2.strength = 8; u2.speed = 4; u2.skill = 7; u2.luck = 4; u2.defense = 10; u2.resistance = 1; u2.current_armor = u2.defense
	var i2 = ItemData.new(); i2.weapon_type = ItemData.WeaponType.LANCE; i2.might = 7; i2.hit = 80; i2.weight = 8; u2.equipped_weapon = i2;
	_assign_starting_deck(u2)
	add_unit(u2)

	var u3 = UnitData.new(); u3.unit_name = "Lilina"; u3.unit_class = UnitData.UnitClass.MAGE; u3.current_hp = 18; u3.max_hp = 18; u3.magic = 8; u3.speed = 6; u3.skill = 5; u3.luck = 6; u3.defense = 3; u3.resistance = 7; u3.current_armor = 0
	var i3 = ItemData.new(); i3.weapon_type = ItemData.WeaponType.TOME; i3.might = 5; i3.hit = 90; i3.weight = 4; i3.range_max = 2; u3.equipped_weapon = i3;
	_assign_starting_deck(u3)
	add_unit(u3)

