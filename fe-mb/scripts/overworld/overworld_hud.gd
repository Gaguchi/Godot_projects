class_name OverworldHUD
extends CanvasLayer
## OverworldHUD - Bannerlord-style bottom panel showing party, location, and resources
## Built entirely in code. Add as child of WorldMap and call setup() with party data.

signal quest_log_requested

# Color palette - Stone & Steel theme
const COLOR_PANEL_BG := Color(0.05, 0.055, 0.08, 0.95)
const COLOR_IRON_BORDER := Color(0.227, 0.239, 0.282)
const COLOR_EMBER := Color(0.69, 0.44, 0.25)
const COLOR_PARCHMENT := Color(0.832, 0.812, 0.761)
const COLOR_BLOOD_RED := Color(0.769, 0.267, 0.267)
const COLOR_MOSS_GREEN := Color(0.353, 0.541, 0.353)
const COLOR_WORN_STONE := Color(0.478, 0.463, 0.439)
const COLOR_BAR_BG := Color(0.15, 0.15, 0.15)

# Class circle colors
const CLASS_COLORS := {
	UnitData.UnitClass.LORD: Color(0.69, 0.44, 0.25),
	UnitData.UnitClass.KNIGHT: Color(0.353, 0.541, 0.671),
	UnitData.UnitClass.MAGE: Color(0.5, 0.3, 0.65),
	UnitData.UnitClass.FIGHTER: Color(0.769, 0.267, 0.267),
	UnitData.UnitClass.ARCHER: Color(0.353, 0.541, 0.353),
	UnitData.UnitClass.CLERIC: Color(0.8, 0.8, 0.8),
	UnitData.UnitClass.THIEF: Color(0.4, 0.4, 0.45),
	UnitData.UnitClass.CAVALIER: Color(0.55, 0.4, 0.3),
	UnitData.UnitClass.BOUNTY_HUNTER: Color(0.6, 0.5, 0.8),
}

# Class initial letters
const CLASS_INITIALS := {
	UnitData.UnitClass.LORD: "L",
	UnitData.UnitClass.KNIGHT: "K",
	UnitData.UnitClass.MAGE: "M",
	UnitData.UnitClass.FIGHTER: "F",
	UnitData.UnitClass.ARCHER: "A",
	UnitData.UnitClass.CLERIC: "C",
	UnitData.UnitClass.THIEF: "T",
	UnitData.UnitClass.CAVALIER: "V",
	UnitData.UnitClass.BOUNTY_HUNTER: "B",
}

# Node references (built in _ready)
var _party_container: HBoxContainer
var _location_name_label: Label
var _location_type_label: Label
var _run_stats_label: Label
var _supply_bar: ProgressBar
var _supply_label: Label
var _gold_label: Label
var _speed_label: Label

# Unit slot references for updates
var _unit_slots: Array[Dictionary] = []
# Each dict: { "root": Control, "name_label": Label, "hp_bar": ProgressBar, "hp_label": Label, "level_label": Label, "weapon_label": Label }


func _ready() -> void:
	layer = 10
	_build_ui()


