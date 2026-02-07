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

# Dungeon state
# var in_dungeon: bool = false # Removed in favor of current_state == DUNGEON
var current_dungeon_floor: int = 1
var dungeon_completed: bool = false

# Party management
var party: Array[Resource] = []  # Array of UnitData
const MAX_PARTY_SIZE: int = 6
const STARTING_PARTY_SIZE: int = 3

# Resources
var gold: int = 0
var food: int = 10
var morale: int = 100  # 0-100 scale

# Run statistics
var battles_won: int = 0
var units_lost: int = 0
var nodes_visited: int = 0
var last_battle_victory: bool = false


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
	gold = 50
	food = 10
	morale = 100
	
	battles_won = 0
	units_lost = 0
	nodes_visited = 0
	
	run_started.emit()
	
	# Add starter units
	var u1 = UnitData.new(); u1.unit_name = "Roy"; u1.unit_class = UnitData.UnitClass.LORD; u1.current_hp = 22; u1.max_hp = 22; u1.strength = 6; u1.speed = 7; u1.defense = 5; u1.current_armor = u1.defense
	var i1 = ItemData.new(); i1.weapon_type = ItemData.WeaponType.SWORD; i1.might = 5; i1.hit = 90; u1.equipped_weapon = i1;
	add_unit(u1)

	var u2 = UnitData.new(); u2.unit_name = "Marcus"; u2.unit_class = UnitData.UnitClass.KNIGHT; u2.current_hp = 28; u2.max_hp = 28; u2.strength = 8; u2.defense = 10; u2.current_armor = u2.defense
	var i2 = ItemData.new(); i2.weapon_type = ItemData.WeaponType.LANCE; i2.might = 7; i2.hit = 80; u2.equipped_weapon = i2;
	add_unit(u2)

	var u3 = UnitData.new(); u3.unit_name = "Lilina"; u3.unit_class = UnitData.UnitClass.MAGE; u3.current_hp = 18; u3.max_hp = 18; u3.magic = 8; u3.defense = 3; u3.current_armor = u3.defense
	var i3 = ItemData.new(); i3.weapon_type = ItemData.WeaponType.TOME; i3.might = 6; i3.hit = 85; i3.range_max = 2; u3.equipped_weapon = i3;
	add_unit(u3)

	print("[GameManager] New run started with 3 units")


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
		morale = max(0, morale - 10)  # Morale drop on unit death
		party_changed.emit()
		resources_changed.emit()


## Consume food when moving to a new node
func consume_food(amount: int = 1) -> void:
	food -= amount
	if food < 0:
		food = 0
		# Apply starvation penalty
		_apply_starvation()
	resources_changed.emit()


## Apply starvation effects to party
func _apply_starvation() -> void:
	print("[GameManager] Party is starving!")
	morale = max(0, morale - 15)
	# Could also apply HP damage to units here


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


## Modify morale
func change_morale(amount: int) -> void:
	morale = clamp(morale + amount, 0, 100)
	resources_changed.emit()


## Get morale modifier for combat (affects hit/avoid)
func get_morale_modifier() -> int:
	if morale >= 80:
		return 5  # High morale bonus
	elif morale >= 50:
		return 0  # Normal
	elif morale >= 25:
		return -5  # Low morale penalty
	else:
		return -10  # Critical morale penalty


## Rest party members, restoring health
func rest_party(heal_percentage: float = 0.3) -> void:
	print("[GameManager] Resting party...")
	for unit_data in party:
		if unit_data.is_alive():
			var heal_amount = int(unit_data.max_hp * heal_percentage)
			var old_hp = unit_data.current_hp
			unit_data.current_hp = min(unit_data.current_hp + heal_amount, unit_data.max_hp)
			print("[GameManager] Healed %s for %d HP (%d -> %d)" % [unit_data.unit_name, heal_amount, old_hp, unit_data.current_hp])
			
	# Also restore some morale
	change_morale(10)
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
		change_morale(10)  # Morale boost for completing dungeon
	else:
		print("[GameManager] Escaped from dungeon")
		change_morale(-5)  # Slight morale penalty for fleeing



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

## Helper for debugging: ensures party has units
func ensure_party() -> void:
	if not party.is_empty():
		return
		
	print("[GameManager] Party empty, adding debug units...")
	var u1 = UnitData.new(); u1.unit_name = "Roy"; u1.unit_class = UnitData.UnitClass.LORD; u1.current_hp = 22; u1.max_hp = 22; u1.strength = 6; u1.speed = 7; u1.defense = 5; u1.current_armor = u1.defense
	var i1 = ItemData.new(); i1.weapon_type = ItemData.WeaponType.SWORD; i1.might = 5; i1.hit = 90; u1.equipped_weapon = i1;
	add_unit(u1)

	var u2 = UnitData.new(); u2.unit_name = "Marcus"; u2.unit_class = UnitData.UnitClass.KNIGHT; u2.current_hp = 28; u2.max_hp = 28; u2.strength = 8; u2.defense = 10; u2.current_armor = u2.defense
	var i2 = ItemData.new(); i2.weapon_type = ItemData.WeaponType.LANCE; i2.might = 7; i2.hit = 80; u2.equipped_weapon = i2;
	add_unit(u2)

	var u3 = UnitData.new(); u3.unit_name = "Lilina"; u3.unit_class = UnitData.UnitClass.MAGE; u3.current_hp = 18; u3.max_hp = 18; u3.magic = 8; u3.defense = 3; u3.current_armor = u3.defense
	var i3 = ItemData.new(); i3.weapon_type = ItemData.WeaponType.TOME; i3.might = 6; i3.hit = 85; i3.range_max = 2; u3.equipped_weapon = i3;
	add_unit(u3)

