class_name BattleGrid
extends Node
## BattleGrid - Grid data structure, pathfinding, terrain, and spatial queries
## Owns all grid state: unit positions, terrain, coordinate conversion, range calculations

enum TerrainType {
	PLAIN,
	FOREST,
	MOUNTAIN,
	FORT,
	WATER
}

## Terrain movement costs (1 = normal, 2 = slow, 999 = impassable)
const TERRAIN_MOVE_COST: Dictionary = {
	TerrainType.PLAIN: 1,
	TerrainType.FOREST: 2,
	TerrainType.MOUNTAIN: 3,
	TerrainType.FORT: 1,
	TerrainType.WATER: 999
}

## Terrain defense bonuses (added to defender's DEF during combat)
const TERRAIN_DEF_BONUS: Dictionary = {
	TerrainType.PLAIN: 0,
	TerrainType.FOREST: 1,
	TerrainType.MOUNTAIN: 2,
	TerrainType.FORT: 3,
	TerrainType.WATER: 0
}

## Terrain avoid bonuses (added to defender's avoid during combat)
const TERRAIN_AVOID_BONUS: Dictionary = {
	TerrainType.PLAIN: 0,
	TerrainType.FOREST: 15,
	TerrainType.MOUNTAIN: 25,
	TerrainType.FORT: 20,
	TerrainType.WATER: 0
}

var grid_width: int = 10
var grid_height: int = 7
var tile_size: int = 64

## O(1) unit lookup: Vector2i -> Node2D
var unit_grid: Dictionary = {}

## Terrain data: Vector2i -> TerrainType
var terrain_grid: Dictionary = {}

## AStarGrid2D for pathfinding
var astar: AStarGrid2D


## Configure grid dimensions and initialize
func configure(width: int, height: int, p_tile_size: int = 64) -> void:
	grid_width = width
	grid_height = height
	tile_size = p_tile_size
	_setup_pathfinding()


func _ready() -> void:
	_setup_pathfinding()


func _setup_pathfinding() -> void:
	astar = AStarGrid2D.new()
	astar.region = Rect2i(0, 0, grid_width, grid_height)
	astar.cell_size = Vector2(tile_size, tile_size)
	astar.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_NEVER
	astar.update()


# --- Coordinate Conversion ---

## Convert world position to grid coordinates
func world_to_grid(world_pos: Vector2) -> Vector2i:
	return Vector2i(int(world_pos.x / tile_size), int(world_pos.y / tile_size))


## Convert grid coordinates to world position (center of tile)
func grid_to_world(grid_pos: Vector2i) -> Vector2:
	return Vector2(grid_pos.x * tile_size + tile_size / 2.0, grid_pos.y * tile_size + tile_size / 2.0)


## Check if a position is within grid bounds
func is_in_bounds(pos: Vector2i) -> bool:
	return pos.x >= 0 and pos.x < grid_width and pos.y >= 0 and pos.y < grid_height


# --- Terrain ---

## Set terrain type for a tile
func set_terrain(pos: Vector2i, terrain: TerrainType) -> void:
	terrain_grid[pos] = terrain


## Get terrain type at a position (defaults to PLAIN)
func get_terrain(pos: Vector2i) -> TerrainType:
	return terrain_grid.get(pos, TerrainType.PLAIN) as TerrainType


## Get movement cost for a tile
func get_move_cost(pos: Vector2i) -> int:
	return TERRAIN_MOVE_COST.get(get_terrain(pos), 1) as int


## Get terrain defense bonus for combat
func get_terrain_def_bonus(pos: Vector2i) -> int:
	return TERRAIN_DEF_BONUS.get(get_terrain(pos), 0) as int


## Get terrain avoid bonus for combat
func get_terrain_avoid_bonus(pos: Vector2i) -> int:
	return TERRAIN_AVOID_BONUS.get(get_terrain(pos), 0) as int


## Check if a tile is walkable (in bounds and not water/impassable)
func is_tile_walkable(pos: Vector2i) -> bool:
	if not is_in_bounds(pos):
		return false
	return get_move_cost(pos) < 999


