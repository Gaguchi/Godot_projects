extends Control
## Party Screen — Stone & Steel styled unit viewer.
## Shows unit list with class circles, detailed stats, HP/XP bars, and weapon card.

signal close_requested

@onready var unit_container: VBoxContainer = $HBox/ListPanel/Scroll/UnitList
@onready var details_panel: Control = $HBox/DetailsPanel
@onready var portrait_rect: ColorRect = $HBox/DetailsPanel/Header/Portrait
@onready var name_label: Label = $HBox/DetailsPanel/Header/Info/NameLabel
@onready var class_label: Label = $HBox/DetailsPanel/Header/Info/ClassLabel
@onready var level_label: Label = $HBox/DetailsPanel/Header/Info/LevelLabel

@onready var hp_bar: ProgressBar = $HBox/DetailsPanel/Stats/HPBar
@onready var hp_label: Label = $HBox/DetailsPanel/Stats/HPLabel
@onready var xp_bar: ProgressBar = $HBox/DetailsPanel/Stats/XPBar

@onready var stat_grid: GridContainer = $HBox/DetailsPanel/Stats/Grid

@onready var weapon_label: Label = $HBox/DetailsPanel/Equipment/WeaponLabel

var selected_unit: UnitData = null
var _selected_btn: Button = null
var _row_styles: Dictionary = {}
var _weapon_card: PanelContainer = null


func _ready() -> void:
	$CloseBtn.pressed.connect(_on_close_pressed)
	if has_node("InventoryBtn"):
		$InventoryBtn.pressed.connect(_on_inventory_pressed)
	_apply_styling()


func _apply_styling() -> void:
	_row_styles = UIFactory.create_row_styleboxes()

	# Style top-right buttons
	UIFactory.style_button($CloseBtn, UIFactory.COLOR_BLOOD)
	if has_node("InventoryBtn"):
		UIFactory.style_button($InventoryBtn, UIFactory.COLOR_EMBER)

	# Header labels
	name_label.add_theme_color_override("font_color", UIFactory.COLOR_PARCHMENT)
	name_label.add_theme_font_size_override("font_size", 24)
	name_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.5))
	name_label.add_theme_constant_override("shadow_offset_x", 1)
	name_label.add_theme_constant_override("shadow_offset_y", 1)

	level_label.add_theme_color_override("font_color", UIFactory.COLOR_EMBER)
	level_label.add_theme_font_size_override("font_size", 14)

	# HP label
	hp_label.add_theme_font_size_override("font_size", 13)

	# Make portrait rect transparent — class circle overlays it
	portrait_rect.color = Color(0, 0, 0, 0)

	# Equipment section header
	var equip_title := $HBox/DetailsPanel/Equipment/Title as Label
	equip_title.add_theme_color_override("font_color", UIFactory.COLOR_EMBER)
	equip_title.add_theme_font_size_override("font_size", 15)
	equip_title.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	equip_title.add_theme_constant_override("shadow_offset_x", 1)
	equip_title.add_theme_constant_override("shadow_offset_y", 1)

	# Hide default weapon label — weapon card replaces it
	weapon_label.visible = false


func _on_inventory_pressed() -> void:
	if has_node("/root/SceneLoader"):
		get_node("/root/SceneLoader").change_scene_to_file("res://scenes/ui/inventory_screen.tscn", false)
	else:
		get_tree().change_scene_to_file("res://scenes/ui/inventory_screen.tscn")


func setup() -> void:
	_refresh_unit_list()
	if not GameManager.party.is_empty():
		_select_unit(GameManager.party[0])
	else:
		details_panel.visible = false


func _refresh_unit_list() -> void:
	for child in unit_container.get_children():
		child.queue_free()
	_selected_btn = null

	for unit in GameManager.party:
		var btn := _create_unit_row(unit)
		unit_container.add_child(btn)
		if unit == selected_unit:
			_highlight_row(btn)


