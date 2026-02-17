extends Node
## EventManager - Handles random travel encounters (dialogue events + battles)
## Loads event definitions and enemy group templates from JSON.
## Called by world_map.gd per-hop during travel.

signal encounter_rolled(encounter: Dictionary)

const EVENTS_PATH = "res://data/events/travel_events.json"
const ENEMY_GROUPS_PATH = "res://data/events/enemy_groups.json"

## Base chance (0.0–1.0) of an encounter per hop
var encounter_rate: float = 0.35

## Loaded data
var _travel_events: Array = []
var _enemy_groups: Dictionary = {}

## Tracking
var completed_one_shots: Array[String] = []


func _ready() -> void:
	_load_travel_events()
	_load_enemy_groups()
	print("[EventManager] Initialized — %d events, %d enemy groups" % [_travel_events.size(), _enemy_groups.size()])


# =============================================================================
# Data Loading
# =============================================================================

func _load_travel_events() -> void:
	var file = FileAccess.open(EVENTS_PATH, FileAccess.READ)
	if not file:
		push_warning("[EventManager] No travel events file at: " + EVENTS_PATH)
		return
	var json = JSON.new()
	if json.parse(file.get_as_text()) != OK:
		push_error("[EventManager] Failed to parse travel events: " + json.get_error_message())
		return
	_travel_events = json.data if json.data is Array else []


func _load_enemy_groups() -> void:
	var file = FileAccess.open(ENEMY_GROUPS_PATH, FileAccess.READ)
	if not file:
		push_warning("[EventManager] No enemy groups file at: " + ENEMY_GROUPS_PATH)
		return
	var json = JSON.new()
	if json.parse(file.get_as_text()) != OK:
		push_error("[EventManager] Failed to parse enemy groups: " + json.get_error_message())
		return
	_enemy_groups = json.data if json.data is Dictionary else {}


# =============================================================================
# Encounter Rolling
# =============================================================================

## Roll for a travel encounter. Returns a dict describing the encounter or { "type": "none" }.
func roll_travel_encounter() -> Dictionary:
	if randf() > encounter_rate:
		return { "type": "none" }

	var available = _get_available_events()
	if available.is_empty():
		return { "type": "none" }

	var event = _pick_weighted_random(available)
	if event.is_empty():
		return { "type": "none" }

	# Mark one-shot events
	if event.get("one_shot", false):
		completed_one_shots.append(event["id"])

	var result: Dictionary = {
		"type": event.get("type", "dialogue"),
		"event_id": event.get("id", ""),
	}

	match result["type"]:
		"dialogue":
			result["dialogue_id"] = event.get("dialogue_id", "")
		"battle":
			result["enemy_group"] = event.get("enemy_group", "")
			result["name"] = _enemy_groups.get(event.get("enemy_group", ""), {}).get("name", "Enemy Encounter")
			# Pass capture_targets metadata if present
			var ct: Array = event.get("capture_targets", [])
			if not ct.is_empty():
				result["capture_targets"] = ct

	encounter_rolled.emit(result)
	EventBus.travel_encounter_started.emit(result)
	print("[EventManager] Encounter rolled: %s" % result)
	return result


## Get events that pass their conditions and haven't been one-shot completed.
func _get_available_events() -> Array:
	var available: Array = []
	for event in _travel_events:
		var eid: String = event.get("id", "")
		if event.get("one_shot", false) and eid in completed_one_shots:
			continue
		if not _check_conditions(event.get("conditions", [])):
			continue
		available.append(event)
	return available


## Pick a random event using weights.
func _pick_weighted_random(events: Array) -> Dictionary:
	var total_weight: float = 0.0
	for event in events:
		total_weight += event.get("weight", 1.0)

	if total_weight <= 0.0:
		return {}

	var roll: float = randf() * total_weight
	var cumulative: float = 0.0
	for event in events:
		cumulative += event.get("weight", 1.0)
		if roll <= cumulative:
			return event

	return events[-1]


## Check an array of conditions. Delegates to shared EventBus implementation.
func _check_conditions(conditions: Array) -> bool:
	return EventBus.check_conditions(conditions)


# =============================================================================
# Enemy Generation
# =============================================================================

## Generate an array of enemy UnitData from an enemy group template.
## Also returns capture_targets metadata via GameManager.pending_battle if applicable.
func generate_enemies(group_id: String) -> Array:
	var group = _enemy_groups.get(group_id, {})
	if group.is_empty():
		push_warning("[EventManager] Unknown enemy group: " + group_id)
		return _generate_fallback_enemies()

	var enemies: Array = []
	var templates: Array = group.get("enemies", [])
	for template in templates:
		var count: int = template.get("count", 1)
		for i in range(count):
			var enemy = _create_enemy_from_template(template, i)
			enemies.append(enemy)

	if enemies.is_empty():
		return _generate_fallback_enemies()
	return enemies