func _build_ui() -> void:
	# Root PanelContainer - full width, bottom anchored
	var panel := PanelContainer.new()
	panel.name = "BottomPanel"

	# Style the panel
	var panel_style := StyleBoxFlat.new()
	panel_style.bg_color = COLOR_PANEL_BG
	panel_style.border_color = COLOR_IRON_BORDER
	panel_style.border_width_top = 2
	panel_style.border_width_left = 0
	panel_style.border_width_right = 0
	panel_style.border_width_bottom = 0
	panel.add_theme_stylebox_override("panel", panel_style)

	# Anchor to bottom of screen, full width
	panel.anchor_left = 0.0
	panel.anchor_right = 1.0
	panel.anchor_top = 1.0
	panel.anchor_bottom = 1.0
	panel.offset_top = -130.0
	panel.offset_bottom = 0.0
	panel.offset_left = 0.0
	panel.offset_right = 0.0
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE

	add_child(panel)

	# MarginContainer for padding
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 8)
	margin.add_theme_constant_override("margin_top", 8)
	margin.add_theme_constant_override("margin_right", 8)
	margin.add_theme_constant_override("margin_bottom", 8)
	panel.add_child(margin)

	# Main HBoxContainer
	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 12)
	margin.add_child(hbox)

	# --- PARTY SECTION (left, ~440px) ---
	_party_container = HBoxContainer.new()
	_party_container.custom_minimum_size.x = 440
	_party_container.add_theme_constant_override("separation", 8)
	_party_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hbox.add_child(_party_container)

	# Separator
	var sep1 := VSeparator.new()
	sep1.add_theme_constant_override("separation", 4)
	sep1.add_theme_stylebox_override("separator", _make_separator_style())
	hbox.add_child(sep1)

	# --- LOCATION SECTION (center, ~300px) ---
	var location_section := VBoxContainer.new()
	location_section.custom_minimum_size.x = 300
	location_section.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	location_section.alignment = BoxContainer.ALIGNMENT_CENTER
	hbox.add_child(location_section)

	_location_name_label = Label.new()
	_location_name_label.add_theme_font_size_override("font_size", 18)
	_location_name_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
	_location_name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_location_name_label.text = "---"
	location_section.add_child(_location_name_label)

	_location_type_label = Label.new()
	_location_type_label.add_theme_font_size_override("font_size", 14)
	_location_type_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
	_location_type_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_location_type_label.text = ""
	location_section.add_child(_location_type_label)

	# Spacer
	var loc_spacer := Control.new()
	loc_spacer.custom_minimum_size.y = 4
	location_section.add_child(loc_spacer)

	_run_stats_label = Label.new()
	_run_stats_label.add_theme_font_size_override("font_size", 12)
	_run_stats_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
	_run_stats_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_run_stats_label.text = "Battles: 0 | Visited: 0"
	location_section.add_child(_run_stats_label)

	# Quest Log button
	var quest_btn := Button.new()
	quest_btn.text = "Quest Log"
	quest_btn.custom_minimum_size = Vector2(100, 24)
	quest_btn.add_theme_font_size_override("font_size", 12)
	quest_btn.add_theme_color_override("font_color", COLOR_WORN_STONE)
	quest_btn.add_theme_color_override("font_hover_color", COLOR_EMBER)
	quest_btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	quest_btn.mouse_filter = Control.MOUSE_FILTER_STOP

	var quest_style := StyleBoxFlat.new()
	quest_style.bg_color = Color(0, 0, 0, 0)
	quest_style.set_border_width_all(0)
	quest_style.border_width_bottom = 1
	quest_style.border_color = Color(COLOR_IRON_BORDER, 0.3)
	quest_style.content_margin_top = 2
	quest_style.content_margin_bottom = 2
	quest_btn.add_theme_stylebox_override("normal", quest_style)

	var quest_hover := quest_style.duplicate()
	quest_hover.border_color = COLOR_EMBER
	quest_btn.add_theme_stylebox_override("hover", quest_hover)

	quest_btn.pressed.connect(func(): quest_log_requested.emit())
	location_section.add_child(quest_btn)

	# Separator
	var sep2 := VSeparator.new()
	sep2.add_theme_constant_override("separation", 4)
	sep2.add_theme_stylebox_override("separator", _make_separator_style())
	hbox.add_child(sep2)

	# --- RESOURCES SECTION (right, ~340px) ---
	var resources_section := VBoxContainer.new()
	resources_section.custom_minimum_size.x = 340
	resources_section.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	resources_section.add_theme_constant_override("separation", 4)
	hbox.add_child(resources_section)

	# Supply row
	var supply_row := _make_resource_row("Supplies", 10, true)
	resources_section.add_child(supply_row.container)
	_supply_bar = supply_row.bar
	_supply_label = supply_row.value_label

	# Gold row
	var gold_row := HBoxContainer.new()
	gold_row.add_theme_constant_override("separation", 8)
	resources_section.add_child(gold_row)

	var gold_text := Label.new()
	gold_text.text = "Gold"
	gold_text.add_theme_font_size_override("font_size", 13)
	gold_text.add_theme_color_override("font_color", COLOR_WORN_STONE)
	gold_text.custom_minimum_size.x = 60
	gold_row.add_child(gold_text)

	_gold_label = Label.new()
	_gold_label.text = "0"
	_gold_label.add_theme_font_size_override("font_size", 13)
	_gold_label.add_theme_color_override("font_color", COLOR_EMBER)
	gold_row.add_child(_gold_label)

	# Speed row
	_speed_label = Label.new()
	_speed_label.text = "Speed: ---"
	_speed_label.add_theme_font_size_override("font_size", 12)
	_speed_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
	resources_section.add_child(_speed_label)


