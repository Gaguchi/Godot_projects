extends Node
## DialogueManager - Singleton autoload that drives visual novel-style dialogue.
## Loads dialogue JSON files, sequences nodes, resolves conditions, executes effects.

# --- Signals ---
signal dialogue_started(dialogue_id: String)
signal dialogue_line_ready(speaker: String, text: String, portrait: String)
signal dialogue_choices_ready(choices: Array)
signal dialogue_finished
signal effect_executed(effect_type: String, effect_data: Dictionary)

# --- State ---
var _dialogue_data: Dictionary = {}
var _current_node_id: String = ""
var _is_active: bool = false
var _dialogue_box: DialogueBox = null

# --- Flags (per-run) ---
var _flags: Dictionary = {}

# --- Stat check pending state ---
var _stat_check_display: StatCheckDisplay = null


func _ready() -> void:
	print("[DialogueManager] Initialized")


# =============================================================================
# Public API
# =============================================================================

## Start a dialogue from a JSON file in res://data/dialogue/
func start_dialogue(dialogue_id: String) -> void:
	if _is_active:
		print("[DialogueManager] Already in dialogue, ignoring start_dialogue(%s)" % dialogue_id)
		return

	_dialogue_data = _load_dialogue(dialogue_id)
	if _dialogue_data.is_empty():
		print("[DialogueManager] Failed to load dialogue: %s" % dialogue_id)
		return

	_is_active = true

	# Create the dialogue box UI
	_create_dialogue_box()

	dialogue_started.emit(dialogue_id)
	print("[DialogueManager] Started dialogue: %s" % dialogue_id)

	# Show the first node (always "start")
	_show_node("start")


## Advance to the next line (called when player clicks with no choices showing)
func advance() -> void:
	if not _is_active:
		return

	var node: Dictionary = _find_node(_current_node_id)
	if node.is_empty():
		end_dialogue()
		return

	var next_id = node.get("next", null)
	if next_id == null or next_id == "":
		end_dialogue()
		return

	_show_node(next_id)


## Player selected a choice by index
func select_choice(choice_index: int) -> void:
	if not _is_active:
		return

	var node: Dictionary = _find_node(_current_node_id)
	if node.is_empty():
		return

	var choices: Array = node.get("choices", [])
	# Build the filtered choices the same way we did when displaying them
	var filtered_choices: Array = _get_filtered_choices(choices)

	if choice_index < 0 or choice_index >= filtered_choices.size():
		print("[DialogueManager] Invalid choice index: %d" % choice_index)
		return

	var choice: Dictionary = filtered_choices[choice_index]

	# Check for stat_check effect - it overrides normal navigation
	var effects: Array = choice.get("effects", [])
	for effect in effects:
		if effect.get("type", "") == "stat_check":
			_handle_stat_check(effect)
			return

	# Execute any non-stat-check effects
	_execute_effects(effects)

	# Navigate to choice's next node
	var next_id = choice.get("next", null)
	if next_id == null or next_id == "":
		end_dialogue()
		return

	_show_node(next_id)


## End dialogue and clean up
func end_dialogue() -> void:
	_is_active = false
	_dialogue_data = {}
	_current_node_id = ""

	if _dialogue_box:
		_dialogue_box.close()
		_dialogue_box = null

	if _stat_check_display:
		_stat_check_display.queue_free()
		_stat_check_display = null

	dialogue_finished.emit()
	print("[DialogueManager] Dialogue finished")


## Check if dialogue is currently active
func is_active() -> bool:
	return _is_active


# =============================================================================
# Flag Management
# =============================================================================

func get_flag(flag_name: String) -> bool:
	# Check local flags first, then EventBus flags
	if _flags.has(flag_name):
		return _flags[flag_name]
	return EventBus.get_flag(flag_name)


func set_flag(flag_name: String, value: bool = true) -> void:
	if value:
		_flags[flag_name] = true
		EventBus.set_flag(flag_name, true)
	else:
		_flags.erase(flag_name)
		EventBus.set_flag(flag_name, false)


func clear_all_flags() -> void:
	_flags.clear()


# =============================================================================
# Internal: Loading & Navigation
# =============================================================================

func _load_dialogue(dialogue_id: String) -> Dictionary:
	var path: String = "res://data/dialogue/%s.json" % dialogue_id
	if not FileAccess.file_exists(path):
		print("[DialogueManager] Dialogue file not found: %s" % path)
		return {}

	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		print("[DialogueManager] Failed to open: %s" % path)
		return {}

	var json_text: String = file.get_as_text()
	file.close()

	var json := JSON.new()
	var err := json.parse(json_text)
	if err != OK:
		print("[DialogueManager] JSON parse error in %s: %s" % [path, json.get_error_message()])
		return {}

	var data = json.data
	if data is Dictionary:
		return data
	return {}


func _find_node(node_id: String) -> Dictionary:
	var lines: Array = _dialogue_data.get("lines", [])
	for line in lines:
		if line is Dictionary and line.get("id", "") == node_id:
			return line
	return {}


