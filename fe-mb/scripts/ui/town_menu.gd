class_name TownMenu
extends CanvasLayer
## TownMenu - Full-screen Mount & Blade style town interface.
## Left sidebar with building buttons, right panel changes per building.

signal town_closed

# --- Palette ---
const COLOR_PANEL_BG := Color(0.05, 0.055, 0.08, 0.95)
const COLOR_SIDEBAR_BG := Color(0.04, 0.045, 0.065, 0.95)
const COLOR_IRON_BORDER := Color(0.227, 0.239, 0.282)
const COLOR_EMBER := Color(0.69, 0.44, 0.25)
const COLOR_PARCHMENT := Color(0.832, 0.812, 0.761)
const COLOR_WORN_STONE := Color(0.478, 0.463, 0.439)
const COLOR_MOSS := Color(0.353, 0.541, 0.353)
const COLOR_BLOOD := Color(0.769, 0.267, 0.267)
const COLOR_OVERLAY := Color(0, 0, 0, 0.85)

const SIDEBAR_WIDTH := 220
const BUILDING_ORDER := ["inn", "shop", "tavern", "guild", "arena"]
const TAVERN_TIPS := [
	"Longer routes mean more encounter chances — but shortcuts aren't always safe.",
	"The weapon triangle gives +15 hit and +1 damage: Sword beats Axe, Axe beats Lance, Lance beats Sword.",
	"Units with 5 or more speed advantage attack twice. Don't send slow units against fast enemies.",
	"Food is consumed with every hop on the map. Stock up before long journeys.",
	"Capturing enemies with the Subdue command can earn gold bounties at taverns.",
	"Steel weapons hit harder than iron but cost a fair bit more.",
	"Healing staves can keep your units alive mid-battle. Protect your healers.",
	"Camps let you rest and heal using food. Towns cost gold but fully restore health.",
	"Defeated units are gone forever. If a battle turns sour, consider your options carefully.",
	"Magic attacks target Resistance, not Defense. Armored foes often have low Resistance.",
	"Some say there are dungeons hidden in these lands, sealed by ancient wards.",
	"Keep your gold reserves healthy — you never know when you'll need an emergency heal.",
]
const BUILDING_NAMES := {
	"inn": "Inn",
	"shop": "Shop",
	"tavern": "Tavern",
	"guild": "Guild",
	"arena": "Arena"
}

# --- State ---
var _town_name: String = ""
var _town_data: Dictionary = {}
var _selected_building: String = ""
var _building_buttons: Dictionary = {}  # building_key -> Button

# --- UI ---
var _bg: ColorRect
var _main_panel: PanelContainer
var _sidebar: VBoxContainer
var _title_label: Label
var _desc_label: Label
var _content_panel: PanelContainer
var _content_container: VBoxContainer  # Holds the active building panel
var _gold_label: Label
var _food_label: Label

# Building panels (created once, swapped in/out)
var _inn_panel: VBoxContainer
var _shop_panel: ShopPanel
var _tavern_panel: VBoxContainer
var _locked_panel: VBoxContainer


func _ready() -> void:
	layer = 30
	_build_ui()


func open(location_name: String) -> void:
	_town_name = location_name
	_load_town_data(location_name)
	_title_label.text = _town_name
	_desc_label.text = _town_data.get("description", "")
	_update_resource_labels()
	_create_building_buttons()
	# Auto-select first available building
	_select_building("inn")


# ============================================================
# Data Loading
# ============================================================

func _load_town_data(location_name: String) -> void:
	var slug := location_name.to_lower().replace(" ", "_").replace("'", "")
	var path := "res://data/towns/%s.json" % slug

	if not FileAccess.file_exists(path):
		print("[TownMenu] No town data for '%s' at %s, using defaults" % [location_name, path])
		_town_data = _default_town_data(location_name)
		return

	var file := FileAccess.open(path, FileAccess.READ)
	var json := JSON.new()
	json.parse(file.get_as_text())
	file.close()

	if json.data is Dictionary:
		_town_data = json.data
	else:
		_town_data = _default_town_data(location_name)


func _default_town_data(location_name: String) -> Dictionary:
	return {
		"name": location_name,
		"description": "A small settlement.",
		"buildings": {
			"inn": { "heal_cost_per_unit": 10 },
			"shop": { "stock": ["vulnerary", "food_rations"] },
			"tavern": { "rumors": ["Nothing of note to report."] },
			"guild": { "locked": true, "locked_text": "No guild here." },
			"arena": { "locked": true, "locked_text": "No arena here." }
		}
	}


