class_name UIFactory
extends RefCounted
## UIFactory - Shared Stone & Steel UI helpers and palette constants.
## Used across party_screen, inventory_screen, and other menus.

# ---- Stone & Steel Palette ----
const COLOR_PANEL_BG := Color(0.05, 0.055, 0.08, 0.95)
const COLOR_IRON_BORDER := Color(0.227, 0.239, 0.282)
const COLOR_EMBER := Color(0.69, 0.44, 0.25)
const COLOR_PARCHMENT := Color(0.832, 0.812, 0.761)
const COLOR_WORN_STONE := Color(0.478, 0.463, 0.439)
const COLOR_MOSS := Color(0.353, 0.541, 0.353)
const COLOR_BLOOD := Color(0.769, 0.267, 0.267)
const COLOR_ROW_BG := Color(0.06, 0.065, 0.09, 0.9)
const COLOR_ROW_HOVER := Color(0.08, 0.085, 0.11, 0.95)
const COLOR_ROW_SELECTED := Color(0.1, 0.09, 0.07, 0.95)
const COLOR_BAR_BG := Color(0.15, 0.15, 0.15)

# ---- Class Colors & Initials ----
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

const WEAPON_SHORT := {
	ItemData.WeaponType.SWORD: "[S]",
	ItemData.WeaponType.LANCE: "[L]",
	ItemData.WeaponType.AXE: "[A]",
	ItemData.WeaponType.BOW: "[B]",
	ItemData.WeaponType.TOME: "[T]",
	ItemData.WeaponType.STAFF: "[+]",
	ItemData.WeaponType.NONE: "[-]",
}


## Create a new styled Button
static func create_styled_button(text: String, accent: Color = COLOR_EMBER, min_size: Vector2 = Vector2(120, 40)) -> Button:
	var btn := Button.new()
	btn.text = text
	btn.custom_minimum_size = min_size
	style_button(btn, accent)
	return btn


## Apply Stone & Steel styling to an existing Button
static func style_button(btn: Button, accent: Color = COLOR_EMBER) -> void:
	var normal := StyleBoxFlat.new()
	normal.bg_color = COLOR_ROW_BG
	normal.border_color = COLOR_IRON_BORDER
	normal.set_border_width_all(1)
	normal.set_corner_radius_all(3)
	normal.set_content_margin_all(8)
	btn.add_theme_stylebox_override("normal", normal)

	var hover := StyleBoxFlat.new()
	hover.bg_color = COLOR_ROW_HOVER
	hover.border_color = accent
	hover.set_border_width_all(1)
	hover.set_corner_radius_all(3)
	hover.set_content_margin_all(8)
	btn.add_theme_stylebox_override("hover", hover)

	var pressed := StyleBoxFlat.new()
	pressed.bg_color = Color(accent.r * 0.3, accent.g * 0.3, accent.b * 0.3, 0.95)
	pressed.border_color = accent
	pressed.set_border_width_all(1)
	pressed.set_corner_radius_all(3)
	pressed.set_content_margin_all(8)
	btn.add_theme_stylebox_override("pressed", pressed)

	var disabled := StyleBoxFlat.new()
	disabled.bg_color = Color(0.05, 0.05, 0.06, 0.7)
	disabled.border_color = Color(0.15, 0.15, 0.17)
	disabled.set_border_width_all(1)
	disabled.set_corner_radius_all(3)
	disabled.set_content_margin_all(8)
	btn.add_theme_stylebox_override("disabled", disabled)

	btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
	btn.add_theme_color_override("font_hover_color", accent)
	btn.add_theme_color_override("font_pressed_color", COLOR_PARCHMENT)
	btn.add_theme_color_override("font_disabled_color", Color(0.35, 0.35, 0.35))


## Create an ember-colored section header
static func create_section_header(text: String) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", 15)
	label.add_theme_color_override("font_color", COLOR_EMBER)
	label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	label.add_theme_constant_override("shadow_offset_x", 1)
	label.add_theme_constant_override("shadow_offset_y", 1)
	return label


## Create a 1px iron-colored separator line
static func create_separator() -> ColorRect:
	var sep := ColorRect.new()
	sep.color = COLOR_IRON_BORDER
	sep.custom_minimum_size = Vector2(0, 1)
	return sep


## Create a class-colored circle panel with initial letter
static func create_class_circle(unit_class: UnitData.UnitClass, circle_size: float = 36.0) -> Panel:
	var panel := Panel.new()
	panel.custom_minimum_size = Vector2(circle_size, circle_size)

	var style := StyleBoxFlat.new()
	style.bg_color = CLASS_COLORS.get(unit_class, COLOR_IRON_BORDER)
	style.set_corner_radius_all(int(circle_size / 2.0))
	panel.add_theme_stylebox_override("panel", style)

	var initial := Label.new()
	initial.text = CLASS_INITIALS.get(unit_class, "?")
	initial.add_theme_font_size_override("font_size", int(circle_size * 0.45))
	initial.add_theme_color_override("font_color", Color.WHITE)
	initial.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	initial.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	initial.anchors_preset = Control.PRESET_FULL_RECT
	initial.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(initial)

	return panel