# --- Unit Grid ---

## Place a unit on the grid
func place_unit(unit: Node2D, grid_pos: Vector2i) -> void:
	unit_grid[grid_pos] = unit


## Remove a unit from the grid
func remove_unit_at(grid_pos: Vector2i) -> void:
	unit_grid.erase(grid_pos)


## Move a unit from one position to another
func move_unit(from: Vector2i, to: Vector2i) -> void:
	if unit_grid.has(from):
		var unit: Node2D = unit_grid[from]
		unit_grid.erase(from)
		unit_grid[to] = unit


## Get unit at a grid position (O(1) lookup)
func get_unit_at(grid_pos: Vector2i) -> Node2D:
	return unit_grid.get(grid_pos, null) as Node2D


## Clear all units from the grid
func clear_units() -> void:
	unit_grid.clear()


## Rebuild unit_grid from the Units container (useful after spawning)
func sync_units_from_container(units_container: Node2D) -> void:
	unit_grid.clear()
	for unit in units_container.get_children():
		if not is_instance_valid(unit) or not unit.has_method("get_unit_data"):
			continue
		var grid_pos: Vector2i = world_to_grid(unit.position)
		unit_grid[grid_pos] = unit


# --- Pathfinding ---

## Update AStar obstacles based on current unit_grid
## exclude_pos: optional position to NOT mark as solid (for the moving unit)
func update_astar_obstacles(exclude_pos: Vector2i = Vector2i(-1, -1)) -> void:
	# Clear all solid points
	for x in range(grid_width):
		for y in range(grid_height):
			var pos := Vector2i(x, y)
			astar.set_point_solid(pos, not is_tile_walkable(pos))

	# Mark unit positions as solid (except excluded)
	for pos in unit_grid:
		if pos != exclude_pos:
			astar.set_point_solid(pos, true)


## Get A* path between two grid positions
func get_grid_path(from: Vector2i, to: Vector2i) -> PackedVector2Array:
	return astar.get_id_path(from, to)


# --- Range Calculations ---

## BFS to get all tiles a unit can reach, respecting terrain costs and other units
func get_reachable_tiles(unit: Node2D, ignore_unit: Node2D = null) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	var start: Vector2i = world_to_grid(unit.position)
	var movement: int = unit.get_unit_data().movement

	# BFS with movement cost tracking
	var visited: Dictionary = {}  # Vector2i -> best remaining movement
	var queue: Array = [[start, movement]]

	while not queue.is_empty():
		var current: Array = queue.pop_front()
		var pos: Vector2i = current[0]
		var remaining: int = current[1]

		# Skip if we've visited with equal or more remaining movement
		if pos in visited and visited[pos] >= remaining:
			continue
		visited[pos] = remaining

		if is_tile_walkable(pos):
			var occupant: Node2D = get_unit_at(pos)
			if pos == start or occupant == null or occupant == ignore_unit:
				if pos != start:
					result.append(pos)

		if remaining > 0:
			for dir in [Vector2i.UP, Vector2i.DOWN, Vector2i.LEFT, Vector2i.RIGHT]:
				var next_pos: Vector2i = pos + dir
				if is_in_bounds(next_pos) and is_tile_walkable(next_pos):
					var cost: int = get_move_cost(next_pos)
					if remaining >= cost:
						queue.append([next_pos, remaining - cost])

	return result


## Get attack range tiles from a specific position given weapon range
func get_attack_tiles_from(pos: Vector2i, min_range: int, max_range: int) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	for x in range(-max_range, max_range + 1):
		for y in range(-max_range, max_range + 1):
			var dist: int = abs(x) + abs(y)
			if dist >= min_range and dist <= max_range:
				var tile: Vector2i = pos + Vector2i(x, y)
				if is_in_bounds(tile):
					result.append(tile)
	return result


## Get weapon range from unit data
func get_weapon_range(unit_data: UnitData) -> Vector2i:
	var min_range: int = 1
	var max_range: int = 1
	if unit_data.equipped_weapon and unit_data.equipped_weapon is ItemData:
		min_range = unit_data.equipped_weapon.range_min
		max_range = unit_data.equipped_weapon.range_max
	return Vector2i(min_range, max_range)


