extends RefCounted
class_name DungeonGenerator
## DungeonGenerator - Procedurally generates Slay the Spire-style dungeon floors

const MIN_PATHS: int = 3  # Minimum paths through dungeon
const MAX_PATHS: int = 4  # Maximum paths through dungeon
const FLOOR_HEIGHT: int = 15  # Rows in a floor (excluding entrance/boss)
const ROW_SPACING: float = 60.0  # Vertical spacing between rows
const COL_SPACING: float = 100.0  # Horizontal spacing between columns
const MAP_WIDTH: float = 400.0
const MAP_HEIGHT: float = 1000.0


## Generate a complete dungeon floor
static func generate_floor(floor_number: int, difficulty: int = 1) -> Array[DungeonRoomData]:
	var rooms: Array[DungeonRoomData] = []
	var room_grid: Array = []  # 2D array [row][col] -> room or null
	
	# Initialize grid
	for row in range(FLOOR_HEIGHT + 2):  # +2 for entrance and boss rows
		room_grid.append([])
		for col in range(MAX_PATHS + 1):
			room_grid[row].append(null)
	
	# Create entrance room at bottom
	var center_col: int = int(MAX_PATHS / 2.0)
	var entrance = _create_room(0, DungeonRoomData.RoomType.ENTRANCE, 0, center_col)
	entrance.position = _get_room_position(0, center_col)
	rooms.append(entrance)
	room_grid[0][center_col] = entrance
	
	# Generate branching paths from entrance
	var paths = _generate_paths(floor_number, difficulty)
	
	# Create rooms along each path
	var room_id = 1
	for path in paths:
		for i in range(path.size()):
			var row = i + 1  # Start from row 1 (after entrance)
			var col = path[i]
			
			# Check if room already exists at this position
			if room_grid[row][col] != null:
				continue
			
			var room_type = _get_room_type_for_row(row, FLOOR_HEIGHT, floor_number)
			var room = _create_room(room_id, room_type, row, col)
			room.position = _get_room_position(row, col)
			room.difficulty_modifier = 1.0 + (difficulty * 0.1) + (floor_number * 0.2)
			rooms.append(room)
			room_grid[row][col] = room
			room_id += 1
	
	# Create boss room at top
	var boss_row = FLOOR_HEIGHT + 1
	var boss = _create_room(room_id, DungeonRoomData.RoomType.BOSS, boss_row, center_col)
	boss.position = _get_room_position(boss_row, center_col)
	boss.difficulty_modifier = 1.5 + (difficulty * 0.2) + (floor_number * 0.3)
	rooms.append(boss)
	room_grid[boss_row][center_col] = boss
	
	# Generate connections between rooms
	_generate_connections(rooms, room_grid, paths)
	
	return rooms


## Generate paths through the dungeon (arrays of column indices per row)
static func _generate_paths(floor_number: int, _difficulty: int) -> Array:
	var num_paths = randi_range(MIN_PATHS, MAX_PATHS)
	var paths: Array = []
	
	for p in range(num_paths):
		var path: Array[int] = []
		var current_col = randi_range(0, MAX_PATHS)
		
		for row in range(FLOOR_HEIGHT):
			path.append(current_col)
			
			# Branch to adjacent column occasionally
			var branch_chance = 0.3 + (floor_number * 0.05)
			if randf() < branch_chance:
				var direction = randi_range(-1, 1)
				current_col = clamp(current_col + direction, 0, MAX_PATHS)
		
		paths.append(path)
	
	return paths


