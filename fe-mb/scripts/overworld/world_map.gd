extends Node2D
## WorldMap - Grid-based overworld with road travel (FTL-style node system on a visual map)

signal travel_started(from: LocationData, to: LocationData)
signal travel_completed(location: LocationData)
signal region_completed(region_index: int)

const LocationNodeScene = preload("res://scenes/overworld/location_node.tscn")

@onready var map_visuals: Node2D = $MapVisuals
@onready var locations_container: Node2D = $Locations
@onready var connections_layer: Node2D = $Connections
@onready var input_manager: Node2D = $WorldInputManager
@onready var camera: Camera2D = $Camera2D
@onready var ui_panel: PanelContainer = $UI/InfoPanel
@onready var location_name_label: Label = $UI/InfoPanel/VBox/LocationName
@onready var location_type_label: Label = $UI/InfoPanel/VBox/LocationType
@onready var travel_btn: Button = $UI/InfoPanel/VBox/TravelBtn
@onready var resources_label: Label = $UI/ResourcesPanel/Resources
@onready var threat_indicator: Label = $UI/ThreatIndicator

var pause_menu_scene = preload("res://scenes/ui/pause_menu.tscn")
var map_pawn_scene = preload("res://scenes/overworld/map_pawn.tscn")
var pause_menu: Control = null
var player_pawn: Node2D = null

# Map state
var current_map_name: String = "test_overworld"
var map_data: Dictionary = {}
var road_cells: Array = []  # Array of Vector2i for pathfinding
var road_set: Dictionary = {}  # Quick lookup for road cells
var tile_size: int = 64

var locations: Array[LocationData] = []
var location_nodes: Dictionary = {}  # id -> LocationNode
var current_location_id: int = 0
var selected_location: LocationData = null
var is_traveling: bool = false

# Threat system
var threat_position: int = 0
var max_threat_turns: int = 12

# Resources
var supplies: int = 10
var gold: int = 50


func _ready() -> void:
	if GameManager.current_state != GameManager.GameState.OVERWORLD:
		GameManager.change_state(GameManager.GameState.OVERWORLD)
	
	# Connect Input Manager and set camera reference
	input_manager.camera = camera
	input_manager.node_clicked.connect(_on_map_node_clicked)
	
	_connect_ui_signals()
	load_map(current_map_name)
	_update_resources_display()
	_update_threat_display()


func _connect_ui_signals() -> void:
	travel_btn.pressed.connect(_on_travel_pressed)
	
	# Instantiate Pause Menu if not present
	if not pause_menu:
		pause_menu = pause_menu_scene.instantiate()
		$UI.add_child(pause_menu)
		pause_menu.hide()


## Load a JSON map file
func load_map(map_name: String) -> void:
	# Clear existing visuals
	for child in map_visuals.get_children():
		child.queue_free()
	for child in locations_container.get_children():
		child.queue_free()
	for child in connections_layer.get_children():
		child.queue_free()
	location_nodes.clear()
	
	# Load map data
	map_data = OverworldMapLoader.load_map_data(map_name)
	if map_data.is_empty():
		push_error("[WorldMap] Failed to load map: " + map_name)
		return
	
	tile_size = map_data.get("tile_size", 64)
	
	# Build visual layers (terrain, roads, objects)
	var build_result = OverworldMapLoader.build_map_visuals(map_data, map_visuals)
	road_cells = build_result.road_cells
	
	# Build road set for quick lookup
	road_set.clear()
	for cell in road_cells:
		road_set[cell] = true
	
	# Extract locations from map JSON
	locations = OverworldMapLoader.extract_locations(map_data, road_cells)
	
	# Create visual nodes for each location
	for loc in locations:
		var node = LocationNodeScene.instantiate()
		node.setup(loc)
		node.location_hovered.connect(_on_location_hovered)
		locations_container.add_child(node)
		location_nodes[loc.id] = node
	
	# Draw connections between locations
	_draw_connections()
	
	# Set starting position
	current_location_id = 0
	_update_reachable_locations()
	
	# Spawn player pawn
	_spawn_pawn()
	
	# Center camera on map
	var map_width = map_data.get("width", 16) * tile_size
	var map_height = map_data.get("height", 12) * tile_size
	camera.position = Vector2(map_width / 2, map_height / 2)
	
	print("[WorldMap] Loaded map '%s' with %d locations and %d road cells" % [
		map_data.get("name", map_name), locations.size(), road_cells.size()
	])


