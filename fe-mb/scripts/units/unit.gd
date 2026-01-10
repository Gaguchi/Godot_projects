extends CharacterBody2D
## Unit - Visual representation of a unit on the battlefield
## Wraps UnitData resource and handles visual state

@export var unit_data: UnitData

@onready var sprite: Sprite2D = $Sprite
@onready var selection_highlight: Sprite2D = $SelectionHighlight

var has_acted: bool = false
var is_selected: bool = false

# HP bar display
var hp_bar: ProgressBar
var hp_bar_bg: ColorRect


func _ready() -> void:
	_create_hp_bar()
	_update_visuals()


## Create HP bar above unit
func _create_hp_bar() -> void:
	# Background
	hp_bar_bg = ColorRect.new()
	hp_bar_bg.size = Vector2(28, 4)
	hp_bar_bg.position = Vector2(-14, -20)
	hp_bar_bg.color = Color(0.1, 0.1, 0.1, 0.8)
	add_child(hp_bar_bg)
	
	# HP bar
	hp_bar = ProgressBar.new()
	hp_bar.size = Vector2(26, 2)
	hp_bar.position = Vector2(-13, -19)
	hp_bar.show_percentage = false
	hp_bar.add_theme_stylebox_override("fill", _create_hp_fill_style())
	hp_bar.add_theme_stylebox_override("background", StyleBoxEmpty.new())
	add_child(hp_bar)


func _create_hp_fill_style() -> StyleBoxFlat:
	var style = StyleBoxFlat.new()
	style.bg_color = Color.LIME_GREEN
	style.corner_radius_top_left = 1
	style.corner_radius_top_right = 1
	style.corner_radius_bottom_left = 1
	style.corner_radius_bottom_right = 1
	return style


## Update HP bar color based on health percentage
func _update_hp_bar_color() -> void:
	if not hp_bar or not unit_data:
		return
	
	var health_percent = float(unit_data.current_hp) / float(unit_data.max_hp)
	var fill_style = hp_bar.get_theme_stylebox("fill") as StyleBoxFlat
	
	if fill_style:
		if health_percent > 0.5:
			fill_style.bg_color = Color.LIME_GREEN
		elif health_percent > 0.25:
			fill_style.bg_color = Color.YELLOW
		else:
			fill_style.bg_color = Color.RED


## Create and assign unit data programmatically
func initialize(data: UnitData) -> void:
	unit_data = data
	_update_visuals()


## Get the unit's data resource
func get_unit_data() -> UnitData:
	return unit_data


## Reset unit state for a new turn
func reset_turn() -> void:
	has_acted = false
	_update_visuals()


## Mark unit as having acted this turn
func mark_acted() -> void:
	has_acted = true
	_update_visuals()


## Set selection state
func set_selected(selected: bool) -> void:
	is_selected = selected
	if selection_highlight:
		selection_highlight.visible = selected


## Update visual appearance based on state
func _update_visuals() -> void:
	if not sprite:
		return
	
	# Create a placeholder colored rectangle based on unit type
	var placeholder = PlaceholderTexture2D.new()
	placeholder.size = Vector2(28, 28)
	sprite.texture = placeholder
	
	if unit_data:
		# Color based on team
		if unit_data.is_player_unit:
			sprite.modulate = Color.DODGER_BLUE
		else:
			sprite.modulate = Color.CRIMSON
		
		# Dim if already acted
		if has_acted:
			sprite.modulate = sprite.modulate.darkened(0.4)
		
		# Update HP bar
		if hp_bar:
			hp_bar.max_value = unit_data.max_hp
			hp_bar.value = unit_data.current_hp
			_update_hp_bar_color()
