extends RefCounted
class_name OverworldMapLoader
## OverworldMapLoader - Loads JSON map data and builds TileMapLayers

const CATALOG_PATH = "res://data/maps/asset_catalog.json"
const MAPS_PATH = "res://data/maps/"

# Cached catalog data
static var _catalog: Dictionary = {}
static var _tile_textures: Dictionary = {}  # tile_name -> Texture2D

# Tile size from catalog
static var tile_size: int = 64


## Load and parse the asset catalog
static func load_catalog() -> bool:
	if not _catalog.is_empty():
		return true

	var data = JSONLoader.load_json(CATALOG_PATH)
	if not data is Dictionary:
		push_error("[OverworldMapLoader] Failed to load catalog: " + CATALOG_PATH)
		return false

	_catalog = data
	tile_size = _catalog.get("tile_size", 64)

	print("[OverworldMapLoader] Loaded catalog with tile_size: %d" % tile_size)
	return true


## Load a map JSON file and return parsed data
static func load_map_data(map_name: String) -> Dictionary:
	var map_path = MAPS_PATH + map_name + ".json"
	var data = JSONLoader.load_json(map_path)
	if not data is Dictionary:
		push_error("[OverworldMapLoader] Failed to load map: " + map_path)
		return {}

	print("[OverworldMapLoader] Loaded map: %s (%dx%d)" % [data.get("name", map_name), data.get("width", 0), data.get("height", 0)])
	return data


## Get the full texture path for a tile name
static func get_tile_texture_path(tile_name: String) -> String:
	load_catalog()
	
	var base_path = _catalog.get("base_path", "res://assets/terrain/overworld/PNG/Default size")
	
	# Search in terrain, environment, structures
	for category in ["terrain", "environment", "structures"]:
		if category in _catalog and tile_name in _catalog[category]:
			return base_path + "/" + _catalog[category][tile_name]
	
	return ""


## Load a texture for a tile name (cached)
static func get_tile_texture(tile_name: String) -> Texture2D:
	if tile_name in _tile_textures:
		return _tile_textures[tile_name]
	
	var path = get_tile_texture_path(tile_name)
	if path.is_empty():
		return null
	
	var texture = load(path) as Texture2D
	if texture:
		_tile_textures[tile_name] = texture
	return texture


## Terrain type enum for movement speeds
enum TerrainType { ROAD, GRASS, DIRT, FOREST, WATER, STONE, SNOW, SAND }

## Get terrain type from tile name
static func get_terrain_type(tile_name: String) -> TerrainType:
	if tile_name.begins_with("road_") or tile_name.begins_with("bridge_"):
		return TerrainType.ROAD
	elif tile_name.begins_with("water_"):
		return TerrainType.WATER
	elif tile_name.begins_with("forest_"):
		return TerrainType.FOREST
	elif tile_name.begins_with("dirt_"):
		return TerrainType.DIRT
	elif tile_name.begins_with("stone_"):
		return TerrainType.STONE
	elif tile_name.begins_with("snow_") or tile_name.begins_with("ice_"):
		return TerrainType.SNOW
	elif tile_name.begins_with("sand_"):
		return TerrainType.SAND
	else:
		return TerrainType.GRASS


## Get movement speed multiplier for terrain (1.0 = normal road speed)
static func get_terrain_speed(terrain: TerrainType) -> float:
	match terrain:
		TerrainType.ROAD: return 1.0
		TerrainType.GRASS: return 0.6
		TerrainType.DIRT: return 0.7
		TerrainType.FOREST: return 0.3
		TerrainType.STONE: return 0.5
		TerrainType.SNOW: return 0.4
		TerrainType.SAND: return 0.5
		TerrainType.WATER: return 0.0  # Impassable
	return 0.5


## Check if terrain is passable
static func is_passable(terrain: TerrainType) -> bool:
	return terrain != TerrainType.WATER


