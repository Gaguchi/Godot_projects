extends Control
## Inventory Screen — Stone & Steel styled item management.
## Custom inventory rows, item detail panel, styled trade overlay.

signal close_requested

# Unit List Panel
@onready var unit_list_container: VBoxContainer = $MarginContainer/Content/UnitListPanel/VBox/Scroll/UnitListContainer

# Inventory Panel - Header (hidden, replaced by custom header)
@onready var unit_info_label: Label = $MarginContainer/Content/InventoryPanel/VBox/Header/UnitInfoLabel
@onready var stats_label: Label = $MarginContainer/Content/InventoryPanel/VBox/Header/StatsLabel

# Inventory Panel - Equipment
@onready var weapon_label: Label = $MarginContainer/Content/InventoryPanel/VBox/EquipmentSection/HBox/WeaponLabel
@onready var unequip_btn: Button = $MarginContainer/Content/InventoryPanel/VBox/EquipmentSection/HBox/UnequipBtn

# Inventory Panel - List & Actions (ItemList hidden, replaced by custom rows)
@onready var inventory_list: ItemList = $MarginContainer/Content/InventoryPanel/VBox/InventorySection/InventoryList
@onready var equip_btn: Button = $MarginContainer/Content/InventoryPanel/VBox/ActionButtons/EquipBtn
@onready var use_btn: Button = $MarginContainer/Content/InventoryPanel/VBox/ActionButtons/UseBtn
@onready var give_btn: Button = $MarginContainer/Content/InventoryPanel/VBox/ActionButtons/GiveBtn

# Overlays
@onready var close_btn: Button = $CloseBtn
@onready var trade_overlay: Control = $TradeOverlay
@onready var recipient_list: VBoxContainer = $TradeOverlay/Panel/VBox/Scroll/RecipientList
@onready var cancel_trade_btn: Button = $TradeOverlay/Panel/VBox/CancelTradeBtn

# State
var selected_unit: UnitData = null
var selected_item_index: int = -1
var _selected_unit_btn: Button = null
var _selected_item_btn: Button = null
var _row_styles: Dictionary = {}
var _weapon_card: PanelContainer = null
var _custom_item_container: VBoxContainer = null
var _custom_header: HBoxContainer = null
var _detail_panel: PanelContainer = null


func _ready() -> void:
	close_btn.pressed.connect(_on_close_pressed)
	unequip_btn.pressed.connect(_on_unequip_pressed)
	equip_btn.pressed.connect(_on_equip_pressed)
	use_btn.pressed.connect(_on_use_pressed)
	give_btn.pressed.connect(_on_give_pressed)
	cancel_trade_btn.pressed.connect(_on_cancel_trade_pressed)

	_apply_styling()
	_refresh_unit_list()

	# Emergency cleanup of blockers
	var root = get_tree().root
	if root.has_node("LoadingScreen"):
		root.get_node("LoadingScreen").queue_free()

	if not GameManager.party.is_empty():
		_select_unit(GameManager.party[0])

	trade_overlay.hide()
	_update_action_buttons()


