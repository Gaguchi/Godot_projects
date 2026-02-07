extends RefCounted
class_name OverworldMapLoader
## OverworldMapLoader - Loads JSON map data, builds autotiled terrain + road visuals

const CATALOG_PATH = "res://data/maps/asset_catalog.json"
const MAPS_PATH = "res://data/maps/"

# Cached catalog data
static var _catalog: Dictionary = {}
static var _tile_textures: Dictionary = {}  # tile_name -> Texture2D

# Tile size from catalog
static var tile_size: int = 64

# Terrain render priority - higher priority terrain bleeds into lower priority cells
const TERRAIN_PRIORITY: Dictionary = {
	"water": 4,
	"sand": 3,
	"dirt": 2,
	"grass": 1,
}


## Load and parse the asset catalog
static func load_catalog() -> bool:
	if not _catalog.is_empty():
		return true

	var file = FileAccess.open(CATALOG_PATH, FileAccess.READ)
	if not file:
		push_error("[OverworldMapLoader] Failed to open catalog: " + CATALOG_PATH)
		return false

	var json = JSON.new()
	var error = json.parse(file.get_as_text())
	file.close()

	if error != OK:
		push_error("[OverworldMapLoader] JSON parse error: " + json.get_error_message())
		return false

	_catalog = json.data
	tile_size = _catalog.get("tile_size", 64)

	print("[OverworldMapLoader] Loaded catalog with tile_size: %d" % tile_size)
	return true


## Load a map JSON file and return parsed data
static func load_map_data(map_name: String) -> Dictionary:
	var map_path = MAPS_PATH + map_name + ".json"

	var file = FileAccess.open(map_path, FileAccess.READ)
	if not file:
		push_error("[OverworldMapLoader] Failed to open map: " + map_path)
		return {}

	var json = JSON.new()
	var error = json.parse(file.get_as_text())
	file.close()

	if error != OK:
		push_error("[OverworldMapLoader] JSON parse error in map: " + json.get_error_message())
		return {}

	print("[OverworldMapLoader] Loaded map: %s (%dx%d)" % [
		json.data.get("name", map_name),
		json.data.get("width", 0),
		json.data.get("height", 0)
	])
	return json.data


## Get the full texture path for a tile name
static func get_tile_texture_path(tile_name: String) -> String:
	load_catalog()

	var base_path = _catalog.get("base_path", "res://pixel_asset_maker/output/overworld")

	# Search in terrain, roads, nature, buildings
	for category in ["terrain", "roads", "nature", "buildings"]:
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


# ---------------------------------------------------------------------------
# Terrain types and movement
# ---------------------------------------------------------------------------

## Terrain type enum for movement speeds
enum TerrainType { ROAD, GRASS, DIRT, FOREST, WATER, SAND }


## Get terrain type from a base terrain name (new simplified tile names)
static func get_terrain_type(tile_name: String) -> TerrainType:
	match tile_name:
		"grass": return TerrainType.GRASS
		"dirt": return TerrainType.DIRT
		"sand": return TerrainType.SAND
		"water": return TerrainType.WATER
	# Legacy prefixed names - keep for backward compatibility
	if tile_name.begins_with("road") or tile_name.begins_with("bridge"):
		return TerrainType.ROAD
	elif tile_name.begins_with("water"):
		return TerrainType.WATER
	elif tile_name.begins_with("forest"):
		return TerrainType.FOREST
	elif tile_name.begins_with("dirt"):
		return TerrainType.DIRT
	elif tile_name.begins_with("sand"):
		return TerrainType.SAND
	return TerrainType.GRASS


## Get movement speed multiplier for terrain (1.0 = normal road speed)
static func get_terrain_speed(terrain: TerrainType) -> float:
	match terrain:
		TerrainType.ROAD: return 1.0
		TerrainType.GRASS: return 0.6
		TerrainType.DIRT: return 0.7
		TerrainType.FOREST: return 0.3
		TerrainType.SAND: return 0.4
		TerrainType.WATER: return 0.0  # Impassable
	return 0.5


## Check if terrain is passable
static func is_passable(terrain: TerrainType) -> bool:
	return terrain != TerrainType.WATER


## Check if a tile name is a road tile (kept for compatibility)
static func is_road_tile(tile_name: String) -> bool:
	return tile_name == "road" or tile_name.begins_with("road_") or tile_name.begins_with("bridge_")