## Check if a tile name is a road tile
static func is_road_tile(tile_name: String) -> bool:
	return tile_name.begins_with("road_") or tile_name.begins_with("bridge_")


## Build terrain sprites from map data and add to parent node
## Returns a dictionary with terrain data for pathfinding
static func build_map_visuals(map_data: Dictionary, parent: Node2D) -> Dictionary:
	load_catalog()
	
	var result = {
		"road_cells": [],  # Array of Vector2i for A* pathfinding
		"terrain_map": {},  # Dictionary[Vector2i] -> TerrainType
		"width": map_data.get("width", 0),
		"height": map_data.get("height", 0),
		"tile_size": map_data.get("tile_size", tile_size)
	}
	
	var ts = result.tile_size
	
	# Process layers
	for layer in map_data.get("layers", []):
		var layer_name = layer.get("name", "unknown")
		var layer_type = layer.get("type", "grid")
		var layer_node = Node2D.new()
		layer_node.name = layer_name.capitalize().replace(" ", "")
		parent.add_child(layer_node)
		
		if layer_type == "grid":
			# Grid-based terrain layer
			var grid_data = layer.get("data", [])
			for y in range(grid_data.size()):
				var row = grid_data[y]
				for x in range(row.size()):
					var tile_name = row[x]
					if tile_name == null or tile_name == "":
						continue
					
					var texture = get_tile_texture(tile_name)
					if texture:
						var sprite = Sprite2D.new()
						sprite.texture = texture
						sprite.position = Vector2(x * ts + ts / 2, y * ts + ts / 2)
						sprite.z_index = -10  # Behind everything
						layer_node.add_child(sprite)
						
						# Track terrain type for all cells
						var terrain = get_terrain_type(tile_name)
						result.terrain_map[Vector2i(x, y)] = terrain
						
						# Track road cells separately for quick lookup
						if terrain == TerrainType.ROAD:
							result.road_cells.append(Vector2i(x, y))
		
		elif layer_type == "objects":
			# Object placement layer
			for obj in layer.get("data", []):
				var obj_x = obj.get("x", 0)
				var obj_y = obj.get("y", 0)
				var asset_name = obj.get("asset", "")
				
				var texture = get_tile_texture(asset_name)
				if texture:
					var sprite = Sprite2D.new()
					sprite.texture = texture
					# Structure tops render ABOVE their base (offset upward)
					if layer_name.contains("top"):
						sprite.position = Vector2(obj_x * ts + ts / 2, obj_y * ts + ts / 2 - ts * 0.6)
						sprite.z_index = 5
					else:
						sprite.position = Vector2(obj_x * ts + ts / 2, obj_y * ts + ts / 2)
						sprite.z_index = 2
					layer_node.add_child(sprite)
	
	print("[OverworldMapLoader] Built map with %d road cells, %d terrain cells" % [result.road_cells.size(), result.terrain_map.size()])
	return result


## Extract road cells from map data WITHOUT building any sprites.
## Used by FTL-style map to generate connections between locations.
static func extract_road_cells(map_data: Dictionary) -> Array:
	var road_cells: Array = []
	for layer in map_data.get("layers", []):
		if layer.get("type", "grid") != "grid":
			continue
		var grid_data = layer.get("data", [])
		for y in range(grid_data.size()):
			var row = grid_data[y]
			for x in range(row.size()):
				var tile_name = row[x]
				if tile_name is String and is_road_tile(tile_name):
					road_cells.append(Vector2i(x, y))
	return road_cells


## Convert grid position to world position (center of tile)
static func grid_to_world(grid_pos: Vector2i, ts: int = tile_size) -> Vector2:
	return Vector2(grid_pos.x * ts + ts / 2, grid_pos.y * ts + ts / 2)


## Convert world position to grid position
static func world_to_grid(world_pos: Vector2, ts: int = tile_size) -> Vector2i:
	return Vector2i(int(world_pos.x / ts), int(world_pos.y / ts))