# ============================================================
# UI Construction
# ============================================================

func _build_ui() -> void:
	# Full screen dark overlay
	_bg = ColorRect.new()
	_bg.color = COLOR_OVERLAY
	_bg.anchor_right = 1.0
	_bg.anchor_bottom = 1.0
	add_child(_bg)

	# Main HBox: sidebar + content
	var root_margin := MarginContainer.new()
	root_margin.anchor_right = 1.0
	root_margin.anchor_bottom = 1.0
	root_margin.add_theme_constant_override("margin_left", 40)
	root_margin.add_theme_constant_override("margin_right", 40)
	root_margin.add_theme_constant_override("margin_top", 30)
	root_margin.add_theme_constant_override("margin_bottom", 30)
	add_child(root_margin)

	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 0)
	root_margin.add_child(hbox)

	# --- Sidebar ---
	var sidebar_panel := PanelContainer.new()
	sidebar_panel.custom_minimum_size = Vector2(SIDEBAR_WIDTH, 0)

	var sidebar_style := StyleBoxFlat.new()
	sidebar_style.bg_color = COLOR_SIDEBAR_BG
	sidebar_style.border_color = COLOR_IRON_BORDER
	sidebar_style.border_width_right = 2
	sidebar_style.border_width_top = 2
	sidebar_style.border_width_bottom = 2
	sidebar_style.border_width_left = 2
	sidebar_style.corner_radius_top_left = 4
	sidebar_style.corner_radius_bottom_left = 4
	sidebar_style.content_margin_left = 12
	sidebar_style.content_margin_right = 12
	sidebar_style.content_margin_top = 16
	sidebar_style.content_margin_bottom = 16
	sidebar_panel.add_theme_stylebox_override("panel", sidebar_style)
	hbox.add_child(sidebar_panel)

	_sidebar = VBoxContainer.new()
	_sidebar.add_theme_constant_override("separation", 6)
	sidebar_panel.add_child(_sidebar)

	# Town title
	_title_label = Label.new()
	_title_label.add_theme_font_size_override("font_size", 22)
	_title_label.add_theme_color_override("font_color", COLOR_EMBER)
	_title_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.5))
	_title_label.add_theme_constant_override("shadow_offset_x", 1)
	_title_label.add_theme_constant_override("shadow_offset_y", 1)
	_sidebar.add_child(_title_label)

	# Description
	_desc_label = Label.new()
	_desc_label.add_theme_font_size_override("font_size", 11)
	_desc_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
	_desc_label.autowrap_mode = TextServer.AUTOWRAP_WORD
	_sidebar.add_child(_desc_label)

	# Separator
	var sep := ColorRect.new()
	sep.custom_minimum_size = Vector2(0, 1)
	sep.color = Color(COLOR_IRON_BORDER, 0.5)
	_sidebar.add_child(sep)

	# Resource display
	var res_row := HBoxContainer.new()
	res_row.add_theme_constant_override("separation", 16)
	_sidebar.add_child(res_row)

	var gold_hbox := HBoxContainer.new()
	gold_hbox.add_theme_constant_override("separation", 4)
	res_row.add_child(gold_hbox)
	var gold_icon := Label.new()
	gold_icon.text = "Gold:"
	gold_icon.add_theme_font_size_override("font_size", 12)
	gold_icon.add_theme_color_override("font_color", COLOR_EMBER)
	gold_hbox.add_child(gold_icon)
	_gold_label = Label.new()
	_gold_label.add_theme_font_size_override("font_size", 12)
	_gold_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
	gold_hbox.add_child(_gold_label)

	var food_hbox := HBoxContainer.new()
	food_hbox.add_theme_constant_override("separation", 4)
	res_row.add_child(food_hbox)
	var food_icon := Label.new()
	food_icon.text = "Food:"
	food_icon.add_theme_font_size_override("font_size", 12)
	food_icon.add_theme_color_override("font_color", COLOR_MOSS)
	food_hbox.add_child(food_icon)
	_food_label = Label.new()
	_food_label.add_theme_font_size_override("font_size", 12)
	_food_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
	food_hbox.add_child(_food_label)

	# Separator
	var sep2 := ColorRect.new()
	sep2.custom_minimum_size = Vector2(0, 1)
	sep2.color = Color(COLOR_IRON_BORDER, 0.3)
	_sidebar.add_child(sep2)

	# Building buttons placeholder (populated in open())
	# Will be added dynamically

	# Spacer pushes Leave to bottom
	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_sidebar.add_child(spacer)

	# Leave button
	var leave_btn := _create_sidebar_button("Leave", COLOR_BLOOD)
	leave_btn.pressed.connect(_on_leave_pressed)
	_sidebar.add_child(leave_btn)

	# --- Content Panel ---
	_content_panel = PanelContainer.new()
	_content_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	var content_style := StyleBoxFlat.new()
	content_style.bg_color = COLOR_PANEL_BG
	content_style.border_color = COLOR_IRON_BORDER
	content_style.border_width_top = 2
	content_style.border_width_bottom = 2
	content_style.border_width_right = 2
	content_style.border_width_left = 0
	content_style.corner_radius_top_right = 4
	content_style.corner_radius_bottom_right = 4
	content_style.content_margin_left = 20
	content_style.content_margin_right = 20
	content_style.content_margin_top = 16
	content_style.content_margin_bottom = 16
	_content_panel.add_theme_stylebox_override("panel", content_style)
	hbox.add_child(_content_panel)

	_content_container = VBoxContainer.new()
	_content_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_content_container.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_content_container.add_theme_constant_override("separation", 8)
	_content_panel.add_child(_content_container)


