extends Node
## QuestManager - Tracks quest state (active, completed, stages).
## Loads quest definitions from JSON. Sets EventBus flags for dialogue conditions.
## NO class_name — this is an autoload singleton.

signal quest_started(quest_id: String)
signal quest_completed(quest_id: String)
signal quest_stage_changed(quest_id: String, stage: int)

# quest_id → { "status": "active"|"complete", "stage": int }
var _quests: Dictionary = {}

# quest_id → definition dict from quest_definitions.json
var _definitions: Dictionary = {}


func _ready() -> void:
	_load_definitions()
	print("[QuestManager] Initialized (%d quest definitions loaded)" % _definitions.size())


# =============================================================================
# Public API
# =============================================================================

## Start a quest by id. Sets EventBus flag {quest_id}_active.
func start_quest(quest_id: String) -> void:
	if _quests.has(quest_id):
		print("[QuestManager] Quest already started: %s" % quest_id)
		return

	_quests[quest_id] = {"status": "active", "stage": 0}
	EventBus.set_flag(quest_id + "_active", true)
	quest_started.emit(quest_id)
	print("[QuestManager] Quest started: %s" % quest_id)


## Complete a quest. Clears _active flag, sets _complete flag.
func complete_quest(quest_id: String) -> void:
	if not _quests.has(quest_id):
		print("[QuestManager] Cannot complete unknown quest: %s" % quest_id)
		return

	_quests[quest_id]["status"] = "complete"
	EventBus.set_flag(quest_id + "_active", false)
	EventBus.set_flag(quest_id + "_complete", true)
	quest_completed.emit(quest_id)
	print("[QuestManager] Quest completed: %s" % quest_id)


## Advance quest to next stage (or set specific stage).
func advance_quest(quest_id: String, stage: int = -1) -> void:
	if not _quests.has(quest_id):
		print("[QuestManager] Cannot advance unknown quest: %s" % quest_id)
		return

	if stage >= 0:
		_quests[quest_id]["stage"] = stage
	else:
		_quests[quest_id]["stage"] += 1

	var new_stage: int = _quests[quest_id]["stage"]
	quest_stage_changed.emit(quest_id, new_stage)
	print("[QuestManager] Quest %s advanced to stage %d" % [quest_id, new_stage])


## Check if a quest is currently active (started but not complete).
func is_quest_active(quest_id: String) -> bool:
	return _quests.has(quest_id) and _quests[quest_id]["status"] == "active"


## Check if a quest is complete.
func is_quest_complete(quest_id: String) -> bool:
	return _quests.has(quest_id) and _quests[quest_id]["status"] == "complete"


## Get current stage of a quest (-1 if not started).
func get_quest_stage(quest_id: String) -> int:
	if _quests.has(quest_id):
		return _quests[quest_id]["stage"]
	return -1


## Get all active quests as an array of quest_ids.
func get_active_quests() -> Array:
	var result: Array = []
	for quest_id in _quests:
		if _quests[quest_id]["status"] == "active":
			result.append(quest_id)
	return result


## Get all completed quests as an array of quest_ids.
func get_completed_quests() -> Array:
	var result: Array = []
	for quest_id in _quests:
		if _quests[quest_id]["status"] == "complete":
			result.append(quest_id)
	return result


## Get quest definition by id. Returns empty dict if not found.
func get_definition(quest_id: String) -> Dictionary:
	return _definitions.get(quest_id, {})


## Get all quest definitions.
func get_all_definitions() -> Dictionary:
	return _definitions


## Get locations that should show quest indicators (yellow "!").
## Returns: { location_name: quest_id } for active quests with location_indicator set.
func get_quest_locations() -> Dictionary:
	var result: Dictionary = {}
	for quest_id in _quests:
		if _quests[quest_id]["status"] != "active":
			continue
		var def: Dictionary = _definitions.get(quest_id, {})
		var indicators: Array = def.get("location_indicators", [])
		for indicator in indicators:
			var loc_name: String = indicator.get("location", "")
			var stage: int = indicator.get("stage", -1)
			if loc_name != "" and (stage < 0 or stage == _quests[quest_id]["stage"]):
				result[loc_name] = quest_id
	return result


## Get quest nodes that should currently exist on the map.
## Returns: Array of { "quest_id": String, "node_index": int, "data": Dictionary }
func get_active_quest_nodes() -> Array:
	var result: Array = []
	for quest_id in _quests:
		if _quests[quest_id]["status"] != "active":
			continue
		var stage: int = _quests[quest_id]["stage"]
		var def: Dictionary = _definitions.get(quest_id, {})
		var quest_nodes: Array = def.get("quest_nodes", [])
		for i in range(quest_nodes.size()):
			var qn: Dictionary = quest_nodes[i]
			var spawn_stage: int = qn.get("spawn_on_stage", 0)
			if stage >= spawn_stage:
				result.append({"quest_id": quest_id, "node_index": i, "data": qn})
	return result


# =============================================================================
# Save / Load
# =============================================================================

func get_save_data() -> Dictionary:
	return {"quests": _quests.duplicate(true)}


func load_save_data(data: Dictionary) -> void:
	_quests.clear()
	var quests_data: Dictionary = data.get("quests", {})
	for quest_id in quests_data:
		_quests[quest_id] = quests_data[quest_id]
		# Restore EventBus flags
		if _quests[quest_id]["status"] == "active":
			EventBus.set_flag(quest_id + "_active", true)
		elif _quests[quest_id]["status"] == "complete":
			EventBus.set_flag(quest_id + "_complete", true)
	print("[QuestManager] Loaded %d quests from save" % _quests.size())


func reset() -> void:
	for quest_id in _quests:
		EventBus.set_flag(quest_id + "_active", false)
		EventBus.set_flag(quest_id + "_complete", false)
	_quests.clear()


# =============================================================================
# Internal
# =============================================================================

func _load_definitions() -> void:
	var path := "res://data/quests/quest_definitions.json"
	var data = JSONLoader.load_json(path)
	if data == null:
		return

	if data is Dictionary:
		var quests_array: Array = data.get("quests", [])
		for quest in quests_array:
			if quest is Dictionary and quest.has("id"):
				_definitions[quest["id"]] = quest
