class_name StatCheckDisplay
extends CanvasLayer
## StatCheckDisplay - UI for stat check events during dialogue.
## Shows the stat being checked, difficulty, and each party member's chances.
## Player selects a unit, roll is animated, result determines dialogue branch.

# --- Signals ---
signal check_completed(success: bool)

# --- Color Palette (from UIColors) ---
const COLOR_PANEL_BG := UIColors.COLOR_PANEL_BG
const COLOR_EMBER := UIColors.COLOR_EMBER
const COLOR_IRON_BORDER := UIColors.COLOR_IRON_BORDER
const COLOR_PARCHMENT := UIColors.COLOR_PARCHMENT
const COLOR_WORN_STONE := UIColors.COLOR_WORN_STONE
const COLOR_MOSS_GREEN := UIColors.COLOR_MOSS_GREEN
const COLOR_BLOOD_RED := UIColors.COLOR_BLOOD_RED
const COLOR_CHOICE_BG := UIColors.COLOR_CHOICE_BG

# --- State ---
var _stat_name: String = ""
var _difficulty: int = 0
var _party: Array = []
var _result_shown: bool = false

# --- Node References ---
var _panel: PanelContainer
var _header_label: Label
var _instruction_label: Label
var _units_container: VBoxContainer
var _result_label: Label
var _continue_button: Button


func _ready() -> void:
	layer = 21  # Above dialogue box


## Build UI and populate with party unit options
func setup(stat_name: String, difficulty: int, party: Array) -> void:
	_stat_name = stat_name
	_difficulty = difficulty
	_party = party
	_build_ui()
	_populate_units()


func _build_ui() -> void:
	# --- Background dimmer ---
	var dimmer := ColorRect.new()
	dimmer.color = Color(0.0, 0.0, 0.0, 0.4)
	dimmer.anchor_left = 0.0
	dimmer.anchor_right = 1.0
	dimmer.anchor_top = 0.0
	dimmer.anchor_bottom = 1.0
	dimmer.mouse_filter = Control.MOUSE_FILTER_STOP  # Block clicks behind
	add_child(dimmer)

	# --- Panel Container (centered) ---
	_panel = PanelContainer.new()
	_panel.name = "StatCheckPanel"

	# Center the panel
	_panel.anchor_left = 0.5
	_panel.anchor_right = 0.5
	_panel.anchor_top = 0.5
	_panel.anchor_bottom = 0.5
	_panel.offset_left = -200
	_panel.offset_right = 200
	_panel.offset_top = -175
	_panel.offset_bottom = 175

	# Style
	var panel_style := StyleBoxFlat.new()
	panel_style.bg_color = COLOR_PANEL_BG
	panel_style.border_color = COLOR_EMBER
	panel_style.border_width_top = 2
	panel_style.border_width_bottom = 2
	panel_style.border_width_left = 2
	panel_style.border_width_right = 2
	panel_style.corner_radius_top_left = 4
	panel_style.corner_radius_top_right = 4
	panel_style.corner_radius_bottom_left = 4
	panel_style.corner_radius_bottom_right = 4
	_panel.add_theme_stylebox_override("panel", panel_style)
	add_child(_panel)

	# --- Margin ---
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_bottom", 12)
	_panel.add_child(margin)

	# --- VBoxContainer ---
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 8)
	margin.add_child(vbox)

	# --- Header ---
	_header_label = Label.new()
	_header_label.add_theme_font_size_override("font_size", 16)
	_header_label.add_theme_color_override("font_color", COLOR_EMBER)
	_header_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_header_label.text = "%s CHECK (DC %d)" % [_stat_name.to_upper(), _difficulty]
	vbox.add_child(_header_label)

	# --- Separator ---
	var sep1 := HSeparator.new()
	sep1.add_theme_stylebox_override("separator", _make_separator_style())
	vbox.add_child(sep1)

	# --- Instruction ---
	_instruction_label = Label.new()
	_instruction_label.text = "Select a unit:"
	_instruction_label.add_theme_font_size_override("font_size", 12)
	_instruction_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
	vbox.add_child(_instruction_label)

	# --- Units Container ---
	_units_container = VBoxContainer.new()
	_units_container.name = "UnitsContainer"
	_units_container.add_theme_constant_override("separation", 4)
	vbox.add_child(_units_container)

	# --- Separator ---
	var sep2 := HSeparator.new()
	sep2.add_theme_stylebox_override("separator", _make_separator_style())
	vbox.add_child(sep2)

	# --- Result Label (hidden until roll) ---
	_result_label = Label.new()
	_result_label.name = "ResultLabel"
	_result_label.add_theme_font_size_override("font_size", 14)
	_result_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_result_label.autowrap_mode = TextServer.AUTOWRAP_WORD
	_result_label.visible = false
	vbox.add_child(_result_label)

	# --- Continue Button (hidden until roll complete) ---
	_continue_button = Button.new()
	_continue_button.text = "Continue"
	_continue_button.add_theme_font_size_override("font_size", 13)
	_continue_button.add_theme_color_override("font_color", COLOR_PARCHMENT)
	_continue_button.add_theme_color_override("font_hover_color", COLOR_EMBER)
	_continue_button.visible = false

	var btn_style := StyleBoxFlat.new()
	btn_style.bg_color = COLOR_CHOICE_BG
	btn_style.border_color = COLOR_IRON_BORDER
	btn_style.border_width_top = 1
	btn_style.border_width_bottom = 1
	btn_style.border_width_left = 1
	btn_style.border_width_right = 1
	btn_style.corner_radius_top_left = 2
	btn_style.corner_radius_top_right = 2
	btn_style.corner_radius_bottom_left = 2
	btn_style.corner_radius_bottom_right = 2
	btn_style.content_margin_top = 4
	btn_style.content_margin_bottom = 4
	_continue_button.add_theme_stylebox_override("normal", btn_style)

	var btn_hover := btn_style.duplicate()
	btn_hover.border_color = COLOR_EMBER
	_continue_button.add_theme_stylebox_override("hover", btn_hover)

	_continue_button.pressed.connect(_on_continue_pressed)
	vbox.add_child(_continue_button)


