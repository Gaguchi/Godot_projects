class_name ItemData
extends Resource
## ItemData - Defines weapons, consumables, and key items

enum ItemType {
	WEAPON,
	CONSUMABLE,
	KEY_ITEM
}

enum WeaponType {
	NONE,
	SWORD,
	LANCE,
	AXE,
	BOW,
	TOME,
	STAFF
}

@export_group("Identity")
@export var item_name: String = "Item"
@export var description: String = ""
@export var item_type: ItemType = ItemType.WEAPON
@export var icon: Texture2D

@export_group("Weapon Stats")
@export var weapon_type: WeaponType = WeaponType.SWORD
@export var might: int = 5          # Damage bonus
@export var hit: int = 90           # Accuracy bonus
@export var crit: int = 0           # Critical hit bonus
@export var weight: int = 5         # Affects attack speed
@export var range_min: int = 1      # Minimum attack range
@export var range_max: int = 1      # Maximum attack range

@export_group("Durability")
@export var max_uses: int = 30
@export var current_uses: int = 30
@export var is_unbreakable: bool = false

@export_group("Consumable Effects")
@export var heal_amount: int = 0    # HP restored when used
@export var stat_boost: String = "" # Which stat to boost temporarily
@export var boost_amount: int = 0   # How much to boost

@export_group("Value")
@export var buy_price: int = 100
@export var sell_price: int = 50


## Use the item, returns true if successful
func use() -> bool:
	if is_unbreakable:
		return true
	
	if current_uses <= 0:
		return false
	
	current_uses -= 1
	return true


## Check if item is broken
func is_broken() -> bool:
	return not is_unbreakable and current_uses <= 0


## Repair the item
func repair(amount: int = -1) -> void:
	if amount < 0:
		current_uses = max_uses
	else:
		current_uses = min(max_uses, current_uses + amount)


## Get weapon triangle advantage against another weapon type
## Returns: 1 for advantage, -1 for disadvantage, 0 for neutral
static func get_triangle_advantage(attacker_type: WeaponType, defender_type: WeaponType) -> int:
	# Sword > Axe > Lance > Sword
	match attacker_type:
		WeaponType.SWORD:
			if defender_type == WeaponType.AXE:
				return 1
			elif defender_type == WeaponType.LANCE:
				return -1
		WeaponType.LANCE:
			if defender_type == WeaponType.SWORD:
				return 1
			elif defender_type == WeaponType.AXE:
				return -1
		WeaponType.AXE:
			if defender_type == WeaponType.LANCE:
				return 1
			elif defender_type == WeaponType.SWORD:
				return -1
	
	return 0  # Neutral (bows, tomes, staves, or same type)


## Get weapon type display name
func get_weapon_type_name() -> String:
	match weapon_type:
		WeaponType.NONE: return "None"
		WeaponType.SWORD: return "Sword"
		WeaponType.LANCE: return "Lance"
		WeaponType.AXE: return "Axe"
		WeaponType.BOW: return "Bow"
		WeaponType.TOME: return "Tome"
		WeaponType.STAFF: return "Staff"
		_: return "Unknown"


## Check if this is a ranged weapon (range > 1)
func is_ranged() -> bool:
	return range_max > 1


## Check if this can only attack at range (like bows)
func is_ranged_only() -> bool:
	return range_min > 1
