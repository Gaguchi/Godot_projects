class_name CardData
extends Resource
## CardData - Defines a single card for the deck-based combat system
## Cards replace the traditional attack/hit/crit system with deterministic effects

enum CardType {
	ATTACK,      # Deals damage to enemies
	SKILL,       # Utility (draw, AP, temp armor, etc.)
	SPELL,       # Magic damage (armor-piercing)
	ITEM         # Consumable one-use cards (bombs, potions)
}

enum TargetType {
	ENEMY,       # Single enemy
	SELF,        # Caster only
	ALLY,        # Single ally (including self)
	ALL_ENEMIES, # All enemies
	ALL_ALLIES,  # All allies (including self)
	GROUND       # Target a tile — hits area (aoe_radius)
}

enum Rarity {
	COMMON,
	UNCOMMON,
	RARE
}

## Source tracking — set at deck build time, not persisted
var source: String = "innate"  # "innate", "hand_left", "hand_right"

@export_group("Identity")
@export var id: String = ""              # Catalog ID (e.g. "slash", "fire") — empty for legacy/uncataloged cards
@export var card_name: String = "Card"
@export var description: String = ""  # Use {DMG} for computed damage, {HEAL} for healing
@export var ap_cost: int = 1
@export var card_type: CardType = CardType.ATTACK
@export var target_type: TargetType = TargetType.ENEMY
@export var rarity: Rarity = Rarity.COMMON

@export_group("Damage")
@export var damage_base: int = 0       # Flat damage component
@export var damage_stat: String = ""   # "str", "mag", "skl", "" for none
@export var damage_multiplier: float = 1.0  # 1.0 normal, 2.0 = hits twice, 0.5 = half
@export var is_magic: bool = false     # True = armor-piercing (half to armor, half to HP)
@export var weapon_type: int = 0       # ItemData.WeaponType value for triangle bonus

@export_group("Healing")
@export var heal_base: int = 0
@export var heal_stat: String = ""     # "mag" etc.

@export_group("Range")
@export var range_min: int = 1
@export var range_max: int = 1
@export var aoe_radius: int = 0  # 0 = single tile, 1+ = manhattan radius AOE

@export_group("Effects")
@export var effects: Array[Dictionary] = []  # [{type: "draw", amount: 2}, {type: "temp_armor", amount: 3}, {type: "ap", amount: 1}]
@export var is_consumable: bool = false      # Removed from deck after use


## Get computed damage for a specific unit (base + stat scaling + sharpness)
## Weapon might is baked into gear cards' damage_base — not added here.
## Sharpness bonus is dynamic (degrades each battle) so it IS added here.
func get_computed_damage(unit: UnitData) -> int:
	var base: float = damage_base
	if damage_stat != "" and unit:
		match damage_stat:
			"str": base += unit.strength
			"mag": base += unit.magic
			"skl": base += unit.skill
	# Add sharpness bonus from the weapon that sourced this card
	if unit and source != "innate":
		var weapon: Resource = null
		if source == "hand_left":
			weapon = unit.hand_left
		elif source == "hand_right":
			weapon = unit.hand_right
		if weapon and weapon is ItemData:
			base += weapon.get_sharpness_bonus()
	return max(0, int(base * damage_multiplier))


## Get computed healing for a specific unit
func get_computed_healing(unit: UnitData) -> int:
	var total: int = heal_base
	match heal_stat:
		"mag": total += unit.magic
		"skl": total += unit.skill
	return max(0, total)


## Get description with {DMG} and {HEAL} replaced by computed values
func get_description_filled(unit: UnitData) -> String:
	var text: String = description
	if "{DMG}" in text:
		text = text.replace("{DMG}", str(get_computed_damage(unit)))
	if "{HEAL}" in text:
		text = text.replace("{HEAL}", str(get_computed_healing(unit)))
	return text


