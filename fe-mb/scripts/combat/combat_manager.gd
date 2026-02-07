class_name CombatManager
extends Node
## CombatManager - Handles combat calculations and resolution
## Fire Emblem style damage formulas with weapon triangle

const WEAPON_TRIANGLE_HIT_BONUS: int = 15
const WEAPON_TRIANGLE_DMG_BONUS: int = 1
const DOUBLE_ATTACK_SPEED_THRESHOLD: int = 5
const CRIT_DAMAGE_MULTIPLIER: int = 3


## Calculate full combat forecast between two units
static func calculate_combat(attacker: UnitData, defender: UnitData, terrain_def_bonus: int = 0, terrain_avoid_bonus: int = 0) -> Dictionary:
	var result = {
		"attacker": attacker,
		"defender": defender,
		"attacker_damage": 0,
		"attacker_hit": 0,
		"attacker_crit": 0,
		"attacker_doubles": false,
		"defender_damage": 0,
		"defender_hit": 0,
		"defender_crit": 0,
		"defender_doubles": false,
		"defender_can_counter": false,
	}
	
	# Check if defender can counter (has weapon and in range)
	var attack_range = _get_attack_range(attacker)
	var counter_range = _get_attack_range(defender)
	result.defender_can_counter = counter_range > 0 and attack_range == counter_range
	
	# Get weapon triangle advantage
	var triangle = _get_weapon_triangle(attacker, defender)
	
	# Calculate attacker stats
	result.attacker_damage = _calculate_damage(attacker, defender, triangle, terrain_def_bonus)
	result.attacker_hit = _calculate_hit_rate(attacker, defender, triangle, terrain_avoid_bonus)
	result.attacker_crit = _calculate_crit_rate(attacker, defender)
	result.attacker_doubles = _can_double_attack(attacker, defender)
	
	# Calculate defender stats (if can counter)
	if result.defender_can_counter:
		result.defender_damage = _calculate_damage(defender, attacker, -triangle, 0)
		result.defender_hit = _calculate_hit_rate(defender, attacker, -triangle, 0)
		result.defender_crit = _calculate_crit_rate(defender, attacker)
		result.defender_doubles = _can_double_attack(defender, attacker)
	
	return result


## Execute combat and apply damage
static func execute_combat(forecast: Dictionary) -> Dictionary:
	var attacker: UnitData = forecast.attacker
	var defender: UnitData = forecast.defender
	var log = []
	
	# Attacker's first attack
	var attack_result = _perform_attack(attacker, defender, forecast.attacker_hit, forecast.attacker_damage, forecast.attacker_crit)
	log.append(attack_result)
	
	if not defender.is_alive():
		return {"log": log, "attacker_alive": true, "defender_alive": false}
	
	# Defender's counter attack
	if forecast.defender_can_counter:
		var counter_result = _perform_attack(defender, attacker, forecast.defender_hit, forecast.defender_damage, forecast.defender_crit)
		log.append(counter_result)
		
		if not attacker.is_alive():
			return {"log": log, "attacker_alive": false, "defender_alive": true}
	
	# Attacker's double attack
	if forecast.attacker_doubles and defender.is_alive():
		var double_result = _perform_attack(attacker, defender, forecast.attacker_hit, forecast.attacker_damage, forecast.attacker_crit)
		log.append(double_result)
		
		if not defender.is_alive():
			return {"log": log, "attacker_alive": true, "defender_alive": false}
	
	# Defender's double counter
	if forecast.defender_can_counter and forecast.defender_doubles and attacker.is_alive():
		var double_counter = _perform_attack(defender, attacker, forecast.defender_hit, forecast.defender_damage, forecast.defender_crit)
		log.append(double_counter)
	
	return {
		"log": log,
		"attacker_alive": attacker.is_alive(),
		"defender_alive": defender.is_alive()
	}


## Perform a single attack roll
static func _perform_attack(attacker: UnitData, defender: UnitData, hit_rate: int, damage: int, crit_rate: int) -> Dictionary:
	var roll = randi() % 100
	var hit = roll < hit_rate
	var crit = false
	var final_damage = 0
	
	if hit:
		var crit_roll = randi() % 100
		crit = crit_roll < crit_rate
		final_damage = damage * CRIT_DAMAGE_MULTIPLIER if crit else damage
		defender.take_damage(final_damage)
	
	return {
		"attacker": attacker.unit_name,
		"defender": defender.unit_name,
		"hit": hit,
		"crit": crit,
		"damage": final_damage,
		"roll": roll,
		"defender_hp": defender.current_hp
	}


## Calculate raw damage (armor absorption happens in UnitData.take_damage)
static func _calculate_damage(attacker: UnitData, defender: UnitData, triangle: int, _terrain_bonus: int) -> int:
	var attack_power: int = attacker.get_attack_power()
	var damage: int = attack_power + (triangle * WEAPON_TRIANGLE_DMG_BONUS)
	return max(0, damage)


## Calculate hit rate
static func _calculate_hit_rate(attacker: UnitData, defender: UnitData, triangle: int, terrain_bonus: int) -> int:
	var hit = attacker.get_hit_rate()
	var avoid = defender.get_avoid() + terrain_bonus
	
	# Add morale modifier
	hit += GameManager.get_morale_modifier() if attacker.is_player_unit else 0
	avoid += GameManager.get_morale_modifier() if defender.is_player_unit else 0
	
	var final_hit = hit - avoid + (triangle * WEAPON_TRIANGLE_HIT_BONUS)
	return clamp(final_hit, 0, 100)


## Calculate crit rate
static func _calculate_crit_rate(attacker: UnitData, defender: UnitData) -> int:
	var crit = attacker.get_crit_rate()
	var crit_avoid = defender.get_crit_avoid()
	return clamp(crit - crit_avoid, 0, 100)


## Check if attacker can double attack
static func _can_double_attack(attacker: UnitData, defender: UnitData) -> bool:
	return attacker.get_attack_speed() >= defender.get_attack_speed() + DOUBLE_ATTACK_SPEED_THRESHOLD


## Get weapon triangle advantage
static func _get_weapon_triangle(attacker: UnitData, defender: UnitData) -> int:
	if not attacker.equipped_weapon or not defender.equipped_weapon:
		return 0
	if not attacker.equipped_weapon is ItemData or not defender.equipped_weapon is ItemData:
		return 0
	
	return ItemData.get_triangle_advantage(
		attacker.equipped_weapon.weapon_type,
		defender.equipped_weapon.weapon_type
	)


## Get attack range of a unit based on equipped weapon
static func _get_attack_range(unit: UnitData) -> int:
	if unit.equipped_weapon and unit.equipped_weapon is ItemData:
		return unit.equipped_weapon.range_max
	return 0