func _apply_styling() -> void:
	_row_styles = UIFactory.create_row_styleboxes()

	# Hide .tscn defaults — replaced by custom elements
	unit_info_label.visible = false
	stats_label.visible = false
	weapon_label.visible = false
	inventory_list.visible = false

	# Style "Party Members" header
	var party_label := $MarginContainer/Content/UnitListPanel/VBox/Label as Label
	party_label.add_theme_color_override("font_color", UIFactory.COLOR_EMBER)
	party_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	party_label.add_theme_constant_override("shadow_offset_x", 1)
	party_label.add_theme_constant_override("shadow_offset_y", 1)

	# Style section headers
	var equip_header := $MarginContainer/Content/InventoryPanel/VBox/EquipmentSection/Label as Label
	equip_header.add_theme_color_override("font_color", UIFactory.COLOR_EMBER)
	equip_header.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	equip_header.add_theme_constant_override("shadow_offset_x", 1)
	equip_header.add_theme_constant_override("shadow_offset_y", 1)

	var inv_header := $MarginContainer/Content/InventoryPanel/VBox/InventorySection/Label as Label
	inv_header.add_theme_color_override("font_color", UIFactory.COLOR_EMBER)
	inv_header.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	inv_header.add_theme_constant_override("shadow_offset_x", 1)
	inv_header.add_theme_constant_override("shadow_offset_y", 1)

	# Style all buttons
	UIFactory.style_button(close_btn, UIFactory.COLOR_BLOOD)
	UIFactory.style_button(unequip_btn, UIFactory.COLOR_BLOOD)
	UIFactory.style_button(equip_btn, UIFactory.COLOR_EMBER)
	UIFactory.style_button(use_btn, UIFactory.COLOR_MOSS)
	UIFactory.style_button(give_btn, UIFactory.COLOR_WORN_STONE)
	UIFactory.style_button(cancel_trade_btn, UIFactory.COLOR_BLOOD)

	# Style trade overlay header
	var trade_header := $TradeOverlay/Panel/VBox/Label as Label
	trade_header.add_theme_color_override("font_color", UIFactory.COLOR_EMBER)

	# Build custom header (replaces hidden UnitInfoLabel + StatsLabel)
	_build_custom_header()

	# Build custom inventory scroll (replaces hidden ItemList)
	_build_custom_inventory()


func _build_custom_header() -> void:
	var header_vbox := $MarginContainer/Content/InventoryPanel/VBox/Header as VBoxContainer
	_custom_header = HBoxContainer.new()
	_custom_header.add_theme_constant_override("separation", 12)
	header_vbox.add_child(_custom_header)
	header_vbox.move_child(_custom_header, 0)


func _build_custom_inventory() -> void:
	var inv_section := $MarginContainer/Content/InventoryPanel/VBox/InventorySection as VBoxContainer

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL

	_custom_item_container = VBoxContainer.new()
	_custom_item_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_custom_item_container.add_theme_constant_override("separation", 4)
	scroll.add_child(_custom_item_container)

	# Add after the hidden ItemList
	inv_section.add_child(scroll)
	inv_section.move_child(scroll, inventory_list.get_index() + 1)

	# Item detail panel (shown when an item is selected)
	_detail_panel = PanelContainer.new()
	_detail_panel.visible = false
	var detail_style := StyleBoxFlat.new()
	detail_style.bg_color = UIFactory.COLOR_ROW_BG
	detail_style.border_color = UIFactory.COLOR_IRON_BORDER
	detail_style.set_border_width_all(1)
	detail_style.set_corner_radius_all(3)
	detail_style.set_content_margin_all(10)
	_detail_panel.add_theme_stylebox_override("panel", detail_style)
	inv_section.add_child(_detail_panel)


# ---- Unit List ----

func _refresh_unit_list() -> void:
	for child in unit_list_container.get_children():
		child.queue_free()
	_selected_unit_btn = null

	for unit in GameManager.party:
		var btn := _create_unit_row(unit)
		unit_list_container.add_child(btn)
		if unit == selected_unit:
			_highlight_unit_row(btn)


func _create_unit_row(unit: UnitData) -> Button:
	var btn := Button.new()
	btn.custom_minimum_size = Vector2(0, 52)
	btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
	btn.add_theme_stylebox_override("normal", _row_styles.normal.duplicate())
	btn.add_theme_stylebox_override("hover", _row_styles.hover.duplicate())
	btn.add_theme_stylebox_override("pressed", _row_styles.selected.duplicate())
	btn.add_theme_stylebox_override("focus", StyleBoxEmpty.new())

	var row := HBoxContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.anchors_preset = Control.PRESET_FULL_RECT
	row.offset_left = 10
	row.offset_right = -8
	row.offset_top = 4
	row.offset_bottom = -4
	row.add_theme_constant_override("separation", 8)
	btn.add_child(row)

	var circle := UIFactory.create_class_circle(unit.unit_class, 32)
	circle.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(circle)

	var info := VBoxContainer.new()
	info.mouse_filter = Control.MOUSE_FILTER_IGNORE
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	info.add_theme_constant_override("separation", 0)

	var nm := Label.new()
	nm.text = unit.unit_name
	nm.add_theme_font_size_override("font_size", 13)
	nm.add_theme_color_override("font_color", UIFactory.COLOR_PARCHMENT)
	nm.mouse_filter = Control.MOUSE_FILTER_IGNORE
	info.add_child(nm)

	var it := Label.new()
	it.text = "Items: %d" % unit.inventory.size()
	it.add_theme_font_size_override("font_size", 10)
	it.add_theme_color_override("font_color", UIFactory.COLOR_WORN_STONE)
	it.mouse_filter = Control.MOUSE_FILTER_IGNORE
	info.add_child(it)

	row.add_child(info)

	btn.pressed.connect(_on_unit_btn_pressed.bind(unit, btn))
	return btn