func _show_node(node_id: String) -> void:
	var node: Dictionary = _find_node(node_id)
	if node.is_empty():
		print("[DialogueManager] Node not found: %s" % node_id)
		end_dialogue()
		return

	_current_node_id = node_id

	# Execute any effects attached to this node (run before displaying text)
	var node_effects: Array = node.get("effects", [])
	_execute_effects(node_effects)

	var speaker: String = node.get("speaker", "")
	var text: String = node.get("text", "")
	var portrait: String = node.get("portrait", "")

	# Check for choices
	var choices: Array = node.get("choices", [])
	var filtered_choices: Array = _get_filtered_choices(choices)

	# Emit the line signal
	dialogue_line_ready.emit(speaker, text, portrait)

	# Show in the dialogue box
	if _dialogue_box:
		_dialogue_box.show_line(speaker, text, portrait)

		if filtered_choices.size() > 0:
			_dialogue_box.show_choices(filtered_choices)
		else:
			_dialogue_box.hide_choices()

	# Also emit choices if they exist
	if filtered_choices.size() > 0:
		dialogue_choices_ready.emit(filtered_choices)


func _get_filtered_choices(choices: Array) -> Array:
	var filtered: Array = []
	for choice in choices:
		if choice is Dictionary:
			var condition = choice.get("condition", {})
			if condition.is_empty() or _evaluate_condition(condition):
				filtered.append(choice)
	return filtered


# =============================================================================
# Condition Evaluation
# =============================================================================

func _evaluate_condition(condition: Dictionary) -> bool:
	match condition.get("type", ""):
		"has_flag":
			return get_flag(condition.get("flag", ""))
		"not_flag":
			return not get_flag(condition.get("flag", ""))
		"has_unit_class":
			for unit in GameManager.party:
				if unit.get_class_name() == condition.get("class", ""):
					return true
			return false
		"stat_min":
			for unit in GameManager.party:
				if unit.get(condition.get("stat", "strength")) >= condition.get("min_value", 0):
					return true
			return false
		"has_gold":
			return GameManager.gold >= condition.get("amount", 0)
		"has_item":
			for unit in GameManager.party:
				for item in unit.inventory:
					if item.item_name == condition.get("item_name", ""):
						return true
			return false
		"quest_active", "quest_complete":
			return false  # Will be wired when QuestManager exists
	return true  # Unknown condition type = pass


# =============================================================================
# Effect Execution
# =============================================================================

func _execute_effects(effects: Array) -> void:
	for effect in effects:
		if effect is Dictionary:
			# Skip stat_check here - those are handled specially in select_choice
			if effect.get("type", "") != "stat_check":
				_execute_effect(effect)


func _execute_effect(effect: Dictionary) -> void:
	var effect_type: String = effect.get("type", "")
	match effect_type:
		"add_gold":
			GameManager.add_gold(effect.get("amount", 0))
		"add_food":
			GameManager.food += effect.get("amount", 0)
			GameManager.resources_changed.emit()
		"heal_party":
			var pct: float = effect.get("percent", 0.3)
			GameManager.rest_party(pct)
		"damage_party":
			var dmg: int = effect.get("amount", 5)
			for unit in GameManager.party:
				if unit.is_alive():
					unit.current_hp = max(1, unit.current_hp - dmg)
			GameManager.party_changed.emit()
		"set_flag":
			set_flag(effect.get("flag", ""))
		"clear_flag":
			set_flag(effect.get("flag", ""), false)
		"start_quest":
			pass  # Will be wired when QuestManager exists
		"complete_quest":
			pass  # Will be wired when QuestManager exists
		"give_item":
			pass  # Will be implemented later
		"start_combat":
			pass  # Will be implemented later
		"recruit_unit":
			pass  # Will be implemented later

	effect_executed.emit(effect_type, effect)


# =============================================================================
# Stat Check
# =============================================================================

func _handle_stat_check(effect: Dictionary) -> void:
	var stat_name: String = effect.get("stat", "strength")
	var difficulty: int = effect.get("difficulty", 15)
	var success_next: String = effect.get("success_next", "")
	var fail_next: String = effect.get("fail_next", "")

	# Hide dialogue box choices while stat check is active
	if _dialogue_box:
		_dialogue_box.hide_choices()

	_show_stat_check(stat_name, difficulty, success_next, fail_next)


func _show_stat_check(stat_name: String, difficulty: int, success_next: String, fail_next: String) -> void:
	# Create the stat check display
	_stat_check_display = StatCheckDisplay.new()
	get_tree().root.add_child(_stat_check_display)
	_stat_check_display.setup(stat_name, difficulty, GameManager.party)
	_stat_check_display.check_completed.connect(
		func(success: bool) -> void:
			# Clean up the stat check display
			if _stat_check_display:
				_stat_check_display.queue_free()
				_stat_check_display = null

			# Navigate based on result
			var next_id: String = success_next if success else fail_next
			if next_id == "" or next_id == null:
				end_dialogue()
			else:
				_show_node(next_id)
	)


# =============================================================================
# Dialogue Box Management
# =============================================================================

func _create_dialogue_box() -> void:
	if _dialogue_box:
		_dialogue_box.close()
		_dialogue_box = null

	_dialogue_box = DialogueBox.new()
	get_tree().root.add_child(_dialogue_box)

	# Connect dialogue box signals
	_dialogue_box.advance_requested.connect(_on_dialogue_box_advance)
	_dialogue_box.choice_selected.connect(_on_dialogue_box_choice)


func _on_dialogue_box_advance() -> void:
	advance()


func _on_dialogue_box_choice(index: int) -> void:
	select_choice(index)
