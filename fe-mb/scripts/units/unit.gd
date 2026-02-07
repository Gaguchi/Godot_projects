extends CharacterBody2D
## Unit - Visual representation of a unit on the battlefield
## Wraps UnitData resource and handles visual state

@export var unit_data: UnitData

@onready var sprite: Sprite2D = $Sprite
@onready var selection_highlight: Sprite2D = $SelectionHighlight
@onready var overhead_hp_bar: ProgressBar = $OverheadHPBar
@onready var overhead_armor_bar: ProgressBar = $OverheadArmorBar
@onready var class_label: Label = $ClassLabel
@onready var team_indicator: Polygon2D = $TeamIndicator
@onready var name_label: Label = $NameLabel

var has_acted: bool = false
var is_selected: bool = false
var _active_turn_tween: Tween = null

## Static sprite cache: "CLASS_TEAM" -> ImageTexture (generated once per session)
static var _sprite_cache: Dictionary = {}
## Static selection highlight texture (shared across all units)
static var _highlight_texture: ImageTexture = null


func _ready() -> void:
	_ensure_highlight_texture()
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
		_active_turn_tween.tween_property(selection_highlight, "modulate:a", 0.3, 0.5).set_trans(Tween.TRANS_SINE)
		_active_turn_tween.tween_property(selection_highlight, "modulate:a", 0.9, 0.5).set_trans(Tween.TRANS_SINE)
	elif selection_highlight:
		selection_highlight.visible = false
		selection_highlight.modulate = Color.WHITE


## Show/hide the unit name tooltip on hover
func show_name_tooltip(show: bool) -> void:
	if name_label:
		if show and unit_data:
			name_label.text = unit_data.unit_name
		name_label.visible = show


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
			var tex_size = tex.get_size()
			sprite.scale = Vector2(48.0 / tex_size.x, 48.0 / tex_size.y)
			sprite.modulate = Color.WHITE
	elif unit_data:
		# Procedural class sprite (cached)
		sprite.texture = _get_cached_sprite(unit_data.unit_class, unit_data.is_player_unit)
		sprite.scale = Vector2.ONE
		sprite.modulate = Color.WHITE

	if unit_data:
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

		# Update team indicator
		if team_indicator:
			team_indicator.color = Color(0.3, 0.7, 1.0, 0.7) if unit_data.is_player_unit else Color(1.0, 0.3, 0.3, 0.7)


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


# --- Procedural Sprite Generation ---

static func _get_cached_sprite(unit_class: UnitData.UnitClass, is_player: bool) -> ImageTexture:
	var key: String = "%d_%s" % [unit_class, "p" if is_player else "e"]
	if key not in _sprite_cache:
		var color: Color = Color(0.25, 0.55, 0.95) if is_player else Color(0.85, 0.2, 0.2)
		_sprite_cache[key] = _generate_class_sprite(unit_class, color)
	return _sprite_cache[key]