func _highlight_unit_row(btn: Button) -> void:
	if _selected_unit_btn and is_instance_valid(_selected_unit_btn):
		_selected_unit_btn.add_theme_stylebox_override("normal", _row_styles.normal.duplicate())
	_selected_unit_btn = btn
	btn.add_theme_stylebox_override("normal", _row_styles.selected.duplicate())


func _on_unit_btn_pressed(unit: UnitData, btn: Button) -> void:
	_select_unit(unit)
	_highlight_unit_row(btn)


func _select_unit(unit: UnitData) -> void:
	selected_unit = unit
	selected_item_index = -1
	_selected_item_btn = null
	_refresh_display()


# ---- Display Refresh ----

func _refresh_display() -> void:
	if not selected_unit:
		return

	_update_custom_header()
	_update_weapon_card()
	unequip_btn.disabled = selected_unit.equipped_weapon == null
	_refresh_inventory_rows()
	_update_detail_panel()
	_update_action_buttons()


func _update_custom_header() -> void:
	for child in _custom_header.get_children():
		child.queue_free()

	# Class circle
	var circle := UIFactory.create_class_circle(selected_unit.unit_class, 48)
	_custom_header.add_child(circle)

	# Info block
	var info := VBoxContainer.new()
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	info.add_theme_constant_override("separation", 2)

	# Name row: Name + Class + Level
	var name_row := HBoxContainer.new()
	name_row.add_theme_constant_override("separation", 12)

	var nm := Label.new()
	nm.text = selected_unit.unit_name
	nm.add_theme_font_size_override("font_size", 22)
	nm.add_theme_color_override("font_color", UIFactory.COLOR_PARCHMENT)
	nm.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.5))
	nm.add_theme_constant_override("shadow_offset_x", 1)
	nm.add_theme_constant_override("shadow_offset_y", 1)
	name_row.add_child(nm)

	var cls := Label.new()
	cls.text = selected_unit.get_class_name()
	cls.add_theme_font_size_override("font_size", 14)
	cls.add_theme_color_override("font_color", UIFactory.CLASS_COLORS.get(selected_unit.unit_class, UIFactory.COLOR_WORN_STONE))
	cls.size_flags_vertical = Control.SIZE_SHRINK_END
	name_row.add_child(cls)

	var lv := Label.new()
	lv.text = "Lv %d" % selected_unit.level
	lv.add_theme_font_size_override("font_size", 14)
	lv.add_theme_color_override("font_color", UIFactory.COLOR_EMBER)
	lv.size_flags_vertical = Control.SIZE_SHRINK_END
	name_row.add_child(lv)

	info.add_child(name_row)

	# Compact stat row: HP + key combat stats
	var stat_row := HBoxContainer.new()
	stat_row.add_theme_constant_override("separation", 16)

	var hp_color := UIFactory.get_hp_color(selected_unit.current_hp, selected_unit.max_hp)
	var hp_text := Label.new()
	hp_text.text = "HP %d/%d" % [selected_unit.current_hp, selected_unit.max_hp]
	hp_text.add_theme_font_size_override("font_size", 12)
	hp_text.add_theme_color_override("font_color", hp_color)
	stat_row.add_child(hp_text)

	for s in [["STR", selected_unit.strength], ["MAG", selected_unit.magic], ["SPD", selected_unit.speed], ["DEF", selected_unit.defense]]:
		var sl := Label.new()
		sl.text = "%s %d" % [s[0], s[1]]
		sl.add_theme_font_size_override("font_size", 12)
		sl.add_theme_color_override("font_color", UIFactory.COLOR_WORN_STONE)
		stat_row.add_child(sl)

	info.add_child(stat_row)
	_custom_header.add_child(info)


