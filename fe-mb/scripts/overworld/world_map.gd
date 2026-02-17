extends Node2D
## WorldMap - FTL-style node graph overworld with organic map background
## Click any node to auto-pathfind and travel through the graph.

signal travel_started(from: LocationData, to: LocationData)
signal travel_completed(location: LocationData)
signal region_completed(region_index: int)

const LocationNodeScene = preload("res://scenes/overworld/location_node.tscn")

@onready var connections_layer: Node2D = $Connections
@onready var locations_container: Node2D = $Locations
@onready var input_manager: Node2D = $WorldInputManager
@onready var camera: Camera2D = $Camera2D
@onready var hover_tooltip: PanelContainer = $UI/HoverTooltip
@onready var tooltip_label: Label = $UI/HoverTooltip/MarginContainer/Label

var overworld_hud: OverworldHUD

var pause_menu_scene = preload("res://scenes/ui/pause_menu.tscn")
var map_pawn_scene = preload("res://scenes/overworld/map_pawn.tscn")
var pause_menu: Control = null
var player_pawn: Node2D = null
var map_background: MapBackground = null

# Map state
var map_data: Dictionary = {}
var regions: Array[Dictionary] = []
var locations: Array[LocationData] = []
var location_nodes: Dictionary = {}  # id -> LocationNode
var location_map: Dictionary = {}  # id -> LocationData
var is_traveling: bool = false

# Connection line references
var connection_lines: Dictionary = {}  # "min_max" key -> Line2D

# Dynamic quest nodes
const QUEST_NODE_BASE_ID: int = 10000
var _next_quest_node_id: int = QUEST_NODE_BASE_ID
var _quest_nodes_active: Dictionary = {}  # "quest_id_nodeindex" -> node_id
var _quest_battle_data: Dictionary = {}  # node_id -> battle config dict

# Path preview
var _preview_lines: Array[Line2D] = []

var _hover_timer: SceneTreeTimer = null
var _pending_hover_loc: LocationData = null

# Event dialogue resource tracking
var _pre_event_gold: int = 0
var _pre_event_food: int = 0

# Travel encounter state — tracks combat triggered from dialogue effects
var _encounter_combat_data: Dictionary = {}


func _ready() -> void:
	if GameManager.current_state != GameManager.GameState.OVERWORLD:
		GameManager.change_state(GameManager.GameState.OVERWORLD)

	input_manager.camera = camera
	input_manager.node_clicked.connect(_on_map_node_clicked)

	# Create the bottom panel HUD
	overworld_hud = OverworldHUD.new()
	add_child(overworld_hud)
	overworld_hud.setup(GameManager.party)
	overworld_hud.quest_log_requested.connect(_open_quest_log)

	# Connect dialogue system for event resolution
	DialogueManager.dialogue_finished.connect(_on_dialogue_finished)
	DialogueManager.effect_executed.connect(_on_dialogue_effect_executed)

	# Connect quest signals for dynamic node management
	QuestManager.quest_started.connect(_on_quest_changed)
	QuestManager.quest_completed.connect(_on_quest_changed)
	QuestManager.quest_stage_changed.connect(_on_quest_stage_changed)

	_setup_pause_menu()
	_load_map("overworld")
	_update_hud_location()
	_update_quest_indicators()

	# Guard against input during post-battle / post-dialogue resume
	var _has_pending_work: bool = (
		GameManager.pending_post_battle_dialogue != "" or
		not GameManager.pending_travel_path.is_empty()
	)
	if _has_pending_work:
		is_traveling = true  # Block clicks during resume

	# Handle post-battle dialogue (e.g. quest capture resolution)
	if GameManager.pending_post_battle_dialogue != "":
		var dialogue_id: String = GameManager.pending_post_battle_dialogue
		GameManager.pending_post_battle_dialogue = ""
		await get_tree().create_timer(0.3).timeout
		_pre_event_gold = GameManager.gold
		_pre_event_food = GameManager.food
		DialogueManager.start_dialogue(dialogue_id)
		await DialogueManager.dialogue_finished

	# Resume travel if returning from a mid-travel encounter
	if not GameManager.pending_travel_path.is_empty():
		var remaining_path = GameManager.pending_travel_path.duplicate()
		GameManager.pending_travel_path.clear()
		await get_tree().create_timer(0.3).timeout
		EventBus.show_notification.emit("Resuming journey...")
		_travel_path(remaining_path)  # sets is_traveling internally
	elif _has_pending_work:
		is_traveling = false  # Unblock only if _travel_path wasn't called

	# Show prologue on first game start
	if not EventBus.get_flag("prologue_seen"):
		is_traveling = true  # Block map clicks during prologue
		await get_tree().create_timer(0.5).timeout
		DialogueManager.start_dialogue("prologue")
		await DialogueManager.dialogue_finished
		is_traveling = false