# ---------------------------------------------------------------------------
# Autotiling - Terrain transitions
# ---------------------------------------------------------------------------

## Get a neighbor cell's terrain type from the grid, returning default for out-of-bounds.
static func _grid_get(grid: Array, x: int, y: int, w: int, h: int, default_val: String) -> String:
	if x < 0 or x >= w or y < 0 or y >= h:
		return default_val
	var row = grid[y]
	if x >= row.size():
		return default_val
	var val = row[x]
	if val == null or val == "":
		return default_val
	return val


## Calculate which terrain transition overlay sprites are needed for a given cell.
## Returns an array of sprite names (e.g. "water_edge_s", "sand_inner_ne") to render
## on top of the base terrain sprite at this cell.
##
## Logic: higher-priority terrain bleeds INTO lower-priority cells.
## - Cardinal edges: if a cardinal neighbor is higher priority, its edge overlaps this cell.
## - Inner corners: if a diagonal neighbor is higher priority but BOTH adjacent cardinal
##   neighbors match this cell, a small triangle of the diagonal terrain pokes in.
static func _get_terrain_overlays(grid: Array, x: int, y: int, w: int, h: int) -> Array[String]:
	var overlays: Array[String] = []
	var center: String = _grid_get(grid, x, y, w, h, "grass")
	var cp: int = TERRAIN_PRIORITY.get(center, 0)

	# Get all 8 neighbors (out-of-bounds treated as same as center to avoid false edges)
	var n: String = _grid_get(grid, x, y - 1, w, h, center)
	var s: String = _grid_get(grid, x, y + 1, w, h, center)
	var e: String = _grid_get(grid, x + 1, y, w, h, center)
	var w_n: String = _grid_get(grid, x - 1, y, w, h, center)
	var ne: String = _grid_get(grid, x + 1, y - 1, w, h, center)
	var nw: String = _grid_get(grid, x - 1, y - 1, w, h, center)
	var se: String = _grid_get(grid, x + 1, y + 1, w, h, center)
	var sw: String = _grid_get(grid, x - 1, y + 1, w, h, center)

	var np: int = TERRAIN_PRIORITY.get(n, 0)
	var sp: int = TERRAIN_PRIORITY.get(s, 0)
	var ep: int = TERRAIN_PRIORITY.get(e, 0)
	var wp: int = TERRAIN_PRIORITY.get(w_n, 0)

	# --- Cardinal edges ---
	# Higher-priority neighbor bleeds its edge into this cell.
	# Edge naming: T_edge_n means "T fills the NORTH portion of the tile".
	# So when the north neighbor is higher priority, use _edge_n (water on top).
	if n != center and np > cp:
		overlays.append(n + "_edge_n")
	if s != center and sp > cp:
		overlays.append(s + "_edge_s")
	if e != center and ep > cp:
		overlays.append(e + "_edge_e")
	if w_n != center and wp > cp:
		overlays.append(w_n + "_edge_w")

	# --- Inner corners ---
	# Diagonal neighbor is higher priority, but BOTH adjacent cardinal neighbors match center.
	# The higher-priority terrain only touches diagonally, so a small triangle pokes in at
	# that corner. T_inner_ne = small triangle of T in the NE corner of this tile.
	var nep: int = TERRAIN_PRIORITY.get(ne, 0)
	var nwp: int = TERRAIN_PRIORITY.get(nw, 0)
	var sep: int = TERRAIN_PRIORITY.get(se, 0)
	var swp: int = TERRAIN_PRIORITY.get(sw, 0)

	if ne != center and nep > cp and n == center and e == center:
		overlays.append(ne + "_inner_ne")
	if nw != center and nwp > cp and n == center and w_n == center:
		overlays.append(nw + "_inner_nw")
	if se != center and sep > cp and s == center and e == center:
		overlays.append(se + "_inner_se")
	if sw != center and swp > cp and s == center and w_n == center:
		overlays.append(sw + "_inner_sw")

	return overlays


# ---------------------------------------------------------------------------
# Autotiling - Roads
# ---------------------------------------------------------------------------

