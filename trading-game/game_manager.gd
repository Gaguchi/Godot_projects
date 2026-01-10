extends Node2D

onready var player = $Player

func _input(event):
	if event is InputEventMouseButton and event.button_index == BUTTON_LEFT and event.pressed:
		player.target_position = event.position