## Create a stat name + value pair
static func create_stat_pair(stat_name: String, value: int, name_width: float = 32.0) -> HBoxContainer:
	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 4)

	var nlabel := Label.new()
	nlabel.text = stat_name
	nlabel.custom_minimum_size = Vector2(name_width, 0)
	nlabel.add_theme_font_size_override("font_size", 12)
	nlabel.add_theme_color_override("font_color", COLOR_WORN_STONE)
	hbox.add_child(nlabel)

	var vlabel := Label.new()
	vlabel.text = str(value)
	vlabel.name = "Value"
	vlabel.add_theme_font_size_override("font_size", 16)
	vlabel.add_theme_color_override("font_color", COLOR_PARCHMENT)
	hbox.add_child(vlabel)

	return hbox


## Get HP color based on current/max ratio
static func get_hp_color(current: int, maximum: int) -> Color:
	if maximum <= 0:
		return COLOR_BLOOD
	var ratio := float(current) / float(maximum)
	if ratio > 0.5:
		return COLOR_MOSS
	elif ratio > 0.25:
		return COLOR_EMBER
	else:
		return COLOR_BLOOD


## Style a ProgressBar with custom fill color
static func style_progress_bar(bar: ProgressBar, fill_color: Color) -> void:
	var bg := StyleBoxFlat.new()
	bg.bg_color = COLOR_BAR_BG
	bg.set_corner_radius_all(2)
	bar.add_theme_stylebox_override("background", bg)

	var fill := StyleBoxFlat.new()
	fill.bg_color = fill_color
	fill.set_corner_radius_all(2)
	bar.add_theme_stylebox_override("fill", fill)


## Create row styleboxes {normal, hover, selected}
static func create_row_styleboxes() -> Dictionary:
	var normal := StyleBoxFlat.new()
	normal.bg_color = COLOR_ROW_BG
	normal.border_color = Color(0, 0, 0, 0)
	normal.set_border_width_all(1)
	normal.border_width_left = 3
	normal.set_corner_radius_all(2)
	normal.set_content_margin_all(8)

	var hover := StyleBoxFlat.new()
	hover.bg_color = COLOR_ROW_HOVER
	hover.border_color = COLOR_IRON_BORDER
	hover.set_border_width_all(1)
	hover.border_width_left = 3
	hover.set_corner_radius_all(2)
	hover.set_content_margin_all(8)

	var selected := StyleBoxFlat.new()
	selected.bg_color = COLOR_ROW_SELECTED
	selected.border_color = COLOR_EMBER
	selected.set_border_width_all(1)
	selected.border_width_left = 3
	selected.set_corner_radius_all(2)
	selected.set_content_margin_all(8)

	return {"normal": normal, "hover": hover, "selected": selected}


## Create a weapon card PanelContainer with full stat display
static func create_weapon_card(weapon: ItemData) -> PanelContainer:
	var card := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = COLOR_ROW_BG
	style.border_color = COLOR_EMBER
	style.set_border_width_all(1)
	style.border_width_left = 3
	style.set_corner_radius_all(3)
	style.set_content_margin_all(10)
	card.add_theme_stylebox_override("panel", style)

	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 16)

	# Left: name + type
	var left := VBoxContainer.new()
	left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left.add_theme_constant_override("separation", 2)

	var wname := Label.new()
	wname.text = weapon.item_name
	wname.add_theme_font_size_override("font_size", 16)
	wname.add_theme_color_override("font_color", COLOR_PARCHMENT)
	left.add_child(wname)

	var wtype := Label.new()
	wtype.text = weapon.get_weapon_type_name()
	wtype.add_theme_font_size_override("font_size", 12)
	wtype.add_theme_color_override("font_color", COLOR_EMBER)
	left.add_child(wtype)

	hbox.add_child(left)

	# Right: stats
	var right := VBoxContainer.new()
	right.add_theme_constant_override("separation", 2)

	var line1 := Label.new()
	line1.text = "Mt: %d  Hit: %d" % [weapon.might, weapon.hit]
	line1.add_theme_font_size_override("font_size", 12)
	line1.add_theme_color_override("font_color", COLOR_WORN_STONE)
	right.add_child(line1)

	var rng := "%d" % weapon.range_min if weapon.range_min == weapon.range_max else "%d-%d" % [weapon.range_min, weapon.range_max]
	var line2 := Label.new()
	line2.text = "Wt: %d  Rng: %s" % [weapon.weight, rng]
	line2.add_theme_font_size_override("font_size", 12)
	line2.add_theme_color_override("font_color", COLOR_WORN_STONE)
	right.add_child(line2)

	hbox.add_child(right)
	card.add_child(hbox)
	return card
