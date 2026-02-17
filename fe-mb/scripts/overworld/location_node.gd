extends Node2D
## LocationNode - Visual representation of a location on the FTL-style node map

@warning_ignore("unused_signal")
signal location_clicked(location_data: LocationData)
signal location_hovered(location_data: LocationData)
signal location_unhovered

@export var location_data: LocationData

var is_hovered: bool = false
var is_current: bool = false
var is_reachable: bool = false
var is_adjacent: bool = false  # Directly connected to current location
var has_quest_indicator: bool = false  # Show yellow "!" for active quests

const NODE_RADIUS: float = 14.0
const PULSE_SPEED: float = 2.5
var _pulse_time: float = 0.0


func _ready() -> void:
	var shape = CircleShape2D.new()
	shape.radius = NODE_RADIUS + 8
	$Area2D/CollisionShape2D.shape = shape
	set_process(false)
	queue_redraw()


func _process(delta: float) -> void:
	_pulse_time += delta * PULSE_SPEED
	queue_redraw()


func _draw() -> void:
	if not location_data:
		return

	var base_color = location_data.get_color()

	var is_quest_node: bool = location_data.location_type == LocationData.LocationType.QUEST

	# Subtle dim for non-adjacent, non-current nodes (except quest nodes stay bright)
	if not is_adjacent and not is_current and not is_quest_node:
		base_color = base_color.darkened(0.15)

	# Pulsing glow for adjacent nodes (ember) and quest nodes (crimson)
	if is_quest_node:
		var glow_alpha = 0.15 + 0.12 * sin(_pulse_time)
		draw_circle(Vector2.ZERO, NODE_RADIUS + 10, Color(0.85, 0.2, 0.15, glow_alpha))
	elif is_adjacent and not is_current:
		var glow_alpha = 0.12 + 0.12 * sin(_pulse_time)
		draw_circle(Vector2.ZERO, NODE_RADIUS + 8, Color(0.69, 0.44, 0.25, glow_alpha))

	# Outer ring
	var ring_color: Color
	if is_current:
		ring_color = Color.WHITE
	elif is_quest_node:
		ring_color = Color(0.85, 0.3, 0.2)
	elif is_hovered:
		ring_color = Color(0.416, 0.439, 0.502)
	elif is_adjacent:
		ring_color = Color(0.62, 0.42, 0.25)
	else:
		ring_color = Color(0.29, 0.31, 0.35)

	draw_circle(Vector2.ZERO, NODE_RADIUS + 3, ring_color)

	# Main circle
	draw_circle(Vector2.ZERO, NODE_RADIUS, base_color)

	# Icon text in center
	var icon = _get_icon_char()
	if not icon.is_empty():
		draw_string(ThemeDB.fallback_font, Vector2(-5, 5), icon, HORIZONTAL_ALIGNMENT_CENTER, -1, 12, Color.WHITE)

	# Visited checkmark
	if location_data.visited and not is_current:
		draw_circle(Vector2(NODE_RADIUS - 2, -(NODE_RADIUS - 2)), 4, Color(0.2, 0.8, 0.2))

	# Quest indicator (yellow "!" above node)
	if has_quest_indicator:
		var quest_color := Color(1.0, 0.85, 0.2)
		draw_circle(Vector2(0, -(NODE_RADIUS + 10)), 7, Color(0.15, 0.12, 0.02))
		draw_string(ThemeDB.fallback_font, Vector2(-4, -(NODE_RADIUS + 5)), "!", HORIZONTAL_ALIGNMENT_CENTER, -1, 14, quest_color)

	# Location name label below
	var name_color = Color(0.832, 0.812, 0.761) if (is_current or is_adjacent or is_quest_node) else Color(0.478, 0.463, 0.439)
	draw_string(ThemeDB.fallback_font, Vector2(-40, NODE_RADIUS + 16), location_data.location_name, HORIZONTAL_ALIGNMENT_CENTER, 80, 12, name_color)


func _get_icon_char() -> String:
	match location_data.location_type:
		LocationData.LocationType.TOWN: return "T"
		LocationData.LocationType.CAMP: return "R"
		LocationData.LocationType.DUNGEON: return "D"
		LocationData.LocationType.EXIT: return "X"
		LocationData.LocationType.QUEST: return "Q"
	return ""


func _on_area_mouse_entered() -> void:
	is_hovered = true
	location_hovered.emit(location_data)
	queue_redraw()

func _on_area_mouse_exited() -> void:
	is_hovered = false
	location_unhovered.emit()
	queue_redraw()


func setup(data: LocationData) -> void:
	location_data = data
	position = data.position
	_update_process()
	queue_redraw()


func set_reachable(reachable: bool) -> void:
	is_reachable = reachable
	queue_redraw()


func set_current(current: bool) -> void:
	is_current = current
	_update_process()
	queue_redraw()


func set_adjacent(adjacent: bool) -> void:
	is_adjacent = adjacent
	_update_process()
	queue_redraw()


func set_quest_indicator(show: bool) -> void:
	has_quest_indicator = show
	queue_redraw()


func _update_process() -> void:
	var is_quest_node: bool = location_data and location_data.location_type == LocationData.LocationType.QUEST
	set_process(is_quest_node or (is_adjacent and not is_current))