func _setup_pause_menu() -> void:
	if not pause_menu:
		pause_menu = pause_menu_scene.instantiate()
		$UI.add_child(pause_menu)
		pause_menu.hide()


# --- Map Loading ---

func _load_map(map_name: String) -> void:
	# Clear existing
	for child in locations_container.get_children():
		child.queue_free()
	for child in connections_layer.get_children():
		child.queue_free()
	location_nodes.clear()
	location_map.clear()
	connection_lines.clear()

	# Load map data via NodeMapLoader (FTL-style: "nodes" key with explicit connections)
	map_data = NodeMapLoader.load_map(map_name)
	if map_data.is_empty():
		push_error("[WorldMap] Failed to load map: " + map_name)
		return

	regions = NodeMapLoader.parse_regions(map_data)
	locations = NodeMapLoader.parse_locations(map_data)

	for loc in locations:
		location_map[loc.id] = loc

	# Create procedural background (water + landmass + region tints)
	_create_background()

	# Draw connection lines
	_draw_connections()

	# Create location nodes
	for loc in locations:
		var node = LocationNodeScene.instantiate()
		node.setup(loc)
		node.location_hovered.connect(_on_location_hovered)
		node.location_unhovered.connect(_on_location_unhovered)
		locations_container.add_child(node)
		location_nodes[loc.id] = node

	# Spawn dynamic quest nodes for active quests (before position restore)
	_sync_quest_nodes()

	# Restore or set starting position
	var start_id = GameManager.current_location_id
	if start_id < 0 or start_id not in location_map:
		start_id = NodeMapLoader.find_spawn_node(map_data)
	GameManager.current_location_id = start_id

	if start_id in location_map:
		location_map[start_id].visited = true

	_update_reachable_locations()
	_spawn_pawn()

	if start_id in location_nodes:
		camera.position = location_nodes[start_id].position
	else:
		camera.position = Vector2(640, 360)

	print("[WorldMap] Loaded map '%s': %d locations, %d regions" % [
		map_data.get("name", map_name), locations.size(), regions.size()
	])


func _create_background() -> void:
	if map_background:
		map_background.queue_free()

	map_background = MapBackground.new()
	map_background.z_index = -10
	add_child(map_background)
	move_child(map_background, 0)

	# Gather position data for background generation
	var all_positions: Array[Vector2] = []
	var region_positions: Dictionary = {}

	for node_dict in map_data.get("nodes", []):
		var pos = Vector2(node_dict.get("x", 0), node_dict.get("y", 0))
		all_positions.append(pos)
		var rid = node_dict.get("region", "")
		if not rid.is_empty():
			if rid not in region_positions:
				region_positions[rid] = []
			region_positions[rid].append(pos)

	map_background.setup(all_positions, region_positions, regions)


func _spawn_pawn() -> void:
	if not player_pawn:
		player_pawn = map_pawn_scene.instantiate()
		add_child(player_pawn)
		player_pawn.z_index = 10

	var loc_id = GameManager.current_location_id
	if loc_id in location_nodes:
		player_pawn.position = location_nodes[loc_id].position


func _draw_connections() -> void:
	for loc in locations:
		for connected_id in loc.connected_locations:
			if connected_id > loc.id:
				var other = location_map.get(connected_id)
				if not other:
					continue

				var line = Line2D.new()
				line.add_point(loc.position)
				line.add_point(other.position)
				line.width = 2.0
				line.default_color = Color(0.227, 0.239, 0.282, 0.4)
				line.z_index = -5
				connections_layer.add_child(line)

				var key = _connection_key(loc.id, connected_id)
				connection_lines[key] = line


func _connection_key(a: int, b: int) -> String:
	return "%d_%d" % [mini(a, b), maxi(a, b)]


# --- Reachability & Visuals ---

