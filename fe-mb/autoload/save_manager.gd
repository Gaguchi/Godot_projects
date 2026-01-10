extends Node
## SaveManager - Handles saving/loading run state and meta-progression
## Uses Godot's FileAccess for JSON-based saves

const SAVE_PATH = "user://save_data.json"
const META_PATH = "user://meta_progression.json"

signal save_completed
signal load_completed


func _ready() -> void:
	print("[SaveManager] Initialized")


## Save current run state
func save_run() -> void:
	var save_data = {
		"version": 1,
		"timestamp": Time.get_unix_time_from_system(),
		"run": {
			"is_active": GameManager.is_run_active,
			"floor": GameManager.current_floor,
			"node_id": GameManager.current_node_id,
			"gold": GameManager.gold,
			"food": GameManager.food,
			"morale": GameManager.morale,
			"battles_won": GameManager.battles_won,
			"units_lost": GameManager.units_lost,
			"nodes_visited": GameManager.nodes_visited,
		},
		"party": _serialize_party()
	}
	
	var file = FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(save_data, "\t"))
		file.close()
		save_completed.emit()
		print("[SaveManager] Run saved")
	else:
		push_error("[SaveManager] Failed to save run: " + str(FileAccess.get_open_error()))


## Load run state
func load_run() -> bool:
	if not FileAccess.file_exists(SAVE_PATH):
		print("[SaveManager] No save file found")
		return false
	
	var file = FileAccess.open(SAVE_PATH, FileAccess.READ)
	if not file:
		push_error("[SaveManager] Failed to open save file")
		return false
	
	var json = JSON.new()
	var parse_result = json.parse(file.get_as_text())
	file.close()
	
	if parse_result != OK:
		push_error("[SaveManager] Failed to parse save file")
		return false
	
	var save_data = json.data
	
	# Restore run state
	var run = save_data.get("run", {})
	GameManager.is_run_active = run.get("is_active", false)
	GameManager.current_floor = run.get("floor", 1)
	GameManager.current_node_id = run.get("node_id", -1)
	GameManager.gold = run.get("gold", 0)
	GameManager.food = run.get("food", 10)
	GameManager.morale = run.get("morale", 100)
	GameManager.battles_won = run.get("battles_won", 0)
	GameManager.units_lost = run.get("units_lost", 0)
	GameManager.nodes_visited = run.get("nodes_visited", 0)
	
	# Restore party
	_deserialize_party(save_data.get("party", []))
	
	load_completed.emit()
	print("[SaveManager] Run loaded")
	return true


## Delete save file
func delete_save() -> void:
	if FileAccess.file_exists(SAVE_PATH):
		DirAccess.remove_absolute(SAVE_PATH)
		print("[SaveManager] Save file deleted")


## Check if a save exists
func has_save() -> bool:
	return FileAccess.file_exists(SAVE_PATH)


## Serialize party to save data
func _serialize_party() -> Array:
	var party_data = []
	for unit in GameManager.party:
		if unit is UnitData:
			party_data.append({
				"name": unit.unit_name,
				"class": unit.unit_class,
				"level": unit.level,
				"current_hp": unit.current_hp,
				"max_hp": unit.max_hp,
				"strength": unit.strength,
				"magic": unit.magic,
				"skill": unit.skill,
				"speed": unit.speed,
				"luck": unit.luck,
				"defense": unit.defense,
				"resistance": unit.resistance,
				"movement": unit.movement,
				"experience": unit.experience,
			})
	return party_data


## Deserialize party from save data
func _deserialize_party(party_data: Array) -> void:
	GameManager.party.clear()
	for unit_dict in party_data:
		var unit = UnitData.new()
		unit.unit_name = unit_dict.get("name", "Unknown")
		unit.unit_class = unit_dict.get("class", "Fighter")
		unit.level = unit_dict.get("level", 1)
		unit.current_hp = unit_dict.get("current_hp", 20)
		unit.max_hp = unit_dict.get("max_hp", 20)
		unit.strength = unit_dict.get("strength", 5)
		unit.magic = unit_dict.get("magic", 0)
		unit.skill = unit_dict.get("skill", 5)
		unit.speed = unit_dict.get("speed", 5)
		unit.luck = unit_dict.get("luck", 5)
		unit.defense = unit_dict.get("defense", 5)
		unit.resistance = unit_dict.get("resistance", 2)
		unit.movement = unit_dict.get("movement", 5)
		unit.experience = unit_dict.get("experience", 0)
		GameManager.party.append(unit)
