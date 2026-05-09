class_name TownMenu
extends CanvasLayer
## TownMenu — Mount & Blade style two-layer town interface.
## Layer 1: Quick Menu — compact centered overlay with district card buttons.
## Layer 2: Sub-menu — clicking a district swaps to back button + content panel.

signal town_closed

# --- Palette ---
const COLOR_PANEL_BG := UIColors.COLOR_PANEL_BG
const COLOR_SIDEBAR_BG := UIColors.COLOR_SIDEBAR_BG
const COLOR_IRON_BORDER := UIColors.COLOR_IRON_BORDER
const COLOR_EMBER := UIColors.COLOR_EMBER
const COLOR_PARCHMENT := UIColors.COLOR_PARCHMENT
const COLOR_WORN_STONE := UIColors.COLOR_WORN_STONE
const COLOR_MOSS := UIColors.COLOR_MOSS
const COLOR_BLOOD := UIColors.COLOR_BLOOD
const COLOR_OVERLAY := UIColors.COLOR_OVERLAY_MEDIUM

const DISTRICT_ORDER := ["inn", "shop", "blacksmith", "tavern", "arena"]
const DISTRICT_INFO := {
	"inn": { "name": "Inn", "desc": "Rest and heal your party.", "icon": "+" },
	"shop": { "name": "Marketplace", "desc": "Buy and sell goods.", "icon": "$" },
	"blacksmith": { "name": "Blacksmith", "desc": "Sharpen and maintain weapons.", "icon": "#" },
	"tavern": { "name": "Tavern", "desc": "Hear rumors, find quests.", "icon": "~" },
	"arena": { "name": "Arena", "desc": "Test your mettle in combat.", "icon": "!" },
}
const TAVERN_TIPS := [
	"Longer routes mean more encounter chances — but shortcuts aren't always safe.",
	"Food is consumed with every hop on the map. Stock up before long journeys.",
	"Capturing enemies with the Subdue command can earn gold bounties at taverns.",
	"Steel weapons hit harder than iron but cost a fair bit more.",
	"Healing staves can keep your units alive mid-battle. Protect your healers.",
	"Camps let you rest and heal using food. Towns cost gold but fully restore health.",
	"Defeated units are gone forever. If a battle turns sour, consider your options carefully.",
	"Magic attacks target Resistance, not Defense. Armored foes often have low Resistance.",
	"Some say there are dungeons hidden in these lands, sealed by ancient wards.",
	"Keep your gold reserves healthy — you never know when you'll need an emergency heal.",
	"Sharp weapons deal +2 damage. Visit the blacksmith before they go dull.",
	"Honed weapons resist the first dulling after battle — a blacksmith's mark of quality.",
]

# --- State ---
var _town_name: String = ""
var _town_data: Dictionary = {}
var _current_layer: String = "quick"  # "quick" or district key

# --- UI refs ---
var _bg: ColorRect
var _center_panel: PanelContainer
var _panel_vbox: VBoxContainer   # root vbox inside center panel

# Header refs (persistent across layers)
var _title_label: Label
var _gold_label: Label
var _food_label: Label

# Quick menu content container (swapped out for sub-menus)
var _quick_content: VBoxContainer
var _sub_content: VBoxContainer

var _shop_panel: ShopPanel


func _ready() -> void:
	layer = 30
	_build_shell()


func open(location_name: String) -> void:
	_town_name = location_name
	_load_town_data(location_name)
	_title_label.text = _town_name
	_update_resource_labels()
	_show_quick_menu()
	show()


# ============================================================
# Data
# ============================================================

func _load_town_data(location_name: String) -> void:
	var slug := location_name.to_lower().replace(" ", "_").replace("'", "")
	var path := "res://data/towns/%s.json" % slug
	var data = JSONLoader.load_json(path)
	if data is Dictionary:
		_town_data = data
	else:
		if not JSONLoader.file_exists(path):
			print("[TownMenu] No town data for '%s', using defaults" % location_name)
		_town_data = _default_town_data(location_name)


