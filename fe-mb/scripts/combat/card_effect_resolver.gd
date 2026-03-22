extends RefCounted
## CardEffectResolver - Resolves card effects (damage, healing, status effects)
## All damage is deterministic — no hit/crit rolls


## Resolve a card being played. Returns result dictionary.
## battle_context: { "terrain_def_bonus": int, "get_defender_weapon_type": Callable }
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


