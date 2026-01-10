extends CharacterBody2D

var target_position = Vector2.ZERO
var speed = 200

func _ready():
	target_position = position

func _process(delta):
	if position.distance_to(target_position) > 1:
		position = position.move_toward(target_position, speed * delta)
