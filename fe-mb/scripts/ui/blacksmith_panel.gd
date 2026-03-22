class_name BlacksmithPanel
extends VBoxContainer
## BlacksmithPanel - Weapon sharpening / honing interface.
## Lists party weapons with sharpness tier, offers "Sharpen All" for a gold cost.

signal gold_changed

# --- Palette (from UIColors) ---
const COLOR_PANEL_BG := UIColors.COLOR_PANEL_BG
const COLOR_IRON_BORDER := UIColors.COLOR_IRON_BORDER
const COLOR_EMBER := UIColors.COLOR_EMBER
const COLOR_PARCHMENT := UIColors.COLOR_PARCHMENT
const COLOR_WORN_STONE := UIColors.COLOR_WORN_STONE
const COLOR_MOSS := UIColors.COLOR_MOSS
const COLOR_BLOOD := UIColors.COLOR_BLOOD

# --- Config ---
var _sharpen_cost_per_weapon: int = 15

# --- State ---
var _sharpen_btn: Button
var _gold_label: Label


func _ready() -> void:
	add_theme_constant_override("separation", 10)


func setup(config: Dictionary) -> void:
	_sharpen_cost_per_weapon = config.get("sharpen_cost_per_weapon", 15)
	_build_ui()


# ============================================================
# UI Construction
# ============================================================

func _build_ui() -> void:
	# Clear any previous children
	for child in get_children():
		child.queue_free()

	# Description
	var desc := Label.new()
	desc.text = "A skilled smith can sharpen and hone your weapons before battle. Sharp weapons deal more damage; dull weapons are a liability."
	desc.add_theme_font_size_override("font_size", 13)
	desc.add_theme_color_override("font_color", COLOR_WORN_STONE)
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD
	add_child(desc)

	var sep := ColorRect.new()
	sep.custom_minimum_size = Vector2(0, 1)
	sep.color = Color(COLOR_IRON_BORDER, 0.4)
	add_child(sep)

	# Weapon list
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)

	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 6)
	scroll.add_child(list)

	var weapon_count := 0
	for unit in GameManager.party:
		if not unit.is_alive():
			continue
		var weapon: Resource = unit.get("equipped_weapon")
		if weapon == null:
			continue
		if weapon.get("item_type") != ItemData.ItemType.WEAPON:
			continue
		weapon_count += 1
		_build_weapon_row(list, unit, weapon)

	if weapon_count == 0:
		var empty := Label.new()
		empty.text = "No party members have equipped weapons."
		empty.add_theme_font_size_override("font_size", 14)
		empty.add_theme_color_override("font_color", COLOR_WORN_STONE)
		list.add_child(empty)

	# Bottom separator
	var sep2 := ColorRect.new()
	sep2.custom_minimum_size = Vector2(0, 1)
	sep2.color = Color(COLOR_IRON_BORDER, 0.3)
	add_child(sep2)

	# Sharpen All row
	var bottom_row := HBoxContainer.new()
	bottom_row.add_theme_constant_override("separation", 16)
	bottom_row.alignment = BoxContainer.ALIGNMENT_END
	add_child(bottom_row)

	# Gold display
	var gold_hbox := HBoxContainer.new()
	gold_hbox.add_theme_constant_override("separation", 4)
	gold_hbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bottom_row.add_child(gold_hbox)

	var gold_icon := Label.new()
	gold_icon.text = "Gold:"
	gold_icon.add_theme_font_size_override("font_size", 14)
	gold_icon.add_theme_color_override("font_color", COLOR_EMBER)
	gold_hbox.add_child(gold_icon)

	_gold_label = Label.new()
	_gold_label.add_theme_font_size_override("font_size", 14)
	_gold_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
	gold_hbox.add_child(_gold_label)

	# Sharpen All button
	_sharpen_btn = _make_action_button("")
	_sharpen_btn.pressed.connect(_on_sharpen_all_pressed)
	bottom_row.add_child(_sharpen_btn)

	_refresh_sharpen_button()


func _build_weapon_row(parent: VBoxContainer, unit: Resource, weapon: Resource) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	parent.add_child(row)

	# Row background panel
	var row_panel := PanelContainer.new()
	row_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	var row_style := StyleBoxFlat.new()
	row_style.bg_color = UIColors.COLOR_ROW_BG
	row_style.set_border_width_all(0)
	row_style.border_width_left = 3
	row_style.border_color = _get_sharpness_color(weapon)
	row_style.set_corner_radius_all(2)
	row_style.content_margin_left = 10
	row_style.content_margin_right = 10
	row_style.content_margin_top = 6
	row_style.content_margin_bottom = 6
	row_panel.add_theme_stylebox_override("panel", row_style)
	parent.add_child(row_panel)

	var row_hbox := HBoxContainer.new()
	row_hbox.add_theme_constant_override("separation", 10)
	row_panel.add_child(row_hbox)

	# Unit name
	var unit_lbl := Label.new()
	unit_lbl.text = unit.unit_name
	unit_lbl.custom_minimum_size = Vector2(90, 0)
	unit_lbl.add_theme_font_size_override("font_size", 14)
	unit_lbl.add_theme_color_override("font_color", COLOR_PARCHMENT)
	row_hbox.add_child(unit_lbl)

	# Weapon name
	var weap_lbl := Label.new()
	weap_lbl.text = weapon.item_name
	weap_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	weap_lbl.add_theme_font_size_override("font_size", 14)
	weap_lbl.add_theme_color_override("font_color", COLOR_PARCHMENT)
	row_hbox.add_child(weap_lbl)

	# Sharpness tier label
	var sharp_lbl := Label.new()
	sharp_lbl.text = _get_sharpness_text(weapon)
	sharp_lbl.custom_minimum_size = Vector2(90, 0)
	sharp_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	sharp_lbl.add_theme_font_size_override("font_size", 13)
	sharp_lbl.add_theme_color_override("font_color", _get_sharpness_color(weapon))
	row_hbox.add_child(sharp_lbl)


