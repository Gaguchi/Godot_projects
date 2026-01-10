extends Node
## GameManager - Central game state singleton
## Manages party, resources, run state, and floor progression

signal party_changed
signal resources_changed
signal run_started
signal run_ended(victory: bool)
signal dungeon_entered(difficulty: int)
signal dungeon_exited(completed: bool)

# Current run state
var is_run_active: bool = false
var current_floor: int = 1
var current_node_id: int = -1

# Dungeon state
var in_dungeon: bool = false
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


func _ready() -> void:
	print("[GameManager] Initialized")


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
	print("[GameManager] New run started")


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


## Enter a dungeon
func enter_dungeon(difficulty: int = 1) -> void:
	in_dungeon = true
	current_dungeon_floor = 1
	dungeon_completed = false
	dungeon_entered.emit(difficulty)
	print("[GameManager] Entered dungeon (difficulty: %d)" % difficulty)


## Exit dungeon (completed or abandoned)
func exit_dungeon(completed: bool = false) -> void:
	in_dungeon = false
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