## Find enemies attackable from current position (without moving)
func get_attackable_enemies(unit: Node2D) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	var unit_pos: Vector2i = world_to_grid(unit.position)
	var unit_data: UnitData = unit.get_unit_data()
	var weapon_range: Vector2i = get_weapon_range(unit_data)

	var tiles: Array[Vector2i] = get_attack_tiles_from(unit_pos, weapon_range.x, weapon_range.y)
	for tile in tiles:
		var target: Node2D = get_unit_at(tile)
		if target and target.get_unit_data() and not target.get_unit_data().is_player_unit != not unit_data.is_player_unit:
			# Target is on the opposing team
			result.append(tile)

	return result


## Calculate combined attack range (all tiles reachable by move + attack)
## Returns only tiles that are outside walkable range (for visual distinction)
func get_combined_attack_range(unit: Node2D, walkable: Array[Vector2i]) -> Array[Vector2i]:
	var unit_pos: Vector2i = world_to_grid(unit.position)
	var unit_data: UnitData = unit.get_unit_data()
	var weapon_range: Vector2i = get_weapon_range(unit_data)

	var attack_positions: Array[Vector2i] = [unit_pos]
	attack_positions.append_array(walkable)

	var attack_set: Dictionary = {}
	var walkable_set: Dictionary = {}
	walkable_set[unit_pos] = true
	for tile in walkable:
		walkable_set[tile] = true

	for pos in attack_positions:
		var tiles: Array[Vector2i] = get_attack_tiles_from(pos, weapon_range.x, weapon_range.y)
		for tile in tiles:
			if tile not in walkable_set:
				attack_set[tile] = true

	var result: Array[Vector2i] = []
	for tile in attack_set:
		result.append(tile)
	return result


## Find the best tile to move to for attacking a target (least movement cost)
func find_attack_position(attacker: Node2D, target_pos: Vector2i, walkable: Array[Vector2i]) -> Vector2i:
	var attacker_pos: Vector2i = world_to_grid(attacker.position)
	var unit_data: UnitData = attacker.get_unit_data()
	var weapon_range: Vector2i = get_weapon_range(unit_data)
	var best_pos: Vector2i = Vector2i(-1, -1)
	var min_cost: int = 999

	for tile in walkable:
		var dist: int = abs(tile.x - target_pos.x) + abs(tile.y - target_pos.y)
		if dist >= weapon_range.x and dist <= weapon_range.y:
			var move_cost: int = abs(tile.x - attacker_pos.x) + abs(tile.y - attacker_pos.y)
			if move_cost < min_cost:
				min_cost = move_cost
				best_pos = tile

	return best_pos


## Find the best tile from candidates that puts a unit in weapon range of target
func find_attack_tile(from_pos: Vector2i, target_pos: Vector2i, candidates: Array[Vector2i], min_range: int, max_range: int) -> Vector2i:
	var best: Vector2i = Vector2i(-1, -1)
	var best_cost: int = 999

	for tile in candidates:
		var dist: int = abs(tile.x - target_pos.x) + abs(tile.y - target_pos.y)
		if dist >= min_range and dist <= max_range:
			var cost: int = abs(tile.x - from_pos.x) + abs(tile.y - from_pos.y)
			if cost < best_cost:
				best_cost = cost
				best = tile

	return best


## Find the reachable tile closest to a target (for approaching when out of range)
func find_best_approach_tile(from_pos: Vector2i, target_pos: Vector2i, reachable: Array[Vector2i]) -> Vector2i:
	var best: Vector2i = from_pos
	var best_dist: int = abs(from_pos.x - target_pos.x) + abs(from_pos.y - target_pos.y)

	for tile in reachable:
		var dist: int = abs(tile.x - target_pos.x) + abs(tile.y - target_pos.y)
		if dist < best_dist:
			best_dist = dist
			best = tile

	return best