func _default_town_data(location_name: String) -> Dictionary:
	return {
		"name": location_name,
		"description": "A small settlement.",
		"buildings": {
			"inn": { "heal_cost_per_unit": 10 },
			"shop": { "stock": ["vulnerary", "food_rations"] },
			"blacksmith": {},
			"tavern": { "rumors": ["Nothing of note to report."] },
			"arena": { "locked": true, "locked_text": "No arena here." }
		}
	}


# ============================================================
# Shell — the persistent frame (bg + centered panel + header)
# ============================================================

func _build_shell() -> void:
	# Dim overlay
	_bg = ColorRect.new()
	_bg.color = COLOR_OVERLAY
	_bg.anchor_right = 1.0
	_bg.anchor_bottom = 1.0
	_bg.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_bg)

	# Centered panel — 60% width, 80% height
	_center_panel = PanelContainer.new()
	_center_panel.anchor_left = 0.2
	_center_panel.anchor_right = 0.8
	_center_panel.anchor_top = 0.08
	_center_panel.anchor_bottom = 0.92
	_center_panel.offset_left = 0
	_center_panel.offset_right = 0
	_center_panel.offset_top = 0
	_center_panel.offset_bottom = 0

	var panel_style := StyleBoxFlat.new()
	panel_style.bg_color = COLOR_PANEL_BG
	panel_style.border_color = COLOR_IRON_BORDER
	panel_style.set_border_width_all(2)
	panel_style.set_corner_radius_all(6)
	panel_style.content_margin_left = 24
	panel_style.content_margin_right = 24
	panel_style.content_margin_top = 20
	panel_style.content_margin_bottom = 20
	_center_panel.add_theme_stylebox_override("panel", panel_style)
	add_child(_center_panel)

	_panel_vbox = VBoxContainer.new()
	_panel_vbox.add_theme_constant_override("separation", 12)
	_center_panel.add_child(_panel_vbox)

	# --- Header (always visible) ---
	var header_row := HBoxContainer.new()
	header_row.add_theme_constant_override("separation", 16)
	_panel_vbox.add_child(header_row)

	_title_label = Label.new()
	_title_label.add_theme_font_size_override("font_size", 24)
	_title_label.add_theme_color_override("font_color", COLOR_EMBER)
	_title_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.5))
	_title_label.add_theme_constant_override("shadow_offset_x", 1)
	_title_label.add_theme_constant_override("shadow_offset_y", 1)
	_title_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header_row.add_child(_title_label)

	# Gold
	var gold_hbox := HBoxContainer.new()
	gold_hbox.add_theme_constant_override("separation", 4)
	header_row.add_child(gold_hbox)
	var gold_icon := Label.new()
	gold_icon.text = "Gold:"
	gold_icon.add_theme_font_size_override("font_size", 14)
	gold_icon.add_theme_color_override("font_color", COLOR_EMBER)
	gold_hbox.add_child(gold_icon)
	_gold_label = Label.new()
	_gold_label.add_theme_font_size_override("font_size", 14)
	_gold_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
	gold_hbox.add_child(_gold_label)

	# Food
	var food_hbox := HBoxContainer.new()
	food_hbox.add_theme_constant_override("separation", 4)
	header_row.add_child(food_hbox)
	var food_icon := Label.new()
	food_icon.text = "Food:"
	food_icon.add_theme_font_size_override("font_size", 14)
	food_icon.add_theme_color_override("font_color", COLOR_MOSS)
	food_hbox.add_child(food_icon)
	_food_label = Label.new()
	_food_label.add_theme_font_size_override("font_size", 14)
	_food_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
	food_hbox.add_child(_food_label)

	# Header separator
	var sep := ColorRect.new()
	sep.custom_minimum_size = Vector2(0, 1)
	sep.color = Color(COLOR_IRON_BORDER, 0.5)
	_panel_vbox.add_child(sep)


# ============================================================
# Quick Menu — district card buttons
# ============================================================