func _make_separator_style() -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = COLOR_IRON_BORDER
	style.content_margin_left = 1
	style.content_margin_right = 1
	return style


## Creates a resource row with label, progress bar, and value label.
## Returns a dictionary with keys: container, bar, value_label
func _make_resource_row(label_text: String, max_val: int, _with_bar: bool) -> Dictionary:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)

	var name_label := Label.new()
	name_label.text = label_text
	name_label.add_theme_font_size_override("font_size", 13)
	name_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
	name_label.custom_minimum_size.x = 60
	row.add_child(name_label)

	var bar := ProgressBar.new()
	bar.custom_minimum_size = Vector2(80, 10)
	bar.max_value = max_val
	bar.value = 0
	bar.show_percentage = false
	bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER

	# Background style
	var bg_style := StyleBoxFlat.new()
	bg_style.bg_color = COLOR_BAR_BG
	bg_style.corner_radius_top_left = 2
	bg_style.corner_radius_top_right = 2
	bg_style.corner_radius_bottom_left = 2
	bg_style.corner_radius_bottom_right = 2
	bar.add_theme_stylebox_override("background", bg_style)

	# Fill style (will be updated dynamically)
	var fill_style := StyleBoxFlat.new()
	fill_style.bg_color = COLOR_MOSS_GREEN
	fill_style.corner_radius_top_left = 2
	fill_style.corner_radius_top_right = 2
	fill_style.corner_radius_bottom_left = 2
	fill_style.corner_radius_bottom_right = 2
	bar.add_theme_stylebox_override("fill", fill_style)

	row.add_child(bar)

	var value_label := Label.new()
	value_label.text = "0/%d" % max_val
	value_label.add_theme_font_size_override("font_size", 13)
	value_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
	row.add_child(value_label)

	return { "container": row, "bar": bar, "value_label": value_label }


# --- PUBLIC API ---

## Initial build of unit slots from party array
func setup(party: Array) -> void:
	_build_party_slots(party)
	update_resources()
	_update_run_stats()


## Rebuild all unit slots from scratch
func _build_party_slots(party: Array) -> void:
	# Clear existing
	for child in _party_container.get_children():
		child.queue_free()
	_unit_slots.clear()

	for unit in party:
		if not unit is UnitData:
			continue
		var slot := _create_unit_slot(unit as UnitData)
		_party_container.add_child(slot.root)
		_unit_slots.append(slot)


