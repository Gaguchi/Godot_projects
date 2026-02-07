extends CharacterBody2D
## Unit - Visual representation of a unit on the battlefield
## Wraps UnitData resource and handles visual state

@export var unit_data: UnitData

@onready var sprite: Sprite2D = $Sprite
@onready var selection_highlight: Sprite2D = $SelectionHighlight
@onready var overhead_hp_bar: ProgressBar = $OverheadHPBar
@onready var overhead_armor_bar: ProgressBar = $OverheadArmorBar
@onready var class_label: Label = $ClassLabel

var has_acted: bool = false
var is_selected: bool = false
var _active_turn_tween: Tween = null


func _ready() -> void:
	print("[Unit] _ready() name=%s sprite=%s pos=%s" % [unit_data.unit_name if unit_data else "NULL", sprite, position])
	_update_visuals()


## Update HP bar color based on health percentage
func _update_hp_bar_color() -> void:
	if not overhead_hp_bar or not unit_data:
		return

	var health_percent: float = float(unit_data.current_hp) / float(unit_data.max_hp)
	var fill_style: StyleBoxFlat = overhead_hp_bar.get_theme_stylebox("fill") as StyleBoxFlat

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


## Highlight this unit as the active turn unit with a pulse effect
func set_active_turn(active: bool) -> void:
	if _active_turn_tween and _active_turn_tween.is_running():
		_active_turn_tween.kill()
		_active_turn_tween = null

	if active and selection_highlight:
		selection_highlight.visible = true
		selection_highlight.modulate = Color(1.0, 0.85, 0.2, 0.8)
		_active_turn_tween = create_tween().set_loops()
		_active_turn_tween.tween_property(selection_highlight, "modulate:a", 0.3, 0.6).set_trans(Tween.TRANS_SINE)
		_active_turn_tween.tween_property(selection_highlight, "modulate:a", 0.8, 0.6).set_trans(Tween.TRANS_SINE)
	elif selection_highlight:
		selection_highlight.visible = false
		selection_highlight.modulate = Color.WHITE


## Map unit names to sprite paths
const UNIT_SPRITES: Dictionary = {
	"Marcus": "res://assets/units/knight.png",
	"Lilina": "res://assets/units/mage.png",
}

## Update visual appearance based on state
func _update_visuals() -> void:
	if not sprite:
		return

	if unit_data and unit_data.unit_name in UNIT_SPRITES:
		var tex = load(UNIT_SPRITES[unit_data.unit_name]) as Texture2D
		if tex:
			sprite.texture = tex
			# Scale sprite to fit 48px tile space
			var tex_size = tex.get_size()
			sprite.scale = Vector2(48.0 / tex_size.x, 48.0 / tex_size.y)
			sprite.modulate = Color.WHITE
	else:
		# Fallback: create a visible colored rectangle for units without sprites
		var img: Image = Image.create(48, 48, false, Image.FORMAT_RGBA8)
		img.fill(Color.WHITE)
		sprite.texture = ImageTexture.create_from_image(img)
		sprite.scale = Vector2.ONE

	if unit_data:
		# Color placeholder units by team (sprites stay white)
		if not unit_data.unit_name in UNIT_SPRITES:
			if unit_data.is_player_unit:
				sprite.modulate = Color.DODGER_BLUE
			else:
				sprite.modulate = Color.CRIMSON

		# Dim if already acted
		if has_acted:
			sprite.modulate = sprite.modulate.darkened(0.4)

		# Update HP bar
		if overhead_hp_bar:
			overhead_hp_bar.max_value = unit_data.max_hp
			overhead_hp_bar.value = unit_data.current_hp
			_update_hp_bar_color()

		# Update armor bar
		if overhead_armor_bar:
			if unit_data.defense > 0:
				overhead_armor_bar.visible = true
				overhead_armor_bar.max_value = unit_data.defense
				overhead_armor_bar.value = unit_data.current_armor
			else:
				overhead_armor_bar.visible = false

		# Update class letter
		if class_label:
			class_label.text = _get_class_letter()


## Get a short letter for the unit's class
func _get_class_letter() -> String:
	if not unit_data:
		return "?"
	match unit_data.unit_class:
		UnitData.UnitClass.FIGHTER: return "F"
		UnitData.UnitClass.KNIGHT: return "K"
		UnitData.UnitClass.CAVALIER: return "C"
		UnitData.UnitClass.ARCHER: return "A"
		UnitData.UnitClass.MAGE: return "M"
		UnitData.UnitClass.CLERIC: return "H"
		UnitData.UnitClass.THIEF: return "T"
		UnitData.UnitClass.LORD: return "L"
	return "?"
