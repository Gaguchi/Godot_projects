class_name UnitData
extends Resource
## UnitData - Defines a unit's stats, class, and growth rates
## Used for both player units and enemies

enum UnitClass {
	FIGHTER,       # Balanced melee
	KNIGHT,        # High defense, low speed
	CAVALIER,      # High movement
	ARCHER,        # Ranged physical
	MAGE,          # Ranged magic
	CLERIC,        # Healer
	THIEF,         # High speed, lockpicking
	LORD,          # Player's main character
	BOUNTY_HUNTER  # Ranged + improved capture rates
}

@export_group("Identity")
@export var unit_name: String = "Unit"
@export var unit_class: UnitClass = UnitClass.FIGHTER
@export var level: int = 1
@export var experience: int = 0
@export var is_player_unit: bool = true
@export var is_bound: bool = false           # Captured/tied up in combat
@export var is_capture_target: bool = false   # Flagged as quest capture target
@export var bounty_value: int = 0             # Gold reward when turned in (0 = use default tier)

@export_group("Current Stats")
@export var current_hp: int = 20
@export var current_armor: int = 5   # Absorbs damage before HP (resets each room)

@export_group("Base Stats")
@export var max_hp: int = 20
@export var strength: int = 5      # Physical damage
@export var magic: int = 0         # Magic damage
@export var skill: int = 5         # Hit rate, crit rate
@export var speed: int = 5         # Avoid, double attacks
@export var luck: int = 5          # Crit avoid, various checks
@export var defense: int = 5       # Max armor (absorbs damage before HP)
@export var resistance: int = 2    # Reduces magic damage (flat DR = floor(RES/2))
@export var movement: int = 5      # Tiles per turn

@export_group("Growth Rates (%)")
@export_range(0, 100) var hp_growth: int = 50
@export_range(0, 100) var str_growth: int = 40
@export_range(0, 100) var mag_growth: int = 0
@export_range(0, 100) var skl_growth: int = 35
@export_range(0, 100) var spd_growth: int = 35
@export_range(0, 100) var lck_growth: int = 30
@export_range(0, 100) var def_growth: int = 25
@export_range(0, 100) var res_growth: int = 20

@export_group("Equipment")
@export var equipped_weapon: Resource  # ItemData
@export var quick_slots: Array[Resource] = [null, null]  # 2 quick slots for consumables or spare weapons

@export_group("Card Deck")
@export var deck: Array[Resource] = []  # Array of CardData
@export var max_ap: int = 3  # Action points per turn in card combat

const EXP_TO_LEVEL: int = 100  # EXP needed to level up


func _init() -> void:
	current_hp = max_hp
	current_armor = defense


## Check if unit is alive
func is_alive() -> bool:
	return current_hp > 0


## Take damage — armor absorbs first, overflow goes to HP. Returns true if unit dies.
## Magic attacks are armor-piercing: half damage to armor, half directly to HP.
func take_damage(amount: int, is_magic: bool = false) -> bool:
	if amount <= 0:
		return current_hp <= 0

	if is_magic and current_armor > 0:
		# Armor-piercing: half goes to armor, half bypasses to HP
		var to_armor: int = int(amount / 2.0)
		var to_hp: int = amount - to_armor
		var armor_absorbed: int = min(current_armor, to_armor)
		current_armor -= armor_absorbed
		# Armor overflow (if armor < half damage) also goes to HP
		to_hp += (to_armor - armor_absorbed)
		current_hp = max(0, current_hp - to_hp)
	else:
		# Physical: armor absorbs first, overflow to HP
		var armor_absorbed: int = min(current_armor, amount)
		current_armor -= armor_absorbed
		var remaining: int = amount - armor_absorbed
		current_hp = max(0, current_hp - remaining)

	return current_hp <= 0


## Heal HP
func heal(amount: int) -> void:
	current_hp = min(max_hp, current_hp + amount)


## Full heal (HP and armor)
func full_heal() -> void:
	current_hp = max_hp
	if unit_class == UnitClass.MAGE or unit_class == UnitClass.CLERIC:
		current_armor = 0
	else:
		current_armor = defense


## Reset armor to max (called at the start of each combat room)
## Mages and Clerics have no armor — they trade protection for magic power.
func reset_armor() -> void:
	if unit_class == UnitClass.MAGE or unit_class == UnitClass.CLERIC:
		current_armor = 0
	else:
		current_armor = defense


