extends Node
## EventBus - Global signal hub for decoupled communication
## Allows different systems to communicate without direct references
## Signals are emitted by external scripts, so suppress unused warnings.

# Overworld signals
@warning_ignore("unused_signal")
signal node_selected(node_id: int)
@warning_ignore("unused_signal")
signal node_entered(node_id: int, node_type: String)
@warning_ignore("unused_signal")
signal floor_completed(floor_num: int)
@warning_ignore("unused_signal")
signal map_generated(floor_num: int)

# Combat signals
@warning_ignore("unused_signal")
signal battle_started(enemy_data: Array)
@warning_ignore("unused_signal")
signal battle_ended(victory: bool)
@warning_ignore("unused_signal")
signal combat_started
@warning_ignore("unused_signal")
signal turn_started(is_player_turn: bool)
@warning_ignore("unused_signal")
signal turn_ended(is_player_turn: bool)
@warning_ignore("unused_signal")
signal unit_selected(unit: Node)
@warning_ignore("unused_signal")
signal unit_moved(unit: Node, from: Vector2i, to: Vector2i)
@warning_ignore("unused_signal")
signal unit_attacked(attacker: Node, defender: Node)
@warning_ignore("unused_signal")
signal unit_died(unit: Node)
@warning_ignore("unused_signal")
signal unit_turn_started(unit: Node)
@warning_ignore("unused_signal")
signal combat_calculated(result: Dictionary)
@warning_ignore("unused_signal")
signal unit_leveled_up(unit_data: Resource, stat_gains: Dictionary)

# UI signals
@warning_ignore("unused_signal")
signal show_dialog(title: String, text: String, options: Array)
@warning_ignore("unused_signal")
signal dialog_option_selected(option_index: int)
@warning_ignore("unused_signal")
signal show_notification(message: String)
@warning_ignore("unused_signal")
signal update_hud

# Event/Skill check signals
@warning_ignore("unused_signal")
signal skill_check_started(skill_name: String, difficulty: int)
@warning_ignore("unused_signal")
signal skill_check_resolved(success: bool, skill_name: String)
@warning_ignore("unused_signal")
signal event_choice_made(event_id: String, choice_index: int)

# Dialogue signals
@warning_ignore("unused_signal")
signal dialogue_requested(dialogue_id: String)
@warning_ignore("unused_signal")
signal location_arrived(location_id: int)

# Shop signals
@warning_ignore("unused_signal")
signal shop_opened(shop_inventory: Array)
@warning_ignore("unused_signal")
signal item_purchased(item: Resource)
@warning_ignore("unused_signal")
signal item_sold(item: Resource)


func _ready() -> void:
	print("[EventBus] Initialized")


# --- Dialogue/Event Flags ---
var _flags: Dictionary = {}

func get_flag(flag_name: String) -> bool:
	return _flags.get(flag_name, false)

func set_flag(flag_name: String, value: bool = true) -> void:
	if value:
		_flags[flag_name] = true
	else:
		_flags.erase(flag_name)

func clear_all_flags() -> void:
	_flags.clear()

func get_all_flags() -> Dictionary:
	return _flags.duplicate()

func set_flags_from_dict(flags: Dictionary) -> void:
	_flags = flags.duplicate()
