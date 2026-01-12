extends Node2D
## WorldMap - Main controller for the FTL-style overworld navigation

signal travel_started(from: LocationData, to: LocationData)
signal travel_completed(location: LocationData)
signal region_completed(region_index: int)

const LocationNodeScene = preload("res://scenes/overworld/location_node.tscn")

@onready var locations_container: Node2D = $Locations
@onready var connections_layer: Node2D = $Connections
@onready var input_manager: Node2D = $WorldInputManager # New Input Manager
@onready var ui_panel: PanelContainer = $UI/InfoPanel
@onready var location_name_label: Label = $UI/InfoPanel/VBox/LocationName
@onready var location_type_label: Label = $UI/InfoPanel/VBox/LocationType
@onready var travel_btn: Button = $UI/InfoPanel/VBox/TravelBtn
@onready var resources_label: Label = $UI/ResourcesPanel/Resources
@onready var threat_indicator: Label = $UI/ThreatIndicator
# save_btn created dynamically in code, no @onready needed here or simple var
@onready var save_btn: Button = null # Deprecated

var pause_menu_scene = preload("res://scenes/ui/pause_menu.tscn")
var map_pawn_scene = preload("res://scenes/overworld/map_pawn.tscn")
var pause_menu: Control = null
var player_pawn: Node2D = null

# Map state
var current_region: int = 0
var locations: Array[LocationData] = []
var location_nodes: Dictionary = {}  # id -> LocationNode
var current_location_id: int = 0
var selected_location: LocationData = null
var current_travel_path: Array[LocationData] = []
var current_path_cost: int = 0

# Threat system
var threat_position: int = 0  # How many turns before threat catches up
var max_threat_turns: int = 12

# Resources
var supplies: int = 10
var gold: int = 50


func _ready() -> void:
	if GameManager.current_state != GameManager.GameState.OVERWORLD:
		GameManager.change_state(GameManager.GameState.OVERWORLD)
		
	# Connect Input Manager
	input_manager.node_clicked.connect(_on_map_node_clicked)
	
	_connect_ui_signals()
	load_current_region()
	_update_resources_display()
	_update_threat_display()


func _connect_ui_signals() -> void:
	travel_btn.pressed.connect(_on_travel_pressed)
	
	# Instantiate Pause Menu if not present
	if not pause_menu:
		pause_menu = pause_menu_scene.instantiate()
		$UI.add_child(pause_menu)
		pause_menu.hide()


## Current region data
var current_region_data: RegionData = null


func load_current_region() -> void:
	# Clear existing
	for child in locations_container.get_children():
		child.queue_free()
	for child in connections_layer.get_children():
		child.queue_free()
	location_nodes.clear()
	
	# Load predefined region data
	current_region_data = RegionLoader.load_region(current_region)
	locations = current_region_data.locations.duplicate()
	max_threat_turns = current_region_data.threat_turns
	
	# Create visual nodes
	for loc in locations:
		var node = LocationNodeScene.instantiate()
		node.setup(loc)
		# node.location_clicked.connect(_on_location_clicked) # Handled by WorldInputManager now
		node.location_hovered.connect(_on_location_hovered)
		locations_container.add_child(node)
		location_nodes[loc.id] = node
	
	# Draw connections
	_draw_connections()
	
	# Set starting position
	current_location_id = 0
	_update_reachable_locations()

	# Spawn Pawn
	if not player_pawn:
		player_pawn = map_pawn_scene.instantiate()
		add_child(player_pawn)
		# Ensure it's above lines but below UI
		player_pawn.z_index = 10 
	
	if current_location_id in location_nodes:
		player_pawn.position = location_nodes[current_location_id].position
	
	print("[WorldMap] Loaded region %d: %s with %d locations" % [current_region, current_region_data.region_name, locations.size()])


func _draw_connections() -> void:
	for loc in locations:
		for connected_id in loc.connected_locations:
			if connected_id > loc.id:  # Only draw once per pair
				var other = _get_location_by_id(connected_id)
				if other:
					var line = Line2D.new()
					line.add_point(loc.position)
					line.add_point(other.position)
					line.width = 2.0
					line.default_color = Color(0.4, 0.4, 0.4, 0.6)
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
		
		# Check if threatened
		var loc = _get_location_by_id(id)
		const MAP_WIDTH: float = 800.0
		if loc and loc.position.x < threat_position * (MAP_WIDTH / max_threat_turns):
			node.set_threatened(true)


