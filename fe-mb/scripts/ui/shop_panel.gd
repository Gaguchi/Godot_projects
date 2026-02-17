class_name ShopPanel
extends VBoxContainer
## ShopPanel - Buy/Sell interface for town shops.
## Loads items from the item catalog, displays them, handles transactions.

signal gold_changed  # Emitted when a transaction occurs so parent can update

# --- Palette ---
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

# --- State ---
var _catalog: Dictionary = {}
var _shop_stock: Array = []  # Array of item_id strings
var _mode: String = "buy"  # "buy" or "sell"

# --- UI Refs ---
var _gold_label: Label
var _buy_tab: Button
var _sell_tab: Button
var _item_list_container: VBoxContainer
var _item_scroll: ScrollContainer
var _detail_panel: VBoxContainer
var _detail_name: Label
var _detail_type: Label
var _detail_stats: Label
var _detail_desc: Label
var _action_area: VBoxContainer
var _unit_selector: OptionButton
var _action_btn: Button
var _selected_item_id: String = ""
var _selected_sell_index: int = -1
var _selected_sell_unit: Resource = null


func _ready() -> void:
	_load_catalog()
	_build_ui()


func setup(stock: Array) -> void:
	_shop_stock = stock
	_mode = "buy"
	_update_tabs()
	_refresh_item_list()
	_clear_detail()
	_update_gold_label()


func _load_catalog() -> void:
	var path := "res://data/items/item_catalog.json"
	if not FileAccess.file_exists(path):
		push_error("[ShopPanel] Item catalog not found: %s" % path)
		return
	var file := FileAccess.open(path, FileAccess.READ)
	var json := JSON.new()
	json.parse(file.get_as_text())
	file.close()
	if json.data is Dictionary:
		_catalog = json.data


func _build_ui() -> void:
	# Gold display
	var gold_row := HBoxContainer.new()
	gold_row.add_theme_constant_override("separation", 8)
	add_child(gold_row)

	var gold_icon := Label.new()
	gold_icon.text = "Gold:"
	gold_icon.add_theme_font_size_override("font_size", 15)
	gold_icon.add_theme_color_override("font_color", COLOR_EMBER)
	gold_row.add_child(gold_icon)

	_gold_label = Label.new()
	_gold_label.add_theme_font_size_override("font_size", 15)
	_gold_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
	gold_row.add_child(_gold_label)

	# Tab buttons
	var tab_row := HBoxContainer.new()
	tab_row.add_theme_constant_override("separation", 4)
	add_child(tab_row)

	_buy_tab = _make_tab_button("Buy")
	_buy_tab.pressed.connect(func(): _switch_mode("buy"))
	tab_row.add_child(_buy_tab)

	_sell_tab = _make_tab_button("Sell")
	_sell_tab.pressed.connect(func(): _switch_mode("sell"))
	tab_row.add_child(_sell_tab)

	# Main content: item list (left) + detail (right)
	var content := HBoxContainer.new()
	content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 8)
	add_child(content)

	# Item list (scrollable)
	_item_scroll = ScrollContainer.new()
	_item_scroll.custom_minimum_size = Vector2(280, 0)
	_item_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_item_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	content.add_child(_item_scroll)

	_item_list_container = VBoxContainer.new()
	_item_list_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_item_list_container.add_theme_constant_override("separation", 2)
	_item_scroll.add_child(_item_list_container)

	# Detail panel
	var detail_scroll := ScrollContainer.new()
	detail_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	detail_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	detail_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	content.add_child(detail_scroll)

	_detail_panel = VBoxContainer.new()
	_detail_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_detail_panel.add_theme_constant_override("separation", 6)
	detail_scroll.add_child(_detail_panel)

	_detail_name = Label.new()
	_detail_name.add_theme_font_size_override("font_size", 18)
	_detail_name.add_theme_color_override("font_color", COLOR_PARCHMENT)
	_detail_panel.add_child(_detail_name)

	_detail_type = Label.new()
	_detail_type.add_theme_font_size_override("font_size", 13)
	_detail_type.add_theme_color_override("font_color", COLOR_EMBER)
	_detail_panel.add_child(_detail_type)

	var detail_sep := ColorRect.new()
	detail_sep.custom_minimum_size = Vector2(0, 1)
	detail_sep.color = Color(COLOR_IRON_BORDER, 0.4)
	_detail_panel.add_child(detail_sep)

	_detail_stats = Label.new()
	_detail_stats.add_theme_font_size_override("font_size", 13)
	_detail_stats.add_theme_color_override("font_color", COLOR_PARCHMENT)
	_detail_panel.add_child(_detail_stats)

	_detail_desc = Label.new()
	_detail_desc.add_theme_font_size_override("font_size", 13)
	_detail_desc.add_theme_color_override("font_color", COLOR_WORN_STONE)
	_detail_desc.autowrap_mode = TextServer.AUTOWRAP_WORD
	_detail_panel.add_child(_detail_desc)

	# Action area
	_action_area = VBoxContainer.new()
	_action_area.add_theme_constant_override("separation", 6)
	_detail_panel.add_child(_action_area)

	_unit_selector = OptionButton.new()
	_unit_selector.add_theme_font_size_override("font_size", 13)
	_unit_selector.add_theme_color_override("font_color", COLOR_PARCHMENT)
	_action_area.add_child(_unit_selector)

	_action_btn = _make_action_button("Buy")
	_action_btn.pressed.connect(_on_action_pressed)
	_action_area.add_child(_action_btn)

	_action_area.visible = false


