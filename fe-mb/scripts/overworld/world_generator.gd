extends RefCounted
class_name WorldGenerator
## WorldGenerator - Procedurally generates world map locations and connections

const MIN_LOCATIONS: int = 12
const MAX_LOCATIONS: int = 18
const MAP_WIDTH: float = 800.0
const MAP_HEIGHT: float = 500.0
const MIN_DISTANCE: float = 80.0  # Minimum distance between nodes
const CONNECTION_DISTANCE: float = 180.0  # Max distance for automatic connection


## Generate a new region with locations and connections
static func generate_region(region_index: int) -> Array[LocationData]:
	var locations: Array[LocationData] = []
	var num_locations = randi_range(MIN_LOCATIONS, MAX_LOCATIONS)
	
	# Generate random positions avoiding overlap
	var positions: Array[Vector2] = []
	var max_attempts = 100
	
	while positions.size() < num_locations and max_attempts > 0:
		var pos = Vector2(
			randf_range(60, MAP_WIDTH - 60),
			randf_range(60, MAP_HEIGHT - 60)
		)
		
		# Check minimum distance from existing positions
		var valid = true
		for existing in positions:
			if pos.distance_to(existing) < MIN_DISTANCE:
				valid = false
				break
		
		if valid:
			positions.append(pos)
		else:
			max_attempts -= 1
	
	# Create location data for each position
	for i in range(positions.size()):
		var loc = LocationData.new()
		loc.id = i
		loc.position = positions[i]
		loc.location_type = _get_random_type(i, positions.size(), region_index)
		loc.location_name = _generate_name(loc.location_type)
		loc.enemy_level = region_index + 1
		loc.revealed = true  # Start with all revealed for now
		locations.append(loc)
	
	# Ensure first location is always the starting point (left side)
	locations.sort_custom(func(a, b): return a.position.x < b.position.x)
	locations[0].location_type = LocationData.LocationType.CAMP
	locations[0].location_name = "Starting Camp"
	locations[0].visited = true
	
	# Ensure last location is always the exit (right side)
	locations[locations.size() - 1].location_type = LocationData.LocationType.EXIT
	locations[locations.size() - 1].location_name = "Region Exit"
	
	# Reassign IDs after sorting
	for i in range(locations.size()):
		locations[i].id = i
	
	# Generate connections
	_generate_connections(locations)
	
	return locations


## Get a random location type (weighted)
static func _get_random_type(index: int, total: int, region_index: int) -> LocationData.LocationType:
	var roll = randf()
	
	# Weight by region (later regions have more battles)
	var battle_weight = 0.3 + region_index * 0.05
	var town_weight = 0.15
	var event_weight = 0.25
	var camp_weight = 0.15
	var dungeon_weight = 0.15
	
	if roll < battle_weight:
		return LocationData.LocationType.BATTLE
	elif roll < battle_weight + town_weight:
		return LocationData.LocationType.TOWN
	elif roll < battle_weight + town_weight + event_weight:
		return LocationData.LocationType.EVENT
	elif roll < battle_weight + town_weight + event_weight + camp_weight:
		return LocationData.LocationType.CAMP
	else:
		return LocationData.LocationType.DUNGEON


## Generate connections between locations (graph structure)
static func _generate_connections(locations: Array[LocationData]) -> void:
	# First pass: connect each location to nearest neighbors
	for loc in locations:
		var nearest: Array[LocationData] = []
		
		for other in locations:
			if other.id == loc.id:
				continue
			if loc.position.distance_to(other.position) <= CONNECTION_DISTANCE:
				nearest.append(other)
		
		# Sort by distance
		nearest.sort_custom(func(a, b): 
			return loc.position.distance_to(a.position) < loc.position.distance_to(b.position)
		)
		
		# Connect to 2-4 nearest
		var connect_count = mini(randi_range(2, 4), nearest.size())
		for i in range(connect_count):
			if nearest[i].id not in loc.connected_locations:
				loc.connected_locations.append(nearest[i].id)
			if loc.id not in nearest[i].connected_locations:
				nearest[i].connected_locations.append(loc.id)
	
	# Second pass: ensure graph is connected (can reach exit from start)
	_ensure_connected(locations)


## Ensure graph is fully connected
static func _ensure_connected(locations: Array[LocationData]) -> void:
	if locations.is_empty():
		return
	
	# BFS from start to find all reachable
	var visited = {}
	var queue = [0]  # Start from first location
	
	while not queue.is_empty():
		var current_id = queue.pop_front()
		if current_id in visited:
			continue
		visited[current_id] = true
		
		for loc in locations:
			if loc.id == current_id:
				for connected_id in loc.connected_locations:
					if connected_id not in visited:
						queue.append(connected_id)
				break
	
	# Connect any unreachable locations to nearest reachable
	for loc in locations:
		if loc.id not in visited:
			var nearest_reachable: LocationData = null
			var nearest_dist = INF
			
			for other in locations:
				if other.id in visited:
					var dist = loc.position.distance_to(other.position)
					if dist < nearest_dist:
						nearest_dist = dist
						nearest_reachable = other
			
			if nearest_reachable:
				loc.connected_locations.append(nearest_reachable.id)
				nearest_reachable.connected_locations.append(loc.id)
				visited[loc.id] = true


## Generate a name for a location type
static func _generate_name(type: LocationData.LocationType) -> String:
	var prefixes = ["Old", "Dark", "Ancient", "Lost", "Hidden", "Cursed", "Holy", "Forgotten"]
	var prefix = prefixes[randi() % prefixes.size()]
	
	match type:
		LocationData.LocationType.TOWN:
			var names = ["Village", "Hamlet", "Settlement", "Township", "Haven"]
			return prefix + " " + names[randi() % names.size()]
		LocationData.LocationType.BATTLE:
			var names = ["Crossing", "Pass", "Bridge", "Road", "Trail"]
			return prefix + " " + names[randi() % names.size()]
		LocationData.LocationType.EVENT:
			var names = ["Shrine", "Monument", "Ruins", "Grove", "Well"]
			return prefix + " " + names[randi() % names.size()]
		LocationData.LocationType.CAMP:
			var names = ["Camp", "Clearing", "Shelter", "Rest Stop"]
			return prefix + " " + names[randi() % names.size()]
		LocationData.LocationType.DUNGEON:
			var names = ["Fortress", "Crypt", "Tower", "Cavern", "Keep"]
			return prefix + " " + names[randi() % names.size()]
		_:
			return "Unknown Location"