## Add experience and check for level up. Returns stat gains dict if leveled up, empty dict otherwise.
func add_experience(amount: int) -> Dictionary:
	experience += amount
	if experience >= EXP_TO_LEVEL:
		experience -= EXP_TO_LEVEL
		return _level_up()
	return {}


## Process level up with growth rates. Returns dictionary of stat gains.
func _level_up() -> Dictionary:
	level += 1
	var gains: Dictionary = {"hp": 0, "str": 0, "mag": 0, "skl": 0, "spd": 0, "lck": 0, "def": 0, "res": 0}

	if randi() % 100 < hp_growth:
		max_hp += 1
		current_hp += 1
		gains["hp"] = 1
	if randi() % 100 < str_growth:
		strength += 1
		gains["str"] = 1
	if randi() % 100 < mag_growth:
		magic += 1
		gains["mag"] = 1
	if randi() % 100 < skl_growth:
		skill += 1
		gains["skl"] = 1
	if randi() % 100 < spd_growth:
		speed += 1
		gains["spd"] = 1
	if randi() % 100 < lck_growth:
		luck += 1
		gains["lck"] = 1
	if randi() % 100 < def_growth:
		defense += 1
		current_armor += 1
		gains["def"] = 1
	if randi() % 100 < res_growth:
		resistance += 1
		gains["res"] = 1

	# AP increase at milestone levels (cap at 5)
	if level in [5, 10, 15] and max_ap < 5:
		max_ap += 1
		print("[UnitData] %s gained +1 AP (now %d)" % [unit_name, max_ap])

	print("[UnitData] %s leveled up to %d!" % [unit_name, level])
	return gains


## Get attack power (physical or magical based on weapon)
func get_attack_power() -> int:
	if equipped_weapon and equipped_weapon is ItemData:
		var weapon = equipped_weapon as ItemData
		if weapon.weapon_type == ItemData.WeaponType.TOME:
			return magic + weapon.might
		else:
			return strength + weapon.might
	return strength


## Get attack speed (for double attack checks)
func get_attack_speed() -> int:
	if equipped_weapon and equipped_weapon is ItemData:
		var weapon = equipped_weapon as ItemData
		return speed - max(0, weapon.weight - strength)
	return speed


## Get hit rate
func get_hit_rate() -> int:
	var base_hit = skill * 2 + luck
	if equipped_weapon and equipped_weapon is ItemData:
		base_hit += equipped_weapon.hit
	return base_hit


## Get avoid rate
func get_avoid() -> int:
	return speed * 2 + luck


## Get crit rate
func get_crit_rate() -> int:
	var base_crit: int = int(skill / 2.0)
	if equipped_weapon and equipped_weapon is ItemData:
		base_crit += equipped_weapon.crit
	return base_crit


## Get crit avoid
func get_crit_avoid() -> int:
	return luck


## Get class display name
func get_class_name() -> String:
	match unit_class:
		UnitClass.FIGHTER: return "Fighter"
		UnitClass.KNIGHT: return "Knight"
		UnitClass.CAVALIER: return "Cavalier"
		UnitClass.ARCHER: return "Archer"
		UnitClass.MAGE: return "Mage"
		UnitClass.CLERIC: return "Cleric"
		UnitClass.THIEF: return "Thief"
		UnitClass.LORD: return "Lord"
		UnitClass.BOUNTY_HUNTER: return "Bounty Hunter"
	return "Unknown"


## Set an item in a quick slot (0 or 1). Returns the previous item (or null).
func set_quick_slot(slot_index: int, item: Resource) -> Resource:
	if slot_index < 0 or slot_index > 1:
		return null
	while quick_slots.size() < 2:
		quick_slots.append(null)
	var prev = quick_slots[slot_index]
	quick_slots[slot_index] = item
	return prev


## Get item from a quick slot
func get_quick_slot(slot_index: int) -> Resource:
	if slot_index < 0 or slot_index > 1 or slot_index >= quick_slots.size():
		return null
	return quick_slots[slot_index]


## Clear a quick slot and return the item
func clear_quick_slot(slot_index: int) -> Resource:
	return set_quick_slot(slot_index, null)


