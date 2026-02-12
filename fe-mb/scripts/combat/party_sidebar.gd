class_name PartySidebar
extends PanelContainer
## PartySidebar - Vertical panel showing player party status during combat
## Displays unit names, HP bars, weapon info, and active/fallen states

# Stone & Steel color palette
const COLOR_PANEL_BG := Color(0.05, 0.055, 0.08, 0.95)
const COLOR_IRON_BORDER := Color(0.227, 0.239, 0.282)
const COLOR_EMBER := Color(0.69, 0.44, 0.25)
const COLOR_PARCHMENT := Color(0.832, 0.812, 0.761)
const COLOR_BLOOD_RED := Color(0.769, 0.267, 0.267)
const COLOR_MOSS_GREEN := Color(0.353, 0.541, 0.353)
const COLOR_WORN_STONE := Color(0.478, 0.463, 0.439)
const COLOR_HP_BAR_BG := Color(0.15, 0.15, 0.15)
const COLOR_ACTIVE_BG := Color(0.07, 0.075, 0.1, 0.95)

# Per-unit UI references keyed by unit_name
var _unit_slots: Dictionary = {}  # unit_name -> Dictionary of UI nodes
var _slot_containers: Dictionary = {}  # unit_name -> PanelContainer (the slot itself)
var _active_unit_name: String = ""
var _vbox: VBoxContainer = null


func setup(units: Array) -> void:
	# --- Root panel styling ---
	var panel_style := StyleBoxFlat.new()
	panel_style.bg_color = COLOR_PANEL_BG
	panel_style.border_color = COLOR_IRON_BORDER
	panel_style.border_width_left = 2
	panel_style.border_width_top = 2
	panel_style.border_width_right = 2
	panel_style.border_width_bottom = 2
	panel_style.corner_radius_top_left = 0
	panel_style.corner_radius_top_right = 0
	panel_style.corner_radius_bottom_left = 0
	panel_style.corner_radius_bottom_right = 0
	add_theme_stylebox_override("panel", panel_style)

	# Anchors: left side, full height
	anchor_left = 0.0
	anchor_top = 0.0
	anchor_right = 0.0
	anchor_bottom = 1.0
	offset_left = 0.0
	offset_top = 0.0
	offset_right = 150.0
	offset_bottom = 0.0
	custom_minimum_size.x = 150

	# --- Margin container ---
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 6)
	margin.add_theme_constant_override("margin_right", 6)
	margin.add_theme_constant_override("margin_top", 6)
	margin.add_theme_constant_override("margin_bottom", 6)
	margin.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	margin.size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_child(margin)

	# --- Main VBox ---
	_vbox = VBoxContainer.new()
	_vbox.add_theme_constant_override("separation", 8)
	margin.add_child(_vbox)

	# --- Header ---
	var header := Label.new()
	header.text = "Party"
	header.add_theme_font_size_override("font_size", 14)
	header.add_theme_color_override("font_color", COLOR_WORN_STONE)
	header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_vbox.add_child(header)

	var sep := HSeparator.new()
	sep.add_theme_color_override("separator_color", COLOR_IRON_BORDER)
	_vbox.add_child(sep)

	# --- Build a slot for each player unit ---
	for unit in units:
		if not unit.has_method("get_unit_data"):
			continue
		var data: UnitData = unit.get_unit_data()
		if data == null or not data.is_player_unit:
			continue
		_create_unit_slot(data)


