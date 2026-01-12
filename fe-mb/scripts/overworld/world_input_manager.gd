extends Node2D

signal node_clicked(node)
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

# ... (imports)

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
                print("[InputManager] Mouse DOWN at ", event.position)
                _start_drag(event.position)
            else:
                print("[InputManager] Mouse UP at ", event.position)
                _end_drag(event.position)

    # Handle Drag Motion
    elif event is InputEventMouseMotion:
        if  _dragging or (Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and _should_start_drag(event.position)):
            _process_drag(event)

func _start_drag(mouse_pos: Vector2) -> void:
    _start_mouse_pos = mouse_pos
    _camera_start_pos = camera.global_position
    _dragging = false # Don't start dragging immediately, wait for threshold

func _should_start_drag(mouse_pos: Vector2) -> bool:
    if _dragging:
        return true
    if _start_mouse_pos.distance_to(mouse_pos) > drag_threshold:
        print("[InputManager] DRAG STARTED (Threshold passed)")
        _dragging = true
        panning_started.emit()
        return true
    return false

func _process_drag(event: InputEventMouseMotion) -> void:
    # Logic: Move camera opposite to mouse movement to create "Drag the World" feel
    # We use relative movement scaled by zoom
    camera.global_position -= event.relative * (1.0 / camera.zoom.x)

func _end_drag(mouse_pos: Vector2) -> void:
    if _dragging:
        print("[InputManager] DRAG ENDED")
        _dragging = false
        panning_ended.emit()
    else:
        # It was a click!
        print("[InputManager] CLICK DETECTED at ", mouse_pos)
        _handle_click(mouse_pos)

func _handle_click(screen_pos: Vector2) -> void:
    # Convert screen pos to world position
    # The Camera logic might offset this, but get_global_mouse_position() usually handles it.
    # We raycast or rely on Area2Ds.
    # Since we are using unhandled_input, we likely just want to fire a signal 
    # and let the Game Map check what's under the cursor.
    # But wait, Area2Ds capture input before unhandled_input only if input_pickable is true.
    # If we want complete control, we manually check intersecting areas.
    
    var world_pos = get_canvas_transform().affine_inverse() * screen_pos
    # Fire a raycast via PhysicsServer or just check distance to nodes?
    # Simpler: emit signal with position, let WorldMap find closest node.
    pass 
    # Actually, simpler pattern: The MapNodes are Area2Ds. 
    # If we didn't drag, we check if the mouse is over one.
    # But input handling order matters.
    # Strategy: Fire a signal "map_clicked" with the global mouse position.
    
    var final_pos = get_global_mouse_position()
    # Signal that a click occurred at this location
    # Ideally we find what was clicked.
    var space_state = get_world_2d().direct_space_state
    var query = PhysicsPointQueryParameters2D.new()
    query.position = final_pos
    query.collide_with_areas = true
    query.collide_with_bodies = false
    
    var result = space_state.intersect_point(query)
    if result.size() > 0:
        # Assuming the first hit is valid.
        var hit_node = result[0].collider
        node_clicked.emit(hit_node)

func _zoom_camera(amount: float) -> void:
    _current_zoom = clamp(_current_zoom + amount, min_zoom, max_zoom)
    # Tweet zoom for smoothness? Optional. For now direct set.
    camera.zoom = Vector2(_current_zoom, _current_zoom)