# ============================================================
# Sharpness Helpers
# ============================================================

func _get_sharpness_text(weapon: Resource) -> String:
	var s = weapon.sharpness
	var base: String
	match s:
		ItemData.Sharpness.SHARP: base = "Sharp"
		ItemData.Sharpness.NORMAL: base = "Normal"
		ItemData.Sharpness.DULL: base = "Dull"
		_: base = "Unknown"
	if weapon.is_honed:
		base += " [Honed]"
	return base


func _get_sharpness_color(weapon: Resource) -> Color:
	match weapon.sharpness:
		ItemData.Sharpness.SHARP: return Color(0.85, 0.85, 0.9)  # Near-white (bright)
		ItemData.Sharpness.NORMAL: return COLOR_EMBER              # Amber
		ItemData.Sharpness.DULL: return COLOR_BLOOD                # Red
		_: return COLOR_WORN_STONE


func _count_sharpenable_weapons() -> int:
	## Returns the number of equipped weapons that are NOT already Sharp+Honed.
	var count := 0
	for unit in GameManager.party:
		if not unit.is_alive():
			continue
		var weapon: Resource = unit.get("equipped_weapon")
		if weapon == null:
			continue
		if weapon.get("item_type") != ItemData.ItemType.WEAPON:
			continue
		if not (weapon.sharpness == ItemData.Sharpness.SHARP and weapon.is_honed):
			count += 1
	return count


func _refresh_sharpen_button() -> void:
	if _sharpen_btn == null or _gold_label == null:
		return

	_gold_label.text = str(GameManager.gold)

	var sharpenable := _count_sharpenable_weapons()
	var total_cost := sharpenable * _sharpen_cost_per_weapon

	if sharpenable == 0:
		_sharpen_btn.text = "All Weapons Sharp & Honed"
		_sharpen_btn.disabled = true
	else:
		_sharpen_btn.text = "Sharpen All  —  %dg" % total_cost
		_sharpen_btn.disabled = GameManager.gold < total_cost


# ============================================================
# Actions
# ============================================================

func _on_sharpen_all_pressed() -> void:
	var sharpenable := _count_sharpenable_weapons()
	if sharpenable == 0:
		return

	var total_cost := sharpenable * _sharpen_cost_per_weapon
	if not GameManager.spend_gold(total_cost):
		EventBus.show_notification.emit("Not enough gold!")
		return

	var count := 0
	for unit in GameManager.party:
		if not unit.is_alive():
			continue
		var weapon: Resource = unit.get("equipped_weapon")
		if weapon == null:
			continue
		if weapon.get("item_type") != ItemData.ItemType.WEAPON:
			continue
		if not (weapon.sharpness == ItemData.Sharpness.SHARP and weapon.is_honed):
			weapon.apply_honing()
			count += 1

	EventBus.show_notification.emit("Sharpened and honed %d weapon%s." % [count, "s" if count != 1 else ""])
	gold_changed.emit()

	# Rebuild UI to reflect updated sharpness state
	_build_ui()


# ============================================================
# Styling Helpers
# ============================================================

func _make_action_button(text: String) -> Button:
	var btn := Button.new()
	btn.text = text
	btn.custom_minimum_size = Vector2(180, 36)
	btn.add_theme_font_size_override("font_size", 14)
	btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
	btn.add_theme_color_override("font_hover_color", COLOR_EMBER)
	btn.add_theme_color_override("font_disabled_color", Color(COLOR_WORN_STONE, 0.4))

	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(0.06, 0.065, 0.09, 0.95)
	normal.border_color = COLOR_IRON_BORDER
	normal.set_border_width_all(1)
	normal.set_corner_radius_all(3)
	normal.content_margin_left = 10
	normal.content_margin_right = 10
	normal.content_margin_top = 6
	normal.content_margin_bottom = 6
	btn.add_theme_stylebox_override("normal", normal)

	var hover := normal.duplicate()
	hover.border_color = COLOR_EMBER
	btn.add_theme_stylebox_override("hover", hover)

	var pressed := normal.duplicate()
	pressed.bg_color = Color(0.1, 0.09, 0.07, 0.95)
	pressed.border_color = COLOR_EMBER
	btn.add_theme_stylebox_override("pressed", pressed)

	var disabled := normal.duplicate()
	disabled.bg_color = Color(0.04, 0.04, 0.06, 0.7)
	disabled.border_color = Color(COLOR_IRON_BORDER, 0.3)
	btn.add_theme_stylebox_override("disabled", disabled)

	return btn