func _create_unit_slot(data: UnitData) -> void:
	var unit_name: String = data.unit_name

	# Slot container (PanelContainer with iron border)
	var slot := PanelContainer.new()
	var slot_style := _make_slot_style(false)
	slot.add_theme_stylebox_override("panel", slot_style)

	# Inner VBox
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 2)
	slot.add_child(vbox)

	# Row 1: [ActiveMarker] [Name] [Level]
	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 3)
	vbox.add_child(hbox)

	var active_marker := Label.new()
	active_marker.text = ">"
	active_marker.add_theme_font_size_override("font_size", 13)
	active_marker.add_theme_color_override("font_color", COLOR_EMBER)
	active_marker.visible = false
	active_marker.custom_minimum_size.x = 10
	hbox.add_child(active_marker)

	var name_label := Label.new()
	name_label.text = data.unit_name
	name_label.add_theme_font_size_override("font_size", 13)
	name_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.clip_text = true
	hbox.add_child(name_label)

	var lv_label := Label.new()
	lv_label.text = "Lv%d" % data.level
	lv_label.add_theme_font_size_override("font_size", 11)
	lv_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
	hbox.add_child(lv_label)

	# Row 2: HP ProgressBar with HP value label beside it
	var hp_row := HBoxContainer.new()
	hp_row.add_theme_constant_override("separation", 4)
	vbox.add_child(hp_row)

	var hp_bar := ProgressBar.new()
	hp_bar.custom_minimum_size = Vector2(90, 6)
	hp_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hp_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	hp_bar.max_value = data.max_hp
	hp_bar.value = data.current_hp
	hp_bar.show_percentage = false
	hp_bar.add_theme_font_size_override("font_size", 1)
	_apply_hp_bar_style(hp_bar, data.current_hp, data.max_hp)
	hp_row.add_child(hp_bar)

	var hp_label := Label.new()
	hp_label.text = "%d" % data.current_hp
	hp_label.add_theme_font_size_override("font_size", 11)
	hp_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
	hp_row.add_child(hp_label)

	# Row 3: Weapon label
	var weapon_label := Label.new()
	weapon_label.add_theme_font_size_override("font_size", 11)
	weapon_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
	weapon_label.text = _get_weapon_text(data)
	vbox.add_child(weapon_label)

	# Store references
	_unit_slots[unit_name] = {
		"active_marker": active_marker,
		"name_label": name_label,
		"lv_label": lv_label,
		"hp_bar": hp_bar,
		"hp_label": hp_label,
		"weapon_label": weapon_label,
		"slot": slot,
	}
	_slot_containers[unit_name] = slot

	_vbox.add_child(slot)


func _make_slot_style(is_active: bool) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	if is_active:
		style.bg_color = COLOR_ACTIVE_BG
		style.border_color = COLOR_EMBER
	else:
		style.bg_color = Color(0.05, 0.055, 0.08, 0.0)  # transparent bg
		style.border_color = COLOR_IRON_BORDER
	style.border_width_left = 2
	style.border_width_top = 2
	style.border_width_right = 2
	style.border_width_bottom = 2
	style.corner_radius_top_left = 3
	style.corner_radius_top_right = 3
	style.corner_radius_bottom_left = 3
	style.corner_radius_bottom_right = 3
	style.content_margin_left = 4
	style.content_margin_right = 4
	style.content_margin_top = 4
	style.content_margin_bottom = 4
	return style


func _apply_hp_bar_style(hp_bar: ProgressBar, current_hp: int, max_hp: int) -> void:
	var hp_ratio: float = float(current_hp) / float(max_hp) if max_hp > 0 else 1.0

	var fill_style := StyleBoxFlat.new()
	fill_style.corner_radius_top_left = 2
	fill_style.corner_radius_top_right = 2
	fill_style.corner_radius_bottom_left = 2
	fill_style.corner_radius_bottom_right = 2
	if hp_ratio > 0.5:
		fill_style.bg_color = COLOR_MOSS_GREEN
	elif hp_ratio > 0.25:
		fill_style.bg_color = COLOR_EMBER
	else:
		fill_style.bg_color = COLOR_BLOOD_RED
	hp_bar.add_theme_stylebox_override("fill", fill_style)

	var bg_style := StyleBoxFlat.new()
	bg_style.bg_color = COLOR_HP_BAR_BG
	bg_style.corner_radius_top_left = 2
	bg_style.corner_radius_top_right = 2
	bg_style.corner_radius_bottom_left = 2
	bg_style.corner_radius_bottom_right = 2
	hp_bar.add_theme_stylebox_override("background", bg_style)


func _get_weapon_text(data: UnitData) -> String:
	if data.equipped_weapon and data.equipped_weapon is ItemData:
		var w: ItemData = data.equipped_weapon as ItemData
		var wname: String = w.item_name if w.item_name != "Item" else w.get_weapon_type_name()
		return wname
	return "Unarmed"


