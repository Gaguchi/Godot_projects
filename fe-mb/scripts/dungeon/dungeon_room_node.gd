extends Node2D
## DungeonRoomNode - Visual representation of a dungeon room

signal room_clicked(room_data: DungeonRoomData)
signal room_hovered(room_data: DungeonRoomData)

@export var room_data: DungeonRoomData

var is_hovered: bool = false
var is_current: bool = false  # Player is here
var is_reachable: bool = false  # Can player travel here?
var is_completed: bool = false  # Room has been cleared

const NODE_RADIUS: float = 18.0


func _ready() -> void:
	_update_visuals()


func _draw() -> void:
	if not room_data:
		return
	
	var base_color = room_data.get_color()
	
	# Modify color based on state
	if is_completed:
		base_color = base_color.darkened(0.4)
	elif not is_reachable and not is_current:
		base_color = base_color.darkened(0.6)
	
	# Draw outer ring
	var ring_color: Color
	if is_current:
		ring_color = Color.WHITE
	elif is_hovered and is_reachable:
		ring_color = Color.YELLOW
	elif is_completed:
		ring_color = Color.DIM_GRAY
	else:
		ring_color = Color(0.3, 0.3, 0.3)
	
	draw_circle(Vector2.ZERO, NODE_RADIUS + 3, ring_color)
	
	# Draw main circle
	draw_circle(Vector2.ZERO, NODE_RADIUS, base_color)
	
	# Draw icon indicator (simple shape for now)
	if is_current:
		draw_circle(Vector2.ZERO, 5, Color.WHITE)
	elif room_data.visited:
		draw_circle(Vector2.ZERO, 4, Color(1, 1, 1, 0.5))


func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if is_hovered and is_reachable:
			room_clicked.emit(room_data)


func _process(_delta: float) -> void:
	var mouse_pos = get_local_mouse_position()
	var was_hovered = is_hovered
	is_hovered = mouse_pos.length() <= NODE_RADIUS + 5
	
	if is_hovered != was_hovered:
		if is_hovered:
			room_hovered.emit(room_data)
		queue_redraw()


## Initialize with room data
func setup(data: DungeonRoomData) -> void:
	room_data = data
	position = data.position
	_update_visuals()


## Set whether player can travel here
func set_reachable(reachable: bool) -> void:
	is_reachable = reachable
	queue_redraw()


## Set as current player location
func set_current(current: bool) -> void:
	is_current = current
	queue_redraw()


## Set as completed (room cleared)
func set_completed(completed: bool) -> void:
	is_completed = completed
	queue_redraw()


func _update_visuals() -> void:
	queue_redraw()