func _create_building_buttons() -> void:
	# Remove old building buttons (between sep2 and spacer)
	for key in _building_buttons:
		var btn = _building_buttons[key]
		if is_instance_valid(btn):
			btn.queue_free()
	_building_buttons.clear()

	var buildings: Dictionary = _town_data.get("buildings", {})

	# Find the spacer (last Control before Leave button)
	var spacer_idx := -1
	for i in range(_sidebar.get_child_count()):
		var child = _sidebar.get_child(i)
		if child is Control and not child is Label and not child is ColorRect \
			and not child is HBoxContainer and not child is Button:
			spacer_idx = i
			break

	var insert_idx := spacer_idx if spacer_idx >= 0 else _sidebar.get_child_count() - 2

	for building_key in BUILDING_ORDER:
		if building_key not in buildings:
			continue

		var bdata: Dictionary = buildings[building_key]
		var is_locked: bool = bdata.get("locked", false)
		var display_name: String = BUILDING_NAMES.get(building_key, building_key.capitalize())

		if is_locked:
			display_name += "  [locked]"

		var btn := _create_sidebar_button(display_name, COLOR_PARCHMENT if not is_locked else COLOR_WORN_STONE)
		if is_locked:
			btn.add_theme_color_override("font_color", Color(COLOR_WORN_STONE, 0.5))
			btn.add_theme_color_override("font_hover_color", Color(COLOR_WORN_STONE, 0.7))

		var captured_key: String = building_key
		btn.pressed.connect(func(): _select_building(captured_key))
		_building_buttons[building_key] = btn

		_sidebar.add_child(btn)
		_sidebar.move_child(btn, insert_idx)
		insert_idx += 1


func _create_sidebar_button(text: String, accent: Color) -> Button:
	var btn := Button.new()
	btn.text = text
	btn.custom_minimum_size = Vector2(0, 38)
	btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
	btn.add_theme_font_size_override("font_size", 15)
	btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
	btn.add_theme_color_override("font_hover_color", accent)

	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(0, 0, 0, 0)
	normal.set_border_width_all(0)
	normal.border_width_left = 3
	normal.border_color = Color(0, 0, 0, 0)
	normal.content_margin_left = 10
	normal.content_margin_right = 6
	normal.content_margin_top = 4
	normal.content_margin_bottom = 4
	btn.add_theme_stylebox_override("normal", normal)

	var hover := normal.duplicate()
	hover.bg_color = Color(0.08, 0.085, 0.11, 0.5)
	hover.border_color = accent
	btn.add_theme_stylebox_override("hover", hover)

	var pressed := normal.duplicate()
	pressed.bg_color = Color(0.1, 0.09, 0.07, 0.6)
	pressed.border_color = accent
	btn.add_theme_stylebox_override("pressed", pressed)

	return btn