# --- New Input Handler ---
func _on_map_node_clicked(hit_node: Node) -> void:
	# Expecting Area2D child of LocationNode
	var loc_node = hit_node.get_parent()
	if loc_node.has_method("setup") and loc_node.location_data:
		_on_location_choice(loc_node.location_data)

func _on_location_choice(loc: LocationData) -> void:
	# Replaces old _on_location_clicked
	if current_location_id == loc.id:
		return

	# Calculate path
	var path_result = _find_path(current_location_id, loc.id)
	
	# Check validity
	if path_result.path.is_empty():
		return # Unreachable or same node
		
	var cost = path_result.cost
	if supplies < cost:
		print("[WorldMap] Not enough supplies!")
		# TODO: Shake UI or Visual Feedack
		return
		
	# Travel! (Instant / Fluid)
	_execute_travel(path_result.path, cost)

func _execute_travel(path: Array[LocationData], cost: int) -> void:
	# Deduct
	supplies -= cost
	_update_resources_display()
	threat_position += cost
	_update_threat_display()
	
	# Move step by step with Bezier Juice
	for next_loc in path:
		var current_node = location_nodes[current_location_id]
		var next_node = location_nodes[next_loc.id]
		
		# Animate
		await _animate_travel_step(current_node.position, next_node.position)
		
		# Logic Update
		var old_id = current_location_id
		current_location_id = next_loc.id
		next_loc.visited = true
		_update_reachable_locations()
		travel_started.emit(_get_location_by_id(old_id), next_loc)
	
	# Arrived
	_trigger_location_event(path.back())

func _animate_travel_step(start: Vector2, end: Vector2) -> void:
	# Bezier Curve Juice
	# Control point is midpoint offset by perpendicular vector
	var mid = (start + end) / 2.0
	var diff = end - start
	var dist = diff.length()
	var perp = Vector2(-diff.y, diff.x).normalized() * (dist * 0.1) # 10% arc (Flatter)
	# Randomize side?
	if randf() > 0.5: perp = -perp
	var control = mid + perp
	
	# Calculate duration based on distance for consistent speed (pixels per second)
	# e.g., 400 pixels/sec. Min 0.4s to feel significant.
	var duration = max(0.4, dist / 400.0)
	
	# Create a temporary Tween
	var t = create_tween()
	var tween_step = func(val: float): 
		if player_pawn:
			player_pawn.position = _calculate_bezier_point(val, start, control, end)
			
	t.tween_method(tween_step, 0.0, 1.0, duration).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)
	
	await t.finished

func _calculate_bezier_point(t: float, p0: Vector2, p1: Vector2, p2: Vector2) -> Vector2:
	var q0 = p0.lerp(p1, t)
	var q1 = p1.lerp(p2, t)
	return q0.lerp(q1, t)

func _on_location_hovered(loc_data: LocationData) -> void:
	# Could show tooltip here
	pass


func _show_location_info(loc: LocationData) -> void:
	ui_panel.visible = true
	location_name_label.text = loc.location_name
	
	var type_names = ["Town", "Battle", "Event", "Camp", "Dungeon", "Exit"]
	location_type_label.text = "Type: %s" % type_names[loc.location_type]
	
	# Calculate path to target
	var path_result = _find_path(current_location_id, loc.id)
	current_travel_path = path_result.path
	current_path_cost = path_result.cost
	
	var can_travel = not current_travel_path.is_empty() and supplies >= current_path_cost
	travel_btn.disabled = not can_travel
	
	if can_travel:
		travel_btn.text = "Travel (%d Supply)" % current_path_cost
	elif current_travel_path.is_empty():
		travel_btn.text = "Unreachable"
	else:
		travel_btn.text = "Need %d Supply" % current_path_cost