## Creates a single unit slot VBoxContainer and returns a dictionary of references
func _create_unit_slot(unit: UnitData) -> Dictionary:
	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 2)
	root.custom_minimum_size.x = 68

	# Top row: class circle + info
	var top_row := HBoxContainer.new()
	top_row.add_theme_constant_override("separation", 4)
	root.add_child(top_row)

	# Class circle (36px diameter)
	var circle_container := Panel.new()
	circle_container.custom_minimum_size = Vector2(36, 36)
	circle_container.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	circle_container.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	circle_container.mouse_filter = Control.MOUSE_FILTER_IGNORE

	var circle_style := StyleBoxFlat.new()
	var class_color: Color = CLASS_COLORS.get(unit.unit_class, COLOR_WORN_STONE)
	circle_style.bg_color = class_color
	circle_style.corner_radius_top_left = 18
	circle_style.corner_radius_top_right = 18
	circle_style.corner_radius_bottom_left = 18
	circle_style.corner_radius_bottom_right = 18
	circle_container.add_theme_stylebox_override("panel", circle_style)

	# Class initial label centered on circle
	var initial_label := Label.new()
	initial_label.text = CLASS_INITIALS.get(unit.unit_class, "?")
	initial_label.add_theme_font_size_override("font_size", 16)
	initial_label.add_theme_color_override("font_color", Color.WHITE)
	initial_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	initial_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	initial_label.anchor_left = 0.0
	initial_label.anchor_right = 1.0
	initial_label.anchor_top = 0.0
	initial_label.anchor_bottom = 1.0
	initial_label.offset_left = 0
	initial_label.offset_right = 0
	initial_label.offset_top = 0
	initial_label.offset_bottom = 0
	initial_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	circle_container.add_child(initial_label)

	top_row.add_child(circle_container)

	# Info column: name, HP bar, level
	var info_col := VBoxContainer.new()
	info_col.add_theme_constant_override("separation", 1)
	top_row.add_child(info_col)

	# Name
	var name_label := Label.new()
	name_label.text = unit.unit_name
	name_label.add_theme_font_size_override("font_size", 12)
	name_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
	info_col.add_child(name_label)

	# HP bar
	var hp_bar := ProgressBar.new()
	hp_bar.custom_minimum_size = Vector2(100, 8)
	hp_bar.max_value = unit.max_hp
	hp_bar.value = unit.current_hp
	hp_bar.show_percentage = false
	hp_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER

	var hp_bg := StyleBoxFlat.new()
	hp_bg.bg_color = COLOR_BAR_BG
	hp_bg.corner_radius_top_left = 2
	hp_bg.corner_radius_top_right = 2
	hp_bg.corner_radius_bottom_left = 2
	hp_bg.corner_radius_bottom_right = 2
	hp_bar.add_theme_stylebox_override("background", hp_bg)

	var hp_fill := StyleBoxFlat.new()
	hp_fill.bg_color = _get_hp_color(unit.current_hp, unit.max_hp)
	hp_fill.corner_radius_top_left = 2
	hp_fill.corner_radius_top_right = 2
	hp_fill.corner_radius_bottom_left = 2
	hp_fill.corner_radius_bottom_right = 2
	hp_bar.add_theme_stylebox_override("fill", hp_fill)

	info_col.add_child(hp_bar)

	# HP value + Level on same line
	var stat_row := HBoxContainer.new()
	stat_row.add_theme_constant_override("separation", 4)
	info_col.add_child(stat_row)

	var hp_label := Label.new()
	hp_label.text = "%d/%d" % [unit.current_hp, unit.max_hp]
	hp_label.add_theme_font_size_override("font_size", 10)
	hp_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
	stat_row.add_child(hp_label)

	var level_label := Label.new()
	level_label.text = "Lv%d" % unit.level
	level_label.add_theme_font_size_override("font_size", 10)
	level_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
	stat_row.add_child(level_label)

	# Weapon label
	var weapon_label := Label.new()
	if unit.equipped_weapon and unit.equipped_weapon is ItemData:
		weapon_label.text = (unit.equipped_weapon as ItemData).get_weapon_type_name()
	else:
		weapon_label.text = "Unarmed"
	weapon_label.add_theme_font_size_override("font_size", 10)
	weapon_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
	root.add_child(weapon_label)

	# Apply fallen modulation if dead
	if not unit.is_alive():
		root.modulate.a = 0.4
		name_label.add_theme_color_override("font_color", COLOR_BLOOD_RED)

	return {
		"root": root,
		"name_label": name_label,
		"hp_bar": hp_bar,
		"hp_label": hp_label,
		"level_label": level_label,
		"weapon_label": weapon_label,
	}