func _make_tab_button(text: String) -> Button:
	var btn := Button.new()
	btn.text = text
	btn.custom_minimum_size = Vector2(80, 32)
	btn.add_theme_font_size_override("font_size", 14)
	btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
	btn.add_theme_color_override("font_hover_color", COLOR_EMBER)

	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(0.06, 0.065, 0.09, 0.9)
	normal.border_color = COLOR_IRON_BORDER
	normal.set_border_width_all(1)
	normal.set_corner_radius_all(2)
	normal.content_margin_left = 8
	normal.content_margin_right = 8
	normal.content_margin_top = 4
	normal.content_margin_bottom = 4
	btn.add_theme_stylebox_override("normal", normal)

	var hover := normal.duplicate()
	hover.border_color = COLOR_EMBER
	btn.add_theme_stylebox_override("hover", hover)

	var pressed := normal.duplicate()
	pressed.bg_color = Color(0.1, 0.09, 0.07, 0.95)
	pressed.border_color = COLOR_EMBER
	btn.add_theme_stylebox_override("pressed", pressed)

	return btn


func _make_action_button(text: String) -> Button:
	var btn := Button.new()
	btn.text = text
	btn.custom_minimum_size = Vector2(0, 36)
	btn.add_theme_font_size_override("font_size", 14)
	btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
	btn.add_theme_color_override("font_hover_color", COLOR_MOSS)
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
	hover.border_color = COLOR_MOSS
	btn.add_theme_stylebox_override("hover", hover)

	var pressed := normal.duplicate()
	pressed.bg_color = Color(0.1, 0.1, 0.14, 0.95)
	pressed.border_color = COLOR_MOSS
	btn.add_theme_stylebox_override("pressed", pressed)

	var disabled := normal.duplicate()
	disabled.bg_color = Color(0.04, 0.04, 0.06, 0.7)
	disabled.border_color = Color(COLOR_IRON_BORDER, 0.3)
	btn.add_theme_stylebox_override("disabled", disabled)

	return btn


# ============================================================
# Mode Switching
# ============================================================

func _switch_mode(mode: String) -> void:
	_mode = mode
	_update_tabs()
	_refresh_item_list()
	_clear_detail()


func _update_tabs() -> void:
	# Highlight active tab
	if _mode == "buy":
		_buy_tab.add_theme_color_override("font_color", COLOR_EMBER)
		_sell_tab.add_theme_color_override("font_color", COLOR_WORN_STONE)
	else:
		_buy_tab.add_theme_color_override("font_color", COLOR_WORN_STONE)
		_sell_tab.add_theme_color_override("font_color", COLOR_EMBER)


func _update_gold_label() -> void:
	_gold_label.text = "%d" % GameManager.gold


func _clear_detail() -> void:
	_detail_name.text = ""
	_detail_type.text = ""
	_detail_stats.text = ""
	_detail_desc.text = "Select an item to view details."
	_action_area.visible = false
	_selected_item_id = ""
	_selected_sell_index = -1
	_selected_sell_unit = null


# ============================================================
# Item List Population
# ============================================================

func _refresh_item_list() -> void:
	for child in _item_list_container.get_children():
		child.queue_free()

	if _mode == "buy":
		_populate_buy_list()
	else:
		_populate_sell_list()


