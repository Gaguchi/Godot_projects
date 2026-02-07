class_name TurnOrderDisplay
extends HBoxContainer
## TurnOrderDisplay - Shows upcoming unit turns in the speed-based system
## Displays small panels with class letter, name, color-coded by team

const MAX_VISIBLE: int = 10

var _panels: Array[PanelContainer] = []
var _letters: Array[Label] = []
var _names: Array[Label] = []
var _style_active_player: StyleBoxFlat
var _style_active_enemy: StyleBoxFlat
var _style_inactive: StyleBoxFlat


func _ready() -> void:
	_create_styles()
	_create_panels()


func _create_styles() -> void:
	_style_active_player = StyleBoxFlat.new()
	_style_active_player.bg_color = Color(0.25, 0.25, 0.35, 0.9)
	_style_active_player.border_color = Color(1.0, 0.85, 0.2)
	_style_active_player.border_width_bottom = 2
	_style_active_player.border_width_top = 2
	_style_active_player.border_width_left = 2
	_style_active_player.border_width_right = 2
	_style_active_player.corner_radius_top_left = 4
	_style_active_player.corner_radius_top_right = 4
	_style_active_player.corner_radius_bottom_left = 4
	_style_active_player.corner_radius_bottom_right = 4

	_style_active_enemy = StyleBoxFlat.new()
	_style_active_enemy.bg_color = Color(0.25, 0.25, 0.35, 0.9)
	_style_active_enemy.border_color = Color(1.0, 0.3, 0.3)
	_style_active_enemy.border_width_bottom = 2
	_style_active_enemy.border_width_top = 2
	_style_active_enemy.border_width_left = 2
	_style_active_enemy.border_width_right = 2
	_style_active_enemy.corner_radius_top_left = 4
	_style_active_enemy.corner_radius_top_right = 4
	_style_active_enemy.corner_radius_bottom_left = 4
	_style_active_enemy.corner_radius_bottom_right = 4

	_style_inactive = StyleBoxFlat.new()
	_style_inactive.bg_color = Color(0.15, 0.15, 0.2, 0.8)
	_style_inactive.corner_radius_top_left = 4
	_style_inactive.corner_radius_top_right = 4
	_style_inactive.corner_radius_bottom_left = 4
	_style_inactive.corner_radius_bottom_right = 4


func _create_panels() -> void:
	for i in range(MAX_VISIBLE):
		var panel: PanelContainer = PanelContainer.new()
		panel.custom_minimum_size = Vector2(60, 44)
		panel.visible = false

		var vbox: VBoxContainer = VBoxContainer.new()
		vbox.alignment = BoxContainer.ALIGNMENT_CENTER

		var letter_label: Label = Label.new()
		letter_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		letter_label.add_theme_font_size_override("font_size", 18)

		var name_label: Label = Label.new()
		name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		name_label.add_theme_font_size_override("font_size", 10)
		name_label.add_theme_color_override("font_color", Color(0.7, 0.7, 0.7))

		vbox.add_child(letter_label)
		vbox.add_child(name_label)
		panel.add_child(vbox)
		add_child(panel)

		_panels.append(panel)
		_letters.append(letter_label)
		_names.append(name_label)


## Update the display with current turn queue
## active_index: index of the currently acting unit
func update_queue(queue: Array, active_index: int) -> void:
	# Hide all first
	for panel in _panels:
		panel.visible = false

	var display_index: int = 0
	for i in range(active_index, queue.size()):
		if display_index >= MAX_VISIBLE:
			break

		var unit: Node2D = queue[i]
		if not is_instance_valid(unit) or not unit.has_method("get_unit_data"):
			continue

		var data: UnitData = unit.get_unit_data()
		if not data or not data.is_alive():
			continue

		var panel: PanelContainer = _panels[display_index]
		var letter: Label = _letters[display_index]
		var name_lbl: Label = _names[display_index]

		letter.text = _get_class_letter(data)
		name_lbl.text = _truncate_name(data.unit_name)

		# Color by team
		if data.is_player_unit:
			letter.add_theme_color_override("font_color", Color(0.3, 0.7, 1.0))
		else:
			letter.add_theme_color_override("font_color", Color(1.0, 0.3, 0.3))

		# Highlight active unit (use cached styles)
		if i == active_index:
			panel.add_theme_stylebox_override("panel", _style_active_player if data.is_player_unit else _style_active_enemy)
		else:
			panel.add_theme_stylebox_override("panel", _style_inactive)

		panel.visible = true
		display_index += 1


func _get_class_letter(data: UnitData) -> String:
	match data.unit_class:
		UnitData.UnitClass.FIGHTER: return "F"
		UnitData.UnitClass.KNIGHT: return "K"
		UnitData.UnitClass.CAVALIER: return "C"
		UnitData.UnitClass.ARCHER: return "A"
		UnitData.UnitClass.MAGE: return "M"
		UnitData.UnitClass.CLERIC: return "H"
		UnitData.UnitClass.THIEF: return "T"
		UnitData.UnitClass.LORD: return "L"
	return "?"


func _truncate_name(unit_name: String) -> String:
	if unit_name.length() > 6:
		return unit_name.substr(0, 5) + "."
	return unit_name