## Refresh all unit slots from GameManager.party
func update_party() -> void:
	var party: Array = GameManager.party

	# If party size changed, rebuild slots
	if party.size() != _unit_slots.size():
		_build_party_slots(party)
		return

	for i in range(party.size()):
		var unit: UnitData = party[i] as UnitData
		if not unit:
			continue
		var slot: Dictionary = _unit_slots[i]

		# Update name
		(slot.name_label as Label).text = unit.unit_name

		# Update HP bar
		var hp_bar: ProgressBar = slot.hp_bar as ProgressBar
		hp_bar.max_value = unit.max_hp
		hp_bar.value = unit.current_hp

		# Update HP bar fill color
		var fill_style := StyleBoxFlat.new()
		fill_style.bg_color = _get_hp_color(unit.current_hp, unit.max_hp)
		fill_style.corner_radius_top_left = 2
		fill_style.corner_radius_top_right = 2
		fill_style.corner_radius_bottom_left = 2
		fill_style.corner_radius_bottom_right = 2
		hp_bar.add_theme_stylebox_override("fill", fill_style)

		# Update HP text
		(slot.hp_label as Label).text = "%d/%d" % [unit.current_hp, unit.max_hp]

		# Update level
		(slot.level_label as Label).text = "Lv%d" % unit.level

		# Update weapon
		if unit.equipped_weapon and unit.equipped_weapon is ItemData:
			(slot.weapon_label as Label).text = (unit.equipped_weapon as ItemData).get_weapon_type_name()
		else:
			(slot.weapon_label as Label).text = "Unarmed"

		# Fallen state
		var root: Control = slot.root as Control
		if not unit.is_alive():
			root.modulate.a = 0.4
			(slot.name_label as Label).add_theme_color_override("font_color", COLOR_BLOOD_RED)
		else:
			root.modulate.a = 1.0
			(slot.name_label as Label).add_theme_color_override("font_color", COLOR_PARCHMENT)


## Update the center location section
func update_location(location_name: String, location_type: String) -> void:
	if _location_name_label:
		_location_name_label.text = location_name
	if _location_type_label:
		_location_type_label.text = location_type
	_update_run_stats()


## Refresh resource values and bar fills from GameManager
func update_resources() -> void:
	var food: int = GameManager.food
	var gold: int = GameManager.gold

	# Supply bar
	if _supply_bar:
		_supply_bar.max_value = 10
		_supply_bar.value = food
		_update_bar_fill(_supply_bar, food, 10, 5, 2)
	if _supply_label:
		_supply_label.text = "%d/10" % food

	# Gold
	if _gold_label:
		_gold_label.text = str(gold)


## Update the speed display
func update_speed(terrain_speed: float, terrain_name: String) -> void:
	if _speed_label:
		_speed_label.text = "Speed: %.1f (%s)" % [terrain_speed, terrain_name]


## Returns the label node for a specific resource (used for float animations)
func get_resource_label(resource_name: String) -> Label:
	match resource_name:
		"supply", "food":
			return _supply_label
		"gold":
			return _gold_label
	return null


# --- INTERNAL HELPERS ---

func _update_run_stats() -> void:
	if _run_stats_label:
		_run_stats_label.text = "Battles: %d | Visited: %d" % [
			GameManager.battles_won, GameManager.nodes_visited
		]


## Update a ProgressBar fill color based on tri-color thresholds
func _update_bar_fill(bar: ProgressBar, current: int, _max_val: int, green_threshold: int, ember_threshold: int) -> void:
	var fill_style := StyleBoxFlat.new()
	if current > green_threshold:
		fill_style.bg_color = COLOR_MOSS_GREEN
	elif current > ember_threshold:
		fill_style.bg_color = COLOR_EMBER
	else:
		fill_style.bg_color = COLOR_BLOOD_RED
	fill_style.corner_radius_top_left = 2
	fill_style.corner_radius_top_right = 2
	fill_style.corner_radius_bottom_left = 2
	fill_style.corner_radius_bottom_right = 2
	bar.add_theme_stylebox_override("fill", fill_style)


## Get HP bar color based on percentage
func _get_hp_color(current_hp: int, max_hp: int) -> Color:
	if max_hp <= 0:
		return COLOR_BLOOD_RED
	var pct: float = float(current_hp) / float(max_hp)
	if pct > 0.5:
		return COLOR_MOSS_GREEN
	elif pct > 0.25:
		return COLOR_EMBER
	else:
		return COLOR_BLOOD_RED