func _show_quick_menu() -> void:
	_current_layer = "quick"
	_clear_content()

	_quick_content = VBoxContainer.new()
	_quick_content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_quick_content.add_theme_constant_override("separation", 10)
	_panel_vbox.add_child(_quick_content)

	# Town description
	var desc_text: String = _town_data.get("description", "")
	if desc_text != "":
		var desc := Label.new()
		desc.text = desc_text
		desc.add_theme_font_size_override("font_size", 13)
		desc.add_theme_color_override("font_color", COLOR_WORN_STONE)
		desc.autowrap_mode = TextServer.AUTOWRAP_WORD
		_quick_content.add_child(desc)

	# District cards grid — 2 columns
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	grid.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_quick_content.add_child(grid)

	var buildings: Dictionary = _town_data.get("buildings", {})
	for key in DISTRICT_ORDER:
		if key not in buildings:
			continue
		var bdata: Dictionary = buildings[key]
		var is_locked: bool = bdata.get("locked", false)
		var info: Dictionary = DISTRICT_INFO.get(key, {})
		var card := _create_district_card(key, info, is_locked)
		grid.add_child(card)

	# Leave button at bottom
	var bottom_row := HBoxContainer.new()
	bottom_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_quick_content.add_child(bottom_row)

	var leave_btn := _create_action_button("Leave Town", COLOR_BLOOD, Vector2(160, 40))
	leave_btn.pressed.connect(_on_leave_pressed)
	bottom_row.add_child(leave_btn)


func _create_district_card(key: String, info: Dictionary, is_locked: bool) -> PanelContainer:
	var card := PanelContainer.new()
	card.custom_minimum_size = Vector2(0, 80)
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	var accent: Color = COLOR_EMBER if not is_locked else Color(COLOR_WORN_STONE, 0.4)
	var bg_color: Color = COLOR_SIDEBAR_BG if not is_locked else Color(0.03, 0.035, 0.05, 0.95)

	var style := StyleBoxFlat.new()
	style.bg_color = bg_color
	style.border_color = accent
	style.border_width_left = 3
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.set_corner_radius_all(4)
	style.content_margin_left = 16
	style.content_margin_right = 16
	style.content_margin_top = 12
	style.content_margin_bottom = 12
	card.add_theme_stylebox_override("panel", style)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 4)
	vbox.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(vbox)

	# Name row
	var name_row := HBoxContainer.new()
	name_row.add_theme_constant_override("separation", 8)
	name_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vbox.add_child(name_row)

	var icon_label := Label.new()
	icon_label.text = info.get("icon", "?")
	icon_label.add_theme_font_size_override("font_size", 18)
	icon_label.add_theme_color_override("font_color", accent)
	icon_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	name_row.add_child(icon_label)

	var name_label := Label.new()
	var display_name: String = info.get("name", key.capitalize())
	if is_locked:
		display_name += "  [Locked]"
	name_label.text = display_name
	name_label.add_theme_font_size_override("font_size", 16)
	name_label.add_theme_color_override("font_color", COLOR_PARCHMENT if not is_locked else Color(COLOR_WORN_STONE, 0.5))
	name_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	name_row.add_child(name_label)

	# Description
	var desc := Label.new()
	desc.text = info.get("desc", "")
	desc.add_theme_font_size_override("font_size", 12)
	desc.add_theme_color_override("font_color", COLOR_WORN_STONE if not is_locked else Color(COLOR_WORN_STONE, 0.3))
	desc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD
	vbox.add_child(desc)

	# Make it clickable
	if not is_locked:
		card.mouse_filter = Control.MOUSE_FILTER_STOP
		card.gui_input.connect(func(event: InputEvent):
			if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
				_enter_district(key)
		)
		card.mouse_entered.connect(func():
			var hover_style := style.duplicate()
			hover_style.bg_color = Color(0.07, 0.075, 0.1, 0.95)
			hover_style.border_color = COLOR_EMBER
			hover_style.set_border_width_all(2)
			hover_style.border_width_left = 3
			card.add_theme_stylebox_override("panel", hover_style)
		)
		card.mouse_exited.connect(func():
			card.add_theme_stylebox_override("panel", style)
		)
	else:
		card.mouse_filter = Control.MOUSE_FILTER_STOP
		card.gui_input.connect(func(event: InputEvent):
			if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
				var bdata: Dictionary = _town_data.get("buildings", {}).get(key, {})
				EventBus.show_notification.emit(bdata.get("locked_text", "This place is not available."))
		)

	return card


# ============================================================
# Sub-Menu — district content with back button
# ============================================================

