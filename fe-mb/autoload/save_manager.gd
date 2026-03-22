extends Node

## SaveManager
## Handles serialization and deserialization of game state to disk.
## Uses JSON for safe, human-readable, and version-friendly saving.

const SAVE_PATH_TEMPLATE = "user://save_slot_%d.json"

## Tracks the version string of the save currently being loaded so migration helpers can read it.
var _current_load_version: String = "0.4.0"

func get_save_path(slot: int) -> String:
	return SAVE_PATH_TEMPLATE % slot

func save_game(slot: int) -> void:
	var save_data = {
		"version": "0.4.0",
		"timestamp": Time.get_unix_time_from_system(),
		"date_string": Time.get_datetime_string_from_system(false, true),
		"game_manager": _serialize_game_manager(),
		"quest_manager": QuestManager.get_save_data(),
		"event_manager": EventManager.get_save_data(),
		"flags": EventBus.get_all_flags(),
	}
	
	var path = get_save_path(slot)
	var file = FileAccess.open(path, FileAccess.WRITE)
	if file:
		var json_string = JSON.stringify(save_data, "\t")
		file.store_string(json_string)
		print("[SaveManager] Game saved to slot %d at %s" % [slot, path])
		EventBus.show_notification.emit("Progress saved.")
	else:
		printerr("[SaveManager] Failed to open save file for writing: %s" % FileAccess.get_open_error())

func load_game(slot: int) -> bool:
	var path = get_save_path(slot)
	if not JSONLoader.file_exists(path):
		print("[SaveManager] No save file found for slot %d." % slot)
		return false

	var save_data = JSONLoader.load_json(path)
	if not save_data is Dictionary:
		printerr("[SaveManager] Failed to load or parse save file for slot %d." % slot)
		return false

	# Capture save version for migration decisions inside _deserialize_game_manager
	_current_load_version = save_data.get("version", "0.1.0")

	# Restore State
	_deserialize_game_manager(save_data.get("game_manager", {}))
	QuestManager.load_save_data(save_data.get("quest_manager", {}))
	EventManager.load_save_data(save_data.get("event_manager", {}))
	_deserialize_flags(save_data.get("flags", {}))

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
	if not JSONLoader.file_exists(path):
		return {}

	var data = JSONLoader.load_json(path)
	if not data is Dictionary:
		return {"error": "Corrupted"}

	var gm_data = data.get("game_manager", {})
	
	return {
		"exists": true,
		"date": data.get("date_string", "Unknown Date"),
		"floor": gm_data.get("current_floor", 1),
		"gold": gm_data.get("gold", 0),
		"food": gm_data.get("food", 0),
		"party_count": gm_data.get("party", []).size(),
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
	
	var captured_data: Array = []
	for unit in GameManager.captured_enemies:
		if unit.has_method("to_dict"):
			captured_data.append(unit.to_dict())

	return {
		"is_run_active": GameManager.is_run_active,
		"current_floor": GameManager.current_floor,
		"gold": GameManager.gold,
		"food": GameManager.food,  # kept for backwards compat; food is derived from bag in 0.4.0+
		"party": party_data,
		"party_bag": GameManager.get_bag_save_data(),
		"scouted_hops": GameManager.scouted_hops,
		"battles_won": GameManager.battles_won,
		"units_lost": GameManager.units_lost,
		"last_battle_victory": GameManager.last_battle_victory,
		"current_state": GameManager.current_state,
		"current_location_id": GameManager.current_location_id,
		"nodes_visited": GameManager.nodes_visited,
		"captured_enemies": captured_data,
	}

func _deserialize_game_manager(data: Dictionary) -> void:
	if data.is_empty():
		return

	# Detect save version for migration (stored at top-level, passed in via load_game)
	var save_version: String = _current_load_version

	GameManager.is_run_active = data.get("is_run_active", false)
	GameManager.current_floor = data.get("current_floor", 1)
	GameManager.gold = data.get("gold", 0)
	# NOTE: Do NOT assign GameManager.food here — food is derived from bag contents in 0.4.0+
	GameManager.battles_won = data.get("battles_won", 0)
	GameManager.units_lost = data.get("units_lost", 0)

	GameManager.last_battle_victory = data.get("last_battle_victory", false)
	GameManager.current_location_id = data.get("current_location_id", 0)
	GameManager.nodes_visited = data.get("nodes_visited", 0)

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

	# Reconstruct captured enemies
	GameManager.captured_enemies.clear()
	var captured_raw = data.get("captured_enemies", [])
	for unit_dict in captured_raw:
		var unit = UnitData.new()
		unit.from_dict(unit_dict)
		GameManager.captured_enemies.append(unit)

	# Restore party bag (0.4.0+) or migrate from old food integer
	if save_version >= "0.4.0":
		GameManager.load_bag_save_data(data.get("party_bag", []))
		GameManager.scouted_hops = data.get("scouted_hops", [])
	else:
		# Migration: old saves store food as a plain integer with no party bag
		GameManager.load_bag_save_data([])
		var old_food: int = data.get("food", 0)
		if old_food > 0:
			GameManager.add_food(old_food)
		# Old per-unit inventory items are handled by UnitData.from_dict() legacy migration
		print("[SaveManager] Migrated save from %s to 0.4.0" % save_version)

	GameManager.party_changed.emit()
	GameManager.resources_changed.emit()


func _deserialize_flags(data: Dictionary) -> void:
	if data.is_empty():
		return
	EventBus.set_flags_from_dict(data)
	print("[SaveManager] Restored %d EventBus flags" % data.size())
