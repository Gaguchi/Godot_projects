class_name CombatAnimator
extends Node
## CombatAnimator - Handles all visual animations during combat
## Movement tweens, combat hit/miss sequences, damage numbers, death fades

var DamageNumberScene: PackedScene = preload("res://scenes/ui/damage_number.tscn")

## Reference to the battlefield node (for add_child of damage numbers)
var battlefield: Node2D

## Reference to battle_grid for coordinate conversion
var battle_grid: BattleGrid


## Animate a unit moving along a path of grid positions
func animate_movement(unit: Node2D, path: PackedVector2Array) -> void:
	if path.is_empty():
		return

	var start: Vector2i = Vector2i(path[0])
	for point in path:
		var grid_pos := Vector2i(point)
		if grid_pos == start:
			continue

		var world_target: Vector2 = battle_grid.grid_to_world(grid_pos)
		var tween: Tween = battlefield.create_tween()
		tween.tween_property(unit, "position", world_target, 0.15).set_trans(Tween.TRANS_LINEAR)
		await tween.finished


## Play full combat animation sequence
## Returns after all animations complete
func play_combat(result: Dictionary, attacker: Node2D, defender: Node2D) -> void:
	for entry in result.log:
		# Determine which unit is being hit
		var target_unit: Node2D = defender if entry.attacker == attacker.get_unit_data().unit_name else attacker
		var source_unit: Node2D = attacker if entry.attacker == attacker.get_unit_data().unit_name else defender

		if not is_instance_valid(source_unit) or not is_instance_valid(target_unit):
			continue

		# Slide attacker toward target
		var original_pos: Vector2 = source_unit.position
		var direction: Vector2 = (target_unit.position - source_unit.position).normalized()
		var slide_target: Vector2 = source_unit.position + direction * 12.0

		var slide_in: Tween = battlefield.create_tween()
		slide_in.tween_property(source_unit, "position", slide_target, 0.08).set_trans(Tween.TRANS_QUAD)
		await slide_in.finished

		if entry.hit:
			# Flash defender white on hit
			if is_instance_valid(target_unit):
				_flash_white(target_unit)

			# Spawn damage number
			if is_instance_valid(target_unit):
				_spawn_damage_number(target_unit.position, entry.damage, entry.crit, false)
				# Update overhead bars
				if target_unit.has_method("_update_visuals"):
					target_unit._update_visuals()
		else:
			# Miss - show MISS text
			if is_instance_valid(target_unit):
				_spawn_damage_number(target_unit.position, 0, false, true)

		# Slide attacker back
		if is_instance_valid(source_unit):
			var slide_back: Tween = battlefield.create_tween()
			slide_back.tween_property(source_unit, "position", original_pos, 0.08).set_trans(Tween.TRANS_QUAD)
			await slide_back.finished

		# Wait between attacks for visual clarity
		await battlefield.get_tree().create_timer(0.3).timeout

	# Handle death animations
	if not result.defender_alive and is_instance_valid(defender):
		await _play_death(defender)

	if not result.attacker_alive and is_instance_valid(attacker):
		await _play_death(attacker)


## Flash a unit white briefly
func _flash_white(unit: Node2D) -> void:
	var original_modulate: Color = unit.modulate
	unit.modulate = Color.WHITE * 2.0  # Bright white flash

	var flash_tween: Tween = battlefield.create_tween()
	flash_tween.tween_property(unit, "modulate", original_modulate, 0.15)
	# Don't await - let it run in parallel with other effects


## Play death fade animation
func _play_death(unit: Node2D) -> void:
	var tween: Tween = battlefield.create_tween()
	tween.tween_property(unit, "modulate:a", 0.0, 0.3).set_trans(Tween.TRANS_QUAD)
	await tween.finished


## Play a single deterministic attack animation (for card system)
## No hit/miss — always hits. Shows damage number.
func play_single_attack(attacker: Node2D, target: Node2D, damage: int, is_magic: bool = false) -> void:
	if not is_instance_valid(attacker) or not is_instance_valid(target):
		return

	# Slide attacker toward target
	var original_pos: Vector2 = attacker.position
	var direction: Vector2 = (target.position - attacker.position).normalized()
	var slide_target: Vector2 = attacker.position + direction * 12.0

	var slide_in: Tween = battlefield.create_tween()
	slide_in.tween_property(attacker, "position", slide_target, 0.08).set_trans(Tween.TRANS_QUAD)
	await slide_in.finished

	# Flash target
	if is_instance_valid(target):
		if is_magic:
			# Purple flash for magic
			target.modulate = Color(0.7, 0.5, 1.0) * 1.5
			var flash_tween: Tween = battlefield.create_tween()
			flash_tween.tween_property(target, "modulate", Color.WHITE, 0.15)
		else:
			_flash_white(target)

	# Damage number
	if is_instance_valid(target):
		_spawn_damage_number(target.position, damage, false, false)
		if target.has_method("_update_visuals"):
			target._update_visuals()

	# Slide back
	if is_instance_valid(attacker):
		var slide_back: Tween = battlefield.create_tween()
		slide_back.tween_property(attacker, "position", original_pos, 0.08).set_trans(Tween.TRANS_QUAD)
		await slide_back.finished

	await battlefield.get_tree().create_timer(0.2).timeout

	# Death animation if target died
	if is_instance_valid(target) and target.has_method("get_unit_data"):
		if not target.get_unit_data().is_alive():
			await _play_death(target)


## Spawn a floating damage number
func _spawn_damage_number(world_pos: Vector2, damage: int, is_crit: bool, is_miss: bool) -> void:
	if not DamageNumberScene:
		return

	var dmg_num: Node = DamageNumberScene.instantiate()
	dmg_num.damage_value = damage
	dmg_num.is_critical = is_crit
	dmg_num.is_miss = is_miss
	dmg_num.position = world_pos + Vector2(0, -10)
	battlefield.add_child(dmg_num)