func _enter_district(key: String) -> void:
	_current_layer = key
	_clear_content()

	_sub_content = VBoxContainer.new()
	_sub_content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_sub_content.add_theme_constant_override("separation", 10)
	_panel_vbox.add_child(_sub_content)

	# Back button row
	var back_row := HBoxContainer.new()
	back_row.add_theme_constant_override("separation", 12)
	_sub_content.add_child(back_row)

	var back_btn := _create_action_button("< Back", COLOR_WORN_STONE, Vector2(80, 32))
	back_btn.pressed.connect(_show_quick_menu)
	back_row.add_child(back_btn)

	var info: Dictionary = DISTRICT_INFO.get(key, {})
	var district_title := Label.new()
	district_title.text = info.get("name", key.capitalize())
	district_title.add_theme_font_size_override("font_size", 18)
	district_title.add_theme_color_override("font_color", COLOR_EMBER)
	district_title.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	back_row.add_child(district_title)

	var sep := ColorRect.new()
	sep.custom_minimum_size = Vector2(0, 1)
	sep.color = Color(COLOR_IRON_BORDER, 0.4)
	_sub_content.add_child(sep)

	# District-specific content
	var buildings: Dictionary = _town_data.get("buildings", {})
	var bdata: Dictionary = buildings.get(key, {})

	match key:
		"inn":
			_show_inn_panel(bdata)
		"shop":
			_show_shop_panel(bdata)
		"blacksmith":
			_show_blacksmith_panel(bdata)
		"tavern":
			_show_tavern_panel(bdata)
		_:
			var locked_label := Label.new()
			locked_label.text = "Coming soon."
			locked_label.add_theme_font_size_override("font_size", 14)
			locked_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
			_sub_content.add_child(locked_label)


# ============================================================
# Content helpers
# ============================================================

func _clear_content() -> void:
	# Remove everything after the header separator (index 2+)
	while _panel_vbox.get_child_count() > 2:
		var child := _panel_vbox.get_child(_panel_vbox.get_child_count() - 1)
		_panel_vbox.remove_child(child)
		child.queue_free()
	_quick_content = null
	_sub_content = null
	_shop_panel = null


func _get_content_parent() -> VBoxContainer:
	return _sub_content if _sub_content else _quick_content


func _update_resource_labels() -> void:
	_gold_label.text = str(GameManager.gold)
	_food_label.text = str(GameManager.food)


func _create_action_button(text: String, accent: Color, min_size: Vector2) -> Button:
	var btn := Button.new()
	btn.text = text
	btn.custom_minimum_size = min_size
	btn.add_theme_font_size_override("font_size", 14)
	btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
	btn.add_theme_color_override("font_hover_color", accent)

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.06, 0.065, 0.09, 0.9)
	style.border_color = COLOR_IRON_BORDER
	style.set_border_width_all(1)
	style.set_corner_radius_all(3)
	style.content_margin_left = 10
	style.content_margin_right = 10
	style.content_margin_top = 6
	style.content_margin_bottom = 6
	btn.add_theme_stylebox_override("normal", style)

	var hover := style.duplicate()
	hover.border_color = accent
	hover.bg_color = Color(0.08, 0.085, 0.11, 0.95)
	btn.add_theme_stylebox_override("hover", hover)

	var pressed := style.duplicate()
	pressed.bg_color = Color(0.1, 0.09, 0.07, 0.6)
	pressed.border_color = accent
	btn.add_theme_stylebox_override("pressed", pressed)

	return btn


# ============================================================
# Inn
# ============================================================