func _update_weapon_card() -> void:
	if _weapon_card and is_instance_valid(_weapon_card):
		_weapon_card.queue_free()
		_weapon_card = null

	var equip_hbox := $MarginContainer/Content/InventoryPanel/VBox/EquipmentSection/HBox as HBoxContainer

	if selected_unit.equipped_weapon and selected_unit.equipped_weapon is ItemData:
		_weapon_card = UIFactory.create_weapon_card(selected_unit.equipped_weapon as ItemData)
		_weapon_card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	else:
		_weapon_card = PanelContainer.new()
		_weapon_card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var style := StyleBoxFlat.new()
		style.bg_color = Color(0, 0, 0, 0)
		_weapon_card.add_theme_stylebox_override("panel", style)
		var lbl := Label.new()
		lbl.text = "No weapon equipped"
		lbl.add_theme_font_size_override("font_size", 14)
		lbl.add_theme_color_override("font_color", UIFactory.COLOR_WORN_STONE)
		_weapon_card.add_child(lbl)

	# Insert before the unequip button
	equip_hbox.add_child(_weapon_card)
	equip_hbox.move_child(_weapon_card, 0)


# ---- Custom Inventory Rows ----

func _refresh_inventory_rows() -> void:
	for child in _custom_item_container.get_children():
		child.queue_free()
	_selected_item_btn = null

	for i in range(selected_unit.inventory.size()):
		var item: ItemData = selected_unit.inventory[i]
		var btn := _create_item_row(item, i)
		_custom_item_container.add_child(btn)

		if i == selected_item_index:
			_highlight_item_row(btn)


func _create_item_row(item: ItemData, index: int) -> Button:
	var btn := Button.new()
	btn.custom_minimum_size = Vector2(0, 40)
	btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
	btn.add_theme_stylebox_override("normal", _row_styles.normal.duplicate())
	btn.add_theme_stylebox_override("hover", _row_styles.hover.duplicate())
	btn.add_theme_stylebox_override("pressed", _row_styles.selected.duplicate())
	btn.add_theme_stylebox_override("focus", StyleBoxEmpty.new())

	var row := HBoxContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.anchors_preset = Control.PRESET_FULL_RECT
	row.offset_left = 10
	row.offset_right = -8
	row.offset_top = 4
	row.offset_bottom = -4
	row.add_theme_constant_override("separation", 8)
	btn.add_child(row)

	# Type indicator
	var type_lbl := Label.new()
	if item.item_type == ItemData.ItemType.WEAPON:
		type_lbl.text = UIFactory.WEAPON_SHORT.get(item.weapon_type, "[-]")
		type_lbl.add_theme_color_override("font_color", UIFactory.COLOR_EMBER)
	elif item.item_type == ItemData.ItemType.CONSUMABLE:
		type_lbl.text = "[U]"
		type_lbl.add_theme_color_override("font_color", UIFactory.COLOR_MOSS)
	else:
		type_lbl.text = "[K]"
		type_lbl.add_theme_color_override("font_color", UIFactory.COLOR_WORN_STONE)
	type_lbl.add_theme_font_size_override("font_size", 12)
	type_lbl.custom_minimum_size = Vector2(28, 0)
	type_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(type_lbl)

	# Item name
	var nm := Label.new()
	nm.text = item.item_name
	nm.add_theme_font_size_override("font_size", 14)
	nm.add_theme_color_override("font_color", UIFactory.COLOR_PARCHMENT)
	nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	nm.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(nm)

	# Summary stat
	var summary := Label.new()
	if item.item_type == ItemData.ItemType.WEAPON:
		summary.text = "Mt %d  Hit %d" % [item.might, item.hit]
	elif item.item_type == ItemData.ItemType.CONSUMABLE and item.heal_amount > 0:
		summary.text = "Heal %d" % item.heal_amount
	else:
		summary.text = ""
	summary.add_theme_font_size_override("font_size", 12)
	summary.add_theme_color_override("font_color", UIFactory.COLOR_WORN_STONE)
	summary.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(summary)

	btn.pressed.connect(_on_item_row_pressed.bind(index, btn))
	return btn