func _update_reachable_locations() -> void:
	var current_id = GameManager.current_location_id
	var current_loc = location_map.get(current_id)
	if not current_loc:
		return

	var adjacent_ids: Array[int] = current_loc.connected_locations

	for id in location_nodes:
		var node = location_nodes[id]
		node.set_reachable(true)
		node.set_current(id == current_id)
		node.set_adjacent(id in adjacent_ids)

	# Highlight adjacent connection lines
	for key in connection_lines:
		var line: Line2D = connection_lines[key]
		var parts = key.split("_")
		var id_a = int(parts[0])
		var id_b = int(parts[1])

		var is_active = (id_a == current_id and id_b in adjacent_ids) or \
						(id_b == current_id and id_a in adjacent_ids)

		if is_active:
			line.default_color = Color(0.69, 0.44, 0.25, 0.6)
			line.width = 3.0
		else:
			line.default_color = Color(0.227, 0.239, 0.282, 0.4)
			line.width = 2.0


# --- BFS Pathfinding ---

## Find shortest path through node graph. Returns node IDs (excluding start, including end).
func _find_path(start_id: int, end_id: int) -> Array[int]:
	if start_id == end_id:
		return []

	var visited: Dictionary = {}
	var queue: Array[int] = [start_id]
	visited[start_id] = -1

	while queue.size() > 0:
		var current = queue.pop_front()

		if current == end_id:
			var path: Array[int] = []
			var node_id = end_id
			while node_id != start_id:
				path.append(node_id)
				node_id = visited[node_id]
			path.reverse()
			return path

		var loc = location_map.get(current)
		if not loc:
			continue
		for neighbor_id in loc.connected_locations:
			if neighbor_id not in visited:
				visited[neighbor_id] = current
				queue.append(neighbor_id)

	return []


# --- Click & Travel ---

func _on_dialogue_finished() -> void:
	# Animate any resource changes that happened during dialogue effects
	_animate_resource_change("gold", GameManager.gold - _pre_event_gold)
	_animate_resource_change("food", GameManager.food - _pre_event_food)
	overworld_hud.update_resources()
	overworld_hud.update_party()
	_sync_quest_nodes()
	_update_reachable_locations()
	_update_hud_location()
	_update_quest_indicators()


func _on_dialogue_effect_executed(effect_type: String, effect_data: Dictionary) -> void:
	if effect_type == "start_combat":
		var group_id: String = effect_data.get("enemy_group", "")
		_encounter_combat_data = {
			"enemy_group": group_id,
			"enemies": EventManager.generate_enemies(group_id),
			"name": "Ambush!",
		}


func _on_map_node_clicked(hit_node: Node) -> void:
	if is_traveling or DialogueManager.is_active():
		return

	var loc_node = hit_node.get_parent()
	if not loc_node.has_method("setup") or not loc_node.location_data:
		return

	var target = loc_node.location_data
	var current_id = GameManager.current_location_id

	if target.id == current_id:
		return

	var path = _find_path(current_id, target.id)
	if path.is_empty():
		return

	_clear_path_preview()
	_hide_hover_tooltip()
	_travel_path(path)