func _show_inn_panel(bdata: Dictionary) -> void:
	var parent := _get_content_parent()
	var cost_per_unit: int = bdata.get("heal_cost_per_unit", 10)

	# Party list with HP bars
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	parent.add_child(scroll)

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

		var name_label := Label.new()
		name_label.custom_minimum_size = Vector2(120, 0)
		name_label.text = unit.unit_name
		name_label.add_theme_font_size_override("font_size", 14)
		name_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
		row.add_child(name_label)

		# HP bar
		var hp_bar := ProgressBar.new()
		hp_bar.custom_minimum_size = Vector2(140, 16)
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

		var hp_text := Label.new()
		hp_text.text = "%d / %d" % [unit.current_hp, unit.max_hp]
		hp_text.add_theme_font_size_override("font_size", 13)
		hp_text.add_theme_color_override("font_color", COLOR_PARCHMENT)
		hp_text.custom_minimum_size = Vector2(70, 0)
		row.add_child(hp_text)

		if unit.current_hp < unit.max_hp:
			injured_count += 1
			var heal_btn := _create_action_button("Heal (%dg)" % cost_per_unit, COLOR_MOSS, Vector2(100, 28))
			heal_btn.disabled = GameManager.gold < cost_per_unit
			heal_btn.add_theme_color_override("font_disabled_color", Color(COLOR_WORN_STONE, 0.4))

			var disabled_style := StyleBoxFlat.new()
			disabled_style.bg_color = Color(0.04, 0.04, 0.06, 0.7)
			disabled_style.border_color = Color(COLOR_IRON_BORDER, 0.3)
			disabled_style.set_border_width_all(1)
			disabled_style.set_corner_radius_all(3)
			disabled_style.content_margin_left = 6
			disabled_style.content_margin_right = 6
			disabled_style.content_margin_top = 2
			disabled_style.content_margin_bottom = 2
			heal_btn.add_theme_stylebox_override("disabled", disabled_style)

			var captured_unit := unit
			heal_btn.pressed.connect(func():
				if GameManager.spend_gold(cost_per_unit):
					captured_unit.current_hp = captured_unit.max_hp
					GameManager.party_changed.emit()
					EventBus.show_notification.emit("Healed %s to full HP." % captured_unit.unit_name)
					_enter_district("inn")  # Refresh
			)
			row.add_child(heal_btn)
		else:
			var full_label := Label.new()
			full_label.text = "Full HP"
			full_label.add_theme_font_size_override("font_size", 12)
			full_label.add_theme_color_override("font_color", COLOR_MOSS)
			row.add_child(full_label)

	# Heal All
	if injured_count > 0:
		var total_cost: int = cost_per_unit * injured_count
		var heal_all_row := HBoxContainer.new()
		heal_all_row.add_theme_constant_override("separation", 12)
		heal_all_row.alignment = BoxContainer.ALIGNMENT_END
		parent.add_child(heal_all_row)

		var cost_label := Label.new()
		cost_label.text = "%d injured  —  Total: %dg" % [injured_count, total_cost]
		cost_label.add_theme_font_size_override("font_size", 14)
		cost_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
		heal_all_row.add_child(cost_label)

		var heal_all_btn := _create_action_button("Heal All (%dg)" % total_cost, COLOR_MOSS, Vector2(140, 36))
		heal_all_btn.disabled = GameManager.gold < total_cost
		heal_all_btn.pressed.connect(func():
			if GameManager.spend_gold(total_cost):
				for u in GameManager.party:
					if u.is_alive():
						u.current_hp = u.max_hp
				GameManager.party_changed.emit()
				EventBus.show_notification.emit("All units healed to full HP.")
				_enter_district("inn")
		)
		heal_all_row.add_child(heal_all_btn)
	else:
		var all_good := Label.new()
		all_good.text = "All units are at full health."
		all_good.add_theme_font_size_override("font_size", 14)
		all_good.add_theme_color_override("font_color", COLOR_MOSS)
		parent.add_child(all_good)


# ============================================================
# Shop
# ============================================================

func _show_shop_panel(bdata: Dictionary) -> void:
	var parent := _get_content_parent()

	_shop_panel = ShopPanel.new()
	_shop_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_shop_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_shop_panel.gold_changed.connect(_update_resource_labels)
	parent.add_child(_shop_panel)

	var stock: Array = bdata.get("stock", [])
	_shop_panel.setup(stock)


# ============================================================
# Blacksmith
# ============================================================

func _show_blacksmith_panel(_bdata: Dictionary) -> void:
	var parent := _get_content_parent()

	var panel := BlacksmithPanel.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.gold_changed.connect(_update_resource_labels)
	parent.add_child(panel)
	panel.setup()


# ============================================================
# Tavern
# ============================================================

