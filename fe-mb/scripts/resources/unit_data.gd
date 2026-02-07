class_name UnitData
extends Resource
## UnitData - Defines a unit's stats, class, and growth rates
## Used for both player units and enemies

enum UnitClass {
	FIGHTER,    # Balanced melee
	KNIGHT,     # High defense, low speed
	CAVALIER,   # High movement
	ARCHER,     # Ranged physical
	MAGE,       # Ranged magic
	CLERIC,     # Healer
	THIEF,      # High speed, lockpicking
	LORD        # Player's main character
}

@export_group("Identity")
@export var unit_name: String = "Unit"
@export var unit_class: UnitClass = UnitClass.FIGHTER
@export var level: int = 1
@export var experience: int = 0
@export var is_player_unit: bool = true

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
@export var resistance: int = 2    # Legacy stat (unused — armor absorbs all damage)
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
@export var inventory: Array[Resource] = []  # Array of ItemData

const EXP_TO_LEVEL: int = 100  # EXP needed to level up


func _init() -> void:
	current_hp = max_hp
	current_armor = defense


## Check if unit is alive
func is_alive() -> bool:
	return current_hp > 0


## Take damage — armor absorbs first, overflow goes to HP. Returns true if unit dies.
func take_damage(amount: int) -> bool:
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
	current_armor = defense


## Reset armor to max (called at the start of each combat room)
func reset_armor() -> void:
	current_armor = defense


## Add experience and check for level up
func add_experience(amount: int) -> bool:
	experience += amount
	if experience >= EXP_TO_LEVEL:
		experience -= EXP_TO_LEVEL
		_level_up()
		return true
	return false


## Process level up with growth rates
func _level_up() -> void:
	level += 1
	
	# Roll for each stat gain based on growth rate
	if randi() % 100 < hp_growth:
		max_hp += 1
		current_hp += 1  # Also heal the gained HP
	if randi() % 100 < str_growth:
		strength += 1
	if randi() % 100 < mag_growth:
		magic += 1
	if randi() % 100 < skl_growth:
		skill += 1
	if randi() % 100 < spd_growth:
		speed += 1
	if randi() % 100 < lck_growth:
		luck += 1
	if randi() % 100 < def_growth:
		defense += 1
		current_armor += 1  # Also gain the armor immediately
	if randi() % 100 < res_growth:
		resistance += 1
	
	print("[UnitData] %s leveled up to %d!" % [unit_name, level])


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
	return "Unknown"


## Add item to inventory
func add_item(item: Resource) -> void:
	if item is ItemData:
		inventory.append(item)


## Remove item from inventory by index
func remove_item(index: int) -> Resource:
	if index >= 0 and index < inventory.size():
		return inventory.pop_at(index)
	return null


## Equip item from inventory (swaps with current weapon if applicable)
## Returns true if successful
func equip_item(index: int) -> bool:
	if index < 0 or index >= inventory.size():
		return false
		
	var item = inventory[index]
	if not item is ItemData:
		return false
		
	# Only weapons can be equipped
	if item.item_type != ItemData.ItemType.WEAPON:
		print("[UnitData] Cannot equip non-weapon item: %s" % item.item_name)
		return false
		
	# Unequip current weapon first (to inventory)
	if equipped_weapon:
		inventory.append(equipped_weapon)
		equipped_weapon = null
		
	# Equip new weapon (remove from inventory)
	# Note: We append old weapon to end, so index might have shifted if we don't watch out.
	# But actually, we should remove the item from inventory FIRST before adding the old one.
	inventory.remove_at(index)
	equipped_weapon = item
	
	return true


## Unequip current weapon to inventory
func unequip_weapon() -> void:
	if equipped_weapon:
		inventory.append(equipped_weapon)
		equipped_weapon = null

## Serialize to dictionary
func to_dict() -> Dictionary:
	var weapon_dict = {}
	if equipped_weapon and equipped_weapon.has_method("to_dict"):
		weapon_dict = equipped_weapon.to_dict()
		
	var inventory_list = []
	for item in inventory:
		if item and item.has_method("to_dict"):
			inventory_list.append(item.to_dict())
	
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
		"inventory": inventory_list
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
	current_armor = data.get("current_armor", defense)
	strength = data.get("strength", 5)
	magic = data.get("magic", 0)
	skill = data.get("skill", 5)
	speed = data.get("speed", 5)
	luck = data.get("luck", 5)
	defense = data.get("defense", 5)
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
	
	# Deserialize Weapon
	var weapon_data = data.get("equipped_weapon", {})
	if not weapon_data.is_empty():
		var new_weapon = ItemData.new()
		new_weapon.from_dict(weapon_data)
		equipped_weapon = new_weapon
	else:
		equipped_weapon = null
		
	# Deserialize Inventory
	inventory.clear()
	var inventory_data = data.get("inventory", [])
	for item_dict in inventory_data:
		var new_item = ItemData.new()
		new_item.from_dict(item_dict)
		inventory.append(new_item)