func _on_travel_pressed() -> void:
	if not selected_location:
		return
	
	if supplies < current_path_cost:
		print("[WorldMap] Not enough supplies!")
		return
		
	# Start travel sequence
	ui_panel.visible = false
	
	# Consume supply
	supplies -= current_path_cost
	_update_resources_display()
	
	# Advance threat
	threat_position += current_path_cost
	_update_threat_display()
	
	# Move step by step
	for next_loc in current_travel_path:
		var old_id = current_location_id
		current_location_id = next_loc.id
		
		# Animate movement (visual only, quick tween)
		# TODO: Add player pawn animation here?
		
		# Wait a bit between steps
		await get_tree().create_timer(0.3).timeout
		
		# Update UI state
		next_loc.visited = true
		_update_reachable_locations()
		
		travel_started.emit(_get_location_by_id(old_id), next_loc)
	
	# Trigger event at final destination
	_trigger_location_event(selected_location)


func _find_path(from_id: int, to_id: int) -> Dictionary:
	var empty_path: Array[LocationData] = []
	
	if from_id == to_id:
		return {"path": empty_path, "cost": 0}
		
	# BFS
	var queue = [[from_id]]
	var visited = {from_id: true}
	
	while not queue.is_empty():
		var path = queue.pop_front()
		var current = path.back()
		
		if current == to_id:
			# Convert IDs to LocationData, skipping the start node
			var loc_path: Array[LocationData] = []
			for i in range(1, path.size()):
				loc_path.append(_get_location_by_id(path[i]))
			return {"path": loc_path, "cost": loc_path.size()}
			
		var current_loc = _get_location_by_id(current)
		if not current_loc:
			continue
			
		for neighbor_id in current_loc.connected_locations:
			if neighbor_id not in visited:
				visited[neighbor_id] = true
				var new_path = path.duplicate()
				new_path.append(neighbor_id)
				queue.append(new_path)
				
	return {"path": empty_path, "cost": 999}


func _trigger_location_event(loc: LocationData) -> void:
	print("[WorldMap] Arrived at: %s (%s)" % [loc.location_name, LocationData.LocationType.keys()[loc.location_type]])
	
	match loc.location_type:
		LocationData.LocationType.BATTLE:
			print("[WorldMap] Starting battle...")
			# TODO: Load combat scene
			EventBus.combat_started.emit()
		
		LocationData.LocationType.TOWN:
			print("[WorldMap] Welcome to town! Shop and recruit available.")
			# TODO: Show town menu
		
		LocationData.LocationType.EVENT:
			print("[WorldMap] Random event triggered!")
			# TODO: Show event dialog
			gold += randi_range(5, 20)
			_update_resources_display()
		
		LocationData.LocationType.CAMP:
			print("[WorldMap] Resting at camp...")
			# TODO: Heal party
		
		LocationData.LocationType.DUNGEON:
			print("[WorldMap] Entering dungeon...")
			var difficulty = current_region_data.difficulty if current_region_data else 1

			GameManager.enter_dungeon(difficulty)
			# GameManager.enter_dungeon already sets state to DUNGEON
			SceneLoader.change_scene_to_file("res://scenes/dungeon/dungeon_map.tscn")
		
		LocationData.LocationType.EXIT:
			print("[WorldMap] Advancing to next region!")
			current_region += 1
			threat_position = 0
			supplies += 5  # Bonus supplies for completing region
			load_current_region()
			region_completed.emit(current_region - 1)
	
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


func _update_threat_display() -> void:
	if threat_indicator:
		var remaining = max_threat_turns - threat_position
		threat_indicator.text = "Threat: %d turns" % remaining
		if remaining <= 3:
			threat_indicator.add_theme_color_override("font_color", Color.RED)
		else:
			threat_indicator.add_theme_color_override("font_color", Color.WHITE)


func _draw() -> void:
	# Draw threat zone (red overlay on left side)
	const MAP_WIDTH: float = 800.0
	const MAP_HEIGHT: float = 500.0
	var threat_x = threat_position * (MAP_WIDTH / max_threat_turns)
	if threat_x > 0:
		var threat_rect = Rect2(0, 0, threat_x, MAP_HEIGHT)
		draw_rect(threat_rect, Color(0.5, 0, 0, 0.2), true)
