extends Node
class_name NodeMapLoader
## NodeMapLoader - Loads FTL-style node graph maps from JSON

const MAP_DIR = "res://data/maps/"


## Load and parse a node map JSON file, returning a dictionary with nodes and edges
static func load_map(map_name: String) -> Dictionary:
	var path = MAP_DIR + map_name + ".json"
	var data = JSONLoader.load_json(path)
	if not data is Dictionary:
		push_error("[NodeMapLoader] Failed to load map or root is not a dictionary: " + path)
		return {}

	return data


## Parse node array from map data into LocationData resources
static func parse_locations(map_data: Dictionary) -> Array[LocationData]:
	var locations: Array[LocationData] = []
	var nodes = map_data.get("nodes", [])

	for node_dict in nodes:
		var loc = LocationData.new()
		loc.id = node_dict.get("id", 0)
		loc.location_name = node_dict.get("name", "Unknown")
		loc.position = Vector2(node_dict.get("x", 0), node_dict.get("y", 0))
		loc.location_type = _parse_location_type(node_dict.get("type", "CAMP"))

		# Build connections (bidirectional)
		var connections = node_dict.get("connections", [])
		for conn_id in connections:
			if conn_id not in loc.connected_locations:
				loc.connected_locations.append(int(conn_id))

		# Optional fields
		loc.enemy_level = node_dict.get("enemy_level", 1)
		loc.enemy_party_size = node_dict.get("enemy_count", 2)
		loc.event_id = node_dict.get("event_id", "")

		locations.append(loc)

	# Ensure bidirectional connections
	_ensure_bidirectional(locations)

	return locations


## Parse region definitions from map data
static func parse_regions(map_data: Dictionary) -> Array[Dictionary]:
	var regions: Array[Dictionary] = []
	for region_dict in map_data.get("regions", []):
		regions.append({
			"id": region_dict.get("id", ""),
			"name": region_dict.get("name", ""),
			"color": Color.from_string(region_dict.get("color", "#666666"), Color.GRAY)
		})
	return regions


## Get the region id for a given node
static func get_node_region(node_dict: Dictionary) -> String:
	return node_dict.get("region", "")


## Find the spawn point node id
static func find_spawn_node(map_data: Dictionary) -> int:
	for node_dict in map_data.get("nodes", []):
		if node_dict.get("spawn_point", false):
			return node_dict.get("id", 0)
	# Default to first node
	return 0


## Convert type string to enum
static func _parse_location_type(type_str: String) -> LocationData.LocationType:
	match type_str.to_upper():
		"TOWN": return LocationData.LocationType.TOWN
		"CAMP": return LocationData.LocationType.CAMP
		"DUNGEON": return LocationData.LocationType.DUNGEON
		"EXIT": return LocationData.LocationType.EXIT
	return LocationData.LocationType.CAMP


## Ensure all connections are bidirectional
static func _ensure_bidirectional(locations: Array[LocationData]) -> void:
	var loc_map: Dictionary = {}
	for loc in locations:
		loc_map[loc.id] = loc

	for loc in locations:
		for conn_id in loc.connected_locations:
			if conn_id in loc_map:
				var other = loc_map[conn_id]
				if loc.id not in other.connected_locations:
					other.connected_locations.append(loc.id)
