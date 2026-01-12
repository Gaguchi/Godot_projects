extends Control

signal close_requested

# Unit List Panel
@onready var unit_list_container: VBoxContainer = $MarginContainer/Content/UnitListPanel/VBox/Scroll/UnitListContainer

# Inventory Panel - Header
@onready var unit_info_label: Label = $MarginContainer/Content/InventoryPanel/VBox/Header/UnitInfoLabel
@onready var stats_label: Label = $MarginContainer/Content/InventoryPanel/VBox/Header/StatsLabel

# Inventory Panel - Equipment
@onready var weapon_label: Label = $MarginContainer/Content/InventoryPanel/VBox/EquipmentSection/HBox/WeaponLabel
@onready var unequip_btn: Button = $MarginContainer/Content/InventoryPanel/VBox/EquipmentSection/HBox/UnequipBtn

# Inventory Panel - List & Actions
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


func _ready() -> void:
	# Connect signals
	close_btn.pressed.connect(_on_close_pressed)
	unequip_btn.pressed.connect(_on_unequip_pressed)
	
	inventory_list.item_selected.connect(_on_item_selected)
	inventory_list.empty_clicked.connect(_on_empty_clicked)
	inventory_list.item_activated.connect(_on_item_activated) # Double click
	
	equip_btn.pressed.connect(_on_equip_pressed)
	use_btn.pressed.connect(_on_use_pressed)
	give_btn.pressed.connect(_on_give_pressed)
	
	cancel_trade_btn.pressed.connect(_on_cancel_trade_pressed)
	
	# Initial Setup
	_refresh_unit_list()
	
	# Emergency Cleanup of blockers
	var root = get_tree().root
	if root.has_node("LoadingScreen"):
		root.get_node("LoadingScreen").queue_free()
	
	# Select first unit if available
	if not GameManager.party.is_empty():
		_select_unit(GameManager.party[0])
	
	# Hide overlays
	trade_overlay.hide()
	_update_action_buttons()



func _refresh_unit_list() -> void:
	for child in unit_list_container.get_children():
		child.queue_free()
		
	for unit in GameManager.party:
		var btn = Button.new()
		btn.text = unit.unit_name
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		btn.custom_minimum_size = Vector2(0, 40)
		btn.pressed.connect(_on_unit_btn_pressed.bind(unit))
		unit_list_container.add_child(btn)

func _on_unit_btn_pressed(unit: UnitData) -> void:
	_select_unit(unit)

func _select_unit(unit: UnitData) -> void:
	selected_unit = unit
	selected_item_index = -1 # Reset selection
	
	_refresh_display()

func _refresh_display() -> void:
	if not selected_unit:
		return
		
	# Header
	unit_info_label.text = "%s - %s - Lv. %d" % [selected_unit.unit_name, selected_unit.get_class_name(), selected_unit.level]
	stats_label.text = "HP: %d/%d  Str: %d  Mag: %d  Spd: %d" % [
		selected_unit.current_hp, selected_unit.max_hp, 
		selected_unit.strength, selected_unit.magic, selected_unit.speed
	]
	
	# Equipment
	if selected_unit.equipped_weapon:
		weapon_label.text = selected_unit.equipped_weapon.item_name
		unequip_btn.disabled = false
	else:
		weapon_label.text = "None"
		unequip_btn.disabled = true
		
	# Inventory List
	inventory_list.clear()
	for item in selected_unit.inventory:
		var text = item.item_name
		var icon = null
		
		# Add Type hints
		if item.item_type == ItemData.ItemType.WEAPON:
			text += " (Wpn)"
		elif item.item_type == ItemData.ItemType.CONSUMABLE:
			text += " (Use)"
			
		inventory_list.add_item(text, icon)
		
	_update_action_buttons()

func _update_action_buttons() -> void:
	equip_btn.disabled = true
	use_btn.disabled = true
	give_btn.disabled = true
	
	if selected_item_index != -1 and selected_unit:
		var item = selected_unit.inventory[selected_item_index]
		
		# Enable actions based on type
		if item.item_type == ItemData.ItemType.WEAPON:
			equip_btn.disabled = false
		elif item.item_type == ItemData.ItemType.CONSUMABLE:
			use_btn.disabled = false
			
		# Can always give items (unless we restrict key items later)
		give_btn.disabled = false

func _on_item_selected(index: int) -> void:
	selected_item_index = index
	_update_action_buttons()

func _on_empty_clicked(_pos, _btn) -> void:
	selected_item_index = -1
	inventory_list.deselect_all()
	_update_action_buttons()

func _on_item_activated(index: int) -> void:
	# Double click handler
	var item = selected_unit.inventory[index]
	if item.item_type == ItemData.ItemType.WEAPON:
		_on_equip_pressed()
	elif item.item_type == ItemData.ItemType.CONSUMABLE:
		_on_use_pressed()

# --- Actions ---

func _on_unequip_pressed() -> void:
	if selected_unit:
		selected_unit.unequip_weapon()
		_refresh_display()

func _on_equip_pressed() -> void:
	if selected_unit and selected_item_index != -1:
		selected_unit.equip_item(selected_item_index)
		selected_item_index = -1 # Order changes, reset selection
		inventory_list.deselect_all()
		_refresh_display()

func _on_use_pressed() -> void:
	# TODO: Implement consumable logic
	print("Use Item Pressed (Not Implemented)")
	pass

func _on_give_pressed() -> void:
	if selected_unit and selected_item_index != -1:
		_show_trade_overlay()

# --- Trade Logic ---

func _show_trade_overlay() -> void:
	trade_overlay.show()
	
	# Populate recipient list
	for child in recipient_list.get_children():
		child.queue_free()
		
	for unit in GameManager.party:
		if unit == selected_unit:
			continue # Can't give to self
			
		var btn = Button.new()
		btn.text = "Give to " + unit.unit_name
		btn.alignment = HORIZONTAL_ALIGNMENT_CENTER
		btn.custom_minimum_size = Vector2(0, 50)
		btn.pressed.connect(_execute_trade.bind(unit))
		recipient_list.add_child(btn)

func _execute_trade(target_unit: UnitData) -> void:
	print("Trading item from %s to %s" % [selected_unit.unit_name, target_unit.unit_name])
	
	var item = selected_unit.remove_item(selected_item_index)
	if item:
		target_unit.add_item(item)
		
	_close_trade_overlay()
	selected_item_index = -1
	_refresh_display()

func _on_cancel_trade_pressed() -> void:
	_close_trade_overlay()

func _close_trade_overlay() -> void:
	trade_overlay.hide()

# --- Navigation ---

func _on_close_pressed() -> void:
	# Navigate back based on context
	var target_scene = "res://scenes/overworld/world_map.tscn"
	if GameManager.current_state == GameManager.GameState.DUNGEON:
		target_scene = "res://scenes/dungeon/dungeon_map.tscn"
		
	if has_node("/root/SceneLoader"):
		get_node("/root/SceneLoader").change_scene_to_file(target_scene, false)
	else:
		get_tree().change_scene_to_file(target_scene)
	
	close_requested.emit()