func _show_tavern_panel(bdata: Dictionary) -> void:
	var parent := _get_content_parent()

	# Buy a Round
	var actions_row := HBoxContainer.new()
	actions_row.add_theme_constant_override("separation", 12)
	parent.add_child(actions_row)

	var round_btn := _create_action_button("Buy a Round  (3g)", COLOR_EMBER, Vector2(160, 38))
	round_btn.disabled = GameManager.gold < 3
	round_btn.add_theme_color_override("font_disabled_color", Color(COLOR_WORN_STONE, 0.4))
	round_btn.pressed.connect(func():
		if GameManager.spend_gold(3):
			var tip: String = TAVERN_TIPS[randi() % TAVERN_TIPS.size()]
			EventBus.show_notification.emit(tip)
			_update_resource_labels()
			round_btn.disabled = GameManager.gold < 3
	)
	actions_row.add_child(round_btn)

	var round_desc := Label.new()
	round_desc.text = "Buy drinks and hear useful advice."
	round_desc.add_theme_font_size_override("font_size", 12)
	round_desc.add_theme_color_override("font_color", COLOR_WORN_STONE)
	round_desc.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	actions_row.add_child(round_desc)

	# Quest NPCs
	var quests: Array = bdata.get("quests", [])
	var visible_quests: Array = _get_visible_quests(quests)

	if not visible_quests.is_empty():
		var quest_sep := ColorRect.new()
		quest_sep.custom_minimum_size = Vector2(0, 1)
		quest_sep.color = Color(COLOR_IRON_BORDER, 0.3)
		parent.add_child(quest_sep)

		var quest_header := Label.new()
		quest_header.text = "Patrons"
		quest_header.add_theme_font_size_override("font_size", 15)
		quest_header.add_theme_color_override("font_color", COLOR_EMBER)
		parent.add_child(quest_header)

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
			parent.add_child(npc_panel)

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

			var talk_btn := _create_action_button("Talk", COLOR_EMBER, Vector2(70, 30))
			var captured_dialogue_id: String = quest_entry.get("dialogue_id", "")
			talk_btn.pressed.connect(func():
				if captured_dialogue_id != "":
					town_closed.emit()
					DialogueManager.start_dialogue(captured_dialogue_id)
			)
			npc_hbox.add_child(talk_btn)

	# Bounty Board
	if not GameManager.captured_enemies.is_empty():
		var bounty_sep := ColorRect.new()
		bounty_sep.custom_minimum_size = Vector2(0, 1)
		bounty_sep.color = Color(COLOR_IRON_BORDER, 0.3)
		parent.add_child(bounty_sep)

		var bounty_header := Label.new()
		bounty_header.text = "Bounty Board"
		bounty_header.add_theme_font_size_override("font_size", 15)
		bounty_header.add_theme_color_override("font_color", Color(0.6, 0.5, 0.8))
		parent.add_child(bounty_header)

		var bounty_board := BountyBoard.new()
		bounty_board.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		bounty_board.gold_changed.connect(_update_resource_labels)
		parent.add_child(bounty_board)

	# Rumors
	var rumors: Array = bdata.get("rumors", [])
	if not rumors.is_empty():
		var rumor_sep := ColorRect.new()
		rumor_sep.custom_minimum_size = Vector2(0, 1)
		rumor_sep.color = Color(COLOR_IRON_BORDER, 0.3)
		parent.add_child(rumor_sep)

		var rumor_header := Label.new()
		rumor_header.text = "Overheard Rumors"
		rumor_header.add_theme_font_size_override("font_size", 15)
		rumor_header.add_theme_color_override("font_color", COLOR_WORN_STONE)
		parent.add_child(rumor_header)

		var scroll := ScrollContainer.new()
		scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
		scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		parent.add_child(scroll)

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
# Quest helpers
# ============================================================

func _get_visible_quests(quests: Array) -> Array:
	var visible: Array = []
	for quest_entry in quests:
		if not quest_entry is Dictionary:
			continue
		var conditions: Array = quest_entry.get("show_conditions", [])
		if EventBus.check_conditions(conditions):
			visible.append(quest_entry)
	return visible


# ============================================================
# Navigation
# ============================================================

func _on_leave_pressed() -> void:
	town_closed.emit()


func _input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		if _current_layer != "quick":
			_show_quick_menu()
		else:
			town_closed.emit()
		get_viewport().set_input_as_handled()