func _on_item_row_pressed(index: int, btn: Button) -> void:
	if selected_item_index == index:
		# Deselect on re-click
		selected_item_index = -1
		_highlight_item_row(null)
	else:
		selected_item_index = index
		_highlight_item_row(btn)
	_update_detail_panel()
	_update_action_buttons()


func _highlight_item_row(btn: Button) -> void:
	if _selected_item_btn and is_instance_valid(_selected_item_btn):
		_selected_item_btn.add_theme_stylebox_override("normal", _row_styles.normal.duplicate())
	_selected_item_btn = btn
	if btn:
		btn.add_theme_stylebox_override("normal", _row_styles.selected.duplicate())


# ---- Item Detail Panel ----

func _update_detail_panel() -> void:
	for child in _detail_panel.get_children():
		child.queue_free()

	if selected_item_index == -1 or not selected_unit:
		_detail_panel.visible = false
		return
	if selected_item_index >= selected_unit.inventory.size():
		_detail_panel.visible = false
		return

	_detail_panel.visible = true
	var item: ItemData = selected_unit.inventory[selected_item_index]

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 6)

	# Item name
	var nm := Label.new()
	nm.text = item.item_name
	nm.add_theme_font_size_override("font_size", 16)
	nm.add_theme_color_override("font_color", UIFactory.COLOR_PARCHMENT)
	vbox.add_child(nm)

	# Type
	var type_text := ""
	if item.item_type == ItemData.ItemType.WEAPON:
		type_text = item.get_weapon_type_name()
	elif item.item_type == ItemData.ItemType.CONSUMABLE:
		type_text = "Consumable"
	else:
		type_text = "Key Item"
	var tp := Label.new()
	tp.text = type_text
	tp.add_theme_font_size_override("font_size", 12)
	tp.add_theme_color_override("font_color", UIFactory.COLOR_EMBER)
	vbox.add_child(tp)

	vbox.add_child(UIFactory.create_separator())

	# Stats
	if item.item_type == ItemData.ItemType.WEAPON:
		var stats_row := HBoxContainer.new()
		stats_row.add_theme_constant_override("separation", 20)
		for s in [["Mt", item.might], ["Hit", item.hit], ["Crit", item.crit], ["Wt", item.weight]]:
			stats_row.add_child(UIFactory.create_stat_pair(s[0], s[1], 28))
		vbox.add_child(stats_row)

		var extra_row := HBoxContainer.new()
		extra_row.add_theme_constant_override("separation", 20)
		var rng_text := "%d" % item.range_min if item.range_min == item.range_max else "%d-%d" % [item.range_min, item.range_max]
		# Range pair
		var rng_pair := HBoxContainer.new()
		rng_pair.add_theme_constant_override("separation", 4)
		var rng_name := Label.new()
		rng_name.text = "Rng"
		rng_name.add_theme_font_size_override("font_size", 12)
		rng_name.add_theme_color_override("font_color", UIFactory.COLOR_WORN_STONE)
		rng_pair.add_child(rng_name)
		var rng_val := Label.new()
		rng_val.text = rng_text
		rng_val.add_theme_font_size_override("font_size", 16)
		rng_val.add_theme_color_override("font_color", UIFactory.COLOR_PARCHMENT)
		rng_pair.add_child(rng_val)
		extra_row.add_child(rng_pair)
		if not item.is_unbreakable:
			extra_row.add_child(UIFactory.create_stat_pair("Uses", item.current_uses, 32))
		vbox.add_child(extra_row)

	elif item.item_type == ItemData.ItemType.CONSUMABLE and item.heal_amount > 0:
		var heal_lbl := Label.new()
		heal_lbl.text = "Restores %d HP" % item.heal_amount
		heal_lbl.add_theme_font_size_override("font_size", 14)
		heal_lbl.add_theme_color_override("font_color", UIFactory.COLOR_MOSS)
		vbox.add_child(heal_lbl)

	# Description
	if not item.description.is_empty():
		vbox.add_child(UIFactory.create_separator())
		var desc := Label.new()
		desc.text = item.description
		desc.add_theme_font_size_override("font_size", 12)
		desc.add_theme_color_override("font_color", UIFactory.COLOR_WORN_STONE)
		desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		vbox.add_child(desc)

	_detail_panel.add_child(vbox)