func _update_sidebar_highlight() -> void:
	for key in _building_buttons:
		var btn: Button = _building_buttons[key]
		var buildings: Dictionary = _town_data.get("buildings", {})
		var is_locked: bool = buildings.get(key, {}).get("locked", false)

		if key == _selected_building:
			# Active building: ember left border
			var active_style := StyleBoxFlat.new()
			active_style.bg_color = Color(0.1, 0.09, 0.07, 0.6)
			active_style.set_border_width_all(0)
			active_style.border_width_left = 3
			active_style.border_color = COLOR_EMBER
			active_style.content_margin_left = 10
			active_style.content_margin_right = 6
			active_style.content_margin_top = 4
			active_style.content_margin_bottom = 4
			btn.add_theme_stylebox_override("normal", active_style)
			btn.add_theme_color_override("font_color", COLOR_EMBER)
		else:
			# Reset to default
			var normal := StyleBoxFlat.new()
			normal.bg_color = Color(0, 0, 0, 0)
			normal.set_border_width_all(0)
			normal.border_width_left = 3
			normal.border_color = Color(0, 0, 0, 0)
			normal.content_margin_left = 10
			normal.content_margin_right = 6
			normal.content_margin_top = 4
			normal.content_margin_bottom = 4
			btn.add_theme_stylebox_override("normal", normal)
			if is_locked:
				btn.add_theme_color_override("font_color", Color(COLOR_WORN_STONE, 0.5))
			else:
				btn.add_theme_color_override("font_color", COLOR_PARCHMENT)


# ============================================================
# Building Selection
# ============================================================

func _select_building(building_key: String) -> void:
	_selected_building = building_key
	_update_sidebar_highlight()
	_update_resource_labels()

	# Clear content
	for child in _content_container.get_children():
		child.queue_free()

	var buildings: Dictionary = _town_data.get("buildings", {})
	var bdata: Dictionary = buildings.get(building_key, {})

	if bdata.get("locked", false):
		_show_locked_panel(bdata)
		return

	match building_key:
		"inn":
			_show_inn_panel(bdata)
		"shop":
			_show_shop_panel(bdata)
		"tavern":
			_show_tavern_panel(bdata)
		_:
			_show_locked_panel(bdata)


func _update_resource_labels() -> void:
	_gold_label.text = str(GameManager.gold)
	_food_label.text = str(GameManager.food)


# ============================================================
# Inn Panel
# ============================================================

