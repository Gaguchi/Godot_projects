extends Node
## EventBus - Global signal hub for decoupled communication
## Allows different systems to communicate without direct references

# Overworld signals
signal node_selected(node_id: int)
signal node_entered(node_id: int, node_type: String)
signal floor_completed(floor_num: int)
signal map_generated(floor_num: int)

# Combat signals
signal battle_started(enemy_data: Array)
signal battle_ended(victory: bool)
signal combat_started  # Simple trigger from world map
signal turn_started(is_player_turn: bool)
signal turn_ended(is_player_turn: bool)
signal unit_selected(unit: Node)
signal unit_moved(unit: Node, from: Vector2i, to: Vector2i)
signal unit_attacked(attacker: Node, defender: Node)
signal unit_died(unit: Node)
signal combat_calculated(result: Dictionary)

# UI signals
signal show_dialog(title: String, text: String, options: Array)
signal dialog_option_selected(option_index: int)
signal show_notification(message: String)
signal update_hud

# Event/Skill check signals
signal skill_check_started(skill_name: String, difficulty: int)
signal skill_check_resolved(success: bool, skill_name: String)
signal event_choice_made(event_id: String, choice_index: int)

# Shop signals
signal shop_opened(shop_inventory: Array)
signal item_purchased(item: Resource)
signal item_sold(item: Resource)


func _ready() -> void:
	print("[EventBus] Initialized")
