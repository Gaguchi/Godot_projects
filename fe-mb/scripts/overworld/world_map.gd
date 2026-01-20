extends Node2D
## WorldMap - Grid-based overworld with free movement (faster on roads, slower off-road)

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

var pause_menu_scene = preload("res://scenes/ui/pause_menu.tscn")
var map_pawn_scene = preload("res://scenes/overworld/map_pawn.tscn")
var pause_menu: Control = null
var player_pawn: Node2D = null

# Map state
var current_map_name: String = "test_overworld"
var map_data: Dictionary = {}
var terrain_map: Dictionary = {}  # Vector2i -> TerrainType
var road_set: Dictionary = {}  # Quick lookup for road cells
var tile_size: int = 64
var map_width: int = 0
var map_height: int = 0

var locations: Array[LocationData] = []
var location_nodes: Dictionary = {}  # id -> LocationNode
var current_location_id: int = 0
var selected_location: LocationData = null
var is_traveling: bool = false

# Resources
var supplies: int = 10
var gold: int = 50

# Movement speeds (tiles per second)
const BASE_SPEED: float = 6.0  # Fast on roads


func _ready() -> void:
	if GameManager.current_state != GameManager.GameState.OVERWORLD:
		GameManager.change_state(GameManager.GameState.OVERWORLD)
	
	# Connect Input Manager and set camera reference
	input_manager.camera = camera
	input_manager.node_clicked.connect(_on_map_node_clicked)
	
	_connect_ui_signals()
	load_map(current_map_name)
	_update_resources_display()


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
	map_width = map_data.get("width", 16)
	map_height = map_data.get("height", 12)
	
	# Build visual layers (terrain, roads, objects)
	var build_result = OverworldMapLoader.build_map_visuals(map_data, map_visuals)
	terrain_map = build_result.terrain_map
	
	# Build road set for quick lookup
	road_set.clear()
	for cell in build_result.road_cells:
		road_set[cell] = true
	
	# Extract locations from map JSON
	locations = OverworldMapLoader.extract_locations(map_data, build_result.road_cells)
	
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
	camera.position = Vector2(map_width * tile_size / 2, map_height * tile_size / 2)
	
	print("[WorldMap] Loaded map '%s' with %d locations, %d terrain cells" % [
		map_data.get("name", map_name), locations.size(), terrain_map.size()
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
					# Draw a subtle connection line
					var line = Line2D.new()
					line.add_point(loc.position)
					line.add_point(other.position)
					line.width = 2.0
					line.default_color = Color(1.0, 0.9, 0.3, 0.3)  # Subtle golden indicator
					line.z_index = -5
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
	
	# With free movement, all locations are technically reachable
	# But we still highlight connected ones for the FTL-style pathing
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
	
	# Calculate path using A* with terrain costs
	var start_grid = OverworldMapLoader.world_to_grid(player_pawn.position, tile_size)
	var end_grid = OverworldMapLoader.world_to_grid(loc.position, tile_size)
	
	var path = _find_terrain_path(start_grid, end_grid)
	if path.is_empty():
		print("[WorldMap] No valid path to destination!")
		return
	
	# Cost is 1 supply per location hop
	var cost = 1
	if supplies < cost:
		print("[WorldMap] Not enough supplies!")
		return
	
	# Travel!
	await _execute_terrain_travel(loc, path, cost)


func _execute_terrain_travel(target_loc: LocationData, path: Array[Vector2i], cost: int) -> void:
	is_traveling = true
	
	# Deduct resources
	supplies -= cost
	_update_resources_display()
	
	# Animate along the path with variable speed based on terrain
	await _animate_terrain_travel(path)
	
	# Update state
	var old_id = current_location_id
	current_location_id = target_loc.id
	target_loc.visited = true
	_update_reachable_locations()
	
	travel_started.emit(_get_location_by_id(old_id), target_loc)
	
	is_traveling = false
	
	# Trigger location event
	_trigger_location_event(target_loc)


func _animate_terrain_travel(path: Array[Vector2i]) -> void:
	for i in range(1, path.size()):
		var from_pos = OverworldMapLoader.grid_to_world(path[i - 1], tile_size)
		var to_pos = OverworldMapLoader.grid_to_world(path[i], tile_size)
		
		# Get terrain speed for destination cell
		var terrain = terrain_map.get(path[i], OverworldMapLoader.TerrainType.GRASS)
		var speed_mult = OverworldMapLoader.get_terrain_speed(terrain)
		
		# Calculate duration based on terrain (faster = shorter duration)
		var step_duration = 1.0 / (BASE_SPEED * max(speed_mult, 0.1))
		
		var tween = create_tween()
		tween.tween_property(player_pawn, "position", to_pos, step_duration).set_trans(Tween.TRANS_LINEAR)
		await tween.finished


## A* pathfinding with terrain costs (water is impassable)
func _find_terrain_path(start: Vector2i, end: Vector2i) -> Array[Vector2i]:
	var empty: Array[Vector2i] = []
	
	# Check bounds
	if not _is_in_bounds(start) or not _is_in_bounds(end):
		return empty
	
	# Check if destination is passable
	var end_terrain = terrain_map.get(end, OverworldMapLoader.TerrainType.GRASS)
	if not OverworldMapLoader.is_passable(end_terrain):
		return empty
	
	# A* algorithm
	var open_set: Array = [start]
	var came_from: Dictionary = {}
	var g_score: Dictionary = {start: 0.0}
	var f_score: Dictionary = {start: _heuristic(start, end)}
	
	var directions = [
		Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1),
		Vector2i(1, 1), Vector2i(-1, 1), Vector2i(1, -1), Vector2i(-1, -1)  # Diagonals
	]
	
	while not open_set.is_empty():
		# Find node with lowest f_score
		var current = open_set[0]
		var current_f = f_score.get(current, INF)
		for node in open_set:
			var node_f = f_score.get(node, INF)
			if node_f < current_f:
				current = node
				current_f = node_f
		
		if current == end:
			# Reconstruct path
			var path: Array[Vector2i] = [current]
			while current in came_from:
				current = came_from[current]
				path.insert(0, current)
			return path
		
		open_set.erase(current)
		
		for dir in directions:
			var neighbor = current + dir
			
			if not _is_in_bounds(neighbor):
				continue
			
			var terrain = terrain_map.get(neighbor, OverworldMapLoader.TerrainType.GRASS)
			if not OverworldMapLoader.is_passable(terrain):
				continue
			
			# Calculate movement cost (inverse of speed)
			var speed = OverworldMapLoader.get_terrain_speed(terrain)
			var move_cost = 1.0 / max(speed, 0.1)
			
			# Diagonal movement costs more
			if dir.x != 0 and dir.y != 0:
				move_cost *= 1.414
			
			var tentative_g = g_score.get(current, INF) + move_cost
			
			if tentative_g < g_score.get(neighbor, INF):
				came_from[neighbor] = current
				g_score[neighbor] = tentative_g
				f_score[neighbor] = tentative_g + _heuristic(neighbor, end)
				
				if neighbor not in open_set:
					open_set.append(neighbor)
	
	return empty


func _heuristic(a: Vector2i, b: Vector2i) -> float:
	# Diagonal distance heuristic
	var dx = abs(a.x - b.x)
	var dy = abs(a.y - b.y)
	return max(dx, dy) + 0.414 * min(dx, dy)


func _is_in_bounds(pos: Vector2i) -> bool:
	return pos.x >= 0 and pos.x < map_width and pos.y >= 0 and pos.y < map_height


func _on_location_hovered(loc_data: LocationData) -> void:
	# Could show path preview here
	pass


func _on_travel_pressed() -> void:
	if not selected_location or is_traveling:
		return
	
	if supplies < 1:
		print("[WorldMap] Not enough supplies!")
		return
	
	ui_panel.visible = false
	
	var start_grid = OverworldMapLoader.world_to_grid(player_pawn.position, tile_size)
	var end_grid = OverworldMapLoader.world_to_grid(selected_location.position, tile_size)
	var path = _find_terrain_path(start_grid, end_grid)
	
	if not path.is_empty():
		await _execute_terrain_travel(selected_location, path, 1)


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


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		if pause_menu and not pause_menu.visible:
			pause_menu.open()
			get_viewport().set_input_as_handled()