## Extract locations from map data and create LocationData resources
static func extract_locations(map_data: Dictionary, road_cells: Array) -> Array[LocationData]:
	var locations: Array[LocationData] = []
	var ts = map_data.get("tile_size", tile_size)
	
	var map_locations = map_data.get("locations", [])
	
	for i in range(map_locations.size()):
		var loc_json = map_locations[i]
		var loc = LocationData.new()
		loc.id = i
		loc.location_name = loc_json.get("name", "Location %d" % i)
		
		# Parse type
		var type_str = loc_json.get("type", "CAMP")
		match type_str:
			"TOWN": loc.location_type = LocationData.LocationType.TOWN
			"CAMP": loc.location_type = LocationData.LocationType.CAMP
			"DUNGEON": loc.location_type = LocationData.LocationType.DUNGEON
			"EXIT": loc.location_type = LocationData.LocationType.EXIT
			_: loc.location_type = LocationData.LocationType.CAMP
		
		# Grid position stored, but position is world coords for compatibility
		var grid_x = loc_json.get("x", 0)
		var grid_y = loc_json.get("y", 0)
		loc.position = grid_to_world(Vector2i(grid_x, grid_y), ts)
		
		# Mark first location as starting point
		if i == 0:
			loc.visited = true
			loc.revealed = true
		else:
			loc.revealed = true  # For now, reveal all
		
		locations.append(loc)
	
	# Auto-generate connections based on road connectivity
	_generate_road_connections(locations, road_cells, ts)
	
	return locations


## Generate connections between locations based on road pathfinding
static func _generate_road_connections(locations: Array[LocationData], road_cells: Array, ts: int) -> void:
	# Build a set of road cells for quick lookup
	var road_set: Dictionary = {}
	for cell in road_cells:
		road_set[cell] = true
	
	# For each pair of locations, check if there's a road path
	for i in range(locations.size()):
		var loc_a = locations[i]
		var grid_a = world_to_grid(loc_a.position, ts)
		
		for j in range(i + 1, locations.size()):
			var loc_b = locations[j]
			var grid_b = world_to_grid(loc_b.position, ts)
			
			# Check if there's a direct road connection (simple path check)
			var path = _find_road_path(grid_a, grid_b, road_set)
			if not path.is_empty():
				# Check path length - only connect if reasonably direct
				# (prevents connecting locations that have very long paths)
				var manhattan = abs(grid_b.x - grid_a.x) + abs(grid_b.y - grid_a.y)
				if path.size() <= manhattan * 2:  # Allow some wiggle room
					if j not in loc_a.connected_locations:
						loc_a.connected_locations.append(j)
					if i not in loc_b.connected_locations:
						loc_b.connected_locations.append(i)


## Simple BFS pathfinding on road cells
static func _find_road_path(start: Vector2i, end: Vector2i, road_set: Dictionary) -> Array[Vector2i]:
	var empty_path: Array[Vector2i] = []
	
	# Both start and end should be on or adjacent to roads
	var start_on_road = start in road_set or _has_adjacent_road(start, road_set)
	var end_on_road = end in road_set or _has_adjacent_road(end, road_set)
	
	if not start_on_road or not end_on_road:
		return empty_path
	
	# BFS
	var queue: Array = [[start]]
	var visited: Dictionary = {start: true}
	var directions = [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
	
	while not queue.is_empty():
		var path = queue.pop_front()
		var current: Vector2i = path.back()
		
		if current == end or _is_adjacent(current, end):
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
	
	return empty_path


static func _has_adjacent_road(pos: Vector2i, road_set: Dictionary) -> bool:
	var directions = [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
	for dir in directions:
		if (pos + dir) in road_set:
			return true
	return false


static func _is_adjacent(a: Vector2i, b: Vector2i) -> bool:
	return abs(a.x - b.x) + abs(a.y - b.y) == 1