func _show_inn_panel(bdata: Dictionary) -> void:
	var cost_per_unit: int = bdata.get("heal_cost_per_unit", 10)

	# Header
	var header := Label.new()
	header.text = "Inn  —  Rest and Recover"
	header.add_theme_font_size_override("font_size", 18)
	header.add_theme_color_override("font_color", COLOR_EMBER)
	_content_container.add_child(header)

	var sep := ColorRect.new()
	sep.custom_minimum_size = Vector2(0, 1)
	sep.color = Color(COLOR_IRON_BORDER, 0.4)
	_content_container.add_child(sep)

	# Party list with HP bars
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_content_container.add_child(scroll)

	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 6)
	scroll.add_child(list)

	var injured_count := 0
	for unit in GameManager.party:
		if not unit.is_alive():
			continue

		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		list.add_child(row)

		# Name + class
		var name_label := Label.new()
		name_label.custom_minimum_size = Vector2(120, 0)
		name_label.text = unit.unit_name
		name_label.add_theme_font_size_override("font_size", 14)
		name_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
		row.add_child(name_label)

		# HP bar
		var hp_bar := ProgressBar.new()
		hp_bar.custom_minimum_size = Vector2(120, 16)
		hp_bar.max_value = unit.max_hp
		hp_bar.value = unit.current_hp
		hp_bar.show_percentage = false
		hp_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER

		var bar_bg := StyleBoxFlat.new()
		bar_bg.bg_color = Color(0.1, 0.1, 0.12)
		bar_bg.set_corner_radius_all(2)
		hp_bar.add_theme_stylebox_override("background", bar_bg)

		var bar_fill := StyleBoxFlat.new()
		var hp_pct: float = float(unit.current_hp) / float(unit.max_hp)
		if hp_pct > 0.5:
			bar_fill.bg_color = COLOR_MOSS
		elif hp_pct > 0.25:
			bar_fill.bg_color = COLOR_EMBER
		else:
			bar_fill.bg_color = COLOR_BLOOD
		bar_fill.set_corner_radius_all(2)
		hp_bar.add_theme_stylebox_override("fill", bar_fill)
		row.add_child(hp_bar)

		# HP text
		var hp_text := Label.new()
		hp_text.text = "%d / %d" % [unit.current_hp, unit.max_hp]
		hp_text.add_theme_font_size_override("font_size", 13)
		hp_text.add_theme_color_override("font_color", COLOR_PARCHMENT)
		hp_text.custom_minimum_size = Vector2(70, 0)
		row.add_child(hp_text)

		# Per-unit heal button (only if injured)
		if unit.current_hp < unit.max_hp:
			injured_count += 1
			var heal_btn := Button.new()
			heal_btn.text = "Heal (%dg)" % cost_per_unit
			heal_btn.add_theme_font_size_override("font_size", 12)
			heal_btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
			heal_btn.add_theme_color_override("font_hover_color", COLOR_MOSS)
			heal_btn.add_theme_color_override("font_disabled_color", Color(COLOR_WORN_STONE, 0.4))
			heal_btn.disabled = GameManager.gold < cost_per_unit

			var heal_style := StyleBoxFlat.new()
			heal_style.bg_color = Color(0.06, 0.065, 0.09, 0.9)
			heal_style.border_color = COLOR_IRON_BORDER
			heal_style.set_border_width_all(1)
			heal_style.set_corner_radius_all(2)
			heal_style.content_margin_left = 6
			heal_style.content_margin_right = 6
			heal_style.content_margin_top = 2
			heal_style.content_margin_bottom = 2
			heal_btn.add_theme_stylebox_override("normal", heal_style)

			var heal_hover := heal_style.duplicate()
			heal_hover.border_color = COLOR_MOSS
			heal_btn.add_theme_stylebox_override("hover", heal_hover)

			var heal_disabled := heal_style.duplicate()
			heal_disabled.bg_color = Color(0.04, 0.04, 0.06, 0.7)
			heal_disabled.border_color = Color(COLOR_IRON_BORDER, 0.3)
			heal_btn.add_theme_stylebox_override("disabled", heal_disabled)

			var captured_unit := unit
			heal_btn.pressed.connect(func():
				if GameManager.spend_gold(cost_per_unit):
					captured_unit.current_hp = captured_unit.max_hp
					GameManager.party_changed.emit()
					EventBus.show_notification.emit("Healed %s to full HP." % captured_unit.unit_name)
					_select_building("inn")  # Refresh
			)
			row.add_child(heal_btn)
		else:
			var full_label := Label.new()
			full_label.text = "Full HP"
			full_label.add_theme_font_size_override("font_size", 12)
			full_label.add_theme_color_override("font_color", COLOR_MOSS)
			row.add_child(full_label)

	# Heal All button
	if injured_count > 0:
		var heal_all_sep := ColorRect.new()
		heal_all_sep.custom_minimum_size = Vector2(0, 1)
		heal_all_sep.color = Color(COLOR_IRON_BORDER, 0.3)
		_content_container.add_child(heal_all_sep)

		var total_cost: int = cost_per_unit * injured_count
		var heal_all_row := HBoxContainer.new()
		heal_all_row.add_theme_constant_override("separation", 12)
		heal_all_row.alignment = BoxContainer.ALIGNMENT_END
		_content_container.add_child(heal_all_row)

		var cost_label := Label.new()
		cost_label.text = "%d injured  —  Total: %dg" % [injured_count, total_cost]
		cost_label.add_theme_font_size_override("font_size", 14)
		cost_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
		heal_all_row.add_child(cost_label)

		var heal_all_btn := Button.new()
		heal_all_btn.text = "Heal All (%dg)" % total_cost
		heal_all_btn.custom_minimum_size = Vector2(140, 36)
		heal_all_btn.add_theme_font_size_override("font_size", 14)
		heal_all_btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
		heal_all_btn.add_theme_color_override("font_hover_color", COLOR_MOSS)
		heal_all_btn.add_theme_color_override("font_disabled_color", Color(COLOR_WORN_STONE, 0.4))
		heal_all_btn.disabled = GameManager.gold < total_cost

		var all_style := StyleBoxFlat.new()
		all_style.bg_color = Color(0.06, 0.065, 0.09, 0.95)
		all_style.border_color = COLOR_MOSS
		all_style.set_border_width_all(1)
		all_style.set_corner_radius_all(3)
		all_style.content_margin_left = 10
		all_style.content_margin_right = 10
		all_style.content_margin_top = 6
		all_style.content_margin_bottom = 6
		heal_all_btn.add_theme_stylebox_override("normal", all_style)

		var all_hover := all_style.duplicate()
		all_hover.bg_color = Color(0.08, 0.09, 0.07, 0.95)
		heal_all_btn.add_theme_stylebox_override("hover", all_hover)

		var all_disabled := all_style.duplicate()
		all_disabled.bg_color = Color(0.04, 0.04, 0.06, 0.7)
		all_disabled.border_color = Color(COLOR_IRON_BORDER, 0.3)
		heal_all_btn.add_theme_stylebox_override("disabled", all_disabled)

		heal_all_btn.pressed.connect(func():
			if GameManager.spend_gold(total_cost):
				for u in GameManager.party:
					if u.is_alive():
						u.current_hp = u.max_hp
				GameManager.party_changed.emit()
				EventBus.show_notification.emit("All units healed to full HP.")
				_select_building("inn")  # Refresh
		)
		heal_all_row.add_child(heal_all_btn)
	else:
		var all_good := Label.new()
		all_good.text = "All units are at full health."
		all_good.add_theme_font_size_override("font_size", 14)
		all_good.add_theme_color_override("font_color", COLOR_MOSS)
		_content_container.add_child(all_good)


