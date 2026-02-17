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
	return EventBus.evaluate_condition(condition)


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
			QuestManager.start_quest(effect.get("quest_id", ""))
		"complete_quest":
			QuestManager.complete_quest(effect.get("quest_id", ""))
		"advance_quest":
			var stage: int = effect.get("stage", -1)
			QuestManager.advance_quest(effect.get("quest_id", ""), stage)
		"give_item":
			_give_item(effect)
		"start_combat":
			pass  # Handled by world_map via effect_executed signal
		"recruit_unit":
			_recruit_unit(effect)

	effect_executed.emit(effect_type, effect)


# =============================================================================
# Recruit & Item Helpers
# =============================================================================

## Create a UnitData from an effect dict and add to party.
## Effect format: { "type": "recruit_unit", "unit_name": "Kael", "unit_class": "BOUNTY_HUNTER",
##   "level": 3, "max_hp": 24, "strength": 7, ... , "weapon": { weapon dict } }
func _recruit_unit(effect: Dictionary) -> void:
	var unit := UnitData.new()
	unit.unit_name = effect.get("unit_name", "Recruit")
	unit.is_player_unit = true

	# Parse unit class from string
	var class_str: String = effect.get("unit_class", "FIGHTER")
	match class_str:
		"FIGHTER": unit.unit_class = UnitData.UnitClass.FIGHTER
		"KNIGHT": unit.unit_class = UnitData.UnitClass.KNIGHT
		"CAVALIER": unit.unit_class = UnitData.UnitClass.CAVALIER
		"ARCHER": unit.unit_class = UnitData.UnitClass.ARCHER
		"MAGE": unit.unit_class = UnitData.UnitClass.MAGE
		"CLERIC": unit.unit_class = UnitData.UnitClass.CLERIC
		"THIEF": unit.unit_class = UnitData.UnitClass.THIEF
		"LORD": unit.unit_class = UnitData.UnitClass.LORD
		"BOUNTY_HUNTER": unit.unit_class = UnitData.UnitClass.BOUNTY_HUNTER

	unit.level = effect.get("level", 1)
	unit.max_hp = effect.get("max_hp", 20)
	unit.current_hp = effect.get("current_hp", unit.max_hp)
	unit.strength = effect.get("strength", 5)
	unit.magic = effect.get("magic", 0)
	unit.skill = effect.get("skill", 5)
	unit.speed = effect.get("speed", 5)
	unit.luck = effect.get("luck", 5)
	unit.defense = effect.get("defense", 5)
	unit.resistance = effect.get("resistance", 2)
	unit.movement = effect.get("movement", 5)
	unit.current_armor = unit.defense

	# Growth rates
	unit.hp_growth = effect.get("hp_growth", 50)
	unit.str_growth = effect.get("str_growth", 40)
	unit.mag_growth = effect.get("mag_growth", 0)
	unit.skl_growth = effect.get("skl_growth", 35)
	unit.spd_growth = effect.get("spd_growth", 35)
	unit.lck_growth = effect.get("lck_growth", 30)
	unit.def_growth = effect.get("def_growth", 25)
	unit.res_growth = effect.get("res_growth", 20)

	# Equip weapon if provided
	var weapon_data: Dictionary = effect.get("weapon", {})
	if not weapon_data.is_empty():
		unit.equipped_weapon = ItemData.create_from_dict(weapon_data)

	if GameManager.add_unit(unit):
		EventBus.show_notification.emit("%s joined the party!" % unit.unit_name)
		print("[DialogueManager] Recruited unit: %s (%s)" % [unit.unit_name, class_str])
	else:
		EventBus.show_notification.emit("Party is full! %s could not join." % unit.unit_name)
		print("[DialogueManager] Party full, could not recruit: %s" % unit.unit_name)


## Give an item to the first party member (or specified unit).
## Effect format: { "type": "give_item", "item_name": "Iron Sword" } — looks up catalog
## OR: { "type": "give_item", "item": { full item dict } } — creates from dict directly
func _give_item(effect: Dictionary) -> void:
	var item: ItemData = null

	# Direct item dict
	var item_dict: Dictionary = effect.get("item", {})
	if not item_dict.is_empty():
		item = ItemData.create_from_dict(item_dict)
	else:
		# Lookup from catalog by name
		var item_name: String = effect.get("item_name", "")
		item = _load_item_from_catalog(item_name)

	if item == null:
		print("[DialogueManager] give_item failed: could not create item")
		return

	# Give to specified unit or first party member with space
	var target_unit_name: String = effect.get("target_unit", "")
	for unit in GameManager.party:
		if target_unit_name != "" and unit.unit_name != target_unit_name:
			continue
		unit.add_item(item)
		EventBus.show_notification.emit("Received %s!" % item.item_name)
		print("[DialogueManager] Gave %s to %s" % [item.item_name, unit.unit_name])
		return

	# Fallback: give to first alive unit
	if GameManager.party.size() > 0:
		GameManager.party[0].add_item(item)
		EventBus.show_notification.emit("Received %s!" % item.item_name)
		print("[DialogueManager] Gave %s to %s (fallback)" % [item.item_name, GameManager.party[0].unit_name])


## Load an item from the item catalog JSON by name.
func _load_item_from_catalog(item_name: String) -> ItemData:
	var path := "res://data/items/item_catalog.json"
	if not FileAccess.file_exists(path):
		return null

	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return null

	var json := JSON.new()
	if json.parse(file.get_as_text()) != OK:
		file.close()
		return null
	file.close()

	var data = json.data
	if not data is Dictionary:
		return null

	var items: Array = data.get("items", [])
	for entry in items:
		if entry is Dictionary and entry.get("item_name", "") == item_name:
			return ItemData.create_from_dict(entry)

	print("[DialogueManager] Item not found in catalog: %s" % item_name)
	return null


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