func _make_separator_style() -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = COLOR_IRON_BORDER
	style.content_margin_top = 1
	style.content_margin_bottom = 1
	return style


func _populate_units() -> void:
	for i in range(_party.size()):
		var unit: Resource = _party[i]
		if not unit.is_alive():
			continue

		var stat_value: int = _get_stat_value(unit, _stat_name)
		var luck_value: int = unit.luck
		var chance: int = _calculate_chance(stat_value, luck_value, _difficulty)

		# Format: "[Roy]  STR 6  -  55% chance"
		var stat_abbrev: String = _stat_name.to_upper().left(3)
		var btn_text: String = "[%s]  %s %d  -  %d%% chance" % [
			unit.unit_name, stat_abbrev, stat_value, chance
		]

		var btn := Button.new()
		btn.text = btn_text
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		btn.add_theme_font_size_override("font_size", 13)

		# Color-code the button text based on chance
		if chance > 60:
			btn.add_theme_color_override("font_color", COLOR_MOSS_GREEN)
			btn.add_theme_color_override("font_hover_color", COLOR_MOSS_GREEN)
		elif chance >= 30:
			btn.add_theme_color_override("font_color", COLOR_EMBER)
			btn.add_theme_color_override("font_hover_color", COLOR_EMBER)
		else:
			btn.add_theme_color_override("font_color", COLOR_BLOOD_RED)
			btn.add_theme_color_override("font_hover_color", COLOR_BLOOD_RED)

		# Button style
		var normal_style := StyleBoxFlat.new()
		normal_style.bg_color = COLOR_CHOICE_BG
		normal_style.border_color = COLOR_IRON_BORDER
		normal_style.border_width_top = 1
		normal_style.border_width_bottom = 1
		normal_style.border_width_left = 1
		normal_style.border_width_right = 1
		normal_style.content_margin_left = 6
		normal_style.content_margin_top = 4
		normal_style.content_margin_bottom = 4
		normal_style.corner_radius_top_left = 2
		normal_style.corner_radius_top_right = 2
		normal_style.corner_radius_bottom_left = 2
		normal_style.corner_radius_bottom_right = 2
		btn.add_theme_stylebox_override("normal", normal_style)

		var hover_style := normal_style.duplicate()
		hover_style.border_color = COLOR_EMBER
		btn.add_theme_stylebox_override("hover", hover_style)

		var pressed_style := normal_style.duplicate()
		pressed_style.bg_color = Color(0.1, 0.1, 0.14, 0.95)
		pressed_style.border_color = COLOR_EMBER
		btn.add_theme_stylebox_override("pressed", pressed_style)

		var idx := i
		btn.pressed.connect(func() -> void: _on_unit_selected(idx))
		_units_container.add_child(btn)


# =============================================================================
# Stat Helpers
# =============================================================================

func _get_stat_value(unit: Resource, stat_name: String) -> int:
	match stat_name.to_lower():
		"strength", "str":
			return unit.strength
		"magic", "mag":
			return unit.magic
		"skill", "skl":
			return unit.skill
		"speed", "spd":
			return unit.speed
		"luck", "lck":
			return unit.luck
		"defense", "def":
			return unit.defense
		"resistance", "res":
			return unit.resistance
	return 0


func _calculate_chance(stat_value: int, luck_value: int, difficulty: int) -> int:
	# Roll range: stat*2 + luck + [0..19]
	var min_roll: int = stat_value * 2 + luck_value
	var max_roll: int = min_roll + 19
	if min_roll >= difficulty:
		return 100
	if max_roll < difficulty:
		return 0
	return int(float(max_roll - difficulty + 1) / 20.0 * 100)


# =============================================================================
# Unit Selection & Roll
# =============================================================================

func _on_unit_selected(unit_index: int) -> void:
	if _result_shown:
		return

	_result_shown = true

	var unit: Resource = _party[unit_index]
	var stat_value: int = _get_stat_value(unit, _stat_name)
	var luck_value: int = unit.luck
	var roll: int = stat_value * 2 + luck_value + randi_range(0, 19)
	var success: bool = roll >= _difficulty

	# Disable all unit buttons
	for child in _units_container.get_children():
		if child is Button:
			child.disabled = true

	# Show result
	_result_label.visible = true
	if success:
		_result_label.text = "%s: %d vs %d - SUCCESS!" % [unit.unit_name, roll, _difficulty]
		_result_label.add_theme_color_override("font_color", COLOR_MOSS_GREEN)
	else:
		_result_label.text = "%s: %d vs %d - FAILED!" % [unit.unit_name, roll, _difficulty]
		_result_label.add_theme_color_override("font_color", COLOR_BLOOD_RED)

	# Show continue button
	_continue_button.visible = true

	# Store result for continue callback
	_continue_button.set_meta("success", success)


func _on_continue_pressed() -> void:
	var success: bool = _continue_button.get_meta("success", false)
	check_completed.emit(success)


# =============================================================================
# Input blocking
# =============================================================================

func _input(event: InputEvent) -> void:
	# Consume all input while stat check is showing to prevent dialogue from advancing
	if event is InputEventMouseButton or event is InputEventKey:
		get_viewport().set_input_as_handled()