func _spawn_pawn() -> void:
	if not player_pawn:
		player_pawn = map_pawn_scene.instantiate()
		add_child(player_pawn)
		player_pawn.z_index = 10
	
	if current_location_id in location_nodes:
		player_pawn.position = location_nodes[current_location_id].position


func _draw_connections() -> void:
	for loc in locations:
		for connected_id in loc.connected_locations:
			if connected_id > loc.id:  # Only draw once per pair
				var other = _get_location_by_id(connected_id)
				if other:
					# Draw a subtle connection line along the road
					var line = Line2D.new()
					
					# Get road path between locations for a nicer line
					var start_grid = OverworldMapLoader.world_to_grid(loc.position, tile_size)
					var end_grid = OverworldMapLoader.world_to_grid(other.position, tile_size)
					var road_path = _find_road_path_cells(start_grid, end_grid)
					
					if road_path.size() > 1:
						# Draw along road
						for cell in road_path:
							line.add_point(OverworldMapLoader.grid_to_world(cell, tile_size))
					else:
						# Fallback to straight line
						line.add_point(loc.position)
						line.add_point(other.position)
					
					line.width = 3.0
					line.default_color = Color(1.0, 0.9, 0.3, 0.4)  # Golden path indicator
					line.z_index = -5  # Above terrain, below objects
					connections_layer.add_child(line)


func _get_location_by_id(id: int) -> LocationData:
	for loc in locations:
		if loc.id == id:
			return loc
	return null


func _update_reachable_locations() -> void:
	var current_loc = _get_location_by_id(current_location_id)
	if not current_loc:
		return
	
	for id in location_nodes:
		var node = location_nodes[id]
		var is_connected = id in current_loc.connected_locations
		node.set_reachable(is_connected)
		node.set_current(id == current_location_id)


# --- Input Handler ---
func _on_map_node_clicked(hit_node: Node) -> void:
	if is_traveling:
		return
	
	# Expecting Area2D child of LocationNode
	var loc_node = hit_node.get_parent()
	if loc_node.has_method("setup") and loc_node.location_data:
		_on_location_choice(loc_node.location_data)


func _on_location_choice(loc: LocationData) -> void:
	if current_location_id == loc.id:
		return
	
	# Check if directly connected
	var current_loc = _get_location_by_id(current_location_id)
	if loc.id not in current_loc.connected_locations:
		print("[WorldMap] Location not directly connected!")
		return
	
	# Cost is 1 supply per hop
	var cost = 1
	if supplies < cost:
		print("[WorldMap] Not enough supplies!")
		return
	
	# Travel!
	await _execute_road_travel(loc, cost)


func _execute_road_travel(target_loc: LocationData, cost: int) -> void:
	is_traveling = true
	
	# Deduct resources
	supplies -= cost
	_update_resources_display()
	threat_position += cost
	_update_threat_display()
	queue_redraw()
	
	# Get road path
	var start_grid = OverworldMapLoader.world_to_grid(location_nodes[current_location_id].position, tile_size)
	var end_grid = OverworldMapLoader.world_to_grid(target_loc.position, tile_size)
	var road_path = _find_road_path_cells(start_grid, end_grid)
	
	if road_path.size() > 1:
		# Animate along road tiles
		await _animate_road_travel(road_path)
	else:
		# Fallback: direct movement
		await _animate_direct_travel(target_loc.position)
	
	# Update state
	var old_id = current_location_id
	current_location_id = target_loc.id
	target_loc.visited = true
	_update_reachable_locations()
	
	travel_started.emit(_get_location_by_id(old_id), target_loc)
	
	is_traveling = false
	
	# Trigger location event
	_trigger_location_event(target_loc)


func _animate_road_travel(path: Array[Vector2i]) -> void:
	# Speed: tiles per second
	const TILES_PER_SECOND: float = 4.0
	var step_duration = 1.0 / TILES_PER_SECOND
	
	for i in range(1, path.size()):
		var from_pos = OverworldMapLoader.grid_to_world(path[i - 1], tile_size)
		var to_pos = OverworldMapLoader.grid_to_world(path[i], tile_size)
		
		var tween = create_tween()
		tween.tween_property(player_pawn, "position", to_pos, step_duration).set_trans(Tween.TRANS_LINEAR)
		await tween.finished


