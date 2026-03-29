class_name CampPopup
extends CanvasLayer
## CampPopup - Camp action popup shown at CAMP locations.
## Offers Rest, Sharpen, Scout, and Leave actions.

signal popup_closed

# --- Stone & Steel Palette (from UIColors) ---
const COLOR_PANEL_BG := UIColors.COLOR_PANEL_BG
const COLOR_IRON_BORDER := UIColors.COLOR_IRON_BORDER
const COLOR_EMBER := UIColors.COLOR_EMBER
const COLOR_PARCHMENT := UIColors.COLOR_PARCHMENT
const COLOR_WORN_STONE := UIColors.COLOR_WORN_STONE
const COLOR_MOSS := UIColors.COLOR_MOSS
const COLOR_OVERLAY := UIColors.COLOR_OVERLAY_LIGHT
const COLOR_SKILL_BLUE := UIColors.COLOR_SKILL_BLUE

var _bg: ColorRect
var _panel: PanelContainer
var _title_label: Label
var _vbox: VBoxContainer
var _rest_btn: Button
var _sharpen_btn: Button
var _scout_btn: Button
var _leave_btn: Button
var _camp_name: String = ""
var _sharpen_selector: VBoxContainer = null


func _ready() -> void:
	layer = 30
	_build_ui()


func open(camp_name: String) -> void:
	_camp_name = camp_name
	_title_label.text = camp_name

	var has_food: bool = GameManager.food >= 1

	# Rest button
	if has_food:
		_rest_btn.disabled = false
		_rest_btn.text = "Rest\nHeal 20% HP (1 food)"
	else:
		_rest_btn.disabled = true
		_rest_btn.text = "Rest\nHeal 20% HP (No food)"

	# Sharpen button — disabled if no food or all weapons already Sharp
	var can_sharpen: bool = has_food and _has_dull_weapons()
	if not has_food:
		_sharpen_btn.disabled = true
		_sharpen_btn.text = "Sharpen\nSharpen a weapon (No food)"
	elif not can_sharpen:
		_sharpen_btn.disabled = true
		_sharpen_btn.text = "Sharpen\nAll weapons are sharp"
	else:
		_sharpen_btn.disabled = false
		_sharpen_btn.text = "Sharpen\nSharpen a weapon (1 food)"

	# Clear any previous sharpen selector
	if _sharpen_selector:
		_sharpen_selector.queue_free()
		_sharpen_selector = null


func _has_dull_weapons() -> bool:
	for unit in GameManager.party:
		if unit.is_alive() and unit.equipped_weapon and unit.equipped_weapon is ItemData:
			if unit.equipped_weapon.sharpness != ItemData.Sharpness.SHARP:
				return true
	return false


func _build_ui() -> void:
	# Full-screen dim overlay
	_bg = ColorRect.new()
	_bg.color = COLOR_OVERLAY
	_bg.anchor_right = 1.0
	_bg.anchor_bottom = 1.0
	add_child(_bg)

	# Centered panel
	_panel = PanelContainer.new()
	_panel.custom_minimum_size = Vector2(340, 260)
	_panel.anchor_left = 0.5
	_panel.anchor_top = 0.5
	_panel.anchor_right = 0.5
	_panel.anchor_bottom = 0.5
	_panel.offset_left = -170
	_panel.offset_top = -130
	_panel.offset_right = 170
	_panel.offset_bottom = 130

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

	_vbox = VBoxContainer.new()
	_vbox.add_theme_constant_override("separation", 10)
	_panel.add_child(_vbox)

	# Title
	_title_label = Label.new()
	_title_label.add_theme_font_size_override("font_size", 20)
	_title_label.add_theme_color_override("font_color", COLOR_EMBER)
	_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_vbox.add_child(_title_label)

	# Separator
	var sep := ColorRect.new()
	sep.custom_minimum_size = Vector2(0, 1)
	sep.color = Color(COLOR_IRON_BORDER, 0.5)
	_vbox.add_child(sep)

	# Action buttons (vertical stack)
	_rest_btn = _create_button("Rest\nHeal 20% HP (1 food)", COLOR_MOSS)
	_rest_btn.pressed.connect(_on_rest_pressed)
	_vbox.add_child(_rest_btn)

	_sharpen_btn = _create_button("Sharpen\nSharpen a weapon (1 food)", COLOR_EMBER)
	_sharpen_btn.pressed.connect(_on_sharpen_pressed)
	_vbox.add_child(_sharpen_btn)

	_scout_btn = _create_button("Scout\nScout the road ahead", COLOR_SKILL_BLUE)
	_scout_btn.pressed.connect(_on_scout_pressed)
	_vbox.add_child(_scout_btn)

	_leave_btn = _create_button("Leave\nContinue journey", COLOR_WORN_STONE)
	_leave_btn.pressed.connect(_on_leave_pressed)
	_vbox.add_child(_leave_btn)