func _travel_path(path: Array[int]) -> void:
	is_traveling = true

	var start_loc = location_map.get(GameManager.current_location_id)
	var final_target = location_map.get(path[-1])

	if start_loc and final_target:
		travel_started.emit(start_loc, final_target)

	# Speed up animation for longer paths
	var hop_duration = 0.3 if path.size() <= 4 else 0.2
	var hop_pause = 0.08

	for i in range(path.size()):
		var node_id = path[i]
		var target_loc = location_map.get(node_id)
		if not target_loc:
			continue

		# Deduct 1 supply per hop
		var old_food: int = GameManager.food
		GameManager.consume_food(1)
		_animate_resource_change("food", GameManager.food - old_food)
		overworld_hud.update_resources()

		# Animate pawn
		var pawn_tween = create_tween()
		pawn_tween.tween_property(player_pawn, "position", target_loc.position, hop_duration) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)

		# Camera follows pawn
		var cam_tween = create_tween()
		cam_tween.tween_property(camera, "position", target_loc.position, hop_duration) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)

		await pawn_tween.finished

		# Update state as we pass through
		GameManager.current_location_id = node_id
		GameManager.nodes_visited += 1
		target_loc.visited = true

		# Roll for travel encounter on intermediate hops (not the final destination)
		if i < path.size() - 1:
			var encounter = EventManager.roll_travel_encounter()
			var remaining_path: Array[int] = []
			for j in range(i + 1, path.size()):
				remaining_path.append(path[j])

			if encounter["type"] == "dialogue":
				# Dialogue encounter — resolve inline, then check for combat
				_encounter_combat_data = {}
				_pre_event_gold = GameManager.gold
				_pre_event_food = GameManager.food
				is_traveling = false
				_update_reachable_locations()
				_update_hud_location()

				DialogueManager.start_dialogue(encounter["dialogue_id"])
				await DialogueManager.dialogue_finished

				# Check if dialogue triggered a start_combat effect
				if not _encounter_combat_data.is_empty():
					GameManager.pending_travel_path = remaining_path
					_start_encounter_battle(
						_encounter_combat_data["enemies"],
						_encounter_combat_data.get("name", "Ambush!")
					)
					_encounter_combat_data = {}
					return

				# No combat — resume traveling
				is_traveling = true
				await get_tree().create_timer(hop_pause).timeout

			elif encounter["type"] == "battle":
				# Direct battle encounter — save remaining path and transition
				GameManager.pending_travel_path = remaining_path
				var enemies = EventManager.generate_enemies(encounter.get("enemy_group", ""))
				var ct: Array = encounter.get("capture_targets", [])
				_start_encounter_battle(enemies, encounter.get("name", "Enemy Encounter"), ct)
				return

			else:
				# No encounter — brief pause and continue
				await get_tree().create_timer(hop_pause).timeout

	_update_reachable_locations()
	is_traveling = false

	# Update HUD with final destination info
	_update_hud_location()

	# Trigger event only at final destination
	if final_target:
		_trigger_location_event(final_target)

	if final_target:
		travel_completed.emit(final_target)


# --- Hover Preview ---

func _on_location_hovered(loc_data: LocationData) -> void:
	_clear_path_preview()

	if is_traveling or not loc_data:
		_hide_hover_tooltip()
		_pending_hover_loc = null
		return

	var current_id = GameManager.current_location_id

	# Draw path preview immediately (it's spatial, not obscuring)
	if loc_data.id != current_id:
		var path = _find_path(current_id, loc_data.id)
		if not path.is_empty():
			var full_path: Array[int] = [current_id]
			full_path.append_array(path)
			for i in range(full_path.size() - 1):
				var from_loc = location_map.get(full_path[i])
				var to_loc = location_map.get(full_path[i + 1])
				if from_loc and to_loc:
					var line = Line2D.new()
					line.add_point(from_loc.position)
					line.add_point(to_loc.position)
					line.width = 4.0
					line.default_color = Color(0.416, 0.439, 0.502, 0.45)
					line.z_index = -3
					connections_layer.add_child(line)
					_preview_lines.append(line)

	# Delay tooltip by 150ms
	_pending_hover_loc = loc_data
	_hover_timer = get_tree().create_timer(0.15)
	_hover_timer.timeout.connect(func():
		if _pending_hover_loc == loc_data:
			if loc_data.id == current_id:
				_show_hover_tooltip(loc_data, 0)
			else:
				var path = _find_path(current_id, loc_data.id)
				if not path.is_empty():
					_show_hover_tooltip(loc_data, path.size())
				else:
					_hide_hover_tooltip()
	, CONNECT_ONE_SHOT)


func _on_location_unhovered() -> void:
	_pending_hover_loc = null
	_clear_path_preview()
	_hide_hover_tooltip()


func _clear_path_preview() -> void:
	for line in _preview_lines:
		if is_instance_valid(line):
			line.queue_free()
	_preview_lines.clear()


