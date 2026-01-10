extends Node2D
## WorldMap - Main controller for the FTL-style overworld navigation

signal travel_started(from: LocationData, to: LocationData)
signal travel_completed(location: LocationData)
signal region_completed(region_index: int)

const LocationNodeScene = preload("res://scenes/overworld/location_node.tscn")

@onready var locations_container: Node2D = $Locations
@onready var connections_layer: Node2D = $Connections
@onready var ui_panel: PanelContainer = $UI/InfoPanel
@onready var location_name_label: Label = $UI/InfoPanel/VBox/LocationName
@onready var location_type_label: Label = $UI/InfoPanel/VBox/LocationType
@onready var travel_btn: Button = $UI/InfoPanel/VBox/TravelBtn
@onready var resources_label: Label = $UI/ResourcesPanel/Resources
@onready var threat_indicator: Label = $UI/ThreatIndicator

# Map state
var current_region: int = 0
var locations: Array[LocationData] = []
var location_nodes: Dictionary = {}  # id -> LocationNode
var current_location_id: int = 0
var selected_location: LocationData = null

# Threat system
var threat_position: int = 0  # How many turns before threat catches up
var max_threat_turns: int = 12

# Resources
var supplies: int = 10
var gold: int = 50


func _ready() -> void:
	_connect_ui_signals()
	load_current_region()
	_update_resources_display()
	_update_threat_display()


func _connect_ui_signals() -> void:
	travel_btn.pressed.connect(_on_travel_pressed)


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
		node.location_clicked.connect(_on_location_clicked)
		node.location_hovered.connect(_on_location_hovered)
		locations_container.add_child(node)
		location_nodes[loc.id] = node
	
	# Draw connections
	_draw_connections()
	
	# Set starting position
	current_location_id = 0
	_update_reachable_locations()
	
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


func _on_location_clicked(loc_data: LocationData) -> void:
	selected_location = loc_data
	_show_location_info(loc_data)


func _on_location_hovered(loc_data: LocationData) -> void:
	# Could show tooltip here
	pass


func _show_location_info(loc: LocationData) -> void:
	ui_panel.visible = true
	location_name_label.text = loc.location_name
	
	var type_names = ["Town", "Battle", "Event", "Camp", "Dungeon", "Exit"]
	location_type_label.text = "Type: %s" % type_names[loc.location_type]
	
	# Can only travel if connected to current location
	var current_loc = _get_location_by_id(current_location_id)
	var can_travel = loc.id in current_loc.connected_locations and supplies > 0
	travel_btn.disabled = not can_travel
	travel_btn.text = "Travel (1 Supply)" if can_travel else "Cannot Travel"


func _on_travel_pressed() -> void:
	if not selected_location:
		return
	
	# Check supplies
	if supplies <= 0:
		print("[WorldMap] No supplies!")
		return
	
	# Consume supply
	supplies -= 1
	_update_resources_display()
	
	# Advance threat
	threat_position += 1
	_update_threat_display()
	
	# Move to new location
	var old_id = current_location_id
	current_location_id = selected_location.id
	selected_location.visited = true
	
	travel_started.emit(_get_location_by_id(old_id), selected_location)
	_update_reachable_locations()
	
	# Trigger location event
	_trigger_location_event(selected_location)


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
			get_tree().change_scene_to_file("res://scenes/dungeon/dungeon_map.tscn")
		
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