## Determine which road sprite(s) to place on a road cell based on its neighbors.
## Returns an array of sprite names from the "roads" catalog category.
static func _get_road_sprites(road_grid: Array, x: int, y: int, w: int, h: int) -> Array[String]:
	var has_n: bool = y > 0 and road_grid[y - 1][x] != null
	var has_s: bool = y < h - 1 and road_grid[y + 1][x] != null
	var has_e: bool = x < w - 1 and road_grid[y][x + 1] != null
	var has_w: bool = x > 0 and road_grid[y][x - 1] != null
	var count: int = int(has_n) + int(has_s) + int(has_e) + int(has_w)

	match count:
		0:
			# Isolated road cell - show crossroads as a generic tile
			return ["road_cross"]
		1:
			# Dead end: cap faces OPPOSITE of the connecting neighbor.
			# road_end_X = cap on X side, road body extends away from X.
			if has_n: return ["road_end_s"]
			if has_s: return ["road_end_n"]
			if has_e: return ["road_end_w"]
			return ["road_end_e"]
		2:
			# Straight or turn
			# road_turn_XY = curve in XY corner, road arms go opposite directions.
			if has_n and has_s: return ["road_straight_v"]
			if has_e and has_w: return ["road_straight_h"]
			if has_n and has_e: return ["road_turn_se"]
			if has_n and has_w: return ["road_turn_sw"]
			if has_s and has_e: return ["road_turn_ne"]
			return ["road_turn_nw"]
		3:
			# T-intersection: straight + stub for the branch direction.
			# Stub uses road_end with cap TOWARD the straight (body extends outward).
			if not has_n: return ["road_straight_h", "road_end_n"]
			if not has_s: return ["road_straight_h", "road_end_s"]
			if not has_e: return ["road_straight_v", "road_end_e"]
			return ["road_straight_v", "road_end_w"]
		4:
			return ["road_cross"]

	return ["road_cross"]


# ---------------------------------------------------------------------------
# Build map visuals
# ---------------------------------------------------------------------------