## Get room type based on row position (Slay the Spire distribution)
static func _get_room_type_for_row(row: int, total_rows: int, floor_number: int) -> DungeonRoomData.RoomType:
	var progress = float(row) / float(total_rows)
	var roll = randf()
	
	# First few rows: mostly combat
	if row <= 2:
		if roll < 0.7:
			return DungeonRoomData.RoomType.COMBAT
		elif roll < 0.85:
			return DungeonRoomData.RoomType.EVENT
		else:
			return DungeonRoomData.RoomType.TREASURE
	
	# Middle section: mix of everything
	if progress < 0.7:
		# Weighted random selection
		var weights = {
			DungeonRoomData.RoomType.COMBAT: 0.35,
			DungeonRoomData.RoomType.EVENT: 0.20,
			DungeonRoomData.RoomType.ELITE: 0.10 + (floor_number * 0.02),
			DungeonRoomData.RoomType.TREASURE: 0.15,
			DungeonRoomData.RoomType.REST: 0.10,
			DungeonRoomData.RoomType.SHOP: 0.10
		}
		return _weighted_random_type(weights)
	
	# Near the top: rest before boss, more elites
	if roll < 0.25:
		return DungeonRoomData.RoomType.REST
	elif roll < 0.45:
		return DungeonRoomData.RoomType.ELITE
	elif roll < 0.65:
		return DungeonRoomData.RoomType.COMBAT
	elif roll < 0.80:
		return DungeonRoomData.RoomType.SHOP
	else:
		return DungeonRoomData.RoomType.TREASURE


## Weighted random room type selection
static func _weighted_random_type(weights: Dictionary) -> DungeonRoomData.RoomType:
	var total = 0.0
	for w in weights.values():
		total += w
	
	var roll = randf() * total
	var cumulative = 0.0
	
	for type in weights:
		cumulative += weights[type]
		if roll <= cumulative:
			return type
	
	return DungeonRoomData.RoomType.COMBAT  # Fallback


## Create a room with given parameters
static func _create_room(id: int, type: DungeonRoomData.RoomType, row: int, col: int) -> DungeonRoomData:
	var room = DungeonRoomData.new()
	room.id = id
	room.room_type = type
	room.row = row
	room.column = col
	room.revealed = true  # Could make this fog of war later
	
	# Set rewards based on type
	match type:
		DungeonRoomData.RoomType.COMBAT:
			room.enemy_count = randi_range(2, 3)
			room.gold_reward = randi_range(10, 20)
		DungeonRoomData.RoomType.ELITE:
			room.enemy_count = randi_range(1, 2)
			room.gold_reward = randi_range(25, 40)
		DungeonRoomData.RoomType.TREASURE:
			room.gold_reward = randi_range(30, 50)
		DungeonRoomData.RoomType.BOSS:
			room.enemy_count = 1
			room.gold_reward = randi_range(50, 100)
	
	return room


## Get visual position for a room
static func _get_room_position(row: int, col: int) -> Vector2:
	var x = 50 + col * COL_SPACING
	var y = MAP_HEIGHT - 50 - row * ROW_SPACING  # Y inverted (bottom to top)
	return Vector2(x, y)


## Generate connections between rooms based on paths
static func _generate_connections(rooms: Array[DungeonRoomData], _grid: Array, paths: Array) -> void:
	# Find rooms by position
	var pos_to_room: Dictionary = {}
	for room in rooms:
		var key = "%d_%d" % [room.row, room.column]
		pos_to_room[key] = room
	
	# Connect entrance to first row rooms
	var entrance = rooms[0]
	for path in paths:
		if path.size() > 0:
			var key = "1_%d" % path[0]
			if key in pos_to_room:
				var target = pos_to_room[key]
				if target.id not in entrance.connected_rooms:
					entrance.connected_rooms.append(target.id)
	
	# Connect rooms along paths
	for path in paths:
		for i in range(path.size() - 1):
			var row = i + 1
			var next_row = i + 2
			var col = path[i]
			var next_col = path[i + 1]
			
			var key = "%d_%d" % [row, col]
			var next_key = "%d_%d" % [next_row, next_col]
			
			if key in pos_to_room and next_key in pos_to_room:
				var room = pos_to_room[key]
				var next_room = pos_to_room[next_key]
				if next_room.id not in room.connected_rooms:
					room.connected_rooms.append(next_room.id)
	
	# Connect last row to boss
	var boss = rooms[rooms.size() - 1]
	var last_row = boss.row - 1
	for room in rooms:
		if room.row == last_row:
			if boss.id not in room.connected_rooms:
				room.connected_rooms.append(boss.id)