## Create a duplicate of this card (for deck building)
func duplicate_card() -> CardData:
	var copy := CardData.new()
	copy.id = id
	copy.card_name = card_name
	copy.description = description
	copy.ap_cost = ap_cost
	copy.card_type = card_type
	copy.target_type = target_type
	copy.rarity = rarity
	copy.damage_base = damage_base
	copy.damage_stat = damage_stat
	copy.damage_multiplier = damage_multiplier
	copy.is_magic = is_magic
	copy.weapon_type = weapon_type
	copy.heal_base = heal_base
	copy.heal_stat = heal_stat
	copy.range_min = range_min
	copy.range_max = range_max
	copy.aoe_radius = aoe_radius
	copy.effects = effects.duplicate(true)
	copy.is_consumable = is_consumable
	copy.source = source
	return copy


## Serialize to dictionary
func to_dict() -> Dictionary:
	return {
		"id": id,
		"card_name": card_name,
		"description": description,
		"ap_cost": ap_cost,
		"card_type": card_type,
		"target_type": target_type,
		"rarity": rarity,
		"damage_base": damage_base,
		"damage_stat": damage_stat,
		"damage_multiplier": damage_multiplier,
		"is_magic": is_magic,
		"weapon_type": weapon_type,
		"heal_base": heal_base,
		"heal_stat": heal_stat,
		"range_min": range_min,
		"range_max": range_max,
		"aoe_radius": aoe_radius,
		"effects": effects.duplicate(true),
		"is_consumable": is_consumable,
	}


## Deserialize from dictionary
func from_dict(data: Dictionary) -> void:
	id = data.get("id", "")
	card_name = data.get("card_name", "Card")
	description = data.get("description", "")
	ap_cost = data.get("ap_cost", 1)

	var ct = data.get("card_type", 0)
	if ct is String:
		match ct:
			"ATTACK": card_type = CardType.ATTACK
			"SKILL": card_type = CardType.SKILL
			"SPELL": card_type = CardType.SPELL
			"ITEM": card_type = CardType.ITEM
			_: card_type = CardType.ATTACK
	else:
		card_type = ct

	var tt = data.get("target_type", 0)
	if tt is String:
		match tt:
			"ENEMY": target_type = TargetType.ENEMY
			"SELF": target_type = TargetType.SELF
			"ALLY": target_type = TargetType.ALLY
			"ALL_ENEMIES": target_type = TargetType.ALL_ENEMIES
			"ALL_ALLIES": target_type = TargetType.ALL_ALLIES
			"GROUND": target_type = TargetType.GROUND
			_: target_type = TargetType.ENEMY
	else:
		target_type = tt

	var r = data.get("rarity", 0)
	if r is String:
		match r:
			"COMMON": rarity = Rarity.COMMON
			"UNCOMMON": rarity = Rarity.UNCOMMON
			"RARE": rarity = Rarity.RARE
			_: rarity = Rarity.COMMON
	else:
		rarity = r

	damage_base = data.get("damage_base", 0)
	damage_stat = data.get("damage_stat", "")
	damage_multiplier = data.get("damage_multiplier", 1.0)
	is_magic = data.get("is_magic", false)

	var wt = data.get("weapon_type", 0)
	if wt is String:
		match wt:
			"NONE": weapon_type = ItemData.WeaponType.NONE
			"SWORD": weapon_type = ItemData.WeaponType.SWORD
			"LANCE": weapon_type = ItemData.WeaponType.LANCE
			"AXE": weapon_type = ItemData.WeaponType.AXE
			"BOW": weapon_type = ItemData.WeaponType.BOW
			"TOME": weapon_type = ItemData.WeaponType.TOME
			"STAFF": weapon_type = ItemData.WeaponType.STAFF
			"CROSSBOW": weapon_type = ItemData.WeaponType.CROSSBOW
			_: weapon_type = ItemData.WeaponType.NONE
	else:
		weapon_type = wt

	heal_base = data.get("heal_base", 0)
	heal_stat = data.get("heal_stat", "")
	range_min = data.get("range_min", 1)
	range_max = data.get("range_max", 1)
	aoe_radius = data.get("aoe_radius", 0)
	var raw_effects: Array = data.get("effects", [])
	effects.clear()
	for eff in raw_effects:
		effects.append(eff)
	is_consumable = data.get("is_consumable", false)


## Create a CardData from a dictionary (static factory)
static func create_from_dict(data: Dictionary) -> CardData:
	var card := CardData.new()
	card.from_dict(data)
	return card