func _populate_buy_list() -> void:
	for item_id in _shop_stock:
		if item_id not in _catalog:
			continue
		var data: Dictionary = _catalog[item_id]
		var row := _create_item_row(
			data.get("item_name", "???"),
			_get_type_letter(data),
			"%dg" % data.get("buy_price", 0),
			GameManager.gold < data.get("buy_price", 0)
		)
		var captured_id: String = item_id
		row.pressed.connect(func(): _on_buy_item_selected(captured_id))
		_item_list_container.add_child(row)


func _populate_sell_list() -> void:
	# Add unit selector header
	var unit_row := HBoxContainer.new()
	unit_row.add_theme_constant_override("separation", 8)
	_item_list_container.add_child(unit_row)

	var unit_label := Label.new()
	unit_label.text = "Unit:"
	unit_label.add_theme_font_size_override("font_size", 13)
	unit_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
	unit_row.add_child(unit_label)

	var sell_unit_opt := OptionButton.new()
	sell_unit_opt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sell_unit_opt.add_theme_font_size_override("font_size", 13)
	for i in range(GameManager.party.size()):
		var unit = GameManager.party[i]
		if unit.is_alive():
			var inv_count: int = unit.inventory.size()
			sell_unit_opt.add_item("%s (%d items)" % [unit.unit_name, inv_count], i)
	unit_row.add_child(sell_unit_opt)

	if sell_unit_opt.item_count > 0:
		sell_unit_opt.item_selected.connect(func(idx: int):
			var unit_idx: int = sell_unit_opt.get_item_id(idx)
			_refresh_sell_items(GameManager.party[unit_idx])
		)
		# Show first unit's items
		var first_idx: int = sell_unit_opt.get_item_id(0)
		_refresh_sell_items(GameManager.party[first_idx])


func _refresh_sell_items(unit: Resource) -> void:
	# Remove everything after the unit selector row (index 0)
	var children = _item_list_container.get_children()
	for i in range(children.size() - 1, 0, -1):
		children[i].queue_free()

	_selected_sell_unit = unit

	if unit.inventory.is_empty() and unit.equipped_weapon == null:
		var empty_label := Label.new()
		empty_label.text = "  No items."
		empty_label.add_theme_font_size_override("font_size", 13)
		empty_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
		_item_list_container.add_child(empty_label)
		return

	# Show equipped weapon
	if unit.equipped_weapon:
		var weap: Resource = unit.equipped_weapon
		var row := _create_item_row(
			weap.item_name + " (Equipped)",
			_get_type_letter_from_item(weap),
			"%dg" % weap.sell_price,
			false
		)
		row.pressed.connect(func(): _on_sell_item_selected(unit, -1, weap))
		_item_list_container.add_child(row)

	# Show inventory items
	for i in range(unit.inventory.size()):
		var item: Resource = unit.inventory[i]
		var row := _create_item_row(
			item.item_name,
			_get_type_letter_from_item(item),
			"%dg" % item.sell_price,
			false
		)
		var captured_i: int = i
		var captured_item: Resource = item
		row.pressed.connect(func(): _on_sell_item_selected(unit, captured_i, captured_item))
		_item_list_container.add_child(row)


func _create_item_row(item_name: String, type_letter: String, price_text: String, dimmed: bool) -> Button:
	var btn := Button.new()
	btn.custom_minimum_size = Vector2(0, 32)
	btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
	btn.add_theme_font_size_override("font_size", 13)

	var color := COLOR_PARCHMENT if not dimmed else Color(COLOR_WORN_STONE, 0.5)
	btn.add_theme_color_override("font_color", color)
	btn.add_theme_color_override("font_hover_color", COLOR_EMBER)

	# Compose display: [S] Iron Sword      460g
	btn.text = "  [%s]  %s        %s" % [type_letter, item_name, price_text]

	var normal := StyleBoxFlat.new()
	normal.bg_color = COLOR_ROW_BG
	normal.set_border_width_all(0)
	normal.set_corner_radius_all(2)
	normal.content_margin_left = 4
	normal.content_margin_right = 4
	normal.content_margin_top = 2
	normal.content_margin_bottom = 2
	btn.add_theme_stylebox_override("normal", normal)

	var hover := normal.duplicate()
	hover.bg_color = COLOR_ROW_HOVER
	hover.border_color = COLOR_EMBER
	hover.border_width_left = 2
	btn.add_theme_stylebox_override("hover", hover)

	var pressed := normal.duplicate()
	pressed.bg_color = COLOR_ROW_SELECTED
	pressed.border_color = COLOR_EMBER
	pressed.border_width_left = 2
	btn.add_theme_stylebox_override("pressed", pressed)

	return btn