## Equip a weapon directly (from bag or quick slot). Returns old weapon or null.
func equip_weapon(weapon: Resource) -> Resource:
	var old = equipped_weapon
	equipped_weapon = weapon
	return old

## Serialize to dictionary
func to_dict() -> Dictionary:
	var weapon_dict = {}
	if equipped_weapon and equipped_weapon.has_method("to_dict"):
		weapon_dict = equipped_weapon.to_dict()
		
	var quick_slot_list = []
	for slot in quick_slots:
		if slot and slot.has_method("to_dict"):
			quick_slot_list.append(slot.to_dict())
		else:
			quick_slot_list.append(null)
	
	var deck_list = []
	for card in deck:
		if card and card.has_method("to_dict"):
			deck_list.append(card.to_dict())

	return {
		"unit_name": unit_name,
		"unit_class": unit_class,
		"level": level,
		"experience": experience,
		"is_player_unit": is_player_unit,
		"current_hp": current_hp,
		"current_armor": current_armor,
		"max_hp": max_hp,
		"strength": strength,
		"magic": magic,
		"skill": skill,
		"speed": speed,
		"luck": luck,
		"defense": defense,
		"resistance": resistance,
		"movement": movement,
		"hp_growth": hp_growth,
		"str_growth": str_growth,
		"mag_growth": mag_growth,
		"skl_growth": skl_growth,
		"spd_growth": spd_growth,
		"lck_growth": lck_growth,
		"def_growth": def_growth,
		"res_growth": res_growth,
		"equipped_weapon": weapon_dict,
		"quick_slots": quick_slot_list,
		"deck": deck_list,
		"max_ap": max_ap,
		"is_capture_target": is_capture_target,
		"bounty_value": bounty_value
	}


## Deserialize from dictionary
func from_dict(data: Dictionary) -> void:
	unit_name = data.get("unit_name", "Unit")
	unit_class = data.get("unit_class", UnitClass.FIGHTER)
	level = data.get("level", 1)
	experience = data.get("experience", 0)
	is_player_unit = data.get("is_player_unit", true)
	current_hp = data.get("current_hp", 20)
	max_hp = data.get("max_hp", 20)
	strength = data.get("strength", 5)
	magic = data.get("magic", 0)
	skill = data.get("skill", 5)
	speed = data.get("speed", 5)
	luck = data.get("luck", 5)
	defense = data.get("defense", 5)
	current_armor = data.get("current_armor", defense)
	resistance = data.get("resistance", 2)
	movement = data.get("movement", 5)
	
	hp_growth = data.get("hp_growth", 50)
	str_growth = data.get("str_growth", 40)
	mag_growth = data.get("mag_growth", 0)
	skl_growth = data.get("skl_growth", 35)
	spd_growth = data.get("spd_growth", 35)
	lck_growth = data.get("lck_growth", 30)
	def_growth = data.get("def_growth", 25)
	res_growth = data.get("res_growth", 20)
	
	is_capture_target = data.get("is_capture_target", false)
	bounty_value = data.get("bounty_value", 0)
	max_ap = data.get("max_ap", 3)

	# Deserialize Deck
	deck.clear()
	var deck_data = data.get("deck", [])
	for card_dict in deck_data:
		var new_card = CardData.new()
		new_card.from_dict(card_dict)
		deck.append(new_card)

	# Deserialize Weapon
	var weapon_data = data.get("equipped_weapon", {})
	if not weapon_data.is_empty():
		var new_weapon = ItemData.new()
		new_weapon.from_dict(weapon_data)
		equipped_weapon = new_weapon
	else:
		equipped_weapon = null
		
	# Deserialize Quick Slots
	quick_slots = [null, null]
	var qs_data = data.get("quick_slots", [])
	for i in range(min(qs_data.size(), 2)):
		if qs_data[i] != null and qs_data[i] is Dictionary:
			var qs_item = ItemData.new()
			qs_item.from_dict(qs_data[i])
			quick_slots[i] = qs_item

	# Legacy: migrate old inventory to quick_slots if present
	var legacy_inv = data.get("inventory", [])
	if qs_data.is_empty() and not legacy_inv.is_empty():
		for i in range(min(legacy_inv.size(), 2)):
			if legacy_inv[i] is Dictionary:
				var item = ItemData.new()
				item.from_dict(legacy_inv[i])
				quick_slots[i] = item
