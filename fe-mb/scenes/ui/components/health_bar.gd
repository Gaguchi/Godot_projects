extends ProgressBar
class_name HealthBar

@onready var actual_bar: ProgressBar = $ActualBar

var _current_health: int = 0
var _max_health: int = 0

func setup(current: int, max_hp: int):
	_current_health = current
	_max_health = max_hp
	max_value = max_hp
	value = current
	
	actual_bar.max_value = max_hp
	actual_bar.value = current

## Updates the health, triggering animations
func set_health(new_health: int):
	# Clamp health
	new_health = clampi(new_health, 0, _max_health)
	
	var previous_health = _current_health
	_current_health = new_health
	
	if new_health < previous_health:
		# TAKING DAMAGE
		# 1. Actual bar drops instantly
		actual_bar.value = new_health
		
		# 2. Damage bar (white, behind) waits then catches up
		value = previous_health
		
		var tween = create_tween()
		tween.tween_interval(0.4)
		tween.tween_property(self, "value", new_health, 0.4).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		
	else:
		# HEALING
		# 1. Damage bar snaps to new high instantly (so it's filled)
		value = new_health
		
		# 2. Actual bar fills up visually
		var tween = create_tween()
		actual_bar.value = previous_health
		tween.tween_property(actual_bar, "value", new_health, 0.4).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)

func set_preview_damage(damage: int):
	# Used for combat forecast "flashing" or preview
	# For now, just tween the actual bar to (current - damage) and back?
	# Or implement a separate preview mode.
	pass