func _create_button(text: String, accent: Color) -> Button:
	var btn := Button.new()
	btn.text = text
	btn.custom_minimum_size = Vector2(300, 44)
	btn.add_theme_font_size_override("font_size", 13)
	btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
	btn.add_theme_color_override("font_hover_color", accent)
	btn.add_theme_color_override("font_disabled_color", Color(COLOR_WORN_STONE, 0.4))
	btn.autowrap_mode = TextServer.AUTOWRAP_WORD

	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(0.08, 0.085, 0.11, 0.95)
	normal.border_color = COLOR_IRON_BORDER
	normal.set_border_width_all(1)
	normal.set_corner_radius_all(3)
	normal.content_margin_left = 10
	normal.content_margin_right = 10
	normal.content_margin_top = 6
	normal.content_margin_bottom = 6
	btn.add_theme_stylebox_override("normal", normal)

	var hover := normal.duplicate()
	hover.border_color = accent
	btn.add_theme_stylebox_override("hover", hover)

	var pressed_style := normal.duplicate()
	pressed_style.border_color = accent
	pressed_style.bg_color = Color(0.1, 0.1, 0.14, 0.95)
	btn.add_theme_stylebox_override("pressed", pressed_style)

	var disabled := normal.duplicate()
	disabled.bg_color = Color(0.04, 0.04, 0.06, 0.7)
	disabled.border_color = Color(COLOR_IRON_BORDER, 0.3)
	btn.add_theme_stylebox_override("disabled", disabled)

	return btn


func _on_rest_pressed() -> void:
	GameManager.consume_food(1)
	GameManager.rest_party(0.2)
	EventBus.show_notification.emit("Rested at %s. Party healed 20%%." % _camp_name)
	_close()


func _on_sharpen_pressed() -> void:
	# Collect units with non-Sharp weapons
	var candidates: Array = []
	for unit in GameManager.party:
		if unit.is_alive() and unit.equipped_weapon and unit.equipped_weapon is ItemData:
			if unit.equipped_weapon.sharpness != ItemData.Sharpness.SHARP:
				candidates.append(unit)
	if candidates.is_empty():
		EventBus.show_notification.emit("All weapons are already sharp!")
		return
	if candidates.size() == 1:
		# Only one candidate — sharpen directly
		GameManager.consume_food(1)
		candidates[0].equipped_weapon.sharpen()
		EventBus.show_notification.emit("%s's %s sharpened!" % [candidates[0].unit_name, candidates[0].equipped_weapon.item_name])
		_close()
	else:
		# Show unit selector for player to choose
		_show_sharpen_selector(candidates)


func _show_sharpen_selector(candidates: Array) -> void:
	if _sharpen_selector:
		_sharpen_selector.queue_free()
	_sharpen_selector = VBoxContainer.new()
	_sharpen_selector.add_theme_constant_override("separation", 6)

	var label := Label.new()
	label.text = "Choose weapon to sharpen:"
	label.add_theme_font_size_override("font_size", 13)
	label.add_theme_color_override("font_color", COLOR_PARCHMENT)
	_sharpen_selector.add_child(label)

	var opt := OptionButton.new()
	opt.add_theme_font_size_override("font_size", 13)
	for unit in candidates:
		var sharp_name: String = ["Sharp", "Normal", "Dull"][unit.equipped_weapon.sharpness]
		opt.add_item("%s — %s (%s)" % [unit.unit_name, unit.equipped_weapon.item_name, sharp_name])
	_sharpen_selector.add_child(opt)
	if opt.item_count > 0:
		opt.select(0)

	var confirm := _create_button("Sharpen", COLOR_EMBER)
	confirm.pressed.connect(func():
		var idx: int = opt.selected
		if idx >= 0 and idx < candidates.size():
			GameManager.consume_food(1)
			candidates[idx].equipped_weapon.sharpen()
			EventBus.show_notification.emit("%s's %s sharpened!" % [candidates[idx].unit_name, candidates[idx].equipped_weapon.item_name])
			_close()
	)
	_sharpen_selector.add_child(confirm)

	# Add selector below the existing buttons
	_vbox.add_child(_sharpen_selector)


func _on_scout_pressed() -> void:
	EventBus.show_notification.emit("Scouted the road ahead. (Coming soon)")
	_close()


func _on_leave_pressed() -> void:
	_close()


func _close() -> void:
	popup_closed.emit()


func _input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		_close()
		get_viewport().set_input_as_handled()
