extends Node2D
## Test battle initializer - Sets up units with stats and weapons for testing

@onready var battlefield = $Battlefield


func _ready() -> void:
	# Initialize units after scene is ready
	await get_tree().process_frame
	_initialize_units()


func _initialize_units() -> void:
	var units = $Battlefield/Units.get_children()
	
	# Unit configurations: [name, class, is_player, stats_override]
	var unit_configs = [
		["Roland", UnitData.UnitClass.LORD, true, {"max_hp": 22, "strength": 7, "skill": 7, "speed": 8}],
		["Marcus", UnitData.UnitClass.KNIGHT, true, {"max_hp": 28, "strength": 9, "defense": 10, "speed": 4}],
		["Elena", UnitData.UnitClass.MAGE, true, {"max_hp": 18, "magic": 8, "resistance": 8}],
		["Bandit", UnitData.UnitClass.FIGHTER, false, {"max_hp": 18, "strength": 6}],
		["Rogue", UnitData.UnitClass.THIEF, false, {"max_hp": 16, "speed": 9, "skill": 8}],
	]
	
	for i in range(min(units.size(), unit_configs.size())):
		var unit = units[i]
		var config = unit_configs[i]
		
		# Create UnitData
		var data = UnitData.new()
		data.unit_name = config[0]
		data.unit_class = config[1]
		data.is_player_unit = config[2]
		
		# Apply stat overrides
		var stats = config[3]
		data.max_hp = stats.get("max_hp", 20)
		data.current_hp = data.max_hp
		data.strength = stats.get("strength", 5)
		data.magic = stats.get("magic", 0)
		data.skill = stats.get("skill", 5)
		data.speed = stats.get("speed", 5)
		data.luck = stats.get("luck", 5)
		data.defense = stats.get("defense", 5)
		data.resistance = stats.get("resistance", 2)
		
		# Create and equip weapon
		data.equipped_weapon = _create_weapon_for_class(data.unit_class)
		
		# Assign to unit node
		unit.unit_data = data
		
		# Update visuals
		var sprite = unit.get_node_or_null("Sprite")
		if sprite:
			sprite.modulate = Color.DODGER_BLUE if data.is_player_unit else Color.CRIMSON
		
		print("[TestBattle] Created %s (%s) with %s" % [
			data.unit_name,
			data.get_class_name(),
			data.equipped_weapon.item_name if data.equipped_weapon else "no weapon"
		])


func _create_weapon_for_class(unit_class: UnitData.UnitClass) -> ItemData:
	var weapon = ItemData.new()
	
	match unit_class:
		UnitData.UnitClass.LORD:
			weapon.item_name = "Rapier"
			weapon.weapon_type = ItemData.WeaponType.SWORD
			weapon.might = 7
			weapon.hit = 95
			weapon.crit = 10
			weapon.weight = 5
		UnitData.UnitClass.FIGHTER:
			weapon.item_name = "Iron Axe"
			weapon.weapon_type = ItemData.WeaponType.AXE
			weapon.might = 8
			weapon.hit = 75
			weapon.crit = 0
			weapon.weight = 10
		UnitData.UnitClass.KNIGHT:
			weapon.item_name = "Iron Lance"
			weapon.weapon_type = ItemData.WeaponType.LANCE
			weapon.might = 7
			weapon.hit = 80
			weapon.crit = 0
			weapon.weight = 8
		UnitData.UnitClass.MAGE:
			weapon.item_name = "Fire"
			weapon.weapon_type = ItemData.WeaponType.TOME
			weapon.might = 5
			weapon.hit = 90
			weapon.crit = 0
			weapon.weight = 4
			weapon.range_max = 2
		UnitData.UnitClass.THIEF:
			weapon.item_name = "Iron Dagger"
			weapon.weapon_type = ItemData.WeaponType.SWORD
			weapon.might = 3
			weapon.hit = 100
			weapon.crit = 5
			weapon.weight = 2
		_:
			weapon.item_name = "Iron Sword"
			weapon.weapon_type = ItemData.WeaponType.SWORD
			weapon.might = 5
			weapon.hit = 90
			weapon.crit = 0
			weapon.weight = 5
	
	return weapon