func _show_hover_tooltip(loc: LocationData, hops: int) -> void:
	var type_name = LocationData.LocationType.keys()[loc.location_type]
	var text = loc.location_name + "\n" + type_name

	if hops > 0:
		var supply_cost: int = hops
		var current_supply: int = GameManager.food
		text += "  |  %d hop%s" % [hops, "s" if hops > 1 else ""]
		text += "\nCost: %d supplies (have: %d)" % [supply_cost, current_supply]

		# Color the tooltip based on affordability
		if current_supply < supply_cost:
			tooltip_label.add_theme_color_override("font_color", Color(0.769, 0.267, 0.267))  # Blood red
		elif current_supply - supply_cost <= 2:
			tooltip_label.add_theme_color_override("font_color", Color(0.69, 0.44, 0.25))  # Ember warning
		else:
			tooltip_label.add_theme_color_override("font_color", Color(0.832, 0.812, 0.761))  # Parchment
	else:
		tooltip_label.add_theme_color_override("font_color", Color(0.832, 0.812, 0.761))  # Parchment

	if loc.visited:
		text += " (visited)"

	tooltip_label.text = text
	if not hover_tooltip.visible:
		hover_tooltip.modulate = Color(1, 1, 1, 0)
	hover_tooltip.visible = true
	var show_tween = create_tween()
	show_tween.tween_property(hover_tooltip, "modulate:a", 1.0, 0.1)

	# Position tooltip near the node in screen space
	var screen_pos = get_viewport().get_canvas_transform() * loc.position
	var tooltip_pos = screen_pos + Vector2(20, -60)
	# Clamp to viewport
	tooltip_pos.x = clampf(tooltip_pos.x, 0, 1280 - 220)
	tooltip_pos.y = clampf(tooltip_pos.y, 0, 720 - 70)

	# Check if tooltip overlaps the node (within ~25px)
	var node_screen = screen_pos
	var tooltip_rect = Rect2(tooltip_pos, Vector2(220, 70))
	var node_rect = Rect2(node_screen - Vector2(25, 25), Vector2(50, 50))
	if tooltip_rect.intersects(node_rect):
		# Flip to below-right of node
		tooltip_pos = screen_pos + Vector2(20, 30)
		tooltip_pos.x = clampf(tooltip_pos.x, 0, 1280 - 220)
		tooltip_pos.y = clampf(tooltip_pos.y, 0, 720 - 70)

	hover_tooltip.position = tooltip_pos


func _hide_hover_tooltip() -> void:
	if not hover_tooltip.visible:
		return
	var tween = create_tween()
	tween.tween_property(hover_tooltip, "modulate:a", 0.0, 0.1)
	tween.tween_callback(func():
		hover_tooltip.visible = false
		hover_tooltip.modulate = Color(1, 1, 1, 1)
	)


# --- Location Events ---

func _trigger_location_event(loc: LocationData) -> void:
	print("[WorldMap] Arrived at: %s (%s)" % [loc.location_name, LocationData.LocationType.keys()[loc.location_type]])

	# Auto-save on arrival at any location
	if GameManager.current_save_slot > 0:
		SaveManager.save_game(GameManager.current_save_slot)

	match loc.location_type:
		LocationData.LocationType.TOWN:
			_enter_town(loc)
		LocationData.LocationType.CAMP:
			_rest_at_camp(loc)
		LocationData.LocationType.DUNGEON:
			_enter_dungeon(loc)
		LocationData.LocationType.EXIT:
			_reach_exit(loc)
		LocationData.LocationType.QUEST:
			_enter_quest_battle(loc)


## Start a battle from a travel encounter (random battle or dialogue-triggered combat)
func _start_encounter_battle(enemies: Array, encounter_name: String, capture_targets: Array = []) -> void:
	GameManager.pending_battle = {
		"enemies": enemies,
		"difficulty": 1,
		"source": "travel_encounter",
		"location_id": GameManager.current_location_id,
		"location_name": encounter_name,
	}
	if not capture_targets.is_empty():
		GameManager.pending_battle["capture_targets"] = capture_targets

	print("[WorldMap] Travel encounter battle: %s (%d enemies)" % [encounter_name, enemies.size()])
	SceneLoader.change_scene_to_file("res://scenes/combat/battlefield.tscn")


func _enter_town(loc: LocationData) -> void:
	print("[WorldMap] Welcome to %s!" % loc.location_name)
	var town_menu := TownMenu.new()
	add_child(town_menu)
	town_menu.open(loc.location_name)
	town_menu.town_closed.connect(func():
		town_menu.queue_free()
		overworld_hud.update_resources()
		overworld_hud.update_party()
	)


func _rest_at_camp(loc: LocationData) -> void:
	var popup := CampPopup.new()
	add_child(popup)
	popup.open(loc.location_name)
	popup.popup_closed.connect(func():
		popup.queue_free()
		overworld_hud.update_resources()
		overworld_hud.update_party()
	)


