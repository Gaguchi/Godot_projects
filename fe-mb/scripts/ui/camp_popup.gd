class_name CampPopup
extends CanvasLayer
## CampPopup - Simple rest confirmation popup shown at CAMP locations.
## Uses 1 food to heal 20% HP, or continue without resting.

signal popup_closed

# --- Stone & Steel Palette ---
const COLOR_PANEL_BG := Color(0.05, 0.055, 0.08, 0.95)
const COLOR_IRON_BORDER := Color(0.227, 0.239, 0.282)
const COLOR_EMBER := Color(0.69, 0.44, 0.25)
const COLOR_PARCHMENT := Color(0.832, 0.812, 0.761)
const COLOR_WORN_STONE := Color(0.478, 0.463, 0.439)
const COLOR_MOSS := Color(0.353, 0.541, 0.353)
const COLOR_OVERLAY := Color(0, 0, 0, 0.6)

var _bg: ColorRect
var _panel: PanelContainer
var _title_label: Label
var _desc_label: Label
var _rest_btn: Button
var _continue_btn: Button
var _camp_name: String = ""


func _ready() -> void:
	layer = 30
	_build_ui()


func open(camp_name: String) -> void:
	_camp_name = camp_name
	_title_label.text = camp_name

	if GameManager.food >= 1:
		_desc_label.text = "Rest here to heal the party.\nUses 1 food to restore 20%% HP."
		_desc_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
		_rest_btn.disabled = false
		_rest_btn.text = "Rest"
	else:
		_desc_label.text = "No food remaining.\nThe party cannot rest."
		_desc_label.add_theme_color_override("font_color", Color(0.769, 0.267, 0.267))
		_rest_btn.disabled = true
		_rest_btn.text = "Rest (No Food)"


func _build_ui() -> void:
	# Full-screen dim overlay
	_bg = ColorRect.new()
	_bg.color = COLOR_OVERLAY
	_bg.anchor_right = 1.0
	_bg.anchor_bottom = 1.0
	add_child(_bg)

	# Centered panel
	_panel = PanelContainer.new()
	_panel.custom_minimum_size = Vector2(340, 200)
	_panel.anchor_left = 0.5
	_panel.anchor_top = 0.5
	_panel.anchor_right = 0.5
	_panel.anchor_bottom = 0.5
	_panel.offset_left = -170
	_panel.offset_top = -100
	_panel.offset_right = 170
	_panel.offset_bottom = 100

	var style := StyleBoxFlat.new()
	style.bg_color = COLOR_PANEL_BG
	style.border_color = COLOR_IRON_BORDER
	style.border_width_top = 2
	style.border_width_bottom = 2
	style.border_width_left = 2
	style.border_width_right = 2
	style.corner_radius_top_left = 4
	style.corner_radius_top_right = 4
	style.corner_radius_bottom_left = 4
	style.corner_radius_bottom_right = 4
	style.content_margin_left = 20
	style.content_margin_right = 20
	style.content_margin_top = 16
	style.content_margin_bottom = 16
	_panel.add_theme_stylebox_override("panel", style)
	add_child(_panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 12)
	_panel.add_child(vbox)

	# Title
	_title_label = Label.new()
	_title_label.add_theme_font_size_override("font_size", 20)
	_title_label.add_theme_color_override("font_color", COLOR_EMBER)
	_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(_title_label)

	# Separator
	var sep := ColorRect.new()
	sep.custom_minimum_size = Vector2(0, 1)
	sep.color = Color(COLOR_IRON_BORDER, 0.5)
	vbox.add_child(sep)

	# Description
	_desc_label = Label.new()
	_desc_label.add_theme_font_size_override("font_size", 14)
	_desc_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
	_desc_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_desc_label.autowrap_mode = TextServer.AUTOWRAP_WORD
	vbox.add_child(_desc_label)

	# Spacer
	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(spacer)

	# Buttons
	var btn_row := HBoxContainer.new()
	btn_row.add_theme_constant_override("separation", 12)
	btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
	vbox.add_child(btn_row)

	_rest_btn = _create_button("Rest", COLOR_MOSS)
	_rest_btn.pressed.connect(_on_rest_pressed)
	btn_row.add_child(_rest_btn)

	_continue_btn = _create_button("Continue", COLOR_WORN_STONE)
	_continue_btn.pressed.connect(_on_continue_pressed)
	btn_row.add_child(_continue_btn)


func _create_button(text: String, accent: Color) -> Button:
	var btn := Button.new()
	btn.text = text
	btn.custom_minimum_size = Vector2(120, 40)
	btn.add_theme_font_size_override("font_size", 15)
	btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
	btn.add_theme_color_override("font_hover_color", accent)
	btn.add_theme_color_override("font_disabled_color", Color(COLOR_WORN_STONE, 0.4))

	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(0.08, 0.085, 0.11, 0.95)
	normal.border_color = COLOR_IRON_BORDER
	normal.set_border_width_all(1)
	normal.set_corner_radius_all(3)
	normal.content_margin_left = 8
	normal.content_margin_right = 8
	normal.content_margin_top = 6
	normal.content_margin_bottom = 6
	btn.add_theme_stylebox_override("normal", normal)

	var hover := normal.duplicate()
	hover.border_color = accent
	btn.add_theme_stylebox_override("hover", hover)

	var pressed := normal.duplicate()
	pressed.border_color = accent
	pressed.bg_color = Color(0.1, 0.1, 0.14, 0.95)
	btn.add_theme_stylebox_override("pressed", pressed)

	var disabled := normal.duplicate()
	disabled.bg_color = Color(0.04, 0.04, 0.06, 0.7)
	disabled.border_color = Color(COLOR_IRON_BORDER, 0.3)
	btn.add_theme_stylebox_override("disabled", disabled)

	return btn


func _on_rest_pressed() -> void:
	if GameManager.food >= 1:
		GameManager.consume_food(1)
		GameManager.rest_party(0.2)
		EventBus.show_notification.emit("Rested at %s. Party healed 20%%." % _camp_name)
	_close()


func _on_continue_pressed() -> void:
	_close()


func _close() -> void:
	popup_closed.emit()


func _input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		_close()
		get_viewport().set_input_as_handled()
