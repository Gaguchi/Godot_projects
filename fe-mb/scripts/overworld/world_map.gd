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

# Path preview
var _preview_lines: Array[Line2D] = []

var _hover_timer: SceneTreeTimer = null
var _pending_hover_loc: LocationData = null

# Event dialogue resource tracking
var _pre_event_gold: int = 0
var _pre_event_food: int = 0


func _ready() -> void:
	if GameManager.current_state != GameManager.GameState.OVERWORLD:
		GameManager.change_state(GameManager.GameState.OVERWORLD)

	input_manager.camera = camera
	input_manager.node_clicked.connect(_on_map_node_clicked)

	# Create the bottom panel HUD
	overworld_hud = OverworldHUD.new()
	add_child(overworld_hud)
	overworld_hud.setup(GameManager.party)

	# Connect dialogue system for event resolution
	DialogueManager.dialogue_finished.connect(_on_dialogue_finished)

	_setup_pause_menu()
	_load_map("overworld")
	_update_hud_location()


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

	# Load data
	map_data = NodeMapLoader.load_map(map_name)
	if map_data.is_empty():
		push_error("[WorldMap] Failed to load map: " + map_name)
		return

	regions = NodeMapLoader.parse_regions(map_data)
	locations = NodeMapLoader.parse_locations(map_data)

	for loc in locations:
		location_map[loc.id] = loc

	# Create procedural background
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

		# Brief pause at intermediate nodes
		if i < path.size() - 1:
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

	match loc.location_type:
		LocationData.LocationType.BATTLE:
			_start_battle(loc)
		LocationData.LocationType.TOWN:
			_enter_town(loc)
		LocationData.LocationType.EVENT:
			_trigger_random_event(loc)
		LocationData.LocationType.CAMP:
			_rest_at_camp(loc)
		LocationData.LocationType.DUNGEON:
			_enter_dungeon(loc)
		LocationData.LocationType.EXIT:
			_reach_exit(loc)


func _start_battle(loc: LocationData) -> void:
	var enemies: Array = []
	var num_enemies = loc.enemy_party_size
	var level = loc.enemy_level

	for i in range(num_enemies):
		var enemy = UnitData.new()
		enemy.unit_name = "Bandit %d" % (i + 1)
		enemy.is_player_unit = false
		enemy.max_hp = 12 + (level * 3)
		enemy.current_hp = enemy.max_hp
		enemy.strength = 3 + level
		enemy.speed = 3 + randi() % (level + 2)
		enemy.defense = 1 + int(level / 2.0)
		enemy.current_armor = enemy.defense

		var weapon = ItemData.new()
		weapon.weapon_type = (randi() % 3) as ItemData.WeaponType
		weapon.might = 3 + int(level / 2.0)
		weapon.hit = 80
		weapon.range_max = 1
		enemy.equipped_weapon = weapon

		enemies.append(enemy)

	GameManager.pending_battle = {
		"enemies": enemies,
		"difficulty": level,
		"source": "overworld",
		"location_id": loc.id,
		"location_name": loc.location_name
	}

	print("[WorldMap] Starting battle: %d enemies (level %d)" % [num_enemies, level])
	SceneLoader.change_scene_to_file("res://scenes/combat/battlefield.tscn")


func _enter_town(loc: LocationData) -> void:
	print("[WorldMap] Welcome to %s!" % loc.location_name)
	for unit in GameManager.party:
		if unit.is_alive():
			unit.current_hp = min(unit.current_hp + 5, unit.max_hp)
	EventBus.show_notification.emit("Welcome to %s! Party healed slightly." % loc.location_name)
	overworld_hud.update_resources()
	overworld_hud.update_party()


func _trigger_random_event(_loc: LocationData) -> void:
	# Snapshot resources before dialogue so we can animate changes after
	_pre_event_gold = GameManager.gold
	_pre_event_food = GameManager.food

	# TODO: Wave 2 will use EventManager to pick dialogue based on location/flags
	DialogueManager.start_dialogue("test_event_crossroads")


func _rest_at_camp(loc: LocationData) -> void:
	GameManager.rest_party(0.3)
	EventBus.show_notification.emit("Rested at %s. Party healed 30%%." % loc.location_name)
	overworld_hud.update_resources()
	overworld_hud.update_party()


func _enter_dungeon(loc: LocationData) -> void:
	var difficulty = loc.enemy_level
	GameManager.enter_dungeon(difficulty)
	SceneLoader.change_scene_to_file("res://scenes/dungeon/dungeon_map.tscn")


func _reach_exit(loc: LocationData) -> void:
	GameManager.end_run(true)
	EventBus.show_notification.emit("Victory! You've conquered the campaign!")


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


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		if pause_menu and not pause_menu.visible:
			pause_menu.open()
			get_viewport().set_input_as_handled()
