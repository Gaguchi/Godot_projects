extends Node2D

signal node_clicked(node)
signal terrain_clicked(world_pos: Vector2)
signal panning_started
signal panning_ended

@export var drag_threshold: float = 10.0
@export var pan_speed: float = 1.0
@export var zoom_speed: float = 0.1
@export var min_zoom: float = 0.5
@export var max_zoom: float = 2.0
@export var camera: Camera2D

var _dragging: bool = false
var _start_mouse_pos: Vector2 = Vector2.ZERO
var _camera_start_pos: Vector2 = Vector2.ZERO
var _current_zoom: float = 1.0


func _unhandled_input(event: InputEvent) -> void:
	if not camera:
		return

	# Handle Zoom
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_zoom_camera(zoom_speed)
			get_viewport().set_input_as_handled()
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_zoom_camera(-zoom_speed)
			get_viewport().set_input_as_handled()
			
		# Handle Click/Drag Start
		elif event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				_start_drag(event.position)
			else:
				_end_drag(event.position)

	# Handle Drag Motion
	elif event is InputEventMouseMotion:
		if _dragging or (Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and _should_start_drag(event.position)):
			_process_drag(event)


func _start_drag(mouse_pos: Vector2) -> void:
	_start_mouse_pos = mouse_pos
	_camera_start_pos = camera.global_position
	_dragging = false


func _should_start_drag(mouse_pos: Vector2) -> bool:
	if _dragging:
		return true
	if _start_mouse_pos.distance_to(mouse_pos) > drag_threshold:
		_dragging = true
		panning_started.emit()
		return true
	return false


func _process_drag(event: InputEventMouseMotion) -> void:
	camera.global_position -= event.relative * (1.0 / camera.zoom.x)


func _end_drag(mouse_pos: Vector2) -> void:
	if _dragging:
		_dragging = false
		panning_ended.emit()
	else:
		_handle_click(mouse_pos)


func _handle_click(screen_pos: Vector2) -> void:
	var final_pos = get_global_mouse_position()
	
	var space_state = get_world_2d().direct_space_state
	var query = PhysicsPointQueryParameters2D.new()
	query.position = final_pos
	query.collide_with_areas = true
	query.collide_with_bodies = false
	
	var result = space_state.intersect_point(query)
	if result.size() > 0:
		var hit_node = result[0].collider
		node_clicked.emit(hit_node)
	else:
		terrain_clicked.emit(final_pos)


func _zoom_camera(amount: float) -> void:
	_current_zoom = clamp(_current_zoom + amount, min_zoom, max_zoom)
	camera.zoom = Vector2(_current_zoom, _current_zoom)