func _enter_dungeon(loc: LocationData) -> void:
	var difficulty = loc.enemy_level
	GameManager.enter_dungeon(difficulty)
	SceneLoader.change_scene_to_file("res://scenes/dungeon/dungeon_map.tscn")


func _reach_exit(loc: LocationData) -> void:
	GameManager.end_run(true)
	EventBus.show_notification.emit("Victory! You've conquered the campaign!")


func _enter_quest_battle(loc: LocationData) -> void:
	var battle_data: Dictionary = _quest_battle_data.get(loc.id, {})
	if battle_data.is_empty():
		EventBus.show_notification.emit("Nothing here...")
		return

	var enemy_group: String = battle_data.get("enemy_group", "")
	var enemies: Array = EventManager.generate_enemies(enemy_group)
	var battle_name: String = battle_data.get("name", "Quest Battle")
	var capture_targets: Array = battle_data.get("capture_targets", [])

	GameManager.pending_battle = {
		"enemies": enemies,
		"difficulty": 1,
		"source": "quest_battle",
		"location_id": loc.id,
		"location_name": battle_name,
		"capture_targets": capture_targets,
	}

	print("[WorldMap] Quest battle: %s (%d enemies)" % [battle_name, enemies.size()])
	SceneLoader.change_scene_to_file("res://scenes/combat/battlefield.tscn")


## Update the HUD location section with current location info
func _update_hud_location() -> void:
	if not overworld_hud:
		return
	var current_loc = location_map.get(GameManager.current_location_id)
	if current_loc:
		var type_name = LocationData.LocationType.keys()[current_loc.location_type]
		overworld_hud.update_location(current_loc.location_name, type_name)
	else:
		overworld_hud.update_location("---", "")


func _animate_resource_change(resource_name: String, delta: int) -> void:
	if delta == 0 or not overworld_hud:
		return
	var target_label: Label = overworld_hud.get_resource_label(resource_name)
	if not target_label:
		return
	var float_label: Label = Label.new()
	float_label.text = "+%d" % delta if delta > 0 else str(delta)
	float_label.add_theme_font_size_override("font_size", 14)
	float_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	float_label.add_theme_constant_override("shadow_offset_x", 1)
	float_label.add_theme_constant_override("shadow_offset_y", 1)
	if delta > 0:
		float_label.add_theme_color_override("font_color", Color(0.353, 0.541, 0.353))  # Moss green
	else:
		float_label.add_theme_color_override("font_color", Color(0.769, 0.267, 0.267))  # Blood red
	# Position above the target label in the UI layer
	float_label.position = target_label.position + Vector2(0, -5)
	target_label.get_parent().add_child(float_label)
	# Animate: float up 20px + fade out
	var tween: Tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(float_label, "position:y", float_label.position.y - 20, 0.8).set_ease(Tween.EASE_OUT)
	tween.tween_property(float_label, "modulate:a", 0.0, 0.8).set_delay(0.2)
	await tween.finished
	if is_instance_valid(float_label):
		float_label.queue_free()


## Open the quest log overlay.
func _open_quest_log() -> void:
	if is_traveling or DialogueManager.is_active():
		return
	var quest_log := QuestLogPanel.new()
	add_child(quest_log)


# --- Dynamic Quest Nodes ---

func _on_quest_changed(_quest_id: String) -> void:
	_sync_quest_nodes()
	_update_reachable_locations()
	_update_quest_indicators()


func _on_quest_stage_changed(_quest_id: String, _stage: int) -> void:
	_sync_quest_nodes()
	_update_reachable_locations()
	_update_quest_indicators()


## Synchronize dynamic quest nodes: create missing, remove stale.
func _sync_quest_nodes() -> void:
	var desired: Array = QuestManager.get_active_quest_nodes()
	var desired_keys: Dictionary = {}

	for entry in desired:
		var key: String = "%s_%d" % [entry["quest_id"], entry["node_index"]]
		desired_keys[key] = entry

	# Remove nodes that shouldn't exist anymore
	var keys_to_remove: Array = []
	for key in _quest_nodes_active:
		if key not in desired_keys:
			keys_to_remove.append(key)
	for key in keys_to_remove:
		_remove_quest_node(key)

	# Create nodes that should exist but don't
	for key in desired_keys:
		if key not in _quest_nodes_active:
			_create_quest_node(key, desired_keys[key])