static func _generate_class_sprite(unit_class: UnitData.UnitClass, team_color: Color) -> ImageTexture:
	var img: Image = Image.create(48, 48, false, Image.FORMAT_RGBA8)
	var dark: Color = team_color.darkened(0.3)
	var light: Color = team_color.lightened(0.3)
	var metal: Color = Color(0.75, 0.78, 0.82)
	var wood: Color = Color(0.5, 0.33, 0.15)
	var gold: Color = Color(0.9, 0.75, 0.2)

	# Base body (all classes)
	_fill_rect(img, 17, 16, 14, 16, team_color)  # Torso
	_fill_rect(img, 15, 32, 8, 12, dark)           # Left leg
	_fill_rect(img, 25, 32, 8, 12, dark)           # Right leg

	# Head (all classes)
	_fill_circle(img, 24, 10, 7, light)

	# Class-specific details
	match unit_class:
		UnitData.UnitClass.FIGHTER:
			_fill_rect(img, 33, 16, 3, 20, metal)        # Sword blade
			_fill_rect(img, 31, 34, 7, 3, wood)           # Sword guard
			_fill_rect(img, 10, 18, 6, 12, team_color)    # Left arm
		UnitData.UnitClass.KNIGHT:
			_fill_rect(img, 13, 14, 22, 20, team_color)   # Wide armor torso
			_fill_rect(img, 8, 16, 6, 16, metal)          # Shield
			_fill_rect(img, 36, 2, 3, 32, metal)          # Lance
			_fill_rect(img, 34, 0, 7, 4, metal)           # Lance head
			_fill_circle(img, 24, 10, 7, metal.lerp(team_color, 0.3))  # Helmet
		UnitData.UnitClass.CAVALIER:
			_fill_rect(img, 8, 30, 32, 10, dark)          # Horse body
			_fill_rect(img, 36, 24, 8, 10, dark)          # Horse head
			_fill_rect(img, 42, 22, 4, 3, dark.lightened(0.2))  # Horse ear
			_fill_rect(img, 33, 10, 3, 20, metal)         # Lance
		UnitData.UnitClass.ARCHER:
			_fill_rect(img, 8, 12, 3, 24, wood)           # Bow stave
			_fill_rect(img, 6, 12, 3, 3, wood)            # Bow top
			_fill_rect(img, 6, 33, 3, 3, wood)            # Bow bottom
			_fill_rect(img, 34, 16, 2, 14, wood)          # Arrow
			_fill_rect(img, 33, 14, 4, 3, metal)          # Arrowhead
		UnitData.UnitClass.MAGE:
			_fill_rect(img, 14, 14, 20, 24, team_color.lerp(Color.PURPLE, 0.3))  # Robe
			_fill_rect(img, 37, 14, 2, 20, wood)          # Staff shaft
			_fill_circle(img, 38, 10, 4, Color(0.3, 0.8, 1.0))  # Staff orb
		UnitData.UnitClass.CLERIC:
			_fill_rect(img, 14, 14, 20, 24, Color.WHITE.darkened(0.15))  # White robe
			_fill_rect(img, 37, 8, 2, 24, gold)           # Staff
			_fill_rect(img, 34, 4, 8, 3, gold)            # Cross horizontal
			_fill_rect(img, 37, 1, 2, 6, gold)            # Cross vertical
		UnitData.UnitClass.THIEF:
			_fill_rect(img, 18, 14, 12, 18, dark)         # Slim dark body
			_fill_rect(img, 14, 16, 4, 10, dark)          # Cloak wing
			_fill_rect(img, 34, 22, 2, 12, metal)         # Dagger blade
			_fill_rect(img, 33, 32, 4, 3, wood)           # Dagger handle
		UnitData.UnitClass.LORD:
			_fill_rect(img, 15, 14, 18, 18, team_color)   # Body
			_fill_rect(img, 34, 12, 3, 22, gold)          # Gold sword
			_fill_rect(img, 32, 10, 7, 3, gold)           # Sword guard
			# Crown
			_fill_rect(img, 17, 2, 14, 3, gold)           # Crown base
			_fill_rect(img, 17, 0, 3, 3, gold)            # Crown left point
			_fill_rect(img, 23, 0, 3, 3, gold)            # Crown center point
			_fill_rect(img, 29, 0, 3, 3, gold)            # Crown right point

	return ImageTexture.create_from_image(img)


static func _fill_rect(img: Image, x: int, y: int, w: int, h: int, color: Color) -> void:
	for px in range(maxi(0, x), mini(48, x + w)):
		for py in range(maxi(0, y), mini(48, y + h)):
			img.set_pixel(px, py, color)


static func _fill_circle(img: Image, cx: int, cy: int, radius: int, color: Color) -> void:
	for px in range(maxi(0, cx - radius), mini(48, cx + radius + 1)):
		for py in range(maxi(0, cy - radius), mini(48, cy + radius + 1)):
			if (px - cx) * (px - cx) + (py - cy) * (py - cy) <= radius * radius:
				img.set_pixel(px, py, color)


# --- Selection Highlight Texture ---

func _ensure_highlight_texture() -> void:
	if selection_highlight and not selection_highlight.texture:
		if not _highlight_texture:
			_highlight_texture = _generate_highlight_texture()
		selection_highlight.texture = _highlight_texture


static func _generate_highlight_texture() -> ImageTexture:
	var size: int = 56
	var border: int = 3
	var img: Image = Image.create(size, size, true, Image.FORMAT_RGBA8)
	var color: Color = Color(1, 1, 1, 0.8)

	for px in range(size):
		for py in range(size):
			var on_left: bool = px < border
			var on_right: bool = px >= size - border
			var on_top: bool = py < border
			var on_bottom: bool = py >= size - border

			if not (on_left or on_right or on_top or on_bottom):
				continue

			# Skip corner pixels for rounded look
			var corner_size: int = 4
			var in_tl: bool = px < corner_size and py < corner_size and (px + py < corner_size)
			var in_tr: bool = px >= size - corner_size and py < corner_size and ((size - 1 - px) + py < corner_size)
			var in_bl: bool = px < corner_size and py >= size - corner_size and (px + (size - 1 - py) < corner_size)
			var in_br: bool = px >= size - corner_size and py >= size - corner_size and ((size - 1 - px) + (size - 1 - py) < corner_size)

			if not (in_tl or in_tr or in_bl or in_br):
				img.set_pixel(px, py, color)

	return ImageTexture.create_from_image(img)