# ============================================================
# Shop Panel
# ============================================================

func _show_shop_panel(bdata: Dictionary) -> void:
	var header := Label.new()
	header.text = "Shop  —  Buy and Sell"
	header.add_theme_font_size_override("font_size", 18)
	header.add_theme_color_override("font_color", COLOR_EMBER)
	_content_container.add_child(header)

	var sep := ColorRect.new()
	sep.custom_minimum_size = Vector2(0, 1)
	sep.color = Color(COLOR_IRON_BORDER, 0.4)
	_content_container.add_child(sep)

	_shop_panel = ShopPanel.new()
	_shop_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_shop_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_shop_panel.gold_changed.connect(_update_resource_labels)
	_content_container.add_child(_shop_panel)

	var stock: Array = bdata.get("stock", [])
	_shop_panel.setup(stock)


# ============================================================
# Tavern Panel
# ============================================================

func _show_tavern_panel(bdata: Dictionary) -> void:
	var header := Label.new()
	header.text = "Tavern  —  Hear the Latest"
	header.add_theme_font_size_override("font_size", 18)
	header.add_theme_color_override("font_color", COLOR_EMBER)
	_content_container.add_child(header)

	var sep := ColorRect.new()
	sep.custom_minimum_size = Vector2(0, 1)
	sep.color = Color(COLOR_IRON_BORDER, 0.4)
	_content_container.add_child(sep)

	# === Tavern Actions (always available) ===
	var actions_row := HBoxContainer.new()
	actions_row.add_theme_constant_override("separation", 12)
	_content_container.add_child(actions_row)

	# Buy a Round — spend gold for a gameplay tip
	var round_btn := Button.new()
	round_btn.text = "Buy a Round  (3g)"
	round_btn.custom_minimum_size = Vector2(160, 38)
	round_btn.add_theme_font_size_override("font_size", 14)
	round_btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
	round_btn.add_theme_color_override("font_hover_color", COLOR_EMBER)
	round_btn.add_theme_color_override("font_disabled_color", Color(COLOR_WORN_STONE, 0.4))
	round_btn.disabled = GameManager.gold < 3

	var round_style := StyleBoxFlat.new()
	round_style.bg_color = Color(0.06, 0.065, 0.09, 0.9)
	round_style.border_color = COLOR_IRON_BORDER
	round_style.set_border_width_all(1)
	round_style.set_corner_radius_all(3)
	round_style.content_margin_left = 10
	round_style.content_margin_right = 10
	round_style.content_margin_top = 6
	round_style.content_margin_bottom = 6
	round_btn.add_theme_stylebox_override("normal", round_style)

	var round_hover := round_style.duplicate()
	round_hover.border_color = COLOR_EMBER
	round_btn.add_theme_stylebox_override("hover", round_hover)

	var round_disabled := round_style.duplicate()
	round_disabled.bg_color = Color(0.04, 0.04, 0.06, 0.7)
	round_disabled.border_color = Color(COLOR_IRON_BORDER, 0.3)
	round_btn.add_theme_stylebox_override("disabled", round_disabled)

	round_btn.pressed.connect(func():
		if GameManager.spend_gold(3):
			var tip: String = TAVERN_TIPS[randi() % TAVERN_TIPS.size()]
			EventBus.show_notification.emit(tip)
			_update_resource_labels()
			# Update disabled state
			round_btn.disabled = GameManager.gold < 3
	)
	actions_row.add_child(round_btn)

	var round_desc := Label.new()
	round_desc.text = "Buy drinks and hear useful advice from the locals."
	round_desc.add_theme_font_size_override("font_size", 12)
	round_desc.add_theme_color_override("font_color", COLOR_WORN_STONE)
	round_desc.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	actions_row.add_child(round_desc)

	# === Quest NPCs ===
	var quests: Array = bdata.get("quests", [])
	var visible_quests: Array = _get_visible_quests(quests)

	if not visible_quests.is_empty():
		var quest_sep := ColorRect.new()
		quest_sep.custom_minimum_size = Vector2(0, 1)
		quest_sep.color = Color(COLOR_IRON_BORDER, 0.3)
		_content_container.add_child(quest_sep)

		var quest_header := Label.new()
		quest_header.text = "Patrons"
		quest_header.add_theme_font_size_override("font_size", 15)
		quest_header.add_theme_color_override("font_color", COLOR_EMBER)
		_content_container.add_child(quest_header)

		for quest_entry in visible_quests:
			var npc_panel := PanelContainer.new()
			var npc_style := StyleBoxFlat.new()
			npc_style.bg_color = Color(0.07, 0.075, 0.1, 0.7)
			npc_style.border_color = Color(COLOR_EMBER, 0.4)
			npc_style.border_width_left = 3
			npc_style.set_corner_radius_all(2)
			npc_style.content_margin_left = 12
			npc_style.content_margin_right = 12
			npc_style.content_margin_top = 8
			npc_style.content_margin_bottom = 8
			npc_panel.add_theme_stylebox_override("panel", npc_style)
			_content_container.add_child(npc_panel)

			var npc_hbox := HBoxContainer.new()
			npc_hbox.add_theme_constant_override("separation", 12)
			npc_panel.add_child(npc_hbox)

			var npc_vbox := VBoxContainer.new()
			npc_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			npc_vbox.add_theme_constant_override("separation", 2)
			npc_hbox.add_child(npc_vbox)

			var npc_name := Label.new()
			npc_name.text = quest_entry.get("npc_name", "???")
			npc_name.add_theme_font_size_override("font_size", 14)
			npc_name.add_theme_color_override("font_color", COLOR_PARCHMENT)
			npc_vbox.add_child(npc_name)

			var npc_desc := Label.new()
			npc_desc.text = quest_entry.get("npc_desc", "")
			npc_desc.add_theme_font_size_override("font_size", 12)
			npc_desc.add_theme_color_override("font_color", COLOR_WORN_STONE)
			npc_desc.autowrap_mode = TextServer.AUTOWRAP_WORD
			npc_vbox.add_child(npc_desc)

			var talk_btn := Button.new()
			talk_btn.text = "Talk"
			talk_btn.custom_minimum_size = Vector2(70, 30)
			talk_btn.add_theme_font_size_override("font_size", 13)
			talk_btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
			talk_btn.add_theme_color_override("font_hover_color", COLOR_EMBER)

			var talk_style := StyleBoxFlat.new()
			talk_style.bg_color = Color(0.06, 0.065, 0.09, 0.9)
			talk_style.border_color = COLOR_IRON_BORDER
			talk_style.set_border_width_all(1)
			talk_style.set_corner_radius_all(2)
			talk_style.content_margin_left = 8
			talk_style.content_margin_right = 8
			talk_style.content_margin_top = 4
			talk_style.content_margin_bottom = 4
			talk_btn.add_theme_stylebox_override("normal", talk_style)

			var talk_hover := talk_style.duplicate()
			talk_hover.border_color = COLOR_EMBER
			talk_btn.add_theme_stylebox_override("hover", talk_hover)

			var captured_dialogue_id: String = quest_entry.get("dialogue_id", "")
			talk_btn.pressed.connect(func():
				if captured_dialogue_id != "":
					town_closed.emit()
					DialogueManager.start_dialogue(captured_dialogue_id)
			)
			npc_hbox.add_child(talk_btn)

	# === Bounty Board ===
	if not GameManager.captured_enemies.is_empty():
		var bounty_sep := ColorRect.new()
		bounty_sep.custom_minimum_size = Vector2(0, 1)
		bounty_sep.color = Color(COLOR_IRON_BORDER, 0.3)
		_content_container.add_child(bounty_sep)

		var bounty_header := Label.new()
		bounty_header.text = "Bounty Board"
		bounty_header.add_theme_font_size_override("font_size", 15)
		bounty_header.add_theme_color_override("font_color", Color(0.6, 0.5, 0.8))
		_content_container.add_child(bounty_header)

		var bounty_board := BountyBoard.new()
		bounty_board.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		bounty_board.gold_changed.connect(_update_resource_labels)
		_content_container.add_child(bounty_board)

	# === Rumors (flavor text at bottom) ===
	var rumors: Array = bdata.get("rumors", [])
	if not rumors.is_empty():
		var rumor_sep := ColorRect.new()
		rumor_sep.custom_minimum_size = Vector2(0, 1)
		rumor_sep.color = Color(COLOR_IRON_BORDER, 0.3)
		_content_container.add_child(rumor_sep)

		var rumor_header := Label.new()
		rumor_header.text = "Overheard Rumors"
		rumor_header.add_theme_font_size_override("font_size", 15)
		rumor_header.add_theme_color_override("font_color", COLOR_WORN_STONE)
		_content_container.add_child(rumor_header)

		var scroll := ScrollContainer.new()
		scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
		scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		_content_container.add_child(scroll)

		var rumor_list := VBoxContainer.new()
		rumor_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		rumor_list.add_theme_constant_override("separation", 8)
		scroll.add_child(rumor_list)

		for i in range(rumors.size()):
			var rumor_panel := PanelContainer.new()
			var rumor_style := StyleBoxFlat.new()
			rumor_style.bg_color = Color(0.06, 0.065, 0.09, 0.5)
			rumor_style.border_color = Color(COLOR_IRON_BORDER, 0.2)
			rumor_style.border_width_left = 3
			rumor_style.set_corner_radius_all(2)
			rumor_style.content_margin_left = 12
			rumor_style.content_margin_right = 12
			rumor_style.content_margin_top = 6
			rumor_style.content_margin_bottom = 6
			rumor_panel.add_theme_stylebox_override("panel", rumor_style)
			rumor_list.add_child(rumor_panel)

			var rumor_text := Label.new()
			rumor_text.text = "\"%s\"" % rumors[i]
			rumor_text.add_theme_font_size_override("font_size", 12)
			rumor_text.add_theme_color_override("font_color", Color(COLOR_PARCHMENT, 0.7))
			rumor_text.autowrap_mode = TextServer.AUTOWRAP_WORD
			rumor_panel.add_child(rumor_text)


