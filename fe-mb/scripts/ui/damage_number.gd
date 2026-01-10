extends Node2D
## DamageNumber - Floating damage text that animates and disappears

var damage_value: int = 0
var is_critical: bool = false
var is_miss: bool = false
var is_heal: bool = false

@onready var label: Label


func _ready() -> void:
	# Create label dynamically
	label = Label.new()
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	add_child(label)
	
	# Set text and style
	if is_miss:
		label.text = "MISS"
		label.add_theme_color_override("font_color", Color.WHITE)
		label.add_theme_font_size_override("font_size", 16)
	elif is_heal:
		label.text = "+%d" % damage_value
		label.add_theme_color_override("font_color", Color.LIME_GREEN)
		label.add_theme_font_size_override("font_size", 18)
	elif is_critical:
		label.text = "%d!" % damage_value
		label.add_theme_color_override("font_color", Color.GOLD)
		label.add_theme_font_size_override("font_size", 24)
	else:
		label.text = str(damage_value)
		label.add_theme_color_override("font_color", Color.WHITE)
		label.add_theme_font_size_override("font_size", 18)
	
	# Add shadow
	label.add_theme_color_override("font_shadow_color", Color.BLACK)
	label.add_theme_constant_override("shadow_offset_x", 2)
	label.add_theme_constant_override("shadow_offset_y", 2)
	
	# Center the label
	label.position = Vector2(-50, -20)
	label.size = Vector2(100, 40)
	
	# Animate!
	_animate()


func _animate() -> void:
	var tween = create_tween()
	tween.set_parallel(true)
	
	# Float upward
	tween.tween_property(self, "position:y", position.y - 40, 0.8).set_ease(Tween.EASE_OUT)
	
	# Fade out
	tween.tween_property(self, "modulate:a", 0.0, 0.8).set_delay(0.3)
	
	# Scale pop for criticals
	if is_critical:
		tween.tween_property(self, "scale", Vector2(1.3, 1.3), 0.1)
		tween.tween_property(self, "scale", Vector2(1.0, 1.0), 0.2).set_delay(0.1)
	
	# Remove after animation
	await tween.finished
	queue_free()


## Factory function to create damage number
static func create(parent: Node, world_pos: Vector2, damage: int, critical: bool = false, miss: bool = false, heal: bool = false) -> void:
	var scene = preload("res://scenes/ui/damage_number.tscn")
	var instance = scene.instantiate()
	instance.damage_value = damage
	instance.is_critical = critical
	instance.is_miss = miss
	instance.is_heal = heal
	instance.position = world_pos
	parent.add_child(instance)