# ============================================================
# Detail + Actions
# ============================================================

func _on_buy_item_selected(item_id: String) -> void:
	_selected_item_id = item_id
	var data: Dictionary = _catalog[item_id]

	_detail_name.text = data.get("item_name", "???")
	_detail_type.text = _get_full_type_text(data)
	_detail_stats.text = _format_stats(data)
	_detail_desc.text = data.get("description", "")

	# Setup unit selector for who receives the item
	_unit_selector.clear()
	_unit_selector.visible = true
	for i in range(GameManager.party.size()):
		var unit = GameManager.party[i]
		if unit.is_alive():
			var inv_count: int = unit.inventory.size()
			var suffix := " (FULL)" if inv_count >= 5 else " (%d/5)" % inv_count
			_unit_selector.add_item(unit.unit_name + suffix, i)

	var price: int = data.get("buy_price", 0)
	_action_btn.text = "Buy — %dg" % price
	_action_btn.disabled = GameManager.gold < price
	_action_area.visible = true


func _on_sell_item_selected(unit: Resource, inv_index: int, item: Resource) -> void:
	_selected_sell_unit = unit
	_selected_sell_index = inv_index
	_selected_item_id = ""

	_detail_name.text = item.item_name
	if inv_index == -1:
		_detail_name.text += " (Equipped)"
	_detail_type.text = _get_full_type_text_from_item(item)
	_detail_stats.text = _format_stats_from_item(item)
	_detail_desc.text = item.description

	_unit_selector.visible = false
	var sell_price: int = item.sell_price
	_action_btn.text = "Sell — +%dg" % sell_price
	_action_btn.disabled = false
	_action_area.visible = true


func _on_action_pressed() -> void:
	if _mode == "buy":
		_execute_buy()
	else:
		_execute_sell()


func _execute_buy() -> void:
	if _selected_item_id.is_empty() or _selected_item_id not in _catalog:
		return

	var data: Dictionary = _catalog[_selected_item_id]
	var price: int = data.get("buy_price", 0)

	if not GameManager.spend_gold(price):
		EventBus.show_notification.emit("Not enough gold!")
		return

	# Special: food_rations adds food directly
	if _selected_item_id == "food_rations":
		GameManager.food += 3
		GameManager.resources_changed.emit()
		EventBus.show_notification.emit("Bought Food Rations. +3 food.")
		_update_gold_label()
		gold_changed.emit()
		_refresh_item_list()
		# Re-select same item to refresh affordability
		_on_buy_item_selected(_selected_item_id)
		return

	# Get target unit
	if _unit_selector.item_count == 0:
		return
	var unit_idx: int = _unit_selector.get_item_id(_unit_selector.selected)
	if unit_idx < 0 or unit_idx >= GameManager.party.size():
		return
	var unit: Resource = GameManager.party[unit_idx]

	if unit.inventory.size() >= 5:
		EventBus.show_notification.emit("%s's inventory is full!" % unit.unit_name)
		return

	var item := ItemData.create_from_dict(data)
	unit.add_item(item)
	GameManager.party_changed.emit()

	EventBus.show_notification.emit("Bought %s for %s." % [item.item_name, unit.unit_name])
	_update_gold_label()
	gold_changed.emit()
	_refresh_item_list()
	_on_buy_item_selected(_selected_item_id)


func _execute_sell() -> void:
	if _selected_sell_unit == null:
		return

	var item: Resource
	if _selected_sell_index == -1:
		# Selling equipped weapon — remove directly (don't move to inventory)
		item = _selected_sell_unit.equipped_weapon
		if item == null:
			return
		_selected_sell_unit.equipped_weapon = null
		# Auto-equip first weapon from inventory
		for i in range(_selected_sell_unit.inventory.size()):
			if _selected_sell_unit.inventory[i].item_type == ItemData.ItemType.WEAPON:
				_selected_sell_unit.equip_item(i)
				break
	else:
		if _selected_sell_index >= _selected_sell_unit.inventory.size():
			return
		item = _selected_sell_unit.remove_item(_selected_sell_index)
		if item == null:
			return

	GameManager.add_gold(item.sell_price)
	GameManager.party_changed.emit()

	EventBus.show_notification.emit("Sold %s for %dg." % [item.item_name, item.sell_price])
	_update_gold_label()
	gold_changed.emit()
	_clear_detail()
	_refresh_item_list()


