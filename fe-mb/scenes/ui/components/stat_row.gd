extends HBoxContainer
class_name StatRow

@onready var icon_rect: TextureRect = $Icon
@onready var label: Label = $Label
@onready var value_label: Label = $Value

func set_stat(stat_name: String, value: int, icon: Texture2D = null):
	label.text = stat_name
	value_label.text = str(value)
	
	if icon:
		icon_rect.texture = icon
		icon_rect.visible = true
	else:
		icon_rect.visible = false

func set_comparison(value: int, other_value: int):
	value_label.text = str(value)
	# Todo: Add color coding for buffs/debuffs
	# if value > original: green else red
