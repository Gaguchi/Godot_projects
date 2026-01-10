extends HBoxContainer

@onready var icon_rect: TextureRect = $Icon
@onready var label: Label = $Value

func update_value(value: int):
	label.text = str(value)

func set_icon(texture: Texture2D):
	icon_rect.texture = texture