func _create_quest_node(key: String, entry: Dictionary) -> void:
	var data: Dictionary = entry["data"]
	var node_id: int = _next_quest_node_id
	_next_quest_node_id += 1

	# Create LocationData
	var loc := LocationData.new()
	loc.id = node_id
	loc.location_name = data.get("name", "Quest Location")
	loc.location_type = LocationData.LocationType.QUEST
	loc.position = Vector2(data.get("x", 0), data.get("y", 0))
	var connections: Array = data.get("connections", [])
	for c in connections:
		loc.connected_locations.append(int(c))

	# Register in data structures
	locations.append(loc)
	location_map[node_id] = loc

	# Make connected nodes connect back to this one
	for c_id in loc.connected_locations:
		var c_loc: LocationData = location_map.get(c_id)
		if c_loc and node_id not in c_loc.connected_locations:
			c_loc.connected_locations.append(node_id)

	# Create visual node
	var vis_node = LocationNodeScene.instantiate()
	vis_node.setup(loc)
	vis_node.location_hovered.connect(_on_location_hovered)
	vis_node.location_unhovered.connect(_on_location_unhovered)
	locations_container.add_child(vis_node)
	location_nodes[node_id] = vis_node

	# Draw connection lines
	for c_id in loc.connected_locations:
		var other_loc: LocationData = location_map.get(c_id)
		if other_loc:
			var line = Line2D.new()
			line.add_point(loc.position)
			line.add_point(other_loc.position)
			line.width = 2.0
			line.default_color = Color(0.227, 0.239, 0.282, 0.4)
			line.z_index = -5
			connections_layer.add_child(line)
			var conn_key = _connection_key(node_id, c_id)
			connection_lines[conn_key] = line

	# Store battle data if present
	if data.has("battle"):
		_quest_battle_data[node_id] = data["battle"]

	_quest_nodes_active[key] = node_id
	print("[WorldMap] Created quest node '%s' (id %d) at %s" % [loc.location_name, node_id, loc.position])


func _remove_quest_node(key: String) -> void:
	var node_id: int = _quest_nodes_active[key]
	var loc: LocationData = location_map.get(node_id)

	# If player is at this node, relocate to a connected base node
	if GameManager.current_location_id == node_id and loc:
		for c_id in loc.connected_locations:
			if c_id < QUEST_NODE_BASE_ID and location_map.has(c_id):
				GameManager.current_location_id = c_id
				if player_pawn and location_nodes.has(c_id):
					player_pawn.position = location_nodes[c_id].position
				if camera:
					camera.position = location_nodes[c_id].position
				break

	# Remove connection lines
	if loc:
		for c_id in loc.connected_locations:
			var conn_key = _connection_key(node_id, c_id)
			if connection_lines.has(conn_key):
				var line: Line2D = connection_lines[conn_key]
				if is_instance_valid(line):
					line.queue_free()
				connection_lines.erase(conn_key)
			# Remove back-connection from the other node
			var c_loc: LocationData = location_map.get(c_id)
			if c_loc:
				c_loc.connected_locations.erase(node_id)

	# Remove visual node
	if location_nodes.has(node_id):
		var vis_node = location_nodes[node_id]
		if is_instance_valid(vis_node):
			vis_node.queue_free()
		location_nodes.erase(node_id)

	# Remove from data structures
	location_map.erase(node_id)
	for i in range(locations.size() - 1, -1, -1):
		if locations[i].id == node_id:
			locations.remove_at(i)
			break

	_quest_battle_data.erase(node_id)
	_quest_nodes_active.erase(key)
	print("[WorldMap] Removed quest node (id %d)" % node_id)


## Update quest "!" indicators on location nodes based on QuestManager data.
func _update_quest_indicators() -> void:
	var quest_locs: Dictionary = QuestManager.get_quest_locations()
	for id in location_nodes:
		var node = location_nodes[id]
		var loc: LocationData = location_map.get(id)
		if loc and loc.location_name in quest_locs:
			node.set_quest_indicator(true)
		else:
			node.set_quest_indicator(false)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		if pause_menu and not pause_menu.visible:
			pause_menu.open()
			get_viewport().set_input_as_handled()