func _create_unit_row(unit: UnitData) -> Button:
	var btn := Button.new()
	btn.custom_minimum_size = Vector2(0, 56)
	btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
	btn.add_theme_stylebox_override("normal", _row_styles.normal.duplicate())
	btn.add_theme_stylebox_override("hover", _row_styles.hover.duplicate())
	btn.add_theme_stylebox_override("pressed", _row_styles.selected.duplicate())
	btn.add_theme_stylebox_override("focus", StyleBoxEmpty.new())

	# Overlay content — mouse_filter IGNORE so button gets clicks
	var row := HBoxContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.anchors_preset = Control.PRESET_FULL_RECT
	row.offset_left = 12
	row.offset_right = -8
	row.offset_top = 4
	row.offset_bottom = -4
	row.add_theme_constant_override("separation", 10)
	btn.add_child(row)

	# Class circle
	var circle := UIFactory.create_class_circle(unit.unit_class, 36)
	circle.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(circle)

	# Name + Class
	var info := VBoxContainer.new()
	info.mouse_filter = Control.MOUSE_FILTER_IGNORE
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	info.add_theme_constant_override("separation", 0)

	var nm := Label.new()
	nm.text = unit.unit_name
	nm.add_theme_font_size_override("font_size", 14)
	nm.add_theme_color_override("font_color", UIFactory.COLOR_PARCHMENT)
	nm.mouse_filter = Control.MOUSE_FILTER_IGNORE
	info.add_child(nm)

	var cl := Label.new()
	cl.text = unit.get_class_name()
	cl.add_theme_font_size_override("font_size", 11)
	cl.add_theme_color_override("font_color", UIFactory.CLASS_COLORS.get(unit.unit_class, UIFactory.COLOR_WORN_STONE))
	cl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	info.add_child(cl)

	row.add_child(info)

	# Level + HP (right side)
	var right := VBoxContainer.new()
	right.mouse_filter = Control.MOUSE_FILTER_IGNORE
	right.add_theme_constant_override("separation", 0)

	var lv := Label.new()
	lv.text = "Lv %d" % unit.level
	lv.add_theme_font_size_override("font_size", 11)
	lv.add_theme_color_override("font_color", UIFactory.COLOR_WORN_STONE)
	lv.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	lv.mouse_filter = Control.MOUSE_FILTER_IGNORE
	right.add_child(lv)

	var hp := Label.new()
	hp.text = "%d/%d" % [unit.current_hp, unit.max_hp]
	hp.add_theme_font_size_override("font_size", 11)
	hp.add_theme_color_override("font_color", UIFactory.get_hp_color(unit.current_hp, unit.max_hp))
	hp.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	hp.mouse_filter = Control.MOUSE_FILTER_IGNORE
	right.add_child(hp)

	row.add_child(right)

	btn.pressed.connect(_on_unit_btn_pressed.bind(unit, btn))
	return btn


func _on_unit_btn_pressed(unit: UnitData, btn: Button) -> void:
	_select_unit(unit)
	_highlight_row(btn)


func _highlight_row(btn: Button) -> void:
	if _selected_btn and is_instance_valid(_selected_btn):
		_selected_btn.add_theme_stylebox_override("normal", _row_styles.normal.duplicate())
	_selected_btn = btn
	btn.add_theme_stylebox_override("normal", _row_styles.selected.duplicate())


func _select_unit(unit: UnitData) -> void:
	selected_unit = unit
	details_panel.visible = true

	# Header
	name_label.text = unit.unit_name

	var cls_color: Color = UIFactory.CLASS_COLORS.get(unit.unit_class, UIFactory.COLOR_WORN_STONE)
	class_label.text = unit.get_class_name()
	class_label.add_theme_color_override("font_color", cls_color)
	class_label.add_theme_font_size_override("font_size", 14)

	level_label.text = "Level %d" % unit.level

	# Portrait — class circle centered in the 120x120 rect
	for child in portrait_rect.get_children():
		child.queue_free()
	var circle := UIFactory.create_class_circle(unit.unit_class, 80)
	circle.position = Vector2(20, 20)
	portrait_rect.add_child(circle)

	# HP bar
	hp_bar.max_value = unit.max_hp
	hp_bar.value = unit.current_hp
	var hp_color := UIFactory.get_hp_color(unit.current_hp, unit.max_hp)
	UIFactory.style_progress_bar(hp_bar, hp_color)
	hp_label.text = "HP  %d / %d" % [unit.current_hp, unit.max_hp]
	hp_label.add_theme_color_override("font_color", hp_color)

	# XP bar
	xp_bar.max_value = 100
	xp_bar.value = unit.experience
	UIFactory.style_progress_bar(xp_bar, UIFactory.COLOR_EMBER)

	# Stats grid — clear and rebuild with paired name/value
	for child in stat_grid.get_children():
		child.queue_free()
	stat_grid.columns = 4

	var stats := [
		["STR", unit.strength], ["MAG", unit.magic],
		["SKL", unit.skill], ["SPD", unit.speed],
		["LCK", unit.luck], ["DEF", unit.defense],
		["RES", unit.resistance], ["MOV", unit.movement],
	]
	for s in stats:
		stat_grid.add_child(UIFactory.create_stat_pair(s[0], s[1]))

	# Weapon card
	_update_weapon_card(unit)


func _update_weapon_card(unit: UnitData) -> void:
	if _weapon_card and is_instance_valid(_weapon_card):
		_weapon_card.queue_free()
		_weapon_card = null

	var equip_container := $HBox/DetailsPanel/Equipment as VBoxContainer

	if unit.equipped_weapon and unit.equipped_weapon is ItemData:
		_weapon_card = UIFactory.create_weapon_card(unit.equipped_weapon as ItemData)
	else:
		_weapon_card = PanelContainer.new()
		var style := StyleBoxFlat.new()
		style.bg_color = Color(0, 0, 0, 0)
		_weapon_card.add_theme_stylebox_override("panel", style)
		var lbl := Label.new()
		lbl.text = "No weapon equipped"
		lbl.add_theme_font_size_override("font_size", 14)
		lbl.add_theme_color_override("font_color", UIFactory.COLOR_WORN_STONE)
		_weapon_card.add_child(lbl)

	equip_container.add_child(_weapon_card)


func _on_close_pressed() -> void:
	close_requested.emit()