## Build terrain sprites from map data and add to parent node.
## Returns a dictionary with terrain data for pathfinding:
##   road_cells: Array of Vector2i for A* pathfinding
##   terrain_map: Dictionary[Vector2i] -> TerrainType
##   width: int
##   height: int
##   tile_size: int
static func build_map_visuals(map_data: Dictionary, parent: Node2D) -> Dictionary:
	load_catalog()

	var result = {
		"road_cells": [],        # Array of Vector2i for A* pathfinding
		"terrain_map": {},       # Dictionary[Vector2i] -> TerrainType
		"width": map_data.get("width", 0),
		"height": map_data.get("height", 0),
		"tile_size": map_data.get("tile_size", tile_size)
	}

	var ts: int = result.tile_size
	var map_w: int = result.width
	var map_h: int = result.height

	# Collect layer data by name for multi-pass rendering
	var terrain_grid: Array = []
	var road_grid: Array = []
	var modifier_grid: Array = []
	var object_layers: Array = []  # Array of {name, data}

	for layer in map_data.get("layers", []):
		var layer_name: String = layer.get("name", "unknown")
		var layer_type: String = layer.get("type", "grid")

		if layer_type == "grid":
			match layer_name:
				"terrain":
					terrain_grid = layer.get("data", [])
				"roads":
					road_grid = layer.get("data", [])
				"movement_modifiers":
					modifier_grid = layer.get("data", [])
		elif layer_type == "objects":
			object_layers.append({"name": layer_name, "data": layer.get("data", [])})

	# --- Pass 1: Base terrain + autotile overlays ---
	if not terrain_grid.is_empty():
		var terrain_node = Node2D.new()
		terrain_node.name = "Terrain"
		parent.add_child(terrain_node)

		for y in range(terrain_grid.size()):
			var row = terrain_grid[y]
			for x in range(row.size()):
				var tile_name = row[x]
				if tile_name == null or tile_name == "":
					continue

				var cell_pos = Vector2(x * ts + ts / 2.0, y * ts + ts / 2.0)

				# Base terrain sprite
				var base_tex = get_tile_texture(tile_name)
				if base_tex:
					var sprite = Sprite2D.new()
					sprite.texture = base_tex
					sprite.position = cell_pos
					sprite.z_index = -10
					terrain_node.add_child(sprite)

				# Autotile transition overlays
				var overlays = _get_terrain_overlays(
					terrain_grid, x, y, map_w, map_h
				)
				for overlay_name in overlays:
					var overlay_tex = get_tile_texture(overlay_name)
					if overlay_tex:
						var overlay_sprite = Sprite2D.new()
						overlay_sprite.texture = overlay_tex
						overlay_sprite.position = cell_pos
						overlay_sprite.z_index = -9  # Just above base terrain
						terrain_node.add_child(overlay_sprite)

				# Populate terrain_map for pathfinding
				var terrain_type = get_terrain_type(tile_name)
				result.terrain_map[Vector2i(x, y)] = terrain_type

	# --- Pass 2: Roads layer (autotiled) ---
	if not road_grid.is_empty():
		var road_node = Node2D.new()
		road_node.name = "Roads"
		parent.add_child(road_node)

		for y in range(road_grid.size()):
			var row = road_grid[y]
			for x in range(row.size()):
				var cell_val = row[x]
				if cell_val == null or cell_val == "":
					continue

				# This cell has a road - determine which sprite(s)
				var road_sprites = _get_road_sprites(
					road_grid, x, y, map_w, map_h
				)
				var cell_pos = Vector2(x * ts + ts / 2.0, y * ts + ts / 2.0)

				for road_name in road_sprites:
					var road_tex = get_tile_texture(road_name)
					if road_tex:
						var sprite = Sprite2D.new()
						sprite.texture = road_tex
						sprite.position = cell_pos
						sprite.z_index = -8  # Above terrain overlays
						road_node.add_child(sprite)

				# Mark as road in terrain_map and road_cells
				var cell_key = Vector2i(x, y)
				result.terrain_map[cell_key] = TerrainType.ROAD
				result.road_cells.append(cell_key)

	# --- Pass 3: Movement modifiers (forest markers etc.) ---
	if not modifier_grid.is_empty():
		for y in range(modifier_grid.size()):
			var row = modifier_grid[y]
			for x in range(row.size()):
				var mod_val = row[x]
				if mod_val == null or mod_val == "":
					continue

				var cell_key = Vector2i(x, y)
				# Only override if not already a road (roads take priority)
				if result.terrain_map.get(cell_key, -1) != TerrainType.ROAD:
					match mod_val:
						"forest":
							result.terrain_map[cell_key] = TerrainType.FOREST

	# --- Pass 4: Object layers (nature, buildings) ---
	for obj_layer in object_layers:
		var layer_name: String = obj_layer.name
		var layer_data: Array = obj_layer.data
		var obj_node = Node2D.new()
		obj_node.name = layer_name.capitalize().replace(" ", "")
		parent.add_child(obj_node)

		for obj in layer_data:
			var obj_x: int = obj.get("x", 0)
			var obj_y: int = obj.get("y", 0)
			var asset_name: String = obj.get("asset", "")

			var texture = get_tile_texture(asset_name)
			if texture:
				var sprite = Sprite2D.new()
				sprite.texture = texture

				# Structure tops render above their base (offset upward)
				if layer_name.contains("top"):
					sprite.position = Vector2(
						obj_x * ts + ts / 2.0,
						obj_y * ts + ts / 2.0 - ts * 0.6
					)
					sprite.z_index = 5
				else:
					sprite.position = Vector2(
						obj_x * ts + ts / 2.0,
						obj_y * ts + ts / 2.0
					)
					sprite.z_index = 2

				obj_node.add_child(sprite)

	print("[OverworldMapLoader] Built map with %d road cells, %d terrain cells" % [
		result.road_cells.size(), result.terrain_map.size()
	])
	return result


# ---------------------------------------------------------------------------
# Coordinate conversion
# ---------------------------------------------------------------------------

## Convert grid position to world position (center of tile)
static func grid_to_world(grid_pos: Vector2i, ts: int = tile_size) -> Vector2:
	return Vector2(grid_pos.x * ts + ts / 2.0, grid_pos.y * ts + ts / 2.0)


## Convert world position to grid position
static func world_to_grid(world_pos: Vector2, ts: int = tile_size) -> Vector2i:
	return Vector2i(int(world_pos.x / ts), int(world_pos.y / ts))


# ---------------------------------------------------------------------------
# Location extraction and road connectivity
# ---------------------------------------------------------------------------

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
		var type_str = loc_json.get("type", "EVENT")
		match type_str:
			"TOWN": loc.location_type = LocationData.LocationType.TOWN
			"BATTLE": loc.location_type = LocationData.LocationType.BATTLE
			"EVENT": loc.location_type = LocationData.LocationType.EVENT
			"CAMP": loc.location_type = LocationData.LocationType.CAMP
			"DUNGEON": loc.location_type = LocationData.LocationType.DUNGEON
			"EXIT": loc.location_type = LocationData.LocationType.EXIT

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
