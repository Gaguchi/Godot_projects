extends Control

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

func _ready() -> void:
	$CloseBtn.pressed.connect(_on_close_pressed)

func setup() -> void:
	_refresh_unit_list()
	
	if not GameManager.party.is_empty():
		_select_unit(GameManager.party[0])
	else:
		details_panel.visible = false

func _refresh_unit_list() -> void:
	# Clear existing
	for child in unit_container.get_children():
		child.queue_free()
		
	for unit in GameManager.party:
		var btn = Button.new()
		btn.text = unit.unit_name
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		btn.custom_minimum_size = Vector2(0, 40)
		btn.pressed.connect(_on_unit_btn_pressed.bind(unit))
		unit_container.add_child(btn)

func _on_unit_btn_pressed(unit: UnitData) -> void:
	_select_unit(unit)

func _select_unit(unit: UnitData) -> void:
	selected_unit = unit
	details_panel.visible = true
	
	# Header
	name_label.text = unit.unit_name
	class_label.text = unit.get_class_name()
	level_label.text = "Lv. %d" % unit.level
	
	# Bars
	hp_bar.max_value = unit.max_hp
	hp_bar.value = unit.current_hp
	hp_label.text = "%d / %d" % [unit.current_hp, unit.max_hp]
	
	xp_bar.max_value = 100
	xp_bar.value = unit.experience
	
	# Stats Grid
	_update_stat_label("Str", unit.strength)
	_update_stat_label("Mag", unit.magic)
	_update_stat_label("Skl", unit.skill)
	_update_stat_label("Spd", unit.speed)
	_update_stat_label("Lck", unit.luck)
	_update_stat_label("Def", unit.defense)
	_update_stat_label("Res", unit.resistance)
	_update_stat_label("Mov", unit.movement)
	
	# Equipment
	if unit.equipped_weapon:
		weapon_label.text = unit.equipped_weapon.item_name
	else:
		weapon_label.text = "None"

func _update_stat_label(stat_name: String, value: int) -> void:
	var node_path = "HBox/DetailsPanel/Stats/Grid/" + stat_name
	if has_node(node_path):
		get_node(node_path).text = "%s: %d" % [stat_name, value]

func _on_close_pressed() -> void:
	close_requested.emit()
