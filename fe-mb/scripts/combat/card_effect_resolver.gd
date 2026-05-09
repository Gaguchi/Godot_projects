extends RefCounted
## CardEffectResolver - Resolves card effects (damage, healing, status effects)
## All damage is deterministic — no hit/crit rolls


## Resolve a card being played. Returns result dictionary.
## battle_context: { "terrain_def_bonus": int }
func resolve_card(card: CardData, caster: UnitData, target: UnitData, battle_context: Dictionary = {}) -> Dictionary:
	var result := {
		"damage_dealt": 0,
		"healing_done": 0,
		"effects_applied": [],
		"target_died": false,
		"hits": 1,  # Number of hits (for damage_multiplier)
	}

	# Apply damage
	if card.damage_base > 0 or card.damage_stat != "":
		result.damage_dealt = _apply_damage(card, caster, target, battle_context)
		result.target_died = not target.is_alive()

	# Apply healing
	if card.heal_base > 0 or card.heal_stat != "":
		result.healing_done = _apply_healing(card, caster, target)

	# Apply special effects
	if not card.effects.is_empty():
		result.effects_applied = _apply_effects(card, caster, target, battle_context)

	return result


## Calculate and apply damage from a card
func _apply_damage(card: CardData, caster: UnitData, target: UnitData, context: Dictionary) -> int:
	var raw_damage: int = card.get_computed_damage(caster)

	# Flat DR from DEF or RES
	var dr: int = 0
	if card.is_magic:
		dr = int(target.resistance / 2.0)
	else:
		dr = int(target.defense / 2.0)

	# Terrain defense bonus
	var terrain_bonus: int = context.get("terrain_def_bonus", 0)
	dr += terrain_bonus

	var damage_per_hit: int = max(0, raw_damage - dr)
	var total_damage: int = 0

	# Handle multi-hit (damage_multiplier as hit count)
	var hits: int = int(card.damage_multiplier) if card.damage_multiplier > 1.0 else 1
	for i in hits:
		if not target.is_alive():
			break
		target.take_damage(damage_per_hit, card.is_magic)
		total_damage += damage_per_hit

	return total_damage


## Calculate and apply healing from a card
func _apply_healing(card: CardData, caster: UnitData, target: UnitData) -> int:
	var heal_amount: int = card.get_computed_healing(caster)
	if heal_amount <= 0:
		return 0
	var old_hp: int = target.current_hp
	target.heal(heal_amount)
	return target.current_hp - old_hp


## Apply special effects from a card
func _apply_effects(card: CardData, caster: UnitData, target: UnitData, context: Dictionary) -> Array:
	var applied: Array = []

	for effect in card.effects:
		var effect_type: String = effect.get("type", "")
		match effect_type:
			"draw":
				# Draw additional cards — handled by battlefield (needs DeckManager)
				applied.append({"type": "draw", "amount": effect.get("amount", 1)})
			"ap":
				# Gain AP — handled by battlefield
				applied.append({"type": "ap", "amount": effect.get("amount", 1)})
			"temp_armor":
				# Temporary armor (added to current_armor)
				var amount: int = effect.get("amount", 0)
				caster.current_armor += amount
				applied.append({"type": "temp_armor", "amount": amount})
			"self_damage":
				# Self-damage (e.g. Reckless Blow)
				var amount: int = effect.get("amount", 0)
				caster.take_damage(amount, false)
				applied.append({"type": "self_damage", "amount": amount})
			"subdue":
				# Capture attempt — handled by battlefield (needs HP% check)
				applied.append({"type": "subdue"})
			"immobilize":
				# Immobilize target — handled by battlefield
				applied.append({"type": "immobilize", "turns": effect.get("turns", 1)})
			"steal_gold":
				# Steal gold from enemy
				var amount: int = effect.get("amount", 0)
				applied.append({"type": "steal_gold", "amount": amount})

	return applied


## Apply a status effect to a unit. Deterministic, no RNG.
func apply_status(target: Resource, effect: Dictionary) -> void:
	var effect_type = effect.get("type", "")
	var value = effect.get("value", 0)
	var duration = effect.get("duration", 0)

	match effect_type:
		"poison":
			# Poison does NOT stack — refresh with higher value
			for i in range(target.status_effects.size()):
				if target.status_effects[i]["type"] == "poison":
					if value >= target.status_effects[i]["value"]:
						target.status_effects[i]["value"] = value
						target.status_effects[i]["duration"] = duration
					return
			target.status_effects.append({"type": "poison", "value": value, "duration": duration})

		"burn":
			# Burn STACKS — multiple sources add together
			target.status_effects.append({"type": "burn", "value": value, "duration": duration})

		"slow":
			# Slow does NOT stack — refresh
			for i in range(target.status_effects.size()):
				if target.status_effects[i]["type"] == "slow":
					target.status_effects[i]["value"] = value
					target.status_effects[i]["duration"] = duration
					return
			target.speed -= value
			target.status_effects.append({"type": "slow", "value": value, "duration": duration, "original_speed": target.speed + value})

		"immobilize":
			# Immobilize does NOT stack — refresh
			for i in range(target.status_effects.size()):
				if target.status_effects[i]["type"] == "immobilize":
					target.status_effects[i]["duration"] = duration
					return
			var original_mov = target.movement
			target.movement = 0
			target.status_effects.append({"type": "immobilize", "value": 0, "duration": duration, "original_movement": original_mov})


## Tick all status effects at end of unit's turn. Returns total damage dealt.
func tick_status_effects(unit: Resource) -> int:
	var total_damage = 0
	var to_remove = []

	for i in range(unit.status_effects.size()):
		var se = unit.status_effects[i]
		match se["type"]:
			"poison":
				unit.current_hp = max(0, unit.current_hp - se["value"])
				total_damage += se["value"]
			"burn":
				unit.current_hp = max(0, unit.current_hp - se["value"])
				total_damage += se["value"]

		se["duration"] -= 1
		if se["duration"] <= 0:
			match se["type"]:
				"slow":
					unit.speed = se.get("original_speed", unit.speed)
				"immobilize":
					unit.movement = se.get("original_movement", unit.movement)
			to_remove.append(i)

	# Remove expired effects (reverse order to preserve indices)
	to_remove.reverse()
	for i in to_remove:
		unit.status_effects.remove_at(i)

	return total_damage


