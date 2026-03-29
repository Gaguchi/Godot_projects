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
	STAFF,
	CROSSBOW
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

@export_group("Grid Size")
@export var grid_width: int = 1
@export var grid_height: int = 1


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
		WeaponType.CROSSBOW: return "Crossbow"
		_: return "Unknown"


## Check if this is a ranged weapon (range > 1)
func is_ranged() -> bool:
	return range_max > 1


## Create an ItemData from a catalog dictionary entry
## Handles string-to-enum conversion for item_type and weapon_type
static func create_from_dict(data: Dictionary) -> ItemData:
	var item := ItemData.new()
	item.item_name = data.get("item_name", "Item")
	item.description = data.get("description", "")

	# Handle string or int item_type
	var it = data.get("item_type", 0)
	if it is String:
		match it:
			"WEAPON": item.item_type = ItemType.WEAPON
			"CONSUMABLE": item.item_type = ItemType.CONSUMABLE
			"KEY_ITEM": item.item_type = ItemType.KEY_ITEM
			_: item.item_type = ItemType.WEAPON
	else:
		item.item_type = it

	# Handle string or int weapon_type
	var wt = data.get("weapon_type", 0)
	if wt is String:
		match wt:
			"NONE": item.weapon_type = WeaponType.NONE
			"SWORD": item.weapon_type = WeaponType.SWORD
			"LANCE": item.weapon_type = WeaponType.LANCE
			"AXE": item.weapon_type = WeaponType.AXE
			"BOW": item.weapon_type = WeaponType.BOW
			"TOME": item.weapon_type = WeaponType.TOME
			"STAFF": item.weapon_type = WeaponType.STAFF
			"CROSSBOW": item.weapon_type = WeaponType.CROSSBOW
			_: item.weapon_type = WeaponType.NONE
	else:
		item.weapon_type = wt

	item.might = data.get("might", 0)
	item.hit = data.get("hit", 0)
	item.crit = data.get("crit", 0)
	item.weight = data.get("weight", 0)
	item.range_min = data.get("range_min", 1)
	item.range_max = data.get("range_max", 1)
	item.max_uses = data.get("max_uses", 1)
	item.current_uses = data.get("current_uses", item.max_uses)
	item.is_unbreakable = data.get("is_unbreakable", false)
	item.heal_amount = data.get("heal_amount", 0)
	item.stat_boost = data.get("stat_boost", "")
	item.boost_amount = data.get("boost_amount", 0)
	item.buy_price = data.get("buy_price", 0)
	item.sell_price = data.get("sell_price", 0)
	item.grid_width = data.get("grid_width", 1)
	item.grid_height = data.get("grid_height", 1)
	return item


## Serialize to dictionary
func to_dict() -> Dictionary:
	return {
		"item_name": item_name,
		"description": description,
		"item_type": item_type,
		# icon is not serialized - loaded from resources or path if dynamic
		"weapon_type": weapon_type,
		"might": might,
		"hit": hit,
		"crit": crit,
		"weight": weight,
		"range_min": range_min,
		"range_max": range_max,
		"max_uses": max_uses,
		"current_uses": current_uses,
		"is_unbreakable": is_unbreakable,
		"heal_amount": heal_amount,
		"stat_boost": stat_boost,
		"boost_amount": boost_amount,
		"buy_price": buy_price,
		"sell_price": sell_price,
		"grid_width": grid_width,
		"grid_height": grid_height,
	}


## Deserialize from dictionary
func from_dict(data: Dictionary) -> void:
	item_name = data.get("item_name", "Item")
	description = data.get("description", "")
	item_type = data.get("item_type", ItemType.WEAPON)
	weapon_type = data.get("weapon_type", WeaponType.SWORD)
	might = data.get("might", 5)
	hit = data.get("hit", 90)
	crit = data.get("crit", 0)
	weight = data.get("weight", 5)
	range_min = data.get("range_min", 1)
	range_max = data.get("range_max", 1)
	max_uses = data.get("max_uses", 30)
	current_uses = data.get("current_uses", 30)
	is_unbreakable = data.get("is_unbreakable", false)
	heal_amount = data.get("heal_amount", 0)
	stat_boost = data.get("stat_boost", "")
	boost_amount = data.get("boost_amount", 0)
	buy_price = data.get("buy_price", 100)
	sell_price = data.get("sell_price", 50)
	grid_width = data.get("grid_width", 1)
	grid_height = data.get("grid_height", 1)
