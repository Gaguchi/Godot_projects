extends Node2D
## LocationNode - Visual representation of a location on the world map

@warning_ignore("unused_signal")
signal location_clicked(location_data: LocationData)
@warning_ignore("unused_signal")
signal location_hovered(location_data: LocationData)

@export var location_data: LocationData

var is_hovered: bool = false
var is_current: bool = false  # Player is here
var is_reachable: bool = false  # Can player travel here?
var is_threatened: bool = false  # Threat has reached this location

const NODE_RADIUS: float = 12.0  # Smaller to fit on roads


func _ready() -> void:
	# Create collision shape dynamically to avoid resource conflicts
	var shape = CircleShape2D.new()
	shape.radius = NODE_RADIUS + 6 # Slightly larger than visual radius for easier clicking
	$Area2D/CollisionShape2D.shape = shape
	
	_update_visuals()


func _draw() -> void:
	if not location_data:
		return
	
	var base_color = location_data.get_color()
	
	# Modify color based on state
	if is_threatened:
		base_color = base_color.lerp(Color.DARK_RED, 0.5)
	elif not is_reachable and not is_current:
		# Just slightly darker to indicate not immediately connected, but still visible
		base_color = base_color.darkened(0.3)
	
	# Draw outer ring
	var ring_color = Color.WHITE if is_current else (Color.YELLOW if is_hovered else Color(0.3, 0.3, 0.3))
	draw_circle(Vector2.ZERO, NODE_RADIUS + 3, ring_color)
	
	# Draw main circle
	draw_circle(Vector2.ZERO, NODE_RADIUS, base_color)
	
	# Draw visited indicator (small dot)
	if location_data.visited:
		draw_circle(Vector2.ZERO, 4, Color.WHITE)


func _on_area_mouse_entered() -> void:
	is_hovered = true
	location_hovered.emit(location_data)
	queue_redraw()

func _on_area_mouse_exited() -> void:
	is_hovered = false
	queue_redraw()


## Initialize with location data
func setup(data: LocationData) -> void:
	location_data = data
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


## Set threatened state (enemy has reached)
func set_threatened(threatened: bool) -> void:
	is_threatened = threatened
	queue_redraw()


func _update_visuals() -> void:
	queue_redraw()
