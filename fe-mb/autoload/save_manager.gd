extends Node

## SaveManager
## Handles serialization and deserialization of game state to disk.
## Uses JSON for safe, human-readable, and version-friendly saving.

const SAVE_PATH_TEMPLATE = "user://save_slot_%d.json"

func get_save_path(slot: int) -> String:
	return SAVE_PATH_TEMPLATE % slot

func save_game(slot: int) -> void:
	var save_data = {
		"version": "0.1.0",
		"timestamp": Time.get_unix_time_from_system(),
		"date_string": Time.get_datetime_string_from_system(false, true), 
		"game_manager": _serialize_game_manager(),
		# Add other systems here (e.g., QuestManager, WorldMap state)
	}
	
	var path = get_save_path(slot)
	var file = FileAccess.open(path, FileAccess.WRITE)
	if file:
		var json_string = JSON.stringify(save_data, "\t")
		file.store_string(json_string)
		print("[SaveManager] Game saved to slot %d at %s" % [slot, path])
	else:
		printerr("[SaveManager] Failed to open save file for writing: %s" % FileAccess.get_open_error())

func load_game(slot: int) -> bool:
	var path = get_save_path(slot)
	if not FileAccess.file_exists(path):
		print("[SaveManager] No save file found for slot %d." % slot)
		return false
		
	var file = FileAccess.open(path, FileAccess.READ)
	if not file:
		printerr("[SaveManager] Failed to open save file for reading.")
		return false
		
	var json_string = file.get_as_text()
	var json = JSON.new()
	var parse_result = json.parse(json_string)
	
	if parse_result != OK:
		printerr("[SaveManager] JSON Parse Error: %s in %s at line %s" % [json.get_error_message(), json_string, json.get_error_line()])
		return false
		
	var save_data = json.get_data()
	
	# Restore State
	_deserialize_game_manager(save_data.get("game_manager", {}))
	
	print("[SaveManager] Game loaded from slot %d." % slot)
	return true

func has_save_file(slot: int) -> bool:
	return FileAccess.file_exists(get_save_path(slot))

func delete_save(slot: int) -> void:
	var path = get_save_path(slot)
	if FileAccess.file_exists(path):
		var err = DirAccess.remove_absolute(path) # Use remove_absolute to be safe with user:// paths mapped to OS
		if err == OK:
			print("[SaveManager] Deleted save slot %d" % slot)
		else:
			printerr("[SaveManager] Failed to delete save slot %d. Error: %d" % [slot, err])
	else:
		print("[SaveManager] No file to delete at slot %d" % slot)

## Get metadata for a slot without loading full state
func get_slot_metadata(slot: int) -> Dictionary:
	var path = get_save_path(slot)
	if not FileAccess.file_exists(path):
		return {}
		
	var file = FileAccess.open(path, FileAccess.READ)
	if not file:
		return {}
		
	var json_string = file.get_as_text()
	var json = JSON.new()
	var parse_result = json.parse(json_string)
	
	if parse_result != OK:
		return {"error": "Corrupted"}
		
	var data = json.get_data()
	var gm_data = data.get("game_manager", {})
	
	return {
		"exists": true,
		"date": data.get("date_string", "Unknown Date"),
		"floor": gm_data.get("current_floor", 1),
		"gold": gm_data.get("gold", 0),
		"party_count": gm_data.get("party", []).size()
	}

# --- Serialization Helpers ---

func _serialize_game_manager() -> Dictionary:
	var party_data = []
	for unit in GameManager.party:
		if unit.has_method("to_dict"):
			party_data.append(unit.to_dict())
	
	# Serialize Dungeon State logic can be improved later
	# Since GameManager active_dungeon_rooms is an array of Resources, we need to handle it deep
	# For now, let's focus on Party and Resources
	
	return {
		"is_run_active": GameManager.is_run_active,
		"current_floor": GameManager.current_floor,
		"gold": GameManager.gold,
		"food": GameManager.food,
		"party": party_data,
		"battles_won": GameManager.battles_won,
		"units_lost": GameManager.units_lost,

		"last_battle_victory": GameManager.last_battle_victory,
		"current_state": GameManager.current_state # Save enum as int
		# "dungeon_state": ... (Complex, needs its own handler)
	}

func _deserialize_game_manager(data: Dictionary) -> void:
	if data.is_empty():
		return
		
	GameManager.is_run_active = data.get("is_run_active", false)
	GameManager.current_floor = data.get("current_floor", 1)
	GameManager.gold = data.get("gold", 0)
	GameManager.food = data.get("food", 0)
	GameManager.battles_won = data.get("battles_won", 0)
	GameManager.units_lost = data.get("units_lost", 0)

	GameManager.last_battle_victory = data.get("last_battle_victory", false)
	
	# Restore State (handling potential missing key for old saves)
	var state_val = data.get("current_state", GameManager.GameState.MAIN_MENU)
	GameManager.current_state = state_val
	print("[SaveManager] Restored GameState: %s" % GameManager.GameState.keys()[state_val])
	
	# Reconstruct Party
	GameManager.party.clear()
	var party_raw = data.get("party", [])
	for unit_dict in party_raw:
		var unit = UnitData.new()
		unit.from_dict(unit_dict)
		GameManager.party.append(unit)
	
	GameManager.party_changed.emit()
	GameManager.resources_changed.emit()