func _update_action_buttons() -> void:
	equip_btn.disabled = true
	use_btn.disabled = true
	give_btn.disabled = true

	if selected_item_index != -1 and selected_unit:
		if selected_item_index < selected_unit.inventory.size():
			var item = selected_unit.inventory[selected_item_index]
			if item.item_type == ItemData.ItemType.WEAPON:
				equip_btn.disabled = false
			elif item.item_type == ItemData.ItemType.CONSUMABLE:
				use_btn.disabled = false
			give_btn.disabled = false


# ---- Actions ----

func _on_unequip_pressed() -> void:
	if selected_unit:
		selected_unit.unequip_weapon()
		_refresh_display()
		_refresh_unit_list()


func _on_equip_pressed() -> void:
	if selected_unit and selected_item_index != -1:
		selected_unit.equip_item(selected_item_index)
		selected_item_index = -1
		_refresh_display()
		_refresh_unit_list()


func _on_use_pressed() -> void:
	if not selected_unit or selected_item_index == -1:
		return
	if selected_item_index >= selected_unit.inventory.size():
		return

	var item: ItemData = selected_unit.inventory[selected_item_index]
	if item.item_type == ItemData.ItemType.CONSUMABLE and item.heal_amount > 0:
		selected_unit.heal(item.heal_amount)
		if item.use():
			if item.is_broken():
				selected_unit.remove_item(selected_item_index)
		selected_item_index = -1
		_refresh_display()
		_refresh_unit_list()


func _on_give_pressed() -> void:
	if selected_unit and selected_item_index != -1:
		_show_trade_overlay()


# ---- Trade Logic ----

func _show_trade_overlay() -> void:
	trade_overlay.show()

	for child in recipient_list.get_children():
		child.queue_free()

	for unit in GameManager.party:
		if unit == selected_unit:
			continue

		var btn := Button.new()
		btn.custom_minimum_size = Vector2(0, 50)
		UIFactory.style_button(btn, UIFactory.COLOR_EMBER)

		# Content overlay with class circle
		var row := HBoxContainer.new()
		row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.anchors_preset = Control.PRESET_FULL_RECT
		row.offset_left = 12
		row.offset_right = -12
		row.offset_top = 6
		row.offset_bottom = -6
		row.add_theme_constant_override("separation", 10)
		btn.add_child(row)

		var circle := UIFactory.create_class_circle(unit.unit_class, 28)
		circle.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(circle)

		var lbl := Label.new()
		lbl.text = "Give to %s" % unit.unit_name
		lbl.add_theme_font_size_override("font_size", 14)
		lbl.add_theme_color_override("font_color", UIFactory.COLOR_PARCHMENT)
		lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(lbl)

		btn.pressed.connect(_execute_trade.bind(unit))
		recipient_list.add_child(btn)


func _execute_trade(target_unit: UnitData) -> void:
	var item = selected_unit.remove_item(selected_item_index)
	if item:
		target_unit.add_item(item)

	_close_trade_overlay()
	selected_item_index = -1
	_refresh_display()
	_refresh_unit_list()


func _on_cancel_trade_pressed() -> void:
	_close_trade_overlay()


func _close_trade_overlay() -> void:
	trade_overlay.hide()


# ---- Navigation ----

func _on_close_pressed() -> void:
	var target_scene = "res://scenes/overworld/world_map.tscn"
	if GameManager.current_state == GameManager.GameState.DUNGEON:
		target_scene = "res://scenes/dungeon/dungeon_map.tscn"

	if has_node("/root/SceneLoader"):
		get_node("/root/SceneLoader").change_scene_to_file(target_scene, false)
	else:
		get_tree().change_scene_to_file(target_scene)

	close_requested.emit()