## Refresh HP bars and fallen status for all units
func update_units(units: Array) -> void:
	# Build a lookup from unit_name to unit data
	var data_lookup: Dictionary = {}
	for unit in units:
		if not is_instance_valid(unit) or not unit.has_method("get_unit_data"):
			continue
		var data: UnitData = unit.get_unit_data()
		if data and data.is_player_unit:
			data_lookup[data.unit_name] = data

	for unit_name in _unit_slots:
		var refs: Dictionary = _unit_slots[unit_name]
		var slot: PanelContainer = _slot_containers[unit_name]

		if data_lookup.has(unit_name):
			var data: UnitData = data_lookup[unit_name]
			_update_slot_from_data(unit_name, data)
		else:
			# Unit no longer exists in the units array -- mark as fallen
			_mark_slot_fallen(unit_name)


func _update_slot_from_data(unit_name: String, data: UnitData) -> void:
	var refs: Dictionary = _unit_slots[unit_name]
	var slot: PanelContainer = _slot_containers[unit_name]

	if not data.is_alive():
		_mark_slot_fallen(unit_name)
		return

	# Update HP
	var hp_bar: ProgressBar = refs["hp_bar"]
	hp_bar.max_value = data.max_hp
	hp_bar.value = data.current_hp
	_apply_hp_bar_style(hp_bar, data.current_hp, data.max_hp)

	var hp_label: Label = refs["hp_label"]
	hp_label.text = "%d" % data.current_hp

	# Update level
	var lv_label: Label = refs["lv_label"]
	lv_label.text = "Lv%d" % data.level

	# Update weapon
	var weapon_label: Label = refs["weapon_label"]
	weapon_label.text = _get_weapon_text(data)

	# Ensure not in fallen state
	slot.modulate.a = 1.0
	var name_label: Label = refs["name_label"]
	name_label.add_theme_color_override("font_color", COLOR_PARCHMENT)


func _mark_slot_fallen(unit_name: String) -> void:
	if not _unit_slots.has(unit_name):
		return
	var refs: Dictionary = _unit_slots[unit_name]
	var slot: PanelContainer = _slot_containers[unit_name]

	slot.modulate.a = 0.35

	var name_label: Label = refs["name_label"]
	name_label.add_theme_color_override("font_color", COLOR_BLOOD_RED)

	var hp_bar: ProgressBar = refs["hp_bar"]
	hp_bar.value = 0

	var hp_label: Label = refs["hp_label"]
	hp_label.text = "0"

	var weapon_label: Label = refs["weapon_label"]
	weapon_label.text = "Fallen"

	# Hide active marker if this unit was active
	var active_marker: Label = refs["active_marker"]
	active_marker.visible = false

	# Reset to iron border
	slot.add_theme_stylebox_override("panel", _make_slot_style(false))


## Highlight the active unit's slot with ember border and marker
func set_active(unit: Node2D) -> void:
	if not unit or not is_instance_valid(unit) or not unit.has_method("get_unit_data"):
		return
	var data: UnitData = unit.get_unit_data()
	if data == null:
		return

	clear_active()
	_active_unit_name = data.unit_name

	if not _unit_slots.has(_active_unit_name):
		return

	var refs: Dictionary = _unit_slots[_active_unit_name]
	var slot: PanelContainer = _slot_containers[_active_unit_name]

	# Show active marker
	var active_marker: Label = refs["active_marker"]
	active_marker.visible = true

	# Apply ember border style
	slot.add_theme_stylebox_override("panel", _make_slot_style(true))


## Remove all active indicators
func clear_active() -> void:
	if _active_unit_name != "" and _unit_slots.has(_active_unit_name):
		var refs: Dictionary = _unit_slots[_active_unit_name]
		var slot: PanelContainer = _slot_containers[_active_unit_name]

		var active_marker: Label = refs["active_marker"]
		active_marker.visible = false

		# Only reset style if not fallen
		if slot.modulate.a > 0.5:
			slot.add_theme_stylebox_override("panel", _make_slot_style(false))

	_active_unit_name = ""
