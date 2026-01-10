extends Node2D
## GridOverlay - Draws grid lines and highlights walkable/attackable tiles
## Child of Battlefield, redraws when highlights change

const TILE_SIZE: int = 32
const GRID_WIDTH: int = 10
const GRID_HEIGHT: int = 10

var walkable_tiles: Array = []
var attackable_tiles: Array = []  # Attack-only tiles (beyond movement)
var attack_from_position_tiles: Array = []  # Tiles from which we can attack
var selected_tile: Vector2i = Vector2i(-1, -1)
var hover_tile: Vector2i = Vector2i(-1, -1)
var path_preview: Array = []  # Path from selected unit to hover tile

# Colors
var grid_color: Color = Color(0.4, 0.4, 0.4, 0.6)
var walkable_color: Color = Color(0.2, 0.6, 1.0, 0.35)  # Blue
var attackable_color: Color = Color(1.0, 0.2, 0.2, 0.35)  # Red
var selected_color: Color = Color(1.0, 1.0, 0.2, 0.5)  # Yellow
var hover_color: Color = Color(1.0, 1.0, 1.0, 0.3)  # White
var path_color: Color = Color(0.3, 0.9, 0.3, 0.6)  # Green


func _ready() -> void:
	# Ensure grid is drawn immediately
	queue_redraw()


func _process(_delta: float) -> void:
	# Update hover tile based on mouse position
	var mouse_pos = get_local_mouse_position()
	var new_hover = Vector2i(int(mouse_pos.x / TILE_SIZE), int(mouse_pos.y / TILE_SIZE))
	
	if new_hover != hover_tile:
		hover_tile = new_hover
		queue_redraw()


func _draw() -> void:
	# Always draw grid lines first
	_draw_grid()
	
	# Draw walkable tiles (movement range)
	for tile in walkable_tiles:
		_draw_tile_highlight(tile, walkable_color)
	
	# Draw attackable tiles (attack range beyond movement)
	for tile in attackable_tiles:
		_draw_tile_highlight(tile, attackable_color)
	
	# Draw path preview
	_draw_path_preview()
	
	# Draw hover tile
	if _is_valid_tile(hover_tile):
		_draw_tile_border(hover_tile, hover_color, 3.0)
	
	# Draw selected tile
	if selected_tile.x >= 0:
		_draw_tile_highlight(selected_tile, selected_color)


func _draw_grid() -> void:
	# Vertical lines
	for x in range(GRID_WIDTH + 1):
		var start = Vector2(x * TILE_SIZE, 0)
		var end = Vector2(x * TILE_SIZE, GRID_HEIGHT * TILE_SIZE)
		draw_line(start, end, grid_color, 1.0)
	
	# Horizontal lines
	for y in range(GRID_HEIGHT + 1):
		var start = Vector2(0, y * TILE_SIZE)
		var end = Vector2(GRID_WIDTH * TILE_SIZE, y * TILE_SIZE)
		draw_line(start, end, grid_color, 1.0)


func _draw_tile_highlight(tile: Vector2i, color: Color) -> void:
	var rect = Rect2(
		tile.x * TILE_SIZE,
		tile.y * TILE_SIZE,
		TILE_SIZE,
		TILE_SIZE
	)
	draw_rect(rect, color, true)


func _draw_tile_border(tile: Vector2i, color: Color, width: float) -> void:
	var rect = Rect2(
		tile.x * TILE_SIZE + 1,
		tile.y * TILE_SIZE + 1,
		TILE_SIZE - 2,
		TILE_SIZE - 2
	)
	draw_rect(rect, color, false, width)


func _draw_path_preview() -> void:
	if path_preview.is_empty():
		return
	
	# Draw path as connected line through tile centers
	for i in range(path_preview.size() - 1):
		var from_tile: Vector2i = path_preview[i]
		var to_tile: Vector2i = path_preview[i + 1]
		var from_pos = Vector2(from_tile.x * TILE_SIZE + TILE_SIZE / 2, from_tile.y * TILE_SIZE + TILE_SIZE / 2)
		var to_pos = Vector2(to_tile.x * TILE_SIZE + TILE_SIZE / 2, to_tile.y * TILE_SIZE + TILE_SIZE / 2)
		draw_line(from_pos, to_pos, path_color, 3.0)
	
	# Draw dots at each path point
	for tile in path_preview:
		var center = Vector2(tile.x * TILE_SIZE + TILE_SIZE / 2, tile.y * TILE_SIZE + TILE_SIZE / 2)
		draw_circle(center, 4, path_color)


func _is_valid_tile(tile: Vector2i) -> bool:
	return tile.x >= 0 and tile.x < GRID_WIDTH and tile.y >= 0 and tile.y < GRID_HEIGHT


## Update walkable tiles and redraw
func set_walkable_tiles(tiles: Array) -> void:
	walkable_tiles = tiles
	queue_redraw()


## Update attackable tiles and redraw
func set_attackable_tiles(tiles: Array) -> void:
	attackable_tiles = tiles
	queue_redraw()


## Set selected tile highlight
func set_selected_tile(tile: Vector2i) -> void:
	selected_tile = tile
	queue_redraw()


## Set path preview
func set_path_preview(path: Array) -> void:
	path_preview = path
	queue_redraw()


## Clear all highlights
func clear_highlights() -> void:
	walkable_tiles.clear()
	attackable_tiles.clear()
	path_preview.clear()
	selected_tile = Vector2i(-1, -1)
	queue_redraw()


## Get current hover tile
func get_hover_tile() -> Vector2i:
	return hover_tile
