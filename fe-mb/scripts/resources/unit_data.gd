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

@export_group("Base Stats")
@export var max_hp: int = 20
@export var strength: int = 5      # Physical damage
@export var magic: int = 0         # Magic damage
@export var skill: int = 5         # Hit rate, crit rate
@export var speed: int = 5         # Avoid, double attacks
@export var luck: int = 5          # Crit avoid, various checks
@export var defense: int = 5       # Physical damage reduction
@export var resistance: int = 2    # Magic damage reduction
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


## Check if unit is alive
func is_alive() -> bool:
	return current_hp > 0


## Take damage, return true if unit dies
func take_damage(amount: int) -> bool:
	current_hp = max(0, current_hp - amount)
	return current_hp <= 0


## Heal HP
func heal(amount: int) -> void:
	current_hp = min(max_hp, current_hp + amount)


## Full heal
func full_heal() -> void:
	current_hp = max_hp


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
	var base_crit = skill / 2
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
		_: return "Unknown"