# ============================================================
# Formatting Helpers
# ============================================================

func _get_type_letter(data: Dictionary) -> String:
	var wt: String = str(data.get("weapon_type", "NONE"))
	match wt:
		"SWORD": return "S"
		"LANCE": return "L"
		"AXE": return "A"
		"BOW": return "B"
		"TOME": return "T"
		"STAFF": return "St"
		_:
			var it: String = str(data.get("item_type", "WEAPON"))
			if it == "CONSUMABLE":
				return "C"
			return "?"


func _get_type_letter_from_item(item: Resource) -> String:
	match item.weapon_type:
		ItemData.WeaponType.SWORD: return "S"
		ItemData.WeaponType.LANCE: return "L"
		ItemData.WeaponType.AXE: return "A"
		ItemData.WeaponType.BOW: return "B"
		ItemData.WeaponType.TOME: return "T"
		ItemData.WeaponType.STAFF: return "St"
		_:
			if item.item_type == ItemData.ItemType.CONSUMABLE:
				return "C"
			return "?"


func _get_full_type_text(data: Dictionary) -> String:
	var it: String = str(data.get("item_type", "WEAPON"))
	var wt: String = str(data.get("weapon_type", "NONE"))
	if it == "WEAPON" and wt != "NONE":
		return "%s — Weapon" % wt.capitalize()
	elif it == "CONSUMABLE":
		return "Consumable"
	return it.capitalize()


func _get_full_type_text_from_item(item: Resource) -> String:
	if item.item_type == ItemData.ItemType.WEAPON and item.weapon_type != ItemData.WeaponType.NONE:
		return "%s — Weapon" % item.get_weapon_type_name()
	elif item.item_type == ItemData.ItemType.CONSUMABLE:
		return "Consumable"
	return "Item"


func _format_stats(data: Dictionary) -> String:
	var it: String = str(data.get("item_type", "WEAPON"))
	if it == "WEAPON":
		var parts: Array[String] = []
		parts.append("Mt: %d" % data.get("might", 0))
		parts.append("Hit: %d" % data.get("hit", 0))
		if data.get("crit", 0) > 0:
			parts.append("Crit: %d" % data.get("crit", 0))
		parts.append("Wt: %d" % data.get("weight", 0))
		var rmin: int = data.get("range_min", 1)
		var rmax: int = data.get("range_max", 1)
		if rmin == rmax:
			parts.append("Rng: %d" % rmin)
		else:
			parts.append("Rng: %d-%d" % [rmin, rmax])
		parts.append("Uses: %d" % data.get("max_uses", 1))
		return "  ".join(parts)
	elif it == "CONSUMABLE":
		var parts: Array[String] = []
		if data.get("heal_amount", 0) > 0:
			var ha: int = data.get("heal_amount", 0)
			parts.append("Heals: %s HP" % ("MAX" if ha >= 999 else str(ha)))
		parts.append("Uses: %d" % data.get("max_uses", 1))
		return "  ".join(parts)
	return ""


func _format_stats_from_item(item: Resource) -> String:
	if item.item_type == ItemData.ItemType.WEAPON:
		var parts: Array[String] = []
		parts.append("Mt: %d" % item.might)
		parts.append("Hit: %d" % item.hit)
		if item.crit > 0:
			parts.append("Crit: %d" % item.crit)
		parts.append("Wt: %d" % item.weight)
		if item.range_min == item.range_max:
			parts.append("Rng: %d" % item.range_min)
		else:
			parts.append("Rng: %d-%d" % [item.range_min, item.range_max])
		parts.append("Uses: %d/%d" % [item.current_uses, item.max_uses])
		return "  ".join(parts)
	elif item.item_type == ItemData.ItemType.CONSUMABLE:
		var parts: Array[String] = []
		if item.heal_amount > 0:
			parts.append("Heals: %s HP" % ("MAX" if item.heal_amount >= 999 else str(item.heal_amount)))
		parts.append("Uses: %d/%d" % [item.current_uses, item.max_uses])
		return "  ".join(parts)
	return ""