# ============================================================
# Quest Helpers
# ============================================================

## Filter quest entries by show_conditions (same logic as EventManager/DialogueManager).
func _get_visible_quests(quests: Array) -> Array:
	var visible: Array = []
	for quest_entry in quests:
		if not quest_entry is Dictionary:
			continue
		var conditions: Array = quest_entry.get("show_conditions", [])
		if _check_quest_conditions(conditions):
			visible.append(quest_entry)
	return visible


func _check_quest_conditions(conditions: Array) -> bool:
	return EventBus.check_conditions(conditions)


# ============================================================
# Locked Panel
# ============================================================

func _show_locked_panel(bdata: Dictionary) -> void:
	var spacer_top := Control.new()
	spacer_top.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_content_container.add_child(spacer_top)

	var lock_vbox := VBoxContainer.new()
	lock_vbox.add_theme_constant_override("separation", 12)
	lock_vbox.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_content_container.add_child(lock_vbox)

	var lock_icon := Label.new()
	lock_icon.text = "[Locked]"
	lock_icon.add_theme_font_size_override("font_size", 24)
	lock_icon.add_theme_color_override("font_color", Color(COLOR_WORN_STONE, 0.4))
	lock_icon.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lock_vbox.add_child(lock_icon)

	var lock_text := Label.new()
	lock_text.text = bdata.get("locked_text", "This building is not available.")
	lock_text.add_theme_font_size_override("font_size", 14)
	lock_text.add_theme_color_override("font_color", COLOR_WORN_STONE)
	lock_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lock_text.autowrap_mode = TextServer.AUTOWRAP_WORD
	lock_vbox.add_child(lock_text)

	var spacer_bottom := Control.new()
	spacer_bottom.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_content_container.add_child(spacer_bottom)


# ============================================================
# Navigation
# ============================================================

func _on_leave_pressed() -> void:
	town_closed.emit()


func _input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		town_closed.emit()
		get_viewport().set_input_as_handled()