func _animate_direct_travel(target_pos: Vector2) -> void:
	var dist = player_pawn.position.distance_to(target_pos)
	var duration = max(0.3, dist / 300.0)
	
	var tween = create_tween()
	tween.tween_property(player_pawn, "position", target_pos, duration).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)
	await tween.finished


## Find road path between two grid cells using BFS
func _find_road_path_cells(start: Vector2i, end: Vector2i) -> Array[Vector2i]:
	var empty: Array[Vector2i] = []
	
	# Check if endpoints are on/near roads
	var actual_start = _find_nearest_road(start)
	var actual_end = _find_nearest_road(end)
	
	if actual_start == Vector2i(-1, -1) or actual_end == Vector2i(-1, -1):
		return empty
	
	# BFS pathfinding
	var queue: Array = [[actual_start]]
	var visited: Dictionary = {actual_start: true}
	var directions = [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
	
	while not queue.is_empty():
		var path: Array = queue.pop_front()
		var current: Vector2i = path.back()
		
		if current == actual_end:
			var result: Array[Vector2i] = []
			for p in path:
				result.append(p)
			return result
		
		for dir in directions:
			var next = current + dir
			if next not in visited and next in road_set:
				visited[next] = true
				var new_path = path.duplicate()
				new_path.append(next)
				queue.append(new_path)
	
	return empty


func _find_nearest_road(pos: Vector2i) -> Vector2i:
	if pos in road_set:
		return pos
	
	# Check adjacent cells
	var directions = [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1),
					  Vector2i(1, 1), Vector2i(-1, 1), Vector2i(1, -1), Vector2i(-1, -1)]
	for dir in directions:
		var check = pos + dir
		if check in road_set:
			return check
	
	return Vector2i(-1, -1)


func _on_location_hovered(loc_data: LocationData) -> void:
	# Show tooltip or highlight path
	pass


func _on_travel_pressed() -> void:
	if not selected_location or is_traveling:
		return
	
	var current_loc = _get_location_by_id(current_location_id)
	if selected_location.id not in current_loc.connected_locations:
		return
	
	if supplies < 1:
		print("[WorldMap] Not enough supplies!")
		return
	
	ui_panel.visible = false
	await _execute_road_travel(selected_location, 1)


func _trigger_location_event(loc: LocationData) -> void:
	print("[WorldMap] Arrived at: %s (%s)" % [loc.location_name, LocationData.LocationType.keys()[loc.location_type]])
	
	match loc.location_type:
		LocationData.LocationType.BATTLE:
			print("[WorldMap] Starting battle...")
			EventBus.combat_started.emit()
		
		LocationData.LocationType.TOWN:
			print("[WorldMap] Welcome to town!")
		
		LocationData.LocationType.EVENT:
			print("[WorldMap] Random event!")
			gold += randi_range(5, 20)
			_update_resources_display()
		
		LocationData.LocationType.CAMP:
			print("[WorldMap] Resting at camp...")
		
		LocationData.LocationType.DUNGEON:
			print("[WorldMap] Entering dungeon...")
			var difficulty = 1
			GameManager.enter_dungeon(difficulty)
			SceneLoader.change_scene_to_file("res://scenes/dungeon/dungeon_map.tscn")
		
		LocationData.LocationType.EXIT:
			print("[WorldMap] Region complete!")
			region_completed.emit(0)
	
	travel_completed.emit(loc)
	ui_panel.visible = false


func _update_resources_display() -> void:
	if resources_label:
		resources_label.text = "Supplies: %d | Gold: %d" % [supplies, gold]


func _update_threat_display() -> void:
	if threat_indicator:
		var remaining = max_threat_turns - threat_position
		threat_indicator.text = "Threat: %d turns" % remaining
		if remaining <= 3:
			threat_indicator.add_theme_color_override("font_color", Color.RED)
		else:
			threat_indicator.add_theme_color_override("font_color", Color.WHITE)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		if pause_menu and not pause_menu.visible:
			pause_menu.open()
			get_viewport().set_input_as_handled()


func _draw() -> void:
	# Draw threat zone (left side of map)
	var map_width = map_data.get("width", 16) * tile_size
	var map_height = map_data.get("height", 12) * tile_size
	var threat_x = threat_position * (map_width / max_threat_turns)
	if threat_x > 0:
		var threat_rect = Rect2(0, 0, threat_x, map_height)
		draw_rect(threat_rect, Color(0.5, 0, 0, 0.2), true)