func _create_enemy_from_template(template: Dictionary, index: int) -> UnitData:
	var enemy = UnitData.new()
	var level: int = template.get("level", 1)
	var base_name: String = template.get("name", "Enemy")

	enemy.unit_name = base_name if template.get("count", 1) == 1 else "%s %d" % [base_name, index + 1]
	enemy.is_player_unit = false
	enemy.level = level
	enemy.unit_class = _parse_unit_class(template.get("class", "FIGHTER"))

	# Scale stats by level. Weapon might grows at half rate to keep ATK in check.
	var wmight: int = 5 + int(level / 2.0)  # Weapon might scales slowly
	match enemy.unit_class:
		UnitData.UnitClass.FIGHTER:
			enemy.max_hp = 18 + (level * 2)
			enemy.strength = 5 + level
			enemy.skill = 4 + level
			enemy.speed = 4 + randi() % (level + 2)
			enemy.defense = 3 + int(level / 2.0)
			enemy.resistance = 1 + int(level / 3.0)
			enemy.luck = 2 + randi() % 3
			enemy.movement = 5
			_equip_weapon(enemy, _random_melee_type(), wmight, 85)
		UnitData.UnitClass.KNIGHT:
			enemy.max_hp = 22 + (level * 3)
			enemy.strength = 6 + level
			enemy.skill = 3 + level
			enemy.speed = 2 + randi() % (level + 1)
			enemy.defense = 6 + level
			enemy.resistance = 1 + int(level / 4.0)
			enemy.luck = 1 + randi() % 2
			enemy.movement = 4
			_equip_weapon(enemy, ItemData.WeaponType.LANCE, wmight + 2, 80)
		UnitData.UnitClass.ARCHER:
			enemy.max_hp = 16 + (level * 2)
			enemy.strength = 4 + level
			enemy.skill = 6 + level
			enemy.speed = 5 + randi() % (level + 2)
			enemy.defense = 2 + int(level / 2.0)
			enemy.resistance = 2 + int(level / 3.0)
			enemy.luck = 3 + randi() % 3
			enemy.movement = 5
			_equip_weapon(enemy, ItemData.WeaponType.BOW, wmight, 90, 2)
		UnitData.UnitClass.MAGE:
			enemy.max_hp = 14 + (level * 2)
			enemy.magic = 6 + level
			enemy.strength = 1
			enemy.skill = 5 + level
			enemy.speed = 4 + randi() % (level + 2)
			enemy.defense = 1 + int(level / 3.0)
			enemy.resistance = 5 + level
			enemy.luck = 2 + randi() % 3
			enemy.movement = 5
			_equip_weapon(enemy, ItemData.WeaponType.TOME, wmight, 85, 1, 2)
		UnitData.UnitClass.THIEF:
			enemy.max_hp = 15 + (level * 2)
			enemy.strength = 3 + level
			enemy.skill = 5 + level
			enemy.speed = 7 + level
			enemy.defense = 2 + int(level / 3.0)
			enemy.resistance = 2 + int(level / 2.0)
			enemy.luck = 5 + randi() % 4
			enemy.movement = 6
			_equip_weapon(enemy, ItemData.WeaponType.SWORD, wmight - 1, 95)
		_:
			# Generic fallback
			enemy.max_hp = 18 + (level * 2)
			enemy.strength = 4 + level
			enemy.skill = 4 + level
			enemy.speed = 4 + randi() % (level + 2)
			enemy.defense = 3 + int(level / 2.0)
			enemy.resistance = 1 + int(level / 3.0)
			enemy.luck = 2 + randi() % 3
			enemy.movement = 5
			_equip_weapon(enemy, _random_melee_type(), wmight, 85)

	enemy.current_hp = enemy.max_hp
	# Mages and Clerics have no armor — they trade protection for magic power
	if enemy.unit_class == UnitData.UnitClass.MAGE or enemy.unit_class == UnitData.UnitClass.CLERIC:
		enemy.current_armor = 0
	else:
		enemy.current_armor = enemy.defense

	# Handle capture_target and bounty_value from template
	if template.get("capture_target", false):
		enemy.is_capture_target = true
	var bv: int = template.get("bounty_value", 0)
	if bv > 0:
		enemy.bounty_value = bv

	return enemy


func _equip_weapon(enemy: UnitData, wtype: ItemData.WeaponType, might: int, hit: int, range_min: int = 1, range_max: int = 1) -> void:
	var weapon = ItemData.new()
	weapon.weapon_type = wtype
	weapon.might = might
	weapon.hit = hit
	weapon.range_min = range_min
	weapon.range_max = range_max
	weapon.weight = max(1, might - 2)
	enemy.equipped_weapon = weapon


func _random_melee_type() -> ItemData.WeaponType:
	var types = [ItemData.WeaponType.SWORD, ItemData.WeaponType.LANCE, ItemData.WeaponType.AXE]
	return types[randi() % types.size()]


func _generate_fallback_enemies() -> Array:
	var enemies: Array = []
	for i in range(2):
		var enemy = UnitData.new()
		enemy.unit_name = "Bandit %d" % (i + 1)
		enemy.is_player_unit = false
		enemy.max_hp = 18
		enemy.current_hp = 18
		enemy.strength = 5
		enemy.speed = 4
		enemy.defense = 3
		enemy.current_armor = 3
		enemy.skill = 4
		enemy.luck = 2
		_equip_weapon(enemy, _random_melee_type(), 5, 85)
		enemies.append(enemy)
	return enemies


func _parse_unit_class(class_str: String) -> UnitData.UnitClass:
	match class_str.to_upper():
		"FIGHTER": return UnitData.UnitClass.FIGHTER
		"KNIGHT": return UnitData.UnitClass.KNIGHT
		"CAVALIER": return UnitData.UnitClass.CAVALIER
		"ARCHER": return UnitData.UnitClass.ARCHER
		"MAGE": return UnitData.UnitClass.MAGE
		"CLERIC": return UnitData.UnitClass.CLERIC
		"THIEF": return UnitData.UnitClass.THIEF
		"LORD": return UnitData.UnitClass.LORD
		"BEAST": return UnitData.UnitClass.FIGHTER  # Beasts use FIGHTER stats
	return UnitData.UnitClass.FIGHTER


# =============================================================================
# Save / Load
# =============================================================================

func get_save_data() -> Dictionary:
	return {
		"completed_one_shots": completed_one_shots.duplicate(),
	}


func load_save_data(data: Dictionary) -> void:
	completed_one_shots.clear()
	for eid in data.get("completed_one_shots", []):
		completed_one_shots.append(eid)


func reset() -> void:
	completed_one_shots.clear()
