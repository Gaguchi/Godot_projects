class_name EnemyAI
extends Node
## EnemyAI - All enemy AI decision-making for combat
## Evaluates targets, moves, and attacks for each enemy unit

## Reference to the grid data (set by battlefield)
var battle_grid: BattleGrid

## Tracks how many enemies are targeting each player unit (focus fire)
var _target_counts: Dictionary = {}


## Reset focus fire tracking at the start of each AI turn
func reset_turn() -> void:
	_target_counts.clear()


## Process a single enemy's turn. Returns a dictionary describing the action taken.
## {action: "attack", move_to: Vector2i, target: Node2D}
## {action: "approach", move_to: Vector2i}
## {action: "idle"}
func decide_action(enemy: Node2D, player_units: Array, enemy_units: Array) -> Dictionary:
	var enemy_data: UnitData = enemy.get_unit_data()
	var enemy_pos: Vector2i = battle_grid.world_to_grid(enemy.position)
	var weapon_range: Vector2i = battle_grid.get_weapon_range(enemy_data)

	# Calculate all tiles this enemy can reach
	var reachable: Array[Vector2i] = battle_grid.get_reachable_tiles(enemy)
	var attack_candidates: Array[Vector2i] = [enemy_pos]
	attack_candidates.append_array(reachable)

	# Evaluate every player unit as a potential target
	var best_score: float = -INF
	var best_target: Node2D = null
	var best_attack_pos: Vector2i = Vector2i(-1, -1)

	for player in player_units:
		if not is_instance_valid(player):
			continue
		var p_data: UnitData = player.get_unit_data()
		if not p_data or not p_data.is_alive():
			continue

		var target_pos: Vector2i = battle_grid.world_to_grid(player.position)
		var attack_pos: Vector2i = battle_grid.find_attack_tile(
			enemy_pos, target_pos, attack_candidates, weapon_range.x, weapon_range.y
		)
		if attack_pos == Vector2i(-1, -1):
			continue

		var forecast: Dictionary = CombatManager.calculate_combat(
			enemy_data, p_data,
			battle_grid.get_terrain_def_bonus(target_pos),
			battle_grid.get_terrain_avoid_bonus(target_pos)
		)
		var score: float = _score_target(enemy_data, p_data, player, forecast, enemy_pos, attack_pos)

		if score > best_score:
			best_score = score
			best_target = player
			best_attack_pos = attack_pos

	if best_target:
		# Track focus fire
		var target_id: int = best_target.get_instance_id()
		_target_counts[target_id] = _target_counts.get(target_id, 0) + 1

		return {
			"action": "attack",
			"move_to": best_attack_pos if best_attack_pos != enemy_pos else Vector2i(-1, -1),
			"target": best_target
		}
	else:
		# No target in range - approach closest player
		var closest: Node2D = _find_closest_player(enemy, player_units)
		if closest:
			var target_pos: Vector2i = battle_grid.world_to_grid(closest.position)
			var move_to: Vector2i = battle_grid.find_best_approach_tile(enemy_pos, target_pos, reachable)
			if move_to != enemy_pos:
				return {"action": "approach", "move_to": move_to}

		return {"action": "idle"}


## Score a potential target for enemy AI decision-making
func _score_target(enemy_data: UnitData, target_data: UnitData, target_node: Node2D, forecast: Dictionary, enemy_pos: Vector2i, attack_pos: Vector2i) -> float:
	var score: float = 0.0

	# Expected damage (damage * hit chance / 100)
	var expected_dmg: float = forecast.attacker_damage * forecast.attacker_hit / 100.0
	if forecast.attacker_doubles:
		expected_dmg *= 2.0
	score += expected_dmg

	# Can we kill the target?
	var total_dmg: int = forecast.attacker_damage * (2 if forecast.attacker_doubles else 1)
	if total_dmg >= target_data.current_hp and forecast.attacker_hit >= 50:
		score += 100.0

	# Target is wounded (< 50% HP) - finish them off
	if target_data.current_hp < target_data.max_hp * 0.5:
		score += 20.0

	# Weapon triangle advantage
	if enemy_data.equipped_weapon and enemy_data.equipped_weapon is ItemData and target_data.equipped_weapon and target_data.equipped_weapon is ItemData:
		var triangle: int = ItemData.get_triangle_advantage(
			enemy_data.equipped_weapon.weapon_type,
			target_data.equipped_weapon.weapon_type
		)
		if triangle > 0:
			score += 15.0
		elif triangle < 0:
			score -= 10.0

	# Can double attack
	if forecast.attacker_doubles:
		score += 10.0

	# Proximity bonus - prefer closer targets (less movement)
	var move_dist: int = abs(attack_pos.x - enemy_pos.x) + abs(attack_pos.y - enemy_pos.y)
	score += max(0.0, (10 - move_dist)) * 2.0

	# Focus fire - prefer targets other enemies are already hitting
	var target_id: int = target_node.get_instance_id()
	var focus_count: int = _target_counts.get(target_id, 0)
	score += focus_count * 15.0

	return score


## Find the closest alive player unit
func _find_closest_player(enemy: Node2D, player_units: Array) -> Node2D:
	var nearest: Node2D = null
	var nearest_dist: float = INF
	var from_pos: Vector2 = enemy.position

	for unit in player_units:
		if not is_instance_valid(unit):
			continue
		if not unit.get_unit_data() or not unit.get_unit_data().is_alive():
			continue
		var dist: float = from_pos.distance_to(unit.position)
		if dist < nearest_dist:
			nearest_dist = dist
			nearest = unit

	return nearest
